package progress

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

type RedisProgressHub struct {
	client  *redis.Client
	pubSub  *redis.PubSub
	clients sync.Map // fileID -> *websocket.Conn
	ctx     context.Context
	cancel  context.CancelFunc
}

func NewProgressHub(rdb *redis.Client) *RedisProgressHub {
	ctx, cancel := context.WithCancel(context.Background())
	hub := &RedisProgressHub{
		client: rdb,
		ctx:    ctx,
		cancel: cancel,
	}
	go hub.subscribe()
	return hub
}

func (h *RedisProgressHub) Register(fileID string, ws *websocket.Conn) {
	fmt.Printf("DEBUG: Registering client for fileID: %s\n", fileID)
	h.clients.Store(fileID, ws)
	// Send cached progress if exists
	if data, err := h.client.HGet(h.ctx, "csv:progress:cache", fileID).Result(); err == nil {
		var prog map[string]interface{}
		if json.Unmarshal([]byte(data), &prog) == nil {
			ws.WriteJSON(gin.H{"type": "progress", "job_id": fileID, "progress": prog})
		}
	}
}

func (h *RedisProgressHub) Unregister(fileID string) {
	fmt.Printf("DEBUG: Unregistering client for fileID: %s\n", fileID)
	h.clients.Delete(fileID)
}

func (h *RedisProgressHub) Publish(ctx context.Context, jobID string, data map[string]interface{}) error {
	data["timestamp"] = time.Now().UnixMilli()

	// 1. Prepare the full event for PubSub
	evt := map[string]interface{}{
		"job_id": jobID,
		"data":   data,
	}
	evtJSON, _ := json.Marshal(evt)

	// 2. Prepare just the data for caching
	dataJSON, _ := json.Marshal(data)

	pipe := h.client.Pipeline()
	pipe.Publish(ctx, "csv:progress", evtJSON)
	pipe.HSet(ctx, "csv:progress:cache", jobID, dataJSON)
	pipe.Expire(ctx, "csv:progress:cache", 24*time.Hour)
	cmds, err := pipe.Exec(ctx)
	if err != nil {
		fmt.Printf("DEBUG: Redis pipe.Exec error: %v\n", err)
	} else {
		fmt.Printf("DEBUG: Published to Redis, cmds: %v\n", cmds)
	}
	return nil
}

func (h *RedisProgressHub) subscribe() {
	h.pubSub = h.client.Subscribe(h.ctx, "csv:progress")
	ch := h.pubSub.Channel()
	fmt.Println("DEBUG: ProgressHub subscriber started")
	for msg := range ch {
		fmt.Printf("DEBUG: Received Redis message: %s\n", msg.Payload)
		var evt struct {
			JobID string                 `json:"job_id"`
			Data  map[string]interface{} `json:"data"`
		}
		if json.Unmarshal([]byte(msg.Payload), &evt) != nil {
			fmt.Printf("DEBUG: Failed to unmarshal message: %s\n", msg.Payload)
			continue
		}
		if ws, ok := h.clients.Load(evt.JobID); ok {
			fmt.Printf("DEBUG: Forwarding progress to fileID: %s\n", evt.JobID)
			conn := ws.(*websocket.Conn)
			conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
			if err := conn.WriteJSON(gin.H{"type": "progress", "job_id": evt.JobID, "progress": evt.Data}); err != nil {
				fmt.Printf("DEBUG: WriteJSON error: %v\n", err)
			}
		} else {
			fmt.Printf("DEBUG: No client found for fileID: %s\n", evt.JobID)
		}
	}
}

func (h *RedisProgressHub) Shutdown() {
	h.cancel()
	if h.pubSub != nil {
		h.pubSub.Close()
	}
}

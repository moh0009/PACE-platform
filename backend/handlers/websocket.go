package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var wsOrigins []string

func SetWSOrigins(origins []string) {
	wsOrigins = origins
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins
	},
}

func (h *Handler) HandleProgressWS(c *gin.Context) {
	fileID := c.Query("fileId")
	if fileID == "" {
		c.JSON(400, gin.H{"error": "missing fileId"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade failed: %v", err)
		return
	}

	h.ProgressHub.Register(fileID, ws)
	defer h.ProgressHub.Unregister(fileID)
	defer ws.Close()

	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
}

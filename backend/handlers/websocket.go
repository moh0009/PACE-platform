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
	log.Printf("[WebSocket] Allowed origins: %v", origins)
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		log.Printf("[WebSocket] Origin header: '%s'", origin)

		// Allow if no Origin header (same-origin or internal requests)
		if origin == "" {
			log.Printf("[WebSocket] No origin header, allowing (same-origin/internal)")
			return true
		}

		// Check against allowed origins
		for _, allowed := range wsOrigins {
			if origin == allowed {
				log.Printf("[WebSocket] Origin matched: %s", allowed)
				return true
			}
		}

		log.Printf("[WebSocket] Origin rejected. Received: %s, Allowed: %v", origin, wsOrigins)
		return false
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
		log.Printf("[WebSocket] Upgrade failed for fileId=%s: %v", fileID, err)
		return
	}

	log.Printf("[WebSocket] Connection established for fileId=%s", fileID)

	h.ProgressHub.Register(fileID, ws)
	defer h.ProgressHub.Unregister(fileID)
	defer ws.Close()

	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
}

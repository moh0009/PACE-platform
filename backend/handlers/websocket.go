package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/moh0009/file-upload-fullstack-task/backend/errors"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// TODO: In production, validate origin against allowed domains
		// For now, allowing localhost for development
		origin := r.Header.Get("Origin")
		return origin == "http://localhost:3000" || origin == "http://localhost:3001"
	},
	Error: func(w http.ResponseWriter, r *http.Request, status int, reason error) {
		fmt.Printf("WebSocket upgrade error: status=%d, reason=%v\n", status, reason)
	},
}

func (h *Handler) HandleProgressWS(c *gin.Context) {
	fileID := c.Query("fileId")
	if fileID == "" {
		appErr := errors.NewMissingRequiredFieldError("fileId")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeNetwork, "WEBSOCKET_UPGRADE_FAILED", "Failed to upgrade connection to WebSocket", http.StatusBadRequest)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
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

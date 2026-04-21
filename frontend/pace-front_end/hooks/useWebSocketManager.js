import { useEffect, useRef, useCallback } from "react";
import { ManagedWebSocket } from "../lib/websocket";

/**
 * useWebSocketManager — Manage ManagedWebSocket instances for file uploads.
 * Handles creating, tracking, and cleaning up WebSocket connections.
 */
export function useWebSocketManager() {
  const activeSockets = useRef(new Map());

  /**
   * Create and track a new WebSocket connection for a file
   */
  const createSocket = useCallback((fileId, callbacks) => {
    // Destroy any existing socket for this file
    if (activeSockets.current.has(fileId)) {
      activeSockets.current.get(fileId).destroy();
      activeSockets.current.delete(fileId);
    }

    const mws = new ManagedWebSocket(fileId, callbacks);
    activeSockets.current.set(fileId, mws);
    return mws;
  }, []);

  /**
   * Get an existing socket by file ID
   */
  const getSocket = useCallback((fileId) => {
    return activeSockets.current.get(fileId);
  }, []);

  /**
   * Destroy a socket by file ID
   */
  const destroySocket = useCallback((fileId) => {
    const mws = activeSockets.current.get(fileId);
    if (mws) {
      mws.destroy();
      activeSockets.current.delete(fileId);
    }
  }, []);

  /**
   * Check if a socket exists for a file
   */
  const hasSocket = useCallback((fileId) => {
    return activeSockets.current.has(fileId);
  }, []);

  // Cleanup all sockets on unmount
  useEffect(() => {
    return () => {
      activeSockets.current.forEach(mws => mws.destroy());
      activeSockets.current.clear();
    };
  }, []);

  return {
    createSocket,
    getSocket,
    destroySocket,
    hasSocket,
    activeSockets: activeSockets.current,
  };
}

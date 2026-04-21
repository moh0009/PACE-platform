import { useState, useCallback } from "react";

/**
 * useAccessibilityAnnouncements — Manage screen reader announcements
 */
export function useAccessibilityAnnouncements() {
  const [liveMsg, setLiveMsg] = useState("");

  const announce = useCallback((msg) => {
    setLiveMsg("");
    // RAF ensures the DOM sees the empty string before the new one
    requestAnimationFrame(() => setLiveMsg(msg));
  }, []);

  return { liveMsg, announce };
}

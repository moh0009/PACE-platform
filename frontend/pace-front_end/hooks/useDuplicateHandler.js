import { useState, useCallback, useEffect } from "react";

/**
 * useDuplicateHandler — Manage duplicate file handling queue
 */
export function useDuplicateHandler() {
  const [duplicateQueue, setDuplicateQueue] = useState([]);
  const [duplicateQueueTotal, setDuplicateQueueTotal] = useState(0);
  const [currentDuplicate, setCurrentDuplicate] = useState(null);

  // Process next duplicate when queue changes
  useEffect(() => {
    if (duplicateQueue.length > 0 && !currentDuplicate) {
      setCurrentDuplicate(duplicateQueue[0]);
    }
  }, [duplicateQueue, currentDuplicate]);

  /**
   * Add files to duplicate queue
   */
  const addDuplicates = useCallback((files) => {
    setDuplicateQueue(prev => [...prev, ...files]);
    setDuplicateQueueTotal(prev => prev + files.length);
  }, []);

  /**
   * Handle duplicate confirmation/rejection
   */
  const handleDuplicateResponse = useCallback((confirmed) => {
    setDuplicateQueue(prev => prev.slice(1));
    setCurrentDuplicate(null);
    return confirmed;
  }, []);

  /**
   * Clear entire duplicate queue
   */
  const clearQueue = useCallback(() => {
    setDuplicateQueue([]);
    setCurrentDuplicate(null);
    setDuplicateQueueTotal(0);
  }, []);

  return {
    duplicateQueue,
    duplicateQueueTotal,
    currentDuplicate,
    addDuplicates,
    handleDuplicateResponse,
    clearQueue,
  };
}

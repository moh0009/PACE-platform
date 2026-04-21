import { useCallback } from "react";
import { uploadChunk, isNetworkError } from "../lib/utils";
import fetchAPI from "../lib/utils";

/**
 * useUploadHandler — Handle file upload logic with chunking
 */
export function useUploadHandler(chunkSize = 5 * 1024 * 1024) {
  /**
   * Create a file object with metadata
   */
  const createFileObject = useCallback((file) => {
    const sizeMB = file.size / (1024 * 1024);
    const expectedTimeMs = Math.max(2000, sizeMB * 500);
    
    return {
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      size: file.size,
      status: "Pending",
      progress_upload: 0,
      progress_processing: 0,
      expectedTimeMs,
      startedAt: null,
      completedAt: null,
      uploadStartedAt: null,
      uploadCompletedAt: null,
      processStartedAt: null,
      processCompletedAt: null,
      file,
      error: null,
    };
  }, []);

  /**
   * Upload a single file in chunks
   */
  const uploadFile = useCallback(async (fileObj) => {
    const file = fileObj.file;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
        await uploadChunk({ 
          chunk, 
          chunkIndex: i, 
          totalChunks, 
          fileName: file.name, 
          fileId: fileObj.id 
        });
      }
    } catch (err) {
      const message = isNetworkError(err)
        ? `Network error uploading ${file.name}. Please check your connection.`
        : `Failed to upload ${file.name}: ${err.message || "Unknown error"}`;
      throw new Error(message);
    }
  }, [chunkSize]);

  /**
   * Initialize processing after upload completes
   */
  const startProcessing = useCallback(async (fileObj) => {
    try {
      await fetchAPI("/process", "POST", { 
        fileName: fileObj.name, 
        fileId: fileObj.id, 
        userId: "" 
      });
    } catch (err) {
      throw new Error(err.message || "Failed to start processing");
    }
  }, []);

  return {
    createFileObject,
    uploadFile,
    startProcessing,
  };
}

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDropzone } from "react-dropzone";
import { Play, Upload } from "lucide-react";
import { cn, uploadChunk, connectWS } from "../lib/utils";
import fetchAPI from "../lib/utils";
import File from "./File";
import DuplicateFileDialog from "./DuplicateFileDialog";
import { useNotification } from "../context/NotificationContext";
import { useFiles } from "../context/FileContext";

/**
 * UploadSection Component
 * Handles drag-and-drop file upload, chunked transfers with real progress,
 * and WebSocket-driven processing progress updates.
 */
export default function UploadSection() {
  const { files, addFile, updateFile, removeFile, replaceFile, getFileByName, isHydrated } = useFiles();
  const [duplicateQueue, setDuplicateQueue] = useState([]);
  const [duplicateQueueTotal, setDuplicateQueueTotal] = useState(0);
  const [currentDuplicate, setCurrentDuplicate] = useState(null);
  const chunkSize = 5 * 1024 * 1024; // 5 MB
  const { showNotification } = useNotification();

  // ─── Resume in-progress uploads on component mount ───────────────────────
  useEffect(() => {
    if (!isHydrated) return;

    const inProgressFiles = files.filter(f => 
      (f.status === "Uploading" || f.status === "Processing") && f.id
    );

    inProgressFiles.forEach(file => {
      // Reconnect WebSocket for in-progress files
      const ws = connectWS(file.id);
      let wsErrorHandled = false;
      const wsTimeout = setTimeout(() => {
        if (!wsErrorHandled) {
          wsErrorHandled = true;
          console.error("WebSocket timeout for resumed file:", file.name);
        }
      }, 15000);

      ws.onmessage = (event) => {
        clearTimeout(wsTimeout);
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "progress" || data.job_id !== file.id) return;

          const prog = data.progress;

          updateFile(file.id, {
            progress_upload: prog.upload_pct !== undefined ? Math.round(prog.upload_pct) : undefined,
            progress_processing: prog.process_pct !== undefined ? Math.round(prog.process_pct) : undefined,
            status:
              prog.stage === "uploading"
                ? "Uploading"
                : prog.stage === "parsing" || prog.stage === "moving"
                ? "Processing"
                : prog.stage === "complete"
                ? "Complete"
                : undefined,
          });

          if (prog.stage === "complete") {
            setTimeout(() => ws.close(), 1000);
            showNotification({ message: `${file.name} processed successfully`, type: "success" });
          }
        } catch (err) {
          console.error("Error processing resumed message:", err);
        }
      };

      ws.onerror = () => {
        clearTimeout(wsTimeout);
        if (!wsErrorHandled) {
          wsErrorHandled = true;
          console.error("WebSocket error for resumed file:", file.name);
        }
      };
    });
  }, [isHydrated, files, updateFile, showNotification]);

  // ─── Process duplicate queue ──────────────────────────────────────────────
  useEffect(() => {
    if (duplicateQueue.length > 0 && !currentDuplicate) {
      setCurrentDuplicate(duplicateQueue[0]);
    }
  }, [duplicateQueue, currentDuplicate]);

  // ─── Drop handler with duplicate detection ────────────────────────────────
  const onDrop = React.useCallback(acceptedFiles => {
    const duplicates = [];
    
    acceptedFiles.forEach(file => {
      const existingFile = getFileByName(file.name);
      
      if (existingFile && existingFile.status === "Pending") {
        // Queue this duplicate for confirmation
        duplicates.push(file);
      } else if (existingFile && existingFile.status !== "Pending") {
        // Completed files can be replaced without confirmation
        const newFile = createFileObject(file);
        replaceFile(existingFile.id, newFile);
        showNotification({ message: `${file.name} re-added for processing`, type: "info" });
      } else {
        // New file
        const newFile = createFileObject(file);
        addFile(newFile);
        showNotification({ message: `${file.name} added`, type: "info" });
      }
    });

    // Add all duplicates to queue
    if (duplicates.length > 0) {
      setDuplicateQueue(prev => [...prev, ...duplicates]);
      setDuplicateQueueTotal(prev => prev + duplicates.length);
    }
  }, [getFileByName, addFile, replaceFile, showNotification]);

  const createFileObject = (file) => {
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
  };

  const handleDuplicateConfirm = (confirmed) => {
    if (confirmed && currentDuplicate) {
      const existingFile = getFileByName(currentDuplicate.name);
      if (existingFile) {
        const newFile = createFileObject(currentDuplicate);
        replaceFile(existingFile.id, newFile);
        showNotification({ message: `${currentDuplicate.name} will be replaced`, type: "warning" });
      }
    }
    
    // Move to next duplicate in queue
    setDuplicateQueue(prev => prev.slice(1));
    setCurrentDuplicate(null);
  };

  // ─── Remove pending file ───────────────────────────────────────────────────
  // Removed - now using removeFile from FileContext

  // ─── Chunked upload with error handling ────────────────────────────────────
  /**
   * Uploads `fileObj.file` in chunks. Progress updates are sent from backend via WebSocket.
   */
  const uploadFile = async (fileObj) => {
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
          fileId: fileObj.id,
        });
      }
      // Progress now sent from backend via WebSocket
    } catch (err) {
      updateFile(fileObj.id, {
        error: err.message || "Upload failed",
        status: "Error",
      });
      
      if (err.message && err.message.includes("Network")) {
        showNotification({
          message: `Network error uploading ${file.name}. Please check your connection.`,
          type: "error",
          duration: 6000,
        });
      } else {
        showNotification({
          message: `Failed to upload ${file.name}: ${err.message || "Unknown error"}`,
          type: "error",
          duration: 6000,
        });
      }
      throw err;
    }
  };

  // ─── Start pipeline with comprehensive error handling ──────────────────────
  const startUpload = async () => {
    let pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) return;

    // Check for files without blob data (loaded from localStorage)
    const filesWithoutBlob = pendingFiles.filter(f => !f.file);
    const filesWithBlob = pendingFiles.filter(f => f.file);

    if (filesWithoutBlob.length > 0) {
      const fileNames = filesWithoutBlob.map(f => f.name).join(", ");
      showNotification({
        message: `Cannot re-upload previously saved files (${fileNames}). Please remove and re-add them.`,
        type: "warning",
        duration: 5000,
      });
      // Remove files without blob from pending list
      pendingFiles = filesWithBlob;
      if (pendingFiles.length === 0) return;
    }

    // Phase 1: mark all pending as Uploading and open WebSockets
    pendingFiles.forEach(f => {
      updateFile(f.id, { status: "Uploading", startedAt: Date.now(), uploadStartedAt: Date.now() });
    });

    const activeSessions = await Promise.all(pendingFiles.map(file =>
      new Promise((resolve) => {
        const ws = connectWS(file.id);
        let wsErrorHandled = false;
        const wsTimeout = setTimeout(() => {
          if (!wsErrorHandled) {
            wsErrorHandled = true;
            updateFile(file.id, {
              error: "WebSocket connection timeout",
              status: "Error",
            });
            showNotification({
              message: `Connection timeout for ${file.name}. Server may be down.`,
              type: "error",
              duration: 6000,
            });
            ws.close();
            resolve({ file, ws, error: true, errorType: "timeout" });
          }
        }, 15000); // 15 second timeout

        ws.onmessage = (event) => {
          clearTimeout(wsTimeout);
          try {
            const data = JSON.parse(event.data);
            if (data.type !== "progress" || data.job_id !== file.id) return;

            const prog = data.progress;

            // Handle completion and other state updates
            updateFile(file.id, {
              progress_upload: prog.upload_pct !== undefined ? Math.round(prog.upload_pct) : undefined,
              progress_processing: prog.process_pct !== undefined ? Math.round(prog.process_pct) : undefined,
              status:
                prog.stage === "uploading"
                  ? "Uploading"
                  : prog.stage === "parsing" || prog.stage === "moving"
                  ? "Processing"
                  : prog.stage === "complete"
                  ? "Complete"
                  : undefined,
              uploadCompletedAt:
                prog.upload_pct === 100 && !files.find(f => f.id === file.id)?.uploadCompletedAt
                  ? Date.now()
                  : undefined,
              processStartedAt:
                (prog.stage === "parsing" || prog.stage === "moving") &&
                !files.find(f => f.id === file.id)?.processStartedAt
                  ? Date.now()
                  : undefined,
              processCompletedAt:
                prog.stage === "complete" && !files.find(f => f.id === file.id)?.processCompletedAt
                  ? Date.now()
                  : undefined,
              completedAt: prog.stage === "complete" && !files.find(f => f.id === file.id)?.completedAt ? Date.now() : undefined,
            });

            if (prog.stage === "complete") {
              setTimeout(() => ws.close(), 1000);
              showNotification({ message: `${file.name} processed successfully`, type: "success" });
            }
          } catch (err) {
            console.error("Error processing message:", err);
            updateFile(file.id, {
              error: "Failed to parse server message",
              status: "Error",
            });
          }
        };

        ws.onopen = async () => {
          clearTimeout(wsTimeout);
          showNotification({ message: `Uploading ${file.name}`, type: "info" });
          try {
            await uploadFile(file);

            // After upload, trigger backend processing
            fetchAPI("/process", "POST", { fileName: file.name, fileId: file.id, userId: "" })
              .then(() => showNotification({ message: `Processing ${file.name}`, type: "info" }))
              .catch(err => {
                console.error("Failed to start processing for", file.name, err);
                updateFile(file.id, {
                  error: err.message || "Failed to start processing",
                  status: "Error",
                });
                showNotification({
                  message: `Server error processing ${file.name}. Please try again.`,
                  type: "error",
                  duration: 6000,
                });
              });

            resolve({ file, ws });
          } catch (err) {
            // uploadFile already updated state and showed notification
            resolve({ file, ws, error: true, errorType: "upload" });
          }
        };

        ws.onerror = (err) => {
          clearTimeout(wsTimeout);
          if (!wsErrorHandled) {
            wsErrorHandled = true;
            console.error("WS error for", file.name, err);
            updateFile(file.id, {
              error: "WebSocket connection failed",
              status: "Error",
            });
            showNotification({
              message: `Connection error for ${file.name}. Check server status.`,
              type: "error",
              duration: 6000,
            });
            resolve({ file, ws, error: true, errorType: "connection" });
          }
        };
      })
    ));

    // Manage sessions and provide feedback
    const errorSessions = activeSessions.filter(s => s.error);
    if (errorSessions.length > 0) {
      const errorCount = errorSessions.length;
      const successCount = activeSessions.length - errorCount;
      if (successCount > 0) {
        showNotification({
          message: `${successCount} file(s) queued, ${errorCount} failed. Check details above.`,
          type: "warning",
          duration: 5000,
        });
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    }
  });

  return (
    <section className="mb-16">
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20 border-2 border-dashed transition-all text-center mb-8 cursor-pointer group",
          isDragActive 
            ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_50px_rgba(79,70,229,0.2)]" 
            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/50"
        )}
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-indigo-600/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-purple-600/5 blur-3xl" />

        <input {...getInputProps()} />
        <div className="relative z-10">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
            <Upload size={40} />
          </div>
          <h4 className="text-2xl md:text-3xl font-black mb-4 text-white">
            {isDragActive ? (
              <span className="text-indigo-400">Release to drop files</span>
            ) : (
              <>
                Drop datasets or <span className="text-indigo-500">Browse</span>
              </>
            )}
          </h4>
          <p className="text-gray-500 text-lg font-medium max-w-md mx-auto">
            High-speed ingestion for .CSV files up to 2GB. Multiple files supported.
          </p>
        </div>
      </div>

      <File files={files} onRemove={removeFile} />
      
      {files.some(f => f.status === "Pending") && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={startUpload}
          className="w-full sm:w-auto mt-8 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Play size={20} fill="currentColor" />
          Start Processing Pipeline
        </motion.button>
      )}

      <AnimatePresence>
        {currentDuplicate && (
          <DuplicateFileDialog
            fileName={currentDuplicate.name}
            currentIndex={duplicateQueueTotal - duplicateQueue.length + 1}
            total={duplicateQueueTotal}
            onConfirm={handleDuplicateConfirm}
            onCancel={() => {
              setDuplicateQueue(prev => prev.slice(1));
              setCurrentDuplicate(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

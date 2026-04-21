import React, { useCallback, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { useDropzone } from "react-dropzone";
import File from "./File";
import DuplicateFileDialog from "./DuplicateFileDialog";
import DropZoneArea from "./DropZoneArea";
import UploadActions from "./UploadActions";
import MetricsDisplay from "./MetricsDisplay";
import { useNotification } from "../context/NotificationContext";
import { useFiles } from "../context/FileContext";
import { useWebSocketManager } from "../hooks/useWebSocketManager";
import { useDuplicateHandler } from "../hooks/useDuplicateHandler";
import { useUploadHandler } from "../hooks/useUploadHandler";
import { useMetricsCalculator } from "../hooks/useMetricsCalculator";
import { useAccessibilityAnnouncements } from "../hooks/useAccessibilityAnnouncements";
import { isNetworkError } from "../lib/utils";
import fetchAPI from "../lib/utils";


/**
 * UploadSection — Main component orchestrating file upload with drag-drop,
 * chunked transfer, WebSocket progress tracking, and metrics display.
 *
 * Responsibilities delegated to custom hooks and sub-components:
 * - useWebSocketManager: WebSocket lifecycle
 * - useDuplicateHandler: Duplicate queue management
 * - useUploadHandler: File object creation & chunked upload
 * - useMetricsCalculator: Performance metrics
 * - useAccessibilityAnnouncements: Screen reader announcements
 *
 * Sub-components:
 * - DropZoneArea: Drag-drop UI
 * - UploadActions: Control buttons
 * - MetricsDisplay: Performance metrics table
 * - File: File list with status
 * - DuplicateFileDialog: Duplicate confirmation
 */
export default function UploadSection() {
  const { files, addFile, updateFile, removeFile, replaceFile, getFileByName, isHydrated } = useFiles();
  const { showNotification } = useNotification();
  const { liveMsg, announce } = useAccessibilityAnnouncements();
  const wsManager = useWebSocketManager();
  const duplicateHandler = useDuplicateHandler();
  const uploadHandler = useUploadHandler();
  const metricsData = useMetricsCalculator(files);

  // ─── Drop handler ─────────────────────────────────────────────────────
  const onDrop = useCallback(
    (acceptedFiles) => {
      const duplicates = [];

      acceptedFiles.forEach((file) => {
        const existingFile = getFileByName(file.name);

        if (existingFile && existingFile.status === "Pending") {
          duplicates.push(file);
        } else if (existingFile && existingFile.status !== "Pending") {
          const newFile = uploadHandler.createFileObject(file);
          replaceFile(existingFile.id, newFile);
          showNotification({
            message: `${file.name} re-added for processing`,
            type: "info",
          });
        } else {
          const newFile = uploadHandler.createFileObject(file);
          addFile(newFile);
          showNotification({ message: `${file.name} added`, type: "info" });
        }
      });

      if (duplicates.length > 0) {
        duplicateHandler.addDuplicates(duplicates);
      }
    },
    [getFileByName, addFile, replaceFile, showNotification]
  );


  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    noClick: true,
    noKeyboard: true,
  });

  // ─── Resume in-progress uploads on mount ──────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;

    const inProgressFiles = files.filter(
      (f) => (f.status === "Uploading" || f.status === "Processing") && f.id
    );

    inProgressFiles.forEach((file) => {
      if (wsManager.hasSocket(file.id)) return;

      const mws = wsManager.createSocket(file.id, {
        onMessage: (data) => handleProgressUpdate(data, file),
        onReconnect: (attempt) => handleReconnect(attempt, file),
        onMaxRetriesReached: () => handleMaxRetriesReached(file),
      });
    });
  }, [isHydrated]);

  // ─── Progress update handler ──────────────────────────────────────────
  const handleProgressUpdate = (data, file) => {
    if (data.type !== "progress" || data.job_id !== file.id) return;
    const prog = data.progress;

    updateFile(file.id, {
      progress_upload:
        prog.upload_pct !== undefined ? Math.round(prog.upload_pct) : undefined,
      progress_processing:
        prog.process_pct !== undefined ? Math.round(prog.process_pct) : undefined,
      status:
        prog.stage === "uploading"
          ? "Uploading"
          : prog.stage === "parsing" || prog.stage === "moving"
          ? "Processing"
          : prog.stage === "complete"
          ? "Complete"
          : undefined,
      uploadCompletedAt: prog.upload_pct === 100 ? Date.now() : undefined,
      processCompletedAt: prog.stage === "complete" ? Date.now() : undefined,
      completedAt: prog.stage === "complete" ? Date.now() : undefined,
    });

    if (prog.stage === "complete") {
      wsManager.destroySocket(file.id);
      showNotification({
        message: `${file.name} processed successfully`,
        type: "success",
      });
      announce(`${file.name} has been processed successfully.`);
    }
  };

  // ─── Reconnect handler ────────────────────────────────────────────────
  const handleReconnect = (attempt, file) => {
    showNotification({
      message: `Reconnecting for ${file.name}… (attempt ${attempt})`,
      type: "warning",
    });
    announce(`Reconnecting for ${file.name}, attempt ${attempt}.`);
  };

  // ─── Max retries handler ──────────────────────────────────────────────
  const handleMaxRetriesReached = (file) => {
    updateFile(file.id, {
      error: "Connection lost. Could not reconnect.",
      status: "Error",
    });
    showNotification({
      message: `Could not reconnect for ${file.name}. Check server status.`,
      type: "error",
      duration: 7000,
    });
    announce(`Connection permanently lost for ${file.name}.`);
  };

  // ─── Duplicate confirmation handler ────────────────────────────────────
  const handleDuplicateConfirm = (confirmed) => {
    if (confirmed && duplicateHandler.currentDuplicate) {
      const existingFile = getFileByName(duplicateHandler.currentDuplicate.name);
      if (existingFile) {
        const newFile = uploadHandler.createFileObject(duplicateHandler.currentDuplicate);
        replaceFile(existingFile.id, newFile);
        showNotification({
          message: `${duplicateHandler.currentDuplicate.name} will be replaced`,
          type: "warning",
        });
      }
    }
    duplicateHandler.handleDuplicateResponse(confirmed);
  };

  // ─── Start upload pipeline ─────────────────────────────────────────────
  const startUpload = async () => {
    let pendingFiles = files.filter((f) => f.status === "Pending");
    if (pendingFiles.length === 0) return;

    const filesWithoutBlob = pendingFiles.filter((f) => !f.file);
    const filesWithBlob = pendingFiles.filter((f) => f.file);

    if (filesWithoutBlob.length > 0) {
      const fileNames = filesWithoutBlob.map((f) => f.name).join(", ");
      showNotification({
        message: `Cannot re-upload previously saved files (${fileNames}). Please remove and re-add them.`,
        type: "warning",
        duration: 5000,
      });
      pendingFiles = filesWithBlob;
      if (pendingFiles.length === 0) return;
    }

    pendingFiles.forEach((f) => {
      updateFile(f.id, {
        status: "Uploading",
        startedAt: Date.now(),
        uploadStartedAt: Date.now(),
      });
    });

    const activeSessions = await Promise.all(
      pendingFiles.map(
        (file) =>
          new Promise((resolve) => {
            const mws = wsManager.createSocket(file.id, {
              onOpen: () => handleUploadStart(file, mws, resolve),
              onMessage: (data) => handleProgressUpdate(data, file),
              onReconnect: (attempt) => handleReconnect(attempt, file),
              onMaxRetriesReached: () => {
                handleMaxRetriesReached(file);
                resolve({ file, mws, error: true, errorType: "connection" });
              },
            });
          })
      )
    );

    const errorSessions = activeSessions.filter((s) => s?.error);
    if (errorSessions.length > 0) {
      const successCount = activeSessions.length - errorSessions.length;
      if (successCount > 0) {
        showNotification({
          message: `${successCount} file(s) queued, ${errorSessions.length} failed.`,
          type: "warning",
          duration: 5000,
        });
      }
    }
  };

  // ─── Upload start handler ──────────────────────────────────────────────
  const handleUploadStart = async (file, mws, resolve) => {
    showNotification({ message: `Uploading ${file.name}`, type: "info" });
    announce(`Started uploading ${file.name}.`);

    try {
      await uploadHandler.uploadFile(file);
      await uploadHandler.startProcessing(file);
      updateFile(file.id, { processStartedAt: Date.now() });
      showNotification({
        message: `Processing ${file.name}`,
        type: "info",
      });
      announce(`${file.name} is now being processed.`);
      resolve({ file, mws });
    } catch (err) {
      const msg = isNetworkError(err)
        ? `Network error uploading ${file.name}. Please check your connection.`
        : `Failed to upload ${file.name}: ${err.message || "Unknown error"}`;
      updateFile(file.id, {
        error: err.message || "Upload failed",
        status: "Error",
      });
      showNotification({ message: msg, type: "error", duration: 6000 });
      resolve({ file, mws, error: true, errorType: "upload" });
    }
  };

  // ─── Clear processed files ─────────────────────────────────────────────
  const clearProcessedFiles = () => {
    const processedFiles = files.filter(
      (f) => f.status === "Complete" || f.status === "Error"
    );
    processedFiles.forEach((f) => removeFile(f.id));
    const count = processedFiles.length;
    if (count > 0) {
      showNotification({
        message: `Cleared ${count} processed file(s)`,
        type: "info",
      });
    }
  };

  const hasPendingFiles = files.some((f) => f.status === "Pending");
  const hasProcessedFiles = files.some(
    (f) => f.status === "Complete" || f.status === "Error"
  );

  return (
    <section className="mb-16" role="region" aria-label="File upload area">
      {/* Visually-hidden live region for screen-reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        {liveMsg}
      </div>

      {/* Dropzone */}
      <DropZoneArea
        isDragActive={isDragActive}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        open={open}
      />

      {/* File List */}
      <File files={files} onRemove={removeFile} />

      {/* Metrics Display */}
      <AnimatePresence>
        <MetricsDisplay metricsData={metricsData} />
      </AnimatePresence>

      {/* Duplicate Dialog */}
      <AnimatePresence>
        {duplicateHandler.currentDuplicate && (
          <DuplicateFileDialog
            fileName={duplicateHandler.currentDuplicate.name}
            currentIndex={
              duplicateHandler.duplicateQueueTotal -
              duplicateHandler.duplicateQueue.length +
              1
            }
            total={duplicateHandler.duplicateQueueTotal}
            onConfirm={handleDuplicateConfirm}
            onCancel={() => {
              duplicateHandler.handleDuplicateResponse(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <UploadActions
        hasPendingFiles={hasPendingFiles}
        hasProcessedFiles={hasProcessedFiles}
        onStartUpload={startUpload}
        onClearProcessed={clearProcessedFiles}
      />
    </section>
  );
}

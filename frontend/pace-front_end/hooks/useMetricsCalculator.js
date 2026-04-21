import { useMemo } from "react";

/**
 * useMetricsCalculator — Calculate and format upload/processing metrics
 */
export function useMetricsCalculator(files) {
  const metricsData = useMemo(() => {
    const completedFiles = files.filter(f => f.status === "Complete");
    if (completedFiles.length === 0) return null;

    const metrics = completedFiles.map(f => ({
      name: f.name,
      uploadTime: f.uploadCompletedAt && f.uploadStartedAt 
        ? f.uploadCompletedAt - f.uploadStartedAt 
        : 0,
      processingTime: f.processCompletedAt && f.processStartedAt 
        ? f.processCompletedAt - f.processStartedAt 
        : 0,
      totalTime: f.completedAt && f.startedAt 
        ? f.completedAt - f.startedAt 
        : 0,
    }));

    const totalUploadTime = metrics.reduce((sum, m) => sum + m.uploadTime, 0);
    const totalProcessingTime = metrics.reduce((sum, m) => sum + m.processingTime, 0);
    const overallTime = metrics.reduce((sum, m) => sum + m.totalTime, 0);

    return { metrics, totalUploadTime, totalProcessingTime, overallTime };
  }, [files]);

  return metricsData;
}

/**
 * formatTime — Convert milliseconds to human-readable time format
 */
export function formatTime(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
}

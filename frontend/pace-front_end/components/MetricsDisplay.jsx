import React from "react";
import { motion } from "motion/react";
import { Upload, Settings } from "lucide-react";
import { formatTime } from "../hooks/useMetricsCalculator";

/**
 * MetricsDisplay — Display upload/processing metrics
 */
export default function MetricsDisplay({ metricsData }) {
  if (!metricsData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
    >
      <h3 className="text-xl font-bold text-white mb-4">Processing Metrics</h3>

      {/* Per-file metrics */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          Per-File Breakdown
        </h4>
        <div className="space-y-2">
          {metricsData.metrics.map((metric, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <span className="text-white font-medium truncate">{metric.name}</span>
              <div className="flex gap-4 text-sm text-gray-300">
                <span>
                  Upload time:{" "}
                  <Upload
                    size={14}
                    className="inline-block text-indigo-400"
                    aria-hidden="true"
                  />{" "}
                  {formatTime(metric.uploadTime)}
                </span>
                <span>
                  Processing time:{" "}
                  <Settings
                    size={14}
                    className="inline-block text-purple-400"
                    aria-hidden="true"
                  />{" "}
                  {formatTime(metric.processingTime)}
                </span>
                <span className="font-semibold text-indigo-300">
                  Total time: {formatTime(metric.totalTime)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall metrics */}
      <div className="border-t border-indigo-500/20 pt-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          Overall Summary
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-gray-400 text-xs font-medium mb-1">Total Upload Time</p>
            <p className="text-2xl font-bold text-indigo-300">
              {formatTime(metricsData.totalUploadTime)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-gray-400 text-xs font-medium mb-1">Total Processing Time</p>
            <p className="text-2xl font-bold text-purple-300">
              {formatTime(metricsData.totalProcessingTime)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30">
            <p className="text-gray-300 text-xs font-medium mb-1">Overall Time</p>
            <p className="text-2xl font-bold text-white">
              {formatTime(metricsData.overallTime)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

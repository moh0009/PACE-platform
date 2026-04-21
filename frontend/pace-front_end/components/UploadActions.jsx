import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Trash2 } from "lucide-react";

/**
 * UploadActions — Action buttons for upload and clear operations
 */
export default function UploadActions({
  hasPendingFiles,
  hasProcessedFiles,
  onStartUpload,
  onClearProcessed,
}) {
  return (
    <AnimatePresence>
      {hasPendingFiles && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onStartUpload}
          aria-label="Start Processing Pipeline"
          aria-disabled={!hasPendingFiles}
          className="w-full sm:w-auto mt-8 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Play size={20} fill="currentColor" aria-hidden="true" />
          Start Processing Pipeline
        </motion.button>
      )}

      {hasProcessedFiles && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onClearProcessed}
          aria-label="Clear Processed Files"
          className="w-full sm:w-auto mt-4 bg-red-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Trash2 size={20} aria-hidden="true" />
          Clear Processed Files
        </motion.button>
      )}
    </AnimatePresence>
  );
}

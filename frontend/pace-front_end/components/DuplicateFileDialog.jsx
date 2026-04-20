import React, { useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "../lib/utils";

export default function DuplicateFileDialog({ fileName, currentIndex, total, onConfirm, onCancel }) {
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white/[0.02] border border-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md shadow-2xl"
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertCircle size={24} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">File Already Exists</h3>
            {total > 1 && (
              <p className="text-xs text-gray-400 mt-1">File {currentIndex} of {total}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">
              "{fileName}" will be replaced. All progress will be reset.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <input
            type="checkbox"
            id="confirm-replace"
            checked={replaceConfirmed}
            onChange={(e) => setReplaceConfirmed(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <label htmlFor="confirm-replace" className="text-sm text-gray-300 cursor-pointer flex-1">
            I understand the file will be replaced and progress reset
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-2xl border border-white/10 text-white font-semibold hover:bg-white/5 transition-all"
          >
            {total > 1 ? "Skip This" : "Cancel"}
          </button>
          <button
            onClick={() => onConfirm(replaceConfirmed)}
            disabled={!replaceConfirmed}
            className={cn(
              "flex-1 px-4 py-3 rounded-2xl font-semibold transition-all",
              replaceConfirmed
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            )}
          >
            Replace File
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

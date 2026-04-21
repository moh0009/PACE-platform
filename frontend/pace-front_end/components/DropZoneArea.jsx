import React from "react";
import { Upload } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * DropZoneArea — Drag-and-drop area for CSV file uploads
 */
export default function DropZoneArea({
  isDragActive,
  getRootProps,
  getInputProps,
  open,
}) {
  return (
    <div
      {...getRootProps()}
      role="button"
      tabIndex={0}
      aria-label={
        isDragActive
          ? "Release to drop CSV files"
          : "Drop CSV files here or press Enter to browse"
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onClick={open}
      className={cn(
        "relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20 border-2 border-dashed transition-all text-center mb-8 cursor-pointer group",
        isDragActive
          ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_50px_rgba(79,70,229,0.2)]"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/50"
      )}
    >
      <div
        className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-indigo-600/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-purple-600/5 blur-3xl"
        aria-hidden="true"
      />

      <input {...getInputProps()} aria-hidden="true" />
      <div className="relative z-10">
        <div
          className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500"
          aria-hidden="true"
        >
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
  );
}

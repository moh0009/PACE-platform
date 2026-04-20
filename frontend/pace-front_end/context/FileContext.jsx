"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const FileContext = createContext(null);
const STORAGE_KEY = "pace_files";

export const useFiles = () => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useFiles must be used within a FileProvider");
  }
  return context;
};

export const FileProvider = ({ children }) => {
  const [files, setFiles] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load files from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedFiles = JSON.parse(stored);
        // Remove file objects (not serializable), keep the metadata
        const filesWithoutBlobs = parsedFiles.map(f => ({
          ...f,
          file: null, // File objects can't be serialized
        }));
        setFiles(filesWithoutBlobs);
      }
    } catch (err) {
      console.error("Failed to load files from localStorage:", err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save files to localStorage whenever they change
  useEffect(() => {
    if (isHydrated) {
      try {
        // Don't serialize file objects
        const filesToSave = files.map(f => {
          const { file, ...rest } = f;
          return rest;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filesToSave));
      } catch (err) {
        console.error("Failed to save files to localStorage:", err);
      }
    }
  }, [files, isHydrated]);

  const addFile = useCallback((file) => {
    setFiles((prev) => [...prev, file]);
  }, []);

  const updateFile = useCallback((fileId, updates) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    );
  }, []);

  const removeFile = useCallback((fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const replaceFile = useCallback((fileId, newFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? newFile : f))
    );
  }, []);

  const getFileByName = useCallback((fileName) => {
    return files.find((f) => f.name === fileName);
  }, [files]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <FileContext.Provider
      value={{
        files,
        addFile,
        updateFile,
        removeFile,
        replaceFile,
        getFileByName,
        clearFiles,
        isHydrated,
      }}
    >
      {children}
    </FileContext.Provider>
  );
};

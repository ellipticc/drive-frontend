"use client";

import { useState, useCallback } from "react";
import { IconUpload } from "@tabler/icons-react";

interface DragDropOverlayProps {
  isVisible: boolean;
  onDrop: (files: FileList) => void;
  onDragLeave: () => void;
}

export function DragDropOverlay({ isVisible, onDrop, onDragLeave }: DragDropOverlayProps) {
  const [isHovering, setIsHovering] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsHovering(false);
    onDragLeave();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onDrop(files);
    }
  }, [onDrop, onDragLeave]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-8 shadow-2xl border-2 border-dashed transition-all duration-200 ${
        isHovering
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
          : 'border-gray-300 dark:border-gray-600'
      }`}>
        <div className="text-center">
          <IconUpload className={`w-12 h-12 mx-auto mb-4 transition-colors ${
            isHovering ? 'text-blue-500' : 'text-gray-400'
          }`} />
          <h3 className="text-lg font-semibold mb-2">
            {isHovering ? 'Drop to upload' : 'Drop files here'}
          </h3>
          <p className="text-sm text-gray-500">
            Files will be securely encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
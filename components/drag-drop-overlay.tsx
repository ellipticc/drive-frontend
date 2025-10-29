"use client";

import { useState, useCallback } from "react";
import { IconUpload, IconFile, IconFolder } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-300"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in-0 duration-300" />

      {/* Modal */}
      <Card className={`relative max-w-md w-full shadow-2xl border-2 border-dashed transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in-0 duration-500 ${
        isHovering
          ? 'border-primary bg-primary/5 scale-105 shadow-primary/20'
          : 'border-muted-foreground/25 bg-card/95'
      }`}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Upload Icon */}
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
            isHovering
              ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
              : 'bg-muted text-muted-foreground'
          }`}>
            <IconUpload className={`w-8 h-8 transition-transform duration-300 ${
              isHovering ? 'scale-110' : ''
            }`} />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className={`text-xl font-semibold transition-colors duration-300 ${
              isHovering ? 'text-primary' : 'text-foreground'
            }`}>
              {isHovering ? 'Drop to Upload' : 'Drop Files Here'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isHovering
                ? 'Release to start secure upload'
                : 'Drag files or folders from your computer'
              }
            </p>
          </div>
          {/* File Types */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <IconFile className="w-4 h-4" />
              <span>Files</span>
            </div>
            <div className="flex items-center gap-1.5">
              <IconFolder className="w-4 h-4" />
              <span>Folders</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
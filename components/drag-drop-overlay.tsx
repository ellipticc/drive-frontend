"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const dragLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragOverCountRef = useRef(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverCountRef.current++;
    setIsHovering(true);
    setIsAnimatingOut(false);
    
    // Clear any pending drag leave timeout
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverCountRef.current--;
    
    if (dragOverCountRef.current <= 0) {
      dragOverCountRef.current = 0;
      setIsHovering(false);
      
      // Debounce the animation out to avoid flickering
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
      dragLeaveTimeoutRef.current = setTimeout(() => {
        setIsAnimatingOut(true);
      }, 50);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragOverCountRef.current = 0;
    setIsHovering(false);
    setIsAnimatingOut(true);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onDrop(files);
    }
    
    // Notify parent to close overlay after animation
    onDragLeave();
  }, [onDrop, onDragLeave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
    };
  }, []);

  // Handle animation completion
  useLayoutEffect(() => {
    if (isAnimatingOut && !isVisible) {
      // Defer state update to avoid synchronous setState inside effect
      requestAnimationFrame(() => {
        setIsAnimatingOut(false);
        dragOverCountRef.current = 0;
      });
    }
  }, [isVisible, isAnimatingOut]);

  if (!isVisible && !isAnimatingOut) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity ${
        isAnimatingOut 
          ? 'opacity-0 duration-200' 
          : 'opacity-100 duration-200'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity ${
        isAnimatingOut 
          ? 'opacity-0 duration-200' 
          : 'opacity-100 duration-200'
      }`} />

      {/* Modal */}
      <Card className={`relative max-w-md w-full shadow-2xl border-2 border-dashed transition-all ${
        isAnimatingOut 
          ? 'opacity-0 scale-95 duration-200' 
          : 'opacity-100 scale-100 duration-300'
      } ${
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
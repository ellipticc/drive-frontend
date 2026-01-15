/**
 * Unified Progress Modal - Handles both file uploads and downloads in a single modal
 * Combines UploadProgressModal and DownloadProgressManager functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconLoader2,
  IconFile,
  IconUpload,
  IconDownload,
  IconMaximize,
  IconPlayerPause,
  IconPlayerPlay,
  IconSquare,
  IconMinimize
} from "@tabler/icons-react";
import { UploadProgress as UploadProgressType, UploadResult } from '@/lib/upload';
import { DownloadProgress } from '@/lib/download';
import { truncateFilename, formatFileSize } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export interface FileUploadState {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: UploadProgressType | null;
  error?: string;
  result?: UploadResult;
  currentFilename?: string; // Current filename being uploaded (may be incremented for keepBoth)
  existingFileIdToDelete?: string; // ID of file to delete if this is a replace operation
}

export interface UnifiedProgressModalProps {
  // Upload props
  uploads?: FileUploadState[];
  onCancelUpload?: (uploadId: string) => void;
  onPauseUpload?: (uploadId: string) => void;
  onResumeUpload?: (uploadId: string) => void;
  onRetryUpload?: (uploadId: string) => void;
  onCancelAllUploads?: () => void;

  // Download props
  downloadProgress?: DownloadProgress | null;
  downloadFilename?: string;
  downloadFileSize?: number;
  downloadFileId?: string;
  onCancelDownload?: () => void;
  onPauseDownload?: () => void;
  onResumeDownload?: () => void;
  onRetryDownload?: () => void;
  downloadError?: string | null;
  isDownloadPaused?: boolean;
  onDownloadComplete?: (fileId: string, filename: string, fileSize: number) => void;

  // Common props
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export function UnifiedProgressModal({
  uploads = [],
  onCancelUpload,
  onPauseUpload,
  onResumeUpload,
  onRetryUpload,
  onCancelAllUploads,
  downloadProgress,
  downloadFilename,
  downloadFileSize = 0,
  downloadFileId,
  onCancelDownload,
  onPauseDownload,
  onResumeDownload,
  downloadError,
  isDownloadPaused,
  onDownloadComplete,
  open,
  onOpenChange,
  onClose
}: UnifiedProgressModalProps) {
  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [, setExpandedItems] = useState<Set<string>>(new Set());
  const downloadStartTimeRef = useRef<number | null>(null);

  // Auto-expand failed uploads
  useEffect(() => {
    const failedUploads = uploads.filter(u => u.status === 'failed').map(u => u.id);
    // Defer state update to avoid calling setState synchronously inside effect
    requestAnimationFrame(() => setExpandedItems(prev => new Set([...prev, ...failedUploads])));
  }, [uploads]);

  // Initialize download start time
  useEffect(() => {
    if ((downloadProgress || downloadError) && downloadStartTimeRef.current === null) {
      downloadStartTimeRef.current = Date.now();
    }
  }, [downloadProgress, downloadError]);

  // Handle download completion
  useEffect(() => {
    if (downloadProgress?.stage === 'complete' && onDownloadComplete && downloadFilename && downloadFileId) {
      onDownloadComplete(downloadFileId, downloadFilename, downloadFileSize);
    }
  }, [downloadProgress?.stage, onDownloadComplete, downloadFilename, downloadFileId, downloadFileSize]);



  const handleCloseAttempt = () => {
    const hasActiveUploads = uploads.some(u =>
      u.status === 'uploading' || u.status === 'pending' || u.status === 'paused'
    );
    const hasActiveDownload = downloadProgress && downloadProgress.stage !== 'complete' && !downloadError;

    if (hasActiveUploads || hasActiveDownload) {
      setShowCloseConfirm(true);
    } else {
      onClose?.();
      onOpenChange(false);
    }
  };

  const confirmClose = () => {
    onCancelAllUploads?.();
    onCancelDownload?.();
    onClose?.();
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const getUploadStatusIcon = (status: FileUploadState['status']) => {
    switch (status) {
      case 'pending':
        return <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'uploading':
        return <IconUpload className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'paused':
        return <IconPlayerPause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <IconCheck className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <IconAlertTriangle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <IconSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getUploadStatusBadge = (status: FileUploadState['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'uploading':
        return <Badge variant="default">Uploading</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Paused</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
    }
  };

  const getUploadStageDescription = (stage: UploadProgressType['stage']): string => {
    switch (stage) {
      case 'hashing':
        return 'Computing file hash';
      case 'chunking':
        return 'Splitting into chunks';
      case 'encrypting':
        return 'Encrypting chunks';
      case 'uploading':
        return 'Uploading to storage';
      case 'finalizing':
        return 'Finalizing upload';
      default:
        return stage;
    }
  };

  // Calculate overall progress
  const uploadProgress = uploads.length > 0
    ? uploads.reduce((sum, upload) => {
      if (upload.status === 'completed') return sum + 100;
      if (upload.status === 'failed' || upload.status === 'cancelled') return sum + 0;
      return sum + (upload.progress?.overallProgress || 0);
    }, 0) / uploads.length
    : 0;

  const downloadProgressValue = downloadProgress?.overallProgress || 0;

  // Calculate combined progress if both uploads and downloads are active
  const hasUploads = uploads.length > 0;
  const hasDownload = downloadProgress || downloadError;
  const combinedProgress = hasUploads && hasDownload
    ? (uploadProgress + downloadProgressValue) / 2
    : hasUploads
      ? uploadProgress
      : downloadProgressValue;

  const completedUploads = uploads.filter(u => u.status === 'completed').length;
  const failedUploads = uploads.filter(u => u.status === 'failed').length;
  const uploadingCount = uploads.filter(u => u.status === 'uploading').length;
  const pausedUploads = uploads.filter(u => u.status === 'paused').length;

  const allUploadsCompleted = uploads.length > 0 && uploads.every(u => u.status === 'completed' || u.status === 'cancelled');

  const hasActiveUploads = uploadingCount > 0 || pausedUploads > 0;
  const hasActiveDownload = downloadProgress && downloadProgress.stage !== 'complete' && !downloadError;
  const downloadCompleted = downloadProgress?.stage === 'complete';

  // Note: Modal no longer auto-closes to allow user to see completion status
  // User can manually close it when ready. Modal persists across navigation.

  // Track current time for elapsed calculations (updated every second)
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Download elapsed time tracked in state (avoid reading ref during render)
  const [downloadElapsedTime, setDownloadElapsedTime] = React.useState<number>(0);
  React.useEffect(() => {
    if (downloadStartTimeRef.current) {
      setDownloadElapsedTime(Math.round((now - downloadStartTimeRef.current) / 1000));
    } else {
      setDownloadElapsedTime(0);
    }
  }, [now, downloadProgress?.stage, downloadProgress?.overallProgress]);

  const totalActiveItems = uploads.length + (hasDownload ? 1 : 0);
  const completedItems = completedUploads + (downloadCompleted ? 1 : 0);
  const failedItems = failedUploads + (downloadError ? 1 : 0);
  const activeItems = uploadingCount + pausedUploads + (hasActiveDownload ? 1 : 0);

  if (!open) return null;

  return (
    <>
      {/* Floating Progress Modal */}
      <div className={`fixed z-50 animate-in slide-in-from-bottom-2 fade-in-0 duration-300 ${isMobile
        ? 'bottom-0 left-0 right-0 w-full h-1/5 rounded-none'
        : 'bottom-4 right-4 w-[32rem] max-w-lg'
        }`}>
        <Card className={`shadow-lg border-2 transition-all duration-200 ${isMinimized ? 'h-12' : totalActiveItems <= 2 ? 'max-h-80' : 'max-h-[32rem]'
          } ${isMobile ? 'h-full rounded-none' : ''}`}>
          {/* Header */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-move">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconUpload className="h-4 w-4" />
              File Operations
              {(completedItems > 0 || totalActiveItems > 1) && (
                <Badge variant="secondary" className="text-xs">
                  {completedItems}/{totalActiveItems}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <IconMaximize className="h-3 w-3" />
                ) : (
                  <IconMinimize className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCloseAttempt}
              >
                <IconX className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>

          {/* Minimized View */}
          {isMinimized && (
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {completedItems} completed, {activeItems} active, {failedItems} failed
                </span>
                <span className="font-medium">{Math.floor(combinedProgress)}%</span>
              </div>
              <Progress value={combinedProgress} className="h-1.5 mt-1" />
            </CardContent>
          )}

          {/* Expanded View */}
          {!isMinimized && (
            <CardContent className="pt-0 space-y-3 max-h-[calc(32rem-4rem)] overflow-hidden flex flex-col">
              {/* Overall Progress */}
              {(hasUploads || hasDownload) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Overall Progress</span>
                    <span className="text-muted-foreground">{Math.floor(combinedProgress)}%</span>
                  </div>
                  <Progress value={combinedProgress} className="h-2 transition-all duration-300 ease-out" />
                  <div className="text-xs text-muted-foreground">
                    {completedItems} completed • {activeItems} active • {failedItems} failed
                  </div>
                </div>
              )}

              {/* Individual Progress Items */}
              <div className={`flex-1 overflow-y-auto space-y-2 min-h-0 ${totalActiveItems > 5 ? 'max-h-80' : ''
                }`}>
                {/* Upload Items */}
                {uploads.slice(0, uploads.length <= 2 ? uploads.length : 5).map((upload) => (
                  <div key={upload.id} className="border rounded-lg p-3 space-y-2 bg-card/50">
                    {/* File Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate" title={upload.currentFilename || upload.file.name}>
                          {truncateFilename(upload.currentFilename || upload.file.name)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ({formatFileSize(upload.file.size)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getUploadStatusBadge(upload.status)}
                        {getUploadStatusIcon(upload.status)}
                      </div>
                    </div>

                    {/* Progress Details */}
                    {(upload.progress || upload.status === 'pending') && upload.status !== 'completed' && upload.status !== 'failed' && upload.status !== 'cancelled' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {upload.progress ? getUploadStageDescription(upload.progress.stage) : 'Queued for upload'}
                            {upload.progress && upload.progress.currentChunk && upload.progress.totalChunks &&
                              ` (${upload.progress.currentChunk}/${upload.progress.totalChunks})`
                            }
                          </span>
                          <span className="font-medium">
                            {upload.progress ? Math.round(upload.progress.overallProgress) : 0}%
                          </span>
                        </div>
                        {upload.progress && (
                          <Progress value={upload.progress.overallProgress} className="h-1 transition-all duration-300 ease-out" />
                        )}
                        {!upload.progress && (
                          <Progress value={0} className="h-1 transition-all duration-300 ease-out" />
                        )}

                        {/* Bytes processed */}
                        {upload.progress && upload.progress.bytesProcessed !== undefined &&
                          upload.progress.totalBytes !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(upload.progress.bytesProcessed)} / {formatFileSize(upload.progress.totalBytes)}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Error Display */}
                    {upload.error && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <div className="flex items-start gap-2">
                          <IconAlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-red-800">Upload Failed</p>
                            <p className="text-xs text-red-700 break-words">{upload.error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-1">
                      {upload.status === 'uploading' && onPauseUpload && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPauseUpload(upload.id)}
                          className="h-6 text-xs px-2"
                        >
                          <IconPlayerPause className="h-3 w-3 mr-1" />
                          Pause
                        </Button>
                      )}
                      {upload.status === 'paused' && onResumeUpload && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onResumeUpload(upload.id)}
                          className="h-6 text-xs px-2"
                        >
                          <IconPlayerPlay className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      )}
                      {(upload.status === 'uploading' || upload.status === 'paused' || upload.status === 'pending') && onCancelUpload && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCancelUpload(upload.id)}
                          className="h-6 text-xs px-2"
                        >
                          <IconSquare className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                      {upload.status === 'failed' && onRetryUpload && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRetryUpload(upload.id)}
                          className="h-6 text-xs px-2"
                        >
                          <IconUpload className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Download Item */}
                {hasDownload && (
                  <div className="border rounded-lg p-3 bg-card/50 group relative">
                    <div className="flex items-center justify-between">
                      {/* Left: Icon + Filename */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Determine icon based on type/mime - simplified here */}
                        <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate" title={downloadFilename}>
                            {truncateFilename(downloadFilename || '')}
                          </span>
                          {downloadError && (
                            <span className="text-xs text-red-500 truncate">{downloadError}</span>
                          )}
                        </div>
                      </div>

                      {!downloadError && downloadProgress && (
                        <div className="flex flex-col items-center justify-center px-4 flex-shrink-0">
                          <span className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                            <span>
                              {downloadProgress.bytesDownloaded !== undefined ? formatFileSize(downloadProgress.bytesDownloaded) : '0 B'}
                              {' / '}
                              {downloadProgress.totalBytes && downloadProgress.totalBytes > 0 ? formatFileSize(downloadProgress.totalBytes) : '...'}
                            </span>
                            {downloadProgress.stage === 'complete' && (
                              <span className="text-green-500 font-medium">Downloaded</span>
                            )}
                          </span>
                          {/* Small Loading Bar */}
                          <div className="w-full h-0.5 bg-muted mt-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${downloadProgress.stage === 'complete' ? 'bg-green-500' : 'bg-primary'}`}
                              style={{ width: `${downloadProgress.overallProgress || 0}%` }}
                            />
                          </div>
                        </div>
                      )}


                      {/* Right: Controls (Hover only) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!downloadError && downloadProgress?.stage !== 'complete' && (
                          <>
                            {isDownloadPaused ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={onResumeDownload}
                                className="h-7 w-7 p-0 rounded-full hover:bg-muted"
                                title="Resume"
                              >
                                <IconPlayerPlay className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={onPauseDownload}
                                className="h-7 w-7 p-0 rounded-full hover:bg-muted"
                                title="Pause"
                              >
                                <IconPlayerPause className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Cancel / Close */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={onCancelDownload}
                              className="h-7 w-7 p-0 rounded-full hover:bg-muted hover:text-destructive"
                              title="Cancel"
                            >
                              <IconX className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show scroll indicator if more than 5 upload files */}
                {uploads.length > 5 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    +{uploads.length - 5} more upload files...
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex justify-between gap-2 pt-2 border-t">
                <div className="flex gap-1">
                  {hasActiveUploads && onCancelAllUploads && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCloseConfirm(true)}
                      className="h-7 text-xs"
                    >
                      Cancel All
                    </Button>
                  )}
                  {hasActiveDownload && !hasActiveUploads && onCancelDownload && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCloseConfirm(true)}
                      className="h-7 text-xs"
                    >
                      Cancel Download
                    </Button>
                  )}
                </div>
                <div className="flex gap-1">
                  {!allUploadsCompleted && !downloadCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsMinimized(true)}
                      className="h-7 text-xs"
                    >
                      Minimize
                    </Button>
                  )}
                  {allUploadsCompleted && (!hasDownload || downloadCompleted) && (
                    <Button
                      size="sm"
                      onClick={handleCloseAttempt}
                      className="h-7 text-xs"
                    >
                      Done
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cancel Operations?</DialogTitle>
            <DialogDescription>
              You have {activeItems} active file operations. Closing this window will cancel all ongoing operations.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCloseConfirm(false)}
            >
              Continue Operations
            </Button>
            <Button
              variant="destructive"
              onClick={confirmClose}
            >
              Cancel All Operations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
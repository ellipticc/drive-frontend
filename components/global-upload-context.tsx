"use client"

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { UnifiedProgressModal, FileUploadState } from '@/components/modals/unified-progress-modal';
import { UploadManager } from '@/components/upload-manager';
import { keyManager } from '@/lib/key-manager';
import { useCurrentFolder } from '@/components/current-folder-context';
import { downloadFileToBrowser, downloadFolderAsZip, downloadMultipleItemsAsZip, DownloadProgress } from '@/lib/download';

interface GlobalUploadContextType {
  // Upload state
  uploads: FileUploadState[];
  isModalOpen: boolean;

  // Upload handlers
  handleFileUpload: () => void;
  handleFolderUpload: () => void;
  startUploadWithFiles: (files: File[], folderId: string | null) => void;
  startUploadWithFolders: (files: FileList, folderId: string | null) => void;

  // Modal controls
  openModal: () => void;
  closeModal: () => void;

  // Upload management
  cancelUpload: (uploadId: string) => void;
  pauseUpload: (uploadId: string) => void;
  resumeUpload: (uploadId: string) => void;
  retryUpload: (uploadId: string) => void;
  cancelAllUploads: () => void;

  // Upload completion callback registration
  registerOnUploadComplete: (callback: (uploadId: string, result: any) => void) => void;
  unregisterOnUploadComplete: (callback: (uploadId: string, result: any) => void) => void;

  // File addition callback for incremental updates
  registerOnFileAdded: (callback: (file: any) => void) => void;
  unregisterOnFileAdded: (callback: (file: any) => void) => void;

  // Download state
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  currentDownloadFile: { id: string; name: string; type: 'file' | 'folder' } | null;

  // Download handlers
  startFileDownload: (fileId: string, fileName: string) => Promise<void>;
  startFolderDownload: (folderId: string, folderName: string) => Promise<void>;
  startBulkDownload: (items: Array<{ id: string; name: string; type: 'file' | 'folder' }>) => Promise<void>;
  cancelDownload: () => void;
  retryDownload: () => void;
}

const GlobalUploadContext = createContext<GlobalUploadContextType | null>(null);

export function useGlobalUpload() {
  const context = useContext(GlobalUploadContext);
  if (!context) {
    throw new Error('useGlobalUpload must be used within a GlobalUploadProvider');
  }
  return context;
}

export function useOnUploadComplete(callback: (uploadId: string, result: any) => void) {
  const { registerOnUploadComplete, unregisterOnUploadComplete } = useGlobalUpload();

  React.useEffect(() => {
    registerOnUploadComplete(callback);
    return () => {
      unregisterOnUploadComplete(callback);
    };
  }, [callback, registerOnUploadComplete, unregisterOnUploadComplete]);
}

export function useOnFileAdded(callback: (file: any) => void) {
  const { registerOnFileAdded, unregisterOnFileAdded } = useGlobalUpload();

  React.useEffect(() => {
    registerOnFileAdded(callback);
    return () => {
      unregisterOnFileAdded(callback);
    };
  }, [callback, registerOnFileAdded, unregisterOnFileAdded]);
}

interface GlobalUploadProviderProps {
  children: ReactNode;
}

export function GlobalUploadProvider({ children }: GlobalUploadProviderProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [currentDownloadFile, setCurrentDownloadFile] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  // Get current folder from context
  const { currentFolderId } = useCurrentFolder();

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Upload managers
  const uploadManagersRef = useRef<Map<string, UploadManager>>(new Map());

  // Upload completion callbacks
  const onUploadCompleteCallbacksRef = useRef<Set<(uploadId: string, result: any) => void>>(new Set());
  
  // File added callbacks for incremental updates
  const onFileAddedCallbacksRef = useRef<Set<(file: any) => void>>(new Set());

  const updateUploadState = useCallback((uploadId: string, updates: Partial<FileUploadState>) => {
    setUploads(prev => prev.map(upload =>
      upload.id === uploadId ? { ...upload, ...updates } : upload
    ));
  }, []);

  const addUpload = useCallback((file: File) => {
    const uploadState: FileUploadState = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: null,
    };

    setUploads(prev => [...prev, uploadState]);
    return uploadState;
  }, []);

  const startUpload = useCallback(async (uploadState: FileUploadState) => {
    try {
      const uploadManager = new UploadManager({
        id: uploadState.id,  // Pass the upload state ID to ensure consistency
        file: uploadState.file,
        folderId: currentFolderId,
        onProgress: (task) => {
          updateUploadState(task.id, {
            status: task.status,
            progress: task.progress,
            error: task.error,
          });
        },
        onComplete: (task) => {
          updateUploadState(task.id, {
            status: 'completed',
            result: task.result,
            progress: task.progress,
          });
          // Trigger all registered upload completion callbacks
          onUploadCompleteCallbacksRef.current.forEach(callback => {
            callback(task.id, task.result);
          });
          // Trigger file added callbacks with the file data
          if (task.result && task.result.file) {
            onFileAddedCallbacksRef.current.forEach(callback => {
              callback(task.result.file);
            });
          }
        },
        onError: (task) => {
          updateUploadState(task.id, {
            status: 'failed',
            error: task.error,
          });
        },
        onCancel: (task) => {
          updateUploadState(task.id, {
            status: 'cancelled',
          });
        },
      });

      uploadManagersRef.current.set(uploadState.id, uploadManager);
      await uploadManager.start();
    } catch (error) {
      updateUploadState(uploadState.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }, [currentFolderId, updateUploadState]);

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFolderUpload = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const cancelUpload = useCallback((uploadId: string) => {
    const manager = uploadManagersRef.current.get(uploadId);
    if (manager) {
      manager.cancel();
      uploadManagersRef.current.delete(uploadId);
    }
  }, []);

  const pauseUpload = useCallback((uploadId: string) => {
    const manager = uploadManagersRef.current.get(uploadId);
    if (manager) {
      manager.pause();
    }
  }, []);

  const resumeUpload = useCallback((uploadId: string) => {
    const manager = uploadManagersRef.current.get(uploadId);
    if (manager) {
      manager.resume();
    }
  }, []);

  const retryUpload = useCallback((uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload) {
      // Reset the upload state
      updateUploadState(uploadId, {
        status: 'pending',
        progress: null,
        error: undefined,
      });
      // Start it again
      startUpload(upload);
    }
  }, [uploads, updateUploadState, startUpload]);

  const cancelAllUploads = useCallback(() => {
    // Cancel all active uploads
    uploadManagersRef.current.forEach(manager => manager.cancel());
    uploadManagersRef.current.clear();

    // Update all uploads to cancelled
    setUploads(prev => prev.map(upload => ({
      ...upload,
      status: upload.status === 'completed' ? 'completed' : 'cancelled'
    })));
  }, []);

  const registerOnUploadComplete = useCallback((callback: (uploadId: string, result: any) => void) => {
    onUploadCompleteCallbacksRef.current.add(callback);
  }, []);

  const unregisterOnUploadComplete = useCallback((callback: (uploadId: string, result: any) => void) => {
    onUploadCompleteCallbacksRef.current.delete(callback);
  }, []);

  const registerOnFileAdded = useCallback((callback: (file: any) => void) => {
    onFileAddedCallbacksRef.current.add(callback);
  }, []);

  const unregisterOnFileAdded = useCallback((callback: (file: any) => void) => {
    onFileAddedCallbacksRef.current.delete(callback);
  }, []);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to array and start uploads
    Array.from(files).forEach(file => {
      const uploadState = addUpload(file);
      startUpload(uploadState);
    });

    // Open modal
    openModal();

    // Clear the input
    e.target.value = '';
  }, [addUpload, startUpload, openModal]);

  // Handle folder selection
  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to array and start uploads
    Array.from(files).forEach(file => {
      const uploadState = addUpload(file);
      startUpload(uploadState);
    });

    // Open modal
    openModal();

    // Clear the input
    e.target.value = '';
  }, [addUpload, startUpload, openModal]);

  // Download handlers
  const startFileDownload = useCallback(async (fileId: string, fileName: string) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: fileId, name: fileName, type: 'file' });
      setIsModalOpen(true);

      const userKeys = await keyManager.getUserKeys();
      await downloadFileToBrowser(fileId, userKeys, (progress) => {
        setDownloadProgress(progress);
      });

      // Keep modal open to show completion - user can manually close
      // The modal will auto-close when all uploads complete
    } catch (error) {
      console.error('Download error:', error);
      setDownloadError(error instanceof Error ? error.message : 'Download failed');
    }
  }, []);

  const startFolderDownload = useCallback(async (folderId: string, folderName: string) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: folderId, name: folderName, type: 'folder' });
      setIsModalOpen(true);

      const userKeys = await keyManager.getUserKeys();
      await downloadFolderAsZip(folderId, folderName, userKeys, (progress) => {
        setDownloadProgress(progress);
      });

      // Keep modal open to show completion - user can manually close
    } catch (error) {
      console.error('Folder download error:', error);
      setDownloadError(error instanceof Error ? error.message : 'Folder download failed');
    }
  }, []);

  const startBulkDownload = useCallback(async (items: Array<{ id: string; name: string; type: 'file' | 'folder' }>) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: 'bulk', name: 'Multiple Items', type: 'file' });
      setIsModalOpen(true);

      const userKeys = await keyManager.getUserKeys();
      await downloadMultipleItemsAsZip(items, userKeys, (progress) => {
        setDownloadProgress(progress);
      });

      // Keep modal open to show completion - user can manually close
    } catch (error) {
      console.error('Bulk download error:', error);
      setDownloadError(error instanceof Error ? error.message : 'Bulk download failed');
    }
  }, []);

  const cancelDownload = useCallback(() => {
    // Note: The download functions don't have built-in cancellation
    // This would need to be implemented in the download functions themselves
    setDownloadProgress(null);
    setDownloadError(null);
    setCurrentDownloadFile(null);
    // Modal stays open until user explicitly closes it
  }, []);

  const startUploadWithFiles = useCallback((files: File[], folderId: string | null) => {
    files.forEach(file => {
      const uploadState = addUpload(file);
      startUpload(uploadState);
    });
    openModal();
  }, [addUpload, startUpload, openModal]);

  const startUploadWithFolders = useCallback((files: FileList, folderId: string | null) => {
    Array.from(files).forEach(file => {
      const uploadState = addUpload(file);
      startUpload(uploadState);
    });
    openModal();
  }, [addUpload, startUpload, openModal]);

  const retryDownload = useCallback(() => {
    if (!currentDownloadFile) return;

    if (currentDownloadFile.id === 'bulk') {
      // Can't retry bulk download easily
      setDownloadError('Cannot retry bulk download');
      return;
    }

    if (currentDownloadFile.type === 'folder') {
      startFolderDownload(currentDownloadFile.id, currentDownloadFile.name);
    } else {
      startFileDownload(currentDownloadFile.id, currentDownloadFile.name);
    }
  }, [currentDownloadFile, startFileDownload, startFolderDownload]);

  const contextValue: GlobalUploadContextType = {
    uploads,
    isModalOpen,
    handleFileUpload,
    handleFolderUpload,
    startUploadWithFiles,
    startUploadWithFolders,
    openModal,
    closeModal,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    retryUpload,
    cancelAllUploads,
    registerOnUploadComplete,
    unregisterOnUploadComplete,
    registerOnFileAdded,
    unregisterOnFileAdded,
    downloadProgress,
    downloadError,
    currentDownloadFile,
    startFileDownload,
    startFolderDownload,
    startBulkDownload,
    cancelDownload,
    retryDownload,
  };

  return (
    <GlobalUploadContext.Provider value={contextValue}>
      {children}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept="*/*"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderChange}
        {...({ webkitdirectory: "" } as any)}
      />

      {/* Global Progress Modal */}
      <UnifiedProgressModal
        uploads={uploads}
        onCancelUpload={cancelUpload}
        onPauseUpload={pauseUpload}
        onResumeUpload={resumeUpload}
        onRetryUpload={retryUpload}
        onCancelAllUploads={cancelAllUploads}
        downloadProgress={downloadProgress}
        downloadFilename={currentDownloadFile?.name}
        downloadFileSize={0} // This would need to be calculated
        downloadFileId={currentDownloadFile?.id}
        onCancelDownload={cancelDownload}
        onRetryDownload={retryDownload}
        downloadError={downloadError}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onClose={closeModal}
      />
    </GlobalUploadContext.Provider>
  );
}
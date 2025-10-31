"use client"

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { UnifiedProgressModal, FileUploadState } from '@/components/modals/unified-progress-modal';
import { UploadManager } from '@/components/upload-manager';
import { keyManager } from '@/lib/key-manager';
import { useCurrentFolder } from '@/components/current-folder-context';

interface GlobalUploadContextType {
  // Upload state
  uploads: FileUploadState[];
  isModalOpen: boolean;

  // Upload handlers
  handleFileUpload: () => void;
  handleFolderUpload: () => void;

  // Modal controls
  openModal: () => void;
  closeModal: () => void;

  // Upload management
  cancelUpload: (uploadId: string) => void;
  pauseUpload: (uploadId: string) => void;
  resumeUpload: (uploadId: string) => void;
  retryUpload: (uploadId: string) => void;
  cancelAllUploads: () => void;
}

const GlobalUploadContext = createContext<GlobalUploadContextType | null>(null);

export function useGlobalUpload() {
  const context = useContext(GlobalUploadContext);
  if (!context) {
    throw new Error('useGlobalUpload must be used within a GlobalUploadProvider');
  }
  return context;
}

interface GlobalUploadProviderProps {
  children: ReactNode;
}

export function GlobalUploadProvider({ children }: GlobalUploadProviderProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get current folder from context
  const { currentFolderId } = useCurrentFolder();

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Upload managers
  const uploadManagersRef = useRef<Map<string, UploadManager>>(new Map());

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
          });
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

  const contextValue: GlobalUploadContextType = {
    uploads,
    isModalOpen,
    handleFileUpload,
    handleFolderUpload,
    openModal,
    closeModal,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    retryUpload,
    cancelAllUploads,
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
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onClose={closeModal}
      />
    </GlobalUploadContext.Provider>
  );
}
"use client"

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { UnifiedProgressModal, FileUploadState } from '@/components/modals/unified-progress-modal';
import { ConflictModal } from '@/components/modals/conflict-modal';
import { UploadManager } from '@/components/upload-manager';
import { keyManager } from '@/lib/key-manager';
import { apiClient, FileItem } from '@/lib/api';
import { decryptFilename } from '@/lib/crypto';
import { masterKeyManager } from '@/lib/master-key';
import { useCurrentFolder } from '@/components/current-folder-context';
import { useUser } from '@/components/user-context';
import { toast } from 'sonner';
import { downloadEncryptedFile, downloadFileToBrowser, downloadFolderAsZip, downloadMultipleItemsAsZip, DownloadProgress, PauseController, downloadEncryptedFileWithCEK } from "@/lib/download";

import { UploadResult } from '@/lib/upload';
export type { UploadResult };
import { prepareFilesForUpload } from '@/lib/folder-upload-utils';
import { ParallelUploadQueue, getUploadQueue, destroyUploadQueue } from '@/lib/parallel-upload-queue';


interface ConflictItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  existingPath: string;
  newPath: string;
  existingItem?: FileItem;
  existingFileId?: string;
}

interface GlobalUploadContextType {
  // Upload state
  uploads: FileUploadState[];
  isModalOpen: boolean;

  // Upload handlers
  handleFileUpload: (accept?: string) => void;
  handleFolderUpload: () => void;
  startUploadWithFiles: (files: File[], folderId: string | null) => void;
  startUploadWithFolders: (files: FileList | File[], folderId: string | null) => void;

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
  registerOnUploadComplete: (callback: (uploadId: string, result: UploadResult) => void) => void;
  unregisterOnUploadComplete: (callback: (uploadId: string, result: UploadResult) => void) => void;

  // File addition callback for incremental updates
  registerOnFileAdded: (callback: (file: FileItem) => void) => void;
  unregisterOnFileAdded: (callback: (file: FileItem) => void) => void;
  notifyFileAdded: (file: FileItem) => void;

  // File deletion callback for incremental updates
  registerOnFileDeleted: (callback: (fileId: string) => void) => void;
  unregisterOnFileDeleted: (callback: (fileId: string) => void) => void;

  // File replacement callback for refreshing the file list
  registerOnFileReplaced: (callback: () => void) => void;
  unregisterOnFileReplaced: (callback: () => void) => void;

  // Download state
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  // currentDownloadFile may represent files, folders or multi-item bundles (papers included)
  currentDownloadFile: { id: string; name: string; type: 'file' | 'folder' | 'paper' } | null;
  isDownloadPaused: boolean;

  // Download handlers
  startFileDownload: (fileId: string, fileName: string) => Promise<void>;
  // CEK-aware download starter for encrypted shared files
  startFileDownloadWithCEK: (fileId: string, fileName: string, cek: Uint8Array) => Promise<void>;
  startFolderDownload: (folderId: string, folderName: string) => Promise<void>;
  // Bulk download may include papers (which will be exported as .url shortcuts when zipped)
  startBulkDownload: (items: Array<{ id: string; name: string; type: 'file' | 'folder' | 'paper' }>) => Promise<void>;
  startPdfPreview: (fileId: string, fileName: string, fileSize: number) => Promise<void>;
  cancelDownload: () => void;
  pauseDownload: () => void;
  resumeDownload: () => void;
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

export function useOnUploadComplete(callback: (uploadId: string, result: UploadResult) => void) {
  const { registerOnUploadComplete, unregisterOnUploadComplete } = useGlobalUpload();

  React.useEffect(() => {
    registerOnUploadComplete(callback);
    return () => {
      unregisterOnUploadComplete(callback);
    };
  }, [callback, registerOnUploadComplete, unregisterOnUploadComplete]);
}

export function useOnFileAdded(callback: (file: FileItem) => void) {
  const { registerOnFileAdded, unregisterOnFileAdded } = useGlobalUpload();

  React.useEffect(() => {
    registerOnFileAdded(callback);
    return () => {
      unregisterOnFileAdded(callback);
    };
  }, [callback, registerOnFileAdded, unregisterOnFileAdded]);
}

export function useOnFileDeleted(callback: (fileId: string) => void) {
  const { registerOnFileDeleted, unregisterOnFileDeleted } = useGlobalUpload();

  React.useEffect(() => {
    registerOnFileDeleted(callback);
    return () => {
      unregisterOnFileDeleted(callback);
    };
  }, [callback, registerOnFileDeleted, unregisterOnFileDeleted]);
}

export function useOnFileReplaced(callback: () => void) {
  const { registerOnFileReplaced, unregisterOnFileReplaced } = useGlobalUpload();

  React.useEffect(() => {
    registerOnFileReplaced(callback);
    return () => {
      unregisterOnFileReplaced(callback);
    };
  }, [callback, registerOnFileReplaced, unregisterOnFileReplaced]);
}

interface GlobalUploadProviderProps {
  children: ReactNode;
}

export function GlobalUploadProvider({ children }: GlobalUploadProviderProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Conflict modal state
  const [conflictItems, setConflictItems] = useState<ConflictItem[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [currentDownloadFile, setCurrentDownloadFile] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const downloadAbortControllerRef = useRef<AbortController | null>(null);

  // Pause state
  const [isDownloadPaused, setIsDownloadPaused] = useState(false);
  const pauseResolverRef = useRef<(() => void) | null>(null);
  // We need a stable reference to the pause controller object to pass to lib functions
  const pauseControllerRef = useRef<PauseController>({
    isPaused: false,
    waitIfPaused: async () => {
      if (pauseControllerRef.current.isPaused) {
        await new Promise<void>(resolve => {
          pauseResolverRef.current = resolve;
        });
      }
    },
    // Simple event emitter pattern
    setOnPause: (callback: () => void) => {
      const listeners = (pauseControllerRef.current as any)._listeners || [];
      listeners.push(callback);
      (pauseControllerRef.current as any)._listeners = listeners;
    }
  });

  // Helper to trigger pause listeners
  const triggerPause = useCallback(() => {
    const listeners = (pauseControllerRef.current as any)._listeners || [];
    listeners.forEach((cb: () => void) => cb());
    (pauseControllerRef.current as any)._listeners = [];
  }, []);

  // Get current folder from context
  const { currentFolderId } = useCurrentFolder();

  // Get user context for storage updates
  const { updateStorage } = useUser();

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Upload managers
  const uploadManagersRef = useRef<Map<string, UploadManager>>(new Map());

  // Parallel upload queue for handling concurrent uploads
  const uploadQueueRef = useRef<ParallelUploadQueue | null>(null);

  // Upload completion callbacks
  const onUploadCompleteCallbacksRef = useRef<Set<(uploadId: string, result: UploadResult) => void>>(new Set());

  // File added callbacks for incremental updates
  const onFileAddedCallbacksRef = useRef<Set<(file: FileItem) => void>>(new Set());

  // File deleted callbacks for incremental updates
  const onFileDeletedCallbacksRef = useRef<Set<(fileId: string) => void>>(new Set());

  // File replaced callbacks for refreshing the file list
  const onFileReplacedCallbacksRef = useRef<Set<() => void>>(new Set());

  // Pending folder upload conflict (used when creating folder hierarchy during folder upload)
  const pendingFolderUploadConflictRef = useRef<null | { files: FileList | File[]; baseFolderId: string | null; conflict: { type?: string; folderPath?: string; folderName?: string; parentFolderId?: string; manifestData?: unknown; responseError?: unknown }; retryCount: number }>(null);

  // Helper: attempt to prepare files for upload (create folders as needed) - used for retries after conflict resolution

  // Initialize upload queue on mount and cleanup on unmount
  useEffect(() => {
    uploadQueueRef.current = getUploadQueue(3); // 3 concurrent uploads

    // Restore modal state when uploads exist
    setIsModalOpen(uploads.length > 0);

    return () => {
      destroyUploadQueue();
      uploadQueueRef.current = null;
    };
  }, [uploads.length]);

  // Keep modal visible if uploads are in progress
  useEffect(() => {
    const hasActiveUploads = uploads.some(u =>
      u.status === 'pending' || u.status === 'uploading' || u.status === 'paused'
    );

    if (hasActiveUploads) {
      setIsModalOpen(true);
    }
  }, [uploads]);

  const updateUploadState = useCallback((uploadId: string, updates: Partial<FileUploadState>) => {
    setUploads(prev => prev.map(upload =>
      upload.id === uploadId ? { ...upload, ...updates } : upload
    ));
  }, []);

  const addUpload = useCallback((file: File) => {
    // Final defense: reject any suspicious entries
    if (!file.name || file.name.trim() === '') {
      throw new Error('Invalid file: missing filename');
    }

    // Reject directory entries: those have webkitRelativePath === name
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    if (relativePath === file.name && relativePath !== '') {
      throw new Error(`Cannot upload directory "${file.name}". Please select files instead.`);
    }

    const uploadState: FileUploadState = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: null,
      currentFilename: file.name,
    };

    setUploads(prev => [...prev, uploadState]);
    return uploadState;
  }, []);

  const startUpload = useCallback(async (uploadState: FileUploadState) => {
    try {
      // Ensure KeyManager is initialized before starting upload
      // This handles the case where uploads start before KeyManager initialization completes
      if (!keyManager.hasKeys()) {
        try {
          // Try to get user data to initialize KeyManager
          // This will recursively call apiClient.getProfile() if needed
          await keyManager.getUserKeys();
          console.log('KeyManager initialized in startUpload');
        } catch (error) {
          console.warn('Failed to initialize KeyManager before upload:', error);
          // Try to initialize without explicit user data
          // The KeyManager might have restored from localStorage
        }
      }

      const uploadManager = new UploadManager({
        id: uploadState.id,  // Pass the upload state ID to ensure consistency
        file: uploadState.file,
        folderId: currentFolderId,
        onProgress: (task) => {
          updateUploadState(task.id, {
            status: task.status,
            progress: task.progress,
            error: task.error,
            currentFilename: task.currentFilename,
          });
        },
        onComplete: (task) => {
          updateUploadState(task.id, {
            status: 'completed',
            result: task.result,
            progress: task.progress,
          });

          // Update storage in sidebar immediately (optimistic update)
          if (task.result && task.result.file && task.result.file.size) {
            updateStorage(task.result.file.size);
          }

          // Trigger all registered upload completion callbacks (only when result exists)
          if (task.result) {
            onUploadCompleteCallbacksRef.current.forEach(callback => {
              callback(task.id, task.result as UploadResult);
            });
          }
          // Trigger file added callbacks with the file data
          if (task.result && task.result.file) {
            onFileAddedCallbacksRef.current.forEach(callback => {
              if (task.result && task.result.file) callback(task.result.file);
            });
          }
          // Trigger file replaced callbacks if a file was replaced - refresh the file list
          if (task.existingFileIdToDelete) {
            onFileReplacedCallbacksRef.current.forEach(callback => {
              callback();
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
        onConflict: (task, conflictInfo) => {
          // Handle file conflict by opening conflict modal
          const conflictItem = {
            id: task.id,
            name: conflictInfo.name,
            type: conflictInfo.type,
            existingPath: conflictInfo.existingPath,
            newPath: conflictInfo.newPath,
            existingFileId: conflictInfo.existingFileId, // Store file ID for deletion
          };
          setConflictItems([conflictItem]);
          setIsConflictModalOpen(true);

          // Store the upload manager for later resolution
          uploadManagersRef.current.set(task.id, uploadManager);
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
  }, [currentFolderId, updateUploadState, updateStorage]);

  const handleFileUpload = useCallback((accept?: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept || "*/*";
      fileInputRef.current.click();
    }
  }, []);

  const handleFolderUpload = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    // Don't allow closing if there are active uploads
    const hasActiveUploads = uploads.some(u =>
      u.status === 'pending' || u.status === 'uploading' || u.status === 'paused'
    );

    if (!hasActiveUploads) {
      setIsModalOpen(false);
      // Clear all uploads when closing the modal to provide a clean slate
      setUploads([]);
    }
  }, [uploads]);

  const handleModalOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Modal is being closed - check if we can close and clear uploads
      const hasActiveUploads = uploads.some(u =>
        u.status === 'pending' || u.status === 'uploading' || u.status === 'paused'
      );

      if (!hasActiveUploads) {
        setIsModalOpen(false);
        // Clear all uploads when closing the modal to provide a clean slate
        setUploads([]);
      }
    } else {
      setIsModalOpen(true);
    }
  }, [uploads]);

  const attemptPrepare = useCallback(async (
    filesToPrepare: FileList | File[],
    baseFolderId: string | null,
    renameMap?: Record<string, string>,
    options?: { suppressEmptyAlert?: boolean }
  ): Promise<boolean> => {
    try {
      const filesForUpload = (await prepareFilesForUpload(filesToPrepare, baseFolderId, (folder) => {
        // Trigger folder added callbacks
        onFileAddedCallbacksRef.current.forEach(callback => {
          callback({
            id: folder.id,
            name: folder.name,
            parentId: folder.parentId,
            path: folder.path,
            type: 'folder',
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
            is_shared: false
          });
        });
      })) as Array<{ file: File; folderId: string | null }>;

      if (filesForUpload.length === 0) {
        console.warn('No files to upload after preparation');
        if (!options?.suppressEmptyAlert) {
          alert('The selected folder is empty. There are no files to upload.');
        }
        return false;
      }

      // Upload each file to its correct folder
      filesForUpload.forEach(({ file, folderId: targetFolderId }) => {
        try {
          const uploadState = addUpload(file);
          const uploadManager = new UploadManager({
            id: uploadState.id,
            file: uploadState.file,
            folderId: targetFolderId,
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
              if (task.result) {
                onUploadCompleteCallbacksRef.current.forEach(callback => {
                  callback(task.id, task.result as UploadResult);
                });
              }
              if (task.result && task.result.file) {
                onFileAddedCallbacksRef.current.forEach(callback => {
                  if (task.result && task.result.file) callback(task.result.file);
                });
              }
              if (task.existingFileIdToDelete) {
                onFileReplacedCallbacksRef.current.forEach(callback => {
                  callback();
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
            onConflict: (task, conflictInfo) => {
              const conflictItem = {
                id: task.id,
                name: conflictInfo.name,
                type: conflictInfo.type,
                existingPath: conflictInfo.existingPath,
                newPath: conflictInfo.newPath,
                existingFileId: conflictInfo.existingFileId,
              };
              setConflictItems([conflictItem]);
              setIsConflictModalOpen(true);
              uploadManagersRef.current.set(task.id, uploadManager);
            },
          });

          uploadManagersRef.current.set(uploadState.id, uploadManager);
          uploadManager.start();
        } catch (error) {
          console.error('Failed to initialize upload for file:', file.name, error);
          const uploadState: FileUploadState = {
            id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            status: 'failed',
            progress: null,
            currentFilename: file.name,
            error: error instanceof Error ? error.message : 'Failed to upload file',
          };
          setUploads(prev => [...prev, uploadState]);
        }
      });

      openModal();
      return true;
    } catch (error: unknown) {
      const folderError = error as { type?: string; folderPath?: string; folderName?: string; parentFolderId?: string; manifestData?: unknown; responseError?: unknown };
      if (folderError && folderError.type === 'folder_conflict') {
        console.log('Folder upload conflict detected:', folderError.folderPath, folderError.folderName);
        pendingFolderUploadConflictRef.current = { files: filesToPrepare, baseFolderId, conflict: folderError, retryCount: 0 };

        const conflictItem = {
          id: folderError.folderPath || folderError.folderName || '',
          name: folderError.folderName || folderError.folderPath || '',
          type: 'folder' as const,
          existingPath: folderError.parentFolderId || '',
          newPath: '',
          existingItem: undefined,
          existingFileId: undefined,
        };

        setConflictItems([conflictItem]);
        setIsConflictModalOpen(true);
        // DO NOT open the upload modal here: there are no uploads yet and showing the progress modal is confusing.
        return false;
      }

      console.error('Failed to prepare folder uploads:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create folder structure';
      alert(`Upload Failed: ${errorMessage}`);
      openModal();
      return false;
    }
  }, [addUpload, updateUploadState, openModal]);

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

  const registerOnUploadComplete = useCallback((callback: (uploadId: string, result: UploadResult) => void) => {
    onUploadCompleteCallbacksRef.current.add(callback);
  }, []);

  const unregisterOnUploadComplete = useCallback((callback: (uploadId: string, result: UploadResult) => void) => {
    onUploadCompleteCallbacksRef.current.delete(callback);
  }, []);

  const registerOnFileAdded = useCallback((callback: (file: FileItem) => void) => {
    onFileAddedCallbacksRef.current.add(callback);
  }, []);

  const unregisterOnFileAdded = useCallback((callback: (file: FileItem) => void) => {
    onFileAddedCallbacksRef.current.delete(callback);
  }, []);

  const notifyFileAdded = useCallback((file: FileItem) => {
    onFileAddedCallbacksRef.current.forEach(callback => callback(file));
  }, []);

  const registerOnFileDeleted = useCallback((callback: (fileId: string) => void) => {
    onFileDeletedCallbacksRef.current.add(callback);
  }, []);

  const unregisterOnFileDeleted = useCallback((callback: (fileId: string) => void) => {
    onFileDeletedCallbacksRef.current.delete(callback);
  }, []);

  const registerOnFileReplaced = useCallback((callback: () => void) => {
    onFileReplacedCallbacksRef.current.add(callback);
  }, []);

  const unregisterOnFileReplaced = useCallback((callback: () => void) => {
    onFileReplacedCallbacksRef.current.delete(callback);
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



  // Download handlers
  const startFileDownload = useCallback(async (fileId: string, fileName: string) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: fileId, name: fileName, type: 'file' });
      setIsModalOpen(true);

      setDownloadProgress({
        stage: 'initializing',
        overallProgress: 0,
        bytesDownloaded: 0,
        totalBytes: 0 // Will be updated when metadata is fetched
      });

      const userKeys = await keyManager.getUserKeys();

      downloadAbortControllerRef.current?.abort();
      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      // Reset pause state
      setIsDownloadPaused(false);
      pauseControllerRef.current.isPaused = false;
      if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
      }

      await downloadFileToBrowser(fileId, userKeys, (progress) => {
        setDownloadProgress(progress);
      }, controller.signal, pauseControllerRef.current);

      // Keep modal open to show completion - user can manually close
      // The modal will auto-close when all uploads complete
    } catch (error) {
      if (error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('Aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('The operation was aborted')
      )) {
        console.log('Download cancelled by user');
        return;
      }
      console.error('Download error:', error);
      setDownloadError(error instanceof Error ? error.message : 'Download failed');
    }
  }, []);

  // New: CEK-aware file download start for shares (accepts pre-unwrapped CEK)
  const startFileDownloadWithCEK = useCallback(async (fileId: string, fileName: string, cek: Uint8Array) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: fileId, name: fileName, type: 'file' });
      setIsModalOpen(true);

      setDownloadProgress({
        stage: 'initializing',
        overallProgress: 0,
        bytesDownloaded: 0,
        totalBytes: 0
      });

      downloadAbortControllerRef.current?.abort();
      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      setIsDownloadPaused(false);
      pauseControllerRef.current.isPaused = false;
      if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
      }

      // Use specialized download that accepts a CEK (for shared items)
      const result = await downloadEncryptedFileWithCEK(fileId, cek, (progress) => {
        setDownloadProgress(progress);
      }, controller.signal, pauseControllerRef.current);

      // Create download link and trigger download
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      // Use the explicitly passed fileName (which comes from our local decryption)
      a.download = fileName || result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      if (error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('Aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('The operation was aborted')
      )) {
        console.log('Download cancelled by user');
        return;
      }
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

      downloadAbortControllerRef.current?.abort();
      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      // Reset pause state
      setIsDownloadPaused(false);
      pauseControllerRef.current.isPaused = false;
      if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
      }

      await downloadFolderAsZip(folderId, folderName, userKeys, (progress) => {
        setDownloadProgress(progress);
      }, controller.signal, pauseControllerRef.current);

      // Keep modal open to show completion - user can manually close
    } catch (error) {
      if (error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('Aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('The operation was aborted')
      )) {
        console.log('Folder download cancelled by user');
        return;
      }
      console.error('Folder download error:', error);
      setDownloadError(error instanceof Error ? error.message : 'Folder download failed');
    }
  }, []);

  const startBulkDownload = useCallback(async (items: Array<{ id: string; name: string; type: 'file' | 'folder' | 'paper' }>) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: 'bulk', name: 'Multiple Items', type: 'file' });
      setIsModalOpen(true);

      const userKeys = await keyManager.getUserKeys();

      downloadAbortControllerRef.current?.abort();
      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      // Reset pause state
      setIsDownloadPaused(false);
      pauseControllerRef.current.isPaused = false;
      if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
      }

      await downloadMultipleItemsAsZip(items, userKeys, (progress) => {
        setDownloadProgress(progress);
      }, controller.signal, pauseControllerRef.current);

      // Keep modal open to show completion - user can manually close
    } catch (error) {
      if (error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('Aborted') ||
        error.message.includes('BodyStreamBuffer was aborted') ||
        error.message.includes('The operation was aborted')
      )) {
        console.log('Bulk download cancelled by user');
        return;
      }
      console.error('Bulk download error:', error);
      setDownloadError(error instanceof Error ? error.message : 'Bulk download failed');
    }
  }, []);

  const startPdfPreview = useCallback(async (fileId: string, fileName: string, _fileSize: number) => {
    // _fileSize intentionally unused
    void _fileSize;
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: fileId, name: fileName, type: 'file' });
      setIsModalOpen(true);

      const userKeys = await keyManager.getUserKeys();

      // Download the file to memory (not to disk)
      downloadAbortControllerRef.current?.abort();
      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      const result = await downloadEncryptedFile(fileId, userKeys, (progress) => {
        setDownloadProgress(progress);
      }, controller.signal); // Note: PDF preview doesn't use the same pause controller currently as it renders directly, but could be added.
      // For now leaving as is since user asked for "downloading file" specifically.

      // Verify it's actually a PDF
      if (!result.mimetype.includes('pdf')) {
        throw new Error('File is not a PDF');
      }

      // Create blob URL and open in new tab
      const blobUrl = URL.createObjectURL(result.blob);

      // Check if mobile device for standalone page approach
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Create standalone HTML page for mobile browsers
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${fileName}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 0; background: #f5f5f5; }
                embed { width: 100vw; height: 100vh; }
              </style>
            </head>
            <body>
              <embed src="${blobUrl}" type="application/pdf" width="100%" height="100%" title="${fileName}">
            </body>
          </html>
        `;

        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        window.open(htmlUrl, '_blank');

        // Clean up HTML URL after delay
        setTimeout(() => URL.revokeObjectURL(htmlUrl), 1000);
      } else {
        // Open PDF directly in new tab for desktop
        window.open(blobUrl, '_blank');
      }

      // Clean up blob URL after delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      // Keep modal open to show completion - user can manually close
    } catch (error) {
      console.error('PDF preview error:', error);
      setDownloadError(error instanceof Error ? error.message : 'PDF preview failed');
    }
  }, []);

  const cancelDownload = useCallback(() => {
    // Abort the pending download
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }

    // Also resolve any pending pause so we don't hang
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
    pauseControllerRef.current.isPaused = false;
    setIsDownloadPaused(false);

    setDownloadProgress(null);
    setDownloadError(null);
    setCurrentDownloadFile(null);
    setIsModalOpen(false); // Close modal on cancel
  }, []);

  const pauseDownload = useCallback(() => {
    setIsDownloadPaused(true);
    pauseControllerRef.current.isPaused = true;
    triggerPause();
  }, [triggerPause]);

  const resumeDownload = useCallback(() => {
    setIsDownloadPaused(false);
    pauseControllerRef.current.isPaused = false;
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, []);

  const startUploadWithFiles = useCallback((files: File[], _folderId: string | null) => {
    // _folderId intentionally unused here (uploads go to current folder)
    void _folderId;
    // Filter out any suspicious entries that might be directories
    const validFiles = files.filter(file => {
      // Check for empty or invalid filenames
      if (!file.name || file.name.trim() === '') {
        return false;
      }

      // ONLY reject truly empty directory entries: size=0 AND type=""
      if (file.size === 0 && file.type === '') {
        return false;
      }

      // All other files (with content) are valid
      return true;
    });

    if (validFiles.length === 0) {
      alert('No valid files to upload. Please select files, not directories.');
      return;
    }

    validFiles.forEach(file => {
      const uploadState = addUpload(file);
      startUpload(uploadState);
    });
    openModal();
  }, [addUpload, startUpload, openModal]);

  const startUploadWithFolders = useCallback((files: FileList | File[], folderId: string | null) => {
    // Filter out any suspicious entries before processing
    const fileArray = Array.from(files);

    const validFiles = fileArray.filter(file => {
      // Check for empty or invalid filenames
      if (!file.name || file.name.trim() === '') {
        return false;
      }

      // ONLY reject truly empty directory entries: size=0 AND type=""
      if (file.size === 0 && file.type === '') {
        return false;
      }

      // All other files (with content) are valid
      return true;
    });

    if (validFiles.length === 0) {
      alert('No files were found in the selected folder. Please select a folder with files.');
      return;
    }

    // Kick off folder preparation/upload attempt
    attemptPrepare(validFiles, folderId);
  }, [attemptPrepare]);

  // Handle folder selection from file input - delegate to folder upload flow
  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    startUploadWithFolders(files, currentFolderId === 'root' ? null : currentFolderId);
    // Clear input
    e.target.value = '';
  }, [startUploadWithFolders, currentFolderId]);

  const handleConflictResolution = useCallback(async (resolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'>) => {
    // Handle conflict resolution for each item
    for (const [itemId, resolution] of Object.entries(resolutions)) {
      const manager = uploadManagersRef.current.get(itemId);
      if (manager) {
        if (resolution === 'replace') {
          // For replace, pass the existing file ID to the upload manager
          // The backend will handle deletion atomically when initializing the upload
          const conflictItem = conflictItems.find(item => item.id === itemId);
          if (conflictItem?.existingFileId) {
            // Store the existing file ID for the upload manager to pass to uploadEncryptedFile
            manager.setExistingFileIdToDelete(conflictItem.existingFileId);

            // Immediately remove the old file from the UI
            onFileDeletedCallbacksRef.current.forEach(callback => {
              callback(conflictItem.existingFileId!);
            });
          } else {
          }
        } else if (resolution === 'keepBoth') {
          // For keepBoth, pass the conflicting filename to extract counter info
          const conflictItem = conflictItems.find(item => item.id === itemId);
          if (conflictItem?.name) {
            // Store the conflict filename for the upload manager to pass to uploadEncryptedFile
            manager.setConflictFileName(conflictItem.name);
          }
        }

        // Map 'ignore' to 'skip' for UploadManager
        const mappedResolution = resolution === 'ignore' ? 'skip' : resolution;
        manager.resolveConflict(mappedResolution as 'replace' | 'keepBoth' | 'skip');
        uploadManagersRef.current.delete(itemId);

        continue; // proceed to next resolution
      }

      // If no upload manager found, check for pending folder upload conflict
      if (pendingFolderUploadConflictRef.current) {
        const pending = pendingFolderUploadConflictRef.current;
        const conflict = pending.conflict;

        if (conflict && conflict.folderPath === itemId) {
          try {
            if (resolution === 'replace') {
              // Attempt to locate existing folder in parent and delete it
              const parentId = conflict.parentFolderId || 'root';
              const contentsResp = await apiClient.getFolderContents(parentId);
              if (!contentsResp.success) throw new Error(contentsResp.error || 'Failed to list parent folder');

              // Build decrypted folder name map for reliable matching
              let masterKey: Uint8Array | null = null;
              try {
                masterKey = masterKeyManager.getMasterKey();
              } catch {
                try {
                  await keyManager.getUserKeys();
                  masterKey = masterKeyManager.getMasterKey();
                } catch {
                  masterKey = null;
                }
              }

              const folders = contentsResp.data?.folders || [];
              type FolderContentItem = { id?: string; name?: string | undefined; encryptedName?: string; nameSalt?: string };
              let existing: FolderContentItem | null = null;
              for (const f of folders) {
                let displayName = f.name || '';
                if ((!displayName || displayName.trim() === '') && f.encryptedName && f.nameSalt && masterKey) {
                  try {
                    displayName = await decryptFilename(f.encryptedName, f.nameSalt, masterKey);
                  } catch {
                    displayName = f.encryptedName || '';
                  }
                }
                if (displayName === conflict.folderName) {
                  existing = f;
                  break;
                }
              }

              if (existing && existing.id) {
                const delResp = await apiClient.deleteFolder(existing.id);
                if (!delResp.success) throw new Error(delResp.error || 'Failed to delete existing folder');

                // Notify UI of folder deletion
                const existingId = existing.id;
                if (existingId) {
                  onFileDeletedCallbacksRef.current.forEach(callback => {
                    callback(existingId);
                  });
                }
              } else {
                throw new Error('Existing folder not found for replace');
              }

              // Clear pending and close modal first to prevent re-entry
              pendingFolderUploadConflictRef.current = null;
              setIsConflictModalOpen(false);
              setConflictItems([]);

              // Retry the folder upload flow (with a simple retry guard) - reset retryCount since we deleted the conflict
              const ok = await attemptPrepare(pending.files, pending.baseFolderId, undefined, { suppressEmptyAlert: true });
              if (ok) {
                toast.success(`Folder replaced successfully`);
              } else {
                throw new Error('Failed to upload folder after replacing existing one');
              }
            } else if (resolution === 'keepBoth') {
              // Propose a unique name in the parent folder and retry with renameMap, with automatic retries if needed
              const parentId = conflict.parentFolderId || 'root';
              const contentsResp = await apiClient.getFolderContents(parentId);
              if (!contentsResp.success) throw new Error(contentsResp.error || 'Failed to list parent folder');

              // Build decrypted folder name set for uniqueness checks
              let masterKey: Uint8Array | null = null;
              try {
                masterKey = masterKeyManager.getMasterKey();
              } catch {
                try {
                  await keyManager.getUserKeys();
                  masterKey = masterKeyManager.getMasterKey();
                } catch {
                  masterKey = null;
                }
              }

              const folders = contentsResp.data?.folders || [];
              const existingNames = new Set<string>();
              for (const f of folders) {
                let displayName = f.name || '';
                if ((!displayName || displayName.trim() === '') && f.encryptedName && f.nameSalt && masterKey) {
                  try {
                    displayName = await decryptFilename(f.encryptedName, f.nameSalt, masterKey);
                  } catch {
                    displayName = f.encryptedName || '';
                  }
                }
                if (displayName) existingNames.add(displayName);
              }

              const base = conflict.folderName;

              // Find a unique name
              let suggested: string | null = null;
              const maxTries = 100; // Increase max tries
              for (let idx = 1; idx <= maxTries; idx++) {
                const candidate = `${base} (${idx})`;
                if (!existingNames.has(candidate)) {
                  suggested = candidate;
                  break;
                }
              }

              if (!suggested) {
                throw new Error('Could not find a unique folder name after 100 attempts');
              }

              // Clear pending and close modal first to prevent re-entry
              pendingFolderUploadConflictRef.current = null;
              setIsConflictModalOpen(false);
              setConflictItems([]);

              // Attempt upload with the unique name
              const renameMap = { [conflict.folderPath]: suggested };
              const ok = await attemptPrepare(pending.files, pending.baseFolderId, renameMap, { suppressEmptyAlert: true });

              if (ok) {
                toast.success(`Folder uploaded as "${suggested}"`);
              } else {
                throw new Error('Failed to upload folder with unique name');
              }
            } else if (resolution === 'ignore') {
              // Filter out files belonging to the conflicting folder path and continue
              const folderPathPrefix = conflict.folderPath + '/';
              const filesArray = Array.from(pending.files as FileList | File[]);
              const filtered = filesArray.filter((f: File) => {
                const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
                return !(rel === conflict.folderPath || rel.startsWith(folderPathPrefix));
              });

              // Clear pending and close modal first to prevent re-entry
              pendingFolderUploadConflictRef.current = null;
              setIsConflictModalOpen(false);
              setConflictItems([]);

              if (filtered.length === 0) {
                // Nothing left to upload after skipping this folder
                toast.info('No files left to upload after skipping the conflicting folder');
                break;
              }

              // Continue with remaining files
              const ok = await attemptPrepare(filtered as File[], pending.baseFolderId, undefined, { suppressEmptyAlert: true });
              if (ok) {
                toast.success('Remaining files uploaded successfully');
              } else {
                // Only show error if there was actually an error, not if folder was empty
                if (filtered.length > 0) {
                  toast.error('Failed to continue upload after skipping conflicting folder');
                }
              }
            }
          } catch (err) {
            console.error('Failed to resolve folder upload conflict:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to resolve conflict');
            pendingFolderUploadConflictRef.current = null;
          }
        }
      }
    }

    // Close conflict modal
    setIsConflictModalOpen(false);
    setConflictItems([]);
  }, [conflictItems, attemptPrepare]);

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
    notifyFileAdded,
    registerOnFileDeleted,
    unregisterOnFileDeleted,
    registerOnFileReplaced,
    unregisterOnFileReplaced,
    downloadProgress,
    downloadError,
    currentDownloadFile,
    isDownloadPaused,
    startFileDownload,
    startFileDownloadWithCEK,
    startFolderDownload,
    startBulkDownload,
    startPdfPreview,
    cancelDownload,
    pauseDownload,
    resumeDownload,
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
        {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string })}
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
        downloadFileSize={0}
        downloadFileId={currentDownloadFile?.id}
        onCancelDownload={cancelDownload}
        onPauseDownload={pauseDownload}
        onResumeDownload={resumeDownload}
        onRetryDownload={retryDownload}
        downloadError={downloadError}
        isDownloadPaused={isDownloadPaused}
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        onClose={closeModal}
      />

      {/* Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        conflicts={conflictItems}
        onResolve={handleConflictResolution}
        operation="upload"
      />
    </GlobalUploadContext.Provider>
  );
}
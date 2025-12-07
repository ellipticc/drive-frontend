"use client"

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { UnifiedProgressModal, FileUploadState } from '@/components/modals/unified-progress-modal';
import { ConflictModal } from '@/components/modals/conflict-modal';
import { UploadManager } from '@/components/upload-manager';
import { keyManager } from '@/lib/key-manager';
import { apiClient } from '@/lib/api';
import { useCurrentFolder } from '@/components/current-folder-context';
import { useUser } from '@/components/user-context';
import { downloadFileToBrowser, downloadFolderAsZip, downloadMultipleItemsAsZip, downloadEncryptedFile, DownloadProgress } from '@/lib/download';
import { prepareFilesForUpload, CreatedFolder } from '@/lib/folder-upload-utils';
import { ParallelUploadQueue, getUploadQueue, destroyUploadQueue } from '@/lib/parallel-upload-queue';

interface GlobalUploadContextType {
  // Upload state
  uploads: FileUploadState[];
  isModalOpen: boolean;

  // Upload handlers
  handleFileUpload: () => void;
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
  registerOnUploadComplete: (callback: (uploadId: string, result: any) => void) => void;
  unregisterOnUploadComplete: (callback: (uploadId: string, result: any) => void) => void;

  // File addition callback for incremental updates
  registerOnFileAdded: (callback: (file: any) => void) => void;
  unregisterOnFileAdded: (callback: (file: any) => void) => void;

  // File deletion callback for incremental updates
  registerOnFileDeleted: (callback: (fileId: string) => void) => void;
  unregisterOnFileDeleted: (callback: (fileId: string) => void) => void;

  // File replacement callback for refreshing the file list
  registerOnFileReplaced: (callback: () => void) => void;
  unregisterOnFileReplaced: (callback: () => void) => void;

  // Download state
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  currentDownloadFile: { id: string; name: string; type: 'file' | 'folder' } | null;

  // Download handlers
  startFileDownload: (fileId: string, fileName: string) => Promise<void>;
  startFolderDownload: (folderId: string, folderName: string) => Promise<void>;
  startBulkDownload: (items: Array<{ id: string; name: string; type: 'file' | 'folder' }>) => Promise<void>;
  startPdfPreview: (fileId: string, fileName: string, fileSize: number) => Promise<void>;
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
  const [conflictItems, setConflictItems] = useState<any[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [currentDownloadFile, setCurrentDownloadFile] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

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
  const onUploadCompleteCallbacksRef = useRef<Set<(uploadId: string, result: any) => void>>(new Set());
  
  // File added callbacks for incremental updates
  const onFileAddedCallbacksRef = useRef<Set<(file: any) => void>>(new Set());
  
  // File deleted callbacks for incremental updates
  const onFileDeletedCallbacksRef = useRef<Set<(fileId: string) => void>>(new Set());
  
  // File replaced callbacks for refreshing the file list
  const onFileReplacedCallbacksRef = useRef<Set<() => void>>(new Set());

  // Initialize upload queue on mount and cleanup on unmount
  useEffect(() => {
    uploadQueueRef.current = getUploadQueue(3); // 3 concurrent uploads

    // Restore modal state when uploads exist
    setIsModalOpen(uploads.length > 0);

    return () => {
      destroyUploadQueue();
      uploadQueueRef.current = null;
    };
  }, []);

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
    const relativePath = (file as any).webkitRelativePath || '';
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

  const startPdfPreview = useCallback(async (fileId: string, fileName: string, fileSize: number) => {
    try {
      setDownloadError(null);
      setCurrentDownloadFile({ id: fileId, name: fileName, type: 'file' });
      setIsModalOpen(true);

      const userKeys = await keyManager.getUserKeys();

      // Download the file to memory (not to disk)
      const result = await downloadEncryptedFile(fileId, userKeys, (progress) => {
        setDownloadProgress(progress);
      });

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
    // Note: The download functions don't have built-in cancellation
    // This would need to be implemented in the download functions themselves
    setDownloadProgress(null);
    setDownloadError(null);
    setCurrentDownloadFile(null);
    // Modal stays open until user explicitly closes it
  }, []);

  const startUploadWithFiles = useCallback((files: File[], folderId: string | null) => {
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
    console.log('=== START UPLOAD WITH FOLDERS ===');
    console.log('Input files count:', fileArray.length);
    fileArray.forEach((f, i) => {
      console.log(`[${i}] name="${f.name}" size=${f.size} type="${f.type}" relativePath="${(f as any).webkitRelativePath || 'NONE'}"`);
    });
    
    const validFiles = fileArray.filter(file => {
      // Check for empty or invalid filenames
      if (!file.name || file.name.trim() === '') {
        console.log('FILTERING OUT: empty name');
        return false;
      }
      
      // ONLY reject truly empty directory entries: size=0 AND type=""
      if (file.size === 0 && file.type === '') {
        console.log(`FILTERING OUT DIR (empty): name="${file.name}" size=${file.size} type="${file.type}"`);
        return false;
      }
      
      // All other files (with content) are valid
      return true;
    });

    console.log('After filter, validFiles count:', validFiles.length);

    if (validFiles.length === 0) {
      alert('No files were found in the selected folder. Please select a folder with files.');
      return;
    }

    // Register callback to add folders immediately when they're created
    const onFolderCreated = (folder: CreatedFolder) => {
      
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
    };

    // Process folder structure and create folders as needed
    // Pass the filtered validFiles array
    prepareFilesForUpload(validFiles, folderId, onFolderCreated)
      .then(filesForUpload => {
        // Check if any files are available
        if (filesForUpload.length === 0) {
          console.warn('📁 Upload skipped: Selected folder is empty or contains no accessible files');
          // Show user-friendly message for empty folders
          alert('The selected folder is empty. There are no files to upload.');
          openModal();
          return;
        }

        // Upload each file to its correct folder
        filesForUpload.forEach(({ file, folderId: targetFolderId }) => {
          try {
            const uploadState = addUpload(file);
            // Store the correct folder ID for this upload
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
            uploadManager.start();
          } catch (error) {
            console.error('Failed to initialize upload for file:', file.name, error);
            // Create an error upload state to display the error to the user
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
      })
      .catch((error) => {
        console.error('Failed to prepare folder uploads:', error);
        // Show error message
        const errorMessage = error instanceof Error ? error.message : 'Failed to create folder structure';
        alert(`Upload Failed: ${errorMessage}`);
        // Still open modal to show errors
        openModal();
      });
  }, [addUpload, updateUploadState, openModal]);

  const handleConflictResolution = useCallback((resolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'>) => {
    // Handle conflict resolution for each item
    Object.entries(resolutions).forEach(async ([itemId, resolution]) => {
      const manager = uploadManagersRef.current.get(itemId);
      if (manager) {
        if (resolution === 'replace') {
          // For replace, pass the existing file ID to the upload manager
          // The backend will handle deletion atomically when initializing the upload
          const conflictItem = conflictItems.find(item => item.id === itemId) as any;
          if (conflictItem?.existingFileId) {
            // Store the existing file ID for the upload manager to pass to uploadEncryptedFile
            (manager as any).task.existingFileIdToDelete = conflictItem.existingFileId;
            
            // Immediately remove the old file from the UI
            onFileDeletedCallbacksRef.current.forEach(callback => {
              callback(conflictItem.existingFileId);
            });
          } else {
          }
        } else if (resolution === 'keepBoth') {
          // For keepBoth, pass the conflicting filename to extract counter info
          const conflictItem = conflictItems.find(item => item.id === itemId) as any;
          if (conflictItem?.name) {
            // Store the conflict filename for the upload manager to pass to uploadEncryptedFile
            (manager as any).task.conflictFileName = conflictItem.name;
          }
        }
        
        // Map 'ignore' to 'skip' for UploadManager
        const mappedResolution = resolution === 'ignore' ? 'skip' : resolution;
        manager.resolveConflict(mappedResolution as 'replace' | 'keepBoth' | 'skip');
        uploadManagersRef.current.delete(itemId);
      }
    });
    
    // Close conflict modal
    setIsConflictModalOpen(false);
    setConflictItems([]);
  }, [conflictItems]);

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
    registerOnFileDeleted,
    unregisterOnFileDeleted,
    registerOnFileReplaced,
    unregisterOnFileReplaced,
    downloadProgress,
    downloadError,
    currentDownloadFile,
    startFileDownload,
    startFolderDownload,
    startBulkDownload,
    startPdfPreview,
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
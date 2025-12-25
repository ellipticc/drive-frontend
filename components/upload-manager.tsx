/**
 * UploadManager - Handles individual file uploads with pause, resume, and cancel functionality
 * Provides actual upload interruption capabilities with AbortController support
 */

import { uploadEncryptedFile, UploadProgress, UserKeys, UploadResult } from '@/lib/upload';
import { keyManager } from '@/lib/key-manager';

interface UploadError extends Error {
  conflictInfo?: ConflictInfo;
}

import { UploadResult } from '@/lib/upload';

export interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: UploadProgress | null;
  error?: string;
  result?: UploadResult;
  abortController?: AbortController;
  currentFilename?: string; // Current filename being uploaded (may be incremented for keepBoth)
  existingFileIdToDelete?: string; // ID of file to delete if this is a replace operation
  conflictResolution?: 'replace' | 'keepBoth' | 'skip';
  conflictFileName?: string;
  isKeepBothAttempt?: boolean;
}

export interface ConflictInfo {
  isKeepBothConflict?: boolean;
  type: 'file';
  name: string;
  existingPath: string;
  newPath: string;
  folderId: string | null;
  existingFileId?: string; // ID of the existing file for deletion if replacing
} 

export interface UploadManagerProps {
  id: string;  // Add explicit ID parameter
  file: File;
  folderId: string | null;
  userKeys?: UserKeys;
  onProgress?: (task: UploadTask) => void;
  onComplete?: (task: UploadTask) => void;
  onError?: (task: UploadTask) => void;
  onCancel?: (task: UploadTask) => void;
  onConflict?: (task: UploadTask, conflictInfo: ConflictInfo) => void;
}

export class UploadManager {
  private task: UploadTask;
  private props: UploadManagerProps;
  private uploadPromise?: Promise<UploadResult>;
  private isDestroyed = false;
  private currentFilename: string; // Track the current filename being uploaded

  constructor(props: UploadManagerProps) {
    // Validate that this is actually a File object and not an empty directory entry
    const file = props.file;
    
    // ONLY reject truly empty directory entries (size=0, type="")
    // Allow files with webkitRelativePath (folder contents) and files from drag-drop
    if (file.size === 0 && file.type === '') {
      throw new Error(`Cannot upload empty directory: "${file.name}". Directory must contain files.`);
    }
    
    // Validate filename is not empty
    if (!file.name || file.name.trim() === '') {
      throw new Error('Cannot upload file: Invalid filename');
    }

    this.props = props;
    this.currentFilename = props.file.name; // Initialize with original filename
    this.task = {
      id: props.id,  // Use the provided ID instead of creating one
      file: props.file,
      status: 'pending',
      progress: null,
      currentFilename: props.file.name, // Initialize current filename
    };
  }

  async start(): Promise<void> {
    if (this.isDestroyed) return;

    // Abort any previous upload to prevent session ID conflicts
    this.task.abortController?.abort();

    try {
      this.task.status = 'uploading';
      this.task.abortController = new AbortController();
      this.notifyProgress();

      // Get user keys
      const keys = this.props.userKeys || await keyManager.getUserKeys();

      // Start the upload
      this.uploadPromise = uploadEncryptedFile(
        this.props.file,
        this.props.folderId,
        keys,
        (progress) => {
          if (this.isDestroyed || this.task.status === 'cancelled') return;
          this.task.progress = progress;
          this.notifyProgress();
        },
        this.task.abortController.signal, // Pass the abort signal
        () => this.task.status === 'paused', // Pass isPaused callback
        this.task.conflictResolution, // Pass conflict resolution
        this.task.conflictFileName, // Pass conflicting filename for counter extraction
        this.task.existingFileIdToDelete, // Pass file ID to delete for replace
        this.task.isKeepBothAttempt // Pass flag to indicate this is a keepBoth retry
      );

      const result = await this.uploadPromise;

      if (this.isDestroyed) return;

      this.task.status = 'completed';
      this.task.result = result;
      // Preserve existingFileIdToDelete in the task for deletion callbacks
      if (this.task.existingFileIdToDelete) {
        this.task.existingFileIdToDelete = this.task.existingFileIdToDelete;
      }
      this.notifyProgress();
      this.props.onComplete?.(this.task);

    } catch (error) {
      if (this.isDestroyed) return;

      const isCancelled = error instanceof Error &&
        (error.name === 'AbortError' ||
         error.message === 'Upload cancelled' ||
         error.message === 'Upload cancelled by user');

      const isPaused = error instanceof Error && error.message === 'Upload paused';

      const isConflict = error instanceof Error && error.message === 'FILE_CONFLICT';

      if (isCancelled) {
        // Upload was cancelled by user
        this.task.status = 'cancelled';
        this.notifyProgress();
        this.props.onCancel?.(this.task);
      } else if (isPaused) {
        // Upload was paused - keep status as 'paused'
        // Don't call any callback, just return and wait for resume
        return;
      } else if (isConflict) {
        // File conflict detected
        const conflictInfo = (error as UploadError).conflictInfo;
        
        // If this is a keepBoth conflict, auto-retry with next number
        if (conflictInfo?.isKeepBothConflict && this.task.conflictResolution === 'keepBoth') {
          
          // Update the conflict filename to the incremented one we just tried
          this.task.conflictFileName = conflictInfo.name;
          
          // Update our current filename tracking
          this.currentFilename = conflictInfo.name;
          this.task.currentFilename = conflictInfo.name;
          
          // Mark as keepBoth attempt so backend knows to expect a numbered filename
          this.task.isKeepBothAttempt = true;
          
          // Keep status as paused but immediately restart with next number
          this.task.status = 'paused';
          this.notifyProgress();
          
          // Wait a bit then auto-retry
          setTimeout(() => {
            if (!this.isDestroyed && this.task.status === 'paused') {
              this.task.status = 'pending';
              this.notifyProgress();
              this.start();
            }
          }, 500);
        } else {
          // Regular conflict - pause and notify user
          this.task.status = 'paused';
          this.notifyProgress();
          if (conflictInfo) {
            this.props.onConflict?.(this.task, conflictInfo);
          }
        }
      } else {
        // Upload failed with actual error
        this.task.status = 'failed';
        this.task.error = error instanceof Error ? error.message : 'Upload failed';
        this.notifyProgress();
        this.props.onError?.(this.task);
      }
    }
  }

  pause(): void {
    if (this.task.status === 'uploading') {
      this.task.status = 'paused';
      // Don't abort - just change status
      // The upload will continue but we'll mark it as paused
      this.notifyProgress();
    }
  }

  resume(): void {
    if (this.task.status === 'paused') {
      // Change status back to uploading and restart
      this.task.status = 'uploading';
      this.notifyProgress();
      // Restart the upload (note: this will re-upload from the beginning)
      // In a more sophisticated implementation, you'd resume from the last chunk
      this.start();
    }
  }

  cancel(): void {
    if (this.task.status === 'uploading' || this.task.status === 'paused' || this.task.status === 'pending') {
      this.task.status = 'cancelled';
      this.task.abortController?.abort();
      this.notifyProgress();
      this.props.onCancel?.(this.task);
    }
  }

  // Public helpers to mutate conflict-related fields (used by callers managing conflicts)
  setExistingFileIdToDelete(id?: string): void {
    this.task.existingFileIdToDelete = id;
  }

  setConflictFileName(name?: string): void {
    this.task.conflictFileName = name;
  }

  resolveConflict(resolution: 'replace' | 'keepBoth' | 'skip'): void {
    if (this.task.status !== 'paused') return;

    if (resolution === 'skip') {
      // Skip means completely cancel the upload, not pause it
      this.task.status = 'cancelled';
      this.task.abortController?.abort();
      this.notifyProgress();
      this.props.onCancel?.(this.task);
      return;
    }

    // For replace and keepBoth, we need to restart the upload with modified parameters
    // For now, just restart - we'll handle the resolution in the upload function
    this.task.status = 'pending';
    this.task.error = undefined;
    this.notifyProgress();
    
    // Store the resolution for the upload function to use
    this.task.conflictResolution = resolution;
    
    // Restart the upload
    this.start();
  }

  getTask(): UploadTask {
    return { ...this.task };
  }

  private notifyProgress(): void {
    this.props.onProgress?.(this.task);
  }
}

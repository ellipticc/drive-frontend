/**
 * UploadManager - Handles individual file uploads with pause, resume, and cancel functionality
 * Provides actual upload interruption capabilities with AbortController support
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { uploadEncryptedFile, UploadProgress, UserKeys } from '@/lib/upload';
import { keyManager } from '@/lib/key-manager';

export interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: UploadProgress | null;
  error?: string;
  result?: any;
  abortController?: AbortController;
}

export interface UploadManagerProps {
  file: File;
  folderId: string | null;
  userKeys?: UserKeys;
  onProgress?: (task: UploadTask) => void;
  onComplete?: (task: UploadTask) => void;
  onError?: (task: UploadTask) => void;
  onCancel?: (task: UploadTask) => void;
}

export class UploadManager {
  private task: UploadTask;
  private props: UploadManagerProps;
  private uploadPromise?: Promise<any>;
  private isDestroyed = false;

  constructor(props: UploadManagerProps) {
    this.props = props;
    this.task = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: props.file,
      status: 'pending',
      progress: null,
    };
  }

  async start(): Promise<void> {
    if (this.isDestroyed) return;

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
        () => this.task.status === 'paused' // Pass isPaused callback
      );

      const result = await this.uploadPromise;

      if (this.isDestroyed) return;

      this.task.status = 'completed';
      this.task.result = result;
      this.notifyProgress();
      this.props.onComplete?.(this.task);

    } catch (error) {
      if (this.isDestroyed) return;

      const isCancelled = error instanceof Error &&
        (error.name === 'AbortError' ||
         error.message === 'Upload cancelled' ||
         error.message === 'Upload cancelled by user');

      const isPaused = error instanceof Error && error.message === 'Upload paused';

      if (isCancelled) {
        // Upload was cancelled by user
        this.task.status = 'cancelled';
        this.notifyProgress();
        this.props.onCancel?.(this.task);
      } else if (isPaused) {
        // Upload was paused - don't change status, just log
        // console.log(`Upload paused for ${this.task.file.name}`);
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
      // Restart the upload from the beginning
      // The progress will be reset but the user knows it was resumed
      this.start();
    }
  }

  cancel(): void {
    if (this.task.status === 'uploading' || this.task.status === 'paused') {
      this.task.status = 'cancelled';
      this.task.abortController?.abort();
      this.notifyProgress();
      this.props.onCancel?.(this.task);
    }
  }

  destroy(): void {
    this.isDestroyed = true;
    this.task.abortController?.abort();
  }

  getTask(): UploadTask {
    return { ...this.task };
  }

  private notifyProgress(): void {
    this.props.onProgress?.(this.task);
  }
}

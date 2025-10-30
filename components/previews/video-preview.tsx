import React, { useState, useEffect } from 'react';
import { downloadEncryptedFile, DownloadProgress } from '@/lib/download';
import { keyManager } from '@/lib/key-manager';

interface VideoPreviewProps {
  fileId: string;
  filename: string;
  mimetype: string;
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  fileId,
  filename,
  mimetype,
  onProgress,
  onError,
  isLoading,
  setIsLoading
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get user keys
        const userKeys = await keyManager.getUserKeys();

        // Download the file using the same encrypted flow as downloads
        const result = await downloadEncryptedFile(fileId, userKeys, (progress) => {
          onProgress?.(progress);
        });

        // Verify it's actually a video file
        if (!result.mimetype.startsWith('video/')) {
          throw new Error('File is not a video file');
        }

        if (isMounted) {
          // Create blob URL for preview
          const url = URL.createObjectURL(result.blob);
          setBlobUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load video';
        console.error('Video preview error:', errorMessage);

        if (isMounted) {
          setError(errorMessage);
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    };

    loadVideo();

    // Cleanup function
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileId]); // Only depend on fileId to prevent infinite loops

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-red-500">
            <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Failed to load video</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">No preview available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Video player */}
      <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
        <video
          controls
          className="max-w-full max-h-full"
          preload="metadata"
          style={{ maxHeight: '70vh' }}
        >
          <source src={blobUrl} type={mimetype} />
          Your browser does not support the video element.
        </video>
      </div>

      {/* File info */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{filename}</h3>
          <p className="text-sm text-muted-foreground">{mimetype}</p>
        </div>
      </div>
    </div>
  );
};
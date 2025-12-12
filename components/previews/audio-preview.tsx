import React, { useState, useEffect } from 'react';
import { downloadEncryptedFile, DownloadProgress } from '@/lib/download';
import { keyManager } from '@/lib/key-manager';
import { Loader2 } from 'lucide-react';

interface AudioPreviewProps {
  fileId: string;
  filename: string;
  mimetype: string;
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const AudioPreview: React.FC<AudioPreviewProps> = ({
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

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get user keys
        const userKeys = await keyManager.getUserKeys();

        // Download the file using the same encrypted flow as downloads
        const result = await downloadEncryptedFile(fileId, userKeys, (progress) => {
          onProgress?.(progress);
        });

        // Verify it's actually an audio file
        if (!result.mimetype.startsWith('audio/')) {
          throw new Error('File is not an audio file');
        }

        if (isMounted) {
          // Create blob URL for preview
          const url = URL.createObjectURL(result.blob);
          setBlobUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load audio';
        console.error('Audio preview error:', errorMessage);

        if (isMounted) {
          setError(errorMessage);
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    };

    loadAudio();

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
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading audio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center space-y-4">
          <div className="text-red-500">
            <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Failed to load audio</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">No preview available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
      {/* Audio player */}
      <div className="w-full max-w-md">
        <audio
          controls
          className="w-full"
          preload="metadata"
        >
          <source src={blobUrl} type={mimetype} />
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* File info */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{filename}</h3>
        <p className="text-sm text-muted-foreground">{mimetype}</p>
      </div>
    </div>
  );
};
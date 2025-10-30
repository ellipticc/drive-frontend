import React, { useState, useEffect } from 'react';
import { downloadEncryptedFile, DownloadProgress } from '@/lib/download';
import { keyManager } from '@/lib/key-manager';

interface PdfPreviewProps {
  fileId: string;
  filename: string;
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({
  fileId,
  filename,
  onProgress,
  onError,
  isLoading,
  setIsLoading
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get user keys
        const userKeys = await keyManager.getUserKeys();

        // Download the file using the same encrypted flow as downloads
        const result = await downloadEncryptedFile(fileId, userKeys, (progress) => {
          onProgress?.(progress);
        });

        // Verify it's actually a PDF
        if (!result.mimetype.includes('pdf')) {
          throw new Error('File is not a PDF');
        }

        if (isMounted) {
          // Create blob URL for preview
          const url = URL.createObjectURL(result.blob);
          setBlobUrl(url);
          setIsLoading(false);

          // Open PDF in new tab immediately
          window.open(url, '_blank');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF';
        console.error('PDF preview error:', errorMessage);

        if (isMounted) {
          setError(errorMessage);
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    };

    loadPdf();

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
          <p className="text-sm text-muted-foreground">Opening PDF in new tab...</p>
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
          <p className="text-sm text-muted-foreground">Failed to open PDF</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="text-6xl text-primary">
          <svg className="h-16 w-16 mx-auto" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5 2H15.5L19 5.5V22H5V2H8.5ZM15 3.5V7H18.5L15 3.5ZM7 4V20H17V9H13V4H7ZM9 12H15V14H9V12ZM9 16H15V18H9V16Z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">{filename}</h3>
        <p className="text-sm text-muted-foreground">PDF opened in new tab</p>
        <p className="text-xs text-muted-foreground">Check your browser tabs</p>
      </div>
    </div>
  );
};
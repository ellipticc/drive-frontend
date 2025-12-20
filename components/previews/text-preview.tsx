import React, { useState, useEffect } from 'react';
import { downloadEncryptedFile, DownloadProgress } from '@/lib/download';
import { keyManager } from '@/lib/key-manager';
import { Loader2 } from 'lucide-react';

interface TextPreviewProps {
  fileId: string;
  filename: string;
  mimetype: string;
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const TextPreview: React.FC<TextPreviewProps> = ({
  fileId,
  filename,
  mimetype,
  onProgress,
  onError,
  isLoading,
  setIsLoading
}) => {
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isMounted = true;

    const loadText = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get user keys
        const userKeys = await keyManager.getUserKeys();

        // Download the file using the same encrypted flow as downloads
        const result = await downloadEncryptedFile(fileId, userKeys, (progress) => {
          onProgress?.(progress);
        });

        // Verify it's actually a text file
        if (!result.mimetype.startsWith('text/') && !result.mimetype.includes('javascript') && !result.mimetype.includes('json')) {
          throw new Error('File is not a text file');
        }

        // Read the blob as text
        const textContent = await result.blob.text();

        if (isMounted) {
          setContent(textContent);
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load text file';
        console.error('Text preview error:', errorMessage);

        if (isMounted) {
          setError(errorMessage);
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    };

    loadText();
  }, [fileId]); // Only depend on fileId to prevent infinite loops

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading text...</p>
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
          <p className="text-sm text-muted-foreground">Failed to load text file</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with file info */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">{filename}</h3>
            <p className="text-xs text-muted-foreground">{mimetype}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <span>{content.split('\n').length} lines</span>
          <span>{content.length} characters</span>
        </div>
      </div>

      {/* Text content */}
      <div className="flex-1 overflow-auto">
        <pre
          className="p-4 text-sm leading-relaxed whitespace-pre-wrap break-words font-mono"
          style={{
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'auto'
          }}
        >
          {content}
        </pre>
      </div>
    </div>
  );
};
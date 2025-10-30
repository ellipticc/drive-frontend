import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DownloadProgress } from '@/lib/download';
import { PdfPreview } from './pdf-preview';
import { AudioPreview } from './audio-preview';
import { VideoPreview } from './video-preview';
import { TextPreview } from './text-preview';
import { ImagePreview } from './image-preview';
import { X, Download, Eye } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
}

interface PreviewModalProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (fileId: string, filename: string, fileType: 'file' | 'folder') => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  file,
  open,
  onOpenChange,
  onDownload
}) => {
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleProgress = useCallback((progress: DownloadProgress) => {
    setDownloadProgress(progress);
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Preview error:', error);
    setIsLoading(false);
    // Could show a toast here if needed
  }, []);

  const getModalSize = useMemo(() => {
    if (!file || !file.mimeType) return 'max-w-6xl w-full h-[90vh]';

    const mimeType = file.mimeType;

    // Image files - medium size, good for viewing images
    if (mimeType.startsWith('image/')) {
      return 'max-w-4xl w-full h-[80vh]';
    }

    // Audio files - compact size
    if (mimeType.startsWith('audio/')) {
      return 'max-w-md w-full h-auto';
    }

    // Video files - large size for video playback
    if (mimeType.startsWith('video/')) {
      return 'max-w-5xl w-full h-[85vh]';
    }

    // PDF files - large size for document viewing
    if (mimeType.includes('pdf')) {
      return 'max-w-6xl w-full h-[90vh]';
    }

    // Text files - medium size for code/text reading
    if (mimeType.startsWith('text/') ||
        mimeType.includes('javascript') ||
        mimeType.includes('json') ||
        mimeType.includes('xml')) {
      return 'max-w-4xl w-full h-[80vh]';
    }

    // Default fallback
    return 'max-w-6xl w-full h-[90vh]';
  }, [file]);

  const getModalContent = useMemo(() => {
    if (!file || file.type !== 'file' || !file.mimeType) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center space-y-4">
            <Eye className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No preview available for this file type</p>
          </div>
        </div>
      );
    }

    const { id, name, mimeType } = file;

    // PDF files
    if (mimeType.includes('pdf')) {
      return (
        <PdfPreview
          fileId={id}
          filename={name}
          onProgress={handleProgress}
          onError={handleError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      );
    }

    // Audio files
    if (mimeType.startsWith('audio/')) {
      return (
        <AudioPreview
          fileId={id}
          filename={name}
          mimetype={mimeType}
          onProgress={handleProgress}
          onError={handleError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      );
    }

    // Video files
    if (mimeType.startsWith('video/')) {
      return (
        <VideoPreview
          fileId={id}
          filename={name}
          mimetype={mimeType}
          onProgress={handleProgress}
          onError={handleError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      );
    }

    // Image files
    if (mimeType.startsWith('image/')) {
      return (
        <ImagePreview
          fileId={id}
          filename={name}
          onProgress={handleProgress}
          onError={handleError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      );
    }

    // Text files
    if (mimeType.startsWith('text/') ||
        mimeType.includes('javascript') ||
        mimeType.includes('json') ||
        mimeType.includes('xml')) {
      return (
        <TextPreview
          fileId={id}
          filename={name}
          mimetype={mimeType}
          onProgress={handleProgress}
          onError={handleError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      );
    }

    // No preview available
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
          <p className="text-xs text-muted-foreground">{mimeType}</p>
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(id, name, file.type)}
              className="mt-2"
            >
              <Download className="h-4 w-4 mr-2" />
              Download instead
            </Button>
          )}
        </div>
      </div>
    );
  }, [file, handleProgress, handleError, onDownload, isLoading, setIsLoading]);

  // Reset loading state when file changes
  useEffect(() => {
    if (file) {
      setIsLoading(false);
      setDownloadProgress(null);
    }
  }, [file?.id, setIsLoading]);

  const canPreview = (file: FileItem | null): boolean => {
    if (!file || file.type !== 'file' || !file.mimeType) return false;

    const mimeType = file.mimeType;
    return mimeType.includes('pdf') ||
           mimeType.startsWith('audio/') ||
           mimeType.startsWith('video/') ||
           mimeType.startsWith('image/') ||
           mimeType.startsWith('text/') ||
           mimeType.includes('javascript') ||
           mimeType.includes('json') ||
           mimeType.includes('xml');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${getModalSize} p-0 gap-0`}>
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {file ? `Preview: ${file.name}` : 'File Preview'}
            </DialogTitle>
            <div className="flex items-center space-x-2">
              {file && onDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(file.id, file.name, file.type)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
          {file && !canPreview(file) && (
            <p className="text-sm text-muted-foreground mt-2">
              This file type doesn't support preview. You can download it instead.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {downloadProgress && downloadProgress.stage !== 'complete' && (
            <div className="px-6 py-2 bg-muted/50 border-b border-border">
              <div className="flex items-center space-x-4 text-sm">
                <span className="capitalize">{downloadProgress.stage}...</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.overallProgress}%` }}
                  />
                </div>
                <span>{Math.round(downloadProgress.overallProgress)}%</span>
              </div>
            </div>
          )}

          <div className="h-full overflow-auto">
            {getModalContent}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
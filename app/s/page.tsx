'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconDownload, IconLoader2, IconLock, IconFile, IconFolder } from '@tabler/icons-react';
import { toast } from 'sonner';

interface SharedFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  encrypted_cek: string;
  encrypted_name: string;
  has_password: boolean;
}

function SharedFileViewerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shareId, setShareId] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sharedFile, setSharedFile] = useState<SharedFile | null>(null);
  const [error, setError] = useState<string>('');
  const [requiresPassword, setRequiresPassword] = useState(false);

  useEffect(() => {
    // Extract shareId from URL path
    const path = window.location.pathname;
    const match = path.match(/\/s\/([a-f0-9]+)/);
    if (match) {
      setShareId(match[1]);
    }

    // Extract encryption key from hash
    const hash = window.location.hash;
    if (hash.startsWith('#')) {
      setEncryptionKey(hash.substring(1));
    }
  }, []);

  useEffect(() => {
    if (shareId) {
      loadSharedFile();
    }
  }, [shareId]);

  const loadSharedFile = async () => {
    if (!shareId) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.getSharedFile(shareId);
      
      if (response.success && response.data) {
        setSharedFile(response.data);
        setRequiresPassword(response.data.has_password);
      } else {
        setError(response.error || 'Failed to load shared file');
      }
    } catch (err) {
      console.error('Error loading shared file:', err);
      setError('Failed to load shared file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!shareId || !sharedFile) return;

    if (requiresPassword && !password) {
      toast.error('Please enter the password');
      return;
    }

    if (!requiresPassword && !encryptionKey) {
      toast.error('Missing encryption key in URL');
      return;
    }

    setIsDownloading(true);

    try {
      const response = await apiClient.downloadSharedFile(
        shareId,
        requiresPassword ? password : encryptionKey,
        requiresPassword
      );

      if (response.success && response.data) {
        // Create blob and download
        const blob = new Blob([response.data], { type: sharedFile.mime_type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sharedFile.name || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('File downloaded successfully');
      } else {
        toast.error(response.error || 'Failed to download file');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      toast.error('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <IconLoader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedFile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconLock className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Unable to Access File</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'This file may have been deleted, expired, or you don\'t have permission to access it.'}
          </p>
          <Button onClick={() => router.push('/')} variant="outline">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="max-w-lg w-full border rounded-lg p-8 bg-card shadow-lg">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <IconFile className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Shared File</h1>
        
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">File Name:</span>
            <span className="font-medium truncate max-w-[200px]" title={sharedFile.name}>
              {sharedFile.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">File Size:</span>
            <span className="font-medium">
              {(sharedFile.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        </div>

        {requiresPassword && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">
              Password Required
            </label>
            <Input
              type="password"
              placeholder="Enter password to access file"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
            />
          </div>
        )}

        <Button
          onClick={handleDownload}
          disabled={isDownloading || (requiresPassword && !password)}
          className="w-full"
          size="lg"
        >
          {isDownloading ? (
            <>
              <IconLoader2 className="h-5 w-5 animate-spin mr-2" />
              Downloading...
            </>
          ) : (
            <>
              <IconDownload className="h-5 w-5 mr-2" />
              Download File
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-4">
          This file is end-to-end encrypted. Only you and the file owner can access its contents.
        </p>
      </div>
    </div>
  );
}

export default function SharedFileViewer() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SharedFileViewerContent />
    </Suspense>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { downloadEncryptedFileWithCEK, downloadEncryptedFile } from '@/lib/download';
import { decryptData } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Loader2, Download, File, AlertCircle, CheckCircle, Share2, FolderOpen, ChevronRight, Lock } from 'lucide-react';

interface ShareDetails {
  id: string;
  file_id: string;
  folder_id?: string;
  is_folder: boolean;
  has_password: boolean;
  salt_pw?: string;
  expires_at?: string;
  max_views?: number;
  views: number;
  disabled: boolean;
  wrapped_cek?: string;
  nonce_wrap?: string;
  kyber_ciphertext?: string;
  kyber_public_key?: string;
  kyber_wrapped_cek?: string;
  nonce_wrap_kyber?: string;
  encryption_version?: number;
  file?: {
    id: string;
    filename: string;
    size: number;
    mimetype: string;
    created_at: string;
  };
  folder?: {
    id: string;
    name: string;
    created_at: string;
  };
}

interface ManifestItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  created_at?: string;
  parent_id?: string | null;
  mimetype?: string;
  folder_id?: string;
}

export default function SharedDownloadPage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;

  const [shareDetails, setShareDetails] = useState<ShareDetails | null>(null);
  const [manifest, setManifest] = useState<Record<string, ManifestItem>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [password, setPassword] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Get items for current folder from manifest
  const currentFolderContents = useMemo(() => {
    if (!manifest || Object.keys(manifest).length === 0 || !currentFolderId) {
      return { folders: [], files: [] };
    }

    const folders: ManifestItem[] = [];
    const files: ManifestItem[] = [];

    for (const item of Object.values(manifest)) {
      if (item.type === 'folder' && item.parent_id === currentFolderId) {
        folders.push(item);
      } else if (item.type === 'file' && item.folder_id === currentFolderId) {
        files.push(item);
      }
    }

    return { folders: folders.sort((a, b) => a.name.localeCompare(b.name)), files: files.sort((a, b) => a.name.localeCompare(b.name)) };
  }, [manifest, currentFolderId]);

  const loadShareDetails = async () => {
    try {
      const shareResponse = await apiClient.getShare(shareId);
      if (!shareResponse.success || !shareResponse.data) {
        throw new Error('Share not found or expired');
      }

      const share = shareResponse.data;
      setShareDetails(share);

      if (share.disabled) {
        throw new Error('This share link has been disabled');
      }

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        throw new Error('This share link has expired');
      }

      if (share.max_views && share.views >= share.max_views) {
        throw new Error('This share link has reached its maximum view limit');
      }

      if (share.has_password) {
        setPasswordVerified(false);
      } else {
        setPasswordVerified(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share details');
      setLoading(false);
    }
  };

  const loadManifestAndInitialize = async () => {
    if (!shareDetails) return;

    try {
      const manifestResponse = await apiClient.getShareManifest(shareId);
      if (!manifestResponse.success || !manifestResponse.data) {
        throw new Error('Failed to load folder contents');
      }

      setManifest(manifestResponse.data);

      if (shareDetails.is_folder && shareDetails.folder_id) {
        // Initialize folder view
        setCurrentFolderId(shareDetails.folder_id);
        setBreadcrumbs([{ id: shareDetails.folder_id, name: shareDetails.folder?.name || 'Shared Folder' }]);
      }
    } catch (err) {
      console.error('Failed to load manifest:', err);
      setError(err instanceof Error ? err.message : 'Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Shared File - Ellipticc Drive';

    if (shareId) {
      loadShareDetails();
    }
  }, [shareId]);

  useEffect(() => {
    if (shareDetails && passwordVerified) {
      loadManifestAndInitialize();
    }
  }, [shareDetails, passwordVerified]);

  const handleVerifyPassword = async () => {
    if (!shareDetails || !password) return;

    setVerifyingPassword(true);
    setPasswordError(null);

    try {
      if (!shareDetails.salt_pw) {
        throw new Error('Password data not available');
      }

      const [saltHex, encryptedCekB64] = shareDetails.salt_pw.split(':');
      if (!saltHex || !encryptedCekB64) {
        throw new Error('Invalid password data format');
      }

      const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []);
      const encryptedCekWithIv = new Uint8Array(atob(encryptedCekB64).split('').map(c => c.charCodeAt(0)));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password + saltHex),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const iv = encryptedCekWithIv.slice(0, 12);
      const encryptedCek = encryptedCekWithIv.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedCek
      );
      const shareCek = new Uint8Array(decrypted);

      if (shareCek.length !== 32) {
        throw new Error('Invalid decrypted share key');
      }

      setPasswordVerified(true);
    } catch (err) {
      setPasswordError('Incorrect password. Please try again.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const getShareCEK = async (): Promise<Uint8Array> => {
    if (!shareDetails) throw new Error('Share details not loaded');

    if (shareDetails.has_password) {
      if (!shareDetails.salt_pw) {
        throw new Error('Password data not available');
      }

      const [saltHex, encryptedCekB64] = shareDetails.salt_pw.split(':');
      if (!saltHex || !encryptedCekB64) {
        throw new Error('Invalid password data format');
      }

      const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []);
      const encryptedCekWithIv = new Uint8Array(atob(encryptedCekB64).split('').map(c => c.charCodeAt(0)));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password + saltHex),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const iv = encryptedCekWithIv.slice(0, 12);
      const encryptedCek = encryptedCekWithIv.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedCek
      );
      return new Uint8Array(decrypted);
    } else {
      const urlFragment = window.location.hash.substring(1);
      if (!urlFragment) {
        throw new Error('Share link is missing encryption key. Please use a valid share link.');
      }
      return new Uint8Array(atob(urlFragment).split('').map(c => c.charCodeAt(0)));
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    if (!shareDetails) return;

    setDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      const shareCek = await getShareCEK();

      if (!shareDetails.wrapped_cek || !shareDetails.nonce_wrap) {
        throw new Error('Share encryption data not available');
      }

      const { decryptData } = await import('@/lib/crypto');
      const fileCek = decryptData(shareDetails.wrapped_cek, shareCek, shareDetails.nonce_wrap);

      const result = await downloadEncryptedFileWithCEK(fileId, fileCek, (progress) => {
        setDownloadProgress(progress.overallProgress);
      });

      await apiClient.trackShareDownload(shareId);

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleNavigateFolder = (folderId: string, folderName: string) => {
    const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
    if (existingIndex >= 0) {
      setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
    } else {
      setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    }
    setCurrentFolderId(folderId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">File Share</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading share details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">File Share</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex items-center justify-center py-16 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle className="text-destructive">Share Unavailable</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button
                onClick={() => router.push('/')}
                className="w-full mt-4"
                variant="outline"
              >
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!shareDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">
              {shareDetails.is_folder ? 'Shared Folder' : 'Shared File'}
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          {shareDetails.has_password && !passwordVerified ? (
            <>
              <CardHeader className="text-center">
                <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Password Required</CardTitle>
                <CardDescription>Enter the password to access this share</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                  />
                </div>
                <Button
                  onClick={handleVerifyPassword}
                  disabled={verifyingPassword || !password}
                  className="w-full"
                  size="lg"
                >
                  {verifyingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Password'
                  )}
                </Button>
                {passwordError && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </>
          ) : shareDetails.is_folder ? (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>{shareDetails.folder?.name || 'Shared Folder'}</CardTitle>
                    <CardDescription>
                      Shared on {shareDetails.folder?.created_at ? formatDate(shareDetails.folder.created_at) : 'unknown date'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Breadcrumbs */}
                {breadcrumbs.length > 0 && (
                  <div className="flex items-center gap-1 text-sm pb-4 border-b">
                    {breadcrumbs.map((crumb, index) => (
                      <div key={crumb.id} className="flex items-center gap-1">
                        {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <button
                          onClick={() => {
                            if (index === 0) {
                              setCurrentFolderId(crumb.id);
                              setBreadcrumbs([crumb]);
                            } else {
                              const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                              setBreadcrumbs(newBreadcrumbs);
                              setCurrentFolderId(crumb.id);
                            }
                          }}
                          className={`hover:underline ${index === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-primary'}`}
                        >
                          {crumb.name}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Download Progress */}
                {downloading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Downloading...</span>
                      <span className="font-mono">{downloadProgress}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                  </div>
                )}

                {/* Folder Contents */}
                {Object.keys(manifest).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading folder contents...</p>
                  </div>
                ) : currentFolderContents.folders.length === 0 && currentFolderContents.files.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">This folder is empty</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Folders */}
                    {currentFolderContents.folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleNavigateFolder(folder.id, folder.name)}
                        className="w-full flex items-center justify-between p-3 hover:bg-accent border rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                      </button>
                    ))}

                    {/* Files */}
                    {currentFolderContents.files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleDownloadFile(file.id, file.name)}
                        className="w-full flex items-center justify-between p-3 hover:bg-accent border rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left min-w-0">
                          <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            {file.size && (
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            )}
                          </div>
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <File className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>File Ready for Download</CardTitle>
                <CardDescription>A file has been shared with you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {shareDetails.file && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-muted-foreground">Filename</span>
                        <p className="text-sm font-mono break-all">{shareDetails.file.filename}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-muted-foreground">Size</span>
                        <p className="text-sm">{formatFileSize(shareDetails.file.size)}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-muted-foreground">Uploaded</span>
                        <p className="text-sm">{formatDate(shareDetails.file.created_at)}</p>
                      </div>
                      {shareDetails.expires_at && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Expires</span>
                          <p className="text-sm">{formatDate(shareDetails.expires_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {downloading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Downloading...</span>
                      <span className="font-mono">{downloadProgress}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                  </div>
                )}

                <Button
                  onClick={() => handleDownloadFile(shareDetails.file_id, shareDetails.file?.filename || 'file')}
                  disabled={downloading}
                  className="w-full"
                  size="lg"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </>
                  )}
                </Button>

                {error && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

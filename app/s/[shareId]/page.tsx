'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { downloadEncryptedFileWithCEK, downloadEncryptedFile } from '@/lib/download';
import { decryptData, hexToUint8Array } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Loader2, Download, File, AlertCircle, CheckCircle, Share2 } from 'lucide-react';

interface ShareDetails {
  id: string;
  file_id: string;
  has_password: boolean;
  salt_pw?: string;
  expires_at?: string;
  max_views?: number;
  views: number;
  disabled: boolean;
  wrapped_cek?: string; // Now returned for E2EE envelope decryption
  nonce_wrap?: string; // Now returned for E2EE envelope decryption
  kyber_ciphertext?: string;
  kyber_public_key?: string;
  kyber_wrapped_cek?: string;
  nonce_wrap_kyber?: string;
  encryption_version?: number;
  file: {
    id: string;
    filename: string;
    size: number;
    mimetype: string;
    created_at: string;
  };
}

interface FileInfo {
  id: string;
  name: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export default function SharedDownloadPage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;

  const [shareDetails, setShareDetails] = useState<ShareDetails | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Shared File - Ellipticc Drive"
    
    const loadShareDetails = async () => {
      try {
        // Get share details
        const shareResponse = await apiClient.getShare(shareId);
        if (!shareResponse.success || !shareResponse.data) {
          throw new Error('Share not found or expired');
        }

        const share = shareResponse.data;
        setShareDetails(share);

        // Check if share is disabled or expired
        if (share.disabled) {
          throw new Error('This share link has been disabled');
        }

        if (share.expires_at) {
          const expiresAt = new Date(share.expires_at);
          if (expiresAt < new Date()) {
            throw new Error('This share link has expired');
          }
        }

        if (share.max_views && share.views >= share.max_views) {
          throw new Error('This share link has reached its maximum view limit');
        }

        // Get file info from share response
        setFileInfo({
          id: share.file.id,
          name: share.file.filename,
          filename: share.file.filename,
          size: share.file.size,
          mimeType: share.file.mimetype,
          createdAt: share.file.created_at
        });

        // Check if password is required
        setPasswordRequired(share.has_password);

        // If no password required, set as verified
        if (!share.has_password) {
          setPasswordVerified(true);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load share details');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      loadShareDetails();
    }
  }, [shareId]);

  const handleVerifyPassword = async () => {
    if (!shareDetails || !password) return;

    setVerifyingPassword(true);
    setPasswordError(null);

    try {
      // Try to derive share CEK from password
      if (!shareDetails.salt_pw) {
        throw new Error('Password data not available');
      }

      const [saltHex, encryptedCekB64] = shareDetails.salt_pw.split(':');
      if (!saltHex || !encryptedCekB64) {
        throw new Error('Invalid password data format');
      }

      const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []);
      const encryptedCekWithIv = new Uint8Array(atob(encryptedCekB64).split('').map(c => c.charCodeAt(0)));

      // Derive key from password + salt
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

      // Try to decrypt the share CEK
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

      // If successful, mark as verified
      setPasswordVerified(true);

    } catch (err) {
      setPasswordError('Incorrect password. Please try again.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleDownload = async () => {
    if (!shareDetails || !fileInfo) return;

    setDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      let shareCek: Uint8Array;

      if (shareDetails.has_password) {
        // Derive share CEK from password
        if (!shareDetails.salt_pw) {
          throw new Error('Password data not available');
        }

        const [saltHex, encryptedCekB64] = shareDetails.salt_pw.split(':');
        if (!saltHex || !encryptedCekB64) {
          throw new Error('Invalid password data format');
        }

        const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []);
        const encryptedCekWithIv = new Uint8Array(atob(encryptedCekB64).split('').map(c => c.charCodeAt(0)));

        // Derive key from password + salt
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

        // Decrypt the share CEK
        const iv = encryptedCekWithIv.slice(0, 12);
        const encryptedCek = encryptedCekWithIv.slice(12);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          encryptedCek
        );
        shareCek = new Uint8Array(decrypted);

        if (shareCek.length !== 32) {
          throw new Error('Invalid decrypted share key');
        }
      } else {
        // Extract share CEK from URL fragment
        const urlFragment = window.location.hash.substring(1); // Remove the '#'
        if (!urlFragment) {
          throw new Error('Share link is missing encryption key. Please use a valid share link.');
        }

        // Decode the base64 share CEK
        shareCek = new Uint8Array(atob(urlFragment).split('').map(c => c.charCodeAt(0)));

        if (shareCek.length !== 32) {
          throw new Error('Invalid share encryption key');
        }
      }

      // console.log('🔐 Using share CEK for true E2EE download');

      // Get the envelope-encrypted file CEK from the share data
      if (!shareDetails.wrapped_cek || !shareDetails.nonce_wrap) {
        throw new Error('Share encryption data not available');
      }

      // Decrypt the file CEK using the share CEK (unwrap envelope)
      const { decryptData } = await import('@/lib/crypto');
      const fileCek = decryptData(shareDetails.wrapped_cek, shareCek, shareDetails.nonce_wrap);

      // Now download the file using the decrypted file CEK
      const result = await downloadEncryptedFileWithCEK(shareDetails.file_id, fileCek, (progress) => {
        setDownloadProgress(progress.overallProgress);
      });

      // Track the download
      await apiClient.trackShareDownload(shareId);

      // Create download link
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadComplete(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">File Share</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Loading Content */}
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
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">File Share</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Error Content */}
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

  if (downloadComplete) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold">File Share</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Success Content */}
        <div className="flex items-center justify-center py-16 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-green-700">Download Complete</CardTitle>
              <CardDescription>
                Your file has been downloaded successfully
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push('/')}
                className="w-full"
              >
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">File Share</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <File className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>{passwordRequired && !passwordVerified ? 'Password Required' : 'File Ready for Download'}</CardTitle>
            <CardDescription>
              {passwordRequired && !passwordVerified ? 'Enter the password to access this shared file' : 'A file has been shared with you'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Password Verification */}
            {passwordRequired && !passwordVerified && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Enter Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="text-sm"
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
              </div>
            )}

            {/* File Info - Only show after password verification */}
            {passwordVerified && fileInfo && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Filename</span>
                    <p className="text-sm font-mono break-all">{fileInfo.filename}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Size</span>
                    <p className="text-sm">{formatFileSize(fileInfo.size)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Uploaded</span>
                    <p className="text-sm">{formatDate(fileInfo.createdAt)}</p>
                  </div>
                  {shareDetails?.expires_at && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">Expires</span>
                      <p className="text-sm">{formatDate(shareDetails.expires_at)}</p>
                    </div>
                  )}
                  {shareDetails?.max_views && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">Views</span>
                      <p className="text-sm">
                        {shareDetails.views} / {shareDetails.max_views}
                      </p>
                    </div>
                  )}
                </div>
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

            {/* Download Button - Only show after password verification */}
            {passwordVerified && (
              <Button
                onClick={handleDownload}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
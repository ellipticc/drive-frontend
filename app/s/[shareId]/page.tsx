'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { downloadEncryptedFileWithCEK } from '@/lib/download';
import { truncateFilename, formatFileSize } from '@/lib/utils';
import { PauseController } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { IconLoader2, IconDownload, IconFile, IconAlertCircle, IconFolderOpen, IconChevronRight, IconLock, IconCaretLeftRightFilled, IconLogout, IconEyeOff, IconInfoCircle } from '@tabler/icons-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { masterKeyManager } from '@/lib/master-key';
import { getDiceBearAvatar } from '@/lib/avatar';
import { ReportDialog } from '@/components/shared/report-dialog';
import { UnifiedProgressModal } from '@/components/modals/unified-progress-modal';
import { DownloadProgress } from '@/lib/download';
import {
  decryptShareFilename,
  decryptEncryptedManifest,
  verifySharePassword,
  looksLikeEncryptedName,
  decryptManifestItemName
} from '@/lib/share-crypto';
import { FullPagePreviewModal, PreviewFileItem } from "@/components/previews/full-page-preview-modal";
import { AudioPreview } from '@/components/previews/audio-preview';
import { ImagePreview } from '@/components/previews/image-preview';
import { TextPreview } from '@/components/previews/text-preview';
import { PdfPreview } from '@/components/previews/pdf-preview';
import { VideoPreview } from '@/components/previews/video-preview';
import { CommentSection } from '@/components/shared/comment-section';
import { FileDetailsDialog } from '@/components/shared/file-details-dialog';

interface ShareDetails {
  id: string;
  file_id: string;
  folder_id?: string;
  owner_user_id?: string;
  owner_name?: string;
  is_folder: boolean;
  has_password: boolean;
  salt_pw?: string;
  comments_enabled?: boolean | number;
  comments_locked?: boolean | number;
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
  encrypted_filename?: string; // Filename encrypted with share CEK
  nonce_filename?: string; // Nonce for filename encryption
  encrypted_manifest?: { encryptedData: string; nonce: string } | string; // E2EE folder manifest
  file?: {
    id: string;
    filename: string;
    size: number;
    mimetype: string;
    created_at: string;
  };
  folder?: {
    id: string;
    name: string; // Master-key encrypted name (for backward compatibility)
    encrypted_name?: string; // Share-CEK encrypted folder name
    nonce_name?: string; // Nonce for folder name decryption
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
  wrapped_cek?: string; // For files in folder shares
  nonce_wrap?: string; // For files in folder shares
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
  const [downloadingType, setDownloadingType] = useState<'header' | 'center' | null>(null);
  const downloading = !!downloadingType;
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Download controllers
  const downloadAbortControllerRef = useRef<AbortController | null>(null);
  const pauseResolverRef = useRef<(() => void) | null>(null);
  const pauseControllerRef = useRef<PauseController>({
    isPaused: false,
    waitIfPaused: async () => {
      if (pauseControllerRef.current.isPaused) {
        await new Promise<void>(resolve => {
          pauseResolverRef.current = resolve;
        });
      }
    }
  });
  const [isDownloadPaused, setIsDownloadPaused] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [decryptedFilename, setDecryptedFilename] = useState<string | null>(null);
  const [decryptedFolderName, setDecryptedFolderName] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<{ id: string; name: string; email: string; avatar: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sharePasswordCEK, setSharePasswordCEK] = useState<Uint8Array | null>(null); // Store CEK from password verification
  const [shareCek, setShareCek] = useState<Uint8Array | null>(null);

  // Preview State
  const [previewFile, setPreviewFile] = useState<PreviewFileItem & { blobUrl: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewProgress, setPreviewProgress] = useState<DownloadProgress | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Load share details function
  const loadShareDetails = useCallback(async () => {
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
        // Stop loading here to show password prompt
        setLoading(false);
      } else {
        setPasswordVerified(true);
        // Loading continues until manifest is loaded
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share details');
      setLoading(false);
    }
  }, [shareId]);

  // Helper: Get display name
  const getDisplayName = (user: { name: string; email: string }): string => {
    if (user.name && user.name.trim() !== '') {
      return user.name.trim();
    }
    const emailPrefix = user.email ? user.email.split('@')[0] : '';
    return emailPrefix || 'User';
  };

  // Check user session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setCheckingSession(false);
          return;
        }

        // Try to fetch user profile to verify session
        const response = await apiClient.getProfile();
        if (response.success && response.data?.user) {
          setUserSession({
            id: response.data.user.id,
            name: response.data.user.name || '',
            email: response.data.user.email,
            avatar: response.data.user.avatar || ''
          });
        }
      } catch (err) {
        // Session check failed - user not authenticated
        console.warn('Session check failed:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await apiClient.logout();
      masterKeyManager.completeClearOnLogout();
    } catch {
      apiClient.clearAuthToken();
      masterKeyManager.completeClearOnLogout();
    } finally {
      setUserSession(null);
      window.location.href = '/login';
    }
  };

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

  const loadManifestAndInitialize = async () => {
    if (!shareDetails) return;

    try {
      const shareCek = await getShareCEK();
      let decryptedManifest: Record<string, ManifestItem> = {};

      // If the share has encrypted_manifest, use it directly (true E2EE)
      if (shareDetails.encrypted_manifest) {
        const rawManifest = await decryptEncryptedManifest(shareDetails.encrypted_manifest, shareCek);

        for (const [itemId, item] of Object.entries(rawManifest)) {
          const manifestItem = item as Record<string, unknown>;
          let decryptedName = itemId;

          // Get plaintext name if present
          if (typeof manifestItem.name === 'string') {
            decryptedName = manifestItem.name as string;
          }

          // Try to decrypt the name if it looks encrypted (base64:base64 format with salt)
          if (typeof manifestItem.name === 'string' && manifestItem.name_salt && looksLikeEncryptedName(manifestItem.name)) {
            try {
              decryptedName = await decryptManifestItemName(manifestItem.name as string, manifestItem.name_salt as string, shareCek, manifestItem.type as string);
            } catch (decryptErr) {
              console.warn(`Failed to decrypt name for ${itemId}, keeping fallback:`, decryptErr);
              // Keep the original (might be base64 but wrong key - use fallback display)
            }
          }

          decryptedManifest[itemId] = {
            ...(manifestItem as Record<string, unknown>),
            id: itemId,
            name: decryptedName
          } as ManifestItem;
        }
      } else if (shareDetails.is_folder) {
        // For folder shares without pre-encrypted manifest, fetch from API (backward compatibility)
        const manifestResponse = await apiClient.getShareManifest(shareId);

        if (!manifestResponse.success || !manifestResponse.data) {
          // If manifest endpoint returns nothing or error, that's OK for file shares
          if (shareDetails.is_folder) {
            throw new Error('Failed to load folder contents');
          }
          console.warn('ℹNo manifest available (file share)');
          decryptedManifest = {};
        } else {
          const rawManifest = manifestResponse.data as Record<string, unknown>;

          // Decrypt all manifest item names using the share CEK (only if encrypted)
          for (const [itemId, item] of Object.entries(rawManifest)) {
            try {
              const manifestItem = item as Record<string, unknown>;
              let decryptedName = itemId;

              if (typeof manifestItem.name === 'string') {
                decryptedName = manifestItem.name as string;
              }

              // Only try to decrypt if it looks like encrypted data (base64:base64 format)
              if (typeof manifestItem.name === 'string' && manifestItem.name_salt && looksLikeEncryptedName(manifestItem.name)) {
                try {
                  decryptedName = await decryptManifestItemName(manifestItem.name as string, manifestItem.name_salt as string, shareCek, manifestItem.type as string);
                } catch (decryptErr) {
                  // If decryption fails, it might be old plaintext format - keep original
                  console.warn(`Failed to decrypt name for ${itemId}, using plaintext fallback:`, decryptErr);
                  decryptedName = manifestItem.name as string || itemId;
                }
              }
              // If name doesn't look encrypted, keep it as-is (old plaintext format or already decrypted)

              decryptedManifest[itemId] = {
                ...(manifestItem as Record<string, unknown>),
                id: itemId,
                name: decryptedName
              } as ManifestItem;
            } catch (err) {
              console.warn(`Error processing manifest item ${itemId}:`, err);
              decryptedManifest[itemId] = item as ManifestItem;
            }
          }
        }
      } else {
        // For file shares, empty manifest is expected
        decryptedManifest = {};
      }

      setManifest(decryptedManifest);

      if (shareDetails.is_folder && shareDetails.folder_id) {
        // Initialize folder view
        setCurrentFolderId(shareDetails.folder_id);

        // Try to decrypt folder name using share-CEK encrypted data first
        let folderName = 'Shared Folder';
        if (shareDetails.folder?.encrypted_name && shareDetails.folder?.nonce_name) {
          try {
            folderName = await decryptShareFilename(
              shareDetails.folder.encrypted_name,
              shareDetails.folder.nonce_name,
              shareCek
            );
          } catch (err) {
            console.warn('Failed to decrypt folder name with share CEK, trying manifest:', err);
            // Fallback to manifest or master-key encrypted name
            folderName = decryptedManifest[shareDetails.folder_id]?.name || shareDetails.folder?.name || 'Shared Folder';
          }
        } else {
          // Fallback to manifest or master-key encrypted name
          folderName = decryptedManifest[shareDetails.folder_id]?.name || shareDetails.folder?.name || 'Shared Folder';
        }

        setDecryptedFolderName(folderName);
        setBreadcrumbs([{ id: shareDetails.folder_id, name: folderName }]);
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
  }, [shareId, loadShareDetails]);

  // Initialize ingest server session for analytics
  useEffect(() => {
    const initializeIngestSession = async () => {
      try {
        const ingestBaseUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'https://ingest.ellipticc.com';
        const sessionUrl = `${ingestBaseUrl}/api/v1/sessions/start`;

        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        // SECURITY: Remove hash fragment containing encryption key before sending to analytics
        const sanitizedUrl = currentUrl.split('#')[0];
        const referrer = typeof document !== 'undefined' ? document.referrer : '';

        // Extract UTM parameters from URL if present
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const utmSource = urlParams.get('utm_source');
        const utmMedium = urlParams.get('utm_medium');
        const utmCampaign = urlParams.get('utm_campaign');

        const sessionData: { first_landing_url: string; referrer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string } = {
          first_landing_url: sanitizedUrl,
          referrer: referrer || undefined
        };

        // Add UTM parameters if present
        if (utmSource) sessionData.utm_source = utmSource;
        if (utmMedium) sessionData.utm_medium = utmMedium;
        if (utmCampaign) sessionData.utm_campaign = utmCampaign;

        const response = await fetch(sessionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.session_id) {
            // Store session ID in sessionStorage for use in file downloads
            sessionStorage.setItem(`share_session_${shareId}`, data.session_id);
          }
        }
      } catch (err) {
        console.warn('Failed to initialize ingest server session:', err);
        // Non-critical error, don't block share access
      }
    };

    if (shareId) {
      initializeIngestSession();
    }
  }, [shareId]);

  // Get Share CEK from URL hash or password-protected wrapper
  const getShareCEK = useCallback(async (): Promise<Uint8Array> => {
    if (!shareDetails) {
      throw new Error('Share details not loaded');
    }

    // If password-protected and already verified, use the stored CEK
    if (shareDetails.has_password && sharePasswordCEK) {
      return sharePasswordCEK;
    }

    // Try to extract from URL hash
    if (typeof window !== 'undefined') {
      const urlFragment = window.location.hash.substring(1);
      if (urlFragment) {
        try {
          return new Uint8Array(atob(urlFragment).split('').map(c => c.charCodeAt(0)));
        } catch (err) {
          console.warn('Failed to decode CEK from hash:', err);
        }
      }
    }

    if (shareDetails.has_password) {
      throw new Error('Password verification required');
    }

    throw new Error('Share encryption key not found in URL');
  }, [shareDetails, sharePasswordCEK]);

  const handleVerifyPassword = async () => {
    if (!shareDetails || !password) return;

    setVerifyingPassword(true);
    setPasswordError(null);

    try {
      if (!shareDetails.salt_pw) {
        throw new Error('Password data not available');
      }

      // Verify password and get decrypted CEK using helper
      const shareCekFromPw = await verifySharePassword(password, shareDetails.salt_pw);

      // Store the CEK for later use in manifest decryption
      setSharePasswordCEK(shareCekFromPw);
      setPasswordVerified(true);
    } catch {
      setPasswordError('Incorrect password. Please try again.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  useEffect(() => {
    if (shareDetails && passwordVerified) {
      // Load manifest
      loadManifestAndInitialize();

      // Decrypt filename if it's encrypted
      const decryptFilenameIfNeeded = async () => {
        if (!shareDetails) {
          return;
        }

        // Try to decrypt encrypted_filename if available
        if (shareDetails.encrypted_filename && shareDetails.nonce_filename) {
          try {
            const shareCek = await getShareCEK();
            const decrypted = await decryptShareFilename(
              shareDetails.encrypted_filename,
              shareDetails.nonce_filename,
              shareCek
            );
            // Sanitize the decrypted filename to remove any control characters
            const sanitized = decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
            setDecryptedFilename(sanitized || '(File)');
          } catch (err) {
            console.warn('Failed to decrypt filename with share CEK:', err);
            // Fallback to generic name
            setDecryptedFilename('(File)');
          }
        } else if (shareDetails.file?.filename) {
          // Fallback to plaintext filename if encrypted version not available
          // Also sanitize plaintext filenames
          const sanitized = shareDetails.file.filename.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
          setDecryptedFilename(sanitized || '(File)');
        } else {
          setDecryptedFilename('(File)');
        }
      };

      decryptFilenameIfNeeded();

      // Initialize shareCek state for components like CommentSection
      getShareCEK().then(setShareCek).catch(err => {
        console.warn('Failed to initialize shareCek:', err);
      });
    }
  }, [shareDetails, passwordVerified, getShareCEK]);







  const handleDownloadFile = async (fileId: string, fileName: string, type: 'header' | 'center' = 'center') => {
    if (!shareDetails) return;

    setDownloadingType(type);
    setError(null);
    setDownloadError(null);

    // Initialize with known size to avoid "0 B / ..." lag
    const totalSize = shareDetails.is_folder
      ? type === 'header' || type === 'center' ? 0 : 0 // Folder size logic might differ
      : shareDetails.file?.size;

    setDownloadProgress({
      stage: 'initializing',
      overallProgress: 0,
      bytesDownloaded: 0,
      totalBytes: totalSize || 0
    });

    // Reset controllers
    downloadAbortControllerRef.current = new AbortController();
    pauseControllerRef.current.isPaused = false;
    setIsDownloadPaused(false);

    try {
      const shareCek = await getShareCEK();
      setDownloadingType(null); // Stop spinner immediately

      const itemType = manifest[fileId]?.type || (shareDetails.folder?.id === fileId ? 'folder' : 'file');

      if (itemType === 'folder') {
        // Custom folder download logic for shares using manifest
        const { createZipFromFilesAndFolders } = await import('@/lib/download');
        const { decryptData } = await import('@/lib/crypto');

        // 1. Collect all files recursively from manifest
        const allFiles: Array<{ fileId: string, relativePath: string, filename: string, size: number, wrappedCek: string, nonceWrap: string }> = [];
        const allFolders: Array<{ folderId: string, relativePath: string, folderName: string }> = [];

        // Helper to recursively walk manifest
        const walk = (folderId: string | null, currentPath: string) => {
          // Files in this folder
          const files = Object.values(manifest).filter(item => item.type === 'file' && (item.folder_id === folderId || (!folderId && !item.folder_id)));
          for (const file of files) {

            allFiles.push({
              fileId: file.id,
              relativePath: currentPath,
              filename: file.name,
              size: Number(file.size || 0),
              wrappedCek: file.wrapped_cek!,
              nonceWrap: file.nonce_wrap!
            });
          }

          // Subfolders
          const folders = Object.values(manifest).filter(item => item.type === 'folder' && (item.folder_id === folderId || (!folderId && !item.folder_id)));
          for (const folder of folders) {
            const folderName = folder.name;
            const subPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            allFolders.push({
              folderId: folder.id,
              relativePath: currentPath,
              folderName: folderName
            });
            walk(folder.id, subPath);
          }
        };

        walk(fileId, '');

        if (allFiles.length === 0 && allFolders.length === 0) {
          throw new Error('Folder is empty');
        }

        // 2. Download loop
        let completedFiles = 0;
        let totalDownloadedBytes = 0;
        let totalBytes = allFiles.reduce((acc, f) => acc + Number(f.size), 0);

        setDownloadProgress({
          stage: 'initializing',
          overallProgress: 0,
          bytesDownloaded: 0,
          totalBytes: totalBytes
        });

        const downloadedFiles: Array<{ relativePath: string, filename: string, blob: Blob }> = [];

        for (const file of allFiles) {
          if (downloadAbortControllerRef.current?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (pauseControllerRef.current.isPaused) await pauseControllerRef.current.waitIfPaused();

          // Decrypt CEK
          let fileCek: Uint8Array;
          try {
            fileCek = decryptData(file.wrappedCek, shareCek, file.nonceWrap);
          } catch (e) {
            console.error('Failed to decrypt CEK for file', file.filename, e);
            continue; // Skip file
          }

          const result = await downloadEncryptedFileWithCEK(file.fileId, fileCek, (progress) => {
            const currentTotalDownloaded = totalDownloadedBytes + (progress.bytesDownloaded || 0);

            // Calculate percentage based on bytes
            const byteProgress = totalBytes > 0 ? (currentTotalDownloaded / totalBytes) * 100 : 0;
            // Scale to 0-90% for downloading phase
            const overallProgress = Math.min(byteProgress, 90);

            setDownloadProgress({
              stage: progress.stage,
              overallProgress: overallProgress,
              bytesDownloaded: currentTotalDownloaded,
              totalBytes: totalBytes,
              downloadSpeed: progress.downloadSpeed,
              timeRemaining: progress.timeRemaining
            });
          }, downloadAbortControllerRef.current?.signal, pauseControllerRef.current);

          downloadedFiles.push({
            relativePath: file.relativePath,
            filename: result.filename, // Use filename from result (decrypted) or manifest name? Result usually has original filename.
            blob: result.blob
          });

          completedFiles++;
          totalDownloadedBytes += Number(file.size);
        }

        // 3. Zip and Download
        setDownloadProgress((prev) => prev ? ({ ...prev, stage: 'assembling', overallProgress: 95 }) : null);
        const zipBlob = await createZipFromFilesAndFolders(downloadedFiles, allFolders, '');
        setDownloadProgress((prev) => prev ? ({ ...prev, stage: 'complete', overallProgress: 100 }) : null);

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

      } else {
        // ... (Existing file download logic)

        // For file shares, get the file's CEK from the manifest
        // For file shares, use the share's wrapped_cek
        let fileCek: Uint8Array;
        const { decryptData } = await import('@/lib/crypto');

        if (shareDetails.is_folder && manifest[fileId]?.wrapped_cek && manifest[fileId]?.nonce_wrap) {
          // Folder share: decrypt the file's envelope-encrypted CEK from manifest
          fileCek = decryptData(manifest[fileId].wrapped_cek, shareCek, manifest[fileId].nonce_wrap);
        } else if (!shareDetails.is_folder && shareDetails.wrapped_cek && shareDetails.nonce_wrap) {
          // File share: decrypt the envelope-encrypted CEK from share record
          fileCek = decryptData(shareDetails.wrapped_cek, shareCek, shareDetails.nonce_wrap);
        } else {
          throw new Error('File encryption data not available');
        }

        const result = await downloadEncryptedFileWithCEK(fileId, fileCek, (progress) => {
          setDownloadProgress(progress);
        }, downloadAbortControllerRef.current.signal, pauseControllerRef.current);

        // ... (ingest tracking and blob download) ...
        // Track in ingest server RIGHT AFTER download URLs request
        try {
          const sessionId = sessionStorage.getItem(`share_session_${shareId}`);
          if (sessionId) {
            const ingestBaseUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'https://ingest.ellipticc.com';
            await fetch(`${ingestBaseUrl}/api/v1/sessions/convert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: sessionId,
                conversion_event: 'share_download',
                event_data: {
                  fileId,
                  fileName: '[encrypted]',
                  shareId,
                  timestamp: new Date().toISOString()
                }
              })
            }).catch(err => {
              console.warn('Failed to track conversion in ingest server:', err);
              // Don't fail download if ingest tracking fails
            });
          }
        } catch (ingestError) {
          console.warn('Error tracking ingest session:', ingestError);
          // Don't fail download if ingest tracking fails
        }

        // Track in main backend for webhooks
        await apiClient.trackShareDownload(shareId);

        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        // Use the already decrypted filename instead of result.filename
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // Check for various abort signals including BodyStreamBuffer aborts
      const isAborted = err instanceof Error && (
        err.name === 'AbortError' ||
        err.message.includes('Aborted') ||
        err.message.includes('BodyStreamBuffer was aborted') ||
        err.message.includes('The operation was aborted')
      );

      if (isAborted) {
        console.log('Download cancelled by user');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
      setDownloadError(msg);
    } finally {
      if (downloadAbortControllerRef.current) {
        downloadAbortControllerRef.current = null;
      }
      setDownloadingType(null);
      setIsDownloadPaused(false);
    }
  };

  const handlePreviewFile = async (fileId: string, fileName: string) => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    setDownloadError(null);
    setDownloadProgress({ stage: 'initializing', overallProgress: 0, bytesDownloaded: 0, totalBytes: 0 });

    // Reset controllers
    downloadAbortControllerRef.current = new AbortController();
    pauseControllerRef.current.isPaused = false;
    setIsDownloadPaused(false);

    try {
      const shareCek = await getShareCEK();
      let fileCek: Uint8Array;
      const { decryptData } = await import('@/lib/crypto');

      if (shareDetails!.is_folder && manifest[fileId]?.wrapped_cek && manifest[fileId]?.nonce_wrap) {
        fileCek = decryptData(manifest[fileId].wrapped_cek!, shareCek, manifest[fileId].nonce_wrap!);
      } else if (!shareDetails!.is_folder && shareDetails!.wrapped_cek && shareDetails!.nonce_wrap) {
        fileCek = decryptData(shareDetails!.wrapped_cek, shareCek, shareDetails!.nonce_wrap);
      } else {
        throw new Error('File encryption data not available');
      }

      const result = await downloadEncryptedFileWithCEK(fileId, fileCek, (progress) => {
        setDownloadProgress(progress);
      }, downloadAbortControllerRef.current.signal, pauseControllerRef.current);

      const blobUrl = URL.createObjectURL(result.blob);

      setPreviewFile({
        id: fileId,
        name: fileName,
        type: 'file',
        mimeType: result.mimetype,
        size: result.size,
        blobUrl: blobUrl
      });
      setIsPreviewOpen(true);

      setDownloadProgress(null);
    } catch (err) {
      const isAborted = err instanceof Error && err.name === 'AbortError';
      if (!isAborted) {
        setDownloadError(err instanceof Error ? err.message : 'Preview failed');
      }
    } finally {
      setIsPreviewing(false);
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



  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading || checkingSession) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
        <header className="z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 relative">
            <div className="flex items-center">
              <Link href="https://ellipticc.com?utm_source=share_download&utm_medium=referral&utm_campaign=share_page" className="flex items-center gap-2 font-medium">
                <div className="flex size-6 items-center justify-center rounded-md">
                  <IconCaretLeftRightFilled className="!size-5" />
                </div>
                <span className="text-base font-mono">ellipticc</span>
              </Link>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
              <IconLock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End-to-end encrypted</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <IconLoader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading share details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
        <header className="z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 relative">
            <div className="flex items-center">
              <Link href="https://ellipticc.com?utm_source=share_download&utm_medium=referral&utm_campaign=share_page" className="flex items-center gap-2 font-medium">
                <div className="flex size-6 items-center justify-center rounded-md">
                  <IconCaretLeftRightFilled className="!size-5" />
                </div>
                <span className="text-base font-mono">ellipticc</span>
              </Link>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
              <IconLock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End-to-end encrypted</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <ThemeToggle />
              {userSession ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-accent transition-colors">
                      <Avatar className="h-9 w-9 rounded-full border-2 border-background">
                        <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                        <AvatarFallback className="rounded-full"></AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-xl" side="bottom" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-9 w-9 rounded-lg">
                          <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                          <AvatarFallback className="rounded-lg"></AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">{getDisplayName(userSession)}</span>
                          <span className="text-muted-foreground truncate text-xs">{userSession.email}</span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => window.location.href = '/'}>
                        Go to Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleLogout}>
                        <IconLogout className="size-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="font-semibold" onClick={() => window.location.href = '/login'}>
                    Log In
                  </Button>
                  <Button size="sm" className="font-semibold rounded-lg px-4" onClick={() => window.location.href = '/signup'}>
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center py-16 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <IconAlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle className="text-destructive">Share Unavailable</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <IconAlertCircle className="h-4 w-4" />
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
    <div className="h-screen bg-muted/30 relative overflow-hidden flex flex-col">
      <header className="z-50 bg-transparent">
        <div className="flex h-14 items-center px-4 relative">
          {/* Left: Logo */}
          <div className="flex items-center">
            <Link href="https://ellipticc.com?utm_source=share_download&utm_medium=referral&utm_campaign=share_page" className="flex items-center gap-2 font-medium">
              <div className="flex size-6 items-center justify-center rounded-md">
                <IconCaretLeftRightFilled className="!size-5" />
              </div>
              <span className="text-base font-mono">ellipticc</span>
            </Link>
          </div>

          {/* Center: E2EE Label */}
          {/* Center: E2EE Label */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-2">
            <IconLock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End-to-end encrypted</span>
          </div>

          <div className="flex-1" />

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {userSession ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-accent transition-colors">
                    <Avatar className="h-9 w-9 rounded-full border-2 border-background">
                      <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                      <AvatarFallback className="rounded-full"></AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-xl" side="bottom" align="end" sideOffset={8}>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-9 w-9 rounded-lg">
                        <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                        <AvatarFallback className="rounded-lg"></AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{getDisplayName(userSession)}</span>
                        <span className="text-muted-foreground truncate text-xs">{userSession.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => window.location.href = '/'}>
                      Go to Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <IconLogout className="size-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="font-semibold" onClick={() => window.location.href = '/login'}>
                  Log In
                </Button>
                <Button size="sm" className="font-semibold rounded-lg px-4" onClick={() => window.location.href = '/signup'}>
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden">
        <Card className="w-full max-w-[98vw] lg:max-w-[94vw] h-[calc(100vh-5rem)] flex flex-col shadow-sm border-0 bg-background rounded-xl overflow-hidden">
          {shareDetails.has_password && !passwordVerified ? (
            <>
              <CardHeader className="text-center">
                <IconLock className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Password Required</CardTitle>
                <CardDescription>Enter the password to access this share</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
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
                      <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Password'
                  )}
                </Button>
                {passwordError && (
                  <Alert>
                    <IconAlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </>
          ) : shareDetails.is_folder ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-muted">
                      <IconFolderOpen className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-xl">{decryptedFolderName || shareDetails.folder?.name || 'Shared Folder'}</CardTitle>
                        <CardDescription>
                          Shared on {shareDetails.folder?.created_at ? formatDate(shareDetails.folder.created_at) : 'unknown date'}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadFile(currentFolderId || shareDetails.folder!.id, decryptedFolderName || shareDetails.folder?.name || 'Shared Folder')}
                        disabled={downloading || !!downloadProgress}
                      >
                        {downloading && (currentFolderId === shareDetails.folder!.id || (!currentFolderId)) ? (
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <IconDownload className="mr-2 h-4 w-4" />
                        )}
                        Download as ZIP
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Breadcrumbs - Filesystem Style */}
                {breadcrumbs.length > 0 && (
                  <div className="flex items-center gap-1 text-sm px-6 py-3 border-b bg-muted font-mono">
                    <span className="text-muted-foreground">/</span>
                    {breadcrumbs.map((crumb, index) => (
                      <div key={crumb.id} className="flex items-center gap-1">
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
                          className={`hover:underline px-1 ${index === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-foreground hover:text-foreground'}`}
                        >
                          {crumb.name}
                        </button>
                        {index < breadcrumbs.length - 1 && <span className="text-muted-foreground">/</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Download Progress - REMOVED (Replaced by UnifiedProgressModal) */}

                {/* Folder Contents - Filesystem Table Style */}
                <div className="divide-y">
                  {Object.keys(manifest).length === 0 ? (
                    <div className="text-center py-16 px-6">
                      <IconLoader2 className="h-8 w-8 text-muted-foreground mx-auto mb-3 animate-spin" />
                      <p className="text-muted-foreground">Loading folder contents...</p>
                    </div>
                  ) : currentFolderContents.folders.length === 0 && currentFolderContents.files.length === 0 ? (
                    <div className="text-center py-16 px-6">
                      <IconFolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-muted-foreground">This folder is empty</p>
                    </div>
                  ) : (
                    <>
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted text-sm font-semibold text-muted-foreground sticky top-0">
                        <div className="col-span-6">Name</div>
                        <div className="col-span-3">Modified</div>
                        <div className="col-span-2 text-right">Size</div>
                        <div className="col-span-1 text-center">Action</div>
                      </div>

                      {/* Folders Section */}
                      {currentFolderContents.folders.length > 0 && (
                        <>
                          {currentFolderContents.folders.map((folder) => (
                            <button
                              key={folder.id}
                              onClick={() => handleNavigateFolder(folder.id, folder.name)}
                              className="w-full grid grid-cols-12 gap-4 px-6 py-3 hover:bg-accent transition-colors items-center group text-left"
                            >
                              <div className="col-span-6 flex items-center gap-3 min-w-0">
                                <IconFolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:scale-110 transition-transform" />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate font-medium text-foreground">{truncateFilename(folder.name)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{folder.name}</TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="col-span-3 text-sm text-muted-foreground">
                                {folder.created_at ? formatDate(folder.created_at) : '-'}
                              </div>
                              <div className="col-span-2 text-sm text-muted-foreground text-right">-</div>
                              <div className="col-span-1 flex justify-center">
                                <IconChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Files Section */}
                      {currentFolderContents.files.length > 0 && (
                        <>
                          {currentFolderContents.files.map((file) => (
                            <div
                              key={file.id}
                              className="w-full grid grid-cols-12 gap-4 px-6 py-3 hover:bg-accent transition-colors items-center group text-left cursor-pointer"
                              onClick={() => handlePreviewFile(file.id, file.name)}
                            >
                              <div className="col-span-6 flex items-center gap-3 min-w-0">
                                <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:scale-110 transition-transform" />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate font-medium text-foreground">{truncateFilename(file.name)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{file.name}</TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="col-span-3 text-sm text-muted-foreground">
                                {file.created_at ? formatDate(file.created_at) : '-'}
                              </div>
                              <div className="col-span-2 text-sm text-muted-foreground text-right font-mono">
                                {file.size ? formatFileSize(file.size) : '-'}
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadFile(file.id, file.name);
                                  }}
                                >
                                  <IconDownload className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>

                {error && (
                  <div className="px-6 py-4">
                    <Alert>
                      <IconAlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 px-6 pt-0 pb-0">
                <div className="flex flex-col gap-1 min-w-0 w-full md:w-auto text-left">
                  <div className="flex items-center gap-2 max-w-full">
                    <CardTitle className="text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
                      {decryptedFilename || shareDetails.file?.filename || 'Encrypted File'}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-foreground" onClick={() => setShowDetailsDialog(true)}>
                      <IconInfoCircle className="h-5 w-5" />
                    </Button>
                  </div>
                  <CardDescription className="text-sm font-medium text-muted-foreground">
                    {formatFileSize(shareDetails.file?.size || 0)}
                    {shareDetails.comments_enabled && shareDetails.owner_name && (
                      <span className="block mt-1 text-xs opacity-80">Shared by {shareDetails.owner_name}</span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button
                    onClick={() => handleDownloadFile(shareDetails.file_id, decryptedFilename || shareDetails.file?.filename || 'file', 'header')}
                    disabled={downloading}
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 font-medium"
                  >
                    {downloadingType === 'header' ? (
                      <>
                        <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading...
                      </>
                    ) : (
                      <>
                        <IconDownload className="mr-2 h-4 w-4" /> Download
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center p-0">
                {(shareDetails.file?.size && shareDetails.file.size > 100 * 1024 * 1024) ? (
                  <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
                    <IconAlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />
                    <div className="space-y-1">
                      <p className="font-medium">Preview not available</p>
                      <p className="text-sm text-muted-foreground">File is too large to preview (&gt;100MB)</p>
                    </div>
                  </div>
                ) : shareDetails.file?.mimetype?.startsWith('audio/') ? (
                  <AudioPreview
                    fileId={shareDetails.file_id}
                    mimeType={shareDetails.file.mimetype}
                    fileSize={shareDetails.file.size}
                    fileName={decryptedFilename || shareDetails.file?.filename || 'Audio File'}
                    shareDetails={shareDetails}
                    onGetShareCEK={getShareCEK}
                  />
                ) : shareDetails.file?.mimetype?.startsWith('image/') ? (
                  <ImagePreview
                    fileId={shareDetails.file_id}
                    mimeType={shareDetails.file.mimetype}
                    fileSize={shareDetails.file.size}
                    fileName={decryptedFilename || shareDetails.file?.filename || 'Image File'}
                    shareDetails={shareDetails}
                    onGetShareCEK={getShareCEK}
                  />
                ) : (shareDetails.file?.mimetype?.startsWith('text/') ||
                  shareDetails.file?.mimetype?.includes('json') ||
                  shareDetails.file?.mimetype?.includes('xml') ||
                  shareDetails.file?.mimetype?.includes('javascript') ||
                  shareDetails.file?.mimetype?.includes('css')) ? (
                  <TextPreview
                    fileId={shareDetails.file_id}
                    mimeType={shareDetails.file.mimetype}
                    fileSize={shareDetails.file.size}
                    fileName={decryptedFilename || shareDetails.file?.filename || 'Text File'}
                    shareDetails={shareDetails}
                    onGetShareCEK={getShareCEK}
                  />
                ) : shareDetails.file?.mimetype === 'application/pdf' ? (
                  <PdfPreview
                    fileId={shareDetails.file_id}
                    mimeType={shareDetails.file.mimetype}
                    fileSize={shareDetails.file.size}
                    fileName={decryptedFilename || shareDetails.file?.filename || 'PDF File'}
                    shareDetails={shareDetails}
                    onGetShareCEK={getShareCEK}
                  />
                ) : shareDetails.file?.mimetype?.startsWith('video/') ? (
                  <VideoPreview
                    fileId={shareDetails.file_id}
                    mimeType={shareDetails.file.mimetype}
                    fileSize={shareDetails.file.size}
                    fileName={decryptedFilename || shareDetails.file?.filename || 'Video File'}
                    shareDetails={shareDetails}
                    onGetShareCEK={getShareCEK}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 w-full">
                    <div className="flex flex-col items-center justify-center gap-6 text-center max-w-2xl mx-auto">
                      <div className="relative">
                        <IconFile className="h-24 w-24 text-muted-foreground/20 fill-muted/10" strokeWidth={1.5} />
                        <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1">
                          <IconEyeOff className="h-10 w-10 text-muted-foreground/60" strokeWidth={2} />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                          Preview of this file type is not supported
                        </h2>
                      </div>
                      <Button
                        onClick={() => handleDownloadFile(shareDetails.file_id, decryptedFilename || shareDetails.file?.filename || 'file', 'center')}
                        disabled={downloading}
                        className="mt-2 h-10 px-6 font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground min-w-[150px]"
                      >
                        {downloadingType === 'center' ? (
                          <>
                            <IconLoader2 className="mr-2 h-5 w-5 animate-spin" /> Downloading...
                          </>
                        ) : (
                          <>
                            Download
                          </>
                        )}
                      </Button>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="max-w-md mt-6 rounded-lg border-2">
                        <IconAlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Mobile: E2EE Label below card */}
        <div className="mt-6 flex md:hidden items-center justify-center gap-2">
          <IconLock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End-to-end encrypted</span>
        </div>
      </div>




      <FileDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        fileName={decryptedFilename || shareDetails.file?.filename || shareDetails.folder?.name || 'File'}
        fileSize={shareDetails.file?.size || 0}
        fileType={shareDetails.file?.mimetype}
        createdAt={shareDetails.file?.created_at || shareDetails.folder?.created_at}
        ownerName={shareDetails.owner_name}
        isFolder={shareDetails.is_folder}
      />

      {/* Report Dialog - Fixed position bottom left */}
      <ReportDialog
        shareId={shareId}
        onReportSuccess={() => loadShareDetails()}
        className="fixed bottom-4 left-4 right-auto z-50"
      />

      {/* Unified Progress Modal */}
      <UnifiedProgressModal
        open={!!downloadProgress && !isPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (downloadAbortControllerRef.current) {
              downloadAbortControllerRef.current.abort();
            }
            setDownloadProgress(null);
            setDownloadError(null);
            setIsPreviewing(false);
          }
        }}
        downloadProgress={downloadProgress}
        downloadFilename={decryptedFilename || decryptedFolderName || shareDetails.file?.filename || shareDetails.folder?.name || previewFile?.name || 'file'}
        downloadFileSize={shareDetails.file?.size || previewFile?.size || 0}
        downloadFileId={shareDetails.file_id || previewFile?.id}
        onCancelDownload={() => {
          if (downloadAbortControllerRef.current) {
            downloadAbortControllerRef.current.abort();
          }
          setDownloadProgress(null);
          setDownloadError(null);
          setIsPreviewing(false);
        }}
        isDownloadPaused={isDownloadPaused}
        onPauseDownload={() => {
          setIsDownloadPaused(true);
          pauseControllerRef.current.isPaused = true;
        }}
        onResumeDownload={() => {
          setIsDownloadPaused(false);
          pauseControllerRef.current.isPaused = false;
          if (pauseResolverRef.current) {
            pauseResolverRef.current();
            pauseResolverRef.current = null;
          }
        }}
        onRetryDownload={() => {
          if (shareDetails?.file_id) {
            handleDownloadFile(shareDetails.file_id, decryptedFilename || shareDetails.file?.filename || 'file', 'center');
          }
        }}
        downloadError={downloadError}
      />

      {/* Plug in Full Page Preview Modal */}
      {previewFile && isPreviewOpen && (
        <FullPagePreviewModal
          isOpen={isPreviewOpen}
          file={previewFile}
          onClose={() => {
            setIsPreviewOpen(false);
            if (previewFile.blobUrl) URL.revokeObjectURL(previewFile.blobUrl);
            setPreviewFile(null);
          }}
          onNavigate={(direction) => {
            const currentIndex = currentFolderContents.files.findIndex(f => f.id === previewFile.id);
            if (currentIndex === -1) return;

            let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex < 0) return;
            if (nextIndex >= currentFolderContents.files.length) return;

            const nextFile = currentFolderContents.files[nextIndex];
            if (previewFile.blobUrl) URL.revokeObjectURL(previewFile.blobUrl);
            setIsPreviewOpen(false);
            handlePreviewFile(nextFile.id, nextFile.name);
          }}
          hasPrev={currentFolderContents.files.findIndex(f => f.id === previewFile.id) > 0}
          hasNext={currentFolderContents.files.findIndex(f => f.id === previewFile.id) < currentFolderContents.files.length - 1}
          onDownload={(file) => {
            const a = document.createElement('a');
            a.href = (file as any).blobUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        />
      )}

      {/* Comment Section - Floating button bottom right */}
      {shareDetails && shareDetails.comments_enabled !== false && (
        <CommentSection
          shareId={shareId as string}
          shareCek={shareCek || undefined}
          currentUser={userSession ? { id: userSession.id, name: userSession.name, avatar: userSession.avatar || '' } : null}
          isOwner={!!userSession && userSession.id === shareDetails?.owner_user_id}
          className="fixed bottom-4 right-4 z-50"
        />
      )}
    </div>
  );
}

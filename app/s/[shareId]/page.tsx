'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { downloadEncryptedFileWithCEK } from '@/lib/download';
import { truncateFilename } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { Loader2, Download, File, AlertCircle, FolderOpen, ChevronRight, Lock } from 'lucide-react';
import { IconCaretLeftRightFilled, IconLogout } from '@tabler/icons-react';
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

// Helper to decrypt filename using share CEK
async function decryptShareFilename(encryptedFilename: string, nonce: string, shareCek: Uint8Array): Promise<string> {
  try {
    const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');
    
    const encrypted = new Uint8Array(atob(encryptedFilename).split('').map(c => c.charCodeAt(0)));
    const nonceBytes = new Uint8Array(atob(nonce).split('').map(c => c.charCodeAt(0)));

    const cipher = xchacha20poly1305(shareCek, nonceBytes);
    const decryptedBytes = cipher.decrypt(encrypted);
    
    const decrypted = new TextDecoder().decode(decryptedBytes);
    // Sanitize control characters and any non-printable characters
    const sanitized = decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    
    // Additional validation
    if (sanitized.length === 0 || sanitized.length > 255) {
      throw new Error('Decrypted filename is empty or too long');
    }
    
    return sanitized;
  } catch (err) {
    console.warn('Failed to decrypt filename:', err);
    throw err;
  }
}

// Helper to check if a string looks like encrypted data (base64 format)
function looksLikeEncryptedName(name: string): boolean {
  if (!name || typeof name !== 'string' || !name.includes(':')) {
    return false;
  }
  
  const [encPart, noncePart] = name.split(':');
  
  // Check if both parts are valid base64 (encrypted names have this format)
  try {
    // Base64 regex check - should only contain [A-Za-z0-9+/=]
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(encPart) && base64Regex.test(noncePart);
  } catch {
    return false;
  }
}
// Format: encryptedData:nonce (both base64), salt is used to derive a key from share CEK
async function decryptManifestItemName(encryptedName: string, nameSalt: string, shareCek: Uint8Array, itemType?: string): Promise<string> {
  try {
    const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');
    
    // Parse encrypted name format: "encryptedData:nonce" (both in base64)
    const [encryptedPart, noncePart] = encryptedName.split(':');
    if (!encryptedPart || !noncePart) {
      // If not in expected format, might be plaintext or differently formatted
      return encryptedName;
    }

    // Decode salt and nonce from base64
    const decodedSalt = new Uint8Array(atob(nameSalt).split('').map(c => c.charCodeAt(0)));
    const nameNonce = new Uint8Array(atob(noncePart).split('').map(c => c.charCodeAt(0)));
    const encryptedBytes = new Uint8Array(atob(encryptedPart).split('').map(c => c.charCodeAt(0)));

    // Derive name-specific key from salt and share CEK using HMAC-SHA256
    // Match the encryption: HMAC(shareCek, salt + 'folder-name-key' or 'file-name-key')
    // If item type is known, use only that variant. Otherwise try both.
    const suffixes = itemType 
      ? [itemType === 'folder' ? 'folder-name-key' : 'file-name-key']
      : ['folder-name-key', 'file-name-key'];
    
    for (const suffix of suffixes) {
      try {
        const suffixBytes = new TextEncoder().encode(suffix);
        const keyMaterial = new Uint8Array(decodedSalt.length + suffixBytes.length);
        keyMaterial.set(decodedSalt, 0);
        keyMaterial.set(suffixBytes, decodedSalt.length);

        const hmacKey = await crypto.subtle.importKey(
          'raw',
          shareCek as BufferSource,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );

        const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
        const nameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));
        
        // Try to decrypt with this key
        const decryptedBytes = xchacha20poly1305(nameKey, nameNonce).decrypt(encryptedBytes);
        const decrypted = new TextDecoder().decode(decryptedBytes);
        
        // Sanitize control characters and any non-printable characters that can cause display issues
        // Remove all control characters (0x00-0x1F, 0x7F-0x9F) and any other problematic chars
        const sanitized = decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        
        // Additional check: ensure the result contains only valid characters
        if (sanitized.length === 0 || sanitized.length > 255) {
          throw new Error('Decrypted name is empty or too long');
        }
        
        return sanitized;
      } catch (e) {
        // Try next suffix
        if (itemType) throw e; // If we know the type and it fails, don't try others
        continue;
      }
    }

    // If both attempts failed
    throw new Error('Could not decrypt with either key variant');
  } catch (err) {
    console.error('Failed to decrypt manifest item name:', err);
    // Return truncated encrypted name as fallback
    return encryptedName.substring(0, 30) + '...';
  }
}

// Helper to decrypt entire encrypted manifest (pre-encrypted on frontend)
async function decryptEncryptedManifest(
  encryptedManifestData: string | { encryptedData: string; nonce: string },
  shareCek: Uint8Array
): Promise<Record<string, unknown>> {
  try {
    const { decryptData } = await import('@/lib/crypto');
    
    // Handle both formats: object (new) or JSON string (legacy)
    let encryptedData: string;
    let nonce: string;
    
    if (typeof encryptedManifestData === 'string') {
      // Legacy format: JSON string containing { encryptedData, nonce }
      const parsed = JSON.parse(encryptedManifestData);
      encryptedData = parsed.encryptedData;
      nonce = parsed.nonce;
    } else {
      // New format: object directly
      encryptedData = encryptedManifestData.encryptedData;
      nonce = encryptedManifestData.nonce;
    }
    
    if (!encryptedData || !nonce) {
      throw new Error('Invalid encrypted manifest structure - missing encryptedData or nonce');
    }
    
    // Decrypt the entire manifest JSON with share CEK
    const decryptedManifestBytes = decryptData(encryptedData, shareCek, nonce);
    const manifestJson = new TextDecoder().decode(decryptedManifestBytes);
    const manifest = JSON.parse(manifestJson);
    
    // Now decrypt individual item names using the salt and derived keys
    const decryptedManifest: Record<string, Record<string, unknown>> = {};
    
    for (const [itemId, item] of Object.entries(manifest)) {
      const manifestItem = item as Record<string, unknown>;
      let decryptedName = itemId;

      // Try to get a plaintext name if available and a string
      if (typeof manifestItem.name === 'string') {
        decryptedName = manifestItem.name as string;
      }

      // Try to decrypt the name if it looks encrypted (contains : and has salt)
      if (typeof manifestItem.name === 'string' && (manifestItem.name as string).includes(':') && manifestItem.name_salt) {
        try {
          decryptedName = await decryptManifestItemName(manifestItem.name as string, manifestItem.name_salt as string, shareCek);
        } catch (decryptErr) {
          console.warn(`Failed to decrypt name for ${itemId}:`, decryptErr);
        }
      }

      // Ensure id is always present
      decryptedManifest[itemId] = {
        id: itemId, // Ensure id field is set
        ...manifestItem,
        name: decryptedName
      } as Record<string, unknown>; 
    }
    return decryptedManifest;
  } catch (err) {
    console.error('Failed to decrypt encrypted manifest:', err);
    throw err;
  }
}

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
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [password, setPassword] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [decryptedFilename, setDecryptedFilename] = useState<string | null>(null);
  const [decryptedFolderName, setDecryptedFolderName] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<{ id: string; name: string; email: string; avatar: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sharePasswordCEK, setSharePasswordCEK] = useState<Uint8Array | null>(null); // Store CEK from password verification

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
      } else {
        setPasswordVerified(true);
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
  }, [shareId]);  useEffect(() => {
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

      // Parse the salt:nonce:ciphertext format with XChaCha20-Poly1305
      const parts = shareDetails.salt_pw.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid password data format');
      }

      const [saltB64, nonceB64, ciphertextB64] = parts;

      // Decode salt, nonce, and ciphertext from base64
      const salt = new Uint8Array(atob(saltB64).split('').map(c => c.charCodeAt(0)));
      const nonce = new Uint8Array(atob(nonceB64).split('').map(c => c.charCodeAt(0)));
      const ciphertext = new Uint8Array(atob(ciphertextB64).split('').map(c => c.charCodeAt(0)));

      // Derive password key using PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const passwordKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-KW' },
        false,
        ['unwrapKey']
      );

      // Export the key to get raw bytes for XChaCha20
      const keyBytes = new Uint8Array(
        await crypto.subtle.exportKey('raw', passwordKey)
      );
      // Use first 32 bytes for XChaCha20
      const xchachaKey = keyBytes.slice(0, 32);

      // Decrypt share CEK using XChaCha20-Poly1305
      const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');
      const shareCekBytes = xchacha20poly1305(xchachaKey, nonce).decrypt(ciphertext);
      const shareCek = new Uint8Array(shareCekBytes);

      if (shareCek.length !== 32) {
        throw new Error('Invalid decrypted share key');
      }

      // Store the CEK for later use in manifest decryption
      setSharePasswordCEK(shareCek);
      setPasswordVerified(true);
    } catch {
      setPasswordError('Incorrect password. Please try again.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Get Share CEK from URL hash or password-protected wrapper
  const getShareCEK = async (): Promise<Uint8Array> => {
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
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    if (!shareDetails) return;

    setDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      const shareCek = await getShareCEK();

      // For folder shares, get the file's CEK from the manifest
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
        const p = typeof progress.overallProgress === 'number' ? progress.overallProgress : 0;
        setDownloadProgress(Math.min(100, Math.max(0, p)));
      });

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

  if (loading || checkingSession) {
    return (
      <div className="min-h-screen bg-background relative">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4">
            <div className="container flex items-center">
              <Link href="/" className="flex items-center gap-2 font-medium">
                <div className="flex size-6 items-center justify-center rounded-md">
                  <IconCaretLeftRightFilled className="!size-5" />
                </div>
                <span className="text-base font-mono">ellipticc</span>
              </Link>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 pr-4">
              <ThemeToggle />
              {/* Loading state has no auth buttons */}
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading share details...</p>
          </div>
        </div>

        {/* Footer - Always shown at extreme bottom */}
        <footer className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-col items-center gap-3 py-6 px-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-6">
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <span className="text-muted-foreground/50">•</span>
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background relative">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4">
            <div className="container flex items-center">
              <Link href="/" className="flex items-center gap-2 font-medium">
                <div className="flex size-6 items-center justify-center rounded-md">
                  <IconCaretLeftRightFilled className="!size-5" />
                </div>
                <span className="text-base font-mono">ellipticc</span>
              </Link>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 pr-4">
              <ThemeToggle />
              {userSession ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-accent transition-colors">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                        <AvatarFallback className="rounded-lg"></AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-lg">
                          <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                          <AvatarFallback className="rounded-lg"></AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-medium">{getDisplayName(userSession)}</span>
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
                        <IconLogout />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = '/login'}>
                    Log In
                  </Button>
                  <Button size="sm" onClick={() => window.location.href = '/signup'}>
                    Sign Up
                  </Button>
                </>
              )}
            </div>
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

        {/* Footer - Always shown at extreme bottom */}
        <footer className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-col items-center gap-3 py-6 px-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-6">
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <span className="text-muted-foreground/50">•</span>
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (!shareDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background relative">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <div className="container flex items-center">
            <Link href="/" className="flex items-center gap-2 font-medium">
              <div className="flex size-6 items-center justify-center rounded-md">
                <IconCaretLeftRightFilled className="!size-5" />
              </div>
              <span className="text-base font-mono">ellipticc</span>
            </Link>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 pr-4">
            <ThemeToggle />
            {userSession ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-accent transition-colors">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                      <AvatarFallback className="rounded-lg"></AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={userSession.avatar || getDiceBearAvatar(userSession.id)} alt={getDisplayName(userSession)} />
                        <AvatarFallback className="rounded-lg"></AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{getDisplayName(userSession)}</span>
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
                      <IconLogout />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/login'}>
                  Log In
                </Button>
                <Button size="sm" onClick={() => window.location.href = '/signup'}>
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto py-8 px-4 flex-1">
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
              <CardHeader className="border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-muted">
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">{decryptedFolderName || shareDetails.folder?.name || 'Shared Folder'}</CardTitle>
                      <CardDescription>
                        Shared on {shareDetails.folder?.created_at ? formatDate(shareDetails.folder.created_at) : 'unknown date'}
                      </CardDescription>
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

                {/* Download Progress */}
                {downloading && (
                  <div className="border-b px-6 py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Downloading...</span>
                      <span className="font-mono text-sm">{Math.round(downloadProgress)}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                  </div>
                )}

                {/* Folder Contents - Filesystem Table Style */}
                <div className="divide-y">
                  {Object.keys(manifest).length === 0 ? (
                    <div className="text-center py-16 px-6">
                      <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-3 animate-spin" />
                      <p className="text-muted-foreground">Loading folder contents...</p>
                    </div>
                  ) : currentFolderContents.folders.length === 0 && currentFolderContents.files.length === 0 ? (
                    <div className="text-center py-16 px-6">
                      <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
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
                                <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:scale-110 transition-transform" />
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
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Files Section */}
                      {currentFolderContents.files.length > 0 && (
                        <>
                          {currentFolderContents.files.map((file) => (
                            <button
                              key={file.id}
                              onClick={() => handleDownloadFile(file.id, file.name)}
                              className="w-full grid grid-cols-12 gap-4 px-6 py-3 hover:bg-accent transition-colors items-center group text-left"
                            >
                              <div className="col-span-6 flex items-center gap-3 min-w-0">
                                <File className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:scale-110 transition-transform" />
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
                                <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>

                {error && (
                  <div className="px-6 py-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm font-mono break-all">{truncateFilename(decryptedFilename || shareDetails.file.filename)}</p>
                          </TooltipTrigger>
                          <TooltipContent>
                            {decryptedFilename || shareDetails.file.filename}
                          </TooltipContent>
                        </Tooltip>
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
                      <span className="font-mono">{Math.round(downloadProgress)}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                  </div>
                )}

                <Button
                  onClick={() => handleDownloadFile(shareDetails.file_id, decryptedFilename || shareDetails.file?.filename || 'file')}
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

      {/* Footer - Absolutely positioned at extreme bottom */}
      <footer className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col items-center gap-3 py-6 px-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-6">
            <a
              href="/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
            <span className="text-muted-foreground/50">•</span>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>

      {/* Report Dialog - Fixed position */}
      <ReportDialog shareId={shareId} onReportSuccess={() => loadShareDetails()} />
    </div>
  );
}

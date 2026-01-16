"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconX,
  IconCopy,
  IconCheck,
  IconSettings,
  IconLink,
  IconSend,
  IconCalendar,
  IconClockHour8,
  IconChartBar,
  IconTrash,
  IconActivity,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { keyManager } from "@/lib/key-manager"
import { masterKeyManager } from "@/lib/master-key"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { getUAInfo } from "./settings/device-icons"
import { format, startOfToday } from "date-fns"
import { truncateFilename } from "@/lib/utils"
import Link from "next/link"

const getFlagEmoji = (countryCode: string | null) => {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

import type { FileTreeItem, FolderTreeItem, FileInfo, FolderInfo, ShareAccessLog, ShareItem } from '@/lib/api'

// Helper function to build encrypted manifest for folder shares
// Returns an object (not JSON string) so createShare can serialize it correctly
async function buildEncryptedFolderManifest(
  folderId: string,
  shareCek: Uint8Array
): Promise<{ encryptedData: string; nonce: string }> {
  try {
    // Get folder contents RECURSIVELY to include all nested files and folders
    const contentsResponse = await apiClient.getFolderContentsRecursive(folderId);
    if (!contentsResponse.success || !contentsResponse.data) {
      throw new Error('Failed to fetch folder contents');
    }

    // Parse the response structure: { folder: {...}, allFiles: [...], totalFiles, totalFolders }
    const { allFiles = [], folder } = contentsResponse.data;

    // Validate folder data
    if (!folder) {
      throw new Error('Invalid folder data: folder is null');
    }
    if (folder.encryptedName && !folder.nameSalt) {
      throw new Error('Invalid folder data: folder has encryptedName but missing nameSalt. Folder structure: ' + JSON.stringify({ id: folder.id, hasEncName: !!folder.encryptedName, hasNameSalt: !!folder.nameSalt }));
    }

    // Extract folders from the hierarchical structure
    const folders: FolderTreeItem[] = [];
    const extractFolders = (folderData: FolderTreeItem) => {
      if (folderData.id !== folderId) { // Don't include root folder in manifest
        folders.push({
          id: folderData.id,
          encryptedName: folderData.encryptedName,
          nameSalt: folderData.nameSalt, // Now properly included from backend
          parentId: folderData.parentId,
          path: folderData.path,
          createdAt: (folderData as unknown as Record<string, unknown>).created_at as string || (folderData as unknown as Record<string, unknown>).createdAt as string || new Date().toISOString(),
          type: 'folder'
        } as unknown as FolderTreeItem);
      }
      if (Array.isArray(folderData.children)) {
        for (const child of folderData.children) {
          extractFolders(child);
        }
      }
    };

    if (folder) {
      extractFolders(folder as FolderTreeItem);
    }

    // Convert allFiles to the expected format
    const files = (allFiles as FileTreeItem[]).map((file) => {
      const raw = file as unknown as Record<string, unknown>;
      return {
        id: file.id,
        encryptedFilename: file.encryptedFilename,
        filenameSalt: file.filenameSalt,
        size: file.size,
        mimeType: file.mimetype,
        folderId: file.folderId,
        createdAt: raw.created_at as string || raw.createdAt as string || new Date().toISOString(),
        wrappedCek: file.wrappedCek,
        nonceWrap: file.nonceWrap,
        kyberCiphertext: (raw.kyber_ciphertext as string | undefined) || (raw.kyberCiphertext as string | undefined) || undefined,
        nonceWrapKyber: (raw.nonce_wrap_kyber as string | undefined) || (raw.nonceWrapKyber as string | undefined) || undefined
      };
    });

    const { encryptData } = await import('@/lib/crypto');
    const { decryptFilename } = await import('@/lib/crypto');
    const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');

    // Get master key for decrypting names from API
    const masterKey = masterKeyManager.getMasterKey();

    // Build manifest with all items
    const manifest: Record<string, Record<string, unknown>> = {};

    // Add root folder (the shared folder itself) to manifest
    let rootFolderName: string;
    try {
      if (!masterKey) {
        throw new Error('Master key is null or undefined');
      }
      rootFolderName = await decryptFilename(folder.encryptedName, folder.nameSalt, masterKey);
    } catch (error) {
      console.error('Failed to decrypt root folder name:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        folderData: {
          encryptedName: folder.encryptedName ? `${folder.encryptedName.substring(0, 30)}...` : null,
          nameSalt: folder.nameSalt ? `${folder.nameSalt.substring(0, 30)}...` : null
        }
      });
      rootFolderName = 'Shared Folder'; // Fallback name
    }
    const rootNameSalt = crypto.getRandomValues(new Uint8Array(32));
    const rootNameSaltB64 = btoa(String.fromCharCode(...rootNameSalt));
    const rootSuffixBytes = new TextEncoder().encode('folder-name-key');
    const rootKeyMaterial = new Uint8Array(rootNameSalt.length + rootSuffixBytes.length);
    rootKeyMaterial.set(rootNameSalt, 0);
    rootKeyMaterial.set(rootSuffixBytes, rootNameSalt.length);
    const rootHmacKey = await crypto.subtle.importKey(
      'raw',
      shareCek as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const rootDerivedKeyMaterial = await crypto.subtle.sign('HMAC', rootHmacKey, rootKeyMaterial);
    const rootNameKey = new Uint8Array(rootDerivedKeyMaterial.slice(0, 32));
    const rootNameNonce = crypto.getRandomValues(new Uint8Array(24));
    const rootNameBytes = new TextEncoder().encode(rootFolderName);
    const encryptedRootName = xchacha20poly1305(rootNameKey, rootNameNonce).encrypt(rootNameBytes);
    const encryptedRootNameB64 = btoa(String.fromCharCode(...encryptedRootName));
    const rootNonceB64 = btoa(String.fromCharCode(...rootNameNonce));

    manifest[folderId] = {
      id: folderId,
      name: `${encryptedRootNameB64}:${rootNonceB64}`,
      name_salt: rootNameSaltB64,
      type: 'folder',
      parent_id: null,
      path: folder.path,
      created_at: (folder as unknown as Record<string, unknown>).created_at as string || new Date().toISOString()
    };

    // Add all subfolders
    for (const subfolder of folders) {
      // First decrypt the name from master key encryption
      let decryptedFolderName: string;
      try {
        if (!masterKey) {
          throw new Error('Master key is null or undefined');
        }
        if (subfolder.encryptedName && subfolder.nameSalt) {
          decryptedFolderName = await decryptFilename(subfolder.encryptedName, subfolder.nameSalt, masterKey);
        } else {
          decryptedFolderName = `Folder ${subfolder.id}`;
        }
      } catch (error) {
        console.error(`Failed to decrypt subfolder ${subfolder.id}:`, {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          folderData: {
            encryptedName: subfolder.encryptedName ? `${String(subfolder.encryptedName).substring(0, 30)}...` : null,
            nameSalt: subfolder.nameSalt ? `${String(subfolder.nameSalt).substring(0, 30)}...` : null
          }
        });
        decryptedFolderName = `Folder ${subfolder.id}`; // Fallback name
      }

      const nameSalt = crypto.getRandomValues(new Uint8Array(32));
      const nameSaltB64 = btoa(String.fromCharCode(...nameSalt));
      const suffixBytes = new TextEncoder().encode('folder-name-key');

      // Derive key using HMAC-SHA256 (consistent with filename encryption)
      const keyMaterial = new Uint8Array(nameSalt.length + suffixBytes.length);
      keyMaterial.set(nameSalt, 0);
      keyMaterial.set(suffixBytes, nameSalt.length);

      const hmacKey = await crypto.subtle.importKey(
        'raw',
        shareCek as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
      const nameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));
      const nameNonce = crypto.getRandomValues(new Uint8Array(24));
      const nameBytes = new TextEncoder().encode(decryptedFolderName);

      const encryptedName = xchacha20poly1305(nameKey, nameNonce).encrypt(nameBytes);
      const encryptedNameB64 = btoa(String.fromCharCode(...encryptedName));
      const nonceB64 = btoa(String.fromCharCode(...nameNonce));

      manifest[subfolder.id] = {
        id: subfolder.id,
        name: `${encryptedNameB64}:${nonceB64}`,
        name_salt: nameSaltB64,
        type: 'folder',
        parent_id: subfolder.parentId,
        path: subfolder.path,
        created_at: (subfolder as unknown as Record<string, unknown>).created_at as string || new Date().toISOString()
      };
    }

    // Add all files
    for (const file of files) {
      // First decrypt the filename from master key encryption
      let decryptedFileName: string;
      try {
        if (!masterKey) {
          throw new Error('Master key is null or undefined');
        }
        if (file.encryptedFilename && file.filenameSalt) {
          decryptedFileName = await decryptFilename(file.encryptedFilename, file.filenameSalt, masterKey);
        } else {
          decryptedFileName = `File ${file.id}`;
        }
      } catch (error) {
        console.error(`Failed to decrypt file ${file.id}:`, {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          fileData: {
            encryptedFilename: file.encryptedFilename ? `${String(file.encryptedFilename).substring(0, 30)}...` : null,
            filenameSalt: file.filenameSalt ? `${String(file.filenameSalt).substring(0, 30)}...` : null
          }
        });
        decryptedFileName = `File ${file.id}`; // Fallback name
      }

      const nameSalt = crypto.getRandomValues(new Uint8Array(32));
      const nameSaltB64 = btoa(String.fromCharCode(...nameSalt));
      const suffixBytes = new TextEncoder().encode('file-name-key');

      // Derive key using HMAC-SHA256 (consistent with filename encryption)
      const keyMaterial = new Uint8Array(nameSalt.length + suffixBytes.length);
      keyMaterial.set(nameSalt, 0);
      keyMaterial.set(suffixBytes, nameSalt.length);

      const hmacKey = await crypto.subtle.importKey(
        'raw',
        shareCek as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
      const nameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));
      const nameNonce = crypto.getRandomValues(new Uint8Array(24));
      const nameBytes = new TextEncoder().encode(decryptedFileName);

      const encryptedName = xchacha20poly1305(nameKey, nameNonce).encrypt(nameBytes);
      const encryptedNameB64 = btoa(String.fromCharCode(...encryptedName));
      const nonceB64 = btoa(String.fromCharCode(...nameNonce));

      // Decrypt the file's CEK using Kyber (same as download) and envelope-encrypt with share CEK
      try {
        const { decryptData, hexToUint8Array } = await import('@/lib/crypto');
        const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js');

        // Get user keys for Kyber decryption
        const userKeys = await keyManager.getUserKeys();

        // Decapsulate Kyber to get shared secret (same as download process)
        const fileMeta = file as unknown as Record<string, unknown>;
        if (!fileMeta.kyberCiphertext) throw new Error(`Missing kyber ciphertext for file ${file.id}`)
        const kyberCiphertext = hexToUint8Array(fileMeta.kyberCiphertext as string);
        const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys.keypairs.kyberPrivateKey);

        // Decrypt the CEK using Kyber shared secret
        if (!fileMeta.wrappedCek || !fileMeta.nonceWrapKyber) throw new Error(`Missing wrapped CEK or nonce for file ${file.id}`)
        const fileCek = decryptData(fileMeta.wrappedCek as string, new Uint8Array(sharedSecret), fileMeta.nonceWrapKyber as string);
        if (!fileCek) {
          throw new Error(`No CEK returned for file ${file.id}`);
        }
        if (!(fileCek instanceof Uint8Array)) {
          throw new Error(`CEK is not a Uint8Array, got ${typeof fileCek}`);
        }

        const envelopeEncryption = encryptData(fileCek, shareCek);
        const envelopeWrappedCek = envelopeEncryption.encryptedData;
        const envelopeNonce = envelopeEncryption.nonce;

        manifest[file.id] = {
          id: file.id,
          name: `${encryptedNameB64}:${nonceB64}`,
          name_salt: nameSaltB64,
          type: 'file',
          size: file.size,
          mimetype: file.mimeType,
          folder_id: file.folderId,
          created_at: file.createdAt,
          wrapped_cek: envelopeWrappedCek,
          nonce_wrap: envelopeNonce
        };
      } catch (error) {
        console.error(`Failed to process file ${file.id} CEK:`, {
          error: error instanceof Error ? error.message : error,
          wrappedCek: file.wrappedCek ? `${file.wrappedCek.substring(0, 30)}...` : null,
          nonceWrap: file.nonceWrap ? `${file.nonceWrap.substring(0, 30)}...` : null
        });
        // Still add the file to manifest with fallback
        manifest[file.id] = {
          id: file.id,
          name: `${encryptedNameB64}:${nonceB64}`,
          name_salt: nameSaltB64,
          type: 'file',
          size: file.size,
          mimetype: file.mimeType,
          folder_id: file.folderId,
          created_at: file.createdAt,
          wrapped_cek: null,
          nonce_wrap: null
        };
      }
    }

    // Encrypt the entire manifest as JSON
    const manifestJson = JSON.stringify(manifest);
    const manifestBytes = new TextEncoder().encode(manifestJson);
    const manifestEncryption = encryptData(manifestBytes, shareCek);

    // Return object (not JSON string) so createShare can serialize it correctly
    // This prevents double-stringification which was truncating the data
    return {
      encryptedData: manifestEncryption.encryptedData,
      nonce: manifestEncryption.nonce
    };
  } catch (error) {
    console.error('Failed to build encrypted manifest:', error);
    throw error;
  }
}

interface ShareModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder" | "paper"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onShareUpdate?: () => void
}

interface ShareSettings {
  password: string
  passwordEnabled: boolean
  expirationDate: Date | undefined
  maxDownloads: number
  maxDownloadsEnabled: boolean
  maxViews: number
  maxViewsEnabled: boolean
  commentsEnabled: boolean
}

export function ShareModal({ children, itemId = "", itemName = "item", itemType = "file", open: externalOpen, onOpenChange: externalOnOpenChange, onShareUpdate }: ShareModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logsModalOpen, setLogsModalOpen] = useState(false)
  const [logs, setLogs] = useState<ShareAccessLog[]>([])
  const [logsPagination, setLogsPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 })
  const [logsSettings, setLogsSettings] = useState({ detailed_logging_enabled: true })
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isWipingLogs, setIsWipingLogs] = useState(false)
  const [isUpdatingLogging, setIsUpdatingLogging] = useState(false)
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [emails, setEmails] = useState<string[]>([])
  const [emailError, setEmailError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [shareLink, setShareLink] = useState("")
  const [copied, setCopied] = useState(false)
  const [createPublicLink, setCreatePublicLink] = useState(false)
  // Track existing share id if an active share already exists for this item
  const [existingShareId, setExistingShareId] = useState<string | null>(null)

  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    password: "",
    passwordEnabled: false,
    expirationDate: undefined,
    maxDownloads: 0,
    maxDownloadsEnabled: false,
    maxViews: 0,
    maxViewsEnabled: false,
    commentsEnabled: true
  })

  // Subscription status for paywall
  const [isPro, setIsPro] = useState(false)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false)

  // Check subscription status when settings open
  useEffect(() => {
    if (settingsOpen) {
      const checkSubscription = async () => {
        setIsLoadingSubscription(true)
        try {
          const res = await apiClient.getSubscriptionStatus()
          // Check if user has an active subscription (Pro or higher)
          if (res.success && res.data?.subscription && res.data.subscription.status === 'active') {
            // Assuming any active subscription is "Pro" or higher for now
            setIsPro(true)
          } else {
            setIsPro(false)
          }
        } catch (error) {
          console.error("Failed to check subscription:", error)
          setIsPro(false)
        } finally {
          setIsLoadingSubscription(false)
        }
      }
      checkSubscription()
    }
  }, [settingsOpen])

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // Message modal state
  const [message, setMessage] = useState("")
  const [includeMessage, setIncludeMessage] = useState(true)

  // Track previous createPublicLink value to detect changes
  const prevCreatePublicLinkRef = useRef(false)

  // Automatically create public link when toggle is switched on
  useEffect(() => {
    const prevCreatePublicLink = prevCreatePublicLinkRef.current
    prevCreatePublicLinkRef.current = createPublicLink

    // Only create link when toggling from false to true
    if (createPublicLink && !prevCreatePublicLink && open && itemId && itemType && !shareLink && !isLoading) {
      handleCreatePublicLink()
    }
  }, [createPublicLink, open, itemId, itemType, shareLink, isLoading])

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Reset state when modal opens for different items
  useEffect(() => {
    if (open && itemId && itemType) {
      // Set loading state first
      setIsModalLoading(true)

      // Reset all share-related state for new items
      setEmails([])
      setEmailInput("")
      setEmailError("")
      setShareLink("")
      setExistingShareId(null)
      setCreatePublicLink(false)
      setShareSettings({
        password: "",
        passwordEnabled: false,
        expirationDate: undefined,
        maxDownloads: 0,
        maxDownloadsEnabled: false,
        maxViews: 0,
        maxViewsEnabled: false,
        commentsEnabled: true
      })
      setMessage("")
      setIncludeMessage(true)
      setMessageModalOpen(false)
      setSettingsOpen(false)

      // Then check for existing shares
      checkExistingShare()
    }
  }, [open, itemId, itemType])

  const checkExistingShare = async () => {
    if (!itemId || !itemType) {
      setIsModalLoading(false)
      return
    }

    try {
      // Check if there's an existing active share for this item
      const response = await apiClient.getMyShares()
      if (response.success && response.data) {
        const shares = Array.isArray(response.data) ? response.data : response.data.data;
        const existingShare = shares.find((share: ShareItem) =>
          (itemType === 'paper' ? share.paperId === itemId : (itemType === 'folder' ? share.folderId === itemId : share.fileId === itemId)) && !share.revoked
        )
        if (existingShare) {
          setExistingShareId(existingShare.id)

          // Automatically enable public link toggle and show existing link
          setCreatePublicLink(true)

          if (existingShare.max_views !== undefined) {
            setShareSettings(prev => ({
              ...prev,
              maxViews: existingShare.max_views || 0,
              maxViewsEnabled: (existingShare.max_views || 0) > 0
            }));
          }
          if (existingShare.max_downloads !== undefined) {
            setShareSettings(prev => ({
              ...prev,
              maxDownloads: existingShare.max_downloads || 0,
              maxDownloadsEnabled: (existingShare.max_downloads || 0) > 0
            }));
          }

          if (existingShare.comments_enabled !== undefined) {
            setShareSettings(prev => ({ ...prev, commentsEnabled: !!existingShare.comments_enabled }));
          }

          // Generate the existing share link
          const accountSalt = masterKeyManager.getAccountSalt()
          if (accountSalt) {
            // Derive CEK deterministically from account salt and file ID
            const derivationInput = `share:${itemId}:${accountSalt}`
            const derivationBytes = new TextEncoder().encode(derivationInput)
            const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
            const shareCek = new Uint8Array(cekHash)
            const shareCekHex = btoa(String.fromCharCode(...shareCek))

            // Show existing share link with deterministically derived CEK in fragment
            // SECURITY: ONLY include CEK if no password is set
            const finalShareUrl = existingShare.has_password
              ? `https://drive.ellipticc.com/s/${existingShare.id}`
              : `https://drive.ellipticc.com/s/${existingShare.id}#${shareCekHex}`

            setShareLink(finalShareUrl)
          }
        } else {

        }
      }
    } catch (error) {
      console.error('Share modal - checkExistingShare error:', error)
      setExistingShareId(null)
    } finally {
      setIsModalLoading(false)
    }
  }

  const handleViewLogs = async (page: number = 1) => {
    if (!existingShareId) return
    setLogsModalOpen(true)
    setIsLoadingLogs(true)
    try {
      const response = await apiClient.getShareLogs(existingShareId, page)
      if (response.success && response.data) {
        setLogs(response.data.logs)
        setLogsPagination(response.data.pagination)
        setLogsSettings(response.data.settings)
      } else if (response.status === 403) {
        toast.error("Detailed access logs require an active Pro subscription")
        setLogsModalOpen(false)
      } else {
        toast.error("Failed to load access logs")
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
      toast.error("An error occurred while fetching logs")
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleWipeLogs = async () => {
    if (!existingShareId || !confirm("Are you sure you want to wipe all access logs? This action cannot be undone.")) return
    setIsWipingLogs(true)
    try {
      const response = await apiClient.wipeShareLogs(existingShareId)
      if (response.success) {
        toast.success("Logs wiped successfully")
        setLogs([])
        setLogsPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
      } else {
        toast.error("Failed to wipe logs")
      }
    } catch (error) {
      console.error("Failed to wipe logs:", error)
      toast.error("An error occurred while wiping logs")
    } finally {
      setIsWipingLogs(false)
    }
  }

  const handleToggleLogging = async (enabled: boolean) => {
    if (!existingShareId) return
    setIsUpdatingLogging(true)
    try {
      const response = await apiClient.updateShareSettings(existingShareId, {
        detailed_logging_enabled: enabled
      })
      if (response.success) {
        setLogsSettings(prev => ({ ...prev, detailed_logging_enabled: enabled }))
        toast.success(enabled ? "Logging enabled" : "Logging disabled")
      } else {
        toast.error("Failed to update logging settings")
      }
    } catch (error) {
      console.error("Failed to update logging settings:", error)
      toast.error("An error occurred while updating settings")
    } finally {
      setIsUpdatingLogging(false)
    }
  }

  const validateEmail = (email: string): boolean => {
    return emailRegex.test(email.trim())
  }

  const addEmail = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) return

    if (!validateEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }

    if (emails.includes(trimmedEmail)) {
      setEmailError("This email has already been added")
      return
    }

    setEmails(prev => [...prev, trimmedEmail])
    setEmailInput("")
    setEmailError("")
  }

  const removeEmail = (emailToRemove: string) => {
    setEmails(prev => prev.filter(email => email !== emailToRemove))
  }

  const handleEmailInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault()
      if (emailInput.trim()) {
        addEmail(emailInput)
      }
    }
  }

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value)
    setEmailError("")
  }

  const handleEmailInputBlur = () => {
    if (emailInput.trim()) {
      addEmail(emailInput)
    }
  }

  const proceedToMessageModal = () => {
    if (emails.length === 0) return
    setMessageModalOpen(true)
  }

  const handleShareViaEmail = async () => {
    if (emails.length === 0) return

    setIsLoading(true)
    try {
      // 1. Derive share CEK deterministically
      const accountSalt = masterKeyManager.getAccountSalt()
      if (!accountSalt) throw new Error('Account salt not available')

      const derivationInput = `share:${itemId}:${accountSalt}`
      const derivationBytes = new TextEncoder().encode(derivationInput)
      const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
      const shareCek = new Uint8Array(cekHash)
      const shareCekHex = btoa(String.fromCharCode(...shareCek))

      // 2. Handle Password
      let saltPw = undefined
      let finalShareCekHex = shareCekHex

      if (shareSettings.passwordEnabled && shareSettings.password) {
        const salt = crypto.getRandomValues(new Uint8Array(32))
        const saltB64 = btoa(String.fromCharCode(...salt))
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(shareSettings.password),
          'PBKDF2',
          false,
          ['deriveBits']
        )
        const derivedBits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          256
        )
        const derivedBytes = new Uint8Array(derivedBits)
        const xchachaKey = derivedBytes.slice(0, 32)
        const nonce = crypto.getRandomValues(new Uint8Array(24))
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js')
        const xchaCiphertext = xchacha20poly1305(xchachaKey, nonce).encrypt(shareCek)
        saltPw = `${saltB64}:${btoa(String.fromCharCode(...nonce))}:${btoa(String.fromCharCode(...xchaCiphertext))}`
        finalShareCekHex = ''
      }

      // 3. Get Item Info and Unwrap CEK
      let infoResponse;
      if (itemType === 'folder') infoResponse = await apiClient.getFolderInfo(itemId);
      else if (itemType === 'paper') infoResponse = await apiClient.getPaper(itemId);
      else infoResponse = await apiClient.getFileInfo(itemId);

      if (!infoResponse.success || !infoResponse.data) throw new Error(`Failed to get ${itemType} info`)

      const { encryptData, decryptData, hexToUint8Array } = await import('@/lib/crypto')
      let itemFileCek: Uint8Array;

      if (itemType === 'paper') {
        const paperData = infoResponse.data as any;
        const masterKey = masterKeyManager.getMasterKey();
        if (!masterKey) {
          toast.error('Encryption key missing. Please login again.');
          return;
        }

        // Ensure the paper has been initialized with encrypted manifest (salt present)
        if (!paperData || !paperData.salt) {
          toast.error('Paper has no encrypted content yet. Please open the paper and save it before creating a share.');
          return;
        }

        try {
          const saltBytes = Uint8Array.from(atob(paperData.salt), c => c.charCodeAt(0));
          const keyMaterial = new Uint8Array(saltBytes.length + 17);
          keyMaterial.set(saltBytes, 0);
          keyMaterial.set(new TextEncoder().encode('paper-content-key'), saltBytes.length);
          const hmacKey = await crypto.subtle.importKey('raw', masterKey as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
          itemFileCek = new Uint8Array(derivedKeyMaterial.slice(0, 32));
        } catch (err) {
          console.error('Failed to derive paper CEK for sharing:', err);
          toast.error('Failed to prepare paper for sharing. Try saving the paper again and retry.');
          return;
        }
      } else if (itemType === 'folder') {
        itemFileCek = shareCek;
      } else {
        const dataObj = infoResponse.data as { file?: FileInfo; folder?: FolderInfo };
        const itemData = dataObj.file as unknown as Record<string, unknown> | undefined;
        if (!itemData || !itemData.wrapped_cek || !itemData.nonce_wrap_kyber) throw new Error(`File encryption info unavailable`)
        const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js')
        const userKeys = await keyManager.getUserKeys()
        const kyberCiphertext = hexToUint8Array(String(itemData.kyber_ciphertext))
        const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys.keypairs.kyberPrivateKey)
        itemFileCek = decryptData(String(itemData.wrapped_cek), new Uint8Array(sharedSecret), String(itemData.nonce_wrap_kyber))
      }

      // 4. Envelope Encryption
      const envelopeEncryption = encryptData(itemFileCek, shareCek)
      const wrappedItemCek = envelopeEncryption.encryptedData
      const envelopeNonce = envelopeEncryption.nonce

      // 5. Filename/Foldername Encryption
      const filenameBytes = new TextEncoder().encode(itemName)
      const filenameEnc = encryptData(filenameBytes, shareCek)
      const encryptedFilename = filenameEnc.encryptedData
      const filenameNonce = filenameEnc.nonce

      let encryptedFoldername = undefined
      let foldernameNonce = undefined
      if (itemType === 'folder') {
        const folderEnc = encryptData(new TextEncoder().encode(itemName), shareCek)
        encryptedFoldername = folderEnc.encryptedData
        foldernameNonce = folderEnc.nonce
      }

      // 6. Manifest
      let encryptedManifest = undefined
      if (itemType === 'folder') {
        encryptedManifest = await buildEncryptedFolderManifest(itemId, shareCek)
      }

      // For paper shares, build an encrypted manifest containing decrypted blocks
      if (itemType === 'paper') {
        try {
          const { decryptPaperContent, decryptFilename, encryptData } = await import('@/lib/crypto')
          const paperData = infoResponse.data as any;
          const masterKey = masterKeyManager.getMasterKey();

          if (!masterKey) {
            toast.error('Encryption key missing. Please login again.');
            setIsLoading(false);
            return;
          }

          const manifestEncrypted = paperData.encryptedContent;
          const manifestIv = paperData.iv;
          const manifestSalt = paperData.salt;

          const manifestStr = await decryptPaperContent(manifestEncrypted, manifestIv, manifestSalt, masterKey);
          const manifestObj = JSON.parse(manifestStr || '{}');
          const chunks = paperData.chunks || {};

          const blocksPlain: any[] = [];
          for (const entry of (manifestObj.blocks || [])) {
            const chunkData = chunks[entry.chunkId];
            if (!chunkData) continue;
            try {
              const blockStr = await decryptPaperContent(chunkData.encryptedContent, chunkData.iv, chunkData.salt, masterKey);
              const parsed = JSON.parse(blockStr);
              blocksPlain.push({ id: entry.id, chunkId: entry.chunkId, hash: entry.hash, content: parsed });
            } catch (err) {
              console.error('Failed to decrypt paper block for share manifest', err);
            }
          }

          let plainTitle = 'Untitled Paper'
          try {
            if (paperData.encryptedTitle && paperData.titleSalt) {
              plainTitle = await decryptFilename(paperData.encryptedTitle, paperData.titleSalt, masterKey);
            }
          } catch (e) {
            console.warn('Failed to decrypt paper title for share manifest', e);
          }

          const shareManifest = {
            version: 1,
            title: plainTitle,
            icon: manifestObj.icon || null,
            blocks: blocksPlain
          };

          const manifestBytes = new TextEncoder().encode(JSON.stringify(shareManifest));
          const manifestEnc = encryptData(manifestBytes, shareCek);
          encryptedManifest = {
            encryptedData: manifestEnc.encryptedData,
            nonce: manifestEnc.nonce
          };
        } catch (err) {
          console.error('Failed to build encrypted manifest for paper share:', err);
          toast.error('Failed to prepare paper share. Try again.');
          setIsLoading(false);
          return;
        }
      }

      // 7. Create Share
      const createResponse = await apiClient.createShare({
        file_id: itemType === 'file' ? itemId : undefined,
        folder_id: itemType === 'folder' ? itemId : undefined,
        paper_id: itemType === 'paper' ? itemId : undefined,
        wrapped_cek: wrappedItemCek,
        nonce_wrap: envelopeNonce,
        has_password: shareSettings.passwordEnabled,
        salt_pw: saltPw,
        max_views: shareSettings.maxViewsEnabled ? shareSettings.maxViews : undefined,
        max_downloads: shareSettings.maxDownloadsEnabled ? shareSettings.maxDownloads : undefined,
        expires_at: shareSettings.expirationDate ? shareSettings.expirationDate.toISOString() : undefined,
        comments_enabled: shareSettings.commentsEnabled,
        encrypted_filename: encryptedFilename,
        nonce_filename: filenameNonce,
        encrypted_foldername: encryptedFoldername,
        nonce_foldername: foldernameNonce,
        encrypted_manifest: encryptedManifest
      })

      if (!createResponse.success || !createResponse.data?.id) throw new Error(createResponse.error || "Failed to create share")
      const shareId = createResponse.data.id
      setExistingShareId(shareId)

      const shareUrl = `https://drive.ellipticc.com/s/${shareId}${finalShareCekHex ? '#' + finalShareCekHex : ''}`

      // 8. Send Emails
      const emailResponse = await apiClient.sendShareEmails(shareId, {
        recipients: emails,
        share_url: shareUrl,
        file_name: itemName,
        message: includeMessage && message.trim() ? message.trim() : undefined
      })

      if (emailResponse.success) {
        toast.success(`Shared ${itemType} with ${emails.length} recipient${emails.length > 1 ? 's' : ''}`)
        setEmails([])
        setMessage("")
        setMessageModalOpen(false)
        setOpen(false)
        onShareUpdate?.()
      } else {
        toast.error(`Failed to send emails: ${emailResponse.error}`)
      }
    } catch (error) {
      console.error("Failed to share item:", error)
      toast.error(error instanceof Error ? error.message : `Failed to share ${itemType}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePublicLink = async () => {
    if (!createPublicLink) return
    setIsLoading(true)

    // Prepare encrypted manifest placeholder
    let encryptedManifest: any = undefined;

    try {
      // 1. Check existing
      const mySharesResponse = await apiClient.getMyShares()
      if (mySharesResponse.success && mySharesResponse.data) {
        const shares = Array.isArray(mySharesResponse.data) ? mySharesResponse.data : mySharesResponse.data.data;
        const existingShare = shares.find((share: ShareItem) =>
          (itemType === 'paper' ? share.paperId === itemId : (itemType === 'folder' ? share.folderId === itemId : share.fileId === itemId)) && !share.revoked
        )

        if (existingShare) {
          const accountSalt = masterKeyManager.getAccountSalt()
          if (!accountSalt) throw new Error('Account salt not available')
          const derivationInput = `share:${itemId}:${accountSalt}`
          const derivationBytes = new TextEncoder().encode(derivationInput)
          const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
          const shareCek = new Uint8Array(cekHash)
          const shareCekHex = btoa(String.fromCharCode(...shareCek))

          const finalShareUrl = existingShare.has_password
            ? `https://drive.ellipticc.com/s/${existingShare.id}`
            : `https://drive.ellipticc.com/s/${existingShare.id}#${shareCekHex}`

          setShareLink(finalShareUrl)
          setExistingShareId(existingShare.id)
          toast.success("Using existing share link")
          setIsLoading(false)
          return
        }
      }

      // 2. Create New
      const accountSalt = masterKeyManager.getAccountSalt()
      if (!accountSalt) throw new Error('Account salt not available')
      const derivationInput = `share:${itemId}:${accountSalt}`
      const derivationBytes = new TextEncoder().encode(derivationInput)
      const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
      const shareCek = new Uint8Array(cekHash)
      const shareCekHex = btoa(String.fromCharCode(...shareCek))

      let saltPw = undefined
      let finalShareCekHex = shareCekHex

      if (shareSettings.passwordEnabled && shareSettings.password) {
        const salt = crypto.getRandomValues(new Uint8Array(32))
        const saltB64 = btoa(String.fromCharCode(...salt))
        const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(shareSettings.password), 'PBKDF2', false, ['deriveBits'])
        const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256)
        const derivedBytes = new Uint8Array(derivedBits)
        const xchachaKey = derivedBytes.slice(0, 32)
        const nonce = crypto.getRandomValues(new Uint8Array(24))
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js')
        const xchaCiphertext = xchacha20poly1305(xchachaKey, nonce).encrypt(shareCek)
        saltPw = `${saltB64}:${btoa(String.fromCharCode(...nonce))}:${btoa(String.fromCharCode(...xchaCiphertext))}`
        finalShareCekHex = ''
      }

      let infoResponse;
      if (itemType === 'folder') infoResponse = await apiClient.getFolderInfo(itemId);
      else if (itemType === 'paper') infoResponse = await apiClient.getPaper(itemId);
      else infoResponse = await apiClient.getFileInfo(itemId);
      if (!infoResponse.success || !infoResponse.data) throw new Error(`Failed to get info`)

      const { encryptData, decryptData, hexToUint8Array } = await import('@/lib/crypto')
      let itemFileCek: Uint8Array;

      if (itemType === 'paper') {
        const paperData = infoResponse.data as any;
        const masterKey = masterKeyManager.getMasterKey();
        if (!masterKey) {
          toast.error('Encryption key missing. Please login again.');
          setIsLoading(false);
          return;
        }

        if (!paperData || !paperData.salt) {
          toast.error('Paper has no encrypted content yet. Please open the paper and save it before creating a share.');
          setIsLoading(false);
          return;
        }

        try {
          const saltBytes = Uint8Array.from(atob(paperData.salt), c => c.charCodeAt(0));
          const keyMaterial = new Uint8Array(saltBytes.length + 17);
          keyMaterial.set(saltBytes, 0);
          keyMaterial.set(new TextEncoder().encode('paper-content-key'), saltBytes.length);
          const hmacKey = await crypto.subtle.importKey('raw', masterKey as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
          itemFileCek = new Uint8Array(derivedKeyMaterial.slice(0, 32));
        } catch (err) {
          console.error('Failed to derive paper CEK for sharing:', err);
          toast.error('Failed to prepare paper for sharing. Try saving the paper again and retry.');
          setIsLoading(false);
          return;
        }

        // Build an encrypted share manifest containing decrypted blocks so recipients can preview without the owner's master key
        try {
          const { decryptPaperContent, decryptFilename, encryptData } = await import('@/lib/crypto')

          // paperData should include the server-side manifest and chunks (from apiClient.getPaper)
          const manifestEncrypted = paperData.encryptedContent;
          const manifestIv = paperData.iv;
          const manifestSalt = paperData.salt;

          let manifestObj: any = null;
          try {
            const manifestStr = await decryptPaperContent(manifestEncrypted, manifestIv, manifestSalt, masterKey);
            manifestObj = JSON.parse(manifestStr || '{}');
          } catch (manifestErr) {
            console.error('Failed to decrypt paper manifest for share creation:', manifestErr);
            toast.error('Failed to read paper content for sharing. Please save the paper and try again.');
            setIsLoading(false);
            return;
          }

          const chunks = paperData.chunks || {};

          // Decrypt each block and construct plaintext blocks array (Plate nodes)
          const blocksPlain: any[] = [];
          for (const entry of (manifestObj.blocks || [])) {
            const chunkData = chunks[entry.chunkId];
            if (!chunkData) {
              console.warn(`Missing chunk ${entry.chunkId} while preparing share manifest`) 
              continue;
            }

            try {
              const blockStr = await decryptPaperContent(chunkData.encryptedContent, chunkData.iv, chunkData.salt, masterKey);
              const parsed = JSON.parse(blockStr);
              blocksPlain.push({ id: entry.id, chunkId: entry.chunkId, hash: entry.hash, content: parsed });
            } catch (blockErr) {
              console.error(`Failed to decrypt block ${entry.chunkId} for sharing:`, blockErr);
            }
          }

          // Derive plaintext title for the share manifest (so share view shows same title/icon)
          let plainTitle = 'Untitled Paper'
          try {
            if (paperData.encryptedTitle && paperData.titleSalt) {
              plainTitle = await decryptFilename(paperData.encryptedTitle, paperData.titleSalt, masterKey);
            }
          } catch (e) {
            console.warn('Failed to decrypt paper title for share manifest', e)
          }

          const shareManifest = {
            version: 1,
            title: plainTitle,
            icon: manifestObj.icon || null,
            blocks: blocksPlain
          };

          const manifestBytes = new TextEncoder().encode(JSON.stringify(shareManifest));
          const manifestEnc = encryptData(manifestBytes, shareCek);
          encryptedManifest = {
            encryptedData: manifestEnc.encryptedData,
            nonce: manifestEnc.nonce
          };

        } catch (err) {
          console.error('Failed to build encrypted manifest for paper share:', err);
          toast.error('Failed to prepare paper share. Try again.');
          setIsLoading(false);
          return;
        }

      } else if (itemType === 'folder') {
        itemFileCek = shareCek;
      } else {
        const dataObj = infoResponse.data as { file?: FileInfo; folder?: FolderInfo };
        const itemData = dataObj.file as unknown as Record<string, unknown> | undefined;
        if (!itemData || !itemData.wrapped_cek || !itemData.nonce_wrap_kyber) {
          toast.error('File encryption info unavailable');
          setIsLoading(false);
          return;
        }
        const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js')
        const userKeys = await keyManager.getUserKeys()
        const kyberCiphertext = hexToUint8Array(String(itemData.kyber_ciphertext))
        const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys.keypairs.kyberPrivateKey)
        itemFileCek = decryptData(String(itemData.wrapped_cek), new Uint8Array(sharedSecret), String(itemData.nonce_wrap_kyber))
      }

      const envelopeEnc = encryptData(itemFileCek, shareCek)
      const filenameEnc = encryptData(new TextEncoder().encode(itemName), shareCek)
      let encryptedFoldername = undefined;
      let foldernameNonce = undefined;
      if (itemType === 'folder') {
        const fEnc = encryptData(new TextEncoder().encode(itemName), shareCek)
        encryptedFoldername = fEnc.encryptedData
        foldernameNonce = fEnc.nonce
      }
      if (itemType === 'folder') encryptedManifest = await buildEncryptedFolderManifest(itemId, shareCek)

      const response = await apiClient.createShare({
        file_id: itemType === 'file' ? itemId : undefined,
        folder_id: itemType === 'folder' ? itemId : undefined,
        paper_id: itemType === 'paper' ? itemId : undefined,
        wrapped_cek: envelopeEnc.encryptedData,
        nonce_wrap: envelopeEnc.nonce,
        has_password: shareSettings.passwordEnabled,
        salt_pw: saltPw,
        encrypted_filename: filenameEnc.encryptedData,
        nonce_filename: filenameEnc.nonce,
        encrypted_foldername: encryptedFoldername,
        nonce_foldername: foldernameNonce,
        expires_at: shareSettings.expirationDate?.toISOString(),
        max_views: shareSettings.maxViewsEnabled ? (shareSettings.maxViews || undefined) : undefined,
        max_downloads: shareSettings.maxDownloadsEnabled ? (shareSettings.maxDownloads || undefined) : undefined,
        permissions: 'read',
        comments_enabled: shareSettings.commentsEnabled,
        encrypted_manifest: encryptedManifest
      })

      if (!response.success || !response.data?.id) throw new Error(response.error || "Failed to create share")
      const shareId = response.data.id
      setExistingShareId(shareId)

      const shareUrl = `https://drive.ellipticc.com/s/${shareId}${finalShareCekHex ? '#' + finalShareCekHex : ''}`
      setShareLink(shareUrl)
      toast.success("Public link created successfully")
      onShareUpdate?.()
    } catch (error) {
      console.error("Failed to create public link:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create public link")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      toast.success("Share link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy link:", error)
      toast.error("Failed to copy link")
    }
  }

  function handleSettingsChange<K extends keyof ShareSettings>(key: K, value: ShareSettings[K]) {
    // Prevent selecting expiration dates in the past
    if (key === 'expirationDate' && value instanceof Date) {
      if (value < new Date()) {
        toast.error('Expiration date cannot be in the past')
        return
      }
    }

    setShareSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {externalOpen === undefined && externalOnOpenChange === undefined ? (
          <DialogTrigger asChild>
            {children}
          </DialogTrigger>
        ) : (
          children
        )}
        <DialogContent className="sm:max-w-lg animate-in fade-in-0 zoom-in-95 duration-200" showCloseButton={false}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle>Share &quot;{truncateFilename(itemName)}&quot;</DialogTitle>
              <DialogDescription>
                Invite people to view this {itemType}.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettingsOpen(true)}
                    className="h-8 w-8 p-0"
                    disabled={isModalLoading}
                    aria-label="Share Settings"
                  >
                    <IconSettings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share Settings</TooltipContent>
              </Tooltip>
              {existingShareId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewLogs(1)}
                      className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                      disabled={isModalLoading}
                      aria-label="Access Logs (Pro)"
                    >
                      <IconChartBar className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Access Logs (Pro)</TooltipContent>
                </Tooltip>
              )}
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {isModalLoading ? (
            // Loading skeleton
            <div className="grid gap-6 py-4">
              {/* Send via Email Section Skeleton */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="grid gap-2">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </div>

              <Separator />

              {/* Create Public Link Section Skeleton */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-9" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ) : (
            // Actual content
            <div className="grid gap-6 py-4">
              {/* Send via Email Section */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <IconSend className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Send via Email</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emails" className="text-xs text-muted-foreground">
                    Enter email addresses (press Enter, Space, or Comma to add)
                  </Label>
                  <Input
                    id="emails"
                    value={emailInput}
                    onChange={(e) => handleEmailInputChange(e.target.value)}
                    onKeyDown={handleEmailInputKeyDown}
                    onBlur={handleEmailInputBlur}
                    placeholder="user1@example.com, user2@example.com"
                    className={emailError ? "border-destructive" : ""}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                  {emails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {emails.map((email) => (
                        <Badge key={email} variant="secondary" className="flex items-center gap-1">
                          {email}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeEmail(email)}
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <IconX className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={proceedToMessageModal}
                    disabled={emails.length === 0 || isLoading}
                    size="sm"
                    className="w-full"
                  >
                    {isLoading ? "Sending..." : `Send to ${emails.length} recipient${emails.length !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Create Public Link Section */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <IconLink className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Create Public Link</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="public-link"
                    checked={createPublicLink}
                    onCheckedChange={async (checked) => {
                      setCreatePublicLink(checked)
                      if (checked) {
                        await handleCreatePublicLink()
                      } else {
                        setShareLink('')
                      }
                    }}
                  />
                  <Label htmlFor="public-link" className="text-sm">
                    Create public link
                  </Label>
                </div>
              </div>

              {/* Share Link Display */}
              {shareLink && (
                <>
                  <Separator />
                  <div className="grid gap-2 animate-in slide-in-from-bottom-2 duration-300">
                    <Label className="text-sm font-medium">Share Link</Label>
                    <div className="flex gap-2">
                      <Input
                        value={shareLink}
                        readOnly
                        className="flex-1 text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={handleCopyLink}>
                        {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Modal */}
      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle>Send Invitation</DialogTitle>
            <DialogDescription>
              Add a personal message to your invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Include message and file in invitation e-mail</Label>
                <Switch
                  checked={includeMessage}
                  onCheckedChange={setIncludeMessage}
                />
              </div>

              {includeMessage && (
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  className="min-h-[100px] animate-in slide-in-from-top-2 duration-200"
                />
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {emails.length} recipient{emails.length !== 1 ? 's' : ''} will receive an invitation to access &quot;{itemName}&quot;
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMessageModalOpen(false)}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleShareViaEmail}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Sub-Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle>Share Settings</DialogTitle>
            <DialogDescription>
              Configure security and access settings for this share.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!isPro && !isLoadingSubscription && (
              <Alert className="mb-2 bg-muted/50 border-border text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertDescription className="text-muted-foreground whitespace-nowrap">
                    <Link href="/pricing" className="hover:underline font-medium underline-offset-4">Upgrade to Ellipticc Pro to enable all link settings</Link>
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Password Protection */}
            <div className={`grid gap-3 ${!isPro ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between">
                <Label htmlFor="password-enabled" className="text-sm font-medium">
                  Require password
                </Label>
                <Switch
                  id="password-enabled"
                  checked={shareSettings.passwordEnabled}
                  onCheckedChange={(checked: boolean) => handleSettingsChange('passwordEnabled', checked)}
                />
              </div>
              {shareSettings.passwordEnabled && (
                <form
                  className="w-full animate-in slide-in-from-top-2 duration-200"
                  onSubmit={(e) => { e.preventDefault(); /* Prevent form submission */ }}
                  autoComplete="off"
                >
                  {/* [DOM] Password forms should have (optionally hidden) username fields for accessibility */}
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    className="hidden"
                    readOnly
                  />
                  <PasswordInput
                    value={shareSettings.password}
                    onChange={(e) => handleSettingsChange('password', e.target.value)}
                    placeholder="Enter password"
                    className="text-sm"
                    autoComplete="new-password"
                  />
                </form>
              )}
            </div>

            {/* Expiration Date */}
            <div className={`grid gap-3 ${!isPro ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Set expiration</Label>
                <Switch
                  checked={!!shareSettings.expirationDate}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Default to tomorrow same time? Or end of today?
                      // Let's default to 7 days from now as a common use case, or just "now".
                      // User prompt said "Set expiration".
                      const date = new Date();
                      date.setDate(date.getDate() + 7); // Default 1 week
                      handleSettingsChange('expirationDate', date);
                    } else {
                      handleSettingsChange('expirationDate', undefined);
                    }
                  }}
                />
              </div>

              {shareSettings.expirationDate && (
                <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                  {/* Date Picker (Left) */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-start text-left font-normal"
                      >
                        <IconCalendar className="mr-2 h-4 w-4" />
                        {shareSettings.expirationDate ? format(shareSettings.expirationDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={shareSettings.expirationDate}
                        onSelect={(date) => {
                          if (date) {
                            const current = shareSettings.expirationDate || new Date();
                            date.setHours(current.getHours());
                            date.setMinutes(current.getMinutes());
                            date.setSeconds(current.getSeconds());
                            handleSettingsChange('expirationDate', date);
                          }
                        }}
                        disabled={{ before: startOfToday() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Time Picker (Right) */}
                  <div className="relative w-32 shrink-0">
                    <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                      <IconClockHour8 className="size-4" />
                    </div>
                    <Input
                      type="time"
                      id="time-picker"
                      step="1"
                      disabled={!shareSettings.expirationDate}
                      value={shareSettings.expirationDate ? format(shareSettings.expirationDate, "HH:mm:ss") : ""}
                      onChange={(e) => {
                        const timeParts = e.target.value.split(':');
                        if (timeParts.length >= 2 && shareSettings.expirationDate) {
                          const newDate = new Date(shareSettings.expirationDate);
                          newDate.setHours(parseInt(timeParts[0]));
                          newDate.setMinutes(parseInt(timeParts[1]));
                          if (timeParts.length === 3) {
                            newDate.setSeconds(parseInt(timeParts[2]));
                          }
                          handleSettingsChange('expirationDate', newDate);
                        }
                      }}
                      className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Enable Comments */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="comments-enabled" className="text-sm font-medium">
                  Enable comments
                </Label>
                <Switch
                  id="comments-enabled"
                  checked={shareSettings.commentsEnabled}
                  onCheckedChange={async (checked: boolean) => {
                    handleSettingsChange('commentsEnabled', checked);
                    if (existingShareId) {
                      try {
                        await apiClient.updateShareSettings(existingShareId, { comments_enabled: checked });
                        toast.success(`Comments ${checked ? 'enabled' : 'disabled'}`);
                      } catch (err) {
                        toast.error("Failed to update comment settings");
                        handleSettingsChange('commentsEnabled', !checked);
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Max Downloads */}
            <div className={`grid gap-3 ${!isPro ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Set maximum downloads</Label>
                <Switch
                  checked={shareSettings.maxDownloadsEnabled}
                  onCheckedChange={(checked) => {
                    handleSettingsChange('maxDownloadsEnabled', checked);
                    if (checked && (!shareSettings.maxDownloads || shareSettings.maxDownloads === 0)) {
                      handleSettingsChange('maxDownloads', 10); // Default start
                    }
                  }}
                />
              </div>
              {shareSettings.maxDownloadsEnabled && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <Input
                    type="number"
                    min="1"
                    value={shareSettings.maxDownloads || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "")
                      let numVal = parseInt(val)
                      if (val === "") numVal = 0

                      if (numVal > 1000000) {
                        toast.error("At this point, just make it unlimited")
                        numVal = 1000000
                      }

                      handleSettingsChange('maxDownloads', numVal)
                    }}
                    placeholder="100"
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            {/* Max Views */}
            <div className={`grid gap-3 ${!isPro ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Set maximum views</Label>
                <Switch
                  checked={shareSettings.maxViewsEnabled}
                  onCheckedChange={(checked) => {
                    handleSettingsChange('maxViewsEnabled', checked);
                    if (checked && (!shareSettings.maxViews || shareSettings.maxViews === 0)) {
                      handleSettingsChange('maxViews', 10); // Default start
                    }
                  }}
                />
              </div>
              {shareSettings.maxViewsEnabled && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <Input
                    type="number"
                    min="1"
                    value={shareSettings.maxViews || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "")
                      let numVal = parseInt(val)
                      if (val === "") numVal = 0

                      if (numVal > 1000000) {
                        toast.error("At this point, just make it unlimited")
                        numVal = 1000000
                      }

                      handleSettingsChange('maxViews', numVal)
                    }}
                    placeholder="100"
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSettingsOpen(false)}
            >
              Apply Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
      {/* Access Logs Modal */}
      <Dialog open={logsModalOpen} onOpenChange={setLogsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader className="p-8 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <IconChartBar className="h-6 w-6 text-primary" />
                  Detailed Access Logs
                </DialogTitle>
                <DialogDescription className="text-base">
                  Track every interaction with your shared content securely.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {isPro && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewLogs(1)}
                        className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                        disabled={isModalLoading}
                        aria-label="Access Logs (Pro)"
                      >
                        <IconChartBar className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Access Logs (Pro)</TooltipContent>
                  </Tooltip>
                )}
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLogsModalOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 px-8 pb-8">
            <div className="flex flex-col gap-6">
              {/* Main Content Area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="font-mono px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      {logsPagination.total} Total Events
                    </Badge>
                    <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-muted/30">
                      <IconActivity className={`h-3 w-3 ${logsSettings.detailed_logging_enabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-tight">Logging</span>
                      <Switch
                        disabled={isUpdatingLogging}
                        checked={logsSettings.detailed_logging_enabled}
                        onCheckedChange={handleToggleLogging}
                        className="scale-75 h-4 w-8"
                      />
                    </div>
                  </div>

                  {logs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleWipeLogs}
                      disabled={isWipingLogs}
                      className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 text-xs font-semibold uppercase tracking-wider"
                    >
                      {isWipingLogs ? (
                        <div className="h-3 w-3 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <IconTrash className="h-3.5 w-3.5" />
                      )}
                      Wipe History
                    </Button>
                  )}
                </div>

                <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left px-6 py-4 font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Session</th>
                          <th className="text-left px-6 py-4 font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Event / Device</th>
                          <th className="text-left px-6 py-4 font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Location</th>
                          <th className="text-left px-6 py-4 font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Status</th>
                          <th className="text-right px-6 py-4 font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {isLoadingLogs ? (
                          [...Array(6)].map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td colSpan={5} className="px-6 py-6">
                                <Skeleton className="h-4 w-full opacity-20" />
                              </td>
                            </tr>
                          ))
                        ) : logs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-20 text-center">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                                  <IconActivity className="h-6 w-6 text-muted-foreground/40" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground">No events recorded</h3>
                                <p className="text-sm text-muted-foreground max-w-[240px]">
                                  {logsSettings.detailed_logging_enabled
                                    ? "Once people interact with your share, logs will appear here."
                                    : "Access logging is currently disabled for this share."}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          logs.map((log) => (
                            <tr key={log.id} className="group hover:bg-muted/40 transition-all duration-200">
                              <td className="px-6 py-5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help transition-colors group-hover:text-foreground">
                                        {log.session_id.substring(0, 12).toUpperCase()}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="font-mono text-[10px]">{log.session_id}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1.5">
                                  <span className="font-bold text-xs tracking-tight text-foreground/90">
                                    {log.action === 'DOWNLOAD' ? 'FILE DOWNLOADED' : 'LINK VISITED'}
                                  </span>
                                  <div className="flex items-center gap-2 opacity-70 scale-90 origin-left">
                                    {(() => {
                                      const { osIcon, osName, browserIcon, browserName } = getUAInfo(log.user_agent || '');
                                      return (
                                        <>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger className="flex items-center pointer-events-auto">{osIcon}</TooltipTrigger>
                                              <TooltipContent side="top"><p className="text-[10px] font-bold">{osName}</p></TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger className="flex items-center pointer-events-auto">{browserIcon}</TooltipTrigger>
                                              <TooltipContent side="top"><p className="text-[10px] font-bold">{browserName}</p></TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-flex items-center gap-3 cursor-help bg-muted/50 rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors">
                                        <span className="text-xl leading-none antialiased grayscale-[0.2]">
                                          {getFlagEmoji(log.country)}
                                        </span>
                                        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                          {log.country || '??'}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-[10px] font-bold uppercase tracking-widest">
                                        {log.country || 'Unknown Location'}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </td>
                              <td className="px-6 py-5">
                                <Badge
                                  className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm tracking-[0.05em] ${log.action === 'DOWNLOAD'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    }`}
                                >
                                  {log.action}
                                </Badge>
                              </td>
                              <td className="px-6 py-5 text-right whitespace-nowrap">
                                <div className="flex flex-col items-end">
                                  <span className="text-[11px] font-bold text-foreground/80">{format(new Date(log.created_at), "dd/MM/yyyy")}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(log.created_at), "hh:mm a")}</span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {logsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-6">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                      Page <span className="text-foreground font-bold">{logsPagination.page}</span> of <span className="text-foreground font-bold">{logsPagination.totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsPagination.page === 1 || isLoadingLogs}
                        onClick={() => handleViewLogs(logsPagination.page - 1)}
                        className="h-8 w-8 p-0 rounded-lg"
                      >
                        <IconChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsPagination.page === logsPagination.totalPages || isLoadingLogs}
                        onClick={() => handleViewLogs(logsPagination.page + 1)}
                        className="h-8 w-8 p-0 rounded-lg"
                      >
                        <IconChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isPro && (
            <div className="mx-8 mb-8 p-4 bg-primary/5 border border-primary/10 rounded-xl text-center">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">
                Full history & analytics available for Pro users.
                <Link href="/pricing" className="underline ml-2 hover:opacity-80 transition-opacity">Upgrade now</Link>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

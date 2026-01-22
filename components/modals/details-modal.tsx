"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  IconFile,
  IconFolder,
  IconCalendar,
  IconShieldCheck,
  IconAlertCircle,
  IconLoader2,
  IconDownload,
  IconCopy,
  IconCheck,
  IconLock,
  IconTag,
  IconPlus,
  IconX,
  IconInfoCircle,
  IconHistory,
  IconSignature,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient, FileInfo, FolderInfo, Tag } from "@/lib/api"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { encryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { Badge } from "@/components/ui/badge"
import { unwrapCEK, DownloadEncryption } from "@/lib/download"
import { decryptData } from "@/lib/crypto"
import { keyManager } from "@/lib/key-manager"
import { useUser } from "@/components/user-context"

interface ItemDetails {
  filename?: string;
  encryptedFilename?: string;
  // Legacy snake_case aliases
  encrypted_filename?: string;
  filename_salt?: string;
  nameSalt?: string;
  parentId?: string | null;
  path?: string;
  encrypted_path?: string;
  encryptedPath?: string;
  path_salt?: string;
  pathSalt?: string;
  created_at?: string;
  createdAt?: string;
  updatedAt?: string;
  updated_at?: string;
  mimetype?: string;
  size?: number;
  is_shared?: boolean;
  sha_hash?: string | null;
  shaHash?: string | null;
  lockedUntil?: string | null;
  retentionMode?: string | null;
  tags?: Tag[];
  width?: number;
  height?: number;
}
import { decryptFilename, decryptUserPrivateKeys } from "@/lib/crypto"
import { useIsMobile } from "@/hooks/use-mobile"
import { useFormatter } from "@/hooks/use-formatter"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { getCekForShare, setCekForShare } from '@/lib/share-cache'
import { decryptShareInWorker } from '@/lib/decrypt-share-pool'
import { decryptShareFilenameWithCek } from '@/lib/share-crypto'

interface DetailsModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder" | "paper"
  // Optional shareId: when provided, DetailsModal will prefer CEK from cache or derive it via worker
  shareId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onTagsUpdated?: () => void
}

export function DetailsModal({
  children,
  itemId = "",
  itemName = "example-file.pdf",
  itemType = "file",
  shareId,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onTagsUpdated
}: DetailsModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { user, deviceQuota } = useUser()
  const { formatDate } = useFormatter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null)
  const [decryptedFilename, setDecryptedFilename] = useState<string | null>(null)
  const [decryptedPath, setDecryptedPath] = useState<string | null>(null)
  const [signatureStatus, setSignatureStatus] = useState<{
    verified: boolean | null
    signerEmail?: string
    error?: string
    status?: string
  } | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [isTagging, setIsTagging] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [openCombobox, setOpenCombobox] = useState(false)

  // NEW: Thumbnail state
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const open = externalOpen ?? internalOpen
  const setOpen = externalOnOpenChange ?? setInternalOpen

  const isFreePlan = (deviceQuota?.planName === 'Free' || !user?.subscription) && user?.plan !== 'pro' && user?.plan !== 'plus' && user?.plan !== 'unlimited';

  useEffect(() => {
    if (open && itemId) {
      loadItemDetailsAndVerify()
    }
  }, [open, itemId])

  // Decrypt filename
  useEffect(() => {
    const decryptFilenameAsync = async () => {
      const encryptedName = itemDetails?.encrypted_filename || itemDetails?.encryptedFilename
      const filenameSalt = itemDetails?.filename_salt || itemDetails?.nameSalt

      // If this item is part of a share and caller supplied a shareId, prefer CEK cache/worker
      if ((encryptedName && filenameSalt) || (itemDetails && (itemDetails as any).shareId && (itemDetails as any).kyber_ciphertext) || shareId) {
        // Prefer explicit prop 'shareId' passed to the modal, otherwise try itemDetails fields
        const effectiveShareId = (shareId) || (itemDetails && ((itemDetails as any).shareId || (itemDetails as any).share_id));

        try {
          // Try master key decryption first for server-provided encrypted filename
          if (encryptedName && filenameSalt) {
            const { masterKeyManager } = await import('@/lib/master-key')
            const masterKey = masterKeyManager.getMasterKey()
            try {
              const decrypted = await decryptFilename(
                encryptedName,
                filenameSalt,
                masterKey
              )
              setDecryptedFilename(decrypted)
              return
            } catch (err) {
              // continue to share-CEK approach if that fails
            }
          }

          if (!effectiveShareId) {
            setDecryptedFilename(null);
            return;
          }

          // 1. Try cache
          const cached = getCekForShare(effectiveShareId);
          if (cached) {
            const name = decryptShareFilenameWithCek({ item: { encryptedName: encryptedName, nameSalt: filenameSalt } }, cached);
            if (name) {
              setDecryptedFilename(name);
              return;
            }
          }

          // 2. Fetch share details and derive CEK via worker
          const userRes = await apiClient.getMe();
          if (!userRes.success || !userRes.data) {
            setDecryptedFilename(null);
            return;
          }

          const keys = await decryptUserPrivateKeys(userRes.data as any);
          const shareRes = await apiClient.getShare(effectiveShareId);
          if (!shareRes.success || !shareRes.data) {
            setDecryptedFilename(null);
            return;
          }

          // Normalize share object into expected worker shape
          const sd = shareRes.data as any;
          const normalizedShare = {
            kyberCiphertext: sd.kyberCiphertext || sd.kyber_ciphertext,
            encryptedCek: sd.encryptedCek || sd.encrypted_cek,
            encryptedCekNonce: sd.encryptedCekNonce || sd.encrypted_cek_nonce,
            item: {
              encryptedName: sd.encrypted_filename || encryptedName,
              nameSalt: sd.nonce_filename || filenameSalt
            }
          }

          const workerRes = await decryptShareInWorker({ id: effectiveShareId, kyberPrivateKey: keys.kyberPrivateKey.buffer as ArrayBuffer, share: normalizedShare });
          if (workerRes && workerRes.cek) {
            const cek = new Uint8Array(workerRes.cek);
            setCekForShare(effectiveShareId, cek);
          }
          if (workerRes && workerRes.name) {
            setDecryptedFilename(workerRes.name);
            return;
          }

          setDecryptedFilename(null);
        } catch (err) {
          console.error('Failed to decrypt shared filename:', err)
          setDecryptedFilename(null)
        }
      } else {
        setDecryptedFilename(null)
      }
    }
    decryptFilenameAsync()
  }, [itemDetails])

  // Decrypt path
  useEffect(() => {
    const decryptPathAsync = async () => {
      // Priority: if backend provided encrypted_path/pathSalt, decrypt it
      const encryptedPath = itemDetails?.encrypted_path || itemDetails?.encryptedPath
      const pathSalt = itemDetails?.path_salt || itemDetails?.pathSalt

      try {
        if (encryptedPath && pathSalt) {
          const { masterKeyManager } = await import('@/lib/master-key')
          const masterKey = masterKeyManager.getMasterKey()
          const decrypted = await decryptFilename(
            encryptedPath,
            pathSalt,
            masterKey
          )
          setDecryptedPath(decrypted)
          return
        }

        // If item is a file and has a folder_id, fetch folder path from backend and decrypt each segment
        const folderId = (itemDetails as any)?.folder_id || (itemDetails as any)?.parentId || null;
        if (folderId) {
          const res = await apiClient.getFolderPath(folderId)
          if (res.success && res.data && Array.isArray(res.data.path) && res.data.path.length > 0) {
            const { masterKeyManager } = await import('@/lib/master-key')
            const masterKey = masterKeyManager.getMasterKey()
            const names: string[] = []
            for (const seg of res.data.path) {
              try {
                const dec = await decryptFilename(seg.encryptedName, seg.nameSalt, masterKey)
                names.push(dec)
              } catch (e) {
                // fallback to masked name if decryption fails
                names.push('•••')
              }
            }
            // Build breadcrumb-like path string (Root / a / b)
            const pathStr = names.length === 0 ? 'Root' : `/${names.join('/')}`
            setDecryptedPath(pathStr)
            return
          }
        }

        // Fallback: prefer server-sent path if available
        if ((itemDetails as any)?.path) {
          setDecryptedPath((itemDetails as any).path)
          return
        }

        setDecryptedPath(null)
      } catch (error) {
        console.error('Failed to resolve path for item:', error)
        setDecryptedPath(null)
      }
    }
    decryptPathAsync()
  }, [itemDetails])

  // NEW: Effect to load thumbnail securely with decryption
  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    const loadThumbnail = async () => {
      // Check if itemDetails mentions a thumbnail exists
      // Cast to Record to access potential database fields
      const details = itemDetails as Record<string, unknown>;
      const hasThumbnail = details && details.thumbnail_path;

      if (open && itemId && itemType === 'file' && hasThumbnail) {
        try {
          // 1. Fetch encrypted blob
          const blob = await apiClient.getThumbnailBlob(itemId);
          if (!blob || !isMounted) return;

          // 2. Get User Keys
          const keys = await keyManager.getUserKeys();

          // 3. Get Encryption Metadata from itemDetails
          const encryption = {
            wrappedCek: details.wrapped_cek || details.wrappedCek,
            kyberCiphertext: details.kyber_ciphertext || details.kyberCiphertext,
            nonceWrapKyber: details.nonce_wrap_kyber || details.nonceWrapKyber || details.nonce_wrap,
          };

          if (!encryption.wrappedCek || !encryption.kyberCiphertext) {
            console.warn("DetailsModal: Missing encryption metadata for thumbnail");
            return;
          }

          try {
            // Prefer cached CEK if present to avoid redundant unwrap
            let usedCek: Uint8Array | null = null;
            const effectiveShareIdForThumb = (shareId || (details as any)?.shareId || (details as any)?.share_id) as string | undefined;
            if (encryption && (encryption as any).kyberCiphertext && effectiveShareIdForThumb) {
              // Try cache first (shareId provided by props or from details)
              const cached = getCekForShare(effectiveShareIdForThumb);
              if (cached) {
                usedCek = cached;
              }
            }

            if (!usedCek) {
              // 4. Unwrap Content Encryption Key (fallback)
              const cek = await unwrapCEK(encryption as DownloadEncryption, keys.keypairs);
              usedCek = cek;
            }

            // 5. Read Blob string "encryptedData:nonce"
            const text = await blob.text();

            if (text.includes(':') && text.length < 20000000) {
              const parts = text.split(':');
              if (parts.length === 2) {
                const [encryptedData, nonce] = parts;

                // 6. Decrypt using usedCek
                const decryptedData = decryptData(encryptedData, usedCek!, nonce);
                const decryptedBlob = new Blob([new Uint8Array(decryptedData)], { type: 'image/jpeg' });

                objectUrl = URL.createObjectURL(decryptedBlob);
                if (isMounted) setThumbnailUrl(objectUrl);
                return;
              }
            }
          } catch (e) {
            console.error("DetailsModal: Thumbnail decryption failed", e);
          }

        } catch (error) {
          console.error("DetailsModal: Error loading thumbnail:", error);
        }
      } else {
        if (isMounted) setThumbnailUrl(null);
      }
    }

    loadThumbnail();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }, [open, itemId, itemDetails, itemType]);

  const loadItemDetailsAndVerify = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true)
        setSignatureStatus(null)
      }

      let response
      if (itemType === "file") {
        response = await apiClient.getFileInfo(itemId)
      } else if (itemType === "paper") {
        response = await apiClient.getPaper(itemId)
      } else {
        response = await apiClient.getFolderInfo(itemId)
      }

      if (response.success && response.data) {
        let details: ItemDetails | null = null;
        if (itemType === "file") {
          details = (response.data as any).file as ItemDetails;
        } else if (itemType === "paper") {
          const p = response.data as any;
          details = {
            id: p.id,
            encryptedFilename: p.encryptedTitle,
            nameSalt: p.titleSalt,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            parentId: p.folderId,
            mimetype: 'application/x-paper',
            size: 0 // Papers are small metadata
          } as ItemDetails;
        } else {
          details = ((response.data as any).folder as ItemDetails) || (response.data as ItemDetails);
        }
        setItemDetails(details)
      }

      if (silent) return;

      let verifyResponse
      if (itemType === "file") {
        verifyResponse = await apiClient.verifyFileSignature(itemId)
      } else {
        verifyResponse = await apiClient.verifyFolderSignature(itemId)
      }

      if (verifyResponse.success) {
        const status = verifyResponse.data?.status || "unknown"
        if (verifyResponse.data?.verified) {
          setSignatureStatus({
            verified: true,
            signerEmail: verifyResponse.data?.signer?.email || "Unknown",
            status: status
          })
        } else {
          setSignatureStatus({
            verified: false,
            error: verifyResponse.data?.message || "Verification failed",
            status: status
          })
        }
      } else {
        setSignatureStatus({
          verified: false,
          error: verifyResponse.error || "Unable to verify signature",
          status: "error"
        })
      }
    } catch (error) {
      console.error("Failed to load details or verify:", error)
      if (!silent) {
        setSignatureStatus({
          verified: false,
          error: "Verification failed",
          status: "error"
        })
      }
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  // Load available tags
  useEffect(() => {
    if (open) {
      fetchAvailableTags()
    }
  }, [open])

  const fetchAvailableTags = async () => {
    try {
      const response = await apiClient.getTags()
      if (response.success && response.data) {
        const masterKey = masterKeyManager.getMasterKey()
        const decryptedTags = await Promise.all(
          response.data.map(async (tag: Tag) => {
            try {
              const decrypted = await decryptFilename(tag.encrypted_name, tag.name_salt, masterKey)
              return { ...tag, decryptedName: decrypted }
            } catch {
              return { ...tag, decryptedName: "[Encrypted Tag]" }
            }
          })
        )
        setAvailableTags(decryptedTags)
      }
    } catch (error) {
      console.error("Failed to fetch available tags:", error)
    }
  }

  // Decrypt item tags
  useEffect(() => {
    const decryptItemTags = async () => {
      const rawTags = itemDetails?.tags as Tag[] || []
      const masterKey = masterKeyManager.getMasterKey()
      const decrypted = await Promise.all(
        rawTags.map(async (tag) => {
          try {
            const name = await decryptFilename(tag.encrypted_name, tag.name_salt, masterKey)
            return { ...tag, decryptedName: name }
          } catch {
            return { ...tag, decryptedName: "[Encrypted Tag]" }
          }
        })
      )
      setTags(decrypted)
    }
    if (itemDetails) {
      decryptItemTags()
    }
  }, [itemDetails])

  const handlePreview = () => {
    if (itemType === 'folder' || !itemId) return;

    if (itemType === 'paper') {
      router.push(`/paper?fileId=${itemId}`);
    } else {
      // Set the 'preview' URL param to trigger the FullPagePreviewModal in the parent
      const params = new URLSearchParams(searchParams.toString());
      params.set('preview', itemId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }

    // Close the details modal to avoid UI overlap
    setOpen(false);
  };

  const handleAddTag = async (tagName: string) => {
    const trimmed = tagName.trim()
    if (!trimmed) return

    if (trimmed.length < 2) {
      toast.error("Tag is too short (min 2 chars)")
      return
    }
    if (trimmed.length > 50) {
      toast.error("Tag is too long (max 50 chars)")
      return
    }
    if (tags.some(t => t.decryptedName?.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput("")
      return
    }

    if (isFreePlan && tags.length >= 5) {
      toast.error("Free plan is limited to 5 tags per item. Upgrade to a paid plan for unlimited tags!", {
        action: {
          label: "Upgrade",
          onClick: () => router.push('/pricing')
        }
      })
      return
    }

    setIsTagging(true)
    try {
      const masterKey = masterKeyManager.getMasterKey()
      const { encryptedFilename, filenameSalt } = await encryptFilename(trimmed, masterKey)

      const response = await apiClient.attachTag({
        [itemType === 'file' ? 'fileId' : 'folderId']: itemId,
        encryptedName: encryptedFilename,
        nameSalt: filenameSalt,
        color: 'slate' // Default color
      })

      if (response.success) {
        setTagInput("")
        loadItemDetailsAndVerify(true)
        fetchAvailableTags()
        onTagsUpdated?.()
      } else {
        toast.error(response.error || "Failed to attach tag")
      }
    } catch (error) {
      console.error("Failed to add tag:", error)
      toast.error("Encryption error while adding tag")
    } finally {
      setIsTagging(false)
    }
  }

  const handleAttachExistingTag = async (tag: Tag) => {
    if (tags.some(t => t.id === tag.id)) return;

    if (isFreePlan && tags.length >= 5) {
      toast.error("Free plan is limited to 5 tags per item. Upgrade to a paid plan for unlimited tags!", {
        action: {
          label: "Upgrade",
          onClick: () => router.push('/pricing')
        }
      })
      return
    }

    try {
      const response = await apiClient.attachTag({
        [itemType === 'file' ? 'fileId' : 'folderId']: itemId,
        encryptedName: tag.encrypted_name,
        nameSalt: tag.name_salt,
        color: tag.color || 'slate'
      })

      if (response.success) {
        loadItemDetailsAndVerify(true)
        fetchAvailableTags()
        onTagsUpdated?.()
      } else {
        toast.error(response.error || "Failed to attach tag")
      }
    } catch (error) {
      console.error("Failed to attach existing tag:", error)
      toast.error("Failed to attach tag")
    }
  }

  const handleDetachTag = async (tagId: string, tagName: string) => {
    try {
      const response = await apiClient.detachTag(tagId, {
        [itemType === 'file' ? 'fileId' : 'folderId']: itemId
      })
      if (response.success) {
        loadItemDetailsAndVerify(true)
        onTagsUpdated?.()
      } else {
        toast.error(response.error || "Failed to remove tag")
      }
    } catch (error) {
      console.error("Failed to detach tag:", error)
    }
  }

  const handleTagClick = (tagName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', `#${tagName}`);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  const copyToClipboard = (text: string, hashId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHashId(hashId)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedHashId(null), 2000)
  }

  const downloadAsJSON = () => {
    try {
      const verifyResponse = {
        itemDetails,
        signatureVerification: signatureStatus,
        timestamp: new Date().toISOString(),
        itemType,
        itemId
      };
      const jsonData = JSON.stringify(verifyResponse, null, 2)
      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${itemName}-verification-details.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Downloaded verification details")
    } catch {
      toast.error("Failed to download verification details")
    }
  }


  const truncateMiddle = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    const half = Math.floor(maxLength / 2);
    return text.substring(0, half - 1) + "..." + text.substring(text.length - half + 1);
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
      ) : (
        children
      )}
      <SheetContent side="right" aria-describedby="details-modal-description" className={`${isMobile ? 'w-full sm:max-w-md' : 'sm:max-w-md'} flex flex-col p-0`}>
        <SheetTitle className="sr-only">Details for {itemName}</SheetTitle>
        <SheetDescription id="details-modal-description" className="sr-only">
          Details for {itemType} {itemName}
        </SheetDescription>

        {/* Sticky Header Zone */}
        <div className="flex-shrink-0 z-10 bg-background pt-4 px-6 pb-0 relative">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-2 mb-2 pr-8">
              <div className="text-primary">
                <IconInfoCircle className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-muted-foreground uppercase leading-none mt-0.5">
                Item Properties
              </span>
            </div>
            <Separator className="opacity-50" />
          </SheetHeader>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading details...</span>
            </div>
          </div>
        ) : itemDetails ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-none pt-4">
              <div className="space-y-6">

                {/* Preview Area */}
                <div className="px-6 flex flex-col items-center justify-center py-4">
                  <div
                    className="rounded-2xl bg-white dark:bg-zinc-900 border shadow-sm flex items-center justify-center mb-4 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all group"
                    style={{
                      width: itemDetails?.width && itemDetails?.height
                        ? (itemDetails.width > itemDetails.height ? '160px' : (itemDetails.width < itemDetails.height ? '96px' : '128px'))
                        : '128px',
                      height: itemDetails?.width && itemDetails?.height
                        ? (itemDetails.width > itemDetails.height ? '90px' : (itemDetails.width < itemDetails.height ? '128px' : '128px'))
                        : '128px',
                    }}
                    onClick={handlePreview}
                  >
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    ) : (
                      <div className="flex w-full h-full items-center justify-center">
                        {itemType === "file" ? (
                          <IconFile className="h-10 w-10 text-muted-foreground opacity-20" />
                        ) : (
                          <IconFolder className="h-10 w-10 text-muted-foreground opacity-20" />
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-center break-all px-4 line-clamp-2">
                    {decryptedFilename || itemName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    {itemType === "file" ? (
                      <>
                        <span className="font-medium text-foreground">{itemDetails.mimetype || 'File'}</span>
                        <span className="opacity-30">•</span>
                        <span>{itemDetails.size ? formatBytes(itemDetails.size) : '0 B'}</span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">Folder</span>
                    )}
                  </p>
                </div>

                <div className="px-6 space-y-6">
                  {/* Tags Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 w-full">
                        <IconTag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Tags</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[10px] text-muted-foreground mr-1">Who can see my tags?</span>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground transition-colors outline-none focus:ring-1 ring-ring rounded-full">
                                  <IconInfoCircle className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-[200px] text-xs">
                                Tags are <b>end-to-end encrypted</b>. Only you and users with access to this file can see or edit these tags.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap gap-1.5 min-h-[2.5rem] p-2 rounded-lg border bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all cursor-text items-center"
                      onClick={() => {
                        if (!openCombobox) setOpenCombobox(true);
                      }}
                    >
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="pl-2 pr-1 h-7 flex items-center gap-1 hover:bg-muted cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTagClick(tag.decryptedName || "")
                          }}
                        >
                          <span className="max-w-[100px] truncate state-text-muted-foreground"># {tag.decryptedName}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDetachTag(tag.id, tag.decryptedName || "");
                            }}
                            className="p-0.5 hover:bg-muted-foreground/20 rounded-full transition-colors opacity-60 hover:opacity-100"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}

                      <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            role="combobox"
                            aria-expanded={openCombobox}
                            className="h-7 border-none bg-transparent hover:bg-muted/50 p-2 text-xs font-normal text-muted-foreground min-w-[2px] px-1 flex-grow justify-start"
                          >
                            {tags.length === 0 && !openCombobox && "Add tags..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search or create tag..."
                              value={tagInput}
                              onValueChange={setTagInput}
                            />
                            <CommandList>
                              {!tagInput && (
                                <div className="py-6 text-center text-xs text-muted-foreground px-2">
                                  <p>Use words that will help you or teammates find this file.</p>
                                </div>
                              )}

                              {tagInput && availableTags.length === 0 && (
                                <CommandEmpty>No matching tags found.</CommandEmpty>
                              )}

                              {availableTags.length > 0 && (
                                <CommandGroup heading="Suggestions">
                                  {availableTags
                                    .filter((t) => !tags.some((existing) => existing.id === t.id))
                                    .filter((t) => !tagInput || t.decryptedName?.toLowerCase().includes(tagInput.toLowerCase()))
                                    .slice(0, 5)
                                    .map((tag) => (
                                      <CommandItem
                                        key={tag.id}
                                        value={tag.decryptedName || ""}
                                        onSelect={() => {
                                          handleAttachExistingTag(tag)
                                          setTagInput("")
                                          setOpenCombobox(false)
                                        }}
                                        className="text-xs"
                                      >
                                        <IconTag className="mr-2 h-3 w-3 opacity-50" />
                                        # {tag.decryptedName}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              )}

                              {tagInput && (
                                <>
                                  <CommandSeparator />
                                  <CommandGroup>
                                    <CommandItem
                                      value={`create:${tagInput}`}
                                      onSelect={() => {
                                        handleAddTag(tagInput)
                                        setTagInput("")
                                        setOpenCombobox(false)
                                      }}
                                      className="text-xs"
                                    >
                                      <IconPlus className="mr-2 h-3 w-3" />
                                      Create tag &quot;# {tagInput}&quot;
                                    </CommandItem>
                                  </CommandGroup>
                                </>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <IconHistory className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Properties</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 bg-muted/10 p-4 rounded-xl border border-border/50">
                      {/* Name */}
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-xs text-muted-foreground">Full Name</span>
                        <span className="text-xs font-medium text-right break-all max-w-[200px]">
                          {decryptedFilename || itemName}
                        </span>
                      </div>

                      {/* Path */}
                      <div className="flex justify-between items-center gap-4 border-t border-border/50 pt-3">
                        <span className="text-xs text-muted-foreground">Location</span>
                        <span className="text-xs font-medium text-right">
                          {(() => {
                            // Explicit root case for folders
                            if (itemType === "folder" && (itemDetails.parentId === null || itemDetails.parentId === undefined)) return 'Root'
                            const p = decryptedPath || (itemDetails as any).path || null
                            return p ? <span title={String(p)} className="truncate max-w-full">{truncateMiddle(String(p), 60)}</span> : 'Root'
                          })()}
                        </span>
                      </div>

                      {/* ID */}
                      <div className="flex justify-between items-center gap-4 border-t border-border/50 pt-3 group">
                        <span className="text-xs text-muted-foreground">ID</span>
                        <button
                          onClick={() => copyToClipboard(itemId, "id")}
                          className="flex items-center gap-1.5 hover:text-primary transition-colors"
                        >
                          <span className="text-[10px] font-mono opacity-60">
                            {truncateMiddle(itemId, 16)}
                          </span>
                          {copiedHashId === "id" ? <IconCheck className="h-3 w-3 text-emerald-500" /> : <IconCopy className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
                        </button>
                      </div>

                      {/* Dates */}
                      <div className="flex justify-between items-center gap-4 border-t border-border/50 pt-3">
                        <span className="text-xs text-muted-foreground">Created</span>
                        <span className="text-xs font-medium text-right">{formatDate(itemDetails.created_at || itemDetails.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 border-t border-border/50 pt-3">
                        <span className="text-xs text-muted-foreground">Modified</span>
                        <span className="text-xs font-medium text-right">{formatDate(itemDetails.updatedAt || itemDetails.updated_at || itemDetails.createdAt || itemDetails.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Digital Integrity Section */}
                  <div className="space-y-4 pb-4">

                    {/* Fixed Digital Integrity Header Layout */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5">
                        <IconSignature className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Digital Integrity</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {signatureStatus?.verified && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 py-0 h-5">Verified</Badge>
                        )}
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground transition-colors outline-none focus:ring-1 ring-ring rounded-full">
                                <IconInfoCircle className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[260px] text-xs">
                              Verification ensures this file hasn&apos;t been <b>tampered</b> with since upload. The <b>signature</b> confirms the uploader&apos;s identity using <b>cryptographic keys</b>.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {/* End Fixed Digital Integrity Header */}

                    {signatureStatus && (
                      <div className={`p-4 rounded-xl border transition-colors ${signatureStatus.verified === true
                        ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                        : signatureStatus.status === "unsigned"
                          ? "border-border bg-muted/5"
                          : "border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
                        }`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-full ${signatureStatus.verified === true
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : signatureStatus.status === "unsigned"
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                            }`}>
                            {signatureStatus.verified === true ? <IconShieldCheck className="h-4 w-4 shrink-0" /> : <IconAlertCircle className="h-4 w-4 shrink-0" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold leading-tight">
                              {signatureStatus.verified === true ? "Cryptographic Proof Valid" : signatureStatus.status === "unsigned" ? "No Signature Attached" : "Verification Failed"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {signatureStatus.verified === true ? (
                                <>Signed by <span className="font-bold text-foreground">{signatureStatus.signerEmail}</span></>
                              ) : signatureStatus.status === "unsigned" ? (
                                "Zero-knowledge encryption active without signature."
                              ) : (
                                signatureStatus.error
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {itemType === "file" && itemDetails.sha_hash && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">File Digest (SHA-512)</p>
                        </div>
                        <div className="relative group">
                          <code className="block p-3 text-[10px] font-mono text-muted-foreground bg-muted/30 border rounded-lg break-all">
                            {itemDetails.sha_hash}
                          </code>
                          <button
                            onClick={() => itemDetails?.sha_hash && copyToClipboard(itemDetails.sha_hash, "hashsha")}
                            className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                          >
                            {copiedHashId === "hashsha" ? <IconCheck className="h-3 w-3 text-emerald-500" /> : <IconCopy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Governance Section */}
                  {(itemDetails.lockedUntil && new Date(itemDetails.lockedUntil) > new Date()) && (
                    <div className="space-y-4 pb-6">
                      <div className="flex items-center gap-1.5">
                        <IconLock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Governance</span>
                      </div>
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 scale-90">
                          <IconLock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-tighter">Retention Lock Active</p>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            Immutable until {formatDate(itemDetails.lockedUntil)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="p-6 border-t bg-background/50 backdrop-blur-md">
              <div className="flex gap-3">
                <Button
                  onClick={downloadAsJSON}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-medium shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
                >
                  <IconDownload className="h-4 w-4 mr-2" />
                  Audit Proof
                </Button>
                <Button
                  onClick={() => setOpen(false)}
                  variant="secondary"
                  className="px-6 h-11 rounded-xl font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-muted-foreground">No details found.</span>
          </div>
        )}

      </SheetContent>
    </Sheet>
  )
}
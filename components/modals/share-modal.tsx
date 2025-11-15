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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconUser,
  IconMail,
  IconX,
  IconCopy,
  IconCheck,
  IconSettings,
  IconLock,
  IconCalendar,
  IconDownload,
  IconLink,
  IconSend,
  IconPlus,
  IconMinus
} from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { keyManager } from "@/lib/key-manager"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { truncateFilename } from "@/lib/utils"

interface ShareModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onShareUpdate?: () => void
}

interface ShareSettings {
  password: string
  passwordEnabled: boolean
  expirationDate: Date | undefined
  maxDownloads: number
}

export function ShareModal({ children, itemId = "", itemName = "item", itemType = "file", open: externalOpen, onOpenChange: externalOnOpenChange, onShareUpdate }: ShareModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [emails, setEmails] = useState<string[]>([])
  const [emailError, setEmailError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [shareLink, setShareLink] = useState("")
  const [copied, setCopied] = useState(false)
  const [createPublicLink, setCreatePublicLink] = useState(false)
  const [existingShareId, setExistingShareId] = useState<string | null>(null)
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    password: "",
    passwordEnabled: false,
    expirationDate: undefined,
    maxDownloads: 0
  })

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
        maxDownloads: 0
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
        const existingShare = response.data.find(share =>
          share.fileId === itemId && !share.revoked
        )
        if (existingShare) {
          setExistingShareId(existingShare.id)

          // Automatically enable public link toggle and show existing link
          setCreatePublicLink(true)

          // Generate the existing share link
          const { masterKeyManager } = await import('@/lib/master-key')
          const accountSalt = masterKeyManager.getAccountSalt()
          if (accountSalt) {
            // Derive CEK deterministically from account salt and file ID
            const derivationInput = `share:${itemId}:${accountSalt}`
            const derivationBytes = new TextEncoder().encode(derivationInput)
            const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
            const shareCek = new Uint8Array(cekHash)
            const shareCekHex = btoa(String.fromCharCode(...shareCek))

            // Show existing share link with deterministically derived CEK in fragment
            const shareUrl = `https://drive.ellipticc.com/s/${existingShare.id}#${shareCekHex}`
            setShareLink(shareUrl)
          }
        } else {
          setExistingShareId(null)
        }
      }
    } catch (error) {
      setExistingShareId(null)
    } finally {
      setIsModalLoading(false)
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
    let shareId: string
    try {
      // Always create new share with proper E2EE envelope encryption
      // Generate CEK deterministically from user + file for consistent links
      const { masterKeyManager } = await import('@/lib/master-key')
      const accountSalt = masterKeyManager.getAccountSalt()
      if (!accountSalt) {
        throw new Error('Account salt not available for CEK derivation')
      }

      // Derive CEK deterministically from account salt and file ID
      const derivationInput = `share:${itemId}:${accountSalt}`
      const derivationBytes = new TextEncoder().encode(derivationInput)
      const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
      const shareCek = new Uint8Array(cekHash)
      const shareCekHex = btoa(String.fromCharCode(...shareCek))

      let saltPw = undefined
      let finalShareCekHex = shareCekHex

      if (shareSettings.passwordEnabled) {
        // Generate salt for password key derivation (32 bytes for PBKDF2)
        const salt = crypto.getRandomValues(new Uint8Array(32))
        const saltB64 = btoa(String.fromCharCode(...salt))

        // Derive key from password using PBKDF2
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(shareSettings.password),
          'PBKDF2',
          false,
          ['deriveKey']
        )
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
          ['wrapKey']
        )

        // Encrypt share CEK with password-derived key using XChaCha20-Poly1305
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js')
        const encryptionKey = new Uint8Array(
          await crypto.subtle.exportKey('raw', passwordKey)
        )
        // Ensure we have exactly 32 bytes for XChaCha20
        const xchachaKey = encryptionKey.slice(0, 32)
        const nonce = crypto.getRandomValues(new Uint8Array(24))

        const xchaCiphertext = xchacha20poly1305(xchachaKey, nonce).encrypt(shareCek)
        const nonceB64 = btoa(String.fromCharCode(...nonce))
        const ciphertextB64 = btoa(String.fromCharCode(...xchaCiphertext))

        // Store salt:nonce:encryptedCek in salt_pw
        saltPw = saltB64 + ':' + nonceB64 + ':' + ciphertextB64

        // Don't put CEK in URL for password-protected shares
        finalShareCekHex = ''
      }

      // Get the file/folder's wrapped CEK from the database and unwrap it
      const infoResponse = itemType === 'folder' 
        ? await apiClient.getFolderInfo(itemId)
        : await apiClient.getFileInfo(itemId)
      
      if (!infoResponse.success || !infoResponse.data) {
        throw new Error(`Failed to get ${itemType} encryption info`)
      }

      const itemData = infoResponse.data[itemType === 'folder' ? 'folder' : 'file'] || infoResponse.data
      if (!itemData.wrapped_cek || !itemData.nonce_wrap_kyber) {
        throw new Error(`${itemType} encryption info not available`)
      }

      // Get user keys to unwrap the file's CEK
      const userKeys = await keyManager.getUserKeys()

      // Unwrap the file's CEK using Kyber decapsulation
      const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js')
      const { decryptData, hexToUint8Array } = await import('@/lib/crypto')

      // First, get the Kyber shared secret
      const kyberCiphertext = hexToUint8Array(itemData.kyber_ciphertext)
      const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys.keypairs.kyberPrivateKey)

      // Decrypt the file's CEK
      const fileCek = decryptData(itemData.wrapped_cek, new Uint8Array(sharedSecret), itemData.nonce_wrap_kyber)

      // Now encrypt the file/folder's CEK with the share CEK (envelope encryption)
      const { encryptData } = await import('@/lib/crypto')
      const envelopeEncryption = encryptData(fileCek, shareCek)
      const wrappedFileCek = envelopeEncryption.encryptedData
      const envelopeNonce = envelopeEncryption.nonce

      // Encrypt the filename with the share CEK for E2EE filename decryption on share page
      const filenameBytes = new TextEncoder().encode(itemName)
      const filenameEncryption = encryptData(filenameBytes, shareCek)
      const encryptedFilename = filenameEncryption.encryptedData
      const filenameNonce = filenameEncryption.nonce

      // Create share with envelope-encrypted CEK and encrypted filename
      const response = await apiClient.createShare({
        [itemType === 'folder' ? 'folder_id' : 'file_id']: itemId,
        wrapped_cek: wrappedFileCek, // Envelope-encrypted file CEK
        nonce_wrap: envelopeNonce,  // Nonce for envelope encryption
        has_password: shareSettings.passwordEnabled,
        salt_pw: shareSettings.passwordEnabled ? saltPw : undefined,
        encrypted_filename: encryptedFilename, // Filename encrypted with share CEK
        nonce_filename: filenameNonce, // Nonce for filename encryption
        expires_at: shareSettings.expirationDate?.toISOString(),
        max_views: shareSettings.maxDownloads || undefined,
        permissions: 'read'
      })

      if (!response.success || !response.data?.id) {
        throw new Error(response.error || "Failed to create share")
      }

      shareId = response.data.id
      setExistingShareId(shareId)

      // Construct share URL with share CEK in fragment (only for non-password shares)
      const shareUrl = `https://drive.ellipticc.com/s/${shareId}${finalShareCekHex ? '#' + finalShareCekHex : ''}`

      // Send emails with the CEK-embedded URL
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
      // console.error("Failed to share item:", error)
      toast.error(`Failed to share ${itemType}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePublicLink = async () => {
    if (!createPublicLink) return

    setIsLoading(true)
    try {
      // First check if there's already a share for this item
      const mySharesResponse = await apiClient.getMyShares()
      if (mySharesResponse.success && mySharesResponse.data) {
        const existingShare = mySharesResponse.data.find(share =>
          share.fileId === itemId && !share.revoked
        )

        if (existingShare) {
          // For existing shares, derive the CEK deterministically to get the exact same link
          // This ensures true E2EE while maintaining link consistency

          // Get user account salt for deterministic derivation
          const { masterKeyManager } = await import('@/lib/master-key')
          const accountSalt = masterKeyManager.getAccountSalt()
          if (!accountSalt) {
            throw new Error('Account salt not available for CEK derivation')
          }

          // Derive CEK deterministically from account salt and file ID
          // This ensures the same user sharing the same file always gets the same CEK
          const derivationInput = `share:${itemId}:${accountSalt}`
          const derivationBytes = new TextEncoder().encode(derivationInput)
          const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
          const shareCek = new Uint8Array(cekHash)
          const shareCekHex = btoa(String.fromCharCode(...shareCek))

          // Show existing share link with deterministically derived CEK in fragment
          const shareUrl = `https://drive.ellipticc.com/s/${existingShare.id}#${shareCekHex}`
          setShareLink(shareUrl)
          setExistingShareId(existingShare.id)
          toast.success("Using existing share link")
          setIsLoading(false)
          return
        }
      }

      // No existing share, create a new one with proper E2EE
      // Generate CEK deterministically from user + file for consistent links
      const { masterKeyManager } = await import('@/lib/master-key')
      const accountSalt = masterKeyManager.getAccountSalt()
      if (!accountSalt) {
        throw new Error('Account salt not available for CEK derivation')
      }

      // Derive CEK deterministically from account salt and item ID
      // This ensures the same user sharing the same item always gets the same CEK
      const derivationInput = `share:${itemId}:${accountSalt}`
      const derivationBytes = new TextEncoder().encode(derivationInput)
      const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes)
      const shareCek = new Uint8Array(cekHash)
      const shareCekHex = btoa(String.fromCharCode(...shareCek))

      let wrappedFileCek: string
      let envelopeNonce: string

      if (itemType === 'folder') {
        // For folder sharing, we don't need to unwrap any existing CEK
        // We just use the share CEK directly for envelope encryption
        const { encryptData } = await import('@/lib/crypto')
        const envelopeEncryption = encryptData(shareCek, shareCek) // Self-encrypt for consistency
        wrappedFileCek = envelopeEncryption.encryptedData
        envelopeNonce = envelopeEncryption.nonce
      } else {
        // For file sharing, get the file's wrapped CEK from the database and unwrap it
        const infoResponse = await apiClient.getFileInfo(itemId)
        
        if (!infoResponse.success || !infoResponse.data) {
          throw new Error(`Failed to get file encryption info`)
        }

        const itemData = infoResponse.data.file || infoResponse.data
        if (!itemData.wrapped_cek || !itemData.nonce_wrap_kyber) {
          throw new Error(`File encryption info not available`)
        }

        // Get user keys to unwrap the file's CEK
        const userKeys = await keyManager.getUserKeys()

        // Unwrap the file's CEK using Kyber decapsulation
        const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js')
        const { decryptData, hexToUint8Array } = await import('@/lib/crypto')

        // First, get the Kyber shared secret
        const kyberCiphertext = hexToUint8Array(itemData.kyber_ciphertext)
        const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys.keypairs.kyberPrivateKey)

        // Decrypt the file's CEK
        const fileCek = decryptData(itemData.wrapped_cek, new Uint8Array(sharedSecret), itemData.nonce_wrap_kyber)

        // Now encrypt the file's CEK with the share CEK (envelope encryption)
        const { encryptData } = await import('@/lib/crypto')
        const envelopeEncryption = encryptData(fileCek, shareCek)
        wrappedFileCek = envelopeEncryption.encryptedData
        envelopeNonce = envelopeEncryption.nonce
      }

      let saltPw = undefined
      let finalShareCekHex = shareCekHex

      if (shareSettings.passwordEnabled) {
        // Generate salt for password key derivation (32 bytes for PBKDF2)
        const salt = crypto.getRandomValues(new Uint8Array(32))
        const saltB64 = btoa(String.fromCharCode(...salt))

        // Derive key from password using PBKDF2
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(shareSettings.password),
          'PBKDF2',
          false,
          ['deriveKey']
        )
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
          ['wrapKey']
        )

        // Encrypt share CEK with password-derived key using XChaCha20-Poly1305
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js')
        const encryptionKey = new Uint8Array(
          await crypto.subtle.exportKey('raw', passwordKey)
        )
        // Ensure we have exactly 32 bytes for XChaCha20
        const xchachaKey = encryptionKey.slice(0, 32)
        const nonce = crypto.getRandomValues(new Uint8Array(24))

        const xchaCiphertext = xchacha20poly1305(xchachaKey, nonce).encrypt(shareCek)
        const nonceB64 = btoa(String.fromCharCode(...nonce))
        const ciphertextB64 = btoa(String.fromCharCode(...xchaCiphertext))

        // Store salt:nonce:encryptedCek in salt_pw
        saltPw = saltB64 + ':' + nonceB64 + ':' + ciphertextB64

        // Don't put CEK in URL for password-protected shares
        finalShareCekHex = ''
      }

      // Encrypt the filename with the share CEK for E2EE filename decryption on share page
      const { encryptData: encryptDataForFilename } = await import('@/lib/crypto')
      const filenameBytes = new TextEncoder().encode(itemName)
      const filenameEncryption = encryptDataForFilename(filenameBytes, shareCek)
      const encryptedFilename = filenameEncryption.encryptedData
      const filenameNonce = filenameEncryption.nonce

      // Create share with envelope-encrypted CEK
      const response = await apiClient.createShare({
        [itemType === 'folder' ? 'folder_id' : 'file_id']: itemId,
        wrapped_cek: wrappedFileCek, // Envelope-encrypted file CEK
        nonce_wrap: envelopeNonce,  // Nonce for envelope encryption
        has_password: shareSettings.passwordEnabled,
        salt_pw: saltPw,
        encrypted_filename: encryptedFilename, // Filename encrypted with share CEK
        nonce_filename: filenameNonce, // Nonce for filename encryption
        expires_at: shareSettings.expirationDate?.toISOString(),
        max_views: shareSettings.maxDownloads || undefined,
        permissions: 'read'
      })

      if (!response.success || !response.data?.id) {
        throw new Error(response.error || "Failed to create share")
      }

      const shareId = response.data.id
      setExistingShareId(shareId)

      // Construct the final share URL with share CEK in fragment for true E2EE (only for non-password)
      const shareUrl = `https://drive.ellipticc.com/s/${shareId}${finalShareCekHex ? '#' + finalShareCekHex : ''}`
      setShareLink(shareUrl)

      toast.success("Public link created successfully")
      onShareUpdate?.()

    } catch (error) {
      // console.error("Failed to create public link:", error)
      toast.error("Failed to create public link")
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
      toast.error("Failed to copy link")
    }
  }

  const handleSettingsChange = (key: keyof ShareSettings, value: any) => {
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
              <DialogTitle>Share "{truncateFilename(itemName)}"</DialogTitle>
              <DialogDescription>
                Invite people to view this {itemType}.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 p-0"
                disabled={isModalLoading}
              >
                <IconSettings className="h-4 w-4" />
              </Button>
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
              {emails.length} recipient{emails.length !== 1 ? 's' : ''} will receive an invitation to access "{itemName}"
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
            {/* Password Protection */}
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <IconLock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Password Protection</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="password-enabled"
                  checked={shareSettings.passwordEnabled}
                  onCheckedChange={(checked: boolean) => handleSettingsChange('passwordEnabled', checked)}
                />
                <Label htmlFor="password-enabled" className="text-sm">
                  Require password to access
                </Label>
              </div>
              {shareSettings.passwordEnabled && (
                <Input
                  type="password"
                  value={shareSettings.password}
                  onChange={(e) => handleSettingsChange('password', e.target.value)}
                  placeholder="Enter password"
                  className="text-sm animate-in slide-in-from-top-2 duration-200"
                />
              )}
            </div>

            <Separator />

            {/* Expiration Date */}
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Expiration</Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {shareSettings.expirationDate ? format(shareSettings.expirationDate, "PPP") : "No expiration"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shareSettings.expirationDate}
                    onSelect={(date) => handleSettingsChange('expirationDate', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Leave empty for no expiration
              </p>
            </div>

            <Separator />

            {/* Max Downloads */}
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <IconDownload className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Download Limit</Label>
              </div>
              <Input
                type="number"
                min="0"
                value={shareSettings.maxDownloads || ''}
                onChange={(e) => handleSettingsChange('maxDownloads', parseInt(e.target.value) || 0)}
                placeholder="Unlimited"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 for unlimited downloads
              </p>
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
      </Dialog>
    </>
  )
}

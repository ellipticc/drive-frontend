"use client"

import { useState, useEffect } from "react"
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
import { apiClient, PQCKeypairs, FileItem } from "@/lib/api"
import { createSignedFolderManifest, decryptUserPrivateKeys } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"
import { ConflictModal } from "@/components/modals/conflict-modal"
import { useLanguage } from "@/lib/i18n/language-context"

interface CreateFolderModalProps {
  children?: React.ReactNode
  parentId?: string | null
  onFolderCreated?: (folder?: FileItem) => void
}

interface UserData {
  id: string
  // metadata fields returned by the profile endpoint
  created_at?: string
  storage_region?: string
  storage_endpoint?: string
  crypto_version?: string
  api_version?: string

  crypto_keypairs: {
    accountSalt: string
    pqcKeypairs: {
      kyber: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
      x25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
      dilithium: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
      ed25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
    }
  }
} 

export function CreateFolderModal({ children, parentId = null, onFolderCreated, open: controlledOpen, onOpenChange: controlledOnOpenChange }: CreateFolderModalProps & { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t } = useLanguage()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen

  const [folderName, setFolderName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)

  // Conflict modal state for create folder
  const [isConflictOpen, setIsConflictOpen] = useState(false)
  const [conflictItem, setConflictItem] = useState<{ id: string; name: string; type: 'folder'; existingPath?: string; existingFileId?: string } | null>(null)

  // Fetch user data when modal opens
  useEffect(() => {
    if (open && !userData) {
      fetchUserData()
    }
  }, [open, userData])

  const fetchUserData = async () => {
    try {
      const response = await apiClient.getProfile()
      if (response.success && response.data?.user?.crypto_keypairs) {
        const cryptoKeys = response.data.user.crypto_keypairs as { accountSalt?: string; pqcKeypairs?: PQCKeypairs }

        // Check if user has incomplete crypto data (e.g., Google OAuth in setup phase)
        if (!cryptoKeys.pqcKeypairs || !cryptoKeys.accountSalt) {
          toast.error("Please complete your account setup before creating folders. Check your email for setup instructions.")
          setUserData(null)
          return
        }

        if (cryptoKeys.pqcKeypairs) {
          // Check if we have the new encryption scheme data
          const hasNewFormat = cryptoKeys.pqcKeypairs.kyber.encryptionKey &&
            cryptoKeys.pqcKeypairs.kyber.encryptionNonce &&
            cryptoKeys.pqcKeypairs.kyber.privateKeyNonce

          if (hasNewFormat) {
            setUserData({
              id: response.data.user.id,
              crypto_keypairs: {
                accountSalt: cryptoKeys.accountSalt,
                pqcKeypairs: cryptoKeys.pqcKeypairs
              }
            })
          } else {
            setUserData(null)
            toast.error("Encryption format not supported. Please update your account.")
          }
        }
      }
    } catch {
      // console.error("Failed to fetch user data:", error)
      toast.error("Failed to load user data")
    }
  }

  const handleCreate = async () => {
    if (!folderName.trim() || !userData) return

    // Check if master key is available
    if (!masterKeyManager.hasMasterKey()) {
      toast.error("Session expired. Please login again.")
      return
    }

    setIsLoading(true)
    try {
      // Decrypt user's private keys using cached master key
      const privateKeys = await decryptUserPrivateKeys(userData)

      // Create signed folder manifest
      const signedManifest = await createSignedFolderManifest(
        folderName.trim(),
        parentId,
        {
          ed25519PrivateKey: privateKeys.ed25519PrivateKey,
          ed25519PublicKey: privateKeys.ed25519PublicKey,
          dilithiumPrivateKey: privateKeys.dilithiumPrivateKey,
          dilithiumPublicKey: privateKeys.dilithiumPublicKey
        }
      )

      // Create folder via API
      const response = await apiClient.createFolder({
        parentId,
        ...signedManifest
      })

      if (response.success && response.data) {
        toast.success(t("files.folderCreated"))

        const newFolder: FileItem = {
          id: response.data.id,
          name: folderName.trim(),
          type: 'folder',
          parentId: response.data.parentId,
          path: response.data.path,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt,
          is_shared: false,
          is_starred: false
        }

        setFolderName("")
        setOpen(false)
        onFolderCreated?.(newFolder)
      } else {
        const isConflict = response.error?.toLowerCase().includes('409') || response.error?.toLowerCase().includes('conflict') || response.error?.toLowerCase().includes('already exists')
        if (isConflict) {
          // Show conflict modal to the user to decide: replace / keep both / ignore
          setConflictItem({ id: folderName, name: folderName, type: 'folder' })
          setIsConflictOpen(true)
        } else {
          toast.error(response.error || t("files.folderCreateFailed"))
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error("Failed to create folder:", errorMsg, error)
      toast.error(t("files.folderCreateFailed") + ": " + errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateConflictResolution = (resolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'>) => {
    // We only expect a single item here
    const resolution = Object.values(resolutions)[0]
    if (!conflictItem) {
      setIsConflictOpen(false)
      return
    }

    if (resolution === 'keepBoth') {
      // Suggest a unique name by appending (1), (2), ...
      const base = conflictItem.name
      const idx = 1
      const suggested = `${base} (${idx})`
      // We cannot access the full listing here easily — user can further adjust name
      setFolderName(suggested)
      setIsConflictOpen(false)
    } else if (resolution === 'replace') {
      // For now, ask user to delete the existing folder manually - backend didn't provide existing id here
      toast.error('Please delete the existing folder first then try creating again (or use rename to replace).')
      setIsConflictOpen(false)
    } else if (resolution === 'ignore') {
      // ignore
      setIsConflictOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && folderName.trim()) {
      handleCreate()
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset form when closing
      setFolderName("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("files.newFolderTitle")}</DialogTitle>
          <DialogDescription>
            {t("files.newFolderDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-name">{t("files.newFolderName")}</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => {
                let val = e.target.value
                if (val.length > 255) {
                  toast.error(t("files.nameLimit"))
                  val = val.slice(0, 255)
                }
                setFolderName(val)
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("files.folderNamePlaceholder")}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            {t("files.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!folderName.trim() || isLoading || !userData}
          >
            {isLoading ? t("files.creating") : t("files.newFolder")}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Conflict modal for create folder */}
      {conflictItem && (
        <ConflictModal
          isOpen={isConflictOpen}
          onClose={() => setIsConflictOpen(false)}
          conflicts={[{
            id: conflictItem.id,
            name: conflictItem.name,
            type: conflictItem.type,
            existingPath: conflictItem.existingPath || `/${conflictItem.name}`,
            newPath: `/${conflictItem.name}`
          }]}
          onResolve={handleCreateConflictResolution}
          operation="upload"
        />
      )}
    </Dialog>
  )
}

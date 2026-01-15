"use client"

import { useState, useRef, useEffect } from "react"
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
import { IconFile, IconFolder, IconEdit } from "@tabler/icons-react"
import { apiClient, PQCKeypairs } from "@/lib/api"
import { createSignedFolderManifest, createSignedFileManifest, decryptUserPrivateKeys } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"
import { truncateFilename } from "@/lib/utils"

interface RenameModalProps {
  children?: React.ReactNode
  itemName?: string
  initialName?: string
  itemType?: "file" | "folder"
  onRename?: (data: string | {
    manifestHash: string;
    manifestCreatedAt: number;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    algorithmVersion: string;
    nameHmac: string;
    encryptedFilename?: string;
    filenameSalt?: string;
    encryptedName?: string;
    nameSalt?: string;
    // Optional helper for frontend UX
    requestedName?: string;
  }) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
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

export function RenameModal({
  children,
  itemName = "example-file.pdf",
  initialName,
  itemType = "file",
  onRename,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: RenameModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [newName, setNewName] = useState(itemName)
  const [isLoading, setIsLoading] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [userDataLoaded, setUserDataLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use external state if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  const fetchUserData = async () => {
    if (userDataLoaded) return; // Don't fetch twice

    try {
      const response = await apiClient.getProfile()
      if (response.success && response.data?.user?.crypto_keypairs) {
        const cryptoKeys = response.data.user.crypto_keypairs as { accountSalt?: string; pqcKeypairs?: PQCKeypairs }
        // Check for both accountSalt and pqcKeypairs
        if (!cryptoKeys.pqcKeypairs || !cryptoKeys.accountSalt) {
          toast.error("Please complete your account setup before renaming. Check your email for setup instructions.")
          setUserData(null)
          setUserDataLoaded(true)
          return
        }

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
          setUserDataLoaded(true)
        } else {
          setUserData(null)
          setUserDataLoaded(true)
          toast.error("Encryption format not supported. Please update your account.")
        }
      }
    } catch {
      setUserDataLoaded(true)
      toast.error("Failed to load user data")
    }
  }

  // Automatically focus & select text when modal opens
  useEffect(() => {
    if (open) {
      const initial = (initialName !== undefined && initialName !== null) ? initialName : itemName
      setNewName(initial)
      // Fetch user data for both file and folder renaming (both need signing now)
      fetchUserData()
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [open, itemName, initialName])

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === itemName) {
      setOpen(false)
      return
    }

    setIsLoading(true)
    try {
      if (!userData) {
        toast.error("User data not loaded. Please try again.")
        return
      }

      // Check if master key is available
      if (!masterKeyManager.hasMasterKey()) {
        toast.error("Session expired. Please login again.")
        return
      }

      // Decrypt user's private keys using cached master key
      const privateKeys = await decryptUserPrivateKeys(userData)

      if (itemType === "folder") {
        // For folders, create signed manifest
        // Get the parent ID - for renaming, we keep the same parent
        // so we can pass null since the backend will preserve the current parentId
        const parentId = null;

        // Create signed folder manifest
        const signedManifest = await createSignedFolderManifest(
          newName.trim(),
          parentId,
          {
            ed25519PrivateKey: privateKeys.ed25519PrivateKey,
            ed25519PublicKey: privateKeys.ed25519PublicKey,
            dilithiumPrivateKey: privateKeys.dilithiumPrivateKey,
            dilithiumPublicKey: privateKeys.dilithiumPublicKey
          }
        )

        // Call the onRename callback with manifest data (include plain requested name for conflict handling)
        onRename?.({ ...signedManifest, requestedName: newName.trim() })
      } else {
        // For files, create signed file manifest
        // For file renaming, folderId is not needed in the manifest
        const folderId = null;

        // Create signed file manifest
        const signedManifest = await createSignedFileManifest(
          newName.trim(),
          folderId,
          {
            ed25519PrivateKey: privateKeys.ed25519PrivateKey,
            ed25519PublicKey: privateKeys.ed25519PublicKey,
            dilithiumPrivateKey: privateKeys.dilithiumPrivateKey,
            dilithiumPublicKey: privateKeys.dilithiumPublicKey
          }
        )

        // Call the onRename callback with manifest data (include plain requested name for conflict handling)
        onRename?.({ ...signedManifest, requestedName: newName.trim() })
      }

      setOpen(false)
    } catch {
      toast.error("Failed to rename item. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newName.trim() && newName.trim() !== itemName) {
      handleRename()
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      ) : (
        children
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconEdit className="h-5 w-5" />
            Rename {truncateFilename(itemName)}
          </DialogTitle>
          <DialogDescription>
            Enter a new name for this {itemType}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">New name</Label>
            <div className="flex items-center gap-2">
              {itemType === "file" ? (
                <IconFile className="h-4 w-4 text-muted-foreground" />
              ) : (
                <IconFolder className="h-4 w-4 text-muted-foreground" />
              )}
              <Input
                ref={inputRef}
                id="name"
                value={newName}
                onChange={(e) => {
                  let val = e.target.value
                  if (val.length > 255) {
                    toast.error("Name cannot exceed 255 characters")
                    val = val.slice(0, 255)
                  }
                  setNewName(val)
                }}
                onKeyDown={handleKeyDown}
                className="flex-1"
                autoFocus
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRename}
            disabled={!newName.trim() || newName.trim() === itemName || isLoading}
          >
            {isLoading ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

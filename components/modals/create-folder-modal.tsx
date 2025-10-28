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
import { IconFolderPlus } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { createSignedFolderManifest, decryptUserPrivateKeys } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"

interface CreateFolderModalProps {
  children?: React.ReactNode
  parentId?: string | null
  onFolderCreated?: () => void
}

interface UserData {
  id: string
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

export function CreateFolderModal({ children, parentId = null, onFolderCreated }: CreateFolderModalProps) {
  const [open, setOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)

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
        const cryptoKeys = response.data.user.crypto_keypairs
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
            // console.warn('⚠️ Backend is using old encryption format. Folder creation may fail until backend is updated.')
            // For now, set userData to null to prevent folder creation
            setUserData(null)
            toast.error("Encryption format not supported. Please update your account.")
          }
        }
      }
    } catch (error) {
      // console.error("Failed to fetch user data:", error)
      toast.error("Failed to load user data")
    }
  }

  const handleCreate = async () => {
    if (!folderName.trim() || !userData) return

    // Check if master key is available
    // console.log('🔐 Checking master key availability:', masterKeyManager.hasMasterKey());
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
        name: folderName.trim(),
        parentId,
        ...signedManifest
      })

      if (response.success) {
        toast.success("Folder created successfully")
        setFolderName("")
        setOpen(false)
        onFolderCreated?.()
      } else {
        toast.error(response.error || "Failed to create folder")
      }
    } catch (error) {
      // console.error("Failed to create folder:", error)
      toast.error("Failed to create folder. Please try again.")
    } finally {
      setIsLoading(false)
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
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <IconFolderPlus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for your new folder.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter folder name"
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!folderName.trim() || isLoading || !userData}
          >
            {isLoading ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

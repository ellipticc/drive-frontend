"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconSettings, IconLoader2, IconPencil, IconCheck } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { useTheme } from "next-themes"
import { getDiceBearAvatar } from "@/lib/avatar"
import { useUser } from "@/components/user-context"
import { getInitials } from "@/components/layout/navigation/nav-user"

interface SettingsModalProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SettingsModal({
  children,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: SettingsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const { user, refetch } = useUser()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Use external state if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // State management
  const [displayName, setDisplayName] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)
  const [dateTimePreference, setDateTimePreference] = useState("24h")

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Handle avatar click to open file picker
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // Handle avatar file selection and upload
  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB")
      return
    }

    setIsLoadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await apiClient.uploadAvatar(formData)

      if (uploadResponse.success && uploadResponse.data?.avatarUrl) {
        // Update the user's profile with the new avatar URL
        await apiClient.updateUserProfile({
          avatar: uploadResponse.data.avatarUrl
        })
        // Force refetch to update user data
        await refetch()
        toast.success("Avatar updated successfully!")
      } else {
        toast.error("Failed to upload avatar")
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast.error("Failed to upload avatar")
    } finally {
      setIsLoadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Handle display name save
  const handleSaveName = async () => {
    if (displayName === originalName) {
      setIsEditingName(false)
      return
    }

    if (!displayName.trim()) {
      toast.error("Display name cannot be empty")
      return
    }

    setIsSavingName(true)
    try {
      const response = await apiClient.updateUserProfile({
        name: displayName.trim()
      })

      if (response.success) {
        setOriginalName(displayName.trim())
        setIsEditingName(false)
        await refetch()
        toast.success("Display name updated!")
      } else {
        toast.error(response.error || "Failed to update display name")
      }
    } catch (error) {
      toast.error("Failed to update display name")
    } finally {
      setIsSavingName(false)
    }
  }

  // Handle display name cancel
  const handleCancelEdit = () => {
    setDisplayName(originalName)
    setIsEditingName(false)
  }

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    try {
      setIsLoadingAvatar(true)
      
      const response = await apiClient.updateUserProfile({
        avatar: ""
      })

      if (response.success) {
        await refetch()
        toast.success("Avatar removed successfully!")
      } else {
        toast.error("Failed to remove avatar")
      }
    } catch (error) {
      console.error('Avatar removal error:', error)
      toast.error("Failed to remove avatar")
    } finally {
      setIsLoadingAvatar(false)
    }
  }

  // Check if current avatar is a DiceBear avatar
  const isDiceBearAvatar = user?.avatar && user.avatar.includes('dicebear-api.com')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <DialogTrigger asChild>
          {children || (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <IconSettings className="h-4 w-4" />
            </Button>
          )}
        </DialogTrigger>
      ) : (
        children
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <IconSettings className="h-6 w-6" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Profile Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Profile</h3>
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="relative group">
                  <Avatar
                    className="h-24 w-24 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0"
                    onClick={handleAvatarClick}
                  >
                    <AvatarImage
                      src={user?.avatar || getDiceBearAvatar(user?.id || "user")}
                      alt="Profile"
                    />
                    <AvatarFallback className="text-lg">
                      {getInitials(displayName || "User")}
                    </AvatarFallback>
                  </Avatar>
                  {isLoadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <IconLoader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  {/* Remove avatar cross - only show for non-DiceBear avatars */}
                  {user?.avatar && !isDiceBearAvatar && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveAvatar()
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Remove avatar"
                    >
                      <span className="text-xs font-bold">✕</span>
                    </button>
                  )}
                </div>

                {/* Display Name Section */}
                <div className="flex-1 pt-2">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="display-name" className="text-sm font-medium">
                        Display name
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          ref={nameInputRef}
                          id="display-name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Enter your name"
                          readOnly={!isEditingName}
                          className={`flex-1 ${!isEditingName ? 'bg-muted cursor-pointer' : ''}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && isEditingName) handleSaveName()
                            if (e.key === 'Escape' && isEditingName) handleCancelEdit()
                          }}
                        />
                        {isEditingName ? (
                          <Button
                            size="sm"
                            onClick={handleSaveName}
                            disabled={isSavingName || displayName === originalName || !displayName.trim()}
                            className="h-9 w-9 p-0"
                          >
                            <IconCheck className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingName(true)}
                            className="h-9 w-9 p-0"
                            title="Edit display name"
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click the avatar to update your profile picture
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Appearance</h3>
            <div className="space-y-2">
              <Label htmlFor="theme-select" className="text-sm font-medium">
                Theme
              </Label>
              <Select value={theme || "system"} onValueChange={setTheme}>
                <SelectTrigger id="theme-select" className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme for the application.
              </p>
            </div>
          </div>

          {/* Date & Time Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Date & Time</h3>
            <div className="space-y-2">
              <Label htmlFor="datetime-select" className="text-sm font-medium">
                Time format
              </Label>
              <Select value={dateTimePreference} onValueChange={setDateTimePreference}>
                <SelectTrigger id="datetime-select" className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose how time is displayed throughout the application.
              </p>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
          disabled={isLoadingAvatar}
        />
      </DialogContent>
    </Dialog>
  )
}

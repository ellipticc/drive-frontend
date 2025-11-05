"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
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
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { IconUserCircle, IconBlur, IconClockHour4, IconSettings } from "@tabler/icons-react"
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use external state if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // User settings state
  const [userSettings, setUserSettings] = useState({
    name: "",
    avatar: ""
  })
  const [originalName, setOriginalName] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    dateFormat: "MM/DD/YYYY"
  })
  const [originalDateFormat, setOriginalDateFormat] = useState("MM/DD/YYYY")

  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingDateFormat, setIsSavingDateFormat] = useState(false)

  useEffect(() => {
    if (open && user) {
      loadSettings()
    }
  }, [open, user])

  const loadSettings = async () => {
    if (!user) return
    
    try {
      const name = user.name || ""
      setUserSettings({
        name: name,
        avatar: user.avatar || ""
      })
      setOriginalName(name)

      // Load date format from localStorage
      const savedDateFormat = localStorage.getItem('dateFormat') || "MM/DD/YYYY"
      setGeneralSettings({ dateFormat: savedDateFormat })
      setOriginalDateFormat(savedDateFormat)
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error("Failed to load settings")
    }
  }

  const handleUserSettingsUpdate = async () => {
    // Only send if name was actually changed
    if (userSettings.name === originalName) {
      setIsEditingName(false)
      toast.info("No changes to save")
      return
    }

    setIsSavingProfile(true)
    try {
      const response = await apiClient.updateUserProfile({
        name: userSettings.name,
        avatar: userSettings.avatar
      })

      if (response.success) {
        setOriginalName(userSettings.name)
        setIsEditingName(false)
        await refetch()
        toast.success("Profile updated successfully!")
      } else {
        toast.error(response.error || "Failed to update profile")
      }
    } catch (error) {
      toast.error("Failed to update profile")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleDateFormatUpdate = async () => {
    // Only send if format actually changed
    if (generalSettings.dateFormat === originalDateFormat) {
      toast.info("No changes to save")
      return
    }

    setIsSavingDateFormat(true)
    try {
      // Save to localStorage (in a real app, this would call an API)
      localStorage.setItem('dateFormat', generalSettings.dateFormat)
      setOriginalDateFormat(generalSettings.dateFormat)
      toast.success("Date format updated!")
    } catch (error) {
      toast.error("Failed to update date format")
    } finally {
      setIsSavingDateFormat(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

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

    setIsLoading(true)
    try {
      // Generate random 32-byte hex filename
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Upload to Backblaze
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', randomHex)

      const uploadResponse = await apiClient.uploadAvatar(formData)

      if (uploadResponse.success && uploadResponse.data?.avatarUrl) {
        // Update user profile with new avatar URL
        const updateResponse = await apiClient.updateUserProfile({
          name: userSettings.name,
          avatar: uploadResponse.data.avatarUrl
        })

        if (updateResponse.success) {
          setUserSettings(prev => ({ ...prev, avatar: uploadResponse.data?.avatarUrl || '' }))
          await refetch()
          toast.success("Avatar updated successfully!")
        } else {
          toast.error("Failed to update profile")
        }
      } else {
        toast.error("Failed to upload avatar")
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast.error("Failed to upload avatar")
    } finally {
      setIsLoading(false)
    }
  }

  const hasProfileChanges = userSettings.name !== originalName
  const hasDateFormatChanges = generalSettings.dateFormat !== originalDateFormat

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
          <DialogTitle className="flex items-center gap-2">
            <IconSettings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your profile, appearance, and preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <IconUserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <IconBlur className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="datetime" className="flex items-center gap-2">
              <IconClockHour4 className="h-4 w-4" />
              <span className="hidden sm:inline">Date & Time</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar
                  className="h-16 w-16 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={handleAvatarClick}
                >
                  <AvatarImage
                    src={userSettings.avatar || getDiceBearAvatar(user?.id || "user")}
                    alt="Profile"
                  />
                  <AvatarFallback className="text-sm">
                    {getInitials(userSettings.name || "User")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">Profile Picture</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Click to upload a new avatar
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAvatarClick}
                    disabled={isLoading}
                  >
                    {isLoading ? "Uploading..." : "Change Avatar"}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <Field>
                  <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="displayName"
                      value={userSettings.name}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your display name"
                      disabled={!isEditingName}
                      className="flex-1"
                    />
                    {!isEditingName ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingName(true)}
                      >
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUserSettings(prev => ({ ...prev, name: originalName }))
                            setIsEditingName(false)
                          }}
                          disabled={isSavingProfile}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUserSettingsUpdate}
                          disabled={!hasProfileChanges || isSavingProfile}
                        >
                          {isSavingProfile ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <FieldDescription>
                    This is how you'll appear to others on the platform.
                  </FieldDescription>
                </Field>
              </div>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-4">
              <Field>
                <FieldLabel>Theme</FieldLabel>
                <div className="flex gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="flex items-center gap-2"
                  >
                    <div className="w-4 h-4 rounded-full bg-white border border-gray-300"></div>
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="flex items-center gap-2"
                  >
                    <div className="w-4 h-4 rounded-full bg-gray-900 border border-gray-600"></div>
                    Dark
                  </Button>
                </div>
                <FieldDescription>
                  Choose your preferred theme for the application.
                </FieldDescription>
              </Field>
            </div>
          </TabsContent>

          {/* Date & Time Tab */}
          <TabsContent value="datetime" className="space-y-4">
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="dateFormat">Date Format</FieldLabel>
                <Select
                  value={generalSettings.dateFormat}
                  onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, dateFormat: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (European)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Choose how dates are formatted throughout the application.
                </FieldDescription>
                {hasDateFormatChanges && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={handleDateFormatUpdate}
                    disabled={isSavingDateFormat}
                  >
                    {isSavingDateFormat ? "Saving..." : "Save Format"}
                  </Button>
                )}
              </Field>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

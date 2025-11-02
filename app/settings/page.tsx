"use client"

import * as React from "react"
import { IconEdit, IconUserCircle, IconClockHour4, IconBlur } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { SiteHeader } from "@/components/layout/header/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { apiClient } from "@/lib/api"
import { useTheme } from "next-themes"
import { getDiceBearAvatar } from "@/lib/avatar"
import { getInitials } from "@/components/layout/navigation/nav-user"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [isLoading, setIsLoading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // User settings state
  const [userSettings, setUserSettings] = React.useState({
    name: "",
    avatar: ""
  })

  const [originalName, setOriginalName] = React.useState("")
  const [isEditingName, setIsEditingName] = React.useState(false)

  // General settings state
  const [generalSettings, setGeneralSettings] = React.useState({
    dateFormat: "MM/DD/YYYY"
  })

  React.useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const userData = await apiClient.getProfile()

      if (userData.success && userData.data?.user) {
        const user = userData.data.user
        const name = user.name || ""
        setUserSettings({
          name: name,
          avatar: user.avatar || ""
        })
        setOriginalName(name)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error("Failed to load settings")
    }
  }

  const handleUserSettingsUpdate = async () => {
    // Only send if name was actually changed
    if (userSettings.name === originalName) {
      setIsEditingName(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await apiClient.updateUserProfile({
        name: userSettings.name,
        avatar: userSettings.avatar
      })

      if (response.success) {
        setOriginalName(userSettings.name)
        setIsEditingName(false)
        toast.success("Profile updated successfully!")
      } else {
        toast.error(response.error || "Failed to update profile")
      }
    } catch (error) {
      toast.error("Failed to update profile")
    } finally {
      setIsLoading(false)
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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader pageTitle="Settings" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 max-w-4xl mx-auto w-full">
        {/* User Profile Section */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <IconUserCircle className="h-4 w-4" />
              Profile
            </CardTitle>
            <CardDescription>
              Update your personal information and profile picture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Display Name + Avatar on same line */}
            <div className="flex items-center gap-4">
              <Avatar
                className="h-12 w-12 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleAvatarClick}
              >
                <AvatarImage src={userSettings.avatar || getDiceBearAvatar("current-user")} alt="Profile" />
                <AvatarFallback className="text-sm">
                  {getInitials(userSettings.name || "User")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
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
                        <IconEdit className="h-4 w-4" />
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
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUserSettingsUpdate}
                          disabled={isLoading || userSettings.name === originalName}
                        >
                          {isLoading ? "Saving..." : "Save"}
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
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <IconBlur className="h-4 w-4" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the application looks and feels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Date & Time Section */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <IconClockHour4 className="h-4 w-4" />
              Date & Time
            </CardTitle>
            <CardDescription>
              Configure how dates and times are displayed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>

  {/* Hidden file input for avatar upload */}
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleAvatarChange}
  />
</SidebarInset>
</SidebarProvider>
)
}
"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  Globe,
  Home,
  Keyboard,
  Link,
  Lock,
  Menu,
  MessageCircle,
  Paintbrush,
  Settings,
  Video,
  User,
  Shield,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { IconSettings, IconLoader2, IconPencil, IconCheck, IconMail, IconLock, IconLogout, IconTrash } from "@tabler/icons-react"
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

const data = {
  nav: [
    { name: "General", icon: User, id: "general" },
    { name: "Security", icon: Shield, id: "security" },
  ],
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

  // Handle modal open/close with URL hash
  const handleOpenChange = (newOpen: boolean) => {
    const finalSetOpen = externalOnOpenChange || setInternalOpen
    finalSetOpen(newOpen)
    if (newOpen) {
      // Add #settings to URL when opening
      window.history.replaceState(null, '', '#settings')
    } else {
      // Remove #settings from URL when closing
      const url = new URL(window.location.href)
      url.hash = ''
      window.history.replaceState(null, '', url.pathname + url.search)
    }
  }

  // State management
  const [displayName, setDisplayName] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)
  const [dateTimePreference, setDateTimePreference] = useState("24h")

  // Tab state
  const [activeTab, setActiveTab] = useState("general")

  // Security state
  const [currentEmail, setCurrentEmail] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

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

  // Handle email change
  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("New email cannot be empty")
      return
    }

    if (newEmail === user?.email) {
      toast.error("New email must be different from current email")
      return
    }

    setIsChangingEmail(true)
    try {
      const response = await apiClient.updateUserProfile({
        email: newEmail.trim()
      })

      if (response.success) {
        setNewEmail("")
        await refetch()
        toast.success("Email updated successfully! Please check your new email for verification.")
      } else {
        toast.error(response.error || "Failed to update email")
      }
    } catch (error) {
      toast.error("Failed to update email")
    } finally {
      setIsChangingEmail(false)
    }
  }

  // Handle password change
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long")
      return
    }

    setIsChangingPassword(true)
    try {
      // For OPAQUE, password change is more complex and requires client-side OPAQUE operations
      // This is a placeholder - the actual implementation would need to integrate with OPAQUE
      toast.error("Password change requires OPAQUE protocol integration. Please use account recovery instead.")

      // Reset form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      toast.error("Failed to change password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Complete logout with full cleanup
  const completeLogout = async () => {
    try {
      // Call logout API
      await apiClient.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    }

    // Clear all local storage
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })
    }

    // Clear user context (this will trigger re-render)
    // The user context should handle clearing its own state
  }

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await completeLogout()
      toast.success("Logged out successfully")
      // Redirect to login page immediately
      window.location.href = '/login'
    } catch (error) {
      toast.error("Failed to logout")
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm account deletion")
      return
    }

    setIsDeletingAccount(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://drive.ellipticc.com/api/v1'}/auth/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiClient.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Complete cleanup
        await completeLogout()
        toast.success("Account deleted successfully")
        // Redirect to landing page
        window.location.href = '/'
      } else {
        toast.error(data.error || "Failed to delete account")
      }
    } catch (error) {
      toast.error("Failed to delete account")
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeleteConfirmation("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {data.nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeTab === item.id}
                        >
                          <button onClick={() => setActiveTab(item.id)}>
                            <item.icon />
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              {activeTab === "general" && (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">General</h2>
                    <div className="flex items-start gap-6">
                      {/* Avatar */}
                      <div className="relative group">
                        <Avatar
                          className="h-20 w-20 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0"
                          onClick={handleAvatarClick}
                        >
                          <AvatarImage
                            src={user?.avatar || getDiceBearAvatar(user?.id || "user")}
                            alt="Profile"
                          />
                          <AvatarFallback className="text-base">
                            {getInitials(displayName || "User")}
                          </AvatarFallback>
                        </Avatar>
                        {isLoadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                            <IconLoader2 className="h-5 w-5 animate-spin text-white" />
                          </div>
                        )}
                        {/* Remove avatar cross - only show for non-DiceBear avatars */}
                        {user?.avatar && !isDiceBearAvatar && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveAvatar()
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Remove avatar"
                          >
                            <span className="text-xs font-bold">×</span>
                          </button>
                        )}
                      </div>

                      {/* Display Name Section */}
                      <div className="flex-1 pt-1">
                        <div className="space-y-2">
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
                                placeholder={displayName || "Enter your name"}
                                readOnly={!isEditingName}
                                className={`flex-1 ${!isEditingName ? 'bg-muted cursor-not-allowed' : ''}`}
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
              )}

              {activeTab === "security" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Security</h2>

                  {/* Change Email Section */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconMail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Email Address</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailModal(true)}
                    >
                      Change
                    </Button>
                  </div>

                  {/* Change Password Section */}
                  <div className="flex items-center justify-between border-t pt-6">
                    <div className="flex items-center gap-3">
                      <IconLock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">••••••••</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Change
                    </Button>
                  </div>

                  {/* Account Actions Section */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Account Actions</h3>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full"
                      >
                        {isLoggingOut ? (
                          <>
                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                            Logging out...
                          </>
                        ) : (
                          <>
                            <IconLogout className="h-4 w-4 mr-2" />
                            Log Out
                          </>
                        )}
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full"
                      >
                        <IconTrash className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </SidebarProvider>

        {/* Email Change Modal */}
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Email Address</DialogTitle>
              <DialogDescription>
                Update your email address. You'll need to verify the new email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="modal-new-email">New Email</Label>
                <Input
                  id="modal-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter your new email address"
                />
              </div>
              <div>
                <Label htmlFor="modal-confirm-email">Confirm New Email</Label>
                <Input
                  id="modal-confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Confirm your new email address"
                />
              </div>
              <div>
                <Label htmlFor="modal-email-password">Current Password</Label>
                <Input
                  id="modal-email-password"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEmailModal(false)
                setNewEmail("")
                setConfirmEmail("")
                setEmailPassword("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!newEmail.trim() || !confirmEmail.trim() || !emailPassword.trim()) {
                    toast.error("All fields are required")
                    return
                  }
                  if (newEmail !== confirmEmail) {
                    toast.error("Email addresses do not match")
                    return
                  }
                  if (newEmail === user?.email) {
                    toast.error("New email must be different from current email")
                    return
                  }

                  setIsChangingEmail(true)
                  try {
                    const response = await apiClient.updateUserProfile({
                      email: newEmail.trim()
                    })

                    if (response.success) {
                      setShowEmailModal(false)
                      setNewEmail("")
                      setConfirmEmail("")
                      setEmailPassword("")
                      await refetch()
                      toast.success("Email successfully updated.")
                    } else {
                      toast.error(response.error || "Failed to update email")
                    }
                  } catch (error) {
                    toast.error("Failed to update email")
                  } finally {
                    setIsChangingEmail(false)
                  }
                }}
                disabled={isChangingEmail}
              >
                {isChangingEmail ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update Email"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Change Modal */}
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Update your password. Make sure it's strong and secure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="modal-current-password">Current Password</Label>
                <Input
                  id="modal-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
              <div>
                <Label htmlFor="modal-new-password">New Password</Label>
                <Input
                  id="modal-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                />
              </div>
              <div>
                <Label htmlFor="modal-confirm-password">Confirm New Password</Label>
                <Input
                  id="modal-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowPasswordModal(false)
                setCurrentPassword("")
                setNewPassword("")
                setConfirmPassword("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!currentPassword || !newPassword || !confirmPassword) {
                    toast.error("All fields are required")
                    return
                  }
                  if (newPassword !== confirmPassword) {
                    toast.error("New passwords do not match")
                    return
                  }
                  if (newPassword.length < 8) {
                    toast.error("New password must be at least 8 characters long")
                    return
                  }

                  setIsChangingPassword(true)
                  try {
                    // For OPAQUE, password change is more complex and requires client-side OPAQUE operations
                    // This is a placeholder - the actual implementation would need to integrate with OPAQUE
                    toast.error("Password change requires OPAQUE protocol integration. Please use account recovery instead.")

                    // Reset form
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                    setShowPasswordModal(false)
                  } catch (error) {
                    toast.error("Failed to change password")
                  } finally {
                    setIsChangingPassword(false)
                  }
                }}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Account Deletion Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">Permanently Delete Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-2">
                  Type "DELETE" to confirm
                </p>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowDeleteModal(false)
                setDeleteConfirmation("")
              }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmation !== "DELETE"}
              >
                {isDeletingAccount ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

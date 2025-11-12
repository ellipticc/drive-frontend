"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  User,
  Shield,
  Gift,
  Eye,
  EyeOff,
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
import { IconSettings, IconLoader2, IconPencil, IconCheck, IconMail, IconLock, IconLogout, IconTrash, IconUserCog, IconLockSquareRounded, IconGift, IconCopy, IconCheck as IconCheckmark  } from "@tabler/icons-react"
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
    { name: "General", icon: IconUserCog, id: "general" },
    { name: "Security", icon: IconLockSquareRounded, id: "security" },
    { name: "Referrals", icon: IconGift, id: "referrals" },
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
  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false)
  const [emailOTPCode, setEmailOTPCode] = useState("")
  const [isVerifyingEmailOTP, setIsVerifyingEmailOTP] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [isLoadingTOTP, setIsLoadingTOTP] = useState(false)
  const [showTOTPSetup, setShowTOTPSetup] = useState(false)
  const [showTOTPDisable, setShowTOTPDisable] = useState(false)
  const [totpSecret, setTotpSecret] = useState("")
  const [totpUri, setTotpUri] = useState("")
  const [totpQrCode, setTotpQrCode] = useState("")
  const [totpToken, setTotpToken] = useState("")
  const [disableToken, setDisableToken] = useState("")
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("")
  const [isVerifyingTOTP, setIsVerifyingTOTP] = useState(false)
  const [isDisablingTOTP, setIsDisablingTOTP] = useState(false)
  // Recovery codes state
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [showRecoveryCodesModal, setShowRecoveryCodesModal] = useState(false)
  const [isLoadingRecoveryCodes, setIsLoadingRecoveryCodes] = useState(false)

  // Recovery phrase state
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState("")
  const [showMnemonic, setShowMnemonic] = useState(false)

  // Referral state
  const [referralCode, setReferralCode] = useState("")
  const [referralLink, setReferralLink] = useState("")
  const [referralStats, setReferralStats] = useState<{
    totalReferrals: number
    completedReferrals: number
    totalEarningsMB: number
  } | null>(null)
  const [recentReferrals, setRecentReferrals] = useState<any[]>([])
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Load TOTP status when modal opens
  useEffect(() => {
    if (open) {
      loadTOTPStatus()
      loadReferralData()
    }
  }, [open])

  // Load TOTP status
  const loadTOTPStatus = async () => {
    try {
      const response = await apiClient.getTOTPStatus()
      if (response.success && response.data) {
        setTotpEnabled(response.data.enabled)
      }
    } catch (error) {
      console.error('Failed to load TOTP status:', error)
    }
  }

  // Load referral data
  const loadReferralData = async () => {
    setIsLoadingReferrals(true)
    try {
      const response = await apiClient.getReferralInfo()
      if (response.success && response.data) {
        setReferralCode(response.data.referralCode)
        setReferralLink(response.data.referralLink)
        setReferralStats(response.data.statistics)
        setRecentReferrals(response.data.recentReferrals || [])
      }
    } catch (error) {
      console.error('Failed to load referral data:', error)
    } finally {
      setIsLoadingReferrals(false)
    }
  }

  // Handle viewing recovery phrase
  const handleShowRecoveryPhrase = () => {
    const mnemonic = localStorage.getItem('recovery_mnemonic')
    if (mnemonic) {
      setRecoveryPhrase(mnemonic)
      setShowRecoveryPhrase(true)
    } else {
      toast.error("Recovery phrase not found. Please re-login to generate it.")
    }
  }

  // Handle exporting recovery phrase as text file
  const handleExportRecoveryPhrase = () => {
    if (!recoveryPhrase) {
      toast.error("Recovery phrase not found")
      return
    }

    const element = document.createElement('a')
    const file = new Blob([`Recovery Phrase\n\n${recoveryPhrase}\n\nKEEP THIS SAFE - Never share with anyone!`], { type: 'text/plain' })
    const unixTimestamp = Math.floor(Date.now() / 1000)
    const randomHex = Math.random().toString(16).slice(2, 8) // Random hex for uniqueness
    element.href = URL.createObjectURL(file)
    element.download = `recovery-phrase-${randomHex}-${unixTimestamp}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    toast.success("Recovery phrase exported!")
  }

  // Handle copying recovery phrase to clipboard
  const handleCopyRecoveryPhrase = async () => {
    if (!recoveryPhrase) {
      toast.error("Recovery phrase not found")
      return
    }

    try {
      await navigator.clipboard.writeText(recoveryPhrase)
      toast.success("Recovery phrase copied to clipboard!")
    } catch (error) {
      toast.error("Failed to copy recovery phrase")
    }
  }

  // Copy referral code to clipboard
  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedCode(true)
      toast.success("Referral code copied!")
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      toast.error("Failed to copy referral code")
    }
  }

  // Copy referral link to clipboard
  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      toast.success("Referral link copied!")
    } catch (error) {
      toast.error("Failed to copy referral link")
    }
  }

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

  // Handle email change - initiate OTP process
  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !confirmEmail.trim()) {
      toast.error("Please enter and confirm your new email")
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsChangingEmail(true)
    try {
      // Step 1: Initiate email change - sends OTP to new email
      const response = await apiClient.initiateEmailChange(newEmail.trim())

      if (response.success && response.data?.emailChangeToken) {
        // Store the token for OTP verification
        sessionStorage.setItem('emailChangeToken', response.data.emailChangeToken)
        sessionStorage.setItem('newEmail', newEmail.trim())
        
        toast.success("OTP sent to your new email address. Please check your inbox.")
        
        // Close the dialog and show OTP verification modal instead
        setShowEmailModal(false)
        setShowEmailOTPModal(true)
        
        // Reset form
        setNewEmail("")
        setConfirmEmail("")
      } else {
        toast.error(response.error || "Failed to initiate email change")
      }
    } catch (error) {
      console.error('Email change initiation error:', error)
      toast.error("Failed to initiate email change")
    } finally {
      setIsChangingEmail(false)
    }
  }

  // Handle email OTP verification
  const handleVerifyEmailOTP = async () => {
    if (!emailOTPCode.trim()) {
      toast.error("Please enter the OTP code")
      return
    }

    setIsVerifyingEmailOTP(true)
    try {
      const emailChangeToken = sessionStorage.getItem('emailChangeToken')
      if (!emailChangeToken) {
        toast.error("Email change session expired. Please try again.")
        return
      }

      const response = await apiClient.verifyEmailChange(emailChangeToken, emailOTPCode.trim())

      if (response.success) {
        toast.success("Email changed successfully!")
        
        // Clear session storage
        sessionStorage.removeItem('emailChangeToken')
        sessionStorage.removeItem('newEmail')
        
        // Refetch user data to update email
        await refetch()
        
        // Close OTP modal
        setShowEmailOTPModal(false)
        setEmailOTPCode("")
      } else {
        toast.error(response.error || "Invalid OTP code")
      }
    } catch (error) {
      console.error('Email OTP verification error:', error)
      toast.error("Failed to verify OTP")
    } finally {
      setIsVerifyingEmailOTP(false)
    }
  }

  // Handle password change with OPAQUE
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
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
      const { OPAQUERegistration } = await import("@/lib/opaque")
      
      // OPAQUE Step 1: Client creates registration request
      const opaqueReg = new OPAQUERegistration()
      const regStep1 = await opaqueReg.step1(newPassword)
      
      // OPAQUE Step 2: Server creates registration response
      const regStep2 = await opaqueReg.step2(user?.email || "", regStep1.registrationRequest)
      
      // OPAQUE Step 3: Client finalizes registration
      const regStep3 = await opaqueReg.step3(regStep2.registrationResponse)
      
      // Step 4: Send new OPAQUE password file to backend
      const response = await apiClient.changePassword({
        newOpaquePasswordFile: regStep3.registrationRecord
      })

      if (response.success) {
        toast.success("Password changed successfully!")
        
        // Reset form
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setShowPasswordModal(false)
      } else {
        toast.error(response.error || "Failed to change password")
      }
    } catch (error) {
      console.error('Password change error:', error)
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

  // Handle TOTP setup
  const handleTOTPSetup = async () => {
    setIsLoadingTOTP(true)
    try {
      const response = await apiClient.setupTOTP()
      console.log('TOTP Setup Response:', response)
      if (response.success && response.data) {
        console.log('Setting TOTP state:', {
          secret: response.data.secret,
          totpUri: response.data.totpUri,
          qrCode: response.data.qrCode ? 'present' : 'missing'
        })
        setTotpSecret(response.data.secret)
        setTotpUri(response.data.totpUri)
        setTotpQrCode(response.data.qrCode)
        setShowTOTPSetup(true)
      } else {
        toast.error("Failed to setup TOTP")
      }
    } catch (error) {
      console.error('TOTP Setup Error:', error)
      toast.error("Failed to setup TOTP")
    } finally {
      setIsLoadingTOTP(false)
    }
  }

  // Handle TOTP verification and enable
  const handleTOTPVerify = async () => {
    if (!totpToken.trim()) {
      toast.error("Please enter the TOTP token")
      return
    }

    setIsVerifyingTOTP(true)
    try {
      const response = await apiClient.verifyTOTPSetup(totpToken.trim())
      if (response.success && response.data) {
        setRecoveryCodes(response.data.recoveryCodes)
        setTotpEnabled(true)
        setShowTOTPSetup(false)
        setShowRecoveryCodesModal(true)
        toast.success("TOTP enabled successfully!")
        // Reset form
        setTotpToken("")
        setTotpSecret("")
        setTotpUri("")
        setTotpQrCode("")
      } else {
        toast.error("Invalid TOTP token")
      }
    } catch (error) {
      toast.error("Failed to verify TOTP token")
    } finally {
      setIsVerifyingTOTP(false)
    }
  }

  // Handle TOTP disable
  const handleTOTPDisable = async () => {
    if (!disableToken.trim() && !disableRecoveryCode.trim()) {
      toast.error("Please enter either a TOTP token or recovery code")
      return
    }

    if (disableToken && !/^\d{6}$/.test(disableToken)) {
      toast.error("TOTP token must be 6 digits")
      return
    }

    if (disableRecoveryCode && disableRecoveryCode.length !== 8) {
      toast.error("Recovery code must be 8 characters")
      return
    }

    setIsDisablingTOTP(true)
    try {
      const response = await apiClient.disableTOTP(disableToken || undefined, disableRecoveryCode || undefined)
      if (response.success) {
        setTotpEnabled(false)
        setShowTOTPDisable(false)
        setDisableToken("")
        setDisableRecoveryCode("")
        toast.success("TOTP disabled successfully")
        // Reload TOTP status to ensure UI is updated
        await loadTOTPStatus()
      } else {
        toast.error(response.error || "Failed to disable TOTP")
      }
    } catch (error) {
      toast.error("Failed to disable TOTP")
    } finally {
      setIsDisablingTOTP(false)
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

                  {/* Wallet User Notice */}
                  {(user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet') && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-blue-900 dark:text-blue-100">MetaMask Authentication</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            You are authenticated via MetaMask wallet. Email, password, and two-factor authentication settings are managed through your wallet and cannot be modified here.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                      disabled={user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
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
                      disabled={user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                    >
                      Change
                    </Button>
                  </div>

                  {/* TOTP Section */}
                  <div className="flex items-center justify-between border-t pt-6">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">
                          {totpEnabled ? "Enabled" : "Add an extra layer of security"}
                        </p>
                      </div>
                    </div>
                    {totpEnabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTOTPDisable(true)}
                        disabled={isLoadingTOTP || user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                      >
                        {isLoadingTOTP ? (
                          <>
                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          "Disable"
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTOTPSetup}
                        disabled={isLoadingTOTP || user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                      >
                        {isLoadingTOTP ? (
                          <>
                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                            Setting up...
                          </>
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Recovery Phrase Section */}
                  <div className="flex items-start justify-between border-t pt-6">
                    <div className="flex items-start gap-3 flex-1">
                      <IconLock className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <p className="font-medium">Recovery Phrase</p>
                        <p className="text-sm text-muted-foreground">
                          View and export your 12-word backup recovery phrase
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShowRecoveryPhrase}
                    >
                      View & Export
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

              {activeTab === "referrals" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Referral Program</h2>

                  {/* Referral Info Banner */}
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <IconGift className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-green-900 dark:text-green-100">Earn Free Storage</h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Invite friends and get 500MB of storage for each friend who signs up, verifies their email, and uploads a file. Maximum 10GB bonus (20 referrals).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Referral Code Section */}
                  {isLoadingReferrals ? (
                    <div className="flex justify-center py-6">
                      <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <Label className="text-sm font-medium">Your Referral Code</Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-3 bg-muted rounded font-mono text-sm border border-border">
                            {referralCode}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCopyReferralCode}
                            className="px-3"
                          >
                            {copiedCode ? (
                              <IconCheckmark className="h-4 w-4" />
                            ) : (
                              <IconCopy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Referral Link Section */}
                      <div className="space-y-4">
                        <Label className="text-sm font-medium">Your Referral Link</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={referralLink}
                            readOnly
                            className="flex-1 p-2 text-sm bg-muted rounded border border-border text-muted-foreground truncate"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCopyReferralLink}
                            className="px-3"
                          >
                            <IconCopy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Referral Stats */}
                      {referralStats && (
                        <div className="border-t pt-6 space-y-4">
                          <h3 className="text-lg font-semibold">Your Referral Stats</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold">{referralStats.completedReferrals}</p>
                              <p className="text-xs text-muted-foreground mt-1">Completed Referrals</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold">{referralStats.totalEarningsMB}</p>
                              <p className="text-xs text-muted-foreground mt-1">MB Earned</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold">{Math.round((referralStats.totalEarningsMB / 10240) * 100)}%</p>
                              <p className="text-xs text-muted-foreground mt-1">of 10GB Max</p>
                            </div>
                          </div>
                          <div className="pt-4 text-sm text-muted-foreground">
                            <p>You have {20 - referralStats.completedReferrals} referral slots remaining.</p>
                          </div>
                        </div>
                      )}

                      {/* Recent Referrals */}
                      {recentReferrals.length > 0 && (
                        <div className="border-t pt-6 space-y-4">
                          <h3 className="text-lg font-semibold">Recent Referrals</h3>
                          <div className="space-y-3 max-h-48 overflow-y-auto">
                            {recentReferrals.map((referral) => (
                              <div key={referral.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{referral.referredUser.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{referral.referredUser.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-medium px-2 py-1 rounded text-white ${
                                    referral.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                                  }`}>
                                    {referral.status === 'completed' ? '+500MB' : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
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

        {/* TOTP Setup Modal */}
        <Dialog open={showTOTPSetup} onOpenChange={setShowTOTPSetup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Scan the QR code with your authenticator app, then enter the 6-digit code to enable TOTP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {totpQrCode && (
                <div className="flex justify-center">
                  <img src={totpQrCode} alt="TOTP QR Code" className="max-w-full h-auto" />
                </div>
              )}
              {totpSecret && (
                <div className="space-y-2">
                  <Label>Manual Entry Code</Label>
                  <code className="block p-2 bg-muted rounded font-mono text-sm break-all">
                    {totpSecret}
                  </code>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="setup-totp-token">Enter 6-digit code</Label>
                <Input
                  id="setup-totp-token"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowTOTPSetup(false)
                setTotpSecret("")
                setTotpUri("")
                setTotpQrCode("")
                setTotpToken("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleTOTPVerify}
                disabled={isVerifyingTOTP || totpToken.length !== 6}
              >
                {isVerifyingTOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Enable TOTP"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* TOTP Disable Modal */}
        <Dialog open={showTOTPDisable} onOpenChange={setShowTOTPDisable}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Enter your 6-digit authenticator code or a recovery code to disable TOTP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disable-totp-token">6-digit Authenticator Code</Label>
                <Input
                  id="disable-totp-token"
                  value={disableToken}
                  onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg font-mono"
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">OR</div>
              <div className="space-y-2">
                <Label htmlFor="disable-recovery-code">Recovery Code</Label>
                <Input
                  id="disable-recovery-code"
                  value={disableRecoveryCode}
                  onChange={(e) => setDisableRecoveryCode(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  className="text-center text-lg font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTOTPDisable(false)
                  setDisableToken("")
                  setDisableRecoveryCode("")
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleTOTPDisable}
                disabled={isDisablingTOTP || (!disableToken && !disableRecoveryCode)}
              >
                {isDisablingTOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Disabling...
                  </>
                ) : (
                  "Disable TOTP"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email OTP Verification Modal */}
        <Dialog open={showEmailOTPModal} onOpenChange={setShowEmailOTPModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Verify Your New Email</DialogTitle>
              <DialogDescription>
                We've sent a 6-digit code to your new email address. Please enter it to complete the email change.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Check your inbox:</strong> {sessionStorage.getItem('newEmail')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-otp-code">Verification Code</Label>
                <Input
                  id="email-otp-code"
                  type="text"
                  value={emailOTPCode}
                  onChange={(e) => setEmailOTPCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg font-mono tracking-widest"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Code expires in 15 minutes
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailOTPModal(false)
                  setEmailOTPCode("")
                  sessionStorage.removeItem('emailChangeToken')
                  sessionStorage.removeItem('newEmail')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyEmailOTP}
                disabled={isVerifyingEmailOTP || emailOTPCode.length !== 6}
              >
                {isVerifyingEmailOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recovery Codes Modal */}
        <Dialog open={showRecoveryCodesModal} onOpenChange={setShowRecoveryCodesModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Your Recovery Codes</DialogTitle>
              <DialogDescription>
                These codes can be used to access your account if you lose your authenticator device. Keep them safe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Important:</strong> Each code can only be used once. Store these codes securely and treat them like passwords.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {recoveryCodes.map((code, index) => (
                  <code key={index} className="block p-2 bg-muted rounded font-mono text-sm text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  // Download recovery codes
                  const codesText = recoveryCodes.join('\n')
                  const blob = new Blob([codesText], { type: 'text/plain' })
                  const unixTimestamp = Math.floor(Date.now() / 1000)
                  const randomHex = Math.random().toString(16).slice(2, 8) // Random hex for uniqueness
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `recovery-codes-${randomHex}-${unixTimestamp}.txt`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                  setShowRecoveryCodesModal(false)
                  setRecoveryCodes([])
                }}
              >
                Download Codes
              </Button>
              <Button
                onClick={() => {
                  setShowRecoveryCodesModal(false)
                  setRecoveryCodes([])
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recovery Phrase Modal */}
        <Dialog open={showRecoveryPhrase} onOpenChange={setShowRecoveryPhrase}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Your Recovery Phrase</DialogTitle>
              <DialogDescription>
                This 12-word phrase can be used to recover your account. Keep it safe and never share it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  <strong>⚠️ Warning:</strong> Anyone with this phrase can access your account. Never share it with anyone.
                </p>
              </div>
              <div className="relative p-4 bg-muted rounded-lg">
                <div className={`font-mono text-sm leading-relaxed ${!showMnemonic ? 'blur-sm' : ''}`}>
                  {recoveryPhrase}
                </div>
                {!showMnemonic && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMnemonic(true)}
                    className="absolute inset-0 w-full h-full flex items-center justify-center hover:bg-black/5"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Click to reveal
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopyRecoveryPhrase}
                className="flex-1"
              >
                <IconCopy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                onClick={handleExportRecoveryPhrase}
                className="flex-1"
              >
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRecoveryPhrase(false)
                  setShowMnemonic(false)
                }}
              >
                Close
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

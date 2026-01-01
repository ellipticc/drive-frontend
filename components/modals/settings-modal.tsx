"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from "sonner"
import Image from "next/image"
import {
  IconShield as Shield,
  IconRefresh as RotateCcwKeyIcon,
  IconUserShield as ShieldUser
} from "@tabler/icons-react"

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { IconSettings, IconLoader2, IconPencil, IconCheck, IconMail, IconLock, IconLogout, IconTrash, IconUserCog, IconLockSquareRounded, IconGift, IconCopy, IconCheck as IconCheckmark, IconBell, IconCoin, IconInfoCircle, IconRefresh, IconX, IconShieldLock, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { apiClient, Referral, Subscription, BillingUsage, PricingPlan, SubscriptionHistory } from "@/lib/api"
import { useTheme } from "next-themes"
import { getDiceBearAvatar } from "@/lib/avatar"
import { useUser } from "@/components/user-context"
import { getInitials } from "@/components/layout/navigation/nav-user"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { compressAvatar } from "@/lib/image"

interface SettingsModalProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialTab?: string
}

const data = {
  nav: [
    { name: "General", icon: IconUserCog, id: "general" },
    { name: "Security", icon: IconLockSquareRounded, id: "security" },
    { name: "Billing", icon: IconCoin, id: "billing" },
    { name: "Notifications", icon: IconBell, id: "notifications" },
    { name: "Referrals", icon: IconGift, id: "referrals" },
  ],
}

export function SettingsModal({
  children,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialTab,
}: SettingsModalProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false)
  const { user, refetch } = useUser()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { registerOnUploadComplete, unregisterOnUploadComplete } = useGlobalUpload()

  // Use external state if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen

  // Handle tab changes and update URL
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    // Update URL hash
    const tabPath = tabId.charAt(0).toUpperCase() + tabId.slice(1)
    window.history.replaceState(null, '', `#settings/${tabPath}`)
  }

  // Handle modal open/close
  const handleOpenChange = (newOpen: boolean) => {
    // Only update the state if provided
    const finalSetOpen = externalOnOpenChange || setInternalOpen
    finalSetOpen(newOpen)
  }

  // Handle hash changes to open modal and navigate to correct tab
  const handleHashChange = useCallback(() => {
    const hash = window.location.hash
    if (hash.startsWith('#settings')) {
      // Only open modal if it's not already open
      const finalSetOpen = externalOnOpenChange || setInternalOpen
      if (!open) {
        finalSetOpen(true)
      }

      // Navigate to the correct tab
      if (hash.includes('/')) {
        const tabFromHash = hash.replace('#settings/', '').toLowerCase()
        // Find the matching tab ID
        const matchingTab = data.nav.find(tab =>
          tab.name.toLowerCase() === tabFromHash || tab.id === tabFromHash
        )
        if (matchingTab) {
          setActiveTab(matchingTab.id)
        } else {
          // If no matching tab found, default to first tab
          setActiveTab(data.nav[0].id)
        }
      } else {
        // No tab specified, default to first tab
        setActiveTab(data.nav[0].id)
      }
    } else if (hash === '') {
      // Close modal when hash is cleared
      const finalSetOpen = externalOnOpenChange || setInternalOpen
      finalSetOpen(false)
    }
  }, [open, externalOnOpenChange])

  useEffect(() => {
    // Check initial hash on mount
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [handleHashChange])

  // State management
  const [displayName, setDisplayName] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)
  const [dateTimePreference, setDateTimePreference] = useState("24h")

  // Tab state - initialize from URL hash or initialTab prop
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL hash first
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash.startsWith('#settings/')) {
        const tabFromHash = hash.replace('#settings/', '')
        // Capitalize first letter to match our tab IDs
        return tabFromHash.charAt(0).toUpperCase() + tabFromHash.slice(1).toLowerCase()
      }
    }
    // Fall back to initialTab prop or default
    return initialTab || "general"
  })

  // Update activeTab when initialTab prop changes
  useEffect(() => {
    if (initialTab && !window.location.hash.startsWith('#settings/')) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // Security state
  const [newEmail, setNewEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false)
  const [emailOTPCode, setEmailOTPCode] = useState("")
  const [isVerifyingEmailOTP, setIsVerifyingEmailOTP] = useState(false)
  const [isResendingEmailOTP, setIsResendingEmailOTP] = useState(false)
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
  const [, setTotpUri] = useState("")
  const [totpQrCode, setTotpQrCode] = useState("")
  const [totpToken, setTotpToken] = useState("")
  const [disableToken, setDisableToken] = useState("")
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("")
  const [isVerifyingTOTP, setIsVerifyingTOTP] = useState(false)
  const [isDisablingTOTP, setIsDisablingTOTP] = useState(false)

  // Session management state
  const [sessionExpiry, setSessionExpiry] = useState("3600")
  const [userSessions, setUserSessions] = useState<any[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1)
  const [sessionsTotal, setSessionsTotal] = useState(0)

  // Recovery codes state
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [showRecoveryCodesModal, setShowRecoveryCodesModal] = useState(false)

  // Track which data has been loaded to prevent duplicate fetches
  const loadedRef = React.useRef(false)

  // Referral state
  const [referralCode, setReferralCode] = useState("")
  const [referralLink, setReferralLink] = useState("")
  const [copiedLink, setCopiedLink] = useState(false)
  const [referralStats, setReferralStats] = useState<{
    completedReferrals: number
    pendingReferrals: number
    totalEarningsMB: number
    currentBonusMB: number
    maxBonusMB: number
    maxReferrals: number
    totalReferralsCount: number
  } | null>(null)
  const [recentReferrals, setRecentReferrals] = useState<Referral[]>([])
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [referralsPage, setReferralsPage] = useState(1)
  const [referralsTotal, setReferralsTotal] = useState(0)

  // Billing state
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null)
  const [, setPricingPlans] = useState<PricingPlan[]>([])
  const [isLoadingBilling, setIsLoadingBilling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showCancelReasonDialog, setShowCancelReasonDialog] = useState(false)
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false)
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [cancelReason, setCancelReason] = useState<string>("")
  const [cancelReasonDetails, setCancelReasonDetails] = useState<string>("")
  const [isRedirectingToPortal, setIsRedirectingToPortal] = useState(false)
  const [subsPage, setSubsPage] = useState(1)
  const [subsTotalPages, setSubsTotalPages] = useState(1)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(1)

  // Notification preferences state
  const [inAppNotifications, setInAppNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loginNotifications, setLoginNotifications] = useState(true)
  const [fileShareNotifications, setFileShareNotifications] = useState(true)
  const [billingNotifications, setBillingNotifications] = useState(true)
  const [isLoadingNotificationPrefs, setIsLoadingNotificationPrefs] = useState(false)

  // Initialize display name from user data
  useEffect(() => {
    if (user) {
      // Use name if available, otherwise derive from email or empty string
      const nameToUse = user.name || (user.email ? user.email.split('@')[0] : "");
      setDisplayName(nameToUse);
      setOriginalName(nameToUse);
    }
  }, [user]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Register upload completion callback to refresh referral data
  useEffect(() => {
    const handleUploadComplete = () => {
      // Refresh referral data when any upload completes
      if (activeTab === "referrals") {
        loadReferralData()
      }
      // Refresh billing data when any upload completes (for usage updates)
      if (activeTab === "billing") {
        loadBillingData()
        loadSubscriptionHistory()
      }
    }

    registerOnUploadComplete(handleUploadComplete)

    return () => {
      unregisterOnUploadComplete(handleUploadComplete)
    }
  }, [activeTab, registerOnUploadComplete, unregisterOnUploadComplete])

  // Load data when modal opens (only once per session)
  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true
      loadTOTPStatus()
      loadReferralData(1)
      loadNotificationPreferences()
      loadSessionConfig()
      loadBillingData()
      loadSubscriptionHistory(1, 1)
      loadUserSessions(1)
    }
  }, [open])

  // Load sessions when switching to security tab
  useEffect(() => {
    if (activeTab === "security" && open) {
      loadUserSessions()
    }
  }, [activeTab, open])

  // Reset loaded state and form data when modal closes
  useEffect(() => {
    if (!open) {
      loadedRef.current = false

      // Reset Profile Edit
      setIsEditingName(false)
      setDisplayName("")
      setOriginalName("")

      // Reset Security Modals
      setNewEmail("")
      setConfirmEmail("")
      setEmailPassword("")
      setIsChangingEmail(false)
      setShowEmailModal(false)
      setShowEmailOTPModal(false)
      setEmailOTPCode("")
      setIsVerifyingEmailOTP(false)
      setIsResendingEmailOTP(false)

      setIsChangingPassword(false)
      setShowPasswordModal(false)

      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeleteConfirmation("")

      // Reset TOTP
      setShowTOTPSetup(false)
      setShowTOTPDisable(false)
      setTotpSecret("")
      setTotpQrCode("")
      setTotpToken("")
      setDisableToken("")
      setDisableRecoveryCode("")
      setIsVerifyingTOTP(false)
      setIsDisablingTOTP(false)

      // Reset Recovery Codes
      setShowRecoveryCodesModal(false)
      setRecoveryCodes([])

      // Reset Billing
      setShowCancelDialog(false)
      setShowCancelReasonDialog(false)
      setIsCancellingSubscription(false)
      setCancelReason("")
      setCancelReasonDetails("")
    }
  }, [open])

  // Load session configuration
  const loadSessionConfig = async () => {
    if (typeof window !== 'undefined') {
      // First try to fetch from backend API
      try {
        const response = await apiClient.getProfile()
        if (response.success && response.data?.user?.sessionDuration) {
          setSessionExpiry(response.data.user.sessionDuration.toString())
          // Also save to localStorage for offline access
          const sessionConfig = {
            sessionExpiry: response.data.user.sessionDuration,
            remindBeforeExpiry: 300
          }
          localStorage.setItem('session_config', JSON.stringify(sessionConfig))
          return
        }
      } catch (error) {
        console.error('Failed to fetch session duration from API:', error)
      }

      // Fallback to localStorage if API fails
      const stored = localStorage.getItem('session_config')
      if (stored) {
        try {
          const config = JSON.parse(stored)
          setSessionExpiry(config.sessionExpiry.toString())
        } catch (e) {
          console.error('Failed to parse stored session config:', e)
          setSessionExpiry('3600')
        }
      }
    }
  }

  // Load TOTP status
  const loadTOTPStatus = async () => {
    try {
      const response = await apiClient.getTOTPStatus()
      if (response.success && response.data) {
        setTotpEnabled(response.data.enabled)
      } else if (response.error) {
        // Log error but don't crash - default to disabled
        console.warn('Failed to load TOTP status:', response.error)
        setTotpEnabled(false)
      }
    } catch (error) {
      console.error('Failed to load TOTP status:', error)
      setTotpEnabled(false)
    }
  }

  // Load referral data
  const loadReferralData = async (page = referralsPage) => {
    setIsLoadingReferrals(true)
    try {
      const response = await apiClient.getReferralInfo(page, 5)
      if (response.success && response.data) {
        setReferralCode(response.data.referralCode)
        // Generate referral link from code
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        setReferralLink(`${baseUrl}/register?ref=${response.data.referralCode}`)
        setReferralStats(response.data.stats)
        setRecentReferrals(response.data.recentReferrals || [])
        setReferralsTotal(response.data.pagination?.total || 0)
        setReferralsPage(page)
      } else if (response.error) {
        // Log error but don't crash - set empty defaults
        console.warn('Failed to load referral data:', response.error)
        setReferralCode('')
        setReferralLink('')
        setReferralStats(null)
        setRecentReferrals([])
      }
    } catch (error) {
      console.error('Failed to load referral data:', error)
      setReferralCode('')
      setReferralLink('')
      setReferralStats(null)
      setRecentReferrals([])
    } finally {
      setIsLoadingReferrals(false)
    }
  }

  // Load billing data
  const loadBillingData = async () => {
    setIsLoadingBilling(true)
    try {
      // Load subscription status
      const subscriptionResponse = await apiClient.getSubscriptionStatus()
      if (subscriptionResponse.success && subscriptionResponse.data) {
        setSubscription(subscriptionResponse.data.subscription)
        setBillingUsage(subscriptionResponse.data.usage)
      } else {
        setSubscription(null)
        setBillingUsage(null)
      }

      // Load pricing plans
      const plansResponse = await apiClient.getPricingPlans()
      if (plansResponse.success && plansResponse.data) {
        setPricingPlans(plansResponse.data.plans || [])
      } else {
        setPricingPlans([])
      }
    } catch (error) {
      console.error('Failed to load billing data:', error)
      setSubscription(null)
      setBillingUsage(null)
      setPricingPlans([])
    } finally {
      setIsLoadingBilling(false)
    }
  }

  // Load subscription history
  const loadSubscriptionHistory = async (sPage = subsPage, iPage = invoicesPage) => {
    setIsLoadingHistory(true)
    try {
      const response = await apiClient.getSubscriptionHistory({
        subsPage: sPage,
        subsLimit: 5,
        invoicesPage: iPage,
        invoicesLimit: 5
      })
      if (response.success && response.data) {
        setSubscriptionHistory(response.data)
        setSubsTotalPages(response.data.pagination?.subs?.totalPages || 1)
        setInvoicesTotalPages(response.data.pagination?.invoices?.totalPages || 1)
        setSubsPage(sPage)
        setInvoicesPage(iPage)
      } else {
        setSubscriptionHistory(null)
      }
    } catch (error) {
      console.error('Failed to load subscription history:', error)
      setSubscriptionHistory(null)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Load notification preferences
  const loadNotificationPreferences = async () => {
    setIsLoadingNotificationPrefs(true)
    try {
      const response = await apiClient.getNotificationPreferences()
      if (response.success && response.data) {
        setInAppNotifications(response.data.inApp ?? true)
        setEmailNotifications(response.data.email ?? true)
        setLoginNotifications(response.data.login ?? true)
        setFileShareNotifications(response.data.fileShare ?? true)
        setBillingNotifications(response.data.billing ?? true)
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
      // Set defaults if API fails
      setInAppNotifications(true)
      setEmailNotifications(true)
      setLoginNotifications(true)
      setFileShareNotifications(true)
      setBillingNotifications(true)
    } finally {
      setIsLoadingNotificationPrefs(false)
    }
  }

  // Save notification preferences immediately with provided values (prevents stale closure)
  const saveNotificationPreferences = async (preferences?: {
    inApp?: boolean;
    email?: boolean;
    login?: boolean;
    fileShare?: boolean;
    billing?: boolean;
  }) => {
    try {
      // Use provided values or fall back to current state
      const preferencesToSave = {
        inApp: preferences?.inApp ?? inAppNotifications,
        email: preferences?.email ?? emailNotifications,
        login: preferences?.login ?? loginNotifications,
        fileShare: preferences?.fileShare ?? fileShareNotifications,
        billing: preferences?.billing ?? billingNotifications
      }

      const response = await apiClient.updateNotificationPreferences(preferencesToSave)
      if (response.success) {
        toast.success("Notification preferences updated!")
      } else {
        toast.error(response.error || "Failed to update notification preferences")
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
      toast.error("Failed to update notification preferences")
    }
  }



  // Load active sessions
  const loadUserSessions = async (page = sessionsPage) => {
    setIsLoadingSessions(true)
    try {
      const response = await apiClient.getSessions(page, 5)
      if (response.success && response.data) {
        setUserSessions(response.data.sessions || [])
        setCurrentSessionId(response.data.currentSessionId || null)
        setSessionsTotalPages(response.data.pagination?.totalPages || 1)
        setSessionsTotal(response.data.pagination?.total || 0)
        setSessionsPage(page)
      } else {
        setUserSessions([])
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setUserSessions([])
    } finally {
      setIsLoadingSessions(false)
    }
  }

  // Revoke a specific session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await apiClient.revokeSession(sessionId)
      if (response.success) {
        toast.success("Session revoked")
        loadUserSessions()
      } else {
        toast.error(response.error || "Failed to revoke session")
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      toast.error("Failed to revoke session")
    }
  }

  // Revoke all other sessions
  const handleRevokeAllSessions = async () => {
    try {
      const response = await apiClient.revokeAllSessions()
      if (response.success) {
        toast.success("All other sessions revoked")
        loadUserSessions()
      } else {
        toast.error(response.error || "Failed to revoke sessions")
      }
    } catch (error) {
      console.error('Failed to revoke sessions:', error)
      toast.error("Failed to revoke sessions")
    } finally {
      setShowRevokeAllDialog(false)
    }
  }

  // Format time ago for display
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'just now'
  }

  // Format date for session display (DD/MM/YYYY HH:MM AM/PM)
  const formatSessionDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'

    hours = hours % 12
    hours = hours ? hours : 12 // the hour '0' should be '12'
    const strHours = String(hours).padStart(2, '0')

    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`
  }

  // Copy referral code to clipboard
  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedCode(true)
      toast.success("Referral code copied!")
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      console.error('Failed to copy referral code:', error)
      toast.error("Failed to copy referral code")
    }
  }

  // Copy referral link to clipboard
  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      toast.success("Referral link copied!")
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (error) {
      console.error('Failed to copy referral link:', error)
      toast.error("Failed to copy referral link")
    }
  }

  // Cancel subscription
  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true)
    try {
      // Cancel the subscription first
      const response = await apiClient.cancelSubscription()
      if (response.success) {
        toast.success('Subscription cancelled successfully. You will retain access until the end of your billing period.')
        // Reload billing data
        await loadBillingData()
        // Now show the cancellation reason dialog
        setShowCancelDialog(false)
        setShowCancelReasonDialog(true)
      } else {
        toast.error(response.error || 'Failed to cancel subscription')
      }
    } catch (error) {
      console.error('Cancel subscription error:', error)
      toast.error('Failed to cancel subscription')
    } finally {
      setIsCancellingSubscription(false)
    }
  }

  // Submit cancellation reason (subscription already cancelled)
  const handleConfirmCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please select a reason for cancellation')
      return
    }

    setIsCancellingSubscription(true)
    try {
      // Send cancellation reason to backend (will webhook to Discord)
      const cancelResponse = await apiClient.cancelSubscriptionWithReason({
        reason: cancelReason,
        details: cancelReasonDetails
      })

      if (cancelResponse.success) {
        toast.success('Thank you for your feedback!')
      } else {
        toast.error(cancelResponse.error || 'Failed to submit feedback')
      }
    } catch (error) {
      console.error('Submit cancellation reason error:', error)
      toast.error('Failed to submit feedback')
    } finally {
      setIsCancellingSubscription(false)
      setShowCancelReasonDialog(false)
      setCancelReason("")
      setCancelReasonDetails("")
    }
  }

  // Manage subscription (redirect to Stripe portal)
  const handleManageSubscription = async () => {
    setIsRedirectingToPortal(true)
    try {
      // Clean return URL to avoid parameter accumulation and loops
      // Always redirects to the billing settings tab
      const returnUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/#settings/Billing`
        : 'https://drive.ellipticc.com/#settings/Billing'

      const response = await apiClient.createPortalSession({ returnUrl })

      if (response.success && response.data?.url) {
        window.location.href = response.data.url
      } else {
        toast.error(response.error || "Failed to create portal session")
        setIsRedirectingToPortal(false)
      }
    } catch (error) {
      console.error('Portal session error:', error)
      toast.error("Failed to redirect to billing portal")
      setIsRedirectingToPortal(false)
    }
  }

  // Format storage size for display
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0MB'

    const mb = bytes / (1024 * 1024)
    if (mb < 1024) {
      return `${Math.round(mb)}MB`
    } else {
      const gb = mb / 1024
      return `${gb.toFixed(1)}GB`
    }
  }

  // Extract display name from email (e.g., "john" from "john@doe.com")
  const getDisplayNameFromEmail = (email: string): string => {
    if (!email) return 'Unknown'
    const atIndex = email.indexOf('@')
    if (atIndex === -1) return email
    const prefix = email.substring(0, atIndex)
    // Capitalize first letter
    return prefix.charAt(0).toUpperCase() + prefix.slice(1)
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
      // Compress image client-side before hashing and uploading
      // Uses fixed parameters (512px, 0.8 quality, JPEG) for deterministic output
      const compressedBlob = await compressAvatar(file);

      // Calculate SHA256 hash of the COMPRESSED image for idempotency
      const buffer = await compressedBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const formData = new FormData()
      // Use compressed blob instead of original file
      formData.append('file', compressedBlob, 'avatar.jpg')

      // Pass the hash as the idempotency key (header)
      const uploadResponse = await apiClient.uploadAvatar(formData, fileHash)

      if (uploadResponse.success && uploadResponse.data?.avatarUrl) {
        // Update the user's profile with the new avatar URL
        await apiClient.updateUserProfile({
          avatar: uploadResponse.data.avatarUrl
        })
        // Force refetch to update user data
        await refetch()
        toast.success("Avatar updated successfully!")
      } else {
        if (uploadResponse.error === 'This image is already set as your avatar.') {
          toast.error("This image is already set as your avatar.");
        } else {
          toast.error(uploadResponse.error || "Failed to upload avatar");
        }
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
      console.error('Failed to update display name:', error)
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
    if (!user?.avatar) return;

    try {
      setIsLoadingAvatar(true)

      const response = await apiClient.updateUserProfile({
        avatar: ""
      })

      if (response.success) {
        // Immediately notify context to refresh
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
        toast.success("Email changed successfully! Please log in again with your new email address.")

        // Clear session storage
        sessionStorage.removeItem('emailChangeToken')
        sessionStorage.removeItem('newEmail')

        // Close OTP modal
        setShowEmailOTPModal(false)
        setEmailOTPCode("")

        // Log out the user to force re-login with new email
        await completeLogout()

        // Redirect to login page
        window.location.href = '/login'
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

  // Handle resend email OTP
  const handleResendEmailOTP = async () => {
    const newEmail = sessionStorage.getItem('newEmail')
    if (!newEmail) {
      toast.error("Email change session expired. Please try again.")
      return
    }

    setIsResendingEmailOTP(true)
    try {
      const response = await apiClient.initiateEmailChange(newEmail)
      if (response.success) {
        const emailChangeToken = response.data?.emailChangeToken
        if (emailChangeToken) {
          sessionStorage.setItem('emailChangeToken', emailChangeToken)
        }
        toast.success("OTP code resent to your new email address")
        setEmailOTPCode("")
      } else {
        toast.error(response.error || "Failed to resend OTP")
      }
    } catch (error) {
      console.error('Resend email OTP error:', error)
      toast.error("Failed to resend OTP")
    } finally {
      setIsResendingEmailOTP(false)
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
      console.error('Logout error:', error)
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://drive.ellipticc.com/api/v1'}/auth/delete`, {
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
      console.error('Delete account error:', error)
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
      if (response.success && response.data) {
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
      console.error('TOTP verification error:', error)
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
      console.error('Disable TOTP error:', error)
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
      <DialogContent showCloseButton={false} className={`${isMobile ? 'w-[90vw] h-[75vh] max-w-none max-h-none overflow-y-auto' : 'md:h-[700px] md:max-w-[1100px] overflow-hidden'} p-0`}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start h-full min-h-0">
          <Sidebar collapsible="none" className="hidden md:flex flex-none w-56 h-full border-r">
            <SidebarHeader className="p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenChange(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Close settings"
              >
                <IconX className="h-5 w-5" />
              </Button>
            </SidebarHeader>
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
                          <button onClick={() => handleTabChange(item.id)}>
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
          <main className="flex flex-1 flex-col h-full relative">
            {/* Mobile Navigation */}
            {isMobile && (
              <div className="border-b border-border p-4 flex-shrink-0 sticky top-0 bg-background">
                <div className="flex gap-1 overflow-x-auto">
                  {data.nav.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-4 p-6 pb-20 overflow-y-auto scroll-smooth">
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
                            onError={(e) => {
                              // Prevent favicon.ico fallback request
                              (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                            }}
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
                                onChange={(e) => {
                                  // Strict validation: Alphanumeric and spaces only, max 50 chars
                                  const val = e.target.value
                                  if (val.length <= 50 && /^[a-zA-Z0-9 ]*$/.test(val)) {
                                    setDisplayName(val)
                                  }
                                }}
                                placeholder={displayName || "Enter your name"}
                                readOnly={!isEditingName}
                                className={`flex-1 ${!isEditingName ? 'bg-muted cursor-not-allowed' : ''}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && isEditingName) handleSaveName()
                                  if (e.key === 'Escape' && isEditingName) handleCancelEdit()
                                }}
                              />
                              {isEditingName ? (
                                displayName === originalName ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    className="h-9 w-9 p-0"
                                    title="Cancel"
                                  >
                                    <IconX className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={handleSaveName}
                                    disabled={isSavingName || !displayName.trim()}
                                    className="h-9 w-9 p-0"
                                    title="Save name"
                                  >
                                    {isSavingName ? (
                                      <IconLoader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <IconCheck className="h-4 w-4" />
                                    )}
                                  </Button>
                                )
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
                      <ShieldUser className="h-5 w-5 text-muted-foreground" />
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

                  {/* Session Duration Configuration Section */}
                  <div className="flex items-center justify-between border-t pt-6">
                    <div className="flex items-center gap-3 flex-1">
                      <RotateCcwKeyIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col gap-1">
                        <p className="font-medium">Session Duration</p>
                        <p className="text-sm text-muted-foreground">
                          How long you can stay logged in before automatic logout
                        </p>
                      </div>
                    </div>
                    <Select
                      value={sessionExpiry}
                      onValueChange={async (value) => {
                        setSessionExpiry(value);
                        const sessionDuration = parseInt(value);

                        // Save to localStorage for immediate frontend use
                        const sessionConfig = {
                          sessionExpiry: sessionDuration,
                          remindBeforeExpiry: 300
                        };
                        localStorage.setItem('session_config', JSON.stringify(sessionConfig));

                        // Send to backend API to persist in database
                        try {
                          const response = await apiClient.updateSessionDuration(sessionDuration);
                          if (response.success) {
                            toast.success('Session duration updated');
                          } else {
                            toast.error(response.error || 'Failed to save session duration');
                          }
                        } catch (error) {
                          console.error('Error saving session duration:', error);
                          toast.error('Failed to save session duration');
                        }
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1800">30 minutes</SelectItem>
                        <SelectItem value="3600">1 hour</SelectItem>
                        <SelectItem value="7200">2 hours</SelectItem>
                        <SelectItem value="21600">6 hours</SelectItem>
                        <SelectItem value="43200">12 hours</SelectItem>
                        <SelectItem value="86400">24 hours</SelectItem>
                        <SelectItem value="604800">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Session Manager Section */}
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <IconShieldLock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Session Manager</p>
                          <p className="text-sm text-muted-foreground">Manage your active login sessions across devices</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {sessionsTotal > 5 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => loadUserSessions(sessionsPage - 1)}
                              disabled={sessionsPage === 1}
                            >
                              <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Page {sessionsPage} of {sessionsTotalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => loadUserSessions(sessionsPage + 1)}
                              disabled={sessionsPage >= sessionsTotalPages}
                            >
                              <IconChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isLoadingSessions || userSessions.filter(s => !s.isCurrent && !s.is_revoked).length === 0}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              Revoke All
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Revoke all other sessions?</DialogTitle>
                              <DialogDescription>
                                This will log you out of all other devices and browsers. You will remain logged in to your current session.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="mt-4">
                              <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleRevokeAllSessions}
                                className="bg-red-500 hover:bg-red-600 text-white"
                              >
                                Revoke All
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Session ID</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Device / Browser</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP Address</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {isLoadingSessions ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center">
                                  <IconLoader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                </td>
                              </tr>
                            ) : userSessions.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                  No active sessions found
                                </td>
                              </tr>
                            ) : (
                              userSessions.map((session) => (
                                <tr key={session.id} className={`hover:bg-muted/30 transition-colors ${session.is_revoked ? 'opacity-50' : ''}`}>
                                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                            {session.id.substring(0, 8)}...
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="font-mono text-xs">{session.id}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="font-medium truncate max-w-[200px]" title={session.user_agent}>
                                        {session.user_agent.includes('Windows') ? 'Windows' :
                                          session.user_agent.includes('Mac') ? 'macOS' :
                                            session.user_agent.includes('Linux') ? 'Linux' :
                                              session.user_agent.includes('Android') ? 'Android' :
                                                session.user_agent.includes('iPhone') ? 'iPhone' : 'Unknown Device'}
                                        {session.user_agent.includes('Chrome') ? ' (Chrome)' :
                                          session.user_agent.includes('Firefox') ? ' (Firefox)' :
                                            session.user_agent.includes('Safari') ? ' (Safari)' :
                                              session.user_agent.includes('Edge') ? ' (Edge)' : ''}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                    {session.ip_address}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                    {formatSessionDate(session.created_at)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {!!session.isCurrent && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase py-1 px-2 bg-emerald-100/50 dark:bg-emerald-950/30 rounded">
                                          Current
                                        </span>
                                      )}
                                      {!!session.is_revoked && (
                                        <span className="text-[10px] text-red-500 font-bold uppercase py-1 px-2 bg-red-100/50 dark:bg-red-950/30 rounded">
                                          Revoked
                                        </span>
                                      )}
                                      {(!session.isCurrent && !session.is_revoked) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRevokeSession(session.id)}
                                          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                          Revoke
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Notifications</h2>

                  {/* Notification Preferences */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">General Preferences</h3>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconBell className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">In-App Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive notifications within the application</p>
                          </div>
                        </div>
                        <Switch
                          checked={inAppNotifications}
                          onCheckedChange={(checked) => {
                            setInAppNotifications(checked)
                            saveNotificationPreferences({ inApp: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                          <IconMail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Email Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                          </div>
                        </div>
                        <Switch
                          checked={emailNotifications}
                          onCheckedChange={(checked) => {
                            setEmailNotifications(checked)
                            saveNotificationPreferences({ email: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-6 space-y-4">
                      <h3 className="text-lg font-semibold">Notification Types</h3>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Login Notifications</p>
                            <p className="text-sm text-muted-foreground">Get notified when someone logs into your account</p>
                          </div>
                        </div>
                        <Switch
                          checked={loginNotifications}
                          onCheckedChange={(checked) => {
                            setLoginNotifications(checked)
                            saveNotificationPreferences({ login: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                          <IconUserCog className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">File Sharing Notifications</p>
                            <p className="text-sm text-muted-foreground">Get notified when files are shared with you</p>
                          </div>
                        </div>
                        <Switch
                          checked={fileShareNotifications}
                          onCheckedChange={(checked) => {
                            setFileShareNotifications(checked)
                            saveNotificationPreferences({ fileShare: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                          <IconGift className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Billing Notifications</p>
                            <p className="text-sm text-muted-foreground">Get notified about billing and payment updates</p>
                          </div>
                        </div>
                        <Switch
                          checked={billingNotifications}
                          onCheckedChange={(checked) => {
                            setBillingNotifications(checked)
                            saveNotificationPreferences({ billing: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>
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

                  <div className="flex-1 overflow-y-auto pr-4 space-y-4">

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
                              {copiedLink ? (
                                <IconCheckmark className="h-4 w-4" />
                              ) : (
                                <IconCopy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Referral Stats - Now showing in the title */}

                        {/* Recent Referrals Table */}
                        {recentReferrals && recentReferrals.length > 0 && (
                          <div className="border-t pt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold">Referral History ({formatStorageSize((referralStats?.totalEarningsMB || 0) * 1024 * 1024)} of 10GB free space earned)</h3>
                              {referralsTotal > 5 && (
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/40 rounded-full border border-border/50 shadow-sm transition-all hover:bg-muted/60">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-full hover:bg-background shadow-xs transition-transform active:scale-95"
                                    onClick={() => loadReferralData(referralsPage - 1)}
                                    disabled={referralsPage === 1}
                                  >
                                    <IconChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <div className="flex items-center gap-1 min-w-[3rem] justify-center">
                                    <span className="text-[11px] font-bold text-foreground tabular-nums">{referralsPage}</span>
                                    <span className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-tight">/</span>
                                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{Math.ceil(referralsTotal / 5)}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-full hover:bg-background shadow-xs transition-transform active:scale-95"
                                    onClick={() => loadReferralData(referralsPage + 1)}
                                    disabled={referralsPage >= Math.ceil(referralsTotal / 5)}
                                  >
                                    <IconChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm font-mono">
                                <thead className="bg-muted/50 border-b">
                                  <tr>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">User</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px] hidden sm:table-cell">Email</th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Status</th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px] hidden xs:table-cell">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {recentReferrals.map((referral) => (
                                    <tr key={referral.referred_user_id} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-4 py-3 min-w-[160px]">
                                        <div className="flex items-center gap-3">
                                          <Avatar className="h-8 w-8 flex-shrink-0">
                                            <AvatarImage
                                              src={referral.avatar_url || getDiceBearAvatar(referral.referred_user_id, 32)}
                                              alt={`${referral.referred_name || getDisplayNameFromEmail(referral.referred_email)}'s avatar`}
                                              onError={(e) => {
                                                // Prevent favicon.ico fallback request
                                                (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                                              }}
                                            />
                                            <AvatarFallback className="text-xs">
                                              {getInitials(referral.referred_name || getDisplayNameFromEmail(referral.referred_email))}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{referral.referred_name || getDisplayNameFromEmail(referral.referred_email)}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 min-w-[160px] hidden sm:table-cell">
                                        <p className="text-xs text-muted-foreground truncate">{referral.referred_email}</p>
                                      </td>
                                      <td className="px-4 py-3 text-center min-w-[120px]">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${referral.status === 'completed'
                                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                          : referral.status === 'pending'
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                            : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                          }`}>
                                          {referral.status === 'completed' ? '✓ Completed' : referral.status === 'pending' ? '○ Pending' : 'Cancelled'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-center min-w-[120px] hidden xs:table-cell">
                                        <p className="text-xs text-muted-foreground">
                                          {referral.status === 'completed' && referral.completed_at
                                            ? formatTimeAgo(referral.completed_at)
                                            : formatTimeAgo(referral.created_at)}
                                        </p>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Empty Referrals State */}
                        {recentReferrals.length === 0 && !isLoadingReferrals && (
                          <div className="border-t pt-6">
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No referrals yet. Share your referral link to get started!
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Billing & Subscription</h2>

                  {/* Current Plan Section */}
                  {isLoadingBilling ? (
                    <div className="flex justify-center py-6">
                      <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <h3 className="font-medium mb-3">Current Plan</h3>
                          {subscription ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Plan:</span>
                                <span className="font-medium">{subscription.plan?.name || 'Unknown Plan'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status:</span>
                                <span className={`text-sm font-medium px-2 py-1 rounded-full ${subscription.status === 'active'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : subscription.status === 'trialing'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : subscription.status === 'past_due'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                  }`}>
                                  {subscription.status === 'active' ? 'Active' :
                                    subscription.status === 'trialing' ? 'Trial' :
                                      subscription.status === 'past_due' ? 'Past Due' :
                                        subscription.status || 'Unknown'}
                                </span>
                              </div>
                              {subscription.cancelAtPeriodEnd && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Cancellation:</span>
                                  <span className="text-sm text-red-600 font-medium">
                                    {subscription.currentPeriodEnd
                                      ? `Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                                      : 'Scheduled for cancellation'
                                    }
                                  </span>
                                </div>
                              )}
                              {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Next billing:</span>
                                  <span className="text-sm font-medium">
                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {subscription.plan?.interval && subscription.plan.interval !== 0 && subscription.plan.interval !== '0' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Billing cycle:</span>
                                  <span className="text-sm font-medium capitalize">
                                    {subscription.plan.interval}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Plan:</span>
                                <span className="font-medium">Free Plan</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status:</span>
                                <span className={`text-sm font-medium px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>
                                  Active
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Storage:</span>
                                <span className="text-sm font-medium">5GB included</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Storage Usage */}
                        {billingUsage && (
                          <div className="p-4 border rounded-lg">
                            <h3 className="font-medium mb-2">Storage Usage</h3>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Used:</span>
                                <span className="font-medium">{formatStorageSize(billingUsage.usedBytes)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Limit:</span>
                                <span className="font-medium">{formatStorageSize(billingUsage.quotaBytes)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${billingUsage.percentUsed > 90
                                    ? 'bg-red-500'
                                    : billingUsage.percentUsed > 75
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                    }`}
                                  style={{ width: `${Math.min(billingUsage.percentUsed, 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-muted-foreground text-center">
                                {billingUsage.percentUsed.toFixed(1)}% used
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          {subscription && !subscription.cancelAtPeriodEnd ? (
                            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  disabled={isCancellingSubscription}
                                  className="flex-1"
                                >
                                  Cancel Subscription
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel your subscription?
                                    <br /><br />
                                    • You will retain access to your current plan until the end of your billing period
                                    <br />
                                    • No future charges will be made
                                    <br />
                                    • You can reactivate your subscription at any time before it expires
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleCancelSubscription}
                                    disabled={isCancellingSubscription}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {isCancellingSubscription ? (
                                      <>
                                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                        Cancelling...
                                      </>
                                    ) : (
                                      'Cancel Subscription'
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : subscription?.cancelAtPeriodEnd ? (
                            <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                                Subscription will be cancelled on {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString() : 'the end of billing period'}
                              </p>
                            </div>
                          ) : null}

                          <Button
                            variant="outline"
                            onClick={handleManageSubscription}
                            disabled={isRedirectingToPortal}
                            className="flex-1"
                          >
                            {isRedirectingToPortal ? (
                              <>
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                Redirecting...
                              </>
                            ) : (
                              'Customer Portal'
                            )}
                          </Button>
                          <Button
                            onClick={() => window.location.href = '/billing'}
                            className="flex-1"
                          >
                            {subscription ? 'Change Plan' : 'Upgrade Plan'}
                          </Button>
                        </div>

                        {/* Important Information */}
                        {subscription && !subscription.cancelAtPeriodEnd && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                              <IconInfoCircle className="w-4 h-4" />
                              Important Information
                            </h4>
                            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                              <li>• You cannot cancel your subscription if you&apos;re using more than 5GB of storage</li>
                              <li>• When cancelled, you&apos;ll keep access until the end of your billing period</li>
                              <li>• No future charges will be made after cancellation</li>
                              <li>• You can reactivate your subscription at any time before it expires</li>
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Subscription History */}
                      <div className="border-t pt-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Billing History</h3>
                          {subscriptionHistory && (subscriptionHistory.history?.length > 0 || subscriptionHistory.invoices?.length > 0) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadSubscriptionHistory()}
                              disabled={isLoadingHistory}
                            >
                              {isLoadingHistory ? (
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <IconRefresh className="h-4 w-4 mr-2" />
                              )}
                              Refresh
                            </Button>
                          )}
                        </div>

                        {isLoadingHistory ? (
                          <div className="flex justify-center py-6">
                            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : subscriptionHistory ? (
                          <>
                            {/* Subscription History Table */}
                            {subscriptionHistory.history && subscriptionHistory.history.length > 0 && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-muted-foreground">Subscriptions</h4>
                                  {subsTotalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage - 1, invoicesPage)}
                                        disabled={subsPage === 1}
                                      >
                                        <IconChevronLeft className="h-4 w-4" />
                                      </Button>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {subsPage} / {subsTotalPages}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage + 1, invoicesPage)}
                                        disabled={subsPage >= subsTotalPages}
                                      >
                                        <IconChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-card max-h-80">
                                  <div className="overflow-x-auto overflow-y-auto h-full">
                                    <table className="w-full text-sm font-mono">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Plan</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Status</th>
                                          <th className="text-right px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Amount</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Billing</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Created</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {subscriptionHistory.history.map((sub: SubscriptionHistory['history'][0]) => (
                                          <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 min-w-[160px]">
                                              <div>
                                                <p className="font-medium">{sub.planName}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{sub.interval}ly</p>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${sub.status === 'active'
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : sub.status === 'canceled'
                                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                  : sub.status === 'past_due'
                                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                    : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                                }`}>
                                                {sub.status === 'active' ? 'Active' :
                                                  sub.status === 'canceled' ? 'Cancelled' :
                                                    sub.status === 'past_due' ? 'Past Due' :
                                                      sub.status}
                                                {sub.cancelAtPeriodEnd && ' (Cancelling)'}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-right min-w-[120px]">
                                              <p className="font-medium">${sub.amount.toFixed(2)}</p>
                                              <p className="text-xs text-muted-foreground">{sub.currency.toUpperCase()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <p className="text-xs capitalize">{sub.interval}ly</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <p className="text-xs">{new Date(sub.created * 1000).toLocaleDateString()}</p>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Invoices Table */}
                            {subscriptionHistory.invoices && subscriptionHistory.invoices.length > 0 && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-muted-foreground">Invoices</h4>
                                  {invoicesTotalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage, invoicesPage - 1)}
                                        disabled={invoicesPage === 1}
                                      >
                                        <IconChevronLeft className="h-4 w-4" />
                                      </Button>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {invoicesPage} / {invoicesTotalPages}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage, invoicesPage + 1)}
                                        disabled={invoicesPage >= invoicesTotalPages}
                                      >
                                        <IconChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-card max-h-80">
                                  <div className="overflow-x-auto overflow-y-auto h-full">
                                    <table className="w-full text-sm font-mono">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Invoice</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Status</th>
                                          <th className="text-right px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Amount</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Date</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {subscriptionHistory.invoices.map((invoice: SubscriptionHistory['invoices'][0]) => (
                                          <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 min-w-[160px]">
                                              <div>
                                                <p className="font-medium">{invoice.number || `Invoice ${invoice.id.slice(-8)}`}</p>
                                                {invoice.subscriptionId && (
                                                  <p className="text-xs text-muted-foreground">Sub: {invoice.subscriptionId.slice(-8)}</p>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${invoice.status === 'paid'
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : invoice.status === 'open'
                                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                  : invoice.status === 'void'
                                                    ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                }`}>
                                                {invoice.status === 'paid' ? 'Paid' :
                                                  invoice.status === 'open' ? 'Open' :
                                                    invoice.status === 'void' ? 'Void' :
                                                      invoice.status}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-right min-w-[120px]">
                                              <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                                              <p className="text-xs text-muted-foreground">{invoice.currency.toUpperCase()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <p className="text-xs">{new Date(invoice.created * 1000).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <div className="flex gap-2 justify-center">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => window.open(invoice.invoicePdf, '_blank')}
                                                  className="text-xs"
                                                >
                                                  Download
                                                </Button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Empty State */}
                            {(!subscriptionHistory.history || subscriptionHistory.history.length === 0) &&
                              (!subscriptionHistory.invoices || subscriptionHistory.invoices.length === 0) && (
                                <div className="text-center py-12">
                                  <h3 className="text-sm font-medium text-foreground mb-1">No billing history yet</h3>
                                  <p className="text-sm text-muted-foreground">Your invoices and subscription details will appear here</p>
                                </div>
                              )}
                          </>
                        ) : (
                          <div className="text-center py-12">
                            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                              <IconLoader2 className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-1">Unable to load billing history</h3>
                            <p className="text-sm text-muted-foreground mb-4">Please try again or contact support if the issue persists</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadSubscriptionHistory()}
                            >
                              Try Again
                            </Button>
                          </div>
                        )}
                      </div>
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
                Update your email address. You&apos;ll need to verify with your password and confirm the new email via OTP.
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
                  disabled={isChangingEmail}
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
                  disabled={isChangingEmail}
                />
              </div>
              <div>
                <Label htmlFor="modal-email-password">Current Password</Label>
                <PasswordInput
                  id="modal-email-password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Enter your current password to verify"
                  disabled={isChangingEmail}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your password will be validated client-side only
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEmailModal(false)
                setNewEmail("")
                setConfirmEmail("")
                setEmailPassword("")
              }} disabled={isChangingEmail}>
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
                    // Step 1: Validate password client-side using OPAQUE
                    // We'll try to complete a login flow to verify the password is correct
                    const { OPAQUELogin } = await import("@/lib/opaque")
                    const passwordVerifier = new OPAQUELogin()

                    try {
                      // Start the login process to validate password
                      const { startLoginRequest } = await passwordVerifier.step1(emailPassword.trim())
                      // Get the login response from server
                      const { loginResponse } = await passwordVerifier.step2(user?.email || "", startLoginRequest)
                      // Finish login locally to verify password
                      const result = await passwordVerifier.step3(loginResponse)

                      if (!result) {
                        toast.error("Invalid password")
                        setIsChangingEmail(false)
                        return
                      }

                      console.log("Password validated successfully")
                    } catch (passwordError: unknown) {
                      const errorMsg = passwordError instanceof Error ? passwordError.message : "Password validation failed"
                      console.error('Password validation error:', errorMsg)
                      toast.error("Invalid password. Please try again.")
                      setIsChangingEmail(false)
                      return
                    }

                    // Step 2: Password is valid, now initiate email change (send OTP)
                    const initiateResponse = await apiClient.initiateEmailChange(newEmail.trim())

                    if (!initiateResponse.success) {
                      toast.error(initiateResponse.error || "Failed to initiate email change")
                      setIsChangingEmail(false)
                      return
                    }

                    // Step 3: Store the email change token and new email for OTP verification
                    const emailChangeToken = initiateResponse.data?.emailChangeToken
                    if (emailChangeToken) {
                      sessionStorage.setItem('emailChangeToken', emailChangeToken)
                      sessionStorage.setItem('newEmail', newEmail.trim())
                    }

                    toast.success("OTP sent to your new email address")

                    // Clear the form and open OTP verification modal
                    setShowEmailModal(false)
                    setNewEmail("")
                    setConfirmEmail("")
                    setEmailPassword("")
                    setEmailOTPCode("")
                    setShowEmailOTPModal(true)

                  } catch (error) {
                    console.error('Email change error:', error)
                    toast.error("Failed to initiate email change")
                  } finally {
                    setIsChangingEmail(false)
                  }
                }}
                disabled={isChangingEmail}
              >
                {isChangingEmail ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Validating...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email Change OTP Verification Modal */}
        <Dialog open={showEmailOTPModal} onOpenChange={setShowEmailOTPModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Verify New Email</DialogTitle>
              <DialogDescription>
                Enter the verification code sent to your new email address
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email-otp-code">Verification Code</Label>
                <Input
                  id="email-otp-code"
                  type="text"
                  value={emailOTPCode}
                  onChange={(e) => setEmailOTPCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  disabled={isVerifyingEmailOTP || isResendingEmailOTP}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailOTPCode.length === 6) {
                      handleVerifyEmailOTP()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Check your new email for the verification code
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={handleResendEmailOTP}
                disabled={isResendingEmailOTP || isVerifyingEmailOTP}
              >
                {isResendingEmailOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Resending...
                  </>
                ) : (
                  "Resend Code"
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEmailOTPModal(false)
                setEmailOTPCode("")
              }} disabled={isVerifyingEmailOTP || isResendingEmailOTP}>
                Cancel
              </Button>
              <Button
                onClick={handleVerifyEmailOTP}
                disabled={isVerifyingEmailOTP || isResendingEmailOTP || emailOTPCode.length !== 6}
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

        {/* Password Change Modal - Now just shows explanation and options */}
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Password Reset Required</DialogTitle>
              <DialogDescription>
                Password changes require your mnemonic backup
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <h3 className="font-medium text-foreground mb-2">
                  Account Recovery System
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Password changes are secured with your mnemonic backup from registration. To reset your password, visit the dedicated reset page.
                </p>
                <div className="bg-background border border-border rounded p-3 text-xs text-foreground space-y-2 mb-3">
                  <p><strong>If you have your mnemonic:</strong></p>
                  <p>✓ Proceed to reset page and use your backup to change your password</p>
                  <p className="pt-2"><strong>If you lost your mnemonic:</strong></p>
                  <p>✗ Unfortunately, you cannot reset your password directly</p>
                  <p>✗ You must create a new account and manually migrate your data</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setIsChangingPassword(true)
                  try {
                    // Reset form
                    setShowPasswordModal(false)

                    // Log out and redirect to reset page
                    await completeLogout()
                    window.location.href = '/reset'
                  } catch (error) {
                    console.error('Password reset redirect error:', error)
                    toast.error("Failed to redirect to password reset page")
                    setIsChangingPassword(false)
                  }
                }}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Redirecting...
                  </>
                ) : (
                  "Go to Reset Page"
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
                  Type &quot;DELETE&quot; to confirm
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
                  <Image
                    src={totpQrCode}
                    alt="TOTP QR Code"
                    width={200}
                    height={200}
                    className="max-w-full h-auto"
                  />
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
                We&apos;ve sent a 6-digit code to your new email address. Please enter it to complete the email change.
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

        {/* Cancellation Reason Dialog */}
        <Dialog open={showCancelReasonDialog} onOpenChange={setShowCancelReasonDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Help us improve</DialogTitle>
              <DialogDescription>
                Your subscription has been cancelled. Your feedback helps us improve our service.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Cancellation Reason</Label>
                <div className="space-y-2">
                  {[
                    { value: 'too_expensive', label: 'Too expensive' },
                    { value: 'not_enough_storage', label: 'Not enough storage' },
                    { value: 'switching_services', label: 'Switching to another service' },
                    { value: 'not_using_features', label: 'Not using the features' },
                    { value: 'performance_issues', label: 'Performance issues' },
                    { value: 'other', label: 'Other' }
                  ].map((option) => (
                    <div key={option.value} className="flex items-center">
                      <input
                        id={`reason-${option.value}`}
                        type="radio"
                        name="cancelReason"
                        value={option.value}
                        checked={cancelReason === option.value}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`reason-${option.value}`} className="ml-3 block text-sm font-medium">
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {cancelReason && (
                <div className="space-y-2">
                  <Label htmlFor="reason-details" className="text-sm font-medium">
                    Additional Details (Optional)
                  </Label>
                  <textarea
                    id="reason-details"
                    value={cancelReasonDetails}
                    onChange={(e) => setCancelReasonDetails(e.target.value)}
                    placeholder="Help us understand better..."
                    className="w-full h-24 p-2 border border-input rounded-md bg-background text-foreground resize-none text-sm"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelReasonDialog(false)
                  setCancelReason("")
                  setCancelReasonDetails("")
                }}
              >
                Skip Feedback
              </Button>
              <Button
                onClick={handleConfirmCancelSubscription}
                disabled={isCancellingSubscription || !cancelReason.trim()}
              >
                {isCancellingSubscription ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
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
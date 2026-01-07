"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from "sonner"
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
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  IconSettings,
  IconUserCog,
  IconLockSquareRounded,
  IconGift,
  IconBell,
  IconCoin,
  IconLoader2,
  IconX,
} from "@tabler/icons-react"
import {
  GeneralTab
} from "./settings/general-tab"
import {
  SecurityTab
} from "./settings/security-tab"
import {
  NotificationsTab
} from "./settings/notifications-tab"
import {
  BillingTab
} from "./settings/billing-tab"
import {
  ReferralsTab
} from "./settings/referrals-tab"

import { apiClient, Referral, Subscription, BillingUsage, PricingPlan, SubscriptionHistory, SecurityEvent } from "@/lib/api"
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
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
  const { user, refetch, deviceLimitReached } = useUser()
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

    // Clear hash when closing if it's a settings hash
    if (!newOpen && window.location.hash.startsWith('#settings')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
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
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteDetails, setDeleteDetails] = useState("")

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
  const [sessionExpiry, setSessionExpiry] = useState("5184000")
  const [userSessions, setUserSessions] = useState<any[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1)
  const [sessionsTotal, setSessionsTotal] = useState(0)

  // Device management state
  const [userDevices, setUserDevices] = useState<any[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [devicesPage, setDevicesPage] = useState(1)
  const [devicesTotalPages, setDevicesTotalPages] = useState(1)
  const [devicesTotal, setDevicesTotal] = useState(0)
  const [devicePlan, setDevicePlan] = useState<{
    name: string;
    maxDevices: number;
    currentDevices: number;
  } | null>(null)
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState("")

  // Security events state
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [isLoadingSecurityEvents, setIsLoadingSecurityEvents] = useState(false)
  const [securityEventsPage, setSecurityEventsPage] = useState(1)
  const [securityEventsTotal, setSecurityEventsTotal] = useState(0)
  const [securityEventsHasMore, setSecurityEventsHasMore] = useState(false)
  const [activityMonitorEnabled, setActivityMonitorEnabled] = useState(true)
  const [detailedEventsEnabled, setDetailedEventsEnabled] = useState(true)
  const [showDisableMonitorDialog, setShowDisableMonitorDialog] = useState(false)
  const [showRevoked, setShowRevoked] = useState(false)

  // Recovery codes state
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [showRecoveryCodesModal, setShowRecoveryCodesModal] = useState(false)

  // Track which data has been loaded to prevent duplicate fetches
  const loadedRef = React.useRef(false)
  const loadedTabsRef = React.useRef<Set<string>>(new Set())

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

  // Data loading functions organized by tab
  const loadGeneralData = useCallback(() => {
    // General tab data is mostly user state which is already loaded
    // Only load session config if not present
    loadSessionConfig()
  }, [])

  const loadSecurityData = useCallback(() => {
    loadTOTPStatus()
    loadUserSessions(1)
    loadUserDevices(1)
    loadSecurityEvents(1)
    loadSecurityPreferences()
  }, [])

  const loadBillingDataTab = useCallback(() => {
    loadBillingData()
    loadSubscriptionHistory(1, 1)
  }, [])

  const loadNotificationsData = useCallback(() => {
    loadNotificationPreferences()
  }, [])

  const loadReferralsData = useCallback(() => {
    loadReferralData(1)
  }, [])

  // Master load function that delegates to specific tab loaders
  const loadTabData = useCallback((tab: string) => {
    if (loadedTabsRef.current.has(tab)) return

    switch (tab) {
      case 'general':
        loadGeneralData()
        break
      case 'security':
        loadSecurityData()
        break
      case 'billing':
        loadBillingDataTab()
        break
      case 'notifications':
        loadNotificationsData()
        break
      case 'referrals':
        loadReferralsData()
        break
    }

    loadedTabsRef.current.add(tab)
  }, [loadGeneralData, loadSecurityData, loadBillingDataTab, loadNotificationsData, loadReferralsData])

  // Load initial data when modal opens
  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true
      // Always load the active tab's data immediately
      loadTabData(activeTab)
    }
  }, [open, activeTab, loadTabData])

  // Load data when switching tabs
  useEffect(() => {
    if (open) {
      loadTabData(activeTab)
    }
  }, [activeTab, open, loadTabData])

  // Reload sessions/devices when showRevoked changes
  useEffect(() => {
    if (open && activeTab === 'security') {
      loadUserSessions(1)
      loadUserDevices(1)
    }
  }, [showRevoked, open, activeTab])

  // Reset loaded state when modal closes
  useEffect(() => {
    if (!open) {
      loadedRef.current = false
      loadedTabsRef.current.clear()

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

      // Reset Security
      setSecurityEventsPage(1)
      setShowRevoked(false)
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
          setSessionExpiry('5184000')
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
      const response = await apiClient.getSessions(page, 5, !showRevoked)
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
        if (deviceLimitReached) {
          toast.info("Sessions Revoked. Please refresh the page to regain full access.", {
            duration: 10000,
            action: {
              label: "Refresh Now",
              onClick: () => window.location.reload()
            }
          })
        }
      } else {
        toast.error(response.error || "Failed to revoke sessions")
      }
    } finally {
      setShowRevokeAllDialog(false)
    }
  }

  // Load authorized devices
  const loadUserDevices = async (page = devicesPage) => {
    setIsLoadingDevices(true)
    try {
      const response = await apiClient.getDevices(page, 5, !showRevoked)
      if (response.success && response.data) {
        setUserDevices(response.data.devices || [])
        setDevicesTotalPages(response.data.pagination?.totalPages || 1)
        setDevicesTotal(response.data.pagination?.total || 0)
        setDevicesPage(page)
        setDevicePlan(response.data.plan || null)
      } else {
        setUserDevices([])
      }
    } catch (error) {
      console.error('Failed to load devices:', error)
      setUserDevices([])
    } finally {
      setIsLoadingDevices(false)
    }
  }

  // Revoke a specific device
  const handleRevokeDevice = async (deviceId: string) => {
    try {
      const response = await apiClient.revokeDevice(deviceId)
      if (response.success) {
        toast.success("Device revoked")
        loadUserDevices()
        if (deviceLimitReached) {
          toast.info("Access Restored? Please refresh the page to regain full access.", {
            duration: 10000,
            action: {
              label: "Refresh Now",
              onClick: () => window.location.reload()
            }
          })
        }
      } else {
        toast.error(response.error || "Failed to revoke device")
      }
    } catch (error) {
      console.error('Failed to revoke device:', error)
      toast.error("Failed to revoke device")
    }
  }

  // Load security preferences
  const loadSecurityPreferences = async () => {
    try {
      const response = await apiClient.getSecurityPreferences()
      if (response.success && response.data) {
        setActivityMonitorEnabled(response.data.activityMonitorEnabled)
        setDetailedEventsEnabled(response.data.detailedEventsEnabled)
      }
    } catch (error) {
      console.error('Failed to load security preferences:', error)
    }
  }

  // Update security preferences
  const handleUpdateSecurityPreferences = async (activity: boolean, detailed: boolean) => {
    try {
      const response = await apiClient.updateSecurityPreferences(activity, detailed)
      if (response.success) {
        setActivityMonitorEnabled(activity)
        setDetailedEventsEnabled(detailed)
        toast.success("Preferences updated")
      } else {
        toast.error(response.error || "Failed to update preferences")
      }
    } catch (error) {
      console.error('Failed to update security preferences:', error)
      toast.error("Failed to update preferences")
    }
  }

  // Load security events history
  const loadSecurityEvents = async (page: number = 1) => {
    setIsLoadingSecurityEvents(true)
    try {
      const limit = 10
      const offset = (page - 1) * limit
      const response = await apiClient.getSecurityEvents(limit, offset)
      if (response.success && response.data) {
        setSecurityEvents(response.data.events || [])
        if (response.data.pagination) {
          setSecurityEventsTotal(response.data.pagination.total || 0)
          setSecurityEventsHasMore(!!response.data.pagination.hasMore)
        }
        setSecurityEventsPage(page)
      } else {
        setSecurityEvents([])
        setSecurityEventsTotal(0)
        setSecurityEventsHasMore(false)
      }
    } catch (error) {
      console.error('Failed to load security events:', error)
    } finally {
      setIsLoadingSecurityEvents(false)
    }
  }

  // Wipe security history
  const handleWipeSecurityEvents = async () => {
    try {
      const response = await apiClient.wipeSecurityEvents()
      if (response.success) {
        toast.success("Security history wiped")
        loadSecurityEvents(1)
      } else {
        toast.error(response.error || "Failed to wipe security history")
      }
    } catch (error) {
      console.error('Failed to wipe security history:', error)
      toast.error("Failed to wipe security history")
    }
  }

  // Download security history
  const handleDownloadSecurityEvents = async () => {
    try {
      const response = await apiClient.getSecurityEvents(1000, 0) // Get more for download
      if (response.success && response.data) {
        const events = response.data.events
        const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `security-history-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download security history:', error)
      toast.error("Failed to download security history")
    }
  }

  // Update device name
  const handleUpdateDeviceName = async (deviceId: string, newName: string) => {
    if (!newName.trim()) return
    try {
      const response = await apiClient.renameDevice(deviceId, newName)
      if (response.success) {
        toast.success("Device name updated")
        loadUserDevices()
      } else {
        toast.error(response.error || "Failed to update device name")
      }
    } catch (error) {
      console.error('Failed to update device name:', error)
      toast.error("Failed to update device name")
    } finally {
      setEditingDeviceId(null)
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
  const isDiceBearAvatar = !!(user?.avatar && user.avatar.includes('dicebear-api.com'))



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
  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm account deletion")
      return
    }

    if (!deleteReason) {
      toast.error("Please select a reason for leaving")
      return
    }

    setIsDeletingAccount(true)
    try {
      const response = await apiClient.deleteAccount(deleteReason, deleteDetails)

      if (response.success) {
        // Complete cleanup
        await completeLogout()
        toast.success("Account deleted successfully")
        // Redirect to landing page
        window.location.href = '/'
      } else {
        toast.error(response.error || "Failed to delete account")
      }
    } catch (error) {
      console.error('Delete account error:', error)
      toast.error("Failed to delete account")
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeleteConfirmation("")
      setDeleteReason("")
      setDeleteDetails("")
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
        setTotpToken("")
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
      <DialogContent showCloseButton={false} className={`${isMobile ? 'w-[90vw] h-[75vh] max-w-none max-h-none overflow-y-auto' : 'md:h-[800px] md:max-w-[1200px] overflow-hidden'} p-0`}>
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
                    {data.nav.map((item) => {
                      const isDisabled = deviceLimitReached && item.id !== "security";
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={activeTab === item.id}
                            disabled={isDisabled}
                            className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <button
                              onClick={() => !isDisabled && handleTabChange(item.id)}
                              className={isDisabled ? "cursor-not-allowed pointer-events-none" : ""}
                            >
                              <item.icon />
                              <span>{item.name}</span>
                            </button>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
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
                <GeneralTab
                  user={user}
                  displayName={displayName}
                  setDisplayName={setDisplayName}
                  originalName={originalName}
                  isEditingName={isEditingName}
                  setIsEditingName={setIsEditingName}
                  isSavingName={isSavingName}
                  handleSaveName={handleSaveName}
                  handleCancelEdit={handleCancelEdit}
                  handleAvatarClick={handleAvatarClick}
                  isLoadingAvatar={isLoadingAvatar}
                  isDiceBearAvatar={isDiceBearAvatar}
                  handleRemoveAvatar={handleRemoveAvatar}
                  nameInputRef={nameInputRef as React.RefObject<HTMLInputElement>}
                  theme={theme}
                  setTheme={setTheme}
                  dateTimePreference={dateTimePreference}
                  setDateTimePreference={setDateTimePreference}
                />
              )}

              {activeTab === "security" && (
                <SecurityTab
                  user={user}
                  setShowEmailModal={setShowEmailModal}
                  setShowPasswordModal={setShowPasswordModal}

                  // 2FA
                  totpEnabled={totpEnabled}
                  isLoadingTOTP={isLoadingTOTP}
                  setShowTOTPDisable={setShowTOTPDisable}
                  handleTOTPSetup={handleTOTPSetup}
                  handleTOTPDisable={handleTOTPDisable}
                  showTOTPSetup={showTOTPSetup}
                  setShowTOTPSetup={setShowTOTPSetup}
                  totpQrCode={totpQrCode}
                  totpSecret={totpSecret}
                  totpToken={totpToken}
                  setTotpToken={setTotpToken}
                  isVerifyingTOTP={isVerifyingTOTP}
                  handleTOTPVerify={handleTOTPVerify}

                  showRecoveryCodesModal={showRecoveryCodesModal}
                  setShowRecoveryCodesModal={setShowRecoveryCodesModal}
                  recoveryCodes={recoveryCodes}
                  showTOTPDisable={showTOTPDisable}
                  disableToken={disableToken}
                  setDisableToken={setDisableToken}
                  disableRecoveryCode={disableRecoveryCode}
                  setDisableRecoveryCode={setDisableRecoveryCode}
                  isDisablingTOTP={isDisablingTOTP}

                  // Session Duration
                  sessionExpiry={sessionExpiry}
                  setSessionExpiry={setSessionExpiry}

                  // Sessions
                  userSessions={userSessions}
                  isLoadingSessions={isLoadingSessions}
                  sessionsTotal={sessionsTotal}
                  sessionsPage={sessionsPage}
                  sessionsTotalPages={sessionsTotalPages}
                  loadUserSessions={loadUserSessions}
                  handleRevokeSession={handleRevokeSession}
                  currentSessionId={currentSessionId}
                  showRevokeAllDialog={showRevokeAllDialog}
                  setShowRevokeAllDialog={setShowRevokeAllDialog}
                  handleRevokeAllSessions={handleRevokeAllSessions}

                  // Devices
                  userDevices={userDevices}
                  isLoadingDevices={isLoadingDevices}
                  devicesTotal={devicesTotal}
                  devicesPage={devicesPage}
                  devicesTotalPages={devicesTotalPages}
                  loadUserDevices={loadUserDevices}
                  handleRevokeDevice={handleRevokeDevice}
                  editingDeviceId={editingDeviceId}
                  setEditingDeviceId={setEditingDeviceId}
                  editNameValue={editNameValue}
                  setEditNameValue={setEditNameValue}
                  handleUpdateDeviceName={handleUpdateDeviceName}
                  devicePlan={devicePlan}

                  // Activity
                  securityEvents={securityEvents}
                  isLoadingSecurityEvents={isLoadingSecurityEvents}
                  detailedEventsEnabled={detailedEventsEnabled}
                  activityMonitorEnabled={activityMonitorEnabled}
                  handleUpdateSecurityPreferences={handleUpdateSecurityPreferences}
                  showDisableMonitorDialog={showDisableMonitorDialog}
                  setShowDisableMonitorDialog={setShowDisableMonitorDialog}
                  handleWipeSecurityEvents={handleWipeSecurityEvents}
                  handleDownloadSecurityEvents={handleDownloadSecurityEvents}
                  loadSecurityEvents={loadSecurityEvents}
                  securityEventsTotal={securityEventsTotal}
                  securityEventsPage={securityEventsPage}
                  securityEventsHasMore={securityEventsHasMore}
                  setSecurityEvents={setSecurityEvents}
                  setSecurityEventsTotal={setSecurityEventsTotal}
                  setSecurityEventsHasMore={setSecurityEventsHasMore}

                  // Account
                  handleLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                  setShowDeleteModal={setShowDeleteModal}

                  // Revoked Toggle
                  showRevoked={showRevoked}
                  setShowRevoked={setShowRevoked}
                />
              )}

              {activeTab === "notifications" && (
                <NotificationsTab
                  inAppNotifications={inAppNotifications}
                  setInAppNotifications={setInAppNotifications}
                  emailNotifications={emailNotifications}
                  setEmailNotifications={setEmailNotifications}
                  loginNotifications={loginNotifications}
                  setLoginNotifications={setLoginNotifications}
                  fileShareNotifications={fileShareNotifications}
                  setFileShareNotifications={setFileShareNotifications}
                  billingNotifications={billingNotifications}
                  setBillingNotifications={setBillingNotifications}
                  isLoadingNotificationPrefs={isLoadingNotificationPrefs}
                  saveNotificationPreferences={saveNotificationPreferences}
                />
              )}

              {activeTab === "referrals" && (
                <ReferralsTab
                  referralCode={referralCode}
                  referralLink={referralLink}
                  isLoadingReferrals={isLoadingReferrals}
                  handleCopyReferralCode={handleCopyReferralCode}
                  handleCopyReferralLink={handleCopyReferralLink}
                  copiedCode={copiedCode}
                  copiedLink={copiedLink}
                  recentReferrals={recentReferrals}
                  referralsPage={referralsPage}
                  referralsTotal={referralsTotal}
                  loadReferralData={loadReferralData}
                  referralStats={referralStats}
                />
              )}

              {activeTab === "billing" && (
                <BillingTab
                  isLoadingBilling={isLoadingBilling}
                  subscription={subscription}
                  billingUsage={billingUsage}
                  showCancelDialog={showCancelDialog}
                  setShowCancelDialog={setShowCancelDialog}
                  isCancellingSubscription={isCancellingSubscription}
                  handleCancelSubscription={handleCancelSubscription}
                  handleManageSubscription={handleManageSubscription}
                  isRedirectingToPortal={isRedirectingToPortal}
                  loadSubscriptionHistory={loadSubscriptionHistory}
                  isLoadingHistory={isLoadingHistory}
                  subscriptionHistory={subscriptionHistory}
                  subsPage={subsPage}
                  invoicesPage={invoicesPage}
                  subsTotalPages={subsTotalPages}
                  invoicesTotalPages={invoicesTotalPages}
                />
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
            <div className="space-y-4 pt-1 max-w-full overflow-hidden">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Why are you leaving? <span className="text-destructive">*</span>
                  </Label>
                  <Select value={deleteReason} onValueChange={setDeleteReason}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Too expensive">Too expensive</SelectItem>
                      <SelectItem value="Better alternative">Found a better alternative</SelectItem>
                      <SelectItem value="Not using">Not using</SelectItem>
                      <SelectItem value="Too New">Product is too new</SelectItem>
                      <SelectItem value="Not enough storage">Not enough storage</SelectItem>
                      <SelectItem value="Security concerns">Security concerns</SelectItem>
                      <SelectItem value="Technical issues">Technical issues</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider break-words">
                      Additional feedback (Optional)
                    </Label>
                    <span className={`text-[10px] flex-shrink-0 ml-2 ${deleteDetails.length > 900 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      {deleteDetails.length} / 1000
                    </span>
                  </div>
                  <Textarea
                    value={deleteDetails}
                    onChange={(e) => setDeleteDetails(e.target.value.substring(0, 1000))}
                    placeholder="Tell us more about your experience..."
                    className="h-28 overflow-y-auto break-words resize-none w-full"
                    style={{ fieldSizing: 'fixed' } as React.CSSProperties}
                  />
                </div>
              </div>

              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg w-full">
                <p className="text-sm font-medium text-destructive mb-2">
                  Type &quot;DELETE&quot; to confirm
                </p>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="font-mono bg-background/50 border-destructive/20 focus-visible:ring-destructive w-full"
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
                disabled={isDeletingAccount || deleteConfirmation !== "DELETE" || !deleteReason}
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
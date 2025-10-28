import * as React from "react"
import {
  IconSettings,
  IconUser,
  IconCreditCard,
  IconShield,
  IconPalette,
  IconBell,
  IconKey,
  IconLock,
  IconMail,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  IconLanguage,
  IconTrash,
  IconDownload,
  IconUpload,
  IconEye,
  IconEyeOff
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api"
import { useTheme } from "next-themes"

interface SettingsModalProps {
  children?: React.ReactNode
}

export function SettingsModal({ children }: SettingsModalProps) {
  const [open, setOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const { theme, setTheme } = useTheme()

  // General Settings State
  const [generalSettings, setGeneralSettings] = React.useState({
    language: "en",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    notifications: true,
    autoSave: true,
    showHiddenFiles: false
  })

  // Account Settings State
  const [accountSettings, setAccountSettings] = React.useState({
    displayName: "",
    email: "",
    avatar: "",
    twoFactorEnabled: false,
    emailNotifications: true,
    storageLimit: 0
  })

  // Security Settings State
  const [securitySettings, setSecuritySettings] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    sessionTimeout: 30,
    loginAlerts: true,
    deviceManagement: true
  })

  // Billing Settings State
  const [billingSettings, setBillingSettings] = React.useState({
    currentPlan: "Free",
    storageUsed: 0,
    paymentMethod: "",
    billingCycle: "monthly",
    autoRenewal: true
  })

  const [plans, setPlans] = React.useState<any[]>([])
  const [subscription, setSubscription] = React.useState<any>(null)
  const [billingLoading, setBillingLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    try {
      const userData = await apiClient.getProfile()

      if (userData.success && userData.data?.user) {
        const user = userData.data.user
        setAccountSettings({
          displayName: user.displayName || user.name || "",
          email: user.email || "",
          avatar: user.avatar || "",
          twoFactorEnabled: user.twoFactorEnabled || false,
          emailNotifications: user.emailNotifications || true,
          storageLimit: user.storageLimit || 0
        })

        setGeneralSettings(prev => ({
          ...prev,
          language: user.language || "en",
          timezone: user.timezone || "UTC",
          notifications: user.notifications || true
        }))

        setSecuritySettings(prev => ({
          ...prev,
          sessionTimeout: user.sessionTimeout || 30,
          loginAlerts: user.loginAlerts || true
        }))

        // Load billing data
        await loadBillingData()
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadBillingData = async () => {
    try {
      setBillingLoading(true)

      // Fetch pricing plans
      const plansResponse = await apiClient.getPricingPlans()
      if (plansResponse.success && plansResponse.data) {
        setPlans(plansResponse.data.plans)
      }

      // Fetch current subscription
      const subscriptionResponse = await apiClient.getSubscriptionStatus()
      if (subscriptionResponse.success && subscriptionResponse.data) {
        setSubscription(subscriptionResponse.data.subscription)
      }

      // Get storage usage
      const storageResponse = await apiClient.getUserStorage()
      if (storageResponse.success && storageResponse.data) {
        setBillingSettings(prev => ({
          ...prev,
          storageUsed: storageResponse.data!.used_bytes
        }))
      }
    } catch (error) {
      console.error('Failed to load billing data:', error)
    } finally {
      setBillingLoading(false)
    }
  }

  const handleGeneralSettingsUpdate = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement when backend endpoint is available
      // const response = await apiClient.updateUserPreferences({...})

      // Mock successful response for now
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("General settings updated successfully!")
    } catch (error) {
      toast.error("Failed to update general settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccountSettingsUpdate = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement when backend endpoint is available
      // const response = await apiClient.updateUserProfile({...})

      // Mock successful response for now
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("Account settings updated successfully!")
    } catch (error) {
      toast.error("Failed to update account settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSecuritySettingsUpdate = async () => {
    if (securitySettings.newPassword && securitySettings.newPassword !== securitySettings.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      // TODO: Implement when backend endpoint is available
      // const response = await apiClient.updateSecuritySettings(updateData)

      // Mock successful response for now
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("Security settings updated successfully!")
      setSecuritySettings(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }))
    } catch (error) {
      toast.error("Failed to update security settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBillingSettingsUpdate = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement when backend endpoint is available
      // const response = await apiClient.updateBillingSettings({...})

      // Mock successful response for now
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("Billing settings updated successfully!")
    } catch (error) {
      toast.error("Failed to update billing settings")
    } finally {
      setIsLoading(false)
    }
  }

  const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <IconSettings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSettings className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <IconPalette className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <IconCreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Theme</Label>
                  <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <IconSun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <IconMoon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <IconDeviceDesktop className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="language">Language</FieldLabel>
                  <Select
                    value={generalSettings.language}
                    onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                  <Select
                    value={generalSettings.timezone}
                    onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="dateFormat">Date Format</FieldLabel>
                  <Select
                    value={generalSettings.dateFormat}
                    onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, dateFormat: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications for important updates</p>
                  </div>
                  <Switch
                    checked={generalSettings.notifications}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, notifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-save</Label>
                    <p className="text-sm text-muted-foreground">Automatically save changes</p>
                  </div>
                  <Switch
                    checked={generalSettings.autoSave}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, autoSave: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Hidden Files</Label>
                    <p className="text-sm text-muted-foreground">Display hidden files and folders</p>
                  </div>
                  <Switch
                    checked={generalSettings.showHiddenFiles}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, showHiddenFiles: checked }))}
                  />
                </div>
              </div>

              <Button onClick={handleGeneralSettingsUpdate} disabled={isLoading} className="w-full">
                {isLoading ? "Saving..." : "Save General Settings"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="account" className="space-y-4 mt-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                <Input
                  id="displayName"
                  value={accountSettings.displayName}
                  onChange={(e) => setAccountSettings(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Your display name"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email Address</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={accountSettings.email}
                  onChange={(e) => setAccountSettings(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your.email@example.com"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="avatar">Avatar URL</FieldLabel>
                <Input
                  id="avatar"
                  value={accountSettings.avatar}
                  onChange={(e) => setAccountSettings(prev => ({ ...prev, avatar: e.target.value }))}
                  placeholder="https://example.com/avatar.jpg"
                />
              </Field>
            </FieldGroup>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <div className="flex items-center gap-2">
                  {accountSettings.twoFactorEnabled ? (
                    <IconShield className="h-4 w-4 text-green-500" />
                  ) : (
                    <IconShield className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Switch
                    checked={accountSettings.twoFactorEnabled}
                    onCheckedChange={(checked) => setAccountSettings(prev => ({ ...prev, twoFactorEnabled: checked }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates about your account</p>
                </div>
                <Switch
                  checked={accountSettings.emailNotifications}
                  onCheckedChange={(checked) => setAccountSettings(prev => ({ ...prev, emailNotifications: checked }))}
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Storage Usage</Label>
                    <p className="text-sm text-muted-foreground">
                      {formatStorageSize(billingSettings.storageUsed)} of {formatStorageSize(accountSettings.storageLimit)} used
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {accountSettings.storageLimit > 0 ? Math.round((billingSettings.storageUsed / accountSettings.storageLimit) * 100) : 0}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${accountSettings.storageLimit > 0 ? Math.min((billingSettings.storageUsed / accountSettings.storageLimit) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleAccountSettingsUpdate} disabled={isLoading} className="w-full">
              {isLoading ? "Saving..." : "Save Account Settings"}
            </Button>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4 mt-4">
            {/* Current Subscription Status */}
            {subscription && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base font-medium">Current Plan</Label>
                    <p className="text-sm text-muted-foreground">{subscription.plan.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                      subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription.status === 'active' ? 'Active' :
                       subscription.status === 'trialing' ? 'Trial' :
                       subscription.status}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/billing'}>
                      Manage
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Storage Used</span>
                    <span>{formatStorageSize(billingSettings.storageUsed)} / {formatStorageSize(subscription.plan.storageQuota)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Renewal Date</span>
                    <span>{subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min((billingSettings.storageUsed / subscription.plan.storageQuota) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Free Plan */}
            {!subscription && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base font-medium">Current Plan</Label>
                    <p className="text-sm text-muted-foreground">Free Plan - 5GB Storage</p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Free
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Storage Used</span>
                    <span>{formatStorageSize(billingSettings.storageUsed)} / 5 GB</span>
                  </div>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min((billingSettings.storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pricing Plans */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Available Plans</Label>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/billing'}>
                  View All Plans
                </Button>
              </div>

              {billingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading plans...</span>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {plans.slice(0, 4).map((plan) => (
                    <div key={plan.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{plan.name}</h3>
                        {plan.popular && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-bold mb-2">
                        ${plan.price / 100}
                        <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                      <ul className="text-sm space-y-1 mb-4">
                        <li>• {Math.round(plan.storageQuota / (1024 * 1024 * 1024))}GB Storage</li>
                        {plan.features.slice(0, 2).map((feature: string, index: number) => (
                          <li key={index}>• {feature}</li>
                        ))}
                        {plan.features.length > 2 && (
                          <li className="text-muted-foreground">• +{plan.features.length - 2} more features</li>
                        )}
                      </ul>
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={async () => {
                          try {
                            setIsLoading(true)
                            const response = await apiClient.createCheckoutSession({
                              priceId: plan.stripePriceId,
                              successUrl: `${window.location.origin}/billing?success=true`,
                              cancelUrl: `${window.location.origin}/billing?canceled=true`
                            })

                            if (response.success && response.data) {
                              window.location.href = response.data.url
                            } else {
                              toast.error('Failed to start checkout process')
                            }
                          } catch (error) {
                            toast.error('Failed to start checkout process')
                          } finally {
                            setIsLoading(false)
                          }
                        }}
                        disabled={isLoading || (subscription && subscription.plan.id === plan.id)}
                      >
                        {isLoading ? 'Processing...' :
                         subscription && subscription.plan.id === plan.id ? 'Current Plan' :
                         'Upgrade'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <Label className="text-base font-medium mb-2 block">Change Password</Label>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="currentPassword">Current Password</FieldLabel>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={securitySettings.currentPassword}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter current password"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                    <Input
                      id="newPassword"
                      type="password"
                      value={securitySettings.newPassword}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={securitySettings.confirmPassword}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                  </Field>
                </FieldGroup>
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="sessionTimeout">Session Timeout (minutes)</FieldLabel>
                  <Select
                    value={securitySettings.sessionTimeout.toString()}
                    onValueChange={(value) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Login Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified of new login attempts</p>
                  </div>
                  <Switch
                    checked={securitySettings.loginAlerts}
                    onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, loginAlerts: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Device Management</Label>
                    <p className="text-sm text-muted-foreground">Manage trusted devices</p>
                  </div>
                  <Switch
                    checked={securitySettings.deviceManagement}
                    onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, deviceManagement: checked }))}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <Label className="text-base font-medium text-destructive mb-2 block">Danger Zone</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  These actions cannot be undone. Please be certain.
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm">
                    <IconTrash className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                  <Button variant="outline" size="sm">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                </div>
              </div>
            </div>

            <Button onClick={handleSecuritySettingsUpdate} disabled={isLoading} className="w-full">
              {isLoading ? "Saving..." : "Save Security Settings"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import {
  IconCode,
  IconWebhook,
  IconCopy,
  IconRefresh,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconSettings,
  IconTrash,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLink,
  IconAlertCircle,
  IconInfoCircle,
  IconLoader2,
  IconActivity,
  IconShieldCheck,
  IconSend,
  IconDeviceDesktop,
  IconBrowser
} from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
// @ts-expect-error JSONHighlighter has no type defs
import JSONHighlighter from 'react-json-syntax-highlighter'

const JsonHighlighter = ({ data }: { data: unknown }) => (
  <div className="json-theme-custom rounded-xl overflow-hidden border border-muted-foreground/10 bg-muted/20">
    <JSONHighlighter obj={data} className="text-[11px] font-mono p-4" />
  </div>
)

const EVENT_TYPES = [
  { id: 'login.success', label: 'Login Success', description: 'Triggered when a user successfully logs in' },
  { id: 'login.fail', label: 'Login Failure', description: 'Triggered when a login attempt fails' },
  { id: 'file.uploaded', label: 'File Uploaded', description: 'Triggered when a file is successfully uploaded' },
  { id: 'file.deleted', label: 'File Deleted/Trashed', description: 'Triggered when a file is moved to trash or permanently deleted' },
  { id: 'file.moved', label: 'File Moved', description: 'Triggered when a file is moved between folders' },
  { id: 'file.renamed', label: 'File Renamed', description: 'Triggered when a file is renamed' },
  { id: 'file.shared', label: 'File Shared', description: 'Triggered when a share link is created' },
  { id: 'file.downloaded', label: 'File Downloaded', description: 'Triggered when a file download is initiated' },
  { id: 'folder.created', label: 'Folder Created', description: 'Triggered when a new folder is created' },
  { id: 'folder.deleted', label: 'Folder Trashed/Deleted', description: 'Triggered when a folder is moved to trash or deleted' },
  { id: 'folder.moved', label: 'Folder Moved', description: 'Triggered when a folder is moved' },
  { id: 'folder.restored', label: 'Folder Restored', description: 'Triggered when a folder is restored from trash' },
  { id: 'paper.created', label: 'Paper Created', description: 'Triggered when a new paper is created' },
  { id: 'paper.updated', label: 'Paper Updated', description: 'Triggered when a paper is modified' },
  { id: 'paper.deleted', label: 'Paper Deleted/Trashed', description: 'Triggered when a paper is moved to trash or deleted' },
  { id: 'paper.restored', label: 'Paper Restored', description: 'Triggered when a paper is restored from trash' },
  { id: 'totp.enabled', label: '2FA Enabled', description: 'Triggered when Two-Factor Authentication is enabled' },
  { id: 'totp.disabled', label: '2FA Disabled', description: 'Triggered when Two-Factor Authentication is disabled' },
  { id: 'totp.fail', label: '2FA Failure', description: 'Triggered when a 2FA verification attempt fails' },
  { id: 'password.changed', label: 'Password Changed', description: 'Triggered when a user changes their password' },
  { id: 'master_key.revealed', label: 'Master Key Revealed', description: 'Triggered when a user reveals their master key' },
  { id: 'master_key.reveal_failed', label: 'Master Key Reveal Failure', description: 'Triggered when a master key reveal attempt fails' },
];

import { UserData } from "@/lib/api"

export function DeveloperTab({ user, userPlan }: { user?: UserData, userPlan: string }) {
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [events, setEvents] = useState<Record<string, { data: any[]; total: number; page: number; pageSize: number; isLoading?: boolean }>>({})
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request')
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<any>(null)

  // Usage State
  const [usageData, setUsageData] = useState<{ allowed: boolean; usage: number; limit: number; plan: string; } | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)

  // Success Dialog State
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [newWebhookSecret, setNewWebhookSecret] = useState("")

  // Alert Dialog State
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [rotateId, setRotateId] = useState<string | null>(null)
  const [rotationLoading, setRotationLoading] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<{ url: string; events: string[]; secret?: string }>({ url: '', events: [] })
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadWebhooks()
    loadUsage()
  }, [])

  async function loadWebhooks() {
    setLoading(true)
    const res = await apiClient.listWebhooks()
    setLoading(false)
    if (res.success) {
      setWebhooks(res.data || [])
    } else {
      toast.error(res.error || 'Failed to load webhooks')
    }
  }

  async function loadUsage() {
    setLoadingUsage(true)
    try {
      const res = await apiClient.getWebhookUsage()
      if (res.success && res.data) {
        setUsageData(res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingUsage(false)
    }
  }

  const resetForm = () => {
    setFormData({ url: '', events: [], secret: '' })
    setEditingWebhook(null)
  }

  const handleEventToggle = (eventId: string) => {
    setFormData(prev => {
      const current = new Set(prev.events)
      if (current.has(eventId)) {
        current.delete(eventId)
      } else {
        current.add(eventId)
      }
      return { ...prev, events: Array.from(current) }
    })
  }

  const selectAllEvents = () => {
    setFormData(prev => ({ ...prev, events: EVENT_TYPES.map(e => e.id) }))
  }

  const clearAllEvents = () => {
    setFormData(prev => ({ ...prev, events: [] }))
  }

  async function handleCreate() {
    if (!formData.url) return toast.error('Please enter a webhook URL')
    if (userPlan === 'Free') return toast.error("Webhooks are a Pro feature")

    try {
      new URL(formData.url);
    } catch (e) {
      return toast.error('Please enter a valid URL (e.g., https://api.example.com/webhook)');
    }

    setLoading(true)
    const res = await apiClient.createWebhook(formData.url, formData.events)
    setLoading(false)
    if (res.success) {
      setNewWebhookSecret(res.data?.secret || "")
      setSuccessModalOpen(true)
      setCreateModalOpen(false)
      resetForm()
      loadWebhooks()
      loadUsage()
    } else {
      toast.error(res.error || 'Failed to create webhook')
    }
  }

  async function handleUpdate() {
    if (!editingWebhook) return
    if (!formData.url) return toast.error('Please enter a webhook URL')

    try {
      new URL(formData.url);
    } catch (e) {
      return toast.error('Please enter a valid URL');
    }

    setLoading(true)
    const updatePayload: any = {
      url: formData.url,
      events: formData.events
    }
    if (formData.secret) {
      updatePayload.secret = formData.secret
    }

    const res = await apiClient.updateWebhook(editingWebhook.id, updatePayload)
    setLoading(false)
    if (res.success) {
      toast.success('Webhook updated successfully')
      setEditModalOpen(false)
      resetForm()
      loadWebhooks()
    } else {
      toast.error(res.error || 'Failed to update webhook')
    }
  }

  async function toggleWebhookEnabled(id: string, currentStatus: boolean) {
    if (!currentStatus && usageData && !usageData.allowed) {
      return toast.error(`You have exceeded your monthly limit of ${usageData.limit} events.`)
    }
    const res = await apiClient.updateWebhook(id, { enabled: !currentStatus })
    if (res.success) {
      toast.success(currentStatus ? 'Webhook paused' : 'Webhook resumed')
      loadWebhooks()
    } else {
      toast.error(res.error || 'Failed to update status')
    }
  }

  function openEditModal(webhook: any) {
    setEditingWebhook(webhook)
    setFormData({
      url: webhook.url,
      events: webhook.events || []
    })
    setEditModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return
    const res = await apiClient.deleteWebhook(deleteId)
    setDeleteId(null)
    if (res.success) {
      toast.success('Webhook deleted permanently')
      loadWebhooks()
    } else {
      toast.error(res.error || 'Failed to delete webhook')
    }
  }

  async function confirmRotate() {
    if (!rotateId) return
    setRotationLoading(rotateId)
    const res = await apiClient.rotateWebhookSecret(rotateId)
    setRotationLoading(null)
    setRotateId(null)
    if (res.success) {
      setNewWebhookSecret(res.data?.secret || "")
      setSuccessModalOpen(true)
      toast.success('New secret generated')
      loadWebhooks()
    } else {
      toast.error(res.error || 'Failed to rotate secret')
    }
  }

  async function testWebhook(id: string) {
    const promise = apiClient.testWebhook(id)
    toast.promise(promise, {
      loading: 'Sending test event...',
      success: 'Test event sent successfully',
      error: (err) => `Failed to send test: ${err?.error || 'Unknown error'}`
    })

    const res = await promise
    if (res.success) {
      await loadWebhookEvents(id, 1)
    }
  }

  async function loadWebhookEvents(id: string, page: number = 1) {
    setEvents(prev => ({ ...(prev || {}), [id]: { ...(prev[id] || { data: [], total: 0, page: 1, pageSize: 10 }), isLoading: true } }))
    const res = await apiClient.listWebhookEvents(id, page, 10)
    if (res.success) {
      setEvents(prev => ({
        ...(prev || {}),
        [id]: {
          data: Array.isArray(res.data) ? res.data : [],
          total: Number(res.total) || 0,
          page: Number(res.page) || page,
          pageSize: Number(res.pageSize) || 10,
          isLoading: false
        }
      }))
    } else {
      setEvents(prev => ({ ...(prev || {}), [id]: { ...(prev[id] || { data: [], total: 0, page: 1, pageSize: 10 }), isLoading: false } }))
      toast.error(res.error || 'Failed to load webhook events')
    }
  }

  async function deleteEvent(webhookId: string, eventId: string) {
    const res = await apiClient.deleteWebhookEvent(eventId)
    if (res.success) {
      toast.success('Event log deleted')
      loadWebhookEvents(webhookId, events[webhookId]?.page || 1)
    } else {
      toast.error(res.error || 'Failed to delete event log')
    }
  }

  async function resendEvent(webhookId: string, eventId: string) {
    const promise = apiClient.resendWebhookEvent(eventId)
    toast.promise(promise, {
      loading: 'Resending event...',
      success: 'Event resent successfully',
      error: (err) => `Failed to resend: ${err?.error || 'Unknown error'}`
    })
    const res = await promise
    if (res.success) {
      loadWebhookEvents(webhookId, events[webhookId]?.page || 1)
    }
  }

  async function toggleExpandEvent(webhookId: string, eventId: string | null) {
    setExpandedEvents(prev => ({ ...(prev || {}), [webhookId]: eventId }))

    if (eventId) {
      // Find existing event
      const eventList = events[webhookId]?.data || [];
      const event = eventList.find(e => e.id === eventId);

      // If event exists but missing details (e.g. request_headers is undefined/null)
      // Check for request_headers as a proxy for details being loaded
      if (event && !event.request_headers && !loadingDetails) {
        setLoadingDetails(eventId);
        try {
          const res = await apiClient.getWebhookEvent(eventId);
          if (res.success && res.data) {
            // Update state
            setEvents(prev => ({
              ...prev,
              [webhookId]: {
                ...prev[webhookId],
                data: prev[webhookId].data.map(e => e.id === eventId ? { ...e, ...res.data } : e)
              }
            }));
          }
        } catch (e) {
          console.error(e);
          toast.error("Failed to load details");
        } finally {
          setLoadingDetails(null);
        }
      }
    }
  }

  function toggleSecretVisibility(id: string) {
    setVisibleSecrets(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const EventSelector = () => (
    <div className="grid gap-3 py-4">
      <div className="flex items-center justify-between">
        <Label>Subscribed Events</Label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAllEvents} className="h-6 text-xs font-medium">Select All</Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAllEvents} className="h-6 text-xs font-medium">Clear</Button>
        </div>
      </div>
      <div className="max-h-[220px] overflow-y-auto border rounded-xl p-3 space-y-2 bg-muted/20 scrollbar-thin">
        {EVENT_TYPES.map(type => (
          <div key={type.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-muted-foreground/10 group">
            <Checkbox
              id={`event-${type.id}`}
              checked={formData.events.includes(type.id)}
              onCheckedChange={() => handleEventToggle(type.id)}
              className="mt-0.5"
            />
            <div className="grid gap-0.5 leading-none">
              <label
                htmlFor={`event-${type.id}`}
                className="text-sm font-semibold leading-none cursor-pointer group-hover:text-primary transition-colors"
              >
                {type.label}
              </label>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                {type.description}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 px-1">
        <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground font-medium">
          Selected: <span className="text-foreground">{formData.events.length}</span> of {EVENT_TYPES.length} events
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Usage Bar */}
      <div className="grid gap-6">
        {usageData && (
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${usageData.allowed ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                  <IconActivity className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Monthly Usage</h4>
                  <p className="text-xs text-muted-foreground">{usageData.plan} Plan Limit</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold ${!usageData.allowed ? 'text-destructive' : ''}`}>{usageData.usage.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm font-medium"> / {usageData.limit.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${!usageData.allowed ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, (usageData.usage / usageData.limit) * 100)}%` }}
              />
            </div>
            {!usageData.allowed && (
              <div className="flex items-start gap-2 text-xs text-destructive font-medium mt-3 bg-destructive/5 p-2.5 rounded-lg border border-destructive/10">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>You have reached your monthly event limit. Webhooks will not be delivered until next month or upgrade your plan.</span>
              </div>
            )}
            {userPlan === 'Free' && (
              <div className="flex items-start gap-2 text-xs text-amber-600 font-medium mt-3 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 dark:text-amber-400">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Webhooks are a generic feature available on Pro and Unlimited plans. Upgrade to enable.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
            <IconWebhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Manage Webhooks</h3>
            <p className="text-sm text-muted-foreground font-medium">Listen for events and automate your workflow</p>
          </div>
        </div>
        <Dialog open={createModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setCreateModalOpen(open) }}>
          <DialogTrigger asChild>
            <Button
              className="rounded-full px-5 shadow-lg shadow-primary/10"
              disabled={userPlan === 'Free' || (usageData ? !usageData.allowed : false)}
            >
              <IconPlus className="h-4 w-4 mr-2" />
              New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription className="font-medium">
                Configure an endpoint to receive real-time notifications.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="grid gap-2">
                <Label htmlFor="url" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Endpoint URL</Label>
                <div className="relative">
                  <IconLink className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="url"
                    className="pl-9 rounded-lg"
                    placeholder="https://your-api.com/webhooks"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              </div>
              <EventSelector />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateModalOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={handleCreate} disabled={loading} className="rounded-full px-6">Create Webhook</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Success Modal for Secret */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-emerald-500/20 shadow-xl shadow-emerald-500/5">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <IconCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl">Successfully Generated!</DialogTitle>
            <DialogDescription className="font-medium text-emerald-600 dark:text-emerald-400">
              Your new signing secret is ready. Store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-muted/30 border rounded-xl p-4 relative group">
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Signing Secret</Label>
                <div className="flex items-center gap-3">
                  <code className="flex-1 font-mono text-sm break-all select-all">
                    {newWebhookSecret}
                  </code>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-9 w-9 rounded-lg shrink-0"
                    onClick={() => { navigator.clipboard.writeText(newWebhookSecret); toast.success('Secret copied') }}
                  >
                    <IconCopy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <IconInfoCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">
                <span className="font-bold text-amber-600 dark:text-amber-400">Security Tip:</span> Keep this secret safe. You can view it again or rotate it anytime from the webhook settings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full rounded-xl h-11" onClick={() => setSuccessModalOpen(false)}>
              I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <IconTrash className="h-5 w-5 text-destructive" />
              </div>
              Delete Webhook?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium pt-2 leading-relaxed">
              This will stop all event delivery to this endpoint. This action is irreversible. All delivery logs for this webhook will also be purged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 rounded-full px-6 shadow-lg shadow-destructive/20">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotation Confirm */}
      <AlertDialog open={!!rotateId} onOpenChange={(open) => !open && setRotateId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-500/10">
                <IconRefresh className="h-5 w-5 text-amber-500" />
              </div>
              Rotate Signing Secret?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium pt-2 leading-relaxed">
              The existing secret will be invalidated <span className="font-bold text-foreground underline decoration-amber-500/30 decoration-2">immediately</span>. Any applications using the old secret will fail to verify signatures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRotate} className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 shadow-lg shadow-amber-600/20">
              Generate New Secret
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setEditModalOpen(open) }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Webhook Settings</DialogTitle>
            <DialogDescription className="font-medium">Modify your webhook endpoint and subscriptions.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-url" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Endpoint URL</Label>
              <div className="relative">
                <IconLink className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="edit-url"
                  className="pl-9 rounded-lg"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
            </div>

            {userPlan === 'Unlimited' && (
              <div className="grid gap-2">
                <Label htmlFor="edit-secret" className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center justify-between">
                  <span>Custom Signing Secret</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 border-amber-500/30 text-amber-600 bg-amber-500/10 dark:text-amber-400">UNLIMITED ONLY</Badge>
                </Label>
                <div className="relative">
                  <IconShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="edit-secret"
                    className="pl-9 rounded-lg font-mono text-sm"
                    placeholder="Enter a custom secret (max 64 chars)"
                    maxLength={64}
                    value={formData.secret || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  This will immediately rotate your secret. Make sure to update your integrations.
                </p>
              </div>
            )}

            <EventSelector />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleUpdate} disabled={loading} className="rounded-full px-6">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhooks Table Implementation */}
      <div className="border rounded-2xl bg-card shadow-sm overflow-hidden">
        {webhooks.length === 0 ? (
          <div className="p-16 text-center bg-muted/5 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center mb-6">
              <IconWebhook className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold">No endpoints found</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto font-medium leading-relaxed">
              Configure your first webhook to start receiving real-time events.
            </p>
            <Button variant="outline" onClick={() => setCreateModalOpen(true)} className="mt-8 rounded-full h-11 px-8">
              Create Webhook
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left w-10"></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Webhook ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Endpoint URL</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Enabled</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {webhooks.map(w => (
                  <React.Fragment key={w.id}>
                    <tr
                      className={`hover:bg-muted/30 transition-colors cursor-pointer group ${expanded === w.id ? 'bg-muted/20' : ''}`}
                      onClick={() => { setExpanded(expanded === w.id ? null : w.id); if (expanded !== w.id) loadWebhookEvents(w.id, 1) }}
                    >
                      <td className="px-4 py-3 text-center">
                        {expanded === w.id ? <IconChevronDown className="h-3 w-3 rotate-180 transition-transform" /> : <IconChevronDown className="h-3 w-3 transition-transform" />}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                  {w.id.substring(0, 8)}...
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="font-mono text-xs">{w.id}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-medium text-sm truncate max-w-[280px] cursor-help">{w.url}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[400px] break-all">{w.url}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <IconCode className="h-3 w-3" />
                            {w.events ? `${w.events.length} events subscribed` : 'All events'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={w.enabled ? "default" : "secondary"} className={`text-[10px] px-2 font-bold uppercase tracking-wider h-5 rounded-md border-transparent ${w.enabled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}`}>
                          {w.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={w.enabled}
                          onCheckedChange={() => toggleWebhookEnabled(w.id, w.enabled)}
                          className="scale-75"
                        />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg hover:bg-muted"
                                  onClick={() => openEditModal(w)}
                                >
                                  <IconSettings className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Settings</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteId(w.id)}
                                >
                                  <IconTrash className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>

                    {expanded === w.id && (
                      <tr className="bg-muted/10 border-b">
                        <td colSpan={6} className="px-8 py-8 border-t">
                          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Signing Secret & Config Section */}
                            <div className="grid md:grid-cols-2 gap-8 pb-8 border-b">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <IconShieldCheck className="h-4 w-4 text-primary" />
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Configuration</h4>
                                </div>
                                <div className="bg-background/50 rounded-xl p-5 border border-dashed border-muted/70 space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Signing Secret</Label>
                                      <Badge variant="outline" className="text-[9px] font-bold h-4 bg-primary/5 text-primary border-primary/20 uppercase tracking-tighter px-1.5">Origin Validation</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex-1">
                                        <Input
                                          readOnly
                                          value={visibleSecrets[w.id] ? w.secret : "•".repeat(48)}
                                          className="font-mono text-xs pr-10 h-10 bg-background rounded-xl border-muted-foreground/20"
                                        />
                                        <div className="absolute right-2 top-2 z-10">
                                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md" onClick={() => toggleSecretVisibility(w.id)}>
                                            {visibleSecrets[w.id] ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                                          </Button>
                                        </div>
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-10 w-10 rounded-xl bg-background shadow-sm hover:border-primary/30 transition-colors"
                                        onClick={() => { navigator.clipboard.writeText(w.secret); toast.success('Secret copied') }}
                                      >
                                        <IconCopy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-10 w-10 rounded-xl bg-background shadow-sm hover:text-amber-600 hover:border-amber-600/30 group/rotate"
                                        onClick={() => setRotateId(w.id)}
                                        disabled={rotationLoading === w.id}
                                      >
                                        {rotationLoading === w.id ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconRefresh className="h-4 w-4 group-hover/rotate:rotate-45 transition-transform" />}
                                      </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/70 font-medium">For your convenience, you can view this secret here anytime. Ensure it is stored securely on your server to verify incoming requests.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <IconActivity className="h-4 w-4 text-primary" />
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Actions & Health</h4>
                                </div>
                                <div className="bg-background/50 rounded-xl p-5 border border-muted/50 flex flex-col justify-center h-[calc(100%-2rem)]">
                                  <div className="grid grid-cols-2 gap-3">
                                    <Button
                                      variant="outline"
                                      className="h-12 rounded-xl text-xs font-bold bg-background shadow-sm border-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-all"
                                      onClick={() => testWebhook(w.id)}
                                    >
                                      <IconRefresh className="h-3.5 w-3.5 mr-2 opacity-60" />
                                      Test Endpoint
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="h-12 rounded-xl text-xs font-bold bg-background shadow-sm hover:bg-muted"
                                      onClick={() => openEditModal(w)}
                                    >
                                      <IconSettings className="h-3.5 w-3.5 mr-2 opacity-60" />
                                      Edit Events
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Delivery Logs Header */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                  Delivery History
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted"
                                  onClick={() => loadWebhookEvents(w.id, events[w.id]?.page || 1)}
                                  disabled={events[w.id]?.isLoading}
                                >
                                  {events[w.id]?.isLoading ? <IconLoader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <IconRefresh className="h-3.5 w-3.5 mr-2" />}
                                  Refresh Logs
                                </Button>
                              </div>

                              {(events[w.id]?.isLoading && !(events[w.id]?.data || []).length) ? (
                                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-4 bg-background/30 rounded-2xl border border-dashed">
                                  <IconLoader2 className="h-8 w-8 text-primary animate-spin" />
                                  <span className="text-sm font-bold tracking-tight">Accessing audit logs...</span>
                                </div>
                              ) : (events[w.id]?.data || []).length === 0 ? (
                                <div className="py-12 text-center flex flex-col items-center bg-background/30 rounded-2xl border border-dashed">
                                  <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-4 text-muted-foreground/40">
                                    <IconActivity className="h-6 w-6" />
                                  </div>
                                  <h4 className="font-bold text-muted-foreground text-sm">No Delivery Logs Found</h4>
                                  <p className="text-[11px] text-muted-foreground/60 mt-1 max-w-xs mx-auto font-medium">Any events sent to this endpoint will be listed here for debugging.</p>
                                </div>
                              ) : (
                                <div className="border rounded-2xl bg-background shadow-sm overflow-hidden">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="px-4 py-3 text-left w-10"></th>
                                          <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Event ID</th>
                                          <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Event Type</th>
                                          <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Status</th>
                                          <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Timestamp</th>
                                          <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[10px] uppercase tracking-wider">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {events[w.id].data.map(ev => {
                                          const isExpanded = expandedEvents[w.id] === ev.id;
                                          return (
                                            <React.Fragment key={ev.id}>
                                              <tr
                                                className={`hover:bg-muted/20 transition-all cursor-pointer group/row ${isExpanded ? 'bg-muted/30' : ''}`}
                                                onClick={() => toggleExpandEvent(w.id, isExpanded ? null : ev.id)}
                                              >
                                                <td className="px-4 py-3 text-center">
                                                  <IconChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                  <div className="flex items-center gap-2">
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                                            {ev.id.substring(0, 8)}...
                                                          </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-mono text-xs">{ev.id}</TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <Badge variant="outline" className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border-muted-foreground/20 bg-background transition-all group-hover/row:border-primary/40 group-hover/row:text-primary capitalize">
                                                    {ev.event_type.replace(/_/g, ' ')}
                                                  </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${ev.status === 'success'
                                                    ? 'text-emerald-600 bg-emerald-500/10'
                                                    : 'text-rose-600 bg-rose-500/10'
                                                    }`}>
                                                    <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${ev.status === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                                    {ev.status === 'success' ? 'Delivered' : 'Failed'}
                                                    {ev.response_code && <span className="ml-2 font-mono opacity-80 border-l border-current/20 pl-2">{ev.response_code}</span>}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-medium text-muted-foreground/80">
                                                  {new Date(ev.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </td>
                                                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                  <div className="flex items-center justify-end gap-1">
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={() => resendEvent(w.id, ev.id)}>
                                                            <IconSend className="h-4 w-4 text-muted-foreground" />
                                                          </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Resend Event</TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteEvent(w.id, ev.id)}>
                                                            <IconTrash className="h-4 w-4" />
                                                          </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete Log</TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  </div>
                                                </td>
                                              </tr>
                                              {isExpanded && (
                                                <tr>
                                                  <td colSpan={6} className="p-0 bg-muted/5 border-t">
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">

                                                      {/* Tab Header & Toolbar */}
                                                      <div className="flex items-center justify-between px-6 py-2 border-b bg-background/50">
                                                        <div className="flex items-center gap-1">
                                                          <button
                                                            onClick={() => setActiveTab('request')}
                                                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'request' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                                          >
                                                            Request
                                                          </button>
                                                          <button
                                                            onClick={() => setActiveTab('response')}
                                                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'response' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                                          >
                                                            Response
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${ev.status === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                              {ev.response_code || (ev.status === 'success' ? 200 : 500)}
                                                            </span>
                                                          </button>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                          {loadingDetails === ev.id && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                          <span className="text-[10px] font-mono text-muted-foreground">
                                                            {ev.duration_ms ? `${(ev.duration_ms / 1000).toFixed(2)}s` : '0.00s'}
                                                          </span>
                                                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resendEvent(w.id, ev.id)}>
                                                            <IconRefresh className="h-3 w-3 mr-2" />
                                                            Redeliver
                                                          </Button>
                                                        </div>
                                                      </div>

                                                      <div className="p-6 max-w-5xl mx-auto space-y-6">
                                                        {loadingDetails === ev.id ? (
                                                          <div className="py-12 text-center text-muted-foreground text-sm">Loading details...</div>
                                                        ) : (
                                                          <>
                                                            {activeTab === 'request' && (
                                                              <>
                                                                <div className="space-y-2">
                                                                  <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-foreground">Headers</h4>
                                                                  </div>
                                                                  <div className="bg-background border rounded-md p-4 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre shadow-sm">
                                                                    {ev.request_headers ? JSON.stringify(JSON.parse(ev.request_headers), null, 2) : 'No headers recorded'}
                                                                  </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                  <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-foreground">Payload</h4>
                                                                  </div>
                                                                  <div className="rounded-md overflow-hidden border shadow-sm bg-background">
                                                                    <JsonHighlighter data={JSON.parse(ev.request_body || '{}')} />
                                                                  </div>
                                                                </div>
                                                              </>
                                                            )}

                                                            {activeTab === 'response' && (
                                                              <>
                                                                <div className="space-y-2">
                                                                  <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-foreground">Headers</h4>
                                                                  </div>
                                                                  <div className="bg-background border rounded-md p-4 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre shadow-sm">
                                                                    {ev.response_headers ? JSON.stringify(JSON.parse(ev.response_headers), null, 2) : 'No response headers'}
                                                                  </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                  <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-foreground">Body</h4>
                                                                  </div>
                                                                  <div className="bg-background border rounded-md p-4 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap shadow-sm">
                                                                    {ev.response_body || 'No response body'}
                                                                  </div>
                                                                </div>
                                                              </>
                                                            )}
                                                          </>
                                                        )}
                                                      </div>

                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Pagination */}
                                  {(events[w.id]?.data.length > 0) && (
                                    <div className="px-5 py-4 border-t bg-muted/30 flex items-center justify-between">
                                      <p className="text-xs text-muted-foreground font-medium">
                                        Showing <span className="text-foreground font-bold">{events[w.id].data.length}</span> of <span className="text-foreground font-bold">{events[w.id].total || events[w.id].data.length}</span> events
                                      </p>
                                      <div className="flex items-center gap-4">
                                        <p className="text-xs text-muted-foreground font-medium">
                                          Page <span className="text-foreground font-bold">{events[w.id].page}</span> of <span className="text-foreground font-bold">{Math.ceil((events[w.id].total || events[w.id].data.length) / events[w.id].pageSize)}</span>
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg shadow-sm bg-background hover:bg-muted transition-colors"
                                            onClick={() => loadWebhookEvents(w.id, events[w.id].page - 1)}
                                            disabled={events[w.id].page === 1 || events[w.id].isLoading}
                                          >
                                            <IconChevronLeft className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg shadow-sm bg-background hover:bg-muted transition-colors"
                                            onClick={() => loadWebhookEvents(w.id, events[w.id].page + 1)}
                                            disabled={events[w.id].isLoading || (events[w.id].page * events[w.id].pageSize) >= (events[w.id].total || 0)}
                                          >
                                            <IconChevronRight className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div >
  )
}

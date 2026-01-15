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
  IconExternalLink,
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconSettings,
  IconTrash,
  IconCheck,
  IconX,
  IconEye,
  IconEyeOff,
  IconLink,
  IconAlertCircle,
  IconInfoCircle,
  IconLoader2
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
];

export function DeveloperTab() {
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [events, setEvents] = useState<Record<string, { data: any[]; total: number; page: number; pageSize: number; isLoading?: boolean }>>({})
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Record<string, string | null>>({})
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<any>(null)

  // Success Dialog State
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [newWebhookSecret, setNewWebhookSecret] = useState("")

  // Alert Dialog State
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [rotateId, setRotateId] = useState<string | null>(null)
  const [rotationLoading, setRotationLoading] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<{ url: string; events: string[] }>({ url: '', events: [] })
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadWebhooks()
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

  const resetForm = () => {
    setFormData({ url: '', events: [] })
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
    const res = await apiClient.updateWebhook(editingWebhook.id, {
      url: formData.url,
      events: formData.events
    })
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
      // The API returns { success: true, data: rows, total, page, pageSize }
      // So 'res.data' IS the array of events
      setEvents(prev => ({
        ...(prev || {}),
        [id]: {
          data: res.data || [],
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

  function toggleExpandEvent(webhookId: string, eventId: string | null) {
    setExpandedEvents(prev => ({ ...(prev || {}), [webhookId]: eventId }))
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
            <Button className="rounded-full px-5 shadow-lg shadow-primary/10">
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
              <IconAlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">
                <span className="font-bold text-amber-600 dark:text-amber-400">Security Warning:</span> We will only show this secret once. If you lose it, you will need to rotate it.
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
            <EventSelector />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleUpdate} disabled={loading} className="rounded-full px-6">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="border border-dashed rounded-2xl p-16 text-center bg-muted/5 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center mb-6">
              <IconWebhook className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold">No endpoints found</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto font-medium leading-relaxed">Configure your first webhook to start receiving real-time events from Ellipticc Drive.</p>
            <Button variant="outline" onClick={() => setCreateModalOpen(true)} className="mt-8 rounded-full h-11 px-8 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
              Create your first webhook
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {webhooks.map(w => (
              <div key={w.id} className="group border rounded-2xl bg-card shadow-sm overflow-hidden transition-all hover:border-primary/30 hover:shadow-md">
                {/* Header Row */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 border-b">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="h-10 w-10 min-w-[40px] rounded-xl bg-background border border-muted-foreground/10 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
                      <IconLink className={`h-4 w-4 ${w.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <h4 className="font-bold truncate text-sm cursor-help">{w.url}</h4>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-md break-all">
                              {w.url}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge variant={w.enabled ? "default" : "secondary"} className={`text-[10px] h-5 px-2 font-bold uppercase tracking-wider rounded-md border-transparent ${w.enabled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}`}>
                          {w.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2.5 mt-1 text-[11px] text-muted-foreground/70 font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 cursor-help"><span className="opacity-60">ID:</span> <span className="font-mono text-[10px]">{w.id.substring(0, 8)}...</span></span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs">{w.id}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="opacity-30">•</span>
                        <span className="flex items-center gap-1"><IconCode className="h-3 w-3 opacity-60" /> {w.events ? `${JSON.parse(JSON.stringify(w.events)).length} events` : 'All events'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-background/50 border rounded-full mr-2">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Power</span>
                      <Switch
                        checked={w.enabled}
                        onCheckedChange={() => toggleWebhookEnabled(w.id, w.enabled)}
                        className="scale-75"
                      />
                    </div>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => testWebhook(w.id)}>
                            <IconRefresh className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send Test Event</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button size="sm" variant="outline" className="h-9 rounded-xl border-muted-foreground/20 hover:border-primary/40" onClick={() => openEditModal(w)}>
                      <IconSettings className="h-3.5 w-3.5 mr-2" />
                      Configure
                    </Button>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(w.id)}>
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Endpoint</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Details Row */}
                <div className="p-5 grid lg:grid-cols-2 gap-8 bg-card/40">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Signing Secret</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground/30 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="w-56 text-xs p-3 leading-relaxed">
                            Used to verify that payloads come from Ellipticc. Set as the <code className="text-primary font-bold">X-Ellipticc-Signature</code> header.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 group/secret">
                        <Input
                          readOnly
                          value={visibleSecrets[w.id] ? w.secret : "•".repeat(48)}
                          className="font-mono text-xs pr-10 h-10 bg-muted/40 rounded-xl tracking-tight"
                        />
                        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/secret:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md hover:bg-background/80" onClick={() => toggleSecretVisibility(w.id)}>
                            {visibleSecrets[w.id] ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl hover:bg-primary/5 hover:text-primary" onClick={() => { navigator.clipboard.writeText(w.secret); toast.success('Secret copied') }}>
                              <IconCopy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy Secret</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-10 w-10 rounded-xl hover:text-amber-600 hover:border-amber-600/30 hover:bg-amber-600/5 group/rotate"
                              onClick={() => setRotateId(w.id)}
                              disabled={rotationLoading === w.id}
                            >
                              {rotationLoading === w.id ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconRefresh className="h-4 w-4 group-hover/rotate:rotate-45 transition-transform" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rotate Secret</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-3">Health & Delivery</Label>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`flex-1 justify-between h-10 rounded-xl px-4 text-xs font-bold transition-all border-muted-foreground/20 hover:border-foreground ${expanded === w.id ? 'bg-foreground text-background shadow-lg shadow-foreground/10' : ''}`}
                        onClick={() => { setExpanded(expanded === w.id ? null : w.id); if (expanded !== w.id) loadWebhookEvents(w.id, 1) }}
                      >
                        <span className="flex items-center gap-2">
                          <IconExternalLink className="h-3.5 w-3.5" />
                          {expanded === w.id ? 'Hide Delivery Logs' : 'View Delivery Logs'}
                        </span>
                        {expanded === w.id ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Events Table */}
                {expanded === w.id && (
                  <div className="border-t bg-muted/5 animate-in slide-in-from-top-4 duration-300">
                    {(events[w.id]?.isLoading) ? (
                      <div className="px-5 py-16 text-center text-muted-foreground flex flex-col items-center gap-4">
                        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <span className="text-sm font-bold tracking-tight">Fetching activity logs...</span>
                      </div>
                    ) : (events[w.id]?.data || []).length === 0 ? (
                      <div className="px-5 py-16 text-center flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-4 text-muted-foreground/40">
                          <IconAlertCircle className="h-6 w-6" />
                        </div>
                        <h4 className="font-bold text-muted-foreground">No Delivery History</h4>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto">Trigger some actions or send a test request to see delivery data here.</p>
                      </div>
                    ) : (
                      <div className="border-t border-muted/50">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/30 text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">
                              <tr>
                                <th className="px-5 py-3 text-left w-10"></th>
                                <th className="px-5 py-3 text-left">Event Type</th>
                                <th className="px-5 py-3 text-left">Status</th>
                                <th className="px-5 py-3 text-left">Timestamp</th>
                                <th className="px-5 py-3 text-right">Delivery ID</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-muted/30">
                              {events[w.id].data.map(ev => {
                                const isExpanded = expandedEvents[w.id] === ev.id;
                                return (
                                  <React.Fragment key={ev.id}>
                                    <tr
                                      className={`hover:bg-primary/5 transition-all cursor-pointer group/row ${isExpanded ? 'bg-primary/[0.03]' : ''}`}
                                      onClick={() => toggleExpandEvent(w.id, isExpanded ? null : ev.id)}
                                    >
                                      <td className="px-5 py-4 text-muted-foreground">
                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                          <IconChevronDown className="h-3.5 w-3.5" />
                                        </div>
                                      </td>
                                      <td className="px-5 py-4">
                                        <Badge variant="outline" className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border-muted-foreground/20 bg-background/50 group-hover/row:border-primary/40 group-hover/row:text-primary transition-all">
                                          {ev.event_type}
                                        </Badge>
                                      </td>
                                      <td className="px-5 py-4">
                                        <div className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${ev.status === 'success'
                                          ? 'text-emerald-600 bg-emerald-50 border-emerald-500/10 dark:bg-emerald-500/5 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/5'
                                          : 'text-rose-600 bg-rose-50 border-rose-500/10 dark:bg-rose-500/5 dark:border-rose-500/20 shadow-sm shadow-rose-500/5'
                                          }`}>
                                          <div className={`h-1.5 w-1.5 rounded-full mr-2 ${ev.status === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                          {ev.status === 'success' ? 'Delivered' : 'Failed'}
                                          {ev.response_code && <span className="ml-2 font-mono opacity-80 border-l border-current/20 pl-2">{ev.response_code}</span>}
                                        </div>
                                      </td>
                                      <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                                        {new Date(ev.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                      </td>
                                      <td className="px-5 py-4 text-right">
                                        <span className="font-mono text-[10px] text-muted-foreground/40 select-all group-hover/row:text-foreground transition-colors">{ev.id.split('-')[0]}</span>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr className="bg-primary/[0.02] shadow-inner">
                                        <td colSpan={5} className="p-0">
                                          <div className="px-10 py-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="grid grid-cols-1 gap-8 max-w-5xl">
                                              {/* Meta Board */}
                                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-muted">
                                                <div className="space-y-1">
                                                  <span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Request ID</span>
                                                  <span className="block font-mono text-[11px] select-all font-bold group-hover:text-primary transition-colors cursor-copy">{ev.request_id}</span>
                                                </div>
                                                <div className="space-y-1">
                                                  <span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Signature ID</span>
                                                  <span className="block font-mono text-[11px] select-all font-bold">{ev.signature_id}</span>
                                                </div>
                                                <div className="space-y-1">
                                                  <span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Time Elapsed</span>
                                                  <span className="block text-[11px] font-bold text-emerald-500">~84ms</span>
                                                </div>
                                                <div className="space-y-1">
                                                  <span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Method</span>
                                                  <span className="block text-[11px] font-bold px-2 py-0.5 bg-foreground text-background inline-block rounded-md">POST</span>
                                                </div>
                                              </div>

                                              <div className="grid md:grid-cols-2 gap-8">
                                                <div className="space-y-3">
                                                  <div className="flex items-center justify-between">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Request Headers</h4>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-muted" onClick={() => { navigator.clipboard.writeText(ev.request_headers || ''); toast.success('Headers copied') }}><IconCopy className="h-3.5 w-3.5" /></Button>
                                                  </div>
                                                  <div className="bg-background/80 border rounded-xl p-4 font-mono text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-sm ring-1 ring-black/5">
                                                    {ev.request_headers}
                                                  </div>
                                                </div>
                                                <div className="space-y-3">
                                                  <div className="flex items-center justify-between">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payload Data</h4>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-muted" onClick={() => { navigator.clipboard.writeText(ev.request_body || ''); toast.success('Payload copied') }}><IconCopy className="h-3.5 w-3.5" /></Button>
                                                  </div>
                                                  <div className="rounded-xl overflow-hidden border shadow-sm ring-1 ring-black/5 bg-background">
                                                    <JsonHighlighter data={JSON.parse(ev.request_body || '{}')} />
                                                  </div>
                                                </div>
                                              </div>

                                              {ev.response_body && (
                                                <div className="border-t border-muted pt-6 mt-2">
                                                  <div className="flex items-center gap-2 mb-3">
                                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] px-2">REMOTE RESPONSE</Badge>
                                                  </div>
                                                  <div className="bg-black/[0.02] dark:bg-white/[0.02] border rounded-xl p-4 font-mono text-[10px] overflow-x-auto max-h-[150px] leading-relaxed">
                                                    {ev.response_body}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {events[w.id].total > 10 && (
                          <div className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Page <span className="text-foreground">{events[w.id].page}</span> of {Math.ceil(events[w.id].total / 10)}</p>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shadow-sm" onClick={() => loadWebhookEvents(w.id, events[w.id].page - 1)} disabled={events[w.id].page === 1 || events[w.id].isLoading}><IconChevronLeft className="h-3.5 w-3.5" /></Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shadow-sm" onClick={() => loadWebhookEvents(w.id, events[w.id].page + 1)} disabled={events[w.id].isLoading || (events[w.id].page * events[w.id].pageSize) >= events[w.id].total}><IconChevronRight className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

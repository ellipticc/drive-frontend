"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { IconCode, IconWebhook, IconCopy, IconExternalLink, IconRefresh, IconChevronUp, IconChevronDown, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import dynamic from 'next/dynamic'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
// @ts-expect-error JSONHighlighter has no type defs
import JSONHighlighter from 'react-json-syntax-highlighter'

const JsonHighlighter = ({ data }: { data: unknown }) => (
  <div className="json-theme-custom rounded-xl overflow-hidden border border-muted-foreground/10 bg-muted/20">
    <JSONHighlighter obj={data} className="text-[11px] font-mono p-4" />
  </div>
)

export function DeveloperTab() {
  const [url, setUrl] = useState("")
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [events, setEvents] = useState<Record<string, { data: any[]; total: number; page: number; pageSize: number; isLoading?: boolean }>>({})
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Record<string, string | null>>({})

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

  async function create() {
    if (!url) return toast.error('Please enter a webhook URL')
    setLoading(true)
    const res = await apiClient.createWebhook(url)
    setLoading(false)
    if (res.success) {
      toast.success('Webhook created - copy the secret and configure your receiver')
      setUrl("")
      loadWebhooks()
    } else {
      toast.error(res.error || 'Failed to create webhook')
    }
  }

  async function remove(id: string) {
    const res = await apiClient.deleteWebhook(id)
    if (res.success) {
      toast.success('Webhook deleted')
      loadWebhooks()
    } else {
      toast.error(res.error || 'Failed to delete webhook')
    }
  }

  async function testWebhook(id: string) {
    const res = await apiClient.testWebhook(id)
    if (res.success) {
      toast.success('Test event sent')
      // refresh events list for first page
      await loadWebhookEvents(id, 1)
    } else {
      toast.error(res.error || 'Failed to send test')
    }
  }

  async function loadWebhookEvents(id: string, page: number = 1) {
    // mark loading
    setEvents(prev => ({ ...(prev || {}), [id]: { ...(prev[id] || { data: [], total: 0, page: 1, pageSize: 10 }), isLoading: true } }))
    const res = await apiClient.listWebhookEvents(id, page, 10)
    if (res.success && res.data) {
      const payload = res.data;
      setEvents(prev => ({ ...(prev || {}), [id]: { data: payload.data || [], total: payload.total || 0, page: payload.page || page, pageSize: payload.pageSize || 10, isLoading: false } }))
    } else {
      setEvents(prev => ({ ...(prev || {}), [id]: { ...(prev[id] || { data: [], total: 0, page: 1, pageSize: 10 }), isLoading: false } }))
      toast.error(res.error || 'Failed to load webhook events')
    }
  }

  function toggleExpandEvent(webhookId: string, eventId: string | null) {
    setExpandedEvents(prev => ({ ...(prev || {}), [webhookId]: eventId }))
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <IconCode className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Developer</h3>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <Label>Webhook endpoint</Label>
          <div className="flex gap-2 mt-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" />
            <Button onClick={create} disabled={loading}>Create</Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">We will create a signing secret and show it to you once created. Use HMAC-SHA256 to verify events with header <code>X-Ellipticc-Signature</code>.</p>
        </div>

        <div className="card p-4">
          <Label>Your webhooks</Label>
          <div className="mt-2">
            {webhooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No webhooks configured yet</p>
            ) : (
              <div className="space-y-2">
                {webhooks.map(w => (
                  <div key={w.id} className="border rounded p-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <IconWebhook className="h-4 w-4" />
                        <span className="font-medium truncate max-w-sm" title={w.url}>{w.url}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(w.secret || '') ; toast.success('Secret copied') }}><IconCopy className="h-4 w-4"/></Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm('Rotate secret for this webhook? This will immediately revoke the existing secret.')) return;
                          const res = await apiClient.rotateWebhookSecret(w.id);
                          if (res.success) {
                            await navigator.clipboard.writeText(res.data?.secret || '');
                            toast.success('New secret generated and copied to clipboard');
                            loadWebhooks();
                          } else {
                            toast.error(res.error || 'Failed to rotate secret');
                          }
                        }} title="Rotate secret"><IconRefresh className="h-4 w-4"/></Button>
                        <Button size="sm" onClick={() => testWebhook(w.id)}><IconRefresh className="h-4 w-4 mr-2"/>Send test</Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(w.id)}><IconExternalLink className="h-4 w-4 mr-2"/>Delete</Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Button size="sm" variant="ghost" onClick={() => { setExpanded(expanded === w.id ? null : w.id); loadWebhookEvents(w.id, 1) }}>{expanded === w.id ? 'Hide events' : 'Show recent events'}</Button>

                      {expanded === w.id && (
                        <div className="mt-2">
                          {/* Events table */}
                          {(events[w.id]?.isLoading) ? (
                            <div className="px-4 py-6 text-center text-muted-foreground">Loading events...</div>
                          ) : (events[w.id]?.data || []).length === 0 ? (
                            <p className="text-muted-foreground text-sm">No events yet</p>
                          ) : (
                            <div className="border rounded overflow-hidden bg-card">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50 border-b">
                                    <tr>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Event ID</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Event</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Endpoint</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Status</th>
                                      <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Time</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {events[w.id].data.map(ev => {
                                      const isExpanded = expandedEvents[w.id] === ev.id;
                                      return (
                                        <React.Fragment key={ev.id}>
                                          <tr className="hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => toggleExpandEvent(w.id, isExpanded ? null : ev.id)}>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                              <div className="flex items-center gap-2">
                                                {isExpanded ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />}
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">{ev.id.substring(0,8)}...</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top"><p className="font-mono text-xs">{ev.id}</p></TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3"><div className="font-medium text-sm capitalize">{ev.event_type.replace(/_/g, ' ')}</div></td>
                                            <td className="px-4 py-3"><div className="text-sm truncate max-w-xs" title={ev.endpoint}>{ev.endpoint}</div></td>
                                            <td className="px-4 py-3"><span className={`text-xs font-bold uppercase py-0.5 px-1.5 rounded ${ev.status === 'success' ? 'text-emerald-600 bg-emerald-100/50' : 'text-red-500 bg-red-100/50'}`}>{ev.status}</span></td>
                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{new Date(ev.created_at).toLocaleString()}</td>
                                          </tr>
                                          {isExpanded && (
                                            <tr className="bg-muted/10 border-b">
                                              <td colSpan={5} className="px-8 py-6">
                                                <div className="grid grid-cols-1 gap-4">
                                                  <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Headers</h4>
                                                      <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(ev.request_headers || '') ; toast.success('Headers copied') }}><IconCopy className="h-4 w-4"/></Button>
                                                    </div>
                                                    <div className="bg-black/5 rounded p-3 font-mono text-xs whitespace-pre-wrap">{ev.request_headers}</div>
                                                  </div>

                                                  <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Body</h4>
                                                    <div className="rounded overflow-hidden border p-3 mt-2">
                                                      <JsonHighlighter data={JSON.parse(ev.request_body || '{}')} />
                                                    </div>
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

                              {events[w.id].total > 10 && (
                                <div className="flex items-center justify-between mt-4">
                                  <p className="text-xs text-muted-foreground">Showing {events[w.id].data.length} of {events[w.id].total} events</p>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => loadWebhookEvents(w.id, events[w.id].page - 1)} disabled={events[w.id].page === 1 || events[w.id].isLoading}><IconChevronLeft className="h-4 w-4"/></Button>
                                    <span className="text-xs text-muted-foreground min-w-[3rem] text-center">Page {events[w.id].page} of {Math.ceil(events[w.id].total / events[w.id].pageSize)}</span>
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => loadWebhookEvents(w.id, events[w.id].page + 1)} disabled={events[w.id].isLoading || (events[w.id].page * events[w.id].pageSize) >= events[w.id].total}><IconChevronRight className="h-4 w-4"/></Button>
                                  </div>
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

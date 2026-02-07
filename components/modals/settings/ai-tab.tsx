"use client"

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { listMemories, deleteMemory, clearMemories } from '@/lib/ai-memory'

const defaultSettings = {
  memory_enabled: false,
  thinking_style: 0.5,
  model: 'auto',
  output_format: 'concise',
  coding_defaults: { language: 'typescript', style: 'functional', add_comments: true },
  visualization_auto: true,
  incognito_mode: false,
  pii_redaction: 'standard',
  web_search_anonymize: false,
  drive_access_scope: 'current_file',
  auto_action_permissions: 'ask',
}

export function AITab() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(defaultSettings)
  const [openMemoryDialog, setOpenMemoryDialog] = useState(false)
  const [memories, setMemories] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.getAIPreferences()
        // Support both legacy (res.settings) and normalized (res.data.settings) payload shapes
        setSettings(res?.data?.settings ?? (res as any)?.settings ?? defaultSettings)
      } catch (e) {
        console.error('Failed to load AI preferences', e)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const save = async (patch: any) => {
    const newSettings = { ...settings, ...patch }
    setSettings(newSettings)
    try {
      await apiClient.updateAIPreferences(newSettings)
    } catch (e) {
      console.error('Failed to save AI preferences', e)
    }
  }

  const openMemory = async () => {
    const all = await listMemories()
    setMemories(all)
    setOpenMemoryDialog(true)
  }

  const handleDeleteMemory = async (id: string) => {
    await deleteMemory(id)
    const all = await listMemories()
    setMemories(all)
  }

  const handleClearMemories = async () => {
    await clearMemories()
    setMemories([])
  }

  const exportMemory = async () => {
    const all = await listMemories()
    const data = all.map(({ id, text, tags, createdAt }) => ({ id, text, tags, createdAt }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-ai-memory.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="space-y-8 pb-8">
      <h2 className="text-xl font-semibold">The Brain — Cognition & Memory</h2>

      {/* Sovereign Memory */}
      <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
        <div className="flex items-start justify-between">
          <div className="space-y-1 max-w-[68%]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Sovereign Memory</h3>
              <Badge variant="secondary">Stored 100% locally. We cannot see this.</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Allow the AI to remember facts about you. Stored only in your browser's IndexedDB.</p>
            <p className="text-xs text-muted-foreground mt-1 italic">Pro Tip: You can export your memory anytime using "Export My Brain" — you own your data.</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Switch checked={!!settings.memory_enabled} id="memory-enabled" onCheckedChange={(v:any)=> save({ memory_enabled: !!v })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={openMemory}>View Memory</Button>
              <Button size="sm" variant="outline" onClick={exportMemory}>Export My Brain</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Thinking Style */}
      <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
        <h3 className="text-sm font-semibold">Thinking Style</h3>
        <p className="text-xs text-muted-foreground">Choose how the AI thinks — from precise to creative.</p>

        <div className="mt-4">
          <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-3">
              <div className="font-semibold">Precise</div>
              <div className="text-xs">Strict, Factual, Concise.</div>
            </div>
            <div className="font-semibold">Creative</div>
          </div>

          <Slider
            min={10}
            max={80}
            value={[Math.round((settings.thinking_style ?? 0.5) * 100)]}
            onValueChange={(vals:any) => {
              const v = (vals[0] || 50) / 100
              save({ thinking_style: v })
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Model Switcher */}
      <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
        <h3 className="text-sm font-semibold">Language Model</h3>
        <p className="text-xs text-muted-foreground">Choose the engine you want to run.</p>

        <div className="mt-4">
          <Select value={settings.model || 'auto'} onValueChange={(v)=> save({ model: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Recommended)</SelectItem>
              <SelectItem value="meta/llama-3-8b">Fast (Llama 3 8B) — Free</SelectItem>
              <SelectItem value="meta/llama-3-70b">Smart (Llama 3 70B) — Pro</SelectItem>
              <SelectItem value="deepseek/deepseek-r1-distill">Deep Reasoner (DeepSeek-R1 Distill)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Output Format */}
      <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
        <h3 className="text-sm font-semibold">Output Format</h3>
        <p className="text-xs text-muted-foreground">Control the shape of the answers.</p>

        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Concise Mode</div>
              <div className="text-xs text-muted-foreground">No yapping. Just the answer.</div>
            </div>
            <Switch checked={settings.output_format === 'concise'} onCheckedChange={(v:any)=> save({ output_format: v ? 'concise' : 'explain'})} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Explain Like I'm 5</div>
              <div className="text-xs text-muted-foreground">Simple analogies, no jargon.</div>
            </div>
            <Switch checked={settings.output_format === 'el5'} onCheckedChange={(v:any)=> save({ output_format: v ? 'el5' : 'concise'})} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Executive Summary</div>
              <div className="text-xs text-muted-foreground">BLUF format always.</div>
            </div>
            <Switch checked={settings.output_format === 'executive'} onCheckedChange={(v:any)=> save({ output_format: v ? 'executive' : 'concise'})} />
          </div>
        </div>
      </div>

      {/* Shield Settings */}
      <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
        <h3 className="text-sm font-semibold">Shield — Privacy & Safety</h3>

        <div className="mt-4 grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Incognito Mode (Ephemeral)</div>
              <div className="text-xs text-muted-foreground">Forget conversation immediately.</div>
            </div>
            <Switch checked={!!settings.incognito_mode} onCheckedChange={(v:any)=> save({ incognito_mode: !!v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">PII Redaction Level</div>
              <div className="text-xs text-muted-foreground">Standard redacts emails/phones. Paranoid redacts names, locations, companies.</div>
            </div>
            <Select value={settings.pii_redaction || 'standard'} onValueChange={(v)=> save({ pii_redaction: v })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="paranoid">Paranoid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Web Search Privacy</div>
              <div className="text-xs text-muted-foreground">Anonymize search queries.</div>
            </div>
            <Switch checked={!!settings.web_search_anonymize} onCheckedChange={(v:any)=> save({ web_search_anonymize: !!v })} />
          </div>
        </div>
      </div>

      {/* Hands Settings */}
      <div className="p-4 bg-muted/20 rounded-lg border border-dashed">
        <h3 className="text-sm font-semibold">Hands — Tools & Integrations</h3>
        <div className="mt-4 grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Drive Access Scope</div>
              <div className="text-xs text-muted-foreground">Control how much of your Drive the AI can access.</div>
            </div>
            <Select value={settings.drive_access_scope || 'current_file'} onValueChange={(v)=> save({ drive_access_scope: v })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current_file">Current File Only</SelectItem>
                <SelectItem value="folder">All Files in Folder</SelectItem>
                <SelectItem value="entire_drive">Entire Drive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Auto-Action Permissions</div>
              <div className="text-xs text-muted-foreground">Always ask, or allow automatic actions.</div>
            </div>
            <Select value={settings.auto_action_permissions || 'ask'} onValueChange={(v)=> save({ auto_action_permissions: v })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">Always Ask</SelectItem>
                <SelectItem value="allow">Always Allow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Memory Dialog */}
      <Dialog open={openMemoryDialog} onOpenChange={setOpenMemoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Memory</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {memories.length === 0 && <div className="text-sm text-muted-foreground">No memories saved.</div>}
            {memories.map(m => (
              <div key={m.id} className="p-3 flex items-center justify-between bg-muted/10 rounded-md">
                <div className="max-w-[70%] break-words text-sm">{m.text}</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDeleteMemory(m.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClearMemories}>Clear All</Button>
              <Button onClick={() => setOpenMemoryDialog(false)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

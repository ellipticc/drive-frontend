"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { apiClient } from '@/lib/api'
import { listMemories, deleteMemory, clearMemories } from '@/lib/ai-memory'
import {
  IconBrain, IconBolt, IconRobot, IconFileText, IconLock, IconClipboardList,
  IconAlertCircle, IconDownload, IconTrash, IconEye, IconSettings, IconCode,
  IconNetwork, IconUser, IconMoodSmile, IconPencil, IconNotebook, IconPalette, 
  IconList, IconHelpCircle
} from '@tabler/icons-react'

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
  // New settings
  personality_style: { tone: 'balanced', characteristics: [] },
  user_profile: { nickname: '', occupation: '', more_about_you: '' },
  advanced_features: { web_search_enabled: false, code_interpreter_enabled: false, canvas_enabled: false },
}

export function AITab() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(defaultSettings)
  const [openMemoryDialog, setOpenMemoryDialog] = useState(false)
  const [memories, setMemories] = useState<any[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const sliderTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize personality characteristics if not present
  useEffect(() => {
    if (!settings.personality_style) {
      setSettings((s: any) => ({
        ...s,
        personality_style: { tone: 'balanced', characteristics: [] }
      }))
    }
    if (!settings.user_profile) {
      setSettings((s: any) => ({
        ...s,
        user_profile: { nickname: '', occupation: '', more_about_you: '' }
      }))
    }
    if (!settings.advanced_features) {
      setSettings((s: any) => ({
        ...s,
        advanced_features: { web_search_enabled: false, code_interpreter_enabled: false, canvas_enabled: false }
      }))
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.getAIPreferences()
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

  // Debounced slider handler - only save after user releases
  const handleSliderChange = useCallback((vals: any) => {
    const v = (vals[0] || 50) / 100
    setSettings((s: any) => ({ ...s, thinking_style: v }))
    
    // Clear existing timeout
    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current)
    }

    // Save after 500ms of no movement
    sliderTimeoutRef.current = setTimeout(() => {
      save({ thinking_style: v })
    }, 500)
  }, [])

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

  const toggleCharacteristic = (char: string) => {
    const newChars = settings.personality_style?.characteristics || []
    const updated = newChars.includes(char)
      ? newChars.filter((c: string) => c !== char)
      : [...newChars, char]
    
    save({
      personality_style: {
        ...settings.personality_style,
        characteristics: updated
      }
    })
  }

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading AI settings...</div>

  return (
    <div className="space-y-6 pb-8">
      <TooltipProvider>
        {/* Sovereign Memory Section */}
        <div className="p-5 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <IconBrain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold">Sovereign Memory</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">AI remembers facts about you. Stored only in your browser's IndexedDB. We cannot see this.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">Enable persistent memory for personalized responses across conversations.</p>
              <Badge variant="outline" className="bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-100 border-purple-200 dark:border-purple-800">
                Encrypted Locally
              </Badge>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Switch
                checked={!!settings.memory_enabled}
                onCheckedChange={(v: any) => save({ memory_enabled: !!v })}
              />
              <div className="flex gap-2">
                <Dialog open={openMemoryDialog} onOpenChange={setOpenMemoryDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" onClick={openMemory}>
                      <IconEye className="w-4 h-4 mr-1" />
                      View Memory
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Your AI Memory</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-2">
                      {memories.length === 0 && (
                        <div className="text-sm text-muted-foreground py-4 text-center">No memories saved yet.</div>
                      )}
                      {memories.map((m) => (
                        <div key={m.id} className="p-3 flex items-start justify-between bg-muted/30 rounded-md hover:bg-muted/50 transition">
                          <div className="max-w-[70%] break-words text-sm">{m.text}</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteMemory(m.id)}
                            className="h-7 w-7 p-0"
                          >
                            <IconTrash className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <DialogFooter className="gap-2">
                      <Button
                        variant="outline"
                        onClick={handleClearMemories}
                        className="text-destructive"
                      >
                        <IconTrash className="w-4 h-4 mr-1" />
                        Clear All
                      </Button>
                      <Button onClick={() => setOpenMemoryDialog(false)}>Close</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button size="sm" variant="outline" onClick={exportMemory}>
                  <IconDownload className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Base Style & Tone Section */}
        <div className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconRobot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold">Base Style & Tone</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Customize how the AI responds to you. This affects the tone but not capabilities.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Tone</Label>
                <Select
                  value={settings.personality_style?.tone || 'balanced'}
                  onValueChange={(v) => save({
                    personality_style: { ...settings.personality_style, tone: v }
                  })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Warm & Friendly</SelectItem>
                    <SelectItem value="balanced">Balanced & Professional</SelectItem>
                    <SelectItem value="technical">Technical & Precise</SelectItem>
                    <SelectItem value="casual">Casual & Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-3 block">Characteristics</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'enthusiastic', label: 'Enthusiastic', Icon: IconMoodSmile },
                    { id: 'concise', label: 'Concise', Icon: IconPencil },
                    { id: 'detailed', label: 'Detailed', Icon: IconNotebook },
                    { id: 'emoji', label: 'Format: Emoji', Icon: IconPalette },
                    { id: 'headers', label: 'Headers & Lists', Icon: IconList },
                    { id: 'socratic', label: 'Socratic', Icon: IconHelpCircle }
                  ].map((char) => (
                    <button
                      key={char.id}
                      onClick={() => toggleCharacteristic(char.id)}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                        (settings.personality_style?.characteristics || []).includes(char.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900'
                      }`}
                    >
                      <char.Icon className="w-4 h-4" />
                      {char.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Thinking Style Section */}
        <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconBolt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold">Thinking Style</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Precise: Factual, deterministic responses. Creative: More varied, exploratory thinking.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                <span>Precise & Factual</span>
                <span>Creative & Exploratory</span>
              </div>

              <Slider
                min={10}
                max={80}
                value={[Math.round((settings.thinking_style ?? 0.5) * 100)]}
                onValueChange={handleSliderChange}
                className="w-full"
              />

              <div className="text-xs text-muted-foreground text-center">
                Current: {Math.round((settings.thinking_style ?? 0.5) * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Language Model Section */}
        <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconRobot className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-semibold">Language Model</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Choose which AI engine processes your requests. Auto switches based on complexity.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Select value={settings.model || 'auto'} onValueChange={(v) => save({ model: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Balances speed & quality)</SelectItem>
                <SelectItem value="meta/llama-3-8b">Fast (Llama 3 8B) — Free</SelectItem>
                <SelectItem value="meta/llama-3-70b">Smart (Llama 3 70B) — Pro</SelectItem>
                <SelectItem value="deepseek/deepseek-r1-distill">Reasoner (DeepSeek-R1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Output Format Section */}
        <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconFileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold">Output Format</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Control how the AI structures its responses to you.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              {[
                { value: 'concise', label: 'Concise Mode', desc: 'No fluff. Just the answer.' },
                { value: 'el5', label: 'Explain Like I\'m 5', desc: 'Simple analogies, no jargon.' },
                { value: 'executive', label: 'Executive Summary', desc: 'BLUF (Bottom Line Up Front).' }
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => save({ output_format: fmt.value })}
                  className={`w-full p-3 rounded-md text-left transition-all ${
                    settings.output_format === fmt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-900'
                  }`}
                >
                  <div className="text-sm font-semibold">{fmt.label}</div>
                  <div className="text-xs opacity-80">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* About You Section */}
        <div className="p-5 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconUser className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              <h3 className="text-sm font-semibold">About You</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Help the AI understand your context. This improves personalization without exposure.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="nickname" className="text-xs font-semibold mb-1.5 block">Nickname</Label>
                <Input
                  id="nickname"
                  placeholder="What should I call you?"
                  value={settings.user_profile?.nickname || ''}
                  onChange={(e) => save({
                    user_profile: { ...settings.user_profile, nickname: e.target.value }
                  })}
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor="occupation" className="text-xs font-semibold mb-1.5 block">Occupation & Role</Label>
                <Input
                  id="occupation"
                  placeholder="e.g., Software Engineer, Designer, Student"
                  value={settings.user_profile?.occupation || ''}
                  onChange={(e) => save({
                    user_profile: { ...settings.user_profile, occupation: e.target.value }
                  })}
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor="more_about_you" className="text-xs font-semibold mb-1.5 block">More About You</Label>
                <textarea
                  id="more_about_you"
                  placeholder="Interests, values, preferences the AI should know..."
                  value={settings.user_profile?.more_about_you || ''}
                  onChange={(e) => save({
                    user_profile: { ...settings.user_profile, more_about_you: e.target.value }
                  })}
                  className="w-full p-2 text-sm border rounded-md bg-white dark:bg-dark resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Safety Section */}
        <div className="p-5 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 rounded-lg border border-red-200 dark:border-red-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconLock className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-semibold">Shield — Privacy & Safety</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Control data sensitivity and privacy protections.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-md bg-red-100 dark:bg-red-950">
                <div>
                  <div className="text-sm font-semibold">Incognito Mode</div>
                  <div className="text-xs text-muted-foreground">Forget conversation immediately after session.</div>
                </div>
                <Switch
                  checked={!!settings.incognito_mode}
                  onCheckedChange={(v: any) => save({ incognito_mode: !!v })}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">PII Redaction Level</Label>
                <Select
                  value={settings.pii_redaction || 'standard'}
                  onValueChange={(v) => save({ pii_redaction: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (emails, phones)</SelectItem>
                    <SelectItem value="paranoid">Paranoid (+ names, locations, companies)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-red-100 dark:bg-red-950">
                <div>
                  <div className="text-sm font-semibold">Web Search Privacy</div>
                  <div className="text-xs text-muted-foreground">Anonymize all search queries.</div>
                </div>
                <Switch
                  checked={!!settings.web_search_anonymize}
                  onCheckedChange={(v: any) => save({ web_search_anonymize: !!v })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hands — Tools & Integrations Section */}
        <div className="p-5 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconClipboardList className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-sm font-semibold">Hands — Tools & Integrations</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Control which external tools and data the AI can access.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Drive Access Scope</Label>
                <Select
                  value={settings.drive_access_scope || 'current_file'}
                  onValueChange={(v) => save({ drive_access_scope: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_file">Current File Only</SelectItem>
                    <SelectItem value="folder">All Files in Folder</SelectItem>
                    <SelectItem value="entire_drive">Entire Drive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Auto-Action Permissions</Label>
                <Select
                  value={settings.auto_action_permissions || 'ask'}
                  onValueChange={(v) => save({ auto_action_permissions: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ask">Always Ask</SelectItem>
                    <SelectItem value="allow">Always Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Features Section */}
        <div className="p-5 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between group hover:opacity-75 transition"
          >
            <div className="flex items-center gap-2">
              <IconSettings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h3 className="text-sm font-semibold">Advanced</h3>
            </div>
            <div className={`transform transition ${showAdvanced ? 'rotate-180' : ''}`}>
              ↓
            </div>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between p-3 rounded-md bg-slate-100 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <IconNetwork className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-semibold">Web Search</div>
                    <div className="text-xs text-muted-foreground">Let AI search the web automatically.</div>
                  </div>
                </div>
                <Switch
                  checked={!!settings.advanced_features?.web_search_enabled}
                  onCheckedChange={(v: any) => save({
                    advanced_features: { ...settings.advanced_features, web_search_enabled: !!v }
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-slate-100 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <IconCode className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-semibold">Code Interpreter</div>
                    <div className="text-xs text-muted-foreground">Execute code to solve problems.</div>
                  </div>
                </div>
                <Switch
                  checked={!!settings.advanced_features?.code_interpreter_enabled}
                  onCheckedChange={(v: any) => save({
                    advanced_features: { ...settings.advanced_features, code_interpreter_enabled: !!v }
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-slate-100 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <IconFileText className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-semibold">Canvas</div>
                    <div className="text-xs text-muted-foreground">Collaborate on text and code in real-time.</div>
                  </div>
                </div>
                <Switch
                  checked={!!settings.advanced_features?.canvas_enabled}
                  onCheckedChange={(v: any) => save({
                    advanced_features: { ...settings.advanced_features, canvas_enabled: !!v }
                  })}
                />
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </div>
  )
}

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
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { apiClient } from '@/lib/api'
import { listMemories, deleteMemory, clearMemories } from '@/lib/ai-memory'
import {
  IconBrain, IconBolt, IconRobot, IconFileText, IconLock, IconClipboardList,
  IconAlertCircle, IconDownload, IconTrash, IconEye, IconSettings, IconCode,
  IconNetwork, IconUser, IconChevronDown
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
  personality_style: { tone: 'balanced', characteristics: [], characteristicsSettings: {} },
  user_profile: { nickname: '', occupation: '', more_about_you: '' },
  custom_instructions: '',
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
        personality_style: { tone: 'balanced', characteristics: [], characteristicsSettings: {} }
      }))
    }
    if (!settings.user_profile) {
      setSettings((s: any) => ({
        ...s,
        user_profile: { nickname: '', occupation: '', more_about_you: '' }
      }))
    }
    if (settings.custom_instructions === undefined) {
      setSettings((s: any) => ({ ...s, custom_instructions: '' }))
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
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconBrain className="w-5 h-5" />
              <CardTitle className="text-sm font-semibold">Sovereign Memory</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs max-w-xs">AI remembers facts about you. Stored only in your browser's IndexedDB. We cannot see this.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={!!settings.memory_enabled}
                onCheckedChange={(v: any) => save({ memory_enabled: !!v })}
              />
              <div className="flex gap-2">
                <Dialog open={openMemoryDialog} onOpenChange={setOpenMemoryDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" onClick={openMemory}>
                      <IconEye className="w-4 h-4 mr-1" />
                      View
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
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Enable persistent memory for personalized responses across conversations.</p>
            <Badge variant="secondary">Encrypted Locally</Badge>
          </CardContent>
        </Card>

        {/* Base Style & Tone Section (plain, matched UX) */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconRobot className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Base Style & Tone</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Set the style and tone of how the assistant responds to you.</p>
            </div>
          </div>

          <div className="mt-3">
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
                <SelectItem value="default"><div className="flex flex-col"><span className="font-medium">Default</span><span className="text-xs text-muted-foreground">Preset style and tone</span></div></SelectItem>
                <SelectItem value="professional"><div className="flex flex-col"><span className="font-medium">Professional</span><span className="text-xs text-muted-foreground">Polished and precise</span></div></SelectItem>
                <SelectItem value="friendly"><div className="flex flex-col"><span className="font-medium">Friendly</span><span className="text-xs text-muted-foreground">Warm and chatty</span></div></SelectItem>
                <SelectItem value="candid"><div className="flex flex-col"><span className="font-medium">Candid</span><span className="text-xs text-muted-foreground">Direct and encouraging</span></div></SelectItem>
                <SelectItem value="quirky"><div className="flex flex-col"><span className="font-medium">Quirky</span><span className="text-xs text-muted-foreground">Playful and imaginative</span></div></SelectItem>
                <SelectItem value="efficient"><div className="flex flex-col"><span className="font-medium">Efficient</span><span className="text-xs text-muted-foreground">Concise and plain</span></div></SelectItem>
                <SelectItem value="nerdy"><div className="flex flex-col"><span className="font-medium">Nerdy</span><span className="text-xs text-muted-foreground">Exploratory and enthusiastic</span></div></SelectItem>
                <SelectItem value="cynical"><div className="flex flex-col"><span className="font-medium">Cynical</span><span className="text-xs text-muted-foreground">Critical and sarcastic</span></div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-4" />

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold mb-2 block">Characteristics</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs max-w-xs">Choose major characteristics and customize intensity per characteristic.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2 mt-2">
              {[
                { id: 'enthusiastic', label: 'Enthusiastic', desc: 'Show energy and optimism' },
                { id: 'concise', label: 'Concise', desc: 'Keep it short and direct' },
                { id: 'detailed', label: 'Detailed', desc: 'Provide thorough explanations' },
                { id: 'headers', label: 'Headers & Lists', desc: 'Structure with headers and lists' },
                { id: 'socratic', label: 'Socratic', desc: 'Ask guiding questions' },
              ].map((char) => {
                const current = settings.personality_style?.characteristicsSettings?.[char.id] || 'default'
                return (
                  <div key={char.id} className="flex items-center justify-between p-2 rounded-md bg-muted/10">
                    <div>
                      <div className="text-sm font-medium">{char.label}</div>
                      <div className="text-xs text-muted-foreground">{char.desc}</div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          {current.charAt(0).toUpperCase() + current.slice(1)} <IconChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-xs">Adjust intensity</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => save({
                          personality_style: { ...settings.personality_style,
                            characteristicsSettings: { ...settings.personality_style?.characteristicsSettings, [char.id]: 'more' }
                          }
                        })}>
                          <div className="flex flex-col">
                            <span className="font-medium">More</span>
                            <span className="text-xs text-muted-foreground">Emphasize this characteristic</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => save({
                          personality_style: { ...settings.personality_style,
                            characteristicsSettings: { ...settings.personality_style?.characteristicsSettings, [char.id]: 'default' }
                          }
                        })}>
                          <div className="flex flex-col">
                            <span className="font-medium">Default</span>
                            <span className="text-xs text-muted-foreground">Standard behavior</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => save({
                          personality_style: { ...settings.personality_style,
                            characteristicsSettings: { ...settings.personality_style?.characteristicsSettings, [char.id]: 'less' }
                          }
                        })}>
                          <div className="flex flex-col">
                            <span className="font-medium">Less</span>
                            <span className="text-xs text-muted-foreground">De-emphasize this characteristic</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Custom Instructions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconAlertCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs max-w-xs">Provide specific instructions the assistant should follow. These are sanitized and limited to 2000 characters.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="mt-2">
              <Textarea
                placeholder="Write your custom instructions here (e.g., You're my ruthless mentor. Don't sugarcoat anything.)"
                value={settings.custom_instructions || ''}
                onChange={(e: any) => {
                  const val = e.target.value
                  if (val.length <= 2000) {
                    setSettings((s: any) => ({ ...s, custom_instructions: val }))
                  }
                }}
                onBlur={() => save({ custom_instructions: settings.custom_instructions || '' })}
                rows={6}
              />
              <div className="text-xs text-muted-foreground text-right mt-1">{(settings.custom_instructions || '').length}/2000</div>
            </div>
          </div>
        </div>

        {/* Thinking Style Section */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconBolt className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Thinking Style</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Precise: Factual, deterministic responses. Creative: More varied, exploratory thinking.</p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
              <span>Precise & Factual</span>
              <span>Creative & Exploratory</span>
            </div>

            <div className="mt-2">
              <Slider
                min={10}
                max={80}
                value={[Math.round((settings.thinking_style ?? 0.5) * 100)]}
                onValueChange={handleSliderChange}
                className="w-full"
              />

              <div className="text-xs text-muted-foreground text-center mt-2">
                Current: {Math.round((settings.thinking_style ?? 0.5) * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconRobot className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Language Model</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Choose which AI engine processes your requests. Auto switches based on complexity.</p>
            </div>
          </div>

          <div className="mt-3">
            <Select value={settings.model || 'auto'} onValueChange={(v) => save({ model: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto"><div className="flex flex-col"><span className="font-medium">Auto</span><span className="text-xs text-muted-foreground">Balances speed & quality</span></div></SelectItem>
                <SelectItem value="meta/llama-3-8b"><div className="flex flex-col"><span className="font-medium">Fast</span><span className="text-xs text-muted-foreground">Llama 3 8B — Free</span></div></SelectItem>
                <SelectItem value="meta/llama-3-70b"><div className="flex flex-col"><span className="font-medium">Smart</span><span className="text-xs text-muted-foreground">Llama 3 70B — Pro</span></div></SelectItem>
                <SelectItem value="deepseek/deepseek-r1-distill"><div className="flex flex-col"><span className="font-medium">Reasoner</span><span className="text-xs text-muted-foreground">DeepSeek-R1</span></div></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Output Format Section */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconFileText className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Output Format</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Control how the AI structures its responses to you.</p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {[
              { value: 'concise', title: 'Concise Mode', desc: 'No fluff. Just the answer.' },
              { value: 'el5', title: "Explain Like I'm 5", desc: 'Simple analogies, no jargon.' },
              { value: 'executive', title: 'Executive Summary', desc: 'BLUF (Bottom Line Up Front).' }
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
                <div className="text-sm font-semibold">{fmt.title}</div>
                <div className="text-xs opacity-80">{fmt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* About You Section */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconUser className="w-5 h-5" />
                <h3 className="text-sm font-semibold">About You</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Help the AI understand your context. This improves personalization without exposure.</p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
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
              <Textarea
                id="more_about_you"
                placeholder="Interests, values, preferences the AI should know..."
                value={settings.user_profile?.more_about_you || ''}
                onChange={(e) => save({
                  user_profile: { ...settings.user_profile, more_about_you: e.target.value }
                })}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Privacy & Safety Section */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconLock className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Shield — Privacy & Safety</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Control data sensitivity and privacy protections.</p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/10">
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
                  <SelectItem value="standard"><div className="flex flex-col"><span className="font-medium">Standard</span><span className="text-xs text-muted-foreground">Redacts emails & phones</span></div></SelectItem>
                  <SelectItem value="paranoid"><div className="flex flex-col"><span className="font-medium">Paranoid</span><span className="text-xs text-muted-foreground">Also redacts names, locations, companies</span></div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-muted/10">
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

        {/* Hands — Tools & Integrations Section */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconClipboardList className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Hands — Tools & Integrations</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Control which external tools and data the AI can access.</p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
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
                  <SelectItem value="current_file"><div className="flex flex-col"><span className="font-medium">Current File Only</span><span className="text-xs text-muted-foreground">Only the active file</span></div></SelectItem>
                  <SelectItem value="folder"><div className="flex flex-col"><span className="font-medium">Folder</span><span className="text-xs text-muted-foreground">All files in the current folder</span></div></SelectItem>
                  <SelectItem value="entire_drive"><div className="flex flex-col"><span className="font-medium">Entire Drive</span><span className="text-xs text-muted-foreground">Full access to Drive</span></div></SelectItem>
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
                  <SelectItem value="ask"><div className="flex flex-col"><span className="font-medium">Always Ask</span><span className="text-xs text-muted-foreground">Ask before auto actions</span></div></SelectItem>
                  <SelectItem value="allow"><div className="flex flex-col"><span className="font-medium">Always Allow</span><span className="text-xs text-muted-foreground">Permit automatic actions</span></div></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Advanced Features Section */}
        <div className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <IconSettings className="w-5 h-5" />
                <h3 className="text-sm font-semibold">Advanced</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Optional advanced capabilities the AI can use.</p>
            </div>
            <div>
              <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)} size="sm">
                {showAdvanced ? 'Collapse' : 'Show'}
              </Button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/10">
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

              <div className="flex items-center justify-between p-3 rounded-md bg-muted/10">
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

              <div className="flex items-center justify-between p-3 rounded-md bg-muted/10">
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

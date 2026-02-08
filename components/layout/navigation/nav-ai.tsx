"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  IconEdit,
  IconSearch,
  IconDotsVertical,
  IconPin,
  IconTrash,
  IconArchive,
  IconChevronDown,
} from "@tabler/icons-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import apiClient from "@/lib/api"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { toast } from "sonner"
import { searchChatsLocal, indexChats, getIndexStatus, clearSearchIndex, getIndexedChatsPaginated, getAllIndexedChats } from "@/lib/indexeddb"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

interface SearchResult {
  chatId: string
  chatTitle: string
  chatCreatedAt: string
  messageSnippet: string
  matchedWord: string
  role: "user" | "assistant"
  isTitle: boolean
}

interface GroupedResults {
  [key: string]: SearchResult[]
}

export function NavAI() {
  const router = useRouter()
  const { state } = useSidebar()

  // Separate states for sidebar search vs command dialog search
  const [sidebarQuery, setSidebarQuery] = useState("")
  const [commandQuery, setCommandQuery] = useState("")

  const [searchOpen, setSearchOpen] = useState(false)
  const [commandResults, setCommandResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [indexReady, setIndexReady] = useState(false) // Track if IndexedDB index is initialized
  const [indexStatus, setIndexStatus] = useState<'idle' | 'indexing' | 'ready' | 'failed'>('idle')
  const [indexProgress, setIndexProgress] = useState(0) // Percentage 0-100

  const [displayChats, setDisplayChats] = useState<any[]>([])

  const loadTimeoutRef = useRef<number | null>(null)
  const indexingRef = useRef(false) // Prevent concurrent indexing runs
  const indexingAbortRef = useRef(false) // Allow cancellation
  const { isReady, userKeys, loadChats, renameChat, pinChat, archiveChat, deleteChat } = useAICrypto()

  // Decrypt a single message
  const decryptMessage = useCallback(async (encryptedContent: string, iv: string, encapsulatedKey?: string): Promise<string> => {
    if (!userKeys) return "Unable to decrypt"
    try {
      const { decryptData } = await import('@/lib/crypto')
      const { ml_kem768 } = await import('@noble/post-quantum/ml-kem')

      if (!encapsulatedKey) return encryptedContent

      const encKeyBytes = Uint8Array.from(atob(encapsulatedKey), c => c.charCodeAt(0))
      const kyberPriv = userKeys.keypairs.kyberPrivateKey
      const sharedSecret = ml_kem768.decapsulate(encKeyBytes, kyberPriv)
      const decryptedBytes = decryptData(encryptedContent, sharedSecret, iv)
      return new TextDecoder().decode(decryptedBytes)
    } catch (e) {
      console.error("Decryption failed:", e)
      return "Unable to decrypt"
    }
  }, [userKeys])

  // Load encrypted chats, decrypt all message content, and build IndexedDB full-text search index
  const loadSearchData = useCallback(async () => {
    if (!isReady || !userKeys) return
    if (indexingRef.current) return

    indexingRef.current = true
    setIndexStatus('indexing')
    setIndexProgress(0)
    setIndexReady(false)

    try {
      const response = await apiClient.searchChats(200)
      const responseData = response as any
      const chats = responseData.chats || responseData.data?.chats || []

      const indexedChats: any[] = []
      const displayList: any[] = []

      const total = chats.length || 1
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i]
        let title = 'New Chat'
        try {
          if (chat.encrypted_title && chat.iv && chat.encapsulated_key) {
            title = await decryptMessage(chat.encrypted_title, chat.iv, chat.encapsulated_key)
            title = title.replace(/^\s*["'`]+|["'`]+\s*$/g, '')
                         .replace(/^Title:\s*/i, '')
                         .replace(/^Conversation\s*Start\s*[:\-\s]*/i, '')
                         .replace(/\s*[:\-\|]\s*0+$/g, '')
                         .trim()
            if (!/[A-Za-z0-9]/.test(title) || title.length === 0) title = 'New Chat'
          }
        } catch (e) {
          title = 'New Chat'
        }

        const msgs = Array.isArray(chat.messages) 
          ? chat.messages.slice().sort((a:any,b:any)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          : []
        const decryptedMsgs: any[] = []
        for (const m of msgs) {
          try {
            const content = await decryptMessage(m.content, m.iv, m.encapsulated_key)
            decryptedMsgs.push({ id: m.id, role: m.role, content, created_at: m.created_at })
          } catch (e) {
            // ignore individual message decrypt failures
          }
        }

        // Keep last 3 for sidebar display
        const lastThreeMsgs = decryptedMsgs.slice(-3)

        indexedChats.push({ id: chat.id, title, createdAt: chat.created_at, pinned: !!chat.pinned, messages: decryptedMsgs })
        displayList.push({ id: chat.id, title, created_at: chat.created_at, pinned: !!chat.pinned, messages: lastThreeMsgs })

        // Update progress
          setIndexProgress(Math.round(((i + 1) / total) * 100))
        // Emit progress event
        if (typeof window !== 'undefined') {
          try { window.dispatchEvent(new CustomEvent('ai:index-progress', { detail: { progress: Math.round(((i + 1) / total) * 100) } })) } catch (e) {}
        }
        // Check cancel flag
        if (indexingAbortRef.current) {
          setIndexStatus('idle')
          indexingRef.current = false
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('ai:build-index-cancel'))
          }
          return
        }
      }

      setDisplayChats(displayList)

      if (indexedChats.length > 0) {
        await indexChats(indexedChats)
      }

      setIndexStatus('ready')
      setIndexReady(true)

      // Notify other UI parts (sidebar history) that index is ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ai:build-index-complete'))
      }
    } catch (error) {
      console.error("Failed to load chats for search:", error)
      setIndexStatus('failed')
      setIndexReady(false)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai:build-index-failed', { detail: { message: String((error as any)?.message || error) } }))
      }
    } finally {
      indexingRef.current = false
      indexingAbortRef.current = false
      setTimeout(() => setIndexProgress(100), 200)
    }
  }, [isReady, userKeys, decryptMessage])

  // (Deprecated) Old search functions replaced by command-query effect and sidebar local filtering


  // Load search data when component mounts
  useEffect(() => {
    loadSearchData()
  }, [loadSearchData])

  // Listen for Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // If user opens command dialog and index is not ready, build it (once)
  useEffect(() => {
    if (searchOpen && indexStatus !== 'ready' && !indexingRef.current) {
      // Dispatch 'start' event
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai:build-index-start'))
      loadSearchData()
    }
  }, [searchOpen, indexStatus, loadSearchData])

  // Allow external cancel events to stop indexing
  useEffect(() => {
    const handler = () => {
      if (indexingRef.current) {
        indexingAbortRef.current = true
        setIndexStatus('idle')
        setIndexProgress(0)
      }
    }
    window.addEventListener('ai:cancel-index', handler)
    return () => window.removeEventListener('ai:cancel-index', handler)
  }, [])

  // Listen for global 'build index' events (e.g., from header history rebuild button)
  useEffect(() => {
    const handler = () => {
      if (!indexingRef.current) loadSearchData()
    }
    window.addEventListener('ai:build-index', handler)
    return () => window.removeEventListener('ai:build-index', handler)
  }, [loadSearchData])

  // Listen for command query changes and search IndexedDB (zero API calls, instant results)
  useEffect(() => {
    if (!commandQuery.trim()) {
      setCommandResults([])
      return
    }

    // If index not ready, bail and show that indexing is in progress
    if (indexStatus !== 'ready') {
      setIsSearching(false)
      setCommandResults([])
      return
    }

    let cancelled = false
    setIsSearching(true)

    ;(async () => {
      try {
        // Search IndexedDB locally - no API call, no decryption
        const results = await searchChatsLocal(commandQuery)
        
        if (!cancelled) {
          // Convert IndexedDB results to SearchResult interface
          const formattedResults: SearchResult[] = results.map((result, idx) => ({
            ...result,
            matchedWord: commandQuery,
          }))
          
          setCommandResults(formattedResults)
        }
      } catch (error) {
        console.error('Local search failed, results may be incomplete:', error)
        if (!cancelled) {
          toast.error('Search error - try rebuilding the index')
        }
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [commandQuery, indexStatus])

  const handleNewChat = () => {
    router.push('/assistant')
    setSearchOpen(false)
  }





  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* New Chat Button */}
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    asChild
                    onClick={handleNewChat}
                    className="cursor-pointer"
                  >
                    <button className="flex items-center gap-2">
                      <IconEdit className="h-4 w-4" />
                      {state === 'expanded' && <span>New Chat</span>}
                    </button>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {state === 'collapsed' && (
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>New chat</span>
                      <Kbd className="text-xs">Ctrl+N</Kbd>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>



            {/* Search */}
            {state === "expanded" ? (
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="px-2 py-1.5">
                      <div className="flex items-center gap-2 px-2 py-2 rounded-md border border-input bg-background hover:bg-accent transition-colors cursor-pointer" onClick={() => setSearchOpen(true)}>
                        <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                          placeholder="Search chats…"
                          value={sidebarQuery}
                          onChange={(e) => setSidebarQuery(e.target.value)}
                          className="border-0 bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 px-0 h-auto text-sm flex-1"
                        />
                        <Kbd className="text-xs ml-auto">
                          ⌘K
                        </Kbd>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>Search chats by title or content</p>
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      onClick={() => setSearchOpen(true)}
                      className="cursor-pointer"
                    >
                      <IconSearch className="h-4 w-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Search chats</span>
                      <Kbd className="text-xs">⌘K</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Search chats by title or message content…"
          value={commandQuery}
          onValueChange={setCommandQuery}
        />
        <CommandList className="max-h-[400px]">
          {indexStatus === 'indexing' && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium">Indexing chats…</div>
                <div className="text-xs text-muted-foreground">{indexProgress}%</div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${indexProgress}%` }} />
              </div>
              <div className="flex justify-end mt-2">
                <button className="text-xs text-destructive underline" onClick={() => {
                  indexingAbortRef.current = true
                  window.dispatchEvent(new Event('ai:cancel-index'))
                  setIndexStatus('idle')
                }}>Cancel</button>
              </div>
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-6">
              <div className="text-sm text-muted-foreground">Searching locally…</div>
            </div>
          )}
          {!isSearching && !commandQuery.trim() && (
            <div className="flex items-center justify-center py-6">
              <div className="text-sm text-muted-foreground">Start typing to search chats</div>
            </div>
          )}
          {!isSearching && commandQuery.trim() && commandResults.length === 0 && (
            <>
              <CommandEmpty>No chats found matching "{commandQuery}"</CommandEmpty>
              {indexStatus !== 'ready' && (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                  Index not ready. Building index when you open search.
                </div>
              )}
            </>
          )}
          
          {/* Group command results for display */}
          {!isSearching && commandResults.length > 0 && (() => {
            const groupedResults = commandResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
              const date = new Date(result.chatCreatedAt)
              const now = new Date()
              const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
              let groupKey = "OLDER"

              if (daysDiff === 0) groupKey = "TODAY"
              else if (daysDiff === 1) groupKey = "YESTERDAY"
              else if (daysDiff <= 7) groupKey = "LAST 7 DAYS"
              else if (daysDiff <= 30) groupKey = "LAST MONTH"
              else if (daysDiff <= 365) groupKey = "LAST YEAR"

              acc[groupKey] = acc[groupKey] || []
              acc[groupKey].push(result)
              return acc
            }, {})

            const groupOrder = ["TODAY", "YESTERDAY", "LAST 7 DAYS", "LAST MONTH", "LAST YEAR", "OLDER"]

            return groupOrder.map(groupKey => {
              const groupResults = groupedResults[groupKey] || []
              if (groupResults.length === 0) return null

              return (
                <CommandGroup key={groupKey} heading={groupKey}>
                  {groupResults.map((result, idx) => (
                    <CommandItem
                      key={`${result.chatId}-${idx}`}
                      value={result.chatId}
                      onSelect={() => {
                        router.push(`/assistant?conversationId=${result.chatId}`)
                        setSearchOpen(false)
                      }}
                      className="flex items-center justify-between gap-2 py-2 cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium line-clamp-1">
                          {result.chatTitle}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {result.messageSnippet}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 ml-2">
                        {new Date(result.chatCreatedAt).toLocaleDateString('en-US', { 
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })
          })()}
        </CommandList>
      </CommandDialog>
    </>
  )
}

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  IconEdit,
  IconSearch,
} from "@tabler/icons-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [allChatsData, setAllChatsData] = useState<any[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { isReady, userKeys } = useAICrypto()

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

  // Load all chats with their messages on component mount
  const loadSearchData = useCallback(async () => {
    if (!isReady || !userKeys) return
    
    try {
      const response = await apiClient.searchChats(100)
      const responseData = response as any
      setAllChatsData(responseData.chats || responseData.data?.chats || [])
    } catch (error) {
      console.error("Failed to load chats for search:", error)
    }
  }, [isReady, userKeys])

  // Perform search with decryption
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !userKeys) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const lowerQuery = query.toLowerCase()
    const results: SearchResult[] = []

    try {
      for (const chat of allChatsData) {
        // Decrypt and search chat title
        let chatTitle = "New Chat"
        if (chat.encrypted_title && chat.iv && chat.encapsulated_key) {
          chatTitle = await decryptMessage(chat.encrypted_title, chat.iv, chat.encapsulated_key)
          chatTitle = chatTitle
            .replace(/^\s*["'`]+|["'`]+\s*$/g, '')
            .replace(/^Title:\s*/i, '')
            .replace(/^Conversation\s*Start\s*[:\-\s]*/i, '')
            .replace(/\s*[:\-\|]\s*0+$/g, '')
            .trim()

          if (!/[A-Za-z0-9]/.test(chatTitle) || chatTitle.length === 0) {
            chatTitle = "New Chat"
          }
        }

        // Search in title
        if (chatTitle.toLowerCase().includes(lowerQuery)) {
          const matchIndex = chatTitle.toLowerCase().indexOf(lowerQuery)
          results.push({
            chatId: chat.id,
            chatTitle,
            chatCreatedAt: chat.created_at,
            messageSnippet: `Chat: "${chatTitle}"`,
            matchedWord: query,
            role: "user",
            isTitle: true,
          })
        }

        // Search in messages
        if (chat.messages && Array.isArray(chat.messages)) {
          for (const message of chat.messages) {
            if (!message.content || !message.iv) continue

            try {
              const decryptedContent = await decryptMessage(message.content, message.iv, message.encapsulated_key)
              
              if (decryptedContent.toLowerCase().includes(lowerQuery)) {
                // Extract snippet around match
                const lowerContent = decryptedContent.toLowerCase()
                const matchIndex = lowerContent.indexOf(lowerQuery)
                const start = Math.max(0, matchIndex - 30)
                const end = Math.min(decryptedContent.length, matchIndex + lowerQuery.length + 30)
                let snippet = decryptedContent.substring(start, end).trim()
                
                if (start > 0) snippet = "..." + snippet
                if (end < decryptedContent.length) snippet = snippet + "..."

                results.push({
                  chatId: chat.id,
                  chatTitle,
                  chatCreatedAt: chat.created_at,
                  messageSnippet: snippet,
                  matchedWord: query,
                  role: message.role,
                  isTitle: false,
                })
              }
            } catch (e) {
              console.error("Failed to decrypt message:", e)
            }
          }
        }
      }

      setSearchResults(results)
    } catch (error) {
      console.error("Search error:", error)
      toast.error("Search failed")
    } finally {
      setIsSearching(false)
    }
  }, [allChatsData, userKeys, decryptMessage])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!value.trim()) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }, [performSearch])

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

  const handleNewChat = () => {
    router.push('/assistant')
    setSearchOpen(false)
  }

  // Group results by date
  const groupedResults = searchResults.reduce<GroupedResults>((acc, result) => {
    const date = new Date(result.chatCreatedAt)
    const now = new Date()
    
    let groupKey = "OLDER"
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 0) {
      groupKey = "TODAY"
    } else if (daysDiff === 1) {
      groupKey = "YESTERDAY"
    } else if (daysDiff <= 7) {
      groupKey = "LAST 7 DAYS"
    } else if (daysDiff <= 30) {
      groupKey = "LAST MONTH"
    } else if (daysDiff <= 365) {
      groupKey = "LAST YEAR"
    }

    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(result)
    return acc
  }, {})

  const groupOrder = ["TODAY", "YESTERDAY", "LAST 7 DAYS", "LAST MONTH", "LAST YEAR", "OLDER"]

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* New Chat Button */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                onClick={handleNewChat}
                className="cursor-pointer"
              >
                <button className="flex items-center gap-2">
                  <IconEdit className="h-4 w-4" />
                  <span>New Chat</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Search */}
            {state === "expanded" ? (
              <SidebarMenuItem>
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-2 px-2 py-2 rounded-md border border-input bg-background hover:bg-accent transition-colors cursor-pointer" onClick={() => setSearchOpen(true)}>
                    <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      placeholder="Search chats…"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => setSearchOpen(true)}
                      className="border-0 bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 px-0 h-auto text-sm flex-1"
                    />
                    <Kbd className="text-xs ml-auto">
                      ⌘K
                    </Kbd>
                  </div>
                </div>
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
          value={searchQuery}
          onValueChange={handleSearchChange}
        />
        <CommandList className="max-h-[400px]">
          {isSearching && (
            <div className="flex items-center justify-center py-6">
              <div className="text-sm text-muted-foreground">Searching…</div>
            </div>
          )}
          {!isSearching && !searchQuery.trim() && (
            <div className="flex items-center justify-center py-6">
              <div className="text-sm text-muted-foreground">Start typing to search chats</div>
            </div>
          )}
          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <CommandEmpty>No chats found matching "{searchQuery}"</CommandEmpty>
          )}
          
          {!isSearching && searchResults.length > 0 && (
            groupOrder.map(groupKey => {
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
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

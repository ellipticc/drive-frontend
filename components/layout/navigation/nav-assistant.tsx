"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  IconHistory,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconPencil,
  IconPin,
  IconPinFilled,
  IconArchive,
  IconTrash,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface NavHistoryProps {
  onSearchOpen: () => void
}

// Group chats by timeline label (Today, month names)
function groupChatsByTimeline(chats: { id: string; title: string; pinned: boolean; archived: boolean; createdAt: string }[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: { label: string; chats: typeof chats }[] = []
  const groupMap = new Map<string, typeof chats>()

  // Sort: pinned first, then by date descending
  const sorted = [...chats]
    .filter(c => !c.archived)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  for (const chat of sorted) {
    const d = new Date(chat.createdAt)
    let label: string

    if (d >= today) {
      label = "Today"
    } else if (d >= yesterday) {
      label = "Yesterday"
    } else {
      // Use month name (e.g. "February")
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      const monthLabel = monthNames[d.getMonth()]
      // Add year if not current year
      label = d.getFullYear() === now.getFullYear() ? monthLabel : `${monthLabel} ${d.getFullYear()}`
    }

    if (!groupMap.has(label)) {
      groupMap.set(label, [])
    }
    groupMap.get(label)!.push(chat)
  }

  // Convert map to ordered array
  for (const [label, groupChats] of groupMap) {
    groups.push({ label, chats: groupChats })
  }

  return groups
}

const MAX_VISIBLE_CHATS = 10

export function NavHistory({ onSearchOpen }: NavHistoryProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { chats, renameChat, pinChat, deleteChat, archiveChat } = useAICrypto()
  const { state } = useSidebar()

  const [isExpanded, setIsExpanded] = React.useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("history-expanded")
      return stored === null ? true : stored === "true" // default expanded
    }
    return true
  })

  const [isHovered, setIsHovered] = React.useState(false)

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [chatToDelete, setChatToDelete] = React.useState<string | null>(null)

  // Inline Rename State
  const [editingChatId, setEditingChatId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")

  const handleNavigate = (url: string) => {
    router.push(url)
  }

  const handleRenameStart = (chat: typeof chats[0]) => {
    setEditingChatId(chat.id)
    setEditTitle(chat.title)
  }

  const handleRenameSave = async (chatId: string) => {
    if (editTitle.trim()) {
      try {
        await renameChat(chatId, editTitle.trim())
        toast.success("Chat renamed")
      } catch {
        toast.error("Failed to rename chat")
      }
    }
    setEditingChatId(null)
    setEditTitle("")
  }

  const handleDeleteClick = (chatId: string) => {
    setChatToDelete(chatId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (chatToDelete) {
      try {
        await deleteChat(chatToDelete)
        setDeleteDialogOpen(false)
        setChatToDelete(null)
        toast.success("Chat deleted")
      } catch {
        toast.error("Failed to delete chat")
      }
    }
  }

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !isExpanded
    setIsExpanded(next)
    sessionStorage.setItem("history-expanded", String(next))
  }

  const currentConversationId = searchParams.get("conversationId")
  const groups = groupChatsByTimeline(chats)

  // Count total visible chats
  let totalShown = 0
  const hasMore = chats.filter(c => !c.archived).length > MAX_VISIBLE_CHATS

  return (
    <SidebarGroup className="p-0 px-2">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <div
              className="flex items-center w-full"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <SidebarMenuButton
                onClick={onSearchOpen}
                tooltip={{
                  children: "History",
                  side: "right",
                  hidden: state !== "collapsed"
                }}
                className="flex-1 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
              >
                {isHovered && state !== "collapsed" ? (
                  <IconChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform duration-200",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                ) : (
                  <IconHistory className="size-4 shrink-0" />
                )}
                <span className="group-data-[collapsible=icon]:hidden">History</span>
              </SidebarMenuButton>

              {/* Chevron toggle (separate click target) */}
              {state !== "collapsed" && (
                <div
                  role="button"
                  onClick={toggleExpanded}
                  className="p-1 rounded-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer text-muted-foreground shrink-0"
                >
                  <IconChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                </div>
              )}
            </div>

            {/* Chat history list with timeline grouping */}
            {isExpanded && state !== "collapsed" && (
              <div className="mt-1">
                {groups.map((group) => {
                  const remainingSlots = MAX_VISIBLE_CHATS - totalShown
                  if (remainingSlots <= 0) return null

                  const visibleChats = group.chats.slice(0, remainingSlots)
                  totalShown += visibleChats.length

                  return (
                    <div key={group.label} className="mb-1">
                      {/* Timeline label */}
                      <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground/60 select-none">
                        {group.label}
                      </div>

                      {/* Chat items with left border */}
                      <div className="ml-[11px] border-l border-border/40 pl-0">
                        {visibleChats.map((chat) => {
                          const isEditing = editingChatId === chat.id
                          const isActive = currentConversationId === chat.id

                          return (
                            <div
                              key={chat.id}
                              className={cn(
                                "group/chat-item relative flex items-center h-7 pl-3 pr-1 text-xs cursor-pointer rounded-r-md transition-colors",
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                              )}
                              onClick={() => !isEditing && handleNavigate(`/new?conversationId=${chat.id}`)}
                            >
                              {isEditing ? (
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameSave(chat.id)
                                    if (e.key === "Escape") setEditingChatId(null)
                                    e.stopPropagation()
                                  }}
                                  onBlur={() => handleRenameSave(chat.id)}
                                  autoFocus
                                  className="h-5 text-xs px-1 py-0 w-full"
                                />
                              ) : (
                                <>
                                  <Tooltip delayDuration={700}>
                                    <TooltipTrigger asChild>
                                      <span className="truncate flex-1">
                                        {chat.title}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="start" className="max-w-[200px] break-words">
                                      {chat.title}
                                    </TooltipContent>
                                  </Tooltip>

                                  {chat.pinned && (
                                    <IconPinFilled className="size-3 text-muted-foreground ml-1 shrink-0" />
                                  )}

                                  {/* Actions dropdown on hover */}
                                  <div className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/chat-item:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <div
                                          role="button"
                                          className="p-0.5 hover:bg-sidebar-accent rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <IconDotsVertical className="size-3" />
                                        </div>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-40">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameStart(chat) }}>
                                          <IconPencil className="size-3.5 mr-2" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            try {
                                              await pinChat(chat.id, !chat.pinned)
                                              toast.success(chat.pinned ? "Unpinned" : "Pinned")
                                            } catch { toast.error("Failed") }
                                          }}
                                        >
                                          {chat.pinned ? <IconPin className="size-3.5 mr-2" /> : <IconPinFilled className="size-3.5 mr-2" />}
                                          {chat.pinned ? "Unpin" : "Pin"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            try {
                                              await archiveChat(chat.id, true)
                                              toast.success("Archived")
                                            } catch { toast.error("Failed") }
                                          }}
                                        >
                                          <IconArchive className="size-3.5 mr-2" />
                                          Archive
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(chat.id) }}
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
                                        >
                                          <IconTrash className="size-3.5 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* See all link */}
                {hasMore && (
                  <div
                    className="px-3 py-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors"
                    onClick={onSearchOpen}
                  >
                    See all
                  </div>
                )}
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete this chat? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarGroup>
  )
}

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconHistory,
  IconChevronDown,
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

// --- Helper Functions ---

function groupChatsByTimeline(chats: { id: string; title: string; pinned: boolean; archived: boolean; createdAt: string }[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: { label: string; chats: typeof chats }[] = []
  const groupMap = new Map<string, typeof chats>()

  // Exclude pinned items from timeline grouping
  const sorted = [...chats]
    .filter(c => !c.archived && !c.pinned)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  for (const chat of sorted) {
    const d = new Date(chat.createdAt)
    let label: string

    if (d >= today) {
      label = "Today"
    } else if (d >= yesterday) {
      label = "Yesterday"
    } else {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      const monthLabel = monthNames[d.getMonth()]
      label = d.getFullYear() === now.getFullYear() ? monthLabel : `${monthLabel} ${d.getFullYear()}`
    }

    if (!groupMap.has(label)) {
      groupMap.set(label, [])
    }
    groupMap.get(label)!.push(chat)
  }

  for (const [label, groupChats] of groupMap) {
    groups.push({ label, chats: groupChats })
  }

  return groups
}

const MAX_VISIBLE_CHATS_HISTORY = 10
const MAX_VISIBLE_CHATS_PINNED = 50

// --- Shared Components ---

function SmartTruncatedTooltip({ text, className }: { text: string; className?: string }) {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  const checkTruncation = () => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth)
    }
  }

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <span
          ref={textRef}
          onMouseEnter={checkTruncation}
          className={cn("truncate", className)}
        >
          {text}
        </span>
      </TooltipTrigger>
      {isTruncated && (
        <TooltipContent side="right" align="start" className="max-w-[200px] break-words">
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  )
}

function ChatItem({ chat }: { chat: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { renameChat, pinChat, archiveChat, deleteChat } = useAICrypto()
  const currentConversationId = searchParams.get("conversationId")

  const [isEditing, setIsEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState(chat.title)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const isActive = currentConversationId === chat.id

  const handleNavigate = () => {
    if (!isEditing) router.push(`/new?conversationId=${chat.id}`)
  }

  const handleRenameSave = async () => {
    if (editTitle.trim() && editTitle.trim() !== chat.title) {
      try {
        await renameChat(chat.id, editTitle.trim())
        toast.success("Chat renamed")
      } catch {
        toast.error("Failed to rename chat")
      }
    } else {
      setEditTitle(chat.title) // reset if empty or unchanged
    }
    setIsEditing(false)
  }

  const confirmDelete = async () => {
    try {
      await deleteChat(chat.id)
      setDeleteDialogOpen(false)
      toast.success("Chat deleted")
    } catch {
      toast.error("Failed to delete chat")
    }
  }

  return (
    <>
      <div
        className={cn(
          "group/chat-item relative flex items-center h-7 pl-3 pr-1 text-[13px] cursor-pointer rounded-r-md transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
        onClick={handleNavigate}
      >
        {isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSave()
              if (e.key === "Escape") {
                setEditTitle(chat.title)
                setIsEditing(false)
              }
              e.stopPropagation()
            }}
            onBlur={handleRenameSave}
            autoFocus
            className="h-5 text-xs px-1 py-0 w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <SmartTruncatedTooltip text={chat.title} className="flex-1 pr-4" />

            {/* Actions dropdown on hover */}
            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/chat-item:opacity-100 transition-opacity">
              <DropdownMenu>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <div
                        role="button"
                        className="p-0.5 hover:bg-sidebar-accent rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconDotsVertical className="size-3.5" />
                      </div>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Options</TooltipContent>
                </Tooltip>

                <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="w-40">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}>
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
                    onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true) }}
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
    </>
  )
}

// --- Specific Nav Components ---

interface NavProps {
  onSearchOpen: () => void
}

export function NavPinned({ onSearchOpen }: NavProps) {
  const { chats } = useAICrypto()
  const { state } = useSidebar()

  const [isExpanded, setIsExpanded] = React.useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("pinned-expanded")
      return stored === null ? true : stored === "true"
    }
    return true
  })
  const [isHovered, setIsHovered] = React.useState(false)

  const pinnedChats = [...chats]
    .filter(c => c.pinned && !c.archived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (pinnedChats.length === 0) return null

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !isExpanded
    setIsExpanded(next)
    sessionStorage.setItem("pinned-expanded", String(next))
  }

  const visibleChats = pinnedChats.slice(0, MAX_VISIBLE_CHATS_PINNED)
  const hasMore = pinnedChats.length > MAX_VISIBLE_CHATS_PINNED

  return (
    <SidebarGroup className="p-0 px-2 mt-2">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={{
                children: "Pinned",
                side: "right",
                hidden: state !== "collapsed"
              }}
            >
              <div
                className="flex w-full items-center cursor-default"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div
                  role="button"
                  onClick={toggleExpanded}
                  className="flex items-center justify-center size-6 -ml-1 rounded-sm hover:bg-sidebar-accent/50 transition-colors shrink-0 cursor-pointer"
                >
                  {isHovered && state !== "collapsed" ? (
                    <IconChevronDown
                      className={cn(
                        "size-4 shrink-0 transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                  ) : (
                    <IconPinFilled className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <div
                  onClick={onSearchOpen}
                  className="flex-1 ml-1 cursor-pointer h-full flex items-center group-data-[collapsible=icon]:hidden font-medium text-sidebar-foreground"
                >
                  Pinned
                </div>
              </div>
            </SidebarMenuButton>

            {isExpanded && state !== "collapsed" && (
              <div className="mt-1 ml-[11px] border-l border-border/40 pl-0 relative">
                <div className="flex flex-col gap-0.5">
                  {visibleChats.map((chat) => (
                    <ChatItem key={chat.id} chat={chat} />
                  ))}
                </div>

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
    </SidebarGroup>
  )
}

export function NavHistory({ onSearchOpen }: NavProps) {
  const { chats } = useAICrypto()
  const { state } = useSidebar()

  const [isExpanded, setIsExpanded] = React.useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("history-expanded")
      return stored === null ? true : stored === "true"
    }
    return true
  })

  const [isHovered, setIsHovered] = React.useState(false)

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !isExpanded
    setIsExpanded(next)
    sessionStorage.setItem("history-expanded", String(next))
  }

  const groups = groupChatsByTimeline(chats)
  let totalShown = 0
  const historyChatsCount = chats.filter(c => !c.pinned && !c.archived).length
  const hasMore = historyChatsCount > MAX_VISIBLE_CHATS_HISTORY

  return (
    <SidebarGroup className="p-0 px-2 mt-2">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={{
                children: "History",
                side: "right",
                hidden: state !== "collapsed"
              }}
            >
              <div
                className="flex w-full items-center cursor-default"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div
                  role="button"
                  onClick={toggleExpanded}
                  className="flex items-center justify-center size-6 -ml-1 rounded-sm hover:bg-sidebar-accent/50 transition-colors shrink-0 cursor-pointer"
                >
                  {isHovered && state !== "collapsed" ? (
                    <IconChevronDown
                      className={cn(
                        "size-4 shrink-0 transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                  ) : (
                    <IconHistory className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <div
                  onClick={onSearchOpen}
                  className="flex-1 ml-1 cursor-pointer h-full flex items-center group-data-[collapsible=icon]:hidden font-medium text-sidebar-foreground"
                >
                  History
                </div>
              </div>
            </SidebarMenuButton>

            {isExpanded && state !== "collapsed" && (
              <div className="mt-1 ml-[11px] border-l border-border/40 pl-0">
                {groups.map((group) => {
                  const remainingSlots = MAX_VISIBLE_CHATS_HISTORY - totalShown
                  if (remainingSlots <= 0) return null

                  const visibleChats = group.chats.slice(0, remainingSlots)
                  totalShown += visibleChats.length

                  if (visibleChats.length === 0) return null

                  return (
                    <div key={group.label} className="mb-2 relative">
                      <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground/60 select-none">
                        {group.label}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        {visibleChats.map((chat) => (
                          <ChatItem key={chat.id} chat={chat} />
                        ))}
                      </div>
                    </div>
                  )
                })}

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
    </SidebarGroup>
  )
}

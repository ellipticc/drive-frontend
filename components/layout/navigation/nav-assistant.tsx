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
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// --- Types ---

type ChatType = { id: string; title: string; pinned: boolean; archived: boolean; createdAt: string }

type ChatActions = {
  renameChat: (conversationId: string, newTitle: string) => Promise<void>
  pinChat: (conversationId: string, pinned: boolean) => Promise<void>
  archiveChat: (conversationId: string, archived: boolean) => Promise<void>
  deleteChat: (conversationId: string) => Promise<void>
}

// --- Helper Functions ---

function groupChatsByTimeline(chats: ChatType[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: { label: string; chats: ChatType[] }[] = []
  const groupMap = new Map<string, ChatType[]>()

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

// ChatItem receives actions as props - NO useAICrypto call here
function ChatItem({ chat, actions }: { chat: ChatType; actions: ChatActions }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentConversationId = searchParams.get("conversationId")

  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false)
  const [renameTitle, setRenameTitle] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const isActive = currentConversationId === chat.id

  const handleNavigate = () => {
    router.push(`/new?conversationId=${chat.id}`)
  }

  const openRenameDialog = () => {
    setRenameTitle(chat.title)
    setRenameDialogOpen(true)
  }

  const handleRenameSave = async () => {
    const trimmed = renameTitle.trim()
    if (!trimmed) {
      toast.error("Title cannot be empty")
      return
    }
    if (trimmed.length > 100) {
      toast.error("Title must be 100 characters or less")
      return
    }
    if (trimmed === chat.title) {
      setRenameDialogOpen(false)
      return
    }
    try {
      await actions.renameChat(chat.id, trimmed)
      toast.success("Chat renamed")
      setRenameDialogOpen(false)
    } catch {
      toast.error("Failed to rename chat")
    }
  }

  const confirmDelete = async () => {
    try {
      await actions.deleteChat(chat.id)
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
          "group/chat-item relative flex items-center h-7 ml-2 pl-2 pr-1 text-[13px] cursor-pointer rounded-md transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
        onClick={handleNavigate}
      >
        <SmartTruncatedTooltip text={chat.title} className="flex-1 pr-5" />

        {/* Actions dropdown on hover */}
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/chat-item:opacity-100 transition-opacity">
          <DropdownMenu>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div
                    role="button"
                    className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconDotsVertical className="size-3.5" />
                  </div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Options</TooltipContent>
            </Tooltip>

            <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRenameDialog() }}>
                <IconPencil className="size-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await actions.pinChat(chat.id, !chat.pinned)
                    toast.success(chat.pinned ? "Unpinned" : "Pinned")
                  } catch { toast.error("Failed") }
                }}
              >
                {chat.pinned ? <IconPinFilled className="size-3.5 mr-2" /> : <IconPin className="size-3.5 mr-2" />}
                {chat.pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await actions.archiveChat(chat.id, true)
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
                className="text-red-600 focus:bg-red-600/15 focus:text-red-600 hover:bg-red-600/15 hover:text-red-700 dark:text-red-500 dark:focus:bg-red-500/20 dark:focus:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 font-medium"
              >
                <IconTrash className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Label htmlFor="rename-input" className="text-sm text-muted-foreground mb-2 block">
              Chat title
            </Label>
            <Input
              id="rename-input"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSave()
              }}
              maxLength={100}
              autoFocus
              placeholder="Enter a title..."
            />
            {renameTitle.trim().length === 0 && (
              <p className="text-xs text-destructive mt-1">Title cannot be empty</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSave} disabled={renameTitle.trim().length === 0}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
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

// --- Nav Components ---

interface NavProps {
  onSearchOpen: () => void
  chats: ChatType[]
  actions: ChatActions
}

export function NavPinned({ onSearchOpen, chats, actions }: NavProps) {
  const { state } = useSidebar()

  const [isExpanded, setIsExpanded] = React.useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("pinned-expanded")
      return stored === null ? true : stored === "true"
    }
    return true
  })
  const [isHovered, setIsHovered] = React.useState(false)

  const pinnedChats = React.useMemo(() =>
    [...chats]
      .filter(c => !!c.pinned && !c.archived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [chats]
  )

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
    <SidebarGroup className="p-0 px-2 mt-1">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={onSearchOpen}
              className="cursor-pointer group/nav-item transition-all"
              tooltip={{
                children: "Pinned",
                side: "right",
                hidden: state !== "collapsed"
              }}
            >
              <div
                role="button"
                onClick={toggleExpanded}
                className="flex items-center justify-center p-0.5 -ml-1 mr-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
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
              <span className="font-medium group-data-[collapsible=icon]:hidden">
                Pinned
              </span>
            </SidebarMenuButton>

            {isExpanded && state !== "collapsed" && (
              <div className="mt-1 ml-[11px] border-l border-border/40 pl-0 relative">
                <div className="flex flex-col gap-[3px]">
                  {visibleChats.map((chat) => (
                    <ChatItem key={chat.id} chat={chat} actions={actions} />
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

export function NavHistory({ onSearchOpen, chats, actions }: NavProps) {
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

  const groups = React.useMemo(() => groupChatsByTimeline(chats), [chats])
  let totalShown = 0
  const historyChatsCount = chats.filter(c => !c.pinned && !c.archived).length
  const hasMore = historyChatsCount > MAX_VISIBLE_CHATS_HISTORY

  return (
    <SidebarGroup className="p-0 px-2 mt-1">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={onSearchOpen}
              className="cursor-pointer group/nav-item transition-all"
              tooltip={{
                children: "History",
                side: "right",
                hidden: state !== "collapsed"
              }}
            >
              <div
                role="button"
                onClick={toggleExpanded}
                className="flex items-center justify-center p-0.5 -ml-1 mr-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
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
              <span className="font-medium group-data-[collapsible=icon]:hidden">
                History
              </span>
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

                      <div className="flex flex-col gap-[3px]">
                        {visibleChats.map((chat) => (
                          <ChatItem key={chat.id} chat={chat} actions={actions} />
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

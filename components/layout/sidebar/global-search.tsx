"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    IconBubbleText,
    IconLoader2,
    IconExternalLink,
    IconEdit,
    IconTrash,
    IconArrowsDiagonalMinimize2,
    IconMaximize,
    IconMessageCircleOff,
    IconCopy,
} from "@tabler/icons-react"
import { useRelativeTime, cn } from "@/lib/utils"
import { sortChatsByLastMessage } from "@/lib/chat-utils"
import type { ChatType } from "@/components/layout/navigation/nav-assistant"
import {
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Command,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { ChatMessage, Message } from "@/components/ai-elements/chat-message"
import { toast } from "sonner"

//  Types 

type ChatGroup = {
    label: string
    chats: ChatType[]
}

//  Chat Grouping Utility 

function groupChatsByDate(chats: ChatType[]): ChatGroup[] {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const buckets: [string, ChatType[]][] = [
        ["Today", []],
        ["Yesterday", []],
        ["Last 7 days", []],
        ["Last 30 days", []],
        ["Earlier", []],
    ]

    for (const chat of chats) {
        const d = new Date(chat.lastMessageAt || chat.createdAt)
        if (d >= startOfToday) buckets[0][1].push(chat)
        else if (d >= startOfYesterday) buckets[1][1].push(chat)
        else if (d >= sevenDaysAgo) buckets[2][1].push(chat)
        else if (d >= thirtyDaysAgo) buckets[3][1].push(chat)
        else buckets[4][1].push(chat)
    }

    return buckets
        .filter(([, list]) => list.length > 0)
        .map(([label, chats]) => ({ label, chats }))
}

//  ActionTooltip (single TooltipProvider prevents flicker) 

const ActionTooltip = React.memo(function ActionTooltip({
    children,
    tooltip,
    side = "top",
}: {
    children: React.ReactNode
    tooltip: string
    side?: "top" | "bottom" | "left" | "right"
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side} sideOffset={4} className="text-xs">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    )
})

//  FooterAction 

function FooterAction({
    label,
    kbd,
    disabled,
    destructive,
    onClick,
}: {
    label: string
    kbd: string
    disabled?: boolean
    destructive?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-normal",
                "transition-colors duration-100 outline-none",
                "disabled:opacity-30 disabled:pointer-events-none",
                destructive
                    ? "text-destructive/70 hover:text-destructive hover:bg-destructive/8"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
        >
            {label}
            <kbd
                className={cn(
                    "inline-flex items-center h-[17px] px-1 rounded-[3px] border font-sans text-[10px] leading-none",
                    destructive
                        ? "border-destructive/25 text-destructive/60 bg-destructive/5"
                        : "border-border/60 text-muted-foreground/60 bg-muted/30"
                )}
            >
                {kbd}
            </kbd>
        </button>
    )
}

//  ChatCommandItem 

const ChatCommandItem = React.memo(function ChatCommandItem({
    chat,
    isSelected,
    isHovered,
    isVisuallyActive,
    isCurrent,
    onSelect,
    onGo,
    onHoverStart,
    onHoverEnd,
    onEdit,
    onDelete,
    onOpenNewTab,
}: {
    chat: ChatType
    isSelected: boolean
    isHovered: boolean        // pointer is physically over this item right now
    isVisuallyActive: boolean // persistent highlight: last hovered/selected
    isCurrent: boolean
    onSelect: () => void
    onGo: () => void
    onHoverStart: () => void
    onHoverEnd: () => void
    onEdit: (chat: ChatType) => void
    onDelete: (chat: ChatType) => void
    onOpenNewTab: (chat: ChatType) => void
}) {
    const timeText = useRelativeTime(chat.lastMessageAt || chat.createdAt)

    return (
        <CommandItem
            onSelect={onGo}
            className="p-0 outline-none focus-visible:ring-0 data-[selected=true]:bg-transparent data-[selected=true]:text-foreground"
            value={chat.title + " " + chat.id}
        >
            <div
                className={cn(
                    "w-full cursor-pointer py-[7px] px-3 group relative flex items-center gap-2 rounded-lg outline-none",
                    "transition-colors duration-100",
                    isSelected
                        ? "bg-accent text-accent-foreground"
                        : isVisuallyActive
                            ? "bg-muted/60"
                            : "hover:bg-muted/40"
                )}
                onPointerEnter={(e) => { e.stopPropagation(); onHoverStart() }}
                onPointerLeave={(e) => { e.stopPropagation(); onHoverEnd() }}
                onClick={(e) => { e.stopPropagation(); onGo() }}
            >
                <IconBubbleText className="shrink-0 h-[15px] w-[15px] text-muted-foreground/60" />

                {/* Title  always pr-[88px] so the right zone never shifts layout */}
                <span className="truncate flex-1 min-w-0 text-base pr-[88px]">{chat.title}</span>

                {/* Fixed 80px right-side zone: timestamp  icons, no layout shift */}
                <div className="absolute right-2 w-[80px] flex items-center justify-end">
                    {/* Timestamp layer */}
                    <span
                        className={cn(
                            "text-[11px] text-muted-foreground/55 whitespace-nowrap transition-opacity duration-150 pointer-events-none select-none",
                            isHovered ? "opacity-0" : "opacity-100"
                        )}
                    >
                        {isCurrent ? (
                            <span className="text-[10px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-sm">
                                Current
                            </span>
                        ) : timeText}
                    </span>

                    {/* Icons layer — absolutely overlaid, same slot. Show when physically hovering. */}
                    <div
                        className={cn(
                            "absolute inset-0 flex items-center justify-end gap-0.5",
                            "transition-opacity duration-150",
                            isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ActionTooltip tooltip="New tab">
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenNewTab(chat) }}
                            >
                                <IconExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </ActionTooltip>

                        <ActionTooltip tooltip="Rename">
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(chat) }}
                            >
                                <IconEdit className="h-3.5 w-3.5" />
                            </Button>
                        </ActionTooltip>

                        <ActionTooltip tooltip="Delete">
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-destructive/55 hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(chat) }}
                            >
                                <IconTrash className="h-3.5 w-3.5" />
                            </Button>
                        </ActionTooltip>
                    </div>
                </div>
            </div>
        </CommandItem>
    )
})

//  GlobalSearch 

export function GlobalSearch({
    open,
    onOpenChange,
    filter,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    filter: "pinned" | "history" | null
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentConversationId = searchParams.get("conversationId")

    const { chats, renameChat, deleteChat, decryptHistory } = useAICrypto()

    //  Modal state 
    const [editingChat, setEditingChat] = React.useState<ChatType | null>(null)
    const [deletingChat, setDeletingChat] = React.useState<ChatType | null>(null)
    const [renameTitle, setRenameTitle] = React.useState("")

    //  UX state 
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [cmdkValue, setCmdkValue] = React.useState("")

    // Explicit 3-way state separation per spec:
    //   selectedConversationId   set by click ONLY
    //   hoveredConversationId    set by pointer enter/leave
    //   previewConversationId    persistent: follows hover, stays when leaving
    const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null)
    const [hoveredConversationId, setHoveredConversationId] = React.useState<string | null>(null)
    const [previewConversationId, setPreviewConversationId] = React.useState<string | null>(null)

    //  Preview cache (Map<id, {messages, fetchedAt}>) 
    // Prevents ALL duplicate fetches: on hover, on expand toggle, on re-render.
    const CACHE_STALE_MS = 5 * 60 * 1000
    const previewCacheRef = React.useRef<Map<string, { messages: Message[]; fetchedAt: number }>>(
        new Map()
    )

    //  Preview messages 
    const [previewMessages, setPreviewMessages] = React.useState<Message[]>([])
    const [previewLoading, setPreviewLoading] = React.useState(false)
    const scrollRef = React.useRef<HTMLDivElement>(null)

    //  Hover handlers (persistence logic) 
    const handleHoverStart = React.useCallback((chatId: string) => {
        setHoveredConversationId(chatId)
        if (isExpanded) setPreviewConversationId(chatId) // only fetch when preview visible
    }, [isExpanded])

    const handleHoverEnd = React.useCallback(() => {
        setHoveredConversationId(null)
        // previewConversationId deliberately NOT reset here  hover persistence rule
    }, [])

    const handleSelect = React.useCallback((chatId: string) => {
        setSelectedConversationId(prev => (prev === chatId ? null : chatId))
        if (isExpanded) setPreviewConversationId(chatId)
    }, [isExpanded])

    //  Filtered + grouped chats 
    const filteredChats = React.useMemo(() => {
        return sortChatsByLastMessage(chats).filter((chat: ChatType) => {
            if (filter === "pinned") return chat.pinned && !chat.archived
            if (filter === "history") return !chat.pinned && !chat.archived
            return !chat.archived
        })
    }, [chats, filter])

    const chatGroups = React.useMemo(() => groupChatsByDate(filteredChats), [filteredChats])

    //  Footer / keyboard target: Selected > Hovered (if collapsed) > Preview 
    const activeFooterId = selectedConversationId || previewConversationId || hoveredConversationId || null
    const footerChat = React.useMemo(() => chats.find(c => c.id === activeFooterId) ?? null, [chats, activeFooterId])
    const previewChat = React.useMemo(() => chats.find(c => c.id === previewConversationId) ?? null, [chats, previewConversationId])

    //  Preview load effect 
    // KEY RULE: depends on previewConversationId ONLY, NOT isExpanded.
    // Toggling expanded never triggers a re-fetch; cached data is always reused.
    React.useEffect(() => {
        if (!previewConversationId || !open || !isExpanded) {
            if (!previewConversationId) {
                setPreviewMessages([])
                setPreviewLoading(false)
            }
            return
        }

        // Cache hit  use immediately, no network call
        const cached = previewCacheRef.current.get(previewConversationId)
        if (cached && Date.now() - cached.fetchedAt < CACHE_STALE_MS) {
            setPreviewMessages(cached.messages)
            setPreviewLoading(false)
            return
        }

        // Cache miss / stale  fetch once
        let cancelled = false
        setPreviewLoading(true)

        decryptHistory(previewConversationId)
            .then(msgs => {
                if (cancelled) return
                previewCacheRef.current.set(previewConversationId, {
                    messages: msgs,
                    fetchedAt: Date.now(),
                })
                setPreviewMessages(msgs)
                setPreviewLoading(false)
            })
            .catch(err => {
                if (cancelled) return
                console.error("Chat preview failed", err)
                setPreviewLoading(false)
            })

        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewConversationId, open])

    //  Auto-scroll preview to bottom (via rAF  no forced reflow) 
    React.useEffect(() => {
        if (!isExpanded || previewMessages.length === 0) return
        const id = requestAnimationFrame(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
        })
        return () => cancelAnimationFrame(id)
    }, [previewMessages, isExpanded])

    //  Cleanup on dialog close 
    React.useEffect(() => {
        if (!open) {
            setSelectedConversationId(null)
            setHoveredConversationId(null)
            setPreviewConversationId(null)
            setCmdkValue("")
            setPreviewMessages([])
            setPreviewLoading(false)
        }
    }, [open])

    // when collapsing preview clear anchor and messages
    React.useEffect(() => {
        if (!isExpanded) {
            setPreviewConversationId(null)
            setPreviewMessages([])
            setPreviewLoading(false)
        }
    }, [isExpanded])

    //  Action handlers 
    const handleOpenEdit = React.useCallback((chat: ChatType) => { setRenameTitle(chat.title); setEditingChat(chat) }, [])
    const handleOpenDelete = React.useCallback((chat: ChatType) => { setDeletingChat(chat) }, [])
    const handleOpenNewTab = React.useCallback((chat: ChatType) => { window.open(`/new?conversationId=${chat.id}`, "_blank") }, [])

    const handleGo = React.useCallback((id?: string) => {
        const target = id || footerChat?.id
        if (target) { router.push(`/new?conversationId=${target}`); onOpenChange(false) }
    }, [footerChat, router, onOpenChange])

    //  Keyboard shortcuts 
    React.useEffect(() => {
        if (!open) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement && e.target.id === "rename-input") return
            const chat = footerChat
            if ((e.ctrlKey || e.metaKey) && chat) {
                if (e.key === "e") { e.preventDefault(); handleOpenEdit(chat) }
                if (e.key === "d") { e.preventDefault(); handleOpenDelete(chat) }
            }
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [open, footerChat, handleOpenEdit, handleOpenDelete])

    //  Rename handler 
    const handleRenameSave = async () => {
        if (!editingChat) return
        const trimmed = renameTitle.trim()
        if (!trimmed) { toast.error("Title cannot be empty"); return }
        if (trimmed === editingChat.title) { setEditingChat(null); return }
        try {
            await renameChat(editingChat.id, trimmed)
            toast.success("Chat renamed")
            setEditingChat(null)
        } catch { toast.error("Failed to rename chat") }
    }

    //  Delete handler 
    const confirmDelete = async () => {
        if (!deletingChat) return
        try {
            await deleteChat(deletingChat.id)
            previewCacheRef.current.delete(deletingChat.id) // evict from cache
            toast.success("Chat deleted")
            setDeletingChat(null)
            if (selectedConversationId === deletingChat.id) setSelectedConversationId(null)
            if (previewConversationId === deletingChat.id) setPreviewConversationId(null)
        } catch { toast.error("Failed to delete chat") }
    }

    //  Dialog dimensions
    // Use ! (important) to override DialogContent's built-in sm:max-w-lg, grid, gap-4, p-6
    const dialogSizeClass = isExpanded
        ? "!w-[92vw] !max-w-[1600px] !h-[92vh]"
        : "!w-[680px] !max-w-[calc(100vw-2rem)] !h-[560px] !max-h-[88vh]"

    //  Render 
    return (
        // Single TooltipProvider wrapping everything prevents per-tooltip mount flicker
        <TooltipProvider delayDuration={500} skipDelayDuration={0}>
            <>
                {/* 
                    MAIN SEARCH DIALOG
                 */}
                <Dialog
                    open={open}
                    onOpenChange={(val) => { onOpenChange(val) }}
                >
                    <DialogContent
                        className={cn(
                            // Override base: grid → flex, p-6 → p-0, gap-4 → gap-0, sm:max-w-lg → our size
                            "!flex !flex-col !p-0 !gap-0 !overflow-hidden",
                            "!rounded-xl border border-border/40 bg-background shadow-2xl",
                            "transition-[width,height] duration-300 ease-in-out",
                            dialogSizeClass
                        )}
                        showCloseButton={false}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        {/* a11y: Radix requires DialogTitle  hidden visually */}
                        <DialogHeader className="sr-only">
                            <DialogTitle>
                                {filter === "pinned" ? "Pinned Conversations" : "Conversation History"}
                            </DialogTitle>
                            <DialogDescription>
                                Search conversations. Arrow keys to navigate, Enter to open, Ctrl+E to rename, Ctrl+D to delete.
                            </DialogDescription>
                        </DialogHeader>

                        <Command
                            className="flex flex-col flex-1 min-h-0 w-full bg-transparent overflow-hidden"
                            shouldFilter={true}
                            value={cmdkValue}
                            onValueChange={setCmdkValue}
                            loop={false}
                        >
                            {/*  Sticky Search Header 
                                Solid background so it never bleeds through in dark mode.
                                z-20 so it stays above the scroll content.
                             */}
                            <div
                                className={cn(
                                    "shrink-0 w-full sticky top-0 z-20",
                                    "bg-background",
                                    isExpanded ? "h-10" : "h-11"
                                )}
                            >
                                <CommandInput
                                    placeholder={
                                        filter === "pinned"
                                            ? "Search pinned chats..."
                                            : "Search conversations..."
                                    }
                                    className="border-none bg-transparent h-full text-sm outline-none focus:ring-0 focus-visible:ring-0"
                                />
                            </div>

                            {/*  Body  */}
                            <div className="flex flex-1 min-h-0 overflow-hidden">

                                {/*  LEFT: Conversation list  */}
                                <div
                                    className={cn(
                                        "flex flex-col h-full justify-start bg-background overflow-hidden",
                                        "transition-[width] duration-300",
                                        isExpanded
                                            ? "w-[40%] border-r border-border/25"
                                            : "w-full"
                                    )}
                                >
                                    <CommandList
                                        className="flex-1 overflow-y-auto min-h-0 px-1.5 pt-0.5 !max-h-none"
                                        style={{ overscrollBehavior: "contain" }}
                                    >
                                        <CommandEmpty className="py-10 text-center text-sm text-muted-foreground/60">
                                            No conversations found.
                                        </CommandEmpty>

                                        {chatGroups.map((group) => (
                                            <CommandGroup
                                                key={group.label}
                                                heading={group.label}
                                                className={cn(
                                                    "mb-0.5",
                                                    // Raw text heading  no border, no box, no bg
                                                    "[&_[cmdk-group-heading]]:px-2",
                                                    "[&_[cmdk-group-heading]]:pt-3",
                                                    "[&_[cmdk-group-heading]]:pb-0.5",
                                                    "[&_[cmdk-group-heading]]:text-[10px]",
                                                    "[&_[cmdk-group-heading]]:font-semibold",
                                                    "[&_[cmdk-group-heading]]:tracking-widest",
                                                    "[&_[cmdk-group-heading]]:uppercase",
                                                    "[&_[cmdk-group-heading]]:text-muted-foreground/40",
                                                    "[&_[cmdk-group-heading]]:bg-transparent",
                                                    "[&_[cmdk-group-heading]]:border-0",
                                                    "[&_[cmdk-group-heading]]:shadow-none",
                                                    "[&_[cmdk-group-heading]]:outline-none",
                                                )}
                                            >
                                                {group.chats.map((chat) => (
                                                    <ChatCommandItem
                                                        key={chat.id}
                                                        chat={chat}
                                                        isSelected={selectedConversationId === chat.id}
                                                        isHovered={hoveredConversationId === chat.id}
                                                        isVisuallyActive={previewConversationId === chat.id && selectedConversationId !== chat.id}
                                                        isCurrent={chat.id === currentConversationId}
                                                        onHoverStart={() => handleHoverStart(chat.id)}
                                                        onHoverEnd={handleHoverEnd}
                                                        onSelect={() => handleSelect(chat.id)}
                                                        onGo={() => handleGo(chat.id)}
                                                        onEdit={handleOpenEdit}
                                                        onDelete={handleOpenDelete}
                                                        onOpenNewTab={handleOpenNewTab}
                                                    />
                                                ))}
                                            </CommandGroup>
                                        ))}
                                    </CommandList>
                                </div>

                                {/*  RIGHT: Preview panel (expanded only)  */}
                                {isExpanded && (
                                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
                                        {previewConversationId ? (
                                            <>
                                                {/* Scrollable messages  full height, no overflow clipping */}
                                                <div
                                                    ref={scrollRef}
                                                    className="flex-1 overflow-y-auto min-h-0 px-6 py-4"
                                                >
                                                    {previewLoading ? (
                                                        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/40">
                                                            <IconLoader2 className="w-5 h-5 animate-spin" />
                                                            <span className="text-xs">Loading preview...</span>
                                                        </div>
                                                    ) : previewMessages.length === 0 ? (
                                                        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/40">
                                                            No messages
                                                        </div>
                                                    ) : (
                                                        <div className="max-w-3xl prose-lg mx-auto space-y-4 pb-4">
                                                            {previewMessages.map((msg, i) => (
                                                                <div
                                                                    key={msg.id || i}
                                                                    className={cn(
                                                                        msg.role === "user" ? "flex justify-end" : "flex justify-start"
                                                                    )}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "text-sm leading-relaxed break-words",
                                                                            msg.role === "user"
                                                                                ? "bg-primary text-primary-foreground px-3.5 py-2 rounded-xl max-w-[78%]"
                                                                                : "max-w-[88%] text-foreground/80"
                                                                        )}
                                                                    >
                                                                        {msg.role === "assistant" || msg.role === "system" ? (
                                                                            <div className="prose prose-lg dark:prose-invert max-w-none [&_.suggestions]:hidden [&_.action-buttons]:pointer-events-none [&_.action-buttons]:opacity-50 [&_.regenerate-button]:pointer-events-none [&_.regenerate-button]:opacity-50">
                                                                                <ChatMessage
                                                                                    message={{
                                                                                        ...msg,
                                                                                        suggestions: undefined,
                                                                                        feedback: undefined,
                                                                                    }}
                                                                                    isLast={false}
                                                                                    onCopy={() => { }}
                                                                                    onFeedback={() => { }}
                                                                                    onRegenerate={() => { }}
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <span className="whitespace-pre-wrap">{msg.content}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30 select-none">
                                                <IconMessageCircleOff className="w-9 h-9 opacity-20" />
                                                <p className="text-sm">Hover a conversation to preview</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer — full-width at bottom natively via flex sibling rules */}
                            <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-background border-t border-border/25">
                                <ActionTooltip tooltip={isExpanded ? "Collapse" : "Expand preview"} side={isExpanded ? "top" : "bottom"}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-md"
                                        onClick={() => setIsExpanded(v => !v)}
                                    >
                                        {isExpanded
                                            ? <IconArrowsDiagonalMinimize2 className="h-4 w-4" />
                                            : <IconMaximize className="h-4 w-4" />
                                        }
                                    </Button>
                                </ActionTooltip>
                                <div className="flex items-center">
                                    <FooterAction label="Open" kbd="Enter" disabled={!footerChat} onClick={() => handleGo()} />
                                    <span className="w-px h-3 bg-border/40 mx-1" />
                                    <FooterAction label="Edit" kbd="E" disabled={!footerChat} onClick={() => footerChat && handleOpenEdit(footerChat)} />
                                    <span className="w-px h-3 bg-border/40 mx-1" />
                                    <FooterAction label="Delete" kbd="D" disabled={!footerChat} destructive onClick={() => footerChat && handleOpenDelete(footerChat)} />
                                </div>
                            </div>
                        </Command>
                    </DialogContent>
                </Dialog>

                {/* 
                    RENAME DIALOG
                 */}
                <Dialog open={!!editingChat} onOpenChange={(v) => !v && setEditingChat(null)}>
                    <DialogContent className="sm:max-w-[400px] z-[100]">
                        <DialogHeader>
                            <DialogTitle>Rename Chat</DialogTitle>
                            <DialogDescription className="sr-only">
                                Enter a new title for this conversation.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-3">
                            <Label htmlFor="rename-input" className="text-sm text-muted-foreground mb-2 block">
                                Chat title
                            </Label>
                            <Input
                                id="rename-input"
                                value={renameTitle}
                                onChange={(e) => setRenameTitle(e.target.value)}
                                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") handleRenameSave() }}
                                maxLength={100}
                                autoFocus
                                placeholder="Enter a title..."
                            />
                            {!renameTitle.trim() && (
                                <p className="text-xs text-destructive mt-1">Title cannot be empty</p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingChat(null)}>Cancel</Button>
                            <Button onClick={handleRenameSave} disabled={!renameTitle.trim()}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 
                    DELETE DIALOG
                 */}
                <Dialog open={!!deletingChat} onOpenChange={(v) => !v && setDeletingChat(null)}>
                    <DialogContent className="z-[100]">
                        <DialogHeader>
                            <DialogTitle>Delete Chat?</DialogTitle>
                            <DialogDescription>
                                Permanently delete &ldquo;{deletingChat?.title}&rdquo;? This cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeletingChat(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        </TooltipProvider>
    )
}

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    IconBubbleText,
    IconLoader2,
    IconExternalLink,
    IconEdit,
    IconTrash,
    IconArrowsDiagonalMinimize2,
    IconMaximize,
    IconMessageCircleOff,
} from "@tabler/icons-react"
import { useRelativeTime, cn } from "@/lib/utils"
import { sortChatsByLastMessage } from "@/lib/chat-utils"
import type { ChatType } from "@/components/layout/navigation/nav-assistant"
import {
    CommandDialog,
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { ChatMessage, Message } from "@/components/ai-elements/chat-message"
import { toast } from "sonner"
import { useWindowSize } from "usehooks-ts"

const ActionTooltip = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => (
    <TooltipProvider delayDuration={300}>
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
)

const ChatCommandItem = ({
    chat,
    onSelect,
    onGo,
    isSelected,
    isHovered,
    isCmdKFocused,
    onHoverStart,
    onHoverEnd,
    onEdit,
    onDelete,
    onOpenNewTab,
}: {
    chat: ChatType
    onSelect: () => void
    onGo: () => void
    isSelected: boolean
    isHovered: boolean
    isCmdKFocused: boolean
    onHoverStart: () => void
    onHoverEnd: () => void
    onEdit: (chat: ChatType) => void
    onDelete: (chat: ChatType) => void
    onOpenNewTab: (chat: ChatType) => void
}) => {
    const timeText = useRelativeTime(chat.lastMessageAt || chat.createdAt)

    return (
        <CommandItem
            onSelect={onGo} // Native CmdK "Enter" acts as Go (Open)
            className={cn(
                "p-0 outline-none focus-visible:ring-0", // strip default padding
                "data-[selected=true]:bg-transparent data-[selected=true]:text-foreground" // strip native cmdk styling so we can entirely control it
            )}
            value={chat.title + " " + chat.id} // value for CmdK filtering
        >
            <div
                className={cn(
                    "w-full cursor-pointer py-2.5 px-3 group relative flex items-center gap-2 rounded-xl outline-none transition-colors",
                    isSelected
                        ? "bg-accent/80 text-accent-foreground shadow-sm ring-1 ring-border/50"
                        : (!isSelected && (isHovered || isCmdKFocused) ? "bg-muted/50" : "")
                )}
                onPointerMove={(e) => { e.stopPropagation(); onHoverStart(); }}
                onPointerEnter={(e) => { e.stopPropagation(); onHoverStart(); }}
                onPointerLeave={(e) => { e.stopPropagation(); onHoverEnd(); }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onGo();
                }}
            >
                <IconBubbleText className="shrink-0 h-4 w-4" />
                <span className="truncate flex-1 min-w-0 pr-[92px]">{chat.title}</span>

                {/* Timestamp (fades out on hover) */}
                <span className="absolute right-3 w-[80px] text-right text-xs text-muted-foreground transition-opacity duration-200 opacity-100 group-hover:opacity-0 bg-transparent pointer-events-none">
                    {timeText}
                </span>

                {/* Hover Actions (fades in on hover) */}
                <div
                    className="absolute right-2 flex items-center justify-end gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 bg-background/80 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none px-1 rounded-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ActionTooltip tooltip="New Tab">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onOpenNewTab(chat)
                            }}
                        >
                            <IconExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    </ActionTooltip>

                    <ActionTooltip tooltip="Edit">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onEdit(chat)
                            }}
                        >
                            <IconEdit className="h-3.5 w-3.5" />
                        </Button>
                    </ActionTooltip>

                    <ActionTooltip tooltip="Trash">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onDelete(chat)
                            }}
                        >
                            <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                    </ActionTooltip>
                </div>
            </div>
        </CommandItem>
    )
}

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
    const { width } = useWindowSize()
    const { chats, renameChat, deleteChat, decryptHistory } = useAICrypto()

    // Modals state
    const [editingChat, setEditingChat] = React.useState<ChatType | null>(null)
    const [deletingChat, setDeletingChat] = React.useState<ChatType | null>(null)
    const [renameTitle, setRenameTitle] = React.useState("")

    // UX State
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null)
    const [hoveredChatId, setHoveredChatId] = React.useState<string | null>(null)
    const [cmdkValue, setCmdkValue] = React.useState("")

    // Preview State
    const [previewMessages, setPreviewMessages] = React.useState<Message[]>([])
    const [previewLoading, setPreviewLoading] = React.useState(false)
    const scrollRef = React.useRef<HTMLDivElement>(null)

    const filteredChats = React.useMemo(() => {
        return sortChatsByLastMessage(chats).filter((chat: ChatType) => {
            if (filter === "pinned") return chat.pinned && !chat.archived
            if (filter === "history") return !chat.pinned && !chat.archived
            return !chat.archived
        })
    }, [chats, filter])

    // Derive target items
    const cmdkChatId = React.useMemo(() => {
        if (!cmdkValue) return null
        return filteredChats.find(c => (c.title + " " + c.id).toLowerCase() === cmdkValue)?.id || null
    }, [cmdkValue, filteredChats])

    // Preview targets Hover > Cmdk > Selected
    const activePreviewId = hoveredChatId || cmdkChatId || selectedChatId || null
    // Footer/Keyboard Target targets Selected > Hover > Cmdk
    const activeFooterId = selectedChatId || hoveredChatId || cmdkChatId || null

    const previewChat = React.useMemo(() => chats.find(c => c.id === activePreviewId), [chats, activePreviewId])
    const footerChat = React.useMemo(() => chats.find(c => c.id === activeFooterId), [chats, activeFooterId])

    // Real-time Preview Effect if expanded
    React.useEffect(() => {
        if (!isExpanded || !activePreviewId || !open) {
            setPreviewMessages([])
            return
        }
        let isMounted = true
        setPreviewLoading(true)
        setPreviewMessages([])
        decryptHistory(activePreviewId).then(msgs => {
            if (isMounted) {
                setPreviewMessages(msgs)
                setPreviewLoading(false)
            }
        }).catch(err => {
            console.error("Failed to decrypt chat preview", err)
            if (isMounted) setPreviewLoading(false)
        })
        return () => { isMounted = false }
    }, [activePreviewId, decryptHistory, open, isExpanded])

    // Auto-scroll to bottom of preview when messages load
    React.useEffect(() => {
        if (isExpanded && previewMessages.length > 0 && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [previewMessages, previewLoading, isExpanded])

    const handleOpenEdit = React.useCallback((chat: ChatType) => {
        setRenameTitle(chat.title)
        setEditingChat(chat)
    }, [])

    const handleOpenDelete = React.useCallback((chat: ChatType) => {
        setDeletingChat(chat)
    }, [])

    const handleOpenNewTab = React.useCallback((chat: ChatType) => {
        window.open(`/new?conversationId=${chat.id}`, '_blank')
        // DELIBERATELY DO NOT CLOSE THE DIALOG
    }, [])

    const handleGo = React.useCallback((id?: string) => {
        const target = id || footerChat?.id
        if (target) {
            router.push(`/new?conversationId=${target}`)
            onOpenChange(false)
        }
    }, [footerChat, router, onOpenChange])

    // Keyboard Shortcuts (Ctrl+E, Ctrl+D, Enter for Open)
    React.useEffect(() => {
        if (!open) return
        const down = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement && e.target.id === "rename-input") return

            const chat = footerChat

            if (e.key === "Enter" && chat && !(e.ctrlKey || e.metaKey)) {
                // We let CmdK native onSelect handle standard Enter, but just in case we catch it globally too if CmdK misses due to focus.
            } else if (e.ctrlKey || e.metaKey) {
                if (e.key === "e" && chat) {
                    e.preventDefault()
                    handleOpenEdit(chat)
                }
                if (e.key === "d" && chat) {
                    e.preventDefault()
                    handleOpenDelete(chat)
                }
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, footerChat, handleOpenEdit, handleOpenDelete])

    const handleRenameSave = async () => {
        if (!editingChat) return
        const trimmed = renameTitle.trim()
        if (!trimmed) {
            toast.error("Title cannot be empty")
            return
        }
        if (trimmed === editingChat.title) {
            setEditingChat(null)
            return
        }
        try {
            await renameChat(editingChat.id, trimmed)
            toast.success("Chat renamed")
            setEditingChat(null)
        } catch {
            toast.error("Failed to rename chat")
        }
    }

    const confirmDelete = async () => {
        if (!deletingChat) return
        try {
            await deleteChat(deletingChat.id)
            toast.success("Chat deleted")
            setDeletingChat(null)
            if (selectedChatId === deletingChat.id) setSelectedChatId(null)
            if (hoveredChatId === deletingChat.id) setHoveredChatId(null)
            // CmdkValue naturally resets via its own list syncing
        } catch {
            toast.error("Failed to delete chat")
        }
    }

    // Dynamic Dialog Dimensions
    const expandedWidthClass = "w-[95vw] sm:max-w-[95vw] md:w-[94vw] md:max-w-[1400px]"
    const expandedHeightClass = "h-[94vh] max-h-[94vh]"
    const collapsedWidthClass = "w-[800px] sm:max-w-[800px]"
    const collapsedHeightClass = "h-[650px] max-h-[85vh]"

    const dialogWidthClass = isExpanded ? expandedWidthClass : collapsedWidthClass
    const dialogHeightClass = isExpanded ? expandedHeightClass : collapsedHeightClass

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(val) => {
                    onOpenChange(val)
                    if (!val) {
                        setSelectedChatId(null)
                        setHoveredChatId(null)
                        setCmdkValue("")
                    }
                }}
            >
                <DialogContent
                    className={cn(
                        "p-0 overflow-hidden flex flex-col gap-0 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl sm:rounded-xl transition-all duration-300",
                        dialogWidthClass,
                        dialogHeightClass
                    )}
                    showCloseButton={false}
                >
                    <Command
                        className="flex flex-col h-full w-full bg-transparent overflow-hidden"
                        shouldFilter={true}
                        value={cmdkValue}
                        onValueChange={setCmdkValue}
                        loop={false}
                    >
                        {/* TOP HEADER: Full width search bar */}
                        <div className={cn("border-b border-border/50 bg-background/50 relative z-10 w-full shrink-0 transition-all duration-300", isExpanded ? "h-10 border-none opacity-80" : "h-14")}>
                            <CommandInput
                                placeholder="Search chats..."
                                className={cn("border-none transition-all duration-300", isExpanded ? "h-10 text-sm px-4" : "h-14 text-lg px-6")}
                            />
                        </div>

                        {/* BODY: Split Layout dynamically applied */}
                        <div className="flex flex-1 overflow-hidden min-h-0">

                            {/* LEFT COLUMN: History List */}
                            <div className={cn(
                                "shrink-0 flex flex-col h-full overflow-hidden transition-all duration-300 min-h-0",
                                isExpanded ? "w-[40%] border-r border-border/50 bg-sidebar/50 backdrop-blur-sm" : "w-full"
                            )}>
                                <CommandList className="flex-1 overflow-y-auto w-full max-h-none p-2 min-h-0">
                                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                        No results found.
                                    </CommandEmpty>
                                    <CommandGroup
                                        heading={filter === "pinned" ? "Pinned" : "History"}
                                        className={cn("p-0 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground border-none outline-none")}
                                    >
                                        {filteredChats.map((chat) => (
                                            <ChatCommandItem
                                                key={chat.id}
                                                chat={chat}
                                                isSelected={selectedChatId === chat.id}
                                                isHovered={hoveredChatId === chat.id}
                                                isCmdKFocused={cmdkChatId === chat.id}
                                                onHoverStart={() => setHoveredChatId(chat.id)}
                                                onHoverEnd={() => setHoveredChatId(null)}
                                                onSelect={() => setSelectedChatId(chat.id)}
                                                onGo={() => handleGo(chat.id)}
                                                onEdit={handleOpenEdit}
                                                onDelete={handleOpenDelete}
                                                onOpenNewTab={handleOpenNewTab}
                                            />
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </div>

                            {/* RIGHT COLUMN: Real-time Preview Area (Only visible when expanded) */}
                            {isExpanded && (
                                <div className="w-[60%] flex flex-col h-full overflow-hidden bg-background min-h-0">
                                    {activePreviewId ? (
                                        <div className="flex flex-col h-full">
                                            {/* Preview Scrollable Content */}
                                            <div
                                                ref={scrollRef}
                                                className="flex-1 overflow-y-auto px-8 py-8 space-y-6"
                                            >
                                                {previewLoading ? (
                                                    <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground gap-3">
                                                        <IconLoader2 className="w-6 h-6 animate-spin opacity-50" />
                                                        <p className="text-sm">Decrypting...</p>
                                                    </div>
                                                ) : previewMessages.length === 0 ? (
                                                    <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                                                        Memory empty
                                                    </div>
                                                ) : (
                                                    <div className="max-w-3xl mx-auto space-y-8 pb-10">
                                                        <h2 className="text-2xl font-semibold mb-8 border-b pb-4 px-2 tracking-tight">{previewChat?.title}</h2>
                                                        {previewMessages.map((msg, i) => (
                                                            <div key={msg.id || i} className={cn("pointer-events-none opacity-95", msg.role === 'user' ? "flex justify-end" : "flex justify-start px-2")}>
                                                                {/* Read-only renderer */}
                                                                <div className={cn(
                                                                    "py-2 leading-relaxed max-w-[90%] break-words w-full",
                                                                    msg.role === 'user' ? "bg-primary text-primary-foreground px-5 py-3 rounded-xl max-w-[80%]" : ""
                                                                )}>
                                                                    {msg.role === 'assistant' || msg.role === 'system' ? (
                                                                        <div className="prose prose-base dark:prose-invert max-w-none">
                                                                            <ChatMessage
                                                                                message={{ ...msg, isThinking: false, reasoningDuration: undefined, reasoning: undefined, suggestions: undefined, feedback: undefined }}
                                                                                isLast={false}
                                                                                onCopy={() => { }}
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
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-[70vh] text-muted-foreground/40 gap-4">
                                            <IconMessageCircleOff className="w-12 h-12 opacity-20" />
                                            <p className="text-base font-medium">Hover or select a conversation to preview</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sticky Footer attached to the whole Dialog container */}
                        <div className={cn(
                            "border-t border-border/50 flex items-center justify-between shrink-0 transition-colors duration-300 w-full",
                            isExpanded ? "p-3 bg-sidebar/50" : "p-2 bg-muted/40"
                        )}>
                            {/* Left Side: Expand Toggle */}
                            <ActionTooltip tooltip={isExpanded ? "Collapse Preview" : "Expand Preview"}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground h-8 px-2 rounded-lg"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                >
                                    {isExpanded ? <IconArrowsDiagonalMinimize2 className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
                                </Button>
                            </ActionTooltip>

                            {/* Right Side: Keyboard hints / Clickable Actions */}
                            <div className="flex items-center gap-1 sm:gap-2 mr-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-lg flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal px-2"
                                    onClick={() => handleGo()}
                                    disabled={!footerChat}
                                >
                                    <span className="text-xs">Open</span>
                                    <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded-[4px] border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                        Enter
                                    </kbd>
                                </Button>

                                <div className="w-px h-3.5 bg-border/80 mx-0.5 hidden sm:block" />

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-lg flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal px-2"
                                    onClick={() => footerChat && handleOpenEdit(footerChat)}
                                    disabled={!footerChat}
                                >
                                    <span className="text-xs">Edit</span>
                                    <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded-[4px] border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                        <span className="text-[10px]">Ctrl</span>E
                                    </kbd>
                                </Button>

                                <div className="w-px h-3.5 bg-border/80 mx-0.5 hidden sm:block" />

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-lg flex items-center gap-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10 font-normal px-2"
                                    onClick={() => footerChat && handleOpenDelete(footerChat)}
                                    disabled={!footerChat}
                                >
                                    <span className="text-xs">Delete</span>
                                    <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded-[4px] border border-destructive/20 bg-destructive/10 px-1.5 font-mono text-[10px] font-medium text-destructive">
                                        <span className="text-[10px]">Ctrl</span>D
                                    </kbd>
                                </Button>
                            </div>
                        </div>
                    </Command>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={!!editingChat} onOpenChange={(v) => !v && setEditingChat(null)}>
                <DialogContent className="sm:max-w-[400px] z-[100]">
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
                                e.stopPropagation()
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingChat(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameSave} disabled={renameTitle.trim().length === 0}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!deletingChat} onOpenChange={(v) => !v && setDeletingChat(null)}>
                <DialogContent className="z-[100]">
                    <DialogHeader>
                        <DialogTitle>Delete Chat?</DialogTitle>
                    </DialogHeader>
                    <div className="py-2 text-sm text-muted-foreground">
                        Are you sure you want to delete this chat? This action cannot be undone.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingChat(null)}>
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

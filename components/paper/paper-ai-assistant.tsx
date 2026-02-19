"use client"

import React, { useState, useRef, useEffect } from "react"
import {
    IconSparkles,
    IconMinus,
    IconLayoutSidebarRightFilled,
    IconFreezeRowColumn,
    IconEdit,
    IconRobot,
    IconAlignLeft,
    IconLanguage,
    IconSearch,
    IconListCheck,
    IconArrowUp,
    IconPlus,
    IconAdjustmentsHorizontal,
    IconFiles,
    IconChevronDown
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import TextareaAutosize from "react-textarea-autosize"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export type AIAssistantMode = 'floating' | 'sidebar'

interface PaperAIAssistantProps {
    isOpen: boolean
    onClose: () => void // Acts as onMinimize
    mode: AIAssistantMode
    onModeChange: (mode: AIAssistantMode) => void
    paperTitle?: string
}

export function PaperAIAssistant({
    isOpen,
    onClose,
    mode,
    onModeChange,
    paperTitle = "Current Page"
}: PaperAIAssistantProps) {
    const [input, setInput] = useState("")
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    if (!isOpen) return null

    const isFloating = mode === 'floating'
    const tooltipSide = isFloating ? "top" : "bottom"

    return (
        <div
            className={cn(
                "flex flex-col bg-background text-foreground border-l border-border shadow-2xl z-50 transition-all duration-300 ease-in-out font-sans",
                isFloating
                    ? "fixed bottom-20 right-6 w-[380px] h-[600px] rounded-xl border border-border"
                    : "relative w-[380px] h-full border-l border-border rounded-none shadow-none"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors group">
                            <span className="text-sm font-medium text-foreground">New AI chat</span>
                            <IconChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => { /* TODO: History logic */ }}>
                            View history
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setInput(""); /* TODO: Reset logic */ }}>
                            Start new chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-1">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    onClick={() => {
                                        setInput("")
                                        // Add clear chat logic here
                                    }}
                                >
                                    <IconEdit className="w-4 h-4" />
                                    <span className="sr-only">New Chat</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side={tooltipSide}>New Chat</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        >
                                            {isFloating ? <IconFreezeRowColumn className="w-4 h-4" /> : <IconLayoutSidebarRightFilled className="w-4 h-4" />}
                                            <span className="sr-only">Switch View</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side={tooltipSide}>Switch View</TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end">
                                <DropdownMenuCheckboxItem
                                    checked={mode === 'sidebar'}
                                    onCheckedChange={(checked) => onModeChange(checked ? 'sidebar' : 'floating')}
                                >
                                    <IconLayoutSidebarRightFilled className="w-4 h-4 mr-2" />
                                    Sidebar
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={mode === 'floating'}
                                    onCheckedChange={(checked) => onModeChange(checked ? 'floating' : 'sidebar')}
                                >
                                    <IconFreezeRowColumn className="w-4 h-4 mr-2" />
                                    Floating
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    onClick={onClose}
                                >
                                    <IconMinus className="w-4 h-4" />
                                    <span className="sr-only">Minimize</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side={tooltipSide}>Minimize</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-8">
                {/* Hero Icon */}
                <div className="relative">
                    <div className="bg-background rounded-full p-4 shadow-sm border border-border inline-flex items-center justify-center">
                        <IconRobot className="w-10 h-10 text-foreground stroke-1.5" />
                    </div>
                </div>

                {/* Greeting */}
                <h2 className="text-xl font-semibold text-foreground">
                    Spice it up — what do you need?
                </h2>

                {/* Quick Actions */}
                <div className="w-full max-w-sm space-y-1">
                    <ActionButton icon={<IconAlignLeft className="w-4 h-4" />} label="Summarize this page" />
                    <ActionButton icon={<IconLanguage className="w-4 h-4" />} label="Translate this page" />
                    <ActionButton icon={<IconSearch className="w-4 h-4" />} label="Analyze for insights" />
                    <ActionButton icon={<IconListCheck className="w-4 h-4" />} label="Create a task tracker" />
                </div>
            </div>

            {/* Input Footer */}
            <div className="p-4 bg-muted/40 rounded-b-xl border-t border-border mt-auto shrink-0">
                <div className="relative bg-background border border-input rounded-lg shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-all">
                    {/* Context Pill */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-full max-w-[180px]">
                        <IconFiles className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium truncate">{paperTitle}</span>
                    </div>

                    <TextareaAutosize
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Do anything with AI..."
                        minRows={1}
                        maxRows={8}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground px-3 pb-3 pt-12 resize-none outline-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                // Handle send
                            }
                        }}
                    />

                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-2 pb-2">
                        <div className="flex items-center gap-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted">
                                            <IconPlus className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Add context</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted">
                                            <IconAdjustmentsHorizontal className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Adjust settings</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-medium">Auto</span>
                            <Button
                                size="icon"
                                className={cn(
                                    "h-6 w-6 rounded-full transition-all duration-200",
                                    input.trim() ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                                disabled={!input.trim()}
                            >
                                <IconArrowUp className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-md transition-colors group text-left">
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{icon}</span>
            <span className="group-hover:text-foreground transition-colors">{label}</span>
        </button>
    )
}

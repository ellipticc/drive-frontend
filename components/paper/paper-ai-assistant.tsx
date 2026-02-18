"use client"

import React, { useState, useRef, useEffect } from "react"
import {
    IconSparkles,
    IconX,
    IconMaximize,
    IconLayoutSidebarRight,
    IconPencil,
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

interface PaperAIAssistantProps {
    isOpen: boolean
    onClose: () => void
    paperTitle?: string
}

export function PaperAIAssistant({ isOpen, onClose, paperTitle = "Current Page" }: PaperAIAssistantProps) {
    const [input, setInput] = useState("")
    const [isExpanded, setIsExpanded] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div
            className={cn(
                "fixed bottom-20 right-6 flex flex-col bg-[#1F1F1F] text-foreground border border-[#303030] shadow-2xl z-50 transition-all duration-300 ease-in-out font-sans",
                isExpanded ? "w-[600px] h-[80vh] rounded-xl" : "w-[440px] h-[600px] rounded-xl"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#303030]">
                <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors group">
                    <span className="text-sm font-medium text-gray-200">New AI chat</span>
                    <IconChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-200" />
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-100 hover:bg-[#303030]">
                        <IconPencil className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-gray-100 hover:bg-[#303030]"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <IconLayoutSidebarRight className="w-4 h-4" /> : <IconMaximize className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-gray-100 hover:bg-[#303030]"
                        onClick={onClose}
                    >
                        <IconX className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-8">
                {/* Hero Icon */}
                <div className="relative">
                    <div className="bg-white rounded-full p-4 shadow-lg inline-flex items-center justify-center">
                        <IconRobot className="w-10 h-10 text-black stroke-1.5" />
                    </div>
                </div>

                {/* Greeting */}
                <h2 className="text-xl font-semibold text-gray-100">
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
            <div className="p-4 bg-[#252525] rounded-b-xl border-t border-[#303030]">
                <div className="relative bg-[#1a1a1a] border border-[#333] rounded-lg shadow-inner overflow-hidden focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                    {/* Context Pill */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 bg-[#333] rounded-full max-w-[180px]">
                        <IconFiles className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-300 font-medium truncate">{paperTitle}</span>
                    </div>

                    <TextareaAutosize
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Do anything with AI..."
                        minRows={1}
                        maxRows={8}
                        className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-500 px-3 pb-3 pt-12 resize-none outline-none"
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
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-[#333]">
                                <IconPlus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-[#333]">
                                <IconAdjustmentsHorizontal className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 font-medium">Auto</span>
                            <Button
                                size="icon"
                                className={cn(
                                    "h-6 w-6 rounded-full transition-all duration-200",
                                    input.trim() ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-[#333] text-gray-500 cursor-not-allowed"
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
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-[#303030] rounded-md transition-colors group text-left">
            <span className="text-gray-400 group-hover:text-gray-200 transition-colors">{icon}</span>
            <span className="group-hover:text-white transition-colors">{label}</span>
        </button>
    )
}

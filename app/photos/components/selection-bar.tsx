"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { IconDownload, IconTrash, IconX, IconFolderSymlink } from "@tabler/icons-react"
import { AnimatePresence, motion } from "motion/react"

interface SelectionBarProps {
    selectedCount: number
    onClear: () => void
    onDownload: () => void
    onDelete: () => void
    onMove?: () => void
}

export function SelectionBar({ selectedCount, onClear, onDownload, onDelete, onMove }: SelectionBarProps) {
    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-full shadow-xl shadow-black/20"
                >
                    <div className="flex items-center gap-3 pl-2 pr-1 border-r border-background/20">
                        <span className="text-sm font-medium whitespace-nowrap">
                            {selectedCount} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-background/20 text-background/80 hover:text-background"
                            onClick={onClear}
                        >
                            <IconX className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 rounded-full hover:bg-background/20 text-background hover:text-background font-medium text-xs"
                            onClick={onDownload}
                        >
                            <IconDownload className="h-3.5 w-3.5 mr-1.5" />
                            Download
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 rounded-full hover:bg-background/20 text-background hover:text-background font-medium text-xs"
                            onClick={onMove}
                            disabled={!onMove}
                        >
                            <IconFolderSymlink className="h-3.5 w-3.5 mr-1.5" />
                            Move
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 font-medium text-xs"
                            onClick={onDelete}
                        >
                            <IconTrash className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

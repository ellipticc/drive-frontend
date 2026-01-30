"use client"

import React, { useMemo } from 'react'
import * as Diff from 'diff'
import { extractPaperText } from '@/lib/paper-service'
import { cn } from '@/lib/utils'

interface DiffBlockViewerProps {
    oldContent: any[]
    newContent: any[]
}

export function DiffBlockViewer({ oldContent, newContent }: DiffBlockViewerProps) {
    const changes = useMemo(() => {
        const oldText = extractPaperText(oldContent || [])
        const newText = extractPaperText(newContent || [])
        return Diff.diffChars(oldText, newText)
    }, [oldContent, newContent])

    if (changes.length === 0 || (changes.length === 1 && !changes[0].added && !changes[0].removed)) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No changes detected</p>
            </div>
        )
    }

    return (
        <div className="w-full bg-background rounded-lg border p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
            {changes.map((part, index) => {
                if (part.added) {
                    return (
                        <span key={index} className="bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 rounded px-0.5 mx-0.5">
                            {part.value}
                        </span>
                    )
                }
                if (part.removed) {
                    return (
                        <span key={index} className="bg-red-500/20 text-red-900 dark:text-red-300 line-through decoration-red-900/50 dark:decoration-red-300/50 rounded px-0.5 mx-0.5 select-none opacity-70">
                            {part.value}
                        </span>
                    )
                }
                return <span key={index} className="text-foreground">{part.value}</span>
            })}
        </div>
    )
}

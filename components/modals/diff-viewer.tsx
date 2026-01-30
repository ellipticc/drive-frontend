"use client"

import React, { useMemo } from 'react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'
import { IconAlertCircle } from '@tabler/icons-react'

interface DiffViewerProps {
    oldContent: any[] // Plate editor blocks
    newContent: any[] // Plate editor blocks
    mode?: 'unified' | 'split'
}

// Extract plain text from Plate editor blocks
function extractText(blocks: any[]): string {
    if (!Array.isArray(blocks)) return ''
    
    const extract = (nodes: any[]): string => {
        return nodes.map(node => {
            if (typeof node === 'string') return node
            if (node.text !== undefined) return node.text
            if (node.children && Array.isArray(node.children)) {
                return extract(node.children)
            }
            return ''
        }).join('')
    }
    
    return extract(blocks)
}

export function DiffViewer({ oldContent, newContent, mode = 'unified' }: DiffViewerProps) {
    const diff = useMemo(() => {
        const oldText = extractText(oldContent)
        const newText = extractText(newContent)
        
        if (!oldText && !newText) {
            return { changes: [], isEmpty: true }
        }
        
        // Use word-level diff for better readability
        const changes = Diff.diffWords(oldText, newText)
        return { changes, isEmpty: false }
    }, [oldContent, newContent])

    if (diff.isEmpty) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="flex items-center gap-2">
                    <IconAlertCircle className="w-5 h-5" />
                    <p className="text-sm">No content to compare</p>
                </div>
            </div>
        )
    }

    if (mode === 'unified') {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-t-lg border-b text-xs text-muted-foreground font-medium">
                    <span>Showing changes</span>
                    <span className="ml-auto flex items-center gap-2">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/50"></span>
                            <span>Added</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/50"></span>
                            <span>Removed</span>
                        </span>
                    </span>
                </div>
                <div className="p-4 bg-background rounded-b-lg border font-mono text-sm overflow-auto max-h-[60vh]">
                    <pre className="whitespace-pre-wrap break-words leading-relaxed">
                        {diff.changes.map((part, index) => {
                            if (part.added) {
                                return (
                                    <span
                                        key={index}
                                        className="bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-0.5 rounded"
                                        title={`Added: ${part.value.length} characters`}
                                    >
                                        {part.value}
                                    </span>
                                )
                            }
                            if (part.removed) {
                                return (
                                    <span
                                        key={index}
                                        className="bg-red-500/15 dark:bg-red-500/20 text-red-700 dark:text-red-300 line-through px-0.5 rounded"
                                        title={`Removed: ${part.value.length} characters`}
                                    >
                                        {part.value}
                                    </span>
                                )
                            }
                            return <span key={index} className="text-foreground/80">{part.value}</span>
                        })}
                    </pre>
                </div>
            </div>
        )
    }

    // Split mode - side by side
    const oldParts: Array<{ value: string; type: 'normal' | 'removed' }> = []
    const newParts: Array<{ value: string; type: 'normal' | 'added' }> = []

    diff.changes.forEach(part => {
        if (part.removed) {
            oldParts.push({ value: part.value, type: 'removed' })
        } else if (part.added) {
            newParts.push({ value: part.value, type: 'added' })
        } else {
            oldParts.push({ value: part.value, type: 'normal' })
            newParts.push({ value: part.value, type: 'normal' })
        }
    })

    return (
        <div className="grid grid-cols-2 gap-2">
            {/* Old version */}
            <div className="space-y-2">
                <div className="px-4 py-2 bg-red-500/10 rounded-t-lg border-b border-red-500/30 text-xs text-red-700 dark:text-red-400 font-medium">
                    Previous Version
                </div>
                <div className="p-4 bg-background rounded-b-lg border font-mono text-sm overflow-auto max-h-[60vh]">
                    <pre className="whitespace-pre-wrap break-words leading-relaxed">
                        {oldParts.map((part, index) => (
                            <span
                                key={index}
                                className={cn(
                                    part.type === 'removed' && 'bg-red-500/15 dark:bg-red-500/20 text-red-700 dark:text-red-300 line-through',
                                    part.type === 'normal' && 'text-foreground/80'
                                )}
                            >
                                {part.value}
                            </span>
                        ))}
                    </pre>
                </div>
            </div>

            {/* New version */}
            <div className="space-y-2">
                <div className="px-4 py-2 bg-emerald-500/10 rounded-t-lg border-b border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    Selected Version
                </div>
                <div className="p-4 bg-background rounded-b-lg border font-mono text-sm overflow-auto max-h-[60vh]">
                    <pre className="whitespace-pre-wrap break-words leading-relaxed">
                        {newParts.map((part, index) => (
                            <span
                                key={index}
                                className={cn(
                                    part.type === 'added' && 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                                    part.type === 'normal' && 'text-foreground/80'
                                )}
                            >
                                {part.value}
                            </span>
                        ))}
                    </pre>
                </div>
            </div>
        </div>
    )
}

"use client"

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { IconAlertCircle } from '@tabler/icons-react'
import { PaperPreview } from '@/components/previews/paper-preview'

interface DiffBlockViewerProps {
    oldContent: any[] // Plate editor blocks
    newContent: any[] // Plate editor blocks
}

/**
 * Compare blocks and identify which ones changed
 * Returns blocks with metadata about changes
 */
function identifyChangedBlocks(oldBlocks: any[], newBlocks: any[]) {
    const changes = {
        added: [] as any[],
        removed: [] as any[],
        modified: [] as any[],
        unchanged: [] as any[]
    }

    // Simple block-level comparison based on content
    const oldBlockTexts = oldBlocks.map((b, i) => ({
        text: JSON.stringify(b),
        index: i,
        block: b
    }))

    const newBlockTexts = newBlocks.map((b, i) => ({
        text: JSON.stringify(b),
        index: i,
        block: b
    }))

    const processedNew = new Set<number>()

    // Find unchanged and modified
    for (const newBlock of newBlockTexts) {
        const matchedOld = oldBlockTexts.find(
            (oldBlock) => oldBlock.text === newBlock.text && !processedNew.has(newBlock.index)
        )

        if (matchedOld) {
            changes.unchanged.push(newBlock.block)
            processedNew.add(newBlock.index)
        } else {
            changes.added.push(newBlock.block)
            processedNew.add(newBlock.index)
        }
    }

    // Find removed
    for (const oldBlock of oldBlockTexts) {
        const exists = oldBlocks.some((b) => JSON.stringify(b) === oldBlock.text)
        const matchedNew = newBlockTexts.find((n) => n.text === oldBlock.text)
        if (!matchedNew) {
            changes.removed.push(oldBlock.block)
        }
    }

    return changes
}

export function DiffBlockViewer({ oldContent, newContent }: DiffBlockViewerProps) {
    const changes = useMemo(() => {
        if (!Array.isArray(oldContent) || !Array.isArray(newContent)) {
            return { added: [], removed: [], modified: [], unchanged: [] }
        }
        return identifyChangedBlocks(oldContent, newContent)
    }, [oldContent, newContent])

    const hasChanges = changes.added.length > 0 || changes.removed.length > 0

    if (!hasChanges) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="flex items-center gap-2">
                    <IconAlertCircle className="w-5 h-5" />
                    <p className="text-sm">No differences between versions</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 w-full">
            {/* Removed blocks */}
            {changes.removed.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-red-700 dark:text-red-400 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-t">
                        REMOVED ({changes.removed.length} {changes.removed.length === 1 ? 'block' : 'blocks'})
                    </div>
                    <div className="border border-red-500/20 rounded-b bg-red-500/5 overflow-hidden">
                        <PaperPreview
                            fileId="diff-removed"
                            initialContent={changes.removed}
                            filename="removed"
                        />
                    </div>
                </div>
            )}

            {/* Added blocks */}
            {changes.added.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-t">
                        ADDED ({changes.added.length} {changes.added.length === 1 ? 'block' : 'blocks'})
                    </div>
                    <div className="border border-emerald-500/20 rounded-b bg-emerald-500/5 overflow-hidden">
                        <PaperPreview
                            fileId="diff-added"
                            initialContent={changes.added}
                            filename="added"
                        />
                    </div>
                </div>
            )}

            {/* Summary */}
            {hasChanges && (
                <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded border">
                    <span className="font-medium">Summary:</span>{' '}
                    {changes.removed.length > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                            {changes.removed.length} removed
                        </span>
                    )}
                    {changes.removed.length > 0 && changes.added.length > 0 && ' • '}
                    {changes.added.length > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                            {changes.added.length} added
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

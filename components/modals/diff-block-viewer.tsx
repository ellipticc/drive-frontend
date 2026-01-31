"use client"

import { useMemo } from 'react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'

export interface DiffBlockViewerProps {
    oldContent: any[]
    newContent: any[]
}

// Helper to extract text from a block recursively
function getBlockText(block: any): string {
    if (!block) return ''
    if (typeof block.text === 'string') return block.text
    if (Array.isArray(block.children)) {
        return block.children.map(getBlockText).join('')
    }
    return ''
}

// Simple text-based diff renderer
function renderTextDiff(oldText: string, newText: string) {
    const diff = Diff.diffWords(oldText, newText)
    return diff.map((part, index) => {
        if (part.added) {
            return (
                <span key={index} className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 px-1 rounded">
                    {part.value}
                </span>
            )
        }
        if (part.removed) {
            return (
                <span key={index} className="bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200 px-1 rounded line-through">
                    {part.value}
                </span>
            )
        }
        return <span key={index}>{part.value}</span>
    })
}

export function DiffBlockViewer({ oldContent, newContent }: DiffBlockViewerProps) {
    const diffContent = useMemo(() => {
        const safeOld = Array.isArray(oldContent) ? oldContent : []
        const safeNew = Array.isArray(newContent) ? newContent : []

        // Extract text content from blocks
        const oldText = safeOld.map(getBlockText).join('\n\n')
        const newText = safeNew.map(getBlockText).join('\n\n')

        return { oldText, newText }
    }, [oldContent, newContent])

    return (
        <div className="w-full max-w-4xl mx-auto bg-background border rounded-lg p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Content Changes</h3>
                <div className="text-sm text-muted-foreground">
                    {renderTextDiff(diffContent.oldText, diffContent.newText)}
                </div>
            </div>
        </div>
    )
}

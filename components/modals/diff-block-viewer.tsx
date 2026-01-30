"use client"

import React, { useMemo } from 'react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'

interface DiffBlockViewerProps {
    oldContent: any[]
    newContent: any[]
}

// Helper to extract text from a block for internal diffing
function getBlockText(block: any): string {
    if (!block) return ''
    if (typeof block.text === 'string') return block.text
    if (Array.isArray(block.children)) {
        return block.children.map(getBlockText).join('')
    }
    return ''
}

// Block Renderer Component
function BlockRenderer({ block, diffStatus, changes }: { block: any, diffStatus: 'added' | 'removed' | 'modified' | 'unchanged', changes?: Diff.Change[] }) {
    // Determine the HTML tag to use
    let Tag: React.ElementType = 'p';

    switch (block.type) {
        case 'h1': Tag = 'h1'; break;
        case 'h2': Tag = 'h2'; break;
        case 'h3': Tag = 'h3'; break;
        case 'blockquote': Tag = 'blockquote'; break;
        case 'ul': Tag = 'ul'; break;
        case 'ol': Tag = 'ol'; break;
        case 'li': Tag = 'li'; break;
        default: Tag = 'p';
    }

    const baseStyles = cn(
        "mb-2 break-words whitespace-pre-wrap leading-relaxed",
        block.type === 'h1' && "text-3xl font-bold mb-4 mt-2",
        block.type === 'h2' && "text-2xl font-bold mb-3 mt-2",
        block.type === 'h3' && "text-xl font-bold mb-3 mt-1",
        block.type === 'blockquote' && "border-l-4 border-gray-300 pl-4 italic text-muted-foreground",
        block.type === 'ul' && "list-disc pl-6",
        block.type === 'ol' && "list-decimal pl-6",
        block.type === 'li' && "mb-1"
    )

    const wrapperStyles = cn(
        "rounded-md px-2 -mx-2 py-1 transition-colors",
        diffStatus === 'added' && "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
        diffStatus === 'removed' && "bg-red-500/20 text-red-900 dark:text-red-100 decoration-red-900/50 dark:decoration-red-100/50"
    )

    // Helper to render text with diff highlights
    const renderTextContent = () => {
        if (changes) {
            return changes.map((part, index) => {
                const style = cn(
                    part.added && "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 rounded px-0.5",
                    part.removed && "bg-red-500/20 text-red-900 dark:text-red-100 line-through decoration-red-900/50 dark:decoration-red-100/50 rounded px-0.5 opacity-80"
                )
                return <span key={index} className={style}>{part.value}</span>
            })
        }
        // Fallback for Added/Removed blocks which don't have char-diffs, just show full text
        const text = getBlockText(block)
        return <span className={diffStatus === 'removed' ? 'line-through opacity-80' : ''}>{text}</span>
    }

    // Handle Lists specifically (render children as LIs if possible, otherwise just text)
    if (block.type === 'ul' || block.type === 'ol') {
        const ListTag = Tag; // Explicitly reuse Tag which is ul/ol
        return (
            <div className={wrapperStyles}>
                <ListTag className={baseStyles}>
                    {block.children?.map((child: any, i: number) => (
                        <li key={i}>{getBlockText(child)}</li>
                    ))}
                </ListTag>
            </div>
        )
    }

    return (
        <div className={wrapperStyles}>
            <Tag className={baseStyles}>
                {renderTextContent()}
            </Tag>
        </div>
    )
}

export function DiffBlockViewer({ oldContent, newContent }: DiffBlockViewerProps) {
    // 1. Block-Level Diffing (by ID)
    const blockDiffs = useMemo(() => {
        // Ensure arrays
        const oldBlocks = Array.isArray(oldContent) ? oldContent : []
        const newBlocks = Array.isArray(newContent) ? newContent : []

        // Use diffArrays with ID comparator
        // Note: paper blocks usually have an 'id' field.
        return Diff.diffArrays(oldBlocks, newBlocks, {
            comparator: (a, b) => {
                if (!a.id && !b.id) return JSON.stringify(a) === JSON.stringify(b); // Fallback if no IDs
                return a.id === b.id
            }
        })
    }, [oldContent, newContent])

    if (!blockDiffs || blockDiffs.length === 0) {
        return <div className="text-center text-muted-foreground p-8">No changes detected</div>
    }

    return (
        <div className="w-full bg-background rounded-lg border p-8 font-serif text-foreground min-h-[500px]">
            {blockDiffs.map((diffChunk, chunkIndex) => {
                // diffChunk.value = Array of blocks

                if (diffChunk.added) {
                    // Entire chunk added (Green)
                    return diffChunk.value.map((block, i) => (
                        <BlockRenderer key={`added-${chunkIndex}-${i}`} block={block} diffStatus="added" />
                    ))
                }

                if (diffChunk.removed) {
                    // Entire chunk removed (Red)
                    return diffChunk.value.map((block, i) => (
                        <BlockRenderer key={`removed-${chunkIndex}-${i}`} block={block} diffStatus="removed" />
                    ))
                }

                // Unchanged Chunk (ID match) - Check for text modifications
                return diffChunk.value.map((newBlock, i) => {
                    // Find original block to compare text
                    const oldBlock = Array.isArray(oldContent) ? oldContent.find(b => b.id === newBlock.id) : null

                    if (!oldBlock) {
                        return <BlockRenderer key={`err-${chunkIndex}-${i}`} block={newBlock} diffStatus="added" />
                    }

                    const oldText = getBlockText(oldBlock)
                    const newText = getBlockText(newBlock)

                    if (oldText !== newText) {
                        // Text Modified: Calculate char diff
                        const charChanges = Diff.diffChars(oldText, newText)
                        return <BlockRenderer key={`mod-${chunkIndex}-${i}`} block={newBlock} diffStatus="modified" changes={charChanges} />
                    }

                    // Identical
                    return <BlockRenderer key={`id-${chunkIndex}-${i}`} block={newBlock} diffStatus="unchanged" />
                })
            })}
        </div>
    )
}

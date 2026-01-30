"use client"

import React, { useMemo } from 'react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'
import { Plate, PlateContent, usePlateEditor } from 'platejs/react'
import { EditorKit } from '@/components/editor-kit'

interface DiffBlockViewerProps {
    oldContent: any[]
    newContent: any[]
}

// Helper to extract text from a block (recursive)
function getBlockText(block: any): string {
    if (!block) return ''
    if (typeof block.text === 'string') return block.text
    if (Array.isArray(block.children)) {
        return block.children.map(getBlockText).join('')
    }
    return ''
}

// 1. Logic to Merge Content for Diff View
function generateDiffContent(oldBlocks: any[], newBlocks: any[]) {
    // Diff at block level (by ID)
    const blockDiffs = Diff.diffArrays(oldBlocks, newBlocks, {
        comparator: (a, b) => {
            // Fallback ID if missing 
            const idA = a.id || JSON.stringify(a)
            const idB = b.id || JSON.stringify(b)
            return idA === idB
        }
    })

    const mergedContent: any[] = []

    blockDiffs.forEach((chunk) => {
        if (chunk.added) {
            // Added blocks: Mark each block in the chunk as added
            chunk.value.forEach(block => {
                mergedContent.push({
                    ...block,
                    diffType: 'added',
                })
            })
        } else if (chunk.removed) {
            // Removed blocks: Mark each block in the chunk as removed
            chunk.value.forEach(block => {
                mergedContent.push({
                    ...block,
                    diffType: 'removed'
                })
            })
        } else {
            // Unchanged chunks (ID matched). Check for text modifications.
            chunk.value.forEach(newBlock => {
                const oldBlock = oldBlocks.find(b => b.id === newBlock.id)
                // If deep equal, just push
                if (JSON.stringify(oldBlock) === JSON.stringify(newBlock)) {
                    mergedContent.push(newBlock)
                    return;
                }

                // If text changed, perform inline diff only if it's a simple text block (p, h1, etc)
                const oldText = getBlockText(oldBlock)
                const newText = getBlockText(newBlock)

                if (oldText !== newText) {
                    // It's a modification. We need to construct new children with inline diffs.
                    // We calculate diffChars on the plain text content.
                    const charDiffs = Diff.diffChars(oldText, newText)

                    // Convert diff chunks into Plate Text Nodes (Leafs)
                    const newChildren = charDiffs.map(part => {
                        return {
                            text: part.value,
                            diffType: part.added ? 'added' : part.removed ? 'removed' : undefined,
                            strikethrough: part.removed, // Use standard marks if supported, but our renderer handles it
                        }
                    })

                    mergedContent.push({
                        ...newBlock,
                        children: newChildren
                    })
                } else {
                    // Content matches text-wise (maybe props changed?), just push new
                    mergedContent.push(newBlock)
                }
            })
        }
    })

    return mergedContent
}

// 2. Custom Plugin to Render Diff Styles
const DiffPlugin = {
    key: 'diff',
    inject: {
        props: {
            className: ({ element }: { element: any }) => {
                if (element.diffType === 'added') return 'bg-emerald-500/20 dark:bg-emerald-500/10 block-diff-added';
                if (element.diffType === 'removed') return 'bg-red-500/20 dark:bg-red-500/10 block-diff-removed select-none opacity-70';
                return '';
            },
        },
    },
};


export function DiffBlockViewer({ oldContent, newContent }: DiffBlockViewerProps) {

    // Memoize the merged content so we don't re-calculate on every render
    const diffContent = useMemo(() => {
        const safeOld = Array.isArray(oldContent) ? oldContent : []
        const safeNew = Array.isArray(newContent) ? newContent : []

        // Fix SlateJS crash NotFoundError by deep cloning the content
        const clonedOld = JSON.parse(JSON.stringify(safeOld))
        const clonedNew = JSON.parse(JSON.stringify(safeNew))

        return generateDiffContent(clonedOld, clonedNew)
    }, [oldContent, newContent])

    // Force unique editor instance when content changes
    // We use a simple timestamp + random number as key to force remount
    const editorId = useMemo(() => `diff-editor-${Date.now()}-${Math.random()}`, [diffContent])

    // Setup Plate Editor
    const editor = usePlateEditor({
        id: editorId,
        plugins: [
            ...EditorKit,
            DiffPlugin as any
        ],
        value: diffContent
    })

    // Custom renderLeaf to handle inline diffs (added/removed text)
    const renderLeaf = (props: any) => {
        const { attributes, children, leaf } = props;

        if (leaf.diffType === 'added') {
            return (
                <span {...attributes} className={cn("bg-emerald-200 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-sm px-0.5", leaf.className)}>
                    {children}
                </span>
            );
        }
        if (leaf.diffType === 'removed') {
            return (
                <span {...attributes} className={cn("bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through decoration-red-500 rounded-sm px-0.5 opacity-80", leaf.className)}>
                    {children}
                </span>
            );
        }

        return (
            <span {...attributes} className={cn(leaf.className)}>
                {children}
            </span>
        )
    }

    return (
        <div className="w-full bg-background rounded-lg border min-h-[500px]">
            <Plate editor={editor} key={editorId}>
                <div className="p-8 md:p-12 max-w-[850px] mx-auto min-h-full">
                    <PlateContent
                        readOnly
                        renderLeaf={renderLeaf}
                        className="outline-none min-h-full"
                    />
                </div>
            </Plate>
        </div>
    )
}

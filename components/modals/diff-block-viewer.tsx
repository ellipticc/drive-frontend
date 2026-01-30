"use client"

import { useMemo } from 'react'
import { Plate, usePlateEditor, PlateController } from 'platejs/react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'
import { Editor } from '@/components/ui/editor'
import { EditorKit } from '@/components/editor-kit'

export interface DiffBlockViewerProps {
    oldContent: any[]
    newContent: any[]
}

const INLINE_DIFFABLE_TYPES = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code_line']

function isInlineDiffable(type?: string) {
    // Default to 'p' if type is missing, which is diffable
    if (!type) return true;
    return INLINE_DIFFABLE_TYPES.includes(type);
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
        // Safety check
        if (!chunk.value) return;

        if (chunk.added) {
            // Added blocks: Mark each block in the chunk as added
            chunk.value.forEach(block => {
                if (!block) return;
                mergedContent.push({
                    ...block,
                    diffType: 'added',
                })
            })
        } else if (chunk.removed) {
            // Removed blocks: Mark each block in the chunk as removed
            chunk.value.forEach(block => {
                if (!block) return;
                mergedContent.push({
                    ...block,
                    diffType: 'removed'
                })
            })
        } else {
            // Unchanged chunks (ID matched). Check for text modifications.
            chunk.value.forEach(newBlock => {
                if (!newBlock) return;

                const oldBlock = oldBlocks.find(b => b.id === newBlock.id)

                // If deep equal, just push (optimization)
                if (oldBlock && JSON.stringify(oldBlock) === JSON.stringify(newBlock)) {
                    mergedContent.push(newBlock)
                    return;
                }

                // Inline Diff Check: Only run on safe text blocks
                const canInlineDiff = isInlineDiffable(newBlock.type);
                const oldText = getBlockText(oldBlock)
                const newText = getBlockText(newBlock)

                if (canInlineDiff && oldText !== newText) {
                    // It's a valid modification. Construct new children with inline diffs.
                    const charDiffs = Diff.diffChars(oldText, newText)

                    // Convert diff chunks into Plate Text Nodes (Leafs)
                    const newChildren = charDiffs.map(part => {
                        return {
                            text: part.value,
                            diffType: part.added ? 'added' : part.removed ? 'removed' : undefined,
                            // Note: we don't set 'strikethrough' mark to avoid confusing plugins; we handle style in renderLeaf
                        }
                    })

                    mergedContent.push({
                        ...newBlock,
                        children: newChildren
                    })
                } else {
                    mergedContent.push(newBlock)
                }
            })
        }
    })

    // ID REGENERATION
    return mergedContent.map((block, index) => {
        if (!block || typeof block !== 'object') return { type: 'p', children: [{ text: '' }], id: `diff-safe-${index}` };

        return {
            ...block,
            id: `diff-${Date.now()}-${index}`,
            // Ensure children exist to prevent invalid node errors
            children: Array.isArray(block.children) ? block.children : [{ text: '' }]
        }
    })
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

        // DEEP CLONE to prevent mutating the original objects in history
        const clonedOld = JSON.parse(JSON.stringify(safeOld))
        const clonedNew = JSON.parse(JSON.stringify(safeNew))

        return generateDiffContent(clonedOld, clonedNew)
    }, [oldContent, newContent])

    // Force unique editor instance when content changes
    const editorId = useMemo(() => `diff-editor-${Date.now()}-${Math.random()}`, [diffContent])

    // Setup Plate Editor with EditorKit (like preview component)
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
        <PlateController>
            <Plate editor={editor} key={editorId}>
                <div className="w-full flex justify-center bg-background min-h-full">
                    <div className="w-full max-w-[850px] px-8 md:px-16 py-12">
                        <Editor
                            readOnly
                            renderLeaf={renderLeaf}
                            className="border-none shadow-none focus-visible:ring-0"
                        />
                    </div>
                </div>
            </Plate>
        </PlateController>
    )
}

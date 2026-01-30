"use client"

import React, { useMemo } from 'react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'
import { Plate, PlateContent, usePlateEditor } from 'platejs/react'

// Import individual kits to construct a READ-ONLY plugin set
import { BasicBlocksKit } from '@/components/basic-blocks-kit';
import { BasicMarksKit } from '@/components/basic-marks-kit';
import { CodeBlockKit } from '@/components/code-block-kit';
import { TableKit } from '@/components/table-kit';
import { ToggleKit } from '@/components/toggle-kit';
import { MediaKit } from '@/components/media-kit';
import { CalloutKit } from '@/components/callout-kit';
import { ColumnKit } from '@/components/column-kit';
import { MathKit } from '@/components/math-kit';
import { DateKit } from '@/components/date-kit';
import { LinkKit } from '@/components/link-kit';
import { MentionKit } from '@/components/mention-kit';
import { FontKit } from '@/components/font-kit';
import { ListKit } from '@/components/list-kit';
import { AlignKit } from '@/components/align-kit';
import { LineHeightKit } from '@/components/line-height-kit';

export interface DiffBlockViewerProps {
    oldContent: any[]
    newContent: any[]
}

// Minimal Plugin Set
const DiffViewerPlugins = [
    ...BasicBlocksKit,
    ...BasicMarksKit,
    ...CodeBlockKit,
    ...TableKit,
    ...ToggleKit,
    ...MediaKit,
    ...CalloutKit,
    ...ColumnKit,
    ...MathKit,
    ...DateKit,
    ...LinkKit,
    ...MentionKit,
    ...FontKit,
    ...ListKit,
    ...AlignKit,
    ...LineHeightKit,
];

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

    // Setup Plate Editor with MINIMAL plugins
    const editor = usePlateEditor({
        id: editorId,
        plugins: [
            ...DiffViewerPlugins, // Replaced EditorKit with safe subset
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
            {/* Key forces complete unmount/remount when content changes */}
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

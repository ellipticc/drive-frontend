"use client"

import { useMemo } from 'react'
import { Plate, usePlateEditor, PlateController } from 'platejs/react'
import * as Diff from 'diff'
import { Editor } from '@/components/ui/editor'
import { EditorKit } from '@/components/editor-kit'

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

// Generate diff content with simpler structure
function generateDiffContent(oldBlocks: any[], newBlocks: any[]) {
    const mergedContent: any[] = []

    // Diff at block level by ID
    const blockDiffs = Diff.diffArrays(oldBlocks, newBlocks, {
        comparator: (a, b) => a?.id === b?.id
    })

    blockDiffs.forEach((chunk) => {
        if (!chunk.value) return

        if (chunk.added) {
            // Mark added blocks with green background
            chunk.value.forEach(block => {
                if (!block) return
                mergedContent.push({
                    ...block,
                    id: `added-${block.id || Date.now()}`,
                    className: 'bg-emerald-100 dark:bg-emerald-950/30 border-l-4 border-emerald-500 pl-3'
                })
            })
        } else if (chunk.removed) {
            // Mark removed blocks with red background
            chunk.value.forEach(block => {
                if (!block) return
                mergedContent.push({
                    ...block,
                    id: `removed-${block.id || Date.now()}`,
                    className: 'bg-red-100 dark:bg-red-950/30 border-l-4 border-red-500 pl-3 opacity-70 line-through'
                })
            })
        } else {
            // Unchanged blocks - check for inline text changes
            chunk.value.forEach(newBlock => {
                if (!newBlock) return

                const oldBlock = oldBlocks.find(b => b?.id === newBlock.id)
                if (!oldBlock) {
                    mergedContent.push(newBlock)
                    return
                }

                const oldText = getBlockText(oldBlock)
                const newText = getBlockText(newBlock)

                // If text is different, show inline diff with simple colored text
                if (oldText !== newText) {
                    const charDiffs = Diff.diffChars(oldText, newText)
                    const hasChanges = charDiffs.some(p => p.added || p.removed)

                    if (hasChanges) {
                        // Create simple text children with color markers
                        const children = charDiffs.map((part, idx) => {
                            if (part.added) {
                                return {
                                    text: part.value,
                                    bold: true,
                                    color: 'rgb(22, 163, 74)' // green-600
                                }
                            }
                            if (part.removed) {
                                return {
                                    text: part.value,
                                    strikethrough: true,
                                    color: 'rgb(220, 38, 38)' // red-600
                                }
                            }
                            return { text: part.value }
                        })

                        mergedContent.push({
                            ...newBlock,
                            id: `modified-${newBlock.id || Date.now()}`,
                            children: children.filter(c => c.text) // Remove empty text nodes
                        })
                    } else {
                        mergedContent.push(newBlock)
                    }
                } else {
                    mergedContent.push(newBlock)
                }
            })
        }
    })

    return mergedContent
}

export function DiffBlockViewer({ oldContent, newContent }: DiffBlockViewerProps) {
    // Generate diff content
    const diffContent = useMemo(() => {
        const safeOld = Array.isArray(oldContent) ? oldContent : []
        const safeNew = Array.isArray(newContent) ? newContent : []

        // Deep clone to prevent mutation
        const clonedOld = JSON.parse(JSON.stringify(safeOld))
        const clonedNew = JSON.parse(JSON.stringify(safeNew))

        const result = generateDiffContent(clonedOld, clonedNew)
        
        // Ensure valid structure
        return result.map((block, idx) => ({
            ...block,
            id: block.id || `block-${idx}`,
            children: Array.isArray(block.children) && block.children.length > 0 
                ? block.children 
                : [{ text: '' }]
        }))
    }, [oldContent, newContent])

    // Create unique editor key
    const editorKey = useMemo(() => Date.now(), [diffContent])

    // Setup simple editor without custom plugins
    const editor = usePlateEditor({
        id: `diff-${editorKey}`,
        plugins: EditorKit,
        value: diffContent
    })

    return (
        <PlateController>
            <Plate editor={editor} key={editorKey}>
                <div className="w-full flex justify-center bg-background min-h-full">
                    <div className="w-full max-w-[850px] px-8 md:px-16 py-12">
                        <Editor
                            readOnly
                            className="border-none shadow-none focus-visible:ring-0"
                        />
                    </div>
                </div>
            </Plate>
        </PlateController>
    )
}

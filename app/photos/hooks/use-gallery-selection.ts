"use client"

import { useState, useCallback } from "react"

export function useGallerySelection(items: any[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

    const toggleSelection = useCallback((id: string, multiSelect: boolean, rangeSelect: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(multiSelect ? prev : [])

            if (rangeSelect && lastSelectedId && items.length > 0) {
                // Find indices
                const currentIndex = items.findIndex(item => item.id === id)
                const lastIndex = items.findIndex(item => item.id === lastSelectedId)

                if (currentIndex !== -1 && lastIndex !== -1) {
                    const start = Math.min(currentIndex, lastIndex)
                    const end = Math.max(currentIndex, lastIndex)

                    // Add all items in range
                    for (let i = start; i <= end; i++) {
                        newSet.add(items[i].id)
                    }
                }
            } else {
                // Normal toggle
                if (newSet.has(id)) {
                    newSet.delete(id)
                } else {
                    newSet.add(id)
                }
            }

            return newSet
        })

        // Update last selected if we're adding or it's a single select
        setLastSelectedId(id)
    }, [items, lastSelectedId])

    const selectAll = useCallback(() => {
        const allIds = new Set(items.map(item => item.id))
        setSelectedIds(allIds)
    }, [items])

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set())
        setLastSelectedId(null)
    }, [])

    return {
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelectionMode: selectedIds.size > 0
    }
}

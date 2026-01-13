"use client"

import React, { useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { format, parseISO, isToday, isYesterday } from "date-fns"
import { IconCalendar } from "@tabler/icons-react"
import { GalleryItem } from "./gallery-item"

interface GalleryGridProps {
    groupedItems: { [key: string]: any[] }
    sortedDates: string[]
    zoomLevel: number // Number of columns (User slider: 2 - 10)
    selectedIds: Set<string>
    isSelectionMode: boolean
    onSelect: (id: string, rangeSelect: boolean) => void
    onPreview: (item: any) => void
    onAction: (action: string, item: any) => void
}

type VirtualRow =
    | { type: 'header', date: string, count: number, id: string }
    | { type: 'items', items: any[], id: string }

export function GalleryGrid({
    groupedItems,
    sortedDates,
    zoomLevel,
    selectedIds,
    isSelectionMode,
    onSelect,
    onPreview,
    onAction
}: GalleryGridProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    const columnCount = Math.max(2, Math.min(12, zoomLevel)) // Clamp between 2 and 12

    // Flatten data into rows
    const virtualRows = useMemo(() => {
        const rows: VirtualRow[] = []

        sortedDates.forEach(date => {
            const items = groupedItems[date]
            // Add Header Row
            rows.push({
                type: 'header',
                date,
                count: items.length,
                id: `header-${date}`
            })

            // Add Item Rows (chunked by columnCount)
            for (let i = 0; i < items.length; i += columnCount) {
                const chunk = items.slice(i, i + columnCount)
                rows.push({
                    type: 'items',
                    items: chunk,
                    id: `row-${date}-${i}`
                })
            }
        })

        return rows
    }, [sortedDates, groupedItems, columnCount])

    const rowVirtualizer = useVirtualizer({
        count: virtualRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const row = virtualRows[index]
            if (row.type === 'header') return 48 // Reduced header height (was 60)

            const width = typeof window !== 'undefined' ? window.innerWidth : 1200
            const gap = 8 // Reduced gap (was 24/8)
            const padding = 32 // px-4 * 2 = 32 approx? No, px-6 is 48. Let's assume px-4 (16px * 2 = 32).

            // Allow for scrollbar width approx 16px
            const availableWidth = width - 48 // px-6 is 24px left + 24px right = 48px

            const itemWidth = (availableWidth - (gap * (columnCount - 1))) / columnCount
            return itemWidth + gap
        },
        overscan: 5,
    })

    const formatDateHeader = (dateStr: string) => {
        const date = parseISO(dateStr)
        if (isToday(date)) return "Today"
        if (isYesterday(date)) return "Yesterday"
        return format(date, 'EEE, MMM d, yyyy')
    }

    return (
        <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar h-full w-full">
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = virtualRows[virtualRow.index]

                    return (
                        <div
                            key={row.id}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className={row.type === 'header' ? "px-6 pt-4 pb-2" : "px-6 pb-2"}
                        >
                            {row.type === 'header' ? (
                                <div className="flex items-center gap-3">
                                    <h2 className="font-medium text-sm text-foreground">
                                        {formatDateHeader(row.date)}
                                    </h2>
                                </div>
                            ) : (
                                <div
                                    className="grid w-full"
                                    style={{
                                        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                                        gap: '8px' // Fixed small gap
                                    }}
                                >
                                    {row.items.map((item, idx) => (
                                        <GalleryItem
                                            key={item.id}
                                            item={item}
                                            index={idx}
                                            isSelected={selectedIds.has(item.id)}
                                            isSelectionMode={isSelectionMode}
                                            onSelect={() => onSelect(item.id, true)}
                                            onPreview={() => onPreview(item)}
                                            viewMode="comfortable" // Always comfortable/square now
                                            onAction={onAction}
                                        />
                                    ))}
                                    {/* Fill empty spots if last row (optional for grid but good for flex behaviors) */}
                                    {Array.from({ length: columnCount - row.items.length }).map((_, i) => (
                                        <div key={`empty-${i}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

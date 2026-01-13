"use client"

import React, { useMemo, useRef, useState, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { format, parseISO, isToday, isYesterday } from "date-fns"
import { IconCalendar } from "@tabler/icons-react"
import { GalleryItem } from "./gallery-item"
import { useWindowSize } from "@/hooks/use-window-size"

interface GalleryGridProps {
    groupedItems: { [key: string]: any[] }
    sortedDates: string[]
    viewMode: 'comfortable' | 'compact'
    selectedIds: Set<string>
    isSelectionMode: boolean
    onSelect: (id: string, rangeSelect: boolean) => void
    onPreview: (item: any) => void
}

type VirtualRow =
    | { type: 'header', date: string, count: number, id: string }
    | { type: 'items', items: any[], id: string }

export function GalleryGrid({
    groupedItems,
    sortedDates,
    viewMode,
    selectedIds,
    isSelectionMode,
    onSelect,
    onPreview
}: GalleryGridProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [columnCount, setColumnCount] = useState(4)

    // Responsive columns
    useEffect(() => {
        const updateColumns = () => {
            const width = window.innerWidth
            // Adjust based on viewMode and screen width
            if (viewMode === 'comfortable') {
                if (width >= 1536) setColumnCount(6)      // 2xl
                else if (width >= 1280) setColumnCount(5) // xl
                else if (width >= 1024) setColumnCount(4) // lg
                else if (width >= 768) setColumnCount(3)  // md
                else setColumnCount(2)                    // sm
            } else { // compact
                if (width >= 1536) setColumnCount(12)
                else if (width >= 1280) setColumnCount(10)
                else if (width >= 1024) setColumnCount(8)
                else if (width >= 768) setColumnCount(6)
                else setColumnCount(4)
            }
        }

        updateColumns()
        window.addEventListener('resize', updateColumns)
        return () => window.removeEventListener('resize', updateColumns)
    }, [viewMode])

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
            if (row.type === 'header') return 60 // Header height

            const width = typeof window !== 'undefined' ? window.innerWidth : 1200
            let itemWidth = 0
            if (viewMode === 'comfortable') {
                // minus padding / gaps
                itemWidth = (width - 48) / columnCount
            } else {
                itemWidth = (width - 48) / columnCount
            }

            return itemWidth + (viewMode === 'comfortable' ? 24 : 8) // + gap
        },
        overscan: 5,
    })

    const formatDateHeader = (dateStr: string) => {
        const date = parseISO(dateStr)
        if (isToday(date)) return "Today"
        if (isYesterday(date)) return "Yesterday"
        return format(date, 'MMMM d, yyyy')
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
                            className={row.type === 'header' ? "px-6 py-4" : `px-6 ${viewMode === 'comfortable' ? 'pb-6' : 'pb-2'}`}
                        >
                            {row.type === 'header' ? (
                                <div className="flex items-center gap-2 pb-2 border-b">
                                    <IconCalendar className="h-4 w-4 text-primary" />
                                    <h2 className="font-semibold text-base text-foreground">
                                        {formatDateHeader(row.date)}
                                    </h2>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        {row.count} items
                                    </span>
                                </div>
                            ) : (
                                <div
                                    className="grid w-full"
                                    style={{
                                        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                                        gap: viewMode === 'comfortable' ? '24px' : '8px'
                                    }}
                                >
                                    {row.items.map((item, idx) => (
                                        <GalleryItem
                                            key={item.id}
                                            item={item}
                                            index={idx} // This index is row-relative, not global. If needed global, we'd need to map differently.
                                            isSelected={selectedIds.has(item.id)}
                                            isSelectionMode={isSelectionMode}
                                            onSelect={() => onSelect(item.id, true)} // True means allowing Shift+Click logic (handled in hook or page)
                                            onPreview={() => onPreview(item)}
                                            viewMode={viewMode}
                                        />
                                    ))}
                                    {/* Fill empty spots if last row */}
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

"use client"

import React, { useMemo, useRef } from "react"
import { format, parseISO, isToday, isYesterday } from "date-fns"
import { GalleryItem } from "./gallery-item"
import { Tag } from "@/lib/api"

interface MediaItem {
    id: string
    encryptedFilename: string
    filenameSalt: string
    mimeType: string
    size: number
    createdAt: string
    thumbnailPath?: string
    width?: number
    height?: number
    duration?: number
    encryption: {
        iv: string
        salt: string
        wrappedCek: string
        fileNoncePrefix: string
        cekNonce: string
        kyberCiphertext: string
        nonceWrapKyber: string
    }
    tags?: Tag[]
    isStarred?: boolean
    filename: string // Plaintext filename after decryption
}

interface GalleryGridProps {
    groupedItems: { [key: string]: MediaItem[] }
    sortedDates: string[]
    zoomLevel: number // Number of columns (User slider: 2 - 10)
    selectedIds: Set<string>
    isSelectionMode: boolean
    onSelect: (id: string, rangeSelect: boolean) => void
    onPreview: (item: MediaItem) => void
    onAction: (action: string, item: MediaItem) => void
    timeScale: 'years' | 'months' | 'days'
}

type VirtualRow =
    | { type: 'header', date: string, count: number, id: string }
    | { type: 'items', items: MediaItem[], id: string }

export function GalleryGrid({
    groupedItems,
    sortedDates,
    zoomLevel,
    selectedIds,
    isSelectionMode,
    onSelect,
    onPreview,
    onAction,
    timeScale
}: GalleryGridProps) {
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

    const formatHeaderDate = (dateStr: string) => {
        const date = parseISO(dateStr)
        if (isToday(date)) return "Today"
        if (isYesterday(date)) return "Yesterday"

        if (timeScale === 'days') {
            return format(date, 'd MMMM') // e.g. "2 January"
        } else if (timeScale === 'years') {
            return format(date, 'yyyy')
        }

        return format(date, 'MMMM yyyy') // e.g. "January 2026"
    }

    return (
        <div className="flex-1 w-full">
            <div className="w-full">
                {virtualRows.map((row) => {

                    return (
                        <div
                            key={row.id}
                            className={row.type === 'header' ? "px-6 pt-6 pb-2" : "px-6 pb-2"}
                        >
                            {row.type === 'header' ? (
                                <div className="flex items-center gap-3">
                                    <h2 className="font-medium text-base text-foreground/90">
                                        {formatHeaderDate(row.date)}
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
                                            onSelect={(range) => onSelect(item.id, range)}
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

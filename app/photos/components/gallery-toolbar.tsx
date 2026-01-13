"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { IconLayoutGrid, IconRefresh, IconGridDots } from "@tabler/icons-react"

interface GalleryToolbarProps {
    itemCount: number
    isRefreshing: boolean
    onRefresh: () => void
    viewMode: 'comfortable' | 'compact'
    setViewMode: (mode: 'comfortable' | 'compact') => void
}

export function GalleryToolbar({ itemCount, isRefreshing, onRefresh, viewMode, setViewMode }: GalleryToolbarProps) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold tracking-tight">Photos & Videos</h1>
                <div className="h-4 w-[1px] bg-border mx-2" />
                <p className="text-sm text-muted-foreground">
                    {itemCount} memories
                </p>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                >
                    <IconRefresh className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>

                <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
                    <Button
                        variant={viewMode === 'comfortable' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setViewMode('comfortable')}
                    >
                        <IconLayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                        Comfortable
                    </Button>
                    <Button
                        variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setViewMode('compact')}
                    >
                        <IconGridDots className="h-3.5 w-3.5 mr-1.5" />
                        Compact
                    </Button>
                </div>
            </div>
        </div>
    )
}

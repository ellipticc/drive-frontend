"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { IconMinus, IconPlus, IconRefresh } from "@tabler/icons-react"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface GalleryToolbarProps {
    viewMode: 'all' | 'photos' | 'videos' | 'starred'
    setViewMode: (mode: 'all' | 'photos' | 'videos' | 'starred') => void
    timeScale: 'years' | 'months' | 'days'
    setTimeScale: (scale: 'years' | 'months' | 'days') => void
    zoomLevel: number
    setZoomLevel: (level: number) => void
    onRefresh: () => void
    isRefreshing: boolean
}

export function GalleryToolbar({
    viewMode,
    setViewMode,
    timeScale,
    setTimeScale,
    zoomLevel,
    setZoomLevel,
    onRefresh,
    isRefreshing
}: GalleryToolbarProps) {

    return (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40 gap-4 h-14">

            {/* View Filter Group */}
            <div className="flex items-center gap-2">
                <ToggleGroup type="single" value={viewMode} onValueChange={(val) => val && setViewMode(val as 'all' | 'photos' | 'videos' | 'starred')}>
                    <ToggleGroupItem value="all" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-4 h-8 text-xs font-medium">All Items</ToggleGroupItem>
                    <ToggleGroupItem value="photos" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-4 h-8 text-xs font-medium">Photos</ToggleGroupItem>
                    <ToggleGroupItem value="videos" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-4 h-8 text-xs font-medium">Videos</ToggleGroupItem>
                    <ToggleGroupItem value="starred" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-4 h-8 text-xs font-medium">Starred</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Time Scale Group */}
            <div className="flex items-center gap-1">
                <ToggleGroup type="single" value={timeScale} onValueChange={(val) => val && setTimeScale(val as 'years' | 'months' | 'days')}>
                    <ToggleGroupItem value="years" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-3 h-8 text-xs font-medium">Years</ToggleGroupItem>
                    <ToggleGroupItem value="months" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-3 h-8 text-xs font-medium">Months</ToggleGroupItem>
                    <ToggleGroupItem value="days" size="sm" className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground hover:bg-transparent hover:text-foreground transition-all rounded-full px-3 h-8 text-xs font-medium">Days</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Zoom Slider */}
            <div className="flex items-center gap-2 w-32">
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setZoomLevel(Math.min(10, zoomLevel + 1))}>
                    <IconMinus className="h-3 w-3" />
                </Button>
                <Slider
                    value={[12 - zoomLevel]}

                    min={2}
                    max={10}
                    step={1}
                    onValueChange={(val) => setZoomLevel(val[0])}
                    inverted
                />

                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setZoomLevel(Math.max(2, zoomLevel - 1))}>
                    <IconPlus className="h-3 w-3" />
                </Button>
            </div>

            <div className="flex-1" /> {/* Spacer */}

            {/* Refresh */}
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing} className={isRefreshing ? "animate-spin" : ""}>
                <IconRefresh className="h-4 w-4" />
            </Button>
        </div>
    )
}

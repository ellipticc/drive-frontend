"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"

export function GallerySkeleton({ zoomLevel = 4 }: { zoomLevel?: number }) {
  const columnCount = Math.max(2, Math.min(12, zoomLevel))

  // Render 3 date groups with 2 rows each
  return (
    <div className="flex-1 w-full">
      {[1, 2, 3].map((group) => (
        <div key={group} className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-6 w-48" />
          </div>
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gap: '8px'
            }}
          >
            {Array.from({ length: columnCount * 2 }).map((_, i) => (
              <div key={i} className="w-full">
                <Skeleton className="w-full h-40 md:h-56 rounded-2xl" />
                <div className="mt-2">
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
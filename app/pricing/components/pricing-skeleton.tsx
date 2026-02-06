"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"

export function PricingSkeleton() {
  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Usage Card skeleton */}
      <div className="w-full">
        <div className="mb-4">
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="rounded-xl border p-6 bg-[var(--table-surface)] shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Skeleton className="h-7 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div>
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
          <div className="mt-6">
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Pricing table skeleton */}
      <div className="w-full">
        <div className="mb-4">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 shadow-sm bg-[var(--table-surface)]">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-full mb-1" />
              <div className="mt-4">
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
"use client"

import { Suspense } from "react"
import { FileBrowser } from "@/components/files/file-browser"

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-svh" />}>
      <FileBrowser />
    </Suspense>
  )
}

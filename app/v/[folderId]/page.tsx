"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { FileBrowser } from "@/components/files/file-browser"

export default function VaultFolderPage() {
    const params = useParams()
    const folderId = params.folderId as string

    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-svh" />}>
            <FileBrowser initialFolderId={folderId} />
        </Suspense>
    )
}

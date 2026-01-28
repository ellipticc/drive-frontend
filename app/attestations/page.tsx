
"use client"

import { SiteHeader } from "@/components/layout/header/site-header"
import { AttestationsView } from "@/components/attestations/attestations-view"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useLayoutEffect } from "react"

export default function AttestationsPage() {
    const { handleFileUpload, handleFolderUpload } = useGlobalUpload()

    useLayoutEffect(() => {
        document.title = "Attestations - Ellipticc Drive"
    }, [])

    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            <SiteHeader
                onSearch={() => { }} // No search logic for this page yet
                searchValue=""
                onFileUpload={handleFileUpload}
                onFolderUpload={handleFolderUpload}
                sticky
            />
            <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pb-8">
                <AttestationsView />
            </main>
        </div>
    )
}

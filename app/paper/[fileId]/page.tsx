"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"

export default function PaperRedirect() {
    const router = useRouter()
    const params = useParams()
    const fileId = params.fileId as string

    useEffect(() => {
        if (fileId) {
            router.replace(`/paper?fileId=${fileId}`)
        } else {
            router.replace('/')
        }
    }, [fileId, router])

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Redirecting to paper...</p>
            </div>
        </div>
    )
}

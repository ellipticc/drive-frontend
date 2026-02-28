"use client"

import { useEffect, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

function PaperRedirectContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const fileId = searchParams.get('fileId')

    useEffect(() => {
        if (fileId) {
            const newParams = new URLSearchParams(searchParams.toString())
            newParams.delete('fileId')
            const queryString = newParams.toString()
            router.replace(`/p/${fileId}${queryString ? `?${queryString}` : ''}`)
        } else {
            router.replace('/')
        }
    }, [fileId, router, searchParams])

    return null
}

export default function PaperRedirectPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-svh" />}>
            <PaperRedirectContent />
        </Suspense>
    )
}

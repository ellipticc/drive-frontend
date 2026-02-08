
"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AttestationsPage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to home page
        router.push("/")
    }, [router])

    return null
}

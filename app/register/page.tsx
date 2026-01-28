"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { IconLoader2 as Loader2 } from "@tabler/icons-react"

function RegisterRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Build the new URL with all search parameters preserved
    const params = new URLSearchParams(searchParams)
    const newUrl = `/signup${params.toString() ? '?' + params.toString() : ''}`

    console.log('Redirecting /register to /signup', {
      params: Object.fromEntries(params),
      newUrl
    })

    router.replace(newUrl)
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}

export default function RegisterRedirect() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <RegisterRedirectContent />
    </Suspense>
  )
}

"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function RegisterRedirect() {
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

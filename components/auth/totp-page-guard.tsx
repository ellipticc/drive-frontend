"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface TOTPPageGuardProps {
  children: React.ReactNode
}

export function TOTPPageGuard({ children }: TOTPPageGuardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    // Prevent infinite redirect loops
    if (hasRedirectedRef.current) return

    // Check if user is in login process (has login credentials stored)
    const hasLoginCredentials =
      localStorage.getItem('login_email') ||
      localStorage.getItem('login_user_id') ||
      searchParams.get('email') ||
      searchParams.get('userId')

    // If not in login process, redirect to login
    if (!hasLoginCredentials) {
      hasRedirectedRef.current = true
      router.push('/login')
      return
    }
  }, []) // Empty dependency array - only run once on mount

  return <>{children}</>
}
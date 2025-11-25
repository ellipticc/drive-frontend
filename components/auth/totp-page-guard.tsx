"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface TOTPPageGuardProps {
  children: React.ReactNode
}

export function TOTPPageGuard({ children }: TOTPPageGuardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user is in login process (has login credentials stored)
    const hasLoginCredentials =
      localStorage.getItem('login_email') ||
      localStorage.getItem('login_user_id') ||
      searchParams.get('email') ||
      searchParams.get('userId')

    // If not in login process, redirect to login
    if (!hasLoginCredentials) {
      router.push('/login')
      return
    }
  }, [router, searchParams])

  return <>{children}</>
}
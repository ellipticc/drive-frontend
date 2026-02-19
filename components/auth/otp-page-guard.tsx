"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

interface OTPPageGuardProps {
  children: React.ReactNode
}

export function OTPPageGuard({ children }: OTPPageGuardProps) {
  const router = useRouter()
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    // Prevent infinite redirect loops
    if (hasRedirectedRef.current) return

    // Check if user has the required signup data in localStorage
    const signupEmail = localStorage.getItem('signup_email')
    const signupPassword = localStorage.getItem('signup_password')

    // If neither signup data exists, redirect to signup page
    if (!signupEmail || !signupPassword) {
      hasRedirectedRef.current = true
      router.push('/signup')
      return
    }
  }, []) // Empty dependency array - only run once on mount

  return <>{children}</>
}
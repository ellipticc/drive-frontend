"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface OTPPageGuardProps {
  children: React.ReactNode
}

export function OTPPageGuard({ children }: OTPPageGuardProps) {
  const router = useRouter()

  useEffect(() => {
    // Check if user has the required signup data in localStorage
    const signupEmail = localStorage.getItem('signup_email')
    const signupPassword = localStorage.getItem('signup_password')

    // If neither signup data exists, redirect to signup page
    if (!signupEmail || !signupPassword) {
      router.push('/signup')
      return
    }
  }, [router])

  return <>{children}</>
}
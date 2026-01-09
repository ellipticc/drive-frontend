"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { FieldDescription } from "@/components/ui/field"
import { RecoveryPasswordResetForm } from "@/components/auth/recovery-password-reset-form"

export default function RecoveryResetPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ""
  const mnemonic = sessionStorage.getItem('recovery_mnemonic') || ""
  const hash = searchParams.get('hash') || ""

  useEffect(() => {
    // Validate that required params are present
    if (!email || !hash) {
      // Redirect back to recover page if params are missing
      router.push('/recover')
      return
    }

    // Validate that mnemonic is in sessionStorage
    if (!mnemonic) {
      // If mnemonic not in session, redirect back
      router.push('/recover')
      return
    }
  }, [email, hash, mnemonic, router])

  const handleSuccess = () => {
    // Clear recovery session data after successful reset
    sessionStorage.removeItem('recovery_mnemonic')
    sessionStorage.removeItem('recovery_hash')
    // Redirect to login page after successful password reset
    router.push('/login?message=password-reset-success')
  }

  const handleBack = () => {
    // Clear recovery session data when going back
    sessionStorage.removeItem('recovery_mnemonic')
    sessionStorage.removeItem('recovery_hash')
    router.push('/recover')
  }

  if (!email || !mnemonic || !hash) {
    return null // Loading state
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <IconCaretLeftRightFilled className="!size-5" />
          <span className="text-base font-geist-mono break-all">ellipticc</span>
        </Link>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-bold">Reset Your Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your new password below.
            </p>
          </div>

          <RecoveryPasswordResetForm
            email={email}
            mnemonic={mnemonic}
            onSuccess={handleSuccess}
            onBack={handleBack}
          />

          <FieldDescription className="text-center text-xs">
            By continuing, you agree to our{" "}
            <Link href="/terms-of-service" className="underline hover:text-primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
            .
          </FieldDescription>
        </div>
      </div>
    </div>
  )
}
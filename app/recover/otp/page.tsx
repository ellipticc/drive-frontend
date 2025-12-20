"use client"

import Link from "next/link"
import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { FieldDescription } from "@/components/ui/field"
import { ThemeToggle } from "@/components/theme-toggle"
import { RecoveryOTPVerificationForm } from "@/components/auth/recovery-otp-verification-form"

export default function RecoveryOTPPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(() => searchParams.get('email') || "")
  const [mnemonicHash, setMnemonicHash] = useState(() => searchParams.get('hash') || "")
  const [mnemonic, setMnemonic] = useState(() => sessionStorage.getItem('recovery_mnemonic') || "")

  useEffect(() => {
    // Validate that required params are present
    if (!email || !mnemonicHash) {
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
  }, [email, mnemonicHash, mnemonic, router])

  const handleSuccess = () => {
    // Redirect to password reset page with email and hash
    // Mnemonic stays in sessionStorage for final reset operation
    router.push(`/recover/reset?email=${encodeURIComponent(email)}&hash=${encodeURIComponent(mnemonicHash)}`)
  }

  const handleBack = () => {
    // Clear recovery session data when going back
    sessionStorage.removeItem('recovery_mnemonic')
    sessionStorage.removeItem('recovery_hash')
    router.push('/recover')
  }

  if (!email || !mnemonicHash || !mnemonic) {
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
          <span className="text-base font-mono break-all">ellipticc</span>
        </Link>
        <RecoveryOTPVerificationForm
          email={email}
          mnemonic={mnemonic}
          onSuccess={handleSuccess}
          onBack={handleBack}
        />
        <FieldDescription className="px-6 text-center">
          By clicking continue, you agree to our{" "}
          <Link href="/terms-of-service" className="underline underline-offset-4 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="underline underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </FieldDescription>
      </div>
    </div>
  )
}
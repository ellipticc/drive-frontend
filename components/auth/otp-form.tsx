"use client"

import { GalleryVerticalEnd } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api"

export function OTPForm({ className, ...props }: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [otp, setOtp] = useState("")
  const [email, setEmail] = useState("")

  // Get email from localStorage (set during signup)
  useEffect(() => {
    const storedEmail = localStorage.getItem('signup_email')
    if (storedEmail) {
      setEmail(storedEmail)
    }
  }, [])

  const handleOtpChange = (value: string) => {
    setOtp(value)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (otp.length !== 6) {
      setError("Please enter a 6-digit code")
      setIsLoading(false)
      return
    }

    try {
      const response = await apiClient.verifyOTP(email, otp)

      if (response.success) {
        // Store authentication token
        const { token } = response.data!
        apiClient.setAuthToken(token)

        // Get user data including crypto keypairs
        const profileResponse = await apiClient.getProfile()
        if (profileResponse.success && profileResponse.data?.user?.crypto_keypairs) {
          const userData = profileResponse.data.user
          
          // Import master key manager and derive master key
          const { masterKeyManager } = await import("@/lib/master-key")
          
          if (userData.crypto_keypairs?.accountSalt) {
            // Get password from localStorage (stored during signup)
            const password = localStorage.getItem('signup_password')
            if (password) {
              await masterKeyManager.deriveAndCacheMasterKey(password, userData.crypto_keypairs.accountSalt)
              // console.log('🔐 Master key cached after OTP verification')
            } else {
              // console.warn('No password found in localStorage for master key derivation')
            }
          }
        }

        // Clear signup data from localStorage
        localStorage.removeItem('signup_email')
        localStorage.removeItem('signup_password')

        // Redirect to backup page
        window.location.href = "/backup"
      } else {
        setError(response.error || "Verification failed")
      }
    } catch (err) {
      // console.error("OTP verification error:", err)
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await apiClient.sendOTP(email)

      if (response.success) {
        setError("") // Clear any previous errors
        // You could show a success message here
      } else {
        setError(response.error || "Failed to resend code")
      }
    } catch (err) {
      // console.error("Resend OTP error:", err)
      setError("Failed to resend verification code")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Enter verification code</h1>
            <FieldDescription>
              We sent a 6-digit code to {email || 'your email address'}
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="otp" className="sr-only">
              Verification code
            </FieldLabel>
            <InputOTP
              maxLength={6}
              id="otp"
              required
              containerClassName="gap-4"
              value={otp}
              onChange={handleOtpChange}
            >
              <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription className="text-center">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isLoading}
                className="underline underline-offset-4 hover:underline disabled:opacity-50"
              >
                Resend
              </button>
            </FieldDescription>
          </Field>
          {error && (
            <FieldDescription className="text-red-500 text-center">
              {error}
            </FieldDescription>
          )}
          <Field>
            <Button type="submit" disabled={isLoading || otp.length !== 6}>
              {isLoading ? "Verifying..." : "Verify"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

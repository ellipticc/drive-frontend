"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { IconAlertCircle as AlertCircle, IconLoader2 as Loader2 } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"

interface RecoveryOTPFormProps {
  email: string
  onSuccess: () => void
  onBack: () => void
}

export function RecoveryOTPForm({
  email,
  onSuccess,
  onBack,
}: RecoveryOTPFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [otp, setOtp] = useState("")
  const [resendCountdown, setResendCountdown] = useState(0)

  const sendOTP = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.sendOTP(email)

      if (response.success) {
        setResendCountdown(60)
      } else {
        setError(response.error || "Failed to send verification code")
      }
    } catch {
      setError("Failed to send verification code")
    } finally {
      setIsLoading(false)
    }
  }, [email])

  // Send OTP automatically when component mounts
  useEffect(() => {
    sendOTP()
  }, [sendOTP])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit code")
      return
    }

    setIsLoading(true)

    try {
      // Verify the OTP using the existing verifyOTP endpoint
      const verifyResponse = await apiClient.verifyOTP(email, otp)

      if (!verifyResponse.success) {
        setError(verifyResponse.error || "Verification failed. Please try again.")
        setOtp("")
        return
      }

      // OTP verified, proceed to password reset
      onSuccess()
    } catch {
      setError("Verification failed. Please try again.")
      setOtp("")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <div className="space-y-2">
          <FieldLabel>Email Verification Code</FieldLabel>
          <FieldDescription>
            Enter the 6-digit code sent to {email}
          </FieldDescription>
        </div>

        <div className="flex justify-center py-2">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(value) => {
              setOtp(value)
              setError("")
            }}
            disabled={isLoading}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <div className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={!otp || otp.length !== 6 || isLoading} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "Verifying..." : "Verify Email"}
        </Button>

        <Button
          type="button"
          onClick={() => sendOTP()}
          disabled={resendCountdown > 0 || isLoading}
          variant="ghost"
          className="w-full"
        >
          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Didn't receive code? Resend"}
        </Button>

        <Button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          variant="outline"
          className="w-full"
        >
          Back
        </Button>
      </FieldGroup>
    </form>
  )
}

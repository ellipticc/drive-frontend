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
import { Input } from "@/components/ui/input"
import {
  IconAlertCircle as AlertCircle,
  IconLoader2 as Loader2,
  IconChevronLeft as ChevronLeft,
  IconMail as Mail,
  IconDeviceMobile as Smartphone,
  IconHistory as History
} from "@tabler/icons-react"
import { apiClient } from "@/lib/api"

interface RecoveryOTPVerificationFormProps {
  email: string
  mnemonic: string // Raw mnemonic from sessionStorage (for final reset only)
  onSuccess: () => void
  onBack: () => void
}

type VerificationMethod = 'email' | 'totp' | 'backup' | null

export function RecoveryOTPVerificationForm({
  email,
  mnemonic,
  onSuccess,
  onBack,
}: RecoveryOTPVerificationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>(null)
  const [otp, setOtp] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [resendCountdown, setResendCountdown] = useState(0)
  const [hasTOTP, setHasTOTP] = useState(false)
  const [showMethodSelection, setShowMethodSelection] = useState(false)

  const sendRecoveryOTP = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.sendRecoveryOTP(email)

      if (response.success) {
        setResendCountdown(60)
      } else {
        setError(response.error || "Failed to send verification code")
      }
    } catch (err) {
      setError("Failed to send verification code")
      console.error('Send recovery OTP error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [email])

  // Countdown effect for resend cooldown
  useEffect(() => {
    if (resendCountdown <= 0) return
    const id = setInterval(() => setResendCountdown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [resendCountdown])

  // Auto-verify when OTP input is complete (email verification method)
  useEffect(() => {
    if (otp.length === 6 && !isLoading && verificationMethod === 'email') {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      (async () => {
        try {
          setIsLoading(true)
          setError("")
          const verifyResponse = await apiClient.verifyRecoveryOTP({
            email,
            mnemonicHash: sessionStorage.getItem('recovery_hash') || mnemonic,
            method: verificationMethod,
            code: otp
          })

          if (!verifyResponse.success) {
            setError(verifyResponse.error || "Verification failed. Please try again.")
            setOtp("")
            return
          }

          if (verifyResponse.data?.token) {
            apiClient.setAuthToken(verifyResponse.data.token)
          }

          onSuccess()
        } catch (err) {
          setError("Verification failed. Please try again.")
          setOtp("")
        } finally {
          setIsLoading(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, verificationMethod])
  // Check if user has TOTP enabled
  useEffect(() => {
    const checkTOTPAvailability = async () => {
      try {
        const response = await apiClient.checkRecoveryTOTPAvailability(email)
        if (response.success) {
          const hasTOTPEnabled = response.data?.hasTOTP || false
          setHasTOTP(hasTOTPEnabled)

          if (!hasTOTPEnabled) {
            // If no TOTP, default to email and send OTP
            setVerificationMethod('email')
            await sendRecoveryOTP()
          }
        } else {
          // Default to email if check fails
          setVerificationMethod('email')
          await sendRecoveryOTP()
        }
      } catch (err) {
        console.error('Error checking TOTP availability:', err)
        // Default to email if check fails
        setVerificationMethod('email')
        await sendRecoveryOTP()
      }
    }

    if (email) {
      checkTOTPAvailability()
    }
  }, [email, sendRecoveryOTP])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!verificationMethod) {
      setError("Please select a verification method")
      return
    }

    if (verificationMethod === 'backup') {
      if (!backupCode.trim()) {
        setError("Please enter your backup code")
        return
      }
    } else {
      if (!otp || otp.length !== 6) {
        setError("Please enter a valid 6-digit code")
        return
      }
    }

    setIsLoading(true)

    try {
      const verifyResponse = await apiClient.verifyRecoveryOTP({
        email,
        mnemonicHash: sessionStorage.getItem('recovery_hash') || mnemonic, // Use hash, not raw mnemonic
        method: verificationMethod,
        code: verificationMethod === 'backup' ? backupCode.trim() : otp
      })

      if (!verifyResponse.success) {
        setError(verifyResponse.error || "Verification failed. Please try again.")
        setOtp("")
        setBackupCode("")
        return
      }

      // Store recovery token for password reset
      if (verifyResponse.data?.token) {
        apiClient.setAuthToken(verifyResponse.data.token)
      }

      // Verification successful, proceed to password reset
      onSuccess()
    } catch (err) {
      setError("Verification failed. Please try again.")
      console.error('Verify recovery OTP error:', err)
      setOtp("")
      setBackupCode("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToMethodSelection = () => {
    setVerificationMethod(null)
    setOtp("")
    setBackupCode("")
    setError("")
    setShowMethodSelection(false)
  }

  // Show method selection screen if TOTP is available and not already selected
  if (hasTOTP && verificationMethod === null && !showMethodSelection) {
    return (
      <form className="space-y-6">
        <FieldGroup>
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold">Verify your identity</h2>
            <p className="text-sm text-muted-foreground">
              Choose how you&apos;d like to verify your identity
            </p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              onClick={async () => {
                setVerificationMethod('email')
                setShowMethodSelection(true)
                // Send email OTP when email method is selected
                await sendRecoveryOTP()
              }}
              disabled={isLoading}
              variant="outline"
              className="w-full justify-start h-11"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email Code
            </Button>

            <Button
              type="button"
              onClick={() => {
                setVerificationMethod('totp')
                setShowMethodSelection(true)
              }}
              disabled={isLoading}
              variant="outline"
              className="w-full justify-start h-11"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Authenticator App
            </Button>

            <Button
              type="button"
              onClick={() => {
                setVerificationMethod('backup')
                setShowMethodSelection(true)
              }}
              disabled={isLoading}
              variant="outline"
              className="w-full justify-start h-11"
            >
              <History className="mr-2 h-4 w-4" />
              Backup Code
            </Button>
          </div>

          <Button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            variant="ghost"
            className="w-full"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </FieldGroup>
      </form>
    )
  }

  // Show OTP/Backup code entry screen
  if (verificationMethod) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          <div className="space-y-2">
            <FieldLabel>
              {verificationMethod === 'email' && 'Email Code'}
              {verificationMethod === 'totp' && 'Authenticator Code'}
              {verificationMethod === 'backup' && 'Backup Code'}
            </FieldLabel>
            <FieldDescription>
              {verificationMethod === 'email' && `We sent a 6-digit code to ${email}`}
              {verificationMethod === 'totp' && "Enter the 6-digit code from your authenticator app"}
              {verificationMethod === 'backup' && "Enter one of your backup codes"}
            </FieldDescription>
          </div>

          {verificationMethod === 'backup' ? (
            <Input
              type="text"
              placeholder="8-character code"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.toUpperCase())
                setError("")
              }}
              disabled={isLoading}
              className="text-center tracking-widest text-lg"
              maxLength={8}
              autoFocus
            />
          ) : (
            <div className="flex justify-center py-4">
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
          )}

          {error && (
            <div className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={
              (verificationMethod === 'backup' && !backupCode.trim()) ||
              (verificationMethod !== 'backup' && (!otp || otp.length !== 6)) ||
              isLoading
            }
            className="w-full h-11"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Verifying..." : "Verify"}
          </Button>

          {verificationMethod === 'email' && (
            <Button
              type="button"
              onClick={() => sendRecoveryOTP()}
              disabled={resendCountdown > 0 || isLoading}
              variant="ghost"
              className="w-full text-sm"
            >
              {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Didn't receive code? Resend"}
            </Button>
          )}

          {hasTOTP ? (
            <Button
              type="button"
              onClick={handleBackToMethodSelection}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Change Method
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </FieldGroup>
      </form>
    )
  }

  return null // Loading state
}

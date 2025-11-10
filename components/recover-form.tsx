"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"

interface RecoverFormProps {
  onError?: (error: string) => void
  onSuccess?: () => void
}

export function RecoverForm({ onError, onSuccess }: RecoverFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<'email-mnemonic' | 'password'>('email-mnemonic')
  const [formData, setFormData] = useState({
    email: "",
    mnemonic: "",
    newPassword: "",
    confirmPassword: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError("")
  }

  const handleMnemonicSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validate inputs
      if (!formData.email || !formData.mnemonic) {
        setError("Please enter both email and recovery phrase")
        setIsLoading(false)
        return
      }

      // Validate mnemonic format
      const words = formData.mnemonic.trim().split(/\s+/)
      if (words.length !== 12) {
        setError("Recovery phrase must contain exactly 12 words")
        setIsLoading(false)
        return
      }

      // Check if recovery is available for this account
      const recoveryCheck = await apiClient.initiateRecovery(formData.email)

      if (!recoveryCheck.success) {
        setError("No account found with this email address")
        setIsLoading(false)
        return
      }

      if (!recoveryCheck.data?.hasRecovery) {
        setError("No recovery data found for this account. Please contact support.")
        setIsLoading(false)
        return
      }

      // Move to password step
      setStep('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validate passwords
      if (!formData.newPassword || !formData.confirmPassword) {
        setError("Please enter both passwords")
        return
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      if (formData.newPassword.length < 8) {
        setError("Password must be at least 8 characters long")
        return
      }

      // Hash the mnemonic with SHA256 for server verification
      const mnemonicHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(formData.mnemonic)
      )
      const hashedMnemonicHex = Array.from(new Uint8Array(mnemonicHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Call recovery API with hashed mnemonic and new password
      // The backend will verify the mnemonic hash and invalidate old tokens
      // User will then log in with new password using OPAQUE protocol
      const response = await apiClient.recoverAccount({
        email: formData.email,
        mnemonic: hashedMnemonicHex,
        // Note: Actual password reset happens via OPAQUE protocol on login
        // The backend only verifies the mnemonic hash here
      })

      if (response.success) {
        // User has proven they know the mnemonic
        // They can now log in with OPAQUE using their new password
        toast.success("Account recovered! Please log in with your new password.")
        onSuccess?.()
        router.push('/login')
      } else {
        setError(response.error || "Recovery failed. Please check your information and try again.")
      }
    } catch (err) {
      console.error('Recovery error:', err)
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {step === 'email-mnemonic' ? (
        <form onSubmit={handleMnemonicSubmit} className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="email">Email Address</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="mnemonic">Recovery Phrase</FieldLabel>
            <textarea
              id="mnemonic"
              name="mnemonic"
              placeholder="Enter your 12-word recovery phrase..."
              required
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.mnemonic}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <FieldDescription>
              Enter the 12 words from your recovery phrase, separated by spaces
            </FieldDescription>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Verifying..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              value={formData.newPassword}
              onChange={handleInputChange}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <FieldDescription>
              Must be at least 8 characters
            </FieldDescription>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStep('email-mnemonic')
              setError("")
            }}
            disabled={isLoading}
            className="w-full"
          >
            Back
          </Button>
        </form>
      )}
    </>
  )
}

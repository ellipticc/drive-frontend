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
  const [step, setStep] = useState<'email-mnemonic'>('email-mnemonic')
  const [formData, setFormData] = useState({
    email: "",
    mnemonic: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError("")
  }

  // Hash the mnemonic using SHA256 (client-side only, never sent raw)
  const hashMnemonic = async (mnemonic: string): Promise<string> => {
    const normalized = mnemonic.trim().toLowerCase()
    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
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

      // Hash mnemonic for secure transmission (never send raw mnemonic)
      const mnemonicHash = await hashMnemonic(formData.mnemonic)

      // Store mnemonic hash in sessionStorage temporarily for password reset
      // The raw mnemonic is kept in memory (formData) for key derivation later
      sessionStorage.setItem('recovery_mnemonic', formData.mnemonic.trim().toLowerCase())
      sessionStorage.setItem('recovery_hash', mnemonicHash)

      // Proceed to OTP verification with hashed mnemonic
      handleOTPVerification(mnemonicHash)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPVerification = (mnemonicHash: string) => {
    // Redirect to OTP verification page with email and mnemonic hash (NOT raw mnemonic)
    // Raw mnemonic is stored in sessionStorage for key derivation
    router.push(`/recover/otp?email=${encodeURIComponent(formData.email)}&hash=${encodeURIComponent(mnemonicHash)}`)
  }

  return (
    <form onSubmit={handleMnemonicSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
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
        </Field>

        <Field>
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
        </Field>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
            <div>{error}</div>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Verifying..." : "Continue"}
        </Button>
      </FieldGroup>
    </form>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api"
import { ThemeToggle } from "@/components/theme-toggle"

export default function RecoverPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<'mnemonic' | 'password'>('mnemonic')
  const [formData, setFormData] = useState({
    email: "",
    mnemonic: "",
    newPassword: "",
    confirmPassword: ""
  })

  useEffect(() => {
    document.title = "Recover Account - Ellipticc Drive"
  }, [])

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
      // Validate mnemonic format
      const words = formData.mnemonic.trim().split(/\s+/)
      if (words.length !== 12) {
        setError("Recovery phrase must contain exactly 12 words")
        return
      }

      // Check if recovery is available for this account (this also validates user exists)
      const recoveryCheck = await apiClient.initiateRecovery(formData.email)

      if (!recoveryCheck.success) {
        setError("No account found with this email address")
        return
      }

      if (!recoveryCheck.data?.hasRecovery) {
        setError("No recovery data found for this account. Please contact support.")
        return
      }

      setStep('password')
    } catch (err) {
      // // console.error("Recovery validation error:", err)
      setError("An unexpected error occurred. Please try again.")
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
      if (formData.newPassword !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      if (formData.newPassword.length < 8) {
        setError("Password must be at least 8 characters long")
        return
      }

      // Hash the mnemonic with SHA256 before sending to server
      const hashedMnemonic = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(formData.mnemonic))
      const hashedMnemonicHex = Array.from(new Uint8Array(hashedMnemonic))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Generate SRP credentials for the new password
      const { SRPClient } = await import("@/lib/srp")
      const { salt: newSalt, verifier: newVerifier } = await SRPClient.generateSaltAndVerifier(formData.email, formData.newPassword)

      // Call recovery API with hashed mnemonic and SRP credentials only
      const response = await apiClient.recoverAccount({
        email: formData.email,
        mnemonic: hashedMnemonicHex, // Send hashed mnemonic instead of plaintext
        newSalt,
        newVerifier
        // Note: No plaintext password sent - SRP credentials are sufficient
      })

      if (response.success) {
        alert("Account recovered successfully! You can now log in with your new password.")
        router.push('/login')
      } else {
        setError(response.error || "Recovery failed")
      }
    } catch (err) {
      // // console.error("Password reset error:", err)
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {step === 'mnemonic' ? 'Recover Your Account' : 'Set New Password'}
          </CardTitle>
          <CardDescription>
            {step === 'mnemonic'
              ? 'Enter your email and recovery phrase to regain access'
              : 'Choose a new secure password'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'mnemonic' ? (
            <form onSubmit={handleMnemonicSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@doe.com"
                    required
                    autoComplete="username"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="mnemonic">Recovery Phrase</FieldLabel>
                  <textarea
                    id="mnemonic"
                    name="mnemonic"
                    placeholder="Enter your 12-word recovery phrase"
                    required
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.mnemonic}
                    onChange={handleInputChange}
                  />
                  <FieldDescription>
                    Enter the 12 words from your recovery phrase, separated by spaces
                  </FieldDescription>
                </Field>
                {error && (
                  <FieldDescription className="text-red-500 text-center">
                    {error}
                  </FieldDescription>
                )}
                <Field>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Verifying..." : "Continue"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit}>
              <FieldGroup>
                <Field>
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
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
                {error && (
                  <FieldDescription className="text-red-500 text-center">
                    {error}
                  </FieldDescription>
                )}
                <Field>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('mnemonic')}
                    className="w-full mt-2"
                  >
                    Back
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

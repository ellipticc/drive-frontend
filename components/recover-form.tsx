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

      // DOUBLE-WRAPPED MASTER KEY RECOVERY
      // 1. Derive RKEK from mnemonic
      // 2. Decrypt RK with RKEK
      // 3. Decrypt original Master Key with RK
      // 4. Re-encrypt Master Key with new password's RK (optional rotation)
      // 5. Update password using OPAQUE
      
      const { 
        deriveRecoveryKeyEncryptionKey, 
        decryptRecoveryKey,
        decryptMasterKeyWithRecoveryKey,
        encryptRecoveryKey,
        encryptMasterKeyWithRecoveryKey,
        deriveEncryptionKey,
        generateKeyDerivationSalt
      } = await import("@/lib/crypto")
      const { masterKeyManager } = await import("@/lib/master-key")
      const { OPAQUERegistration } = await import("@/lib/opaque")

      // CRITICAL: Normalize mnemonic input (trim whitespace, normalize spacing)
      const normalizedMnemonic = formData.mnemonic.trim().split(/\s+/).join(' ').toLowerCase()
      const mnemonicWords = normalizedMnemonic.split(' ')
      
      if (mnemonicWords.length !== 12) {
        setError("Recovery phrase must contain exactly 12 words")
        return
      }
      
      console.log('📝 Recovery Phrase Analysis:')
      console.log('- Word count:', mnemonicWords.length)
      console.log('- Words:', mnemonicWords.join(' | '))
      
      // Step 1: Derive RKEK from mnemonic
      const rkek = await deriveRecoveryKeyEncryptionKey(normalizedMnemonic)
      console.log('Derived RKEK from mnemonic')
      const rkekHex = Array.from(rkek).map(b => b.toString(16).padStart(2, '0')).join('')
      console.log('RKEK (first 32 chars):', rkekHex.substring(0, 32))

      // Step 2: Get user's encrypted recovery key from backend
      // We need to fetch it first - initiate recovery should return it
      const recoveryCheck = await apiClient.initiateRecovery(formData.email)
      if (!recoveryCheck.success || !recoveryCheck.data?.encryptedRecoveryKey) {
        setError("Unable to retrieve recovery data. Please try again.")
        return
      }

      if (!recoveryCheck.data?.accountSalt) {
        setError("Account salt not found. Please try again.")
        return
      }

      const { encryptedRecoveryKey, recoveryKeyNonce, accountSalt } = recoveryCheck.data

      // Step 3: Decrypt RK with RKEK
      if (!recoveryKeyNonce) {
        setError("Recovery key nonce not found. Please try again.")
        return
      }
      let recoveryKey: Uint8Array
      try {
        recoveryKey = decryptRecoveryKey(encryptedRecoveryKey, recoveryKeyNonce, rkek)
        console.log('✅ Successfully decrypted Recovery Key with RKEK')
      } catch (decryptError) {
        console.error('❌ RK decryption error:', decryptError)
        console.error('This means the recovery phrase is incorrect or was stored differently.')
        console.error('Recovery phrase provided:', normalizedMnemonic)
        console.error('Encrypted RK (first 50 chars):', encryptedRecoveryKey.substring(0, 50))
        setError("The recovery phrase you entered is incorrect. Please double-check your 12-word phrase and try again. If you don't have your recovery phrase, you may need to contact support.")
        return
      }

      // Step 4: Get encrypted master key from recovery data
      if (!recoveryCheck.data?.encryptedMasterKey || !recoveryCheck.data?.masterKeyNonce) {
        setError("Master key recovery data not found. Cannot restore file access.")
        return
      }

      const { encryptedMasterKey: originalEncryptedMK, masterKeyNonce: originalMKNonce } = recoveryCheck.data

      // Step 5: Decrypt original Master Key with RK
      const originalMasterKey = decryptMasterKeyWithRecoveryKey(originalEncryptedMK, originalMKNonce, recoveryKey)
      console.log('Decrypted original Master Key with Recovery Key')

      // CRITICAL: Keep the SAME master key! Do NOT derive a new one from password.
      // The master key is what encrypts all files - it must remain unchanged.
      // We only update the password authentication mechanism.

      // Re-encrypt the SAME original master key with same Recovery Key
      // This allows future recovery with the same mnemonic
      const reEncryptedMKResult = encryptMasterKeyWithRecoveryKey(originalMasterKey, recoveryKey)

      // Re-encrypt RK with SAME RKEK (derived from same mnemonic)
      // The RKEK is deterministic: SHA256(SHA256(mnemonic)), so it never changes
      const reEncryptedRKResult = encryptRecoveryKey(recoveryKey, rkek)

      console.log('Re-encrypted keys (keeping same master key for file access)')

      // Step 7: Update password using OPAQUE
      // OPAQUE protocol ensures password is NEVER sent to backend - only derived OPAQUE record
      console.log('Updating password with OPAQUE...')
      const opaqueReg = new OPAQUERegistration()
      
      // OPAQUE Step 1: Client creates registration request
      const regStep1 = await opaqueReg.step1(formData.newPassword)
      
      // OPAQUE Step 2: Server creates registration response
      const regStep2 = await opaqueReg.step2(formData.email, regStep1.registrationRequest)
      
      // OPAQUE Step 3: Client finalizes registration
      const regStep3 = await opaqueReg.step3(regStep2.registrationResponse)
      
      // Step 8: Call recovery API with:
      // - Mnemonic hash for verification
      // - Re-encrypted Master Key for file access
      // - Re-encrypted Recovery Key for future recovery
      // - New OPAQUE registration record (derived from password, never plaintext sent)
      const response = await apiClient.recoverAccount({
        email: formData.email,
        mnemonic: hashedMnemonicHex,
        encryptedMasterKey: reEncryptedMKResult.encryptedMasterKey,
        masterKeySalt: JSON.stringify({
          accountSalt: accountSalt,
          masterKeyNonce: reEncryptedMKResult.masterKeyNonce,
          version: 1
        }),
        encryptedRecoveryKey: reEncryptedRKResult.encryptedRecoveryKey,
        recoveryKeyNonce: reEncryptedRKResult.recoveryKeyNonce,
        masterKeyVersion: 1,
        // OPAQUE-derived password file (password never sent to backend)
        newOpaquePasswordFile: regStep3.registrationRecord
      })

      if (response.success) {
        // Store auth token if provided
        if (response.data?.token) {
          apiClient.setAuthToken(response.data.token)
        }

        // Cache the RECOVERED master key for immediate dashboard access
        // Use the original account salt that was used to derive the master key initially
        masterKeyManager.cacheExistingMasterKey(originalMasterKey, accountSalt)
        
        toast.success("Account recovered! Your files are accessible again.")
        
        // Give a brief moment for toast to show, then redirect
        // The UserProvider will automatically fetch profile data when we redirect
        setTimeout(() => {
          onSuccess?.()
          // Force a full page reload to ensure UserProvider refreshes
          window.location.href = '/'
        }, 1000)
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

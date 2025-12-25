"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"
import { AlertCircle, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { OPAQUERegistration } from "@/lib/opaque"
import { deriveEncryptionKey, encryptData, encryptRecoveryKey, encryptMasterKeyWithRecoveryKey, deriveRecoveryKeyEncryptionKey, generateMasterKeyVerificationHash } from "@/lib/crypto"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"

interface RecoveryPasswordResetFormProps {
  email: string
  mnemonic: string // Raw mnemonic from sessionStorage
  onSuccess: () => void
  onBack: () => void
}

export function RecoveryPasswordResetForm({
  email,
  mnemonic,
  onSuccess,
  onBack,
}: RecoveryPasswordResetFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

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

    setIsLoading(true)

    try {
      // Step 1: Get user's encrypted recovery data (no auth required)
      const userDataResponse = await fetch(`/api/v1/recovery/user-data/${encodeURIComponent(email)}`)
      if (!userDataResponse.ok) {
        throw new Error("Failed to fetch user data")
      }

      const userDataJson = await userDataResponse.json()
      if (!userDataJson.success || !userDataJson.data) {
        throw new Error("Failed to fetch user data")
      }

      const userData = userDataJson.data
      const encryptedRecoveryKey = userData.encrypted_recovery_key
      const recoveryKeyNonce = userData.recovery_key_nonce
      const encryptedMasterKey = userData.encrypted_master_key
      const masterKeyNonce = userData.master_key_nonce
      const accountSalt = userData.account_salt

      if (!encryptedRecoveryKey || !recoveryKeyNonce || !encryptedMasterKey || !masterKeyNonce) {
        throw new Error("Missing encryption data in user profile")
      }

      // Validate nonce lengths (should be base64 strings that decode to 24 bytes)
      try {
        const rkNonceDecoded = atob(recoveryKeyNonce)
        const mkNonceDecoded = atob(masterKeyNonce)
        
        if (rkNonceDecoded.length !== 24) {
          throw new Error(`Recovery key nonce has wrong length: ${rkNonceDecoded.length} bytes (expected 24)`)
        }
        if (mkNonceDecoded.length !== 24) {
          throw new Error(`Master key nonce has wrong length: ${mkNonceDecoded.length} bytes (expected 24)`)
        }
      } catch (nonceError) {
        console.error('Nonce validation error:', nonceError)
        throw nonceError
      }

      // Step 2: Derive RKEK from mnemonic (using same algorithm as backend)
      const normalizedMnemonic = mnemonic.trim().toLowerCase()
      
      // CRITICAL: Use the same RKEK derivation as signup (SHA256(SHA256(mnemonic)))
      const rkek = await deriveRecoveryKeyEncryptionKey(normalizedMnemonic)
      
      if (!rkek || rkek.length !== 32) {
        throw new Error(`RKEK derivation failed: expected 32 bytes, got ${rkek?.length || 0}`)
      }

      // Step 3: Decrypt Recovery Key using RKEK
      // Nonces from backend are stored as base64, not hex
      const encryptedRKBytes = Uint8Array.from(atob(encryptedRecoveryKey), c => c.charCodeAt(0))
      const rkNonceBytes = Uint8Array.from(atob(recoveryKeyNonce), c => c.charCodeAt(0))
      
      let recoveryKeyBytes: Uint8Array
      try {
        recoveryKeyBytes = xchacha20poly1305(rkek, rkNonceBytes).decrypt(encryptedRKBytes)
      } catch (error) {
        throw new Error(`Failed to decrypt recovery key: ${error instanceof Error ? error.message : String(error)}`)
      }
      
      // Step 4: Decrypt Master Key using Recovery Key
      // Nonces from backend are stored as base64, not hex
      const encryptedMKBytes = Uint8Array.from(atob(encryptedMasterKey), c => c.charCodeAt(0))
      const mkNonceBytes = Uint8Array.from(atob(masterKeyNonce), c => c.charCodeAt(0))
      
      let masterKeyBytes: Uint8Array
      try {
        masterKeyBytes = xchacha20poly1305(recoveryKeyBytes, mkNonceBytes).decrypt(encryptedMKBytes)
      } catch (error) {
        throw new Error(`Failed to decrypt master key: ${error instanceof Error ? error.message : String(error)}`)
      }

      // Step 5: Re-encrypt both keys (with new nonces for freshness)
      // Use specialized functions for recovery and master key encryption
      const reEncryptedRKResult = encryptRecoveryKey(recoveryKeyBytes, rkek)
      const reEncryptedRK = reEncryptedRKResult.encryptedRecoveryKey
      const newRKNonce = reEncryptedRKResult.recoveryKeyNonce
      
      const reEncryptedMKResult = encryptMasterKeyWithRecoveryKey(masterKeyBytes, recoveryKeyBytes)
      const reEncryptedMK = reEncryptedMKResult.encryptedMasterKey
      const newMKNonce = reEncryptedMKResult.masterKeyNonce

      // Step 6: Derive new password-based encryption key and re-encrypt Master Key with it
      // CRITICAL: This allows login with new password to decrypt Master Key
      // Account salt is retrieved from user data endpoint
      if (!accountSalt) {
        throw new Error("Account salt not found. Cannot derive password-based encryption key.")
      }
      
      const newPasswordDerivedKey = await deriveEncryptionKey(formData.newPassword, accountSalt)
      const { encryptedData: encryptedMasterKeyPassword, nonce: masterKeyPasswordNonce } = encryptData(masterKeyBytes, newPasswordDerivedKey)

      // Generate Master Key verification hash for integrity validation
      // This allows detection of silent decryption failures or data corruption
      const masterKeyVerificationHash = await generateMasterKeyVerificationHash(masterKeyBytes)

      // IMPORTANT: For users who don't have encrypted_master_key_password in DB (old registrations),
      // we MUST send it now to enable password-based login
      // This is the FIRST time password-encrypted MK is being stored for these users

      // Step 7: Generate OPAQUE password file client-side
      const opaqueReg = new OPAQUERegistration()
      const { registrationRequest } = await opaqueReg.step1(formData.newPassword)
      const { registrationResponse } = await opaqueReg.step2(email, registrationRequest)
      const { registrationRecord } = await opaqueReg.step3(registrationResponse)

      // Step 8: Send to server
      const response = await apiClient.resetPasswordWithRecovery({
        email,
        newOpaquePasswordFile: registrationRecord,
        encryptedMasterKey: reEncryptedMK,
        masterKeyNonce: newMKNonce,
        encryptedRecoveryKey: reEncryptedRK,
        recoveryKeyNonce: newRKNonce,
        encryptedMasterKeyPassword: encryptedMasterKeyPassword,
        masterKeyPasswordNonce: masterKeyPasswordNonce,
        masterKeyVerificationHash: masterKeyVerificationHash
      })

      if (response.success) {
        toast.success("Password reset successful! You can now log in with your new password.")
        onSuccess()
      } else {
        setError(response.error || "Password reset failed. Please try again.")
      }
    } catch (err) {
      console.error('Password reset error:', err)
      setError(err instanceof Error ? err.message : "Password reset failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            value={formData.newPassword}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
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
        </Field>

        {error && (
          <div className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "Resetting..." : "Reset Password"}
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
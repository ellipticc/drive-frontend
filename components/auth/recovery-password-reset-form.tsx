"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AlertCircle, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { OPAQUERegistration } from "@/lib/opaque"
import { deriveEncryptionKey, uint8ArrayToHex, hexToUint8Array, encryptData } from "@/lib/crypto"
import { xchacha20poly1305 } from "@noble/ciphers/chacha"

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

      if (!encryptedRecoveryKey || !recoveryKeyNonce || !encryptedMasterKey || !masterKeyNonce) {
        throw new Error("Missing encryption data in user profile")
      }

      // Step 2: Derive RKEK from mnemonic (using same algorithm as backend)
      const normalizedMnemonic = mnemonic.trim().toLowerCase()
      // Derive RKEK using Argon2id with mnemonic as password and "RKEK" as salt
      const rkekSaltBytes = new TextEncoder().encode("RKEK")
      const rkekSaltHex = uint8ArrayToHex(rkekSaltBytes)
      const rkek = await deriveEncryptionKey(normalizedMnemonic, rkekSaltHex)

      // Step 3: Decrypt Recovery Key using RKEK
      const encryptedRKBytes = hexToUint8Array(encryptedRecoveryKey)
      const rkNonceBytes = hexToUint8Array(recoveryKeyNonce)
      
      const recoveryKeyBytes = xchacha20poly1305(rkek, rkNonceBytes).decrypt(encryptedRKBytes)
      
      // Step 4: Decrypt Master Key using Recovery Key
      const encryptedMKBytes = hexToUint8Array(encryptedMasterKey)
      const mkNonceBytes = hexToUint8Array(masterKeyNonce)
      
      const masterKeyBytes = xchacha20poly1305(recoveryKeyBytes, mkNonceBytes).decrypt(encryptedMKBytes)

      // Step 5: Re-encrypt both keys (with new nonces for freshness)
      const { encryptedData: reEncryptedRK, nonce: newRKNonce } = encryptData(recoveryKeyBytes, rkek)
      const { encryptedData: reEncryptedMK, nonce: newMKNonce } = encryptData(masterKeyBytes, recoveryKeyBytes)

      // Step 6: Generate OPAQUE password file client-side
      const opaqueReg = new OPAQUERegistration()
      const { registrationRequest } = await opaqueReg.step1(formData.newPassword)
      const { registrationResponse } = await opaqueReg.step2(email, registrationRequest)
      const { registrationRecord } = await opaqueReg.step3(registrationResponse)

      // Step 7: Send to server
      const response = await apiClient.resetPasswordWithRecovery({
        email,
        newOpaquePasswordFile: registrationRecord,
        encryptedMasterKey: reEncryptedMK,
        masterKeyNonce: newMKNonce,
        encryptedRecoveryKey: reEncryptedRK,
        recoveryKeyNonce: newRKNonce
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
        </Field>

        <Field>
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
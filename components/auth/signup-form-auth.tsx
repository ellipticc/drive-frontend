"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { Loader2 } from "lucide-react"
import { SIWELoginButton } from "./siwe-login-button"
import { GoogleOAuthButton } from "./google-oauth-button"
import { useSessionTracking, sessionTrackingUtils } from "@/hooks/useSessionTracking"

export function SignupFormAuth({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [error, setError] = useState("")
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const sessionTracking = useSessionTracking(true) // Enable session tracking on signup page
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  })

  // Check if user is already authenticated with cached credentials
  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        // Check if JWT token exists and is valid
        const token = localStorage.getItem('auth_token')
        const masterKey = localStorage.getItem('master_key')
        const accountSalt = localStorage.getItem('account_salt')

        if (token && masterKey && accountSalt) {
          console.log('All credentials found! Redirecting to dashboard...')
          // Token and master key found in cache - user is authenticated
          // Silently redirect to dashboard with loading spinner
          router.push('/')
          return
        } else {
          console.log('Missing credentials - staying on signup page')
          // No cached credentials - stay on signup page
          setIsCheckingAuth(false)
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setIsCheckingAuth(false)
      }
    }

    checkAndRedirect()
  }, [router])

  // Capture referral code from URL on mount
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      // Store in localStorage so it persists across redirects
      sessionStorage.setItem('referral_code', ref)
      console.log('Referral code captured:', ref)
    }
  }, [searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validate form
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters long")
        return
      }

      // Import crypto functions
      const { 
        generateAllKeypairs, 
        hexToUint8Array,
        deriveRecoveryKeyEncryptionKey,
        generateRecoveryKey,
        encryptRecoveryKey,
        encryptMasterKeyWithRecoveryKey,
        deriveEncryptionKey,
        encryptData,
        generateMasterKeyVerificationHash
      } = await import("@/lib/crypto")
      const { OPAQUE } = await import("@/lib/opaque")
      
      // Generate a random account salt (32 bytes) in hex format
      // This salt is used for PBKDF2 key derivation and is deterministic per user
      const tempAccountSalt = crypto.getRandomValues(new Uint8Array(32))
      const tempAccountSaltHex = Array.from(tempAccountSalt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      // Generate keypairs using the hex salt
      const keypairs = await generateAllKeypairs(formData.password, tempAccountSaltHex)
      
      // The mnemonic is already generated in generateAllKeypairs
      const mnemonic = keypairs.mnemonic
      const mnemonicHash = keypairs.mnemonicHash
      
      // Derive RKEK (Recovery Key Encryption Key) from mnemonic
      const rkek = await deriveRecoveryKeyEncryptionKey(mnemonic)
      
      // Generate a random Recovery Key (RK)
      const rk = generateRecoveryKey()
      
      // Encrypt the RK with RKEK
      const recoveryKeyEncryption = encryptRecoveryKey(rk, rkek)
      const encryptedRecoveryKey = recoveryKeyEncryption.encryptedRecoveryKey
      const recoveryKeyNonce = recoveryKeyEncryption.recoveryKeyNonce
      
      // Derive the Master Key from password (same as regular login)
      const masterKey = await deriveEncryptionKey(formData.password, tempAccountSaltHex)
      
      // Encrypt the Master Key with the Recovery Key
      const masterKeyEncryption = encryptMasterKeyWithRecoveryKey(masterKey, rk)
      const encryptedMasterKey = masterKeyEncryption.encryptedMasterKey
      const masterKeyNonce = masterKeyEncryption.masterKeyNonce
      
      // CRITICAL: Also encrypt Master Key with password-derived key
      // This allows login with password to decrypt Master Key (password-based path)
      const newPasswordDerivedKey = await deriveEncryptionKey(formData.password, tempAccountSaltHex)
      const { encryptedData: encryptedMasterKeyPassword, nonce: masterKeyPasswordNonce } = encryptData(masterKey, newPasswordDerivedKey)
      
      // Generate Master Key verification hash for integrity validation
      // This allows detection of silent decryption failures or data corruption
      const masterKeyVerificationHash = await generateMasterKeyVerificationHash(masterKey)
      
      // Prepare master key salt for storage (JSON stringified with the nonce)
      const masterKeySalt = JSON.stringify({
        salt: tempAccountSaltHex,
        algorithm: 'argon2id',
        masterKeyNonce: masterKeyNonce
      })

      // Execute complete OPAQUE registration (all 4 steps)
      const registrationResult = await OPAQUE.register(
        formData.password,
        formData.email,
        "", // Empty name since it's not required
        {
          accountSalt: tempAccountSaltHex,
          algorithmVersion: 'v3-hybrid-pqc-xchacha20'
        }
      )

      if (!registrationResult.success) {
        setError("Registration failed. Please try again.")
        return
      }

      // Get account salt and user ID from registration response
      const { userId, token } = registrationResult

      // Store authentication token
      apiClient.setAuthToken(token)

      // Store email and password for future use (OTP, master key derivation, etc.)
      localStorage.setItem('signup_email', formData.email)
      localStorage.setItem('signup_password', formData.password)

      // Store mnemonic for backup page
      localStorage.setItem('recovery_mnemonic', keypairs.mnemonic)

      // Now store the PQC keypairs in individual database columns
      // CRITICAL: Store accountSalt as HEX (same format used for key derivation)
      try {
        // Retrieve referral code from sessionStorage if it exists
        const referralCode = sessionStorage.getItem('referral_code')
        
        const cryptoSetupResponse = await apiClient.storeCryptoKeypairs({
          userId,
          accountSalt: tempAccountSaltHex,  // Store as HEX, not base64
          pqcKeypairs: keypairs.pqcKeypairs,
          mnemonicHash,  // SHA256(mnemonic) for zero-knowledge verification
          masterKeyVerificationHash,  // HMAC for master key integrity validation
          encryptedRecoveryKey,  // RK encrypted with RKEK(mnemonic)
          recoveryKeyNonce,      // Nonce for decrypting recovery key
          encryptedMasterKey,    // MK encrypted with RK
          masterKeySalt,         // JSON stringified with salt and algorithm
          encryptedMasterKeyPassword,  // MK encrypted with password-derived key
          masterKeyPasswordNonce,      // Nonce for password-encrypted MK
          referralCode: referralCode || undefined  // Pass referral code if available
        })

        if (!cryptoSetupResponse.success) {
          console.warn('PQC keypairs setup failed, but registration succeeded:', cryptoSetupResponse)
          // Don't fail registration if crypto setup fails - user can retry later
        } else {
          console.log('PQC keypairs stored successfully')
        }
      } catch (cryptoError) {
        console.warn('PQC keypairs setup error:', cryptoError)
        // Don't fail registration if crypto setup fails - user can retry later
      }

      // Store email and password for OTP verification
      localStorage.setItem('signup_email', formData.email)
      localStorage.setItem('signup_password', formData.password)

      // Track signup conversion
      const sessionId = sessionTrackingUtils.getSessionId()
      if (sessionId) {
        sessionTrackingUtils.trackConversion(sessionId, 'signup', userId)
      }

      // Navigate to OTP verification page (CRITICAL: user must verify email first before backup)
      router.push("/otp")
    } catch (err) {
      console.error('Signup error:', err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading spinner while checking authentication and redirecting
  if (isCheckingAuth) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Checking Authentication</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Please wait while we verify your session...
          </p>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit} className="w-full">
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Enter your email below to create your account
            </p>
          </div>
          <Field>
            <SIWELoginButton context="register" />
          </Field>
          <Field className="-mt-4">
            <GoogleOAuthButton context="register" />
          </Field>
          <FieldSeparator>
            Or continue with email
          </FieldSeparator>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
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
            <Field className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm Password
                </FieldLabel>
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
            </Field>
            <FieldDescription>
              Must be at least 8 characters long.
            </FieldDescription>
          </Field>
          {error && (
            <FieldDescription className="text-red-500 text-center">
              {error}
            </FieldDescription>
          )}
          <Field>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="animate-spin" />}
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
            <FieldDescription className="text-center">
              Already have an account? <Link href="/login" className="underline underline-offset-4 hover:underline">Sign in</Link>
            </FieldDescription>
          </Field>
          <FieldDescription className="text-center text-xs">
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
        </FieldGroup>
      </form>
    </div>
  )
}

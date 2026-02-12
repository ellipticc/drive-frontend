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
import { PasswordInput } from "@/components/ui/password-input"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { IconLoader2 as Loader2 } from "@tabler/icons-react"


import { initializeDeviceKeys } from "@/lib/device-keys"
import { IconCheck, IconX } from "@tabler/icons-react"

export function SignupFormAuth({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  })

  // Shared visibility for password & confirm password on signup
  const [showPasswords, setShowPasswords] = useState(false)

  const validatePasswordRealtime = (pwd: string) => {
    return {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    }
  }

  const passwordChecks = validatePasswordRealtime(formData.password)


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
          // Check for pending redirect
          const redirectUrl = sessionStorage.getItem('login_redirect_url');
          if (redirectUrl) {
            console.log('Redirecting to stored URL:', redirectUrl);
            sessionStorage.removeItem('login_redirect_url');
            window.location.href = redirectUrl;
          } else {
            router.push('/')
          }
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

      const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

      if (!passwordPattern.test(formData.password)) {
        setError("Password must be at least 8 characters and include an uppercase letter, lowercase letter, a number, and a special character")
        return
      }

      // Import crypto functions
      const {
        generateAllKeypairs,
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

      if (!userId) {
        setError("Registration failed: missing user ID")
        return
      }

      // Store authentication token
      apiClient.setAuthToken(token ?? null)

      // Initialize device keys and authorize device
      const publicKey = await initializeDeviceKeys();
      if (publicKey) {
        const deviceAuth = await apiClient.authorizeDevice(publicKey);
        if (deviceAuth.success && deviceAuth.data) {
          // Store device ID for authenticated requests
          localStorage.setItem('device_id', deviceAuth.data.deviceId);

          if (deviceAuth.data.limitReached) {
            try {
              const { toast } = await import("sonner");
              toast.error("Device Limit Reached", {
                description: `Your ${deviceAuth.data.deviceQuota?.planName || 'Free'} plan limit has been reached. You will have restricted access until you upgrade or revoke a device.`,
                duration: 10000,
              });
            } catch (e) {
              console.warn("Toast error", e);
            }
          } else if (deviceAuth.data.warning) {
            try {
              const { toast } = await import("sonner");
              toast.warning("Device Limit Notice", {
                description: deviceAuth.data.warning,
                duration: 8000,
              });
            } catch (e) {
              console.warn("Toast error", e);
            }
          }
        } else {
          apiClient.setAuthToken(null)

          if (deviceAuth.data?.limitReached) {
            const quota = deviceAuth.data.deviceQuota;
            setError(`Device limit reached. Your ${quota?.planName || 'current'} plan only allows up to ${quota?.maxDevices || 'limited'} devices. Please logout from another device or upgrade your plan.`);
          } else {
            setError(deviceAuth.error || "Device security verification failed");
          }
          return;
        }
      }

      // Store email and password for future use (OTP, master key derivation, etc.)
      localStorage.setItem('signup_email', formData.email)
      localStorage.setItem('signup_password', formData.password)

      // Store mnemonic for backup page
      localStorage.setItem('recovery_mnemonic', keypairs.mnemonic)

      // Now store the PQC keypairs in individual database columns
      // CRITICAL: Store accountSalt as HEX (same format used for key derivation)
      try {

        const cryptoSetupResponse = await apiClient.storeCryptoKeypairs({
          userId,
          accountSalt: tempAccountSaltHex,  // Store as HEX, not base64
          pqcKeypairs: keypairs.pqcKeypairs,
          mnemonicHash,  // SHA256(mnemonic) for zero-knowledge verification
          encryptedRecoveryKey,  // RK encrypted with RKEK(mnemonic)
          recoveryKeyNonce,      // Nonce for decrypting recovery key
          encryptedMasterKey,    // MK encrypted with RK
          masterKeySalt,         // JSON stringified with salt and algorithm
          encryptedMasterKeyPassword,  // MK encrypted with password-derived key
          masterKeyPasswordNonce,      // Nonce for password-encrypted MK
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



      // Stop analytics tracking immediately after registration
      if (typeof window !== 'undefined') {
        (window as { stopTracking?: () => void }).stopTracking?.();
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
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  show={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm Password
                </FieldLabel>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  show={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                />
              </Field>
            </Field>
            {formData.password.length > 0 && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                <div className="text-xs font-medium text-foreground mb-2">Password strength:</div>
                <ul className="grid grid-cols-2 gap-2 text-xs">
                  <li className={`flex items-center gap-2 ${passwordChecks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {passwordChecks.length ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />} 8+ characters
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.upper ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {passwordChecks.upper ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />} Uppercase
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.lower ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {passwordChecks.lower ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />} Lowercase
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.number ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {passwordChecks.number ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />} Number
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.special ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {passwordChecks.special ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />} Special char
                  </li>
                </ul>
              </div>
            )}
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

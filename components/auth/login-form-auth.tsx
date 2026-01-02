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
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { UserData } from '@/lib/api'
import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { keyManager } from "@/lib/key-manager"
import { IconLoader2 as Loader2 } from "@tabler/icons-react"
import { SIWELoginButton } from "./siwe-login-button"
import { GoogleOAuthButton } from "./google-oauth-button"
import { useSessionTracking, sessionTrackingUtils } from "@/hooks/useSessionTracking"
import { initializeDeviceKeys } from "@/lib/device-keys"

export function LoginFormAuth({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  useSessionTracking(true) // Enable session tracking on login page

  // Check if user is already authenticated with cached credentials
  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        // Check if JWT token exists and is valid in either localStorage or sessionStorage
        const localToken = localStorage.getItem('auth_token')
        const sessionToken = sessionStorage.getItem('auth_token')
        const token = localToken || sessionToken

        const localMasterKey = localStorage.getItem('master_key')
        const sessionMasterKey = sessionStorage.getItem('master_key')
        const masterKey = localMasterKey || sessionMasterKey

        const localAccountSalt = localStorage.getItem('account_salt')
        const sessionAccountSalt = sessionStorage.getItem('account_salt')
        const accountSalt = localAccountSalt || sessionAccountSalt

        if (token && masterKey && accountSalt) {
          console.log('All credentials found! Redirecting to dashboard...')
          // Determine storage type based on where credentials were found
          const storage = (sessionToken && sessionMasterKey && sessionAccountSalt) ? sessionStorage : localStorage;
          apiClient.setStorage(storage);
          masterKeyManager.setStorage(storage);
          // Token and master key found in cache - user is authenticated
          // Check for pending redirect
          const redirectUrl = sessionStorage.getItem('login_redirect_url');
          if (redirectUrl) {
            console.log('Redirecting to stored URL:', redirectUrl);
            sessionStorage.removeItem('login_redirect_url');
            window.location.href = redirectUrl; // Use window.location for full refresh/external checks
          } else {
            router.push('/')
          }
          return
        } else {
          console.log('Missing credentials - staying on login page')
          // No cached credentials - stay on login page
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
      // Dynamically import OPAQUE to ensure it only runs on client
      const { OPAQUE } = await import("@/lib/opaque")

      // Execute complete OPAQUE login (all 4 steps)
      const loginResult = await OPAQUE.login(formData.password, formData.email)

      if (!loginResult.success) {
        setError("Invalid email or password")
        return
      }

      const { token, user } = loginResult
      const userObj = user as unknown as UserData

      // Set storage type based on keepSignedIn preference
      const storage = keepSignedIn ? localStorage : sessionStorage;
      apiClient.setStorage(storage);
      masterKeyManager.setStorage(storage);

      // DO NOT store token yet - wait for TOTP check
      // Token will only be stored if TOTP is not required or passes verification

      // Validate crypto keypairs structure
      if (userObj.crypto_keypairs?.pqcKeypairs) {
        const requiredKeys = ['ed25519', 'x25519', 'kyber', 'dilithium'] as const;
        const missingKeys = requiredKeys.filter(key => !(userObj.crypto_keypairs!.pqcKeypairs as unknown as Record<string, unknown>)[key as string]);

        if (missingKeys.length > 0) {
          setError(`Missing cryptographic keys: ${missingKeys.join(', ')}`);
          return;
        }

        // Validate each keypair has required fields
        for (const keyType of requiredKeys) {
          const keypair = (userObj.crypto_keypairs!.pqcKeypairs as unknown as Record<string, unknown>)[keyType as string] as Record<string, unknown> | undefined;
          if (!keypair) {
            setError(`Invalid ${String(keyType)} keypair structure`);
            return;
          }

          const requiredFields = ['publicKey', 'encryptedPrivateKey', 'privateKeyNonce', 'encryptionKey', 'encryptionNonce'];
          const missingFields = requiredFields.filter(field => !(keypair[field]));

          if (missingFields.length > 0) {
            setError(`Invalid ${String(keyType)} keypair structure`);
            return;
          }

          const maxLengths = {
            encryptedPrivateKey: 6000,
            encryptionKey: 200,
            encryptionNonce: 100
          };

          const encPriv = keypair.encryptedPrivateKey as string | undefined;
          const encKey = keypair.encryptionKey as string | undefined;
          const encNonce = keypair.encryptionNonce as string | undefined;

          if ((encPriv && encPriv.length > maxLengths.encryptedPrivateKey) ||
            (encKey && encKey.length > maxLengths.encryptionKey) ||
            (encNonce && encNonce.length > maxLengths.encryptionNonce)) {
            keyManager.forceClearStorage();
          }
        }
      }

      // If login didn't include crypto_keypairs, fetch profile
      // NOTE: We need to set the token first since getProfile() requires authentication
      let userData: UserData | Record<string, unknown> = userObj;

      // Temporarily set token for fetching profile
      apiClient.setAuthToken(token ?? null)

      // CRITICAL: Initialize device identity IMMEDIATELY after login
      // This ensures all following requests (getProfile, getTOTPStatus) have device headers
      const publicKey = await initializeDeviceKeys();
      if (publicKey) {
        const deviceAuth = await apiClient.authorizeDevice(publicKey);
        if (deviceAuth.success && deviceAuth.data) {
          // Store device ID so it's injected into following request headers
          localStorage.setItem('device_id', deviceAuth.data.deviceId);

          if (deviceAuth.data.warning) {
            try {
              const { toast } = await import("sonner");
              toast.warning("Device Limit Notice", {
                description: deviceAuth.data.warning,
                duration: 8000,
              });
            } catch (tError) {
              console.warn('Could not load toast:', tError);
            }
          }
        } else {
          // If device auth fails, we cannot proceed as subsequent calls will fail 401
          apiClient.setAuthToken(null)
          setError(deviceAuth.error || "Device security verification failed");
          return;
        }
      }

      if (!userObj.crypto_keypairs?.accountSalt) {
        const profileResponse = await apiClient.getProfile();
        if (profileResponse.success && profileResponse.data?.user) {
          userData = profileResponse.data.user as UserData;
        } else {
          // Clear token if profile fetch fails
          apiClient.setAuthToken(null)
          setError("Failed to load cryptographic keys");
          return;
        }
      }

      // Check if TOTP is enabled for this user BEFORE deriving master key
      // This way if we redirect to TOTP, we store password in the appropriate storage
      const totpStatusResponse = await apiClient.getTOTPStatus(userObj.id as string)
      const isTOTPEnabled = totpStatusResponse.success && totpStatusResponse.data?.enabled;

      if (isTOTPEnabled) {
        // Check if device is remembered
        const deviceToken = localStorage.getItem('totp_device_token')
        if (deviceToken) {
          const deviceResponse = await apiClient.verifyDeviceToken(deviceToken)
          if (deviceResponse.success && deviceResponse.data?.isValidDevice) {
            // Fall through to master key derivation below
          } else {
            if (token) storage.setItem('pending_auth_token', token)
            storage.setItem('login_email', formData.email)
            storage.setItem('login_password', formData.password)
            storage.setItem('login_user_id', String(userObj.id))
            // DO NOT clear the token - TOTP form needs it to call getProfile()
            router.push(`/totp?email=${encodeURIComponent(formData.email)}&userId=${userObj.id}`)
            return
          }
        } else {
          if (token) {
            storage.setItem('pending_auth_token', token)
            storage.setItem('login_email', formData.email)
            storage.setItem('login_password', formData.password)
            storage.setItem('login_user_id', String(userObj.id))
          }
          // DO NOT clear the token - TOTP form needs it to call getProfile()
          router.push(`/totp?email=${encodeURIComponent(formData.email)}&userId=${userObj.id}`)
          return
        }
      }

      // Only derive master key if not redirecting to TOTP
      // Derive and cache master key for the session
      try {
        const ud = userData as UserData;
        if (ud.crypto_keypairs?.accountSalt) {
          // Check if user has password-encrypted master key (new path)
          if (ud.encrypted_master_key_password && ud.master_key_password_nonce) {
            const { deriveEncryptionKey, decryptData } = await import("@/lib/crypto")

            // Derive password-based encryption key using account salt
            const passwordDerivedKey = await deriveEncryptionKey(
              formData.password,
              ud.crypto_keypairs.accountSalt as string
            )

            // Decrypt the Master Key using password-derived key
            try {
              const masterKeyBytes = await decryptData(
                ud.encrypted_master_key_password,
                passwordDerivedKey,
                ud.master_key_password_nonce
              )

              // Cache the decrypted master key
              if (ud.crypto_keypairs?.accountSalt) {
                masterKeyManager.cacheExistingMasterKey(masterKeyBytes, ud.crypto_keypairs.accountSalt as string)
              }
            } catch (decryptError) {
              console.error('Failed to decrypt password-encrypted master key:', decryptError)
              setError("Incorrect password")
              return
            }
          } else {
            if (ud.crypto_keypairs?.accountSalt) {
              await masterKeyManager.deriveAndCacheMasterKey(
                formData.password,
                ud.crypto_keypairs.accountSalt as string
              );
            } else {
              throw new Error('Missing account salt');
            }
          }
        } else {
          throw new Error('No account salt found in user profile');
        }
      } catch (keyError) {
        console.error('Failed to derive master key:', keyError);
        setError("Failed to initialize cryptographic keys");
        return;
      }

      // Initialize KeyManager with user data
      try {
        await keyManager.initialize(userData as UserData);
      } catch (keyManagerError) {
        if (keyManagerError instanceof Error &&
          (keyManagerError.message.includes('Corrupted') ||
            keyManagerError.message.includes('corrupted') ||
            keyManagerError.message.includes('Invalid'))) {
          keyManager.forceClearStorage();

          try {
            await keyManager.initialize(userData as UserData);
          } catch {
            setError("Failed to initialize key management system. Please try logging out and back in.");
            return;
          }
        } else {
          setError("Failed to initialize key management system");
          return;
        }
      }

      // Only reach here if TOTP is not enabled or device was remembered
      // Token and auth should already be set at this point
      // Track login conversion before clearing session
      const sessionId = sessionTrackingUtils.getSessionId()
      if (sessionId) {
        sessionTrackingUtils.trackConversion(sessionId, 'login', userObj.id as string)
      }

      // Stop session tracking after successful login
      sessionTrackingUtils.clearSession()

      window.dispatchEvent(new CustomEvent('user-login'));

      // Check for pending redirect
      const redirectUrl = sessionStorage.getItem('login_redirect_url');
      if (redirectUrl) {
        console.log('Redirecting to stored URL:', redirectUrl);
        sessionStorage.removeItem('login_redirect_url');
        window.location.href = redirectUrl;
      } else {
        router.push("/")
      }
    } catch (err) {
      console.error('Login error:', err)
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
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Login with your email and password
            </p>
          </div>
          <Field>
            <SIWELoginButton />
          </Field>
          <Field className="-mt-4">
            <GoogleOAuthButton />
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
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/recover"
                className="ml-auto text-sm underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
            />
          </Field>
          <Field>
            <div className="flex items-center space-x-2">
              <Switch
                id="keep-signed-in"
                checked={keepSignedIn}
                onCheckedChange={setKeepSignedIn}
              />
              <FieldLabel htmlFor="keep-signed-in" className="text-sm font-normal">
                Keep me signed in
              </FieldLabel>
            </div>
            <FieldDescription className="text-xs">
              Stay logged in across browser sessions. If unchecked, you&apos;ll be logged out when you close the tab.
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
              {isLoading ? "Signing in..." : "Login"}
            </Button>
            <FieldDescription className="text-center">
              Don&apos;t have an account? <Link href="/signup" className="underline underline-offset-4 hover:underline">Sign up</Link>
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

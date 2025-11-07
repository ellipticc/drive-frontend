"use client"

import { cn } from "@/lib/utils"
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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { keyManager } from "@/lib/key-manager"
import { Loader2 } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })

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

      // Store authentication token
      apiClient.setAuthToken(token)

      // Validate crypto keypairs structure
      if (user.crypto_keypairs?.pqcKeypairs) {
        const requiredKeys = ['ed25519', 'x25519', 'kyber', 'dilithium'];
        const missingKeys = requiredKeys.filter(key => !user.crypto_keypairs.pqcKeypairs[key]);
        
        if (missingKeys.length > 0) {
          setError(`Missing cryptographic keys: ${missingKeys.join(', ')}`);
          return;
        }

        // Validate each keypair has required fields
        for (const keyType of requiredKeys) {
          const keypair = user.crypto_keypairs.pqcKeypairs[keyType];
          const requiredFields = ['publicKey', 'encryptedPrivateKey', 'privateKeyNonce', 'encryptionKey', 'encryptionNonce'];
          const missingFields = requiredFields.filter(field => !keypair[field]);
          
          if (missingFields.length > 0) {
            setError(`Invalid ${keyType} keypair structure`);
            return;
          }

          const maxLengths = {
            encryptedPrivateKey: 6000,
            encryptionKey: 200,
            encryptionNonce: 100
          };
          
          if (keypair.encryptedPrivateKey?.length > maxLengths.encryptedPrivateKey || 
              keypair.encryptionKey?.length > maxLengths.encryptionKey || 
              keypair.encryptionNonce?.length > maxLengths.encryptionNonce) {
            keyManager.forceClearStorage();
          }
        }
      }

      // If login didn't include crypto_keypairs, fetch profile
      let userData = user;
      if (!user.crypto_keypairs?.accountSalt) {
        const profileResponse = await apiClient.getProfile();
        if (profileResponse.success && profileResponse.data?.user) {
          userData = profileResponse.data.user;
        } else {
          setError("Failed to load cryptographic keys");
          return;
        }
      }

      // Derive and cache master key for the session
      try {
        if (userData.crypto_keypairs?.accountSalt) {
          await masterKeyManager.deriveAndCacheMasterKey(formData.password, userData.crypto_keypairs.accountSalt);
        }
      } catch (keyError) {
        setError("Failed to initialize cryptographic keys");
        return;
      }

      // Initialize KeyManager with user data
      try {
        await keyManager.initialize(userData);
      } catch (keyManagerError) {
        if (keyManagerError instanceof Error && 
            (keyManagerError.message.includes('Corrupted') || 
             keyManagerError.message.includes('corrupted') ||
             keyManagerError.message.includes('Invalid'))) {
          keyManager.forceClearStorage();
          
          try {
            await keyManager.initialize(userData);
          } catch (retryError) {
            setError("Failed to initialize key management system. Please try logging out and back in.");
            return;
          }
        } else {
          setError("Failed to initialize key management system");
          return;
        }
      }

      // Check if TOTP is enabled for this user
      const totpStatusResponse = await apiClient.getTOTPStatus()
      if (totpStatusResponse.success && totpStatusResponse.data?.enabled) {
        // Check if device is remembered
        const deviceToken = localStorage.getItem('totp_device_token')
        if (deviceToken) {
          const deviceResponse = await apiClient.verifyDeviceToken(deviceToken)
          if (deviceResponse.success && deviceResponse.data?.isValidDevice) {
            // Device is remembered, proceed with login
          } else {
            // Device not remembered or invalid, redirect to TOTP
            localStorage.setItem('login_email', formData.email)
            localStorage.setItem('login_password', formData.password)
            localStorage.setItem('login_user_id', user.id)
            router.push(`/totp?email=${encodeURIComponent(formData.email)}&userId=${user.id}`)
            return
          }
        } else {
          // TOTP enabled but no remembered device, redirect to TOTP
          localStorage.setItem('login_email', formData.email)
          localStorage.setItem('login_password', formData.password)
          localStorage.setItem('login_user_id', user.id)
          router.push(`/totp?email=${encodeURIComponent(formData.email)}&userId=${user.id}`)
          return
        }
      }

      // Redirect to main page (for both TOTP disabled users and TOTP enabled users with remembered devices)
      window.dispatchEvent(new CustomEvent('user-login'));
      router.push("/")
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Login with your email and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <Button variant="outline" type="button" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>
                  Login with Apple
                </Button>
                <Button variant="outline" type="button" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Login with Google
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
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
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </Field>
              {error && (
                <FieldDescription className="text-red-500 text-center">
                  {error}
                </FieldDescription>
              )}
              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="animate-spin" />}
                  {isLoading ? "Signing in..." : "Login"}
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link href="/signup" className="underline underline-offset-4 hover:underline">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

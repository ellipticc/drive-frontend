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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { keyManager } from "@/lib/key-manager"
import { Loader2 } from "lucide-react"
import { IconCloudLock } from '@tabler/icons-react';
import { sessionTrackingUtils } from "@/hooks/useSessionTracking"

export function TOTPLoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    token: "",
    rememberDevice: false
  })
  const [userEmail, setUserEmail] = useState("")
  const [userId, setUserId] = useState("")

  // Get user email and userId from URL params or localStorage
  useEffect(() => {
    const email = searchParams.get('email') || localStorage.getItem('login_email')
    const id = searchParams.get('userId') || localStorage.getItem('login_user_id')
    if (email) {
      setUserEmail(email)
    }
    if (id) {
      setUserId(id)
    }
  }, [searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 6) }))
    setError("")
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, rememberDevice: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.token.length !== 6) {
      setError("Please enter a 6-digit code")
      setIsLoading(false)
      return
    }

    try {
      const response = await apiClient.verifyTOTPLogin(userId, formData.token, formData.rememberDevice)

      if (response.success) {
        // Store device token if remember device was checked
        if (formData.rememberDevice && response.data?.deviceToken) {
          localStorage.setItem('totp_device_token', response.data.deviceToken)
        }

        // Get user data and initialize crypto
        const profileResponse = await apiClient.getProfile()
        if (profileResponse.success && profileResponse.data?.user) {
          const userData = profileResponse.data.user

          // Derive and cache master key for the session
          try {
            if (userData.crypto_keypairs?.accountSalt) {
              const password = localStorage.getItem('login_password')
              if (password) {
                await masterKeyManager.deriveAndCacheMasterKey(password, userData.crypto_keypairs.accountSalt)
              }
            }
          } catch (keyError) {
            setError("Failed to initialize cryptographic keys")
            return
          }

          // Initialize KeyManager with user data
          try {
            await keyManager.initialize(userData)
          } catch (keyManagerError) {
            if (keyManagerError instanceof Error &&
                (keyManagerError.message.includes('Corrupted') ||
                 keyManagerError.message.includes('corrupted') ||
                 keyManagerError.message.includes('Invalid'))) {
              keyManager.forceClearStorage()

              try {
                await keyManager.initialize(userData)
              } catch (retryError) {
                setError("Failed to initialize key management system. Please try logging out and back in.")
                return
              }
            } else {
              setError("Failed to initialize key management system")
              return
            }
          }

          // Clear login data from localStorage
          localStorage.removeItem('login_email')
          localStorage.removeItem('login_password')
          localStorage.removeItem('login_user_id')

          // Track login conversion for session analytics
          const sessionId = sessionTrackingUtils.getSessionId()
          if (sessionId) {
            sessionTrackingUtils.trackConversion(sessionId, 'login', userId)
          }

          // Clear session tracking after successful login
          sessionTrackingUtils.clearSession()

          // Redirect to main page
          window.dispatchEvent(new CustomEvent('user-login'))
          router.push("/")
        } else {
          setError("Failed to load user profile")
        }
      } else {
        setError(response.error || "Invalid TOTP code")
      }
    } catch (err) {
      console.error('TOTP verification error:', err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseRecoveryCode = () => {
    // Redirect to recovery code page
    router.push(`/totp/recovery?email=${encodeURIComponent(userEmail)}&userId=${userId}`)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <IconCloudLock className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token">Authentication Code</FieldLabel>
                <Input
                  id="token"
                  name="token"
                  type="text"
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  value={formData.token}
                  onChange={handleInputChange}
                  className="text-center text-lg font-mono"
                  maxLength={6}
                />
              </Field>
              <Field>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-device"
                    checked={formData.rememberDevice}
                    onCheckedChange={handleCheckboxChange}
                  />
                  <label
                    htmlFor="remember-device"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember this device for 30 days
                  </label>
                </div>
              </Field>
              {error && (
                <FieldDescription className="text-red-500 text-center">
                  {error}
                </FieldDescription>
              )}
              <Field>
                <Button type="submit" disabled={isLoading || formData.token.length !== 6}>
                  {isLoading && <Loader2 className="animate-spin" />}
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>
              </Field>
              <Field>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseRecoveryCode}
                  className="w-full"
                >
                  Use Recovery Code Instead
                </Button>
              </Field>
              <FieldDescription className="text-center">
                <Link
                  href="/login"
                  className="underline underline-offset-4 hover:underline"
                >
                  Back to login
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
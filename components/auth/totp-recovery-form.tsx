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
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { keyManager } from "@/lib/key-manager"
import { Loader2 } from "lucide-react"
import { IconKey } from '@tabler/icons-react';

export function TOTPRecoveryForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userId, setUserId] = useState("")

  // Get user email and userId from URL params
  useEffect(() => {
    const email = searchParams.get('email')
    const id = searchParams.get('userId')
    if (email) {
      setUserEmail(email)
    }
    if (id) {
      setUserId(id)
    }
  }, [searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecoveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (!recoveryCode.trim()) {
      setError("Please enter a recovery code")
      setIsLoading(false)
      return
    }

    try {
      const response = await apiClient.verifyRecoveryCode(recoveryCode.trim())

      if (response.success) {
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

          // Redirect to main page
          window.dispatchEvent(new CustomEvent('user-login'))
          router.push("/")
        } else {
          setError("Failed to load user profile")
        }
      } else {
        setError(response.error || "Invalid recovery code")
      }
    } catch (err) {
      console.error('Recovery code verification error:', err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <IconKey className="h-5 w-5" />
            Recovery Code
          </CardTitle>
          <CardDescription>
            Enter one of your recovery codes to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="recovery-code">Recovery Code</FieldLabel>
                <Input
                  id="recovery-code"
                  type="text"
                  placeholder="ABCD1234"
                  required
                  value={recoveryCode}
                  onChange={handleInputChange}
                  className="text-center font-mono text-lg uppercase"
                  maxLength={8} // 8 characters
                />
                <FieldDescription className="text-center text-sm">
                  Recovery codes are 8 characters long and contain letters and numbers
                </FieldDescription>
              </Field>
              {error && (
                <FieldDescription className="text-red-500 text-center">
                  {error}
                </FieldDescription>
              )}
              <Field>
                <Button type="submit" disabled={isLoading || !recoveryCode.trim()}>
                  {isLoading && <Loader2 className="animate-spin" />}
                  {isLoading ? "Verifying..." : "Verify Recovery Code"}
                </Button>
              </Field>
              <FieldDescription className="text-center">
                <Link
                  href={`/totp?email=${encodeURIComponent(userEmail)}&userId=${userId}`}
                  className="underline underline-offset-4 hover:underline"
                >
                  Back to authenticator
                </Link>
              </FieldDescription>
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
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
import { useRouter } from "next/navigation"
import { useState } from "react"
import { apiClient } from "@/lib/api"
import { Loader2 } from "lucide-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
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
      // Validate form
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters long")
        return
      }

      // Import PQC crypto functions to get keypairs
      const { generateAllKeypairs, hexToUint8Array } = await import("@/lib/crypto")
      const { OPAQUE } = await import("@/lib/opaque")
      
      // Generate a random account salt (32 bytes) in hex format
      // This salt is used for PBKDF2 key derivation and is deterministic per user
      const tempAccountSalt = crypto.getRandomValues(new Uint8Array(32))
      const tempAccountSaltHex = Array.from(tempAccountSalt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      // Generate keypairs using the hex salt
      const keypairs = await generateAllKeypairs(formData.password, tempAccountSaltHex)

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
        const cryptoSetupResponse = await apiClient.storeCryptoKeypairs({
          userId,
          accountSalt: tempAccountSaltHex,  // Store as HEX, not base64
          pqcKeypairs: keypairs.pqcKeypairs,
          encryptedMnemonic: '', // Not used - we only send mnemonicHash for zero-knowledge verification
          mnemonicSalt: '',
          mnemonicIv: ''
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

      // Navigate to OTP verification
      router.push("/otp")
    } catch (err) {
      console.error('Signup error:', err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
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
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="animate-spin" />}
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account? <Link href="/login" className="underline underline-offset-4 hover:underline">Sign in</Link>
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

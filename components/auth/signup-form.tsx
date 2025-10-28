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
import { SRPClient, generateSRPSalt } from "@/lib/srp"
import { Loader2 } from "lucide-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
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

      // Generate SRP salt and verifier
      const { salt, verifier } = await SRPClient.generateSaltAndVerifier(formData.email, formData.password)

      // Register with SRP first (server generates account salt)
      const registerResponse = await apiClient.registerSRP({
        email: formData.email,
        name: formData.name,
        salt,
        verifier,
        algorithmVersion: "v3-hybrid-pqc-xchacha20"
        // Don't send encrypted keys yet - we'll send them after getting account salt
      })

      if (!registerResponse.success) {
        setError(registerResponse.error || "Registration failed")
        return
      }

      // Get the account salt and userId from the registration response
      const accountSalt = registerResponse.data?.accountSalt
      const userId = registerResponse.data?.userId
      if (!accountSalt || !userId) {
        setError("Failed to get account salt or user ID from server")
        return
      }

      // Import PQC crypto functions
      const { generateAllKeypairs } = await import("@/lib/crypto")

      // Generate cryptographic keypairs using the account salt from server
      const keypairs = await generateAllKeypairs(formData.password, accountSalt)

      // Store the encrypted PQC keys using the account salt
      const storeKeysResponse = await apiClient.storePQCKeysAfterRegistration(userId, keypairs.pqcKeypairs)

      if (!storeKeysResponse.success) {
        setError("Account created but failed to store cryptographic keys. Please contact support.")
        return
      }

      // Store mnemonic for backup page
      localStorage.setItem('recovery_mnemonic', keypairs.mnemonic)

      // Store email and password for OTP verification and master key derivation
      localStorage.setItem('signup_email', formData.email)
      localStorage.setItem('signup_password', formData.password)

      // Navigate to OTP verification
      router.push("/otp")
    } catch (err) {
      // console.error("Registration error:", err)
      setError("An unexpected error occurred")
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
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </Field>
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

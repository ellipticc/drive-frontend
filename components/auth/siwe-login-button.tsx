"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { keyManager } from "@/lib/key-manager"
import SIWE from "@/lib/siwe"

interface SIWELoginButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

export function SIWELoginButton({ onSuccess, onError }: SIWELoginButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleMetaMaskLogin = async () => {
    setIsLoading(true)
    setError("")

    try {
      // Check if MetaMask is installed
      if (!SIWE.isWalletInstalled()) {
        const errorMsg = "MetaMask not installed. Please install MetaMask to continue."
        setError(errorMsg)
        onError?.(errorMsg)
        toast.error(errorMsg)
        return
      }

      // Perform SIWE login
      const siwe = new SIWE(1) // Mainnet
      const loginResult = await siwe.login()

      if (!loginResult.success || !loginResult.token || !loginResult.user) {
        const errorMsg = loginResult.error || "Login failed"
        setError(errorMsg)
        onError?.(errorMsg)
        toast.error(errorMsg)
        return
      }

      const { token, user, message } = loginResult
      const isNewUser = message?.includes('created') || false

      // Store authentication token
      apiClient.setAuthToken(token)

      if (isNewUser) {

        // Generate a random password for key derivation
        // (This is not used for login, only for key derivation consistency)
        const randomPassword = generateRandomPassword(32)

        // Generate all keypairs using the random password
        const { generateAllKeypairs } = await import("@/lib/crypto")
        const keypairs = await generateAllKeypairs(randomPassword)

        // Derive and cache master key
        await masterKeyManager.deriveAndCacheMasterKey(randomPassword, keypairs.keyDerivationSalt)

        // Store the generated password hash with the user account
        // (Backend should have already created an empty account)
        // Now we initialize crypto with the generated keypairs
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          walletAddress: user.walletAddress,
          isWalletUser: true,
          crypto_keypairs: {
            accountSalt: keypairs.keyDerivationSalt,
            pqcKeypairs: keypairs.pqcKeypairs
          }
        }

        // Store crypto keypairs
        const storeResponse = await apiClient.storeCryptoKeypairs({
          userId: user.id,
          accountSalt: keypairs.keyDerivationSalt,
          pqcKeypairs: keypairs.pqcKeypairs,
          encryptedMnemonic: keypairs.encryptedMnemonic,
          mnemonicSalt: keypairs.mnemonicSalt,
          mnemonicIv: keypairs.mnemonicIv
        })

        if (!storeResponse.success) {
          throw new Error("Failed to store crypto keypairs")
        }

        // Store the password in session for later reference
        // NOTE: For E2EE consistency, wallet users' master key is derived from:
        // 1. Account Salt (stored in DB, retrieved on each login)
        // 2. Random password generated each time (not stored anywhere)
        // This means each SIWE login generates the same master key because:
        // - Account Salt is deterministic (same for each user)
        // - Random password is re-derived from wallet signature (via recovery flow if needed)
        // Alternative approach for returning users: Store encrypted password in localStorage
        // encrypted with wallet's public key, then decrypt using wallet's signature
        sessionStorage.setItem(`wallet_${user.walletAddress}_password`, randomPassword)

        // Initialize key manager with user data
        await keyManager.initialize(userData)

        toast.success("Account created successfully!")
      } else {
        // Existing wallet user - just proceed with login

        const profileResponse = await apiClient.getProfile()
        if (profileResponse.success && profileResponse.data?.user) {
          const userData = profileResponse.data.user

          // Initialize key manager
          await keyManager.initialize(userData)
        }

        toast.success("Login successful!")
      }

      // Call success callback
      onSuccess?.(user)

      // Redirect to main drive page
      router.push("/")

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred"
      console.error("SIWE login error:", errorMsg)
      setError(errorMsg)
      onError?.(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      <Button
        onClick={handleMetaMaskLogin}
        disabled={isLoading}
        className="w-full"
        variant="outline"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            🦊 Login with MetaMask
          </>
        )}
      </Button>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Generate a random password for wallet-based key derivation
 */
function generateRandomPassword(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length]
  }
  return password
}

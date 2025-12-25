"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { metamaskAuthService, MetaMaskAuthService } from "@/lib/metamask-auth-service"
import { keyManager } from "@/lib/key-manager"
import SIWE from "@/lib/siwe"
import { sessionTrackingUtils } from "@/hooks/useSessionTracking"

interface User {
  id: string;
  [key: string]: unknown; // Allow additional properties for flexibility
}

interface SIWELoginButtonProps {
  onSuccess?: (user: User) => void;
  onError?: (error: string) => void;
  context?: 'login' | 'register';
}

export function SIWELoginButton({ onSuccess, onError, context = 'login' }: SIWELoginButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleMetaMaskLogin = async () => {
    setIsLoading(true)
    setError("")

    try {
      // Check if MetaMask is installed
      if (!SIWE.isWalletInstalled()) {
        setError("MetaMask not installed. Install MetaMask extension to use wallet-based authentication.")
        setIsLoading(false)
        return
      }

      // Perform SIWE login
      const siwe = new SIWE(1) // Mainnet
      
      // Get referral code from sessionStorage if available
      const referralCode = sessionStorage.getItem('referral_code') || undefined;
      
      const loginResult = await siwe.login(referralCode)

      if (!loginResult.success || !loginResult.token || !loginResult.user) {
        const errorMsg = loginResult.error || "Login failed"
        setError(errorMsg)
        onError?.(errorMsg)
        toast.error(errorMsg)
        return
      }

      const { token, user, signature } = loginResult
      const isNewUser = loginResult.user.isNewUser

      // Store authentication token
      apiClient.setAuthToken(token)

      if (isNewUser) {
        // NEW USER: Generate Master Key and encrypt using signature-derived key

        // STEP 1: Generate Master Key (root of all encryption)
        const masterKey = await MetaMaskAuthService.generateMasterKey()

        // STEP 2: Cache MK in session for immediate use
        MetaMaskAuthService.cacheMasterKeyInSession(masterKey)

        // STEP 3: Encrypt Master Key with signature-derived key
        // User approves signing challenge, we derive key from signature
        const encryptedMKData = await MetaMaskAuthService.encryptMasterKeyWithWallet(
          masterKey,
          user.walletAddress
        )

        // STEP 4: Store encrypted master key locally (encrypted, so safe)
        MetaMaskAuthService.storeEncryptedMasterKeyLocally(
          encryptedMKData,
          user.walletAddress
        )

        // STEP 5: For crypto keypairs, we use the master key directly as the password seed
        const masterKeyHex = Array.from(masterKey)
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join('')

        // STEP 6: Generate all crypto keypairs using master key as password seed
        const { 
          generateAllKeypairs,
          deriveRecoveryKeyEncryptionKey,
          generateRecoveryKey,
          encryptRecoveryKey,
          encryptMasterKeyWithRecoveryKey
        } = await import("@/lib/crypto")
        
        const keypairs = await generateAllKeypairs(masterKeyHex)

        // STEP 6.5: Generate recovery key components for double-wrapped scheme
        const mnemonic = keypairs.mnemonic
        const mnemonicHash = keypairs.mnemonicHash
        
        // Derive RKEK from mnemonic
        const rkek = await deriveRecoveryKeyEncryptionKey(mnemonic)
        
        // Generate random RK
        const rk = generateRecoveryKey()
        
        // Encrypt RK with RKEK
        const recoveryKeyEncryption = encryptRecoveryKey(rk, rkek)
        const encryptedRecoveryKey = recoveryKeyEncryption.encryptedRecoveryKey
        const recoveryKeyNonce = recoveryKeyEncryption.recoveryKeyNonce
        
        // Encrypt the Master Key with the Recovery Key (for recovery without password)
        const masterKeyEncryption = encryptMasterKeyWithRecoveryKey(masterKey, rk)
        const encryptedMasterKeyForRecovery = masterKeyEncryption.encryptedMasterKey
        const masterKeyNonce = masterKeyEncryption.masterKeyNonce

        // STEP 7: Store crypto keypairs AND encrypted keys to backend
        const storeResponse = await apiClient.storeCryptoKeypairs({
          userId: user.id,
          accountSalt: keypairs.keyDerivationSalt,
          pqcKeypairs: keypairs.pqcKeypairs,
          mnemonicHash,  // Zero-knowledge recovery: only send hash
          // For MetaMask: Store wallet-encrypted master key (vault backup, not used for decryption)
          encryptedMasterKey: encryptedMKData.encryptedMasterKey,
          masterKeySalt: JSON.stringify({
            ...encryptedMKData.masterKeyMetadata,
            challengeSalt: encryptedMKData.publicKey,  // CRITICAL: Store the challenge salt for MetaMask decryption
            masterKeyNonce: masterKeyNonce  // Nonce for recovery key encryption
          }),
          // Store encrypted recovery key components
          encryptedRecoveryKey,
          recoveryKeyNonce,
          // Pass referral code if available
          referralCode: referralCode || undefined
        })

        if (!storeResponse.success) {
          throw new Error('Failed to store crypto keypairs on backend')
        }

        // Store mnemonic for backup page (same as password auth)
        localStorage.setItem('recovery_mnemonic', mnemonic)

        // STEP 8: Cache master key for session (MetaMask users can get from wallet or localStorage)
        // Use the master key directly since it's already decrypted
        const { masterKeyManager } = await import("@/lib/master-key")
        await masterKeyManager.deriveAndCacheMasterKey(
          masterKeyHex,
          keypairs.keyDerivationSalt
        )

        // STEP 9: Fetch updated profile with stored keypairs
        const profileResponse = await apiClient.getProfile()
        if (!profileResponse.success || !profileResponse.data?.user) {
          throw new Error('Failed to fetch updated user profile')
        }

        const userData = profileResponse.data.user

        // STEP 10: Initialize key manager with decrypted keypairs
        await keyManager.initialize(userData)

        toast.success("Account created successfully!")
      } else {
        // EXISTING USER: Retrieve encrypted MK from localStorage, decrypt with wallet, restore keys

        const profileResponse = await apiClient.getProfile()
        if (!profileResponse.success || !profileResponse.data?.user) {
          throw new Error('Failed to fetch user profile')
        }

        const userData = profileResponse.data.user

        // CRITICAL: For MetaMask users, restore the master key from encrypted storage
        if (userData.encryptedMasterKey) {
          try {
            // STEP 1: Try to get encrypted master key from localStorage first
            let storedEncryptedMK = MetaMaskAuthService.getEncryptedMasterKeyFromLocal(
              user.walletAddress
            )

            // STEP 1.5: If not in localStorage, fetch from backend (new device, localStorage cleared, etc.)
            if (!storedEncryptedMK) {
              console.log('Master key not in localStorage, fetching from backend...')
              
              // Extract challenge salt from backend metadata
              let challengeSalt = user.walletAddress;  // fallback to wallet address
              let version = 'v7-wallet-stored';
              
              if (userData.masterKeySalt) {
                try {
                  // masterKeySalt is stored as JSON with {version, algorithm, challengeSalt, masterKeyNonce}
                  if (typeof userData.masterKeySalt === 'string' && userData.masterKeySalt.startsWith('{')) {
                    const saltObj = JSON.parse(userData.masterKeySalt);
                    challengeSalt = saltObj.challengeSalt || user.walletAddress;
                    version = saltObj.version || 'v7-wallet-stored';
                  }
                } catch (e) {
                  console.warn('Could not parse masterKeySalt from backend:', e);
                }
              }
              
              // userData.encryptedMasterKey is the encrypted master key from the backend profile
              storedEncryptedMK = {
                encryptedMasterKey: userData.encryptedMasterKey,
                publicKey: challengeSalt,  // This is the challenge salt for MetaMask
                masterKeyMetadata: {
                  version: version,
                  algorithm: 'signature-argon2id-xchacha20poly1305',
                  createdAt: Date.now()
                }
              }
              // Store it in localStorage for next time
              MetaMaskAuthService.storeEncryptedMasterKeyLocally(
                storedEncryptedMK,
                user.walletAddress
              )
            }

            // STEP 2: Retrieve the master key from localStorage or backend (it's stored unencrypted, protected by same-origin policy)
            const decryptedMasterKey = await MetaMaskAuthService.decryptMasterKeyWithWallet(
              storedEncryptedMK.encryptedMasterKey,
              storedEncryptedMK.publicKey, // This contains the challenge salt
              storedEncryptedMK.masterKeyMetadata?.version // Pass version to determine salt strategy
            )

            // STEP 3: Cache the restored master key in session
            MetaMaskAuthService.cacheMasterKeyInSession(decryptedMasterKey)

            // STEP 4: Use master key to derive encryption for file access
            const masterKeyHex = Array.from(decryptedMasterKey)
              .map((b: number) => b.toString(16).padStart(2, '0'))
              .join('')

            // STEP 5: Cache master key for session
            const { masterKeyManager } = await import("@/lib/master-key")
            const accountSalt = userData.crypto_keypairs?.accountSalt
            if (!accountSalt) throw new Error('No account salt found')
            await masterKeyManager.deriveAndCacheMasterKey(
              masterKeyHex,
              accountSalt
            )
          } catch (keyError) {
            console.error('Failed to restore master key for returning MetaMask user:', keyError)
            throw new Error('Failed to restore encryption keys. Please try logging in again.')
          }
        } else if (userData.crypto_keypairs?.accountSalt) {
          // Fallback for users without encrypted master key (shouldn't happen for MetaMask users)
          console.warn('No encrypted master key found. This MetaMask user may not have been properly registered.')
          throw new Error('User encryption keys not properly configured')
        } else {
          console.warn('No account salt found in profile. Master key not cached.')
          throw new Error('User crypto keys not properly initialized')
        }

        // Initialize key manager with decrypted keypairs
        await keyManager.initialize(userData)
        toast.success("Login successful!")
      }

      // Call success callback
      onSuccess?.(user)

      // Track login conversion for session analytics
      const sessionId = sessionTrackingUtils.getSessionId()
      if (sessionId) {
        sessionTrackingUtils.trackConversion(sessionId, 'login', user.id)
      }

      // Clear session tracking after successful login
      sessionTrackingUtils.clearSession()

      // Redirect to main drive page
      router.push("/")

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred"
      console.error("SIWE login error:", errorMsg)

      // For user rejection, only show toast (not error box)
      if (errorMsg === "User rejected signature request") {
        toast.error("Signature request cancelled", {
          description: "Please try again if you want to sign in with MetaMask"
        })
        return
      }

      // For other errors, show both error box and toast
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
        type="button"
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 507.83 470.86" className="mr-2 h-4 w-4">
              <defs>
                <style>{`.a{fill:#e2761b;stroke:#e2761b;}.a,.b,.c,.d,.e,.f,.g,.h,.i,.j{stroke-linecap:round;stroke-linejoin:round;}.b{fill:#e4761b;stroke:#e4761b;}.c{fill:#d7c1b3;stroke:#d7c1b3;}.d{fill:#233447;stroke:#233447;}.e{fill:#cd6116;stroke:#cd6116;}.f{fill:#e4751f;stroke:#e4751f;}.g{fill:#f6851b;stroke:#f6851b;}.h{fill:#c0ad9e;stroke:#c0ad9e;}.i{fill:#161616;stroke:#161616;}.j{fill:#763d16;stroke:#763d16;}`}</style>
              </defs>
              <title>metamask</title>
              <polygon className="a" points="482.09 0.5 284.32 147.38 320.9 60.72 482.09 0.5"/>
              <polygon className="b" points="25.54 0.5 221.72 148.77 186.93 60.72 25.54 0.5"/>
              <polygon className="b" points="410.93 340.97 358.26 421.67 470.96 452.67 503.36 342.76 410.93 340.97"/>
              <polygon className="b" points="4.67 342.76 36.87 452.67 149.57 421.67 96.9 340.97 4.67 342.76"/>
              <polygon className="b" points="143.21 204.62 111.8 252.13 223.7 257.1 219.73 136.85 143.21 204.62"/>
              <polygon className="b" points="364.42 204.62 286.91 135.46 284.32 257.1 396.03 252.13 364.42 204.62"/>
              <polygon className="b" points="149.57 421.67 216.75 388.87 158.71 343.55 149.57 421.67"/>
              <polygon className="b" points="290.88 388.87 358.26 421.67 348.92 343.55 290.88 388.87"/>
              <polygon className="c" points="358.26 421.67 290.88 388.87 296.25 432.8 295.65 451.28 358.26 421.67"/>
              <polygon className="c" points="149.57 421.67 212.18 451.28 211.78 432.8 216.75 388.87 149.57 421.67"/>
              <polygon className="d" points="213.17 314.54 157.12 298.04 196.67 279.95 213.17 314.54"/>
              <polygon className="d" points="294.46 314.54 310.96 279.95 350.71 298.04 294.46 314.54"/>
              <polygon className="e" points="149.57 421.67 159.11 340.97 96.9 342.76 149.57 421.67"/>
              <polygon className="e" points="348.72 340.97 358.26 421.67 410.93 342.76 348.72 340.97"/>
              <polygon className="e" points="396.03 252.13 284.32 257.1 294.66 314.54 311.16 279.95 350.91 298.04 396.03 252.13"/>
              <polygon className="e" points="157.12 298.04 196.87 279.95 213.17 314.54 223.7 257.1 111.8 252.13 157.12 298.04"/>
              <polygon className="f" points="111.8 252.13 158.71 343.55 157.12 298.04 111.8 252.13"/>
              <polygon className="f" points="350.91 298.04 348.92 343.55 396.03 252.13 350.91 298.04"/>
              <polygon className="f" points="223.7 257.1 213.17 314.54 226.29 382.31 229.27 293.07 223.7 257.1"/>
              <polygon className="f" points="284.32 257.1 278.96 292.87 281.34 382.31 294.66 314.54 284.32 257.1"/>
              <polygon className="g" points="294.66 314.54 281.34 382.31 290.88 388.87 348.92 343.55 350.91 298.04 294.66 314.54"/>
              <polygon className="g" points="157.12 298.04 158.71 343.55 216.75 388.87 226.29 382.31 213.17 314.54 157.12 298.04"/>
              <polygon className="h" points="295.65 451.28 296.25 432.8 291.28 428.42 216.35 428.42 211.78 432.8 212.18 451.28 149.57 421.67 171.43 439.55 215.75 470.36 291.88 470.36 336.4 439.55 358.26 421.67 295.65 451.28"/>
              <polygon className="i" points="290.88 388.87 281.34 382.31 226.29 382.31 216.75 388.87 211.78 432.8 216.35 428.42 291.28 428.42 296.25 432.8 290.88 388.87"/>
              <polygon className="j" points="490.44 156.92 507.33 75.83 482.09 0.5 290.88 142.41 364.42 204.62 468.37 235.03 491.43 208.2 481.49 201.05 497.39 186.54 485.07 177 500.97 164.87 490.44 156.92"/>
              <polygon className="j" points="0.5 75.83 17.39 156.92 6.66 164.87 22.56 177 10.44 186.54 26.34 201.05 16.4 208.2 39.26 235.03 143.21 204.62 216.75 142.41 25.54 0.5 0.5 75.83"/>
              <polygon className="g" points="468.37 235.03 364.42 204.62 396.03 252.13 348.92 343.55 410.93 342.76 503.36 342.76 468.37 235.03"/>
              <polygon className="g" points="143.21 204.62 39.26 235.03 4.67 342.76 96.9 342.76 158.71 343.55 111.8 252.13 143.21 204.62"/>
              <polygon className="g" points="284.32 257.1 290.88 142.41 321.1 60.72 186.93 60.72 216.75 142.41 223.7 257.1 226.09 293.27 226.29 382.31 281.34 382.31 281.74 293.27 284.32 257.1"/>
            </svg>
                        {context === 'register' ? 'Register with MetaMask' : 'Login with MetaMask'}
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

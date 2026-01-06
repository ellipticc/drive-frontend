"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api"
import { IconLoader2 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export function RecoverForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  // Keep email separately, but manage mnemonic via words array
  const [email, setEmail] = useState("")
  const [words, setWords] = useState<string[]>(Array(12).fill(""))

  // Refs for the 12 inputs to handle navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Load wordlist for validation
  const [validWordlist, setValidWordlist] = useState<string[]>([])

  useEffect(() => {
    // Dynamic import to avoid SSR issues if any, or just standard import
    import('@scure/bip39/wordlists/english.js').then(module => {
      setValidWordlist(module.wordlist)
    }).catch(err => {
      console.error("Failed to load wordlist", err)
    })
  }, [])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setError("")
  }

  // Handle individual word changes
  const handleWordChange = (index: number, value: string) => {
    setError("")

    // Check if user pasted a full phrase
    if (value.includes(" ") || value.split(/\s+/).length > 1) {
      handlePaste(index, value)
      return
    }

    const trimmedValue = value.toLowerCase().trim()
    const newWords = [...words]
    newWords[index] = trimmedValue
    setWords(newWords)

    // Auto-advance if valid word is typed (PERFECT match)
    if (validWordlist.includes(trimmedValue) && index < 11) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (startIndex: number, text: string) => {
    const pastedWords = text.trim().split(/\s+/).map(w => w.toLowerCase().trim()).filter(Boolean)
    if (pastedWords.length === 0) return

    const newWords = [...words]
    pastedWords.forEach((word, i) => {
      if (startIndex + i < 12) {
        newWords[startIndex + i] = word
      }
    })
    setWords(newWords)

    // Focus end of pasted sequence
    const nextIndex = Math.min(startIndex + pastedWords.length, 11)
    inputRefs.current[nextIndex]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      // Use current value to validate?
      // Just move next if not empty
      if (words[index].length > 0) {
        if (index < 11) {
          inputRefs.current[index + 1]?.focus()
        } else {
          // Last word, maybe submit?
          // inputRefs.current[index]?.blur()
        }
      }
    } else if (e.key === "Backspace" && words[index] === "") {
      // Move to previous if empty
      e.preventDefault()
      if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
  }

  // Check valid status
  const isWordValid = (word: string) => {
    if (!validWordlist.length || !word) return null // null = neutral
    return validWordlist.includes(word)
  }

  // Hash the mnemonic using SHA256 (client-side only, never sent raw)
  const hashMnemonic = async (mnemonic: string): Promise<string> => {
    const normalized = mnemonic.trim().toLowerCase()
    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  const handleMnemonicSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const mnemonic = words.join(" ").trim()

    try {
      // Validate inputs
      if (!email || !mnemonic) {
        setError("Please enter both email and recovery phrase")
        setIsLoading(false)
        return
      }

      // Check empty words
      if (words.some(w => !w)) {
        setError("Please fill in all 12 words")
        setIsLoading(false)
        return
      }

      // Validate mnemonic format
      const wordListToCheck = mnemonic.split(/\s+/)
      if (wordListToCheck.length !== 12) {
        setError("Recovery phrase must contain exactly 12 words")
        setIsLoading(false)
        return
      }

      // Validate against wordlist if loaded
      // Strict validation: Do not allow submission if ANY word is invalid
      if (validWordlist.length > 0) {
        const invalidWords = words.filter(w => !validWordlist.includes(w))
        if (invalidWords.length > 0) {
          setError(`Invalid words detected: ${invalidWords.join(", ")}`)
          setIsLoading(false)
          return
        }
      }

      // Check if recovery is available for this account
      const recoveryCheck = await apiClient.initiateRecovery(email)

      if (!recoveryCheck.success) {
        setError("No account found with this email address")
        setIsLoading(false)
        return
      }

      if (!recoveryCheck.data?.hasRecovery) {
        setError("No recovery data found for this account. Please contact support.")
        setIsLoading(false)
        return
      }

      // Hash mnemonic for secure transmission (never send raw mnemonic)
      const mnemonicHash = await hashMnemonic(mnemonic)

      // Store mnemonic hash in sessionStorage temporarily for password reset
      // The raw mnemonic is kept in memory (formData) for key derivation later
      sessionStorage.setItem('recovery_mnemonic', mnemonic.toLowerCase())
      sessionStorage.setItem('recovery_hash', mnemonicHash)

      // Proceed to OTP verification with hashed mnemonic
      handleOTPVerification(mnemonicHash)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPVerification = (mnemonicHash: string) => {
    // Redirect to OTP verification page with email and mnemonic hash (NOT raw mnemonic)
    // Raw mnemonic is stored in sessionStorage for key derivation
    router.push(`/recover/otp?email=${encodeURIComponent(email)}&hash=${encodeURIComponent(mnemonicHash)}`)
  }

  return (
    <form onSubmit={handleMnemonicSubmit} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email Address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            disabled={isLoading}
          />
        </Field>

        <Field>
          <FieldLabel className="mb-2 block">Recovery Phrase</FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            {words.map((word, index) => {
              const isValid = isWordValid(word)
              return (
                <div key={index} className="relative group">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/50 select-none pointer-events-none transition-colors duration-200 group-focus-within:text-primary/70">
                    {index + 1}.
                  </span>
                  <Input
                    ref={el => { inputRefs.current[index] = el }}
                    type="text"
                    value={word}
                    onChange={(e) => handleWordChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={isLoading}
                    className={cn(
                      "pl-6 pr-2 h-10 text-sm font-medium transition-all duration-200 ease-in-out border border-input/50 bg-secondary/20",
                      "focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
                      word.length > 0 && isValid === true && "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/5",
                      word.length > 0 && isValid === false && "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/5"
                    )}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {/* Validation Indicator (Dot only) */}
                  <div className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 scale-0 opacity-0",
                    word.length > 0 && "scale-100 opacity-100"
                  )}>
                    {isValid === true ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500/80 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                    ) : isValid === false ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <FieldDescription className="mt-2 text-center text-xs">
            Enter the 12 words from your recovery phrase directly into the grid
          </FieldDescription>
        </Field>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex gap-2 justify-center">
            <div>{error}</div>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full h-11 text-base shadow-lg hover:shadow-xl transition-all">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <IconLoader2 className="animate-spin w-4 h-4" /> Verifying...
            </span>
          ) : "Continue Recovery"}
        </Button>
      </FieldGroup>
    </form>
  )
}

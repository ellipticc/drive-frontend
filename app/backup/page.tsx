"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckCircle, Copy, Eye, EyeOff, Shield, AlertTriangle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function BackupPage() {
  const router = useRouter()
  const [mnemonic, setMnemonic] = useState("")
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    document.title = "Backup Recovery Phrase - Ellipticc Drive"
    
    // Get mnemonic from localStorage
    const storedMnemonic = localStorage.getItem('recovery_mnemonic')
    if (!storedMnemonic) {
      // Redirect to signup if no mnemonic
      router.push('/signup')
      return
    }
    setMnemonic(storedMnemonic)
  }, [router])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // // console.error('Failed to copy:', err)
    }
  }

  const handleConfirm = () => {
    setConfirmed(true)
    // Clear mnemonic from localStorage for security
    localStorage.removeItem('recovery_mnemonic')
    // Navigate to main page
    router.push('/')
  }

  if (!mnemonic) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold">Secure Your Account</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Your recovery phrase is the master key to your account. Store it safely - this is the only way to recover access if you lose your password.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Warning Alert */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-destructive">Critical Security Information</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Write down these 12 words in the exact order shown</li>
                  <li>• Store them in a secure, offline location (safe, paper, etc.)</li>
                  <li>• Never share them with anyone or store them online</li>
                  <li>• Without this phrase, your account cannot be recovered</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Recovery Phrase Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Your Recovery Phrase
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="gap-2"
                >
                  {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showMnemonic ? "Hide" : "Reveal"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!showMnemonic}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 p-6 rounded-lg border-2 border-dashed border-muted-foreground/25">
              {showMnemonic ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {mnemonic.split(' ').map((word, index) => (
                    <div key={index} className="bg-background p-3 rounded-md border shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-6">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        <span className="font-mono font-medium">{word}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">Recovery phrase is hidden</p>
                  <p className="text-sm text-muted-foreground">Click "Reveal" to show your 12-word recovery phrase</p>
                </div>
              )}
            </div>
          </div>

          {/* Security Checklist */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Write it down</p>
                <p className="text-sm text-green-700 dark:text-green-300">Use pen and paper, not digital</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Keep it safe</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Store in a secure location</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">Test recovery</p>
                <p className="text-sm text-orange-700 dark:text-orange-300">Verify you can recover access</p>
              </div>
            </div>
          </div>

          {/* Confirmation */}
          <div className="space-y-4 pt-6 border-t">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="confirm-backup"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <label htmlFor="confirm-backup" className="text-sm leading-relaxed">
                <strong>I understand:</strong> I have securely stored my recovery phrase and accept that losing it means permanent loss of account access. I will never share it with anyone.
              </label>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={!confirmed}
              className="w-full h-12 text-lg font-medium"
              size="lg"
            >
              I've Securely Stored My Recovery Phrase
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              You can change your password later, but this recovery phrase will always work to regain access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

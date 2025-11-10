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
import { Copy, Eye, EyeOff, AlertTriangle, Download } from "lucide-react"
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
      console.error('Failed to copy:', err)
    }
  }

  const downloadAsText = () => {
    const element = document.createElement('a')
    const timestamp = Date.now()
    const randomHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    const file = new Blob([mnemonic], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `recovery-phrase-${randomHex}-${timestamp}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
  }

  const handleConfirm = () => {
    if (!confirmed) return
    // Clear mnemonic from localStorage for security
    localStorage.removeItem('recovery_mnemonic')
    // Navigate to main page
    router.push('/')
  }

  if (!mnemonic) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Save Your Recovery Phrase</CardTitle>
          <CardDescription className="mt-2">
            Write down these 12 words in order. You'll need them to recover your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Warning */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive mb-1">Important:</p>
              <p className="text-muted-foreground">Never share these words. Without them, you cannot recover your account.</p>
            </div>
          </div>

          {/* Recovery Phrase Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Your Recovery Phrase</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="h-8 px-3 text-xs"
                >
                  {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!showMnemonic}
                  className="h-8 px-3 text-xs"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadAsText}
                  disabled={!showMnemonic}
                  className="h-8 px-3 text-xs"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg border min-h-[240px] flex items-center justify-center">
              {showMnemonic ? (
                <div className="grid grid-cols-3 gap-2 w-full">
                  {mnemonic.split(' ').map((word, index) => (
                    <div key={index} className="text-sm bg-background p-2 rounded border text-center">
                      <span className="text-xs text-muted-foreground block">{index + 1}</span>
                      <span className="font-mono font-medium">{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click "Show" to reveal your phrase</p>
                </div>
              )}
            </div>
          </div>

          {/* Confirmation */}
          <div className="space-y-4 pt-4 border-t">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">
                I have securely stored my recovery phrase and understand I need it to recover my account
              </span>
            </label>

            <Button
              onClick={handleConfirm}
              disabled={!confirmed}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

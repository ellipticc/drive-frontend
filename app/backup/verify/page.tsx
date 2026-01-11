"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { apiClient } from "@/lib/api"
import { IconLoader2, IconArrowLeft, IconCaretLeftRightFilled, IconDice5 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/theme-toggle"

export default function VerifyBackupPage() {
    const router = useRouter()
    const [words, setWords] = useState<string[]>(Array(12).fill(""))
    const [missingIndices, setMissingIndices] = useState<Set<number>>(new Set())
    const [isLoading, setIsLoading] = useState(false)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])
    const [originalMnemonic, setOriginalMnemonic] = useState<string>("")

    useEffect(() => {
        // 1. Check for mnemonic
        const mnemonic = localStorage.getItem('recovery_mnemonic')
        if (!mnemonic) {
            router.replace('/backup')
            return
        }
        setOriginalMnemonic(mnemonic)

        // 2. Initialize Puzzle
        const allWords = mnemonic.split(' ')
        if (allWords.length !== 12) {
            // Invalid mnemonic state
            router.replace('/backup')
            return
        }

        // Pick 3 or 4 random indices to hide
        const indicesToHide = new Set<number>()
        const countToHide = Math.random() > 0.5 ? 3 : 4

        while (indicesToHide.size < countToHide) {
            const idx = Math.floor(Math.random() * 12)
            indicesToHide.add(idx)
        }
        setMissingIndices(indicesToHide)

        // Pre-fill visible words
        const initialWords = allWords.map((word, index) =>
            indicesToHide.has(index) ? "" : word
        )
        setWords(initialWords)

        // Focus first missing index
        // Use timeout to wait for render
        setTimeout(() => {
            const firstMissing = Array.from(indicesToHide).sort((a, b) => a - b)[0]
            inputRefs.current[firstMissing]?.focus()
        }, 100)

    }, [router])

    const handleWordChange = (index: number, value: string) => {
        // Only allow changing missing indices (extra safety, though input is disabled otherwise)
        if (!missingIndices.has(index)) return

        const newWords = [...words]
        newWords[index] = value.toLowerCase().trim()
        setWords(newWords)

    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            // Jump to next MISSING index
            const sortedMissing = Array.from(missingIndices).sort((a, b) => a - b)
            const currentPos = sortedMissing.indexOf(index)
            if (currentPos !== -1 && currentPos < sortedMissing.length - 1) {
                const nextIndex = sortedMissing[currentPos + 1]
                inputRefs.current[nextIndex]?.focus()
            }
        } else if (e.key === "Backspace" && words[index] === "") {
            // Move to previous MISSING index
            const sortedMissing = Array.from(missingIndices).sort((a, b) => a - b)
            const currentPos = sortedMissing.indexOf(index)
            if (currentPos > 0) {
                const prevIndex = sortedMissing[currentPos - 1]
                inputRefs.current[prevIndex]?.focus()
            }
        }
    }

    const handleVerify = async () => {
        setIsLoading(true)
        try {
            const enteredMnemonic = words.join(" ")
            if (enteredMnemonic !== originalMnemonic) {
                toast.error("Incorrect words. Please check your recovery phrase.")
                setIsLoading(false)
                return
            }

            // Clear mnemonic for security
            localStorage.removeItem('recovery_mnemonic')

            // Track verification success
            await apiClient.trackBackupVerified()

            // Handle redirect
            const redirectUrl = sessionStorage.getItem('login_redirect_url');
            if (redirectUrl) {
                sessionStorage.removeItem('login_redirect_url');
                window.location.href = redirectUrl;
            } else {
                router.push('/')
            }
            toast.success("Backup verified successfully!")
        } catch (error) {
            console.error("Verification failed", error)
            toast.error("Failed to verify. Please try again.")
            setIsLoading(false)
        }
    }

    const shufflePuzzle = () => {
        if (!originalMnemonic) return
        const allWords = originalMnemonic.split(' ')
        const indicesToHide = new Set<number>()
        const countToHide = Math.random() > 0.5 ? 3 : 4

        while (indicesToHide.size < countToHide) {
            const idx = Math.floor(Math.random() * 12)
            indicesToHide.add(idx)
        }
        setMissingIndices(indicesToHide)
        const newWords = allWords.map((word, index) =>
            indicesToHide.has(index) ? "" : word
        )
        setWords(newWords)

        setTimeout(() => {
            const firstMissing = Array.from(indicesToHide).sort((a, b) => a - b)[0]
            inputRefs.current[firstMissing]?.focus()
        }, 100)

        toast.info("Puzzle shuffled")
    }

    return (
        <div className="min-h-screen bg-muted flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements for premium feel */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
            </div>

            <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 font-medium no-underline border-none bg-transparent hover:bg-transparent focus:outline-none group">
                    <IconCaretLeftRightFilled className="!size-6 text-primary transition-transform group-hover:rotate-12" />
                    <span className="text-lg font-geist-mono select-none tracking-tighter">ellipticc</span>
                </Link>
            </div>

            <div className="absolute top-6 right-6 z-10">
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-border/40 backdrop-blur-sm bg-background/80 z-10 transition-all duration-300">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="flex justify-between items-center w-full px-1">
                        <Link href="/backup" className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-all duration-200">
                            <IconArrowLeft className="w-5 h-5" />
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={shufflePuzzle}
                            className="text-muted-foreground hover:text-primary transition-all duration-300 hover:rotate-45 active:scale-90"
                            title="Shuffle hidden words"
                        >
                            <IconDice5 className="w-5 h-5" />
                        </Button>
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-extrabold tracking-tight">Verify Recovery Phrase</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Type the missing words to confirm your backup.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                    <div className="grid grid-cols-3 gap-3">
                        {words.map((word, index) => {
                            const isMissing = missingIndices.has(index)
                            const isFilled = word.length > 0
                            const isCorrect = isMissing && isFilled ? word === originalMnemonic.split(' ')[index] : null

                            return (
                                <div key={index} className="relative group perspective-1000">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/50 select-none pointer-events-none transition-colors duration-200 group-focus-within:text-primary/70 z-10">
                                        {String(index + 1).padStart(2, '0')}.
                                    </span>
                                    <Input
                                        ref={el => { inputRefs.current[index] = el }}
                                        type="text"
                                        value={word}
                                        onChange={(e) => handleWordChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        disabled={isLoading || !isMissing}
                                        className={cn(
                                            "pl-7 pr-2 h-10 text-sm font-medium transition-all duration-200 ease-in-out border border-input/50 shadow-sm",
                                            !isMissing
                                                ? "bg-muted/30 text-muted-foreground/70 border-transparent select-none cursor-default opacity-80"
                                                : "bg-secondary/20 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
                                            isMissing && isFilled && isCorrect === true && "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/5",
                                            isMissing && isFilled && isCorrect === false && "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/5"
                                        )}
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        placeholder={isMissing ? "..." : ""}
                                    />
                                    {isMissing && (
                                        <div className={cn(
                                            "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 scale-0 opacity-0",
                                            isFilled && "scale-100 opacity-100"
                                        )}>
                                            {isCorrect === true ? (
                                                <div className="h-1.5 w-1.5 rounded-full bg-green-500/80 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                                            ) : isCorrect === false ? (
                                                <div className="h-1.5 w-1.5 rounded-full bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="pt-2">
                        <Button
                            onClick={handleVerify}
                            disabled={isLoading || words.some(w => !w)}
                            className="w-full h-11 text-base shadow-lg hover:shadow-xl transition-all"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <IconLoader2 className="animate-spin w-4 h-4" /> Verifying Security...
                                </span>
                            ) : "Verify & Finish"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

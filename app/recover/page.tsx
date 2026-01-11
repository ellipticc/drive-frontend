"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldDescription } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { RecoverFormClient } from "@/components/auth/recover-form-client"
import { IconCaretLeftRightFilled, IconArrowLeft } from "@tabler/icons-react"

export default function RecoverPage() {
  const router = useRouter()

  useEffect(() => {
    document.title = "Recover Account - Ellipticc Drive"
  }, [])

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="absolute top-4 left-4">
        <Button
          onClick={() => router.push('/login')}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Login
        </Button>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="#" className="flex items-center gap-2 self-center font-medium">
          <IconCaretLeftRightFilled className="!size-5" />
          <span className="text-base font-geist-mono select-none break-all">ellipticc</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Recover Your Account</CardTitle>
            <CardDescription>
              Enter your email and recovery phrase to set a new password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RecoverFormClient />
            <FieldDescription className="px-6 text-center">
              By clicking continue, you agree to our{" "}
              <Link href="/terms-of-service" className="underline underline-offset-4 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="underline underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              .
            </FieldDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

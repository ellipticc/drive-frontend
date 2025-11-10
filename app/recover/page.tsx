"use client"

import { useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { RecoverFormClient } from "@/components/auth/recover-form-client"
import { IconCaretLeftRightFilled } from "@tabler/icons-react"

export default function RecoverPage() {
  useEffect(() => {
    document.title = "Recover Account - Ellipticc Drive"
  }, [])

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <IconCaretLeftRightFilled className="!size-5" />
          </div>
          <span className="text-base font-mono break-all">ellipticc</span>
        </a>
        
        <Card>
          <CardHeader>
            <CardTitle>Recover Your Account</CardTitle>
            <CardDescription>
              Enter your email and recovery phrase to set a new password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecoverFormClient />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

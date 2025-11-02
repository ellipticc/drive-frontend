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

export default function RecoverPage() {
  useEffect(() => {
    document.title = "Recover Account - Ellipticc Drive"
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Recover Your Account
          </CardTitle>
          <CardDescription>
            Enter your email and recovery phrase to regain access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecoverFormClient />
        </CardContent>
      </Card>
    </div>
  )
}

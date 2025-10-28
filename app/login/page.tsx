import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Login - Ellipticc Drive",
}

export default function LoginPage() {
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
        <LoginForm />
      </div>
    </div>
  )
}

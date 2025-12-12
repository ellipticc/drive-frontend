import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"

import { ThemeToggle } from "@/components/theme-toggle"
import { LoginFormAuth } from "@/components/auth/login-form-auth"

export const metadata: Metadata = {
  title: "Login - Ellipticc Drive",
}

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Image on left side */}
      <div className="bg-muted relative hidden lg:flex lg:flex-col lg:items-center lg:justify-center order-first lg:order-first">
        <img
          src="/placeholder.svg"
          alt="Image"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
      {/* Form on right side */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <a href="#" className="flex items-center gap-2 font-medium">
            <IconCaretLeftRightFilled className="!size-5" />
            <span className="text-base font-mono break-all">ellipticc</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginFormAuth />
          </div>
        </div>
      </div>
    </div>
  )
}

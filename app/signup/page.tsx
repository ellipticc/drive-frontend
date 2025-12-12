import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"

import { ThemeToggle } from "@/components/theme-toggle"
import { SignupFormAuth } from "@/components/auth/signup-form-auth"

export const metadata: Metadata = {
  title: "Register - Ellipticc Drive",
}

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-medium">
            <IconCaretLeftRightFilled className="!size-5" />
            <span className="text-base font-mono break-all">ellipticc</span>
          </a>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupFormAuth />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
        <img
          src="/placeholder.svg"
          alt="Image"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

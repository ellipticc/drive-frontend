import Link from "next/link"
import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"

import { OTPForm } from "@/components/auth/otp-form"
import { FieldDescription } from "@/components/ui/field"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Verify Email - Ellipticc Drive",
}

export default function OTPPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <IconCaretLeftRightFilled className="!size-5" />
          <span className="text-base font-mono break-all">ellipticc</span>
        </a>
        <OTPForm />
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
      </div>
    </div>
  )
}

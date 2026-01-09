import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"
import Link from "next/link"

import { TOTPRecoveryForm } from "@/components/auth/totp-recovery-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { TOTPPageGuard } from "@/components/auth/totp-page-guard"

export const metadata: Metadata = {
  title: "Recovery Code - Ellipticc Drive",
}

export default function TOTPRecoveryPage() {
  return (
    <TOTPPageGuard>
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link href="/login" className="flex items-center gap-2 self-center font-medium">
            <IconCaretLeftRightFilled className="!size-5" />
            <span className="text-base font-geist-mono break-all">ellipticc</span>
          </Link>
          <TOTPRecoveryForm />
        </div>
      </div>
    </TOTPPageGuard>
  )
}
import type { Metadata } from "next"
import { PrivacyPolicyContent } from "@/components/pages/privacy-policy-content"

export const metadata: Metadata = {
  title: "Privacy Policy - Ellipticc Drive",
  description: "Learn how Ellipticc Drive collects, uses, and protects your personal information and data.",
}

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />
}

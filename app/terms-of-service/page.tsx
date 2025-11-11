import type { Metadata } from "next"
import { TermsOfServiceContent } from "@/components/pages/terms-of-service-content"

export const metadata: Metadata = {
  title: "Terms of Service - Ellipticc Drive",
  description: "Read our Terms of Service to understand the rules and guidelines for using Ellipticc Drive.",
}

export default function TermsOfServicePage() {
  return <TermsOfServiceContent />
}

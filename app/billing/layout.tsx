import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing & Plans - Ellipticc Drive",
  description: "Choose your perfect storage plan with transparent, flexible pricing. No hidden fees.",
};

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { UserProvider } from "@/components/user-context";
import { GlobalUploadProvider } from "@/components/global-upload-context";
import { CurrentFolderProvider } from "@/components/current-folder-context";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  description: "Secure file storage and collaboration platform",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <CurrentFolderProvider>
            <GlobalUploadProvider>
              <UserProvider>
                <AuthGuard>
                  <ConditionalLayout>{children}</ConditionalLayout>
                </AuthGuard>
                <Toaster
                  position="bottom-right"
                  richColors
                  duration={5000}
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                  }}
                />
              </UserProvider>
            </GlobalUploadProvider>
          </CurrentFolderProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

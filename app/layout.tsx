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
  title: {
    default: "Ellipticc Drive - Secure, Encrypted File Storage",
    template: "%s | Ellipticc Drive"
  },
  description: "Secure, end-to-end encrypted file storage and collaboration platform. Keep your files private with military-grade encryption and zero-knowledge architecture.",
  keywords: ["encrypted file storage", "secure cloud storage", "zero-knowledge encryption", "privacy-focused", "file sharing", "end-to-end encryption"],
  authors: [{ name: "Ellipticc" }],
  creator: "Ellipticc",
  publisher: "Ellipticc",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://ellipticc.com'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Ellipticc Drive - Secure, Encrypted File Storage',
    description: 'Secure, end-to-end encrypted file storage and collaboration platform. Keep your files private with military-grade encryption.',
    siteName: 'Ellipticc Drive',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Ellipticc Drive - Secure File Storage',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ellipticc Drive - Secure, Encrypted File Storage',
    description: 'Secure, end-to-end encrypted file storage and collaboration platform.',
    images: ['/og-image.svg'],
    creator: '@ellipticc',
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ellipticc.com'

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Ellipticc Drive",
    "description": "Secure, end-to-end encrypted file storage and collaboration platform",
    "url": baseUrl,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Organization",
      "name": "Ellipticc",
      "url": baseUrl
    },
    "featureList": [
      "End-to-end encryption",
      "Zero-knowledge architecture",
      "Secure file sharing",
      "Military-grade security",
      "Privacy-focused design"
    ]
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        {/* Google Analytics 4 */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-NSQ52X2GM3"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-NSQ52X2GM3');
            `,
          }}
        />
      </head>
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

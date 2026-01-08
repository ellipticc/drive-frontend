import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { UserProvider } from "@/components/user-context";
import { GlobalUploadProvider } from "@/components/global-upload-context";
import { CurrentFolderProvider } from "@/components/current-folder-context";
import { BillingProvider } from "@/components/billing-context";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
import { SessionPingProvider } from "@/components/session-ping-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { ThemeConfiguration } from "@/components/theme-configuration";
import "./globals.css";

// Font definitions
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
  keywords: ["encrypted file storage", "secure cloud storage", "zero-knowledge encryption", "privacy-focused", "file sharing", "end-to-end encryption", "secure collaboration", "military-grade security"],
  authors: [{ name: "Ellipticc" }],
  creator: "Ellipticc",
  publisher: "Ellipticc",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://drive.ellipticc.com'),
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
    description: 'Secure, end-to-end encrypted file storage and collaboration platform. Keep your files private with military-grade encryption and zero-knowledge architecture.',
    siteName: 'Ellipticc Drive',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Ellipticc Drive - Secure File Storage',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ellipticc Drive - Secure, Encrypted File Storage',
    description: 'Secure, end-to-end encrypted file storage and collaboration platform. Keep your files private with military-grade encryption.',
    images: ['/og-image.png'],
    creator: '@ellipticc',
    site: '@ellipticc',
  },
  other: {
    'og:image:secure_url': `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ellipticc.com'}/og-image.png`,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': 'Ellipticc Drive - Secure File Storage',
    'og:type': 'website',
    'og:site_name': 'Ellipticc Drive',
    'og:locale': 'en_US',
    'twitter:image:alt': 'Ellipticc Drive - Secure File Storage',
    'twitter:card': 'summary_large_image',
    'twitter:site': '@ellipticc',
    'twitter:creator': '@ellipticc',
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
  category: 'technology',
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
        {/* Primary Meta Tags */}
        <meta name="title" content="Ellipticc Drive - Secure, Encrypted File Storage" />
        <meta name="description" content="Secure, end-to-end encrypted file storage and collaboration platform. Keep your files private with military-grade encryption and zero-knowledge architecture." />
        <meta name="keywords" content="encrypted file storage, secure cloud storage, zero-knowledge encryption, privacy-focused, file sharing, end-to-end encryption, secure collaboration, military-grade security" />
        <meta name="author" content="Ellipticc" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />
        <meta name="theme-color" content="#000000" />

        {/* Security & Performance */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />

        {/* Mobile Optimization */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Ellipticc Drive" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-NSQ52X2GM3"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
        >
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-NSQ52X2GM3');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var cookie = document.cookie.split('; ').find(row => row.startsWith('appearance_theme='));
                  if (cookie) {
                    var theme = cookie.split('=')[1];
                    if (theme && theme !== 'default') {
                      document.documentElement.classList.add(theme);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AuthGuard>
            <NotificationProvider>
              <CurrentFolderProvider>
                <UserProvider>
                  <BillingProvider>
                    <LanguageProvider>
                      <GlobalUploadProvider>
                        <ThemeConfiguration />
                        <SessionPingProvider />
                        <ConditionalLayout>{children}</ConditionalLayout>
                        <Toaster
                          position="bottom-right"
                          richColors
                          duration={5000}
                          style={{
                            fontFamily: 'var(--font-geist-sans)',
                          }}
                        />
                      </GlobalUploadProvider>
                    </LanguageProvider>
                  </BillingProvider>
                </UserProvider>
              </CurrentFolderProvider>
            </NotificationProvider>
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}

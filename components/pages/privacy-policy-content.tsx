"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { IconArrowLeft, IconCaretLeftRightFilled } from "@tabler/icons-react"

export function PrivacyPolicyContent() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <IconArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
          <div className="flex-1 flex justify-center">
            <Link href="/" className="flex items-center gap-2 font-medium">
              <div className="flex size-6 items-center justify-center rounded-md">
                <IconCaretLeftRightFilled className="!size-5" />
              </div>
              <span className="text-base font-mono">ellipticc</span>
            </Link>
          </div>
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
          {/* Page Header */}
          <div className="mb-12 space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground">
              Last updated: November 11, 2025
            </p>
            <p className="text-base text-muted-foreground">
              We are committed to protecting your privacy. Learn how we collect, use, and safeguard your information.
            </p>
          </div>

          {/* Content Sections */}
          <div className="space-y-8 text-foreground prose prose-sm dark:prose-invert max-w-none">
            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Introduction</h2>
              <p className="text-base leading-relaxed">
                Ellipticc (&quot;we,&quot; &quot;us,&quot; &quot;our,&quot; or &quot;Company&quot;) is an end-to-end encrypted (E2EE), post-quantum cryptography (PQC), zero-knowledge cloud storage service. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
              </p>
              <p className="text-base leading-relaxed">
                <strong>Key Privacy Principle:</strong> We are designed to have zero knowledge of your file contents, filenames, or encryption keys. All encryption and decryption occur exclusively on your device, and we cannot access or decrypt any of your data, even if legally required.
              </p>
              <p className="text-base leading-relaxed">
                Please read this Privacy Policy carefully. By accessing and using the Service, you acknowledge that you have read and understand this Privacy Policy.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">2.1 Information You Provide Directly</h3>
                  <p className="text-base leading-relaxed">
                    When you create an account, we collect your name and email address. During registration, your password is never sent to or stored by our servers — not even as a hash. Instead, a cryptographic record derived from your password (created using the <a href="https://csrc.nist.gov/csrc/media/presentations/2024/crclub-2024-10-16/images-media/crypto-club-20241016--hugo--OPAQUE.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">OPAQUE</a> protocol) is securely stored to allow future authentication without revealing or retaining the actual password. For paid accounts, we also collect your billing address and payment information through secure payment processors. These are the only identifying personal details we collect.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">2.2 User-Generated Content (Zero Knowledge)</h3>
                  <p className="text-base leading-relaxed">
                    You can upload files, documents, folders, and other content to the Service. However, <strong>Ellipticc has zero access to your content.</strong> Here&apos;s why:
                  </p>
                  <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                    <li><strong>All encryption occurs on your device</strong> before any data is transmitted to our servers.</li>
                    <li><strong>Your filenames are encrypted</strong> on your device; we never see them in plain text.</li>
                    <li><strong>Your encryption keys never leave your device</strong> — we cannot decrypt your files.</li>
                    <li><strong>All decryption occurs on your device</strong> when you access your files.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">2.3 Limited Metadata (Non-Identifying)</h3>
                  <p className="text-base leading-relaxed">
                    We automatically collect only the following non-identifying metadata for technical and operational purposes:
                  </p>
                  <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                    <li><strong>File type:</strong> Used to display files correctly in your interface.</li>
                    <li><strong>File size:</strong> Used for storage management and billing calculations.</li>
                    <li><strong>Timestamps:</strong> Used for syncing, version control, and file organization.</li>
                    <li><strong>Encrypted filename (ciphertext only):</strong> Stored to allow you to organize and search your files on your device.</li>
                  </ul>
                  <p className="text-base leading-relaxed mt-3">
                    <strong>We cannot see the actual filenames or file contents.</strong> Even if we wanted to, the encrypted metadata provides no meaningful information about what your files contain.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">2.4 Usage Analytics (Anonymized)</h3>
                  <p className="text-base leading-relaxed">
                    We collect anonymized usage data about your interactions with the Service (e.g., how often you access your files, total files uploaded, storage used). This helps us improve performance and reliability. Device information such as device type, operating system, and browser type is collected separately from any identifying information.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">2.5 Cookies and Tracking Technologies</h3>
                  <p className="text-base leading-relaxed">
                    We use session cookies for authentication and security purposes only. These cookies do not contain personal information and expire after your session ends. You can disable cookies in your browser settings if you prefer, though this may affect Service functionality.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.1 Service Delivery</h3>
                  <p className="text-base leading-relaxed">
                    We use your information to create and maintain your account, authenticate your access, store and retrieve your encrypted data, enable collaboration features (via encrypted sharing), process transactions, and respond to support requests. We never view the contents of your encrypted files.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.2 Communication</h3>
                  <p className="text-base leading-relaxed">
                    We may send transactional emails (password resets, confirmations, billing notifications) and respond to your support inquiries. With your consent, we may send promotional content and updates about new features.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.3 Service Improvement and Analytics</h3>
                  <p className="text-base leading-relaxed">
                    We analyze anonymized usage patterns to improve Service performance, develop new features, troubleshoot technical issues, and understand general usage trends. This analysis never involves accessing your encrypted data or decrypting your files.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.4 Security and Fraud Prevention</h3>
                  <p className="text-base leading-relaxed">
                    We use your information to detect and prevent fraud, abuse, and unauthorized access to your account, and to enforce our Terms of Service. Security monitoring operates at the system level and does not involve accessing your encrypted content.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">4. Data Sharing and Disclosure</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">4.1 We Do Not Sell Your Data</h3>
                  <p className="text-base leading-relaxed font-medium text-primary">
                    We do not sell, trade, or rent your personal information or any metadata to third parties. This is a core principle of our zero-knowledge architecture.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">4.2 Service Providers</h3>
                  <p className="text-base leading-relaxed">
                    We share limited information with trusted third parties who perform services on our behalf, including payment processors, email providers, analytics services, and hosting providers. These service providers are contractually obligated to maintain the confidentiality of your information and cannot access your encrypted files.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">4.3 Legal Requirements and Limitations</h3>
                  <p className="text-base leading-relaxed">
                    While we comply with applicable laws and legal obligations, we are fundamentally limited in what we can provide. <strong>We cannot decrypt your files or provide unencrypted data, even if required by law, because we do not have access to your encryption keys.</strong> We may disclose encrypted data and account metadata when legally required by court orders or subpoenas, but the encrypted nature of your content provides inherent protection against unauthorized access.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Data Security & Post-Quantum Cryptography</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">5.1 End-to-End Encryption (E2EE)</h3>
                  <p className="text-base leading-relaxed">
                    All your files are encrypted on your device using encryption keys that never leave your device. We store only the encrypted data, making it impossible for us or any unauthorized third party to access your files.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">5.2 Post-Quantum Cryptography (PQC)</h3>
                  <p className="text-base leading-relaxed">
                    Ellipticc uses post-quantum cryptographic algorithms aligned with NIST standards, including:
                  </p>
                  <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                    <li><strong>CRYSTALS-Kyber(ML-KEM768):</strong> For quantum-resistant key encapsulation and hybrid encryption.</li>
                    <li><strong>CRYSTALS-Dilithium(ML-DSA65):</strong> For quantum-resistant digital signatures and data authentication.</li>
                    <li><strong>X25519/Ed25519:</strong> For modern elliptic-curve cryptography complementing PQC protection.</li>
                  </ul>
                  <p className="text-base leading-relaxed mt-3">
                    These algorithms protect your data against both current and future quantum computing threats, ensuring your data remains secure for decades to come.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">5.3 Transport Security</h3>
                  <p className="text-base leading-relaxed">
                    We use TLS/SSL encryption for all data in transit between your device and our servers. This protects your data from interception during transmission.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">5.4 Key Management</h3>
                  <p className="text-base leading-relaxed">
                    Your encryption keys are derived from your password using secure key derivation functions and are never shared with us, stored on our servers, or transmitted unencrypted. You are responsible for protecting your password.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Zero-Knowledge Commitment</h2>
              <p className="text-base leading-relaxed">
                Ellipticc operates as a zero-knowledge service, meaning:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                <li><strong>We cannot view your files:</strong> All content is encrypted on your device before transmission.</li>
                <li><strong>We cannot see your filenames:</strong> Filenames are encrypted using your device-side encryption keys.</li>
                <li><strong>We cannot access your encryption keys:</strong> Keys exist only on your device.</li>
                <li><strong>We cannot recover your data:</strong> If you lose your password or keys, we cannot help you recover your files, as we have no way to decrypt them.</li>
                <li><strong>We cannot comply with decryption requests:</strong> Even if legally required to provide data, we cannot decrypt it.</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                This design is intentional and is our core strength. Your privacy and security are maximized because we are technically incapable of accessing your data, regardless of external pressures or compromises.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">7. Your Rights and Choices</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">7.1 Access and Portability</h3>
                  <p className="text-base leading-relaxed">
                    You have the right to access the personal information we hold about you (name, email, billing details) and request a copy of your account metadata in a portable format. You can export your encrypted files at any time through the Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">7.2 Correction and Deletion</h3>
                  <p className="text-base leading-relaxed">
                    You have the right to correct inaccurate account information and request deletion of your account and associated encrypted data through your account settings or by contacting us. Upon deletion, encrypted data is securely removed from our servers.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">7.3 Marketing Communications</h3>
                  <p className="text-base leading-relaxed">
                    You can opt out of promotional emails by clicking the unsubscribe link in any marketing email or adjusting your preferences in your account settings.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">7.4 Cookies and Tracking</h3>
                  <p className="text-base leading-relaxed">
                    You can disable cookies in your browser settings. Note that disabling cookies may affect your ability to use certain Service features.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Children&apos;s Privacy</h2>
              <p className="text-base leading-relaxed">
                The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will promptly delete such information.
              </p>
              <p className="text-base leading-relaxed">
                If you are between 13 and 18 years old, you must have parental or guardian consent to use the Service.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">9. International Data Transfers</h2>
              <p className="text-base leading-relaxed">
                Your encrypted files and account metadata may be transferred, stored, and processed in countries other than your country of residence. By using the Service, you consent to the transfer of your information for the purposes described in this Privacy Policy. Because your data is encrypted, international transfers provide no additional risk to your privacy.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">10. Updates to This Privacy Policy</h2>
              <p className="text-base leading-relaxed">
                We may update this Privacy Policy at any time. The updated version will be effective upon posting. For material changes that reduce your privacy protections, we will notify you via email. Your continued use following notification constitutes your acceptance of the updated Privacy Policy.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">11. Contact Us</h2>
              <p className="text-base leading-relaxed">
                For questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact:
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-base">
                <p><strong>Email:</strong> <a href="mailto:privacy@ellipticc.com" className="text-blue-600 underline hover:text-blue-800">privacy@ellipticc.com</a></p>
                <p><strong>Support Email:</strong> <a href="mailto:support@ellipticc.com" className="text-blue-600 underline hover:text-blue-800">support@ellipticc.com</a></p>
                <p><strong>Website:</strong> <a href="https://ellipticc.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">ellipticc.com</a></p>
              </div>
            </section>

            {/* Final Note */}
            <section className="space-y-4 border-t border-border pt-8">
              <p className="text-base leading-relaxed text-muted-foreground">
                <strong>Thank you for your trust. Your privacy and security are fundamental to our design—not just a policy.</strong> We are committed to being the most privacy-respecting cloud storage service available.
              </p>
            </section>
          </div>

          {/* Back Button */}
          <div className="mt-12 pt-8 border-t border-border">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <IconArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

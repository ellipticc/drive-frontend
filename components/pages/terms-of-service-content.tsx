"use client"

import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { IconArrowLeft } from "@tabler/icons-react"

export function TermsOfServiceContent() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <IconArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
          {/* Page Header */}
          <div className="mb-12 space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Terms of Service
            </h1>
            <p className="text-lg text-muted-foreground">
              Last updated: November 11, 2025
            </p>
            <p className="text-base text-muted-foreground">
              Please read our terms carefully. By using Ellipticc Drive, you agree to be bound by these terms.
            </p>
          </div>

          {/* Content Sections */}
          <div className="space-y-8 text-foreground prose prose-sm dark:prose-invert max-w-none">
            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-base leading-relaxed">
                By accessing and using this website and service (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service. We reserve the right to modify these Terms at any time. Your continued use of the Service following the posting of revised Terms means that you accept and agree to the changes.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. Description of Service</h2>
              <p className="text-base leading-relaxed">
                Ellipticc is an end-to-end encrypted (E2EE), post-quantum cryptography (PQC), zero-knowledge cloud storage and collaboration platform. The Service allows users to securely store, manage, and share files online with the guarantee that:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                <li><strong>All encryption and decryption occur exclusively on your device.</strong> Ellipticc cannot access or view your files.</li>
                <li><strong>Your encryption keys never leave your device.</strong> We cannot decrypt your data, even if we wanted to.</li>
                <li><strong>Filenames are encrypted.</strong> Ellipticc never sees your actual file or folder names in plain text.</li>
                <li><strong>We maintain zero knowledge of your content.</strong> This is architectural, not just operational.</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                The Service includes account creation, file management, secure sharing capabilities, and related features. All data transmission is protected using post-quantum cryptographic algorithms (NIST-standardized CRYSTALS-Kyber and Dilithium) to protect against current and future quantum threats.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. User Accounts</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.1 Account Creation</h3>
                  <p className="text-base leading-relaxed">
                    To use the Service, you must create an account and provide accurate, complete, and current information (such as your email and name). You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Your password is never sent to or stored by our servers, not even as a hash. Instead, our system uses the <a href="https://csrc.nist.gov/csrc/media/presentations/2024/crclub-2024-10-16/images-media/crypto-club-20241016--hugo--OPAQUE.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">OPAQUE</a> secure authentication protocol, which allows you to log in without your password ever being revealed, transmitted, or recoverable by us.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.2 Account Eligibility</h3>
                  <p className="text-base leading-relaxed">
                    You must be at least 13 years of age to use this Service. If you are under 18, you represent that you have obtained parental consent to use the Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">3.3 Account Termination</h3>
                  <p className="text-base leading-relaxed">
                    We reserve the right to terminate or suspend your account at any time if you violate these Terms, engage in fraudulent behavior, or if required by law. Upon termination, your access to the Service will be immediately revoked, and your encrypted data will be securely deleted within 30 days unless you request earlier deletion.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">4. User Responsibilities</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">4.1 Acceptable Use</h3>
                  <p className="text-base leading-relaxed">
                    You agree to use the Service only for lawful purposes and in a way that does not infringe upon the rights of others or restrict their use and enjoyment of the Service. Prohibited behavior includes:
                  </p>
                  <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                    <li>Harassing or causing distress or inconvenience to any person</li>
                    <li>Obscene or offensive statements or statements that cause offense to any user</li>
                    <li>Disruption of the normal flow of dialogue or operations within the Service</li>
                    <li>Obtaining unauthorized access to confidential information or systems</li>
                    <li>Intentionally or unintentionally violating any laws, rules, or regulations applicable to the Service</li>
                    <li>Attempting to reverse-engineer, decrypt, or bypass the Service's security measures</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">4.2 Content Responsibility</h3>
                  <p className="text-base leading-relaxed">
                    You are solely responsible for the content you upload, store, and share through the Service. You represent and warrant that you own or have the necessary rights to all content you upload and that your content does not violate any laws, regulations, or third-party intellectual property rights. You agree not to upload illegal content, malware, or material that infringes on others' rights.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Account Security</h2>
              <p className="text-base leading-relaxed">
                You are responsible for all activity on your account. You agree to keep your password confidential and secure, immediately notify us of any unauthorized use, and log out when using shared or public devices. We implement industry-standard security measures, including end-to-end encryption and post-quantum cryptography.
              </p>
              <p className="text-base leading-relaxed">
                <strong>Important Limitation:</strong> Because we are a zero-knowledge service, we cannot recover your account if you lose your password or encryption keys. We have no way to decrypt your data if you forget your password. Consider storing your password in a secure password manager or keeping a backup in a secure location.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Intellectual Property Rights</h2>
              <p className="text-base leading-relaxed">
                You retain all ownership rights to the content you upload to the Service. By uploading content, you grant us a limited license to store, maintain, transmit, and deliver your encrypted content to you and to authorized recipients you specify. This license is solely for the purpose of providing the Service and does not grant us any right to view, use, or commercialize your content.
              </p>
              <p className="text-base leading-relaxed">
                All materials provided by the Company, including software, design, documentation, and branding, are the exclusive property of Ellipticc and protected by copyright law. You agree not to reproduce, distribute, modify, or reverse-engineer any proprietary materials without authorization.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">7. Zero-Knowledge Commitment</h2>
              <p className="text-base leading-relaxed">
                Ellipticc is designed as a zero-knowledge service. This means:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                <li><strong>We cannot view your files:</strong> All content is encrypted on your device before transmission to our servers.</li>
                <li><strong>We cannot see your filenames:</strong> Filenames are encrypted using your device-side encryption keys.</li>
                <li><strong>We cannot access your encryption keys:</strong> Encryption keys are generated and stored only on your device.</li>
                <li><strong>We cannot recover your data:</strong> If you lose your password, forget your encryption keys, or forget your two-factor authentication, we cannot help you recover your files or account.</li>
                <li><strong>We cannot decrypt data for legal requests:</strong> Even if we receive court orders, subpoenas, or government requests to provide unencrypted data, we are technically incapable of doing so because we do not have access to encryption keys.</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                This design is intentional and is our core value proposition. Your privacy and security are protected because we are technically incapable of accessing your data, regardless of external pressures.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Data Loss & Responsibility</h2>
              <p className="text-base leading-relaxed">
                <strong>You are responsible for maintaining backups of your encryption keys and passwords.</strong> Because Ellipticc has no knowledge of your passwords or encryption keys, we cannot recover your data if you lose them. While we maintain automated backups of encrypted data on our servers, we cannot help you access your data if you forget your password or lose your encryption keys.
              </p>
              <p className="text-base leading-relaxed">
                We recommend:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                <li>Using a secure password manager to store your password</li>
                <li>Writing down recovery codes and storing them in a safe location</li>
                <li>Enabling two-factor authentication and backing up recovery codes</li>
                <li>Never sharing your password or recovery codes with anyone</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">9. Limitation of Liability</h2>
              <p className="text-base leading-relaxed">
                The Service is provided "as is" and "as available" without warranties of any kind. We disclaim all warranties, including implied warranties of merchantability and fitness for a particular purpose. We do not guarantee that the Service will be error-free or uninterrupted.
              </p>
              <p className="text-base leading-relaxed">
                To the fullest extent permitted by law, Ellipticc shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for any matter beyond our reasonable control, including data loss caused by your loss of passwords or encryption keys. Our total liability shall not exceed the amount you have paid to us in the 12 months preceding the claim.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">10. Changes to the Service</h2>
              <p className="text-base leading-relaxed">
                We may modify, suspend, or discontinue the Service or any features at any time with notice. We will make reasonable efforts to notify users of material changes. Your continued use of the Service following notice of changes constitutes your acceptance of the modified Service.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">11. Compliance & Legal Access</h2>
              <p className="text-base leading-relaxed">
                Ellipticc complies with applicable laws and legal obligations. However, due to our zero-knowledge architecture, we have strict limitations on what we can provide:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 text-base">
                <li>We may disclose encrypted files and encrypted metadata when required by valid court orders or subpoenas.</li>
                <li>We can provide account metadata (email, account creation date, IP addresses) when legally required.</li>
                <li><strong>We cannot provide decrypted files or unencrypted data, even if required by law, because we have no access to encryption keys.</strong></li>
                <li><strong>We cannot force users to surrender encryption keys.</strong> Your encryption keys exist only on your device.</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                This architectural limitation is a feature of our zero-knowledge design and provides inherent protection against unauthorized access to your data.
              </p>
            </section>

            {/* Section 12 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">12. Data Retention & Deletion</h2>
              <p className="text-base leading-relaxed">
                You can delete your account and all associated encrypted data at any time through your account settings. Upon deletion, we securely remove all encrypted files and account data from our servers within 30 days. This deletion is permanent and irreversible.
              </p>
              <p className="text-base leading-relaxed">
                If your account is terminated by us, we retain encrypted data for 30 days to allow you to recover your account. After 30 days, data is permanently deleted.
              </p>
            </section>

            {/* Section 13 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">13. Third-Party Services and Links</h2>
              <p className="text-base leading-relaxed">
                The Service may integrate with or link to third-party services. We are not responsible for the availability, accuracy, security, or content of third-party services or their privacy practices. We encourage you to review the terms and privacy policies of third-party services before using them.
              </p>
            </section>

            {/* Section 14 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">14. Termination</h2>
              <p className="text-base leading-relaxed">
                We may terminate or suspend your account immediately if you violate these Terms, engage in fraudulent behavior, if your account is inactive for an extended period, or if we are required to do so by law. Upon termination, your access to the Service ceases immediately, and encrypted data is deleted per Section 12.
              </p>
            </section>

            {/* Section 15 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">15. Dispute Resolution & Governing Law</h2>
              <p className="text-base leading-relaxed">
                These Terms are governed by the laws of Delaware, United States, without regard to conflicts of law principles. Any disputes arising from or related to these Terms or the Service shall be resolved through binding arbitration administered by JAMS (Judicial Arbitration and Mediation Services) in accordance with its Comprehensive Arbitration Rules & Procedures, rather than in court.
              </p>
              <p className="text-base leading-relaxed">
                The arbitration shall take place in Wilmington, Delaware. Each party shall bear its own costs and attorneys' fees, unless the arbitrator determines otherwise. You waive the right to trial by jury and the right to participate in class action litigation.
              </p>
            </section>

            {/* Section 16 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">16. Contact Information</h2>
              <p className="text-base leading-relaxed">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-base">
                <p><strong>Email:</strong> <a href="mailto:support@ellipticc.com" className="text-blue-600 underline hover:text-blue-800">support@ellipticc.com</a></p>
                <p><strong>Website:</strong> <a href="https://ellipticc.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">ellipticc.com</a></p>
              </div>
            </section>

            {/* Final Note */}
            <section className="space-y-4 border-t border-border pt-8">
              <p className="text-base leading-relaxed text-muted-foreground">
                By using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and accept the zero-knowledge nature of our platform.
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

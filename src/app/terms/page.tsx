import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and conditions for using StayOps.",
};

const sections = [
  {
    title: "1. Agreement to these terms",
    content:
      "These Terms and Conditions govern your access to and use of StayOps. By creating an account, inviting a team member, or using the service, you agree to these terms. If you use StayOps for a business or organization, you confirm that you have authority to accept these terms for it.",
  },
  {
    title: "2. Your account",
    content:
      "Keep your account details accurate and your sign-in credentials secure. You are responsible for activity under your account and for ensuring that each person you invite uses StayOps appropriately. Let us know promptly if you believe your account has been accessed without permission.",
  },
  {
    title: "3. Using StayOps",
    content:
      "StayOps is designed to help short-stay operators coordinate bookings, payments, turnovers, and expenses. You may use the service only in compliance with applicable laws and these terms. Do not interfere with the service, attempt to access accounts or data that are not yours, or use StayOps to store unlawful, misleading, or harmful content.",
  },
  {
    title: "4. Your data",
    content:
      "You retain ownership of the information you enter into StayOps. You give us permission to host, process, and display that information only as needed to operate, secure, and improve the service for you. You are responsible for ensuring that you have the right to provide any guest, staff, or property information you add.",
  },
  {
    title: "5. Fees and payments",
    content:
      "Where a paid plan applies, the price, billing interval, and payment terms will be presented before you subscribe. Fees are due in advance unless stated otherwise. You may cancel a paid plan at any time; access will continue through the end of the current paid period unless otherwise specified.",
  },
  {
    title: "6. Availability and changes",
    content:
      "We aim to keep StayOps reliable and available, but the service may occasionally be unavailable for maintenance, updates, or matters beyond our control. We may update, add, or retire features as the product evolves. We will make reasonable efforts to communicate material changes that affect your use of the service.",
  },
  {
    title: "7. Disclaimer and limitation of liability",
    content:
      "StayOps is provided on an “as is” and “as available” basis to the extent permitted by law. The service helps you organize operations; you remain responsible for your business decisions, guest communications, records, and legal obligations. To the maximum extent permitted by law, StayOps is not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the service.",
  },
  {
    title: "8. Suspension and termination",
    content:
      "You may stop using StayOps at any time. We may suspend or terminate access if we reasonably believe there is a breach of these terms, a security risk, or a legal requirement to do so. Where practical, we will provide notice and an opportunity to address the issue.",
  },
  {
    title: "9. Changes to these terms",
    content:
      "We may update these terms from time to time. If we make a material change, we will update the effective date and provide notice through StayOps or another reasonable channel. Continuing to use the service after the updated terms take effect means you accept them.",
  },
  {
    title: "10. Contact",
    content:
      "For questions about these terms or your StayOps account, please contact the StayOps team through the support channel available in your account.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-pine/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/" aria-label="StayOps home">
            <Logo />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-pine underline underline-offset-4 hover:text-pine-soft"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine/60">
            Legal
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-pine sm:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-ink/65 sm:text-base">
            These terms explain the rules for using StayOps and the
            responsibilities we share in keeping the service useful and secure.
          </p>
          <p className="mt-5 text-sm text-ink/50">
            Effective date: September 24, 2026
          </p>
        </div>

        <div className="mt-14 max-w-3xl space-y-10 sm:mt-16">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl text-pine">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink/70 sm:text-base">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

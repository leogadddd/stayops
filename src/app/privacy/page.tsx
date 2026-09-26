import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for using StayOps.",
};

const sections = [
  {
    title: "1. What this policy covers",
    content:
      "This Privacy Policy explains how StayOps collects, uses, stores, and protects personal information when you use our service. It applies to account holders, team members, guests, and anyone whose information is entered into StayOps.",
  },
  {
    title: "2. Information we process",
    content:
      "We process information needed to operate StayOps, including account details such as your name, email address, profile image, and sign-in records; organization and property details; team-member details; and operational records such as guest contact details, reservations, payments, expenses, tasks, notes, and uploaded attachments.",
  },
  {
    title: "3. How we use information",
    content:
      "We use information to provide and secure the service, manage your account and organization, support reservations and stay operations, display operational records to authorized team members, communicate about the service, resolve support requests, and maintain, troubleshoot, and improve StayOps.",
  },
  {
    title: "4. Your organization’s data",
    content:
      "Your organization controls the guest, reservation, property, and team information entered into its StayOps workspace. You are responsible for providing appropriate notices and obtaining any permissions required before entering personal information about guests or team members. Access is limited by the roles and permissions your organization assigns.",
  },
  {
    title: "5. When information is shared",
    content:
      "We do not sell personal information. We may share information with service providers that help us host, secure, and operate StayOps, when required by law, or where necessary to protect the service, our users, or others. We require providers to handle information only for the services they perform for us.",
  },
  {
    title: "6. Security and retention",
    content:
      "We use reasonable technical and organizational measures to protect information from unauthorized access, loss, misuse, or disclosure. No system is perfectly secure, so please protect your credentials and notify us promptly of suspected unauthorized access. We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements.",
  },
  {
    title: "7. Your choices and rights",
    content:
      "You may update your account information through StayOps. Depending on applicable law, you may also have rights to be informed about processing, access and correct personal information, object to certain processing, request erasure or blocking where appropriate, request data portability, or file a complaint. We will handle requests in accordance with applicable law and may need to verify your identity first.",
  },
  {
    title: "8. International processing",
    content:
      "StayOps and its service providers may process information in locations outside your province or country. Where this happens, we take reasonable steps to ensure the information receives protection consistent with this policy and applicable law.",
  },
  {
    title: "9. Changes to this policy",
    content:
      "We may update this policy as StayOps evolves or legal requirements change. If we make a material change, we will update the effective date and provide notice through StayOps or another reasonable channel.",
  },
  {
    title: "10. Contact",
    content:
      "For questions, requests, or concerns about privacy and personal information, please contact the StayOps team through the support channel available in your account.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-pine/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/" aria-label="StayOps home"><Logo /></Link>
          <Link href="/login" className="text-sm font-medium text-pine underline underline-offset-4 hover:text-pine-soft">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-14 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine/60">Legal</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-pine sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 text-sm leading-relaxed text-ink/65 sm:text-base">This policy explains what information StayOps handles, why we use it, and the choices available to you and your organization.</p>
          <p className="mt-5 text-sm text-ink/50">Effective date: September 26, 2026</p>
        </div>
        <div className="mt-14 max-w-3xl space-y-10 sm:mt-16">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl text-pine">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink/70 sm:text-base">{section.content}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

import { Logo, LogoMark } from "@/components/logo";
import Link from "next/link";

/**
 * Split-screen auth layout, after the StayOps login reference:
 * brand panel on the left, form on the right.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-pine p-10 text-paper lg:flex">
        <Link href="/" aria-label="StayOps home">
          <Logo className="text-paper" />
        </Link>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight xl:text-5xl">
            A calmer way to run your stays.
          </p>
          <p className="mt-6 text-sm leading-relaxed text-paper/70">
            Bookings, payments, turnovers and expenses for small stay
            operators — from the first inquiry to the final checkout.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-paper/50">
          People · Spaces · Progress
        </p>
        {/* subtle door motif echoing the logo */}
        <LogoMark
          className="pointer-events-none absolute -bottom-16 -right-16 h-96 w-96 text-paper/5"
          aria-hidden
        />
      </aside>
      <main className="flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

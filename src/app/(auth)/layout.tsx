import { Logo, LogoMark } from "@/components/logo";
import Link from "next/link";

const CELL = 48;

// Filled grid cells, like stays on a calendar: [column, row, span, color].
const BLOCKS: [number, number, number, string][] = [
  [7, 1, 3, "bg-sage/80"],
  [9, 2, 2, "bg-sand-deep/80"],
  [6, 3, 2, "bg-paper/10"],
  [8, 3, 3, "bg-moss/70"],
  [10, 4, 2, "bg-clay/70"],
];

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
      <aside className="theme-keep-light theme-keep-brand relative hidden flex-col justify-between overflow-hidden bg-pine p-10 text-paper lg:flex">
        {/* calendar grid backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-paper) 1px, transparent 1px), linear-gradient(90deg, var(--color-paper) 1px, transparent 1px)",
            backgroundSize: `${CELL}px ${CELL}px`,
          }}
        />
        {BLOCKS.map(([col, row, span, color]) => (
          <span
            key={`${col}-${row}`}
            aria-hidden
            className={`pointer-events-none absolute ${color}`}
            style={{
              left: col * CELL + 1,
              top: row * CELL + 1,
              width: span * CELL - 1,
              height: CELL - 1,
            }}
          />
        ))}

        <Link href="/" aria-label="StayOps home" className="relative z-10">
          <Logo className="text-paper" />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl leading-tight xl:text-5xl">
            A calmer way to run your staycation.
          </p>
          <p className="mt-6 text-sm leading-relaxed text-paper/70">
            Every booking, payment, turnover and expense in one place, from the
            first inquiry to the final checkout.
          </p>
        </div>
        <p className="relative z-10 text-xs uppercase tracking-[0.2em] text-paper/50">
          People · Spaces · Progress
        </p>
        {/* subtle door motif echoing the logo */}
        <LogoMark
          className="pointer-events-none absolute -bottom-16 -right-16 h-96 w-96 text-paper/5"
          aria-hidden
        />
      </aside>
      <main className="flex items-start justify-center bg-paper px-6 py-9 lg:items-center lg:py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            aria-label="StayOps home"
            className="mb-12 flex justify-center lg:hidden"
          >
            <Logo />
          </Link>
          {children}
          <footer className="mt-10 flex items-center justify-center gap-4 text-xs text-ink/50">
            <Link href="/terms" className="underline-offset-4 hover:text-pine hover:underline">
              Terms and Conditions
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:text-pine hover:underline">
              Privacy Policy
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}

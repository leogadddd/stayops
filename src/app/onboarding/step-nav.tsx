import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

/**
 * Bottom navigation shared by every onboarding step: Back on the left, the
 * step's forward actions (Next, Skip…) on the right.
 */
export function StepNav({
  backHref,
  children,
}: {
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-pine/10 pt-6">
      {backHref ? (
        <Link href={backHref} className={buttonClassName("ghost", "md")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

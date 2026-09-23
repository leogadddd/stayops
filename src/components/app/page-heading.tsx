import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeading({ title, description, backHref, backLabel = "Back", children }: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {backHref ? <Link href={backHref} className="mb-4 inline-flex items-center gap-2 text-sm text-pine/70 hover:text-clay"><ArrowLeft className="h-4 w-4" aria-hidden />{backLabel}</Link> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-pine sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

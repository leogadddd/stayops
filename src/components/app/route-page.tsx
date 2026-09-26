import type { ReactNode } from "react";
import { PageHeading } from "@/components/app/page-heading";
import { Card, CardBody } from "@/components/ui/card";

/**
 * The full-page form of an action that normally opens as a RouteModal: the
 * same content, reached by a direct visit or a reload.
 */
export function RoutePage({
  title,
  description,
  backHref,
  backLabel,
  unavailable,
  children,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  unavailable?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title={title} description={description} backHref={backHref} backLabel={backLabel} />
      <Card className="bg-surface">
        <CardBody>
          {unavailable ? <p className="text-sm text-ink/65" role="status">{unavailable}</p> : children}
        </CardBody>
      </Card>
    </div>
  );
}

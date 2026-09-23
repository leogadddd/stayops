import { ShieldAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

export function PermissionDenied({
  title = "Owner access only",
  description = "This area is limited to the organization owner. Ask the owner to grant you access or switch accounts.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardBody className="flex flex-col items-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay/10 text-clay">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl text-pine">{title}</h1>
          <p className="mt-2 max-w-sm text-sm text-ink/60">{description}</p>
        </CardBody>
      </Card>
    </div>
  );
}

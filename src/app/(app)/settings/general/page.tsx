import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = { title: "General settings" };

/** Reserved for organization-wide settings that do not fit another category. */
export default function GeneralSettingsPage() {
  return (
    <Card className="min-w-0 bg-[#FFFDFA]">
      <CardBody>
        <div className="min-h-32" />
      </CardBody>
    </Card>
  );
}

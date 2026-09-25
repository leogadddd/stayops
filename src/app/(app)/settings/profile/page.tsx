import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  return <Card className="min-w-0 bg-[#FFFDFA]"><CardBody><ProfileForm name={user.name} email={user.email} /></CardBody></Card>;
}

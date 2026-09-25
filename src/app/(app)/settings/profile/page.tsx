import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const image = user.image?.startsWith(`user/${user.id}/`)
    ? `/api/users/${user.id}/profile-image`
    : user.image ?? null;
  return <ProfileForm name={user.name} email={user.email} image={image} />;
}

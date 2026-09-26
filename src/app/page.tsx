import { redirect } from "next/navigation";
import { getSession, listAccessibleOrganizations } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const memberships = await listAccessibleOrganizations(session.user.id);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }
  redirect("/dashboard");
}

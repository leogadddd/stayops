import { redirect } from "next/navigation";
import { getSession, listMemberships } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const memberships = await listMemberships(session.user.id);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }
  redirect("/calendar");
}

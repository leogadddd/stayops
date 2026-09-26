import { redirect } from "next/navigation";
import { getSession, hasOrganizationAccess } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!(await hasOrganizationAccess(session.user.id))) {
    redirect("/onboarding");
  }
  redirect("/dashboard");
}

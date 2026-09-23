import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { listMemberships } from "@/lib/auth/session";
import { AppSidebar, MobileTopBar } from "@/components/app/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  const membership = memberships[0];

  if (!membership) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-dvh">
      <AppSidebar
        organizationName={membership.organizationName}
        userName={user.name}
        userEmail={user.email}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar organizationName={membership.organizationName} />
        <main className="flex-1 px-4 py-6 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

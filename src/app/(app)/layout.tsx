import { listMemberships, requireMembership, requireUser } from "@/lib/auth/session";
import { AppHeader, AppSidebar } from "@/components/app/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // These share the request-scoped auth cache, and running them together keeps
  // the layout from adding a sequential wait before the page can render.
  const [user, membership] = await Promise.all([
    requireUser(),
    requireMembership(),
  ]);
  const organizations = await listMemberships(user.id);
  const identity = {
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    organizations: organizations.map((organization) => ({
      id: organization.organizationId,
      name: organization.organizationName,
      role: organization.role,
    })),
    userName: user.name,
    userEmail: user.email,
    userImage: user.image?.startsWith(`user/${user.id}/`)
      ? `/api/users/${user.id}/profile-image`
      : user.image ?? null,
    role: membership.role,
  };
  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <a
        href="#main-content"
        className="fixed left-4 top-2 z-50 -translate-y-24 rounded-lg bg-clay px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <AppSidebar {...identity} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader {...identity} initialNow={new Date().toISOString()} />
        <main
          id="main-content"
          tabIndex={-1}
          className="app-scroll relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

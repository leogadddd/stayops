import { requireMembership, requireUser } from "@/lib/auth/session";
import { AppHeader, AppSidebar } from "@/components/app/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const membership = await requireMembership();
  const identity = {
    organizationName: membership.organizationName,
    userName: user.name,
    userEmail: user.email,
    role: membership.role,
  };
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
  }).format(new Date());

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <a href="#main-content" className="fixed left-4 top-2 z-50 -translate-y-24 rounded-lg bg-clay px-4 py-3 text-sm text-white focus:translate-y-0">Skip to content</a>
      <AppSidebar {...identity} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader {...identity} dateLabel={dateLabel} />
        <main id="main-content" tabIndex={-1} className="app-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { AppHeader, AppSidebar } from "@/components/app/sidebar";
import { Logo, LogoMark } from "@/components/logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AppLayout from "@/app/(app)/layout";
import { requireMembership, requireUser } from "@/lib/auth/session";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), requireMembership: vi.fn() }));

const identity = { organizationName: "Example stays", userName: "Test Owner", userEmail: "owner@example.com", role: "owner" as const };
const h = React.createElement;
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(usePathname).mockReturnValue("/calendar");
});

describe("branded app shell", () => {
  it("uses supplied brand assets rather than a redrawn SVG", () => {
    const logo = renderToStaticMarkup(h(Logo));
    expect(logo).toContain('aria-label="StayOps"');
    expect(logo).toContain("/brand/stayops-logo.png");
    expect(logo).not.toContain("<svg");
    expect(renderToStaticMarkup(h(LogoMark))).toContain("/brand/stayops-mark.png");
  });

  it("keeps audit logs under settings rather than sidebar navigation", () => {
    const markup = renderToStaticMarkup(h(AppSidebar, identity));
    for (const href of ["/dashboard", "/calendar", "/reservations", "/settings/properties", "/guests", "/tasks", "/reports", "/expenses", "/settings"]) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup).not.toContain('href="/audit-logs"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain("Sign out");
  });

  it("does not offer staff owner-only destinations", () => {
    const markup = renderToStaticMarkup(h(AppSidebar, { ...identity, role: "staff" }));
    for (const href of ["/reports", "/expenses", "/settings", "/audit-logs"]) expect(markup).not.toContain(`href="${href}`);
    expect(markup).toContain('href="/tasks"');
    expect(markup).toContain('href="/reservations"');
  });

  it("selects only properties while editing a nested unit", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/properties/property-a/units/unit-a/edit");
    const markup = renderToStaticMarkup(h(AppSidebar, identity));
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    const propertiesLink = markup.match(/<a\b[^>]*>/g)?.find((tag) => tag.includes('href="/settings/properties"'));
    expect(propertiesLink).toContain('aria-current="page"');
  });

  it("provides account controls, a live clock and accessible mobile navigation", () => {
    const markup = renderToStaticMarkup(h(AppHeader, { ...identity, initialNow: "2026-09-24T01:02:03.000Z" }));
    expect(markup).not.toContain('action="/reservations"');
    expect(markup).not.toContain('name="q"');
    expect(markup).toContain('aria-label="Current date and time"');
    expect(markup).toContain('aria-label="Open account menu"');
    expect(markup).toContain('aria-label="Open navigation"');
    expect(markup).toContain('<dialog aria-label="Navigation"');
    expect(markup).toContain('aria-label="Close navigation"');
  });

  it("keeps the shared header and sidebar outside the content scroll region", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "user-a", name: identity.userName, email: identity.userEmail } as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(requireMembership).mockResolvedValue({ userId: "user-a", organizationId: "org-a", organizationName: identity.organizationName, organizationSlug: "example", role: "owner" });
    const markup = renderToStaticMarkup(await AppLayout({ children: h("p", null, "Page content") }));
    expect(requireMembership).toHaveBeenCalledOnce();
    expect(markup).toContain("h-dvh overflow-hidden");
    expect(markup).toContain("flex-col overflow-hidden");
    expect(markup).toMatch(/<main[^>]*overflow-y-auto/);
    expect(markup.indexOf('data-testid="app-header"')).toBeLessThan(markup.indexOf('<main'));
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain("Page content");
  });
});

describe("shared table", () => {
  it("keeps native semantics and contains wide content in its own scroller", () => {
    const markup = renderToStaticMarkup(h(Table, { className: "min-w-160" },
      h(TableHeader, null, h(TableRow, null, h(TableHead, { scope: "col" }, "Guest"))),
      h(TableBody, null, h(TableRow, null, h(TableCell, null, "Example Guest"))),
    ));
    expect(markup).toContain('data-slot="table-container"');
    expect(markup).toContain("overflow-x-auto");
    for (const tag of ["table", "thead", "tbody", "tr", "th", "td"]) expect(markup).toContain(`<${tag}`);
    expect(markup).toContain('scope="col"');
    expect(markup).toContain("min-w-160");
  });
});

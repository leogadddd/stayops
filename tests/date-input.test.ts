import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readableDate } from "@/lib/dates";
import { DateInput } from "@/components/ui/date-input";

const h = React.createElement;
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("readableDate", () => {
  const today = "2026-09-24";

  it("names today, tomorrow and yesterday", () => {
    expect(readableDate("2026-09-24", today)).toBe("Today, Sep 24, 2026");
    expect(readableDate("2026-09-25", today)).toBe("Tomorrow, Sep 25, 2026");
    expect(readableDate("2026-09-23", today)).toBe("Yesterday, Sep 23, 2026");
  });

  it("uses the weekday form for other days and when today is unknown", () => {
    expect(readableDate("2026-09-28", today)).toBe("Mon, Sep 28, 2026");
    expect(readableDate("2026-09-24")).toBe("Thu, Sep 24, 2026");
  });
});

describe("DateInput", () => {
  it("shows a readable date and submits yyyy-mm-dd", () => {
    const html = renderToStaticMarkup(h(DateInput, { name: "paidDate", defaultValue: "2026-09-28", today: "2026-09-24", required: true }));
    expect(html).toContain("Mon, Sep 28, 2026");
    expect(html).toContain('name="paidDate"');
    expect(html).toContain('value="2026-09-28"');
    expect(html).not.toContain('type="date"');
  });

  it("says Today for today's date", () => {
    const html = renderToStaticMarkup(h(DateInput, { value: "2026-09-24", today: "2026-09-24" }));
    expect(html).toContain("Today, Sep 24, 2026");
  });

  it("shows the placeholder when empty", () => {
    const html = renderToStaticMarkup(h(DateInput, { name: "startDate", placeholder: "Any", clearable: true }));
    expect(html).toContain("Any");
    expect(html).not.toContain("Clear date");
  });
});

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readableTime, TimeInput } from "@/components/ui/time-input";

const h = React.createElement;
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("TimeInput", () => {
  it("reads 24-hour values as 12-hour times", () => {
    expect(readableTime("00:05")).toBe("12:05 AM");
    expect(readableTime("12:00")).toBe("12:00 PM");
    expect(readableTime("15:30")).toBe("3:30 PM");
    expect(readableTime("")).toBe("");
  });

  it("shows the readable time and submits the 24-hour value", () => {
    const html = renderToStaticMarkup(h(TimeInput, { name: "checkInTime", defaultValue: "15:00", required: true }));
    expect(html).toContain("3:00 PM");
    expect(html).toContain('name="checkInTime"');
    expect(html).toContain('value="15:00"');
    expect(html).toContain("required");
  });

  it("shows a placeholder when empty", () => {
    expect(renderToStaticMarkup(h(TimeInput, { value: "", onChange: () => {} }))).toContain("Pick a time");
  });
});

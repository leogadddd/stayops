import { describe, expect, it } from "vitest";
import {
  ORG_NAME_MAX,
  OrgError,
  slugify,
  validateOrgName,
} from "@/server/orgs/service";

describe("slugify", () => {
  it("produces lowercase URL-safe slugs", () => {
    expect(slugify("Dela Cruz Stays")).toBe("dela-cruz-stays");
    expect(slugify("  Manila  Homes!! ")).toBe("manila-homes");
    expect(slugify("Lorenzo's Lofts")).toBe("lorenzos-lofts");
  });

  it("bounds slug length", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("validateOrgName", () => {
  it("trims and accepts valid names", () => {
    expect(validateOrgName("  Demo Stay Operations  ")).toBe(
      "Demo Stay Operations",
    );
  });

  it("rejects too-short names", () => {
    expect(() => validateOrgName("x")).toThrow(OrgError);
  });

  it("rejects too-long names", () => {
    expect(() => validateOrgName("a".repeat(ORG_NAME_MAX + 1))).toThrow(
      OrgError,
    );
  });
});

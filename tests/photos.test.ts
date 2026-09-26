import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireMembership, type MembershipContext } from "@/lib/auth/session";
import { isStoredPhotoKey, photoSrc, unitOrPropertyPhotoSrc } from "@/lib/photos";
import * as inventory from "@/server/inventory/service";
import { createObjectStorageFromEnvironment } from "@/server/storage/service";
import { createPropertyAction, updateUnitAction } from "@/app/(app)/properties/actions";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/session")>(),
  requireMembership: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({
  createProperty: vi.fn(), updateProperty: vi.fn(), deleteProperty: vi.fn(),
  createUnit: vi.fn(), updateUnit: vi.fn(), deleteUnit: vi.fn(),
  getPropertyOrThrow: vi.fn(), getUnitOrThrow: vi.fn(),
}));
vi.mock("@/server/storage/service", () => ({
  createObjectStorageFromEnvironment: vi.fn(),
  StorageError: class extends Error {},
}));

const owner: MembershipContext = {
  organizationId: "org-a", organizationName: "Test stays",
  organizationSlug: "test-stays", userId: "owner-a", role: "owner",
};
const storage = { put: vi.fn(), delete: vi.fn() };
// Uploads are decoded (not trusted by MIME type), so tests need a real image.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function formWithPhoto(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  form.set("image", new File([ONE_PIXEL_PNG], "cover.png", { type: "image/png" }));
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMembership).mockResolvedValue(owner);
  vi.mocked(createObjectStorageFromEnvironment).mockReturnValue(storage as unknown as ReturnType<typeof createObjectStorageFromEnvironment>);
  vi.mocked(inventory.createProperty).mockResolvedValue({ id: "property-new" } as Awaited<ReturnType<typeof inventory.createProperty>>);
});

describe("photo sources", () => {
  it("serves stored keys through the member-only route with a version", () => {
    const src = photoSrc("unit", { id: "unit-a", imageUrl: "org/org-a/photos/1234abcd-5678" });
    expect(src).toBe("/api/units/unit-a/photo?v=1234abcd");
  });

  it("shows older inline photos as they are, and nothing when there is none", () => {
    expect(photoSrc("property", { id: "p", imageUrl: "data:image/png;base64,AAAA" })).toBe("data:image/png;base64,AAAA");
    expect(photoSrc("property", { id: "p", imageUrl: null })).toBeNull();
  });

  it("falls back from the unit's photo to the property's", () => {
    expect(unitOrPropertyPhotoSrc({ id: "u", imageUrl: null }, { id: "p", imageUrl: "org/o/photos/abc" })).toBe("/api/properties/p/photo?v=abc");
  });

  it("only accepts keys from the member's own organization", () => {
    expect(isStoredPhotoKey("org/org-a/photos/x", "org-a")).toBe(true);
    expect(isStoredPhotoKey("org/org-b/photos/x", "org-a")).toBe(false);
    expect(isStoredPhotoKey("data:image/png;base64,AA", "org-a")).toBe(false);
  });
});

describe("saving cover photos", () => {
  it("stores a new property's photo and saves its key", async () => {
    expect(await createPropertyAction({}, formWithPhoto({ name: "Beach House" }))).toEqual({ success: true, id: "property-new" });
    const key = vi.mocked(storage.put).mock.calls[0]![0].key as string;
    expect(key).toMatch(/^org\/org-a\/photos\/[0-9a-f-]{36}$/);
    expect(storage.put).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/webp" }));
    expect(inventory.createProperty).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imageUrl: key }),
    }));
  });

  it("removes the replaced photo after a successful edit", async () => {
    vi.mocked(inventory.getUnitOrThrow).mockResolvedValue({ imageUrl: "org/org-a/photos/old" } as Awaited<ReturnType<typeof inventory.getUnitOrThrow>>);
    await updateUnitAction("property-a", "unit-a", {}, formWithPhoto({
      name: "Unit 1", capacity: "2", bedrooms: "1", bathrooms: "1", status: "active",
    }));
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith("org/org-a/photos/old");
  });

  it("removes the new photo when the save fails", async () => {
    vi.mocked(inventory.createProperty).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await createPropertyAction({}, formWithPhoto({ name: "Beach House" }));
    expect(state.error).toBeTruthy();
    const key = vi.mocked(storage.put).mock.calls[0]![0].key;
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(key);
  });

  it("keeps the current photo when no file is chosen", async () => {
    await createPropertyAction({}, (() => { const f = new FormData(); f.set("name", "Beach House"); return f; })());
    expect(storage.put).not.toHaveBeenCalled();
    expect(inventory.createProperty).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imageUrl: undefined }),
    }));
  });
});

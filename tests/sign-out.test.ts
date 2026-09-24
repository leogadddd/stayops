import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth/client";
import { signOutAndRedirect } from "@/lib/auth/sign-out";

vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut: vi.fn() },
}));

beforeEach(() => vi.resetAllMocks());

describe("sign out", () => {
  it("uses the auth client and redirects only after success", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });
    const redirect = vi.fn();

    await signOutAndRedirect(redirect);

    expect(authClient.signOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("surfaces API errors and stays on the current page", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: null,
      error: { message: "Session service unavailable" },
    } as Awaited<ReturnType<typeof authClient.signOut>>);
    const redirect = vi.fn();

    await expect(signOutAndRedirect(redirect)).rejects.toThrow("Session service unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });
});

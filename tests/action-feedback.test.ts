import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { showActionFeedback } from "@/hooks/use-action-feedback";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

beforeEach(() => vi.resetAllMocks());

describe("action toast feedback", () => {
  it("shows server errors with their useful detail", () => {
    showActionFeedback({ error: "The unit has an active stay." });
    expect(toast.error).toHaveBeenCalledWith("That didn’t work", {
      description: "The unit has an active stay.",
    });
  });

  it("shows successful action copy", () => {
    showActionFeedback({ success: true }, { success: "Property updated." });
    expect(toast.success).toHaveBeenCalledWith("Property updated.");
  });

  it("supports informational and warning results", () => {
    showActionFeedback(
      { error: undefined, result: "conflict" },
      { getInformation: () => ({ type: "warning", message: "Unit is not available", description: "Overlaps a confirmed stay" }) },
    );
    expect(toast.warning).toHaveBeenCalledWith("Unit is not available", {
      description: "Overlaps a confirmed stay",
    });
  });
});

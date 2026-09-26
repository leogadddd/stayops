import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, listPendingJoinRequests } from "../state";
import { JoinOrganization } from "./join-organization";

export const metadata: Metadata = { title: "Join an organization" };

export default async function OnboardingJoinPage() {
  const user = await requireUser();
  const [state, pendingRequests] = await Promise.all([
    getOnboardingState(user.id),
    listPendingJoinRequests(user.id),
  ]);

  return (
    <JoinOrganization
      hasMembership={Boolean(state.membership)}
      pendingRequests={pendingRequests.map((request) => ({
        id: request.id,
        organizationName: request.organizationName,
        requestedAt: request.createdAt.toISOString(),
      }))}
    />
  );
}

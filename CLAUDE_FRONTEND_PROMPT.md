# Frontend handoff: organization roles and onboarding invitations

Update the existing StayOps Next.js frontend only. Do not change database schema, migrations, or server-side services unless a compile fix is strictly required. Preserve the current visual system and reusable UI components.

## Backend already available

Roles are global seeded reference data. Role keys are `owner`, `admin`, `operations_manager`, and `staff`. The permission matrix lives in `src/lib/permissions.ts`:

- Owner: every permission, including billing and ownership-sensitive configuration.
- Admin: organization/team management and operational access, but no billing.
- Operations Manager: properties, reservations, expenses, operations, and inventory; no team or organization administration.
- Staff: day-to-day operations only.

Memberships now have `roleId`; session membership `role` is one of those four keys. Do not assume only `owner | staff` in components.

The relevant server APIs are already implemented:

- `inviteStaff` in `src/server/orgs/service.ts`: owner creates an email-bound invitation. It returns `{ invitationId, code, email, role, expiresAt }`. The raw code is only returned once and must be turned into an app link in the UI, such as `${window.location.origin}/onboarding?invite=<encoded code>`.
- `getInvitationForUser`, `acceptInvitation`, `requestOrganizationAccess`, `createOrganizationJoinCode`, `reviewOrganizationJoinRequest`, `listOrganizationJoinRequests`, and `listAssignableRoles` are in the same service.
- Settings server actions are in `src/app/(app)/settings/actions.ts`: `inviteStaffAction`, `createOrganizationJoinCodeAction`, and `reviewOrganizationJoinRequestAction`.
- Onboarding actions are in `src/app/onboarding/invitation-actions.ts`: `inspectInvitationAction`, `acceptInvitationAction`, and `requestOrganizationAccessAction`.

Invitation security rules are fixed: invitations are email-bound, expire after 14 days, and raw codes are not stored. A reusable organization join code creates a **pending request** that requires owner approval. Do not bypass either rule client-side.

## Build this UX

1. Update all role labels and role-aware UI to support all four roles. Use these readable labels: Owner, Admin, Operations Manager, Staff. Do not grant pages/actions just because a user can see a navigation item; server authorization remains authoritative.

2. Replace the current “Add staff” form with an invite flow:
   - email input and role selector containing Admin, Operations Manager, and Staff (never Owner);
   - submit through `inviteStaffAction`;
   - on success, show a one-time invitation link/code with Copy button and expiration date; explain that the link must be sent securely to the recipient;
   - use wording “Invite team member,” not “Add staff,” since an account is not created until acceptance.

3. Add an owner-only pending-access-requests section to team/settings. Load `listOrganizationJoinRequests(organizationId)` server-side and show requester name, email, requested Staff role, and request date. Each row has Approve and Decline controls calling `reviewOrganizationJoinRequestAction(requestId, true|false)`. Confirm the decision and refresh the list.

4. Add an owner-only “Organization join code” control. `createOrganizationJoinCodeAction()` returns the code only once. Show it in a copyable, security-conscious dialog and explain it creates requests that the owner must approve. It is not an automatic membership link.

5. Redesign onboarding for a user without a membership:
   - If the URL has `?invite=<code>`, make “Accept your invitation” the primary state. Call `inspectInvitationAction` using that code, show organization name and assigned role, then call `acceptInvitationAction(code)` on confirmation. On success redirect to `/dashboard`; do not run property setup.
   - If no code exists, offer two equal, explicit choices: “Create a new organization” and “Join an existing organization.”
   - New organization continues the existing organization/property/unit onboarding unchanged.
   - Join existing organization asks for a reusable organization join code, calls `requestOrganizationAccessAction`, and displays a pending-approval state. Do not pretend the user is a member; they should not enter the app until approved. Include a way to enter a different code.
   - Accounts created from `/register` should preserve the `invite` query parameter when navigating to onboarding, so a newly registered invitee immediately sees acceptance.

6. Make login/register invitation-aware:
   - when an unauthenticated visitor opens an invitation onboarding URL, preserve `invite` through login and registration links;
   - after successful login/registration, return to `/onboarding?invite=...` rather than generic onboarding;
   - do not expose whether a different email address has an invitation.

7. Keep accessibility strong: semantic form labels, inline errors from server action states, focus-visible controls, clear status text, keyboard-accessible copy actions, and no color-only meaning. Reuse existing `Button`, `Input`, `SelectMenu`, cards, dialogs, toast, and action-feedback patterns.

## Acceptance checks

- TypeScript passes.
- Existing owner/staff behavior does not regress.
- Admin and Operations Manager render sensible labels instead of “Staff.”
- An existing or new account can accept only its own email-bound invite.
- A join-code submission never creates a membership before owner approval.
- The raw invite/join code is only shown immediately after generation, never fetched back from the database.

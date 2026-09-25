import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/general");
  // `redirect` throws during a real request. This unreachable return keeps
  // the route's component type concrete for server-side callers and tests.
  return <div />;
}

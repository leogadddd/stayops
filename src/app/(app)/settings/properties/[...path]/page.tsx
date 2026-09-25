import { redirect } from "next/navigation";

export default async function LegacyPropertyRoute({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  redirect(`/properties/${path.join("/")}`);
}

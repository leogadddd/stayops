import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createOrganization, OrgError } from "@/server/orgs/service";

const createOrgSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function POST(request: Request) {
  const user = await requireUser();

  const parsed = createOrgSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter an organization name (2–80 characters)." },
      { status: 400 },
    );
  }

  try {
    const org = await createOrganization({
      name: parsed.data.name,
      ownerUserId: user.id,
    });
    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    if (error instanceof OrgError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

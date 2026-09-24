import { resetDemoData } from "../../../../../scripts/reset-demo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await resetDemoData();
    return Response.json({ ok: true, resetAt: new Date().toISOString() });
  } catch (error) {
    console.error("nightly demo reset failed", error);
    return Response.json({ error: "Demo reset failed." }, { status: 500 });
  }
}

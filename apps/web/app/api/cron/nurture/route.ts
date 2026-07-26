import { NextRequest, NextResponse } from "next/server";
import { runNurtureCron } from "@/lib/nurture";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily activation-nurture cron. Scheduled in vercel.json.
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
 * is set, and always sets the `x-vercel-cron` header on cron invocations.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;

  if (secret && auth !== `Bearer ${secret}` && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runNurtureCron();
    logger.info({ operation: "nurture.cron_run", ...summary });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    logger.error({ operation: "nurture.cron_error" }, error);
    return NextResponse.json({ error: "cron failed" }, { status: 500 });
  }
}

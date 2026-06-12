import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") ?? "throw";

  if (mode === "logger") {
    logger.error(
      { operation: "sentry.test.logger" },
      new Error("Sentry test via logger.error — safe to delete"),
    );
    return NextResponse.json({ ok: true, mode });
  }

  throw new Error("Sentry test via thrown error — safe to delete");
}

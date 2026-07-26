import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubToken } from "@/lib/unsubscribe-token";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:12vh auto;padding:0 24px;text-align:center;color:#E7EDF7;">
<div style="display:inline-block;width:10px;height:34px;border-radius:2px;background:linear-gradient(180deg,#4D9FFF,#185FA5);vertical-align:middle;"></div>
<span style="font-size:26px;font-weight:700;margin-left:12px;vertical-align:middle;">Journeyline</span>
<h1 style="font-size:20px;font-weight:600;margin:32px 0 12px;">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#9FB0CC;">${body}</p>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * One-click unsubscribe from the nurture footer link.
 * Token is HMAC(userId), verified statelessly.
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  const t = req.nextUrl.searchParams.get("t");

  if (!u || !t || !verifyUnsubToken(u, t)) {
    return page("Invalid link", "This unsubscribe link is invalid or has expired.", 400);
  }

  try {
    await prisma.user.update({
      where: { id: u },
      data: { marketingUnsubscribedAt: new Date() },
    });
    logger.info({ operation: "nurture.unsubscribed", userId: u });
  } catch (error) {
    logger.error({ operation: "nurture.unsubscribe_error", userId: u }, error);
    return page("Something went wrong", "We couldn't process that just now. Please try again later.", 500);
  }

  return page(
    "You're unsubscribed",
    "You won't receive any more Journeyline activation emails. You'll still get important account and purchase messages.",
  );
}

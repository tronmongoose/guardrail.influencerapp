import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/email-helpers";

const FEEDBACK_TO = "info@skillguide.net";
const MAX_LEN = 2000;

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawMessage = typeof body?.message === "string" ? body.message : "";
  const programId = typeof body?.programId === "string" ? body.programId : null;
  const message = rawMessage.trim().slice(0, MAX_LEN);

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const editUrl = programId ? absoluteUrl(`/programs/${programId}/edit`) : null;

  const text = [
    message,
    "",
    "—",
    `From: ${user.name ? `${user.name} <${user.email}>` : user.email}`,
    programId ? `Program: ${programId}` : null,
    editUrl ? `Edit URL: ${editUrl}` : null,
    `User ID: ${user.id}`,
    `Sent: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const subject = `JourneyLine feedback from ${user.email}`;

  const sent = await sendEmail({
    to: FEEDBACK_TO,
    subject,
    text,
    replyTo: user.email,
  });

  if (!sent) {
    return NextResponse.json({ error: "Could not send feedback" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

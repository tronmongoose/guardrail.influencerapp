import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/email-helpers";
import { logger } from "@/lib/logger";
import { renderNurtureEmail, type NurtureVars } from "@/emails/nurture/render";
import { makeUnsubToken } from "@/lib/unsubscribe-token";

// ---------------------------------------------------------------------------
// Activation nurture — creators who signed up but never published a program.
// Event-less drip: a daily cron finds who is due for the next step and sends it.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after signup each step becomes due. Index 0 = step 1. */
const STEP_OFFSET_DAYS = [1, 3, 6, 10, 14];
const TOTAL_STEPS = STEP_OFFSET_DAYS.length;

/** Don't enroll signups older than this (avoid blasting dormant accounts). */
const MAX_SIGNUP_AGE_DAYS = Number(process.env.NURTURE_MAX_SIGNUP_AGE_DAYS || 45);

type CreatorRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  programs: { id: string; published: boolean; createdAt: Date; _count: { videos: number } }[];
  nurtureSends: { step: number }[];
};

type ProgramState = {
  state: "A" | "B" | "C";
  statusLine: string;
  resumePath: string;
  hasVideo: boolean;
};

export function resolveState(row: CreatorRow): ProgramState {
  // Caller guarantees no published program. Programs ordered newest-first.
  if (row.programs.length === 0) {
    return {
      state: "A",
      statusLine: "hasn't been started yet",
      resumePath: "/dashboard",
      hasVideo: false,
    };
  }
  const latest = row.programs[0];
  const videoCount = latest._count.videos;
  if (videoCount === 0) {
    return {
      state: "B",
      statusLine: "is started but doesn't have any video in it yet",
      resumePath: `/programs/${latest.id}/edit`,
      hasVideo: false,
    };
  }
  return {
    state: "C",
    statusLine: "is built but hasn't gone live yet",
    resumePath: `/programs/${latest.id}/edit`,
    hasVideo: true,
  };
}

/** Smallest step that is due (offset elapsed) and not yet sent, or null. */
export function nextDueStep(createdAt: Date, sentSteps: Set<number>, now: Date): number | null {
  const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / DAY_MS);
  for (let step = 1; step <= TOTAL_STEPS; step++) {
    if (sentSteps.has(step)) continue;
    if (STEP_OFFSET_DAYS[step - 1] <= daysSince) return step;
  }
  return null;
}

function firstNameOf(name: string | null): string {
  const n = (name || "").trim().split(/\s+/)[0];
  return n || "there";
}

function fromAddress(): string {
  return (
    process.env.NURTURE_FROM_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.EMAIL_FROM ||
    "JourneyLine <noreply@journeyline.ai>"
  );
}

export interface NurtureCronSummary {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  byStep: Record<number, number>;
}

/**
 * One pass: find due creators, send each their next step (one per run), log it.
 * Idempotent — a NurtureSend row per (user, step) prevents duplicates.
 */
export async function runNurtureCron(now: Date = new Date()): Promise<NurtureCronSummary> {
  const oldestCutoff = new Date(now.getTime() - STEP_OFFSET_DAYS[0] * DAY_MS); // ≥1 day old
  const windowStart = new Date(now.getTime() - MAX_SIGNUP_AGE_DAYS * DAY_MS);

  const creators = (await prisma.user.findMany({
    where: {
      role: "CREATOR",
      marketingUnsubscribedAt: null,
      createdAt: { lte: oldestCutoff, gte: windowStart },
      programs: { none: { published: true } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      programs: {
        select: { id: true, published: true, createdAt: true, _count: { select: { videos: true } } },
        orderBy: { createdAt: "desc" },
      },
      nurtureSends: { select: { step: true } },
    },
  })) as CreatorRow[];

  const summary: NurtureCronSummary = {
    scanned: creators.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    byStep: {},
  };

  const from = fromAddress();
  const companyAddress = process.env.COMPANY_ADDRESS || "";

  for (const c of creators) {
    const sentSteps = new Set(c.nurtureSends.map((s) => s.step));
    const step = nextDueStep(c.createdAt, sentSteps, now);
    if (step === null) {
      summary.skipped++;
      continue;
    }

    const st = resolveState(c);
    const vars: NurtureVars = {
      firstName: firstNameOf(c.name),
      statusLine: st.statusLine,
      resumeUrl: absoluteUrl(st.resumePath),
      unsubscribeUrl: absoluteUrl(
        `/api/email/unsubscribe?u=${encodeURIComponent(c.id)}&t=${makeUnsubToken(c.id)}`,
      ),
      preferencesUrl: absoluteUrl("/dashboard/settings"),
      companyAddress,
      assetBase: absoluteUrl("/email"),
      hasVideo: st.hasVideo,
    };

    let rendered;
    try {
      rendered = renderNurtureEmail(step, vars);
    } catch (err) {
      logger.error({ operation: "nurture.render_error", userId: c.id, step }, err);
      summary.failed++;
      continue;
    }

    const ok = await sendEmail({
      to: c.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      from,
      replyTo: from,
    });

    if (!ok) {
      summary.failed++;
      continue;
    }

    try {
      await prisma.nurtureSend.create({ data: { userId: c.id, step } });
    } catch {
      // Unique (userId, step) violation on a concurrent run — email still sent once.
    }

    summary.sent++;
    summary.byStep[step] = (summary.byStep[step] || 0) + 1;
    logger.info({ operation: "nurture.sent", userId: c.id, step, state: st.state });
  }

  return summary;
}

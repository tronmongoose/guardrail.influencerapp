import { render } from "@react-email/render";
import * as React from "react";
import { logger } from "./logger";
import { WelcomeLearner } from "@/emails/WelcomeLearner";
import { CreatorEnrollment } from "@/emails/CreatorEnrollment";
import { MagicLinkResend } from "@/emails/MagicLinkResend";
import { ProgramCompletion } from "@/emails/ProgramCompletion";
import { ProgramReady } from "@/emails/ProgramReady";
import {
  getProgramPreview,
  getCreatorLifetimeStats,
  formatCents,
  absoluteUrl,
} from "./email-helpers";
import { resolvePayoutInfo, formatPayoutDate } from "./stripe-payout";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send an email via Resend, or log to console in dev when no key is set.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  from,
  replyTo,
}: SendEmailOptions): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.EMAIL_FROM || "JourneyLine <noreply@journeyline.ai>";

  if (resendApiKey) {
    try {
      const payload: Record<string, unknown> = {
        from: from || defaultFrom,
        to,
        subject,
        text,
        html: html || text,
      };
      if (replyTo) payload.reply_to = replyTo;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn({ operation: "email.send_failed", to, error: errorText });
        return false;
      }

      logger.info({ operation: "email.sent", to, subject });
      return true;
    } catch (error) {
      logger.error({ operation: "email.send_error", to }, error);
      return false;
    }
  }

  if (process.env.NODE_ENV === "production") {
    logger.warn({
      operation: "email.skipped_no_key",
      to,
      subject,
      message: "RESEND_API_KEY is not set — email was NOT sent.",
    });
    return false;
  }

  logger.info({
    operation: "email.dev_preview",
    to,
    subject,
    from: from || defaultFrom,
    replyTo,
    body: text,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Branded learner welcome (post-purchase)
// ---------------------------------------------------------------------------

interface SendLearnerWelcomeArgs {
  learnerEmail: string;
  programId: string;
  magicLinkUrl: string;
  creator: { name: string | null; email: string };
}

/**
 * Branded post-purchase email. Looks like it's from the creator (From: "Coach
 * Name via JourneyLine"; Reply-To: creator email). Embeds the magic link as
 * the primary CTA so this single email handles both "welcome" and "log in".
 */
export async function sendLearnerWelcomeEmail({
  learnerEmail,
  programId,
  magicLinkUrl,
  creator,
}: SendLearnerWelcomeArgs): Promise<boolean> {
  const preview = await getProgramPreview(programId);
  if (!preview) {
    logger.warn({ operation: "email.welcome.program_missing", programId });
    return false;
  }

  const creatorName = creator.name?.trim() || "Your coach";
  const fallbackUrl = absoluteUrl(`/learn/${programId}`);

  const html = await render(
    React.createElement(WelcomeLearner, {
      creatorName,
      creatorAvatarUrl: preview.creatorAvatarUrl,
      programTitle: preview.title,
      targetTransformation: preview.targetTransformation,
      lessonCount: preview.lessonCount,
      totalMinutes: preview.totalMinutes,
      firstLessonTitles: preview.firstLessonTitles,
      heroImageUrl: preview.heroImageUrl,
      magicLinkUrl,
      fallbackUrl,
      brand: preview.brand,
      appUrl: absoluteUrl("/"),
    }),
  );

  const text = [
    `${creatorName} just sent you ${preview.title}.`,
    preview.targetTransformation || "",
    "",
    `Open your program: ${magicLinkUrl}`,
    "",
    "This link works for 24 hours. After that, request a fresh one anytime at:",
    fallbackUrl,
    "",
    `Reply to this email to chat with ${creatorName} directly.`,
  ]
    .filter(Boolean)
    .join("\n");

  const fromDomain = (process.env.EMAIL_FROM_ADDRESS || "noreply@journeyline.ai").trim();
  const safeName = creatorName.replace(/[\r\n"]/g, "").slice(0, 60);
  const from = `${safeName} via JourneyLine <${fromDomain}>`;

  return sendEmail({
    to: learnerEmail,
    subject: `Welcome to ${preview.title}`,
    text,
    html,
    from,
    replyTo: creator.email,
  });
}

// ---------------------------------------------------------------------------
// Creator enrollment notification ("you just got paid" / "new student")
// ---------------------------------------------------------------------------

interface SendCreatorEnrollmentArgs {
  creator: { id: string; email: string; name: string | null };
  programTitle: string;
  learnerEmail: string;
  /** When set, fetches payout timing + amount from Stripe. */
  stripeSessionId?: string | null;
  /** Fallback amount in cents when Stripe lookup is unavailable (e.g. free). */
  fallbackAmountCents?: number;
  fallbackCurrency?: string;
}

export async function sendCreatorEnrollmentEmail({
  creator,
  programTitle,
  learnerEmail,
  stripeSessionId,
  fallbackAmountCents,
  fallbackCurrency = "usd",
}: SendCreatorEnrollmentArgs): Promise<boolean> {
  const stats = await getCreatorLifetimeStats(creator.id);

  let variant: "paid" | "free" = "free";
  let amountFormatted: string | undefined;
  let payoutAvailableOn: string | null = null;

  if (stripeSessionId) {
    const payout = await resolvePayoutInfo(stripeSessionId);
    const amountCents = payout.netAmountCents ?? payout.grossAmountCents ?? fallbackAmountCents ?? 0;
    if (amountCents > 0) {
      variant = "paid";
      amountFormatted = formatCents(amountCents, payout.currency || fallbackCurrency);
      payoutAvailableOn = payout.availableOn ? formatPayoutDate(payout.availableOn) : null;
    }
  } else if (fallbackAmountCents && fallbackAmountCents > 0) {
    variant = "paid";
    amountFormatted = formatCents(fallbackAmountCents, fallbackCurrency);
  }

  const dashboardUrl = absoluteUrl("/dashboard");
  const lifetimeGrossFormatted = formatCents(stats.grossEarnedCents, fallbackCurrency);

  const html = await render(
    React.createElement(CreatorEnrollment, {
      variant,
      creatorName: creator.name || "",
      programTitle,
      learnerEmail,
      amountFormatted,
      payoutAvailableOn,
      lifetimeEnrollmentCount: stats.enrollmentCount,
      lifetimeGrossFormatted,
      dashboardUrl,
      appUrl: absoluteUrl("/"),
    }),
  );

  const headline = variant === "paid" ? "You just got paid" : "You got a new student";
  const subject =
    variant === "paid"
      ? `${headline} — ${programTitle}`
      : `${headline} — ${programTitle}`;

  const text = [
    `${headline}.`,
    "",
    variant === "paid" && amountFormatted ? `${amountFormatted}` : "",
    `${learnerEmail} ${variant === "paid" ? "signed up for" : "just enrolled in"} ${programTitle}.`,
    "",
    variant === "paid"
      ? payoutAvailableOn
        ? `Payout: funds arrive around ${payoutAvailableOn} on your normal Stripe schedule.`
        : "Payout: funds typically arrive in 2–7 days on your normal Stripe schedule."
      : "",
    "",
    `Lifetime: ${stats.enrollmentCount} enrollments · ${lifetimeGrossFormatted} earned`,
    "",
    `Dashboard: ${dashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: creator.email,
    subject,
    text,
    html,
  });
}

// ---------------------------------------------------------------------------
// Branded program completion ("you finished it") — fires once per entitlement
// ---------------------------------------------------------------------------

interface SendProgramCompletionArgs {
  learnerEmail: string;
  programId: string;
  enrolledAt: Date;
  creator: { name: string | null; email: string };
}

/**
 * Sent when a learner completes every action in every lesson of a program.
 * Mirrors the welcome email's branded "creator via JourneyLine" From line so
 * the celebration feels like it's coming from the coach. Idempotency is the
 * caller's responsibility (gate on Entitlement.completionEmailSentAt).
 */
export async function sendProgramCompletionEmail({
  learnerEmail,
  programId,
  enrolledAt,
  creator,
}: SendProgramCompletionArgs): Promise<boolean> {
  const preview = await getProgramPreview(programId);
  if (!preview) {
    logger.warn({ operation: "email.completion.program_missing", programId });
    return false;
  }

  const creatorName = creator.name?.trim() || "Your coach";
  const revisitUrl = absoluteUrl(`/learn/${programId}`);
  const daysEnrolled = Math.max(
    1,
    Math.round((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const html = await render(
    React.createElement(ProgramCompletion, {
      creatorName,
      creatorAvatarUrl: preview.creatorAvatarUrl,
      programTitle: preview.title,
      lessonCount: preview.lessonCount,
      totalMinutes: preview.totalMinutes,
      daysEnrolled,
      heroImageUrl: preview.heroImageUrl,
      revisitUrl,
      brand: preview.brand,
      appUrl: absoluteUrl("/"),
    }),
  );

  const text = [
    `You finished ${preview.title}.`,
    "",
    "That's the whole program — every lesson, every action. Real follow-through.",
    "",
    `Revisit anytime: ${revisitUrl}`,
    "",
    `Reply to tell ${creatorName} how it went — they'll see it directly.`,
  ].join("\n");

  const fromDomain = (process.env.EMAIL_FROM_ADDRESS || "noreply@journeyline.ai").trim();
  const safeName = creatorName.replace(/[\r\n"]/g, "").slice(0, 60);
  const from = `${safeName} via JourneyLine <${fromDomain}>`;

  return sendEmail({
    to: learnerEmail,
    subject: `You finished ${preview.title}`,
    text,
    html,
    from,
    replyTo: creator.email,
  });
}

// ---------------------------------------------------------------------------
// Magic link resend (used by /api/auth/resend-magic-link)
// ---------------------------------------------------------------------------

export async function sendMagicLinkEmail(
  email: string,
  magicLinkUrl: string,
  programTitle?: string,
): Promise<boolean> {
  const html = await render(
    React.createElement(MagicLinkResend, {
      programTitle,
      magicLinkUrl,
      appUrl: absoluteUrl("/"),
    }),
  );

  const text = [
    programTitle ? `Open ${programTitle}.` : "Your JourneyLine access link.",
    "",
    `Sign in: ${magicLinkUrl}`,
    "",
    "This link works for 24 hours and can only be used once.",
  ].join("\n");

  return sendEmail({
    to: email,
    subject: programTitle ? `Open ${programTitle}` : "Your JourneyLine access link",
    text,
    html,
  });
}

// ---------------------------------------------------------------------------
// Admin notifications (unchanged plain-text; internal use only)
// ---------------------------------------------------------------------------

export async function notifyAdminNewCreator(user: {
  email: string;
  name?: string | null;
  id: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;

  const label = user.name || user.email;
  await sendEmail({
    to: adminEmail,
    subject: `[Journeyline] New creator signup: ${label}`,
    text: `New creator signed up on Journeyline.\n\nName: ${user.name || "—"}\nEmail: ${user.email}\nUser ID: ${user.id}\nTime: ${new Date().toISOString()}\n\n--\nJourneyline Admin Notifications`,
  });
}

export async function notifyAdminProgramPublished(
  program: { id: string; title: string; slug: string; priceInCents: number; currency: string },
  creator: { email: string; name?: string | null },
  stats: { weekCount: number; sessionCount: number },
): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.journeyline.ai";
  const price = program.priceInCents === 0
    ? "Free"
    : `${(program.priceInCents / 100).toFixed(2)} ${program.currency.toUpperCase()}`;

  await sendEmail({
    to: adminEmail,
    subject: `[Journeyline] Program published: "${program.title}"`,
    text: `A program was just published on Journeyline.\n\nProgram: ${program.title}\nCreator: ${creator.name || "—"} (${creator.email})\nPrice: ${price}\nStructure: ${stats.weekCount} week(s), ${stats.sessionCount} session(s)\nPublic URL: ${appUrl}/p/${program.slug}\n\n--\nJourneyline Admin Notifications`,
  });
}

export async function notifyAdminEnrollment(
  learner: { email: string; name?: string | null },
  program: { title: string; id: string },
  enrollmentType: "paid" | "free" | "promo",
): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;

  await sendEmail({
    to: adminEmail,
    subject: `[Journeyline] New enrollment (${enrollmentType}): "${program.title}"`,
    text: `A learner just enrolled in a program.\n\nLearner: ${learner.name || "Anonymous"} (${learner.email})\nProgram: ${program.title}\nEnrollment type: ${enrollmentType}\nProgram ID: ${program.id}\n\n--\nJourneyline Admin Notifications`,
  });
}

export async function sendProgramReadyEmail(
  to: string,
  firstName: string,
  programTitle: string,
  programId: string,
): Promise<boolean> {
  const editUrl = absoluteUrl(`/programs/${programId}/edit`);
  const preview = await getProgramPreview(programId);

  const html = await render(
    React.createElement(ProgramReady, {
      firstName,
      programTitle: preview?.title ?? programTitle,
      targetTransformation: preview?.targetTransformation ?? null,
      lessonCount: preview?.lessonCount ?? 0,
      totalMinutes: preview?.totalMinutes ?? null,
      heroImageUrl: preview?.heroImageUrl ?? null,
      editUrl,
      brand: preview?.brand ?? { accent: "#06b6d4", accentText: "#ffffff" },
      appUrl: absoluteUrl("/"),
    }),
  );

  const greetingName = firstName?.trim() ? firstName.split(" ")[0] : "there";
  const text = [
    `Nice work, ${greetingName}.`,
    "",
    `${preview?.title ?? programTitle} has been generated and is waiting for your review.`,
    "",
    `Open your program: ${editUrl}`,
    "",
    "Edit the curriculum, set your price, and publish whenever you're ready.",
    "",
    "Heads up — nothing is live until you hit publish.",
  ].join("\n");

  return sendEmail({
    to,
    subject: `Your program "${preview?.title ?? programTitle}" is ready to review`,
    text,
    html,
  });
}

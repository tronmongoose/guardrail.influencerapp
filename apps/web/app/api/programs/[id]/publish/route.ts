import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { slugify } from "@/lib/slug";
import { logger } from "@/lib/logger";

interface ValidationError {
  field: string;
  message: string;
}

async function generateUniqueSlug(title: string, programId: string): Promise<string> {
  const baseSlug = slugify(title);

  // Check if current slug is already unique
  const existing = await prisma.program.findFirst({
    where: {
      slug: baseSlug,
      id: { not: programId },
    },
  });

  if (!existing) {
    return baseSlug;
  }

  // Add suffix for uniqueness
  for (let i = 2; i <= 100; i++) {
    const candidateSlug = `${baseSlug}-${i}`;
    const collision = await prisma.program.findFirst({
      where: {
        slug: candidateSlug,
        id: { not: programId },
      },
    });
    if (!collision) {
      return candidateSlug;
    }
  }

  // Fallback: use programId suffix
  return `${baseSlug}-${programId.slice(0, 8)}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      weeks: {
        include: {
          sessions: {
            include: {
              actions: true,
            },
          },
        },
      },
      videos: true,
    },
  });

  if (!program || program.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validation
  const errors: ValidationError[] = [];

  // Required: Title
  if (!program.title || program.title.trim() === "" || program.title === "Untitled Program") {
    errors.push({ field: "title", message: "Program must have a title" });
  }

  // Required: At least 1 week
  if (program.weeks.length === 0) {
    errors.push({ field: "weeks", message: "Program must have at least one week" });
  }

  // Required: At least 1 session
  const totalSessions = program.weeks.reduce((sum, w) => sum + w.sessions.length, 0);
  if (totalSessions === 0) {
    errors.push({ field: "sessions", message: "Program must have at least one session" });
  }

  // Required: Duration
  if (!program.durationWeeks || program.durationWeeks < 1) {
    errors.push({ field: "durationWeeks", message: "Program must have a valid duration" });
  }

  // Required: Skin selected
  if (!program.skinId) {
    errors.push({ field: "skinId", message: "Program must have a theme selected" });
  }

  // Warn if no videos (not blocking, but included in response)
  const hasVideos = program.videos.length > 0;

  // Check Stripe Connect requirement for paid programs
  if (program.priceInCents > 0) {
    if (!user.stripeOnboardingComplete) {
      return NextResponse.json(
        {
          error: "Stripe account required",
          code: "STRIPE_REQUIRED",
          message: "To publish a paid program, please connect your Stripe account first.",
        },
        { status: 402 }
      );
    }
  }

  if (errors.length > 0) {
    logger.warn({
      operation: "program.publish.validation_failed",
      programId: id,
      errorCount: errors.length,
    });
    return NextResponse.json(
      {
        error: "Program is not ready to publish",
        validationErrors: errors,
      },
      { status: 400 }
    );
  }

  // Generate unique slug if needed
  let slug = program.slug;
  if (!slug || slug.startsWith("untitled-")) {
    slug = await generateUniqueSlug(program.title, program.id);
  }

  // If program has a price and Stripe is configured, create product/price
  let stripeProductId = program.stripeProductId;
  let stripePriceId = program.stripePriceId;

  if (program.priceInCents > 0 && isStripeConfigured()) {
    try {
      const stripe = getStripe();

      // Create or update Stripe product
      if (!stripeProductId) {
        const product = await stripe.products.create({
          name: program.title,
          description: program.description || undefined,
          metadata: { programId: program.id },
        });
        stripeProductId = product.id;
      } else {
        await stripe.products.update(stripeProductId, {
          name: program.title,
          description: program.description || undefined,
        });
      }

      // Create new price (Stripe prices are immutable, so we always create new)
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: program.priceInCents,
        currency: program.currency,
      });
      stripePriceId = price.id;
    } catch (err) {
      logger.error(
        { operation: "program.publish.stripe_failed", programId: id },
        err
      );
      return NextResponse.json(
        { error: "Failed to configure payment. Please try again." },
        { status: 502 }
      );
    }
  }

  const updated = await prisma.program.update({
    where: { id },
    data: {
      published: true,
      slug,
      stripeProductId,
      stripePriceId,
    },
  });

  logger.info({
    operation: "program.publish.success",
    programId: id,
    slug,
    hasVideos,
    weekCount: program.weeks.length,
    sessionCount: totalSessions,
    priceInCents: program.priceInCents,
  });

  return NextResponse.json({
    ...updated,
    shareUrl: `/p/${slug}`,
  });
}

import { prisma } from "./prisma";
import { logger } from "./logger";

const MAGIC_LINK_EXPIRY_HOURS = 24;

interface CreateMagicLinkOptions {
  email: string;
  name?: string;
  programId?: string;
}

/**
 * Creates or retrieves a learner user and generates a magic link token.
 */
export async function createMagicLink({
  email,
  name,
  programId,
}: CreateMagicLinkOptions): Promise<{ token: string; userId: string; isNewUser: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        role: "LEARNER",
      },
    });

    logger.info({
      operation: "magic_link.user_created",
      userId: user.id,
      email: normalizedEmail,
    });
  }

  // Create magic link token
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + MAGIC_LINK_EXPIRY_HOURS);

  const magicLink = await prisma.magicLink.create({
    data: {
      userId: user.id,
      programId,
      expiresAt,
    },
  });

  logger.info({
    operation: "magic_link.created",
    userId: user.id,
    programId,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    token: magicLink.token,
    userId: user.id,
    isNewUser,
  };
}

/**
 * Validates a magic link token and returns the associated user.
 * Marks the token as used after successful validation.
 */
export async function validateMagicLink(token: string): Promise<{
  valid: boolean;
  userId?: string;
  programId?: string | null;
  error?: string;
}> {
  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!magicLink) {
    return { valid: false, error: "Invalid link" };
  }

  if (magicLink.usedAt) {
    return { valid: false, error: "Link already used" };
  }

  if (new Date() > magicLink.expiresAt) {
    return { valid: false, error: "Link expired" };
  }

  // Mark as used
  await prisma.magicLink.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() },
  });

  logger.info({
    operation: "magic_link.validated",
    userId: magicLink.userId,
    programId: magicLink.programId ?? undefined,
  });

  return {
    valid: true,
    userId: magicLink.userId,
    programId: magicLink.programId,
  };
}

/**
 * Generates a magic link URL.
 * Relative by default (for browser redirects). Pass absolute=true for email links.
 */
export function getMagicLinkUrl(token: string, programId?: string, absolute = false): string {
  const path = `/auth/magic?token=${token}${programId ? `&programId=${programId}` : ""}`;
  if (!absolute) return path;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}${path}`;
}

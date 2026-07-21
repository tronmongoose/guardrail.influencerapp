import { auth, currentUser } from "@clerk/nextjs/server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { notifyAdminNewCreator } from "./email";

const LEARNER_SESSION_COOKIE = "guiderail_learner_session";

/**
 * Get or create the DB User from the current Clerk session.
 * This is for creators who use Clerk authentication.
 */
export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";

  // If a user already exists with this email (e.g. a learner who purchased
  // via magic link), link the Clerk account to that existing record.
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    const promoted = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId: userId,
        role: "CREATOR",
        name: existingByEmail.name ?? (clerkUser.firstName
          ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
          : undefined),
      },
    });
    // Defer with after() so Vercel keeps the function instance alive until the
    // Resend call finishes — a bare fire-and-forget send is dropped when the
    // response returns and the serverless instance freezes.
    after(() => notifyAdminNewCreator(promoted).catch(() => {}));
    return promoted;
  }

  try {
    const newUser = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name: clerkUser.firstName
          ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
          : undefined,
        role: "CREATOR",
      },
    });
    after(() => notifyAdminNewCreator(newUser).catch(() => {}));
    return newUser;
  } catch (err) {
    // P2002 = unique constraint. A concurrent request from the same Clerk
    // session won the create; re-fetch and return its row instead of 500ing.
    if ((err as { code?: string })?.code === "P2002") {
      const recovered =
        (await prisma.user.findUnique({ where: { clerkId: userId } })) ??
        (await prisma.user.findUnique({ where: { email } }));
      if (recovered) return recovered;
    }
    throw err;
  }
}

/**
 * Get the learner user from the magic link session cookie.
 * This is for learners who use magic link authentication.
 */
export async function getLearnerSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(LEARNER_SESSION_COOKIE);

  if (!sessionCookie?.value) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionCookie.value },
  });

  return user;
}

/**
 * Get the current user - checks both Clerk (creator) and magic link (learner) sessions.
 * Prioritizes Clerk auth for creators, falls back to magic link session for learners.
 */
export async function getCurrentUser() {
  // First try Clerk auth (for creators)
  const clerkUser = await getOrCreateUser();
  if (clerkUser) return clerkUser;

  // Fall back to magic link session (for learners)
  return getLearnerSession();
}

/**
 * Like `getCurrentUser` but program-aware. When the request carries BOTH a
 * Clerk session (creator) AND a learner cookie (purchased as a learner), and
 * only one of those identities holds an entitlement for the given program,
 * returns that one. Resolves the "creator-testing-as-learner" case where the
 * Clerk identity would otherwise win and fail the entitlement check.
 *
 * Used on the program viewer (/learn/*) and sales page (/p/*) where the
 * relevant identity is whichever one actually paid for this program.
 */
export async function getCurrentUserForProgram(programId: string) {
  const [clerkUser, learnerUser] = await Promise.all([
    getOrCreateUser(),
    getLearnerSession(),
  ]);

  // Common case: only one identity present.
  if (!clerkUser) return learnerUser;
  if (!learnerUser) return clerkUser;
  if (clerkUser.id === learnerUser.id) return clerkUser;

  // Both present and distinct — pick the one that owns the entitlement.
  // Creators viewing their own program don't need an entitlement; that
  // case is handled by the page-level isCreator check.
  const [clerkEnt, learnerEnt] = await Promise.all([
    prisma.entitlement.findUnique({
      where: { userId_programId: { userId: clerkUser.id, programId } },
    }),
    prisma.entitlement.findUnique({
      where: { userId_programId: { userId: learnerUser.id, programId } },
    }),
  ]);

  const clerkActive = clerkEnt?.status === "ACTIVE";
  const learnerActive = learnerEnt?.status === "ACTIVE";

  if (learnerActive && !clerkActive) return learnerUser;
  if (clerkActive && !learnerActive) return clerkUser;

  // Both or neither active — fall back to existing precedence (Clerk wins).
  return clerkUser;
}

/**
 * Check if user has entitlement to a program.
 */
export async function hasEntitlement(userId: string, programId: string) {
  const ent = await prisma.entitlement.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  return ent?.status === "ACTIVE";
}

/**
 * Get entitlement with full details for a user/program pair.
 */
export async function getEntitlement(userId: string, programId: string) {
  return prisma.entitlement.findUnique({
    where: { userId_programId: { userId, programId } },
    include: {
      weekCompletions: true,
    },
  });
}

import { prisma } from "@/lib/prisma";
import { getCurrentUserForProgram, getEntitlement } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { LearnerTimeline } from "./timeline";
import { resolveTokens } from "@/lib/resolve-tokens";
import { getTokenCSSVars } from "@/lib/skin-bridge";
import { SkinThemeProvider } from "@/components/skins/SkinThemeProvider";
import { SkinDecorationLayer } from "@/components/skins/SkinDecorationLayer";
import { RequestAccessLink } from "@/components/learn/RequestAccessLink";

export default async function LearnPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;

  const user = await getCurrentUserForProgram(programId);

  // No session → render the "send me a sign-in link" fallback inline instead of
  // redirecting away. Lets returning learners re-enter from any /learn URL.
  if (!user) {
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: {
        title: true,
        published: true,
        creator: { select: { name: true } },
      },
    });
    if (!program || !program.published) notFound();
    return (
      <RequestAccessLink
        programId={programId}
        programTitle={program.title}
        creatorName={program.creator.name}
      />
    );
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      creator: { select: { name: true } },
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          sessions: {
            orderBy: { orderIndex: "asc" },
            include: {
              actions: {
                orderBy: { orderIndex: "asc" },
                include: {
                  youtubeVideo: true,
                  progress: { where: { userId: user.id } },
                },
              },
              compositeSession: {
                include: {
                  clips: {
                    orderBy: { orderIndex: "asc" },
                    select: {
                      id: true,
                      startSeconds: true,
                      endSeconds: true,
                      chapterTitle: true,
                      orderIndex: true,
                      youtubeVideo: { select: { muxPlaybackId: true, thumbnailUrl: true, videoId: true, title: true, url: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!program) notFound();

  // Creators can always view their own program (even unpublished)
  const isCreator = program.creatorId === user.id;

  let currentWeek: number;
  let completedWeeks: number[];
  let enrolledAt: string;

  if (isCreator) {
    // Creators see all weeks unlocked
    currentWeek = program.durationWeeks;
    completedWeeks = [];
    enrolledAt = program.createdAt.toISOString();
  } else {
    if (!program.published) notFound();

    const entitlement = await getEntitlement(user.id, programId);
    if (!entitlement || entitlement.status !== "ACTIVE") {
      redirect("/p/" + program.slug);
    }

    completedWeeks = entitlement.weekCompletions.map((wc) => wc.weekNumber);
    enrolledAt = entitlement.createdAt.toISOString();

    if (program.pacingMode === "DRIP_BY_WEEK") {
      const now = new Date();
      const daysSinceEnrollment = Math.floor(
        (now.getTime() - entitlement.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      currentWeek = Math.min(
        Math.floor(daysSinceEnrollment / 7) + 1,
        program.durationWeeks
      );
    } else {
      currentWeek = entitlement.currentWeek;
    }
  }

  const tokens = await resolveTokens(program);
  const skinCSSVars = getTokenCSSVars(tokens);

  // Map private blob URL to public proxy URL for avatar rendering
  const avatarProxyUrl = program.creatorAvatarUrl
    ? `/api/programs/${program.id}/avatar`
    : null;

  return (
    <SkinThemeProvider tokens={tokens}>
      <SkinDecorationLayer skinId={program.skinId} />
      <LearnerTimeline
        program={program}
        userId={user.id}
        enrolledAt={enrolledAt}
        currentWeek={currentWeek}
        completedWeeks={completedWeeks}
        pacingMode={program.pacingMode}
        skinId={program.skinId}
        skinCSSVars={skinCSSVars}
        creatorName={program.creator.name}
        creatorAvatarUrl={avatarProxyUrl}
        targetTransformation={program.targetTransformation}
        durationWeeks={program.durationWeeks}
      />
    </SkinThemeProvider>
  );
}

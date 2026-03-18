import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const SYSTEM_PROMPT = `You are organizing video clips into a structured learning program. Given these clips and the creator's instructions, return JSON with:
- groups: array of {clipIndexes: number[], title: string, combinable: boolean}
- sectionBoundaries: array of clip indexes where new sessions start
- summary: plain English description of what you decided (2-3 sentences)

Duration guidance: under 20s = micro clip (combinable), 30s-3min = normal lesson, over 15min = consider splitting.
Return ONLY valid JSON with no markdown or extra explanation.`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: {
      creatorId: true,
      videos: {
        select: { id: true, title: true, durationSeconds: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (program.creatorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { videoIds, intentText } = (await req.json()) as {
    videoIds: string[];
    intentText?: string;
  };

  if (!videoIds || videoIds.length === 0) {
    return NextResponse.json({ error: "No videos provided" }, { status: 400 });
  }

  // Build ordered clip list using the client's ordering, with server-fetched metadata
  const videoMap = new Map(program.videos.map((v) => [v.id, v]));
  const clips = videoIds
    .map((id, index) => {
      const v = videoMap.get(id);
      if (!v) return null;
      return {
        index,
        title: v.title || `Clip ${index + 1}`,
        durationSeconds: v.durationSeconds ?? null,
      };
    })
    .filter(Boolean) as { index: number; title: string; durationSeconds: number | null }[];

  if (clips.length === 0) {
    return NextResponse.json({ error: "No matching videos found" }, { status: 400 });
  }

  const clipSummary = clips
    .map((c) =>
      `[${c.index}] "${c.title}"${c.durationSeconds != null ? ` (${c.durationSeconds}s)` : ""}`
    )
    .join("\n");

  const userMessage = `Clips:\n${clipSummary}\n\nCreator instructions: ${intentText?.trim() || "(none provided)"}`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  let rawJson: string;

  try {
    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      rawJson = data?.content?.[0]?.text?.trim();
    } else if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      rawJson = data?.choices?.[0]?.message?.content?.trim();
    } else {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = JSON.parse(rawJson);
    const { groups, sectionBoundaries, summary } = parsed;

    // Persist to program for use during session generation
    await prisma.program.update({
      where: { id: programId },
      data: {
        videoGroups: groups ?? [],
        sectionBoundaries: sectionBoundaries ?? [],
      },
    });

    logger.info({
      operation: "ai.intent",
      programId,
      clipCount: clips.length,
      groupCount: groups?.length ?? 0,
    });

    return NextResponse.json({ groups, sectionBoundaries, summary });
  } catch (err) {
    logger.error({ operation: "ai.intent_failed", programId }, err);
    return NextResponse.json({ error: "Failed to analyze video intent" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: programId, sessionId } = await params;

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      week: { include: { program: { select: { creatorId: true, id: true } } } },
      actions: {
        where: { type: "WATCH" },
        orderBy: { orderIndex: "asc" },
        include: {
          youtubeVideo: { include: { analysis: true } },
        },
      },
      compositeSession: {
        include: {
          clips: {
            orderBy: { orderIndex: "asc" },
            take: 1,
            include: {
              youtubeVideo: { include: { analysis: true } },
            },
          },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.week.program.creatorId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.week.program.id !== programId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find video analysis — prefer composite clips, fall back to WATCH actions
  let analysis: {
    summary: string;
    fullTranscript: string | null;
    segments: unknown;
  } | null = null;

  const firstClipVideo = session.compositeSession?.clips[0]?.youtubeVideo;
  if (firstClipVideo?.analysis) {
    analysis = firstClipVideo.analysis;
  } else {
    for (const action of session.actions) {
      if (action.youtubeVideo?.analysis) {
        analysis = action.youtubeVideo.analysis;
        break;
      }
    }
  }

  if (!analysis) {
    return NextResponse.json(
      { error: "No video analysis available. Analyze the video first." },
      { status: 404 }
    );
  }

  const transcriptText = (analysis.fullTranscript ?? analysis.summary).slice(0, 8000);
  const segmentsText = JSON.stringify(
    (Array.isArray(analysis.segments) ? analysis.segments : []).slice(0, 15)
  );

  const prompt = `Based on this video transcript and analysis, suggest:
- A concise session description (2 sentences max)
- 3 key takeaways (short, actionable)
- 1 PRACTICE action prompt (something the learner can do)
- 1 REFLECT action prompt (a question to journal about)

Video summary: ${analysis.summary}

Transcript excerpt:
${transcriptText}

Segments:
${segmentsText}

Return ONLY a JSON object with this exact shape, no markdown:
{
  "description": "...",
  "keyTakeaways": ["...", "...", "..."],
  "actions": [
    { "type": "DO", "title": "..." },
    { "type": "REFLECT", "title": "..." }
  ]
}`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  let raw: string;

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
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "AI service error" }, { status: 502 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    raw = data?.content?.[0]?.text?.trim() ?? "";
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
          {
            role: "system",
            content:
              "You are a curriculum design assistant. Always respond with valid JSON only, no markdown.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "AI service error" }, { status: 502 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  } else {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Invalid AI response" }, { status: 502 });

  try {
    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }
}

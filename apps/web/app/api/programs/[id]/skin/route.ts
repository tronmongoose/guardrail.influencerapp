import { NextRequest, NextResponse } from "next/server";
import type { SkinTokens } from "@guide-rail/shared";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSkinFromVibe } from "@/lib/generate-skin";

/** POST /api/programs/[id]/skin — generate or refine a custom skin for this program.
 *
 *  Body (optional): { refinementPrompt?: string }
 *  - Absent: seed mode. Creates a new CustomSkin row (existing behavior).
 *  - Present: refine mode. Regenerates against the program's current customSkin
 *    tokens and updates that row in place. If no customSkin exists yet, falls
 *    back to seed behavior.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programId } = await params;

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: {
      id: true,
      creatorId: true,
      title: true,
      targetTransformation: true,
      vibePrompt: true,
      customSkinId: true,
    },
  });
  if (!program || program.creatorId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Body is optional — tolerate empty POSTs from the existing editor button.
  let refinementPrompt: string | null = null;
  let seedPrompt: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.refinementPrompt === "string" && body.refinementPrompt.trim()) {
      refinementPrompt = body.refinementPrompt.trim();
    }
    if (body && typeof body.seedPrompt === "string" && body.seedPrompt.trim()) {
      seedPrompt = body.seedPrompt.trim();
    }
  } catch {
    // no body, fine
  }

  const existing = program.customSkinId
    ? await prisma.customSkin.findUnique({ where: { id: program.customSkinId } })
    : null;

  const isRefine = !!(refinementPrompt && existing);

  const tokens = await generateSkinFromVibe({
    title: program.title,
    targetTransformation: program.targetTransformation,
    // In seed mode, the user's fresh prompt overrides the program's stored
    // vibePrompt — otherwise typing into the Studio's "Describe the vibe" box
    // would silently fall back to whatever was last saved on the program row.
    vibePrompt: seedPrompt ?? program.vibePrompt,
    currentTokens: isRefine ? (existing!.tokens as unknown as SkinTokens) : undefined,
    refinementPrompt: isRefine ? refinementPrompt : undefined,
  });

  if (!tokens) {
    // LLM_PROVIDER=stub or parse failure
    return NextResponse.json({ customSkinId: null, tokens: null });
  }

  if (isRefine) {
    const updated = await prisma.customSkin.update({
      where: { id: existing!.id },
      data: { tokens: tokens as object },
    });
    return NextResponse.json({ customSkinId: updated.id, tokens });
  }

  const customSkin = await prisma.customSkin.create({
    data: {
      creatorId: user.id,
      name: `${program.title} – AI Skin`,
      tokens: tokens as object,
    },
  });

  await prisma.program.update({
    where: { id: programId },
    data: { customSkinId: customSkin.id, skinId: "classic-minimal" },
  });

  return NextResponse.json({ customSkinId: customSkin.id, tokens });
}

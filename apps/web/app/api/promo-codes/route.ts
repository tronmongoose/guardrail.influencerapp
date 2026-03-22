import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

interface PromoCodeRow {
  id: string;
  code: string;
  creatorId: string;
  programId: string | null;
  programTitle: string | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.$queryRaw<PromoCodeRow[]>`
    SELECT
      pc.id, pc.code, pc."creatorId", pc."programId",
      p.title AS "programTitle",
      pc."maxUses", pc.uses, pc.active, pc."expiresAt", pc."createdAt"
    FROM "PromoCode" pc
    LEFT JOIN "Program" p ON p.id = pc."programId"
    WHERE pc."creatorId" = ${user.id}
    ORDER BY pc."createdAt" DESC
  `;

  const codes = rows.map((r) => ({
    id: r.id,
    code: r.code,
    programId: r.programId,
    program: r.programTitle ? { title: r.programTitle } : null,
    maxUses: r.maxUses !== null ? Number(r.maxUses) : null,
    uses: Number(r.uses),
    active: r.active,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));

  return NextResponse.json(codes);
}

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { code, programId, maxUses, expiresAt } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const upperCode = code.toUpperCase().trim();
  if (!CODE_PATTERN.test(upperCode)) {
    return NextResponse.json(
      { error: "Code must be 3–20 characters: letters, numbers, or dashes only" },
      { status: 400 }
    );
  }

  if (programId) {
    const prog = await prisma.program.findFirst({ where: { id: programId, creatorId: user.id } });
    if (!prog) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }
  }

  const newId = randomUUID();
  const maxUsesVal: number | null = maxUses ? parseInt(maxUses, 10) : null;
  const expiresAtVal: Date | null = expiresAt ? new Date(expiresAt) : null;
  const programIdVal: string | null = programId || null;

  // Check uniqueness first
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "PromoCode" WHERE code = ${upperCode} LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "That code is already taken" }, { status: 409 });
  }

  await prisma.$executeRaw`
    INSERT INTO "PromoCode" (id, code, "creatorId", "programId", "maxUses", uses, active, "expiresAt", "createdAt")
    VALUES (
      ${newId},
      ${upperCode},
      ${user.id},
      ${programIdVal},
      ${maxUsesVal},
      0,
      true,
      ${expiresAtVal},
      now()
    )
  `;

  let programTitle: string | null = null;
  if (programIdVal) {
    const prog = await prisma.program.findUnique({ where: { id: programIdVal }, select: { title: true } });
    programTitle = prog?.title ?? null;
  }

  return NextResponse.json(
    {
      id: newId,
      code: upperCode,
      programId: programIdVal,
      program: programTitle ? { title: programTitle } : null,
      maxUses: maxUsesVal,
      uses: 0,
      active: true,
      expiresAt: expiresAtVal,
      createdAt: new Date(),
    },
    { status: 201 }
  );
}

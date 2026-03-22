import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface PromoRow {
  id: string;
  maxUses: number | null;
  uses: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, programId } = body;

  if (!code || !programId) {
    return NextResponse.json({ valid: false, message: "Missing code or program" });
  }

  const programs = await prisma.$queryRaw<Array<{ creatorId: string }>>`
    SELECT "creatorId" FROM "Program" WHERE id = ${programId} LIMIT 1
  `;

  if (!programs[0]) {
    return NextResponse.json({ valid: false, message: "Program not found" });
  }

  const { creatorId } = programs[0];
  const upperCode = code.toUpperCase();
  const now = new Date();

  // Raw SQL so PromoCode table works before Prisma client restart
  const rows = await prisma.$queryRaw<PromoRow[]>`
    SELECT id, "maxUses", uses FROM "PromoCode"
    WHERE code = ${upperCode}
      AND active = true
      AND "creatorId" = ${creatorId}
      AND ("programId" IS NULL OR "programId" = ${programId})
      AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
    LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json({ valid: false, message: "Invalid or expired promo code" });
  }

  const promo = rows[0];
  if (promo.maxUses !== null && promo.uses >= promo.maxUses) {
    return NextResponse.json({ valid: false, message: "This promo code has reached its usage limit" });
  }

  return NextResponse.json({ valid: true });
}

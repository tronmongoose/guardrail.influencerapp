import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Raw SQL so PromoCode table works before Prisma client restart
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "PromoCode" WHERE id = ${id} AND "creatorId" = ${user.id} LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$executeRaw`
    UPDATE "PromoCode" SET active = false WHERE id = ${id}
  `;

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isDebugUser } from "@/lib/debug-access";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ enabled: false });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { email: true },
  });

  return NextResponse.json({ enabled: isDebugUser(user?.email ?? null) });
}

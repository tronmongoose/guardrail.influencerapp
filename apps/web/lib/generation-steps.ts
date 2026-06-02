import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GenerationStepStatus = "running" | "ok" | "error";

export type GenerationStep = {
  stage: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  status: GenerationStepStatus;
  note?: string;
};

type UpdateExtras = {
  progress?: number;
  status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export async function beginStep(
  jobId: string,
  stage: string,
  note?: string,
  extras: UpdateExtras = {}
): Promise<void> {
  const entry: GenerationStep = {
    stage,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationMs: null,
    status: "running",
    ...(note ? { note } : {}),
  };

  await prisma.$executeRaw`
    UPDATE "GenerationJob"
    SET "steps" = COALESCE("steps", '[]'::jsonb) || ${JSON.stringify(entry)}::jsonb,
        "stage" = ${stage},
        "updatedAt" = NOW()
    WHERE "id" = ${jobId}
  `;

  if (extras.progress !== undefined || extras.status || extras.error !== undefined || extras.startedAt !== undefined || extras.completedAt !== undefined) {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        ...(extras.progress !== undefined ? { progress: extras.progress } : {}),
        ...(extras.status ? { status: extras.status } : {}),
        ...(extras.error !== undefined ? { error: extras.error } : {}),
        ...(extras.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
        ...(extras.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
      },
    });
  }
}

export async function endStep(
  jobId: string,
  status: "ok" | "error",
  note?: string,
  extras: UpdateExtras = {}
): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { steps: true },
  });
  if (!job) return;

  const steps = Array.isArray(job.steps)
    ? (job.steps as unknown as GenerationStep[])
    : [];
  if (steps.length === 0) return;

  const idx = [...steps].reverse().findIndex((s) => s.status === "running");
  if (idx === -1) return;
  const realIdx = steps.length - 1 - idx;
  const startedAt = new Date(steps[realIdx].startedAt).getTime();
  const endedAt = new Date();
  const updated: GenerationStep = {
    ...steps[realIdx],
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt,
    status,
    ...(note ? { note } : {}),
  };
  const nextSteps = [...steps];
  nextSteps[realIdx] = updated;

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      steps: nextSteps as unknown as Prisma.InputJsonValue,
      ...(extras.progress !== undefined ? { progress: extras.progress } : {}),
      ...(extras.status ? { status: extras.status } : {}),
      ...(extras.error !== undefined ? { error: extras.error } : {}),
      ...(extras.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
      ...(extras.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
    },
  });
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GenerationStep = {
  stage: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  status: "running" | "ok" | "error";
  note?: string;
};

type StatusResponse = {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: string | null;
  progress: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  isStale?: boolean;
  steps?: GenerationStep[];
};

type PastJob = {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: string | null;
  progress: number;
  error: string | null;
  steps: GenerationStep[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

interface Props {
  programId: string;
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}m ${r}s`;
}

function statusDot(status: "running" | "ok" | "error" | string): string {
  if (status === "running") return "bg-blue-400 animate-pulse";
  if (status === "ok") return "bg-green-500";
  if (status === "error") return "bg-red-500";
  return "bg-gray-400";
}

function StepRow({ step, now }: { step: GenerationStep; now: number }) {
  const live = step.status === "running"
    ? now - new Date(step.startedAt).getTime()
    : step.durationMs;
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-1.5 text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left hover:bg-gray-50"
      >
        <span className={`h-2 w-2 rounded-full ${statusDot(step.status)}`} />
        <span className="font-mono text-gray-800">{step.stage}</span>
        <span className="ml-auto font-mono text-gray-500">{fmtDuration(live ?? null)}</span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 font-mono text-[10px] text-gray-500">
          <div>started: {new Date(step.startedAt).toLocaleTimeString()}</div>
          {step.endedAt && <div>ended: {new Date(step.endedAt).toLocaleTimeString()}</div>}
          {step.note && <div className="whitespace-pre-wrap break-words text-gray-700">note: {step.note}</div>}
        </div>
      )}
    </div>
  );
}

function PastJobCard({ job }: { job: PastJob }) {
  const [open, setOpen] = useState(false);
  const total = job.startedAt && job.completedAt
    ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
    : null;
  const color =
    job.status === "COMPLETED" ? "text-green-700"
    : job.status === "FAILED" ? "text-red-700"
    : "text-gray-600";
  return (
    <div className="rounded border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-gray-50"
      >
        <span className={`font-mono ${color}`}>{job.status}</span>
        <span className="font-mono text-gray-500">{fmtDuration(total)}</span>
        <span className="ml-auto font-mono text-[10px] text-gray-400">
          {new Date(job.createdAt).toLocaleString()}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-2 py-1">
          {job.error && (
            <div className="mb-1 whitespace-pre-wrap break-words rounded bg-red-50 p-1 font-mono text-[10px] text-red-800">
              {job.error}
            </div>
          )}
          {(job.steps ?? []).length === 0 ? (
            <div className="py-1 text-[10px] text-gray-400">no step data</div>
          ) : (
            (job.steps ?? []).map((s, i) => <StepRow key={i} step={s} now={Date.now()} />)
          )}
        </div>
      )}
    </div>
  );
}

export function GenerationDebugPanel({ programId }: Props) {
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [pastJobs, setPastJobs] = useState<PastJob[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const lastJobStatus = useRef<string | null>(null);
  const lastJobId = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    setStatus(null);
    setStatusLoaded(false);

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/programs/${programId}/generate-async/status`);
        if (stopped) return;
        if (res.status === 404) {
          setStatus(null);
          setStatusLoaded(true);
          return;
        }
        if (!res.ok) return;
        const data: StatusResponse = await res.json();
        if (stopped) return;
        setStatus(data);
        setStatusLoaded(true);
        if (lastJobId.current !== data.jobId) {
          lastJobId.current = data.jobId;
          lastJobStatus.current = data.status;
          fetchPastJobs();
        } else if (
          (data.status === "COMPLETED" || data.status === "FAILED") &&
          lastJobStatus.current !== data.status
        ) {
          lastJobStatus.current = data.status;
          fetchPastJobs();
        }
      } catch {}
    };

    const fetchPastJobs = async () => {
      try {
        const res = await fetch(`/api/programs/${programId}/generation-jobs`);
        if (!res.ok) return;
        const data: { jobs: PastJob[] } = await res.json();
        if (!stopped) setPastJobs(data.jobs);
      } catch {}
    };

    poll();
    fetchPastJobs();
    timer = setInterval(poll, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      clearInterval(tick);
    };
  }, [programId]);

  const currentSteps = useMemo(() => status?.steps ?? [], [status]);
  const runningStep = currentSteps.find((s) => s.status === "running");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[60] rounded-md bg-gray-900 px-3 py-2 font-mono text-xs text-white shadow-lg hover:bg-gray-800"
      >
        debug ⚙
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-[60] flex w-96 flex-col border-l border-gray-300 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-900 px-3 py-2 font-mono text-xs text-white">
        <span>generation debug</span>
        <span className="ml-auto rounded bg-gray-700 px-1.5 py-0.5 text-[10px]">{programId.slice(0, 8)}</span>
        <button onClick={() => setOpen(false)} className="ml-1 text-gray-300 hover:text-white">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <section className="mb-4">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500">
            <span>current job</span>
            <span className="font-mono">{status?.progress ?? 0}%</span>
          </div>
          {status ? (
            <div className="mb-2 font-mono text-xs">
              <span className={
                status.status === "COMPLETED" ? "text-green-700"
                : status.status === "FAILED" ? "text-red-700"
                : "text-blue-700"
              }>{status.status}</span>
              {status.isStale && <span className="ml-2 rounded bg-yellow-100 px-1 text-[10px] text-yellow-800">STALE</span>}
              {runningStep && <span className="ml-2 text-gray-500">→ {runningStep.stage}</span>}
            </div>
          ) : statusLoaded ? (
            <div className="text-xs text-gray-400">no generation has been run yet</div>
          ) : (
            <div className="text-xs text-gray-400">loading…</div>
          )}
          {status?.error && (
            <div className="mb-2 whitespace-pre-wrap break-words rounded bg-red-50 p-2 font-mono text-[10px] text-red-800">
              {status.error}
            </div>
          )}
          {currentSteps.length === 0 ? (
            <div className="text-[10px] text-gray-400">no step data yet</div>
          ) : (
            currentSteps.map((s, i) => <StepRow key={i} step={s} now={now} />)
          )}
        </section>

        <section>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">
            recent jobs ({pastJobs.length})
          </div>
          <div className="space-y-1">
            {pastJobs.map((j) => <PastJobCard key={j.id} job={j} />)}
            {pastJobs.length === 0 && <div className="text-[10px] text-gray-400">none</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

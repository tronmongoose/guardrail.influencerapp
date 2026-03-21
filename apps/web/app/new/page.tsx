"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { SaveStatusIndicator } from "@/components/ui/SaveStatusIndicator";
import { useGeneration } from "@/components/generation";
import { useAutosave } from "@/hooks/useAutosave";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { ContentLegalNotice } from "@/components/wizard/ContentLegalNotice";
import { upload } from "@vercel/blob/client";
import { SkinPicker } from "@/components/skins/SkinPicker";

/**
 * First Program Creation Flow
 *
 * This is the entry point for new users. It combines:
 * 1. Quick profile setup (just name, pulled from Clerk)
 * 2. Program basics (title, audience, transformation)
 * 3. Content (videos)
 * 4. Duration & pacing
 * 5. Vibe/style
 * 6. Generate
 *
 * Replaces the old onboarding → dashboard → new program flow.
 */

interface Video {
  id: string;
  videoId: string;
  title: string | null;
  thumbnailUrl: string | null;
}

interface PendingUpload {
  localId: string;
  file: File;
  duration: number;
  progress: number;
  error?: string;
}

type Step = "welcome" | "program" | "videos" | "structure" | "generate";

interface AutosaveData {
  step: Step;
  programTitle: string;
  programDescription: string;
  targetAudience: string;
  targetTransformation: string;
  durationWeeks: number;
  pacingMode: "unlock_on_complete" | "drip_by_week";
  vibePrompt: string;
  videoHints: string;
  skinId: string;
}

const STORAGE_KEY_PREFIX = "new-program-";

const STEPS: { key: Step; label: string }[] = [
  { key: "welcome", label: "You" },
  { key: "program", label: "Program" },
  { key: "videos", label: "Content" },
  { key: "structure", label: "Structure" },
  { key: "generate", label: "Generate" },
];

export default function NewProgramPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded } = useUser();
  const { startGeneration } = useGeneration();

  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [programTitle, setProgramTitle] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [targetTransformation, setTargetTransformation] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [videoAddStage, setVideoAddStage] = useState<"idle" | "fetching" | "transcript" | "ready">("idle");
  const [videoInputMode, setVideoInputMode] = useState<"youtube" | "upload">("youtube");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [pacingMode, setPacingMode] = useState<"unlock_on_complete" | "drip_by_week">("unlock_on_complete");
  const [vibePrompt, setVibePrompt] = useState("");
  const [videoHints, setVideoHints] = useState("");
  const [skinId, setSkinId] = useState("classic-minimal");
  const [intentResult, setIntentResult] = useState<{
    groups: { clipIndexes: number[]; title: string; combinable: boolean }[];
    sectionBoundaries: number[];
    summary: string;
  } | null>(null);

  // Autosave: persist form state to localStorage + debounced DB save
  const autosaveData = useMemo<AutosaveData>(() => ({
    step, programTitle, programDescription, targetAudience, targetTransformation,
    durationWeeks, pacingMode, vibePrompt, videoHints, skinId,
  }), [step, programTitle, programDescription, targetAudience, targetTransformation,
       durationWeeks, pacingMode, vibePrompt, videoHints, skinId]);

  const { saveStatus, flush, clear, hasUnsavedChanges } = useAutosave<AutosaveData>({
    storageKey: programId ? `${STORAGE_KEY_PREFIX}${programId}` : "",
    data: autosaveData,
    enabled: !!programId && step !== "welcome",
    debounceMs: 2000,
    onSave: async (data) => {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.programTitle,
          description: data.programDescription || null,
          targetAudience: data.targetAudience,
          targetTransformation: data.targetTransformation,
          durationWeeks: data.durationWeeks,
          pacingMode: data.pacingMode,
          vibePrompt: data.vibePrompt,
          skinId: data.skinId,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
  });

  useBeforeUnload(hasUnsavedChanges);

  // Restore an in-progress draft when returning to the /new page
  async function restoreDraftState(draftProgramId: string) {
    // 1. Try localStorage first (has step position + all fields)
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${draftProgramId}`);
    let restoredFromStorage = false;

    if (stored) {
      try {
        const parsed: Partial<AutosaveData> = JSON.parse(stored);
        if (parsed.programTitle) setProgramTitle(parsed.programTitle);
        if (parsed.programDescription) setProgramDescription(parsed.programDescription);
        if (parsed.targetAudience) setTargetAudience(parsed.targetAudience);
        if (parsed.targetTransformation) setTargetTransformation(parsed.targetTransformation);
        if (parsed.durationWeeks) setDurationWeeks(parsed.durationWeeks);
        if (parsed.pacingMode) setPacingMode(parsed.pacingMode);
        if (parsed.vibePrompt) setVibePrompt(parsed.vibePrompt);
        if (parsed.videoHints) setVideoHints(parsed.videoHints);
        if (parsed.skinId) setSkinId(parsed.skinId);
        if (parsed.step && parsed.step !== "welcome") setStep(parsed.step);
        restoredFromStorage = true;
      } catch {
        // Corrupt data — fall through to DB restore
      }
    }

    // 2. Load program from DB (for cross-device recovery + videos)
    try {
      const res = await fetch(`/api/programs/${draftProgramId}`);
      if (res.ok) {
        const program = await res.json();
        // Use DB values as fallback if localStorage was empty
        if (!restoredFromStorage) {
          if (program.title && program.title !== "Untitled Program") setProgramTitle(program.title);
          if (program.description) setProgramDescription(program.description);
          if (program.targetAudience) setTargetAudience(program.targetAudience);
          if (program.targetTransformation) setTargetTransformation(program.targetTransformation);
          if (program.durationWeeks) setDurationWeeks(program.durationWeeks);
          if (program.pacingMode) setPacingMode(program.pacingMode);
          if (program.vibePrompt) setVibePrompt(program.vibePrompt);
          if (program.skinId) setSkinId(program.skinId);
          // Infer step from available data
          if (program.videos?.length > 0) setStep("structure");
          else if (program.targetTransformation) setStep("videos");
          else setStep("program");
        }
        // Videos always come from DB (they're persisted immediately)
        if (program.videos?.length > 0) {
          setVideos(program.videos.map((v: { id: string; videoId: string; title: string | null; thumbnailUrl: string | null }) => ({
            id: v.id,
            videoId: v.videoId,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
          })));
        }
      }
    } catch {
      // Graceful: just let user start from the program step
      if (!restoredFromStorage) setStep("program");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser) {
      router.push("/");
      return;
    }

    // Check if user already has programs - if so, redirect to dashboard
    Promise.all([
      fetch("/api/user/onboarding").then(r => r.json()),
      fetch("/api/programs").then(r => r.json()),
    ]).then(([userData, programs]) => {
      // Pre-fill name from Clerk or existing user data
      setName(userData.name || clerkUser.fullName || "");

      if (Array.isArray(programs) && programs.length > 0) {
        // Check for an in-progress draft (created at step 1 but never generated)
        const inProgressDraft = programs.find(
          (p: { published: boolean; _count?: { weeks: number } }) =>
            !p.published && p._count?.weeks === 0
        );

        if (inProgressDraft) {
          // Resume the draft instead of redirecting
          setProgramId(inProgressDraft.id);
          restoreDraftState(inProgressDraft.id);
          return;
        }

        // Otherwise, they have real programs — go to dashboard
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    }).catch(() => {
      setName(clerkUser.fullName || "");
      setLoading(false);
    });
  }, [isLoaded, clerkUser, router]);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case "welcome":
        return name.trim().length > 0;
      case "program":
        return programTitle.trim().length > 0 && targetTransformation.trim().length > 0;
      case "videos":
        return videos.length > 0;
      case "structure":
        return true;
      case "generate":
        return true;
      default:
        return false;
    }
  }, [step, name, programTitle, targetTransformation, videos.length]);

  const handleNext = async () => {
    setError(null);

    if (step === "welcome") {
      // Save user profile and create program
      setSaving(true);
      try {
        // Update user profile
        await fetch("/api/user/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });

        // Create program
        const res = await fetch("/api/programs/create", { method: "POST" });
        if (!res.ok) throw new Error("Failed to create program");
        const program = await res.json();
        setProgramId(program.id);

        setStep("program");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === "program") {
      setStep("videos");
      return;
    }

    if (step === "videos") {
      // If intent has already been reviewed, advance
      if (intentResult) {
        setStep("structure");
        return;
      }

      // Call the AI intent parser before advancing
      setSaving(true);
      try {
        const res = await fetch(`/api/programs/${programId}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoIds: videos.map((v) => v.id),
            intentText: videoHints.trim(),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to analyze videos");
        }
        const result = await res.json();
        setIntentResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze videos");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === "structure") {
      setStep("generate");
      return;
    }
  };

  const handleBack = () => {
    setError(null);
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key);
    }
  };

  const handleAddVideo = async () => {
    if (!videoUrl.trim() || !programId) return;

    setAddingVideo(true);
    setVideoAddStage("fetching");
    setError(null);

    // Simulate transcript extraction stage after a short delay
    const transcriptTimer = setTimeout(() => setVideoAddStage("transcript"), 1200);

    try {
      const res = await fetch(`/api/programs/${programId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add video");
      }

      const video = await res.json();

      clearTimeout(transcriptTimer);
      setVideoAddStage("ready");

      // Hold "ready" state briefly for visual satisfaction
      await new Promise(resolve => setTimeout(resolve, 600));

      setVideos(prev => [...prev, video]);
      setVideoUrl("");
    } catch (err) {
      clearTimeout(transcriptTimer);
      setError(err instanceof Error ? err.message : "Failed to add video");
    } finally {
      setAddingVideo(false);
      setVideoAddStage("idle");
    }
  };

  const getVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });

  const formatDuration = (seconds: number): string => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!programId) return;

    const MAX_SIZE = 500 * 1024 * 1024;
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        errors.push(`"${file.name}" exceeds 500 MB limit`);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) setError(errors.join(", "));
    if (validFiles.length === 0) return;
    if (errors.length === 0) setError(null);

    const pending: PendingUpload[] = validFiles.map((file) => ({
      localId: `${Date.now()}-${Math.random()}`,
      file,
      duration: 0,
      progress: 0,
    }));

    setPendingUploads((prev) => [...prev, ...pending]);

    // Load durations asynchronously in the background
    pending.forEach(async (item) => {
      const duration = await getVideoDuration(item.file);
      setPendingUploads((prev) =>
        prev.map((p) => (p.localId === item.localId ? { ...p, duration } : p))
      );
    });

    // Upload sequentially
    for (const item of pending) {
      try {
        const blob = await upload(item.file.name, item.file, {
          access: "public",
          handleUploadUrl: `/api/programs/${programId}/videos/upload`,
          onUploadProgress: ({ percentage }) => {
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.localId === item.localId ? { ...p, progress: Math.round(percentage) } : p
              )
            );
          },
        });

        const res = await fetch(`/api/programs/${programId}/videos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: blob.url, source: "upload", title: item.file.name }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to register video");
        }

        const video = await res.json();
        setVideos((prev) => [...prev, video]);
        setPendingUploads((prev) => prev.filter((p) => p.localId !== item.localId));
      } catch (err) {
        setPendingUploads((prev) =>
          prev.map((p) =>
            p.localId === item.localId
              ? { ...p, error: err instanceof Error ? err.message : "Upload failed" }
              : p
          )
        );
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveVideo = async (videoId: string) => {
    if (!programId) return;

    try {
      await fetch(`/api/programs/${programId}/videos?videoId=${videoId}`, {
        method: "DELETE",
      });
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch {
      // Silently fail, video still in list
    }
  };

  const handleGenerate = async () => {
    if (!programId) return;

    setSaving(true);
    setError(null);

    // Settle any pending autosave before the explicit save
    await flush();

    try {
      // Save program details
      const patchRes = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: programTitle,
          targetAudience,
          targetTransformation,
          durationWeeks,
          pacingMode,
          vibePrompt,
          videoHints,
        }),
      });

      if (!patchRes.ok) throw new Error("Failed to save program");

      // Mark onboarding complete
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          onboardingComplete: true,
        }),
      });

      // Start async generation
      const genRes = await fetch(`/api/programs/${programId}/generate-async`, {
        method: "POST",
      });

      if (!genRes.ok) {
        const error = await genRes.json();
        throw new Error(error.detail || error.error || "Failed to start generation");
      }

      // Track generation
      startGeneration(programId);

      // Clear autosave data — draft is now generating
      clear();

      // Go directly to edit page so user sees their program being built
      router.push(`/programs/${programId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg-radial grid-bg">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-surface-border/50 backdrop-blur-sm">
        <Link href="/" className="text-xl font-bold tracking-tight neon-text-cyan text-neon-cyan">
          Journeyline
        </Link>
        <div className="flex items-center gap-2">
          <SaveStatusIndicator status={saveStatus} />
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`hidden sm:flex items-center gap-2 ${i > 0 ? "ml-2" : ""}`}
            >
              {i > 0 && <div className="w-8 h-px bg-surface-border" />}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  s.key === step
                    ? "bg-neon-cyan text-surface-dark"
                    : i < currentStepIndex
                    ? "bg-neon-cyan/30 text-neon-cyan"
                    : "bg-surface-border text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs ${
                  s.key === step ? "text-white" : "text-gray-500"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-12">
        {/* Step: Welcome */}
        {step === "welcome" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                Let's build your first program
              </h1>
              <p className="text-gray-400">
                Transform your videos into a structured learning experience
              </p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should learners know you?"
                  className="w-full mt-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Program */}
        {step === "program" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                Define your program
              </h1>
              <p className="text-gray-400">
                What will learners achieve?
              </p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400">Program title</label>
                <input
                  type="text"
                  value={programTitle}
                  onChange={(e) => setProgramTitle(e.target.value)}
                  placeholder="e.g., 'Master Video Editing in 8 Weeks'"
                  className="w-full mt-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">Description <span className="text-gray-600">(optional)</span></label>
                <textarea
                  value={programDescription}
                  onChange={(e) => setProgramDescription(e.target.value)}
                  placeholder="A brief overview of what your program covers"
                  rows={2}
                  className="w-full mt-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">Who is this for?</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., 'Beginner content creators'"
                  className="w-full mt-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">The transformation</label>
                <textarea
                  value={targetTransformation}
                  onChange={(e) => setTargetTransformation(e.target.value)}
                  placeholder="What will they be able to do after completing your program?"
                  rows={3}
                  className="w-full mt-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific: "Edit professional YouTube videos in under 2 hours"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step: Videos — intent review card */}
        {step === "videos" && intentResult && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">Here's what AI decided</h1>
              <p className="text-gray-400">Review before we build your structure</p>
            </div>

            <div className="bg-surface-card rounded-xl border border-surface-border border-l-4 border-l-neon-cyan p-6">
              <p className="text-white text-sm leading-relaxed">{intentResult.summary}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep("structure")}
                className="w-full btn-neon py-3 rounded-xl text-surface-dark font-semibold"
              >
                Looks good, continue →
              </button>
              <button
                onClick={() => setIntentResult(null)}
                className="text-sm text-gray-400 hover:text-white transition text-center"
              >
                Let me adjust
              </button>
            </div>
          </div>
        )}

        {/* Step: Videos — input mode */}
        {step === "videos" && !intentResult && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                Add your content
              </h1>
              <p className="text-gray-400">
                Paste YouTube URLs or upload video files
              </p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
              {/* Tab toggle */}
              <div className="flex rounded-lg border border-surface-border overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setVideoInputMode("youtube")}
                  className={`flex-1 py-2 font-medium transition ${
                    videoInputMode === "youtube"
                      ? "bg-neon-cyan/10 text-neon-cyan"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  YouTube URL
                </button>
                <button
                  type="button"
                  onClick={() => setVideoInputMode("upload")}
                  className={`flex-1 py-2 font-medium transition border-l border-surface-border ${
                    videoInputMode === "upload"
                      ? "bg-neon-cyan/10 text-neon-cyan"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Upload File
                </button>
              </div>

              {/* YouTube input */}
              {videoInputMode === "youtube" && (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="flex-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
                      onKeyDown={(e) => e.key === "Enter" && handleAddVideo()}
                    />
                    <button
                      onClick={handleAddVideo}
                      disabled={addingVideo || !videoUrl.trim()}
                      className="px-4 py-2.5 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-lg text-sm font-medium hover:bg-neon-cyan/20 transition disabled:opacity-50"
                    >
                      {addingVideo ? <Spinner size="sm" /> : "Add"}
                    </button>
                  </div>

                  {addingVideo && (
                    <div className="flex items-center gap-2 text-xs" aria-live="polite">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        videoAddStage === "ready" ? "bg-neon-cyan" : "bg-neon-pink animate-pulse"
                      }`} />
                      {videoAddStage === "fetching" && <span className="text-gray-400">Fetching video info...</span>}
                      {videoAddStage === "transcript" && <span className="text-gray-400">Extracting transcript...</span>}
                      {videoAddStage === "ready" && <span className="text-neon-cyan">Content ready</span>}
                    </div>
                  )}
                </>
              )}

              {/* File upload input */}
              {videoInputMode === "upload" && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/mp4,video/quicktime,.mp4,.mov"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) handleFilesSelected(files);
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const files = Array.from(e.dataTransfer.files).filter((f) =>
                        f.type === "video/mp4" || f.type === "video/quicktime" ||
                        f.name.endsWith(".mp4") || f.name.endsWith(".mov")
                      );
                      if (files.length > 0) handleFilesSelected(files);
                    }}
                    className={`w-full py-8 border-2 border-dashed rounded-lg text-center transition cursor-pointer select-none ${
                      isDragging
                        ? "border-neon-cyan/70 bg-neon-cyan/5"
                        : "border-surface-border hover:border-neon-cyan/40"
                    }`}
                  >
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-400">
                      {isDragging ? "Drop videos here" : "Click or drag to add videos"}
                    </span>
                    <span className="block text-xs text-gray-600 mt-1">MP4 or MOV video files — up to 500MB each</span>
                  </div>
                </div>
              )}

              {/* Video list (shared between both modes) */}
              {videos.length > 0 ? (
                <div className="space-y-2">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-3 p-3 bg-surface-dark rounded-lg border border-surface-border"
                    >
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="w-16 h-9 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-9 rounded bg-surface-border flex-shrink-0 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <span className="flex-1 text-sm text-white truncate">
                        {video.title || video.videoId}
                      </span>
                      <button
                        onClick={() => handleRemoveVideo(video.id)}
                        className="text-gray-500 hover:text-red-400 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Add at least one video to continue</p>
                </div>
              )}

              <p className="text-xs text-gray-500">
                {videos.length} video{videos.length !== 1 ? "s" : ""} added
              </p>

              {/* Hints section — shown once at least one video is added */}
              {videos.length > 0 && (
                <div className="rounded-xl bg-white/5 px-4 py-4 space-y-2">
                  <label className="text-sm font-medium text-gray-200 block">
                    Anything we should know about these videos?
                  </label>
                  <textarea
                    value={videoHints}
                    onChange={(e) => setVideoHints(e.target.value)}
                    placeholder="e.g. First 3 are short clips — combine them. Last video should stand alone."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-white/5 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    Optional — our AI will use your hints to structure the program.
                  </p>
                </div>
              )}

              <ContentLegalNotice />
            </div>
          </div>
        )}

        {/* Step: Structure */}
        {step === "structure" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                Program structure
              </h1>
              <p className="text-gray-400">
                How should learners progress?
              </p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
              {/* Pacing — shown first so duration language updates instantly */}
              <div>
                <label className="text-sm text-gray-400 mb-3 block">Progression style</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setPacingMode("unlock_on_complete")}
                    className={`w-full p-4 rounded-lg border text-left transition ${
                      pacingMode === "unlock_on_complete"
                        ? "border-neon-cyan bg-neon-cyan/10"
                        : "border-surface-border bg-surface-dark hover:border-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${pacingMode === "unlock_on_complete" ? "text-neon-cyan" : "text-white"}`}>
                        Self-paced
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                        Recommended
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      Next lesson unlocks when learner completes the current one
                    </p>
                  </button>
                  <button
                    onClick={() => setPacingMode("drip_by_week")}
                    className={`w-full p-4 rounded-lg border text-left transition ${
                      pacingMode === "drip_by_week"
                        ? "border-neon-cyan bg-neon-cyan/10"
                        : "border-surface-border bg-surface-dark hover:border-gray-500"
                    }`}
                  >
                    <span className={`font-medium ${pacingMode === "drip_by_week" ? "text-neon-cyan" : "text-white"}`}>
                      Weekly release
                    </span>
                    <p className="text-sm text-gray-400 mt-1">
                      New content unlocks each week on a schedule
                    </p>
                  </button>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-sm text-gray-400 mb-3 block">Duration</label>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { n: 6, sublabel: "Standard" },
                      { n: 8, sublabel: "Deep dive" },
                      { n: 12, sublabel: "Comprehensive" },
                    ] as const
                  ).map(({ n, sublabel }) => (
                    <button
                      key={n}
                      onClick={() => setDurationWeeks(n)}
                      className={`p-4 rounded-lg border text-center transition ${
                        durationWeeks === n
                          ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"
                          : "border-surface-border bg-surface-dark text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <span className="text-2xl font-bold">{n}</span>
                      <span className="text-sm block mt-1">
                        {pacingMode === "unlock_on_complete" ? "sessions" : "weeks"}
                      </span>
                      <span className="text-[11px] block mt-0.5 opacity-60">{sublabel}</span>
                    </button>
                  ))}
                </div>

                {/* Program Timeline */}
                <div className="mt-4">
                  <span className="text-xs text-gray-500 block mb-2">Program Timeline</span>
                  <div className="relative h-1 bg-surface-dark rounded-full">
                    <div
                      className="absolute h-full bg-neon-cyan rounded-full transition-all duration-300"
                      style={{
                        width:
                          durationWeeks === 6
                            ? "33.3%"
                            : durationWeeks === 8
                            ? "66.6%"
                            : "100%",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    {[6, 8, 12].map((n) => (
                      <span
                        key={n}
                        className={`text-xs tabular-nums transition-colors ${
                          durationWeeks === n ? "text-neon-cyan" : "text-gray-600"
                        }`}
                      >
                        {pacingMode === "unlock_on_complete" ? n : `${n}w`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Context line */}
                <p className="mt-2 text-xs text-gray-500">
                  {pacingMode === "unlock_on_complete"
                    ? `${durationWeeks} sessions = a focused, self-paced program`
                    : `${durationWeeks} weeks = approximately ${durationWeeks * 2} to ${
                        durationWeeks * 3
                      } lessons`}
                </p>
              </div>

              {/* Duration detail cards */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      n: 6,
                      sublabel: "Standard",
                      weekDesc: "A focused sprint for a single, well-defined skill",
                      sessionDesc: "Tight and action-packed — ideal for quick wins",
                    },
                    {
                      n: 8,
                      sublabel: "Deep dive",
                      weekDesc: "Most popular — room to build skills week over week",
                      sessionDesc: "Most popular — builds momentum lesson by lesson",
                    },
                    {
                      n: 12,
                      sublabel: "Comprehensive",
                      weekDesc: "Full transformation spanning multiple skill areas",
                      sessionDesc: "Broad curriculum for lasting behavior change",
                    },
                  ] as const
                ).map(({ n, sublabel, weekDesc, sessionDesc }) => (
                  <button
                    key={n}
                    onClick={() => setDurationWeeks(n)}
                    className={`p-3 rounded-lg border text-left transition ${
                      durationWeeks === n
                        ? "border-neon-cyan/50 bg-neon-cyan/5"
                        : "border-surface-border bg-surface-dark hover:border-gray-600"
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold mb-1 ${
                        durationWeeks === n ? "text-neon-cyan" : "text-white"
                      }`}
                    >
                      {n} {pacingMode === "unlock_on_complete" ? "Sessions" : "Weeks"}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-snug">
                      <span className="text-gray-400">{sublabel}</span>
                      {" — "}
                      {pacingMode === "unlock_on_complete" ? sessionDesc : weekDesc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Vibe */}
              <div>
                <label className="text-sm text-gray-400">Style guidance (optional)</label>
                <textarea
                  value={vibePrompt}
                  onChange={(e) => setVibePrompt(e.target.value)}
                  placeholder="How should the AI write? e.g., 'Casual and encouraging' or 'Professional and structured'"
                  rows={2}
                  className="w-full mt-1 px-3 py-2.5 bg-surface-dark border border-surface-border rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none"
                />
              </div>

              {/* Visual theme */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Visual theme</label>
                <SkinPicker value={skinId} onChange={setSkinId} />
              </div>
            </div>
          </div>
        )}

        {/* Step: Generate */}
        {step === "generate" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                Ready to generate
              </h1>
              <p className="text-gray-400">
                AI will structure your videos into a week-by-week curriculum
              </p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Program</span>
                  <p className="text-white font-medium truncate">{programTitle}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="text-white font-medium">
                    {durationWeeks} {pacingMode === "unlock_on_complete" ? "sessions" : "weeks"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Videos</span>
                  <p className="text-white font-medium">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
                </div>
                <div>
                  <span className="text-gray-500">Pacing</span>
                  <p className="text-white font-medium">
                    {pacingMode === "unlock_on_complete" ? "Self-paced" : "Weekly"}
                  </p>
                </div>
              </div>

              <div className="border-t border-surface-border pt-4">
                <p className="text-xs text-gray-500">
                  Generation takes a few seconds. You can edit everything after.
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={saving}
              className="w-full btn-neon py-4 rounded-xl text-surface-dark font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner size="sm" />
                  Creating your program...
                </>
              ) : (
                "Generate Program"
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        {step !== "generate" && !(step === "videos" && intentResult) && (
          <div className="flex justify-between mt-8">
            {step !== "welcome" ? (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className="btn-neon px-6 py-2.5 rounded-lg text-surface-dark text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner size="sm" />
                  Saving...
                </>
              ) : (
                "Continue →"
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

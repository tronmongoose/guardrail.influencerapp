"use client";

import { useState, useEffect } from "react";
import { extractAudioChunks } from "@/lib/audio-extract";
import { ContentLegalNotice } from "../ContentLegalNotice";

interface Video {
  id: string;
  videoId: string;
  url?: string;
  title: string | null;
  thumbnailUrl: string | null;
  durationSeconds?: number | null;
  desiredSegmentCount?: number;
  muxUploadId?: string | null;
  _count?: { segments: number };
}

interface Artifact {
  id?: string;
  originalFilename: string;
  fileType: string;
  extractedText?: string;
  metadata: { pageCount?: number; wordCount: number; duration?: number; transcriptionProvider?: string };
}

interface StepContentProps {
  programId: string;
  videos: Video[];
  artifacts: Artifact[];
  onVideosChange: (videos: Video[]) => void;
  onArtifactsChange: (artifacts: Artifact[]) => void;
  onUploadingCountChange?: (count: number) => void;
}

function isUploadedVideo(video: Video): boolean {
  return !!(
    video.url?.includes("blob.vercel-storage.com") ||
    video.url?.startsWith("mux-upload://") ||
    video.muxUploadId
  );
}

interface FileExtractionState {
  filename: string;
  fileSize?: number;
  progress: number;
  status: "pending" | "extracting" | "transcribing" | "done" | "error";
  error?: string;
  phase?: string;
}

// iOS Safari transcodes HEVC → H.264 inside the Photos picker when the input
// accepts specific video extensions (.mp4/.mov) — that's the "Preparing 1 of N…"
// wait users hit before the picker dismisses. Using video/* / audio/* MIME types
// lets iOS hand off originals immediately; Mux transcodes server-side.
// (9th-degree mobile run 2026-05-24.)
const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.md,video/*,audio/*";

function getFileType(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return "video";
  if (lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".wav")) return "audio";
  return null;
}

function isVideoFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

function isAudioFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".wav");
}

function getFileTypeColor(fileType: string): string {
  switch (fileType) {
    case "pdf": return "bg-red-500/20 text-red-400";
    case "docx": return "bg-blue-500/20 text-blue-400";
    case "txt": return "bg-green-500/20 text-green-400";
    case "md": return "bg-purple-500/20 text-purple-400";
    case "video": return "bg-orange-500/20 text-orange-400";
    case "audio": return "bg-yellow-500/20 text-yellow-400";
    default: return "bg-gray-500/20 text-gray-400";
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// Extract a thumbnail frame and duration from a video File object (runs entirely client-side).
// Seeks to `seekTo` seconds (or 10% of duration if shorter) to skip black frames.
function extractVideoMetadata(
  file: File,
  seekTo = 2,
): Promise<{ thumbnailUrl: string | null; durationSeconds: number | null }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let durationSeconds: number | null = null;
    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onerror = () => { cleanup(); resolve({ thumbnailUrl: null, durationSeconds }); };

    video.onloadedmetadata = () => {
      durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      video.currentTime = Math.min(seekTo, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const aspect = video.videoHeight / (video.videoWidth || 1);
        canvas.width = 640;
        canvas.height = Math.round(640 * aspect) || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); resolve({ thumbnailUrl: null, durationSeconds }); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve({ thumbnailUrl: canvas.toDataURL("image/jpeg", 0.7), durationSeconds });
      } catch {
        cleanup();
        resolve({ thumbnailUrl: null, durationSeconds });
      }
    };

    video.src = objectUrl;
  });
}

export function StepContent({
  programId,
  videos,
  artifacts,
  onVideosChange,
  onArtifactsChange,
  onUploadingCountChange,
}: StepContentProps) {
  const [extractionStates, setExtractionStates] = useState<FileExtractionState[]>([]);
  const [aiMessageIndex, setAiMessageIndex] = useState(0);
  // iOS Safari makes the Photos picker prepare each video (iCloud download +
  // HEVC→H.264 transcode) before dismissing — out of our control. Show iOS
  // users an expectation-setting note so the wait doesn't read as "stuck."
  // useState(false) + useEffect avoids SSR/hydration mismatch on the UA check.
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const iPadOS = typeof navigator !== "undefined"
      && navigator.platform === "MacIntel"
      && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !== undefined
      && ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1;
    setIsIOS(/iPhone|iPad|iPod/i.test(ua) || iPadOS);
  }, []);

  const isExtracting = extractionStates.some((s) => s.status === "pending" || s.status === "extracting" || s.status === "transcribing");

  const UPLOAD_MESSAGES = [
    "Uploading your videos...",
    "Sending files to our servers...",
    "Processing your upload...",
    "Almost done uploading...",
    "Saving your content...",
  ];

  useEffect(() => {
    if (!isExtracting) {
      setAiMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setAiMessageIndex((i) => (i + 1) % UPLOAD_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtracting]);

  // Segment counts — refreshed after videos change (Gemini analysis is async/fire-and-forget)
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (videos.length === 0) return;

    const poll = () =>
      fetch(`/api/programs/${programId}/videos`)
        .then((r) => r.ok ? r.json() : [])
        .then((data: Array<{ id: string; _count: { segments: number }; hasAnalysis?: boolean }>) => {
          const counts: Record<string, number> = {};
          const ready: Record<string, boolean> = {};
          for (const v of data) {
            if (v._count?.segments > 0) counts[v.id] = v._count.segments;
            ready[v.id] = !!v.hasAnalysis;
          }
          setSegmentCounts(counts);
          return ready;
        })
        .catch(() => ({} as Record<string, boolean>));

    poll().then((ready) => {
      const uploadedIds = videos.filter(isUploadedVideo).map((v) => v.id);
      if (uploadedIds.length === 0) return;
      if (uploadedIds.every((id) => ready[id])) return;

      const interval = setInterval(() => {
        poll().then((latest) => {
          if (uploadedIds.every((id) => latest[id])) clearInterval(interval);
        });
      }, 5_000);

      return () => clearInterval(interval);
    });
  }, [programId, videos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSegmentCount = Object.values(segmentCounts).reduce((a, b) => a + b, 0);
  const segmentedVideoCount = Object.keys(segmentCounts).length;

  const handleRemoveVideo = (videoId: string) => {
    onVideosChange(videos.filter((v) => v.id !== videoId));
  };

  function getVideoMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return "video/mp4";
  }

  const uploadVideoBlob = async (file: File): Promise<Video | null> => {
    const updateState = (progress: number, phase: string, status: "extracting" | "transcribing" = "extracting") => {
      setExtractionStates((prev) =>
        prev.map((s) => s.filename === file.name ? { ...s, progress, phase, status } : s)
      );
    };

    updateState(0, "Uploading");

    // Step 1: Get a Mux direct upload URL
    const tokenRes = await fetch("/api/mux/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!tokenRes.ok) {
      const data = await tokenRes.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to get upload URL");
    }

    const { uploadId, uploadUrl } = (await tokenRes.json()) as {
      uploadId: string;
      uploadUrl: string;
    };

    // Step 2: PUT the file directly to Mux — never touches the Next.js server.
    // 10-min timeout per file. Without it XHR can hang forever when Mux
    // receives the bytes but the response packet is lost — none of load /
    // error / abort fires, the wrapping Promise never settles, and the
    // wizard's Promise.allSettled blocks the "uploading" indicator
    // indefinitely. (9th-degree-healing 2026-05-22 incident.)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 10 * 60 * 1000;

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          updateState(Math.round((event.loaded / event.total) * 88), "Uploading");
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      });

      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
      xhr.addEventListener("timeout", () => reject(new Error("Upload timed out after 10 minutes")));

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || getVideoMimeType(file.name));
      xhr.send(file);
    });

    updateState(92, "Saving");

    // Step 3: Create the video record linked to the Mux upload ID.
    // Gemini analysis is triggered by the video.asset.ready webhook once Mux finishes processing.
    const res = await fetch(`/api/programs/${programId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "mux-upload", muxUploadId: uploadId, title: file.name }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save video");
    }

    const video: Video = await res.json();

    // Extract thumbnail + duration from the local File (while we still have it).
    // Duration lets the wizard show an accurate "~N lessons" estimate before Gemini analyzes.
    const { thumbnailUrl, durationSeconds } = await extractVideoMetadata(file);
    return {
      ...video,
      thumbnailUrl: thumbnailUrl ?? video.thumbnailUrl,
      durationSeconds: durationSeconds ?? video.durationSeconds,
    };
  };

  const extractSingleFile = async (file: File): Promise<Artifact | null> => {
    const fileType = getFileType(file.name);
    if (!fileType) {
      return null;
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`${file.name}: File must be less than 10MB`);
    }

    const updateProgress = (filename: string, progress: number) => {
      setExtractionStates((prev) =>
        prev.map((s) => s.filename === filename ? { ...s, progress } : s)
      );
    };

    let extractedText = "";
    let metadata: { pageCount?: number; wordCount: number } = { wordCount: 0 };

    if (fileType === "pdf") {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const totalPages = pdf.numPages;
      const textParts: string[] = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        textParts.push(pageText);
        updateProgress(file.name, (i / totalPages) * 100);
      }

      extractedText = textParts.join("\n\n");
      metadata = {
        pageCount: totalPages,
        wordCount: extractedText.split(/\s+/).length,
      };
    } else if (fileType === "docx") {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      extractedText = result.value;
      metadata = {
        wordCount: extractedText.split(/\s+/).length,
      };
      updateProgress(file.name, 100);
    } else if (fileType === "txt" || fileType === "md") {
      extractedText = await file.text();
      metadata = {
        wordCount: extractedText.split(/\s+/).length,
      };
      updateProgress(file.name, 100);
    }

    return {
      originalFilename: file.name,
      fileType,
      extractedText,
      metadata,
    };
  };

  const extractAudioVideoFile = async (file: File): Promise<Artifact | null> => {
    const fileType = getFileType(file.name);
    if (!fileType || fileType !== "audio") return null;

    if (file.size > 100 * 1024 * 1024) {
      throw new Error(`${file.name}: File must be less than 100MB`);
    }

    const updateState = (progress: number, phase: string, status: "extracting" | "transcribing" = "extracting") => {
      setExtractionStates((prev) =>
        prev.map((s) => s.filename === file.name ? { ...s, progress, phase, status } : s)
      );
    };

    // Phase 1: Extract audio and chunk
    updateState(5, "Extracting audio");
    const { chunks, totalDurationSeconds, totalChunks } = await extractAudioChunks(
      file,
      (progress) => updateState(Math.round(progress * 0.5), "Extracting audio")
    );

    // Phase 2: Transcribe each chunk via server
    const transcriptParts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const phaseLabel = totalChunks > 1 ? `Transcribing (${i + 1}/${totalChunks})` : "Transcribing";
      updateState(Math.round(50 + ((i + 1) / totalChunks) * 45), phaseLabel, "transcribing");

      const res = await fetch(`/api/programs/${programId}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: chunk.base64,
          chunkIndex: chunk.index,
          totalChunks,
          filename: file.name,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Transcription failed" }));
        throw new Error(error.error || `Transcription failed for part ${i + 1}`);
      }

      const result = await res.json();
      if (result.text) transcriptParts.push(result.text);
    }

    const extractedText = transcriptParts.join(" ");
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    if (wordCount < 5) {
      throw new Error(`${file.name}: Could not extract meaningful transcript. The audio may be silent or unsupported.`);
    }

    return {
      originalFilename: file.name,
      fileType,
      extractedText,
      metadata: {
        wordCount,
        duration: Math.round(totalDurationSeconds),
        transcriptionProvider: "whisper",
      },
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const videoFiles = files.filter((f) => isVideoFile(f.name));
    const otherFiles = files.filter((f) => !isVideoFile(f.name));

    // Signal to parent that uploads are starting so wizard can allow advancing
    if (videoFiles.length > 0) {
      onUploadingCountChange?.(videoFiles.length);
    }

    // Initialize extraction states — first batch of videos start as "extracting",
    // later-batch videos and other files start as "pending" until their turn
    const CONCURRENCY = 5;
    const newStates: FileExtractionState[] = files.map((f, _idx) => {
      const videoIdx = videoFiles.indexOf(f);
      const isFirstBatch = videoIdx >= 0 && videoIdx < CONCURRENCY;
      return {
        filename: f.name,
        fileSize: f.size,
        progress: 0,
        status: (isFirstBatch ? "extracting" : "pending") as FileExtractionState["status"],
      };
    });
    setExtractionStates((prev) => [...prev, ...newStates]);

    const newVideos: Video[] = [];
    const newArtifacts: Artifact[] = [];

    // Upload video files with a concurrency limit to avoid saturating browser connections
    if (videoFiles.length > 0) {
      const CONCURRENCY = 5;
      const videoResults: PromiseSettledResult<Video | null>[] = [];
      for (let i = 0; i < videoFiles.length; i += CONCURRENCY) {
        const batch = videoFiles.slice(i, i + CONCURRENCY);
        // Mark this batch as actively uploading
        setExtractionStates((prev) =>
          prev.map((s) => batch.some((f) => f.name === s.filename) ? { ...s, status: "extracting" } : s)
        );
        const batchResults = await Promise.allSettled(batch.map((file) => uploadVideoBlob(file)));
        videoResults.push(...batchResults);
      }
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const result = videoResults[i];
        if (result.status === "fulfilled" && result.value) {
          newVideos.push(result.value);
          setExtractionStates((prev) =>
            prev.map((s) => s.filename === file.name ? { ...s, status: "done", progress: 100 } : s)
          );
        } else if (result.status === "rejected") {
          console.error(`[upload] Failed for "${file.name}":`, result.reason);
          setExtractionStates((prev) =>
            prev.map((s) => s.filename === file.name
              ? { ...s, status: "error", error: result.reason instanceof Error ? result.reason.message : "Upload failed" }
              : s
            )
          );
        }
      }
    }

    // Process non-video files sequentially (they use client-side extraction)
    for (const file of otherFiles) {
      setExtractionStates((prev) =>
        prev.map((s) => s.filename === file.name ? { ...s, status: "extracting" } : s)
      );
      try {
        const artifact = isAudioFile(file.name)
          ? await extractAudioVideoFile(file)
          : await extractSingleFile(file);
        if (artifact) {
          // Save to API immediately so extractedText is persisted server-side
          try {
            const res = await fetch(`/api/programs/${programId}/artifacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(artifact),
            });
            if (res.ok) {
              const saved = await res.json();
              artifact.id = saved.id;
            }
          } catch {
            // Non-critical — artifact can be saved later in handleGenerate
          }
          newArtifacts.push(artifact);
          setExtractionStates((prev) =>
            prev.map((s) => s.filename === file.name ? { ...s, status: "done", progress: 100 } : s)
          );
        } else {
          setExtractionStates((prev) =>
            prev.map((s) => s.filename === file.name ? { ...s, status: "error", error: "Unsupported file type" } : s)
          );
        }
      } catch (error) {
        console.error("Extraction error:", error);
        setExtractionStates((prev) =>
          prev.map((s) => s.filename === file.name
            ? { ...s, status: "error", error: error instanceof Error ? error.message : "Processing failed" }
            : s
          )
        );
      }
    }

    // Signal uploads finished
    onUploadingCountChange?.(0);

    if (newVideos.length > 0) {
      onVideosChange([...videos, ...newVideos]);
    }
    if (newArtifacts.length > 0) {
      onArtifactsChange([...artifacts, ...newArtifacts]);
    }

    // Clear only "done" states after a delay; keep errors visible so the user can see what failed
    setTimeout(() => {
      setExtractionStates((prev) => prev.filter((s) => s.status !== "done"));
    }, 2000);

    // Reset file input
    e.target.value = "";
  };

  const handleRemoveArtifact = (index: number) => {
    onArtifactsChange(artifacts.filter((_, i) => i !== index));
  };

  // Content summary
  const docArtifacts = artifacts.filter((a) => a.fileType !== "video" && a.fileType !== "audio");
  const avArtifacts = artifacts.filter((a) => a.fileType === "video" || a.fileType === "audio");
  const contentParts: string[] = [];
  if (videos.length > 0) contentParts.push(`${videos.length} video${videos.length !== 1 ? "s" : ""}`);
  if (avArtifacts.length > 0) contentParts.push(`${avArtifacts.length} uploaded recording${avArtifacts.length !== 1 ? "s" : ""}`);
  if (docArtifacts.length > 0) contentParts.push(`${docArtifacts.length} document${docArtifacts.length !== 1 ? "s" : ""}`);
  const contentSummary = contentParts.length > 0
    ? contentParts.join(", ") + " added"
    : "No content added yet";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Program Content</h2>
        <p className="text-gray-400 text-sm">
          Add your content sources. The AI will analyze these to create your program structure.
        </p>
      </div>

      {/* Content summary */}
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <svg className="w-4 h-4 text-neon-cyan flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {contentSummary}
      </div>

      {/* Long video segmentation notice */}
      {totalSegmentCount > 0 && (
        <div className="flex items-start gap-2 p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
          <svg className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-xs text-gray-300">
            <span className="text-neon-cyan font-medium">Long videos detected</span> —{" "}
            {segmentedVideoCount === 1 ? "1 video" : `${segmentedVideoCount} videos`} will be auto-split into{" "}
            <span className="text-neon-cyan font-medium">{totalSegmentCount} focused segments</span> before generation.
          </p>
        </div>
      )}

      {/* Combined content tip */}
      <div className="flex items-start gap-2 p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
        <svg className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-xs text-gray-300">
          Upload your videos. We&apos;ll sort them by topic, recommend a duration, and break long ones into clips. Aim for more content if you want a longer program.
        </p>
      </div>

      <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Add videos from your phone, documents, or audio recordings. AI will analyze everything and build your program.
          </p>

          {/* File dropzone — mobile-optimized */}
          <label className="block cursor-pointer">
            <div className={`
              border-2 border-dashed rounded-lg p-8 sm:p-6 min-h-[120px] text-center transition flex flex-col items-center justify-center
              ${isExtracting
                ? "border-neon-pink bg-neon-pink/5"
                : "border-surface-border hover:border-neon-cyan hover:bg-neon-cyan/5 active:bg-neon-cyan/10"
              }
            `}>
              {isExtracting ? (
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto mb-3 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-neon-pink transition-all duration-500">
                    {UPLOAD_MESSAGES[aiMessageIndex]}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Large videos take a minute — hang tight</p>
                </div>
              ) : (
                <>
                  <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {/* Desktop copy */}
                  <p className="text-sm text-gray-400 hidden sm:block">
                    Drop files here, or <span className="text-neon-cyan">browse</span>
                  </p>
                  {/* Mobile copy */}
                  <p className="text-sm text-gray-400 block sm:hidden">
                    <span className="text-neon-cyan">Tap to choose files</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Videos (MP4, MOV), Audio (MP3, WAV), or Docs (PDF, DOCX, TXT) · up to 500 MB per file</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileUpload}
              disabled={isExtracting}
              multiple={true}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
            />
          </label>

          {isIOS && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-card border border-surface-border">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-400 leading-relaxed">
                In your Photos library, iOS will prepare each video (downloading from iCloud and converting the format) before handing them to Journeyline. This may take a moment per video — it&apos;s outside our control.
              </p>
            </div>
          )}

          {/* Per-file extraction progress */}
          {extractionStates.length > 0 && (
            <div className="space-y-2">
              {extractionStates.map((state, i) => (
                <div key={`${state.filename}-${i}`} className="p-2 bg-surface-dark rounded-lg border border-surface-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400 truncate flex-1">{state.filename}</span>
                    <span className="text-xs ml-2 flex items-center gap-2">
                      {state.fileSize && (
                        <span className="text-gray-500">{(state.fileSize / (1024 * 1024)).toFixed(0)} MB</span>
                      )}
                      {state.status === "pending" && <span className="text-gray-500">Queued</span>}
                      {state.status === "extracting" && <span className="text-neon-pink">{state.phase ?? `${Math.round(state.progress)}%`}</span>}
                      {state.status === "transcribing" && <span className="text-neon-cyan">{state.phase ?? "Transcribing..."}</span>}
                      {state.status === "done" && <span className="text-green-400">Done</span>}
                      {state.status === "error" && <span className="text-red-400">Error</span>}
                    </span>
                  </div>
                  <div className="h-1 bg-surface-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        state.status === "error" ? "bg-red-500" : state.status === "done" ? "bg-green-500" : state.status === "transcribing" ? "bg-neon-cyan" : state.status === "pending" ? "bg-gray-600" : "bg-neon-pink"
                      }`}
                      style={{ width: `${state.status === "pending" ? 0 : state.progress}%` }}
                    />
                  </div>
                  {state.error && (
                    <div className="flex items-start justify-between mt-1">
                      <p className="text-xs text-red-400 flex-1">{state.error}</p>
                      <button
                        onClick={() => setExtractionStates((prev) => prev.filter((s) => s.filename !== state.filename))}
                        className="ml-2 text-gray-500 hover:text-red-400 flex-shrink-0"
                        title="Dismiss"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Uploaded video list */}
          {videos.filter(isUploadedVideo).length > 0 && (
            <div className="space-y-2">
              {videos.filter(isUploadedVideo).map((video) => (
                <div
                  key={video.id}
                  className="flex items-start gap-3 p-2 bg-surface-dark rounded-lg border border-surface-border"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-16 h-9 object-cover rounded flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-16 h-9 rounded bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{video.title || "Uploaded Video"}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                        Uploaded
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveVideo(video.id)}
                    className="p-1.5 text-gray-400 hover:text-neon-pink transition flex-shrink-0 mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Artifact list */}
          {artifacts.length > 0 && (
            <div className="space-y-2">
              {artifacts.map((artifact, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-surface-dark rounded-lg border border-surface-border"
                >
                  <div className={`
                    w-10 h-10 rounded flex items-center justify-center text-xs font-medium
                    ${getFileTypeColor(artifact.fileType)}
                  `}>
                    {artifact.fileType === "video" ? "VID" : artifact.fileType === "audio" ? "AUD" : artifact.fileType.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{artifact.originalFilename}</p>
                    <p className="text-xs text-gray-500">
                      {artifact.metadata.pageCount && `${artifact.metadata.pageCount} pages · `}
                      {artifact.metadata.duration && `${formatDuration(artifact.metadata.duration)} · `}
                      {artifact.metadata.wordCount.toLocaleString()} words
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveArtifact(index)}
                    className="p-1.5 text-gray-400 hover:text-neon-pink transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

        {/* Legacy YouTube videos — only shown if a draft already has them; can be removed */}
        {videos.filter((v) => !isUploadedVideo(v)).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Previously added YouTube videos</p>
            {videos.filter((v) => !isUploadedVideo(v)).map((video) => (
              <div
                key={video.id}
                className="flex items-start gap-3 p-2 bg-surface-dark rounded-lg border border-surface-border"
              >
                {video.thumbnailUrl && (
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="w-16 h-9 object-cover rounded flex-shrink-0 mt-0.5"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="block text-sm text-white truncate">
                    {video.title || video.videoId}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveVideo(video.id)}
                  className="p-1.5 text-gray-400 hover:text-neon-pink transition flex-shrink-0 mt-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legal notice */}
      <ContentLegalNotice />
    </div>
  );
}

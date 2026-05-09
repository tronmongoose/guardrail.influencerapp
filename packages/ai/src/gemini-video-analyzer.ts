/**
 * Gemini video analyzer — sends YouTube URLs to Google AI Studio for
 * structured video analysis (transcript, topics, key moments, people).
 *
 * Gemini natively accepts YouTube URLs via fileData.fileUri and watches
 * the video (audio + 1fps visual sampling).
 *
 * Env: GOOGLE_AI_API_KEY (from Google AI Studio, $300 free credit)
 * Model: configurable via GEMINI_VIDEO_MODEL, defaults to DEFAULT_GEMINI_VIDEO_MODEL
 */

import type { VideoAnalysisOutput } from "@guide-rail/shared";
import { VideoAnalysisOutputSchema } from "@guide-rail/shared";
import { GEMINI_API_BASE, getGeminiVideoModel } from "./constants";

const GEMINI_TIMEOUT_MS = 300_000; // 5 minutes — uploaded videos need more headroom

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function buildVideoAnalysisPrompt(videoTitle: string): string {
  return `You are an expert video content analyst. Analyze this video thoroughly and return structured JSON.

VIDEO TITLE: "${videoTitle}"

Extract the following information as a single JSON object (no markdown, no code fences):

{
  "summary": "2-3 sentence summary of what the video covers and its core message",
  "fullTranscript": "Complete transcript of the video with natural paragraph breaks",
  "segments": [
    {
      "startSeconds": 0,
      "endSeconds": 45,
      "text": "Transcript text for this segment",
      "topic": "Topic label for this segment",
      "speakerName": "Name of person speaking (if identifiable)"
    }
  ],
  "topics": [
    {
      "label": "Topic or section name",
      "startSeconds": 0,
      "endSeconds": 225,
      "subtopics": ["subtopic 1", "subtopic 2"]
    }
  ],
  "keyMoments": [
    {
      "timestampSeconds": 135,
      "description": "What makes this moment notable",
      "significance": "high",
      "type": "insight"
    }
  ],
  "people": [
    {
      "name": "Person's name",
      "role": "host"
    }
  ],
  "durationSeconds": 1234
}

REQUIREMENTS:
- segments: Break the video into segments at natural topic boundaries (roughly every 30-90 seconds). Include the spoken text for each segment.
- topics: Group segments by THEMATIC DISTINCTNESS, not by time. Prefer fewer, broader topics.
    * For videos under 8 minutes: return 1 topic unless the video genuinely covers two UNRELATED subjects (e.g. not "intro + demo" — that is ONE topic).
    * For videos 8-20 minutes: return 1-3 topics.
    * For videos over 20 minutes: return 2-5 topics.
    * A single tool demo, walkthrough, or concept explanation is ONE topic regardless of its length or internal sub-steps.
    * Do NOT split a video into topics just because it has an intro section followed by instruction — that is one topic.
- keyMoments: Identify the most important moments — memorable analogies, case studies, exercise demonstrations, key insights, transitions between major sections. Mark significance as "high" for must-see moments, "medium" for notable, "low" for minor.
  - type should be one of: "insight", "example", "exercise", "transition", "summary"
- people: List anyone who appears or is prominently mentioned, with their role (host, guest, expert, etc.)
- durationSeconds: Total video length in seconds
- Be precise with timestamps — they will be used to create video clips

Return ONLY the JSON object.`;
}

/**
 * Stub analysis for local dev without Gemini API key.
 * Generates plausible synthetic data from the video title.
 */
function generateStubAnalysis(videoTitle: string, durationSeconds?: number): VideoAnalysisOutput {
  const duration = durationSeconds || 600; // default 10 min
  const segmentCount = Math.max(3, Math.ceil(duration / 60));

  const segments = [];
  const segmentDuration = Math.floor(duration / segmentCount);
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      startSeconds: i * segmentDuration,
      endSeconds: Math.min((i + 1) * segmentDuration, duration),
      text: `Segment ${i + 1} of "${videoTitle}" covering key concepts and examples.`,
      topic: `Section ${i + 1}`,
    });
  }

  const topicCount = Math.max(2, Math.ceil(segmentCount / 3));
  const topicDuration = Math.floor(duration / topicCount);
  const topics = [];
  for (let i = 0; i < topicCount; i++) {
    topics.push({
      label: `Topic ${i + 1}: ${videoTitle.split(" ").slice(0, 3).join(" ")}`,
      startSeconds: i * topicDuration,
      endSeconds: Math.min((i + 1) * topicDuration, duration),
    });
  }

  return {
    summary: `This video covers "${videoTitle}". It explores key concepts, provides practical examples, and offers actionable insights for learners.`,
    fullTranscript: segments.map((s) => s.text).join(" "),
    segments,
    topics,
    keyMoments: [
      {
        timestampSeconds: Math.floor(duration * 0.15),
        description: "Key framework introduction",
        significance: "high" as const,
        type: "insight" as const,
      },
      {
        timestampSeconds: Math.floor(duration * 0.5),
        description: "Practical example demonstration",
        significance: "high" as const,
        type: "example" as const,
      },
      {
        timestampSeconds: Math.floor(duration * 0.85),
        description: "Summary and next steps",
        significance: "medium" as const,
        type: "summary" as const,
      },
    ],
    durationSeconds: duration,
  };
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text;
}

const GEMINI_FILES_UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";
const GEMINI_FILES_POLL_INTERVAL_MS = 3_000;
const GEMINI_FILES_MAX_WAIT_MS = 300_000; // 5 minutes

/**
 * Upload a video file to Gemini Files API using resumable upload.
 * Streams from the provided URL to avoid loading the full file into memory.
 * Returns the Gemini file URI to use in content requests.
 */
async function uploadVideoToGeminiFiles(
  videoUrl: string,
  videoTitle: string,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  // Step 1: Initiate resumable upload session
  const initRes = await fetch(
    `${GEMINI_FILES_UPLOAD_BASE}/files?uploadType=resumable&key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Type": mimeType,
      },
      body: JSON.stringify({ file: { displayName: videoTitle } }),
    },
  );

  if (!initRes.ok) {
    const err = await initRes.text().catch(() => "");
    throw new Error(`Gemini Files API init failed: ${initRes.status} - ${err}`);
  }

  const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("Gemini Files API: no upload URL in response");

  // Step 2: Stream video data from source URL to Gemini upload URL
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok || !videoRes.body) {
    throw new Error(`Failed to fetch video from ${videoUrl}: ${videoRes.status}`);
  }

  const contentLength = videoRes.headers.get("content-length");
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: videoRes.body as any,
    // @ts-expect-error — needed for streaming in Node.js
    duplex: "half",
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => "");
    throw new Error(`Gemini Files API upload failed: ${uploadRes.status} - ${err}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadData: any = await uploadRes.json();
  const fileName: string = uploadData.file?.name;
  if (!fileName) throw new Error("Gemini Files API: no file name in upload response");

  // Step 3: Poll until file state is ACTIVE
  const deadline = Date.now() + GEMINI_FILES_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, GEMINI_FILES_POLL_INTERVAL_MS));
    const statusRes = await fetch(
      `${GEMINI_API_BASE}/${fileName}?key=${apiKey}`,
    );
    if (!statusRes.ok) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusData: any = await statusRes.json();
    if (statusData.state === "ACTIVE") {
      return statusData.uri as string;
    }
    if (statusData.state === "FAILED") {
      throw new Error(`Gemini file processing failed: ${JSON.stringify(statusData)}`);
    }
  }

  throw new Error("Gemini Files API: timed out waiting for file to become ACTIVE");
}

/**
 * Clean up a Gemini Files API file after use.
 * Best-effort — errors are logged but not re-thrown.
 */
async function deleteGeminiFile(fileName: string, apiKey: string): Promise<void> {
  try {
    await fetch(`${GEMINI_API_BASE}/${fileName}?key=${apiKey}`, { method: "DELETE" });
  } catch {
    // best-effort cleanup
  }
}

/**
 * Analyze a directly-uploaded video file (e.g. from Vercel Blob) using Gemini.
 * Streams the video to Gemini Files API, waits for processing, then runs analysis.
 * Falls back to stub analysis if GOOGLE_AI_API_KEY is not set.
 */
export async function analyzeUploadedVideoWithGemini(
  videoUrl: string,
  videoTitle: string,
  mimeType: "video/mp4" | "video/quicktime" = "video/mp4",
): Promise<VideoAnalysisOutput> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.info("[gemini] No GOOGLE_AI_API_KEY, using stub analysis for upload");
    return generateStubAnalysis(videoTitle);
  }

  const model = getGeminiVideoModel();
  console.info(`[gemini] Uploading video to Files API: "${videoTitle}"`);

  let fileUri: string | null = null;
  let fileName: string | null = null;

  try {
    fileUri = await uploadVideoToGeminiFiles(videoUrl, videoTitle, mimeType, apiKey);
    // Extract file name from URI for cleanup (format: .../files/{name})
    const match = fileUri.match(/\/files\/([^?]+)/);
    if (match) fileName = `files/${match[1]}`;

    console.info(`[gemini] File uploaded, analyzing: "${videoTitle}" via ${model}`);

    const prompt = buildVideoAnalysisPrompt(videoTitle);
    const requestBody = {
      contents: [
        {
          parts: [
            { fileData: { fileUri, mimeType } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    const res = await fetchWithTimeout(
      `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      GEMINI_TIMEOUT_MS,
    );

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) throw new Error("Gemini returned no candidates");

    const rawText = candidates[0].content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini returned empty response");

    const json = extractJSON(rawText);
    const parsed = JSON.parse(json);
    const validated = VideoAnalysisOutputSchema.parse(parsed);

    console.info(
      `[gemini] Upload analysis complete: ${validated.segments.length} segments, ${validated.topics.length} topics`,
    );

    return validated;
  } finally {
    // Always clean up the uploaded file
    if (fileName && apiKey) {
      await deleteGeminiFile(fileName, apiKey);
    }
  }
}

/**
 * Analyze a YouTube video using Google Gemini.
 * Returns structured analysis with timestamps, topics, key moments.
 */
export async function analyzeVideoWithGemini(
  youtubeVideoId: string,
  videoTitle: string,
  durationSeconds?: number,
): Promise<VideoAnalysisOutput> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.info("[gemini] No GOOGLE_AI_API_KEY, using stub analysis");
    return generateStubAnalysis(videoTitle, durationSeconds);
  }

  const model = getGeminiVideoModel();
  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  const prompt = buildVideoAnalysisPrompt(videoTitle);

  console.info(`[gemini] Analyzing video: ${videoTitle} (${youtubeVideoId}) with ${model}`);

  const requestBody = {
    contents: [
      {
        parts: [
          {
            fileData: {
              fileUri: youtubeUrl,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  };

  const res = await fetchWithTimeout(
    `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    },
    GEMINI_TIMEOUT_MS,
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  const rawText = candidates[0].content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini returned empty response");
  }

  console.info(`[gemini] Raw response length: ${rawText.length} chars`);

  const json = extractJSON(rawText);
  const parsed = JSON.parse(json);
  const validated = VideoAnalysisOutputSchema.parse(parsed);

  console.info(
    `[gemini] Analysis complete: ${validated.segments.length} segments, ${validated.topics.length} topics, ${validated.keyMoments?.length ?? 0} key moments`,
  );

  return validated;
}

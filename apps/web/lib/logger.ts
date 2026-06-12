/**
 * Structured logging utility for observability.
 *
 * Design principles:
 * - No sensitive data (transcripts, prompts, user emails) logged by default
 * - Structured JSON format for easy parsing
 * - Consistent context (programId, operation, duration)
 * - Error details without exposing internals
 */

import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  programId?: string;
  videoId?: string;
  operation: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  operation: string;
  programId?: string;
  videoId?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  errorCode?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, context: LogContext, extra?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    ...context,
    ...extra,
  };
}

function output(entry: LogEntry) {
  const json = JSON.stringify(entry);

  if (entry.level === "error") {
    console.error(json);
  } else if (entry.level === "warn") {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export const logger = {
  info(context: LogContext, extra?: Record<string, unknown>) {
    output(formatLog("info", context, extra));
  },

  warn(context: LogContext, extra?: Record<string, unknown>) {
    output(formatLog("warn", context, extra));
  },

  error(context: LogContext, error: unknown, extra?: Record<string, unknown>) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;

    output(formatLog("error", context, {
      ...extra,
      error: errorMessage,
      errorCode,
      success: false,
    }));

    Sentry.withScope((scope) => {
      scope.setTag("operation", context.operation);
      if (context.programId) scope.setTag("programId", context.programId);
      if (context.videoId) scope.setTag("videoId", context.videoId);
      if (errorCode) scope.setTag("errorCode", errorCode);
      scope.setContext("logger", { ...context, ...extra });
      Sentry.captureException(
        error instanceof Error ? error : new Error(errorMessage),
      );
    });
  },
};

/**
 * Timer utility for measuring operation duration
 */
export function createTimer() {
  const start = performance.now();
  return {
    elapsed(): number {
      return Math.round(performance.now() - start);
    },
  };
}

/**
 * Video ingestion logging helpers
 */
export const videoLogger = {
  ingestionStart(programId: string, videoId: string, source: "single" | "batch") {
    logger.info({
      operation: "video.ingestion.start",
      programId,
      videoId,
      source,
    });
  },

  ingestionSuccess(
    programId: string,
    videoId: string,
    durationMs: number,
    details: {
      hasTranscript: boolean;
      hasMetadata: boolean;
      source: "single" | "batch";
    }
  ) {
    logger.info({
      operation: "video.ingestion.success",
      programId,
      videoId,
      durationMs,
      success: true,
      ...details,
    });
  },

  ingestionFailure(
    programId: string,
    videoId: string | null,
    durationMs: number,
    error: unknown,
    details: {
      stage: "parse" | "metadata" | "transcript" | "database";
      source: "single" | "batch";
    }
  ) {
    logger.error(
      {
        operation: "video.ingestion.failure",
        programId,
        videoId: videoId ?? "unknown",
        durationMs,
        ...details,
      },
      error
    );
  },

  transcriptUnavailable(programId: string, videoId: string) {
    logger.info({
      operation: "video.transcript.unavailable",
      programId,
      videoId,
    });
  },

  batchSummary(
    programId: string,
    durationMs: number,
    successCount: number,
    errorCount: number
  ) {
    logger.info({
      operation: "video.batch.complete",
      programId,
      durationMs,
      successCount,
      errorCount,
      totalCount: successCount + errorCount,
    });
  },
};

/**
 * AI generation logging helpers
 */
export const aiLogger = {
  embeddingStart(programId: string, contentCount: number) {
    logger.info({
      operation: "ai.embedding.start",
      programId,
      contentCount,
    });
  },

  embeddingSuccess(programId: string, durationMs: number, contentCount: number) {
    logger.info({
      operation: "ai.embedding.success",
      programId,
      durationMs,
      contentCount,
      success: true,
    });
  },

  embeddingFailure(programId: string, durationMs: number, error: unknown) {
    logger.error(
      {
        operation: "ai.embedding.failure",
        programId,
        durationMs,
      },
      error
    );
  },

  clusteringComplete(
    programId: string,
    durationMs: number,
    details: { videoCount: number; clusterCount: number }
  ) {
    logger.info({
      operation: "ai.clustering.complete",
      programId,
      durationMs,
      success: true,
      ...details,
    });
  },

  generationStart(
    programId: string,
    details: { clusterCount: number; durationWeeks: number }
  ) {
    logger.info({
      operation: "ai.generation.start",
      programId,
      ...details,
    });
  },

  generationSuccess(
    programId: string,
    durationMs: number,
    details: {
      weekCount: number;
      sessionCount: number;
      actionCount: number;
      tokenUsage?: { input?: number; output?: number };
    }
  ) {
    logger.info({
      operation: "ai.generation.success",
      programId,
      durationMs,
      success: true,
      ...details,
    });
  },

  generationFailure(
    programId: string,
    durationMs: number,
    error: unknown,
    stage: "llm" | "validation" | "persistence"
  ) {
    logger.error(
      {
        operation: "ai.generation.failure",
        programId,
        durationMs,
        stage,
      },
      error
    );
  },

  validationFailure(programId: string, issueCount: number) {
    logger.warn({
      operation: "ai.generation.validation_failure",
      programId,
      issueCount,
    });
  },

  extractionStart(programId: string, contentCount: number) {
    logger.info({
      operation: "ai.extraction.start",
      programId,
      contentCount,
    });
  },

  extractionSuccess(programId: string, durationMs: number, contentCount: number) {
    logger.info({
      operation: "ai.extraction.success",
      programId,
      durationMs,
      contentCount,
      success: true,
    });
  },

  extractionFailure(programId: string, durationMs: number, error: unknown) {
    logger.error(
      {
        operation: "ai.extraction.failure",
        programId,
        durationMs,
      },
      error,
    );
  },
};

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

type Status = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget() {
  const params = useParams();
  const programId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined;

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && status !== "sending";

  async function handleSend() {
    if (!canSend) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, programId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not send feedback");
      }
      setStatus("sent");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1800);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Could not send feedback");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 flex items-center justify-center gap-2 h-10 w-10 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 rounded-full bg-pink-600/80 sm:bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold shadow-lg shadow-pink-900/40 backdrop-blur-sm transition"
        aria-label="Send feedback"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="hidden sm:inline">Feedback</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4 z-50 sm:w-[320px] rounded-xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/60 animate-slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Send feedback</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setStatus("idle");
            setErrorMsg(null);
          }}
          className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition"
          aria-label="Close feedback"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3">
        {status === "sent" ? (
          <p className="text-sm text-teal-400 py-4 text-center">Thanks — got it.</p>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A sentence or two — what's working, what's not?"
              maxLength={2000}
              rows={4}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/60 resize-none"
            />
            {errorMsg && (
              <p className="text-xs text-red-400">{errorMsg}</p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-500">Goes straight to the team.</p>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

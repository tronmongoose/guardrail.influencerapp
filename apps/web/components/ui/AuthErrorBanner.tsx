"use client";

import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "That link is missing a token. Please request a new access link.",
  invalid_link: "That access link is invalid. Please request a new one.",
  "link expired": "That access link has expired. Please request a new one.",
  link_expired: "That access link has expired. Please request a new one.",
  already_used: "That access link has already been used. Please request a new one.",
};

export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (!error) return null;

  const message =
    ERROR_MESSAGES[error] ||
    `Something went wrong: ${decodeURIComponent(error)}. Please try again.`;

  return (
    <div className="mx-6 mt-4 p-4 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-center">
      <p className="text-sm text-neon-pink font-medium">{message}</p>
    </div>
  );
}

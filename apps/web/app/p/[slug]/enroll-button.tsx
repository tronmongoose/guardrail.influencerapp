"use client";

import { useState } from "react";
import { SkinButton } from "@/components/skins/SkinButton";

interface EnrollButtonProps {
  programId: string;
  isFree: boolean;
  priceDisplay: string;
}

export function EnrollButton({ programId, isFree, priceDisplay }: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const handleEnroll = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/checkout/${programId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined, name: name || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiresEmail) {
          setShowEmailForm(true);
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Failed to enroll");
      }

      if (data.redirectUrl) {
        // Free enrollment or already enrolled — redirect directly
        window.location.href = data.redirectUrl;
        return;
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Unexpected response from server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Email form
  if (showEmailForm) {
    return (
      <div className="space-y-3">
        <div>
          <label
            htmlFor="email"
            className="block mb-1"
            style={{
              fontSize: "var(--token-text-label-sm-size)",
              fontWeight: "var(--token-text-label-sm-weight)",
              color: "var(--token-color-text-primary)",
            }}
          >
            Email address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 focus:outline-none"
            style={{
              borderRadius: "var(--token-radius-md)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid var(--token-color-border-subtle)",
              color: "var(--token-color-text-primary)",
              fontSize: "var(--token-text-body-sm-size)",
            }}
            required
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="block mb-1"
            style={{
              fontSize: "var(--token-text-label-sm-size)",
              fontWeight: "var(--token-text-label-sm-weight)",
              color: "var(--token-color-text-primary)",
            }}
          >
            Name <span style={{ color: "var(--token-color-text-secondary)" }}>(optional)</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2 focus:outline-none"
            style={{
              borderRadius: "var(--token-radius-md)",
              backgroundColor: "var(--token-color-bg-elevated)",
              border: "1px solid var(--token-color-border-subtle)",
              color: "var(--token-color-text-primary)",
              fontSize: "var(--token-text-body-sm-size)",
            }}
          />
        </div>
        <SkinButton
          variant="primary"
          onClick={handleEnroll}
          disabled={loading || !email}
          className="w-full py-3"
        >
          {loading ? "Processing..." : isFree ? "Get free access" : "Continue to payment"}
        </SkinButton>
        <button
          onClick={() => setShowEmailForm(false)}
          className="w-full py-2 transition"
          style={{
            color: "var(--token-color-text-secondary)",
            fontSize: "var(--token-text-body-sm-size)",
          }}
        >
          Cancel
        </button>
        {error && (
          <p
            className="text-sm"
            style={{ color: "var(--token-color-semantic-error)" }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  // Initial button state
  return (
    <div className="space-y-2">
      <SkinButton
        variant="primary"
        onClick={handleEnroll}
        disabled={loading}
        className="w-full py-3"
      >
        {loading ? "Processing..." : isFree ? "Enroll free" : `Buy for ${priceDisplay}`}
      </SkinButton>
      {error && (
        <p
          className="text-sm"
          style={{ color: "var(--token-color-semantic-error)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

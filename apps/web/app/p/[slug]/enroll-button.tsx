"use client";

import { useState } from "react";
import { SkinButton } from "@/components/skins/SkinButton";

interface EnrollButtonProps {
  programId: string;
  isFree: boolean;
  priceDisplay: string;
  isEnrolled?: boolean;
}

const gradientBtnStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #AD46FF 0%, #F6339A 100%)",
  borderRadius: "100px",
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--token-text-label-sm-size)",
  fontWeight: "var(--token-text-label-sm-weight)",
  color: "var(--token-color-text-primary)",
};

const inputStyle: React.CSSProperties = {
  borderRadius: "var(--token-radius-md)",
  backgroundColor: "var(--token-color-bg-elevated)",
  border: "1px solid var(--token-color-border-subtle)",
  color: "var(--token-color-text-primary)",
  fontSize: "var(--token-text-body-sm-size)",
};

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm" style={{ color: "var(--token-color-semantic-error)" }}>
      {message}
    </p>
  );
}

export function EnrollButton({ programId, isFree, priceDisplay, isEnrolled }: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  if (isEnrolled) {
    return (
      <SkinButton
        variant="primary"
        onClick={() => { window.location.href = `/learn/${programId}`; }}
        className="w-full py-3"
        style={gradientBtnStyle}
      >
        Continue learning →
      </SkinButton>
    );
  }

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);

    // Validate email client-side with a friendly message
    if (showEmailForm && email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }
    }

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

      const destination = data.redirectUrl || data.checkoutUrl;
      if (destination) {
        window.location.href = destination;
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
          <label htmlFor="email" className="block mb-1" style={labelStyle}>
            Email address
          </label>
          <input
            type="text"
            id="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 focus:outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="name" className="block mb-1" style={labelStyle}>
            Name <span style={{ color: "var(--token-color-text-secondary)" }}>(optional)</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2 focus:outline-none"
            style={inputStyle}
          />
        </div>
        <SkinButton
          variant="primary"
          onClick={handleEnroll}
          disabled={loading || !email}
          className="w-full py-3"
          style={gradientBtnStyle}
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
        <ErrorMessage message={error} />
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
        style={gradientBtnStyle}
      >
        {loading ? "Processing..." : isFree ? "Enroll free" : `Buy for ${priceDisplay}`}
      </SkinButton>
      <ErrorMessage message={error} />
    </div>
  );
}

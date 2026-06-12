import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendMagicLink } from "./ResendMagicLink";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ programId?: string; session_id?: string; granted?: string }>;
}) {
  const params = await searchParams;
  const programId = params.programId;
  const sessionId = params.session_id;
  const granted = params.granted === "1";

  // Self-heal path: Stripe sessions created before the success_url was moved
  // to /api/checkout/finalize land here directly with session_id. Hand off to
  // finalize so the entitlement is claimed and the session cookie is set —
  // the learner gets instant access without bouncing through email.
  if (sessionId && programId && params.granted === undefined) {
    redirect(
      `/api/checkout/finalize?programId=${encodeURIComponent(programId)}&session_id=${encodeURIComponent(sessionId)}`,
    );
  }

  return (
    <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {granted ? "You're in" : "Payment successful"}
          </h1>

          <p className="text-gray-400 mb-6">
            {granted
              ? "Your access is ready. Continue to your program below — we also sent you an email link as a backup for signing in from another device."
              : "Thank you for your purchase — your access is yours to keep. We're sending a sign-in link to your email so you can pick up where you left off from any device."}
          </p>

          {!granted && (
            <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                <strong className="text-neon-cyan">Heads up:</strong> the email link is single-use
                and expires in 24 hours, but your purchase is permanent — you can request a fresh
                link any time.
              </p>
            </div>
          )}

          {!granted && programId && <ResendMagicLink programId={programId} />}

          <div className="flex gap-3 justify-center">
            {programId && granted && (
              <Link
                href={`/learn/${programId}`}
                className="px-6 py-3 bg-gradient-to-r from-neon-cyan to-neon-pink text-surface-dark rounded-lg font-medium hover:opacity-90 transition"
              >
                Continue to your program →
              </Link>
            )}
            <Link
              href="/"
              className="px-6 py-3 bg-surface-dark border border-surface-border text-gray-300 rounded-lg font-medium hover:border-neon-cyan hover:text-neon-cyan transition"
            >
              Return home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

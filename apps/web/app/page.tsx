import Link from "next/link";
import { Suspense } from "react";
import { AuthNav, AuthCTA } from "./auth-components";
import { AuthErrorBanner } from "@/components/ui/AuthErrorBanner";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen gradient-bg-radial grid-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-surface-border/50 backdrop-blur-sm">
        <span className="text-xl font-bold tracking-tight neon-text-cyan text-neon-cyan">
          GuideRail
        </span>
        <AuthNav />
      </nav>

      {/* Auth error banner (from magic link failures) */}
      <Suspense fallback={null}>
        <AuthErrorBanner />
      </Suspense>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-12 pb-20">
        <div className="max-w-3xl space-y-8">
          {/* Badge */}
          <div className="animate-slide-up">
            <span className="inline-block px-4 py-1.5 rounded-full border border-neon-pink/30 text-neon-pink text-xs font-bold uppercase tracking-widest bg-neon-pink/5">
              For creators who teach
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] animate-slide-up-delay">
            Your videos.{" "}
            <span className="gradient-text">Structured.</span>
            <br />
            <span className="text-neon-cyan neon-text-cyan">Sold.</span>
          </h1>

          {/* Sub */}
          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-xl mx-auto animate-slide-up-delay-2">
            Paste YouTube links. AI structures them into a week-by-week
            guided program. Set a price. Launch.
          </p>

          {/* CTA */}
          <div className="animate-slide-up-delay-3">
            <AuthCTA />
          </div>
        </div>

        {/* How it works */}
        <section id="how-it-works" className="mt-20 sm:mt-32 w-full max-w-4xl">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-neon-yellow neon-text-yellow mb-8 sm:mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Step 01 */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-left hover:border-neon-cyan/40 transition-all hover:-translate-y-1 neon-glow-box">
              <span className="text-neon-cyan text-xs font-bold uppercase tracking-widest">
                Step 01
              </span>
              <h3 className="text-lg font-bold mt-3 mb-2 text-white">
                Paste your videos
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Drop YouTube URLs. We pull metadata, thumbnails, and descriptions instantly.
              </p>
            </div>
            {/* Step 02 */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-left hover:border-neon-pink/40 transition-all hover:-translate-y-1 neon-glow-pink">
              <span className="text-neon-pink text-xs font-bold uppercase tracking-widest">
                Step 02
              </span>
              <h3 className="text-lg font-bold mt-3 mb-2 text-white">
                AI builds the structure
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Embeddings cluster your content into weeks, sessions, and actions. You edit the draft.
              </p>
            </div>
            {/* Step 03 */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-left hover:border-neon-yellow/40 transition-all hover:-translate-y-1">
              <span className="text-neon-yellow text-xs font-bold uppercase tracking-widest">
                Step 03
              </span>
              <h3 className="text-lg font-bold mt-3 mb-2 text-white">
                Publish &amp; earn
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Set your price. We handle Stripe checkout. Learners get a guided, drip-fed journey.
              </p>
            </div>
          </div>
        </section>

        {/* Stats / Social Proof placeholder */}
        <section className="mt-20 sm:mt-28 w-full max-w-3xl">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-black text-neon-cyan">6-12</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider sm:tracking-widest mt-1 sm:mt-2 font-medium">Week programs</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-black text-neon-pink">4</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider sm:tracking-widest mt-1 sm:mt-2 font-medium">Action types</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-black text-neon-yellow">$0</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider sm:tracking-widest mt-1 sm:mt-2 font-medium">To start</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-20 sm:mt-28 w-full max-w-xl">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-8 sm:p-12 text-center neon-glow-box">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">
              Ready to <span className="text-neon-cyan">launch</span>?
            </h2>
            <p className="text-gray-500 mb-8 text-sm">
              Your audience is waiting for structure. Give it to them.
            </p>
            <Link
              href="/dashboard"
              className="btn-neon-pink px-10 py-4 rounded-xl text-white inline-block"
            >
              Create your first program
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-600 border-t border-surface-border/30">
        &copy; {new Date().getFullYear()} GuideRail
      </footer>
    </div>
  );
}

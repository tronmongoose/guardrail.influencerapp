import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export function AuthNav() {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <SignedOut>
        <Link
          href="/sign-in"
          className="px-3 sm:px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 transition-all"
        >
          Sign in
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard" className="text-sm text-neon-cyan font-medium hover:neon-text-cyan transition-all">
          Dashboard
        </Link>
        <UserButton />
      </SignedIn>
    </div>
  );
}

export function AuthCTA() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <SignedOut>
        <Link
          href="/sign-in"
          className="btn-neon px-8 py-4 rounded-xl text-surface-dark font-bold text-center"
        >
          Start building
        </Link>
      </SignedOut>
      <SignedIn>
        {/* Dashboard will redirect to /new if they have no programs */}
        <Link
          href="/dashboard"
          className="btn-neon px-8 py-4 rounded-xl text-surface-dark text-center font-bold"
        >
          Go to dashboard
        </Link>
      </SignedIn>
      <Link
        href="#how-it-works"
        className="px-8 py-4 rounded-xl border border-surface-border text-gray-300 hover:border-neon-cyan hover:text-neon-cyan transition-all text-center font-medium"
      >
        See how it works
      </Link>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen gradient-bg-radial grid-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-neon-cyan"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="text-xs font-mono uppercase tracking-widest text-neon-cyan/70 mb-2">
          404
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          We can&apos;t find that page
        </h1>
        <p className="text-gray-400 mb-6 text-sm">
          The link you followed may be broken, or the page may have moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 transition"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

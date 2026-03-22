export function ContentLegalNotice() {
  return (
    <div className="flex items-start gap-3 p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
      <svg className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <div>
        <p className="text-xs font-medium text-neon-cyan mb-1">Your content, your rights</p>
        <p className="text-[11px] leading-relaxed text-gray-400">
          By uploading or connecting content you confirm you own it or hold all necessary rights to use, publish, and monetize it, and that it doesn&apos;t infringe any third-party rights. You retain full ownership — Journeyline claims no rights to your content, now or ever.
        </p>
      </div>
    </div>
  );
}

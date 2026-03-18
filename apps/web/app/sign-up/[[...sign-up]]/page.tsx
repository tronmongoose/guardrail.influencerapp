import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen gradient-bg-radial grid-bg flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-surface-border/50">
        <Link href="/" className="text-xl font-bold tracking-tight neon-text-cyan text-neon-cyan">
          Journeyline
        </Link>
      </nav>

      {/* Sign up form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <SignUp
            appearance={{
              variables: {
                colorPrimary: "#00fff0",
                colorBackground: "#12121a",
                colorInputBackground: "#0a0a0f",
                colorInputText: "#ffffff",
                colorText: "#ffffff",
                colorTextSecondary: "#9ca3af",
                colorDanger: "#ff2dff",
                borderRadius: "0.75rem",
              },
              elements: {
                rootBox: "mx-auto",
                card: "bg-[#12121a] border border-[#1e1e2e] shadow-2xl shadow-[#00fff0]/5",
                headerTitle: "text-white text-2xl font-bold",
                headerSubtitle: "text-gray-400",
                socialButtonsBlockButton:
                  "bg-[#0a0a0f] border border-[#1e1e2e] text-white hover:border-[#00fff0]/40 transition-all",
                socialButtonsBlockButtonText: "text-white font-medium",
                socialButtonsBlockButtonArrow: "text-[#00fff0]",
                dividerLine: "bg-[#1e1e2e]",
                dividerText: "text-gray-500 text-xs uppercase tracking-widest",
                formFieldLabel: "text-gray-300 text-sm font-medium",
                formFieldInput:
                  "bg-[#0a0a0f] border-[#1e1e2e] text-white placeholder:text-gray-500 focus:border-[#00fff0] focus:ring-1 focus:ring-[#00fff0]",
                formButtonPrimary:
                  "bg-gradient-to-r from-[#00fff0] to-[#ff2dff] hover:opacity-90 text-[#0a0a0f] font-bold text-base py-3",
                footerAction: "text-gray-400",
                footerActionLink: "text-[#00fff0] hover:text-[#ff2dff] font-medium",
                identityPreview: "bg-[#0a0a0f] border border-[#1e1e2e]",
                identityPreviewText: "text-white",
                identityPreviewEditButton: "text-[#00fff0] hover:text-[#ff2dff]",
                formFieldSuccessText: "text-[#00fff0]",
                formFieldErrorText: "text-[#ff2dff]",
                alertText: "text-white",
                badge: "bg-[#00fff0]/10 text-[#00fff0] border border-[#00fff0]/30",
              },
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { GenerationProvider } from "@/components/generation";

export const metadata: Metadata = {
  title: "Journeyline — Guided Learning Programs",
  description: "Premium instructor-led programs built from your content.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen flex flex-col">
          <ToastProvider>
            <GenerationProvider>{children}</GenerationProvider>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Space_Grotesk, Inter, Fraunces, Nunito, Quicksand } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { GenerationProvider } from "@/components/generation";

// Google Tag Manager container for app.journeyline.ai (paid-channel conversion
// tracking). GTM IDs are public by design. Marketing site journeyline.ai uses
// the same container but is hosted separately (Cloudflare).
const GTM_ID = "GTM-P2TFZKLC";

// Skin Studio font presets — each preset's token strings reference these
// CSS variables so the font swap applies without a network round-trip.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const inter        = Inter({        subsets: ["latin"], variable: "--font-inter",         display: "swap" });
const fraunces     = Fraunces({     subsets: ["latin"], variable: "--font-fraunces",      display: "swap" });
const nunito       = Nunito({       subsets: ["latin"], variable: "--font-nunito",        display: "swap" });
const quicksand    = Quicksand({    subsets: ["latin"], variable: "--font-quicksand",     display: "swap" });

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
      <html
        lang="en"
        className={`${spaceGrotesk.variable} ${inter.variable} ${fraunces.variable} ${nunito.variable} ${quicksand.variable}`}
      >
        {/* Google Tag Manager */}
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        {/* End Google Tag Manager */}
        <body className="min-h-screen flex flex-col">
          {/* Google Tag Manager (noscript) */}
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
          {/* End Google Tag Manager (noscript) */}
          <ToastProvider>
            <GenerationProvider>{children}</GenerationProvider>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

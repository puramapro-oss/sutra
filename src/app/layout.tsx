import type { Metadata, Viewport } from "next";
import { Orbitron, Exo_2 } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const exo2 = Exo_2({
  subsets: ["latin", "latin-ext"],
  variable: "--font-exo2",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const APP_NAME = "SUTRA";
const APP_DESCRIPTION =
  "Generez des videos professionnelles par IA en quelques secondes. Transformez vos idees en contenus visuels epoustouflants avec SUTRA by Purama.";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sutra.purama.dev";

export const metadata: Metadata = {
  title: {
    default: "SUTRA by Purama — Generation Video IA",
    template: "%s | SUTRA by Purama",
  },
  description: APP_DESCRIPTION,
  keywords: [
    "generation video IA",
    "video IA",
    "intelligence artificielle video",
    "creation video automatique",
    "SUTRA",
    "Purama",
    "text to video",
    "AI video generator",
    "video marketing IA",
  ],
  authors: [{ name: "Purama", url: "https://purama.dev" }],
  creator: "Purama",
  publisher: "Purama",
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: APP_URL,
    siteName: APP_NAME,
    title: "SUTRA by Purama — Generation Video IA",
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "SUTRA by Purama — Generation Video IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SUTRA by Purama — Generation Video IA",
    description: APP_DESCRIPTION,
    images: ["/api/og"],
    creator: "@purama_dev",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#06050e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${orbitron.variable} ${exo2.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col bg-[#06050e] text-[#f8fafc]">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(255, 255, 255, 0.06)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              color: "#f8fafc",
              borderRadius: "12px",
            },
          }}
          richColors
          closeButton
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

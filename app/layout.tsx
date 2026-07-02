import type { Metadata } from "next";
import { VT323, Inter, Geist_Mono } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { DemoBanner } from "@/components/demo-banner";
import { IS_DEMO } from "@/lib/demo";
import "./globals.css";

// The deck's dot-matrix LCD face is the app's display type — the same font
// the cover projects onto the mural, so every page reads as the same machine.
const lcdFont = VT323({
  variable: "--font-lcd",
  weight: "400",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "solostereo",
  description: "A personal Spotify listening archive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${lcdFont.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {IS_DEMO && <DemoBanner />}
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}

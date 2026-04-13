import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import FeedbackFab from "@/components/FeedbackFab";
import { JarvisProvider } from "@/components/JarvisContext";
import JarvisBackground from "@/components/JarvisBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Profile Coach — AI LinkedIn Optimizer",
  description: "Recruiters use AI to find candidates. Use AI to be found. Get your free LinkedIn score in 60 seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050510] text-white">
        <JarvisProvider>
          <JarvisBackground />
          <div className="relative" style={{ zIndex: 2 }}>
            {children}
          </div>
          <FeedbackFab />
        </JarvisProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}

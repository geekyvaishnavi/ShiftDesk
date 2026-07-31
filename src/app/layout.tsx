import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "ShiftDesk",
  description: "Create, claim, and manage clinic shifts for doctors, nurses, and receptionists.",
};

/// Runs before first paint so the page never flashes the wrong theme. The
/// server cannot know the preference, so it writes nothing and this script
/// settles data-theme from storage, falling back to the OS setting.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the script above adds data-theme to <html>
    // before React hydrates, so the attribute legitimately differs from the
    // server output.
    //
    // lang is en-GB rather than en: every formatter in the app is en-GB with
    // hourCycle h23, and the document should declare the same locale the
    // native date and time pickers are asked to render in.
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

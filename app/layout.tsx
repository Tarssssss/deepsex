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
  title: "DeepSex",
  description:
    "A DeepSex coding agent, powered by the DeepSeek API — reads, edits, and runs code in a sandbox.",
};

// Set the theme before first paint to avoid a flash of the wrong theme. The
// preference lives in the persisted settings object (ds-settings); "system"
// resolves against prefers-color-scheme.
const themeInit = `(function(){try{var p='system';var raw=localStorage.getItem('ds-settings');if(raw){var s=JSON.parse(raw);if(s&&s.theme){p=s.theme;}}var t=p;if(p==='system'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full h-full">{children}</body>
    </html>
  );
}

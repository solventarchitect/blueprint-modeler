import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { Analytics } from "@/components/Analytics";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle, themeBootScript } from "@/components/ThemeToggle";
import { shareCaptureScript } from "@/io/shareLink";
import { site } from "@/lib/site";
import "./globals.css";

// Self-hosted IBM Plex (OFL, see src/fonts/README.md): no requests to any font CDN.
const sans = localFont({
  src: [{ path: "../fonts/ibm-plex-sans-latin-wght-normal.woff2", style: "normal" }],
  variable: "--font-plex-sans",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s — ${site.name}` },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: site.name, url: "/", title: site.title, description: site.description },
  twitter: { card: "summary", site: "@thesolarchitect", creator: "@thesolarchitect" },
  authors: [site.author],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121e2b" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* A shared model's link (M45): off the address before any other script runs. */}
        <script dangerouslySetInnerHTML={{ __html: shareCaptureScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-surface text-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        <header className="h-14 border-b border-border">
          <div className="flex h-full items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="flex min-h-11 items-center gap-3 hover:text-accent">
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center border border-accent font-mono text-xs font-medium text-accent"
              >
                BM
              </span>
              <span className="font-mono text-sm font-medium tracking-[0.14em] uppercase max-[479px]:sr-only">{site.name}</span>
            </Link>
            <nav aria-label="Main" className="ml-auto">
              <ul className="flex items-center gap-1 text-sm">
                <li>
                  <Link href="/editor" className="inline-flex min-h-11 items-center px-3 text-ink-soft hover:text-accent">
                    Editor
                  </Link>
                </li>
                <li>
                  <Link href="/guide" className="inline-flex min-h-11 items-center px-3 text-ink-soft hover:text-accent">
                    Guide
                  </Link>
                </li>
              </ul>
            </nav>
            <ThemeToggle />
          </div>
        </header>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}

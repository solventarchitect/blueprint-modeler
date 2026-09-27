import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-surface text-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center border border-accent font-mono text-xs font-medium text-accent"
            >
              BM
            </span>
            <span className="font-mono text-sm font-medium tracking-[0.14em] uppercase">{site.name}</span>
          </div>
        </header>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-muted sm:px-6">
            <p>
              Built by{" "}
              <a className="text-accent underline underline-offset-4" href={site.author.url}>
                {site.author.name}
              </a>
              . Free and open source (MIT) —{" "}
              <a className="text-accent underline underline-offset-4" href={site.repo}>
                source on GitHub
              </a>
              .
            </p>
            <p>{site.notAffiliated}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

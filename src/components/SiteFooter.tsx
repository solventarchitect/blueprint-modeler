"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

/** The site footer. The editor fills the screen, so it carries these links in its own status bar instead. */
export function SiteFooter() {
  const path = usePathname();
  if (path?.startsWith("/editor")) return null;
  return (
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
        <p className="flex gap-4">
          <Link className="text-accent underline underline-offset-4" href="/about">
            About
          </Link>
          <Link className="text-accent underline underline-offset-4" href="/privacy">
            Privacy
          </Link>
        </p>
      </div>
    </footer>
  );
}

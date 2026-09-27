import type { Page } from "@playwright/test";

const PRODUCTION = "https://model.mikereams.com";
const beaconHosts = new Set(["static.cloudflareinsights.com", "cloudflareinsights.com"]);

/**
 * Collects requests to any origin but the app's own. The Cloudflare Web Analytics beacon is
 * allowed only when testing the production site; local, CI and preview builds must load nothing.
 */
export function watchForeignRequests(page: Page, baseURL: string | undefined): string[] {
  const origin = new URL(baseURL!).origin;
  const allowBeacon = origin === PRODUCTION;
  const foreign: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!u.protocol.startsWith("http") || u.origin === origin) return;
    if (allowBeacon && beaconHosts.has(u.hostname)) return;
    foreign.push(r.url());
  });
  return foreign;
}

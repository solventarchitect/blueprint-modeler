import Script from "next/script";
import { CF_BEACON_TOKEN, analyticsEnabled } from "@/lib/analytics";

/**
 * Cloudflare Web Analytics: cookieless, no client-side state, so no consent banner (see /privacy).
 * `lazyOnload` injects it after the load event with no preload, so it never slows first paint.
 */
export function Analytics() {
  if (!analyticsEnabled()) return null;
  return <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="lazyOnload" data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })} />;
}

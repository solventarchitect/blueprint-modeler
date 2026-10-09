import { CF_BEACON_TOKEN, analyticsEnabled } from "@/lib/analytics";
import { BeaconLoader } from "./BeaconLoader";

/**
 * Cloudflare Web Analytics: cookieless, no client-side state, so no consent banner (see /privacy).
 * `lazyOnload` injects it after the load event with no preload, so it never slows first paint.
 * Decided at build time (production only); the loader skips pages opened from a model link.
 */
export function Analytics() {
  if (!analyticsEnabled()) return null;
  return <BeaconLoader token={CF_BEACON_TOKEN} />;
}

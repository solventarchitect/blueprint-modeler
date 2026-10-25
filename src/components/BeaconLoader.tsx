"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * Loads the visit counter after the page has loaded, unless the page arrived with a shared model's
 * link (M45): the browser keeps the address a page arrived with in its navigation-timing record, so
 * on such a page the counter is never loaded at all. The flag is read after hydration (the server
 * renders nothing). A model link pasted in later sets it too, once the counter may already be loaded:
 * nothing then needs to change, so there is nothing to subscribe to.
 */
export function BeaconLoader({ token }: { token: string }) {
  const load = useSyncExternalStore(
    never,
    () => !window.__bmNoBeacon,
    () => false,
  );
  if (!load) return null;
  return <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="lazyOnload" data-cf-beacon={JSON.stringify({ token })} />;
}

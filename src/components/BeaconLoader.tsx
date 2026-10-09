"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

/**
 * Loads the visit counter after the page has loaded, unless the page arrived with a shared model's
 * link (M45): the browser keeps the address a page arrived with in its navigation-timing record, so
 * on such a page the counter is never loaded at all.
 */
export function BeaconLoader({ token }: { token: string }) {
  const [load, setLoad] = useState(false);
  useEffect(() => {
    if (!window.__bmNoBeacon) setLoad(true);
  }, []);
  if (!load) return null;
  return <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="lazyOnload" data-cf-beacon={JSON.stringify({ token })} />;
}

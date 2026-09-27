/**
 * Cloudflare Web Analytics beacon token (public: it ships in every page, as Cloudflare's setup
 * has you paste it; it identifies the site and grants no access). Shared with mikereams.com —
 * the Cloudflare dashboard filters by host. Swap for a dedicated site token if one is created.
 */
export const CF_BEACON_TOKEN = "0ade116815b74944905349c31dbfabf7";

/** Only Vercel production builds report; previews, CI and local builds load nothing third-party. */
export const analyticsEnabled = (env = process.env.VERCEL_ENV) => env === "production";

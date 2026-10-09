import type { Metadata } from "next";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Blueprint Modeler keeps your models in your browser. No accounts, no cookies, anonymous visit statistics only.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Prose eyebrow="Privacy" title="Privacy">
      <p>Short version: your models never leave your device unless you export or share them, and there are no accounts or cookies.</p>
      <h2>Your models</h2>
      <p>
        Models are stored in your browser&apos;s own storage (IndexedDB) on this device. They are not sent anywhere.
        Delete them in the editor under Manage…, or by clearing your browser&apos;s site data; either way, export a file first
        if you want a copy. Import reads the file you
        choose inside the browser; export creates the file on your device. Auto-layout runs in a background worker on
        your device.
      </p>
      <h2>Shared links</h2>
      <p>
        Export › Copy link to this model makes a link you can share. A shared link contains the whole model.
        Anyone who has the link can read it, and it stays in browser history and wherever you paste it. The part after
        # is not sent to our server. Opening a shared link saves a copy of the model in the browser that opens it, as
        importing a file does, and the visit counter below is not loaded on a page opened from one.
      </p>
      <h2>Your settings</h2>
      <p>
        A few display settings are saved in this browser (local storage) so they stick between visits: Light or Dark if
        you pick one in the header (Auto saves nothing), the editor&apos;s lens, and its View options (layer boxes, lanes,
        snap to grid). They never leave your device.
      </p>
      <h2>Visit statistics</h2>
      <p>
        The live site uses Cloudflare Web Analytics to count visits: which pages are viewed, the referring site, and
        the browser, device type and country. It sets no cookies and does not track you across sites. It never sees
        your models.
      </p>
      <h2>Hosting</h2>
      <p>
        The site is hosted on Vercel, which processes standard request data (such as your IP address) to deliver the
        pages and keep them secure.
      </p>
      <h2>Changes</h2>
      <p>If this changes, this page changes first. Last updated October 9, 2026.</p>
    </Prose>
  );
}

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
      <p>Short version: your models never leave your device unless you export them, and there are no accounts or cookies.</p>
      <h2>Your models</h2>
      <p>
        Models are stored in your browser&apos;s own storage (IndexedDB) on this device. They are not sent anywhere.
        Clearing your browser&apos;s site data deletes them, so export a file to keep a copy. Import reads the file you
        choose inside the browser; export creates the file on your device. Auto-layout runs in a background worker on
        your device.
      </p>
      <h2>Your theme choice</h2>
      <p>If you pick Light or Dark in the header, that choice is saved in this browser (local storage). Auto saves nothing.</p>
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
      <p>If this changes, this page changes first. Last updated September 27, 2026.</p>
    </Prose>
  );
}

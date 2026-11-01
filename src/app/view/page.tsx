import type { Metadata } from "next";
import { Viewer } from "@/viewer/Viewer";

/** M75: a model opened read only from a view-only link; nothing is saved. Not for search engines (each link is someone's model). */
export const metadata: Metadata = {
  title: "View a model",
  description: "A Blueprint Modeler model, opened read only from a link. Nothing is saved until you choose Save a copy.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/view" },
  openGraph: { url: "/view" },
};

export default function ViewPage() {
  return <Viewer />;
}

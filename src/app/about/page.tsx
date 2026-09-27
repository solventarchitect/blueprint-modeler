import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "What Blueprint Modeler is, how its CSDM content was written, and who built it.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Prose eyebrow="About" title="About Blueprint Modeler">
      <p>
        Blueprint Modeler is a free canvas for sketching application architecture with the Common Service Data Model
        (CSDM): from business capability to business application, application service and the technology underneath.
        It suggests only the relationships the model uses, flags common gaps as you draw, and exports a file you can
        keep in Git or an image you can put in a slide.
      </p>
      <h2>How the CSDM content was written</h2>
      <p>
        Every class, relationship and hint comes from ServiceNow&apos;s public CSDM material, mainly the CSDM 5 white
        paper, and is written in our own words. Each entry links to its source in the <a href="/guide">class guide</a>,
        and relationship types are labeled by how well the public text supports them. Nothing here is copied from any
        employer, customer or instance, and the tool never connects to a ServiceNow instance.
      </p>
      <h2>No account, no server</h2>
      <p>
        The app is a static site. Your models are saved only in your browser, and import, export and auto-layout all
        run on your device. See <a href="/privacy">Privacy</a> for the details.
      </p>
      <h2>Who built it</h2>
      <p>
        Built by <a href={site.author.url}>{site.author.name}</a>, an enterprise architect. The code is open source
        under the MIT license: <a href={site.repo}>{site.repo.replace("https://", "")}</a>. Issues and suggestions are
        welcome there.
      </p>
      <h2>Not affiliated</h2>
      <p>{site.notAffiliated}</p>
    </Prose>
  );
}

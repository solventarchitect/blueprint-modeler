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
        (CSDM): from Business Capability to Business Application, Application Service and the technology underneath.
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
      <h2>Other frameworks</h2>
      <p>
        Switch the lens to <strong>CSDM + ArchiMate 3.2</strong> and every element also shows the ArchiMate element it
        maps to, with the notation icon. The model itself stays in CSDM terms, so nothing about your files changes. The
        mapping is written in our own words and linked to the public ArchiMate specification in the{" "}
        <a href="/guide#archimate">class guide</a>, and Export › ArchiMate model writes a Model Exchange File you can open in Archi or another ArchiMate tool. ArchiMate® is a registered trademark of The Open Group; this tool is
        not affiliated with or endorsed by The Open Group.
      </p>
      <h2>Blast radius</h2>
      <p>
        Right-click an element on the canvas, or use the button in the Inspector, and choose{" "}
        <strong>Show blast radius</strong>: the element is marked failed, and each hop of elements that depend on it
        lights up in turn. Switch to Dependencies to see what the element needs instead. While it is open, Export ›
        Blast radius animation (GIF) saves it as an animated image. The impact rules behind it, with their evidence, are
        in the <a href="/guide#impact">class guide</a>. It is a what-if on your model, not ServiceNow&apos;s Impacted
        Services calculation, and it never changes the model.
      </p>
      <h2>No account, no server</h2>
      <p>
        The app is a static site. Your models are saved only in your browser, and import, export and auto-layout all
        run on your device. Export › Copy link to this model shares a model without a server: the whole model travels
        inside the link, after the #, which browsers never send to a server, and whoever opens it gets their own copy.
        See <a href="/privacy">Privacy</a> for the details.
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

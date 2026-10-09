import type { Metadata } from "next";
import { Editor } from "@/editor/Editor";
import { shareCaptureScript } from "@/io/shareLink";

export const metadata: Metadata = {
  title: "Editor",
  description: "Model application architecture the CSDM way, in your browser.",
  alternates: { canonical: "/editor" },
};

export default function EditorPage() {
  return (
    <>
      {/* A shared model's link (M45): runs while the page is parsed, so the model leaves the address
          before any script loaded after the page could read it. */}
      <script dangerouslySetInnerHTML={{ __html: shareCaptureScript }} />
      <Editor />
    </>
  );
}

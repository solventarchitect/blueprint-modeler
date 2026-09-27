import type { Metadata } from "next";
import { Editor } from "@/editor/Editor";

export const metadata: Metadata = {
  title: "Editor",
  description: "Model application architecture the CSDM way, in your browser.",
  alternates: { canonical: "/editor" },
};

export default function EditorPage() {
  return <Editor />;
}

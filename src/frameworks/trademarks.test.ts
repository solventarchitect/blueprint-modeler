import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lenses } from "./index";

/**
 * The Open Group's trademark guidance (2026-11-16): ArchiMate® and TOGAF® are adjectives, never standalone
 * nouns, and carry ® on labels. This scans what users read (the app's source text, comments stripped, and the
 * README) for a mark not followed by a noun it describes.
 */
const ROOT = join(__dirname, "..", "..");

/** Words the ArchiMate® mark may describe. */
const ARCHIMATE_NOUNS = new Set(
  "type types element elements relationship relationships notation layer layers model models tool tools terms name names reading exchange Exchange specification Specification Model modeling language mapping view View file interface outcomes lens source fill export icon Application Technology Business".split(" "),
);
/** Words the TOGAF® mark may describe. */
const TOGAF_NOUNS = new Set("Standard conformance".split(" "));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Comments are for developers; strings and JSX text are what users read. */
function withoutComments(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** Each use of a mark that isn't followed (after ® and a version) by one of its nouns. */
function misuses(text: string, mark: string, nouns: Set<string>) {
  const found: string[] = [];
  const re = new RegExp(`${mark}(?![A-Za-z])(®)?((?: 3\\.2| 4)?)(?:\\s+|-)?([A-Za-z']*)`, "g");
  for (const m of text.matchAll(re)) {
    const next = m[3] ?? "";
    // The trademark notice itself: "ArchiMate® is a registered trademark…", "ArchiMate® and TOGAF® are registered trademarks…".
    const rest = text.slice((m.index ?? 0) + m[0].length);
    if (["is", "and", "are"].includes(next) && /^[^.]*registered trademark/.test(rest)) continue;
    // An element type filled in at run time: `ArchiMate® ${type}` in an image, `ArchiMate® {type}` in JSX.
    if (next === "" && /^\$?\{/.test(text.slice((m.index ?? 0) + m[0].length))) continue;
    if (!nouns.has(next)) found.push(text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + m[0].length + 20).replace(/\s+/g, " "));
  }
  return found;
}

const texts = [
  ...sourceFiles(join(ROOT, "src")).map((path) => ({ path, text: withoutComments(readFileSync(path, "utf8")) })),
  { path: "README.md", text: readFileSync(join(ROOT, "README.md"), "utf8") },
];

describe("The Open Group's marks (guidance of 2026-11-16)", () => {
  it("names the lenses with ® and a noun", () => {
    expect(lenses.map((l) => l.label)).toEqual(["CSDM", "CSDM with ArchiMate® 3.2 notation", "ArchiMate® 3.2 modeling language view"]);
  });

  it("uses ArchiMate® only as an adjective, in the app and the README", () => {
    expect(texts.flatMap(({ path, text }) => misuses(text, "ArchiMate", ARCHIMATE_NOUNS).map((m) => `${path}: ${m}`))).toEqual([]);
  });

  it("uses TOGAF® only as an adjective, with Standard capitalized", () => {
    expect(texts.flatMap(({ path, text }) => misuses(text, "TOGAF", TOGAF_NOUNS).map((m) => `${path}: ${m}`))).toEqual([]);
  });

  it("tells commercial users of the Open Group material that they need their own license", () => {
    const readme = texts.at(-1)!.text;
    expect(readme).toContain("for commercial purposes requires a separate license from The Open Group");
  });
});

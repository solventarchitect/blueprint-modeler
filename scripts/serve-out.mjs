// Serves the static export in out/ for e2e (next start does not serve `output: "export"`).
// Dependency-free; localhost only. Maps /path -> out/path.html, /path/ -> index.html.
// M75: applies vercel.json's headers too (sources written as plain regular expressions), so e2e sees what Vercel sends.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "out");
const vercel = JSON.parse(await readFile(join(process.cwd(), "vercel.json"), "utf8").catch(() => "{}"));
const headerRules = (vercel.headers ?? []).map((r) => ({ test: new RegExp(`^${r.source}$`), headers: r.headers }));
const headersFor = (path) => Object.fromEntries(headerRules.filter((r) => r.test.test(path)).flatMap((r) => r.headers.map((h) => [h.key, h.value])));
const port = Number(process.env.PORT ?? 3000);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain",
};

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^([/\\])+/, "");
  if (clean.startsWith("..")) return null;
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(root, candidate);
    try { if ((await stat(file)).isFile()) return file; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = (await resolve(req.url ?? "/")) ?? join(root, "404.html");
  const status = file.endsWith("404.html") && !(req.url ?? "").includes("404") ? 404 : 200;
  try {
    const body = await readFile(file);
    res.writeHead(status, { "content-type": types[extname(file)] ?? "application/octet-stream", ...headersFor((req.url ?? "/").split("?")[0]) });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`serving out/ on http://127.0.0.1:${port}`));

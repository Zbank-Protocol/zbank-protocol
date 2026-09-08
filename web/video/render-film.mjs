import { createServer } from "node:http";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "output");
const rawDir = join(outputDir, "raw");
const filmFile = process.env.ZBANK_FILM_HTML ?? "zbank-film-v2.html";
const keyArt =
  process.env.ZBANK_KEY_ART ??
  "/Users/jamison/.cursor/projects/Users-jamison-work-me/assets/zbank-film-key-art.png";

await rm(rawDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });
const html = await readFile(join(here, filmFile));
const art = await readFile(keyArt);
const fontRoot = join(here, "..", "node_modules", "@fontsource-variable");

async function loadFont(packageName, preferredPart) {
  const dir = join(fontRoot, packageName, "files");
  const names = await readdir(dir);
  const name =
    names.find((candidate) => candidate.includes(preferredPart) && candidate.endsWith(".woff2")) ??
    names.find(
      (candidate) =>
        candidate.includes("latin") &&
        candidate.includes("normal") &&
        !candidate.includes("ext") &&
        candidate.endsWith(".woff2"),
    );
  if (!name) throw new Error(`No Latin font file found for ${packageName}`);
  return readFile(join(dir, name));
}

const [archivo, fraunces, mono] = await Promise.all([
  loadFont("archivo", "latin-wdth-normal"),
  loadFont("fraunces", "latin-wght-normal"),
  loadFont("jetbrains-mono", "latin-wght-normal"),
]);

const server = createServer((req, res) => {
  const fonts = {
    "/archivo.woff2": archivo,
    "/fraunces.woff2": fraunces,
    "/mono.woff2": mono,
  };
  if (req.url in fonts) {
    res.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "no-store" });
    return res.end(fonts[req.url]);
  }
  if (req.url === "/key-art.png") {
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    return res.end(art);
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
});
await new Promise((resolve) => server.listen(4188, "127.0.0.1", resolve));

const browser = await chromium.launch({
  args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto("http://127.0.0.1:4188", { waitUntil: "networkidle" });
await page.waitForTimeout(45_100);
const video = page.video();
await page.close();
const webmPath = join(outputDir, "zbank-explainer-v2-silent.webm");
await video.saveAs(webmPath);
await context.close();
await browser.close();
server.close();

if (errors.length) throw new Error(`Film browser errors:\n${errors.join("\n")}`);
console.log(webmPath);

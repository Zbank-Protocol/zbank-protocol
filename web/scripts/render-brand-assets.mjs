/**
 * Rasterises the brand artwork in scripts/og.html.
 *
 * Captured by element bounds at deviceScaleFactor 1, so the output dimensions are exactly the CSS
 * dimensions — social scrapers reject a card that is not the size the meta tags claim, and X
 * rejects an avatar or banner that is off-size.
 *
 * Two destinations, and the split is meaningful: `public/` is served by the site and referenced
 * from meta tags, `brand/` is uploaded by hand to a platform and is deliberately not shipped.
 *
 * Must run against the *dev* server, not preview. The artwork imports fonts as bare specifiers,
 * which only resolve through Vite's transform.
 *
 * Usage: start the dev server, then `SITE_URL=http://localhost:5173/ node scripts/render-brand-assets.mjs`
 */
import { chromium } from "playwright";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:5173/";
/** The built site, for photographing the field. Preview rather than dev, so it cannot be stale. */
const PREVIEW_URL = process.env.PREVIEW_URL ?? "http://localhost:4173/";

/**
 * Which act each banner photographs the field at.
 *
 * 1 is the diverted stream: a long cool ribbon, and the state whose shape suits a 3:1 crop best.
 * 2 is the conversion core, which is where the gold and the heat are — the state to reach for when
 * the artwork needs to look alive rather than sombre.
 */
const FIELD_ACTS = { stream: 1, core: 2 };

/**
 * Screenshots the live WebGL field at a given act, with the interface hidden.
 *
 * Captured at 1500x940 and cropped to the banner's 3:1 by the artwork, rather than captured at 3:1
 * directly. The framing is a real perspective projection, so a 500px-tall viewport widens the
 * camera's field of view and the mass shrinks into the middle of the frame — photographing it at
 * roughly the proportions it was composed for and then cropping keeps it at the size it was tuned
 * to be.
 *
 * Returned as a data URL, so no temporary file lands in `public/` and ships with the site.
 */
async function captureFieldPlate(browser, act) {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 940 },
    deviceScaleFactor: 1,
  });

  await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2600); // boot overlay clears, field eases in

  await page.evaluate((index) => {
    const el = document.querySelectorAll("[data-sec]")[index];
    if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY));
  }, act);
  // Lenis animates programmatic scrolls, and the morph is spring-damped on top of that.
  await page.waitForTimeout(3200);

  /*
   * Hide everything that is not the canvas.
   *
   * An element screenshot clips the page to the element's box but still paints whatever sits above
   * it, so the scrim, headline and rails would all come through. The `contains` guard matters
   * because `visibility` inherits: hiding an ancestor of the canvas would hide the canvas too.
   */
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("no canvas: the field failed to start");
    for (const el of document.querySelectorAll("body *")) {
      if (el !== canvas && !el.contains(canvas)) el.style.visibility = "hidden";
    }
  });

  const buffer = await page.locator("canvas").screenshot();
  await page.close();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

const TARGETS = [
  { selector: "#og", path: "public/og.png" },
  { selector: "#icon", path: "public/icon-180.png" },
  { selector: "#banner", path: "brand/twitter-banner.png" },
  { selector: "#banner-warm", path: "brand/twitter-banner-warm.png" },
  { selector: "#banner-min", path: "brand/twitter-banner-minimal.png" },
  { selector: "#pfp-dark", path: "brand/twitter-pfp-dark.png" },
  { selector: "#pfp-gold", path: "brand/twitter-pfp-gold.png" },
  // Not for upload. These show the circle X crops the square to.
  { selector: "#pfp-dark-circle", path: "brand/preview-pfp-dark-circle.png" },
  { selector: "#pfp-gold-circle", path: "brand/preview-pfp-gold-circle.png" },
];

const browser = await chromium.launch({
  // Headless Chromium has no GPU, so the field's WebGL context has to fall through to SwiftShader.
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

const streamPlate = await captureFieldPlate(browser, FIELD_ACTS.stream);
const corePlate = await captureFieldPlate(browser, FIELD_ACTS.core);

const page = await browser.newPage({ deviceScaleFactor: 1 });

const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(new URL("scripts/og.html", SITE_URL).href, { waitUntil: "networkidle" });

// Capturing before the webfonts resolve bakes the fallback face into the PNG.
await page.waitForSelector("html[data-fonts-ready='true']", { timeout: 15_000 });

// Awaited, because an <img> whose src was set a moment ago has not necessarily decoded, and
// screenshotting before it does yields a banner with an empty half.
await page.evaluate(async (plates) => {
  for (const [id, src] of Object.entries(plates)) {
    const img = document.getElementById(id);
    if (!(img instanceof HTMLImageElement)) throw new Error(`missing field img: ${id}`);
    img.src = src;
    await img.decode();
  }
}, { "banner-field": streamPlate, "banner-gold-field": corePlate });

for (const { selector, path } of TARGETS) {
  const box = await page.locator(selector).boundingBox();
  await page.locator(selector).screenshot({ path });
  console.log(`${path}  ${box?.width}x${box?.height}`);
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();

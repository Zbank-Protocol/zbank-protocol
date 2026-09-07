import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

/*
 * Captures every numbered section of the built site.
 *
 * Points at the preview server (`vite preview`, port 4173), never the dev server: preview
 * serves the built `dist`, so a capture is always of the code that would actually ship.
 * Build first, then capture.
 */
const URL = process.env.SITE_URL ?? "http://localhost:4173/";

await mkdir("shots", { recursive: true });

// SwiftShader: headless Chromium has no GPU, and without software GL the particle field never
// initialises and every shot would miss the site's signature layer.
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "networkidle" });
// Fonts, first rise, the field's lazy chunk, its entrance fade, and the progress spring.
await page.waitForSelector('.field[data-ready="true"]', { timeout: 15000 }).catch(() => {
  console.warn("field never became ready — capturing without it");
});
await page.waitForTimeout(2200);

const sections = await page.locator("[data-sec]").count();

for (let i = 0; i < sections; i++) {
  await page.evaluate((index) => {
    const el = document.querySelectorAll("[data-sec]")[index];
    // Below the fixed masthead, exactly as an anchor lands.
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64), behavior: "instant" });
  }, i);
  await page.waitForTimeout(1600); // rise transitions + the field's progress spring settle

  const name = await page.evaluate(
    (index) => document.querySelectorAll("[data-sec]")[index].dataset.sec,
    i,
  );
  await page.screenshot({ path: `shots/sec-${name}.png` });
}

// Narrow pass: collapsed grids and overflow mistakes show up here.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(URL, { waitUntil: "networkidle" });
await phone.waitForSelector('.field[data-ready="true"]', { timeout: 15000 }).catch(() => {});
await phone.waitForTimeout(2000);

for (const index of [0, 1, 3, 4, 9, 10]) {
  await phone.evaluate((i) => {
    const el = document.querySelectorAll("[data-sec]")[i];
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64), behavior: "instant" });
  }, index);
  await phone.waitForTimeout(1400);
  const name = await phone.evaluate(
    (i) => document.querySelectorAll("[data-sec]")[i].dataset.sec,
    index,
  );
  await phone.screenshot({ path: `shots/m-sec-${name}.png` });
}

const overflow = await phone.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
console.log("phone horizontal overflow (px):", overflow);
await phone.close();

console.log("sections:", sections);
console.log("console errors:", errors.length ? errors : "none");

await browser.close();

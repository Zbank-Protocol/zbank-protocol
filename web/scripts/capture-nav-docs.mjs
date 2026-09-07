/** Capture the new masthead (dropdown open), the docs page, and mobile drawer states. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
mkdirSync("shots/navdocs", { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

// Desktop: docs page full, then dropdown open over the homepage.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.screenshot({ path: "shots/navdocs/docs-top.png" });
await page.evaluate(() => document.getElementById("zcredit")?.scrollIntoView());
await page.waitForTimeout(600);
await page.screenshot({ path: "shots/navdocs/docs-zcredit.png" });

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.hover(".masthead__item:nth-child(2) .masthead__link"); // Invest (after pill span)
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/navdocs/nav-invest-open.png" });
await page.hover("text=Credit");
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/navdocs/nav-credit-open.png" });
await page.close();

// Phone: drawer open + docs.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(`${BASE}/`, { waitUntil: "networkidle" });
await phone.waitForTimeout(1500);
await phone.click(".masthead__burger");
await phone.waitForTimeout(500);
await phone.screenshot({ path: "shots/navdocs/phone-drawer.png" });
await phone.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
await phone.waitForTimeout(700);
await phone.screenshot({ path: "shots/navdocs/phone-docs.png" });
const overflow = await phone.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
if (overflow > 0) console.log(`OVERFLOW phone docs: ${overflow}px`);
await phone.close();

await browser.close();
console.log("done");

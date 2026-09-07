/**
 * Screenshot every application route at desktop width (plus a phone pass on the key
 * product pages) against a local preview server. Usage: node scripts/capture-routes.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = "shots/routes";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "/"],
  ["app", "/app"],
  ["invest", "/invest"],
  ["indexes", "/invest/indexes"],
  ["credit", "/credit"],
  ["loop", "/credit/loop"],
  ["earn", "/earn"],
  ["treasury", "/treasury"],
  ["token", "/token"],
  ["docs", "/docs"],
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

for (const [w, h, tag, routes] of [
  [1440, 900, "desktop", ROUTES],
  [390, 844, "phone", ROUTES.filter(([n]) => ["home", "app", "invest", "credit", "loop", "treasury"].includes(n))],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [name, route] of routes) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(name === "home" ? 2200 : 900);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: route !== "/" });
    // Overflow probe while we're here.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) console.log(`OVERFLOW ${tag} ${name}: ${overflow}px`);
  }
  await page.close();
}

await browser.close();
console.log("done");

import { chromium } from "playwright";

const URL = "http://localhost:4317/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1800); // let boot overlay clear

const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
const stops = [
  ["01-transparent", 0],
  ["02-diverting", 0.18],
  ["03-mechanism", 0.36],
  ["04-reserve", 0.56],
  ["05-shielded", 0.72],
  ["06-claim", 0.86],
];

for (const [name, frac] of stops) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * frac));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${name}.png` });
}

// Verify the descent variables are actually being driven.
const vars = await page.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  return {
    exposure: s.getPropertyValue("--exposure").trim(),
    shielding: s.getPropertyValue("--shielding").trim(),
    reserveFill: s.getPropertyValue("--reserve-fill").trim(),
  };
});

console.log("scrollable height:", total);
console.log("CSS vars at bottom:", JSON.stringify(vars));
console.log("console errors:", errors.length ? errors : "none");

await browser.close();

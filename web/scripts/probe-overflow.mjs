import { chromium } from "playwright";

/** Lists every element wider than the phone viewport, so overflow bugs name themselves. */
const URL = process.env.SITE_URL ?? "http://localhost:4173/";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const wide = await page.evaluate(() => {
  const out = [];
  const max = window.innerWidth;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width > max + 1 || r.right > max + 1) {
      out.push(
        `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} w=${Math.round(r.width)} right=${Math.round(r.right)}`,
      );
    }
  }
  return out.slice(0, 30);
});
console.log(wide.join("\n") || "no overflow");
await browser.close();

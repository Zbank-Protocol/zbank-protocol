/**
 * Reads computed styles off the running page.
 *
 * Screenshots answer "does it look right"; they do not answer "did this rule apply at all". When a
 * change appears to have no effect, this distinguishes a rule that lost a specificity fight from a
 * rule that is applying and simply is not visible.
 *
 * Usage: node scripts/probe-styles.mjs [selector]
 */
import { chromium } from "playwright";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:5173/";
const SELECTOR = process.argv[2] ?? ".steps";

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(SITE_URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const report = await page.evaluate((selector) => {
  const el = document.querySelector(selector);
  if (!el) return { found: false, selector };

  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    found: true,
    selector,
    tag: el.tagName.toLowerCase(),
    classes: el.className,
    backgroundColor: cs.backgroundColor,
    borderTop: `${cs.borderTopWidth} ${cs.borderTopColor}`,
    paddingLeft: cs.paddingLeft,
    backdropFilter: cs.backdropFilter,
    opacity: cs.opacity,
    zIndex: cs.zIndex,
    box: { width: Math.round(rect.width), right: Math.round(rect.right) },
    viewportWidth: window.innerWidth,
  };
}, SELECTOR);

console.log(JSON.stringify(report, null, 2));
await browser.close();

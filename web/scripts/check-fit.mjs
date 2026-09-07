/**
 * Reports whether each act's content fits one screen, at the viewport sizes a demo actually runs on.
 *
 * Sections are `min-height: 100svh`, which guarantees they are at least a screen tall but says
 * nothing about whether their content fits inside one. When it does not, the section simply grows
 * and the fold lands in the middle of a panel or a paragraph — fine for a visitor who scrolls,
 * bad on a projector where the first impression is a sliced-off element.
 *
 * Usage: SITE_URL=http://localhost:4173/ node scripts/check-fit.mjs
 */
import { chromium } from "playwright";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:4173/";

/** 900 is the classic 1440 laptop; 864 is the default logical height of a 14" MacBook Pro. */
const VIEWPORTS = [
  { width: 1440, height: 900, label: "1440x900" },
  { width: 1512, height: 864, label: "1512x864" },
];

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({ viewport });
  await page.goto(SITE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const rows = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll("[data-sec]"));
    return sections.map((section) => ({
      sec: section.dataset.sec,
      /*
       * The section's own box, not the furthest child edge.
       *
       * Summing child rects looks more precise and is actually wrong here: the entrance animation
       * holds every child of an un-entered section under a translateY, and getBoundingClientRect
       * reports post-transform geometry. Any act below the fold therefore measured its own reveal
       * offset as overflow, which invented ~28px on every section and reported the terms act as
       * broken when it fits exactly.
       *
       * Because `min-height: 100svh` floors the height at one screen, height > viewport is
       * precisely the condition we care about, and transforms cannot perturb it.
       */
      height: Math.round(section.getBoundingClientRect().height),
    }));
  });

  console.log(`\n=== ${viewport.label} ===`);
  for (const row of rows) {
    const over = row.height - viewport.height;
    const verdict = over > 0 ? `OVERFLOWS by ${over}px` : "fits";
    console.log(`  act ${row.sec}: ${row.height}px  ${verdict}`);
  }

  await page.close();
}

await browser.close();

/**
 * Renders alternative hero *compositions* and screenshots each.
 *
 * Not typefaces. The complaint is that the arrangement reads as generated — one giant headline
 * pinned to the left edge, an orphaned paragraph beneath it, and four unrelated fragments in the
 * four corners — and that is a layout problem, so these vary placement, margin and hierarchy while
 * leaving the type alone.
 *
 * Overrides are injected at runtime. Nothing here touches the shipped stylesheet.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:4173/";

await mkdir("shots/hero", { recursive: true });

/** Clears the fixed corner furniture, which is global UI that only clutters the opening frame. */
const noFurniture = `
  .telemetry, .hud__gauge { opacity: 0 !important; }
`;

const VARIANTS = {
  "comp-0-current": "",

  /*
   * A · Title card. Centred, symmetrical, and stripped to one statement.
   * The opposite bet to the current layout: no corner furniture, no act rule, maximum air.
   */
  "comp-a-titlecard": `${noFurniture}
    .sec--hero { align-content: center !important; padding-bottom: 0 !important; }
    .sec--hero .sec__open { display: none !important; }
    .sec--hero .cue { left: 50% !important; transform: translateX(-50%); }
    .sec--hero .sec__h {
      grid-column: 2 / span 10 !important;
      text-align: center;
      margin-bottom: 2.5rem !important;
      font-size: clamp(2.5rem, 0.5rem + 6.2vw, 6.5rem) !important;
    }
    .sec--hero .hero__lede {
      grid-column: 4 / span 6 !important;
      text-align: center;
    }
    .sec--hero .hero__lede p { margin-inline: auto; max-width: 46ch; }
  `,

  /*
   * B · Editorial staircase. Real margins, second line indented, paragraph moved into the
   * right half so the frame reads as a composition across its whole width rather than a
   * left-hand column with dead space beside it.
   */
  "comp-b-staircase": `${noFurniture}
    .sec--hero .sec__h {
      grid-column: 2 / span 9 !important;
      margin-bottom: 0 !important;
      font-size: clamp(2.5rem, 0.5rem + 6.6vw, 7rem) !important;
    }
    .sec--hero .t-hero .reveal__line:nth-child(2) .reveal__inner {
      display: inline-block;
      margin-left: 14%;
    }
    .sec--hero .hero__lede {
      grid-column: 8 / span 4 !important;
      align-self: start;
      grid-row: 2;
      padding-top: 0.9rem;
    }
    .sec--hero .hero__lede p { font-size: 1rem; }
  `,

  /*
   * C · Full-measure band. The headline is set to fill the width and pinned low, so it reads as a
   * masthead the field sits on top of rather than as a paragraph that happens to be large.
   */
  "comp-c-band": `${noFurniture}
    .sec--hero { align-content: end !important; padding-bottom: var(--v4) !important; }
    .sec--hero .sec__open { display: none !important; }
    .sec--hero .sec__h {
      grid-column: 1 / span 12 !important;
      margin-bottom: 1.5rem !important;
      font-size: clamp(2.5rem, 0.5rem + 8.4vw, 9rem) !important;
      line-height: 0.9 !important;
    }
    .sec--hero .hero__lede {
      grid-column: 1 / span 12 !important;
      border-top: 1px solid var(--line);
      padding-top: 1.1rem;
    }
    .sec--hero .hero__lede p {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      max-width: none;
      color: var(--ink-3);
    }
  `,

  /*
   * D · Offset counterweight. Headline low-left at moderate scale against a small block of
   * metadata high-right, so the diagonal is the composition and the field fills the middle.
   */
  "comp-d-offset": `${noFurniture}
    .sec--hero { align-content: end !important; }
    .sec--hero .sec__open { grid-column: 1 / span 4 !important; }
    .sec--hero .sec__h {
      grid-column: 2 / span 7 !important;
      margin-bottom: var(--v3) !important;
      font-size: clamp(2.25rem, 0.5rem + 5.4vw, 5.75rem) !important;
    }
    .sec--hero .hero__lede {
      grid-column: 2 / span 5 !important;
    }
    .sec--hero .hero__lede p { font-size: 1rem; }
  `,
};

const browser = await chromium.launch({
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

for (const [name, css] of Object.entries(VARIANTS)) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 864 } });
  await page.goto(SITE_URL, { waitUntil: "networkidle" });
  if (css) await page.addStyleTag({ content: css });
  await page.mouse.move(1050, 400);
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `shots/hero/${name}.png` });
  console.log(`hero/${name}.png`);
  await page.close();
}

await browser.close();

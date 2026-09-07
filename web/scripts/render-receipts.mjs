#!/usr/bin/env node
/**
 * Renders the "onchain receipts" tweet graphic — real addresses, real tx hashes,
 * pixel-perfect. Image models mangle hex; a browser does not.
 *
 *   node scripts/render-receipts.mjs
 *
 * Output: brand/zbank-onchain-receipts.png (1600×900 @2x)
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../brand/zbank-onchain-receipts.png");

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1600px; height: 900px; }
  body {
    background: radial-gradient(1200px 700px at 50% 38%, #17140d 0%, #0b0b0d 62%);
    color: #e9e4d8;
    font-family: "Helvetica Neue", Arial, sans-serif;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .grain { position: absolute; inset: 0; opacity: 0.5; }
  .grain i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #f5b301; }
  .card { position: relative; width: 1180px; z-index: 2; }
  .kicker {
    font-size: 21px; letter-spacing: 0.42em; color: #f5b301; text-transform: uppercase;
    display: flex; align-items: center; gap: 18px; margin-bottom: 26px;
  }
  .kicker::before { content: ""; width: 46px; height: 1px; background: #f5b301; }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: #35d07f;
    box-shadow: 0 0 14px #35d07f; display: inline-block; }
  h1 {
    font-family: "Didot", "Bodoni 72", "Playfair Display", serif;
    font-weight: 500; font-size: 78px; line-height: 1.02; color: #f4efe4;
    letter-spacing: 0.005em; margin-bottom: 44px; white-space: nowrap;
  }
  h1 em { font-style: italic; color: #f5b301; }
  .ledger {
    border: 1px solid rgba(245, 179, 1, 0.28); border-radius: 14px;
    background: rgba(12, 11, 9, 0.72);
    box-shadow: 0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,179,1,0.12);
    padding: 8px 0; margin-bottom: 30px;
  }
  .row {
    display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: baseline;
    padding: 26px 42px;
  }
  .row + .row { border-top: 1px solid rgba(245, 179, 1, 0.12); }
  .label { font-size: 19px; letter-spacing: 0.28em; text-transform: uppercase; color: #8f8878; }
  .label b { display: block; color: #e9e4d8; font-weight: 600; margin-bottom: 7px; font-size: 21px; }
  .mono {
    font-family: "SF Mono", Menlo, monospace; font-size: 25px; color: #f5b301;
    line-height: 1.5; white-space: nowrap;
  }
  .mono .tx { display: block; color: #9a917c; font-size: 15.5px; margin-top: 6px; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; }
  .verify { font-size: 20px; letter-spacing: 0.3em; text-transform: uppercase; color: #8f8878; }
  .verify b { color: #f4efe4; }
  .site { font-size: 20px; letter-spacing: 0.42em; text-transform: uppercase; color: #f5b301; }
</style></head>
<body>
  <div class="grain" id="g"></div>
  <div class="card">
    <div class="kicker"><span class="dot"></span> Robinhood Chain Mainnet · Chain ID 4663 · Sep 7, 2026</div>
    <h1>Onchain. <em>Verifiable.</em> Not a larp.</h1>
    <div class="ledger">
      <div class="row">
        <div class="label"><b>ZCREDIT MARKET</b>lending · zZEC collateral · USDG</div>
        <div class="mono">0x77ccb77d1fd337b7027b3482ca365db57d92151e
          <span class="tx">deploy tx 0xf6aa13248cba9defd4efb4c8ce0d260ebf22aeded99a55dc0d72f1836c8163c6</span>
        </div>
      </div>
      <div class="row">
        <div class="label"><b>ZEC / USD ORACLE</b>chainlink data streams feed</div>
        <div class="mono">0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5
          <span class="tx">deploy tx 0x5d9e405d196c4852129028e322134d0b741d97c791efe9d59fc9e09286a29ecf</span>
        </div>
      </div>
    </div>
    <div class="foot">
      <div class="verify">Verify it yourself → <b>robinhoodchain.blockscout.com</b></div>
      <div class="site">ZBANK.WORLD</div>
    </div>
  </div>
  <script>
    const g = document.getElementById("g");
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 240; i++) {
      const d = document.createElement("i");
      const cx = 0.5 + (rnd() - 0.5) * (0.55 + rnd());
      const cy = 0.42 + (rnd() - 0.5) * (0.6 + rnd());
      d.style.left = (cx * 1600).toFixed(1) + "px";
      d.style.top = (cy * 900).toFixed(1) + "px";
      const s = 1 + rnd() * 2.2;
      d.style.width = d.style.height = s.toFixed(1) + "px";
      d.style.opacity = (0.06 + rnd() * 0.5).toFixed(2);
      d.style.filter = "blur(" + (rnd() * 1.4).toFixed(1) + "px)";
      g.appendChild(d);
    }
  </script>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT });
await browser.close();
console.log("wrote", OUT);

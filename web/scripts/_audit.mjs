import { chromium } from "playwright";

const b = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1512, height: 864 } });
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);

const tops = await p.evaluate(() =>
  [...document.querySelectorAll("[data-sec]")].map((s) => s.getBoundingClientRect().top + scrollY),
);

console.log("      0%        25%       50%       75%      100%");
for (let i = 0; i < tops.length; i++) {
  await p.evaluate((y) => scrollTo(0, y), tops[i]);
  await p.waitForTimeout(1500);
  const row = await p.evaluate((idx) => {
    const sec = document.querySelectorAll("[data-sec]")[idx];
    const blocks = [...sec.children].filter(
      (c) => !c.classList.contains("sec__open") && !c.classList.contains("cue"),
    );
    let l = 100;
    let r = 0;
    for (const c of blocks) {
      const bb = c.getBoundingClientRect();
      l = Math.min(l, (bb.left / innerWidth) * 100);
      r = Math.max(r, (bb.right / innerWidth) * 100);
    }
    return {
      l: Math.round(l),
      r: Math.round(r),
      mass: Number(
        getComputedStyle(document.documentElement).getPropertyValue("--mass-x").trim() || 0.5,
      ),
      shield: getComputedStyle(document.documentElement).getPropertyValue("--shielding").trim(),
    };
  }, i);

  const cell = (v) => Math.round(v / 2.2);
  const line = Array(46).fill(" ");
  for (let x = cell(row.l); x <= cell(row.r) && x < 46; x++) line[x] = "T";
  const m = Math.min(45, Math.max(0, Math.round((row.mass * 100) / 2.2)));
  line[m] = line[m] === "T" ? "X" : "o";
  console.log(`act ${i} |${line.join("")}|  type ${row.l}-${row.r}%  mass ${row.mass.toFixed(2)}  shield ${row.shield}`);
}
console.log("\nT = type   o = field mass   X = mass sitting under type (bad)");

await b.close();

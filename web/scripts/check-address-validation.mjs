import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:4317/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Same vectors the Solidity test suite uses (script/gen-taddr.js).
const cases = [
  ["t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56U", "valid",   "P2PKH accepted"],
  ["t3RGLfnZuS1KC8NXizVcdWf5JRkonfbwKdd", "valid",   "P2SH accepted"],
  ["t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs", "valid",   "all-zero payload accepted"],
  ["t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56V", "invalid", "single-char typo rejected"],
  ["t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX65U", "invalid", "transposition rejected"],
  ["tW7rHp81WDV6iZn42EqG6KRi6Kh4Uq5jCu7", "invalid", "bad version prefix rejected"],
  ["tmPqq3aWjZhqMwnSnpioaFM7xJaXZFpAA1Z", "invalid", "testnet address rejected"],
  ["t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56l", "invalid", "non-Base58 char rejected"],
  ["t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56",  "invalid", "short address rejected"],
];

const input = page.locator(".register__input");
const hint = page.locator("#payout-hint");
let failures = 0;

for (const [addr, expected, label] of cases) {
  await input.fill(addr);
  await page.waitForTimeout(160);
  const actual = await hint.getAttribute("data-state");
  const message = (await hint.textContent())?.trim();
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label.padEnd(34)} state=${actual}  "${message}"`);
}

// The button must be disabled for anything invalid.
await input.fill("t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56V");
await page.waitForTimeout(160);
const disabled = await page.locator(".btn--primary").isDisabled();
console.log(`${disabled ? "PASS" : "FAIL"}  submit blocked on invalid address`);
if (!disabled) failures++;

console.log(failures === 0 ? "\nAll validator cases agree with the contract." : `\n${failures} FAILURES`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

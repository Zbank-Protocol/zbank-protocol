#!/usr/bin/env node
/**
 * Verify the STOCK_TOKENS universe in src/config/protocol.ts against the chain:
 * checksum validity, onchain symbol match, 18 decimals, and a live QuoterV2 quote for
 * $100 through each token's configured fee tier. Run before every deploy that touches it.
 */
import { createPublicClient, http, getAddress } from "viem";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/config/protocol.ts", import.meta.url), "utf8");
const block = src.slice(src.indexOf("export const STOCK_TOKENS"), src.indexOf("/* ------------------------------- Oracles"));
const entries = [...block.matchAll(/(\w+): \{ symbol: "(\w+)",[^}]*address: "(0x[a-fA-F0-9]{40})",[^}]*fee: (\d+)/g)].map(
  (m) => ({ key: m[1], symbol: m[2], address: m[3], fee: Number(m[4]) }),
);
if (entries.length === 0) throw new Error("no STOCK_TOKENS parsed");

const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const QUOTER = "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const ERC20 = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "view",
    inputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
];

let failures = 0;
for (const e of entries) {
  const issues = [];
  try {
    if (getAddress(e.address) !== e.address) issues.push(`checksum: should be ${getAddress(e.address)}`);
  } catch {
    issues.push("invalid checksum");
  }
  try {
    const [sym, dec] = await Promise.all([
      client.readContract({ address: e.address, abi: ERC20, functionName: "symbol" }),
      client.readContract({ address: e.address, abi: ERC20, functionName: "decimals" }),
    ]);
    if (sym !== e.symbol) issues.push(`onchain symbol ${sym} != ${e.symbol}`);
    if (dec !== 18) issues.push(`decimals ${dec} != 18`);
    const [out] = await client.readContract({
      address: QUOTER,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDG, tokenOut: e.address, amountIn: 100_000_000n, fee: e.fee, sqrtPriceLimitX96: 0n }],
    });
    const outHuman = Number(out) / 1e18;
    const impliedPrice = 100 / outHuman;
    console.log(`${e.symbol.padEnd(6)} OK  $100 -> ${outHuman.toFixed(6)} (implied $${impliedPrice.toFixed(2)}) fee=${e.fee}${issues.length ? "  ISSUES: " + issues.join("; ") : ""}`);
  } catch (err) {
    issues.push(`read/quote failed: ${err.shortMessage ?? err.message}`);
    console.log(`${e.symbol.padEnd(6)} FAIL ${issues.join("; ")}`);
  }
  if (issues.length) failures++;
}
console.log(failures === 0 ? "\nUniverse verified clean." : `\n${failures} token(s) need fixing.`);
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * Enumerate every Uniswap v3 pool on Robinhood Chain from factory PoolCreated events,
 * keep the USDG pairs, and print each counter-asset with its deepest pool and real depth.
 * This is how the ZINVEST investable universe is derived — from onchain liquidity, not a list.
 */
import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168".toLowerCase();

const client = createPublicClient({ transport: http(RPC) });
const POOL_CREATED = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
);
const ERC20 = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];

const latest = await client.getBlockNumber();
console.log("latest block:", latest);

const CHUNK = 5_000_000n;
let logs = [];
for (let from = 0n; from <= latest; from += CHUNK) {
  const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
  const batch = await client.getLogs({ address: FACTORY, event: POOL_CREATED, fromBlock: from, toBlock: to });
  logs = logs.concat(batch);
  process.stderr.write(`scanned ${from}-${to}: ${batch.length} pools\n`);
}
console.log("total pools:", logs.length);

const usdgPools = logs.filter(
  (l) => l.args.token0.toLowerCase() === USDG || l.args.token1.toLowerCase() === USDG,
);
console.log("USDG pools:", usdgPools.length);

const bySymbol = {};
for (const l of usdgPools) {
  const other = l.args.token0.toLowerCase() === USDG ? l.args.token1 : l.args.token0;
  try {
    const [sym, dec, otherBal, usdgBal] = await Promise.all([
      client.readContract({ address: other, abi: ERC20, functionName: "symbol" }),
      client.readContract({ address: other, abi: ERC20, functionName: "decimals" }),
      client.readContract({ address: other, abi: ERC20, functionName: "balanceOf", args: [l.args.pool] }),
      client.readContract({ address: USDG, abi: ERC20, functionName: "balanceOf", args: [l.args.pool] }),
    ]);
    const usdg = Number(formatUnits(usdgBal, 6));
    const rec = { sym, token: other, pool: l.args.pool, fee: l.args.fee, usdgDepth: usdg, otherBal: Number(formatUnits(otherBal, dec)) };
    if (!bySymbol[sym] || bySymbol[sym].usdgDepth < usdg) bySymbol[sym] = rec;
  } catch {
    /* non-standard token — skip */
  }
}

const rows = Object.values(bySymbol).sort((a, b) => b.usdgDepth - a.usdgDepth);
for (const r of rows) {
  console.log(
    `${r.sym.padEnd(8)} ${r.token} pool=${r.pool} fee=${r.fee} USDG=$${Math.round(r.usdgDepth).toLocaleString()} other=${r.otherBal.toFixed(2)}`,
  );
}

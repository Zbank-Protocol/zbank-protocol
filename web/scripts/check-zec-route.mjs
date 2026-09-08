#!/usr/bin/env node
/**
 * Verify the direct ZINVEST route against Robinhood Chain:
 * zZEC/USDG pool existence and balances, a live multi-hop quote, and InvestRouter bytecode.
 *
 * Usage:
 *   node scripts/check-zec-route.mjs
 *   INVEST_ROUTER=0x... node scripts/check-zec-route.mjs --require-live
 */
import {
  createPublicClient,
  encodePacked,
  formatUnits,
  http,
  parseAbi,
} from "viem";

const RPC = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const ZZEC = "0x0b151Ff7a7c5250130EC16C275790961d558E402";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const SPY = "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C";
const FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
const QUOTER = "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7";
const ZZEC_USDG_FEE = Number(process.env.ZZEC_USDG_FEE ?? 3000);
const SPY_FEE = 3000;
const INVEST_ROUTER = process.env.INVEST_ROUTER;
const requireLive = process.argv.includes("--require-live");

const client = createPublicClient({ transport: http(RPC) });
const factoryAbi = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "view",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
];

const pool = await client.readContract({
  address: FACTORY,
  abi: factoryAbi,
  functionName: "getPool",
  args: [ZZEC, USDG, ZZEC_USDG_FEE],
});
const poolExists = pool !== "0x0000000000000000000000000000000000000000";
let zzecDepth = 0n;
let usdgDepth = 0n;
let quoteOut = null;
let quoteError = null;

if (poolExists) {
  [zzecDepth, usdgDepth] = await Promise.all([
    client.readContract({ address: ZZEC, abi: erc20Abi, functionName: "balanceOf", args: [pool] }),
    client.readContract({ address: USDG, abi: erc20Abi, functionName: "balanceOf", args: [pool] }),
  ]);
  try {
    const path = encodePacked(
      ["address", "uint24", "address", "uint24", "address"],
      [ZZEC, ZZEC_USDG_FEE, USDG, SPY_FEE, SPY],
    );
    const [amountOut] = await client.readContract({
      address: QUOTER,
      abi: quoterAbi,
      functionName: "quoteExactInput",
      args: [path, 1_000_000n], // 0.01 zZEC
    });
    quoteOut = formatUnits(amountOut, 18);
  } catch (error) {
    quoteError = error.shortMessage ?? error.message;
  }
}

let routerDeployed = false;
if (INVEST_ROUTER && /^0x[a-fA-F0-9]{40}$/.test(INVEST_ROUTER)) {
  routerDeployed = (await client.getCode({ address: INVEST_ROUTER })) !== undefined;
}

const result = {
  chainId: 4663,
  route: "zZEC -> USDG -> SPY",
  pool,
  poolFee: ZZEC_USDG_FEE,
  poolExists,
  poolFunded: zzecDepth > 0n && usdgDepth > 0n,
  depth: {
    zZEC: formatUnits(zzecDepth, 8),
    USDG: formatUnits(usdgDepth, 6),
  },
  testQuote: {
    input: "0.01 zZEC",
    outputSPY: quoteOut,
    error: quoteError,
  },
  investRouter: INVEST_ROUTER ?? null,
  routerDeployed,
  ready: poolExists && zzecDepth > 0n && usdgDepth > 0n && quoteOut != null && routerDeployed,
};

console.log(JSON.stringify(result, null, 2));
if (requireLive && !result.ready) process.exit(1);

import { createPublicClient, defineChain, formatUnits, http, parseAbi } from "viem";

const RPC = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const MARKET = "0x77ccb77d1fd337b7027b3482ca365db57d92151e";
const ORACLE = "0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5";
const chain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const client = createPublicClient({ chain, transport: http(RPC, { timeout: 8_000 }) });
const marketAbi = parseAbi([
  "function availableLiquidity() view returns (uint256)",
  "function totalBorrows() view returns (uint256)",
  "function totalReserves() view returns (uint256)",
  "function totalCollateral() view returns (uint256)",
  "function collateralCap() view returns (uint256)",
  "function utilizationBps() view returns (uint256)",
  "function borrowRatePerYear() view returns (uint256)",
  "function supplyRatePerYear() view returns (uint256)",
  "function paused() view returns (bool)",
]);
const oracleAbi = parseAbi([
  "function priceUsd() view returns (uint256)",
  "function lastObservedAt() view returns (uint32)",
  "function maxAge() view returns (uint32)",
]);
const readMarket = (functionName) =>
  client.readContract({ address: MARKET, abi: marketAbi, functionName });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const values = await Promise.all([
      readMarket("availableLiquidity"),
      readMarket("totalBorrows"),
      readMarket("totalReserves"),
      readMarket("totalCollateral"),
      readMarket("collateralCap"),
      readMarket("utilizationBps"),
      readMarket("borrowRatePerYear"),
      readMarket("supplyRatePerYear"),
      readMarket("paused"),
      client.readContract({ address: ORACLE, abi: oracleAbi, functionName: "lastObservedAt" }),
      client.readContract({ address: ORACLE, abi: oracleAbi, functionName: "maxAge" }),
      client
        .readContract({ address: ORACLE, abi: oracleAbi, functionName: "priceUsd" })
        .then((value) => ({ ok: true, value }))
        .catch(() => ({ ok: false, value: null })),
    ]);
    const [liquidity, borrows, reserves, collateral, cap, utilization, borrowRate, supplyRate, paused, observedAt, maxAge, oracle] =
      values;
    const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(observedAt));

    return res.status(200).json({
      schema: "zbank.market.v1",
      generatedAt: new Date().toISOString(),
      chainId: 4663,
      contracts: { market: MARKET, oracle: ORACLE },
      oracle: {
        status: oracle.ok && ageSeconds <= Number(maxAge) ? "live" : "stale",
        priceUsd: oracle.value == null ? null : formatUnits(oracle.value, 18),
        observedAt: Number(observedAt),
        ageSeconds,
        maxAgeSeconds: Number(maxAge),
      },
      market: {
        paused,
        availableLiquidityUsdg: formatUnits(liquidity, 6),
        totalBorrowsUsdg: formatUnits(borrows, 6),
        totalReservesUsdg: formatUnits(reserves, 6),
        totalCollateralZec: formatUnits(collateral, 8),
        collateralCapZec: formatUnits(cap, 8),
        utilizationBps: Number(utilization),
        borrowApy: formatUnits(borrowRate, 18),
        supplyApy: formatUnits(supplyRate, 18),
      },
      units: {
        utilizationBps: "basis_points",
        borrowApy: "decimal_fraction_per_year",
        supplyApy: "decimal_fraction_per_year",
      },
    });
  } catch (error) {
    return res.status(503).json({
      error: "upstream_unavailable",
      message: error instanceof Error ? error.message : "Robinhood Chain RPC request failed",
    });
  }
}

const manifest = {
  schema: "zbank.protocol.v1",
  version: "1.0.0",
  updatedAt: "2026-09-08",
  identity: {
    name: "ZBANK",
    description: "Capital markets for Zcash on Robinhood Chain.",
    website: "https://zbank.world",
    docs: "https://zbank.world/docs",
    network: {
      name: "Robinhood Chain",
      chainId: 4663,
      rpc: "https://rpc.mainnet.chain.robinhood.com",
      explorer: "https://robinhoodchain.blockscout.com",
    },
  },
  products: [
    { id: "zinvest", action: "invest_usdg", status: "Live", route: "/invest" },
    { id: "zindex", action: "select_strategy", status: "Live", route: "/invest/indexes" },
    { id: "zcredit", action: "borrow_or_supply", status: "Beta", route: "/credit" },
    { id: "zearn", action: "supply_usdg", status: "Beta", route: "/earn" },
    { id: "zloop", action: "borrow_and_invest", status: "Beta", route: "/credit/loop" },
    { id: "ztreasury", action: "verify_protocol", status: "Live", route: "/treasury" },
  ],
  contracts: {
    creditMarket: "0x77ccb77d1fd337b7027b3482ca365db57d92151e",
    oracle: "0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5",
    protocolSafe: "0x31837999D9E463B2EB4327CEb4BD7CCa2a500480",
    investRouter: null,
    treasury: null,
    zbnk: null,
  },
  assets: {
    zZEC: { address: "0x0b151Ff7a7c5250130EC16C275790961d558E402", decimals: 8 },
    USDG: { address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", decimals: 6 },
  },
  execution: {
    swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2",
    quoterV2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
    v3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  },
  oracle: {
    provider: "chainlink-data-streams",
    feedId: "0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693",
    maxStalenessSeconds: 1800,
  },
  risk: {
    status: "beta_not_externally_reviewed",
    maxLtvBps: 5000,
    liquidationThresholdBps: 7000,
    liquidationBonusBps: 800,
    reserveFactorBps: 1000,
    collateralCapZec: "5000",
  },
  strategies: ["ZTECH", "ZAI", "Z500", "ZYLD", "ZMAG", "CUSTOM"],
  revenueAllocation: {
    status: "proposed",
    treasuryBps: 5000,
    burnBps: 3000,
    reserveBps: 2000,
  },
  endpoints: {
    protocol: "/api/v1/protocol",
    market: "/api/v1/market",
    agentDiscovery: "/.well-known/agent.json",
    llms: "/llms.txt",
  },
  warnings: [
    "ZCREDIT, ZEARN, and ZLOOP are unaudited beta products.",
    "ZBNK and treasury redemption are not launched.",
    "Never infer missing values; treat null as unavailable.",
  ],
};

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  return res.status(200).json(manifest);
}

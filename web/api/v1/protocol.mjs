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
    {
      id: "zinvest",
      action: "invest_usdg_or_zzec",
      status: "Live",
      route: "/invest",
      capabilities: {
        usdgInput: "live",
        zzecInput: "coming_soon_awaiting_funded_pool",
      },
    },
    { id: "zindex", action: "select_strategy", status: "Live", route: "/invest/indexes" },
    { id: "zcredit", action: "borrow_or_supply", status: "Beta", route: "/credit" },
    {
      id: "zearn",
      action: "supply_usdg",
      status: "Mixed",
      route: "/earn",
      capabilities: {
        zecCreditMarket: "beta_zbank_contract",
        diversifiedUsdg: "live_third_party_morpho_v2",
      },
    },
    { id: "zloop", action: "borrow_and_invest", status: "Beta", route: "/credit/loop" },
    { id: "ztreasury", action: "verify_protocol", status: "Live", route: "/treasury" },
    {
      id: "zliquidity",
      action: "fund_zzec_usdg_pool",
      status: "Bootstrap",
      route: "/liquidity",
      custody: "user_owned_uniswap_v3_lp_nft",
    },
  ],
  contracts: {
    creditMarket: "0x77ccb77d1fd337b7027b3482ca365db57d92151e",
    oracle: "0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5",
    protocolSafe: "0x31837999D9E463B2EB4327CEb4BD7CCa2a500480",
    investRouter: null,
    treasury: null,
    redemption: null,
    payoutRegistry: null,
    ponsFeeLiquidityManager: "0x082B87D21A5F840De52F2c154aC4132E3C365295",
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
    nonfungiblePositionManager: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
    zzecUsdgPool: null,
    zzecUsdgFee: 3000,
  },
  pons: {
    version: "v2",
    factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
    feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
    memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
    quoteAsset: "USDG",
    feeLiquidityBps: 5000,
    status: "manager_deployed_awaiting_token_and_treasury",
  },
  integrations: {
    morpho: {
      vault: "0xBeEff033F34C046626B8D0A041844C5d1A5409dd",
      product: "Steakhouse USDG",
      version: "vault-v2",
      underlying: "USDG",
      custody: "user_owned_vault_shares",
      curator: "Steakhouse Financial",
      metricsEndpoint: "/api/v1/earn",
      status: "live_third_party",
    },
    across: {
      purpose: "bridge_usdg_to_robinhood_chain",
      url: "https://across.to",
      status: "external_link",
    },
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
    retirementBps: 3000,
    reserveBps: 2000,
  },
  endpoints: {
    protocol: "/api/v1/protocol",
    market: "/api/v1/market",
    earn: "/api/v1/earn",
    agentDiscovery: "/.well-known/agent.json",
    llms: "/llms.txt",
  },
  warnings: [
    "The ZCREDIT-backed ZEARN lane and ZLOOP are unaudited ZBANK beta products.",
    "The diversified ZEARN lane deposits directly into a third-party Morpho vault; ZBANK does not control its allocations, rates, or liquidity.",
    "Direct zZEC investing is built but not active until its funded pool and router are deployed.",
    "Users can initialize and fund zZEC/USDG directly; execution is price-guarded and LP NFTs remain user-owned.",
    "The pre-audit Pons fee manager is built to route 50% of creator fees into zZEC/USDG liquidity after deployment.",
    "Treasury and dual-path redemption are implemented as pre-audit alpha contracts but cannot deploy before the canonical Pons ZBNK address exists.",
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

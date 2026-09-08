/**
 * Central protocol configuration — every address, risk parameter, fee, asset, and status flag
 * the application reads. Nothing in a page or component may hardcode a protocol constant;
 * launch is a config change, not a refactor.
 *
 * `null` always means "does not exist yet" and renders as "—" / "Pending launch".
 */

import { CHAIN } from "../config";

/* ------------------------------- Launch status ------------------------------- */

export type ProductKey = "zinvest" | "zindex" | "zcredit" | "zearn" | "zloop" | "ztreasury";
export type LaunchStatus = "Live" | "Beta" | "Preview" | "Coming soon" | "Proposed";

/**
 * The single source of truth for what is live.
 *
 * Everything is Preview until its execution path is deployed AND tested — the launch target is
 * Live across the suite, but a status here only changes when the wiring is real. Nothing else
 * in the codebase may claim liveness.
 */
export const PRODUCT_STATUS: Record<ProductKey, LaunchStatus> = {
  // ZINVEST/ZINDEX execute through Uniswap v3 on Robinhood Chain — audited public
  // infrastructure (SwapRouter02 + QuoterV2), verified canonical Stock Tokens, live pool
  // liquidity confirmed onchain 2026-09-07. No ZBANK custody contract sits in the path.
  zinvest: "Live",
  zindex: "Live",
  // ZCredit deployed to Robinhood Chain mainnet 2026-09-07 (unaudited beta, temporary
  // 1-of-1 Safe admin, 5,000 zZEC collateral cap). Beta — not Live — until the audit lands.
  zcredit: "Beta",
  zearn: "Beta",
  // ZLOOP composes the live ZCREDIT market with ZINVEST execution. Beta because the
  // credit leg carries the same unaudited-market caveats as ZCREDIT.
  zloop: "Beta",
  // Read-only dashboard over live market + oracle data; token metrics label themselves
  // "Pending token launch" until ZBNK exists.
  ztreasury: "Live",
};

/** What each product is waiting on. Shown verbatim in the product's preview banner. */
export const EXECUTION_DEPENDENCIES: Record<ProductKey, string[]> = {
  zinvest: [],
  zindex: [],
  zcredit: [],
  zearn: [],
  zloop: [],
  ztreasury: [],
};

/* ------------------------------- Assets ------------------------------- */

export type Asset = {
  symbol: string;
  name: string;
  decimals: number;
  /** null until the asset (or its bridged representation) exists on Robinhood Chain. */
  address: `0x${string}` | null;
};

export const ASSETS = {
  ZEC: {
    symbol: "zZEC",
    // ZEAL's reserve-backed wrapper — the only ZEC representation live on Robinhood Chain
    // (verified onchain 2026-09-07: 8 decimals, active wrap/redeem desks). Custody model is
    // operator-held reserve with onchain attestation; see SECURITY.md before treating it as
    // final collateral.
    name: "Wrapped Zcash (ZEAL zZEC)",
    decimals: 8,
    address: "0x0b151Ff7a7c5250130EC16C275790961d558E402",
  },
  USDG: {
    symbol: "USDG",
    // Official Robinhood Chain USDG per docs.robinhood.com/chain/contracts (verified onchain
    // 2026-09-07: 6 decimals, ~$671M supply).
    name: "Global Dollar (USDG)",
    decimals: 6,
    address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  },
} satisfies Record<string, Asset>;

/* ------------------------------- Contracts ------------------------------- */

export const PROTOCOL_CONTRACTS = {
  /** The ZCREDIT lending market — LIVE on Robinhood Chain mainnet (deployed 2026-09-07). */
  creditMarket: "0x77ccb77d1fd337b7027b3482ca365db57d92151e" as `0x${string}` | null,
  /** The ZINVEST execution router (ZEC → USDG → Stock Tokens). */
  investRouter: null as `0x${string}` | null,
  /** Treasury accounting. */
  treasury: null as `0x${string}` | null,
  /** Dual-path pre-audit alpha redemption contract. */
  redemption: null as `0x${string}` | null,
  /** Self-service Zcash t-address registry for native-ZEC claims. */
  payoutRegistry: null as `0x${string}` | null,
  /** Claims Pons USDG creator fees and funds zZEC/USDG liquidity. */
  ponsFeeLiquidityManager: null as `0x${string}` | null,
  /** ZBNK token. */
  zbnk: null as `0x${string}` | null,
  /** Pons-compatible permanent retirement address. */
  retirement: "0x000000000000000000000000000000000000dEaD" as `0x${string}`,
} as const;

/* ------------------------------- Uniswap (execution venue) ------------------------------- */

/**
 * ZINVEST executes through Uniswap v3 on Robinhood Chain — Uniswap's audited, canonical
 * deployment (addresses cross-checked against Uniswap/contracts deployments/4663.md and
 * verified onchain 2026-09-07). User funds never touch a ZBANK-authored contract on this
 * path: approvals go to Uniswap's SwapRouter02, swaps settle in the user's wallet.
 */
export const UNISWAP = {
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2" as `0x${string}`,
  quoterV2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7" as `0x${string}`,
  v3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA" as `0x${string}`,
  nonfungiblePositionManager:
    "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3" as `0x${string}`,
  /** Set after SeedZzecUsdgPool creates and funds the market. */
  zzecUsdgPool: null as `0x${string}` | null,
  zzecUsdgFee: 3000 as const,
} as const;

/**
 * The ZINVEST investable universe: canonical Robinhood Stock Tokens with live Uniswap v3
 * USDG liquidity. Every entry was verified onchain 2026-09-07: token name matches the
 * "• Robinhood Token" issuer pattern, and `fee` is the token's deepest USDG pool tier at
 * verification time (depth noted). All Stock Tokens are 18 decimals.
 */
export type StockToken = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  /** Fee tier (bps ×100) of the deepest USDG pool. */
  fee: 100 | 500 | 3000 | 10000;
  /** Approximate USDG-side pool depth at verification, for display honesty. */
  poolDepthUsd: number;
};

export const STOCK_TOKENS: Record<string, StockToken> = {
  NVDA: { symbol: "NVDA", name: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", fee: 500, poolDepthUsd: 6_900_000 },
  SPY: { symbol: "SPY", name: "SPDR S&P 500 ETF", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", fee: 3000, poolDepthUsd: 10_100_000 },
  QQQ: { symbol: "QQQ", name: "Invesco QQQ", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", fee: 500, poolDepthUsd: 1_370_000 },
  GOOGL: { symbol: "GOOGL", name: "Alphabet Class A", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", fee: 500, poolDepthUsd: 463_000 },
  AAPL: { symbol: "AAPL", name: "Apple", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", fee: 500, poolDepthUsd: 327_000 },
  SGOV: { symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond", address: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5", fee: 3000, poolDepthUsd: 3_870_000 },
  MSFT: { symbol: "MSFT", name: "Microsoft", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", fee: 3000, poolDepthUsd: 588_000 },
  TSLA: { symbol: "TSLA", name: "Tesla", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", fee: 3000, poolDepthUsd: 1_360_000 },
  AMZN: { symbol: "AMZN", name: "Amazon", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", fee: 3000, poolDepthUsd: 1_150_000 },
  META: { symbol: "META", name: "Meta Platforms", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", fee: 3000, poolDepthUsd: 207_000 },
  GME: { symbol: "GME", name: "GameStop", address: "0x1b0E319c6A659F002271B69dB8A7df2F911c153E", fee: 500, poolDepthUsd: 712_000 },
  HIMS: { symbol: "HIMS", name: "Hims & Hers Health", address: "0xCceE82fE024c36fA15E1005edE3E9e4787e23D09", fee: 3000, poolDepthUsd: 1_755_000 },
};

/* ------------------------------- Oracles ------------------------------- */

/**
 * ZCREDIT never values collateral from a frontend price. All borrow/liquidation math uses a
 * trusted onchain oracle; until one is selected and deployed, every valuation renders as "—".
 */
export const ORACLES = {
  zecUsd: {
    label: "ZEC / USD",
    /** The deployed ZecUsdDataStreamFeed contract — LIVE on mainnet (2026-09-07). */
    address: "0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5" as `0x${string}` | null,
    /**
     * Provider selected: Chainlink Data Streams (pull model). There is no ZEC/USD push feed
     * on Robinhood Chain (57 feeds checked 2026-09-07), but Chainlink runs a ZEC/USD stream
     * and the chain's verifier proxy is live — reports are DON-signed and verified onchain.
     */
    provider: "chainlink-data-streams",
    verifierProxy: "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7" as `0x${string}`,
    streamFeedId:
      "0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693" as `0x${string}`,
    status: "live" as "pending-launch" | "live" | "stale" | "error",
    /** Max age before a price is treated as stale (matches the contract's maxAge). */
    maxStalenessSeconds: 1800,
  },
} as const;

/* ------------------------------- Governance ------------------------------- */

/**
 * Safe v1.4.1 is deployed on Robinhood Chain at its canonical addresses (verified onchain
 * 2026-09-07). The temporary solo Safe was deployed and made ZCredit owner on 2026-09-08.
 * It remains single-signature administration until independent signers are added.
 */
export const GOVERNANCE = {
  multisig: "0x31837999D9E463B2EB4327CEb4BD7CCa2a500480" as `0x${string}` | null,
  safeProxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67" as `0x${string}`,
  safeSingletonL2: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762" as `0x${string}`,
} as const;

/* ------------------------------- ZCREDIT risk ------------------------------- */

/**
 * ============================================================================
 * BETA RISK PARAMETERS — DEPLOYED, NOT YET EXTERNALLY REVIEWED
 * ============================================================================
 * These values mirror the current beta market configuration. They are not read
 * from chain by this frontend and have not been externally reviewed. The
 * deployed contract is authoritative; keep this mirror synchronized with any
 * onchain change. Do not set `finalized: true` without a documented risk review
 * and multisig migration (see /SECURITY.md).
 */
export const ZCREDIT_RISK = {
  finalized: false,
  collateralAsset: "ZEC" as keyof typeof ASSETS,
  borrowAsset: "USDG" as keyof typeof ASSETS,
  /** Max loan-to-value at which new borrowing is allowed. */
  maxLtvBps: 5000,
  /** LTV at which a position becomes liquidatable. */
  liquidationThresholdBps: 7000,
  /** Discount a liquidator receives on seized collateral. */
  liquidationBonusBps: 800,
  /** Share of borrower interest retained by the protocol. */
  reserveFactorBps: 1000,
  minBorrow: 10, // USDG
  minCollateral: 0.1, // ZEC
  /** Utilization-based variable rate model (bps at utilization checkpoints). */
  interestModel: {
    baseBps: 0,
    slope1Bps: 400,
    kinkBps: 8000,
    slope2Bps: 6000,
  },
} as const;

/** Health factor bands. The UI never hides risk behind a tooltip. */
export const HEALTH_BANDS = [
  { label: "Safe", min: 1.5 },
  { label: "Caution", min: 1.2 },
  { label: "High risk", min: 1.0 },
  { label: "Liquidatable", min: 0 },
] as const;

export function healthBand(hf: number | null): (typeof HEALTH_BANDS)[number]["label"] | null {
  if (hf == null) return null;
  for (const band of HEALTH_BANDS) if (hf >= band.min && band.min > 0) return band.label;
  return "Liquidatable";
}

/* ------------------------------- Fees & revenue ------------------------------- */

/** Product fee schedule. null = not set; the UI shows "—", never an invented rate. */
export const FEES = {
  zinvestExecutionBps: null as number | null,
  zloopExecutionBps: null as number | null,
  zswapRoutingBps: null as number | null,
} as const;

/**
 * Protocol revenue split. Placeholder values only — `finalized: false` means these are a
 * development illustration, not policy. Percentages are not shown as final anywhere.
 */
export const REVENUE_ALLOCATION = {
  finalized: false,
  treasuryBps: 5000,
  burnBps: 3000,
  reserveBps: 2000,
} as const;

// A split that doesn't sum to 100% is a config bug worth failing loudly over, even in dev.
if (
  REVENUE_ALLOCATION.treasuryBps + REVENUE_ALLOCATION.burnBps + REVENUE_ALLOCATION.reserveBps !==
  10_000
) {
  throw new Error("REVENUE_ALLOCATION must sum to 10000 bps");
}

/* ------------------------------- Index strategies ------------------------------- */

export type IndexStrategy = {
  ticker: string;
  name: string;
  description: string;
  /** Component symbols with target weights (percent). Empty = user-defined. */
  targets: { symbol: string; weight: number }[];
  /**
   * No automated rebalance contract exists — these are target allocation strategies, and the
   * UI must say so. Change only when a rebalance engine is deployed.
   */
  rebalancePolicy: "Target allocation strategy — no automated rebalancing";
  status: LaunchStatus;
};

const REBALANCE = "Target allocation strategy — no automated rebalancing" as const;

/**
 * Every strategy below is fully executable today: each component is a verified canonical
 * Stock Token in STOCK_TOKENS with live Uniswap v3 USDG liquidity. No placeholder tickers.
 */
export const INDEX_STRATEGIES: IndexStrategy[] = [
  {
    ticker: "ZTECH",
    name: "Technology",
    description: "Large-cap technology Stock Tokens.",
    targets: [
      { symbol: "NVDA", weight: 25 },
      { symbol: "MSFT", weight: 20 },
      { symbol: "AAPL", weight: 20 },
      { symbol: "META", weight: 15 },
      { symbol: "GOOGL", weight: 10 },
      { symbol: "QQQ", weight: 10 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "ZAI",
    name: "AI Leaders",
    description: "Concentrated exposure to the companies building AI.",
    targets: [
      { symbol: "NVDA", weight: 35 },
      { symbol: "MSFT", weight: 25 },
      { symbol: "GOOGL", weight: 20 },
      { symbol: "META", weight: 20 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "Z500",
    name: "Broad Market",
    description: "Broad U.S. market exposure through index Stock Tokens.",
    targets: [
      { symbol: "SPY", weight: 50 },
      { symbol: "QQQ", weight: 30 },
      { symbol: "AMZN", weight: 10 },
      { symbol: "TSLA", weight: 10 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "ZYLD",
    name: "Treasury + Market",
    description: "Short-duration Treasury ETF ballast with a broad-market sleeve.",
    targets: [
      { symbol: "SGOV", weight: 60 },
      { symbol: "SPY", weight: 25 },
      { symbol: "QQQ", weight: 15 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "ZMAG",
    name: "Mega Cap",
    description: "The seven mega-cap names, equal-leaning weights.",
    targets: [
      { symbol: "NVDA", weight: 16 },
      { symbol: "AAPL", weight: 14 },
      { symbol: "MSFT", weight: 14 },
      { symbol: "GOOGL", weight: 14 },
      { symbol: "AMZN", weight: 14 },
      { symbol: "META", weight: 14 },
      { symbol: "TSLA", weight: 14 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "CUSTOM",
    name: "Custom",
    description: "Your own allocation across supported Stock Tokens.",
    targets: [],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
];

/* ------------------------------- Network ------------------------------- */

export const NETWORK = {
  chainId: CHAIN.id,
  name: CHAIN.name,
  rpcUrl: CHAIN.rpcUrl,
  explorer: CHAIN.explorer,
} as const;

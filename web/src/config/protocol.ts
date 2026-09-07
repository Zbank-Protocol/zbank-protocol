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
  zinvest: "Preview",
  zindex: "Preview",
  // ZCredit deployed to Robinhood Chain mainnet 2026-09-07 (unaudited beta, single-key
  // admin, 5,000 zZEC collateral cap). Beta — not Live — until the external audit lands.
  zcredit: "Beta",
  zearn: "Beta",
  zloop: "Preview",
  ztreasury: "Preview",
};

/** What each product is waiting on. Shown verbatim in the product's preview banner. */
export const EXECUTION_DEPENDENCIES: Record<ProductKey, string[]> = {
  zinvest: ["Stock Token routing contracts", "ZEC/USDG route liquidity", "Execution router deployment"],
  zindex: ["ZINVEST execution (ZINDEX routes through it)"],
  zcredit: ["Lending market deployment (audited stack)", "ZEC/USD oracle", "Liquidation infrastructure"],
  zearn: ["ZCREDIT market deployment (ZEARN is its lender side)"],
  zloop: ["ZCREDIT market deployment", "ZINVEST execution"],
  ztreasury: ["Treasury accounting contracts", "ZBNK token launch"],
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
  /** ZBNK token. */
  zbnk: null as `0x${string}` | null,
  /** The burn address once burns are live. */
  burn: null as `0x${string}` | null,
} as const;

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
    status: "pending-launch" as "pending-launch" | "live" | "stale" | "error",
    /** Max age before a price is treated as stale (matches the contract's maxAge). */
    maxStalenessSeconds: 1800,
  },
} as const;

/* ------------------------------- Governance ------------------------------- */

/**
 * Safe v1.4.1 is deployed on Robinhood Chain at its canonical addresses (verified onchain
 * 2026-09-07). The protocol multisig is created via script/CreateSafe.s.sol; its address
 * lands here and becomes the owner of every contract at deployment.
 */
export const GOVERNANCE = {
  multisig: null as `0x${string}` | null,
  safeProxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67" as `0x${string}`,
  safeSingletonL2: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762" as `0x${string}`,
} as const;

/* ------------------------------- ZCREDIT risk ------------------------------- */

/**
 * ============================================================================
 * TODO: FINAL RISK PARAMETERS REQUIRED BEFORE MAINNET
 * ============================================================================
 * Every value below is a conservative development placeholder. None has been
 * reviewed for production. `finalized: false` gates all execution paths — do
 * not flip it without a documented risk review (see /SECURITY.md).
 */
export const ZCREDIT_RISK = {
  finalized: false,
  collateralAsset: "ZEC" as keyof typeof ASSETS,
  borrowAsset: "USDG" as keyof typeof ASSETS,
  /** Max loan-to-value at which new borrowing is allowed. */
  maxLtvBps: 5000,
  /** LTV at which a position becomes liquidatable. */
  liquidationThresholdBps: 6500,
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

export const INDEX_STRATEGIES: IndexStrategy[] = [
  {
    ticker: "ZTECH",
    name: "Technology",
    description: "Large-cap technology Stock Tokens with a ZEC sleeve.",
    targets: [
      { symbol: "NVDA", weight: 25 },
      { symbol: "AAPL", weight: 20 },
      { symbol: "MSFT", weight: 20 },
      { symbol: "META", weight: 15 },
      { symbol: "AVGO", weight: 10 },
      { symbol: "ZEC", weight: 10 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "ZAI",
    name: "AI + Semiconductors",
    description: "AI and semiconductor exposure, ZEC-funded.",
    targets: [
      { symbol: "NVDA", weight: 30 },
      { symbol: "AMD", weight: 20 },
      { symbol: "TSM", weight: 15 },
      { symbol: "ASML", weight: 10 },
      { symbol: "MSFT", weight: 15 },
      { symbol: "ZEC", weight: 10 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "Z500",
    name: "Broad Market",
    description: "Broad U.S. market exposure through index Stock Tokens.",
    targets: [
      { symbol: "SPY", weight: 45 },
      { symbol: "QQQ", weight: 25 },
      { symbol: "IWM", weight: 10 },
      { symbol: "ZEC", weight: 20 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "ZDIV",
    name: "Dividend",
    description: "Dividend-oriented Stock Tokens with a ZEC sleeve.",
    targets: [
      { symbol: "JNJ", weight: 20 },
      { symbol: "KO", weight: 20 },
      { symbol: "PG", weight: 15 },
      { symbol: "XOM", weight: 15 },
      { symbol: "VZ", weight: 15 },
      { symbol: "ZEC", weight: 15 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "Z50",
    name: "ZEC 50/50",
    description: "Half ZEC, half broad-market Stock Tokens.",
    targets: [
      { symbol: "ZEC", weight: 50 },
      { symbol: "SPY", weight: 25 },
      { symbol: "QQQ", weight: 15 },
      { symbol: "NVDA", weight: 10 },
    ],
    rebalancePolicy: REBALANCE,
    status: PRODUCT_STATUS.zindex,
  },
  {
    ticker: "CUSTOM",
    name: "Custom",
    description: "Your own allocation across supported Stock Tokens and ZEC.",
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

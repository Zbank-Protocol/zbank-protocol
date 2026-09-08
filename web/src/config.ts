/**
 * Deployment configuration.
 *
 * Addresses left as `null` are not deployed yet. Every component treats `null` as
 * "show the mechanism, but don't claim a number" rather than rendering a fake value,
 * so the site is honest before launch and live immediately after.
 */

/** Robinhood Chain mainnet: a permissionless Arbitrum Orbit L2 settling to Ethereum. */
export const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  /** Gas is paid in ETH; the chain has no native token. */
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
} as const;

export const TESTNET = {
  id: 46630,
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorer: "https://explorer.testnet.chain.robinhood.com",
} as const;

/**
 * Brand identity. Change these in one place to rebrand.
 *
 * `zbank.world` rather than a `.com`: every strong `zbank` .com is registered. The financial TLDs
 * that would have read better next to a Zcash product — `.cash` among them — turned out to hold
 * "bank" on a registry blocklist and refuse registration outright, which is a restriction no
 * availability lookup reports.
 */
export const BRAND = {
  name: "ZBANK",
  domain: "zbank.world",
  tagline: "Capital markets for Zcash",
} as const;

/** The token identity. */
export const TOKEN = {
  name: "Zbank",
  symbol: "ZBNK",
  /** Set once the Pons launch transaction confirms. */
  address: null as `0x${string}` | null,
} as const;

/**
 * Pons contracts. A hook binds to one factory permanently, so a token belongs to a
 * specific factory/hook/escrow set. Read these from the launch record rather than
 * assuming them — querying the wrong escrow reports a zero balance instead of failing,
 * which is an easy way to silently show holders the wrong number.
 */
export const PONS = {
  /** Pons v2 factory; verified by launchConfigCount() on Robinhood Chain. */
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as `0x${string}`,
  feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as `0x${string}` | null,
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as `0x${string}` | null,
  graduationGuard: "0xf5695117b99B6f6401e67d4195BD653628176C6C" as `0x${string}`,
  /** Standard protocol trading fee, before any creator tax. */
  protocolFeeBps: 100,
  /** Current split of the standard fee: the creator keeps 70%, Pons keeps 30%. */
  creatorShareBps: 7000,
} as const;

/** Our own contracts. */
export const CONTRACTS = {
  payoutRegistry: null as `0x${string}` | null,
  treasury: null as `0x${string}` | null,
  feeLiquidityManager:
    "0x082B87D21A5F840De52F2c154aC4132E3C365295" as `0x${string}` | null,
} as const;

/**
 * The public Zcash transparent address holding the reserve.
 *
 * Publishing this is the entire proof-of-reserve story: anyone can verify the balance
 * on a block explorer without trusting this site. It is transparent rather than shielded
 * for exactly that reason.
 */
export const ZEC_RESERVE = {
  address: null as string | null,
  explorerBase: "https://blockchair.com/zcash/address/",
} as const;

/**
 * Explorer link for the token, or null before launch.
 *
 * Kept here rather than beside the chain client: it only formats a string, and importing it
 * from the client would make every consumer — including the masthead — pull viem into the
 * entry bundle.
 */
export function tokenExplorerUrl(): string | null {
  return TOKEN.address ? `${CHAIN.explorer}/token/${TOKEN.address}` : null;
}

/** Where a holder converts ETH fees into ZEC. Documented so the route isn't a black box. */
export const SWAP_ROUTES = [
  { name: "NEAR Intents", note: "100+ assets into native ZEC in one flow" },
  { name: "THORChain", note: "native ZEC swaps, no wrapping" },
  { name: "Maya Protocol", note: "native ZEC, transparent addresses" },
] as const;

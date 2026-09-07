import { ASSETS, ORACLES, PROTOCOL_CONTRACTS } from "../config/protocol";

/**
 * The chain layer for ZCREDIT: one place that knows the ABI, the chain, and how to read and
 * write the deployed market. Hooks consume this; components never touch viem directly.
 *
 * Everything is a dynamic import of viem so the landing experience pays no bundle cost —
 * the module only loads on app pages that actually talk to the chain.
 */

export const ROBINHOOD_CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
} as const;

export const ZCREDIT_ABI = [
  // -------- market reads
  { type: "function", name: "utilizationBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowRatePerYear", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "supplyRatePerYear", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableLiquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBorrows", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalCollateral", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "collateralCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  // -------- position reads
  { type: "function", name: "collateralOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "debtOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "healthFactor", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOfSupplied", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxLtvBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  // -------- writes
  { type: "function", name: "supply", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "depositCollateral", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawCollateral", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "borrow", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "repay", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
] as const;

export const ORACLE_ABI = [
  { type: "function", name: "priceUsd", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastObservedAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const marketAddress = () => PROTOCOL_CONTRACTS.creditMarket;
export const oracleAddress = () => ORACLES.zecUsd.address;

const USDG_UNIT = 10 ** ASSETS.USDG.decimals;
const ZEC_UNIT = 10 ** ASSETS.ZEC.decimals;

export const toUsdg = (raw: bigint) => Number(raw) / USDG_UNIT;
export const toZec = (raw: bigint) => Number(raw) / ZEC_UNIT;
export const toWadFraction = (raw: bigint) => Number(raw) / 1e18;
export const fromUsdg = (amount: number) => BigInt(Math.round(amount * USDG_UNIT));
export const fromZec = (amount: number) => BigInt(Math.round(amount * ZEC_UNIT));

export async function getPublicClient() {
  const { createPublicClient, http } = await import("viem");
  return createPublicClient({ chain: ROBINHOOD_CHAIN, transport: http() });
}

/** Wallet client over the injected provider, pinned to Robinhood Chain. */
export async function getWalletClient(account: `0x${string}`) {
  const { createWalletClient, custom } = await import("viem");
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!ethereum) throw new Error("No wallet detected");
  return createWalletClient({
    chain: ROBINHOOD_CHAIN,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: custom(ethereum as any),
    account,
  });
}

/** Approve `spender` for exactly `amount` of `token` if the current allowance is short. */
export async function ensureAllowance(
  account: `0x${string}`,
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
) {
  const publicClient = await getPublicClient();
  const current = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account, spender],
  })) as bigint;
  if (current >= amount) return;
  const wallet = await getWalletClient(account);
  const hash = await wallet.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Execute one market write and wait for its receipt. */
export async function marketWrite(
  account: `0x${string}`,
  functionName: "supply" | "withdraw" | "depositCollateral" | "withdrawCollateral" | "borrow" | "repay",
  args: readonly unknown[],
) {
  const address = marketAddress();
  if (!address) throw new Error("Market not deployed");
  const wallet = await getWalletClient(account);
  const publicClient = await getPublicClient();
  const hash = await wallet.writeContract({
    address,
    abi: ZCREDIT_ABI,
    functionName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: args as any,
  });
  return publicClient.waitForTransactionReceipt({ hash });
}

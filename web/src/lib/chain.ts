import { createPublicClient, defineChain, formatEther, http, parseAbi } from "viem";
import { CHAIN, CONTRACTS, PONS, TOKEN, ZEC_RESERVE } from "../config";

export const robinhoodChain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [CHAIN.rpcUrl] } },
  blockExplorers: { default: { name: "Blockscout", url: CHAIN.explorer } },
});

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(CHAIN.rpcUrl),
});

/**
 * Pons fee escrow. Fees are credited here rather than pushed, so a recipient that cannot
 * receive a transfer never blocks a sweep for anyone else. Balances are per-asset: a
 * native-quote launch credits the ETH ledger, a custom-pair launch credits the quote
 * asset's ledger, and a released buyback vest credits the launch token's ledger.
 */
export const escrowAbi = parseAbi([
  "function balanceOf(address recipient) view returns (uint256)",
  "function balanceOfToken(address recipient, address token) view returns (uint256)",
  "function claim()",
  "function claimToken(address token)",
]);

/**
 * The shared Pons hook. Fees accrued but not yet swept live here, so the escrow balance
 * alone understates what the treasury is owed.
 */
export const hookAbi = parseAbi([
  "function pendingFees(bytes32 poolId, address currency) view returns (uint256)",
  "function pendingCreatorTax(bytes32 poolId, address currency) view returns (uint256)",
]);

export const registryAbi = parseAbi([
  "function setPayoutAddress(string encoded)",
  "function clearPayoutAddress()",
  "function isRegistered(address holder) view returns (bool)",
  "function isValidPayoutAddress(string encoded) view returns (bool)",
  "function registeredCount() view returns (uint256)",
]);

export type TreasuryState = {
  /** Fees claimable from escrow right now, in ETH. */
  claimable: number | null;
  /** Accrued in the hook but not yet swept, in ETH. */
  pending: number | null;
  /** Holders who have registered a Zcash payout address. */
  registered: number | null;
  /** ZEC held in the public reserve address. */
  reserveZec: number | null;
};

const EMPTY: TreasuryState = {
  claimable: null,
  pending: null,
  registered: null,
  reserveZec: null,
};

/**
 * Reads live protocol state, returning `null` for anything not yet deployed or reachable.
 *
 * Nothing here invents a number. A `null` renders as a dash, because a placeholder figure
 * on a page about verifiable reserves would undermine the only thing the page is claiming.
 */
export async function readTreasuryState(): Promise<TreasuryState> {
  const state: TreasuryState = { ...EMPTY };

  await Promise.allSettled([
    (async () => {
      if (!PONS.feeEscrow || !CONTRACTS.treasury) return;
      const wei = await publicClient.readContract({
        address: PONS.feeEscrow,
        abi: escrowAbi,
        functionName: "balanceOf",
        args: [CONTRACTS.treasury],
      });
      state.claimable = Number(formatEther(wei));
    })(),

    (async () => {
      if (!CONTRACTS.payoutRegistry) return;
      const count = await publicClient.readContract({
        address: CONTRACTS.payoutRegistry,
        abi: registryAbi,
        functionName: "registeredCount",
      });
      state.registered = Number(count);
    })(),

    (async () => {
      state.reserveZec = await readZecReserve();
    })(),
  ]);

  return state;
}

/**
 * Reads the ZEC reserve balance from a public Zcash explorer.
 *
 * Deliberately a third-party read: the point of publishing a transparent address is that
 * the balance can be confirmed without trusting us, and it would be incoherent to then
 * serve the number from our own backend.
 */
export async function readZecReserve(): Promise<number | null> {
  if (!ZEC_RESERVE.address) return null;

  try {
    const response = await fetch(
      `https://api.blockchair.com/zcash/dashboards/address/${ZEC_RESERVE.address}`,
    );
    if (!response.ok) return null;

    const json = (await response.json()) as {
      data?: Record<string, { address?: { balance?: number } }>;
    };
    const balance = json.data?.[ZEC_RESERVE.address]?.address?.balance;
    // Zcash amounts are quoted in zatoshis: 1 ZEC = 1e8.
    return typeof balance === "number" ? balance / 1e8 : null;
  } catch {
    return null;
  }
}

export function tokenExplorerUrl(): string | null {
  return TOKEN.address ? `${CHAIN.explorer}/token/${TOKEN.address}` : null;
}

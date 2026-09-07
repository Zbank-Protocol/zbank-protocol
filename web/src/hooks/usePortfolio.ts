import { useEffect, useState } from "react";
import { ASSETS, NETWORK, PROTOCOL_CONTRACTS } from "../config/protocol";
import { useZCreditPosition } from "./useZCreditPosition";

/**
 * The unified /app portfolio: wallet balances, invested positions, credit position, token
 * holdings. Composes the other hooks — the dashboard never talks to a data source directly.
 *
 * Balance reads are real: for every asset whose address exists in config, this hook reads
 * `balanceOf` over the chain RPC and normalizes by the configured decimals. Today the
 * addresses are null, so balances render "—"; the moment launch config lands, this code path
 * lights up with no component changes. viem is imported dynamically so the app shell doesn't
 * pay for it before a wallet ever connects.
 */

type Balances = { zec: number | null; usdg: number | null; zbnk: number | null };

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type Portfolio = {
  live: boolean;
  zecBalance: number | null;
  usdgBalance: number | null;
  zbnkBalance: number | null;
  stockTokenPositions: { symbol: string; amount: number | null }[] | null;
  indexPositions: { ticker: string; amount: number | null }[] | null;
  credit: ReturnType<typeof useZCreditPosition>;
};

export function usePortfolio(address: string | null): Portfolio {
  const credit = useZCreditPosition(address);
  const [balances, setBalances] = useState<Balances>({ zec: null, usdg: null, zbnk: null });

  useEffect(() => {
    let cancelled = false;

    const targets = [
      ["zec", ASSETS.ZEC.address, ASSETS.ZEC.decimals],
      ["usdg", ASSETS.USDG.address, ASSETS.USDG.decimals],
      ["zbnk", PROTOCOL_CONTRACTS.zbnk, 18],
    ] as const;

    // No wallet, or nothing deployed to read: balances stay null (rendered as "—").
    if (!address || targets.every(([, tokenAddress]) => tokenAddress == null)) {
      setBalances({ zec: null, usdg: null, zbnk: null });
      return;
    }

    void (async () => {
      const { createPublicClient, http, formatUnits } = await import("viem");
      const client = createPublicClient({ transport: http(NETWORK.rpcUrl) });

      const next: Balances = { zec: null, usdg: null, zbnk: null };
      for (const [key, tokenAddress, decimals] of targets) {
        if (tokenAddress == null) continue;
        try {
          const raw = await client.readContract({
            address: tokenAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          });
          next[key] = Number(formatUnits(raw, decimals));
        } catch {
          next[key] = null; // A failed read is unknown, never zero.
        }
      }
      if (!cancelled) setBalances(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return {
    live: PROTOCOL_CONTRACTS.investRouter != null,
    zecBalance: balances.zec,
    usdgBalance: balances.usdg,
    zbnkBalance: balances.zbnk,
    stockTokenPositions: null,
    indexPositions: null,
    credit,
  };
}

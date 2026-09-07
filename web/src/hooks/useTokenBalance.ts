import { useCallback, useEffect, useState } from "react";
import { ERC20_ABI, getPublicClient } from "../lib/zcredit";

/**
 * The connected wallet's balance of one ERC-20, in human units — a live `balanceOf` read
 * against the token contract on Robinhood Chain. Null while unknown (no wallet, read failed),
 * so inputs render the honest "—" instead of a zero the chain never said.
 *
 * Refreshes on account change and every 30s while mounted; `refresh` forces one (call it
 * after a transaction settles).
 */
export function useTokenBalance(
  account: string | null,
  token: `0x${string}`,
  decimals: number,
): { balance: number | null; refresh: () => void } {
  const [balance, setBalance] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!account) {
      setBalance(null);
      return;
    }
    let cancelled = false;

    const read = async () => {
      try {
        const client = await getPublicClient();
        const raw = (await client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account as `0x${string}`],
        })) as bigint;
        if (!cancelled) setBalance(Number(raw) / 10 ** decimals);
      } catch {
        if (!cancelled) setBalance(null);
      }
    };

    void read();
    const timer = window.setInterval(() => void read(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [account, token, decimals, nonce]);

  return { balance, refresh };
}

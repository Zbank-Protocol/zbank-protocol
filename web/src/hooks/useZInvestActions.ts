import { useCallback, useState } from "react";
import { executeBasket, type BasketQuote } from "../lib/zinvest";

export type InvestStatus = "idle" | "approving" | "confirming" | "success" | "error";

/**
 * ZINVEST execution: one call, one atomic Uniswap multicall, full status reporting.
 * The approval (if needed) and the swap are separate wallet prompts; both are surfaced.
 */
export function useZInvestActions(account: string | null) {
  const [status, setStatus] = useState<InvestStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const invest = useCallback(
    async (quote: BasketQuote, slippageBps: number) => {
      if (!account) return;
      setStatus("approving");
      setError(null);
      setTxHash(null);
      try {
        setStatus("confirming");
        const hash = await executeBasket(account as `0x${string}`, quote, slippageBps);
        setTxHash(hash);
        setStatus("success");
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0].slice(0, 160) : "Transaction failed";
        setError(message);
        setStatus("error");
      }
    },
    [account],
  );

  return {
    status,
    error,
    txHash,
    busy: status === "approving" || status === "confirming",
    reset: () => {
      setStatus("idle");
      setError(null);
      setTxHash(null);
    },
    invest,
  };
}

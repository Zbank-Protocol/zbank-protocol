import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_MORPHO_STATE,
  readMorphoVault,
  type MorphoVaultState,
} from "../lib/morpho";

export function useMorphoVault(account: string | null): MorphoVaultState & {
  loading: boolean;
  refresh: () => void;
} {
  const [state, setState] = useState<MorphoVaultState>(EMPTY_MORPHO_STATE);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await readMorphoVault(account);
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState(EMPTY_MORPHO_STATE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [account, nonce]);

  return { ...state, loading, refresh };
}

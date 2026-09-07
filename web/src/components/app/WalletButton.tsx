import { shortAddress, useWallet } from "../../hooks/useWallet";
import { NETWORK } from "../../config/protocol";

/**
 * The wallet control: connect, or show the connected address; if connected to the wrong
 * network, the one action that matters is switching to Robinhood Chain.
 */
export function WalletButton() {
  const { address, chainId, hasProvider, connecting, connect, switchChain } = useWallet();

  if (!hasProvider) {
    return <span className="chip chip--bare">No wallet detected</span>;
  }

  if (address == null) {
    return (
      <button className="btn btn--gold" onClick={() => void connect()} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== NETWORK.chainId) {
    return (
      <button className="btn btn--line" onClick={() => void switchChain()}>
        Switch to {NETWORK.name}
      </button>
    );
  }

  return (
    <span className="wallet-tag">
      <span className="dot" />
      {shortAddress(address)}
    </span>
  );
}

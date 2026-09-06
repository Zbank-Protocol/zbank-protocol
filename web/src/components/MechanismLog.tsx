import { PONS } from "../config";

/**
 * The mechanism, stated without euphemism — including the step where funds leave the chain,
 * which is the one a reader is entitled to be suspicious about.
 */
const STEPS = [
  {
    t: "01",
    verb: "Trade",
    detail: `A swap pays the standard ${(PONS.protocolFeeBps / 100).toFixed(
      2,
    )}% protocol fee, plus any creator tax fixed at launch. The pool itself charges nothing — the Pons hook charges the fee.`,
  },
  {
    t: "02",
    verb: "Accrue",
    detail: `Pons splits that fee and credits our share to its escrow. The creator share is ${
      PONS.creatorShareBps / 100
    }% on current launches. It is credited, not pushed, so it cannot be blocked.`,
  },
  {
    t: "03",
    verb: "Claim",
    detail:
      "The treasury contract is set as the fee recipient and pulls the escrow balance. Anyone can trigger this; the funds can only move to one place.",
  },
  {
    t: "04",
    verb: "Convert",
    detail:
      "ETH is bridged off Robinhood Chain and swapped for native ZEC through intent-based routes. This is the step a contract cannot do, because Zcash is not an EVM chain.",
  },
  {
    t: "05",
    verb: "Distribute",
    detail:
      "ZEC lands in the published reserve. Holders claim pro rata to the Zcash address they registered, settled on the Zcash network.",
  },
] as const;

export function MechanismLog() {
  return (
    <ol className="log">
      {STEPS.map((step) => (
        <li className="log__row" key={step.t}>
          <span className="log__t">{step.t}</span>
          <div>
            <div className="log__verb">{step.verb}</div>
            <p className="log__detail">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

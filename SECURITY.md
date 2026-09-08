# ZBANK — Launch Readiness & Security Posture

Status date: 2026-09-08. This document is the honest register of what exists, what does not,
and what must be resolved before the capped mainnet beta expands. Nothing in this repository
has been externally audited. ZCREDIT, ZEARN, and ZLOOP remain explicitly Beta.

## Reporting a vulnerability

Do not disclose an exploitable vulnerability in a public issue. Submit it through GitHub's
private vulnerability reporting on the repository Security tab. Include the affected commit
and contract, impact, proof of concept, and proposed remediation when possible.

Public audit issues are for non-exploitable hardening and defense-in-depth findings only.

## Current onchain surface

| Component | Status |
| --- | --- |
| `ZcashAddress.sol` (t-address validation library) | Implemented, unit-tested, **not audited** |
| `PayoutRegistry.sol` (native-ZEC payout registry) | Implemented, unit-tested, **not audited, not deployed** — deploys with token economics after canonical Pons ZBNK exists |
| `ZCredit.sol` (ZCREDIT lending market) | **Deployed** at `0x77ccb77d1fd337b7027b3482ca365db57d92151e`, unit-tested, **not audited**, owned by temporary 1-of-1 Safe `0x31837999D9E463B2EB4327CEb4BD7CCa2a500480` |
| `InvestRouter.sol` (ZINVEST execution router) | Implemented, unit-tested with the production adapter, **not audited, not deployed** |
| `UniswapV3Adapter.sol` (approved direct/multi-hop venue paths) | Implemented, unit-tested, **not audited, not deployed** — direct zZEC remains disabled until its market is funded and reviewed |
| `ZBankTreasury.sol` (revenue split / buckets / Pons-compatible retirement) | Implemented, unit-tested, **not audited, not deployed** |
| `ZBankRedemption.sol` (atomic zZEC + operator-settled native ZEC) | Implemented, unit-tested, **not audited, not deployed** — permanently binds to the canonical Pons ZBNK address |
| `ZBNK.sol` (fixed-supply burnable token) | Implemented, unit-tested, **not launched** — superseded if launched via Pons |
| `ChainlinkOracleAdapter.sol` (push-feed adapter, fallback) | Implemented, unit-tested |
| `ZecUsdDataStreamFeed.sol` (ZEC/USD via Chainlink Data Streams verifier) | **Deployed and receiving verified reports** at `0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5`, unit-tested, **not audited** |
| `script/Deploy.s.sol` | Full-stack deploy; defaults to verified mainnet addresses (zZEC, USDG, verifier, feed id) |
| `script/CreateSafe.s.sol` | Creates the protocol Safe via the canonical v1.4.1 factory (verified deployed on chain 4663) |

Verified external addresses (Robinhood Chain mainnet, checked onchain 2026-09-07):

| What | Address | Source |
| --- | --- | --- |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | docs.robinhood.com/chain/contracts + onchain (6dp) |
| zZEC (ZEAL wrapped ZEC) | `0x0b151Ff7a7c5250130EC16C275790961d558E402` | zealtoken.com + onchain (8dp, live supply) |
| Data Streams verifier proxy | `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7` | docs.robinhood.com/chain/data-streams |
| ZEC/USD stream feed id | `0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693` | Chainlink crypto-streams catalog |
| Safe v1.4.1 factory / L2 singleton | `0x4e1DCf7…ec67` / `0x29fcB43…C762` | canonical addresses, code verified onchain |

Test suite: `forge test` — 82 tests discovered, 81 passing and the RPC-dependent fork test
skipped when no fork endpoint is available (supply/borrow/repay lifecycle, interest
accrual to lenders and reserves, close-factor liquidation, stale/zero oracle rejection,
parameter rails, pause semantics, revenue split accounting, retirement tracking, basket routing,
approved-path validation, integrated direct-zZEC adapter execution, proportional zZEC
redemption, and cancellable native-ZEC claims).

The frontend reflects this with ZCREDIT, ZEARN, and ZLOOP in Beta and blocks new borrower
exposure whenever the oracle is stale or uninitialized. ZINVEST/ZINDEX execute non-custodial
Uniswap v3 routes. Token and treasury metrics remain pending launch.

## Unresolved contract risks

1. **Lending engine (ZCREDIT).** Handles user collateral and lender funds — the highest-risk
   component. A custom engine (`ZCredit.sol`) now exists in this repo: single market,
   share-based lender accounting, kinked utilization rates, health factor, close-factor
   liquidations, hard parameter rails, pause that still allows repay/withdraw. **This
   supersedes the earlier decision 0.2 to only deploy an audited third-party stack — which
   means the full audit cycle it warned about is now mandatory before production status or
   expansion beyond the disclosed alpha/beta caps.** The audited-stack route (Aave v3 instance / Morpho Blue market) remains
   the fallback if the audit timeline is unacceptable. Known accepted simplification: USDG is
   valued at $1 (no debt-side oracle); a USDG depeg is not detected by the market.
2. **Liquidation system.** Depends on the lending stack chosen. Requirements: keeper
   incentives (liquidation bonus), partial liquidations, and behavior under oracle downtime.
3. **Interest model.** Variable utilization-based model. Parameters in
   `web/src/config/protocol.ts` mirror the deployed beta configuration but are not read
   dynamically; the deployed contract is authoritative.
4. **ZINVEST router.** Swap routing ZEC → USDG → Stock Tokens. Risks: slippage handling,
   token approval scope, MEV exposure on multi-hop routes, Stock Token transfer restrictions.
5. **Treasury contracts.** Revenue collection, ZEC acquisition, buyback + burn. Risk: any
   discretionary control over treasury funds must be transparent and time-locked.
6. **Reentrancy / pause / upgradeability.** ZCredit uses `ReentrancyGuard` and `Pausable` and
   is not upgradeable. Its owner can tune bounded parameters, sweep accrued reserves, and
   pause new exposure; repay and lender withdrawal remain available while paused.

## Oracle dependencies — RESOLVED PATH (verified 2026-09-07)

- ZCREDIT valuation MUST come from a trusted onchain ZEC/USD source; the frontend never
  prices collateral.
- Findings, all verified against the chain or primary docs:
  - Chainlink is Robinhood Chain's official oracle provider; 57 push feeds exist onchain
    (ETH/USD, USDG/USD, BTC/USD, stock tokens) — **no ZEC/USD push feed among them**.
  - Chainlink runs a **ZEC/USD Data Stream** (`ZEC/USD-RefPrice-DS-Premium-Global-003`,
    feed id `0x00039f8a…db693`), and the chain's **Data Streams verifier proxy is live at
    `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`** (published in Robinhood's own docs).
  - Pyth has no verified deployment on the chain (candidate addresses probed; none respond
    to the Pyth interface).
- Selected design: `ZecUsdDataStreamFeed.sol` — permissionless relayers submit DON-signed
  reports; the Chainlink verifier proxy checks signatures onchain; the contract enforces
  feed-id match, positive price, report expiry, monotonic observation timestamps (no
  rollback), and a 30-minute staleness bound on reads. Trust rests on Chainlink's DON, not
  the relayer.
- Remaining operational requirement: **someone must relay reports** (a keeper cron, or the
  frontend attaching an update to user transactions). If nobody relays for 30 minutes the
  market halts new borrowing and liquidation — safe, but it must be monitored.
- zZEC-specific risk, stated plainly: the oracle prices **ZEC**, and the market takes
  **zZEC** (ZEAL's reserve-backed wrapper) as collateral. This assumes the 1:1 peg holds.
  zZEC v1 is operator-custodied with onchain attestation — a reserve failure would not be
  detected by the price feed. Mitigations to decide before size grows: collateral caps,
  peg monitoring against the zZEC/ETH Uniswap market, or waiting for zZEC's trust-minimized
  custody phase.

## Deployed beta parameters (not externally reviewed)

| Parameter | Deployed beta value | Note |
| --- | --- | --- |
| Max LTV | 50% | Conservative for a volatile collateral; needs risk modeling |
| Liquidation threshold | 70% | Onchain value; gap to max LTV must absorb ZEC's realistic daily moves |
| Liquidation bonus | 8% | Must clear keeper gas + slippage on the chain's real liquidity |
| Reserve factor | 10% | Protocol share of borrower interest |
| Min borrow / min collateral | 10 USDG / 0.1 ZEC | Dust prevention |

The frontend mirror lives in `web/src/config/protocol.ts` (`ZCREDIT_RISK`,
`finalized: false`). The deployed contract is authoritative and drift is checked in CI.

## Admin permissions

- **Temporary solo administration, recorded 2026-09-08:** ZCredit ownership was transferred
  from the automated keeper EOA to Safe `0x31837999D9E463B2EB4327CEb4BD7CCa2a500480`.
  Its sole owner is the separate address `0x367fC81A2205587DF2ae6F9BA0af28EF75A88b07`
  and its threshold is 1. This separates the keeper from administration and creates a Safe
  upgrade path, but it remains single-signature administration. Add independent signers,
  verify an emergency Safe transaction, and raise the threshold before production status or
  expansion of the alpha/beta caps.
- The admin risk is bounded by onchain rails: the Safe cannot touch user collateral or
  supplied funds, cannot set parameters outside the hard bounds, and pause never blocks
  repay or lender withdrawal.
- The full-stack script (`script/Deploy.s.sol`) still requires `MULTISIG` and remains the
  standard path once co-signers exist.
- Privileged surface, enumerated:
  - `ZCredit`: `setRiskParams` / `setRateParams` (inside hard bounds: LTV < threshold ≤ 90%,
    bonus ≤ 20%, reserve factor ≤ 50%, base ≤ 10%, kink inside (0,100%)), `sweepReserves`
    (bounded by accrued reserves — cannot touch user funds), `pause`/`unpause` (pause blocks
    new exposure only; repay and lender withdrawal always work).
  - `ZBankTreasury`: `spend` (bounded per bucket, memo logged onchain), `setSplit` (must sum
    to 10000 bps). `allocateRevenue` and `retireZbnk` are permissionless. Pons ZBNK exposes
    no holder burn function, so retired tokens move to the inaccessible canonical retirement
    address and are excluded from eligible supply.
  - `ZBankRedemption`: the owner can pause new claims, enable direct/native modes, rotate the
    native settlement operator, and set a 1–30 day claim timeout. Direct zZEC redemption is
    atomic. Native ZEC is explicitly operator-settled: pending claims reserve zZEC, snapshot
    the registered t-address, and become cancellable if not settled by their deadline.
  - `InvestRouter`: `setAdapter`, `setFee` (hard-capped at 200 bps), `pause`/`unpause`.
    The adapter choice is the largest trust lever — a malicious adapter steals in-flight
    swaps. Adapter changes must be time-locked and announced.
  - `ZBNK`: no privileged functions; fixed supply, burn only.
- `PayoutRegistry.sol` is ownerless by design (self-service registry).

## Internal security review — 2026-09-07 (NOT an external audit)

An adversarial internal review pass was run over the full contract stack. Findings and
resolutions, all covered by regression tests:

1. **HIGH — first-depositor share inflation (`ZCredit.supply`).** Donating USDG directly to
   the pool could round later suppliers' shares to zero and let the first depositor capture
   their funds. **Fixed** with Morpho-style virtual shares/assets (1e6 offset); the attack is
   now a no-op (`test_share_inflation_attack_neutralized`).
2. **MEDIUM — revenue stranded outside treasury buckets.** Router fees and reserve sweeps
   arrive as plain transfers, which never entered `bucketOf` and were unspendable. **Fixed**
   with permissionless `bucketIdle(asset)` that splits idle balance per the configured bps;
   ZBNK is excluded (burn-only) (`test_plain_transfers_bucketable_via_bucketIdle`).
3. **MEDIUM — zZEC collateral vs ZEC oracle (peg risk).** A zZEC depeg would not be seen by
   the ZEC/USD feed. **Mitigated** with an onchain market-wide collateral cap (launch default
   5,000 zZEC, raised only by the multisig via `setCollateralCap`) — bounding maximum bad
   debt while the wrapper's custody model matures (`test_collateral_cap_enforced`). Full
   resolution (peg oracle/haircut) remains open below.
4. **MEDIUM — no L2 sequencer gate on price reads.** **Fixed**: both oracle adapters accept
   an optional Chainlink sequencer uptime feed and revert during outages and a 1-hour
   recovery grace period (`test_sequencer_down_blocks_pricing`). Wire the feed address the
   moment Chainlink publishes one for Robinhood Chain (none in the current catalog).

This review raises confidence; it does not replace the external audit below.

## Required audits

- `ZCredit.sol` — full audit, non-negotiable: it custodies collateral and lender funds.
- `InvestRouter.sol` + the chosen venue adapter, and `ZBankTreasury.sol` — now written, in scope.
- `ZBankRedemption.sol` + `PayoutRegistry.sol` — direct redemption custody, eligible-supply
  accounting, native-claim cancellation, operator settlement, and Pons-token behavior.
- The Pons-issued ZBNK token and deployed redemption mechanism before the website can drop
  the words Alpha and Pre-audit.
- **Do not claim "audited" anywhere until a report exists and is linked.**

## Required mainnet parameter decisions

1. Final LTV / liquidation threshold / bonus / reserve factor (risk modeling against ZEC
   volatility and chain liquidity).
2. Revenue allocation split (`REVENUE_ALLOCATION` — placeholder 50/30/20, `finalized: false`;
   validated to sum to 10000 bps).
3. ZINVEST / ZLOOP execution fee levels (currently null — displayed as "—", never invented).
4. Oracle provider, feed address, staleness window.
5. Supported Stock Token list and per-asset caps.
6. Whether ZBNK incentive emissions exist at launch (until configured, no incentive APY is
   displayed anywhere).

## Frontend safety invariants (already enforced)

- No fabricated numbers: absent data renders "—" or "Pending launch".
- Execution buttons are disabled with the blocking dependency named; no fake transactions.
- ZLOOP requires an explicit risk acknowledgment and states all five leverage risks inline.
- ZEARN does not imply instant withdrawal; liquidity dependence is stated on the panel.
- Supply APY (borrower-paid) is structurally separated from incentives in the UI.
- Protocol constants live only in `web/src/config/protocol.ts` / `web/src/config.ts`.

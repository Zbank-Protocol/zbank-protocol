# ZBANK — Launch Runbook

The ordered path from today's preview build to a live client and a launched token. Each item
names its owner surface (contract, config, or external) and its verification step. Pair this
with `SECURITY.md` (the risk register) — nothing below overrides it.

## Phase 0 — Decisions that block everything else

| # | Decision | Blocked products |
| --- | --- | --- |
| 0.1 | ~~ZEC/USD oracle provider~~ **RESOLVED**: Chainlink Data Streams ZEC/USD via the chain's live verifier proxy (`ZecUsdDataStreamFeed.sol`). Remaining: run a report relayer + monitoring | ZCREDIT, ZEARN, ZLOOP |
| 0.2 | Lending stack: the in-repo `ZCredit.sol` engine is built and tested — commission its audit, or fall back to an audited pattern (Aave v3 / Morpho Blue) if the audit timeline is unacceptable | ZCREDIT, ZEARN, ZLOOP |
| 0.3 | ~~ZEC representation + USDG addresses~~ **RESOLVED**: zZEC `0x0b151F…E402` (ZEAL, reserve-backed — custody risk documented in SECURITY.md) and USDG `0x5fc536…d168` (official). Remaining: accept or cap zZEC custody risk | everything |
| 0.4 | Final risk parameters (max LTV, liquidation threshold/bonus, reserve factor) via risk modeling | ZCREDIT family |
| 0.5 | Final revenue allocation (treasury / burn / reserve bps) | ZTREASURY, /token |
| 0.6 | ZINVEST / ZLOOP execution fee levels | ZINVEST, ZLOOP |

## Phase 1 — Token launch (ZBNK on Pons)

1. Launch ZBNK through the Pons factory (`web/src/config.ts` → `PONS.factory`).
2. Record from the launch transaction: token address, fee escrow, meme hook.
3. Set config: `TOKEN.address`, `PONS.feeEscrow`, `PONS.memeHook`.
4. Set `PROTOCOL_CONTRACTS.zbnk` in `web/src/config/protocol.ts` — the dashboard's ZBNK
   balance read activates by itself.
5. Publish the ZEC treasury t-address (`ZEC_RESERVE.address`) — the proof-of-reserve story
   starts the moment it is public.
6. Verify: token page shows the live address; explorer links resolve; ZTREASURY stops saying
   "Pending launch" for token supply figures once indexing is wired.

## Phase 2 — Credit market (the long pole)

1. Deploy the lending stack with the Phase 0.4 parameters — `script/Deploy.s.sol` deploys the
   full suite (token, treasury, oracle adapter, `ZCredit`, router) and refuses to run without
   the Phase 0 env inputs. Audit first: see SECURITY.md.
2. Wire the oracle (0.1) and verify staleness/zero-price handling on a fork test.
3. Set `PROTOCOL_CONTRACTS.creditMarket` and `ORACLES.zecUsd.address`; flip
   `ZCREDIT_RISK.finalized` only after the documented risk review.
4. Replace the internals of `useZCreditMarket` / `useZCreditPosition` with contract reads
   (the shapes already match; components don't change).
5. Liquidation dry run on testnet: open a position, push the oracle, verify a keeper can
   liquidate and the health meter tracked every band on the way down.
6. Flip `PRODUCT_STATUS.zcredit` and `.zearn` to `Live` — only after 1–5 are verified.

## Phase 3 — Invest router

1. Deploy the execution router (ZEC → USDG → Stock Tokens) against real route liquidity.
2. Set `PROTOCOL_CONTRACTS.investRouter` and the fee config (`FEES`).
3. Implement `useZInvestQuote` against the router's quoter; verify quotes vs. executions
   within slippage bounds on testnet.
4. Flip `PRODUCT_STATUS.zinvest` and `.zindex` to `Live`; ZLOOP to `Beta` once both engines
   hold, `Live` after the guided flow executes end-to-end in anger.

## Phase 4 — Treasury engine

1. Deploy revenue collection + allocation (0.5) and the burn path.
2. Set `PROTOCOL_CONTRACTS.treasury` / `.burn`; publish addresses on /treasury and /token.
3. Feed `useTreasuryMetrics` from chain data / an indexer; windows (24h/7d/30d) come from the
   indexer, never hand-entered.
4. Flip `PRODUCT_STATUS.ztreasury` to `Live`.

## Client launch gate (all must hold)

- [ ] Every `Live` status has a tested execution path behind it.
- [ ] No "—" remains on a Live surface where a real number belongs.
- [ ] SECURITY.md updated: audits linked (not claimed), admin keys documented, params final.
- [ ] The twelve launch-quality-bar actions (connect → borrow → repay → supply → withdraw →
      invest → index → loop → dashboard → treasury) each verified by a human on mainnet with
      small size.
- [ ] Disclaimers reviewed by counsel; "Proposed Redemption Model" language unchanged until
      the redemption contract exists.

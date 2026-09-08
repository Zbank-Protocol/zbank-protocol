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

1. **DEPLOYED:** `PonsFeeLiquidityManager`
   (`0x082B87D21A5F840De52F2c154aC4132E3C365295`). Its owner and LP NFT recipient are the
   protocol Safe. Treasury remains unset until the token-economics deployment.
2. Deploy `PonsFeeRouter` with `DeployPonsFeeRouter.s.sol`, owned by the protocol Safe and
   initially pointing at the deployed manager. The router is the permanent Pons fee recipient;
   manager replacements use its one-day onchain notice period.
3. Launch only through `LaunchZbnkPons.s.sol`. It pins launch config 0, official USDG, the
   reviewed economics digest, 1% Pons base fee + 2% ZBANK creator tax = **3% total trader fee**,
   Pons buyback disabled, and the deployed router as `creatorFeeRecipient`. Simulate without
   `--broadcast` first; any Pons economics change makes the script revert.
4. Record from the launch transaction: token address, curve, pair token, fee escrow, meme hook,
   creator-fee recipient, fee policy, and economics hash.
5. Set config: `TOKEN.address`, `PONS.feeEscrow`, `PONS.memeHook`, and the router address.
6. Set `PROTOCOL_CONTRACTS.zbnk` in `web/src/config/protocol.ts` — the dashboard's ZBNK
   balance read activates by itself.
7. Run `DeployTokenEconomics.s.sol` with the canonical token address. This deploys the
   pre-audit alpha treasury, payout registry, and dual-path redemption contracts with both
   redemption modes disabled.
8. Set the liquidity manager's treasury through the Safe. Its permissionless harvester routes
   50% of claimed Pons USDG creator fees into zZEC/USDG liquidity and sends 50% into treasury
   allocation.
9. Fund redemption with real zZEC, verify every recorded address, then explicitly enable the
   atomic zZEC path and/or operator-settled native ZEC path through the owner Safe.
10. Publish the ZEC treasury t-address (`ZEC_RESERVE.address`) — the proof-of-reserve story
   starts the moment it is public.
11. Verify: token page shows the live address; explorer links resolve; ZTREASURY stops saying
   "Pending launch" for token supply figures once indexing is wired.

## Phase 2 — Credit market (the long pole)

1. **DEPLOYED PRE-AUDIT BETA:** ZCREDIT and the Data Streams oracle are live with the
   disclosed development parameters and temporary 1-of-1 Safe.
2. **ACTIVE:** GitHub and Vercel keepers relay the oracle; verify staleness/zero-price
   handling continuously.
3. Keep `ZCREDIT_RISK.finalized` false until the external risk review, even while the public
   pre-audit beta remains available.
4. Replace the internals of `useZCreditMarket` / `useZCreditPosition` with contract reads
   (the shapes already match; components don't change).
5. Liquidation dry run on testnet: open a position, push the oracle, verify a keeper can
   liquidate and the health meter tracked every band on the way down.
6. Flip `PRODUCT_STATUS.zcredit` and the ZEC-backed ZEARN lane from `Beta` to `Live` only after
   audit and production-readiness review.
7. **LIVE THIRD-PARTY RAIL:** ZEARN's Diversified USDG lane deposits directly into Steakhouse
   USDG (`0xBeEff033F34C046626B8D0A041844C5d1A5409dd`) on Morpho V2. ZBANK never owns the
   shares. Keep `/api/v1/earn`, vault links, curator attribution, variable-rate language, and
   withdrawal-liquidity warnings visible; smoke-test deposit and full redemption after every
   vault or frontend change.

## Phase 3 — Invest router

Implementation is complete; activation is waiting on funded liquidity. Follow
`docs/zzec-liquidity-launch.md`.

1. Initialize and fund zZEC/USDG at the live oracle price through `/liquidity`, or use
   `SeedZzecUsdgPool.s.sol` for a protocol-owned seed. User-funded positions mint directly to
   each user's wallet; the protocol cannot withdraw them.
2. Run `DeployZecInvest.s.sol`; it deploys the approved-path Uniswap adapter and
   `InvestRouter` only after confirming that the pool has both assets.
3. Run `INVEST_ROUTER=0x... npm run check:zec-route -- --require-live`, then complete the
   small/medium/launch-limit mainnet dry runs and external review.
4. Set `UNISWAP.zzecUsdgPool`, `PROTOCOL_CONTRACTS.investRouter`, and the finalized fee config.
   The zZEC input changes from Coming soon to Live from those central values.

## Phase 4 — Treasury engine

1. Deploy revenue collection + allocation (0.5), Pons-compatible retirement, payout registry,
   and redemption with `DeployTokenEconomics.s.sol`.
2. Set `PROTOCOL_CONTRACTS.treasury`, `.redemption`, `.payoutRegistry`, and `.zbnk`; publish
   addresses on /treasury and /token.
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

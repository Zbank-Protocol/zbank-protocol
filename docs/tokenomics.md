# ZBNK Tokenomics — the two-force model

> **Status: proposed.** The redemption model, revenue allocation, and token utility described
> here remain subject to final technical, legal, and governance implementation. No redemption
> contract is deployed and no redemption rights currently exist. Every figure in this document
> is an example for illustration, never live protocol data or a forecast.

## The model in one line

**MORE ZEC. FEWER ZBNK.**

ZBANK is designed around two forces: accumulating ZEC and reducing ZBNK supply. Protocol
revenue can acquire ZEC for the treasury and buy ZBNK for permanent burn. Under the proposed
redemption model, eligible ZBNK can be redeemed against its proportional share of the
redeemable ZEC treasury.

## How revenue flows

Every ZBANK product feeds the same engine:

```
ZINVEST · ZINDEX · ZCREDIT · ZVAULT · ZLAUNCH · ZPAY
                       │
                       ▼
              PROTOCOL REVENUE
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   A. ZEC ACQUISITION        B. ZBNK BUYBACK
   Revenue purchases ZEC.    Revenue purchases ZBNK
   ZEC enters the ZBANK      from the market.
   Treasury.                 Purchased ZBNK is
                             permanently burned.
          │                         │
          ▼                         ▼
    ZEC TREASURY ↑            ZBNK SUPPLY ↓
          └────────────┬────────────┘
                       ▼
             ZEC PER ELIGIBLE ZBNK ↑
                       ▼
           STRONGER ZBANK ECOSYSTEM
                       ▼
              MORE PRODUCT USAGE
                       ▼
                    (repeat)
```

Both forces move the same ratio, which is the central metric of the whole system:

```
ZEC PER ZBNK = REDEEMABLE ZEC TREASURY / ELIGIBLE ZBNK SUPPLY
```

Nothing about this loop promises or guarantees any token price outcome.

## The proposed redemption model

The intent is that eligible ZBNK represents a **proposed proportional redemption claim**
against the **redeemable** ZEC treasury:

```
BURN ZBNK  →  RECEIVE PROPORTIONAL ZEC  →  ZBNK IS REMOVED FROM SUPPLY
```

Redemption would permanently remove redeemed ZBNK from eligible supply and transfer the
corresponding amount of redeemable treasury ZEC according to the protocol's redemption rules.

Until the contracts and legal structure are finalized, every surface that shows this mechanism
is labelled **"Proposed Redemption Model"**. The website (and this document) must always
distinguish between live functionality, proposed tokenomics, example calculations, and future
products.

## Worked example (example values only)

| | Redeemable treasury | Eligible supply | ZEC per ZBNK |
|---|---|---|---|
| Current | 168,500 ZEC | 100,000,000 ZBNK | 0.001685 |
| 10,000,000 ZBNK burned | 168,500 ZEC | 90,000,000 ZBNK | 0.001872 (+11.1%) |
| Treasury grows to 200,000 ZEC | 200,000 ZEC | 90,000,000 ZBNK | 0.002222 |

The lesson the site teaches interactively (see `TreasuryBackingCalculator`):

**TREASURY ↑ + SUPPLY ↓ = MORE ZEC PER ZBNK**

A redemption at the first line's rate: burning 100,000 ZBNK at 0.001685 ZEC/ZBNK would receive
168.50 ZEC, and those 100,000 ZBNK would leave eligible supply forever.

## Treasury asset value vs. market price

The dashboard also compares the token's market price against what the redeemable treasury
represents per token:

```
TREASURY ASSET VALUE PER ZBNK = (REDEEMABLE ZEC × ZEC MARKET PRICE) / ELIGIBLE ZBNK SUPPLY

PREMIUM / DISCOUNT = (ZBNK MARKET PRICE − TREASURY ASSET VALUE PER ZBNK)
                     / TREASURY ASSET VALUE PER ZBNK
```

This resembles a closed-end fund or treasury-company dashboard. We deliberately do **not**
call this figure "NAV" unless the final accounting/legal structure supports that terminology —
the site uses "Treasury Asset Value" / "Treasury Assets per ZBNK".

## Treasury accounting: redeemable vs. strategic

Not every treasury asset necessarily backs redemption. The treasury is therefore split:

- **Total ZEC treasury** — everything the protocol holds. The 1% mission counts this.
- **Redeemable ZEC** — the portion backing the proposed redemption model.
- **Strategic / reserved ZEC** — operations and strategy; explicitly not redemption backing.

**All backing and redemption math uses redeemable ZEC only.** Total treasury is a mission
figure, never a backing figure. The frontend enforces this structurally — see
`web/src/lib/economics.ts`:

```ts
treasury: { totalZec, redeemableZec, strategicZec, currentZecPrice }
token:    { totalSupply, circulatingSupply, eligibleSupply, burnedSupply, currentPrice }
metrics:  { zecPerEligibleZbnk, treasuryAssetValuePerZbnk, premiumDiscount, missionProgress }
```

`deriveMetrics()` computes every headline number from raw state; a missing input propagates as
`null` and renders as "—" or "Pending launch" — never as zero, never as an invented value.

## The 1% mission

**"1% isn't a slogan. It's the target."** The long-term mission is to acquire 1% of
circulating ZEC (≈168,500 ZEC at pre-launch estimates; the current demo figure shows
12,481.37 ZEC owned, 7.4% progress, ~156,018 ZEC remaining).

The mission now has direct relevance to the token model: as the treasury accumulates ZEC,
treasury assets per eligible ZBNK increase, all else equal — and buybacks can simultaneously
reduce the number of ZBNK sharing the treasury. Hence the site's recurring motif:

**MORE ZEC ÷ FEWER ZBNK = MORE ZEC PER ZBNK**

## Transparency commitments

The Protocol section will expose, as each becomes real (rendering "Pending launch" until then,
never an invented address or transaction):

ZEC Treasury Address · ZBNK Contract · Redeemable Treasury · Strategic Treasury ·
Eligible Supply · Burn Address · Cumulative Burns · Treasury Purchases · Protocol Revenue ·
Revenue Allocation · Redemption Contract · Audit Status

## Language policy

Because this model contemplates token holders having redemption rights against treasury
assets, wording is constrained until legal counsel confirms the structure:

**Never write:** "ZBNK is a share of ZBANK", "ZBNK holders own ZBANK", "equity", "stock",
"dividend", "guaranteed backing", "guaranteed floor", "guaranteed returns", "risk-free",
"ZBNK can only go up".

**Use instead:** "proposed proportional redemption claim", "redeemable treasury assets",
"treasury assets per eligible ZBNK", "proposed redemption mechanism", "protocol-funded
buyback and burn".

Every page carrying the model also carries the disclaimer: *"The redemption model, revenue
allocation, and token utility remain subject to final technical, legal, and governance
implementation."*

## Where this lives in the code

- `web/src/lib/economics.ts` — types, metric derivation, formatting. The single source of
  backing math.
- `web/src/data/site.ts` — all copy, the example model (`EXAMPLE_MODEL`), live state
  placeholders (`TREASURY_STATE`, `TOKEN_STATE`), and the disclaimer string.
- `web/src/components/TwoForces.tsx` — the "Two forces. One token." diagram.
- `web/src/components/TreasuryBackingCalculator.tsx` — the interactive model simulation.
- `web/src/components/RedeemPanel.tsx` — the proposed redemption interface concept.
- `web/src/components/Equation.tsx` — the MORE ZEC ÷ FEWER ZBNK motif.
- `web/src/components/FlywheelDiagram.tsx` — the revenue loop with both branches and the
  convergence chain.

<p align="center">
  <img src="web/brand/zbank-banner-1b.png" alt="ZBANK — The Bank of Zcash" width="100%" />
</p>

<p align="center">
  <a href="https://zbank.world"><strong>Open ZBANK</strong></a>
  ·
  <a href="https://zbank.world/docs">Documentation</a>
  ·
  <a href="https://zbank.world/treasury">Transparency</a>
  ·
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="https://github.com/Zbank-Protocol/zbank-protocol/actions/workflows/ci.yml">
    <img src="https://github.com/Zbank-Protocol/zbank-protocol/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/Zbank-Protocol/zbank-protocol/actions/workflows/keeper.yml">
    <img src="https://github.com/Zbank-Protocol/zbank-protocol/actions/workflows/keeper.yml/badge.svg" alt="Keeper" />
  </a>
</p>

# Capital markets for Zcash

ZBANK is building a Zcash-native financial system on Robinhood Chain:

- **ZINVEST** — route USDG into transparent Stock Token portfolios.
- **ZINDEX** — prebuilt and custom portfolio strategies powered by ZINVEST.
- **ZCREDIT** — deposit zZEC collateral, borrow USDG, or supply USDG to earn borrower-paid interest.
- **ZEARN** — choose ZEC-backed ZCREDIT lending or direct, user-owned shares in the live
  third-party Steakhouse USDG Morpho V2 vault.
- **ZLOOP** — keep ZEC exposure, borrow USDG, and invest the borrowed capital.
- **ZLIQUIDITY** — fund zZEC/USDG directly and keep the Uniswap LP NFT.
- **ZTREASURY** — public protocol, reserve, retirement, and revenue-allocation reporting.

The long-term economic thesis is simple: **more ZEC, fewer ZBNK**. Product revenue is intended
to acquire ZEC and buy back and permanently retire ZBNK, subject to final technical, legal, and governance
implementation.

## Honest launch status

The web application and machine-readable APIs are live. USDG-funded ZINVEST routes execute
non-custodially through Uniswap v3. ZCREDIT, the ZEC-backed ZEARN lane, and ZLOOP are an
**unaudited mainnet beta**. ZEARN's diversified lane interacts directly with the independent
Steakhouse USDG Morpho V2 vault; ZBANK does not custody those positions or control that vault.

ZBNK, the treasury, redemption, and direct zZEC-funded ZINVEST are not live. The treasury and
dual-path redemption contracts are implemented as pre-audit alpha code, but deployment waits
for the canonical Pons ZBNK address. The interface renders unavailable values as
`Pending launch` and does not simulate transactions.

The user-owned `/liquidity` flow and Pons creator-fee liquidity manager are implemented. The
zZEC/USDG pool is not initialized yet. A permanent Safe-controlled fee router is implemented so
Pons can point at one address while manager implementations remain replaceable after a one-day
notice. ZBNK creator-fee harvesting activates after the router, token, pool, and treasury are
deployed and linked.

Deployed Robinhood Chain contracts:

- ZCREDIT: [`0x77ccb77d1fd337b7027b3482ca365db57d92151e`](https://robinhoodchain.blockscout.com/address/0x77ccb77d1fd337b7027b3482ca365db57d92151e)
- ZEC/USD feed: [`0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5`](https://robinhoodchain.blockscout.com/address/0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5)
- Pons fee liquidity manager: [`0x082B87D21A5F840De52F2c154aC4132E3C365295`](https://robinhoodchain.blockscout.com/address/0x082B87D21A5F840De52F2c154aC4132E3C365295)
- Pons fee router: not deployed — must deploy before ZBNK and use it as the creator-fee recipient
- Temporary protocol Safe: [`0x31837999D9E463B2EB4327CEb4BD7CCa2a500480`](https://robinhoodchain.blockscout.com/address/0x31837999D9E463B2EB4327CEb4BD7CCa2a500480)

Read [`SECURITY.md`](SECURITY.md) before integrating or depositing funds.
Token-economics integrators should also read
[`docs/redemption-alpha.md`](docs/redemption-alpha.md). The verified external-protocol backlog
lives in [`docs/ecosystem-integrations.md`](docs/ecosystem-integrations.md).

## Repository

- `src/` — protocol contracts
- `test/` — unit and mainnet-fork tests
- `script/` — deployment and administration scripts
- `bots/` — oracle relay and liquidation keeper
- `web/` — Vite/React application and serverless agent APIs
- `docs/` — architecture, tokenomics, launch, and operations

## Verify locally

Requirements: Foundry and Node.js 22.

```bash
forge fmt --check
forge build
forge test

cd web
npm ci
npm run test:api
npm run lint
npm run build

cd ../bots
npm ci
npm test
```

## Public security review

Independent review is welcome. Start with the unresolved risks and audit scope in
[`SECURITY.md`](SECURITY.md), then reproduce findings against the test suite.

Do **not** publish an exploitable vulnerability in a public issue. Use GitHub's private
vulnerability reporting on the repository Security tab. Reports should include affected
commit and contract, impact, proof of concept, and a proposed remediation when possible.

No external audit has been completed. Passing tests and public source code do not mean the
contracts are risk-free.

## Agent access

- Protocol manifest: [`/api/v1/protocol`](https://zbank.world/api/v1/protocol)
- Live market data: [`/api/v1/market`](https://zbank.world/api/v1/market)
- Agent discovery: [`/.well-known/agent.json`](https://zbank.world/.well-known/agent.json)
- LLM context: [`/llms.txt`](https://zbank.world/llms.txt)

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
- **ZEARN** — a simplified lender interface for the ZCREDIT USDG pool.
- **ZLOOP** — keep ZEC exposure, borrow USDG, and invest the borrowed capital.
- **ZTREASURY** — public protocol, reserve, burn, and revenue-allocation reporting.

The long-term economic thesis is simple: **more ZEC, fewer ZBNK**. Product revenue is intended
to acquire ZEC and buy back and burn ZBNK, subject to final technical, legal, and governance
implementation.

## Honest launch status

The web application and machine-readable APIs are live. USDG-funded ZINVEST routes execute
non-custodially through Uniswap v3. ZCREDIT, ZEARN, and ZLOOP are an **unaudited mainnet beta**.

ZBNK, the treasury contract, proportional redemption, and direct zZEC-funded ZINVEST are not
live. The interface renders unavailable values as `Pending launch` and does not simulate
transactions.

Deployed Robinhood Chain contracts:

- ZCREDIT: [`0x77ccb77d1fd337b7027b3482ca365db57d92151e`](https://robinhoodchain.blockscout.com/address/0x77ccb77d1fd337b7027b3482ca365db57d92151e)
- ZEC/USD feed: [`0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5`](https://robinhoodchain.blockscout.com/address/0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5)
- Temporary protocol Safe: [`0x31837999D9E463B2EB4327CEb4BD7CCa2a500480`](https://robinhoodchain.blockscout.com/address/0x31837999D9E463B2EB4327CEb4BD7CCa2a500480)

Read [`SECURITY.md`](SECURITY.md) before integrating or depositing funds.

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

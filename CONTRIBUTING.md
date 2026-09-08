# Contributing to ZBANK

ZBANK welcomes focused pull requests, reproducible bug reports, documentation improvements,
and independent contract review.

## Before opening a pull request

1. Open or reference an issue for changes that affect protocol behavior.
2. Keep each pull request limited to one security or product concern.
3. Add regression tests for every contract or transaction-flow change.
4. Do not change deployed addresses, risk parameters, or launch-status labels without
   onchain evidence and an explicit rationale.
5. Never commit private keys, API credentials, wallet exports, or local environment files.

Run the same checks used by CI:

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

## Security findings

Do not open a public issue for a vulnerability that could put funds or operations at risk.
Use the repository Security tab and submit a private vulnerability report. Include the
affected commit, impact, proof of concept, and suggested remediation.

Public audit issues are reserved for non-exploitable hardening, documentation, and
defense-in-depth findings.

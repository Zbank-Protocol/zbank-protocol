/**
 * Domain availability check via RDAP.
 *
 * RDAP is the registry-authoritative successor to WHOIS: `rdap.org` bootstraps to the correct
 * registry for each TLD and answers 404 for an unregistered name, 200 for a registered one.
 * That is a real signal, unlike a DNS lookup — plenty of registered domains have no NS records
 * and would otherwise look free.
 *
 * Usage: node script/check-domains.mjs
 */

const CANDIDATES = [
  // The name the brief asks for first.
  "zbank.com",
  "zbank.io",
  "zbank.co",
  "zbank.xyz",
  "zbank.app",
  "zbank.finance",
  "zbank.cash",
  "zbank.money",
  "zbank.fi",
  "zbank.org",
  "zbank.net",
  "zbank.dev",

  // Near-misses that still read as the same brand.
  "zbankhq.com",
  "getzbank.com",
  "zbanking.com",
  "z-bank.com",
  "zbank.exchange",
  "zbank.capital",

  // The current name.
  "shielded.com",
  "shielded.io",
  "shielded.xyz",
  "shielded.finance",
  "shielded.cash",
  "shielded.money",
  "getshielded.com",
  "shieldedhq.com",

  // Concept: the reserve / the vault.
  "zvault.com",
  "zvault.io",
  "zvault.xyz",
  "zreserve.com",
  "zreserve.io",
  "zreserve.xyz",
  "zyield.com",
  "zyield.io",
  "zyield.xyz",

  // Concept: ZEC-forward.
  "zecbank.com",
  "zecbank.io",
  "zecvault.com",
  "zecvault.io",
  "zecyield.com",
  "zecflow.com",
  "zecreserve.com",

  // Concept: the shielding act itself.
  "shieldpool.com",
  "shieldpool.io",
  "shieldedpool.com",
  "shieldedpool.io",
  "shieldedpool.xyz",
  "redacted.finance",
  "thereserve.cash",

  // Short and abstract, the register a fintech actually uses.
  "zephyrbank.com",
  "zeta.cash",
  "zenith.cash",
  "zed.finance",
  "zbx.io",
  "zbnk.com",
  "zbnk.io",
  "zbnk.xyz",
];

/**
 * TLDs missing from the IANA bootstrap, or whose listed server does not answer.
 *
 * `.io` in particular publishes no bootstrap entry, so without this every `.io` candidate comes
 * back "unknown" — which is indistinguishable from available and the easy way to talk yourself
 * into a name that is already gone.
 */
const TLD_OVERRIDES = {
  io: "https://rdap.identitydigital.services/rdap",
  sh: "https://rdap.identitydigital.services/rdap",
  ac: "https://rdap.identitydigital.services/rdap",
  co: "https://rdap.nic.co",
  ai: "https://rdap.identitydigital.services/rdap",
};

const CONCURRENCY = 6;

const HEADERS = {
  Accept: "application/rdap+json",
  // Registries reject unidentified clients; rdap.org 403s every request without this.
  "User-Agent": "domain-availability-check/1.0",
};

/**
 * IANA publishes the authoritative TLD-to-RDAP-server map. Querying each registry directly is
 * more reliable than going through an aggregator, which rate-limits and can refuse outright.
 */
async function loadBootstrap() {
  const response = await fetch("https://data.iana.org/rdap/dns.json", {
    headers: HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`bootstrap failed: HTTP ${response.status}`);

  const data = await response.json();
  const map = new Map();
  for (const [tlds, servers] of data.services) {
    for (const tld of tlds) map.set(tld, servers[0].replace(/\/$/, ""));
  }
  return map;
}

const bootstrap = await loadBootstrap();

/** One RDAP lookup against the registry that actually owns the TLD, with retries. */
async function check(domain, attempt = 0) {
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  const base = bootstrap.get(tld) ?? TLD_OVERRIDES[tld];
  if (!base) return { domain, status: "unknown", detail: "no RDAP service for TLD" };

  try {
    const response = await fetch(`${base}/domain/${domain}`, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status === 404) return { domain, status: "available" };
    if (response.status === 200) {
      const body = await response.json().catch(() => null);
      // Registries report pending-delete and similar via status codes worth surfacing.
      const flags = Array.isArray(body?.status) ? body.status.join(", ") : "";
      return { domain, status: "taken", detail: flags };
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      return check(domain, attempt + 1);
    }

    // Some TLDs have no RDAP service at all; say so rather than implying availability.
    return { domain, status: "unknown", detail: `HTTP ${response.status}` };
  } catch (error) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
      return check(domain, attempt + 1);
    }
    return { domain, status: "unknown", detail: error.message };
  }
}

// Domains can be passed as arguments for a targeted pass, e.g. `node script/check-domains.mjs zbank.io`.
const queue = process.argv.length > 2 ? process.argv.slice(2) : [...CANDIDATES];
const results = [];

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const domain = queue.shift();
      results.push(await check(domain));
    }
  }),
);

const order = { available: 0, unknown: 1, taken: 2 };
results.sort((a, b) => order[a.status] - order[b.status] || a.domain.localeCompare(b.domain));

for (const group of ["available", "unknown", "taken"]) {
  const rows = results.filter((r) => r.status === group);
  if (!rows.length) continue;
  console.log(`\n=== ${group.toUpperCase()} (${rows.length}) ===`);
  for (const row of rows) {
    console.log(`${row.domain.padEnd(24)} ${row.detail ?? ""}`.trimEnd());
  }
}

#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
MARKET="${MARKET_ADDRESS:-0x77ccb77d1fd337b7027b3482ca365db57d92151e}"
ORACLE="${ORACLE_ADDRESS:-0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5}"

read_uint() {
  cast call "$1" "$2" --rpc-url "$RPC_URL" | awk '{print $1}'
}

assert_eq() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "config drift: $label expected=$expected actual=$actual" >&2
    exit 1
  fi
  echo "ok: $label=$actual"
}

assert_eq "maxLtvBps" "$(read_uint "$MARKET" 'maxLtvBps()(uint16)')" "5000"
assert_eq "liqThresholdBps" "$(read_uint "$MARKET" 'liqThresholdBps()(uint16)')" "7000"
assert_eq "liqBonusBps" "$(read_uint "$MARKET" 'liqBonusBps()(uint16)')" "800"
assert_eq "reserveFactorBps" "$(read_uint "$MARKET" 'reserveFactorBps()(uint16)')" "1000"
assert_eq "collateralCap" "$(read_uint "$MARKET" 'collateralCap()(uint256)')" "500000000000"
assert_eq "oracleMaxAge" "$(read_uint "$ORACLE" 'maxAge()(uint32)')" "1800"

grep -q 'maxLtvBps: 5000' web/src/config/protocol.ts
grep -q 'liquidationThresholdBps: 7000' web/src/config/protocol.ts
grep -q 'liquidationBonusBps: 800' web/src/config/protocol.ts
grep -q 'reserveFactorBps: 1000' web/src/config/protocol.ts

echo "deployed market and frontend mirror agree"

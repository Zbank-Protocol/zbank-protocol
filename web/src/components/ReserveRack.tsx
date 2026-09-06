import { SWAP_ROUTES, ZEC_RESERVE } from "../config";
import type { TreasuryState } from "../lib/chain";

/** A dash, not a zero. An unknown value must not read as a measured one. */
function figure(value: number | null, unit: string, digits = 4) {
  if (value === null) return { text: "—", pending: true };
  return { text: `${value.toFixed(digits)} ${unit}`, pending: false };
}

export function ReserveRack({ state }: { state: TreasuryState }) {
  const reserve = figure(state.reserveZec, "ZEC");
  const claimable = figure(state.claimable, "ETH");
  const registered =
    state.registered === null
      ? { text: "—", pending: true }
      : { text: state.registered.toLocaleString(), pending: false };

  return (
    <>
      <div className="rack">
        <div className="rack__row">
          <span className="rack__name">
            ZEC in reserve
            <span className="rack__note">
              {ZEC_RESERVE.address
                ? "Read from a public Zcash explorer, not from us"
                : "Reserve address published at launch"}
            </span>
          </span>
          <span className="rack__val" data-pending={reserve.pending}>
            {reserve.text}
          </span>
        </div>

        <div className="rack__row">
          <span className="rack__name">
            Fees awaiting conversion
            <span className="rack__note">Credited to the Pons escrow, not yet swapped</span>
          </span>
          <span className="rack__val" data-pending={claimable.pending}>
            {claimable.text}
          </span>
        </div>

        <div className="rack__row">
          <span className="rack__name">
            Holders registered
            <span className="rack__note">Have a validated Zcash payout address on file</span>
          </span>
          <span className="rack__val" data-pending={registered.pending}>
            {registered.text}
          </span>
        </div>

        <div className="rack__meter" aria-hidden="true">
          <span style={{ width: `calc(var(--reserve-fill) * 100%)` }} />
        </div>
      </div>

      {ZEC_RESERVE.address ? (
        <p style={{ marginTop: "1.2rem" }}>
          <a
            className="btn btn--ghost"
            href={`${ZEC_RESERVE.explorerBase}${ZEC_RESERVE.address}`}
            target="_blank"
            rel="noreferrer"
          >
            Audit the reserve
          </a>
        </p>
      ) : null}

      <p className="t-body sec__p sec__p--quiet" style={{ marginTop: "1.6rem" }}>
        Conversion routes: {SWAP_ROUTES.map((route) => route.name).join(", ")}. All settle native
        ZEC to transparent addresses; none require wrapping.
      </p>
    </>
  );
}

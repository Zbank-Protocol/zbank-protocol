import { useEffect, useRef, useState } from "react";
import { ShieldedPoolCanvas } from "./canvas/shieldedPool";
import { useDescent } from "./hooks/useDescent";
import { readTreasuryState, type TreasuryState } from "./lib/chain";
import { CHAIN, TOKEN } from "./config";
import { Boot } from "./components/Boot";
import { Topbar } from "./components/Topbar";
import { Telemetry } from "./components/Telemetry";
import { Station } from "./components/Station";
import { MechanismLog } from "./components/MechanismLog";
import { ReserveRack } from "./components/ReserveRack";
import { RegisterPayout } from "./components/RegisterPayout";

export default function App() {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ShieldedPoolCanvas | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<TreasuryState>({
    claimable: null,
    pending: null,
    registered: null,
    reserveZec: null,
  });

  const descent = useDescent(engineRef);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const engine = new ShieldedPoolCanvas(el);
    engineRef.current = engine;
    engine.start();
    setReady(true);

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Poll live state. Slow interval: these numbers move with sweeps, not with blocks.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await readTreasuryState();
      if (!cancelled) setState(next);
    };

    void load();
    const id = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#mechanism">
        Skip to how it works
      </a>

      <canvas ref={canvasElRef} className="pool-canvas" data-ready={ready} aria-hidden="true" />

      <div className="overlay">
        <div className="scrim" />
        <Topbar stage={descent.stage} />
        <Telemetry stage={descent.stage} state={state} />
      </div>

      <Boot />

      <main className="scroll-track">
        {/* ---- Station 00: the transparent ledger ---- */}
        <section className="sec">
          <div className="sec__inner">
            <Station index={0} label="Transparent" />
            <h1 className="t-statement sec__h sec__h--hero">
              Every trade you make
              <br />
              is on the record.
            </h1>
            <p className="t-body sec__p">
              {TOKEN.symbol} trades in a public pool on {CHAIN.name}. Size, timing, wallet — all of
              it is permanent and searchable by anyone, forever. That is the deal you accept on a
              transparent chain.
            </p>
            <p className="t-body sec__p sec__p--quiet">
              The fees those trades generate do not have to be.
            </p>
          </div>
          <div className="cue" aria-hidden="true">
            <span className="t-label">Descend</span>
            <span className="cue__line" />
          </div>
        </section>

        {/* ---- Station 01: the claim ---- */}
        <section className="sec" id="mechanism">
          <div className="sec__inner">
            <Station index={1} label="Diverting" />
            <h2 className="t-statement sec__h">
              The fee leaves the
              <br />
              ledger as Zcash.
            </h2>
            <p className="t-body sec__p">
              Trading fees on {TOKEN.symbol} are routed out of the pool, converted to native ZEC,
              and held in a reserve you can audit. Holders claim their share to their own Zcash
              address.
            </p>
            <p className="t-body sec__p sec__p--quiet">
              Nothing about this is custodial by preference. It is custodial by geography: Zcash is
              a different chain, and it cannot be reached from a smart contract.
            </p>
          </div>
        </section>

        {/* ---- Station 02: the mechanism, stated plainly ---- */}
        <section className="sec">
          <div className="sec__inner">
            <Station index={2} label="Mechanism" />
            <h2 className="t-statement sec__h">No magic. Five steps.</h2>
            <MechanismLog />
          </div>
        </section>

        {/* ---- Station 03: the reserve ---- */}
        <section className="sec">
          <div className="sec__inner">
            <Station index={3} label="Reserve" />
            <h2 className="t-statement sec__h">
              Verify it without
              <br />
              trusting us.
            </h2>
            <p className="t-body sec__p">
              The reserve is a <em>transparent</em> Zcash address, deliberately. A shielded reserve
              would be private from you too. Publishing it means the balance is confirmable on any
              block explorer, by anyone, at any time.
            </p>
            <ReserveRack state={state} />
          </div>
        </section>

        {/* ---- Station 04: definition ---- */}
        <section className="sec">
          <div className="sec__inner">
            <Station index={4} label="Shielded" />
            <div className="define">
              <div className="define__word">
                <span className="define__term t-serif">shielded</span>
                <span className="define__pron t-mono">/ˈʃiːldɪd/</span>
              </div>
              <span className="define__pos">adjective</span>
              <p className="t-body define__body">
                Of a Zcash transaction: encrypted such that amount, sender and recipient are proven
                valid without being revealed. The ledger still verifies. It simply stops reporting.
              </p>
            </div>
            <p className="t-body sec__p" style={{ marginTop: "2rem" }}>
              Payouts settle to transparent addresses, because that is what the swap routes and
              Robinhood's own withdrawals support. Shielding after receipt is yours to do, in a
              wallet we never touch.
            </p>
          </div>
        </section>

        {/* ---- Station 05: register ---- */}
        <section className="sec">
          <div className="sec__inner">
            <Station index={5} label="Claim" />
            <h2 className="t-statement sec__h">Tell us where to send it.</h2>
            <p className="t-body sec__p">
              Your {CHAIN.name} address says nothing about where your ZEC should go. Register a
              Zcash address once and it is checked on-chain before it is stored — checksum included,
              so a typo is rejected here rather than swallowing a payout.
            </p>
            <RegisterPayout />
          </div>
        </section>

        {/* ---- Station 06: the honest endnote ---- */}
        <section className="sec">
          <div className="sec__inner">
            <Station index={6} label="Terms" />
            <h2 className="t-statement sec__h">What this is not.</h2>

            <div className="endnote">
              <div className="endnote__cols">
                <div className="endnote__col">
                  <span className="t-label">Not a yield product</span>
                  <p>
                    Distributions depend entirely on trading volume. Volume can be zero. There is no
                    rate, no floor, and nothing accrues when nobody trades.
                  </p>
                </div>
                <div className="endnote__col">
                  <span className="t-label">Not issued by Robinhood</span>
                  <p>
                    {CHAIN.name} is a permissionless network. Deploying on it implies no
                    relationship with, endorsement by, or affiliation with Robinhood.
                  </p>
                </div>
                <div className="endnote__col">
                  <span className="t-label">Not a locked mechanism</span>
                  <p>
                    The Pons fee split is fixed at launch and cannot be raised. Where those fees are
                    sent can be changed by whoever controls the recipient.
                  </p>
                </div>
                <div className="endnote__col">
                  <span className="t-label">Not custody-free</span>
                  <p>
                    Converting to ZEC requires bridging and swapping off this chain. Between the fee
                    and the payout, funds are handled by a process, not a contract.
                  </p>
                </div>
              </div>

              <p className="endnote__risk">
                A token that pays holders a share of trading revenue may be treated as a security in
                your jurisdiction. This page is not an offer, and nothing here is investment or
                legal advice. Assume you can lose everything you put in.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

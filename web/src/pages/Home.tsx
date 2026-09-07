import { Link } from "react-router-dom";
import { Section } from "../components/Section";
import { Rise } from "../components/Rise";
import { HeroPanel } from "../components/HeroPanel";
import { LiveStrip } from "../components/LiveStrip";
import { TreasuryTracker } from "../components/TreasuryTracker";
import { ProductCard, ProductIcon } from "../components/ProductCard";
import { RoadmapStage } from "../components/RoadmapStage";
import { ProtocolLink } from "../components/ProtocolLink";
import { TwoForces } from "../components/TwoForces";
import { Equation } from "../components/Equation";
import { Logo } from "../components/Logo";
import {
  HERO,
  HERO_THESIS,
  ACTIONS,
  ZLOOP_FEATURE,
  MISSION,
  TREASURY,
  PRODUCTS,
  LATER_PRODUCTS,
  TOKENOMICS,
  ROADMAP,
  PROTOCOL_ITEMS,
  INDEPENDENCE_NOTICE,
  RISKS,
} from "../data/site";
import { BRAND, CHAIN } from "../config";

/**
 * The homepage: the launch products, the three primitives, and the economic engine — over the
 * particle field. Product functionality lives on the application routes; this page's job is
 * that a visitor understands ZBANK in ten seconds and knows where to click.
 */
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#actions">
        Skip to content
      </a>

      {/* The ledger field runs behind this page (and every page) from the app shell. */}
      <main>
        {/* ================================ 01 · Hero ================================ */}
        <section className="hero" data-sec="01">
          <div className="container hero__grid">
            <Rise className="hero__copy">
              <p className="hero__kicker">{HERO.support}</p>
              <h1 className="hero__title">
                {HERO.headline.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h1>
              <p className="hero__lede">{HERO.copy}</p>
              <div className="hero__actions">
                <Link className="btn btn--gold" to={HERO.primaryCta.href}>
                  {HERO.primaryCta.label}
                </Link>
                <Link className="btn btn--line" to={HERO.secondaryCta.href}>
                  {HERO.secondaryCta.label}
                </Link>
              </div>
              <Link className="hero__learn" to="/start">
                New here? Take the seven-chapter tour →
              </Link>
            </Rise>

            <Rise className="hero__visual" delay={0.12}>
              <HeroPanel />
            </Rise>
          </div>

          <Rise delay={0.2}>
            <div className="container">
              <LiveStrip />

              <div className="thesis">
                <div className="thesis__index" aria-hidden="true">
                  <span>THE ZBANK MANDATE</span>
                  <span>01 / 01</span>
                </div>
                <div className="thesis__body">
                  <p className="thesis__lines">
                    {HERO_THESIS.lines.map((line) => (
                      <span className="thesis__line" key={line}>
                        {line}
                      </span>
                    ))}
                  </p>
                  <p className="thesis__support">{HERO_THESIS.support}</p>
                </div>
              </div>
            </div>
          </Rise>
        </section>

        {/* ========================= 02 · What can your ZEC do ========================= */}
        <Section
          no="02"
          kicker="The Bank"
          id="actions"
          title={["What can your ZEC do?"]}
          lede="Three moves. Your ZEC stays yours through all of them — that is the point of a bank."
        >
          <div className="actions">
            {ACTIONS.map((a, i) => (
              <Rise key={a.name} delay={i * 0.07}>
                <Link className="action" to={a.to}>
                  <span className="action__top">
                    <span className="action__icon">
                      <ProductIcon
                        name={a.name === "Invest" ? "ZLOOP" : a.name === "Borrow" ? "ZCREDIT" : "ZEARN"}
                      />
                    </span>
                    <span className="action__no">0{i + 1}</span>
                  </span>
                  <span className="action__name">{a.name}</span>
                  <span className="action__copy">{a.copy}</span>
                  <span className="action__detail">{a.detail}</span>
                  <span className="action__foot">
                    <span>
                      {a.name === "Invest"
                        ? "Open ZLOOP"
                        : a.name === "Borrow"
                          ? "Open ZCREDIT"
                          : "Open ZEARN"}
                    </span>
                    <span className="action__arrow" aria-hidden="true">↗</span>
                  </span>
                </Link>
              </Rise>
            ))}
          </div>
        </Section>

        {/* ==================== 03 · ZLOOP — the flagship ZEC-native flow ==================== */}
        <Section no="03" kicker="ZLOOP" id="zloop" title={[...ZLOOP_FEATURE.headline]} lede={ZLOOP_FEATURE.copy}>
          <Rise delay={0.08}>
            <div className="loop-feature">
              <div className="flow-rail" role="img" aria-label="ZLOOP flow">
                {["Deposit ZEC", "Borrow USDG", "Choose strategy", "Invest via ZINVEST"].map(
                  (step, i) => (
                    <span className="flow-rail__part" key={step}>
                      {i > 0 ? <span className="flywheel__chain-arrow">→</span> : null}
                      <span className="flywheel__chain-node">{step}</span>
                    </span>
                  ),
                )}
              </div>
              <div className="loop-feature__foot">
                <p className="t-note">{ZLOOP_FEATURE.risk}</p>
                <Link className="btn btn--gold" to={ZLOOP_FEATURE.cta.to}>
                  {ZLOOP_FEATURE.cta.label}
                </Link>
              </div>
            </div>
          </Rise>
        </Section>

        {/* ============================== 04 · Products ============================== */}
        <Section
          no="04"
          kicker="Launch Suite"
          id="products"
          title={["One ZEC balance.", "An entire financial system."]}
          lede="Six products, three shared engines. Nothing is labelled live until its execution path is."
        >
          <div className="products">
            {PRODUCTS.map((p, i) => (
              <Rise key={p.name} delay={(i % 3) * 0.07}>
                <ProductCard product={p} />
              </Rise>
            ))}
          </div>
          <p className="t-note container__note">
            Beyond launch: {LATER_PRODUCTS.join(" · ")} — planned, in that order.
          </p>
        </Section>

        {/* ==================== 05 · Mission & Treasury (one machine) ==================== */}
        <Section
          no="05"
          kicker="The 1% Mission"
          id="mission"
          title={[...MISSION.headline]}
          lede={MISSION.copy}
        >
          <Rise delay={0.08}>
            <TreasuryTracker />
          </Rise>
          <Rise delay={0.12}>
            <div className="why">
              <div className="why__copy">
                <h3 className="why__q">{MISSION.why.q}</h3>
                <p>{MISSION.why.copy}</p>
              </div>
              <Equation />
            </div>
          </Rise>
          <Rise delay={0.14}>
            <div className="board">
              <div className="board__foot">
                <div className="board__address">
                  <span className="metric__label">Treasury address</span>
                  <span className="protocol__value" data-pending={TREASURY.address === null}>
                    {TREASURY.address ?? "Publishes at token launch"}
                  </span>
                </div>
                <Link className="btn btn--line" to="/treasury">
                  Open ZTREASURY
                </Link>
              </div>
              <p className="t-note">{TREASURY.policy}</p>
              <p className="t-note">{TREASURY.accountingNote}</p>
            </div>
          </Rise>
        </Section>

        {/* ============================== 06 · The Token ============================== */}
        <Section
          no="06"
          kicker="The Token"
          id="token"
          title={[...TOKENOMICS.headline]}
          lede={TOKENOMICS.lede}
        >
          <Rise delay={0.08}>
            <TwoForces />
          </Rise>
          <Rise delay={0.1}>
            <div className="token-cta">
              <Equation />
              <Link className="btn btn--line" to="/token">
                Explore ZBNK economics
              </Link>
            </div>
          </Rise>
        </Section>

        {/* ============================== 07 · Roadmap ============================== */}
        <Section no="07" kicker="Roadmap" id="roadmap" title={["What shipped.", "What comes next."]}>
          <div className="roadmap">
            {ROADMAP.map((stage, i) => (
              <Rise key={stage.phase} delay={i * 0.05}>
                <RoadmapStage stage={stage} />
              </Rise>
            ))}
          </div>
        </Section>

        {/* ======================== 08 · Protocol / Transparency ======================== */}
        <Section no="08" kicker="Protocol" id="protocol" title={["Verify the system."]}>
          <div className="protocol-grid">
            {PROTOCOL_ITEMS.map((item, i) => (
              <Rise key={item.label} delay={(i % 4) * 0.05}>
                <ProtocolLink item={item} />
              </Rise>
            ))}
          </div>
          <p className="t-note container__note">{INDEPENDENCE_NOTICE}</p>
        </Section>
      </main>

      {/* ============================ 09 · Disclaimer / Footer ============================ */}
      <footer className="footer" data-sec="09">
        <div className="container">
          <div className="footer__top">
            <Logo />
            <span className="footer__net">
              {CHAIN.name} · {BRAND.domain} ·{" "}
              <a
                href="https://x.com/zbankworld"
                target="_blank"
                rel="noreferrer"
                className="footer__x"
              >
                @zbankworld
              </a>
            </span>
          </div>
          <ul className="footer__risks">
            {RISKS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="footer__legal">
            © {new Date().getFullYear()} {BRAND.name}. Nothing on this page is an offer, a
            solicitation, or investment advice.
          </p>
        </div>
      </footer>
    </>
  );
}

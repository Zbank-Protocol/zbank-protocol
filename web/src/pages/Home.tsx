import { Link } from "react-router-dom";
import { Section } from "../components/Section";
import { Rise } from "../components/Rise";
import { MetricCard } from "../components/MetricCard";
import { HeroPanel } from "../components/HeroPanel";
import { TreasuryTracker } from "../components/TreasuryTracker";
import { ProductCard } from "../components/ProductCard";
import { FlywheelDiagram } from "../components/FlywheelDiagram";
import { RoadmapStage } from "../components/RoadmapStage";
import { ProtocolLink } from "../components/ProtocolLink";
import { TwoForces } from "../components/TwoForces";
import { Equation } from "../components/Equation";
import { Logo } from "../components/Logo";
import {
  HERO,
  HERO_METRICS,
  HERO_THESIS,
  ACTIONS,
  ZLOOP_FEATURE,
  MISSION,
  TREASURY,
  PRODUCTS,
  LATER_PRODUCTS,
  FLYWHEEL,
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
              <div className="strip" aria-label="Key protocol metrics">
                {HERO_METRICS.map((m) => (
                  <MetricCard key={m.label} label={m.label} value={m.value} unit={m.unit} />
                ))}
                <span className="strip__note t-demo">Pre-launch figures</span>
              </div>

              <div className="thesis">
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
          </Rise>
        </section>

        {/* ========================= 02 · The three primitives ========================= */}
        <Section
          no="02"
          kicker="The Bank"
          id="actions"
          title={["Three things a bank does."]}
          lede="Invest, borrow, earn. Every ZBANK product composes these primitives."
        >
          <div className="actions">
            {ACTIONS.map((a, i) => (
              <Rise key={a.name} delay={i * 0.07}>
                <Link className="action" to={a.to}>
                  <span className="action__name">{a.name}</span>
                  <span className="action__copy">{a.copy}</span>
                  <span className="action__detail">{a.detail}</span>
                  <span className="product__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </Rise>
            ))}
          </div>
        </Section>

        {/* ============================== 03 · Mission ============================== */}
        <Section
          no="03"
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
        </Section>

        {/* ============================== 04 · Treasury ============================== */}
        <Section
          no="04"
          kicker="ZEC Treasury"
          id="treasury"
          title={[TREASURY.headline]}
          lede={TREASURY.copy}
        >
          <Rise delay={0.08}>
            <div className="board">
              <div className="board__grid">
                {TREASURY.stats.map((s) => (
                  <MetricCard key={s.label} label={s.label} value={s.value} unit={s.unit} />
                ))}
              </div>
              <div className="board__foot">
                <div className="board__address">
                  <span className="metric__label">Treasury address</span>
                  <span className="protocol__value" data-pending={TREASURY.address === null}>
                    {TREASURY.address ?? "Pending launch"}
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

        {/* ============================== 05 · Products ============================== */}
        <Section
          no="05"
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

        {/* ============================== 06 · ZLOOP feature ============================== */}
        <Section no="06" kicker="ZLOOP" id="zloop" title={[...ZLOOP_FEATURE.headline]} lede={ZLOOP_FEATURE.copy}>
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

        {/* ============================= 07 · Flywheel ============================= */}
        <Section no="07" kicker="The Flywheel" id="flywheel" title={[FLYWHEEL.headline]}>
          <Rise delay={0.08}>
            <FlywheelDiagram />
          </Rise>
        </Section>

        {/* ============================== 08 · The Token ============================== */}
        <Section
          no="08"
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

        {/* ============================== 09 · Roadmap ============================== */}
        <Section no="09" kicker="Roadmap" id="roadmap" title={["Build the bank."]}>
          <div className="roadmap">
            {ROADMAP.map((stage, i) => (
              <Rise key={stage.phase} delay={i * 0.05}>
                <RoadmapStage stage={stage} />
              </Rise>
            ))}
          </div>
        </Section>

        {/* ======================== 10 · Protocol / Transparency ======================== */}
        <Section no="10" kicker="Protocol" id="protocol" title={["Verify the system."]}>
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

      {/* ============================ 11 · Disclaimer / Footer ============================ */}
      <footer className="footer" data-sec="11">
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

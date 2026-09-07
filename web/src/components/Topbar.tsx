import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { ProductIcon } from "./ProductCard";

/**
 * The masthead: a scroll-aware frosted bar with product-group dropdowns.
 *
 * The pattern is the Linear/Vercel one — a shared hover highlight that glides between
 * items, panels that open with a soft rise, and a full drawer on mobile instead of hiding
 * navigation. Dropdowns open on hover and on focus/click, close on route change and Escape.
 */

type MenuItem = {
  name: string;
  ticker: string;
  desc: string;
  to: string;
};

type NavEntry =
  | { label: string; to: string; menu?: undefined }
  | { label: string; to: string; menu: MenuItem[] };

const NAV: NavEntry[] = [
  {
    label: "Invest",
    to: "/invest",
    menu: [
      { name: "ZINVEST", ticker: "ZINVEST", desc: "Turn ZEC into a Stock Token portfolio.", to: "/invest" },
      { name: "ZINDEX", ticker: "ZINDEX", desc: "Prebuilt market strategies — ZTECH, ZAI, Z500.", to: "/invest/indexes" },
    ],
  },
  {
    label: "Credit",
    to: "/credit",
    menu: [
      { name: "Borrow", ticker: "ZCREDIT", desc: "Keep your ZEC. Borrow USDG against it.", to: "/credit" },
      { name: "ZLOOP", ticker: "ZLOOP", desc: "Borrow and invest in one guided flow.", to: "/credit/loop" },
    ],
  },
  {
    label: "Earn",
    to: "/earn",
    menu: [
      { name: "ZEARN", ticker: "ZEARN", desc: "Supply USDG. Earn the borrower rate.", to: "/earn" },
    ],
  },
  { label: "Treasury", to: "/treasury" },
  { label: "$ZBNK", to: "/token" },
  {
    label: "Learn",
    to: "/start",
    menu: [
      { name: "Start here", ticker: "START", desc: "The seven-chapter tour of how ZBANK works.", to: "/start" },
      { name: "Docs", ticker: "DOCS", desc: "The full protocol reference, mechanism by mechanism.", to: "/docs" },
    ],
  },
];

export function Topbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const closeTimer = useRef<number | null>(null);

  /* The glide highlight: one element, repositioned under whichever item is hovered. */
  const navRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Route change closes everything and unlocks scroll.
  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [drawer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enter = (label: string, el: HTMLElement) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(NAV.find((n) => n.label === label)?.menu ? label : null);

    // Glide the highlight pill under the hovered item.
    const nav = navRef.current;
    const pill = pillRef.current;
    if (nav && pill) {
      const nr = nav.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      pill.style.width = `${er.width}px`;
      pill.style.transform = `translateX(${er.left - nr.left}px)`;
      pill.style.opacity = "1";
    }
  };

  const leave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(null), 120);
    const pill = pillRef.current;
    if (pill) pill.style.opacity = "0";
  };

  return (
    <header className="masthead" data-scrolled={scrolled} data-menu-open={open != null}>
      <div className="masthead__inner">
        <Link to="/" className="masthead__home" aria-label="ZBANK home">
          <Logo />
        </Link>

        {/* ---- Desktop nav with glide highlight and dropdown panels. ---- */}
        <nav className="masthead__nav" aria-label="Products" ref={navRef} onMouseLeave={leave}>
          <span className="masthead__pill" ref={pillRef} aria-hidden="true" />
          {NAV.map((entry) => (
            <div
              className="masthead__item"
              key={entry.label}
              onMouseEnter={(e) => enter(entry.label, e.currentTarget)}
              onFocus={(e) => enter(entry.label, e.currentTarget)}
            >
              <NavLink
                to={entry.to}
                end={entry.label === "Invest" || entry.label === "Credit" ? false : undefined}
                className={({ isActive }) => `masthead__link${isActive ? " is-active" : ""}`}
                aria-haspopup={entry.menu ? "menu" : undefined}
                aria-expanded={entry.menu ? open === entry.label : undefined}
              >
                {entry.label}
                {entry.menu ? (
                  <svg className="masthead__caret" viewBox="0 0 10 6" aria-hidden="true">
                    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                ) : null}
              </NavLink>

              {entry.menu ? (
                <div className="menu" data-open={open === entry.label} role="menu">
                  <div className="menu__panel">
                    {entry.menu.map((item) => (
                      <Link className="menu__entry" to={item.to} role="menuitem" key={item.to}>
                        <span className="menu__icon">
                          <ProductIcon name={item.ticker} />
                        </span>
                        <span className="menu__text">
                          <span className="menu__name">{item.name}</span>
                          <span className="menu__desc">{item.desc}</span>
                        </span>
                        <span className="menu__arrow" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="masthead__right">
          <Link className="btn btn--gold masthead__cta" to="/app">
            Open App
          </Link>
          <button
            className="masthead__burger"
            aria-label={drawer ? "Close menu" : "Open menu"}
            aria-expanded={drawer}
            data-open={drawer}
            onClick={() => setDrawer((d) => !d)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* ---- Mobile drawer: full navigation, grouped, big targets. ---- */}
      <div className="drawer" data-open={drawer} aria-hidden={!drawer}>
        <nav className="drawer__nav" aria-label="Products">
          {NAV.map((entry) =>
            entry.menu ? (
              <div className="drawer__group" key={entry.label}>
                <span className="drawer__label">{entry.label}</span>
                {entry.menu.map((item) => (
                  <Link className="drawer__link" to={item.to} key={item.to}>
                    <span className="drawer__name">{item.name}</span>
                    <span className="drawer__desc">{item.desc}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link className="drawer__link drawer__link--solo" to={entry.to} key={entry.label}>
                <span className="drawer__name">{entry.label}</span>
              </Link>
            ),
          )}
          <Link className="btn btn--gold drawer__cta" to="/app">
            Open App
          </Link>
        </nav>
      </div>
    </header>
  );
}

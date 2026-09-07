import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Topbar } from "./components/Topbar";
import { Cursor } from "./components/Cursor";
import { Boot } from "./components/Boot";
import { FieldBackdrop } from "./components/FieldBackdrop";
import Home from "./pages/Home";
import AppDashboard from "./pages/AppDashboard";
import Invest from "./pages/Invest";
import Indexes from "./pages/Indexes";
import Credit from "./pages/Credit";
import Loop from "./pages/Loop";
import Earn from "./pages/Earn";
import Treasury from "./pages/Treasury";
import TokenPage from "./pages/TokenPage";
import Docs from "./pages/Docs";
import Start from "./pages/Start";

/** SPA route changes land at the top of the page, like real navigation. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

/**
 * First visit goes through the tour, wherever the visitor landed. Exactly once: /start marks
 * the flag on mount, so a reload — or the Skip button — never traps anyone in a loop.
 */
function FirstVisitGate() {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      if (!localStorage.getItem("zbank.toured.v1") && window.location.pathname !== "/start") {
        navigate("/start", { replace: true });
      }
    } catch {
      /* storage unavailable — never gate */
    }
    // Mount-only by design: this decides the landing route, not ongoing navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * ZBANK — the marketing page at `/`, the application everywhere else.
 *
 * The particle field is the site's permanent ground: mounted once here, it runs behind every
 * route and survives navigation. Cursor and masthead are global too.
 */
export default function App() {
  return (
    <>
      <Boot />
      <FirstVisitGate />
      <ScrollToTop />
      <FieldBackdrop />
      <Cursor />
      <Topbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={<AppDashboard />} />
        <Route path="/invest" element={<Invest />} />
        <Route path="/invest/indexes" element={<Indexes />} />
        <Route path="/credit" element={<Credit />} />
        <Route path="/credit/loop" element={<Loop />} />
        <Route path="/earn" element={<Earn />} />
        <Route path="/treasury" element={<Treasury />} />
        <Route path="/token" element={<TokenPage />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/start" element={<Start />} />
        {/* Unknown routes land on the homepage rather than a dead end. */}
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

/**
 * The documentation diagrams — hand-drawn SVG in the brand register: hairline boxes, mono
 * labels, gold for money flows, one idea per figure. Shared by /docs and the /start tutorial
 * so the same picture teaches the same mechanism everywhere.
 */

const INK = "#c0c3cb";
const INK_DIM = "#8f939e";
const LINE = "#26272e";
const GOLD = "#f4b728";
const GOLD_DIM = "#b98d24";
const PANEL = "#0e0e12";
const DANGER = "#e5484d";

const mono = {
  fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
  letterSpacing: "0.08em",
} as const;

function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
  gold = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  gold?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={gold ? "rgba(244,183,40,0.07)" : PANEL}
        stroke={gold ? GOLD_DIM : LINE}
      />
      <text
        x={x + w / 2}
        y={y + (sub ? h / 2 - 4 : h / 2 + 3)}
        textAnchor="middle"
        fontSize="10"
        fill={gold ? GOLD : INK}
        style={mono}
      >
        {label}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  label,
  gold = false,
  labelDy = -5,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  gold?: boolean;
  labelDy?: number;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ah = 5;
  const c = gold ? GOLD_DIM : INK_DIM;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="1" />
      <path
        d={`M ${x2} ${y2} L ${x2 - ah * Math.cos(angle - 0.45)} ${y2 - ah * Math.sin(angle - 0.45)} M ${x2} ${y2} L ${x2 - ah * Math.cos(angle + 0.45)} ${y2 - ah * Math.sin(angle + 0.45)}`}
        stroke={c}
        strokeWidth="1"
        fill="none"
      />
      {label ? (
        <text x={mx} y={my + labelDy} textAnchor="middle" fontSize="8" fill={gold ? GOLD : INK_DIM} style={mono}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Figure({ title, children, viewBox }: { title: string; children: React.ReactNode; viewBox: string }) {
  return (
    <figure className="docfig">
      <svg viewBox={viewBox} role="img" aria-label={title}>
        {children}
      </svg>
      <figcaption className="docfig__cap">{title}</figcaption>
    </figure>
  );
}

/* ------------------------------ The credit market ------------------------------ */

export function DiagramCreditMarket() {
  return (
    <Figure title="The ZCREDIT market: one pool, two sides, an oracle in the middle" viewBox="0 0 560 240">
      {/* Actors */}
      <Box x={20} y={95} w={110} h={50} label="BORROWERS" sub="hold ZEC" />
      <Box x={430} y={95} w={110} h={50} label="LENDERS" sub="hold USDG" />
      {/* Vault + oracle */}
      <Box x={225} y={90} w={110} h={60} label="ZCREDIT" sub="market" gold />
      <Box x={225} y={16} w={110} h={36} label="ZEC/USD ORACLE" />
      <Arrow x1={280} y1={52} x2={280} y2={88} label="values collateral" labelDy={-8} />
      {/* Flows */}
      <Arrow x1={130} y1={105} x2={223} y2={105} label="deposit ZEC" gold />
      <Arrow x1={223} y1={135} x2={130} y2={135} label="borrow USDG" />
      <Arrow x1={430} y1={135} x2={337} y2={135} label="supply USDG" gold />
      <Arrow x1={337} y1={105} x2={430} y2={105} label="interest − reserve" />
      {/* Interest origination */}
      <text x={280} y={186} textAnchor="middle" fontSize="9" fill={INK} style={mono}>
        BORROWERS PAY INTEREST → LENDERS EARN IT
      </text>
      <text x={280} y={204} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        the protocol keeps a reserve factor of the interest — that spread is revenue
      </text>
      <text x={280} y={228} textAnchor="middle" fontSize="8" fill={DANGER} style={mono}>
        if collateral value falls too far, liquidators repay debt and seize collateral
      </text>
    </Figure>
  );
}

/* ------------------------------ The invest route ------------------------------ */

export function DiagramInvestRoute() {
  const outs = [
    ["NVDA", 25],
    ["AAPL", 20],
    ["MSFT", 20],
    ["META", 15],
    ["ZEC", 10],
  ] as const;
  return (
    <Figure title="A ZINVEST execution: one input, one route, a weighted basket out" viewBox="0 0 560 210">
      <Box x={20} y={80} w={90} h={44} label="ZEC" sub="your input" gold />
      <Arrow x1={110} y1={102} x2={168} y2={102} label="swap" />
      <Box x={170} y={80} w={90} h={44} label="USDG" sub="via router" />
      <Arrow x1={260} y1={102} x2={318} y2={102} label="split by weight" />
      <Box x={320} y={68} w={100} h={68} label="ALLOCATOR" sub="ZTECH targets" gold />
      {outs.map(([sym, w], i) => {
        const y = 18 + i * 36;
        return (
          <g key={sym}>
            <Arrow x1={420} y1={102} x2={452} y2={y + 13} />
            <rect x={454} y={y} width={54} height={26} fill={PANEL} stroke={LINE} />
            <text x={481} y={y + 16} textAnchor="middle" fontSize="9" fill={INK} style={mono}>
              {sym}
            </text>
            <rect x={512} y={y + 10} width={(w / 25) * 30} height={5} fill={GOLD} opacity={0.85} />
          </g>
        );
      })}
      <text x={220} y={170} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        quoted before execution: price impact · fees · slippage · estimated received
      </text>
      <text x={220} y={188} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        reverts instead of filling beyond your slippage tolerance
      </text>
    </Figure>
  );
}

/* ------------------------------ The loop ------------------------------ */

export function DiagramLoop() {
  return (
    <Figure title="ZLOOP: the same ZEC, working twice — with debt attached" viewBox="0 0 560 250">
      <Box x={30} y={30} w={120} h={48} label="100 ZEC" sub="stays yours" gold />
      <Arrow x1={90} y1={78} x2={90} y2={118} label="deposit as collateral" labelDy={12} />
      <Box x={30} y={120} w={120} h={48} label="ZCREDIT VAULT" />
      <Arrow x1={150} y1={144} x2={218} y2={144} label="borrow" gold />
      <Box x={220} y={120} w={120} h={48} label="USDG" sub="this is debt" />
      <Arrow x1={340} y1={144} x2={408} y2={144} label="invest via ZINVEST" gold />
      <Box x={410} y={120} w={120} h={48} label="PORTFOLIO" sub="e.g. ZTECH" gold />
      {/* Debt reminder rail */}
      <line x1={280} y1={168} x2={280} y2={200} stroke={DANGER} strokeWidth="1" strokeDasharray="3 3" />
      <text x={280} y={216} textAnchor="middle" fontSize="8.5" fill={DANGER} style={mono}>
        interest accrues · portfolio losses do not reduce the debt
      </text>
      <text x={280} y={234} textAnchor="middle" fontSize="8.5" fill={DANGER} style={mono}>
        if ZEC falls, the collateral thins and liquidation gets closer
      </text>
      <text x={470} y={92} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        upside: ZEC exposure kept,
      </text>
      <text x={470} y={104} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        portfolio added on top
      </text>
    </Figure>
  );
}

/* ------------------------------ The rate curve ------------------------------ */

export function DiagramRateCurve() {
  // Kinked utilization curve: gentle to the kink at 80%, steep after.
  const x0 = 60;
  const y0 = 150;
  const w = 420;
  const h = 110;
  const kink = 0.8;
  const kx = x0 + w * kink;
  return (
    <Figure title="The variable rate model: utilization sets the price of liquidity" viewBox="0 0 560 200">
      {/* Axes */}
      <line x1={x0} y1={y0} x2={x0 + w} y2={y0} stroke={LINE} />
      <line x1={x0} y1={y0} x2={x0} y2={y0 - h} stroke={LINE} />
      <text x={x0 + w / 2} y={y0 + 26} textAnchor="middle" fontSize="8.5" fill={INK_DIM} style={mono}>
        UTILIZATION (BORROWED ÷ SUPPLIED)
      </text>
      <text
        x={x0 - 34}
        y={y0 - h / 2}
        textAnchor="middle"
        fontSize="8.5"
        fill={INK_DIM}
        style={mono}
        transform={`rotate(-90 ${x0 - 34} ${y0 - h / 2})`}
      >
        BORROW RATE
      </text>
      {/* Curve: base → kink shallow, then steep */}
      <path
        d={`M ${x0} ${y0 - 6} L ${kx} ${y0 - 34} L ${x0 + w} ${y0 - h + 6}`}
        fill="none"
        stroke={GOLD}
        strokeWidth="1.6"
      />
      {/* Kink marker */}
      <line x1={kx} y1={y0} x2={kx} y2={y0 - 34} stroke={GOLD_DIM} strokeDasharray="3 3" />
      <text x={kx} y={y0 + 14} textAnchor="middle" fontSize="8.5" fill={GOLD} style={mono}>
        80% KINK
      </text>
      {/* Annotations */}
      <text x={x0 + w * 0.38} y={y0 - 52} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        cheap liquidity while plenty is idle
      </text>
      <text x={x0 + w * 0.9} y={y0 - h + 2} textAnchor="end" fontSize="8" fill={INK} style={mono}>
        scarce liquidity gets expensive fast —
      </text>
      <text x={x0 + w * 0.9} y={y0 - h + 14} textAnchor="end" fontSize="8" fill={INK_DIM} style={mono}>
        attracting supply, encouraging repayment
      </text>
      <text x={x0} y={30} fontSize="8.5" fill={INK} style={mono}>
        SUPPLY RATE = BORROW RATE × UTILIZATION − RESERVE FACTOR
      </text>
    </Figure>
  );
}

/* ------------------------------ The engine ------------------------------ */

export function DiagramEngine() {
  return (
    <Figure title="The economic engine: every product feeds the same two forces" viewBox="0 0 560 250">
      <Box x={20} y={20} w={150} h={38} label="ZINVEST · ZINDEX" sub="execution fees" />
      <Box x={205} y={20} w={150} h={38} label="ZCREDIT · ZEARN" sub="reserve factor" />
      <Box x={390} y={20} w={150} h={38} label="ZLOOP · ZSWAP" sub="routing fees" />
      <Arrow x1={95} y1={58} x2={235} y2={102} />
      <Arrow x1={280} y1={58} x2={280} y2={102} />
      <Arrow x1={465} y1={58} x2={325} y2={102} />
      <Box x={205} y={104} w={150} h={40} label="PROTOCOL REVENUE" gold />
      <Arrow x1={240} y1={144} x2={130} y2={182} label="acquire" gold />
      <Arrow x1={320} y1={144} x2={430} y2={182} label="buy + burn" gold />
      <Box x={40} y={184} w={180} h={42} label="ZEC TREASURY ↑" sub="more ZEC held" gold />
      <Box x={340} y={184} w={180} h={42} label="ZBNK SUPPLY ↓" sub="fewer tokens sharing it" gold />
      <text x={280} y={244} textAnchor="middle" fontSize="9.5" fill={GOLD} style={mono}>
        ZEC PER ZBNK ↑
      </text>
    </Figure>
  );
}

/* ------------------------------ Treasury split ------------------------------ */

export function DiagramTreasurySplit() {
  return (
    <Figure title="Treasury accounting: only the redeemable slice backs the claim" viewBox="0 0 560 150">
      <rect x={40} y={30} width={480} height={34} fill={PANEL} stroke={LINE} />
      <rect x={40} y={30} width={330} height={34} fill="rgba(244,183,40,0.14)" stroke={GOLD_DIM} />
      <text x={205} y={51} textAnchor="middle" fontSize="9.5" fill={GOLD} style={mono}>
        REDEEMABLE ZEC
      </text>
      <text x={445} y={51} textAnchor="middle" fontSize="9.5" fill={INK} style={mono}>
        STRATEGIC ZEC
      </text>
      <text x={280} y={20} textAnchor="middle" fontSize="8.5" fill={INK_DIM} style={mono}>
        TOTAL ZEC TREASURY
      </text>
      <Arrow x1={205} y1={64} x2={205} y2={96} gold />
      <text x={205} y={112} textAnchor="middle" fontSize="8.5" fill={INK} style={mono}>
        ÷ ELIGIBLE ZBNK SUPPLY = ZEC PER ZBNK
      </text>
      <text x={205} y={130} textAnchor="middle" fontSize="8" fill={INK_DIM} style={mono}>
        the backing math never touches the strategic slice
      </text>
    </Figure>
  );
}

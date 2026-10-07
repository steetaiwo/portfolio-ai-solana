"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import WalletButton from "./WalletButton";
import TwoClocks, { getMarketState } from "./TwoClocks";
import { getPortfolioSnapshot } from "../lib/portfolio/demoDataSource";
import type { Position } from "../lib/portfolio/model";

const { portfolio } = getPortfolioSnapshot();
const positions = ["AAPLx", "TSLAx", "GRND"].map((symbol) =>
  portfolio.positions.find((position) => position.symbol === symbol)!,
);
const [apple, tesla, grindr] = positions;
const formatCurrency = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const allocationOf = (position: Position) => position.value / portfolio.totalValue * 100;
const equityPositions = portfolio.positions.filter(
  (position) => position.lookThrough?.exposureCategory === "us-equity" && position.underlyingAsset,
);
const equityValue = equityPositions.reduce((sum, position) => sum + position.value, 0);
const equityShare = equityValue / portfolio.totalValue * 100;
const marketShareLabel = `${equityShare.toFixed(1)}%`;
const views = [
  { id: "observe", label: "OBSERVE" },
  { id: "lookthrough", label: "LOOK THROUGH" },
  { id: "whatif", label: "WHAT-IF" },
  { id: "evidence", label: "EVIDENCE" },
] as const;
type ViewId = (typeof views)[number]["id"];

function isViewId(value: string | null): value is ViewId {
  return views.some((view) => view.id === value);
}

function LookThroughDiagram() {
  return (
    <svg className="overview-lookthrough-svg" viewBox="0 0 640 130" role="img" aria-label="Tokenized positions AAPLx and TSLAx map through Apple and Tesla to U.S. equity exposure">
      <text className="overview-svg-heading" x="0" y="14">TOKEN</text>
      <text className="overview-svg-heading" x="175" y="14">COMPANY</text>
      <text className="overview-svg-heading" x="432" y="14">MARKET</text>
      <path className="overview-apple-line" d="M72 51 H154 M238 51 C294 51 316 70 373 70" />
      <path className="overview-tesla-line" d="M72 92 H154 M238 92 C294 92 316 70 373 70" />
      <path className="overview-market-line" d="M373 70 H421" />
      <text className="overview-token-label" x="0" y="55">{apple.symbol}</text>
      <text className="overview-token-label" x="0" y="96">{tesla.symbol}</text>
      <text className="overview-company-label" x="175" y="55">{apple.underlyingAsset?.name}</text>
      <text className="overview-company-label" x="175" y="96">{tesla.underlyingAsset?.name}</text>
      <text className="overview-market-label" x="432" y="68">U.S. Equity</text>
      <text className="overview-market-value" x="432" y="91">{marketShareLabel}</text>
    </svg>
  );
}

export default function Horizon() {
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketEvidence, setMarketEvidence] = useState<"OBSERVED" | "DERIVED">("OBSERVED");
  const [activeView, setActiveView] = useState<ViewId>("lookthrough");
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const [stickyValueMode, setStickyValueMode] = useState<"portfolio" | "scenario" | null>(null);
  const [activeInvestigationStep, setActiveInvestigationStep] = useState<number | null>(null);
  const investigationChainRef = useRef<HTMLOListElement | null>(null);
  const scenarioStepRef = useRef<HTMLLIElement | null>(null);
  const appleStyle = { clipPath: `inset(0 ${100 - allocationOf(apple)}% 0 0)` } as CSSProperties;
  const grindrStyle = { clipPath: `inset(0 0 0 ${100 - allocationOf(grindr)}%)` } as CSSProperties;
  const baseStyle = { clipPath: `inset(0 ${allocationOf(grindr)}% 0 0)` } as CSSProperties;

  useEffect(() => {
    const readViewFromUrl = () => {
      const requestedView = new URLSearchParams(window.location.search).get("view");
      const validView = isViewId(requestedView);
      const nextView = validView ? requestedView : "lookthrough";
      setActiveView(nextView);
      if (!validView) {
        const url = new URL(window.location.href);
        url.searchParams.set("view", "lookthrough");
        window.history.replaceState(null, "", url);
      }
    };
    const updateClock = () => {
      const now = new Date();
      const override = new URLSearchParams(window.location.search).get("market");
      const forcedMarketState = override === "open" || override === "closed";
      setMarketOpen(override === "open" || (override !== "closed" && getMarketState(now).isOpen));
      setMarketEvidence(forcedMarketState ? "DERIVED" : "OBSERVED");
    };
    const handlePopState = () => readViewFromUrl();
    readViewFromUrl();
    updateClock();
    const interval = window.setInterval(updateClock, 30_000);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (activeView !== "observe" || !investigationOpen) return;
    const updateScenarioPosition = () => {
      const bounds = scenarioStepRef.current?.getBoundingClientRect();
      const readingLine = window.innerHeight * 0.76;
      const scenarioInReadingRegion = bounds !== undefined && bounds.top < readingLine && bounds.bottom > 112;
      setStickyValueMode(scenarioInReadingRegion ? "scenario" : window.scrollY > 160 ? "portfolio" : null);

      const steps = investigationChainRef.current?.querySelectorAll<HTMLElement>(".investigation-step");
      let nextActiveStep: number | null = null;
      steps?.forEach((step, index) => {
        if (step.getBoundingClientRect().top < readingLine) nextActiveStep = index;
      });
      setActiveInvestigationStep(nextActiveStep);
    };
    window.requestAnimationFrame(updateScenarioPosition);
    window.addEventListener("scroll", updateScenarioPosition, { passive: true });
    window.addEventListener("resize", updateScenarioPosition);
    return () => {
      window.removeEventListener("scroll", updateScenarioPosition);
      window.removeEventListener("resize", updateScenarioPosition);
    };
  }, [activeView, investigationOpen]);

  function selectView(view: ViewId) {
    setActiveView(view);
    if (view !== "observe") {
      setStickyValueMode(null);
      setActiveInvestigationStep(null);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.pushState(null, "", url);
  }

  function investigationStepClass(index: number, detailClass = "") {
    const progressClass = activeInvestigationStep === index
      ? "is-active"
      : activeInvestigationStep !== null && index < activeInvestigationStep
        ? "is-settled"
        : "is-upcoming";
    return ["investigation-step", detailClass, progressClass].filter(Boolean).join(" ");
  }

  return (
    <div className={`portfolio-scene${activeView === "observe" && investigationOpen ? " is-investigating" : ""}${stickyValueMode === "scenario" ? " is-scenario-active" : ""}`}>
      <header className="app-topbar">
        <span className="overview-brand">Portfolio AI</span>
        <nav className="overview-nav" aria-label="Portfolio views">
          {views.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeView === id}
              className={activeView === id ? "is-selected" : ""}
              onClick={() => selectView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="overview-wallet"><WalletButton /></div>
      </header>

      <div className="overview-clock-strip">
        <TwoClocks total={portfolio.totalValue} assetCount={portfolio.positions.length} compact />
      </div>

      <main className={`portfolio-screen is-view-${activeView}${marketOpen ? " is-market-open" : ""}`} aria-label="Portfolio overview">
        <div className="overview-main">
          <section className="overview-number-section" aria-label="Portfolio value and holdings">
            <p className="portfolio-kicker">MARKETS CLOSE. YOUR ONCHAIN PORTFOLIO DOESN&apos;T.</p>
            <div className={`overview-total${marketOpen ? " is-market-open" : ""}`}>
              <span className="overview-total-copy overview-total-base" style={baseStyle}>{formatCurrency(portfolio.totalValue)}</span>
              <span className="overview-total-copy overview-total-apple" style={appleStyle}>{formatCurrency(portfolio.totalValue)}</span>
              <span className="overview-total-copy overview-total-grnd" style={grindrStyle}>{formatCurrency(portfolio.totalValue)}</span>
            </div>

            <div className="overview-measurements" aria-label="Portfolio holdings">
              <div className="overview-measurement-row">
                {[apple, tesla, grindr].map((position) => (
                  <div className={`overview-measurement overview-measurement-${position.symbol.toLowerCase()}`} key={position.symbol} style={{ flexGrow: position.value, flexBasis: 0 }}>
                    <span className={`overview-bracket overview-bracket-${position.symbol.toLowerCase()}`} />
                    <strong>{position.symbol}</strong>
                    <span className="overview-measurement-value">
                      <span>${Math.round(position.value).toLocaleString("en-US")}</span>
                      <span>· {Math.round(allocationOf(position))}%</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="overview-classification-row">
                <div className="overview-classification overview-equity-classification" style={{ flexGrow: apple.value + tesla.value, flexBasis: 0 }}>
                  <span className="overview-classification-bracket" />
                  <span>{marketShareLabel} U.S. Equity</span>
                </div>
                <div className="overview-classification overview-onchain-classification" style={{ flexGrow: grindr.value, flexBasis: 0 }}>
                  <span className="overview-classification-bracket" />
                  <span>on-chain only</span>
                </div>
              </div>
            </div>
          </section>

          {activeView === "observe" ? (
            <section className="overview-investigation" aria-label="Portfolio vulnerability investigation">
              <button
                type="button"
                className="investigation-question"
                aria-expanded={investigationOpen}
                aria-controls="investigation-chain"
                onClick={() => {
                  if (investigationOpen) {
                    setStickyValueMode(null);
                    setActiveInvestigationStep(null);
                  }
                  setInvestigationOpen((open) => !open);
                }}
              >
                Why is my portfolio vulnerable?
                <span className="investigation-toggle" aria-hidden="true">{investigationOpen ? "−" : "+"}</span>
              </button>
              <div id="investigation-chain" className={`investigation-chain-wrap${investigationOpen ? " is-open" : ""}`}>
                {investigationOpen && (
                  <ol className="investigation-chain" ref={investigationChainRef}>
                    <li className={investigationStepClass(0)} aria-current={activeInvestigationStep === 0 ? "step" : undefined}>
                      <span className="investigation-step-number">01</span>
                      <div className="investigation-step-content">
                        <div className="investigation-step-heading"><span>CONCENTRATION</span><span className="evidence-tag">DERIVED</span></div>
                        <div className="investigation-concentration"><strong>62%</strong><span>AAPLx</span></div>
                        <p>AAPLx is the largest position in this portfolio.</p>
                      </div>
                    </li>
                    <li className={investigationStepClass(1)} aria-current={activeInvestigationStep === 1 ? "step" : undefined}>
                      <span className="investigation-step-number">02</span>
                      <div className="investigation-step-content">
                        <div className="investigation-step-heading"><span>LOOK THROUGH</span><span className="evidence-tag">DERIVED</span></div>
                        <div className="investigation-lookthrough"><strong>AAPLx</strong><span>→</span><strong>{apple.underlyingAsset?.name}</strong><span>→</span><strong>U.S. Equity</strong></div>
                        <p className="investigation-exposure-value">{marketShareLabel}</p>
                        <div className="investigation-exposure-meter" role="img" aria-label={`U.S. Equity exposure ${marketShareLabel}`}>
                          <span style={{ width: `${equityShare}%` }} />
                        </div>
                        <p>The token maps to its configured underlying equity exposure.</p>
                      </div>
                    </li>
                    <li className={investigationStepClass(2, "investigation-step-market")} aria-current={activeInvestigationStep === 2 ? "step" : undefined}>
                      <span className="investigation-step-number">03</span>
                      <div className="investigation-step-content">
                        <div className="investigation-step-heading"><span>MARKET STATE</span><span className="evidence-tag">{marketEvidence}</span></div>
                        <div className="investigation-market-states">
                          <p><span>Traditional market</span><strong className={marketOpen ? "is-open" : "is-closed"}>{marketOpen ? "OPEN" : "CLOSED"}</strong></p>
                          <p><span>On-chain</span><strong className="is-live">LIVE</strong></p>
                        </div>
                      </div>
                    </li>
                    <li className={investigationStepClass(3, "investigation-step-scenario")} aria-current={activeInvestigationStep === 3 ? "step" : undefined} ref={scenarioStepRef}>
                      <span className="investigation-step-number">04</span>
                      <div className="investigation-step-content">
                        <div className="investigation-step-heading"><span>WHAT-IF</span><span className="evidence-tag">COMPUTED</span></div>
                        <p className="scenario-label">SCENARIO · NOT REAL</p>
                        <p className="investigation-scenario-move"><span className="scenario-asset">AAPLx</span>{" "}<span className="scenario-change">−10%</span></p>
                        <div className="scenario-results">
                          <div><dt>Portfolio impact</dt><dd>−$2,989.20</dd></div>
                          <div><dt>New portfolio value</dt><dd>$45,223.70</dd></div>
                          <div><dt>Portfolio change</dt><dd>−6.20%</dd></div>
                        </div>
                        <button type="button" className="investigation-link" onClick={() => selectView("whatif")}>Open What-If view <span aria-hidden="true">→</span></button>
                      </div>
                    </li>
                    <li className={investigationStepClass(4, "investigation-step-conclusion")} aria-current={activeInvestigationStep === 4 ? "step" : undefined}>
                      <span className="investigation-step-number">05</span>
                      <div className="investigation-step-content">
                        <div className="investigation-step-heading"><span>EVIDENCE / CONCLUSION</span><span className="evidence-tag">INFERRED</span></div>
                        <ul className="investigation-evidence-list">
                          <li>Portfolio holdings</li>
                          <li>Existing schedule / market-state logic</li>
                          <li>Scenario mathematics</li>
                        </ul>
                        <p className="investigation-conclusion">The vulnerability combines AAPLx concentration, underlying U.S. Equity exposure, and a traditional market that closes while on-chain trading remains live.</p>
                      </div>
                    </li>
                  </ol>
                )}
              </div>
            </section>
          ) : (
            <section className="overview-lower-grid" aria-label="Portfolio interpretation">
              <div className="scene-chain-area" aria-live="polite">
                {activeView === "lookthrough" && <LookThroughDiagram />}
                {activeView === "whatif" && (
                  <div className="scene-state-panel scene-scenario">
                    <p className="scenario-label">SCENARIO · NOT REAL</p>
                    <p className="scenario-move"><span className="scenario-asset">AAPLx</span>{" "}<span className="scenario-change">−10%</span></p>
                    <dl className="scenario-results">
                      <div><dt>Portfolio impact</dt><dd>−$2,989.20</dd></div>
                      <div><dt>New portfolio value</dt><dd>$45,223.70</dd></div>
                      <div><dt>Portfolio change</dt><dd>−6.20%</dd></div>
                    </dl>
                  </div>
                )}
                {activeView === "evidence" && (
                  <ul className="scene-evidence" aria-label="Evidence used">
                    <li><strong>Portfolio holdings</strong></li>
                    <li><strong>Existing schedule / market-state logic</strong></li>
                    <li><strong>Scenario mathematics</strong></li>
                  </ul>
                )}
              </div>

              <div className="overview-narrative" aria-label="The gap between market clocks">
                <p className="overview-narrative-lead">
                  <span>{marketShareLabel}</span>{" "}of this number is {marketOpen ? <>priced by an open market.</> : <>anchored to a market that is <em>closed.</em></>}
                </p>
                <div className="overview-why-heading"><span>THE GAP BETWEEN THE CLOCKS</span><span className="overview-inferred-tag">INFERRED</span></div>
                <p className="overview-why-copy">Different tickers, one market. You can still trade both on-chain while it is closed, but nothing new is said about Apple or Tesla until it opens.</p>
              </div>
            </section>
          )}
          </div>
        {activeView !== "observe" && <p className="overview-onchain-caption">On-chain · always live</p>}
        <div className="overview-bottom-strip" aria-hidden="true" />
        <div className="overview-ask-glow" aria-hidden="true" />
        <div className="overview-ask-bar" aria-label="Ask about your portfolio (visual preview)">
          <span>Ask about your portfolio, or try: What if AAPLx falls 10%?</span>
          <span className="overview-mic" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path d="M5 10v4 M9 7v10 M13 4v16 M17 8v8 M21 10v4" />
            </svg>
          </span>
        </div>
      </main>
      {stickyValueMode && (
        <div className={`scenario-sticky-value is-${stickyValueMode}`} aria-live="polite">
          <span className="scenario-sticky-label">{stickyValueMode === "scenario" ? "SCENARIO" : "PORTFOLIO"}</span>
          <strong key={stickyValueMode}>{stickyValueMode === "scenario" ? "$45,223.70" : formatCurrency(portfolio.totalValue)}</strong>
          {stickyValueMode === "scenario" && <span>−6.20%</span>}
        </div>
      )}
    </div>
  );
}

"use client";

import { generateInsights } from "./insights";
import { AlertTriangle, ArrowDownRight, TrendingUp } from "lucide-react";
import { calculateAllocationPercentage, calculateExposureCategorySummary, calculatePositionScenario, formatPercentage, getAssetRiskSummary } from "../lib/portfolio/calculations";
import { getPortfolioSnapshot } from "../lib/portfolio/demoDataSource";
import { useEffect } from "react";
import { useState } from "react";

function currency(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AIInsights() {
  const snapshot = getPortfolioSnapshot();
  const insights = generateInsights(snapshot);
  const { positions: assets, totalValue: total } = snapshot.portfolio;
  const [analysisStatus, setAnalysisStatus] = useState<"ready" | "complete">("ready");
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(null);

  useEffect(() => {
    function onPanelClose() {
      setAnalysisStatus("ready");
    }

    function onAnalysisState(event: Event) {
      const detail = (event as CustomEvent<{ status?: "ready" | "complete" }>).detail;
      if (detail?.status) setAnalysisStatus(detail.status);
    }

    function onFocus(event: Event) {
      const detail = (event as CustomEvent<{ symbol?: string | null }>).detail;
      setFocusedSymbol(detail?.symbol ?? null);
    }

    window.addEventListener("ai-panel-close", onPanelClose);
    window.addEventListener("ai-analysis-state", onAnalysisState);
    window.addEventListener("portfolio-ai-focus", onFocus);
    return () => {
      window.removeEventListener("ai-panel-close", onPanelClose);
      window.removeEventListener("ai-analysis-state", onAnalysisState);
      window.removeEventListener("portfolio-ai-focus", onFocus);
    };
  }, []);

  const largest = insights.find((insight) => insight.id === "largest");
  const mover = insights.find((insight) => insight.id === "mover");
  const concentrationAsset = assets.find((asset) => asset.symbol === largest?.symbol);
  const moverAsset = assets.find((asset) => asset.symbol === mover?.symbol);
  const decline = insights.find((insight) => insight.id === "decline");
  const declineAsset = assets.find((asset) => asset.symbol === decline?.symbol);
  const lookThroughPositions = assets.filter((asset) => asset.lookThrough && asset.underlyingAsset);
  const unconfiguredUnderlyingPositions = assets.filter((asset) => !asset.lookThrough || !asset.underlyingAsset);
  const equityExposure = calculateExposureCategorySummary(snapshot.portfolio, "us-equity");
  const signals = [
    { id: "concentration", label: "Concentration", symbol: concentrationAsset?.symbol ?? "AAPLx", value: concentrationAsset ? formatPercentage(calculateAllocationPercentage(concentrationAsset.value, total)) : "—", note: "Your largest exposure", prompt: `Why is ${concentrationAsset?.symbol ?? "AAPLx"} important to my portfolio?`, icon: AlertTriangle, tone: "purple" },
    { id: "momentum", label: "Momentum", symbol: moverAsset?.symbol ?? "GRND", value: moverAsset?.change24h === undefined ? "—" : `${moverAsset.change24h >= 0 ? "+" : ""}${moverAsset.change24h}%`, note: "Strongest recorded 24h move", prompt: "What changed today?", icon: TrendingUp, tone: "green" },
    { id: "pressure", label: "Pressure", symbol: declineAsset?.symbol ?? "TSLAx", value: declineAsset?.change24h === undefined ? "—" : `${declineAsset.change24h}%`, note: "Recorded declining position", prompt: `Tell me about ${declineAsset?.symbol ?? "TSLAx"}`, icon: ArrowDownRight, tone: "amber" },
  ];

  function askAbout(prompt: string) {
    window.dispatchEvent(new CustomEvent("ai-orb-click", {
      detail: { source: "insights", prompt },
    }));
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-purple-300" /><p className="text-xs font-medium uppercase tracking-[0.16em] text-purple-200/70">Portfolio signals</p></div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Signals worth understanding</h3>
          <p className="mt-1 text-xs text-white/40" aria-live="polite">
            {analysisStatus === "complete" ? "Signal linked to the selected holding" : "Concentration and recorded position movement"}
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/30">Sample data</div>
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        {signals.map(({ id, label, symbol, value, note, prompt, icon: Icon, tone }) => {
          const isFocused = focusedSymbol === symbol;
          const isConcentration = id === "concentration";
          const allocation = concentrationAsset ? calculateAllocationPercentage(concentrationAsset.value, total) : 0;
          const portfolioEffectAtTenPercent = concentrationAsset
            ? calculatePositionScenario(snapshot.portfolio, concentrationAsset.symbol, 10).portfolioImpactPercentage
            : 0;
          const toneClasses = tone === "green" ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200" : tone === "amber" ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-200" : "border-purple-400/25 bg-purple-400/[0.08] text-purple-200";
          const riskSummary = concentrationAsset ? getAssetRiskSummary(concentrationAsset, total) : null;
          return <div key={id} className={`panel-lift border-b py-5 transition-[background-color,box-shadow,opacity] duration-500 md:border-b-0 md:border-r md:px-5 ${toneClasses.replace("bg-purple-400/[0.08]", "bg-transparent").replace("bg-emerald-400/[0.06]", "bg-transparent").replace("bg-amber-400/[0.06]", "bg-transparent")} ${isConcentration ? "md:pl-0" : ""} ${id === "pressure" ? "md:border-r-0" : ""} ${focusedSymbol && !isFocused ? "opacity-45" : ""} ${isConcentration ? "rounded-xl border border-purple-300/25 bg-purple-400/[0.07] px-4 shadow-[0_16px_48px_rgba(76,29,149,0.12)] md:my-3 md:mr-5 md:px-4" : ""} ${isFocused ? "bg-purple-400/[0.08] shadow-[inset_3px_0_0_rgba(196,181,253,0.8)]" : ""}`}>
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em]"><Icon size={14} />{label}</div>{isFocused && <span className="text-[9px] uppercase tracking-[0.14em]">Focused</span>}</div>
            <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xl font-semibold text-white">{symbol}</p><p className="mt-1 text-xs text-white/50">{note}</p></div><div className="text-right"><p className={`text-xl font-semibold ${isConcentration ? "text-purple-100" : "text-white"}`}>{value}</p>{isConcentration && <p className="mt-1 text-xs text-white/55">{currency(concentrationAsset?.value ?? 0)} position</p>}</div></div>
            {isConcentration && <div className="mt-4"><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-white/45"><span>Portfolio share</span><span>{formatPercentage(allocation)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={`${symbol} portfolio concentration`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(formatPercentage(allocation).slice(0, -1))}><div className="h-full rounded-full bg-gradient-to-r from-purple-400 via-fuchsia-300 to-purple-200" style={{ width: `${allocation}%` }} /></div><p className="mt-2 text-xs leading-5 text-purple-100/75">A 10% {symbol} move means about a {formatPercentage(portfolioEffectAtTenPercent)} portfolio move, if other holdings stay unchanged.</p>{riskSummary && <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/45">Underlying · On-chain</p>}<p className="mt-2 text-xs leading-5 text-white/60">{riskSummary ? `${riskSummary.referenceAsset?.name ?? symbol} is the underlying market reference, while ${symbol} also exists in a continuous on-chain token context.` : "Underlying exposure and tokenized context are treated separately in this demo."}</p></div>}
            {isConcentration && <button onClick={() => askAbout(prompt)} aria-label={`Investigate ${label.toLowerCase()} signal for ${symbol}`} className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-purple-300/35 bg-purple-400/[0.08] px-3 py-2 text-xs text-purple-100/90 transition hover:border-purple-200/60 hover:bg-purple-400/[0.14] hover:text-white focus-visible:outline-offset-2">
              Investigate concentration
            </button>}
          </div>;
        })}
      </div>

      <details open className="mt-5 border-t border-white/10 pt-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-xs font-medium text-white/80 focus-visible:outline-offset-4">
          <span className="text-[10px] uppercase tracking-[0.18em] text-purple-200/70">Look-through exposure</span>
          <span className="text-[10px] text-white/45">Configured metadata · U.S. equity {formatPercentage(equityExposure.portfolioWeight)}</span>
        </summary>
        <div className="lookthrough-flow mt-4">
          {lookThroughPositions.map((asset) => {
            const weight = calculateAllocationPercentage(asset.value, total);
            const categoryLabel = asset.lookThrough?.exposureCategory === "us-equity" ? "U.S. equity" : "On-chain";
            return (
              <div key={asset.symbol} className="lookthrough-node">
                <div className="lookthrough-step">
                  <span className="lookthrough-token">{asset.symbol}</span>
                  <span className="lookthrough-arrow" aria-hidden="true">→</span>
                  <span className="lookthrough-label">{asset.underlyingAsset?.name}</span>
                  <span className="lookthrough-arrow" aria-hidden="true">→</span>
                  <span className="lookthrough-label is-highlight">{categoryLabel}</span>
                </div>
                <div className="lookthrough-meta">
                  <span className="lookthrough-weight">{formatPercentage(weight)}</span>
                </div>
                <p className="lookthrough-copy">{asset.lookThrough?.exposureDescription} Underlying-market concentration is distinct from the token&apos;s on-chain context.</p>
              </div>
            );
          })}
        </div>
        <div className="lookthrough-summary">
          <span className="lookthrough-summary-label">U.S. equity path</span>
          <strong>AAPLx + TSLAx</strong>
          <span aria-hidden="true">→</span>
          <strong>U.S. equity</strong>
          <span aria-hidden="true">→</span>
          <strong>{formatPercentage(equityExposure.portfolioWeight)}</strong>
        </div>
        {unconfiguredUnderlyingPositions.length > 0 && (
          <p className="mt-3 text-[10px] leading-5 text-white/45">
            {unconfiguredUnderlyingPositions.map((asset) => `${asset.symbol}: on-chain position; no configured underlying/reference relationship`).join(" · ")}. No look-through is inferred.
          </p>
        )}
        <p className="mt-2 text-[10px] leading-5 text-white/35">Weights are derived from this demo portfolio snapshot and configured metadata, not an external provider. Underlying-market risk ≠ on-chain/token context.</p>
      </details>
    </div>
  );
}

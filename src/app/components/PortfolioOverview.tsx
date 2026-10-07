"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { calculateAllocationPercentage, calculateWeightedChangePercentage, formatPercentage } from "../lib/portfolio/calculations";
import { getPortfolioSnapshot } from "../lib/portfolio/demoDataSource";

export default function PortfolioOverview() {
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(null);
  const { positions: assets, totalValue: total } = getPortfolioSnapshot().portfolio;

  useEffect(() => {
    function focusHolding(event: Event) {
      const { symbol } = (event as CustomEvent<{ symbol?: string | null }>).detail ?? {};
      setFocusedSymbol(symbol ?? null);
    }

    window.addEventListener("portfolio-ai-focus", focusHolding);
    return () => {
      window.removeEventListener("portfolio-ai-focus", focusHolding);
    };
  }, []);

  function selectHolding(symbol: string) {
    window.dispatchEvent(new CustomEvent<{ symbol: string }>("portfolio-ai-focus", {
      detail: { symbol },
    }));
  }

  const pct24 = calculateWeightedChangePercentage(assets, total);
  const pct24Rounded = Math.round(pct24 * 100) / 100;
  const recordedChanges = assets.flatMap((asset) => asset.change24h === undefined ? [] : [asset.change24h]);
  const avgMove = recordedChanges.length > 0 ? recordedChanges.reduce((sum, change) => sum + change, 0) / recordedChanges.length : 0;
  const positiveCount = recordedChanges.filter((change) => change >= 0).length;
  const negativeCount = recordedChanges.filter((change) => change < 0).length;
  const riskScore = Math.min(96, Math.max(22, Math.round(Math.abs(avgMove) * 4 + (negativeCount * 9))));
  const riskLabel = riskScore > 70 ? "Elevated" : riskScore > 45 ? "Moderate" : "Balanced";
  const topAllocation = assets.reduce((a, b) => (a.value > b.value ? a : b));

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Portfolio movement</p>

          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <div className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{pct24 >= 0 ? "+" : ""}{pct24Rounded}%</div>
            <div className={`rounded-full border px-3 py-1 text-sm font-medium ${pct24 >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-rose-500/20 bg-rose-500/10 text-rose-300"}`}>
              24h
            </div>
          </div>

          <p className="mt-2 text-xs text-white/35">Weighted 24h change · sample snapshot</p>
        </div>

      </div>

      <div className="grid gap-0 border-b border-white/10 md:grid-cols-3">
        <div className="border-b border-white/10 py-4 md:border-b-0 md:border-r md:pr-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Momentum</p>
          <p className="mt-2 text-xl font-semibold text-white">{avgMove >= 0 ? "+" : ""}{avgMove.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-white/45">{positiveCount} of {assets.length} assets positive</p>
        </div>
        <div className="border-b border-white/10 py-4 md:border-b-0 md:border-r md:px-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Risk</p>
          <p className="mt-2 text-xl font-semibold text-white">{riskScore}/100</p>
          <p className="mt-1 text-xs text-white/45">{riskLabel} profile</p>
        </div>
        <div className="py-4 md:pl-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Largest</p>
          <p className="mt-2 text-xl font-semibold text-white">{topAllocation.symbol}</p>
          <p className="mt-1 text-xs text-white/45">${topAllocation.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} position</p>
        </div>
      </div>

      <div className="grid gap-8 border-b border-white/10 py-7 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Allocation</p>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">By value</span>
          </div>

          <div className="allocation-stack space-y-3">
            {assets.map((a) => {
              const width = calculateAllocationPercentage(a.value, total);
              const isFocused = focusedSymbol === a.symbol;
              const isLeader = a.symbol === topAllocation.symbol;
              return (
                <div key={a.symbol} className={`allocation-row ${isLeader ? "is-leader" : ""} ${isFocused ? "is-focused" : ""}`}>
                  <div className="mb-1 flex items-center justify-between text-xs text-white/60">
                    <span>{a.symbol} <span className="text-white/30">{a.name.includes("Tokenized") ? "· tokenized" : "· onchain asset"}</span></span>
                    <span>{formatPercentage(width)}</span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-white/5"
                    role="progressbar"
                    aria-label={`${a.symbol} portfolio allocation`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Number(formatPercentage(width).slice(0, -1))}
                  >
                    <div
                      className={`allocation-fill h-full rounded-full ${a.change24h === undefined ? "bg-white/30" : a.change24h >= 0 ? "bg-gradient-to-r from-emerald-400 to-teal-300" : "bg-gradient-to-r from-purple-400 to-fuchsia-300"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-l border-white/10 pl-0 xl:pl-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Risk pulse</p>
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">
              {riskLabel}
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${riskScore > 70 ? "bg-gradient-to-r from-rose-400 to-orange-300" : riskScore > 45 ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-gradient-to-r from-emerald-400 to-teal-300"}`}
              style={{ width: `${riskScore}%` }}
            />
          </div>

          <div className="mt-4 space-y-2 text-sm text-white/65">
            <div className="flex items-center justify-between">
              <span>Exposure</span>
              <span className="font-medium text-white">{topAllocation.symbol}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Volatility</span>
              <span className="font-medium text-white">{Math.max(3, Math.round(Math.abs(avgMove) * 2))}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Watchlist</span>
              <span className="font-medium text-white">{assets.filter((a) => a.change24h !== undefined && Math.abs(a.change24h) >= 5).length} assets</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-4 border-b border-white/10 py-4">
        <div>
          <p className="text-sm font-medium text-white">Holdings</p>
          <p className="mt-1 text-xs text-white/40">Position value and recorded 24h move</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">{assets.length} assets</span>
      </div>

      <div className="divide-y divide-white/10">
        {assets.map((a) => {
          const isFocused = focusedSymbol === a.symbol;
          return (
          <div key={a.symbol} role="button" tabIndex={0} onClick={() => selectHolding(a.symbol)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectHolding(a.symbol); } }} aria-pressed={isFocused} aria-label={`Select ${a.symbol}, ${a.name}, ${a.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} dollars, ${formatPercentage(calculateAllocationPercentage(a.value, total))} of portfolio`} className={`relative flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 py-4 text-left transition-[background-color,box-shadow,opacity] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 focus-visible:outline-offset-4 sm:gap-4 ${focusedSymbol && !isFocused ? "opacity-45" : ""} ${isFocused ? "bg-purple-400/[0.08] shadow-[inset_3px_0_0_rgba(196,181,253,0.8)]" : "hover:bg-white/[0.025]"}`}>
            <div className={`pointer-events-none absolute right-3 top-2 flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.14em] text-purple-200 transition-opacity duration-500 ${isFocused ? "opacity-90" : "opacity-0"}`} aria-hidden={!isFocused}>
              <Sparkles size={10} />
              Selected
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-semibold text-white/80">
                  {a.symbol}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {a.name} <span className="text-xs text-white/40">· {a.symbol}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">{a.quantity.toLocaleString()} units • ${a.price} · {a.name.includes("Tokenized") ? "Solana tokenized asset" : "onchain asset"}</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-medium text-white">${a.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`mt-1 text-xs ${a.change24h === undefined ? "text-white/40" : a.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {a.change24h === undefined ? "—" : `${a.change24h >= 0 ? "+" : ""}${a.change24h}%`}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

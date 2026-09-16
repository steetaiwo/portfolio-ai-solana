"use client";

import { getDemoPortfolio } from "./demoData";

export default function PortfolioOverview() {
  const { assets, total } = getDemoPortfolio();

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/40">Total portfolio value</p>
          <div className="mt-2 text-4xl font-semibold tracking-tight">${total.toLocaleString()}</div>
          <p className="mt-1 text-xs text-white/40">Demo mode — deterministic sample data</p>
        </div>
        <div className="hidden md:block">
          <div className="h-24 w-48 rounded-2xl bg-gradient-to-br from-purple-600/10 to-white/[0.02]" />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {assets.map((a) => (
          <div key={a.symbol} className="flex items-center justify-between gap-4 rounded-xl border border-white/6 bg-white/2 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-white/5 flex items-center justify-center text-sm font-semibold text-white/80">
                  {a.symbol}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name} <span className="text-xs text-white/40">· {a.symbol}</span></p>
                  <p className="mt-0.5 text-xs text-white/50">{a.quantity.toLocaleString()} • ${a.price}</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-medium">${a.value.toLocaleString()}</div>
              <div className={`mt-1 text-xs ${a.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{a.change24h >= 0 ? "+" : ""}{a.change24h}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

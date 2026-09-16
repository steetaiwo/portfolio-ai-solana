"use client";

import { getDemoPortfolio } from "./demoData";

function currency(n: number) {
  return `$${n.toLocaleString()}`;
}

export default function AIInsights() {
  const { assets, total } = getDemoPortfolio();

  // Observation 1: Largest position
  const largest = assets.reduce((a, b) => (a.value > b.value ? a : b));

  // Observation 2: Concentration - percent of largest position
  const concentration = Math.round((largest.value / total) * 100);

  // Observation 3: Biggest gainer & loser
  const gainers = [...assets].sort((a, b) => b.change24h - a.change24h);
  const biggestGainer = gainers[0];
  const biggestLoser = gainers[gainers.length - 1];

  // Observation 4: Suggested watch (small positions with >5% move)
  const noteworthy = assets.filter((a) => Math.abs(a.change24h) >= 5);

  const observations = [
    {
      title: "Largest position",
      body: `${largest.name} (${largest.symbol}) — ${currency(largest.value)} (${concentration}% of portfolio). Consider whether this concentration aligns with your risk tolerance.`,
    },
    {
      title: "Top mover (24h)",
      body: `${biggestGainer.name} up ${biggestGainer.change24h}% — currently ${currency(biggestGainer.value)}. Might be worth taking profits or reviewing recent news.`,
    },
    {
      title: "Biggest decline (24h)",
      body: `${biggestLoser.name} down ${biggestLoser.change24h}% — currently ${currency(biggestLoser.value)}. If this is a strategic holding, consider whether this presents a buying opportunity.`,
    },
  ];

  if (noteworthy.length > 1) {
    observations.push({
      title: "Noteworthy movements",
      body: `Several small holdings moved significantly: ${noteworthy
        .map((n) => `${n.symbol} (${n.change24h >= 0 ? "+" : ""}${n.change24h}%)`)
        .join(", ")}. Keep these on a short watchlist.`,
    });
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/40">AI Intelligence</p>
          <h3 className="mt-1 text-xl font-semibold">Automatic observations</h3>
        </div>
        <div className="text-xs text-white/40">Generated from demo portfolio</div>
      </div>

      <div className="mt-6 grid gap-3">
        {observations.map((o) => (
          <div key={o.title} className="rounded-2xl border border-white/6 bg-purple-700/3 p-4">
            <p className="text-sm font-semibold text-white">{o.title}</p>
            <p className="mt-2 text-sm text-white/60">{o.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

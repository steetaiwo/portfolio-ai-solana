import { calculateAllocationPercentage, formatPercentage } from "../lib/portfolio/calculations";
import { getPortfolioSnapshot } from "../lib/portfolio/demoDataSource";
import type { PortfolioSnapshot, Position } from "../lib/portfolio/model";

export type Insight = {
  id: string;
  type: "largest" | "mover" | "decline" | "watch" | "summary";
  title: string;
  body: string;
  value?: number | string;
  symbol?: string;
  riskLayer?: "underlying-market" | "on-chain-token" | "combined";
};

export function generateInsights(snapshot: PortfolioSnapshot = getPortfolioSnapshot()) {
  const { positions: assets, totalValue: total } = snapshot.portfolio;

  if (assets.length === 0) {
    return [{
      id: "summary",
      type: "summary" as const,
      title: "Portfolio snapshot",
      body: "No positions are available in this portfolio snapshot.",
      value: total,
    }];
  }

  const largest = assets.reduce((a, b) => (a.value > b.value ? a : b));
  const concentration = formatPercentage(calculateAllocationPercentage(largest.value, total));

  const sortedByChange = assets
    .filter((asset): asset is Position & { change24h: number } => asset.change24h !== undefined)
    .sort((a, b) => b.change24h - a.change24h);
  const biggestGainer = sortedByChange[0];
  const biggestLoser = sortedByChange[sortedByChange.length - 1];

  const noteworthy = assets.filter((a): a is Position & { change24h: number } => a.change24h !== undefined && Math.abs(a.change24h) >= 5);

  const insights: Insight[] = [];

  insights.push({
    id: "summary",
    type: "summary",
    title: "Portfolio snapshot",
    body: `Demo portfolio valued at $${total.toLocaleString()} across ${assets.length} assets. Largest position: ${largest.symbol} (${concentration} of portfolio).`,
    value: total,
  });

  insights.push({
    id: "largest",
    type: "largest",
    title: `Largest position — ${largest.symbol}`,
    body: `${largest.name} is your largest holding at $${largest.value.toLocaleString()} (${concentration} of portfolio). This concentration is an underlying exposure story, while the tokenized representation also carries separate on-chain risk context.`,
    value: largest.value,
    symbol: largest.symbol,
    riskLayer: "combined",
  });

  if (biggestGainer && biggestLoser) {
    insights.push({
      id: "mover",
      type: "mover",
      title: `Top mover (24h) — ${biggestGainer.symbol}`,
      body: `${biggestGainer.name} moved ${biggestGainer.change24h >= 0 ? "+" : ""}${biggestGainer.change24h}% in the last 24h and is worth $${biggestGainer.value.toLocaleString()}.`,
      value: biggestGainer.value,
      symbol: biggestGainer.symbol,
    });

    insights.push({
      id: "decline",
      type: "decline",
      title: `Biggest decline (24h) — ${biggestLoser.symbol}`,
      body: `${biggestLoser.name} moved ${biggestLoser.change24h}% in the last 24h and is worth $${biggestLoser.value.toLocaleString()}. Assess if this aligns with your strategy.`,
      value: biggestLoser.value,
      symbol: biggestLoser.symbol,
    });
  }

  if (noteworthy.length > 0) {
    insights.push({
      id: "watch",
      type: "watch",
      title: "Watchlist candidates",
      body: `Notable moves: ${noteworthy.map((n) => `${n.symbol} (${n.change24h >= 0 ? "+" : ""}${n.change24h}%)`).join(", ")}. Consider adding to a short watchlist.`,
    });
  }

  return insights;
}

import { getPortfolioSnapshot } from "../lib/portfolio/demoDataSource";
import type { Position } from "../lib/portfolio/model";

export type DemoAsset = Position;

export function getDemoPortfolio() {
  const snapshot = getPortfolioSnapshot();

  return {
    assets: snapshot.portfolio.positions,
    total: snapshot.portfolio.totalValue,
    generatedAt: snapshot.capturedAt,
  };
}

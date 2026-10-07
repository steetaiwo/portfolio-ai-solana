import type { PortfolioSnapshot } from "./model";

export interface PortfolioDataSource {
  getSnapshot(): PortfolioSnapshot;
}

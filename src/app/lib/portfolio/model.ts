export type UnderlyingMarketState = "traditional-hours" | "open" | "closed" | "not-applicable";
export type OnChainMarketState = "continuous-onchain" | "not-applicable";

export interface AssetReference {
  symbol: string;
  name: string;
  assetType?: "equity" | "security" | "tokenized-asset" | "other";
}

export interface UnderlyingMarketRiskContext {
  marketState: UnderlyingMarketState;
  referenceAsset?: AssetReference;
  description: string;
  concentrationLabel: string;
}

export interface OnChainTokenRiskContext {
  marketState: OnChainMarketState;
  description: string;
  representationLabel: string;
}

export interface RiskContext {
  underlyingMarket: UnderlyingMarketRiskContext;
  onChainToken: OnChainTokenRiskContext;
}

export type ExposureCategory = "us-equity" | "on-chain";
export type RepresentationType = "tokenized-onchain" | "onchain-position";

export interface LookThroughMetadata {
  representationType: RepresentationType;
  exposureCategory: ExposureCategory;
  exposureDescription: string;
  metadataStatus: "application-demo-metadata";
}

export interface MarketStateContext {
  underlying: {
    label: string;
    state: UnderlyingMarketState;
  };
  onChain: {
    label: string;
    state: OnChainMarketState;
  };
}

export interface Asset {
  symbol: string;
  name: string;
  assetType?: "tokenized-equity" | "equity" | "tokenized-asset" | "other";
  chain?: string;
  underlyingAsset?: AssetReference;
  lookThrough?: LookThroughMetadata;
  marketStateContext?: MarketStateContext;
  riskContext?: RiskContext;
}

export interface Position extends Asset {
  quantity: number;
  price: number;
  value: number;
  change24h?: number;
}

export type PositionInput = Asset & {
  quantity: number;
  price: number;
  change24h?: number;
};

export interface Portfolio {
  positions: Position[];
  totalValue: number;
}

export type PortfolioSource = "demo" | "wallet" | "import";

export interface PortfolioSnapshot {
  portfolio: Portfolio;
  capturedAt: string;
  source: PortfolioSource;
}

export interface ScenarioResult {
  affectedPosition?: Position;
  scenarioPercent: number;
  positionImpact?: number;
  portfolioImpact: number;
  resultingPortfolioValue: number;
  portfolioImpactPercentage: number;
}

export interface EvidenceItem {
  label: string;
  value: string;
  detail?: string;
}

export interface CalculationProvenance {
  formula: string;
  inputs: EvidenceItem[];
  result: string;
}

export interface EvidenceRiskContext {
  underlying?: string;
  onChain?: string;
}

export interface EvidenceReceipt {
  id: string;
  claim: string;
  snapshotLabel: string;
  snapshotTimestamp?: string;
  evidence: EvidenceItem[];
  provenance: CalculationProvenance;
  assumptions: string[];
  riskContext?: EvidenceRiskContext;
}

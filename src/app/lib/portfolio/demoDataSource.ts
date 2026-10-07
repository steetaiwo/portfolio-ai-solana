import { createPortfolio } from "./calculations";
import type { PortfolioDataSource } from "./dataSource";
import type { PortfolioSnapshot, PositionInput } from "./model";

export const DEMO_POSITIONS: readonly PositionInput[] = [
	{
		symbol: "AAPLx",
		name: "Apple Tokenized Stock",
		assetType: "tokenized-equity",
		underlyingAsset: { symbol: "AAPL", name: "Apple", assetType: "equity" },
		lookThrough: {
			representationType: "tokenized-onchain",
			exposureCategory: "us-equity",
			exposureDescription: "Apple equity exposure through a tokenized/on-chain representation.",
			metadataStatus: "application-demo-metadata",
		},
		riskContext: {
			underlyingMarket: {
				marketState: "traditional-hours",
				referenceAsset: { symbol: "AAPL", name: "Apple", assetType: "equity" },
				description: "AAPLx represents concentrated Apple exposure in the underlying market. The underlying risk context tracks the reference asset and its traditional market-hours behavior.",
				concentrationLabel: "Underlying exposure",
			},
			onChainToken: {
				marketState: "continuous-onchain",
				description: "AAPLx is the tokenized representation of Apple exposure and sits in a separate continuous on-chain trading environment. This is distinct from the underlying market-hours context.",
				representationLabel: "Tokenized representation",
			},
		},
		quantity: 100,
		price: 298.92,
		change24h: 1.8,
	},
	{
		symbol: "TSLAx",
		name: "Tesla Tokenized Stock",
		assetType: "tokenized-equity",
		underlyingAsset: { symbol: "TSLA", name: "Tesla", assetType: "equity" },
		lookThrough: {
			representationType: "tokenized-onchain",
			exposureCategory: "us-equity",
			exposureDescription: "Tesla equity exposure through a tokenized/on-chain representation.",
			metadataStatus: "application-demo-metadata",
		},
		riskContext: {
			underlyingMarket: {
				marketState: "traditional-hours",
				referenceAsset: { symbol: "TSLA", name: "Tesla", assetType: "equity" },
				description: "TSLAx represents Tesla exposure in the underlying market. The underlying risk context follows the reference asset's traditional market-hours behavior.",
				concentrationLabel: "Underlying exposure",
			},
			onChainToken: {
				marketState: "continuous-onchain",
				description: "TSLAx exists as a tokenized representation in a continuously available on-chain environment, separate from the underlying market context.",
				representationLabel: "Tokenized representation",
			},
		},
		quantity: 50,
		price: 221.78,
		change24h: -2.6,
	},
	{
		symbol: "GRND",
		name: "Grindr",
		assetType: "tokenized-asset",
		riskContext: {
			underlyingMarket: {
				marketState: "not-applicable",
				description: "GRND has no configured underlying/reference-asset relationship in this demo snapshot.",
				concentrationLabel: "No configured underlying reference",
			},
			onChainToken: {
				marketState: "continuous-onchain",
				description: "GRND's tokenized representation exists in a continuous on-chain environment and should be interpreted separately from the underlying market context.",
				representationLabel: "Tokenized representation",
			},
		},
		quantity: 100,
		price: 72.319,
		change24h: 4.7,
	},
];

export const demoPortfolioDataSource: PortfolioDataSource = {
	getSnapshot(): PortfolioSnapshot {
		return {
			portfolio: createPortfolio(DEMO_POSITIONS),
			capturedAt: new Date().toISOString(),
			source: "demo",
		};
	},
};

// Swap this source in one place when a real portfolio source is introduced.
export const portfolioDataSource: PortfolioDataSource = demoPortfolioDataSource;

export function getPortfolioSnapshot(): PortfolioSnapshot {
	return portfolioDataSource.getSnapshot();
}

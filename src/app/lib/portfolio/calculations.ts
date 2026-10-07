import type {
  EvidenceReceipt,
  ExposureCategory,
  Portfolio,
  Position,
  PositionInput,
  RiskContext,
  ScenarioResult,
} from "./model";

// Monetary outputs are rounded to cents; percentages retain precision for display-layer formatting.
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Monetary values must be finite numbers.");
  }

  const cents = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("Monetary value exceeds the supported precision range.");
  }

  const rounded = cents / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number.`);
  }
}

export function calculatePositionValue(quantity: number, price: number): number {
  assertNonNegativeFinite(quantity, "Quantity");
  assertNonNegativeFinite(price, "Price");
  return roundMoney(quantity * price);
}

export function calculatePortfolioTotal(positions: readonly Pick<Position, "value">[]): number {
  const cents = positions.reduce((sum, position) => {
    assertNonNegativeFinite(position.value, "Position value");
    return sum + Math.round((position.value + Number.EPSILON) * 100);
  }, 0);

  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("Portfolio total exceeds the supported monetary range.");
  }

  return cents / 100;
}

export function calculateAllocationPercentage(positionValue: number, portfolioTotal: number): number {
  assertNonNegativeFinite(positionValue, "Position value");
  assertNonNegativeFinite(portfolioTotal, "Portfolio total");
  return portfolioTotal === 0 ? 0 : (positionValue / portfolioTotal) * 100;
}

export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError("Percentage values must be finite numbers.");
  }
  return `${value.toFixed(2)}%`;
}

export function calculateExposureCategorySummary(
  portfolio: Portfolio,
  category: ExposureCategory,
) {
  const positions = portfolio.positions.filter((position) => position.lookThrough?.exposureCategory === category);
  const positionValue = calculatePortfolioTotal(positions);

  return {
    category,
    positions,
    positionValue,
    portfolioWeight: calculateAllocationPercentage(positionValue, portfolio.totalValue),
  };
}

export function createRiskContext(position: Pick<Position, "symbol" | "name" | "underlyingAsset" | "assetType">): RiskContext {
  const referenceAsset = position.underlyingAsset;
  const hasUnderlyingReference = referenceAsset !== undefined;

  return {
    underlyingMarket: {
      marketState: hasUnderlyingReference ? "traditional-hours" : "not-applicable",
      referenceAsset,
      description: hasUnderlyingReference
        ? `${position.name} is a tokenized representation of ${referenceAsset.name} exposure. The underlying risk context tracks the traditional/reference asset and its market-hours behavior.`
        : `${position.symbol} has no configured underlying/reference-asset relationship in this portfolio snapshot.`,
      concentrationLabel: hasUnderlyingReference ? "Underlying exposure" : "No configured underlying reference",
    },
    onChainToken: {
      marketState: "continuous-onchain",
      description: `${position.symbol} also exists in a continuous on-chain token context. This risk layer is distinct from the underlying market context and remains conceptually independent from live execution data.`,
      representationLabel: "Tokenized representation",
    },
  };
}

export function getAssetRiskSummary(position: Pick<Position, "symbol" | "name" | "value" | "riskContext" | "underlyingAsset" | "assetType">, portfolioTotal: number) {
  const riskContext = position.riskContext ?? createRiskContext(position);
  return {
    allocation: calculateAllocationPercentage(position.value, portfolioTotal),
    underlying: riskContext.underlyingMarket.description,
    onChain: riskContext.onChainToken.description,
    referenceAsset: riskContext.underlyingMarket.referenceAsset,
  };
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatSignedPercentage(value: number) {
  const stringValue = `${Math.abs(value).toFixed(2)}%`;
  return `${value >= 0 ? "+" : "-"}${stringValue}`;
}

export function createConcentrationEvidenceReceipt(
  position: Pick<Position, "symbol" | "name" | "value" | "riskContext" | "underlyingAsset" | "assetType">,
  portfolioTotal: number,
  snapshotTimestamp?: string,
): EvidenceReceipt {
  const allocation = calculateAllocationPercentage(position.value, portfolioTotal);
  const allocationLabel = formatPercentage(allocation);
  const referenceAsset = position.underlyingAsset ?? position.riskContext?.underlyingMarket.referenceAsset;

  return {
    id: `evidence-concentration-${position.symbol}`,
    claim: `${position.symbol} is ${allocationLabel} of the current demo portfolio.`,
    snapshotLabel: "Demo snapshot / calculated from sample portfolio data",
    snapshotTimestamp,
    evidence: [
      { label: "Position value", value: formatCurrency(position.value) },
      { label: "Portfolio value", value: formatCurrency(portfolioTotal) },
      { label: "Allocation", value: allocationLabel, detail: "Position value ÷ portfolio value × 100" },
    ],
    provenance: {
      formula: `position value ÷ portfolio value × 100 = ${allocationLabel}`,
      inputs: [
        { label: "Position value", value: formatCurrency(position.value) },
        { label: "Portfolio value", value: formatCurrency(portfolioTotal) },
      ],
      result: allocationLabel,
    },
    assumptions: [
      "Calculated from the current demo portfolio snapshot.",
      "Other positions are held constant for this concentration calculation.",
      "This is a deterministic portfolio math result, not a live market reading.",
    ],
    riskContext: {
      underlying: referenceAsset
        ? `${referenceAsset.name} is the underlying reference used by this tokenized position.`
        : `${position.symbol} has no configured underlying/reference-asset relationship in this demo snapshot.`,
      onChain: `${position.symbol} is the tokenized representation and lives in a separate continuous on-chain context in this demo.`,
    },
  };
}

export function createLookThroughEvidenceReceipt(
  position: Position,
  portfolioTotal: number,
  snapshotTimestamp?: string,
): EvidenceReceipt | null {
  const metadata = position.lookThrough;
  const referenceAsset = position.underlyingAsset;
  if (!metadata || !referenceAsset) return null;

  const allocation = calculateAllocationPercentage(position.value, portfolioTotal);
  const allocationLabel = formatPercentage(allocation);
  const representationLabel = metadata.representationType === "tokenized-onchain"
    ? "Tokenized/on-chain"
    : "On-chain position";
  const categoryLabel = metadata.exposureCategory === "us-equity" ? "U.S. equity" : "On-chain";
  const positionValue = formatCurrency(position.value);
  const portfolioValue = formatCurrency(portfolioTotal);

  return {
    id: `evidence-look-through-${position.symbol}`,
    claim: `${allocationLabel} of the portfolio is exposed to the ${referenceAsset.name} reference asset through ${position.symbol}.`,
    snapshotLabel: "Demo snapshot / configured asset metadata",
    snapshotTimestamp,
    evidence: [
      { label: `${position.symbol} value`, value: positionValue },
      { label: "Portfolio value", value: portfolioValue },
      { label: "Portfolio weight", value: allocationLabel },
      { label: "Underlying/reference asset", value: referenceAsset.name, detail: referenceAsset.symbol },
      { label: "Representation", value: representationLabel },
      { label: "Exposure category", value: categoryLabel },
    ],
    provenance: {
      formula: `${positionValue} ÷ ${portfolioValue} = ${allocationLabel}`,
      inputs: [
        { label: `${position.symbol} value`, value: positionValue },
        { label: "Portfolio value", value: portfolioValue },
        { label: "Underlying/reference asset", value: referenceAsset.name, detail: referenceAsset.symbol },
        { label: "Representation", value: representationLabel },
      ],
      result: allocationLabel,
    },
    assumptions: [
      "Derived from the demo portfolio snapshot and application-configured asset metadata.",
      "This relationship is not verified by an external look-through provider.",
      "Underlying-market concentration and on-chain/token context are separate risk layers.",
    ],
    riskContext: {
      underlying: `${referenceAsset.name} exposure is classified as ${categoryLabel}; position concentration is measured from this snapshot.`,
      onChain: `${position.symbol} is the ${representationLabel.toLowerCase()} representation; its on-chain/token context remains distinct from underlying-market risk.`,
    },
  };
}

export function createExposureCategoryEvidenceReceipt(
  portfolio: Portfolio,
  category: ExposureCategory,
  snapshotTimestamp?: string,
): EvidenceReceipt | null {
  const summary = calculateExposureCategorySummary(portfolio, category);
  if (summary.positions.length === 0) return null;

  const categoryLabel = category === "us-equity" ? "U.S. equity" : "on-chain";
  const allocationLabel = formatPercentage(summary.portfolioWeight);
  const positionValue = formatCurrency(summary.positionValue);
  const portfolioValue = formatCurrency(portfolio.totalValue);
  const inputs = summary.positions.map((position) => ({
    label: `${position.symbol} value`,
    value: formatCurrency(position.value),
    detail: position.underlyingAsset?.name ?? position.lookThrough?.exposureDescription,
  }));

  return {
    id: `evidence-exposure-category-${category}`,
    claim: `${allocationLabel} of the portfolio is classified as ${categoryLabel} exposure by configured asset metadata.`,
    snapshotLabel: "Demo snapshot / configured asset metadata",
    snapshotTimestamp,
    evidence: [
      ...inputs,
      { label: "Category exposure value", value: positionValue },
      { label: "Portfolio value", value: portfolioValue },
      { label: "Portfolio weight", value: allocationLabel },
    ],
    provenance: {
      formula: `(${summary.positions.map((position) => formatCurrency(position.value)).join(" + ")}) ÷ ${portfolioValue} = ${allocationLabel}`,
      inputs: [...inputs, { label: "Portfolio value", value: portfolioValue }],
      result: allocationLabel,
    },
    assumptions: [
      "Aggregated from positions carrying this exposure category in application-configured demo metadata.",
      "Weights are calculated from the current demo portfolio snapshot, not a live external provider.",
      "On-chain/token context remains separate from underlying-market risk.",
    ],
    riskContext: {
      underlying: `Category membership is based only on configured ${categoryLabel} metadata.`,
      onChain: "Token representation and underlying-market exposure are tracked as distinct contexts.",
    },
  };
}

export function createScenarioEvidenceReceipt(
  scenario: { symbol?: string; changePercent: number; isPortfolio: boolean },
  portfolio: Portfolio,
  portfolioTotal: number,
  snapshotTimestamp?: string,
): EvidenceReceipt {
  const result = scenario.isPortfolio
    ? calculatePortfolioScenario(portfolio, scenario.changePercent)
    : scenario.symbol
      ? calculatePositionScenario(portfolio, scenario.symbol, scenario.changePercent)
      : calculatePortfolioScenario(portfolio, scenario.changePercent);

  const currentPortfolioValue = portfolioTotal;
  const symbolName = scenario.symbol ?? "Portfolio";
  const claim = scenario.isPortfolio
    ? `${symbolName} ${scenario.changePercent >= 0 ? "+" : ""}${scenario.changePercent}% scenario impact is ${formatSignedCurrency(result.portfolioImpact)} on the demo portfolio.`
    : `${symbolName} ${scenario.changePercent >= 0 ? "+" : ""}${scenario.changePercent}% scenario impact is ${formatSignedCurrency(result.portfolioImpact)} on the demo portfolio.`;

  const asset = scenario.symbol ? portfolio.positions.find((item) => item.symbol === scenario.symbol) : undefined;
  const evidence = scenario.isPortfolio
    ? [
        { label: "Portfolio value", value: formatCurrency(currentPortfolioValue) },
        { label: "Scenario move", value: `${scenario.changePercent >= 0 ? "+" : ""}${scenario.changePercent}%` },
        { label: "Portfolio impact", value: formatSignedPercentage(result.portfolioImpactPercentage) },
        { label: "Resulting portfolio value", value: formatCurrency(result.resultingPortfolioValue) },
      ]
    : asset
      ? [
          { label: "Position value", value: formatCurrency(asset.value) },
          { label: "Scenario move", value: `${scenario.changePercent >= 0 ? "+" : ""}${scenario.changePercent}%` },
          { label: "Position impact", value: formatSignedCurrency(result.portfolioImpact) },
          { label: "Portfolio impact", value: formatSignedPercentage(result.portfolioImpactPercentage) },
          { label: "Resulting portfolio value", value: formatCurrency(result.resultingPortfolioValue) },
        ]
      : [
          { label: "Portfolio value", value: formatCurrency(currentPortfolioValue) },
          { label: "Scenario move", value: `${scenario.changePercent >= 0 ? "+" : ""}${scenario.changePercent}%` },
          { label: "Portfolio impact", value: formatSignedPercentage(result.portfolioImpactPercentage) },
          { label: "Resulting portfolio value", value: formatCurrency(result.resultingPortfolioValue) },
        ];

  const formula = scenario.isPortfolio
    ? `${formatCurrency(currentPortfolioValue)} × ${scenario.changePercent}% = ${formatSignedCurrency(result.portfolioImpact)}; ${formatCurrency(currentPortfolioValue)} ${result.portfolioImpact >= 0 ? "+" : "-"}${formatCurrency(Math.abs(result.portfolioImpact))} = ${formatCurrency(result.resultingPortfolioValue)}`
    : asset
      ? `${formatCurrency(asset.value)} × ${scenario.changePercent}% = ${formatSignedCurrency(result.portfolioImpact)}; ${formatCurrency(currentPortfolioValue)} ${result.portfolioImpact >= 0 ? "+" : "-"}${formatCurrency(Math.abs(result.portfolioImpact))} = ${formatCurrency(result.resultingPortfolioValue)}`
      : `${formatCurrency(currentPortfolioValue)} × ${scenario.changePercent}% = ${formatSignedCurrency(result.portfolioImpact)}; ${formatCurrency(currentPortfolioValue)} ${result.portfolioImpact >= 0 ? "+" : "-"}${formatCurrency(Math.abs(result.portfolioImpact))} = ${formatCurrency(result.resultingPortfolioValue)}`;

  return {
    id: `evidence-scenario-${symbolName}-${scenario.changePercent}`,
    claim,
    snapshotLabel: "Demo snapshot / calculated from sample portfolio data",
    snapshotTimestamp,
    evidence,
    provenance: {
      formula,
      inputs: evidence.filter((item) => item.label !== "Resulting portfolio value" && item.label !== "Portfolio impact"),
      result: `${formatSignedPercentage(result.portfolioImpactPercentage)}`,
    },
    assumptions: [
      "Single-position shock applied to the selected asset; other positions unchanged.",
      "No fees, no slippage, and no live execution assumptions are included.",
      "Based on the demo portfolio snapshot and not a live market forecast.",
      "This is an illustration, not a prediction.",
    ],
    riskContext: asset
      ? {
          underlying: asset.underlyingAsset
            ? `${asset.underlyingAsset.name} is the underlying reference for this tokenized exposure.`
            : `${asset.symbol} has no configured underlying/reference-asset relationship in this demo snapshot.`,
          onChain: `${asset.symbol} is the tokenized representation used in the demo and is considered separately from the underlying reference asset.`,
        }
      : undefined,
  };
}

export function calculateWeightedChangePercentage(positions: readonly Position[], portfolioTotal: number): number {
  assertNonNegativeFinite(portfolioTotal, "Portfolio total");
  if (portfolioTotal === 0) return 0;

  const weightedChange = positions.reduce((sum, position) => {
    if (position.change24h === undefined) return sum;
    if (!Number.isFinite(position.change24h)) {
      throw new RangeError("24h change must be a finite number when provided.");
    }
    return sum + (position.value * position.change24h) / 100;
  }, 0);

  return (weightedChange / portfolioTotal) * 100;
}

export function createPortfolio(inputs: readonly PositionInput[]): Portfolio {
  const positions: Position[] = inputs.map((input) => {
    if (input.change24h !== undefined && !Number.isFinite(input.change24h)) {
      throw new RangeError("24h change must be a finite number when provided.");
    }

    return {
      ...input,
      value: calculatePositionValue(input.quantity, input.price),
    };
  });

  return { positions, totalValue: calculatePortfolioTotal(positions) };
}

export function calculatePositionScenario(
  portfolio: Portfolio,
  symbol: string,
  scenarioPercent: number,
): ScenarioResult {
  if (!Number.isFinite(scenarioPercent) || scenarioPercent < -100) {
    throw new RangeError("Scenario percentage must be finite and at least -100%.");
  }

  const affectedPosition = portfolio.positions.find((position) => position.symbol === symbol);
  if (!affectedPosition) {
    throw new RangeError(`Position ${symbol} was not found in the portfolio.`);
  }

  const positionImpact = roundMoney((affectedPosition.value * scenarioPercent) / 100);
  const portfolioImpact = positionImpact;
  const resultingPortfolioValue = roundMoney(portfolio.totalValue + portfolioImpact);
  const portfolioImpactPercentage = portfolio.totalValue === 0
    ? 0
    : (portfolioImpact / portfolio.totalValue) * 100;

  return {
    affectedPosition,
    scenarioPercent,
    positionImpact,
    portfolioImpact,
    resultingPortfolioValue,
    portfolioImpactPercentage,
  };
}

export function calculatePortfolioScenario(portfolio: Portfolio, scenarioPercent: number): ScenarioResult {
  if (!Number.isFinite(scenarioPercent) || scenarioPercent < -100) {
    throw new RangeError("Scenario percentage must be finite and at least -100%.");
  }

  const portfolioImpact = roundMoney((portfolio.totalValue * scenarioPercent) / 100);
  return {
    scenarioPercent,
    portfolioImpact,
    resultingPortfolioValue: roundMoney(portfolio.totalValue + portfolioImpact),
    portfolioImpactPercentage: portfolio.totalValue === 0
      ? 0
      : (portfolioImpact / portfolio.totalValue) * 100,
  };
}

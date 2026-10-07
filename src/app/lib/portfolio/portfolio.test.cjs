/* eslint @typescript-eslint/no-require-imports: "off" */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

// Load the domain's TypeScript directly so Node's built-in test runner needs no extra dependency.
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { demoPortfolioDataSource } = require("./demoDataSource.ts");
const {
  calculateAllocationPercentage,
  calculatePortfolioTotal,
  calculatePortfolioScenario,
  calculatePositionScenario,
  calculatePositionValue,
  calculateExposureCategorySummary,
  createExposureCategoryEvidenceReceipt,
  createLookThroughEvidenceReceipt,
  formatPercentage,
  createPortfolio,
} = require("./calculations.ts");
const { DEMO_POSITIONS } = require("./demoDataSource.ts");

const closeTo = (actual, expected, tolerance = 0.005) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

test("canonical demo fixture values and total are calculated from source positions", () => {
  const { positions, totalValue } = demoPortfolioDataSource.getSnapshot().portfolio;
  assert.deepEqual(positions.map(({ symbol, value }) => [symbol, value]), [
    ["AAPLx", 29892],
    ["TSLAx", 11089],
    ["GRND", 7231.9],
  ]);
  assert.equal(totalValue, 48212.9);
});

test("position valuation and allocations derive from portfolio values", () => {
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  assert.equal(calculatePositionValue(100, 298.92), 29892);
  assert.equal(calculatePortfolioTotal(portfolio.positions), 48212.9);
  closeTo(calculateAllocationPercentage(29892, portfolio.totalValue), 62, 0.001);
  closeTo(calculateAllocationPercentage(11089, portfolio.totalValue), 23, 0.001);
  closeTo(calculateAllocationPercentage(7231.9, portfolio.totalValue), 15, 0.001);
  assert.equal(formatPercentage(calculateAllocationPercentage(29892, portfolio.totalValue)), "62.00%");
  assert.equal(formatPercentage(calculateAllocationPercentage(11089, portfolio.totalValue)), "23.00%");
  assert.equal(formatPercentage(calculateAllocationPercentage(7231.9, portfolio.totalValue)), "15.00%");
  assert.equal(formatPercentage(calculateExposureCategorySummary(portfolio, "us-equity").portfolioWeight), "85.00%");
  assert.equal(calculateAllocationPercentage(10, 0), 0);
  assert.throws(() => calculatePortfolioTotal([{ value: -1 }]), RangeError);
  assert.throws(() => calculatePortfolioTotal([{ value: Number.NaN }]), RangeError);
  assert.throws(() => calculateAllocationPercentage(-1, 10), RangeError);
});

test("AAPLx -10% sensitivity returns position and portfolio impact", () => {
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  const result = calculatePositionScenario(portfolio, "AAPLx", -10);
  assert.equal(result.positionImpact, -2989.2);
  assert.equal(result.portfolioImpact, -2989.2);
  assert.equal(result.resultingPortfolioValue, 45223.7);
  closeTo(result.portfolioImpactPercentage, -6.2, 0.005);
});

test("zero, positive, negative, and whole-portfolio scenarios are derived", () => {
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  const noChange = calculatePositionScenario(portfolio, "AAPLx", 0);
  assert.equal(noChange.positionImpact, 0);
  assert.equal(noChange.resultingPortfolioValue, portfolio.totalValue);

  const gain = calculatePositionScenario(portfolio, "AAPLx", 10);
  assert.equal(gain.positionImpact, 2989.2);
  assert.equal(gain.resultingPortfolioValue, 51202.1);

  const loss = calculatePositionScenario(portfolio, "AAPLx", -10);
  assert.equal(loss.positionImpact, -2989.2);

  const wholePortfolio = calculatePortfolioScenario(portfolio, -10);
  assert.equal(wholePortfolio.positionImpact, undefined);
  assert.equal(wholePortfolio.portfolioImpact, -4821.29);
  assert.equal(wholePortfolio.resultingPortfolioValue, 43391.61);
});

test("tokenized assets expose distinct underlying and on-chain risk contexts", () => {
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  const aapl = portfolio.positions.find((position) => position.symbol === "AAPLx");
  const tsla = portfolio.positions.find((position) => position.symbol === "TSLAx");
  assert.ok(aapl && aapl.riskContext);
  assert.equal(aapl.riskContext.underlyingMarket.referenceAsset?.symbol, "AAPL");
  assert.match(aapl.riskContext.underlyingMarket.description, /Apple/i);
  assert.equal(aapl.riskContext.onChainToken.marketState, "continuous-onchain");
  assert.equal(aapl.riskContext.underlyingMarket.marketState, "traditional-hours");
  assert.ok(tsla && tsla.riskContext);
  assert.equal(tsla.riskContext.underlyingMarket.referenceAsset?.symbol, "TSLA");
});

test("look-through exposure maps configured token metadata to reference assets and categories", () => {
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  const aapl = portfolio.positions.find((position) => position.symbol === "AAPLx");
  const tsla = portfolio.positions.find((position) => position.symbol === "TSLAx");
  const grnd = portfolio.positions.find((position) => position.symbol === "GRND");

  assert.equal(aapl.lookThrough.representationType, "tokenized-onchain");
  assert.equal(aapl.underlyingAsset.name, "Apple");
  assert.equal(aapl.underlyingAsset.symbol, "AAPL");
  assert.equal(aapl.lookThrough.exposureCategory, "us-equity");
  assert.equal(aapl.lookThrough.metadataStatus, "application-demo-metadata");
  assert.equal(tsla.underlyingAsset.name, "Tesla");
  assert.equal(tsla.underlyingAsset.symbol, "TSLA");
  assert.equal(tsla.lookThrough.exposureCategory, "us-equity");
  assert.equal(grnd.underlyingAsset, undefined);
  assert.equal(grnd.lookThrough, undefined);
  assert.equal(grnd.riskContext.underlyingMarket.marketState, "not-applicable");
  assert.equal(grnd.riskContext.onChainToken.marketState, "continuous-onchain");

  closeTo(calculateAllocationPercentage(aapl.value, portfolio.totalValue), 62.0001, 0.001);
  closeTo(calculateAllocationPercentage(tsla.value, portfolio.totalValue), 23, 0.001);
  const equityExposure = calculateExposureCategorySummary(portfolio, "us-equity");
  assert.deepEqual(equityExposure.positions.map((position) => position.symbol), ["AAPLx", "TSLAx"]);
  closeTo(equityExposure.portfolioWeight, 85, 0.001);

  const receipt = createLookThroughEvidenceReceipt(aapl, portfolio.totalValue);
  assert.ok(receipt);
  assert.equal(receipt.claim, "62.00% of the portfolio is exposed to the Apple reference asset through AAPLx.");
  assert.equal(receipt.evidence.find((item) => item.label === "Underlying/reference asset").value, "Apple");
  assert.equal(receipt.evidence.find((item) => item.label === "Representation").value, "Tokenized/on-chain");
  assert.equal(receipt.provenance.formula, "$29,892.00 ÷ $48,212.90 = 62.00%");
  assert.ok(receipt.assumptions.some((assumption) => assumption.includes("not verified by an external")));
  assert.equal(createLookThroughEvidenceReceipt(grnd, portfolio.totalValue), null);
});

test("exposure category aggregation includes future compatible metadata without symbol-specific logic", () => {
  const portfolio = createPortfolio([
    ...DEMO_POSITIONS,
    {
      symbol: "FUTURE",
      name: "Future Tokenized Equity",
      assetType: "tokenized-equity",
      underlyingAsset: { symbol: "FUT", name: "Future Corp", assetType: "equity" },
      lookThrough: {
        representationType: "tokenized-onchain",
        exposureCategory: "us-equity",
        exposureDescription: "Future Corp equity exposure through a tokenized/on-chain representation.",
        metadataStatus: "application-demo-metadata",
      },
      quantity: 1,
      price: 100,
    },
  ]);
  const summary = calculateExposureCategorySummary(portfolio, "us-equity");
  assert.deepEqual(summary.positions.map((position) => position.symbol), ["AAPLx", "TSLAx", "FUTURE"]);
  assert.equal(summary.positionValue, 41081);
  closeTo(summary.portfolioWeight, 85.03, 0.01);
  const evidence = createExposureCategoryEvidenceReceipt(portfolio, "us-equity");
  assert.ok(evidence);
  assert.match(evidence.claim, /configured asset metadata/);
  assert.equal(evidence.provenance.inputs.filter((input) => input.label.endsWith("value")).length, 4);
});

test("evidence receipts explain concentration and scenario calculations without inventing live data", () => {
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  const aapl = portfolio.positions.find((position) => position.symbol === "AAPLx");
  const concentrationReceipt = require("./calculations.ts").createConcentrationEvidenceReceipt(aapl, portfolio.totalValue);
  assert.equal(concentrationReceipt.claim, "AAPLx is 62.00% of the current demo portfolio.");
  assert.equal(concentrationReceipt.evidence[0].value, "$29,892.00");
  assert.equal(concentrationReceipt.evidence[1].value, "$48,212.90");
  assert.equal(concentrationReceipt.provenance.result, "62.00%");
  assert.match(concentrationReceipt.provenance.formula, /position value.*portfolio value/);

  const scenarioReceipt = require("./calculations.ts").createScenarioEvidenceReceipt({
    symbol: "AAPLx",
    changePercent: -10,
    isPortfolio: false,
  }, portfolio, portfolio.totalValue);
  assert.equal(scenarioReceipt.claim, "AAPLx -10% scenario impact is -$2,989.20 on the demo portfolio.");
  assert.equal(scenarioReceipt.evidence.find((item) => item.label === "Position impact").value, "-$2,989.20");
  assert.equal(scenarioReceipt.evidence.find((item) => item.label === "Resulting portfolio value").value, "$45,223.70");
  assert.equal(scenarioReceipt.evidence.find((item) => item.label === "Portfolio impact").value, "-6.20%");
  assert.ok(scenarioReceipt.assumptions.some((assumption) => assumption.includes("other positions unchanged")));
  assert.ok(scenarioReceipt.snapshotLabel.includes("Demo snapshot"));

  const grndScenarioReceipt = require("./calculations.ts").createScenarioEvidenceReceipt({
    symbol: "GRND",
    changePercent: -10,
    isPortfolio: false,
  }, portfolio, portfolio.totalValue);
  assert.match(grndScenarioReceipt.riskContext.underlying, /no configured underlying\/reference-asset relationship/);
});

test("zero-value positions and zero-total portfolios are handled safely", () => {
  const empty = createPortfolio([{ symbol: "ZERO", name: "Zero position", quantity: 0, price: 10 }]);
  assert.equal(empty.totalValue, 0);
  assert.equal(calculateAllocationPercentage(empty.positions[0].value, empty.totalValue), 0);
  assert.equal(calculatePositionScenario(empty, "ZERO", 0).portfolioImpactPercentage, 0);
});

test("invalid quantities, prices, and scenario percentages are rejected", () => {
  assert.throws(() => calculatePositionValue(-1, 5), RangeError);
  assert.throws(() => calculatePositionValue(1, Number.NaN), RangeError);
  assert.throws(() => createPortfolio([{ symbol: "BAD", name: "Bad", quantity: 1, price: -1 }]));
  const portfolio = demoPortfolioDataSource.getSnapshot().portfolio;
  assert.throws(() => calculatePositionScenario(portfolio, "AAPLx", Number.NaN), RangeError);
  assert.throws(() => calculatePositionScenario(portfolio, "AAPLx", -100.01), RangeError);
  assert.throws(() => calculatePositionScenario(portfolio, "MISSING", 10), RangeError);
});

assert.equal(DEMO_POSITIONS.length, 3);

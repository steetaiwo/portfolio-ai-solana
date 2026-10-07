"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, ScanLine, Send, Sparkles, X } from "lucide-react";
import { generateInsights } from "./insights";
import {
  calculateAllocationPercentage,
  calculateExposureCategorySummary,
  calculatePortfolioScenario,
  calculatePositionScenario,
  createConcentrationEvidenceReceipt,
  createExposureCategoryEvidenceReceipt,
  createLookThroughEvidenceReceipt,
  createScenarioEvidenceReceipt,
  formatPercentage,
  getAssetRiskSummary,
} from "../lib/portfolio/calculations";
import { getPortfolioSnapshot as getPortfolioDataSnapshot } from "../lib/portfolio/demoDataSource";
import type { EvidenceReceipt, Portfolio, Position } from "../lib/portfolio/model";

type Message = { id: string; role: "assistant" | "user"; text: string };
type FocusSignal = { eyebrow: string; title: string; body: string; symbol?: string };
type QuestionCategory = "portfolio" | "allocation" | "look-through" | "movers" | "asset" | "risk" | "watch" | "unknown";
type ParsedScenario = { symbol?: string; changePercent: number | null; isPortfolio: boolean };
type InvestigationContext = "idle" | "portfolio" | "asset" | "scenario";
type AnalysisStage = "idle" | "complete";
type Answer = { text: string; focus?: FocusSignal; followUps: string[]; scenario?: ParsedScenario; context?: InvestigationContext; evidence?: EvidenceReceipt | null };
type ScenarioPresentation = { symbol: string; changePercent: number; currentValue: number; allocation: number; impact: number; afterValue: number; portfolioEffect: number };
type PortfolioSummary = {
  total: number;
  assetCount: number;
  largest: Position;
  largestAllocation: number;
  distribution: string;
  mover?: ReturnType<typeof generateInsights>[number];
};

function normalizeQuestion(question: string) {
  return question.trim().toLowerCase().replace(/[?!.,]/g, "");
}

function getAssetFromQuestion(question: string, symbols: string[]) {
  const normalizedQuestion = normalizeQuestion(question);
  return symbols.find((symbol) => normalizedQuestion.includes(symbol.toLowerCase()));
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function createPortfolioSummary(
  portfolio: Portfolio,
  insights: ReturnType<typeof generateInsights>,
): PortfolioSummary {
  const { positions: assets, totalValue: total } = portfolio;
  const largest = assets.reduce((a, b) => (a.value > b.value ? a : b));
  const mover = insights.find((insight) => insight.id === "mover") ?? insights[0];
  return {
    total,
    assetCount: assets.length,
    largest,
    largestAllocation: calculateAllocationPercentage(largest.value, total),
    distribution: assets.map((asset) => `${asset.symbol} ${formatPercentage(calculateAllocationPercentage(asset.value, total))}`).join(" · "),
    mover,
  };
}

function getConcentrationInsight(snapshot: PortfolioSummary) {
  return `${snapshot.largest.symbol} accounts for ${formatPercentage(snapshot.largestAllocation)} of the demo portfolio, so a movement in that position has a relatively large effect on total portfolio value.`;
}

function parseScenarioQuestion(question: string, assets: Position[]): ParsedScenario | null {
  const normalizedQuestion = normalizeQuestion(question);
  const hasScenarioLanguage = /what if|what happens|scenario|how much would.*(lose|gain)|if .* (drop|fall|decline|down|lose|rise|grow|gain|up|increase|move)/.test(normalizedQuestion);
  const directionIsNegative = /drop|drops|fall|falls|decline|declines|down|lose|loses/.test(normalizedQuestion);
  const directionIsPositive = /rise|rises|grow|grows|gain|gains|up|increase|increases/.test(normalizedQuestion);
  const percentageMatch = normalizedQuestion.match(/(-?\d+(?:\.\d+)?)\s*(?:%|percent)/);
  const hasAsset = getAssetFromQuestion(normalizedQuestion, assets.map((asset) => asset.symbol));
  const hasPortfolio = /my portfolio|the portfolio|portfolio/.test(normalizedQuestion);

  if (!hasScenarioLanguage && !(hasAsset && (percentageMatch || directionIsNegative || directionIsPositive))) return null;

  const largest = assets.reduce((a, b) => (a.value > b.value ? a : b));
  const symbol = hasAsset ?? (/biggest holding|largest holding|largest position/.test(normalizedQuestion) ? largest.symbol : undefined);
  const rawPercentage = percentageMatch ? Number(percentageMatch[1]) : null;
  const magnitude = rawPercentage === null ? null : Math.abs(rawPercentage);
  let changePercent: number | null = null;
  if (rawPercentage !== null) {
    changePercent = rawPercentage < 0
      ? rawPercentage
      : directionIsNegative
        ? -magnitude!
        : directionIsPositive
          ? magnitude!
          : rawPercentage;
  }

  return { symbol, changePercent, isPortfolio: !symbol && hasPortfolio };
}

function generateScenarioAnswer(
  scenario: ParsedScenario,
  portfolio: Portfolio,
  total: number,
  snapshotTimestamp?: string,
): Answer {
  const assets = portfolio.positions;
  const followUps = scenario.symbol ? ["Try +10%", "Try -20%", "Compare another asset"] : ["Try AAPLx -10%", "Try TSLAx +20%"];
  if (scenario.changePercent === null || (!scenario.symbol && !scenario.isPortfolio)) {
    return {
      text: "Scenario analysis needs an asset and percentage. Try “What if AAPLx drops 10%?” or ask about the whole portfolio, such as “What if my portfolio drops 10%?”",
      followUps,
      scenario,
      context: "scenario",
    };
  }

  const change = scenario.changePercent;
  if (scenario.isPortfolio) {
    const result = calculatePortfolioScenario(portfolio, change);
    const evidence = createScenarioEvidenceReceipt({ symbol: undefined, changePercent: change, isPortfolio: true }, portfolio, total, snapshotTimestamp);
    return {
      text: `Illustrative scenario analysis: whole portfolio ${change >= 0 ? "+" : ""}${change}%. Current portfolio value: ${formatCurrency(total)}. Estimated portfolio impact: ${formatSignedCurrency(result.portfolioImpact)}. Estimated new portfolio value: ${formatCurrency(result.resultingPortfolioValue)}. This sensitivity scenario applies the move to the full demo portfolio; it is not a prediction.`,
      followUps: ["Try AAPLx -10%", "Try TSLAx +20%"],
      scenario,
      context: "scenario",
      evidence,
    };
  }

  const asset = assets.find((item) => item.symbol === scenario.symbol);
  if (!asset) {
    return {
      text: "I could not match that asset to the demo portfolio. Try AAPLx, TSLAx, or GRND in a scenario question.",
      followUps: ["Try AAPLx -10%", "Try TSLAx +20%"],
      scenario,
    };
  }

  const result = calculatePositionScenario(portfolio, asset.symbol, change);
  const allocation = calculateAllocationPercentage(asset.value, total);
  const focus: FocusSignal = {
    eyebrow: "Scenario signal",
    title: asset.name,
    body: `${formatCurrency(asset.value)} position · ${formatPercentage(allocation)} of the demo portfolio · illustrative ${change >= 0 ? "+" : ""}${change}% move.`,
    symbol: asset.symbol,
  };
  const evidence = createScenarioEvidenceReceipt({ symbol: asset.symbol, changePercent: change, isPortfolio: false }, portfolio, total, snapshotTimestamp);

  return {
    text: `Illustrative scenario analysis: ${asset.symbol} ${change >= 0 ? "+" : ""}${change}%. Current ${asset.symbol} position: ${formatCurrency(asset.value)}. Estimated portfolio impact: ${formatSignedCurrency(result.portfolioImpact)}. Estimated new portfolio value: ${formatCurrency(result.resultingPortfolioValue)}. Because ${asset.symbol} represents ${formatPercentage(allocation)} of the demo portfolio, this move would have a ${allocation >= 50 ? "significant" : "visible"} allocation impact. This is a sensitivity scenario, not a prediction.`,
    focus,
    followUps: ["Try +10%", "Try -20%", "Compare another asset"],
    scenario,
    context: "scenario",
    evidence,
  };
}

function classifyQuestion(question: string, symbols: string[]): QuestionCategory {
  const normalizedQuestion = normalizeQuestion(question);
  if (/what am i actually exposed to|look.?through|underlying exposure|how much.*(u\.?s\.? equities|equities)|exposed to (u\.?s\.? )?equities|equity exposure/.test(normalizedQuestion)) return "look-through";
  if (getAssetFromQuestion(normalizedQuestion, symbols)) return "asset";
  if (/biggest holding|largest allocation|most exposed|distributed|allocation|exposure|where.*money|most of my money/.test(normalizedQuestion)) return "allocation";
  if (/changed|moving|moved|performing|best today|24h|momentum/.test(normalizedQuestion)) return "movers";
  if (/concentrated|biggest risk|careful|diversified|risk/.test(normalizedQuestion)) return "risk";
  if (/watch|pay attention|signals?/.test(normalizedQuestion)) return "watch";
  if (/total|worth|how many assets|overview|analyze|summarize|summary|full portfolio|how is my portfolio|healthy|stands out|most important|portfolio/.test(normalizedQuestion)) return "portfolio";
  return "unknown";
}

function getAssetKnowledge(symbol: string, assets: Position[], total: number) {
  const asset = assets.find((item) => item.symbol === symbol);
  if (!asset) return null;
  const allocation = calculateAllocationPercentage(asset.value, total);
  const description = asset.symbol === "AAPLx"
    ? "Apple tokenized stock and the largest demo holding"
    : asset.symbol === "TSLAx"
      ? "Tesla tokenized stock"
      : "Grindr";
  return { asset, allocation, description };
}

function generatePortfolioAnswer(
  question: string,
  portfolio: Portfolio,
  insights: ReturnType<typeof generateInsights>,
  snapshotTimestamp?: string,
): Answer {
  const assets = portfolio.positions;
  const total = portfolio.totalValue;
  const symbols = assets.map((asset) => asset.symbol);
  const scenario = parseScenarioQuestion(question, assets);
  if (scenario) return generateScenarioAnswer(scenario, portfolio, total, snapshotTimestamp);

  const category = classifyQuestion(question, symbols);
  const snapshot = createPortfolioSummary(portfolio, insights);
  const largest = insights.find((insight) => insight.id === "largest");
  const mover = insights.find((insight) => insight.id === "mover");
  const decline = insights.find((insight) => insight.id === "decline");
  const largestAsset = snapshot.largest;
  const moverAsset = assets.find((asset) => asset.symbol === snapshot.mover?.symbol) ?? snapshot.largest;
  const focusFor = (insight: typeof largest, eyebrow: string): FocusSignal | undefined => insight?.symbol
    ? { eyebrow, title: insight.title, body: insight.body, symbol: insight.symbol }
    : undefined;

  if (category === "asset") {
    const symbol = getAssetFromQuestion(question, symbols);
    const knowledge = symbol ? getAssetKnowledge(symbol, assets, total) : null;
    if (knowledge) {
      const change = knowledge.asset.change24h === undefined
        ? "No recorded 24h sample move."
        : `Its recorded 24h move is ${knowledge.asset.change24h >= 0 ? "+" : ""}${knowledge.asset.change24h}%.`;
      const tenPercentScenario = calculatePositionScenario(portfolio, knowledge.asset.symbol, 10);
      const impactAtTenPercent = tenPercentScenario.positionImpact ?? 0;
      const isLargest = knowledge.asset.symbol === snapshot.largest.symbol;
      const riskSummary = getAssetRiskSummary(knowledge.asset, total);
      const lookThrough = knowledge.asset.lookThrough;
      const riskText = riskSummary.referenceAsset
        ? ` ${knowledge.asset.symbol} represents ${riskSummary.referenceAsset.name} exposure in the underlying market. The tokenized representation is distinct from that underlying market context and sits in a continuous on-chain environment.`
        : ` ${knowledge.asset.symbol} has no configured underlying/reference-asset relationship in this demo snapshot; its on-chain/token context is kept separate and no underlying exposure is inferred.`;
      const evidence = lookThrough
        ? createLookThroughEvidenceReceipt(knowledge.asset, total, snapshotTimestamp)
        : createConcentrationEvidenceReceipt(knowledge.asset, total, snapshotTimestamp);
      const lookThroughText = lookThrough && knowledge.asset.underlyingAsset
        ? ` Look-through: ${knowledge.asset.symbol} → ${knowledge.asset.underlyingAsset.name} → ${lookThrough.exposureCategory === "us-equity" ? "U.S. equity" : "on-chain"} exposure (${formatPercentage(knowledge.allocation)} of the demo portfolio). This link is based on configured application demo metadata, not external verification. The underlying-market concentration risk is distinct from the on-chain/token context.`
        : " No underlying/reference-asset relationship is configured for this position, so no look-through exposure is inferred.";
      return {
        text: `${knowledge.asset.symbol} is ${knowledge.description}, valued at ${formatCurrency(knowledge.asset.value)} (${formatPercentage(knowledge.allocation)} of this demo portfolio). ${change}${riskText}${lookThroughText} ${isLargest ? `For illustration, a 10% move in ${knowledge.asset.symbol} would change portfolio value by approximately ${formatCurrency(impactAtTenPercent)}, or ${formatPercentage(tenPercentScenario.portfolioImpactPercentage)} of portfolio value, assuming other holdings stay unchanged.` : "Its allocation shows how much of the portfolio is connected to this position."}`,
        focus: {
          eyebrow: "Asset signal",
          title: knowledge.asset.name,
          body: `${formatCurrency(knowledge.asset.value)} · ${formatPercentage(knowledge.allocation)} allocation · ${change}`,
          symbol: knowledge.asset.symbol,
        },
        followUps: [`Why is ${knowledge.asset.symbol} important?`, "Run a scenario", "Compare another holding"],
        context: "asset",
        evidence,
      };
    }
  }

  if (category === "look-through") {
    const configuredPositions = assets.filter((asset) => asset.lookThrough && asset.underlyingAsset);
    const equitySummary = calculateExposureCategorySummary(portfolio, "us-equity");
    const configuredLines = configuredPositions.map((asset) => {
      const allocation = calculateAllocationPercentage(asset.value, total);
      const categoryLabel = asset.lookThrough?.exposureCategory === "us-equity" ? "U.S. equity" : "on-chain";
      return `${asset.symbol} represents ${asset.underlyingAsset!.name} (${asset.underlyingAsset!.symbol}) and is ${categoryLabel} exposure at ${formatPercentage(allocation)} of the demo portfolio`;
    });
    const unconfiguredPositions = assets.filter((asset) => !asset.lookThrough || !asset.underlyingAsset);
    const unconfiguredText = unconfiguredPositions.map((asset) => `${asset.symbol} is an on-chain position with no configured underlying/reference relationship; no further look-through is inferred`).join("; ");
    const evidence = createExposureCategoryEvidenceReceipt(portfolio, "us-equity", snapshotTimestamp);
    const details = [...configuredLines, unconfiguredText].filter(Boolean).join(". ");
    return {
      text: `Based on the portfolio's configured asset metadata: ${details}. Together, configured U.S. equity positions represent ${formatPercentage(equitySummary.portfolioWeight)} of the demo portfolio. These weights are derived from the demo snapshot, not an external look-through provider. Underlying-market concentration remains distinct from on-chain/token context.`,
      followUps: configuredPositions.map((asset) => `Why is ${asset.symbol} important?`).concat("Show my biggest risk"),
      context: "portfolio",
      evidence,
    };
  }

  if (category === "allocation") {
    const largestRiskSummary = getAssetRiskSummary(largestAsset, total);
    const evidence = createConcentrationEvidenceReceipt(largestAsset, total, snapshotTimestamp);
    return {
      text: `Most of the demo portfolio is in ${largestAsset.symbol}: ${formatCurrency(largestAsset.value)} (${formatPercentage(snapshot.largestAllocation)}). The current allocation distribution is ${snapshot.distribution}. ${largestRiskSummary.referenceAsset?.name ?? largestAsset.name} is the underlying market reference for this concentration, while the tokenized representation remains in a separate continuous on-chain context.`,
      focus: focusFor(largest, "Allocation signal"),
      followUps: ["Show my biggest risk", "How is my portfolio distributed?"],
      context: "portfolio",
      evidence,
    };
  }

  if (category === "movers") {
    return {
      text: `${moverAsset.change24h === undefined ? `${moverAsset.symbol} has no recorded 24h move` : `${moverAsset.symbol} is the strongest recorded 24h mover at ${moverAsset.change24h >= 0 ? "+" : ""}${moverAsset.change24h}%`} and is valued at $${moverAsset.value.toLocaleString()}. ${decline?.body ?? "The sample also includes a negative mover."} This is demo data, not live market data.`,
      focus: focusFor(mover, "Momentum signal"),
      followUps: [`Tell me about ${moverAsset.symbol}`, "What should I watch?"],
      context: "portfolio",
    };
  }

  if (category === "risk") {
    const largestRiskSummary = getAssetRiskSummary(largestAsset, total);
    const evidence = createConcentrationEvidenceReceipt(largestAsset, total, snapshotTimestamp);
    return {
      text: `${getConcentrationInsight(snapshot)} The demo has ${assets.length} assets, and whether that concentration fits your objectives depends on your risk tolerance and plan; this is a measurable observation, not a recommendation. ${largestRiskSummary.referenceAsset?.name ?? largestAsset.name} represents the underlying exposure, while ${largestAsset.symbol} itself is the tokenized representation operating in a separate continuous on-chain context.`,
      focus: focusFor(largest, "Concentration signal"),
      followUps: ["What is my biggest holding?", `Tell me about ${largestAsset.symbol}`],
      context: "portfolio",
      evidence,
    };
  }

  if (category === "watch") {
    const watch = insights.find((insight) => insight.id === "watch");
    return {
      text: watch?.body ?? (moverAsset.change24h === undefined
        ? `No holding crossed the existing 5% watch threshold in this demo snapshot, and no 24h move is recorded for ${moverAsset.symbol}.`
        : `No holding crossed the existing 5% watch threshold in this demo snapshot. The strongest recorded move is ${moverAsset.symbol} at ${moverAsset.change24h >= 0 ? "+" : ""}${moverAsset.change24h}%, so that is the clearest signal to monitor.`),
      followUps: ["What changed today?", "Show my biggest risk"],
      context: "portfolio",
    };
  }

  if (category === "portfolio") {
    const largestRiskSummary = getAssetRiskSummary(snapshot.largest, total);
    const evidence = createConcentrationEvidenceReceipt(snapshot.largest, total, snapshotTimestamp);
    return {
      text: `Portfolio snapshot: ${formatCurrency(snapshot.total)} across ${snapshot.assetCount} assets. Largest allocation: ${snapshot.largest.symbol} at ${formatCurrency(snapshot.largest.value)} (${formatPercentage(snapshot.largestAllocation)}). ${moverAsset.change24h === undefined ? `No 24h movement is recorded for ${moverAsset.symbol}.` : `Current demo movement: ${moverAsset.symbol} at ${moverAsset.change24h >= 0 ? "+" : ""}${moverAsset.change24h}% over 24h.`} ${getConcentrationInsight(snapshot)} ${largestRiskSummary.referenceAsset?.name ?? snapshot.largest.name} represents the underlying exposure, while ${snapshot.largest.symbol} itself is the tokenized representation with separate on-chain context. This is calculated from sample data, not live market data.`,
      focus: focusFor(largest, "Portfolio signal"),
      followUps: [`What if ${snapshot.largest.symbol} drops 10%?`, "Explain my allocation", "What changed today?"],
      context: "portfolio",
      evidence,
    };
  }

  return {
    text: "That question does not match a supported portfolio signal yet. Ask about an asset, allocation, recorded move, or What-If scenario.",
    followUps: ["Analyze my portfolio", "What should I watch?"],
    context: "idle",
  };
}

export default function AICommandCenter() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"portfolio" | "insights" | "orb" | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [focusSignal, setFocusSignal] = useState<FocusSignal | null>(null);
  const [analysisResponseId, setAnalysisResponseId] = useState<string | null>(null);
  const [scenarioResponseId, setScenarioResponseId] = useState<string | null>(null);
  const [scenarioAsset, setScenarioAsset] = useState<string | null>(null);
  const [scenarioPresentation, setScenarioPresentation] = useState<ScenarioPresentation | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, EvidenceReceipt>>({});
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [investigationContext, setInvestigationContext] = useState<InvestigationContext>("idle");
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const handlePromptRef = useRef<((prompt: string) => void) | null>(null);
  const resetAnalysisRef = useRef<(() => void) | null>(null);
  const analysisRunRef = useRef(0);
  const messageIdRef = useRef(0);
  const portfolioSnapshot = getPortfolioDataSnapshot();
  const portfolio = portfolioSnapshot.portfolio;
  const insights = generateInsights(portfolioSnapshot);
  const intro = `Portfolio snapshot: ${formatCurrency(portfolio.totalValue)} across ${portfolio.positions.length} sample positions. Select the AAPLx concentration signal or ask about an asset, allocation, movement, or scenario.`;

  function resetAnalysis() {
    analysisRunRef.current += 1;
    setMessages([{ id: "m0", role: "assistant", text: intro }]);
    setFocusSignal(null);
    setAnalysisResponseId(null);
    setScenarioResponseId(null);
    setScenarioAsset(null);
    setScenarioPresentation(null);
    setEvidenceMap({});
    setMessage("");
    setFollowUps([]);
    setInvestigationContext("idle");
    setAnalysisStage("idle");
    window.dispatchEvent(new CustomEvent("ai-analysis-state", { detail: { status: "ready" } }));
    window.dispatchEvent(new CustomEvent<{ symbol: string | null }>("portfolio-ai-focus", {
      detail: { symbol: null },
    }));
  }

  function closePanel() {
    window.dispatchEvent(new CustomEvent<{ symbol: string | null }>("portfolio-ai-focus", {
      detail: { symbol: null },
    }));
    setOpen(false);
    setSource(null);
  }

  useEffect(() => {
    function onOrbClick(event: Event) {
      const detail = (event as CustomEvent<{ source?: "portfolio" | "insights" | "orb"; prompt?: string }>).detail;
      const nextSource = detail?.source ?? "orb";
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSource(nextSource);
      setOpen(true);
      if (detail?.prompt) {
        setMessages([{ id: "m0", role: "assistant", text: intro }]);
        void handlePromptRef.current?.(detail.prompt);
      } else {
        resetAnalysisRef.current?.();
      }
    }
    window.addEventListener("ai-orb-click", onOrbClick as EventListener);
    return () => window.removeEventListener("ai-orb-click", onOrbClick as EventListener);
  }, [intro]);
  useEffect(() => {
    // dispatch panel open/close events for orb state
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(open ? "ai-panel-open" : "ai-panel-close", {
          detail: { source },
        }),
      );
    }
  }, [open, source]);

  useEffect(() => {
    const dashboard = document.getElementById("dashboard-content");
    if (!dashboard) return;
    dashboard.inert = open;
    return () => {
      dashboard.inert = false;
    };
  }, [open]);

  useEffect(() => {
    // scroll to bottom on messages change
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) {
          event.preventDefault();
          dialogRef.current?.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!dialogRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open || !previouslyFocusedRef.current) return;
    previouslyFocusedRef.current.focus();
    previouslyFocusedRef.current = null;
  }, [open]);

  useEffect(() => {
    if (open && analysisStage === "complete" && !dialogRef.current?.contains(document.activeElement)) {
      inputRef.current?.focus();
    }
  }, [analysisStage, open]);

  function pushMessage(msg: Message) {
    setMessages((m) => [...m, msg]);
  }

  function handlePrompt(prompt: string) {
    const runId = ++analysisRunRef.current;
    const currentFocusSymbol = focusSignal?.symbol;
    const normalizedPrompt = normalizeQuestion(prompt);
    const comparisonAsset = currentFocusSymbol
      ? portfolio.positions.find((asset) => asset.symbol !== currentFocusSymbol)
      : undefined;
    const contextualPrompt = currentFocusSymbol && /^(what is it|what is this|tell me about it|why does it matter|why is it important)$/.test(normalizedPrompt)
      ? `${currentFocusSymbol} ${prompt}`
      : currentFocusSymbol && normalizedPrompt === "run a scenario"
        ? `What if ${currentFocusSymbol} drops 10%?`
        : comparisonAsset && /^(compare another holding|compare another asset)$/.test(normalizedPrompt)
          ? `Tell me about ${comparisonAsset.symbol}`
        : prompt;

    // push user message
    const userMsg: Message = { id: `u-${messageIdRef.current++}`, role: "user", text: prompt };
    pushMessage(userMsg);
    setMessage("");
    setFocusSignal(null);
    setAnalysisResponseId(null);
    setScenarioResponseId(null);
    setEvidenceMap({});
    setFollowUps([]);
    setInvestigationContext("idle");
    if (analysisRunRef.current !== runId) return;

    const scenarioFollowUp = scenarioAsset && /^try [+-]\d/.test(normalizeQuestion(contextualPrompt))
      ? `${scenarioAsset} ${contextualPrompt}`
      : contextualPrompt;
    const answer = generatePortfolioAnswer(scenarioFollowUp, portfolio, insights, portfolioSnapshot.capturedAt);
    const response = answer.text;
    const nextFocusSignal = answer.focus;

    const assistantMsg: Message = { id: `a-${messageIdRef.current++}`, role: "assistant", text: response };
    setFocusSignal(nextFocusSignal ?? null);
    setAnalysisResponseId(assistantMsg.id);
    setScenarioResponseId(answer.scenario ? assistantMsg.id : null);
    setScenarioAsset(answer.scenario?.symbol ?? null);
    if (answer.evidence) {
      setEvidenceMap((existing) => ({ ...existing, [assistantMsg.id]: answer.evidence! }));
    }
    if (answer.scenario?.symbol && answer.scenario.changePercent !== null) {
      const scenarioAssetData = portfolio.positions.find((asset) => asset.symbol === answer.scenario?.symbol);
      if (scenarioAssetData) {
        const result = calculatePositionScenario(portfolio, scenarioAssetData.symbol, answer.scenario.changePercent);
        setScenarioPresentation({
          symbol: scenarioAssetData.symbol,
          changePercent: answer.scenario.changePercent,
          currentValue: portfolio.totalValue,
          allocation: calculateAllocationPercentage(scenarioAssetData.value, portfolio.totalValue),
          impact: result.portfolioImpact,
          afterValue: result.resultingPortfolioValue,
          portfolioEffect: result.portfolioImpactPercentage,
        });
      }
    } else {
      setScenarioPresentation(null);
    }
    setInvestigationContext(answer.context ?? "idle");
    setAnalysisStage("complete");
    window.dispatchEvent(new CustomEvent("ai-analysis-state", { detail: { status: "complete" } }));
    window.dispatchEvent(new CustomEvent<{ symbol: string | null }>("portfolio-ai-focus", {
      detail: { symbol: nextFocusSignal?.symbol ?? null },
    }));
    pushMessage(assistantMsg);
    setFollowUps(answer.followUps);
  }

  useEffect(() => {
    handlePromptRef.current = handlePrompt;
    resetAnalysisRef.current = resetAnalysis;
  });

  const investigationLabel = investigationContext === "scenario"
    ? "Scenario analysis"
    : investigationContext === "asset"
      ? focusSignal?.symbol ?? "Asset analysis"
      : investigationContext === "portfolio"
        ? "Portfolio overview"
        : "Ready to interpret";
  const investigationBreadcrumb = investigationContext === "scenario" && focusSignal?.symbol
    ? `Portfolio  →  ${focusSignal.symbol}  →  Scenario`
    : investigationContext === "asset" && focusSignal?.symbol
      ? `Portfolio  →  ${focusSignal.symbol}`
      : investigationContext === "portfolio"
        ? "Portfolio  →  Intelligence"
        : "Portfolio  →  Intelligence";

  return (
    <>
      <div
        ref={dialogRef}
        id="portfolio-ai-dialog"
        aria-hidden={!open}
        aria-modal={open ? "true" : undefined}
        aria-labelledby="command-center-title"
        aria-describedby="investigation-breadcrumb"
        inert={!open || undefined}
        role="dialog"
        tabIndex={-1}
        className={`fixed bottom-0 right-0 z-50 flex h-[min(720px,calc(100vh-1.5rem))] w-[calc(100vw-1rem)] max-w-[720px] origin-bottom-right flex-col overflow-hidden border-l border-t border-purple-300/20 bg-[#0c0b12]/[0.98] shadow-2xl shadow-purple-950/50 backdrop-blur-2xl transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none sm:bottom-4 sm:right-4 sm:w-[calc(100vw-2rem)] md:h-[680px] ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
            : "pointer-events-none translate-y-8 scale-[.94] opacity-0 blur-sm"
        }`}
      >
        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-purple-400/10">
                <div className="absolute h-5 w-5 animate-pulse rounded-full bg-purple-400/40 blur-md" />
                <Sparkles size={17} className="relative text-purple-300" />
              </div>

              <div>
                <p id="command-center-title" className="text-sm font-semibold text-white">Portfolio intelligence</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-purple-200/50">Rule-based · sample data</p>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              onClick={closePanel}
              aria-label="Close Portfolio AI"
              className="rounded-xl p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-white/6 pt-3">
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-purple-200/65">
                <ScanLine size={11} />
                Investigation state
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <p className="truncate text-xs text-white/75">{investigationLabel}</p>
                {analysisStage === "complete" && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-emerald-300/70">
                    <CheckCircle2 size={11} />
                    Complete
                  </span>
                )}
              </div>
              <p id="investigation-breadcrumb" className="mt-1 truncate text-[10px] text-white/30">{investigationBreadcrumb}</p>
            </div>
            {(investigationContext !== "idle" || messages.length > 1) && (
              <button
                onClick={resetAnalysis}
                aria-label="Reset analysis"
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/8 px-2.5 text-[10px] uppercase tracking-[0.12em] text-white/40 transition hover:border-purple-300/25 hover:bg-purple-400/[0.08] hover:text-white/80"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        </div>

        <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="border-y border-purple-400/15 py-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-purple-300/70">Ready to investigate</p>
              <p className="mt-2 max-w-xl text-2xl font-semibold leading-tight text-white">Select a signal to trace its effect through the portfolio.</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">The sample workspace connects concentration, momentum, and scenario impact to the holding that created the signal.</p>
            </div>
          )}

          {messages.map((m) => {
            const evidenceReceipt = m.role === "assistant" ? evidenceMap[m.id] : undefined;
            return (
              <div key={m.id} className={`max-w-full ${m.role === "assistant" ? "self-start" : "self-end"}`}>
                {m.id === analysisResponseId && focusSignal && (
                  <div className="mb-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3.5">
                    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200/80">
                      <CheckCircle2 size={13} />
                      Signal detected
                    </div>
                    <div className="mt-3 border-l border-emerald-300/30 pl-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Focus signal · {focusSignal.eyebrow}</p>
                      <p className="mt-1 text-sm font-medium text-white/90">{focusSignal.symbol ? `${focusSignal.symbol} · ` : ""}{focusSignal.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/60">{focusSignal.body}</p>
                    </div>
                  </div>
                )}

                {m.id === scenarioResponseId && scenarioPresentation && (
                  <div className="mb-2 rounded-2xl border border-purple-300/20 bg-gradient-to-br from-purple-400/[0.1] to-white/[0.03] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-purple-200/80"><ScanLine size={13} /> What-If impact</div>
                      <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">Illustrative</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ScenarioMetric label="Current portfolio" value={formatCurrency(scenarioPresentation.currentValue)} />
                      <ScenarioMetric label={`${scenarioPresentation.symbol} change`} value={`${scenarioPresentation.changePercent >= 0 ? "+" : ""}${scenarioPresentation.changePercent}%`} tone="purple" />
                      <ScenarioMetric label="Position impact" value={formatSignedCurrency(scenarioPresentation.impact)} tone={scenarioPresentation.impact >= 0 ? "green" : "red"} />
                      <ScenarioMetric label="Resulting portfolio" value={formatCurrency(scenarioPresentation.afterValue)} tone={scenarioPresentation.impact >= 0 ? "green" : "red"} />
                    </div>
                    <div className="mt-3 rounded-xl border border-white/8 bg-black/10 p-3 text-center">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-white/40">Portfolio-level impact</p>
                      <p className={`mt-1 text-sm font-semibold ${scenarioPresentation.portfolioEffect >= 0 ? "text-emerald-200" : "text-rose-200"}`}>{scenarioPresentation.portfolioEffect >= 0 ? "+" : ""}{formatPercentage(scenarioPresentation.portfolioEffect)}</p>
                      <p className="mt-1 text-[10px] text-white/40">{scenarioPresentation.symbol} is {formatPercentage(scenarioPresentation.allocation)} of the current portfolio.</p>
                    </div>
                    <div className="mt-3 border-t border-white/8 pt-3">
                      <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-purple-200/65">Next step</p>
                      <p className="mt-1 text-xs leading-5 text-white/55">Check whether this position’s share fits your intended allocation.</p>
                    </div>
                  </div>
                )}

                {m.role === "assistant" && (
                  <div className="mb-1.5 flex items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.17em] text-purple-200/55">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={12} />
                      Portfolio analysis
                    </span>
                    {m.id === scenarioResponseId && (
                      <span className="rounded-full border border-purple-300/20 bg-purple-400/[0.08] px-2 py-0.5 text-[9px] tracking-[0.14em] text-purple-200/75">
                        Scenario analysis
                      </span>
                    )}
                  </div>
                )}

                <div className={`${m.role === "assistant" ? "mt-3 border-t border-white/10 pt-3" : "border-l border-purple-300/30 pl-3"}`}>
                  {m.role === "assistant" && m.id === scenarioResponseId ? (
                    <p className="text-xs text-white/45">Scenario resolved from the existing portfolio snapshot. The result is illustrative, not a prediction.</p>
                  ) : m.role === "assistant" && m.id === analysisResponseId && focusSignal ? (
                    <p className="text-xs leading-6 text-white/65">{m.text}</p>
                  ) : (
                    <p className={`text-xs ${m.role === "assistant" ? "text-white/55" : "text-white"}`}>{m.text}</p>
                  )}
                </div>

                {m.role === "assistant" && evidenceReceipt && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-purple-200/65">Evidence</p>
                      <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">{evidenceReceipt.snapshotLabel}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{evidenceReceipt.claim}</p>
                    <div className="mt-3 space-y-2">
                      {evidenceReceipt.evidence.map((item) => (
                        <div key={item.label} className="flex items-start justify-between gap-3 border-b border-white/6 pb-2 last:border-b-0 last:pb-0">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">{item.label}</span>
                          <div className="text-right">
                            <span className="block text-xs font-medium text-white">{item.value}</span>
                            {item.detail && <span className="mt-1 block text-[10px] text-white/35">{item.detail}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-purple-300/15 bg-purple-400/[0.04] p-3">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-purple-200/65">How calculated</p>
                      <p className="mt-2 text-xs leading-5 text-white/70">{evidenceReceipt.provenance.formula}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/35">Result: {evidenceReceipt.provenance.result}</p>
                    </div>
                    {evidenceReceipt.assumptions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">Assumptions</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-5 text-white/55">
                          {evidenceReceipt.assumptions.map((assumption) => (
                            <li key={assumption}>{assumption}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {evidenceReceipt.riskContext && (
                      <div className="mt-3 border-t border-white/8 pt-3">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">Risk context</p>
                        <div className="mt-2 space-y-2 text-[10px] leading-5 text-white/60">
                          {evidenceReceipt.riskContext.underlying && <p><span className="font-medium text-white/80">Underlying:</span> {evidenceReceipt.riskContext.underlying}</p>}
                          {evidenceReceipt.riskContext.onChain && <p><span className="font-medium text-white/80">On-chain:</span> {evidenceReceipt.riskContext.onChain}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {followUps.length > 0 && (
            <div className="space-y-2">
              {investigationContext === "portfolio" && analysisStage === "complete" && (
                <p className="px-1 text-[10px] uppercase tracking-[0.16em] text-purple-200/55">Explore a holding or run a scenario.</p>
              )}
              <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-white/30">Continue analysis</p>
              <div className="flex flex-wrap gap-2">
                {followUps.map((followUp) => (
                  <button
                    key={followUp}
                    onClick={() => handlePrompt(followUp)}
                    className="rounded-xl border border-purple-300/15 bg-purple-400/[0.05] px-3 py-2 text-left text-[11px] text-purple-100/65 transition hover:border-purple-300/35 hover:bg-purple-400/[0.12] hover:text-white"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-label="Ask Portfolio AI"
              placeholder="Ask the investigation layer..."
              className="min-w-0 flex-1 bg-transparent px-2 text-xs text-white outline-none placeholder:text-white/25"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePrompt(message || "Analyze my portfolio");
                }
              }}
            />

            <button
              aria-label="Send question"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-purple-300 transition hover:bg-purple-400/25"
              onClick={() => handlePrompt(message || "Analyze my portfolio")}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ScenarioMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "purple" | "green" | "red" }) {
  const toneClass = tone === "red" ? "text-rose-300" : tone === "green" ? "text-emerald-300" : tone === "purple" ? "text-purple-200" : "text-white";
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-white/35">{label}</p><p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p></div>;
}

"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export type MarketState = {
  isOpen: boolean;
  nextSession: string;
};

type ClockId = "traditional" | "onchain";

const MARKET_TIME_ZONE = "America/New_York";

export function getMarketState(now: Date): MarketState {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const minutes = part("hour") * 60 + part("minute");
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TIME_ZONE, weekday: "short" }).format(now);
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const isOpen = isWeekday && minutes >= 9 * 60 + 30 && minutes < 16 * 60;

  if (isOpen) return { isOpen: true, nextSession: "" };

  const nextDate = new Date(Date.UTC(year, month - 1, day));
  if (isWeekday && minutes < 9 * 60 + 30) {
    // The next session begins today before the opening bell.
  } else {
    do {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    } while (nextDate.getUTCDay() === 0 || nextDate.getUTCDay() === 6);
  }

  const nextSessionDate = nextDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return { isOpen: false, nextSession: `${nextSessionDate} · 09:30 ET` };
}

export default function TwoClocks({ total, assetCount, compact = false }: { total: number; assetCount: number; compact?: boolean }) {
  const [market, setMarket] = useState<MarketState | null>(null);
  const [hoveredClock, setHoveredClock] = useState<ClockId | null>(null);
  const [focusedClock, setFocusedClock] = useState<ClockId | null>(null);
  const [pinnedClock, setPinnedClock] = useState<ClockId | null>(null);

  useEffect(() => {
    const updateMarket = () => setMarket(getMarketState(new Date()));
    updateMarket();
    const interval = window.setInterval(updateMarket, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const activeClock = pinnedClock ?? focusedClock ?? hoveredClock;
  const portfolioValue = `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function clockHandlers(clock: ClockId) {
    return {
      onPointerEnter: () => setHoveredClock(clock),
      onPointerLeave: () => setHoveredClock(null),
      onFocus: () => setFocusedClock(clock),
      onBlur: () => setFocusedClock(null),
      onClick: () => setPinnedClock((current) => current === clock ? null : clock),
      "aria-expanded": activeClock === clock,
    };
  }

  if (compact) {
    return (
      <section aria-label="Two clocks" className="topbar-clocks" data-market-state={market?.isOpen ? "open" : "closed"}>
        <button type="button" {...clockHandlers("traditional")} aria-controls="traditional-clock-detail" className="topbar-clock-node topbar-clock-traditional">
          <span className="topbar-clock-label">Traditional market</span>
          <span className={`topbar-clock-state ${market?.isOpen ? "is-open" : "is-closed"}`}>{market ? (market.isOpen ? "OPEN" : "CLOSED") : "CHECKING"}</span>
          <span id="traditional-clock-detail" className="topbar-clock-detail">{market?.isOpen ? "Weekdays · 09:30–16:00 ET" : market ? `Next session · ${market.nextSession}` : "Weekday session · 09:30–16:00 ET"}</span>
        </button>
        <div className="clock-dual-timeline" aria-hidden="true">
          <span className="clock-timeline-line clock-timeline-traditional" />
          <span className="clock-timeline-point" />
          <span className="clock-timeline-label">TWO SYSTEMS · DIFFERENT HOURS</span>
          <span className="clock-timeline-point" />
          <span className="clock-timeline-line clock-timeline-onchain" />
        </div>
        <button type="button" {...clockHandlers("onchain")} aria-controls="onchain-clock-detail" className="topbar-clock-node topbar-clock-onchain">
          <span className="topbar-clock-label">On-chain · Solana</span>
          <span className="topbar-clock-state is-live">LIVE</span>
          <span id="onchain-clock-detail" className="topbar-clock-detail">Continuous market</span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="two-clocks-title"
      className="two-clocks-field relative isolate mb-8 overflow-hidden border-y border-white/10 px-4 py-6 sm:px-6 sm:py-8 md:px-8"
    >
      <div className="relative z-10 mb-7 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:mb-9">
        <div className="flex items-baseline gap-3">
          <h2 id="two-clocks-title" className="text-[10px] font-medium uppercase tracking-[0.22em] text-purple-200/75">Two clocks</h2>
          <p className="text-[11px] text-white/40">Two markets. One intelligence layer.</p>
        </div>
        <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">Market context · local schedule</p>
      </div>

      <div className="two-clocks-bridge relative z-10 grid min-w-0 grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1fr)_5rem_minmax(280px,1.15fr)_5rem_minmax(0,1fr)]" data-active={activeClock ?? "none"}>
        <button
          type="button"
          {...clockHandlers("traditional")}
          aria-label={`Traditional markets, NYSE and Nasdaq: ${market ? (market.isOpen ? "open" : "closed") : "status checking"}. Activate to ${pinnedClock === "traditional" ? "hide" : "show"} session detail.`}
          aria-controls="traditional-clock-detail"
          className={`two-clocks-node group min-w-0 py-2 text-left transition-[opacity,color,transform] duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 focus-visible:outline-offset-4 ${activeClock && activeClock !== "traditional" ? "opacity-55" : "opacity-100"} ${activeClock === "traditional" ? "text-white lg:-translate-y-0.5" : "text-white/85"}`}
        >
          <span className="block text-[9px] font-medium uppercase tracking-[0.2em] text-white/45 transition-colors group-hover:text-white/65 group-focus-visible:text-white/65">Traditional markets</span>
          <span className="mt-2 block text-xs font-medium tracking-[0.14em] text-white/65">NYSE / NASDAQ</span>
          <span className="mt-4 flex items-center gap-2.5">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 ${market?.isOpen ? "bg-emerald-300" : "bg-white/45"}`} />
            <span className={`text-xl font-semibold tracking-[0.035em] transition-colors duration-300 ${market?.isOpen ? "text-emerald-200" : "text-white"}`}>
              {market ? (market.isOpen ? "OPEN" : "CLOSED") : "CHECKING"}
            </span>
          </span>
          <span className="mt-1.5 block text-xs text-white/50">
            {market?.isOpen ? "Weekdays · 09:30–16:00 ET" : market ? `Next session · ${market.nextSession}` : "Weekday session · 09:30–16:00 ET"}
          </span>
          <span className="mt-1.5 block text-[9px] text-white/30">Weekday schedule · holidays not modeled</span>
          <span id="traditional-clock-detail" className={`mt-2 block min-h-4 text-[10px] text-purple-200/90 transition-opacity duration-300 motion-reduce:transition-none ${activeClock === "traditional" ? "opacity-100" : "opacity-0"}`}>
            Traditional session
          </span>
        </button>

        <div aria-hidden="true" className="two-clock-link two-clock-link-traditional" data-active={activeClock === "traditional"}>
          <span className="two-clock-link-track"><span className="two-clock-link-particle" /></span>
        </div>

        <div className="two-clocks-core relative flex min-w-0 flex-col items-start justify-center py-6 lg:min-h-44 lg:items-center lg:py-4 lg:text-center">
          <div aria-hidden="true" className="two-clocks-core-signal absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-purple-200/70 lg:left-1/2 lg:top-0 lg:h-8 lg:w-8 lg:-translate-x-1/2 lg:translate-y-0">
            <span className="two-clocks-signal-ring absolute inset-0" />
            <Sparkles size={14} strokeWidth={1.5} />
          </div>
          <span className="pl-12 text-[9px] font-medium uppercase tracking-[0.22em] text-purple-200/75 lg:pl-0 lg:pt-9">Portfolio AI</span>
          <span className="mt-1 pl-12 text-[2.2rem] font-semibold leading-none tracking-[-0.065em] text-white sm:text-5xl lg:pl-0 lg:text-[3.25rem]">{portfolioValue}</span>
          <span className="mt-2 pl-12 text-[9px] font-medium uppercase tracking-[0.2em] text-white/45 lg:pl-0">{assetCount} assets</span>
        </div>

        <div aria-hidden="true" className="two-clock-link two-clock-link-onchain" data-active={activeClock === "onchain"}>
          <span className="two-clock-link-track"><span className="two-clock-link-particle" /></span>
        </div>

        <button
          type="button"
          {...clockHandlers("onchain")}
          aria-label="On-chain markets, Solana: live and continuously available. Activate to show liquidity detail."
          aria-controls="onchain-clock-detail"
          className={`two-clocks-node group min-w-0 py-2 text-left transition-[opacity,color,transform] duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 focus-visible:outline-offset-4 lg:text-right ${activeClock && activeClock !== "onchain" ? "opacity-55" : "opacity-100"} ${activeClock === "onchain" ? "text-white lg:-translate-y-0.5" : "text-white/85"}`}
        >
          <span className="block text-[9px] font-medium uppercase tracking-[0.2em] text-white/45 transition-colors group-hover:text-white/65 group-focus-visible:text-white/65">On-chain</span>
          <span className="mt-2 block text-xs font-medium tracking-[0.14em] text-white/65">SOLANA</span>
          <span className="mt-4 flex items-center gap-2.5 lg:justify-end">
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="clock-live-pulse absolute inline-flex h-full w-full rounded-full bg-purple-300/45" />
              <span className="relative inline-flex h-1.5 w-1.5 bg-purple-200" />
            </span>
            <span className="text-xl font-semibold tracking-[0.035em] text-purple-100">LIVE</span>
          </span>
          <span className="mt-1.5 block text-xs text-white/50">Continuous market</span>
          <span id="onchain-clock-detail" className={`mt-2 block min-h-4 text-[10px] text-purple-200/90 transition-opacity duration-300 motion-reduce:transition-none ${activeClock === "onchain" ? "opacity-100" : "opacity-0"}`}>
            Continuous liquidity
          </span>
        </button>
      </div>
    </section>
  );
}

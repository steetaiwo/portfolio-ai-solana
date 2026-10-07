"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

type FocusEventDetail = { symbol?: string | null };
type PanelEventDetail = { source?: "portfolio" | "insights" | "orb" | null };

export default function AIOrb() {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(null);

  useEffect(() => {
    function onFocus(event: Event) {
      const detail = (event as CustomEvent<FocusEventDetail>).detail;
      setFocusedSymbol(detail?.symbol ?? null);
    }

    function onPanelOpen() {
      setIsOpen(true);
    }

    function onPanelClose() {
      setIsOpen(false);
    }

    window.addEventListener("portfolio-ai-focus", onFocus);
    window.addEventListener("ai-panel-open", onPanelOpen as EventListener);
    window.addEventListener("ai-panel-close", onPanelClose as EventListener);
    return () => {
      window.removeEventListener("portfolio-ai-focus", onFocus);
      window.removeEventListener("ai-panel-open", onPanelOpen as EventListener);
      window.removeEventListener("ai-panel-close", onPanelClose as EventListener);
    };
  }, []);

  function handleClick() {
    const detail: PanelEventDetail & { prompt?: string } = { source: "orb" };
    if (focusedSymbol) detail.prompt = `Tell me about ${focusedSymbol}`;
    window.dispatchEvent(new CustomEvent("ai-orb-click", { detail }));
  }

  const label = focusedSymbol
    ? `Open Portfolio Intelligence for ${focusedSymbol}`
    : "Open Portfolio Intelligence";

  return (
    <div
      aria-hidden={isOpen}
      className={`fixed bottom-6 right-6 z-[60] transition-[opacity,transform] duration-200 motion-reduce:transition-none ${isOpen ? "pointer-events-none translate-y-2 opacity-0" : ""}`}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls="portfolio-ai-dialog"
        tabIndex={isOpen ? -1 : 0}
        title={label}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border bg-[#17121f]/95 text-purple-200 transition-[border-color,background-color,color] hover:bg-purple-400/[0.12] focus-visible:outline-offset-4 motion-reduce:transition-none ${focusedSymbol ? "border-purple-300/55 text-purple-100" : "border-purple-400/25 text-purple-300"}`}
      >
        <span aria-hidden="true" className="absolute -inset-1 rounded-full ai-orb-glow ai-orb-idle-shadow" />
        <Sparkles size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

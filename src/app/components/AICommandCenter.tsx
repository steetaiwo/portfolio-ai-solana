
"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { generateInsights } from "./insights";
import { getDemoPortfolio } from "./demoData";

type Message = { id: string; role: "assistant" | "user"; text: string };

export default function AICommandCenter() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const insights = generateInsights();
  const demo = getDemoPortfolio();

  useEffect(() => {
    if (open) {
      // When opening, show an intro that references demo portfolio
      const intro = `Hello — I can analyze your demo portfolio: total value ${demo.total.toLocaleString()} across ${demo.assets.length} assets. Ask one of the quick prompts or type a question.`;
      setMessages([{ id: "m0", role: "assistant", text: intro }]);
    }
  }, [open]);

  useEffect(() => {
    // scroll to bottom on messages change
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, thinking]);

  function pushMessage(msg: Message) {
    setMessages((m) => [...m, msg]);
  }

  async function handlePrompt(prompt: string) {
    // push user message
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: prompt };
    pushMessage(userMsg);
    setMessage("");

    // simulate thinking
    setThinking(true);
    await new Promise((r) => setTimeout(r, 600));

    // deterministic responses based on insights/demo
    let response = "I'm here to help with your portfolio.";

    if (prompt === "Analyze my portfolio") {
      const summary = insights.find((i) => i.id === "summary");
      const largest = insights.find((i) => i.id === "largest");
      const mover = insights.find((i) => i.id === "mover");
      response = `${summary?.body} Top holding: ${largest?.title} — ${largest?.body} Top 24h mover: ${mover?.title} — ${mover?.body}`;
    } else if (prompt === "What changed today?") {
      const mover = insights.find((i) => i.id === "mover");
      const decline = insights.find((i) => i.id === "decline");
      response = `24h changes: ${mover?.title} — ${mover?.body} // ${decline?.title} — ${decline?.body}`;
    } else if (prompt === "What should I watch?") {
      const watch = insights.find((i) => i.id === "watch");
      if (watch) {
        response = `${watch.body}`;
      } else {
        response = `No small holdings moved >5% in this demo portfolio. Consider monitoring your top movers and any small caps.`;
      }
    } else {
      // fallback: reference total and top holding
      const largest = insights.find((i) => i.id === "largest");
      response = `I can help analyze this portfolio (demo total ${demo.total.toLocaleString()}). For a quick overview try 'Analyze my portfolio'. Example: ${largest?.body}`;
    }

    const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", text: response };
    pushMessage(assistantMsg);
    setThinking(false);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-purple-400/30 bg-[#17121f]/90 px-5 py-3 text-sm text-purple-100 shadow-2xl shadow-purple-900/30 backdrop-blur-xl transition hover:scale-105 hover:border-purple-300/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-400/15">
            <Sparkles size={16} />
          </span>
          Ask Portfolio AI
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-3xl border border-purple-400/20 bg-[#0d0b12]/95 shadow-2xl shadow-purple-950/40 backdrop-blur-2xl">
          {/* AI header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-purple-400/10">
                <div className="absolute h-5 w-5 animate-pulse rounded-full bg-purple-400/40 blur-md" />
                <Sparkles size={17} className="relative text-purple-300" />
              </div>

              <div>
                <p className="text-sm font-medium">Portfolio AI</p>
                <p className="text-xs text-white/35">Intelligence layer</p>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-white/40 transition hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Conversation */}
          <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-purple-400/10 bg-purple-400/5 p-4">
                <p className="text-xs uppercase tracking-wider text-purple-300/70">AI observation</p>
                <p className="mt-2 text-sm leading-6 text-white/70">Connect your Solana wallet and I’ll analyze your portfolio, identify important changes, and explain what deserves your attention.</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`max-w-full ${m.role === "assistant" ? "self-start" : "self-end"}`}>
                <div className={`rounded-2xl p-3 ${m.role === "assistant" ? "bg-white/4 border border-white/6" : "bg-purple-400/10"}`}>
                  <p className={`text-xs ${m.role === "assistant" ? "text-white/80" : "text-white"}`}>{m.text}</p>
                </div>
              </div>
            ))}

            {thinking && (
              <div className="rounded-2xl p-3 bg-white/4 border border-white/6 w-24">
                <p className="text-xs text-white/60">Thinking…</p>
              </div>
            )}

            {/* Quick suggestions */}
            <div className="grid gap-2">
              {[
                "Analyze my portfolio",
                "What changed today?",
                "What should I watch?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePrompt(prompt)}
                  className="rounded-xl border border-white/10 px-4 py-3 text-left text-xs text-white/45 transition hover:border-purple-400/20 hover:bg-white/[0.03] hover:text-white/70"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask anything about your portfolio..."
                className="min-w-0 flex-1 bg-transparent px-2 text-xs text-white outline-none placeholder:text-white/25"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePrompt(message || "Analyze my portfolio");
                  }
                }}
              />

              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-purple-300 transition hover:bg-purple-400/25"
                onClick={() => handlePrompt(message || "Analyze my portfolio")}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

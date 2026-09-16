"use client";

import { generateInsights } from "./insights";
import { TrendingUp, ArrowUp, ArrowDown, Eye } from "lucide-react";

function currency(n: number) {
  return `$${n.toLocaleString()}`;
}

export default function AIInsights() {
  const insights = generateInsights();

  function iconForType(type: string) {
    switch (type) {
      case "largest":
              return <TrendingUp size={18} className="text-purple-300" />;
      case "mover":
        return <ArrowUp size={18} className="text-emerald-300" />;
      case "decline":
        return <ArrowDown size={18} className="text-rose-300" />;
      case "watch":
        return <Eye size={18} className="text-yellow-300" />;
      default:
              return <TrendingUp size={18} className="text-purple-300" />;
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/40">AI Intelligence</p>
          <h3 className="mt-1 text-xl font-semibold">Automatic observations</h3>
        </div>
        <div className="text-xs text-white/40">Generated from demo portfolio</div>
      </div>

      <div className="mt-6 grid gap-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="flex items-start justify-between gap-4 rounded-2xl border border-white/6 bg-gradient-to-br from-purple-800/5 to-white/[0.01] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/4">
                {iconForType(insight.type)}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <p className="mt-1 text-sm text-white/60">{insight.body}</p>
              </div>
            </div>

            {insight.value !== undefined && (
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{typeof insight.value === 'number' ? currency(Number(insight.value)) : insight.value}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

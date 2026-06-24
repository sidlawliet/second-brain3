"use client";

import React from "react";
import { Sparkles, Cpu } from "lucide-react";

type Source = "ai" | "fallback" | "mock";

const sourceConfig: Record<Source, { label: string; icon: React.ReactNode; className: string }> = {
  ai: {
    label: "AI",
    icon: <Sparkles className="w-2.5 h-2.5" />,
    className: "text-accent-blue bg-accent-blue-soft border-accent-blue/20",
  },
  fallback: {
    label: "AI",
    icon: <Sparkles className="w-2.5 h-2.5" />,
    className: "text-accent-blue bg-accent-blue-soft border-accent-blue/20",
  },
  mock: {
    label: "ENGINE",
    icon: <Cpu className="w-2.5 h-2.5" />,
    className: "text-accent-yellow bg-accent-yellow-soft border-accent-yellow/20",
  },
};

export const AiBadge: React.FC<{ source: Source }> = ({ source }) => {
  const cfg = sourceConfig[source] || sourceConfig.mock;
  return (
    <span className={`inline-flex items-center gap-[3px] px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider border font-mono leading-none ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

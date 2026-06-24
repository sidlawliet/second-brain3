"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

export type PipelineStep = {
  agent: string;
  action: string;
  tool: string;
  input: string;
  output: string;
  status: "running" | "done" | "error";
  timestamp: number;
};

export type PipelineState = {
  steps: PipelineStep[];
  isRunning: boolean;
  fullConversation: string;
};

// ─── Agent icons and colors ─────────────────────────────────────────────────
const AGENT_META: Record<string, { icon: React.ReactNode; color: string; gradient: string }> = {
  ChiefOfStaff: {
    icon: <Brain className="w-3.5 h-3.5" />,
    color: "text-accent-blue",
    gradient: "from-accent-blue/10 to-transparent",
  },
  PlanningAgent: {
    icon: <Zap className="w-3.5 h-3.5" />,
    color: "text-accent-green",
    gradient: "from-accent-green/10 to-transparent",
  },
  PrioritizationAgent: {
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    color: "text-accent-yellow",
    gradient: "from-accent-yellow/10 to-transparent",
  },
  RiskAgent: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-accent-red",
    gradient: "from-accent-red/10 to-transparent",
  },
  RescueAgent: {
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    color: "text-accent-red",
    gradient: "from-accent-red/10 to-transparent",
  },
  ReflectionAgent: {
    icon: <Brain className="w-3.5 h-3.5" />,
    color: "text-accent-blue",
    gradient: "from-accent-blue/10 to-transparent",
  },
  RealityCheckEngine: {
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: "text-accent-yellow",
    gradient: "from-accent-yellow/10 to-transparent",
  },
};

function getAgentMeta(name: string) {
  return AGENT_META[name] || {
    icon: <Brain className="w-3.5 h-3.5" />,
    color: "text-mute",
    gradient: "from-mute/5 to-transparent",
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface AgentPipelineProps {
  pipeline: PipelineState;
  onClose?: () => void;
  compact?: boolean;
}

export const AgentPipeline: React.FC<AgentPipelineProps> = ({
  pipeline,
  onClose,
  compact,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const prevStepCountRef = useRef(0);

  // Auto-scroll when new steps appear
  useEffect(() => {
    if (pipeline.steps.length > prevStepCountRef.current && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
    prevStepCountRef.current = pipeline.steps.length;
  }, [pipeline.steps.length]);

  const modalContent = (
    <div className="bg-surface border border-hairline rounded-lg overflow-hidden flex flex-col shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-hairline bg-surface-elevated flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-accent-blue" />
          <span className="text-sm font-semibold text-on-dark tracking-tight">Agent Pipeline</span>
          {pipeline.isRunning && (
            <span className="bg-accent-blue-soft text-accent-blue text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              LIVE
            </span>
          )}
          {!pipeline.isRunning && pipeline.steps.length > 0 && (
            <span className="bg-accent-green-soft text-accent-green text-[10px] px-1.5 py-0.5 rounded font-mono">
              {pipeline.steps.filter(s => s.status === "done").length}/{pipeline.steps.length} COMPLETE
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-stone hover:text-on-dark transition-colors p-1 rounded-sm cursor-pointer">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Steps */}
      <div ref={listRef} className={`overflow-y-auto ${compact ? "max-h-[300px]" : "max-h-[400px]"}`}>
        <div className="p-3 space-y-1.5">
          {pipeline.steps.length === 0 && pipeline.isRunning && (
            <div className="py-8 text-center text-xs text-stone flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
              <span>Initializing agent pipeline...</span>
            </div>
          )}

          {pipeline.steps.length === 0 && !pipeline.isRunning && (
            <div className="py-8 text-center text-xs text-stone">
              Run Auto-Pilot to see the agent pipeline in action.
            </div>
          )}

          <AnimatePresence initial={false}>
            {pipeline.steps.map((step, idx) => {
              const meta = getAgentMeta(step.agent);
              const isLast = idx === pipeline.steps.length - 1;
              const isLatestRunning = isLast && step.status === "running";

              return (
                <motion.div
                  key={`${step.agent}-${step.timestamp}-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`relative rounded-md border ${
                    step.status === "error"
                      ? "border-accent-red/20 bg-accent-red-soft/20"
                      : step.status === "running"
                      ? "border-accent-blue/20 bg-accent-blue-soft/10"
                      : "border-hairline bg-surface-elevated/30"
                  } p-3`}
                >
                  {/* Connector line to next step */}
                  {idx < pipeline.steps.length - 1 && (
                    <div className="absolute left-5 top-10 bottom-0 w-px bg-hairline" />
                  )}

                  {/* Agent header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded border ${
                        step.status === "running"
                          ? "bg-accent-blue-soft border-accent-blue/20"
                          : step.status === "error"
                          ? "bg-accent-red-soft border-accent-red/20"
                          : "bg-surface-elevated border-hairline"
                      }`}>
                        {step.status === "running" ? (
                          <Loader2 className={`w-3.5 h-3.5 animate-spin ${meta.color}`} />
                        ) : (
                          React.cloneElement(meta.icon as React.ReactElement<{ className?: string }>, { className: `w-3.5 h-3.5 ${meta.color}` })
                        )}
                      </div>
                      <span className="text-xs font-semibold text-on-dark">{step.agent}</span>
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded-full border ${
                        step.status === "done"
                          ? "text-accent-green border-accent-green/20 bg-accent-green-soft"
                          : step.status === "error"
                          ? "text-accent-red border-accent-red/20 bg-accent-red-soft"
                          : "text-accent-blue border-accent-blue/20 bg-accent-blue-soft"
                      }`}>
                        {step.status === "done" ? "DONE" : step.status === "error" ? "ERROR" : "RUNNING"}
                      </span>
                    </div>
                    <span className="text-[9px] text-stone font-mono">{step.tool}</span>
                  </div>

                  {/* Action */}
                  <p className="text-[11px] text-mute font-medium mb-0.5">{step.action}</p>

                  {/* Tool call detail */}
                  <div className="mt-1.5 space-y-0.5">
                    {step.input && (
                      <div className="flex items-start space-x-1.5">
                        <span className="text-[9px] text-stone font-mono mt-0.5 flex-shrink-0">IN:</span>
                        <p className="text-[10px] text-stone font-mono leading-relaxed break-all">
                          {step.input.length > 100 ? step.input.slice(0, 100) + "..." : step.input}
                        </p>
                      </div>
                    )}
                    {step.output && (
                      <div className="flex items-start space-x-1.5">
                        <span className="text-[9px] text-stone font-mono mt-0.5 flex-shrink-0">OUT:</span>
                        <p className="text-[10px] text-mute leading-relaxed">
                          {step.output.length > 120 ? step.output.slice(0, 120) + "..." : step.output}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer stats */}
      {!compact && (
        <div className="px-4 py-2 border-t border-hairline bg-surface-elevated flex items-center justify-between text-[10px] text-stone">
          <span>{pipeline.steps.length} agent steps executed</span>
          <span className="font-mono">
            {pipeline.steps.filter(s => s.status === "done").length} done ·{" "}
            {pipeline.steps.filter(s => s.status === "error").length} errors
          </span>
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="w-full">
        {modalContent}
      </div>
    );
  }

  // Full modal overlay
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-xl"
        >
          {modalContent}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

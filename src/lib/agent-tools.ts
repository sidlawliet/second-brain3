// Shared store for agent pipeline steps — used by agent-orchestrator.ts
// This module does NOT use "use server" — it's an internal library

// ─── Shared store for agent pipeline steps ──────────────────────────────────
// Server-side storage so all agents can write to it
const agentLogStore: Map<string, AgentStep[]> = new Map();

export type AgentStep = {
  agent: string;
  action: string;
  tool: string;
  input: string;
  output: string;
  status: "running" | "done" | "error";
  timestamp: number;
};

export function initAgentLog(sessionId: string) {
  agentLogStore.set(sessionId, []);
}

export function logStep(sessionId: string, step: AgentStep) {
  const log = agentLogStore.get(sessionId) || [];
  log.push(step);
  agentLogStore.set(sessionId, log);
}

export function getAgentLog(sessionId: string): AgentStep[] {
  return agentLogStore.get(sessionId) || [];
}

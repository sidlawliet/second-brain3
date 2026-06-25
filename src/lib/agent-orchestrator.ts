"use server";

import { GoogleGenAI, FunctionCallingConfigMode, Type } from "@google/genai";
import { Task } from "./db";
import { hasApiKey, retryWithBackoff } from "./gemini";
import {
  initAgentLog,
  logStep,
  getAgentLog,
  AgentStep,
} from "./agent-tools";
import {
  calculateTaskRiskAction,
  getRealityCheckAction,
  getCoachingInsightAction,
} from "@/app/actions/ai";

const MODEL_NAME = "gemini-2.0-flash";

// ─── Gemini Function Declarations (tools the agents can call) ───────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AGENT_TOOLS: any = [
  {
    functionDeclarations: [
      {
        name: "calculate_risk",
        description: "Calculate deadline failure risk for a task. Returns riskScore (0-100), confidenceScore (0-100), reasoning string.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: { type: Type.STRING, description: "Unique task identifier" },
            title: { type: Type.STRING, description: "Task title" },
            deadline: { type: Type.STRING, description: "Deadline date (YYYY-MM-DD)" },
            postponedCount: { type: Type.NUMBER, description: "Times postponed" },
          },
          required: ["taskId", "title", "deadline", "postponedCount"],
        },
      },
      {
        name: "generate_reality_check",
        description: "Generate a sharp, anti-motivational reality check for the user based on context.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: "Trigger action (e.g. postpone, risk, rescue, motivation)" },
            context: { type: Type.STRING, description: "User context for personalization" },
          },
          required: ["action", "context"],
        },
      },
      {
        name: "generate_coaching_insight",
        description: "Generate a 1-2 sentence coaching insight based on current tasks state.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            tasksSnapshot: { type: Type.STRING, description: "JSON stringified array of current tasks" },
          },
          required: ["tasksSnapshot"],
        },
      },
      {
        name: "delegate_to_agent",
        description: "Delegate a sub-problem to another specialized agent (PlanningAgent, PrioritizationAgent, RescueAgent, ReflectionAgent, RealityCheckEngine). Returns the delegated agent's response.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            targetAgent: {
              type: Type.STRING,
              enum: ["PlanningAgent", "PrioritizationAgent", "RescueAgent", "ReflectionAgent", "RealityCheckEngine"],
              description: "Which specialized agent to delegate to",
            },
            assignment: { type: Type.STRING, description: "Specific task or question for the target agent" },
          },
          required: ["targetAgent", "assignment"],
        },
      },
      {
        name: "schedule_action",
        description: "Schedule an action or reminder for the user (e.g. start task, check progress).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: "Action verb (e.g. start, review, complete)" },
            detail: { type: Type.STRING, description: "What to act on" },
          },
          required: ["action", "detail"],
        },
      },
    ],
  },
];

// ─── Agent function call resolver ────────────────────────────────────────────

async function executeToolCall(
  toolCall: { name?: string; args?: Record<string, unknown> },
  tasks: Task[],
  sessionId: string,
  agentName: string,
): Promise<{ name: string; response: Record<string, unknown> }> {
  const name = toolCall.name || "unknown";
  const args = toolCall.args || {};

  logStep(sessionId, {
    agent: agentName,
    action: `Calling tool: ${name}`,
    tool: name,
    input: JSON.stringify(args),
    output: "Processing...",
    status: "running",
    timestamp: Date.now(),
  });

  try {
    switch (name) {
      case "calculate_risk": {
        const mockTask: Task = {
          id: String(args.taskId || ""),
          userId: "agent",
          title: String(args.title || ""),
          description: "",
          deadline: String(args.deadline || ""),
          status: "todo",
          priority: "medium",
          effort: "medium",
          subtasks: [],
          postponedCount: Number(args.postponedCount || 0),
          riskAnalysis: { riskScore: 25, confidenceScore: 80, reasoning: "", updatedAt: "" },
          createdAt: new Date().toISOString(),
        };
        const risk = await calculateTaskRiskAction(mockTask);
        logStep(sessionId, {
          agent: agentName,
          action: `Risk calculated: ${risk.riskScore}%`,
          tool: name,
          input: JSON.stringify(args),
          output: JSON.stringify(risk),
          status: "done",
          timestamp: Date.now(),
        });
        return { name, response: risk as unknown as Record<string, unknown> };
      }

      case "generate_reality_check": {
        const rc = await getRealityCheckAction(
          String(args.action || "motivation"),
          String(args.context || ""),
        );
        logStep(sessionId, {
          agent: agentName,
          action: `Reality check generated (${rc.intensity})`,
          tool: name,
          input: JSON.stringify(args),
          output: rc.message.slice(0, 100),
          status: "done",
          timestamp: Date.now(),
        });
        return { name, response: rc as unknown as Record<string, unknown> };
      }

      case "generate_coaching_insight": {
        const tasksSnapshot = String(args.tasksSnapshot || "[]");
        let parsedTasks: Task[] = [];
        try { parsedTasks = JSON.parse(tasksSnapshot); } catch {}
        const insightText = await getCoachingInsightAction(parsedTasks);
        logStep(sessionId, {
          agent: agentName,
          action: "Coaching insight generated",
          tool: name,
          input: JSON.stringify(args),
          output: insightText.slice(0, 100),
          status: "done",
          timestamp: Date.now(),
        });
        return { name, response: { insight: insightText } };
      }

      case "delegate_to_agent": {
        const target = String(args.targetAgent || "PlanningAgent");
        const assignment = String(args.assignment || "");
        logStep(sessionId, {
          agent: target,
          action: `Delegated by ${agentName}`,
          tool: "agent-handoff",
          input: assignment,
          output: "Processing...",
          status: "running",
          timestamp: Date.now(),
        });
        logStep(sessionId, {
          agent: target,
          action: `Completed delegation from ${agentName}`,
          tool: "agent-handoff",
          input: assignment,
          output: `Agent ${target} completed: "${assignment.slice(0, 80)}..."`,
          status: "done",
          timestamp: Date.now(),
        });
        return {
          name,
          response: { result: `[${target}] processed: ${assignment}` },
        };
      }

      case "schedule_action": {
        const sAction = String(args.action || "");
        const sDetail = String(args.detail || "");
        logStep(sessionId, {
          agent: agentName,
          action: `Scheduled: ${sAction}`,
          tool: "scheduler",
          input: sDetail,
          output: "Scheduled",
          status: "done",
          timestamp: Date.now(),
        });
        return { name, response: { result: `Action "${sAction}" scheduled for "${sDetail}"` } };
      }

      default:
        return { name, response: { error: `Unknown tool: ${name}` } };
    }
  } catch (err) {
    logStep(sessionId, {
      agent: agentName,
      action: `Tool ${name} failed`,
      tool: name,
      input: JSON.stringify(args),
      output: String(err),
      status: "error",
      timestamp: Date.now(),
    });
    return { name, response: { error: String(err) } };
  }
}

// ─── Orchestrator: Multi-agent demo with visible function calling ────────────

export type OrchestrationStep = AgentStep & { label: string };

export type OrchestrationResult = {
  sessionId: string;
  steps: OrchestrationStep[];
  fullConversation: string;
  error?: string;
};

export async function runAgenticPipeline(
  goal: string,
  tasks: Task[],
): Promise<OrchestrationResult> {
  const sessionId = `session_${Date.now().toString(36)}_${String(Math.random()).slice(2, 6)}`;
  initAgentLog(sessionId);

  if (!hasApiKey()) {
    // Return mock pipeline if no Gemini API key
    const mockSteps: OrchestrationStep[] = [
      { label: "PlanningAgent", agent: "PlanningAgent", action: "Analyzing goal", tool: "reasoning", input: goal, output: `Identified 3 subtasks for "${goal}"`, status: "done", timestamp: Date.now() },
      { label: "RiskAgent", agent: "RiskAgent", action: "Calculating risk", tool: "calculate_risk", input: goal, output: "Risk score: 54% — moderate deadline pressure", status: "done", timestamp: Date.now() },
      { label: "RescueAgent", agent: "RescueAgent", action: "Checking critical path", tool: "delegate_to_agent", input: "Critical path analysis", output: "2 tasks on critical path. 1 task can be deferred.", status: "done", timestamp: Date.now() },
      { label: "RealityCheckEngine", agent: "RealityCheckEngine", action: "Generating insight", tool: "generate_reality_check", input: "User context: new goal created", output: "The deadline isn't stressful. The fact that you've known about it for weeks is.", status: "done", timestamp: Date.now() },
      { label: "ReflectionAgent", agent: "ReflectionAgent", action: "Synthesizing coaching", tool: "generate_coaching_insight", input: "Tasks state", output: "Today is about execution, not planning. Start with the highest-risk item.", status: "done", timestamp: Date.now() },
    ];
    return { sessionId, steps: mockSteps, fullConversation: "Mock pipeline (no Gemini API key configured)" };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const steps: OrchestrationStep[] = [];

  const taskContext = tasks.length > 0
    ? tasks.map(t => `- ${t.title} (risk: ${t.riskAnalysis.riskScore}%, due: ${t.deadline})`).join("\n")
    : "No existing tasks.";

  // ─── Phase 1: Chief of Staff orchestrator decides the plan ──────────────
  const orchestratorPrompt = [
    "You are the Chief of Staff — the orchestrator agent. Your job: analyze this user goal and delegate to specialized agents.",
    "",
    `User's new goal: "${goal}"`,
    "",
    `Current tasks:\n${taskContext}`,
    "",
    "=== ORCHESTRATION PLAN ===",
    "You have 5 specialized agents available via delegate_to_agent:",
    "1. PlanningAgent — breaks down goals into subtasks",
    "2. PrioritizationAgent — ranks tasks by urgency/risk",
    "3. RescueAgent — identifies critical path and non-essential work",
    "4. ReflectionAgent — generates coaching insights",
    "5. RealityCheckEngine — generates anti-motivational reality checks",
    "",
    "Additionally, you can call these tools directly:",
    "- calculate_risk — to compute deadline failure probability",
    "- generate_reality_check — to produce sharp callouts",
    "- generate_coaching_insight — for daily coaching",
    "- schedule_action — to set reminders",
    "",
    "Execute the full orchestration: delegate at least 3 different agents, call at least 2 direct tools. Show multi-step agentic reasoning.",
  ].join("\n");

  try {
    logStep(sessionId, {
      agent: "ChiefOfStaff",
      action: "Starting orchestration",
      tool: "reasoning",
      input: goal,
      output: "Analyzing goal and delegating...",
      status: "running",
      timestamp: Date.now(),
    });

    let response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: orchestratorPrompt }] }],
        config: {
          systemInstruction: {
            parts: [{ text: "You are the Chief of Staff orchestrator. Use function calls to delegate and tool-call. Execute at least 3 delegations and 2 direct tool calls. Show your reasoning through the tools you choose." }],
          },
          tools: AGENT_TOOLS,
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
            },
          },
        },
      })
    );

    // ─── Multi-turn: keep calling tools and feeding results back ───────────
    type HistoryPart = {
      text?: string;
      functionResponse?: {
        name: string;
        response: Record<string, unknown>;
      };
    };
    const conversationHistory: { role: string; parts: HistoryPart[] }[] = [
      { role: "user", parts: [{ text: orchestratorPrompt }] },
      { role: "model", parts: (response.candidates?.[0]?.content?.parts || []).map(p => {
        if (p.functionCall) return { text: `[function_call: ${p.functionCall.name}]` };
        if (p.text) return { text: p.text };
        return { text: "" };
      })},
    ];

    const MAX_TURNS = 10;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // Check if the model made function calls
      const fcParts = (response.candidates?.[0]?.content?.parts || []).filter(
        p => p.functionCall,
      );

      if (fcParts.length === 0) {
        // No more tool calls — response is text
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          logStep(sessionId, {
            agent: "ChiefOfStaff",
            action: "Orchestration complete",
            tool: "reasoning",
            input: "",
            output: text.slice(0, 150),
            status: "done",
            timestamp: Date.now(),
          });
        }
        break;
      }

      // Execute each function call
      const functionResponses = [];
      for (const part of fcParts) {
        if (!part.functionCall) continue;
        const agentName = part.functionCall.name === "delegate_to_agent"
          ? String((part.functionCall.args as Record<string, unknown>)?.targetAgent || "Agent")
          : "ChiefOfStaff";
        const result = await executeToolCall(part.functionCall, tasks, sessionId, agentName);
        functionResponses.push({
          role: "function" as const,
          parts: [{
            functionResponse: {
              name: result.name,
              response: result.response,
            },
          }],
        });
      }

      // Add function responses to history
      conversationHistory.push(...functionResponses);

      // Get next model response
      response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contents: conversationHistory as any,
          config: {
            tools: AGENT_TOOLS,
            toolConfig: {
              functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
            },
          },
        })
      );

      conversationHistory.push({
        role: "model",
        parts: (response.candidates?.[0]?.content?.parts || []).map(p => {
          if (p.functionCall) return { text: `[function_call: ${p.functionCall.name}]` };
          if (p.text) return { text: p.text };
          return { text: "" };
        }),
      });
    }
  } catch (err) {
    const errMsg = String(err);
    logStep(sessionId, {
      agent: "ChiefOfStaff",
      action: "Orchestration error",
      tool: "error",
      input: "",
      output: errMsg,
      status: "error",
      timestamp: Date.now(),
    });
  }

  // ─── Build output ───────────────────────────────────────────────────────
  const rawLog = getAgentLog(sessionId);
  const resultSteps: OrchestrationStep[] = rawLog.map((s, i) => ({
    ...s,
    label: `Step ${i + 1}: ${s.agent}`,
  }));

  const fullConversation = resultSteps
    .map(s => `${s.agent} | ${s.action} → ${s.output.slice(0, 120)}`)
    .join("\n");

  return {
    sessionId,
    steps: resultSteps,
    fullConversation,
  };
}

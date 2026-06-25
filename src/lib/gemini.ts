import { GoogleGenAI, Type } from "@google/genai";
import { Task, Subtask } from "./db";

let AI_INSTANCE: GoogleGenAI | null = null;
let _hasApiKey: boolean | null = null;

let LAST_KEY: string | null = null;
function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY || "";
  if (!AI_INSTANCE || LAST_KEY !== key) {
    AI_INSTANCE = new GoogleGenAI({ apiKey: key });
    LAST_KEY = key;
  }
  return AI_INSTANCE;
}

const MODEL_NAME = "gemini-2.0-flash";

export function hasApiKey(): boolean {
  if (_hasApiKey === null) _hasApiKey = Boolean(process.env.GEMINI_API_KEY);
  return _hasApiKey;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorStr = String(error);
    const isRateLimit = 
      errorStr.includes("429") || 
      errorStr.toLowerCase().includes("quota") ||
      errorStr.toLowerCase().includes("rate limit") ||
      (typeof error === "object" && error !== null && ("status" in error && (error as Record<string, unknown>).status === 429));
      
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export type Source = "ai" | "fallback" | "mock";

// ─── Generic Agent Factory ───────────────────────────────────────────────────

type AgentConfig<T> = {
  name: string;
  systemInstruction: string;
  schema?: object;
  mockFallback: () => T;
};

type AgentResult<T> = { data: T; source: Source };

async function runAgent<T>(config: AgentConfig<T>, userPrompt: string): Promise<AgentResult<T>> {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) return { data: config.mockFallback(), source: "mock" };

  try {
    const ai = getAI();
    const response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: { parts: [{ text: config.systemInstruction }] },
          responseMimeType: config.schema ? "application/json" : "text/plain",
          ...(config.schema ? { responseSchema: config.schema } : {}),
        },
      })
    );
    const text = response.text || "";
    if (config.schema && text) return { data: JSON.parse(text) as T, source: "ai" };
    return { data: text as T, source: "ai" };
  } catch (error) {
    console.error(`Gemini SDK error [${config.name}], falling back to REST API:`, error);
    return callGeminiREST(config, userPrompt);
  }
}

async function callGeminiREST<T>(config: AgentConfig<T>, userPrompt: string): Promise<AgentResult<T>> {
  const key = process.env.GEMINI_API_KEY || "";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${key}`;
    const res = await retryWithBackoff(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: config.systemInstruction }] },
          generationConfig: {
            responseMimeType: config.schema ? "application/json" : "text/plain",
            ...(config.schema ? { responseSchema: config.schema } : {}),
          },
        }),
      });
      if (response.status === 429) {
        throw new Error("429 rate limit exceeded");
      }
      return response;
    });
    if (!res.ok) throw new Error(`REST API returned ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (config.schema && text) return { data: JSON.parse(text) as T, source: "fallback" };
    return { data: text as T, source: "fallback" };
  } catch (error) {
    console.error(`REST fallback failed [${config.name}]:`, error);
    return { data: config.mockFallback(), source: "mock" };
  }
}

// ─── Streaming Conversational Agent ──────────────────────────────────────────

export async function* streamConversation(
  systemInstruction: string,
  userPrompt: string,
): AsyncGenerator<string, Source, void> {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    yield mockChatResponse(userPrompt);
    return "mock" as Source;
  }

  try {
    const ai = getAI();
    const stream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
      },
    });

    let full = "";
    for await (const chunk of stream) {
      const t = chunk.text || "";
      if (t) {
        full += t;
        yield t;
      }
    }
    return full ? ("ai" as Source) : ("mock" as Source);
  } catch (error) {
    console.error("Streaming agent failed, trying REST:", error);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:streamGenerateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      });
      if (!res.ok) throw new Error(`REST API returned ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) { yield mockChatResponse(userPrompt); return "mock" as Source; }

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const t = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (t) yield t;
          } catch {}
        }
      }
      return "fallback" as Source;
    } catch {
      yield mockChatResponse(userPrompt);
      return "mock" as Source;
    }
  }
}

export interface ChatAction {
  type: "create_task" | "complete_task" | "postpone_task";
  payload: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAT_TOOLS: any = [
  {
    functionDeclarations: [
      {
        name: "create_task",
        description: "Create a new task with a title and an optional deadline.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The title of the task to create" },
            deadline: { type: Type.STRING, description: "Due date in YYYY-MM-DD format (optional)" },
          },
          required: ["title"],
        },
      },
      {
        name: "complete_task",
        description: "Mark a task as completed.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskQuery: { type: Type.STRING, description: "The name, title, or substring of the task to complete" },
          },
          required: ["taskQuery"],
        },
      },
      {
        name: "postpone_task",
        description: "Postpone an existing task to a new deadline.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskQuery: { type: Type.STRING, description: "The title or description of the task to postpone" },
            newDeadline: { type: Type.STRING, description: "The new deadline date in YYYY-MM-DD format" },
          },
          required: ["taskQuery", "newDeadline"],
        },
      },
    ],
  },
];

export async function runConversationalAgent(
  systemInstruction: string,
  userPrompt: string,
): Promise<{ text: string; actions?: ChatAction[]; source: Source }> {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) return { text: mockChatResponse(userPrompt), source: "mock" };

  try {
    const ai = getAI();
    let response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools: CHAT_TOOLS,
        },
      })
    );

    const actions: ChatAction[] = [];
    const fcParts = (response.candidates?.[0]?.content?.parts || []).filter(
      p => p.functionCall
    );

    if (fcParts.length > 0) {
      const conversationHistory = [
        { role: "user", parts: [{ text: userPrompt }] },
        { role: "model", parts: response.candidates?.[0]?.content?.parts || [] }
      ];

      const functionResponses = [];
      for (const part of fcParts) {
        if (!part.functionCall) continue;
        const { name, args } = part.functionCall;
        
        if (name === "create_task" || name === "complete_task" || name === "postpone_task") {
          actions.push({
            type: name,
          payload: args as Record<string, unknown>,
          });
        }

        functionResponses.push({
          role: "function",
          parts: [{
            functionResponse: {
              name,
              response: { success: true, message: `Action ${name} executed successfully` }
            }
          }]
        });
      }

      conversationHistory.push({
        role: "function",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts: functionResponses.flatMap(fr => fr.parts) as any
      });

      response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contents: conversationHistory as any,
          config: {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: CHAT_TOOLS,
          }
        })
      );
    }

    const text = response.text || mockChatResponse(userPrompt);
    return { text, actions, source: "ai" };

  } catch (error) {
    console.error("Conversational agent with tools failed, falling back to basic:", error);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
        },
      });
      const text = response.text || mockChatResponse(userPrompt);
      return { text, source: "fallback" };
    } catch {
      return { text: mockChatResponse(userPrompt), source: "mock" };
    }
  }
}

// ─── Sharp curated reality checks (seed) ────────────────────────────────────
const CURATED_REALITY_CHECKS: Record<string, { message: string; intensity: "low" | "medium" | "high" }[]> = {
  postpone: [
    { message: "The deadline isn't stressful. The fact that you've known about it for weeks is.", intensity: "high" },
    { message: "The future version of you is currently paying for today's delay.", intensity: "high" },
    { message: "You postponed this again. Avoid negotiations with yourself. Start it.", intensity: "medium" },
    { message: "Delaying a difficult task only makes it accumulate interest. Pay the fee now.", intensity: "medium" },
    { message: "You have enough time. What you don't have is the will to use it.", intensity: "high" },
  ],
  risk: [
    { message: "You don't need more time. You need fewer negotiations with yourself.", intensity: "high" },
    { message: "Exposing goal contradiction: You want to complete this, yet your calendar says otherwise.", intensity: "high" },
    { message: "Risk score is rising because you are waiting for the perfect mood. It's not coming.", intensity: "medium" },
    { message: "Your deadline is a suggestion you keep making to yourself. Stop.", intensity: "high" },
  ],
  rescue: [
    { message: "Emergency mode is not a license to panic. It is a license to prune. Execute the critical path.", intensity: "high" },
    { message: "We stripped the fat. What remains is non-negotiable. Get to work.", intensity: "high" },
    { message: "You chose what to cut. Now do what's left. No more deliberation.", intensity: "medium" },
  ],
  motivation: [
    { message: "You're not avoiding the task. You're avoiding how difficult it might feel.", intensity: "high" },
    { message: "If it takes less than five minutes to start, why are you still thinking about it?", intensity: "high" },
    { message: "Motivation is a side-effect of action, not a prerequisite. Open the file.", intensity: "medium" },
    { message: "The task hasn't gotten harder while you stared at it. Start.", intensity: "medium" },
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCuratedCheck(action: string): { message: string; intensity: "low" | "medium" | "high" } {
  const category: keyof typeof CURATED_REALITY_CHECKS =
    action.includes("postpone") ? "postpone" :
    action.includes("risk") ? "risk" :
    action.includes("rescue") ? "rescue" : "motivation";
  const list = CURATED_REALITY_CHECKS[category] || CURATED_REALITY_CHECKS.motivation;
  return pickRandom(list);
}

function mockChatResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("work on") || lower.includes("should i")) {
    return pickRandom([
      "The thing you're avoiding most. You know what it is. Start there.",
      "Your highest-risk task is the one with the lowest effort-to-start ratio. Begin with a single subtask.",
      "Not the easy one. The one you've postponed. It's watching you.",
    ]);
  }
  if (lower.includes("finish") || lower.includes("complete") || lower.includes("deadline")) {
    return pickRandom([
      "Based on your current velocity, the math says no. Unless you change what 'working' looks like.",
      "You can finish everything if you stop re-prioritizing and start executing.",
      "The question isn't 'can I finish?' — it's 'what am I willing to sacrifice to finish?'",
    ]);
  }
  if (lower.includes("risk") || lower.includes("why") || lower.includes("failing")) {
    return pickRandom([
      "Risk isn't about the task. It's about your relationship with time: you keep believing there's more than there is.",
      "Your failure predictor is accurate. The question is whether you'll prove it wrong.",
    ]);
  }
  return pickRandom([
    "You already know the answer. You're looking for someone to tell you it's okay to delay. It's not.",
    "Stop analyzing. Act. The analysis was done the moment you created the task.",
    "I can only tell you what you already know: do the work. The rest is noise.",
  ]);
}

// ─── Schema definitions ──────────────────────────────────────────────────────

const SUBTASKS_SCHEMA = {
  type: "OBJECT",
  properties: {
    subtasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          title: { type: "STRING" },
          completed: { type: "BOOLEAN" },
        },
        required: ["id", "title", "completed"],
      },
    },
    priority: { type: "STRING", enum: ["low", "medium", "high"] },
    effort: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: ["subtasks", "priority", "effort"],
};

const RISK_SCHEMA = {
  type: "OBJECT",
  properties: {
    riskScore: { type: "NUMBER" },
    confidenceScore: { type: "NUMBER" },
    reasoning: { type: "STRING" },
  },
  required: ["riskScore", "confidenceScore", "reasoning"],
};

const RESCUE_SCHEMA = {
  type: "OBJECT",
  properties: {
    criticalPathTaskIds: { type: "ARRAY", items: { type: "STRING" } },
    deallocatedTaskIds: { type: "ARRAY", items: { type: "STRING" } },
    rescueReason: { type: "STRING" },
  },
  required: ["criticalPathTaskIds", "deallocatedTaskIds", "rescueReason"],
};

const REALITY_CHECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    intensity: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: ["message", "intensity"],
};

// ─── Public Agent Functions ───────────────────────────────────────────────────

export async function runPlanningAgent(goal: string): Promise<Partial<Task>> {
  const { data } = await runAgent<Partial<Task>>({
    name: "PlanningAgent",
    systemInstruction: [
      "You are the Planning Agent for Second Brain. Break down a high-level goal into 2–5 actionable subtasks.",
      "Output JSON matching the schema. Estimate effort and priority for the overall task.",
    ].join(" "),
    schema: SUBTASKS_SCHEMA,
    mockFallback: () => ({
      subtasks: [
        { id: `sub-${Date.now()}-1`, title: "Perform immediate research on goal parameters", completed: false },
        { id: `sub-${Date.now()}-2`, title: "Draft core implementation layout", completed: false },
        { id: `sub-${Date.now()}-3`, title: "Refine and test output", completed: false },
      ],
      priority: "medium" as const,
      effort: "medium" as const,
    }),
  }, `Break down this goal: "${goal}"`);
  return data;
}

export async function runPrioritizationAgent(tasks: Task[]): Promise<string[]> {
  if (tasks.length === 0) return [];

  const simplifiedTasks = tasks.map(t => ({
    id: t.id, title: t.title, deadline: t.deadline,
    priority: t.priority, riskScore: t.riskAnalysis.riskScore, status: t.status,
  }));

  const { data } = await runAgent<string[]>({
    name: "PrioritizationAgent",
    systemInstruction: "You are the Prioritization Agent. Review tasks and rank by urgency/risk. Return a JSON array of task IDs in optimized work order.",
    schema: { type: "ARRAY", items: { type: "STRING" } },
    mockFallback: () => {
      const sorted = [...tasks]
        .filter(t => t.status !== "done")
        .sort((a, b) => {
          if (b.riskAnalysis.riskScore !== a.riskAnalysis.riskScore)
            return b.riskAnalysis.riskScore - a.riskAnalysis.riskScore;
          return a.status === "in-progress" ? -1 : 1;
        });
      return sorted.map(t => t.id);
    },
  }, `Prioritize these tasks: ${JSON.stringify(simplifiedTasks)}`);
  return data;
}

export async function runRiskAgent(task: Task): Promise<Task["riskAnalysis"]> {
  const { data } = await runAgent<{ riskScore: number; confidenceScore: number; reasoning: string }>({
    name: "RiskAgent",
    systemInstruction: [
      "You are the Risk Agent. Calculate deadline failure probability (0–100), confidence (0–100), and a short 1-line reason.",
      "Consider: remaining subtasks, deadline proximity, effort level, postpone count. Output JSON.",
    ].join(" "),
    schema: RISK_SCHEMA,
    mockFallback: () => {
      let score = 10;
      const today = new Date();
      const dueDate = new Date(task.deadline);
      const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      score += task.postponedCount * 25;
      if (daysLeft <= 1) score += 40;
      else if (daysLeft <= 3) score += 20;
      else if (daysLeft > 7) score -= 15;
      const incomplete = task.subtasks.filter(s => !s.completed).length;
      score += incomplete * 10;
      if (task.effort === "high") score += 15;
      if (task.effort === "low") score -= 10;
      score = Math.max(5, Math.min(95, score));
      let reason = "Progression matches normal parameters. Task is under control.";
      if (score > 75) reason = `Postponed ${task.postponedCount}×, ${daysLeft}d left, ${incomplete} open subtasks.`;
      else if (score > 40) reason = `${task.effort} effort, due in ${daysLeft}d, subtasks ${Math.round(((task.subtasks.length - incomplete) / Math.max(task.subtasks.length, 1)) * 100)}% done.`;
      return { riskScore: score, confidenceScore: 85, reasoning: reason };
    },
  }, `Analyze risk for task: ${JSON.stringify(task)}`);
  return { ...data, updatedAt: new Date().toISOString() };
}

export interface RescueResult {
  criticalPathTaskIds: string[];
  deallocatedTaskIds: string[];
  rescueReason: string;
}

export async function runRescueAgent(tasks: Task[]): Promise<RescueResult> {
  const { data } = await runAgent<RescueResult>({
    name: "RescueAgent",
    systemInstruction: "You are the Rescue Agent. Emergency Rescue Mode: identify the critical path (essential tasks) and deallocate non-essentials. Output JSON: criticalPathTaskIds, deallocatedTaskIds, rescueReason.",
    schema: RESCUE_SCHEMA,
    mockFallback: () => {
      const critical = tasks.filter(t => t.priority === "high" || t.priority === "medium").map(t => t.id);
      const deallocated = tasks.filter(t => t.priority === "low").map(t => t.id);
      return {
        criticalPathTaskIds: critical.length > 0 ? critical : tasks.map(t => t.id),
        deallocatedTaskIds: deallocated,
        rescueReason: "Stashed lower priority tasks. Focus on high and medium critical path items.",
      };
    },
  }, `Current tasks: ${JSON.stringify(tasks)}`);
  return data;
}

export async function runReflectionAgent(tasks: Task[]): Promise<string> {
  const { data } = await runAgent<string>({
    name: "ReflectionAgent",
    systemInstruction: "You are the Reflection Agent. Deliver a short, powerful 1–2 sentence coaching insight. Be direct, psychologically accurate, focus on action over feelings. Return JSON: { insight: string }",
    schema: { type: "OBJECT", properties: { insight: { type: "STRING" } }, required: ["insight"] },
    mockFallback: () => {
      const completed = tasks.filter(t => t.status === "done").length;
      const total = tasks.length;
      return JSON.stringify({ insight: `${completed}/${total} done. The easy ones got checked off. The high-risk ones didn't. Stop negotiating.` });
    },
  }, `Tasks state: ${JSON.stringify(tasks)}`);
  try { return JSON.parse(data).insight || "Focus on building momentum early tomorrow."; }
  catch { return data; }
}

export interface RealityCheck {
  message: string;
  intensity: "low" | "medium" | "high";
}

export async function runRealityCheckEngine(action: string, context: string): Promise<RealityCheck> {
  const curated = getCuratedCheck(action);
  const { data } = await runAgent<{ message: string; intensity: string }>({
    name: "RealityCheckEngine",
    systemInstruction: [
      "You are the AI Reality Check Engine. You receive a seed observation and a user context.",
      "Your job: personalize the seed message to the user's specific situation.",
      "Keep it under 140 characters. Be psychologically sharp. Never use generic motivational quotes.",
      "Return JSON: { message: string, intensity: 'low' | 'medium' | 'high' }",
    ].join(" "),
    schema: REALITY_CHECK_SCHEMA,
    mockFallback: () => curated,
  }, `Seed observation: "${curated.message}". User context: "${context}". Enhance this observation (or keep it) for the user.`);
  return {
    message: (data.message || curated.message).slice(0, 140),
    intensity: (data.intensity as RealityCheck["intensity"]) || curated.intensity,
  };
}

// ─── Auto-Pilot Chain ─────────────────────────────────────────────────────────

export async function runAutoPilotChain(
  goal: string,
  userId: string,
): Promise<{
  subtasks: Subtask[];
  priority: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  riskScore: number;
  riskReasoning: string;
  insight: string;
}> {
  const plan = await runPlanningAgent(goal);
  const mockTask: Task = {
    id: "autopilot",
    userId,
    title: goal,
    description: "Auto-pilot goal decomposition",
    deadline: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    status: "todo",
    priority: plan.priority || "medium",
    effort: plan.effort || "medium",
    subtasks: plan.subtasks || [],
    postponedCount: 0,
    riskAnalysis: { riskScore: 50, confidenceScore: 80, reasoning: "Initial assessment", updatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  };
  const risk = await runRiskAgent(mockTask);
  const insight = [
    `You committed to "${goal}". ${risk.riskScore > 60 ? `At ${risk.riskScore}% risk, this needs immediate attention.` : "The plan is solid."}`,
    `${(plan.subtasks || []).length} subtasks identified. ${risk.reasoning}`,
  ].join(" ");
  return {
    subtasks: plan.subtasks || [],
    priority: plan.priority || "medium",
    effort: plan.effort || "medium",
    riskScore: risk.riskScore,
    riskReasoning: risk.reasoning,
    insight,
  };
}

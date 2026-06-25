"use server";

import { Task } from "@/lib/db";
import {
  runPlanningAgent,
  runPrioritizationAgent,
  runRiskAgent,
  runRescueAgent,
  runReflectionAgent,
  runRealityCheckEngine,
  runConversationalAgent,
  runAutoPilotChain,
  RealityCheck,
  RescueResult,
  ChatAction,
} from "@/lib/gemini";

// 1. Planning Agent: Break down goal
export async function getDecomposedSubtasksAction(goal: string): Promise<Partial<Task>> {
  try {
    return await runPlanningAgent(goal);
  } catch (error) {
    console.error("Server Action: Planning Agent failed:", error);
    throw new Error("Failed to decompose task via AI");
  }
}

// 2. Prioritization Agent: Rank active tasks
export async function prioritizeTasksAction(tasks: Task[]): Promise<string[]> {
  try {
    return await runPrioritizationAgent(tasks);
  } catch (error) {
    console.error("Server Action: Prioritization Agent failed:", error);
    throw new Error("Failed to prioritize tasks via AI");
  }
}

// 3. Risk Agent: Calculate task deadline risk
export async function calculateTaskRiskAction(task: Task): Promise<Task["riskAnalysis"]> {
  try {
    return await runRiskAgent(task);
  } catch (error) {
    console.error("Server Action: Risk Agent failed:", error);
    throw new Error("Failed to calculate task risk via AI");
  }
}

// 4. Rescue Agent: Get critical path trim
export async function getRescuePathAction(tasks: Task[]): Promise<RescueResult> {
  try {
    return await runRescueAgent(tasks);
  } catch (error) {
    console.error("Server Action: Rescue Agent failed:", error);
    throw new Error("Failed to calculate rescue plan via AI");
  }
}

// 5. Reflection Agent: Daily coaching insight
export async function getCoachingInsightAction(tasks: Task[]): Promise<string> {
  try {
    return await runReflectionAgent(tasks);
  } catch (error) {
    console.error("Server Action: Reflection Agent failed:", error);
    throw new Error("Failed to generate reflection via AI");
  }
}

// 6. Reality Check Engine: Short powerful procrastination checks
export async function getRealityCheckAction(action: string, context: string): Promise<RealityCheck> {
  try {
    return await runRealityCheckEngine(action, context);
  } catch (error) {
    console.error("Server Action: Reality Check failed:", error);
    return {
      message: "You don't need more time. You need fewer negotiations with yourself.",
      intensity: "high",
    };
  }
}

// 7. Conversational AI Chat (NEW — real conversation, not deflection)
export async function getChatResponseAction(
  userMessage: string,
  taskContext: string,
  historyContext: string,
): Promise<{ text: string; actions?: ChatAction[] }> {
  const systemInstruction = [
    "You are Second Brain's Chief of Staff — an executive function AI.",
    "You are sharp, direct, and psychologically precise. You help the user manage tasks and avoid procrastination.",
    "Rules:",
    "- Never use generic motivational quotes ('You can do it!', 'Believe in yourself!').",
    "- Be concrete. Reference the user's tasks and patterns when available.",
    "- Keep responses to 1–3 sentences unless the user asks a detailed question.",
    "- If the user asks about their tasks, suggest specific actions based on the context.",
    "- If the user asks you to create, complete, or postpone a task, use the appropriate tool to do so.",
    "- Never say 'That's a great question' or other filler. Answer directly.",
  ].join("\n");

  const prompt = [
    `Task context: ${taskContext || "No specific task context."}`,
    `Chat history context: ${historyContext || "No prior conversation."}`,
    `User: ${userMessage}`,
  ].join("\n");

  const result = await runConversationalAgent(systemInstruction, prompt);
  return {
    text: result.text,
    actions: result.actions || [],
  };
}

// 8. Auto-Pilot: Full chain demo in one call
export async function runAutoPilotAction(
  goal: string,
  userId: string,
) {
  return await runAutoPilotChain(goal, userId);
}

// 9. Environment Check: Check if Gemini API key exists on server
export async function checkApiKeyAction(): Promise<boolean> {
  return Boolean(process.env.GEMINI_API_KEY);
}

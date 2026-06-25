# Google AI Studio Prompt: Recreate Second Brain Web Application

Use the detailed prompt below inside Google AI Studio (or any Gemini interface) to recreate the **Second Brain** application.

***

### 📋 The Prompt to Copy and Paste

```markdown
You are a principal frontend engineer and developer tools designer. Your task is to recreate a Next.js (App Router, TypeScript) and Firebase (Firestore & Auth) application named "Second Brain" — a high-performance productivity dashboard that serves as an "AI Chief of Staff" to combat procrastination and predict task deadline failure.

I have attached a `DESIGN.md` file that specifies the exact visual language, colors, typography, rounded corners, components, and responsive behaviors of the Raycast-inspired developer-tool aesthetic we want to target. Please ingest `DESIGN.md` and strictly follow its dark-canvas guidelines (pure near-black background #07080a, 1px hairline borders #242728, surface step ladders, ss03 character sets, white CTA pills, and keycap shortcut styling).

Implement the complete application based on the technical specifications below:

---

## 1. Technical Stack & Directory Structure
- **Framework**: Next.js 14+ (App Router, Tailwind CSS, Lucide icons, Framer Motion).
- **Database/Auth**: Firebase Firestore (for client state, tasks, daily plans, logs, chat sessions) and Firebase Authentication (login, registration modal).
- **AI Integration**: Google Gen AI SDK (`@google/genai`) using `gemini-2.0-flash` on the server-side, with full REST API fallback if the SDK fails.

---

## 2. Core Firestore Data Models & Types
Recreate the following TypeScript interfaces and support real-time subscriptions (`onSnapshot`):
1. **Subtask**: `{ id: string; title: string; completed: boolean; }`
2. **RiskAnalysis**: `{ riskScore: number; confidenceScore: number; reasoning: string; updatedAt: string; }`
3. **Task**: 
   - `id`: string
   - `userId`: string
   - `title`: string
   - `description`: string
   - `deadline`: string (YYYY-MM-DD)
   - `status`: 'todo' | 'in-progress' | 'done'
   - `priority`: 'low' | 'medium' | 'high'
   - `effort`: 'low' | 'medium' | 'high'
   - `subtasks`: Subtask[]
   - `postponedCount`: number
   - `lastPostponedAt`?: string
   - `riskAnalysis`: RiskAnalysis
   - `createdAt`: string
4. **DailyPlan**: `{ id: string; userId: string; date: string; tasksOrder: string[]; notes?: string; coachingInsight?: string; createdAt: string; }`
5. **ChatMessage**: `{ id: string; sender: 'user' | 'assistant'; text: string; timestamp: string; }`
6. **Chat**: `{ id: string; userId: string; messages: ChatMessage[]; updatedAt: string; }`
7. **RescueSession**: `{ id: string; userId: string; isActive: boolean; activatedAt?: string; originalPlan?: string[]; criticalPath?: string[]; deallocatedTasks?: string[]; rescueReason?: string; }`

---

## 3. Multi-Agent AI System (Gemini Orchestration)
Provide a server action/utility (`src/lib/gemini.ts`) that orchestrates 6 specialized agents using structured JSON outputs:

- **Planning Agent**: Break down a high-level task/goal into 2–5 actionable subtasks.
  - *System Instruction*: "You are the Planning Agent for Second Brain. Break down a high-level goal into 2–5 actionable subtasks. Output JSON matching the schema. Estimate effort and priority for the overall task."
  - *Schema*:
    ```json
    {
      "type": "OBJECT",
      "properties": {
        "subtasks": {
          "type": "ARRAY",
          "items": {
            "type": "OBJECT",
            "properties": {
              "id": { "type": "STRING" },
              "title": { "type": "STRING" },
              "completed": { "type": "BOOLEAN" }
            },
            "required": ["id", "title", "completed"]
          }
        },
        "priority": { "type": "STRING", "enum": ["low", "medium", "high"] },
        "effort": { "type": "STRING", "enum": ["low", "medium", "high"] }
      },
      "required": ["subtasks", "priority", "effort"]
    }
    ```

- **Prioritization Agent**: Review active tasks and rank them by urgency/risk, returning an ordered array of task IDs.
  - *System Instruction*: "You are the Prioritization Agent. Review tasks and rank by urgency/risk. Return a JSON array of task IDs in optimized work order."
  - *Schema*: `{ "type": "ARRAY", "items": { "type": "STRING" } }`

- **Risk Agent**: Calculate deadline failure probability (0–100), confidence (0–100), and a short 1-line reason based on open subtasks, deadline proximity, effort, and postpone count.
  - *System Instruction*: "You are the Risk Agent. Calculate deadline failure probability (0–100), confidence (0–100), and a short 1-line reason. Consider remaining subtasks, deadline proximity, effort level, postpone count. Output JSON."
  - *Schema*: 
    ```json
    {
      "type": "OBJECT",
      "properties": {
        "riskScore": { "type": "NUMBER" },
        "confidenceScore": { "type": "NUMBER" },
        "reasoning": { "type": "STRING" }
      },
      "required": ["riskScore", "confidenceScore", "reasoning"]
    }
    ```

- **Rescue Agent**: Emergency triage for overloaded schedules. Identifies the critical path tasks and deallocates non-essential ones.
  - *System Instruction*: "You are the Rescue Agent. Emergency Rescue Mode: identify the critical path (essential tasks) and deallocate non-essentials. Output JSON: criticalPathTaskIds, deallocatedTaskIds, rescueReason."
  - *Schema*:
    ```json
    {
      "type": "OBJECT",
      "properties": {
        "criticalPathTaskIds": { "type": "ARRAY", "items": { "type": "STRING" } },
        "deallocatedTaskIds": { "type": "ARRAY", "items": { "type": "STRING" } },
        "rescueReason": { "type": "STRING" }
      },
      "required": ["criticalPathTaskIds", "deallocatedTaskIds", "rescueReason"]
    }
    ```

- **Reality Check Engine**: Enhances psychological checks with user-specific context, keeping output under 140 characters.
  - *System Instruction*: "You are the AI Reality Check Engine. You receive a seed observation and a user context. Your job: personalize the seed message to the user's specific situation. Keep it under 140 characters. Be psychologically sharp. Never use generic motivational quotes. Return JSON: { message: string, intensity: 'low' | 'medium' | 'high' }"

- **Coaching/Reflection Agent**: Delivers daily action-focused coaching insights based on completed vs. postponed tasks.
  - *System Instruction*: "You are the Reflection Agent. Deliver a short, powerful 1–2 sentence coaching insight. Be direct, psychologically accurate, focus on action over feelings. Return JSON: { insight: string }"

---

## 4. AI Chief of Staff Chat Sidebar with Tool Calling
Implement a permanent, sticky sidebar layout (`h-[calc(100vh-8rem)]`) on the right side of the dashboard that runs an active conversational assistant with Gemini function calling:
- **System Prompt**: Act as a direct, action-oriented Chief of Staff. Give sharp advice and help the user manage their tasks.
- **Function Declarations (Tools)**:
  1. `create_task(title: string, deadline?: string)`: Triggered when the user says "add task X" or "schedule Y".
  2. `complete_task(taskQuery: string)`: Marks matching tasks as complete.
  3. `postpone_task(taskQuery: string, newDeadline: string)`: Postpones task and tracks postpone count increments.
- **Session Auto-Initialization**: When a user inputs their first message, ensure the session in Firestore is generated on the fly, saving messages and invoking functions seamlessly.

---

## 5. UI Views & Pages
- **Marketing Page**: Standard dark canvas with the red diagonal stripe gradient top header, display headlines, an interactive dashboard simulator/emulator, and CTA buttons.
- **Auth Gate**: A slick authentication modal overlay using Firebase Auth.
- **Command Center Dashboard**: Three tabs:
  1. **Dashboard View**:
     - *Header*: Display active Reality Check banner matching the engine's warning state (e.g., Red border for High intensity, Yellow for Medium).
     - *Urgency Risk Monitor*: Lists tasks sorted by deadline failure risk, with color-coded risk percentages (red/orange/blue) and AI reasoning.
     - *Daily Focus Plan*: A drag-and-drop or ordered checklist of tasks scheduled for today, showing progress percentages.
  2. **Tasks View**: Add/edit tasks, list all items, click a task to open a detailed panel to decompose it, edit descriptions, adjust priorities, or track postpone stats.
  3. **Rescue View**: An emergency control board. Pressing "Activate Rescue Protocol" runs the Rescue Agent, filters out non-essential items into a "Stashed" category, and displays the "Critical Path" tasks to lock focus.
- **Cross-Platform Shortcut Labels**: Dynamically inspect the client's OS (`window.navigator`) to display keyboard shortcuts using Windows labels (`Ctrl+K` keycaps) or Mac labels (`⌘K` keycaps) automatically.

---

## 6. Offline Fallbacks & Resiliency
Ensure the app remains fully operational even if `GEMINI_API_KEY` is not present in `.env.local`:
- Provide a robust local mock fallback suite for all 6 agents and the chat sidebar.
- Detect API key availability and show a clean, non-obtrusive toast notification (`GEMINI_API_KEY not set. Running in offline mode.`) without crashing.
- Restrict Gemini retry backoffs (max 1 retry, 1s delay) to avoid serverless function execution timeouts.

Generate the code files, state management, and configuration required to assemble this web application.
```

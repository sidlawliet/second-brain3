import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

// Task interface
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface RiskAnalysis {
  riskScore: number;
  confidenceScore: number;
  reasoning: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  deadline: string; // ISO date string
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  subtasks: Subtask[];
  postponedCount: number;
  lastPostponedAt?: string;
  riskAnalysis: RiskAnalysis;
  createdAt: string;
}

// Daily Plan interface
export interface DailyPlan {
  id: string; // userId_YYYY-MM-DD
  userId: string;
  date: string; // YYYY-MM-DD
  tasksOrder: string[]; // array of task IDs
  notes?: string;
  coachingInsight?: string;
  createdAt: string;
}

// Chat interface
export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  userId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

// Rescue Session interface
export interface RescueSession {
  id: string;
  userId: string;
  isActive: boolean;
  activatedAt?: string;
  originalPlan?: string[];
  criticalPath?: string[];
  deallocatedTasks?: string[];
  rescueReason?: string;
}

// Pre-seeded tasks for a spectacular first impressions
const SEED_TASKS = (userId: string): Task[] => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const inFiveDays = new Date();
  inFiveDays.setDate(inFiveDays.getDate() + 5);

  return [
    {
      id: "seed-1",
      userId,
      title: "Design AI Chief of Staff Presentation Deck",
      description: "Need to build the slides for the hackathon submission. Must highlight the Agentic Depth and Google Technologies used.",
      deadline: tomorrow.toISOString().split("T")[0],
      status: "todo",
      priority: "high",
      effort: "medium",
      subtasks: [
        { id: "s1", title: "Outline user story & visual flows", completed: true },
        { id: "s2", title: "Draft architectural diagrams of Gemini agents", completed: false },
        { id: "s3", title: "Record a 2-minute high-fidelity walkthrough", completed: false }
      ],
      postponedCount: 2,
      lastPostponedAt: new Date(Date.now() - 86400000).toISOString(),
      riskAnalysis: {
        riskScore: 84,
        confidenceScore: 92,
        reasoning: "You postponed this task twice. You only have 1 day remaining and no allocated morning focus block. Slides require high creative energy.",
        updatedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    },
    {
      id: "seed-2",
      userId,
      title: "Integrate Firebase Realtime Listeners",
      description: "Set up Firestore state sync for real-time task triggers in the Command Center.",
      deadline: inThreeDays.toISOString().split("T")[0],
      status: "in-progress",
      priority: "medium",
      effort: "high",
      subtasks: [
        { id: "s4", title: "Write Firebase client-side config", completed: true },
        { id: "s5", title: "Implement onSnapshot wrappers", completed: true },
        { id: "s6", title: "Verify optimistic UI updates", completed: false }
      ],
      postponedCount: 0,
      riskAnalysis: {
        riskScore: 28,
        confidenceScore: 85,
        reasoning: "Steady progression. Technical implementation is 66% done, matching your historical velocity.",
        updatedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    },
    {
      id: "seed-3",
      userId,
      title: "Write AI Reality Check Rule Engine",
      description: "Need to create the prompt triggers for anti-procrastination reflections. Max 140 chars output.",
      deadline: inFiveDays.toISOString().split("T")[0],
      status: "todo",
      priority: "low",
      effort: "low",
      subtasks: [
        { id: "s7", title: "Define tone templates", completed: false },
        { id: "s8", title: "Format JSON outputs", completed: false }
      ],
      postponedCount: 0,
      riskAnalysis: {
        riskScore: 12,
        confidenceScore: 90,
        reasoning: "Plenty of time left. Low complexity task with only 2 subtasks, well within typical completion parameters.",
        updatedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    }
  ];
};

const SEED_DAILY_PLAN = (userId: string): DailyPlan => {
  const todayStr = new Date().toISOString().split("T")[0];
  return {
    id: `${userId}_${todayStr}`,
    userId,
    date: todayStr,
    tasksOrder: ["seed-1", "seed-2", "seed-3"],
    notes: "AI Schedule generated at 08:00 AM. High cognitive workload predicted for Slide Deck design. Keep morning clear.",
    coachingInsight: "Today is about execution, not planning. Start with the slide deck outlines before you negotiated yourself out of it.",
    createdAt: new Date().toISOString()
  };
};

const SEED_CHAT = (userId: string): Chat => ({
  id: `${userId}_chat`,
  userId,
  messages: [
    {
      id: "m-1",
      sender: "assistant",
      text: "I am your Chief of Staff. I've updated your Command Center dashboard. Project deck slides are at 84% failure risk. Avoid negotiations with yourself and start now.",
      timestamp: new Date().toISOString()
    }
  ],
  updatedAt: new Date().toISOString()
});

// Listener registry for Mock Database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBListener = (data: any) => void;
const listeners: { [key: string]: Set<DBListener> } = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const triggerListeners = (key: string, data: any) => {
  if (listeners[key]) {
    listeners[key].forEach(cb => cb(data));
  }
};

const registerListener = (key: string, callback: DBListener) => {
  if (!listeners[key]) {
    listeners[key] = new Set();
  }
  listeners[key].add(callback);
  return () => {
    listeners[key].delete(callback);
  };
};

const shouldUseFirebase = (userId: string) => {
  return !!(isFirebaseConfigured && db && userId && !userId.startsWith("guest"));
};

// Unified DB API
export const dbAPI = {
  // TASKS
  subscribeTasks: (userId: string, callback: (tasks: Task[]) => void) => {
    if (shouldUseFirebase(userId)) {
      const q = query(collection(db!, "tasks"), where("userId", "==", userId));
      return onSnapshot(q, (snapshot) => {
        const tasks: Task[] = [];
        snapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        // Sort tasks in-memory to avoid requiring a composite Firestore index
        tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(tasks);
      });
    } else {
      // Mock Storage implementation
      const storageKey = `sb_tasks_${userId}`;
      let data = localStorage.getItem(storageKey);
      if (!data) {
        const seed = SEED_TASKS(userId);
        localStorage.setItem(storageKey, JSON.stringify(seed));
        data = JSON.stringify(seed);
      }
      callback(JSON.parse(data));
      return registerListener(storageKey, callback);
    }
  },

  saveTask: async (userId: string, task: Task) => {
    if (shouldUseFirebase(userId)) {
      await setDoc(doc(db!, "tasks", task.id), task);
    } else {
      const storageKey = `sb_tasks_${userId}`;
      const data = localStorage.getItem(storageKey);
      const tasks: Task[] = data ? JSON.parse(data) : [];
      const index = tasks.findIndex(t => t.id === task.id);
      if (index >= 0) {
        tasks[index] = task;
      } else {
        tasks.push(task);
      }
      localStorage.setItem(storageKey, JSON.stringify(tasks));
      triggerListeners(storageKey, tasks);
    }
  },

  updateTask: async (userId: string, taskId: string, updates: Partial<Task>) => {
    if (shouldUseFirebase(userId)) {
      await updateDoc(doc(db!, "tasks", taskId), updates);
    } else {
      const storageKey = `sb_tasks_${userId}`;
      const data = localStorage.getItem(storageKey);
      let tasks: Task[] = data ? JSON.parse(data) : [];
      tasks = tasks.map(t => {
        if (t.id === taskId) {
          const updated = { ...t, ...updates };
          return updated;
        }
        return t;
      });
      localStorage.setItem(storageKey, JSON.stringify(tasks));
      triggerListeners(storageKey, tasks);
    }
  },

  deleteTask: async (userId: string, taskId: string) => {
    if (shouldUseFirebase(userId)) {
      await deleteDoc(doc(db!, "tasks", taskId));
    } else {
      const storageKey = `sb_tasks_${userId}`;
      const data = localStorage.getItem(storageKey);
      let tasks: Task[] = data ? JSON.parse(data) : [];
      tasks = tasks.filter(t => t.id !== taskId);
      localStorage.setItem(storageKey, JSON.stringify(tasks));
      triggerListeners(storageKey, tasks);
    }
  },

  // DAILY PLANS
  subscribeDailyPlan: (userId: string, date: string, callback: (plan: DailyPlan | null) => void) => {
    if (shouldUseFirebase(userId)) {
      const docId = `${userId}_${date}`;
      return onSnapshot(doc(db!, "dailyPlans", docId), (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as DailyPlan);
        } else {
          callback(null);
        }
      });
    } else {
      const storageKey = `sb_dailyPlan_${userId}_${date}`;
      let data = localStorage.getItem(storageKey);
      if (!data) {
        const seed = SEED_DAILY_PLAN(userId);
        if (seed.date === date) {
          localStorage.setItem(storageKey, JSON.stringify(seed));
          data = JSON.stringify(seed);
        }
      }
      callback(data ? JSON.parse(data) : null);
      return registerListener(storageKey, callback);
    }
  },

  saveDailyPlan: async (userId: string, plan: DailyPlan) => {
    if (shouldUseFirebase(userId)) {
      await setDoc(doc(db!, "dailyPlans", plan.id), plan);
    } else {
      const storageKey = `sb_dailyPlan_${userId}_${plan.date}`;
      localStorage.setItem(storageKey, JSON.stringify(plan));
      triggerListeners(storageKey, plan);
    }
  },

  // CHAT
  subscribeChats: (userId: string, callback: (chat: Chat | null) => void) => {
    if (shouldUseFirebase(userId)) {
      const docId = `${userId}_chat`;
      return onSnapshot(doc(db!, "chats", docId), (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as Chat);
        } else {
          callback(null);
        }
      });
    } else {
      const storageKey = `sb_chat_${userId}`;
      let data = localStorage.getItem(storageKey);
      if (!data) {
        const seed = SEED_CHAT(userId);
        localStorage.setItem(storageKey, JSON.stringify(seed));
        data = JSON.stringify(seed);
      }
      callback(JSON.parse(data));
      return registerListener(storageKey, callback);
    }
  },

  saveChat: async (userId: string, chat: Chat) => {
    if (shouldUseFirebase(userId)) {
      await setDoc(doc(db!, "chats", chat.id), chat);
    } else {
      const storageKey = `sb_chat_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(chat));
      triggerListeners(storageKey, chat);
    }
  },

  // RESCUE SESSION
  subscribeRescueSession: (userId: string, callback: (session: RescueSession | null) => void) => {
    if (shouldUseFirebase(userId)) {
      const docId = `${userId}_rescue`;
      return onSnapshot(doc(db!, "rescueSessions", docId), (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as RescueSession);
        } else {
          callback(null);
        }
      });
    } else {
      const storageKey = `sb_rescue_${userId}`;
      let data = localStorage.getItem(storageKey);
      if (!data) {
        const initial: RescueSession = {
          id: `${userId}_rescue`,
          userId,
          isActive: false
        };
        localStorage.setItem(storageKey, JSON.stringify(initial));
        data = JSON.stringify(initial);
      }
      callback(JSON.parse(data));
      return registerListener(storageKey, callback);
    }
  },

  setRescueSession: async (userId: string, session: RescueSession) => {
    if (shouldUseFirebase(userId)) {
      await setDoc(doc(db!, "rescueSessions", session.id), session);
    } else {
      const storageKey = `sb_rescue_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(session));
      triggerListeners(storageKey, session);
    }
  }
};

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { dbAPI, Task, DailyPlan, Chat, RescueSession, ChatMessage } from "@/lib/db";
import { CommandPalette } from "./command-palette";
import { AIChat } from "./ai-chat";
import { TaskDetail } from "./task-detail";
import { ErrorBoundary } from "./error-boundary";
import { useToast } from "./toast-provider";
import { hasApiKey } from "@/lib/gemini";
import { recordPostpone, getWeeklyTrend, getProcrastinationInsight } from "@/lib/trend-tracker";
import {
  getRealityCheckAction,
  prioritizeTasksAction,
  getRescuePathAction,
  getCoachingInsightAction,
  calculateTaskRiskAction,
  getChatResponseAction,
  runAutoPilotAction,
} from "@/app/actions/ai";
import {
  ShieldAlert,
  Plus,
  Search,
  Calendar,
  Clock,
  TrendingUp,
  MessageSquare,
  LogOut,
  CheckCircle2,
  Rocket,
  X,
} from "lucide-react";

export const CommandCenter: React.FC = () => {
  const { user, logout } = useAuth();
  const userId = user?.uid || "guest";
  const { addToast } = useToast();

  // Data states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [rescue, setRescue] = useState<RescueSession | null>(null);

  // UI States
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "rescue">("dashboard");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Dynamic AI States
  const [realityCheck, setRealityCheck] = useState<{ message: string; intensity: string }>({
    message: "Avoid negotiations with yourself. Start working before your brain finds an excuse.",
    intensity: "low"
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState(
    (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    })()
  );

  // Auto-Pilot: One-click full chain demo
  const [autoPilotOpen, setAutoPilotOpen] = useState(false);
  const [autoPilotGoal, setAutoPilotGoal] = useState("");
  const [autoPilotRunning, setAutoPilotRunning] = useState(false);

  const handleAutoPilot = async () => {
    if (!autoPilotGoal.trim() || autoPilotRunning) return;
    setAutoPilotRunning(true);
    try {
      const result = await runAutoPilotAction(autoPilotGoal.trim(), userId);
      // Create the task with AI-generated data
      const newTask: Task = {
        id: `task-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
        userId,
        title: autoPilotGoal.trim(),
        description: "Auto-pilot created task",
        deadline: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        status: "todo",
        priority: result.priority,
        effort: result.effort,
        subtasks: result.subtasks,
        postponedCount: 0,
        createdAt: new Date().toISOString(),
        riskAnalysis: {
          riskScore: result.riskScore,
          confidenceScore: 85,
          reasoning: result.riskReasoning,
          updatedAt: new Date().toISOString(),
        },
      };
      await dbAPI.saveTask(userId, newTask);
      setAutoPilotGoal("");
      setAutoPilotOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAutoPilotRunning(false);
    }
  };

  // Warn if API key is missing
  useEffect(() => {
    if (!hasApiKey()) {
      addToast("GEMINI_API_KEY not set. AI features running in offline mode.", "warning");
    }
  }, []);

  // Seed onboarding data for first-time users (Firebase or localStorage)
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || tasks.length > 0) return;
    const seedFlag = localStorage.getItem("sb_seeded_" + userId);
    if (seedFlag) return;
    // Seed 2 demo tasks so the dashboard isn't empty
    const seedTasks: Task[] = [
      {
        id: `task-${crypto.randomUUID?.().slice(0, 8) || "demo1"}`,
        userId,
        title: "Design AI Chief of Staff Presentation Deck",
        description: "Build slides for the hackathon submission. Highlight agentic depth and Google technologies.",
        deadline: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        status: "in-progress",
        priority: "high",
        effort: "medium",
        subtasks: [
          { id: "s1", title: "Outline user story flow", completed: true },
          { id: "s2", title: "Draft architecture diagrams", completed: false },
          { id: "s3", title: "Record walkthrough demo", completed: false },
        ],
        postponedCount: 0,
        riskAnalysis: { riskScore: 72, confidenceScore: 88, reasoning: "Presentation tasks have been started but core narrative is not yet drafted. 3 days remaining with known blockers.", updatedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      },
      {
        id: `task-${crypto.randomUUID?.().slice(0, 8) || "demo2"}`,
        userId,
        title: "Polish Command Center UI Animations",
        description: "Tune framer-motion transitions on modal open/close and task status changes.",
        deadline: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
        status: "todo",
        priority: "medium",
        effort: "low",
        subtasks: [],
        postponedCount: 0,
        riskAnalysis: { riskScore: 18, confidenceScore: 92, reasoning: "Low complexity task with sufficient buffer. Effort estimation indicates a single-session task.", updatedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      },
    ];
    Promise.all(seedTasks.map(t => dbAPI.saveTask(userId, t))).then(() => {
      localStorage.setItem("sb_seeded_" + userId, "1");
      setSeeded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tasks.length, seeded]);

  // Subscriptions
  useEffect(() => {
    const unsubTasks = dbAPI.subscribeTasks(userId, (data) => setTasks(data));
    const todayStr = new Date().toISOString().split("T")[0];
    const unsubPlan = dbAPI.subscribeDailyPlan(userId, todayStr, (data) => setDailyPlan(data));
    const unsubChat = dbAPI.subscribeChats(userId, (data) => setChat(data));
    const unsubRescue = dbAPI.subscribeRescueSession(userId, (data) => setRescue(data));

    return () => {
      unsubTasks();
      unsubPlan();
      unsubChat();
      unsubRescue();
    };
  }, [userId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Toggle Command Palette: Cmd + K or Ctrl + K
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      // Toggle AI Chat: Alt + C or Option + C
      if (e.key === "c" && e.altKey) {
        e.preventDefault();
        setIsChatOpen(prev => !prev);
      }
      // Toggle Rescue Mode: Alt + R or Option + R
      if (e.key === "r" && e.altKey) {
        e.preventDefault();
        handleToggleRescueMode();
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, rescue]);

  // Handle adding a new task
  const handleCreateTask = async (titleToCreate?: string, deadlineToCreate?: string) => {
    const name = titleToCreate || newTaskTitle;
    if (!name.trim()) return;

    setNewTaskTitle("");
    const dl = deadlineToCreate || newTaskDeadline;

    const newTask: Task = {
      id: `task-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
      userId,
      title: name,
      description: "No details provided yet. Click to decompose and add subtasks.",
      deadline: dl,
      status: "todo",
      priority: "medium",
      effort: "medium",
      subtasks: [],
      postponedCount: 0,
      createdAt: new Date().toISOString(),
      riskAnalysis: {
        riskScore: 25,
        confidenceScore: 80,
        reasoning: "Newly created task. Computing risk assessment...",
        updatedAt: new Date().toISOString()
      }
    };

    // Reset default deadline
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNewTaskDeadline(tomorrow.toISOString().split("T")[0]);

    // Calculate risk score live — never show "baseline" to the user
    try {
      const risk = await calculateTaskRiskAction(newTask);
      newTask.riskAnalysis = risk;
    } catch (e) {
      console.error(e);
      // ponytail: synchronous fallback so risk always has real data
      // upgrade: retry with exponential backoff when API recovers
      const today = new Date();
      const dueDate = new Date(newTask.deadline);
      const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      let score = 20;
      if (daysLeft <= 1) score += 40;
      else if (daysLeft <= 3) score += 20;
      const reason = score > 50
        ? `Deadline is tight (${daysLeft}d). Start immediately to stay ahead.`
        : `New task with ${daysLeft}d to deadline. Risk is manageable if started soon.`;
      newTask.riskAnalysis = {
        riskScore: Math.min(95, score),
        confidenceScore: 75,
        reasoning: reason,
        updatedAt: new Date().toISOString(),
      };
    }

    await dbAPI.saveTask(userId, newTask);
  };

  // Update/Delete adapters
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    await dbAPI.updateTask(userId, taskId, updates);
  };

  const handleDeleteTask = async (taskId: string) => {
    await dbAPI.deleteTask(userId, taskId);
  };

  const handleClearAllTasks = async () => {
    for (const t of tasks) {
      await dbAPI.deleteTask(userId, t.id);
    }
  };

  // AI Actions: Prioritize Tasks
  const handleAIPrioritization = async () => {
    if (tasks.length === 0) return;
    setAiLoading(true);
    try {
      const orderedIds = await prioritizeTasksAction(tasks);
      
      // Update Daily Plan ordering
      const todayStr = new Date().toISOString().split("T")[0];
      const newPlan: DailyPlan = {
        id: `${userId}_${todayStr}`,
        userId,
        date: todayStr,
        tasksOrder: orderedIds,
        notes: `AI schedule regenerated at ${new Date().toLocaleTimeString()}. Sorted by urgency and deadline risks.`,
        coachingInsight: await getCoachingInsightAction(tasks),
        createdAt: new Date().toISOString()
      };
      await dbAPI.saveDailyPlan(userId, newPlan);

      // Trigger a reflection warning
      const topTask = tasks.find(t => t.id === orderedIds[0]);
      if (topTask) {
        const rc = await getRealityCheckAction("prioritize", `User prioritized task sheet. Top risk item is ${topTask.title}.`);
        setRealityCheck(rc);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Actions: Emergency Rescue Mode
  const handleToggleRescueMode = async () => {
    const isActivating = !rescue?.isActive;
    setAiLoading(true);
    try {
      if (isActivating) {
        // Run Rescue Agent
        const res = await getRescuePathAction(tasks);
        const session: RescueSession = {
          id: `${userId}_rescue`,
          userId,
          isActive: true,
          activatedAt: new Date().toISOString(),
          originalPlan: tasks.map(t => t.id),
          criticalPath: res.criticalPathTaskIds,
          deallocatedTasks: res.deallocatedTaskIds,
          rescueReason: res.rescueReason
        };
        await dbAPI.setRescueSession(userId, session);
        
        // Trigger high reality check
        const rc = await getRealityCheckAction("rescue_activated", res.rescueReason);
        setRealityCheck(rc);
        setActiveTab("rescue");
      } else {
        // Reset rescue
        const session: RescueSession = {
          id: `${userId}_rescue`,
          userId,
          isActive: false
        };
        await dbAPI.setRescueSession(userId, session);
        setActiveTab("dashboard");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Chat interaction — conversational, not deflection
  const handleSendMessage = async (text: string) => {
    if (!chat) return;
    setAiLoading(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: "user",
      text,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...chat.messages, userMsg];
    await dbAPI.saveChat(userId, {
      ...chat,
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    });

    try {
      // Build conversation context from last 3 exchanges
      const recentHistory = updatedMessages.slice(-6).map(m =>
        `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`
      ).join("\n");
      const taskContext = tasks.length > 0
        ? `Current tasks (${tasks.length} total): ${tasks.filter(t => t.status !== "done").slice(0, 5).map(t => `${t.title} (risk: ${t.riskAnalysis.riskScore}%)`).join(", ")}`
        : "";

      const response = await getChatResponseAction(text, taskContext, recentHistory);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        sender: "assistant",
        text: response,
        timestamp: new Date().toISOString()
      };

      await dbAPI.saveChat(userId, {
        ...chat,
        messages: [...updatedMessages, assistantMsg],
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      // Fallback message on error
      try {
        const fallbackMsg: ChatMessage = {
          id: `msg-${Date.now()}-a`,
          sender: "assistant",
          text: "I hit a processing error. The core insight remains: stop analyzing, start doing. Ask again.",
          timestamp: new Date().toISOString()
        };
        await dbAPI.saveChat(userId, {
          ...chat,
          messages: [...updatedMessages, fallbackMsg],
          updatedAt: new Date().toISOString()
        });
      } catch {}
    } finally {
      setAiLoading(false);
    }
  };

  // Reality Check interface triggers
  const handleTriggerRealityCheck = async (action: string, context: string) => {
    try {
      // Track postpones for trend widget
      if (action.includes("postpone")) {
        recordPostpone();
      }
      const rc = await getRealityCheckAction(action, context);
      setRealityCheck(rc);
      return rc;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // Determine styling for reality check banner based on intensity
  const getBannerStyle = (intensity: string) => {
    if (intensity === "high") {
      return {
        wrapper: "bg-accent-red-soft border-accent-red/20 text-accent-red",
        badge: "bg-accent-red text-canvas"
      };
    }
    if (intensity === "medium") {
      return {
        wrapper: "bg-accent-yellow-soft border-accent-yellow/20 text-accent-yellow",
        badge: "bg-accent-yellow text-canvas"
      };
    }
    return {
      wrapper: "bg-accent-blue-soft border-accent-blue/20 text-accent-blue",
      badge: "bg-accent-blue text-canvas"
    };
  };

  const bannerStyles = getBannerStyle(realityCheck.intensity);

  // Trend tracking
  const [trendData, setTrendData] = useState({ thisWeek: 0, lastWeek: 0, trend: "", insight: "" });
  useEffect(() => {
    const t = getWeeklyTrend();
    setTrendData({ ...t, insight: getProcrastinationInsight(tasks.length) });
  }, [tasks]);

  // Filter tasks depending on Rescue active session
  const isRescueActive = !!rescue?.isActive;
  const criticalTasks = isRescueActive 
    ? tasks.filter(t => rescue.criticalPath?.includes(t.id))
    : tasks;
  const stashedTasks = isRescueActive
    ? tasks.filter(t => rescue.deallocatedTasks?.includes(t.id))
    : [];

  return (
    <div className="min-h-screen bg-canvas text-body font-sans relative">
      
      {/* Visual Stripe Gradient at landing hero top — hidden on dashboard, only for landing */}
      {/* Stripes removed on dashboard — reserved for landing page */}
      {false && (
        <div className="hero-stripes-container">
          <div className="hero-stripe hero-stripe-1"></div>
          <div className="hero-stripe hero-stripe-2"></div>
          <div className="hero-stripe hero-stripe-3"></div>
        </div>
      )}

      {/* Top Nav */}
      <header className="h-14 border-b border-hairline bg-canvas flex items-center justify-between px-6 relative z-10">
        {/* Logo */}
        <div className="flex items-center space-x-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Second Brain Logo" className="w-6 h-6 object-contain rounded-sm select-none" />
          <span className="font-display-xl text-sm font-semibold tracking-tight text-on-dark">Second Brain</span>
        </div>

        {/* Tab Selection */}
        <nav className="hidden md:flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-150 cursor-pointer ${
              activeTab === "dashboard" ? "bg-surface-elevated text-on-dark" : "text-mute hover:text-on-dark"
            }`}
          >
            Command Center
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-150 cursor-pointer ${
              activeTab === "tasks" ? "bg-surface-elevated text-on-dark" : "text-mute hover:text-on-dark"
            }`}
          >
            Task Matrix
          </button>
          {isRescueActive && (
            <button
              onClick={() => setActiveTab("rescue")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-150 cursor-pointer ${
                activeTab === "rescue" ? "bg-accent-red-soft text-accent-red border border-accent-red/20 animate-pulse" : "text-mute hover:text-on-dark"
              }`}
            >
              Rescue Logs
            </button>
          )}
        </nav>

        {/* Right Nav */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoPilotOpen(true)}
            disabled={autoPilotRunning}
            className="h-7 px-3 text-xs font-medium rounded-md flex items-center transition-colors border duration-150 cursor-pointer bg-accent-green-soft border-accent-green/20 text-accent-green hover:bg-accent-green/20"
          >
            <Rocket className="w-3.5 h-3.5 mr-1" />
            Auto-Pilot
          </button>
          <button
            onClick={handleToggleRescueMode}
            className={`h-7 px-3 text-xs font-medium rounded-md flex items-center transition-colors border duration-150 cursor-pointer ${
              isRescueActive
                ? "bg-accent-red text-canvas border-transparent hover:bg-accent-red/90"
                : "bg-surface-elevated border-hairline text-on-dark hover:border-hairline-strong"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            {isRescueActive ? "Rescue Active" : "Emergency Rescue"}
          </button>

          <button
            onClick={() => setIsChatOpen(true)}
            className="h-7 w-7 bg-surface-elevated border border-hairline rounded-md flex items-center justify-center text-on-dark hover:border-hairline-strong transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-hairline" />

          <span className="text-xs font-semibold text-mute font-mono hidden sm:inline">
            {user?.displayName}
          </span>

          <button 
            onClick={logout}
            className="text-stone hover:text-on-dark p-1 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1240px] mx-auto px-6 py-6 space-y-6 relative z-10">
        
        {/* Command Search Input Bar (Raycast Style) */}
        <div 
          onClick={() => setIsPaletteOpen(true)}
          className="w-full bg-surface-elevated border border-hairline rounded-md h-11 flex items-center px-4 justify-between cursor-pointer hover:border-hairline-strong transition-colors duration-150"
        >
          <div className="flex items-center space-x-3 text-stone">
            <Search className="w-4.5 h-4.5" />
            <span className="text-sm">Search commands, schedule tasks or ask AI (Cmd+K)...</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="keycap-item">⌘</span>
            <span className="keycap-item">K</span>
          </div>
        </div>

        {/* AI Reality Check Banner (The Core Procrastination Callout) */}
        <ErrorBoundary>
        <div className={`border p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 ${bannerStyles.wrapper}`}>
          <div className="flex items-start space-x-3">
            <div className="mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase font-mono ${bannerStyles.badge}`}>
                {realityCheck.intensity}
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold tracking-wider text-on-dark uppercase">AI Reality Check</h4>
              <p className="text-sm font-medium leading-relaxed font-display-xl text-on-dark select-none">
                &ldquo;{realityCheck.message}&rdquo;
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const rc = await handleTriggerRealityCheck("motivation", "User requested a sharper reality check after seeing the current one.");
              if (rc) setRealityCheck(rc);
            }}
            className="text-xs self-start md:self-center bg-canvas border border-hairline px-3 h-8 text-on-dark rounded-md hover:bg-surface-elevated hover:border-hairline-strong transition-colors duration-150 cursor-pointer flex-shrink-0"
          >
            Strike Harder
          </button>
        </div>
        </ErrorBoundary>

        {/* Dashboard Tab Content */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Daily Schedule Panel */}
            <section className="lg:col-span-4 bg-surface border border-hairline rounded-lg p-5 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-dark tracking-wide uppercase select-none flex items-center">
                  <Calendar className="w-4 h-4 text-accent-blue mr-1.5" />
                  Daily focus Plan
                </h3>
                <button
                  onClick={handleAIPrioritization}
                  disabled={aiLoading || tasks.length === 0}
                  className="text-[11px] bg-surface-elevated border border-hairline text-accent-blue px-2.5 h-6 rounded hover:bg-surface-card hover:border-hairline-strong transition-colors cursor-pointer"
                >
                  Regenerate
                </button>
              </div>

              {dailyPlan?.coachingInsight && (
                <div className="text-xs border-l-2 border-accent-blue bg-accent-blue-soft/30 p-3 rounded-r-md text-ink leading-relaxed">
                  <p className="font-semibold text-[10px] text-accent-blue tracking-wider uppercase mb-0.5">Focus directive</p>
                  {dailyPlan.coachingInsight}
                </div>
              )}

              {/* Scheduled Blocks */}
              {tasks.length === 0 ? (
                <div className="flex-grow flex items-center justify-center py-12 text-center text-xs text-stone border border-dashed border-hairline rounded-md">
                  No tasks registered. Create a task via Cmd+K to initialize daily scheduling.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {dailyPlan?.tasksOrder && dailyPlan.tasksOrder.length > 0 ? (
                    dailyPlan.tasksOrder.map((tid, idx) => {
                      const t = tasks.find(item => item.id === tid);
                      if (!t || t.status === "done") return null;

                      // Map indexes to schedule blocks
                      const times = ["09:00 AM — Morning focus", "01:00 PM — Afternoon focus", "04:30 PM — Daily wrap-up"];
                      const blockTitle = times[Math.min(idx, times.length - 1)];

                      return (
                        <div key={t.id} className="space-y-1.5 group">
                          <span className="text-[10px] font-semibold text-mute font-mono block">
                            {blockTitle}
                          </span>
                          <button
                            onClick={() => setSelectedTask(t)}
                            className="w-full text-left bg-surface-elevated border border-hairline rounded-md p-3 hover:border-hairline-strong transition-colors duration-150 cursor-pointer flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-semibold text-on-dark truncate group-hover:text-accent-blue transition-colors">{t.title}</p>
                              <p className="text-[10px] text-stone font-mono mt-0.5">Effort: {t.effort} | Risk: {t.riskAnalysis.riskScore}%</p>
                            </div>
                            <Clock className="w-3.5 h-3.5 text-stone flex-shrink-0 group-hover:text-on-dark transition-colors" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-mute bg-surface-elevated/40 rounded border border-hairline">
                      Daily order not initialized. Click Regenerate to prioritize with AI.
                    </div>
                  )}
                </div>
              )}

              {/* Procrastination Trend Widget */}
              <div className="border-t border-hairline pt-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-mute uppercase tracking-wider font-mono">Postpone Trend</span>
                  <span className="text-[10px] font-mono text-stone">
                    {trendData.thisWeek > 0 ? `${trendData.thisWeek} this week` : ""}
                    {trendData.lastWeek > 0 ? ` · ${trendData.lastWeek} last week` : ""}
                  </span>
                </div>
                <p className="text-[11px] text-ink leading-relaxed">{trendData.insight}</p>
                {trendData.lastWeek > 0 && trendData.thisWeek < trendData.lastWeek && (
                  <p className="text-[10px] text-accent-green font-semibold mt-1 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" /> Improving
                  </p>
                )}
                {trendData.lastWeek > 0 && trendData.thisWeek > trendData.lastWeek && (
                  <p className="text-[10px] text-accent-red font-semibold mt-1 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1 rotate-180" /> Worsening
                  </p>
                )}
              </div>
            </section>

            {/* Task Grid & Deadlines Matrix */}
            <section className="lg:col-span-8 bg-surface border border-hairline rounded-lg p-5 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-dark tracking-wide uppercase select-none flex items-center">
                  <TrendingUp className="w-4 h-4 text-accent-green mr-1.5" />
                  Active deadline Risks
                </h3>
              </div>

              {/* Prominent Quick Add Task Form Console */}
              <div className="bg-surface-elevated/40 border border-hairline rounded-md p-3.5 space-y-3">
                <span className="text-[10px] font-semibold text-mute font-mono block uppercase">
                  Add New Task Console
                </span>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                    placeholder="What goal needs decomposition? (e.g. Design Presentation Deck)"
                    className="flex-grow h-9 bg-surface text-on-dark border border-hairline rounded-md px-3 text-xs focus:outline-none focus:border-hairline-strong placeholder-stone"
                  />
                  <div className="flex items-center gap-3 flex-shrink-0 justify-between md:justify-start w-full md:w-auto">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] text-stone font-mono uppercase">Due:</span>
                      <input
                        type="date"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        className="h-9 bg-surface text-on-dark border border-hairline rounded-md px-2.5 text-xs focus:outline-none focus:border-hairline-strong [color-scheme:dark]"
                      />
                    </div>
                    <button
                      onClick={() => handleCreateTask()}
                      className="h-9 px-4 bg-on-dark text-button-fg rounded-md text-xs font-semibold hover:bg-primary-pressed transition-colors duration-150 cursor-pointer flex items-center"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Task
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks List */}
              <div className="flex-grow overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-hairline text-left">
                      <th className="py-2.5 text-[10px] font-semibold text-mute uppercase select-none tracking-wider font-mono">Task details</th>
                      <th className="py-2.5 text-[10px] font-semibold text-mute uppercase select-none tracking-wider font-mono text-center">AI priority</th>
                      <th className="py-2.5 text-[10px] font-semibold text-mute uppercase select-none tracking-wider font-mono text-center">Deadline risk</th>
                      <th className="py-2.5 text-[10px] font-semibold text-mute uppercase select-none tracking-wider font-mono text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalTasks.filter(t => t.status !== "done").map((t) => (
                      <tr 
                        key={t.id}
                        className="border-b border-hairline/50 hover:bg-surface-elevated/40 transition-colors group"
                      >
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedTask(t)}
                            className="text-left cursor-pointer min-w-0 pr-4 block"
                          >
                            <p className="text-xs font-bold text-on-dark truncate max-w-[280px] group-hover:text-accent-blue transition-colors">{t.title}</p>
                            <p className="text-[10px] text-stone truncate max-w-[280px] mt-0.5">{t.description}</p>
                          </button>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase border font-mono ${
                            t.priority === "high" ? "text-accent-red border-accent-red/20 bg-accent-red-soft" :
                            t.priority === "medium" ? "text-accent-yellow border-accent-yellow/20 bg-accent-yellow-soft" :
                            "text-accent-green border-accent-green/20 bg-accent-green-soft"
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col items-center justify-center">
                            <span className={`text-xs font-semibold ${
                              t.riskAnalysis.riskScore > 75 ? "text-accent-red" : 
                              t.riskAnalysis.riskScore > 40 ? "text-accent-yellow" : "text-accent-green"
                            }`}>
                              {t.riskAnalysis.riskScore}%
                            </span>
                            <span className="text-[9px] text-stone font-mono mt-0.5">Due {t.deadline}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={async () => {
                                await handleUpdateTask(t.id, { status: "done" });
                                handleTriggerRealityCheck("complete_task", `User successfully finished '${t.title}'.`);
                              }}
                              className="text-stone hover:text-accent-green p-1 cursor-pointer transition-colors duration-150"
                              title="Mark complete"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedTask(t)}
                              className="text-xs font-mono keycap-item opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                            >
                              ⏎ settings
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {criticalTasks.filter(t => t.status !== "done").length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-xs text-stone">
                          No pending tasks found. Set targets in the inputs above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Tasks Matrix Tab */}
        {activeTab === "tasks" && (
          <section className="bg-surface border border-hairline rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-sm font-semibold text-on-dark tracking-wide uppercase">All Configured Tasks</h3>
              <span className="text-xs text-mute font-mono">{tasks.length} total tasks</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(t => (
                <div 
                  key={t.id} 
                  className={`bg-surface-elevated border border-hairline rounded-md p-4 flex flex-col justify-between space-y-4 hover:border-hairline-strong transition-colors group`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase border font-mono ${
                        t.status === "done" ? "text-stone border-hairline bg-surface" :
                        t.priority === "high" ? "text-accent-red border-accent-red/20 bg-accent-red-soft" : "text-mute border-hairline bg-surface"
                      }`}>
                        {t.status === "done" ? "completed" : `${t.priority} priority`}
                      </span>
                      <span className={`text-xs font-semibold ${
                        t.status === "done" ? "text-stone" :
                        t.riskAnalysis.riskScore > 75 ? "text-accent-red" : 
                        t.riskAnalysis.riskScore > 40 ? "text-accent-yellow" : "text-accent-green"
                      }`}>
                        {t.status === "done" ? "Done" : `Risk: ${t.riskAnalysis.riskScore}%`}
                      </span>
                    </div>

                    <div>
                      <h4 className={`text-xs font-bold ${t.status === "done" ? "line-through text-stone" : "text-on-dark"}`}>
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-stone leading-relaxed mt-1 line-clamp-2">
                        {t.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-hairline/40 pt-3">
                    <span className="text-[10px] text-mute font-mono">Due {t.deadline}</span>
                    <button
                      onClick={() => setSelectedTask(t)}
                      className="text-xs font-semibold text-accent-blue hover:text-on-dark transition-colors cursor-pointer"
                    >
                      Configure &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rescue Mode View Tab */}
        {activeTab === "rescue" && isRescueActive && rescue && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
            
            {/* Rescue Summary card */}
            <div className="lg:col-span-4 bg-accent-red-soft/20 border border-accent-red/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center space-x-2 text-accent-red">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <h3 className="text-sm font-semibold tracking-wide uppercase select-none">Rescue Status</h3>
              </div>
              
              <div className="space-y-1">
                <span className="text-[10px] text-stone font-semibold uppercase tracking-wider block">Rescue Strategy</span>
                <p className="text-xs text-ink leading-relaxed bg-canvas/40 border border-hairline p-3 rounded-md">
                  {rescue.rescueReason}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-mute font-mono">
                  <span>Critical path items:</span>
                  <span className="text-on-dark">{rescue.criticalPath?.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-mute font-mono">
                  <span>Stashed tasks:</span>
                  <span className="text-on-dark">{rescue.deallocatedTasks?.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-mute font-mono">
                  <span>Activation time:</span>
                  <span className="text-on-dark">{new Date(rescue.activatedAt || "").toLocaleTimeString()}</span>
                </div>
              </div>

              <button
                onClick={handleToggleRescueMode}
                className="w-full h-9 bg-accent-red text-canvas rounded-md text-xs font-bold transition-colors hover:bg-accent-red/90 cursor-pointer flex items-center justify-center"
              >
                Deactivate Rescue Mode
              </button>
            </div>

            {/* Critical Path Tasks */}
            <div className="lg:col-span-8 space-y-6">
              
              <section className="bg-surface border border-hairline rounded-lg p-5 space-y-4">
                <div className="border-b border-hairline pb-2.5">
                  <h3 className="text-xs font-bold text-accent-green tracking-wide uppercase select-none flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Critical Path (Non-negotiable Work)
                  </h3>
                </div>

                <div className="space-y-3">
                  {tasks.filter(t => rescue.criticalPath?.includes(t.id)).map(t => (
                    <div 
                      key={t.id} 
                      className="bg-surface-elevated border border-hairline rounded-md p-3.5 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-on-dark">{t.title}</h4>
                        <p className="text-[10px] text-stone mt-0.5">Due {t.deadline} | Risk score: {t.riskAnalysis.riskScore}%</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={async () => {
                            await handleUpdateTask(t.id, { status: "done" });
                            handleTriggerRealityCheck("complete_task", `User completed rescue path item '${t.title}'.`);
                          }}
                          className="h-7 px-3 bg-accent-green text-canvas rounded text-xs font-bold transition-colors hover:bg-accent-green/90 cursor-pointer"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="text-xs font-mono keycap-item cursor-pointer"
                        >
                          Configure
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Stashed tasks */}
              <section className="bg-surface border border-hairline rounded-lg p-5 opacity-60 hover:opacity-100 transition-opacity duration-200 space-y-3">
                <div className="border-b border-hairline pb-2.5">
                  <h3 className="text-xs font-bold text-mute tracking-wide uppercase select-none flex items-center">
                    <Clock className="w-4 h-4 mr-1.5" />
                    Stashed Tasks (Deallocated for Focus)
                  </h3>
                </div>

                <div className="space-y-2">
                  {stashedTasks.map(t => (
                    <div 
                      key={t.id} 
                      className="bg-surface-card border border-hairline rounded px-3 py-2 flex items-center justify-between text-xs text-mute"
                    >
                      <span className="truncate max-w-[400px]">{t.title}</span>
                      <span className="font-mono text-[10px] text-stone">Stashed until Rescue Mode ends</span>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </div>
        )}

      </main>

      {/* Footer shortcut helper banner */}
      <footer className="max-w-[1240px] mx-auto px-6 py-6 border-t border-hairline text-xs text-mute flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center"><span className="keycap-item mr-1.5">⌘K</span> Command Search</span>
          <span className="flex items-center"><span className="keycap-item mr-1.5">⌥C</span> Toggle AI Chat</span>
          <span className="flex items-center"><span className="keycap-item mr-1.5">⌥R</span> Toggle Rescue Mode</span>
        </div>
        <div>
          <span>Second Brain &mdash; Staff-level Hackathon Agent</span>
        </div>
      </footer>

      {/* AUTO-PILOT MODAL */}
      {autoPilotOpen && (
        <div className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface border border-hairline rounded-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="px-4 py-3 border-b border-hairline flex items-center justify-between bg-surface-elevated">
              <span className="text-sm font-semibold text-on-dark tracking-tight flex items-center">
                <Rocket className="w-4 h-4 text-accent-green mr-1.5" />
                AI Auto-Pilot
              </span>
              <button
                onClick={() => { if (!autoPilotRunning) { setAutoPilotOpen(false); setAutoPilotGoal(""); } }}
                className="text-stone hover:text-on-dark transition-colors p-1 rounded-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-mute leading-relaxed">
                Watch the full AI pipeline in action: planning, risk assessment, and prioritization — all from one goal.
              </p>
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-medium text-mute">Goal to decompose</label>
                <input
                  type="text"
                  value={autoPilotGoal}
                  onChange={(e) => setAutoPilotGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAutoPilot()}
                  placeholder="e.g. Build Q3 investor presentation"
                  className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong placeholder-stone"
                  disabled={autoPilotRunning}
                />
              </div>
              <button
                onClick={handleAutoPilot}
                disabled={!autoPilotGoal.trim() || autoPilotRunning}
                className="w-full h-9 bg-accent-green text-canvas rounded-md text-xs font-bold hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
              >
                {autoPilotRunning ? (
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full border-2 border-canvas border-t-transparent animate-spin mr-2" /> Running AI Pipeline...</span>
                ) : (
                  <span className="flex items-center"><Rocket className="w-3.5 h-3.5 mr-1.5" /> Execute Auto-Pilot</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMAND PALETTE MODAL OVERLAY */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        tasks={tasks}
        onAddTask={handleCreateTask}
        onRunPrioritization={handleAIPrioritization}
        onToggleRescue={handleToggleRescueMode}
        onRunReflection={async () => {
          setAiLoading(true);
          try {
            const ins = await getCoachingInsightAction(tasks);
            setDailyPlan(prev => prev ? { ...prev, coachingInsight: ins } : null);
            setRealityCheck({
              message: ins,
              intensity: "medium"
            });
          } catch (e) {
            console.error(e);
          } finally {
            setAiLoading(false);
          }
        }}
        onClearTasks={handleClearAllTasks}
        onSelectTask={(task) => setSelectedTask(task)}
        rescueActive={isRescueActive}
      />

      {/* AI PRODUCTIVITY CHAT DRAWER */}
      <AIChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        chat={chat}
        onSendMessage={handleSendMessage}
        isLoading={aiLoading}
      />

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onTriggerRealityCheck={async (action, context) => { handleTriggerRealityCheck(action, context); }}
        />
      )}

    </div>
  );
};

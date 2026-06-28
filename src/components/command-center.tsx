"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { dbAPI, Task, DailyPlan, Chat, RescueSession, ChatMessage } from "@/lib/db";
import { CommandPalette } from "./command-palette";
import { AIChatSidebar } from "./ai-chat-sidebar";
import { TaskDetail } from "./task-detail";
import { ErrorBoundary } from "./error-boundary";
import { useToast } from "./toast-provider";
import { recordPostpone, getWeeklyTrend, getProcrastinationInsight } from "@/lib/trend-tracker";
import {
  getRealityCheckAction,
  prioritizeTasksAction,
  getRescuePathAction,
  getCoachingInsightAction,
  calculateTaskRiskAction,
  getChatResponseAction,
  checkApiKeyAction,
} from "@/app/actions/ai";
import { DailyFocusPlan } from "./daily-focus-plan";
import { DeadlineRisks } from "./deadline-risks";
import { RescueLogs } from "./rescue-logs";
import {
  ShieldAlert,
  Search,
  LogOut,
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

  // OS detection state
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    }
  }, []);

  // UI States
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "rescue">("dashboard");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
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

  // Warn if API key is missing
  useEffect(() => {
    const verifyApiKey = async () => {
      const active = await checkApiKeyAction();
      if (!active) {
        addToast("OPENAI_API_KEY not set. AI features running in offline mode.", "warning");
      }
    };
    verifyApiKey();
  }, [addToast]);

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

  const handleSendMessage = async (text: string) => {
    let activeChat = chat;
    if (!activeChat) {
      const docId = `${userId}_chat`;
      activeChat = {
        id: docId,
        userId,
        messages: [
          {
            id: "welcome-1",
            sender: "assistant",
            text: "I am your AI Chief of Staff. I track task risks, prioritize schedules, and keep you accountable. What are we shipping today?",
            timestamp: new Date().toISOString()
          }
        ],
        updatedAt: new Date().toISOString()
      };
      await dbAPI.saveChat(userId, activeChat);
    }

    setAiLoading(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: "user",
      text,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...activeChat.messages, userMsg];
    await dbAPI.saveChat(userId, {
      ...activeChat,
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    });

    try {
      // Build conversation context from last 3 exchanges
      const recentHistory = updatedMessages.slice(-6).map(m =>
        `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`
      ).join("\n");
      const taskContext = tasks.length > 0
        ? `Current tasks (${tasks.length} total): ${tasks.filter(t => t.status !== "done").slice(0, 5).map(t => `${t.title} (risk: ${t.riskAnalysis?.riskScore || 0}%)`).join(", ")}`
        : "";

      const { text: responseText, actions } = await getChatResponseAction(text, taskContext, recentHistory);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        sender: "assistant",
        text: responseText,
        timestamp: new Date().toISOString()
      };

      await dbAPI.saveChat(userId, {
        ...activeChat,
        messages: [...updatedMessages, assistantMsg],
        updatedAt: new Date().toISOString()
      });

      // Execute client-side tool actions returned by Gemini
      if (actions && actions.length > 0) {
        for (const action of actions) {
          if (action.type === "create_task") {
            const title = typeof action.payload.title === "string" ? action.payload.title : "";
            const dl = typeof action.payload.deadline === "string" ? action.payload.deadline : new Date(Date.now() + 86400000).toISOString().split("T")[0];
            await handleCreateTask(title, dl);
            addToast(`Created task: "${title}"`, "success");
          } else if (action.type === "complete_task") {
            const taskQuery = typeof action.payload.taskQuery === "string" ? action.payload.taskQuery : "";
            const queryStr = taskQuery.toLowerCase();
            const matchedTask = tasks.find(t => 
              t.title.toLowerCase().includes(queryStr) || 
              t.id === queryStr
            );
            if (matchedTask) {
              await handleUpdateTask(matchedTask.id, { status: "done" });
              addToast(`Completed task: "${matchedTask.title}"`, "success");
            } else {
              addToast(`Could not find task matching: "${taskQuery}"`, "warning");
            }
          } else if (action.type === "postpone_task") {
            const taskQuery = typeof action.payload.taskQuery === "string" ? action.payload.taskQuery : "";
            const newDeadline = typeof action.payload.newDeadline === "string" ? action.payload.newDeadline : "";
            const queryStr = taskQuery.toLowerCase();
            const matchedTask = tasks.find(t => 
              t.title.toLowerCase().includes(queryStr) || 
              t.id === queryStr
            );
            if (matchedTask) {
              await handleUpdateTask(matchedTask.id, { 
                deadline: newDeadline,
                postponedCount: matchedTask.postponedCount + 1 
              });
              addToast(`Postponed "${matchedTask.title}" to ${newDeadline}`, "info");
            } else {
              addToast(`Could not find task matching: "${taskQuery}"`, "warning");
            }
          }
        }
      }
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
          ...activeChat,
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
            <span className="text-sm">Search commands, schedule tasks or ask AI ({isMac ? "Cmd+K" : "Ctrl+K"})...</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="keycap-item">{isMac ? "⌘" : "Ctrl"}</span>
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

        {/* Two-Column Grid: Left for tab content, right for permanent sidebar chat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Dashboard Tab Content */}
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <DailyFocusPlan
                  tasks={tasks}
                  dailyPlan={dailyPlan}
                  aiLoading={aiLoading}
                  handleAIPrioritization={handleAIPrioritization}
                  setSelectedTask={setSelectedTask}
                  trendData={trendData}
                />
                <DeadlineRisks
                  criticalTasks={criticalTasks}
                  newTaskTitle={newTaskTitle}
                  setNewTaskTitle={setNewTaskTitle}
                  newTaskDeadline={newTaskDeadline}
                  setNewTaskDeadline={setNewTaskDeadline}
                  handleCreateTask={handleCreateTask}
                  handleUpdateTask={handleUpdateTask}
                  setSelectedTask={setSelectedTask}
                  handleTriggerRealityCheck={handleTriggerRealityCheck}
                />
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
              <RescueLogs
                rescue={rescue}
                tasks={tasks}
                stashedTasks={stashedTasks}
                handleToggleRescueMode={handleToggleRescueMode}
                handleUpdateTask={handleUpdateTask}
                setSelectedTask={setSelectedTask}
                handleTriggerRealityCheck={handleTriggerRealityCheck}
              />
            )}
          </div>

          {/* AI Chief of Staff Chat Sidebar */}
          <div className="lg:col-span-4 h-[calc(100vh-8rem)] lg:sticky lg:top-24 flex flex-col min-h-[450px]">
            <AIChatSidebar
              chat={chat}
              onSendMessage={handleSendMessage}
              isLoading={aiLoading}
            />
          </div>

        </div>

      </main>

      {/* Footer shortcut helper banner */}
      <footer className="max-w-[1240px] mx-auto px-6 py-6 border-t border-hairline text-xs text-mute flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center"><span className="keycap-item mr-1.5">{isMac ? "⌘K" : "Ctrl+K"}</span> Command Search</span>
          <span className="flex items-center"><span className="keycap-item mr-1.5">{isMac ? "⌥R" : "Alt+R"}</span> Toggle Rescue Mode</span>
        </div>
        <div>
          <span>Second Brain &mdash; Staff-level Hackathon Agent</span>
        </div>
      </footer>

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

      {selectedTask && (
        <TaskDetail
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onTriggerRealityCheck={async (action, context) => { handleTriggerRealityCheck(action, context); }}
        />
      )}

    </div>
  );
};

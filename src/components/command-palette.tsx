"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Task } from "@/lib/db";
import { Search, Plus, Sparkles, ShieldAlert, ArrowRight, Trash2 } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onAddTask: (title: string) => void;
  onRunPrioritization: () => void;
  onToggleRescue: () => void;
  onRunReflection: () => void;
  onClearTasks: () => void;
  onSelectTask: (task: Task) => void;
  rescueActive: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tasks,
  onAddTask,
  onRunPrioritization,
  onToggleRescue,
  onRunReflection,
  onClearTasks,
  onSelectTask,
  rescueActive
}) => {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on Escape, keyboard nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);


  const systemCommands = [
    {
      id: "cmd-add",
      title: "Add Task...",
      subtitle: "Type '/add <task name>' to create a new task",
      icon: <Plus className="w-4 h-4 text-accent-green" />,
      action: () => {
        if (search.length > 5) {
          onAddTask(search.slice(5));
          onClose();
        } else {
          setSearch("/add ");
        }
      },
      shortcut: "⏎"
    },
    {
      id: "cmd-prioritize",
      title: "Prioritize Tasks (AI)",
      subtitle: "Ranks tasks based on urgency and deadline risk score",
      icon: <Sparkles className="w-4 h-4 text-accent-yellow" />,
      action: () => {
        onRunPrioritization();
        onClose();
      },
      shortcut: "⌘P"
    },
    {
      id: "cmd-rescue",
      title: rescueActive ? "Deactivate Rescue Mode" : "Activate Emergency Rescue Mode (AI)",
      subtitle: rescueActive 
        ? "Restore original task schedules" 
        : "Rebuild plan around the critical path, stashing non-essential tasks",
      icon: <ShieldAlert className="w-4 h-4 text-accent-red" />,
      action: () => {
        onToggleRescue();
        onClose();
      },
      shortcut: "⌘R"
    },
    {
      id: "cmd-reflection",
      title: "Generate Daily Coaching Review (AI)",
      subtitle: "Ask Reflection Agent for action-oriented performance feedback",
      icon: <ArrowRight className="w-4 h-4 text-accent-blue" />,
      action: () => {
        onRunReflection();
        onClose();
      },
      shortcut: "⌘D"
    },
    {
      id: "cmd-clear",
      title: "Clear All Tasks",
      subtitle: "Wipe all tasks from database storage",
      icon: <Trash2 className="w-4 h-4 text-stone" />,
      action: () => {
        if (confirm("Are you sure you want to clear all tasks?")) {
          onClearTasks();
          onClose();
        }
      },
      shortcut: "⌘Del"
    }
  ];

  // Filter tasks based on search
  const filteredTasks = search && !search.startsWith("/")
    ? tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : [];

  const visibleCommands = search.startsWith("/")
    ? systemCommands.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || search.startsWith(c.id === "cmd-add" ? "/add" : "/"))
    : systemCommands;

  const totalItems = filteredTasks.length + visibleCommands.length;

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    }
  };

  const executeSelected = () => {
    if (filteredTasks.length > 0 && selectedIndex < filteredTasks.length) {
      onSelectTask(filteredTasks[selectedIndex]);
      onClose();
    } else {
      const cmdIndex = selectedIndex - filteredTasks.length;
      if (visibleCommands[cmdIndex]) {
        visibleCommands[cmdIndex].action();
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (listEl) {
      const activeEl = listEl.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        const listHeight = listEl.clientHeight;
        const activeTop = activeEl.offsetTop;
        const activeHeight = activeEl.clientHeight;
        if (activeTop + activeHeight > listEl.scrollTop + listHeight) {
          listEl.scrollTop = activeTop + activeHeight - listHeight;
        } else if (activeTop < listEl.scrollTop) {
          listEl.scrollTop = activeTop;
        }
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50"
          />

          {/* Command Card Container */}
          <div className="fixed inset-0 flex items-start justify-center pt-[15vh] z-50 pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onKeyDown={handleKeyDown}
              className="w-full max-w-2xl bg-surface border border-hairline rounded-lg overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
            >
              {/* Search Bar */}
              <div className="flex items-center px-4 border-b border-hairline h-12 bg-surface-elevated">
                <Search className="w-5 h-5 text-stone mr-3 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search tasks or type a command (e.g. /add, /prioritize)..."
                  className="w-full bg-transparent text-on-dark text-sm placeholder-stone focus:outline-none"
                />
                {search && (
                  <button 
                    onClick={() => setSearch("")}
                    className="text-xs text-mute hover:text-on-dark font-mono keycap-item mr-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <span className="keycap-item ml-2">Esc</span>
              </div>

              {/* List Area */}
              <div 
                ref={listRef}
                className="max-h-[340px] overflow-y-auto p-2 space-y-0.5 bg-surface"
              >
                {/* Search matching tasks */}
                {filteredTasks.length > 0 && (
                  <div className="px-3 py-1.5 text-[11px] font-medium text-mute tracking-wider uppercase select-none">
                    Matching Tasks
                  </div>
                )}
                {filteredTasks.map((task, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={task.id}
                      onClick={() => {
                        onSelectTask(task);
                        onClose();
                      }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-colors duration-100 cursor-pointer ${
                        isActive ? "bg-surface-card text-on-dark" : "bg-transparent text-mute"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          task.riskAnalysis.riskScore > 75 ? "bg-accent-red" : 
                          task.riskAnalysis.riskScore > 40 ? "bg-accent-yellow" : "bg-accent-green"
                        }`} />
                        <span className="truncate font-medium">{task.title}</span>
                        <span className="text-xs text-stone truncate max-w-[200px]">{task.description}</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        <span className="text-xs text-stone">Due {task.deadline}</span>
                        {isActive && <span className="keycap-item">⏎ View</span>}
                      </div>
                    </button>
                  );
                })}

                {/* System Commands */}
                {visibleCommands.length > 0 && (
                  <div className="px-3 py-1.5 text-[11px] font-medium text-mute tracking-wider uppercase select-none">
                    System Commands
                  </div>
                )}
                {visibleCommands.map((cmd, idx) => {
                  const globalIdx = filteredTasks.length + idx;
                  const isActive = globalIdx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-colors duration-100 cursor-pointer ${
                        isActive ? "bg-surface-card text-on-dark" : "bg-transparent text-mute"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-1 bg-surface-elevated rounded border border-hairline">
                          {cmd.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-on-dark">{cmd.title}</span>
                          <span className="text-xs text-stone">{cmd.subtitle}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isActive && <span className="keycap-item">{cmd.shortcut}</span>}
                      </div>
                    </button>
                  );
                })}

                {totalItems === 0 && (
                  <div className="py-12 text-center text-sm text-mute">
                    No matching actions or tasks found. Type <span className="text-on-dark">/</span> to list all commands.
                  </div>
                )}
              </div>

              {/* Status bar */}
              <div className="px-4 py-2 border-t border-hairline bg-surface-elevated flex items-center justify-between text-xs text-stone">
                <div className="flex items-center space-x-3">
                  <span>Use <span className="keycap-item">↑</span> <span className="keycap-item">↓</span> to navigate</span>
                  <span><span className="keycap-item">⏎</span> to select</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>Second Brain Command Center</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { Task } from "@/lib/db";
import { 
  X, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
  Trash2, 
  Sparkles, 
  Zap 
} from "lucide-react";
import { getDecomposedSubtasksAction, calculateTaskRiskAction } from "@/app/actions/ai";

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onTriggerRealityCheck: (action: string, context: string) => Promise<void>;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({
  task,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onTriggerRealityCheck
}) => {
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ponytail: single object state to avoid prop-to-state sync bug
  // upgrade: use a form library if the form gets more complex
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    status: task.status,
    priority: task.priority,
    effort: task.effort,
  });

  // Sync when the task prop changes (e.g., Firestore subscription update)
  useEffect(() => {
    if (!isSaving) {
      setDraft({
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        status: task.status,
        priority: task.priority,
        effort: task.effort,
      });
    }
  }, [task.id, task.title, task.description, task.deadline, task.status, task.priority, task.effort, isSaving]);

  // Handle saving the core details
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<Task> = {
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        effort: draft.effort,
      };

      // Check if deadline was changed/postponed
      if (draft.deadline !== task.deadline) {
        updates.deadline = draft.deadline;
        updates.postponedCount = task.postponedCount + 1;
        updates.lastPostponedAt = new Date().toISOString();

        // Trigger procrastinating check
        await onTriggerRealityCheck(
          "postpone_task",
          `User pushed deadline for '${task.title}' from ${task.deadline} to ${draft.deadline}. Postponed ${updates.postponedCount} times.`
        );
      }

      // Re-run Risk Agent automatically on edit
      const tempTaskForRisk: Task = {
        ...task,
        ...updates
      };
      const newRisk = await calculateTaskRiskAction(tempTaskForRisk);
      updates.riskAnalysis = newRisk;

      await onUpdateTask(task.id, updates);
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle single subtask status
  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    const updatedSubtasks = task.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed } : s
    );
    
    // Update local task values to recalculate risk
    const tempTask: Task = {
      ...task,
      subtasks: updatedSubtasks
    };
    
    const newRisk = await calculateTaskRiskAction(tempTask);
    await onUpdateTask(task.id, { 
      subtasks: updatedSubtasks,
      riskAnalysis: newRisk
    });
  };

  // Run AI Planning Agent to decompose goal into subtasks
  const handleDecompose = async () => {
    setIsDecomposing(true);
    try {
      const result = await getDecomposedSubtasksAction(draft.description || draft.title);
      const updatedSubtasks = result.subtasks || [];

      const tempTask: Task = {
        ...task,
        subtasks: updatedSubtasks,
        priority: result.priority || draft.priority,
        effort: result.effort || draft.effort,
      };

      // Update draft with new AI values
      setDraft(prev => ({
        ...prev,
        priority: result.priority || draft.priority,
        effort: result.effort || draft.effort,
      }));

      // Calculate risk
      const newRisk = await calculateTaskRiskAction(tempTask);

      await onUpdateTask(task.id, {
        subtasks: updatedSubtasks,
        priority: result.priority || draft.priority,
        effort: result.effort || draft.effort,
        riskAnalysis: newRisk,
      });
    } catch (error) {
      console.error("AI Decomposition failed:", error);
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to stash/delete this task?")) {
      await onDeleteTask(task.id);
      onClose();
    }
  };

  // Determine risk badges colors
  const getRiskColor = (score: number) => {
    if (score > 75) return "text-accent-red bg-accent-red-soft border-accent-red/20";
    if (score > 40) return "text-accent-yellow bg-accent-yellow-soft border-accent-yellow/20";
    return "text-accent-green bg-accent-green-soft border-accent-green/20";
  };

  return (
    <div className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface border border-hairline rounded-lg overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-hairline flex items-center justify-between bg-surface-elevated">
          <span className="text-sm font-semibold text-on-dark tracking-tight flex items-center">
            <Zap className="w-4 h-4 text-accent-yellow mr-1.5" />
            Task Settings
          </span>
          <button 
            onClick={onClose}
            className="text-stone hover:text-on-dark transition-colors p-1 rounded-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 max-h-[75vh]">
          {/* Risk Dashboard */}
          <div className={`border p-4 rounded-md space-y-2 ${getRiskColor(task.riskAnalysis.riskScore)}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Deadline Risk Score
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold font-display-xl">{task.riskAnalysis.riskScore}%</span>
                <span className="text-[10px] opacity-75 font-mono">Conf: {task.riskAnalysis.confidenceScore}%</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{task.riskAnalysis.reasoning}</p>
            {task.postponedCount > 0 && (
              <p className="text-[10px] opacity-75 font-mono pt-1">
                ⚠️ Postponed {task.postponedCount} times. Last delay: {new Date(task.lastPostponedAt || "").toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-mute">Task Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
                className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-mute">Task Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Give a clear definition of completion so the Planning Agent can outline subtasks."
                className="w-full bg-surface-elevated text-on-dark border border-hairline rounded-md p-3 text-sm focus:outline-none focus:border-hairline-strong placeholder-stone resize-none"
              />
            </div>

            {/* Grid properties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-medium text-mute">Deadline</label>
                <div className="relative">
                  <input
                    type="date"
                    value={draft.deadline}
                    onChange={(e) => setDraft(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-medium text-mute">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft(prev => ({ ...prev, status: e.target.value as Task["status"] }))}
                  className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Completed</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-medium text-mute">AI Priority</label>
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft(prev => ({ ...prev, priority: e.target.value as Task["priority"] }))}
                  className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-medium text-mute">Estimated Effort</label>
                <select
                  value={draft.effort}
                  onChange={(e) => setDraft(prev => ({ ...prev, effort: e.target.value as Task["effort"] }))}
                  className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong"
                >
                  <option value="low">Low Effort</option>
                  <option value="medium">Medium Effort</option>
                  <option value="high">High Effort</option>
                </select>
              </div>
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="space-y-3 pt-3 border-t border-hairline">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-dark tracking-wide uppercase select-none">Actionable Subtasks</span>
              <button
                onClick={handleDecompose}
                disabled={isDecomposing}
                className="text-xs bg-surface-elevated border border-hairline text-accent-blue rounded-md px-3 h-7 flex items-center hover:bg-surface-card hover:border-hairline-strong transition-colors duration-150 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3 mr-1.5" />
                {isDecomposing ? "Decomposing..." : "Decompose (AI)"}
              </button>
            </div>

            {task.subtasks.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-hairline rounded-md bg-surface-elevated/30">
                <p className="text-xs text-stone">No subtasks defined. Click Decompose (AI) to generate an actionable path.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {task.subtasks.map((sub) => (
                  <div 
                    key={sub.id}
                    className="flex items-center space-x-3 bg-surface-elevated border border-hairline/60 rounded px-3 py-2.5"
                  >
                    <button
                      onClick={() => handleToggleSubtask(sub.id, !sub.completed)}
                      className="text-mute hover:text-on-dark transition-colors cursor-pointer"
                    >
                      {sub.completed ? (
                        <CheckSquare className="w-4 h-4 text-accent-green" />
                      ) : (
                        <Square className="w-4 h-4 text-stone" />
                      )}
                    </button>
                    <span className={`text-xs font-medium ${sub.completed ? "line-through text-stone" : "text-ink"}`}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-hairline bg-surface-elevated flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="h-9 px-3 bg-transparent text-accent-red rounded-md text-xs font-medium transition-colors hover:bg-accent-red-soft flex items-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete Task
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-transparent border border-hairline text-on-dark rounded-md text-xs font-medium transition-colors hover:bg-surface-card cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-4 bg-on-dark text-button-fg rounded-md text-xs font-medium transition-colors hover:bg-primary-pressed cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

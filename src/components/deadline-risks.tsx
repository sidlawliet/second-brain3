import React from "react";
import { TrendingUp, Plus, CheckCircle2 } from "lucide-react";
import { Task } from "@/lib/db";

interface DeadlineRisksProps {
  criticalTasks: Task[];
  newTaskTitle: string;
  setNewTaskTitle: (val: string) => void;
  newTaskDeadline: string;
  setNewTaskDeadline: (val: string) => void;
  handleCreateTask: () => void;
  handleUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  setSelectedTask: (task: Task) => void;
  handleTriggerRealityCheck: (action: string, context: string) => void;
}

export const DeadlineRisks: React.FC<DeadlineRisksProps> = ({
  criticalTasks,
  newTaskTitle,
  setNewTaskTitle,
  newTaskDeadline,
  setNewTaskDeadline,
  handleCreateTask,
  handleUpdateTask,
  setSelectedTask,
  handleTriggerRealityCheck
}) => {
  return (
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
  );
};

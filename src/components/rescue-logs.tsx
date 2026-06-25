import React from "react";
import { ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { Task, RescueSession } from "@/lib/db";

interface RescueLogsProps {
  rescue: RescueSession | null;
  tasks: Task[];
  stashedTasks: Task[];
  handleToggleRescueMode: () => void;
  handleUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  setSelectedTask: (task: Task) => void;
  handleTriggerRealityCheck: (action: string, context: string) => void;
}

export const RescueLogs: React.FC<RescueLogsProps> = ({
  rescue,
  tasks,
  stashedTasks,
  handleToggleRescueMode,
  handleUpdateTask,
  setSelectedTask,
  handleTriggerRealityCheck
}) => {
  if (!rescue) return null;

  return (
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
  );
};

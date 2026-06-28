import React from "react";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import { Task, DailyPlan } from "@/lib/db";

interface DailyFocusPlanProps {
  tasks: Task[];
  dailyPlan: DailyPlan | null;
  aiLoading: boolean;
  handleAIPrioritization: () => void;
  setSelectedTask: (task: Task) => void;
  trendData: { thisWeek: number; lastWeek: number; trend: string; insight: string };
}

export const DailyFocusPlan: React.FC<DailyFocusPlanProps> = ({
  tasks,
  dailyPlan,
  aiLoading,
  handleAIPrioritization,
  setSelectedTask,
  trendData
}) => {
  const rawTasksOrder = dailyPlan?.tasksOrder;
  let tasksOrder: string[] = [];
  if (Array.isArray(rawTasksOrder)) {
    tasksOrder = rawTasksOrder;
  } else if (rawTasksOrder && typeof rawTasksOrder === "object") {
    const obj = (rawTasksOrder as unknown) as Record<string, unknown>;
    if (Array.isArray(obj.tasksOrder)) {
      tasksOrder = obj.tasksOrder as string[];
    }
  }

  return (
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
          {typeof dailyPlan.coachingInsight === "string" 
            ? dailyPlan.coachingInsight 
            : ((dailyPlan.coachingInsight as unknown) as Record<string, unknown>)?.insight as string || JSON.stringify(dailyPlan.coachingInsight)}
        </div>
      )}

      {/* Scheduled Blocks */}
      {tasks.length === 0 ? (
        <div className="flex-grow flex items-center justify-center py-12 text-center text-xs text-stone border border-dashed border-hairline rounded-md">
          No tasks registered. Create a task via Cmd+K to initialize daily scheduling.
        </div>
      ) : (
        <div className="space-y-3.5">
          {tasksOrder && tasksOrder.length > 0 ? (
            tasksOrder.map((tid, idx) => {
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
  );
};

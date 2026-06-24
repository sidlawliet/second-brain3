// ponytail: localStorage-based trend tracker, no DB dependency
// upgrade: move to Firestore when user count grows for cross-device trends

interface PostponeEvent {
  date: string; // YYYY-MM-DD
  count: number;
}

const STORAGE_KEY = "sb_trend";

function getEvents(): PostponeEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEvents(events: PostponeEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function recordPostpone() {
  const today = new Date().toISOString().split("T")[0];
  const events = getEvents();
  const existing = events.find(e => e.date === today);
  if (existing) {
    existing.count += 1;
  } else {
    events.push({ date: today, count: 1 });
  }
  saveEvents(events);
}

export function getWeeklyTrend(): { thisWeek: number; lastWeek: number; trend: string } {
  const events = getEvents();
  const now = new Date();

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay()); // Sunday
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let thisWeek = 0;
  let lastWeek = 0;

  for (const e of events) {
    const d = new Date(e.date);
    if (d >= thisWeekStart) {
      thisWeek += e.count;
    } else if (d >= lastWeekStart && d < thisWeekStart) {
      lastWeek += e.count;
    }
  }

  let trend: string;
  if (lastWeek === 0 && thisWeek === 0) {
    trend = "No data yet — start tracking by postponing a task.";
  } else if (lastWeek === 0) {
    trend = `${thisWeek} postpones this week. Early days.`;
  } else {
    const change = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    if (change < 0) trend = `${Math.abs(change)}% fewer postpones than last week. Progress.`;
    else if (change > 0) trend = `${change}% more postpones than last week. The trend is the wrong direction.`;
    else trend = "Same postpones as last week. No improvement.";
  }

  return { thisWeek, lastWeek, trend };
}

export function getProcrastinationInsight(tasksCount: number): string {
  const { thisWeek, lastWeek, trend } = getWeeklyTrend();

  if (tasksCount === 0) return "Add your first task to start tracking procrastination patterns.";

  if (thisWeek === 0 && lastWeek === 0) {
    return "Zero postpones recorded. Either you're executing perfectly, or you haven't pushed a deadline yet.";
  }

  if (thisWeek < lastWeek) {
    return "Postpones are trending down. The system is working. Keep momentum.";
  }

  if (thisWeek > lastWeek) {
    return `Postpones are up. ${trend}. Each delay compounds the next.`;
  }

  return trend;
}

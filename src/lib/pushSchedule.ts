import type { StudyPlan } from './calendar';
import type { FocusSession } from './focusSession';
export interface PushJob {
  id: string; kind: 'plan' | 'focus' | 'break'; dueAt: string; expiresAt: string;
  title: string; body: string; destination: 'calendar' | 'classroom';
}
export function pushSchedule(plans: StudyPlan[], session: FocusSession | null, now = Date.now()): PushJob[] {
  const jobs: PushJob[] = [];
  const add = (id: string, kind: PushJob['kind'], due: number, expiry: number, title: string, body: string, destination: PushJob['destination']) => {
    if (due > now && due <= now + 366 * 86400000) jobs.push({ id, kind, dueAt: new Date(due).toISOString(), expiresAt: new Date(expiry).toISOString(), title, body: body.slice(0, 240), destination });
  };
  for (const plan of plans) {
    if (plan.source !== 'local' || plan.reminderMinutes == null) continue;
    const start = Date.parse(plan.startsAt), due = start - plan.reminderMinutes * 60000;
    if (!Number.isFinite(due)) continue;
    add(`plan:${plan.id}:${due}`, 'plan', due, start + 600000, 'A little time for your plan', plan.title, 'calendar');
  }
  if (session?.status === 'running') {
    if (session.stage === 'focus') {
      add(`focus:${session.deadline}`, 'focus', session.deadline, session.deadline + 120000,
        session.mode === 'pomodoro' ? 'Time for a little break' : 'Your focus session is complete', session.subject, 'classroom');
      if (session.mode === 'pomodoro') add(`break:${session.deadline + 300000}`, 'break', session.deadline + 300000, session.deadline + 900000, 'Your seat is waiting', 'Your break is over. Come back when you’re ready.', 'classroom');
    } else if (session.stage === 'break') add(`break:${session.deadline}`, 'break', session.deadline, session.deadline + 600000, 'Your seat is waiting', 'Your break is over. Come back when you’re ready.', 'classroom');
  }
  return jobs.sort((a,b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 100);
}

import { describe, expect, it } from 'vitest';
import { startSession, pauseSession, advanceSession } from './focusSession';
import { pushSchedule } from './pushSchedule';

describe('phone notification schedule', () => {
  it('schedules focus and break against absolute deadlines, without restarting on reopen', () => {
    const session = startSession('pomodoro', 25, 'Calculus', 1000);
    const jobs = pushSchedule([], session, 1000);
    expect(jobs.map(j => [j.kind, j.dueAt])).toEqual([
      ['focus', new Date(1501000).toISOString()], ['break', new Date(1801000).toISOString()],
    ]);
    expect(pushSchedule([], advanceSession(session, 1502000), 1502000).map(j => j.kind)).toEqual(['break']);
    expect(pushSchedule([], pauseSession(session, 2000), 2000)).toEqual([]);
    expect(pushSchedule([], advanceSession(session, 1802000), 1802000)).toEqual([]);
  });
  it('only uploads upcoming local reminders, never unrelated Google agenda or notes', () => {
    const plans = [{ id: 'p', source: 'local' as const, title: 'Read', startsAt: new Date(900000).toISOString(), durationMinutes: 25, reminderMinutes: 10 as const }];
    const jobs = pushSchedule(plans, null, 0);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: 'plan', dueAt: new Date(300000).toISOString(), destination: 'calendar' });
    expect(pushSchedule([{...plans[0], reminderMinutes: null}], null, 0)).toEqual([]);
    expect(pushSchedule(plans, null, 900001)).toEqual([]);
  });
});

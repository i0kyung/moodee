import { useCallback, useEffect, useState } from 'react';
import { advanceSession, endSession, nextRound, pauseSession, resumeSession, startSession, type FocusMode, type FocusSession } from './focusSession';
import { loadValue, save } from './storage';

function restore(): FocusSession | null {
  const s = loadValue<FocusSession | null>('activeFocusSession', null);
  if (!s || !['timer','pomodoro'].includes(s.mode) || !['focus','break','return','complete'].includes(s.stage) || !['running','paused'].includes(s.status) || typeof s.subject !== 'string' || s.subject.length > 4000 || ![s.deadline,s.remainingMs,s.focusDurationMs,s.focusedMs,s.rounds].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) || s.focusDurationMs < 60000 || s.focusDurationMs > 43200000) return null;
  return advanceSession(s, Date.now());
}

export function useFocusSession() {
  const [session, setSession] = useState<FocusSession | null>(restore);
  // Persist transitions, not every countdown tick. Absolute deadlines restore elapsed time.
  useEffect(() => { save('activeFocusSession', session); }, [session?.deadline, session?.stage, session?.status, session?.subject, session?.focusedMs, session?.rounds]);
  const start = useCallback((mode: FocusMode, minutes: number, subject: string) => setSession(startSession(mode, minutes, subject, Date.now())), []);
  const clear = useCallback(() => setSession(null), []);
  const end = useCallback(() => setSession((state) => state && endSession(state, Date.now())), []);
  const togglePause = useCallback(() => setSession((state) => state && (state.status === 'running' ? pauseSession(state, Date.now()) : resumeSession(state, Date.now()))), []);
  const returnToFocus = useCallback(() => setSession((state) => state && nextRound(state, Date.now())), []);
  const ticking = session !== null && session.status === 'running' && (session.stage === 'focus' || session.stage === 'break');
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setSession((state) => state && advanceSession(state, Date.now()));
    const id = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ticking]);
  useEffect(() => {
    if (!session || session.stage === 'complete') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [session !== null && session.stage !== 'complete']);
  return { session, start, clear, end, togglePause, returnToFocus };
}
export type FocusSessionController = ReturnType<typeof useFocusSession>;

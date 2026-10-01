// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFocusSession } from './useFocusSession';

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });
it('restores a closed Pomodoro into its expired break and keeps paused time frozen', () => {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const first = renderHook(() => useFocusSession());
  act(() => first.result.current.start('pomodoro', 25, 'Read'));
  first.unmount();
  vi.setSystemTime(1802000);
  const second = renderHook(() => useFocusSession());
  expect(second.result.current.session?.stage).toBe('return');
  act(() => second.result.current.returnToFocus());
  act(() => second.result.current.togglePause());
  const left = second.result.current.session!.remainingMs;
  second.unmount(); vi.setSystemTime(9999999);
  const third = renderHook(() => useFocusSession());
  expect(third.result.current.session?.remainingMs).toBe(left);
  expect(third.result.current.session?.status).toBe('paused');
  act(() => third.result.current.clear()); third.unmount();
  expect(renderHook(() => useFocusSession()).result.current.session).toBeNull();
});
it('discards a corrupt saved timer', () => {
  localStorage.setItem('moodie:activeFocusSession', JSON.stringify({deadline: 'bad', stage:'focus'}));
  expect(renderHook(() => useFocusSession()).result.current.session).toBeNull();
});
it('keeps the break deadline through rerenders and reconciles time on returning to the tab', () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const { result, rerender } = renderHook(() => useFocusSession());
  act(() => result.current.start('pomodoro', 25, 'Notes'));
  act(() => { vi.setSystemTime(1500000); window.dispatchEvent(new Event('focus')); });
  expect(result.current.session?.stage).toBe('break');
  rerender();
  act(() => { vi.setSystemTime(1801000); document.dispatchEvent(new Event('visibilitychange')); });
  expect(result.current.session?.stage).toBe('return');
  act(() => result.current.returnToFocus());
  expect(result.current.session?.remainingMs).toBe(1500000);
  act(() => result.current.end());
  expect(result.current.session?.focusedMs).toBe(1500000);
});

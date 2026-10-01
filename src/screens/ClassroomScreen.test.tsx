// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { startSession } from '../lib/focusSession';
import { ClassroomScreen } from './ClassroomScreen';

vi.mock('../audio/useSoundscape', () => ({ useSoundscape: () => ({
  settings: { master: .8, sounds: { clock: {on:false}, pencil: {on:false}, breeze: {on:false}, hum: {on:false} } },
  playing: true, start: async () => {}, stop: () => {},
}) }));
vi.mock('../components/SeatedScene', () => ({ SeatedScene: () => null }));
vi.mock('../components/SeatPicker', () => ({ SeatPicker: () => null }));
vi.mock('../components/TutorPanel', () => ({ TutorPanel: () => null }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it('keeps Tutor, Chat and sounds above the timer including the iPhone bottom safe area', async () => {
  let height = 192;
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('aria-label') === 'Focus timer' ? height : 0;
  });
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = computedStyle(element);
    if (element.getAttribute('aria-label') === 'Focus timer') Object.defineProperty(style, 'marginBottom', {value: '46px'});
    return style;
  });
  render(<ClassroomScreen characterId={null} visible onExit={() => {}} onEnd={() => {}} onRecords={() => {}} focusTimer={{
    session: startSession('pomodoro', 25, 'Coding', Date.now()),
    start: vi.fn(), clear: vi.fn(), end: vi.fn(), togglePause: vi.fn(), returnToFocus: vi.fn(),
  }} />);
  const controls = screen.getByRole('button', {name: 'Tutor'}).parentElement!.parentElement!;
  await waitFor(() => expect(controls.style.bottom).toBe('250px'));
  expect(screen.getByRole('group', {name: 'Ambient sounds'}).style.bottom).toBe('250px');
  height = 232;
  fireEvent(window, new Event('resize'));
  await waitFor(() => expect(controls.style.bottom).toBe('290px'));
});

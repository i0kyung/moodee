// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionIntentScreen } from './SessionIntentScreen';

afterEach(cleanup);

it('requires a confirmed nonblank one-line goal before entering Classroom', () => {
  const onConfirm = vi.fn();
  render(<SessionIntentScreen initialText="  " onBack={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: /enter classroom/i }));
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: /one thing/i }), { target: { value: '  Write introduction  ' } });
  fireEvent.click(screen.getByRole('button', { name: /enter classroom/i }));
  expect(onConfirm).toHaveBeenCalledWith({ text: 'Write introduction' });
});

it('requires confirmation even when an agenda event fills the goal', () => {
  const onConfirm = vi.fn();
  render(<SessionIntentScreen initialText="Seminar notes" sourceEventId="google-event" onBack={() => {}} onConfirm={onConfirm} />);
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /enter classroom/i }));
  expect(onConfirm).toHaveBeenCalledWith({ text: 'Seminar notes', sourceEventId: 'google-event' });
});

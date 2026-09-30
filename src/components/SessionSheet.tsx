// 집중 시작 전 계획: 얼마나(시간) + 무엇을(What are you studying?) — 포스트잇 피드백의 Intention 단계
import { useState } from 'react';
import { customSubjects, SUBJECT_PRESETS } from '../lib/sessions';
import { Sheet } from './Sheet';
import styles from './SessionSheet.module.css';

interface Props {
  open: boolean;
  minutes: number;
  subject: string;
  onMinutes: (m: number) => void;
  onSubject: (s: string) => void;
  onStart: () => void;
}

// 1분은 발표·시연용(기록과 코인이 쌓이는 과정을 바로 보여 주기 위함)
const DURATIONS = [15, 25, 50, 1];

export function SessionSheet({ open, minutes, subject, onMinutes, onSubject, onStart }: Props) {
  const [draft, setDraft] = useState('');
  const chips = [...SUBJECT_PRESETS, ...customSubjects().filter((s) => !SUBJECT_PRESETS.includes(s))];
  const isCustom = subject !== '' && !chips.includes(subject);

  const commitDraft = () => {
    const v = draft.trim();
    if (v) onSubject(v);
  };

  return (
    <Sheet open={open} onClose={() => {}} dismissable={false} title="Plan this session" subtitle="Pick a length and one thing to work on.">
      <h3 className={styles.label}>How long?</h3>
      <div className={styles.chips} role="radiogroup" aria-label="Session length">
        {DURATIONS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={minutes === m} className={`${styles.chip} ${minutes === m ? styles.on : ''}`} onClick={() => onMinutes(m)}>
            {m} min{m === 1 && <small> · demo</small>}
          </button>
        ))}
      </div>

      <h3 className={styles.label}>What are you studying?</h3>
      <div className={styles.chips} role="radiogroup" aria-label="Subject">
        {chips.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={subject === s}
            className={`${styles.chip} ${subject === s ? styles.on : ''}`}
            onClick={() => {
              onSubject(subject === s ? '' : s);
              setDraft('');
            }}
          >
            {s}
          </button>
        ))}
        {isCustom && (
          <button type="button" role="radio" aria-checked className={`${styles.chip} ${styles.on}`} onClick={() => onSubject('')}>
            {subject}
          </button>
        )}
      </div>
      <input
        className={styles.input}
        value={draft}
        maxLength={24}
        placeholder="Or type your own — e.g. UX assignment"
        aria-label="Type your own subject"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => e.key === 'Enter' && (commitDraft(), e.currentTarget.blur())}
      />

      <button type="button" className="pill pill-primary" style={{ width: '100%', marginTop: 14 }} onClick={onStart}>
        {subject ? `Start ${minutes} min of ${subject}` : `Start ${minutes} min`}
      </button>
      <p className={styles.note}>Classmates only see what you’re studying — no chat.</p>
    </Sheet>
  );
}

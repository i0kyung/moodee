import { motion } from 'framer-motion';
import { useState } from 'react';
import { BackIcon } from '../components/Icons';
import { normalizeIntent, type SessionIntent } from '../lib/calendar';
import { screenMotion } from '../lib/motion';
import styles from './SessionIntentScreen.module.css';

interface Props {
  initialText?: string;
  sourceEventId?: string;
  onBack: () => void;
  onConfirm: (intent: SessionIntent) => void;
}

export function SessionIntentScreen({ initialText = '', sourceEventId, onBack, onConfirm }: Props) {
  const [text, setText] = useState(initialText);
  const [attempted, setAttempted] = useState(false);
  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    const intent = normalizeIntent(text, sourceEventId);
    if (intent) onConfirm(intent);
  };
  return (
    <motion.main className={`screen ${styles.screen}`} {...screenMotion}>
      <header className={styles.header}>
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>
        <span className={styles.step}>Before Classroom</span>
      </header>
      <div className={styles.content}>
        <span className={styles.sparkle} aria-hidden>✦</span>
        <p className={styles.eyebrow}>One thing to start</p>
        <h1>What will you begin with?</h1>
        <p className={styles.copy}>Just one small step is enough. Your goal will stay with you while you focus.</p>
        <form onSubmit={confirm}>
          <label htmlFor="session-goal">My one thing</label>
          <input id="session-goal" aria-label="One thing to start" autoFocus value={text} maxLength={300} onChange={(event) => setText(event.target.value)} placeholder="e.g. Write the report intro" />
          {attempted && !text.trim() && <p className={styles.error} role="alert">Write one thing before entering.</p>}
          <button type="submit" className="pill pill-primary">Enter Classroom</button>
        </form>
      </div>
    </motion.main>
  );
}

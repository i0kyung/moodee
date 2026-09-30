// 클래스룸 흐름: 걸어서 자리 고르기(탑뷰) → 앉기(눈높이 뷰로 카메라 이동) → 소리 설정 → 집중 타이머
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundscape, type SoundId } from '../audio/soundscape';
import { useSoundscape } from '../audio/useSoundscape';
import { BackIcon, FlameIcon, MuteIcon, ResetIcon, SoundIcon } from '../components/Icons';
import { SeatedScene } from '../components/SeatedScene';
import { SeatPicker } from '../components/SeatPicker';
import { SoundMixer } from '../components/SoundMixer';
import { getCharacter, type CharacterId } from '../data/characters';
import type { Seat } from '../data/places';
import { loadValue, save } from '../lib/storage';
import { completeSession } from '../lib/streak';
import { screenMotion } from '../lib/motion';
import type { SessionIntent } from '../lib/calendar';
import styles from './ClassroomScreen.module.css';

interface Props {
  characterId: CharacterId | null;
  intent: SessionIntent;
  onExit: () => void;
}

type Phase = 'explore' | 'sitting' | 'sounds' | 'focus';
type TimerStatus = 'idle' | 'running' | 'paused';
const DURATIONS = [15, 25, 50];

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function ClassroomScreen({ characterId, intent, onExit }: Props) {
  const character = getCharacter(characterId);
  const { settings, playing, start, stop } = useSoundscape();
  const [phase, setPhase] = useState<Phase>('explore');
  const [seat, setSeat] = useState<Seat | null>(null);
  const [mixerOpen, setMixerOpen] = useState(false);

  // ── 타이머 ──
  const [minutes, setMinutes] = useState(() => loadValue('focusMinutes', 25));
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [remaining, setRemaining] = useState(minutes * 60_000);
  const endAt = useRef(0);
  const [done, setDone] = useState<null | { count: number }>(null);

  const finish = useCallback(() => {
    setStatus('idle');
    setRemaining(minutes * 60_000);
    soundscape.chime();
    setDone(completeSession());
  }, [minutes]);

  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => {
      const left = endAt.current - Date.now();
      if (left <= 0) {
        window.clearInterval(id);
        finish();
      } else setRemaining(left);
    }, 250);
    return () => window.clearInterval(id);
  }, [status, finish]);

  // 화면을 떠나면 소리 정지
  useEffect(() => () => soundscape.stop(), []);

  // 앉는 탭(사용자 제스처) 안에서 소리를 켜 두고, 카메라 이동이 끝나면 소리 설정을 띄움
  const sit = (s: Seat) => {
    setSeat(s);
    setPhase('sitting');
    void start();
    window.setTimeout(() => setPhase('sounds'), 1900);
  };

  const changeSeat = () => {
    setStatus('idle');
    setRemaining(minutes * 60_000);
    setPhase('explore');
  };

  const pickMinutes = (m: number) => {
    setMinutes(m);
    setRemaining(m * 60_000);
    save('focusMinutes', m);
  };

  const onPrimary = async () => {
    if (status === 'running') {
      setStatus('paused');
      return;
    }
    endAt.current = Date.now() + remaining;
    setStatus('running');
    if (!playing) await start();
  };

  const reset = () => {
    setStatus('idle');
    setRemaining(minutes * 60_000);
  };

  const toggleSound = async (id: SoundId) => {
    const on = !settings.sounds[id].on;
    soundscape.setSound(id, { on });
    if (on && !playing) await start();
  };

  const progress = 1 - remaining / (minutes * 60_000);
  const primaryLabel = status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Start focus';
  const seated = phase !== 'explore';

  return (
    <motion.main className={`screen ${styles.room}`} {...screenMotion}>
      <AnimatePresence initial={false}>
        {seated && seat ? (
          <motion.div key="seated" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <SeatedScene
              character={character}
              side={seat.side}
              focusing={status === 'running'}
              raised={phase === 'sounds' || mixerOpen}
              soundOn={(id) => playing && settings.sounds[id].on}
              onToggleSound={toggleSound}
            />
          </motion.div>
        ) : (
          <motion.div key="explore" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <SeatPicker character={character} onSit={sit} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className={styles.top}>
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Leave classroom">
          <BackIcon />
        </button>
        {seated && seat ? (
          <button type="button" className={styles.chip} onClick={changeSeat} disabled={status === 'running'} aria-label={`Seat ${seat.id}. Change seat`}>
            Seat {seat.id} <span>· Change</span>
          </button>
        ) : (
          <span className={styles.chip}>Classroom</span>
        )}
        {seated ? (
          <button type="button" className={`icon-btn ${playing ? styles.soundLive : ''}`} onClick={() => setMixerOpen(true)} aria-label="Sound mixer">
            {playing && settings.master > 0 ? <SoundIcon /> : <MuteIcon />}
          </button>
        ) : (
          <span className={styles.spacer} />
        )}
      </header>

      <div className={styles.intentBadge} aria-label={`My one thing: ${intent.text}`}><span>MY ONE THING</span><b>{intent.text}</b></div>

      <AnimatePresence>
        {phase === 'sitting' && (
          <motion.p className={styles.toast} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }} exit={{ opacity: 0 }}>
            Taking a seat…
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'focus' && (
          <motion.section
            className={styles.panel}
            aria-label="Focus timer"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            <div className={styles.timerRow}>
              <div className={styles.ring} style={{ ['--p' as string]: progress }}>
                <span className={styles.time}>{fmt(remaining)}</span>
              </div>
              <div className={styles.timerSide}>
                {status === 'idle' ? (
                  <div className={styles.chips} role="radiogroup" aria-label="Session length">
                    {DURATIONS.map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={minutes === m} className={minutes === m ? styles.chipOn : ''} onClick={() => pickMinutes(m)}>
                        {m}m
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.state}>{status === 'running' ? 'Focusing at your desk…' : 'Paused. Take a breath.'}</p>
                )}
              </div>
            </div>
            <div className={styles.actions}>
              {status !== 'idle' && (
                <button type="button" className="icon-btn" onClick={reset} aria-label="Reset timer">
                  <ResetIcon />
                </button>
              )}
              <button type="button" className="pill pill-primary" onClick={onPrimary}>
                {primaryLabel}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 앉은 직후: 소리 설정 → 끝나면 타이머 */}
      <SoundMixer
        open={phase === 'sounds'}
        title="Set the mood"
        subtitle="Everything starts quiet. Tap a sound to add it."
        doneLabel="I'm ready"
        onClose={() => setPhase('focus')}
        playing={playing}
        onPlay={start}
        onStop={stop}
      />
      <SoundMixer open={mixerOpen} onClose={() => setMixerOpen(false)} playing={playing} onPlay={start} onStop={stop} />

      <AnimatePresence>
        {done && (
          <motion.div className={styles.doneBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className={styles.doneCard}
              role="dialog"
              aria-modal="true"
              aria-labelledby="done-title"
              initial={{ y: 40, scale: 0.95 }}
              animate={{ y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className={styles.doneFlame}>
                <FlameIcon width={34} height={34} />
              </div>
              <h2 id="done-title">Session complete</h2>
              <p>
                {minutes} calm minutes with {character.name}.<br />
                You're on a <b>{done.count}-day</b> streak.
              </p>
              <button type="button" className="pill pill-primary" onClick={() => setDone(null)}>
                Stay a little longer
              </button>
              <button type="button" className={styles.doneLink} onClick={onExit}>
                Back home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}

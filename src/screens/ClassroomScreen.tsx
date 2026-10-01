// 클래스룸 집중 루틴(포스트잇 피드백 반영):
// 자리 고르기 → 자리로 이동·앉기 → 소리 조절 → 시간 + "What are you studying?" → 집중 → 기록 저장
// 같은 방 친구들이 무엇을 공부 중인지는 이름표와 People 시트로 보인다(채팅 없음)
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundscape, type SoundId } from '../audio/soundscape';
import { useSoundscape } from '../audio/useSoundscape';
import { ClassroomHud } from '../components/ClassroomHud';
import { CountUp, Sparkles } from '../components/Coin';
import { BackIcon, MuteIcon, PeopleIcon, SoundIcon } from '../components/Icons';
import { PeopleSheet } from '../components/PeopleSheet';
import { SeatedScene } from '../components/SeatedScene';
import { SeatPicker } from '../components/SeatPicker';
import { SessionSheet } from '../components/SessionSheet';
import { SoundMixer } from '../components/SoundMixer';
import { CLASSMATES } from '../data/classmates';
import { getCharacter, type CharacterId } from '../data/characters';
import type { Seat } from '../data/places';
import { MIN_REWARD_MINUTES, sessionCoins } from '../config/economy';
import { addSession, fmtMinutes, setFriction } from '../lib/sessions';
import { addThought } from '../lib/thoughts';
import { loadValue, save } from '../lib/storage';
import { completeSession } from '../lib/streak';
import { earn, markStampReady } from '../lib/wallet';
import { screenMotion } from '../lib/motion';
import type { SessionIntent } from '../lib/calendar';
import styles from './ClassroomScreen.module.css';

interface Props {
  characterId: CharacterId | null;
  onExit: () => void;
  onRecords: () => void;
  intent: SessionIntent;
}

type Phase = 'explore' | 'sitting' | 'sounds' | 'plan' | 'focus';
type TimerStatus = 'running' | 'paused';
interface Done {
  sessionId: string;
  streak: number;
  minutes: number;
  subject: string;
  sessionCoins: number; // 집중 시간 보상(1시간 = 30코인)
  stamp: boolean; // 오늘 첫 세션이라 출석 도장이 준비됨
  step: 'reward' | 'checkin';
}

const coinsImg = `${import.meta.env.BASE_URL}assets/rewards/coins.png`;
const FRICTION = ['Easy', 'Okay', 'So-so', 'Hard', 'Very hard'];

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function ClassroomScreen({ characterId, intent, onExit, onRecords }: Props) {
  const character = getCharacter(characterId);
  const { settings, playing, start, stop } = useSoundscape();
  const [phase, setPhase] = useState<Phase>('explore');
  const [seat, setSeat] = useState<Seat | null>(null);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

  // ── 세션 계획 ──
  const [minutes, setMinutes] = useState(() => loadValue('focusMinutes', 25));
  const [subject, setSubject] = useState(intent.text);

  // ── 타이머 ──
  const [status, setStatus] = useState<TimerStatus>('running');
  const [remaining, setRemaining] = useState(minutes * 60_000);
  const endAt = useRef(0);
  const [done, setDone] = useState<Done | null>(null);
  // 생각 내려놓기(C6): 타이머는 멈추지 않는다
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [thought, setThought] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const saveThought = () => {
    if (!thought.trim()) return;
    addThought(thought, `Classroom · ${subject || 'Focus'}`);
    setThought('');
    setThoughtOpen(false);
    setToast('Saved to Library');
    window.setTimeout(() => setToast(null), 2000);
  };

  // 세션 저장: 실제로 집중한 분만 기록(중간에 끝내도 남김), 오늘 첫 세션이면 하루 코인 지급
  const finish = useCallback(
    (focusedMs: number) => {
      const mins = Math.max(1, Math.round(focusedMs / 60_000));
      const label = subject || 'Focus';
      const session = addSession({ subject: label, minutes: mins, seat: seat?.id ?? '' });
      soundscape.chime();
      // 코인: 집중 시간 보상 + 오늘 첫 세션이면 하루 선물
      const earned = sessionCoins(mins);
      if (earned) earn(earned);
      setDone({ sessionId: session.id, streak: completeSession().count, minutes: mins, subject: label, sessionCoins: earned, stamp: markStampReady(), step: 'reward' });
      setPhase('plan');
    },
    [subject, seat],
  );

  useEffect(() => {
    if (phase !== 'focus' || status !== 'running') return;
    const id = window.setInterval(() => {
      const left = endAt.current - Date.now();
      if (left <= 0) {
        window.clearInterval(id);
        finish(minutes * 60_000);
      } else setRemaining(left);
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, status, finish, minutes]);

  // 화면을 떠나면 소리 정지
  useEffect(() => () => soundscape.stop(), []);

  // 앉는 탭(사용자 제스처) 안에서 오디오를 열어 두고, 카메라 이동이 끝나면 소리 설정을 띄움
  const sit = (s: Seat) => {
    setSeat(s);
    setPhase('sitting');
    void start();
    window.setTimeout(() => setPhase('sounds'), 1900);
  };

  const startFocus = async () => {
    save('focusMinutes', minutes);
    save('lastSubject', subject);
    endAt.current = Date.now() + minutes * 60_000;
    setRemaining(minutes * 60_000);
    setStatus('running');
    setPhase('focus');
    if (!playing) await start();
  };

  const togglePause = () => {
    if (status === 'running') setStatus('paused');
    else {
      endAt.current = Date.now() + remaining;
      setStatus('running');
    }
  };

  // 일찍 끝내기: 10초 넘게 집중했으면 기록, 아니면 계획 화면으로만 돌아감
  const endNow = () => {
    const focused = minutes * 60_000 - remaining;
    if (focused >= 10_000) finish(focused);
    else setPhase('plan');
  };

  const toggleSound = async (id: SoundId) => {
    const on = !settings.sounds[id].on;
    soundscape.setSound(id, { on });
    if (on && !playing) await start();
  };

  // 전체 음소거: 채널별 설정은 그대로 두고 master만 0으로. 다시 켜면 이전 음량으로 복원
  const lastMaster = useRef(settings.master || 0.8);
  const muted = settings.master === 0;
  const toggleMute = async () => {
    if (muted) {
      soundscape.setMaster(lastMaster.current);
      if (!playing) await start();
    } else {
      lastMaster.current = settings.master;
      soundscape.setMaster(0);
    }
  };

  const progress = 1 - remaining / (minutes * 60_000);
  const seated = phase !== 'explore';
  const focusing = phase === 'focus' && status === 'running';

  return (
    <motion.main className={`screen ${styles.room}`} {...screenMotion}>
      <AnimatePresence initial={false}>
        {seated && seat ? (
          <motion.div key="seated" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <SeatedScene
              character={character}
              side={seat.side}
              focusing={focusing}
              raised={phase === 'sounds' || phase === 'plan' || mixerOpen || peopleOpen}
              soundOn={(id) => playing && settings.sounds[id].on}
              onToggleSound={toggleSound}
              mySubject={subject}
              onPeople={() => setPeopleOpen(true)}
            />
          </motion.div>
        ) : (
          <motion.div key="explore" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <SeatPicker character={character} onSit={sit} onPeople={() => setPeopleOpen(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className={styles.top}>
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Leave classroom">
          <BackIcon />
        </button>
        {seated && seat ? (
          <button type="button" className={styles.chip} onClick={() => setPhase('explore')} disabled={phase === 'focus'} aria-label={`Seat ${seat.id}. Change seat`}>
            Seat {seat.id} <span>· Change</span>
          </button>
        ) : (
          <span className={styles.chip}>Classroom</span>
        )}
        <div className={styles.topRight}>
          <button type="button" className={`icon-btn ${styles.people}`} onClick={() => setPeopleOpen(true)} aria-label={`${CLASSMATES.length + 1} people in this room. See who`}>
            <PeopleIcon />
            <b>{CLASSMATES.length + 1}</b>
          </button>
          {seated && (
            <button type="button" className={`icon-btn ${playing && !muted ? styles.soundLive : ''}`} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute all sound' : 'Mute all sound'}>
              {muted ? <MuteIcon /> : <SoundIcon />}
            </button>
          )}
        </div>
      </header>

      <div className={styles.intentBadge} aria-label={`Session goal: ${subject}`}>
        <span>MY ONE THING</span>
        <b>{subject}</b>
      </div>

      {/* 집중 중 HUD: 미니맵·소리 아이콘·데모 채팅 */}
      {phase === 'focus' && seat && !done && (
        <ClassroomHud seat={seat} soundOn={(id) => playing && !muted && settings.sounds[id].on} onToggleSound={toggleSound} onMixer={() => setMixerOpen(true)} raised />
      )}

      {/* 집중 중: 남은 시간 + 지금 하는 것 */}
      <AnimatePresence>
        {phase === 'focus' && (
          <motion.section className={styles.panel} aria-label="Focus timer" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            <div className={styles.timerRow}>
              <div className={styles.ring} style={{ ['--p' as string]: progress }}>
                <span className={styles.time}>{fmt(remaining)}</span>
              </div>
              <div className={styles.timerSide}>
                <span className={styles.nowLabel}>{status === 'running' ? 'Now focusing on' : 'Paused'}</span>
                <p className={styles.state}>{subject || 'Just focus'}</p>
                <button type="button" className={styles.with} onClick={() => setPeopleOpen(true)}>
                  with {CLASSMATES.length} Cloudees ›
                </button>
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={`pill pill-soft ${styles.end}`} onClick={endNow}>
                End
              </button>
              <button type="button" className={`pill pill-soft ${styles.end}`} onClick={() => setThoughtOpen(true)} aria-label="Park a thought in the Library">
                Note
              </button>
              <button type="button" className="pill pill-primary" onClick={togglePause}>
                {status === 'running' ? 'Pause' : 'Resume'}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ① 소리 조절 */}
      <SoundMixer
        open={phase === 'sounds'}
        title="Set the mood"
        subtitle="Everything starts quiet. Tap a sound to add it."
        doneLabel="Next"
        onClose={() => setPhase('plan')}
        playing={playing}
        onPlay={start}
        onStop={stop}
      />
      {/* ② 시간 + 무엇을 공부할지 */}
      <SessionSheet open={phase === 'plan' && !done && !peopleOpen && !mixerOpen} minutes={minutes} subject={subject} onMinutes={setMinutes} onSubject={setSubject} onStart={startFocus} />

      <SoundMixer open={mixerOpen} onClose={() => setMixerOpen(false)} playing={playing} onPlay={start} onStop={stop} />
      <PeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} me={character} mySubject={phase === 'focus' ? subject : undefined} />

      <AnimatePresence>
        {(phase === 'sitting' || toast) && (
          <motion.p key={toast ?? 'sit'} className={styles.toast} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {toast ?? 'Taking a seat…'}
          </motion.p>
        )}
      </AnimatePresence>

      {/* C6 생각 내려놓기 */}
      <AnimatePresence>
        {thoughtOpen && (
          <motion.div className={styles.doneBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setThoughtOpen(false)}>
            <motion.div className={styles.doneCard} role="dialog" aria-modal="true" aria-label="Park a thought" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h2>Park a thought</h2>
              <p>One line goes to your Library. The timer keeps running.</p>
              <input
                className={styles.thoughtInput}
                autoFocus
                maxLength={80}
                value={thought}
                placeholder="e.g. Email the professor later"
                onChange={(e) => setThought(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveThought()}
              />
              <button type="button" className="pill pill-primary" onClick={saveThought} disabled={!thought.trim()}>
                Save to Library
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* C8 보상 → C9 한 번 탭 체크인 */}
      <AnimatePresence>
        {done && (
          <motion.div className={styles.doneBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              key={done.step}
              className={styles.doneCard}
              role="dialog"
              aria-modal="true"
              aria-labelledby="done-title"
              initial={{ y: 40, scale: 0.95 }}
              animate={{ y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } }}
              exit={{ y: 20, opacity: 0 }}
            >
              {done.step === 'reward' ? (
                <>
                  <div className={styles.coinPile}>
                    <motion.img src={coinsImg} alt="" initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.15 }} />
                    <Sparkles count={12} />
                  </div>
                  {done.sessionCoins > 0 ? (
                    <h2 id="done-title">
                      You earned{' '}
                      <em>
                        <CountUp value={done.sessionCoins} duration={1} /> coins!
                      </em>
                    </h2>
                  ) : (
                    <h2 id="done-title">Session saved</h2>
                  )}
                  <p>
                    For studying <b>{fmtMinutes(done.minutes)}</b> of <b>{done.subject}</b>.
                  </p>
                  <div className={styles.doneStats}>
                    {done.sessionCoins > 0 && (
                      <span>
                        <b>+{done.sessionCoins}</b> focus time
                      </span>
                    )}
                    {done.stamp && (
                      <span>
                        <b>★</b> today’s stamp is ready · claim it in the Shop
                      </span>
                    )}
                    <span>
                      <b>{done.streak}</b>-day streak
                    </span>
                  </div>
                  {done.sessionCoins === 0 && (
                    <small className={styles.doneHint}>
                      Sessions of {MIN_REWARD_MINUTES}+ minutes also earn focus coins (30 per hour). Your first session of the day also lights up a stamp in the Shop.
                    </small>
                  )}
                  <button type="button" className="pill pill-primary" onClick={() => setDone({ ...done, step: 'checkin' })}>
                    Continue
                  </button>
                  <button type="button" className={styles.doneLink} onClick={onExit}>
                    Back home
                  </button>
                </>
              ) : (
                <>
                  <h2 id="done-title">How hard was it to start?</h2>
                  <p>One tap. It helps you see what makes starting easier.</p>
                  <div className={styles.friction} role="radiogroup" aria-label="How hard was it to start">
                    {FRICTION.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setFriction(done.sessionId, i + 1);
                          setDone(null);
                        }}
                      >
                        <b>{i + 1}</b>
                        <small>{label}</small>
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.doneLink} onClick={() => setDone(null)}>
                    Skip
                  </button>
                  <button
                    type="button"
                    className={styles.doneLink}
                    onClick={() => {
                      setDone(null);
                      onRecords();
                    }}
                  >
                    See my records
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}

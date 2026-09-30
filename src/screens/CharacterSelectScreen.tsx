// 캐릭터 선택: 스와이프/화살표/썸네일로 고르고 하단 버튼으로 확정
import { AnimatePresence, motion, type PanInfo, type Variants } from 'framer-motion';
import { useState } from 'react';
import { CharacterSprite } from '../components/CharacterSprite';
import { BackIcon } from '../components/Icons';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { screenMotion } from '../lib/motion';
import styles from './CharacterSelectScreen.module.css';

interface Props {
  initialId: CharacterId | null;
  onBack?: () => void; // 첫 실행에는 돌아갈 곳이 없음
  onConfirm: (id: CharacterId) => void;
}

const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 120, opacity: 0, scale: 0.94 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
  exit: (dir: number) => ({ x: dir * -120, opacity: 0, scale: 0.94, transition: { duration: 0.18 } }),
};

export function CharacterSelectScreen({ initialId, onBack, onConfirm }: Props) {
  const [[index, dir], setState] = useState<[number, number]>(() => [
    Math.max(0, CHARACTERS.findIndex((c) => c.id === initialId)),
    0,
  ]);
  const current = CHARACTERS[index];

  const go = (next: number) => {
    const n = (next + CHARACTERS.length) % CHARACTERS.length;
    if (n === index) return;
    setState([n, next > index ? 1 : -1]);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -50 || info.velocity.x < -400) go(index + 1);
    else if (info.offset.x > 50 || info.velocity.x > 400) go(index - 1);
  };

  return (
    <motion.main className={`screen ${styles.select}`} {...screenMotion}>
      <header className={styles.top}>
        {onBack ? (
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to home">
            <BackIcon />
          </button>
        ) : (
          <span className={styles.spacer} />
        )}
        <div className={styles.titles}>
          {/* 첫 실행(돌아갈 곳 없음)이면 앱 소개를 함께 보여줌 */}
          {onBack ? (
            <span className={styles.eyebrow}>Your study buddy</span>
          ) : (
            <>
              <span className={styles.logo}>MOODEE</span>
              <p className={styles.intro}>A cozy world for distracted minds.</p>
            </>
          )}
          <h1>Who's studying today?</h1>
        </div>
        <span className={styles.spacer} />
      </header>

      <section className={styles.stage} aria-roledescription="carousel" aria-label="Characters">
        <div className={styles.halo} aria-hidden />
        <div className={styles.floor} aria-hidden />

        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={current.id}
            className={styles.hero}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={onDragEnd}
          >
            <motion.div
              className={styles.bob}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <CharacterSprite character={current} pose="front" />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => go(index - 1)} aria-label="Previous character">
          <BackIcon />
        </button>
        <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => go(index + 1)} aria-label="Next character">
          <BackIcon style={{ transform: 'scaleX(-1)' }} />
        </button>
      </section>

      <div className={styles.info} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <h2>{current.name}</h2>
            <p>{current.vibe}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className={styles.thumbs} role="tablist" aria-label="Pick a character">
        {CHARACTERS.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={c.name}
              className={`${styles.thumb} ${i === index ? styles.thumbOn : ''}`}
              onClick={() => go(i)}
            >
              <CharacterSprite character={c} pose="front" className={styles.thumbSprite} style={{ height: '240%' }} />
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.dock}>
        <button type="button" className="pill pill-primary" onClick={() => onConfirm(current.id)}>
          Continue as {current.name}
        </button>
      </div>
    </motion.main>
  );
}

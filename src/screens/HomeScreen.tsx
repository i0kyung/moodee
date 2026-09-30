// 홈: 장소 휠을 돌려 갈 곳을 고른다. Classroom만 열려 있고 나머지는 Coming soon
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CharacterSprite } from '../components/CharacterSprite';
import { FlameIcon } from '../components/Icons';
import { PlaceWheel } from '../components/PlaceWheel';
import { getCharacter, type CharacterId } from '../data/characters';
import { PLACES, type Place } from '../data/places';
import { loadValue, save } from '../lib/storage';
import { screenMotion } from '../lib/motion';
import { readStreak } from '../lib/streak';
import styles from './HomeScreen.module.css';

interface Props {
  characterId: CharacterId | null;
  onGo: (place: Place) => void;
  onChangeCharacter: () => void;
}

// 시간대 인사 + 이름 (예: "Good evening, Nier" / "Still up, Nier?")
const greeting = (name: string) => {
  const h = new Date().getHours();
  if (h < 5) return <>Still up, <b>{name}</b>?</>;
  const word = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return <>{word}, <b>{name}</b></>;
};

export function HomeScreen({ characterId, onGo, onChangeCharacter }: Props) {
  const character = getCharacter(characterId);
  const streak = readStreak();
  const [index, setIndex] = useState(() => Math.max(0, PLACES.findIndex((p) => p.id === loadValue('lastPlace', 'classroom'))));
  const [walking, setWalking] = useState(false);
  const [going, setGoing] = useState(false);
  const place = PLACES[index];

  const changeIndex = (i: number) => {
    setIndex(i);
    save('lastPlace', PLACES[i].id);
  };

  const go = () => {
    if (!place.available || going) return;
    setGoing(true);
    window.setTimeout(() => onGo(place), 2000);
  };

  // 휠이 도는 중이거나 출발했을 때 "Going to …"
  const status = going || walking ? `Going to ${place.name}…` : null;

  return (
    <motion.main className={`screen ${styles.home}`} {...screenMotion}>
      <div className={styles.sun} aria-hidden />

      <header className={styles.header}>
        <button type="button" className={styles.hello} onClick={onChangeCharacter} aria-label={`Studying as ${character.name}. Change character`}>
          <span className={styles.avatar} aria-hidden>
            <CharacterSprite character={character} pose="front" className={styles.avatarSprite} style={{ height: '250%' }} />
          </span>
          <span>{greeting(character.name)}</span>
        </button>
        <div className={styles.streak} aria-label={`${streak.count}-day focus streak`}>
          <FlameIcon width={18} height={18} className={streak.count ? styles.flameOn : styles.flameOff} />
          <b>{streak.count}</b>
          <span>day{streak.count === 1 ? '' : 's'}</span>
        </div>
      </header>

      <div className={styles.brand}>
        <h1>MOODIE</h1>
        <p>A cozy world for distracted minds.</p>
      </div>

      <div className={styles.info} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {status ? (
            <motion.p key="going" className={styles.going} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {status}
            </motion.p>
          ) : (
            <motion.div key={place.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <span className={styles.eyebrow}>Where to today?</span>
              <h2>{place.name}</h2>
              <p>{place.available ? place.blurb : 'Still being decorated. Coming soon!'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PlaceWheel places={PLACES} character={character} index={index} onIndexChange={changeIndex} going={going} onWalkingChange={setWalking} />

      <div className={styles.dock}>
        <button type="button" className={`pill ${place.available ? 'pill-primary' : styles.locked}`} onClick={go} disabled={!place.available || going}>
          {place.available ? (going ? 'On my way…' : `Go to ${place.name}`) : 'Coming soon'}
        </button>
        <p className={styles.tip}>Drag the wheel or tap a place</p>
      </div>
    </motion.main>
  );
}

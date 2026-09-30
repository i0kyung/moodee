// 장소 휠: 드래그/탭으로 돌리면 캐릭터가 옆모습으로 걷고, 맨 위에 온 장소가 선택됨
import { animate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Character, Pose } from '../data/characters';
import type { Place } from '../data/places';
import { CharacterSprite } from './CharacterSprite';
import { PlaceIcon } from './PlaceIcon';
import styles from './PlaceWheel.module.css';

interface Props {
  places: Place[];
  character: Character;
  index: number;
  onIndexChange: (i: number) => void;
  going: boolean; // Go를 누른 뒤 이동 연출 중
  onWalkingChange?: (walking: boolean) => void;
}

const DRAG_DEG_PER_PX = 0.4;

export function PlaceWheel({ places, character, index, onIndexChange, going, onWalkingChange }: Props) {
  const n = places.length;
  // 한 칸 간격(도). 양옆 장소가 화면 가장자리에 걸쳐 보이도록 360/n보다 촘촘하게 두고,
  // 위치는 선택 기준으로 앞뒤 절반씩 감싸서(캐러셀) 항상 가운데 주변에 놓는다
  const step = 50;
  const rot = useMotionValue(-index * step);
  const [angle, setAngle] = useState(rot.get());
  const [pose, setPose] = useState<Pose>('front');
  const drag = useRef<{ id: number; x: number; start: number; moved: boolean } | null>(null);
  const idleTimer = useRef<number>(0);

  // 회전 방향에 따라 캐릭터가 걷는 방향(옆모습) 결정: 땅이 오른쪽으로 돌면 왼쪽으로 걷는 셈
  useMotionValueEvent(rot, 'change', (v) => {
    const vel = rot.getVelocity();
    setAngle(v);
    if (Math.abs(vel) > 8) {
      setPose(vel > 0 ? 'side' : 'sideAlt');
      onWalkingChange?.(true);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        setPose('front');
        onWalkingChange?.(false);
      }, 180);
    }
  });

  const selectedFrom = (r: number) => (((Math.round(-r / step) % n) + n) % n);

  const snapTo = (target: number) => {
    animate(rot, target, { type: 'spring', stiffness: 120, damping: 20 });
    onIndexChange(selectedFrom(target));
  };

  // 가장 가까운 방향으로 i번 장소를 맨 위로
  const goToIndex = (i: number) => {
    const cur = rot.get();
    const base = -i * step;
    const cycle = n * step;
    const k = Math.round((cur - base) / cycle);
    snapTo(base + k * cycle);
  };

  // Go: 제자리에서 한 바퀴 걸어가는 연출
  useEffect(() => {
    if (!going) return;
    // 장소들이 한 바퀴 돌아 다시 같은 곳이 맨 위로 오도록 n칸 이동
    const c = animate(rot, rot.get() - n * step, { duration: 1.9, ease: [0.45, 0, 0.25, 1] });
    return () => c.stop();
  }, [going, rot, n]);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  // 방향키로도 돌리기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (going) return;
      if (e.key === 'ArrowLeft') goToIndex((index - 1 + n) % n);
      if (e.key === 'ArrowRight') goToIndex((index + 1) % n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const walking = pose !== 'front';

  return (
    <div
      className={styles.wheelArea}
      onPointerDown={(e) => {
        if (going) return;
        rot.stop();
        drag.current = { id: e.pointerId, x: e.clientX, start: rot.get(), moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 4) d.moved = true;
        rot.set(d.start + dx * DRAG_DEG_PER_PX);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) {
          // 손을 뗀 속도를 반영해 가장 가까운 칸으로 착 붙게
          const projected = rot.get() + rot.getVelocity() * 0.15;
          snapTo(Math.round(projected / step) * step);
        } else {
          // 탭: 눌린 아이콘이 있으면 그 장소로
          const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-place-index]');
          if (el) goToIndex(Number(el.dataset.placeIndex));
        }
      }}
    >
      <div className={styles.disc} aria-hidden />

      {/* 캐릭터: 맨 위 장소 위에서 걷기 */}
      <div className={styles.walker}>
        <span className={styles.shadow} />
        <div className={walking || going ? styles.walking : styles.idle}>
          <CharacterSprite character={character} pose={going ? 'sideAlt' : pose} />
        </div>
      </div>

      <ul className={styles.ring} role="listbox" aria-label="Places" aria-activedescendant={`place-${places[index].id}`}>
        {places.map((p, i) => {
          // 맨 위(0°)로부터의 각도 차이 → 흐림/투명도
          const c = -angle / step; // 지금 맨 위에 있는 (연속) 인덱스
          const off = ((((i - c) % n) + n + n / 2) % n) - n / 2;
          const a = off * step;
          const t = Math.min(1, Math.abs(a) / step);
          // 바로 옆(±1칸)까지만 보이고, 그보다 먼 장소는 휠 아래로 사라지듯 투명하게
          const far = Math.max(0, Math.abs(off) - 1);
          return (
            <li
              key={p.id}
              id={`place-${p.id}`}
              role="option"
              aria-selected={i === index}
              data-place-index={i}
              className={styles.slot}
              style={{
                transform: `rotate(${a}deg) translateY(calc(-1 * var(--orbit)))`,
                opacity: Math.max(0, 1 - 0.4 * t - far * 1.2),
                filter: `blur(${t * 1.6}px) grayscale(${t * 0.35})`,
                zIndex: Math.round(10 - t * 5),
              }}
            >
              <div className={styles.iconWrap} style={{ scale: `${1.12 - t * 0.28}` }}>
                <PlaceIcon place={p} className={styles.icon} />
                {!p.available && t < 0.5 && <span className={styles.soon}>Coming soon</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

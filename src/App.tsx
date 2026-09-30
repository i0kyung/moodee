// 화면 흐름: (첫 실행) Character Select → Home(장소 휠) → Classroom 집중 루틴 / 다른 공간 둘러보기
// 홈에서 Records(주제별 시간)와 Membership(코인·보상)으로 갈 수 있다
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useRef, useState } from 'react';
import { LoadingSplash, pickSplash } from './components/LoadingSplash';
import { type CharacterId } from './data/characters';
import type { Place } from './data/places';
import { loadValue, save } from './lib/storage';
import { HomeScreen } from './screens/HomeScreen';
import { IntroScreen } from './screens/IntroScreen';
import { CafeScreen } from './screens/CafeScreen';
import { CompanionSetupScreen } from './screens/CompanionSetupScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen';
import { ClassroomScreen } from './screens/ClassroomScreen';
import { ShopScreen } from './screens/ShopScreen';
import { MuseumScreen } from './screens/MuseumScreen';
import { RoomScreen } from './screens/RoomScreen';
import { RecordsScreen } from './screens/RecordsScreen';

type Screen = 'intro' | 'home' | 'companions' | 'select' | 'classroom' | 'cafe' | 'library' | 'museum' | 'my-room' | 'records' | 'membership';

const SPLASH_SECONDS = 2.2;

export function App() {
  const [characterId, setCharacterId] = useState<CharacterId | null>(() => loadValue<CharacterId | null>('character', null));
  const [screen, setScreen] = useState<Screen>('intro');
  // 앱을 열면 인트로 → 친구 수 → 캐릭터 고르기 순서로 한 번 지나간다
  const [onboarding, setOnboarding] = useState(true);
  // Membership에서 뒤로 갈 곳(홈 또는 둘러보던 공간)
  const [membershipFrom, setMembershipFrom] = useState<Screen>('home');

  // 로딩 화면: 앱을 열 때와 장소로 이동할 때(그림은 매번 무작위 한 장)
  const [splash, setSplash] = useState<{ image: string; label: string } | null>(null);
  const timers = useRef<number[]>([]);
  const showSplash = (label: string, then?: () => void) => {
    timers.current.forEach(clearTimeout);
    setSplash({ image: pickSplash(), label });
    timers.current = [window.setTimeout(() => then?.(), 500), window.setTimeout(() => setSplash(null), SPLASH_SECONDS * 1000)];
  };
  const chooseCharacter = (id: CharacterId) => {
    setCharacterId(id);
    save('character', id);
    setOnboarding(false);
    setScreen('home');
  };

  const go = (p: Place) => {
    showSplash(`Going to ${p.name}…`, () => {
      if (p.available) setScreen('classroom');
      else setScreen(p.id as Screen);
    });
  };

  const openMembership = (from: Screen) => {
    setMembershipFrom(from);
    setScreen('membership');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="phone">
        {/* 이전 화면이 사라지는 동안 새 화면이 겹쳐 떠오르는 크로스페이드(빈 화면 없음) */}
        <AnimatePresence initial={false}>
          {screen === 'home' && (
            <HomeScreen
              key="home"
              characterId={characterId}
              onGo={go}
              onChangeCharacter={() => setScreen('select')}
              onRecords={() => setScreen('records')}
              onMembership={() => openMembership('home')}
            />
          )}
          {screen === 'companions' && <CompanionSetupScreen key="companions" onBack={onboarding ? undefined : () => setScreen('home')} onDone={() => setScreen(onboarding ? 'select' : 'home')} />}
          {screen === 'intro' && <IntroScreen key="intro" onStart={() => setScreen('companions')} />}
          {screen === 'cafe' && <CafeScreen key="cafe" characterId={characterId} onBack={() => setScreen('home')} onChangeFriends={() => setScreen('companions')} />}
          {screen === 'library' && <LibraryScreen key="library" characterId={characterId} onBack={() => setScreen('home')} onChangeFriends={() => setScreen('companions')} />}
          {screen === 'select' && (
            <CharacterSelectScreen
              key="select"
              initialId={characterId}
              onBack={onboarding ? () => setScreen('companions') : () => setScreen('home')}
              onConfirm={chooseCharacter}
            />
          )}
          {screen === 'classroom' && (
            <ClassroomScreen key="classroom" characterId={characterId} onExit={() => setScreen('home')} onRecords={() => setScreen('records')} />
          )}
          {screen === 'museum' && <MuseumScreen key="museum" characterId={characterId} onBack={() => setScreen('home')} />}
          {screen === 'my-room' && (
            <RoomScreen key="my-room" characterId={characterId} onBack={() => setScreen('home')} onMembership={() => openMembership('my-room')} onChangeCharacter={(id) => (setCharacterId(id), save('character', id))} />
          )}
          {screen === 'records' && <RecordsScreen key="records" onBack={() => setScreen('home')} onStudy={() => setScreen('classroom')} />}
          {screen === 'membership' && <ShopScreen key="membership" onBack={() => setScreen(membershipFrom)} onStudy={() => setScreen('classroom')} />}
        </AnimatePresence>
        <AnimatePresence>{splash && <LoadingSplash key={splash.image} {...splash} duration={SPLASH_SECONDS - 0.3} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}

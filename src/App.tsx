// 화면 흐름: (첫 실행) Character Select → Home(장소 휠) → Classroom
// 홈에서 캐릭터가 걸어가야 하므로 캐릭터를 먼저 고른다. 이후엔 홈의 아바타로 바꿀 수 있음
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { type CharacterId } from './data/characters';
import { type SessionIntent } from './lib/calendar';
import { completeGoogleRedirect } from './lib/googleConnection';
import { loadValue, save } from './lib/storage';
import { HomeScreen } from './screens/HomeScreen';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen';
import { ClassroomScreen } from './screens/ClassroomScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { SessionIntentScreen } from './screens/SessionIntentScreen';

type Screen = 'home' | 'select' | 'calendar' | 'intent' | 'classroom';

export function App() {
  const [characterId, setCharacterId] = useState<CharacterId | null>(() => loadValue<CharacterId | null>('character', null));
  const [screen, setScreen] = useState<Screen>(() => (characterId ? 'home' : 'select'));
  const [intent, setIntent] = useState<SessionIntent | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; eventId?: string }>({ text: '' });
  const [calendarMessage, setCalendarMessage] = useState('');
  const [calendarConnectionRevision, setCalendarConnectionRevision] = useState(0);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has('error')) {
      setCalendarMessage(query.get('error_description')?.slice(0, 200) || 'Google connection was cancelled.');
      query.delete('error'); query.delete('error_description');
      window.history.replaceState({}, '', `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`);
      setScreen('calendar');
      return;
    }
    if (!query.has('code')) return;
    void completeGoogleRedirect().then(() => {
      setCalendarMessage('Google Calendar connected.');
      setCalendarConnectionRevision((revision) => revision + 1);
      setScreen('calendar');
    }).catch((error: unknown) => {
      setCalendarMessage(error instanceof Error ? error.message : 'Could not connect Google Calendar.');
      setScreen('calendar');
    });
  }, []);

  const chooseCharacter = (id: CharacterId) => {
    setCharacterId(id);
    save('character', id);
    setScreen('home');
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
              onGo={() => { setPrefill({ text: '' }); setScreen('intent'); }}
              onCalendar={() => setScreen('calendar')}
              onChangeCharacter={() => setScreen('select')}
            />
          )}
          {screen === 'calendar' && (
            <CalendarScreen key="calendar" initialMessage={calendarMessage} connectionRevision={calendarConnectionRevision} onBack={() => setScreen('home')} onStart={(text, eventId) => { setPrefill({ text, eventId }); setScreen('intent'); }} />
          )}
          {screen === 'intent' && (
            <SessionIntentScreen key="intent" initialText={prefill.text} sourceEventId={prefill.eventId} onBack={() => setScreen(prefill.eventId ? 'calendar' : 'home')} onConfirm={(value) => { setIntent(value); setScreen('classroom'); }} />
          )}
          {screen === 'select' && (
            <CharacterSelectScreen
              key="select"
              initialId={characterId}
              onBack={characterId ? () => setScreen('home') : undefined}
              onConfirm={chooseCharacter}
            />
          )}
          {screen === 'classroom' && (
            <ClassroomScreen key="classroom" characterId={characterId} intent={intent!} onExit={() => { setIntent(null); setScreen('home'); }} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

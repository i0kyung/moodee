import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgendaEvent, PlanInput } from './calendar';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const googleConfigured = Boolean(url && anonKey);

// Supabase's OAuth exchange returns provider tokens in memory. The browser only
// persists the Supabase session; Google tokens are sent once to the Edge Function.
export function safeAuthStorage(storage: Storage): Storage {
  return {
    get length() { return storage.length; },
    clear: () => storage.clear(),
    key: (index) => storage.key(index),
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    setItem(key, value) {
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          delete parsed.provider_token;
          delete parsed.provider_refresh_token;
          storage.setItem(key, JSON.stringify(parsed));
          return;
        }
      } catch { /* Other storage values pass through. */ }
      storage.setItem(key, value);
    },
  };
}

function availableStorage(): Storage {
  try { return window.localStorage; }
  catch {
    const values = new Map<string, string>();
    return {
      get length() { return values.size; },
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => { values.delete(key); },
      setItem: (key, value) => { values.set(key, value); },
    };
  }
}

export const supabase: SupabaseClient | null = googleConfigured
  ? createClient(url, anonKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, storage: safeAuthStorage(availableStorage()), persistSession: true },
  }) : null;

export class CalendarRequestError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

export async function callCalendar<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new CalendarRequestError('Google Calendar needs project configuration.', 'unconfigured');
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new CalendarRequestError('Connect Google Calendar first.', 'reconnect');
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/calendar`, {
      method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    throw new CalendarRequestError('You appear to be offline. Showing the last saved agenda.', 'offline');
  }
  const result = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (!response.ok) throw new CalendarRequestError(result.error || 'Calendar request failed.', response.status >= 500 ? 'offline' : result.code);
  return result as T;
}

export async function beginGoogleConnection() {
  if (!supabase) throw new CalendarRequestError('Google Calendar needs project configuration.', 'unconfigured');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.app.created',
      redirectTo: `${window.location.origin}${window.location.pathname}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw new CalendarRequestError(error.message);
}

export async function completeGoogleRedirect(): Promise<boolean> {
  if (!supabase) return false;
  const address = new URL(window.location.href);
  const code = address.searchParams.get('code');
  if (!code) return false;
  address.searchParams.delete('code');
  window.history.replaceState({}, '', address.pathname + address.search + address.hash);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new CalendarRequestError(error.message, 'reconnect');
  const refresh = data.session?.provider_refresh_token;
  if (!refresh) throw new CalendarRequestError('Google did not grant offline access. Please reconnect and approve Calendar access.', 'reconnect');
  await callCalendar('connect', { providerRefreshToken: refresh });
  return true;
}

export async function currentAccountId(): Promise<string | null> {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  return data.session?.user.id ?? null;
}

export async function connectionStatus(): Promise<{ connected: boolean; email: string | null }> {
  if (!supabase) return { connected: false, email: null };
  const userId = await currentAccountId();
  if (!userId) return { connected: false, email: null };
  return callCalendar('status');
}

export async function listGoogleAgenda(timeMin: string, timeMax: string): Promise<AgendaEvent[]> {
  const data = await callCalendar<{ events: AgendaEvent[] }>('agenda', { timeMin, timeMax });
  return data.events;
}

export async function createGooglePlan(plan: PlanInput & { id: string }): Promise<AgendaEvent> {
  const data = await callCalendar<{ event: AgendaEvent }>('create', { plan });
  return data.event;
}

export async function updateGooglePlan(event: AgendaEvent, plan: PlanInput): Promise<AgendaEvent> {
  const data = await callCalendar<{ event: AgendaEvent }>('update', {
    calendarId: event.calendarId, eventId: event.id, etag: event.etag,
    plan: { id: crypto.randomUUID(), ...plan },
  });
  return data.event;
}

export async function deleteGooglePlan(event: AgendaEvent): Promise<void> {
  await callCalendar('delete', { calendarId: event.calendarId, eventId: event.id, etag: event.etag });
}

export async function disconnectGoogle(): Promise<void> {
  await callCalendar('disconnect');
  await supabase?.auth.signOut();
}

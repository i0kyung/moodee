# PWA and phone reminders

MOODEE installs from its existing HTTPS GitHub Pages URL. No app store is required.

## On a phone

1. **iPhone (iOS 16.4+):** open MOODEE in Safari → Share → Add to Home Screen → Add. Open the new MOODEE icon.
2. **Android:** open in Chrome → Install app / Add to Home Screen, or use MOODEE’s Install button when offered.
3. Open **Home → Install & phone reminders**, or **Calendar → Phone reminders → Manage**.
4. Tap **Enable phone reminders**, then allow notifications.
5. Tap **Send test**. Allow around 15–30 seconds for the scheduler and delivery.

Permission is requested only after a tap. Blocking notifications does not block Classroom.
No Google login or CAPTCHA is needed. Supabase creates an anonymous session for a guest.
Each installed browser/device needs its own permission; an app installation on another phone is separate.

## What is sent

- Upcoming **local** study reminders at the selected reminder time. Off means no push.
- Standard timer completion; Pomodoro focus completion and five-minute break completion.
- Pause/stop/delete replaces the server schedule while online. Resuming or starting a new round creates new deadlines.
- Clicking a notification opens Calendar or Classroom, restoring a saved session and seat.
- Google events continue to use Google Calendar’s popup/email reminders. They are **not mirrored** into MOODEE’s push queue, so edits made in Google while MOODEE is closed do not create stale duplicate reminders.

Only opted-in local plan titles and deadlines/timer context are stored for delivery. Notes, Tutor chats, and unrelated Google events are not uploaded. Private tables are accessed only by the verified backend.
Turning reminders off invalidates the browser subscription and deletes its server jobs. Changing account invalidates the previous browser subscription; enable again for the new identity.

The scheduler polls every 15 seconds, and network, OS battery saving, Focus/Do Not Disturb and push-provider availability can delay or prevent delivery. These are gentle reminders, not exact alarm-clock guarantees. Saving or cancelling reminders requires connectivity. If syncing fails, MOODEE shows a warning; a previously scheduled alert can still arrive until synced. Jobs expire after their useful window and are retried at most three times. Notification tags collapse duplicate delivery.

## Backend setup

For local review use `npm run build` then `npm run preview`. The worker is intentionally disabled in the normal Vite development server. Add the preview origin to `APP_ORIGINS` before testing subscription requests. Phone delivery requires an HTTPS deployment (localhost is an exception only on the computer itself).

The linked project needs **Authentication → Sign In / Providers → Anonymous → Enable anonymous sign-ins**. Leave CAPTCHA disabled per the current product decision. This is the same anonymous authentication used by Tutor.

Generate VAPID keys once, from the repository root:

```powershell
node scripts/setup-push-secrets.mjs YOUR_PROJECT_REF
npx supabase secrets set --env-file .git/moodee-push-setup/secrets.env
npx supabase db push
npx supabase db query --linked --file .git/moodee-push-setup/vault.sql
npx supabase functions deploy push push-dispatch --use-api
```

`APP_ORIGINS` must include your Pages origin and any local testing origin (scheme + hostname + port, without paths). The public VAPID key is returned by `push/status`; no extra GitHub Actions environment variable is required. Private VAPID and scheduler keys stay in Supabase secrets; the scheduler key is also stored encrypted in Vault. Never add them to a `VITE_` variable.

The setup script retains existing local generated keys. Do not rotate VAPID keys after users subscribe unless you plan to re-enable subscriptions on their devices. Securely retain the key pair in Supabase; local setup files are inside `.git`, not tracked. A fresh clone needs an existing key pair for redeployment, not newly generated replacements.

The migration creates service-only subscription/job tables, invoker RPCs, `pg_cron`/`pg_net`, a 15-second job that invokes the dispatcher only when jobs are due, and daily cleanup. Each identity can register five devices; each device holds up to 100 upcoming notifications. Delivered/expired jobs are retained at most seven days for deduplication. Stale device subscriptions expire after 367 days.

## Offline and updates

The app shell and brand icons are precached. Visited image/audio assets are cached with bounded storage. Auth, Google Calendar, OpenAI and other API responses are never cached by the service worker.
An available update is shown in app settings and waits for an explicit tap. Updating is disabled during an active session. The timer persists absolute deadlines and paused state locally, so reopening reconciles elapsed time. Browser storage clearing removes local plans/history and recovery data.

## Verification on a real phone

After enabling, send a test, close MOODEE, and confirm a lock-screen notification. Then create a local plan with an at-start reminder two minutes ahead and close the app. Test a one-minute standard session and a Pomodoro focus/break cycle; tapping its alert should restore Classroom. Pause or end a session online and verify its previous alert does not arrive. Confirm Google Calendar reminders separately in Google’s device settings.

References: [WebKit: Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Vite PWA custom worker](https://vite-pwa-org.netlify.app/guide/inject-manifest).

## Implementation verification — 1 October 2026

- 117 Vitest tests and 29 rule checks passed; TypeScript and production/PWA build passed. The existing large-bundle warning and a Vite PWA plugin deprecation warning remain non-blocking.
- SQL tests ran inside a rolled-back transaction against the linked project: private table/RPC access, stale revision rejection, cancellation, test deduplication, five-job delivery batches, and active leases passed.
- Live `push/status` returned configured; anonymous authentication is enabled; an empty-queue dispatcher smoke test returned HTTP 200. Backend migration, private keys/Vault configuration, and both Edge Functions are deployed. The cron scheduler runs every 15 seconds with no observed execution failures during checks.
- Frontend changes are on `feature/pwa-phone-notifications`; they have not been pushed or merged to `main`, and the production Pages frontend has not been replaced.
- Real phone permission, encrypted push delivery and lock-screen presentation remain device acceptance tests. Follow the steps above after deploying the feature to an HTTPS preview or approving its release.

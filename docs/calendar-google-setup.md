# Kalender MOODEE: setup untuk penguji terbatas

Fitur tamu langsung berjalan tanpa layanan eksternal. Rencana tamu hanya tersimpan di browser perangkat itu dan penanda pengingat hanya tampil saat game terbuka. Agar acara bertahan di Google Calendar dan pengingat popup/email dapat bekerja saat game tertutup, siapkan Google Cloud dan Supabase berikut.

## 1. Google Cloud

1. Buat project Google Cloud khusus MOODEE. Aktifkan **Google Calendar API**.
2. Buka **Google Auth Platform / OAuth consent screen**. Pilih **External**, status **Testing**, isi nama aplikasi dan email kontak, lalu tambahkan alamat Google semua penguji sebagai **Test users**.
3. Tambahkan scope `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.readonly`, dan `https://www.googleapis.com/auth/calendar.app.created`. Scope pertama dipakai untuk login; dua scope Calendar memungkinkan pembacaan agenda dan pengelolaan kalender sekunder yang dibuat aplikasi. Periksa tampilan consent dan batas penguji di Cloud Console.
4. Buat **OAuth Client ID → Web application**. Pada **Authorized redirect URIs**, masukkan `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. Origin aplikasi GitHub Pages **bukan** redirect URI Google; Supabase meneruskan pengguna ke aplikasi setelah login.
5. Simpan Client ID dan Client Secret di tempat aman. Client Secret hanya dimasukkan di dashboard Supabase dan Edge Function, tidak di Vite atau GitHub Pages.

Google dapat membuat refresh token untuk aplikasi External dalam mode Testing kedaluwarsa setelah tujuh hari. UI menyediakan **Reconnect Google** ketika ini terjadi. Untuk rilis publik, tinjau verifikasi OAuth dan kebijakan Google lebih lanjut.

## 2. Supabase

1. Buat project Supabase. Di **Authentication → Providers → Google**, aktifkan provider dan masukkan OAuth Client ID serta Secret dari langkah 1.
2. Di **Authentication → URL Configuration**, isi **Site URL** dengan `https://i0kyung.github.io/moodie/` dan tambahkan redirect URL `https://i0kyung.github.io/moodie/` serta `http://localhost:5173/**` untuk pengembangan lokal. Jika alamat Pages berubah, sesuaikan di sini dan di konfigurasi aplikasi.
3. Jalankan migrasi [`202609300001_google_calendar_connections.sql`](../supabase/migrations/202609300001_google_calendar_connections.sql) melalui Supabase CLI (`supabase db push`) atau SQL Editor. Tabel berisi ID kalender dan refresh token terenkripsi, memiliki RLS aktif tanpa policy klien, dan akses `anon`/`authenticated` dicabut.
4. Buat kunci enkripsi acak 32 byte berbentuk Base64. Contoh lokal: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Simpan nilainya sebagai secret `GOOGLE_TOKEN_ENCRYPTION_KEY`. Jangan mengubahnya setelah akun terhubung tanpa migrasi token, sebab token lama tak dapat didekripsi.
5. Set Edge Function secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, dan `APP_ORIGINS`. Isi `APP_ORIGINS` dengan daftar origin dipisahkan koma, misalnya `https://i0kyung.github.io,http://localhost:5173` (tanpa `/moodie/`). `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` disediakan lingkungan Supabase Functions. Jangan menaruh service role key di frontend.
6. Deploy fungsi [`calendar`](../supabase/functions/calendar/index.ts), misalnya `supabase functions deploy calendar --no-verify-jwt`. Fungsi tetap memvalidasi JWT Supabase sendiri lewat `auth.getUser`, sehingga preflight CORS dapat dilayani. Pastikan `supabase/config.toml` ikut dipakai.

Untuk pengembangan lokal, salin [`.env.example`](../.env.example) menjadi `.env.local` dan isi **hanya** `VITE_SUPABASE_URL` dan publishable/anon key. Jalankan `npm run dev`. Dua nilai ini memang publik; kredensial Google dan service role key tidak boleh menggunakan prefiks `VITE_`.

Untuk build GitHub Pages, tambahkan repository **Variables** `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Workflow build membacanya saat `main` nanti dideploy. Branch fitur ini tidak memicu deployment `main`.

## 3. Uji koneksi langsung setelah konfigurasi

1. Dengan akun yang termasuk Test users, buka aplikasi dan pilih **Calendar → Connect**. Setujui scope Calendar. Setelah kembali, pastikan status menampilkan alamat email yang benar.
2. Buat rencana berpengingat 10 menit. Buka kalender sekunder **MOODEE** di Google Calendar dan pastikan acara, popup, dan email reminder tampil. Pengiriman notifikasi tetap bergantung pada pengaturan Google Calendar dan perangkat.
3. Sunting judul/waktu acara di Google Calendar, lalu tekan **Refresh** di MOODEE. Pastikan perubahan muncul. Hapus acara di Google, Refresh lagi, pastikan hilang. Agenda kalender Google lain harus tampil sebagai baca saja.
4. Buat rencana sebagai tamu, kemudian hubungkan Google dan pilih **Move upcoming plans**. Simulasikan kegagalan jaringan sebagian; hanya rencana yang berhasil dibuat di Google yang boleh dihapus dari browser. Ulangi migrasi dan periksa tidak ada duplikat.
5. Gunakan dua akun penguji berbeda. Pastikan satu akun tidak melihat acara MOODEE atau cache agenda akun lain. Periksa browser Storage: yang tersimpan hanya sesi Supabase, rencana tamu, dan cache agenda; `provider_token` serta `provider_refresh_token` Google tidak boleh muncul. Periksa pula respons `agenda` tidak memuat token.
6. Cabut akses Google atau tunggu token Testing kedaluwarsa, lalu pastikan agenda tersimpan tampil baca saja dan **Reconnect Google** tersedia.

## Perilaku dan batas

- Saat terhubung, daftar agenda dimuat ulang saat layar Calendar dibuka, browser kembali aktif, minggu diganti, atau tombol Refresh ditekan. Cache per pengguna/per minggu hanya dipakai ketika jaringan atau akses gagal; cache tidak dapat disunting.
- MOODEE hanya membuat/mengubah/menghapus acara di kalender sekunder **MOODEE**. Kalender Google lain dibaca saja. Perubahan bersamaan ditolak melalui ETag; aplikasi memuat versi terbaru dan pengguna mengulang suntingan.
- Disconnect mencabut refresh token dan menghapus hubungan akun di Supabase. Kalender dan acara yang sudah ada tetap berada di Google Calendar; bila akun yang sama terhubung lagi, kalender MOODEE yang ada dipakai ulang.
- Token Google melewati browser sementara selama OAuth Supabase, tetapi penyimpanan sesi menyaring `provider_token` dan `provider_refresh_token`. Refresh token kemudian dikirim sekali ke Edge Function, dienkripsi dengan AES-GCM, dan tidak dikembalikan di respons agenda.
- Pengujian otomatis memakai respons Google tiruan. Verifikasi OAuth dan pengingat langsung **belum dapat dilakukan** sampai project Google Cloud dan Supabase penguji tersedia.

Referensi: [scope Google Calendar](https://developers.google.com/workspace/calendar/api/auth), [pengingat acara](https://developers.google.com/workspace/calendar/api/concepts/reminders), [OAuth Google di Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [batas mode Testing](https://support.google.com/cloud/answer/15549945).

# GhostDraft

![GhostDraft](logo.png)

Live draft autosave — ketik apa aja, langsung tersimpan di cloud secara real-time. Tanpa tombol publish, tanpa akun, tanpa ribet. Dibangun dengan vanilla HTML/CSS/JS di atas Firebase Realtime Database.

> **Inspirasi visual:** [Ghostbin oleh kilgarth](https://github.com/kilgarth/ghostbin) — pastebin legendaris yang memulai semuanya. Kami meminjam estetika Inter UI + Envy Code R yang gelap dan menjadikannya autosave-native.

---

## Fitur

| Halaman | URL | Yang terjadi |
|---------|-----|-------------|
| **Editor** | `/` | Buka sesi baru. Kamu ketik. Dia simpan. Udah. |
| **Viewer** | `/d/{id}` | Real-time viewer. Lihat ketikan muncul saat penulis mengetik. |
| **Raw** | `/raw/{id}` | Output `text/plain` murni. Tanpa HTML, tanpa script. |
| **Admin** | `/admin` | Login Firebase Auth. Jelajahi semua draft, hapus massal, lihat detail. |

**Fitur sekilas:**
- Autosave dengan debounce 1 detik (bukan setiap ketukan)
- Sinkronisasi real-time via Firebase `onValue` — viewer update langsung
- Syntax highlighting (highlight.js) — 30+ bahasa, fallback auto-detect
- Penyimpanan Base64 — konten di-encode saat disimpan, di-decode saat ditampilkan
- Tombol QR code — scan dengan HP untuk buka viewer
- Batas 700 KB raw text (~1 MB encoded, diterapkan di frontend + rules)
- Admin hapus massal dengan checkbox
- Tema gelap Ghostbin — Inter UI, Envy Code R, Fontello icons

---

## Deploy Cepat

| Platform | Tombol |
|----------|--------|
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/arilaprilio/ghostdraft) |
| **Heroku** | [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/arilaprilio/ghostdraft) |
| **Railway** | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/arilaprilio/ghostdraft) |
| **Cloudflare Workers** | `npx wrangler deploy` (lihat panduan di bawah) |
| **Render** | Arahkan ke repo ini → Build: `npm install`, Start: `npm start` |

---

## Setup Manual

### Prasyarat
- **Node.js 18+** (hanya untuk menjalankan dev server — tidak ada build step backend)
- **Akun Firebase** (free tier sudah cukup)
- Tempat deploy: Vercel, Heroku, Railway, atau Cloudflare

### 1. Clone & install

```bash
git clone https://github.com/arilaprilio/ghostdraft.git
cd ghostdraft
npm install    # opsional — hanya diperlukan untuk wrangler deploy
```

### 2. Buat project Firebase

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. **Add project** → ikuti wizard (Analytics opsional)
3. Klik ikon **Web** (`</>`) → daftarkan app → beri nama
4. Salin objek `firebaseConfig` — akan dipakai di langkah 5

### 3. Aktifkan Realtime Database

1. Firebase Console → **Build** → **Realtime Database**
2. **Create Database** → pilih lokasi → mulai dalam **test mode**
3. Salin URL database (format: `https://NAMA-PROJECT-default-rtdb.firebaseio.com`)

### 4. Aktifkan Email/Password Auth

1. Firebase Console → **Build** → **Authentication** → **Get started**
2. Tab **Sign-in method** → **Email/Password** → **Enable**
3. Tab **Users** → **Add user** → masukkan email admin + password (ini login admin kamu)

### 5. Atur environment variables

Salin file contoh dan isi dengan nilai dari langkah 2:

```bash
cp .env.example .env
```

Buka `.env` dan ganti setiap nilai `PASTE_YOUR_*`:

```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://my-project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=my-project
FIREBASE_STORAGE_BUCKET=my-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc...
FIREBASE_MEASUREMENT_ID=G-ABC123
```

> `.env` sudah di-gitignore — jangan pernah commit kunci asli. `.env.example` tetap di repo sebagai template.
>
> Untuk platform deploy, atur variabel yang sama di dashboard platform:
> - **Vercel**: Project Settings → Environment Variables
> - **Heroku**: Settings → Config Vars
> - **Railway**: Tab Variables
> - **Render**: Environment → Environment Variables
> - **Cloudflare Workers**: lihat panduan lengkap di bawah (bagian Cloudflare Workers Setup)

### 6. Atur database rules

Buka `database.rules.json`, ganti `YOUR_ADMIN_EMAIL@example.com` dengan email yang kamu pakai di langkah 4.

Lalu buka Firebase Console → **Realtime Database** → tab **Rules** → tempel seluruh isinya → **Publish**.

### 7. Jalankan server

```bash
npm start
# atau: node server.js
```

Buka **http://localhost:3000** — mulai mengetik!

### 8. Akses halaman

| Halaman | URL |
|---------|-----|
| Editor | http://localhost:3000/ |
| Viewer | http://localhost:3000/d/{sessionId} |
| Admin | http://localhost:3000/admin |
| Raw | http://localhost:3000/raw/{sessionId} |

---

## Cloudflare Workers Setup

GhostDraft mendukung dua metode deploy ke Cloudflare Workers: **deploy via CLI (wrangler)** dan **Connect Git (Cloudflare Pages + auto-deploy)**. Pilih sesuai kebutuhan.

### Metode A: Deploy via CLI (`wrangler`)

Cocok untuk: development, private repo, atau kalau kamu deploy manual dari terminal.

**1. Isi konfigurasi Firebase** di `wrangler.jsonc` → `vars` (ganti setiap `""` kosong):

```jsonc
{
  "vars": {
    "FIREBASE_API_KEY": "AIzaSy...",
    "FIREBASE_AUTH_DOMAIN": "my-project.firebaseapp.com",
    "FIREBASE_DATABASE_URL": "https://my-project-default-rtdb.firebaseio.com",
    "FIREBASE_PROJECT_ID": "my-project",
    "FIREBASE_STORAGE_BUCKET": "my-project.firebasestorage.app",
    "FIREBASE_MESSAGING_SENDER_ID": "123456789",
    "FIREBASE_APP_ID": "1:123456789:web:abc...",
    "FIREBASE_MEASUREMENT_ID": "G-ABC123"
  }
}
```

> ⚠️ **Peringatan:** Jangan deploy dengan nilai kosong `""` — akan error `firebaseConfig is not defined` di browser.

**2. Deploy:**

```bash
npm install --save-dev wrangler
npx wrangler deploy
```

> Untuk production, gunakan `npx wrangler secret put FIREBASE_API_KEY` (satu per satu) agar nilai tidak tersimpan di `wrangler.jsonc`. Secret yang di-`put` via CLI terenkripsi dan tidak muncul di file.

---

### Metode B: Connect Git (Cloudflare Pages) — Direkomendasikan

Cocok untuk: repo **public**, auto-deploy tiap push, tidak ingin API key tersimpan di file konfigurasi.

#### Cara kerja

Cloudflare Pages terhubung ke repo GitHub/GitLab kamu. Setiap `git push`, Cloudflare otomatis build dan deploy. Karena `wrangler.jsonc` ikut tercommit di repo, **kamu tidak bisa menyimpan API key di `wrangler.jsonc` kalau repo-mu public**.

#### Langkah-langkah

**1. Hubungkan repo ke Cloudflare Pages**

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages**
2. Pilih **Connect to Git** → pilih GitHub/GitLab → pilih repo ghostdraft
3. Konfigurasi build:
   - **Build command:** (kosongkan — tidak perlu)
   - **Build output directory:** `public`
4. Klik **Save and Deploy**

**2. Biarkan `wrangler.jsonc` dengan nilai kosong** (seperti kondisi awal repo):

```jsonc
"vars": {
  "FIREBASE_API_KEY": "",
  "FIREBASE_AUTH_DOMAIN": "",
  "FIREBASE_DATABASE_URL": "",
  "FIREBASE_PROJECT_ID": "",
  "FIREBASE_STORAGE_BUCKET": "",
  "FIREBASE_MESSAGING_SENDER_ID": "",
  "FIREBASE_APP_ID": "",
  "FIREBASE_MEASUREMENT_ID": ""
}
```

> Nilai kosong aman dicommit ke repo public — tidak ada kunci yang bocor.

**3. Isi variabel di Dashboard Cloudflare**

Buka Dashboard → **Workers & Pages** → pilih project → **Settings** → **Environment Variables**.

Tambah 8 variabel berikut di bagian **Production**:

| Variable | Value |
|----------|-------|
| `FIREBASE_API_KEY` | `AIzaSy...` |
| `FIREBASE_AUTH_DOMAIN` | `my-project.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | `https://my-project-default-rtdb.firebaseio.com` |
| `FIREBASE_PROJECT_ID` | `my-project` |
| `FIREBASE_STORAGE_BUCKET` | `my-project.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `FIREBASE_APP_ID` | `1:123456789:web:abc...` |
| `FIREBASE_MEASUREMENT_ID` | `G-ABC123` |

> 📌 **Penting:** Environment variables di Dashboard **SELALU mengambil alih (override)** nilai `vars` di `wrangler.jsonc`. Jadi meskipun `wrangler.jsonc` kosong, worker tetap membaca nilai dari Dashboard. Ini adalah cara yang benar dan aman untuk repo public.

**4. Redeploy**

Setelah menambah variabel di Dashboard, buka tab **Deployments** → klik **Retry deployment** pada deployment terakhir (atau cukup push commit baru — auto-deploy akan jalan).

**5. Verifikasi**

Buka URL Pages kamu (format: `https://ghostdraft-xxx.pages.dev`). Kalau editor muncul tanpa error di console, berarti variabel sudah terbaca.

---

### Perbandingan Metode Deploy Cloudflare

| Metode | Commit API key di repo? | Cocok untuk Connect Git? | Aman untuk repo public? |
|--------|:---:|:---:|:---:|
| `wrangler.jsonc` vars | Ya | ✅ (auto-deploy) | ❌ (API key bocor) |
| Dashboard Env Vars | Tidak | ✅ | ✅ |
| `wrangler secret put` | Tidak | ❌ (butuh CLI deploy) | ✅ |

> **Rekomendasi final:** Untuk Connect Git + repo public, **kosongkan `wrangler.jsonc` vars** dan **isi semua variabel di Dashboard Environment Variables**. Worker membaca dari binding `env.*` yang sama — tidak perlu ubah kode.

---

## Keamanan

| Masalah | Penanganan |
|---------|------------|
| Session ID bisa ditebak | 16-char random dari `crypto.getRandomValues()` (~10²⁵ kombinasi) |
| Listing tidak sah | Hanya email admin yang bisa membaca node `/drafts` |
| Field injection | `$other: { .validate: false }` — whitelist saja |
| Content bombing | Batas 700 KB raw / 1 MB encoded (frontend + rules) |
| Path traversal | Diblokir di server.js (`..` → 403) |
| Password admin | Tidak pernah di kode — Firebase Auth menangani login |
| Firebase keys | Tidak pernah dicommit — dibaca dari env vars saat runtime |
| Raw endpoint | Server-side Firebase REST proxy — tidak ada API key yang terekspos |

---

## Struktur Project

```
ghostdraft/
├── .env.example           # Template environment variables
├── server.js              # Node.js HTTP server (main entry)
├── worker.js              # Cloudflare Workers entry (alternatif)
├── package.json           # npm scripts
├── vercel.json            # Konfigurasi deploy Vercel
├── wrangler.jsonc         # Konfigurasi Cloudflare Workers
├── .assetsignore          # Mengecualikan file sensitif dari static serving
├── database.rules.json    # Aturan keamanan Firebase RTDB
├── README.md              # Kamu sedang membaca ini
└── public/                # Semua aset statis
    ├── index.html         # Halaman editor
    ├── viewer.html        # Halaman viewer
    ├── admin.html         # Dashboard admin
    ├── raw.html           # Halaman raw content
    └── assets/
        ├── ghostdraft.js          # Utilitas encode/decode Base64
        ├── style.css              # Semua stylesheet
        ├── editor.js              # Logika editor + autosave
        ├── viewer.js              # Logika viewer + highlighting
        └── admin.js               # Logika admin + hapus massal
```

---

## Kredit Tema

Identitas visual GhostDraft terinspirasi dari **[Ghostbin](https://github.com/kilgarth/ghostbin)** — pastebin gelap nan bersih yang mendefinisikan genre. Kami memakai font yang sama:

- **Inter UI** — teks body (Rasmus Andersson)
- **Envy Code R** — kode monospace (Damien Guard)
- **Fontello** — set ikon (subset khusus)

Syntax highlighting via **[highlight.js](https://highlightjs.org/)** dengan tema Monokai Sublime.

---

## Lisensi

MIT — lakukan apa pun yang kamu mau. PR dipersilakan.

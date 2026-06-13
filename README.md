# GhostDraft

![GhostDraft](logo.png)

Live draft autosave — type anything, it saves to the cloud in real time. No publish button, no accounts, no friction. Built with vanilla HTML/CSS/JS on top of Firebase Realtime Database.

> **Visual inspiration:** [Ghostbin by kilgarth](https://github.com/kilgarth/ghostbin) — the original pastebin that started it all. We borrowed the dark Inter UI + Envy Code R aesthetic and made it autosave-native.

---

## What it does

| Page | URL | What happens |
|------|-----|-------------|
| **Editor** | `/` | Opens a new session. You type. It saves. That's it. |
| **Viewer** | `/d/{id}` | Real-time viewer. See keystrokes appear as the author types. |
| **Raw** | `/raw/{id}` | Pure `text/plain` output. No HTML, no scripts. |
| **Admin** | `/admin` | Firebase Auth login. Browse all drafts, mass-delete, view details. |

**Features at a glance:**
- Autosave with 1-second debounce (not every keypress)
- Real-time sync via Firebase `onValue` — viewer updates live
- Syntax highlighting (highlight.js) — 30+ languages, auto-detect fallback
- Base64 storage — content encoded at rest, decoded on display
- QR code button — scan with phone to open viewer
- 700 KB raw text limit (~1 MB encoded, enforced in frontend + rules)
- Admin mass-delete with checkboxes
- Dark Ghostbin theme — Inter UI, Envy Code R, Fontello icons

---

## Quick Deploy

| Platform | Button |
|----------|--------|
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/arilaprilio/ghostdraft) |
| **Heroku** | [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/arilaprilio/ghostdraft) |
| **Railway** | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/arilaprilio/ghostdraft) |
| **Cloudflare Workers** | `npx wrangler deploy` (see below) |
| **Render** | Point to this repo → Build: `npm install`, Start: `npm start` |



---

## Manual Setup

### Prerequisites
- **Node.js 18+** (just for running the dev server — no backend build step)
- **Firebase account** (free tier is plenty)
- A place to deploy: Vercel, Heroku, Railway, or Cloudflare

### 1. Clone & install

```bash
git clone https://github.com/arilaprilio/ghostdraft.git
cd ghostdraft
npm install    # optional — only needed for wrangler deploy
```

### 2. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. **Add project** → follow the wizard (Analytics optional)
3. Click the **Web** icon (`</>`) → register app → give it a name
4. Copy the `firebaseConfig` object — you'll need it in step 5

### 3. Enable Realtime Database

1. Firebase Console → **Build** → **Realtime Database**
2. **Create Database** → pick a location → start in **test mode**
3. Copy the database URL (looks like `https://YOUR-PROJECT-default-rtdb.firebaseio.com`)

### 4. Enable Email/Password Auth

1. Firebase Console → **Build** → **Authentication** → **Get started**
2. **Sign-in method** tab → **Email/Password** → **Enable**
3. **Users** tab → **Add user** → enter admin email + password (this is your admin login)

### 5. Set environment variables

Copy the example file and fill in your values from step 2:

```bash
cp .env.example .env
```

Open `.env` and replace every `PASTE_YOUR_*` value:

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

> `.env` is gitignored — never commit real keys. `.env.example` stays in the repo as a template.
>
> For deployment platforms, set these same vars in the platform dashboard:
> - **Vercel**: Project Settings → Environment Variables
> - **Heroku**: Settings → Config Vars
> - **Railway**: Variables tab
> - **Render**: Environment → Environment Variables
> - **Cloudflare Workers**: `wrangler.jsonc` → `vars` section, or `npx wrangler secret put`

### 6. Set up database rules

Open `database.rules.json`, replace `YOUR_ADMIN_EMAIL@example.com` with the email you used in step 4.

Then go to Firebase Console → **Realtime Database** → **Rules** tab → paste the entire content → **Publish**.

### 7. Start the server

```bash
npm start
# or: node server.js
```

Open **http://localhost:3000** — start typing!

### 8. Access pages

| Page | URL |
|------|-----|
| Editor | http://localhost:3000/ |
| Viewer | http://localhost:3000/d/{sessionId} |
| Admin | http://localhost:3000/admin |
| Raw | http://localhost:3000/raw/{sessionId} |

---

## Cloudflare Workers Setup

1. **Fill in Firebase config** in `wrangler.jsonc` → `vars` (replace every empty `""`):
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

> **Penting:** Jangan deploy dengan nilai kosong `""` — akan error `firebaseConfig is not defined` di browser.

2. **Deploy:**
```bash
npm install --save-dev wrangler
npx wrangler deploy
```

> Untuk production, gunakan `npx wrangler secret put FIREBASE_API_KEY` (satu per satu) agar nilai tidak tersimpan di `wrangler.jsonc`.

---

## Security

| Concern | How it's handled |
|---------|-----------------|
| Session ID guessing | 16-char random from `crypto.getRandomValues()` (~10²⁵ combos) |
| Unauthorized listing | Only admin email can read `/drafts` node |
| Field injection | `$other: { .validate: false }` — whitelist only |
| Content bombing | 700 KB raw / 1 MB encoded limit (frontend + rules) |
| Path traversal | Blocked in server.js (`..` → 403) |
| Admin password | Never in code — Firebase Auth handles login |
| Firebase keys | Never committed — read from env vars at runtime |
| Raw endpoint | Server-side Firebase REST proxy — no API keys exposed |

---

## Project Structure

```
ghostdraft/
├── .env.example           # Template for environment variables
├── server.js              # Node.js HTTP server (main entry)
├── worker.js              # Cloudflare Workers entry (alternative)
├── package.json           # npm scripts
├── vercel.json            # Vercel deployment config
├── wrangler.jsonc         # Cloudflare Workers config
├── .assetsignore          # Exclude sensitive files from static serving
├── database.rules.json    # Firebase RTDB security rules
├── README.md              # You're reading it
└── public/                # All static assets
    ├── index.html         # Editor page
    ├── viewer.html        # Viewer page
    ├── admin.html         # Admin dashboard
    ├── raw.html           # Raw content page
    └── assets/
        ├── ghostdraft.js          # Base64 encode/decode utilities
        ├── style.css              # All styles
        ├── editor.js              # Editor logic + autosave
        ├── viewer.js              # Viewer logic + highlighting
        └── admin.js               # Admin logic + mass delete
```

---

## Theme Credits

GhostDraft's visual identity is heavily inspired by **[Ghostbin](https://github.com/kilgarth/ghostbin)** — the clean, dark pastebin that defined the genre. We use the same fonts:

- **Inter UI** — body text (Rasmus Andersson)
- **Envy Code R** — monospace code (Damien Guard)
- **Fontello** — icon set (custom subset)

Syntax highlighting via **[highlight.js](https://highlightjs.org/)** with the Monokai Sublime theme.

---

## License

MIT — do whatever you want. PRs welcome.

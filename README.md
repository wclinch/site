# Site

A minimal, local-first research workspace. Load PDFs, images, and web pages on
the left; view them in the center; write a draft on the right — all in one
window. Everything stays on your machine.

## Run in the browser

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. No backend required.

## Run as a desktop app (Electron)

```bash
# Dev: hot-reload Next + Electron window
npm run electron:dev

# Pack an unsigned app bundle into ./release (fast — for local testing)
npm run electron:pack

# Build a distributable installer for your current platform
npm run electron:build

# Or target a specific platform
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

The desktop build produces a static export under `out/` and bundles it inside
Electron. The window opens directly to the workspace (the marketing landing,
about, and privacy pages are part of the web build only).

Output installers land in `./release/`.

## Limits

Single-user, local-only. Data lives on your machine:

- **Storage** — up to **250 MB** of files in IndexedDB
- **Projects** — up to **3** named projects (plus a floating-sources inbox)
- **No cloud sync, no account, no server calls**

## Tech

Next.js · React · TypeScript · IndexedDB · `react-pdf` · Electron

## Repo layout

- `app/` — Next.js routes (`/` landing, `/app` workspace, `/about`, `/privacy`)
- `components/` — UI panels (`SourcePanel`, `ReaderPanel`, `DraftPanel`, …)
- `context/AppContext.tsx` — single source of truth for projects, sources, drafts
- `lib/idb.ts` — IndexedDB read/write for files and extracted content
- `lib/storage.ts` — localStorage for project structure
- `lib/storage-limit.ts` — 250 MB cap check
- `electron/main.cjs` — desktop main process; serves the static export via a
  custom `site://` protocol and opens the workspace window

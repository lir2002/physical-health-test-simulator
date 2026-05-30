# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chinese-language exam-prep web app for the 2026 Shenzhen "体育与健康" (Physical Education & Health) middle-school theory test. It offers a study mode (per-year question banks), a timed 30-minute mock-exam mode, voice readout of explanations, and per-user history/trend charts. It ships both as a web app (Vite) and an Android APK (Capacitor).

## Repository layout

The repo has two distinct halves:

- **Root** — the **data pipeline**. `parse.js` (a CommonJS Node script) reads the human-authored markdown question sources `Questions-2025.md` and `Questions-predict-2026.md` and generates structured JSON and JS modules, automatically writing them to the root, `app/src/data/`, and `wechat-miniprogram/data/` directories to keep both platforms in sync.
- **`app/`** — the **Vite + React 19 + Capacitor application**. All run/build/lint commands must be run from inside `app/`.
- **`wechat-miniprogram/`** — the **WeChat Mini Program** codebase. Runs directly inside WeChat Developer Tools.

## Commands

Data regeneration (from repo root):
```
node parse.js            # parses the .md sources, validates, and automatically writes/syncs JSON to app/ and JS modules to wechat-miniprogram/
```

App development (from `app/`):
```
npm install
npm run dev              # Vite dev server with HMR
npm run build            # production build to app/dist (iife, es2015 target)
npm run lint             # ESLint (flat config, eslint.config.js)
npm run preview          # serve the built bundle
```

Android APK (from `app/`, after `npm run build`):
```
npx cap sync android                       # copy dist + plugins into the Android project
cd android && ./gradlew assembleDebug      # APK at android/app/build/outputs/apk/debug/
```

There is **no test runner** configured. The only test files are Capacitor's stock Java examples under `app/android/.../test/`; they are not part of any workflow.

## Architecture

### Single-file React app
Essentially the entire UI and all state live in `app/src/App.jsx` (~2000 lines). There is no router and no component library. "Pages" are a `view` string in state (`dashboard`, `study-setup`, `study`, `exam-setup`, `exam`, `report-detail`, `history`), conditionally rendered. The `view` state is mirrored to `window.location.hash` (and vice versa) so the Android hardware back button works — see the `hashchange` effect and `applyingHistoryNavigationRef`. Styling is global CSS (`App.css`, `index.css`) plus heavy inline styles; theme is driven by CSS custom properties (`--color-primary`, etc.).

### Question data model
Each question object: `{ id, type, year, title, stem, options[], answer, explanation }`.
- `type` is `'tf'` (true/false) or `'mc'` (single-choice).
- For `tf`, `answer` is the string `'T'` or `'F'`.
- For `mc`, `options` is an ordered array of choice strings and `answer` is a **letter** `'A'`–`'D'`. The UI derives the letter from the option's array index (`['A','B','C','D'][idx]`) — there is no letter stored on each option, so option order in the JSON is significant.

### Modes
- **Study**: a single year's pool (2025 real questions or 2026 predicted), Fisher-Yates shuffled, answered one at a time with immediate feedback. Correct answers auto-advance after 3s; wrong answers reveal the explanation (and trigger voice readout). Sessions are **resumable per year**, persisted to localStorage.
- **Exam**: samples 10 `tf` + 15 `mc` (optionally mixing in 2026 questions), 30-minute countdown with auto-submit at zero, 4 points/question = 100 max. Free navigation between questions before submit; full review afterward.
- Both produce a **report** appended to `history`, which powers the dashboard stats, the SVG trend chart (`renderTrendChart`), and the searchable history list.

### Persistence (localStorage)
Keys: `simulator_history`, `saved_study_session_2025`, `saved_study_session_2026`, `voice_enabled`. All reads/writes go through the `readStorageValue` / `writeStorageValue` / `readStorageJson` helpers, which swallow quota/parse errors and discard corrupt JSON.

### Dual text-to-speech
Voice readout has two backends selected by `isNativeAndroid`:
- **Web**: `window.speechSynthesis`. Voice selection prefers Chinese voices in order Yunxi → Kangkang → any male → first `zh-*`.
- **Native Android**: a custom Capacitor plugin `NativeSpeech` (registered via `registerPlugin('NativeSpeech')`), implemented in `app/android/app/src/main/java/com/physicalhealth/testsim/NativeSpeechPlugin.java`. It wraps Android `TextToSpeech`, exposes `speak`/`stop`/`isAvailable`/`openSettings`, and the JS layer prompts the user to install/enable a TTS engine when unavailable.

### Android / Capacitor specifics
- `MainActivity.java` registers `NativeSpeechPlugin` and overrides `onBackPressed` to navigate WebView history (paired with the hash-based routing above).
- `vite.config.js` contains a custom `androidCompatPlugin` and a non-default Rollup config (`format: 'iife'`, `inlineDynamicImports`, `target: 'es2015'`, stripped `type="module"`/`crossorigin`, `<script defer>`). This exists specifically to keep the single bundle runnable inside older Android WebViews — do not "modernize" it back to ES modules without understanding the WebView constraint.
- `webDir` is `dist`, so always `npm run build` before `npx cap sync`.

## Conventions

- UI strings, comments in the question data, and user-facing copy are **Chinese**; keep new user-facing text consistent.
- When changing question content, edit the markdown sources and re-run the pipeline rather than hand-editing JSON — but remember the manual copy step into `app/src/data/`.

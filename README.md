# Ledger — Offline-First Finance Tracker

A personal finance tracker built with React, Tailwind CSS, and Firebase.
Works fully offline after the first login: add transactions, transfer
between accounts, and browse your history with no connection — everything
syncs automatically once you're back online.

## Stack

- **Vite + React 19** — build tooling and UI
- **Tailwind CSS v4** — styling (ledger/paper aesthetic — see `src/index.css`)
- **Firebase Auth** — email/password + Google sign-in
- **Firestore** — database, with offline persistence turned on
- **Recharts** — dashboard and report charts
- **Vitest** — unit tests for money math, dates, and balance logic
- **vite-plugin-pwa** — service worker so the app shell itself loads offline

## 1. Set up Firebase

You'll want **three separate Firebase projects** — dev, staging, prod —
so local development never touches real data:

1. Go to console.firebase.google.com and create a project for each environment (e.g. `ledger-dev`, `ledger-staging`, `ledger-prod`).
2. In each project:
   - **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
   - **Firestore Database** → Create database (start in production mode — our rules handle access control).
3. **Project settings → General → Your apps → Add app (Web)** to get your config keys.

Copy `.env.example` to `.env.development`, `.env.staging`, and
`.env.production`, and fill in each with the matching project's config:

```bash
cp .env.example .env.development
```

## 2. Install and run locally

```bash
npm install
npm run dev
```

Vite automatically loads `.env.development` in dev mode.

## 3. Run tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

44 unit tests cover the pure logic: money formatting (integer cents, no
floating-point drift), local-date grouping, derived account balances,
transfer math, and budget status.

### Firestore security rules tests

The rules test (`firestore.rules.test.js`) needs the **Firebase Emulator
Suite**, which requires downloading from Google's servers — it wasn't run
as part of this build. Run it yourself before deploying real rules:

```bash
npm install -g firebase-tools
npm install -D @firebase/rules-unit-testing
firebase login
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.js"
```

It asserts: a user can read/write their own data, cannot read another
user's data, and malformed documents (negative amounts, float amounts,
invalid types) are rejected.

## 4. Deploy Firestore rules and indexes

**Do this before you ever point the app at a real project with real
users** — untested rules are one of the most common ways apps leak data.

```bash
firebase use ledger-prod   # or --add to link the project first
firebase deploy --only firestore:rules,firestore:indexes
```

## 5. Deploy hosting

```bash
npm run build
firebase deploy --only hosting
```

## 6. CI/CD

`.github/workflows/ci.yml` runs tests and a production build on every
push/PR. `.github/workflows/deploy.yml` deploys rules, indexes, and
hosting together on merge to `main`, so a rules change and the code that
depends on it always ship in lockstep.

You'll need to add these repo secrets (Settings → Secrets and variables →
Actions): the six `VITE_FIREBASE_*` values for CI, the `PROD_VITE_FIREBASE_*`
equivalents for deploy, and a `FIREBASE_TOKEN` (generate with
`firebase login:ci`).

## Architecture notes

- **Amounts are integer cents**, never floats — `src/lib/money.js` is the
  only place that multiplies/divides for display. This avoids the classic
  `0.1 + 0.2 !== 0.3` drift over thousands of transactions.
- **Balances are never stored** — they're derived on the fly from
  transaction history (`src/lib/ledger.js`). This is what makes the whole
  app offline-safe: no atomic read-then-write (`runTransaction`) is
  needed anywhere, since those require a live connection.
- **Transfers are two linked transaction docs** (`transfer_out` /
  `transfer_in`, sharing a `transferId`), written together with a
  `writeBatch` (which queues safely offline). This keeps transfers out of
  income/expense totals since moving your own money isn't income or
  spending.
- **Every transaction stores a `localDate` string** ("YYYY-MM-DD")
  computed on the user's device, separate from the server timestamp. All
  month/day grouping reads this field — never derives the month from a
  UTC timestamp, which would misgroup late-night transactions for anyone
  outside UTC.
- **Deleting an account or category is blocked if it's referenced** by
  existing transactions — archive instead. Nothing with financial history
  silently disappears.
- **Deletes get an undo toast** (5 seconds, re-creates the doc from
  memory) since Firestore has no built-in trash.
- **"Delete my account"** actually deletes all Firestore data and the
  Auth record — not just a disabled login.

## Known limitations / things to test yourself

- **True offline behavior needs a real phone test.** Load the app once
  online, turn on airplane mode, close and reopen it, and confirm it
  opens with your data visible. Desktop DevTools' offline simulator
  doesn't catch everything — iOS Safari in particular has more aggressive
  storage eviction than desktop Chrome.
- **First-ever sign-in requires internet.** After that, the session stays
  cached and works offline.
- **Firestore composite indexes** are pre-declared in
  `firestore.indexes.json` — if you add a new query pattern later, you'll
  need to add a matching index entry or the query will fail at runtime
  with a link to auto-create it.
- **Free tier (Spark plan)** has finite daily reads/writes — fine for
  personal use, worth knowing before heavier traffic.
- **No automatic backups** on the free tier — use the Export CSV/JSON
  button in Settings periodically, or set up scheduled exports (a Blaze-
  plan feature) if this grows beyond personal use.
- **Multi-device conflicts** resolve last-write-wins per field if you
  edit the very same transaction from two offline devices before either
  syncs — a low-risk edge case for single-user private data.

## Project structure

```
src/
  lib/          pure logic: money.js, dates.js, ledger.js, firebase.js, exportData.js
  services/     Firestore CRUD: accounts, transactions, transfers, budgets, deleteAccount
  contexts/     AuthContext
  hooks/        useOnlineStatus, useLedgerData
  components/   AppLayout, ProtectedRoute, OfflineBanner, TransactionForm
  pages/        Login, Signup, Dashboard, Transactions, Accounts, Budgets, Reports, Settings
firestore.rules
firestore.indexes.json
firebase.json
```

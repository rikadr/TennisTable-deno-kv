# Tennis Table — Frontend

The React frontend for Tennis Table, an office table-tennis leaderboard with
Elo ratings, achievements, tournaments, seasons, and live game tracking.

The app is a **thick client**: it downloads the full event history from the
backend and projects it into application state locally (the `TennisTable`
class in `src/client/client-db/`). The backend is a thin event store — all
business logic lives here in the frontend.

## Getting started

Requires Node 24 (see `engines` in `package.json`).

```bash
npm install
cp .env.example .env   # defaults point at a local backend on :8000
npm start
```

Start the backend from `../DenoServer` with `deno task dev` (see its README),
or point `REACT_APP_API_BASE_URL` at a deployed backend.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `REACT_APP_API_BASE_URL` | Backend base URL (local dev: `http://localhost:8000`) |
| `REACT_APP_CLIENT` | Client/tenant config: `local`, `optio`, `skimore`, `asplanviak`, `deepinsight`, or unset for the guest client |
| `REACT_APP_ENV` | `local` enables local-only admin controls |
| `REACT_APP_IMAGE_KIT_PUBLIC_KEY` | ImageKit public key for profile picture uploads |

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Dev server |
| `npm run build` | Production build |
| `npm test` | Run the Jest suite once |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |
| `npm run lint` | ESLint over `src/` |

## Project layout

- `src/client/client-db/` — all domain logic: event projection, Elo,
  leaderboard, achievements, tournaments, seasons, predictions. Tested in
  `src/client/client-db/__tests__/`.
- `src/client/client-config/` — per-tenant client configs and themes.
- `src/client/changelog/` — the changelog posts shown at `/changelog`.
- `src/pages/` — page components, routed in `src/App.tsx`.
- `src/common/` — shared UI helpers and utilities.
- `src/wrappers/` — providers (event DB, theming, nav).

## Conventions

See `AGENTS.md` for the full guidelines. The short version:

- **Mobile-first is critical** — the app is used at the tennis table on
  phones and tablets.
- Use the theme classes (`bg-primary-background`, `text-primary-text`, …)
  instead of hardcoded Tailwind colors, so client themes keep working.
- Never use the `any` type in application code.
- Table components follow the rules in `TABLES.md`.

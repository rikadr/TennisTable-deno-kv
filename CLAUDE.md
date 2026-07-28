# Claude Code Project Guidelines

## Project Overview
This repository contains the **Tennis Table** application.
- **Frontend:** React (Thick Client)
- **Backend:** Deno (Thin Server)

## Commands

### Frontend (`/frontend`)
- **Build:** `npm run build`
- **Test:** `npm run test` (Runs Jest)
- **Lint:** `npm run lint`
- **Install:** `npm install`

### Backend (`/DenoServer`)
- **Run Dev:** `deno task dev`
- **Check Types:** `deno task check`
- **Format:** `deno fmt`

## Architecture Highlights
- **Event Sourcing:** The frontend projects events into state (`TennisTable` class).
- **Backend:** Stateless event store + Auth.
- **Do not** add business logic to the backend.

## Code Style
- **Never use `any` type** in application code. Always use proper types. In test files, `any` is acceptable in rare cases where typing is impractical.

## Changelog
Posts live in `frontend/src/client/changelog/changelog-posts.ts`. Add one when a
change clears the bar; skip it when it does not, rather than padding the list.

**Add a post when the change is either:**
- Something players can see or try - a new feature, a meaningful update to one, a
  removed feature, or a bug fix that affected their scores or history.
- A significant change under the hood. The audience is mostly engineers, so
  architecture, performance and data-model work is worth reading about even when
  it changes nothing for a player.

**Skip it for:** small UI tweaks, admin-only changes (the bar is higher, since
most readers never see those screens), internal plumbing, config and cron
changes, dependency bumps, and refactors with no visible or architectural
consequence.

**Writing a post:**
- **Lead with what is new.** The reader is here for what it changed *to*.
  Describe the previous behaviour only where it makes the new thing land, and put
  it after, not first.
- **Plain, descriptive titles.** "Live win% predictions on tracked games", not
  "Live odds on the wall-mounted TV". For a batch of achievements, "4 new
  achievements" beats anything clever.
- Be concise, and say why the change was made where the reasoning is interesting.
  Trade-offs and reverted decisions are worth stating honestly.
- **No commit hashes or commit messages** - they are noise for this reader.
- Tag with one or two of: `new-feature`, `feature-update`, `removed-feature`,
  `bug-fix`, `technical`.
- Body blocks are `text` and `list` only. Backticks render as inline code.
- Slugs are permalinks - do not change one once it has shipped.
- It is a static content list and needs no tests.

The page is at `/changelog` and is intentionally **not** in the nav menu yet -
reachable by direct url only until the navigation structure is reworked.

## Context Files
- Root Instructions: `./GEMINI.md`
- Frontend Details: `./frontend/AGENTS.md`
- Backend Details: `./DenoServer/AGENTS.md`

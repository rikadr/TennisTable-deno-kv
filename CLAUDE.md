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

## Context Files
- Root Instructions: `./GEMINI.md`
- Frontend Details: `./frontend/AGENTS.md`
- Backend Details: `./DenoServer/AGENTS.md`

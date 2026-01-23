# Root Agent Guidelines

## Project Overview
This repository hosts the **Tennis Table** application, a system for tracking office table tennis matches.

## Architecture
The system follows a strict **Event Sourcing** architecture with a clear separation of concerns:
- **Thin Server (Backend):** Responsible only for authentication, event storage (append-only log), and real-time broadcasting.
- **Thick Client (Frontend):** Responsible for all business logic, statistics, and state calculation. The client downloads the full event log and projects it locally to derive the application state (leaderboards, Elo ratings, game history).

## Directory Structure
- `/frontend`: The React application. Contains all business logic and UI.
- `/DenoServer`: The Deno backend. Handles API, WebSockets, and DB (Deno KV).

## General Philosophies
1.  **Event Driven:** The state is a derivative of events. To change state, you emit an event.
2.  **Client-Side Logic:** Heavy calculations belong in the frontend (often using Web Workers). The backend should remain lightweight.
3.  **Type Safety:** Both ends use TypeScript. Ensure types are kept in sync or shared where possible.

## Sub-Agents
For specific instructions, refer to the agent guides in each directory:
- **Frontend Work:** [frontend/AGENTS.md](./frontend/AGENTS.md)
- **Backend Work:** [DenoServer/AGENTS.md](./DenoServer/AGENTS.md)

(Note: This file is `GEMINI.md`, serving as the primary context for the Gemini CLI).

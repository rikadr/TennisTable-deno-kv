# Backend Agent Guidelines (DenoServer)

## Core Philosophy
The backend is the "Vault". It is a **Thin Server** designed to be simple, fast, and stateless regarding business rules. It does **not** calculate match winners, Elo ratings, or statistics.

## Responsibilities
1.  **Event Storage:** Appends events to the database (Deno KV).
2.  **Authentication:** Handles user login and session security.
3.  **Broadcasting:** Pushes new events to connected clients via WebSockets.
4.  **Image Handling:** Proxies/manages image uploads (ImageKit).

## Architecture
- **Runtime:** Deno.
- **Framework:** Oak (Middleware framework).
- **Database:** Deno KV (Key-Value store).
- **Routes:** Organized in folders (e.g., `user/`, `event-store/`, `web-socket/`).

## Workflows

### 1. Running the Server
- **Command:** `deno task dev`
- **Flags:** Note the usage of `--unstable-kv` and `--unstable-cron`.

### 2. Type Checking
- **Command:** `deno task check`
- Ensure no type errors are introduced.

### 3. Modifying the API
- **Routes:** Add new routes in the relevant subfolder (e.g., `user/user.routes.ts`) and register them in `server.ts`.
- **Events:** If adding new event types that the server needs to validate (rare), check `event-store/`. Generally, the server treats events as opaque payloads to store and broadcast.

## Tech Stack
- **Deno** (TypeScript).
- **Oak** (HTTP Server).
- **Deno KV** (Persistence).

## Key Files
- `server.ts`: Entry point and middleware setup.
- `deno.json`: Task and import definitions.
- `event-store/event-store.ts`: Logic for persisting events.

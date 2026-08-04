# Backend Agent Guidelines (DenoServer)

## Core Philosophy
The backend is the "Vault". It is a **Thin Server** designed to be simple, fast, and stateless regarding business rules. It does **not** calculate match winners, Elo ratings, or statistics.

## Responsibilities
1.  **Event Storage:** Appends events to the database (SQL).
2.  **Authentication:** Handles user login and session security.
3.  **Broadcasting:** Pushes new events to connected clients via WebSockets.
4.  **Image Handling:** Proxies/manages image uploads (ImageKit).

## Architecture
- **Runtime:** Deno.
- **Framework:** Oak (Middleware framework).
- **Database:** SQL behind the `Database` interface in `db/database.ts`. Supabase
  Postgres in deployed environments, SQLite (`./data/local.db`) locally.
- **Routes:** Organized in folders (e.g., `user/`, `event-store/`, `web-socket/`).

## Database
- **Interface:** `db/database.ts` defines every operation the server can perform.
  `db.ts` picks the implementation: Supabase when `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` are set, otherwise local SQLite. On Deno Deploy the
  Supabase variables are required and the server refuses to start without them.
- **Implementations:** `db/supabase.ts` and `db/sqlite.ts`. Add a method to both
  when you extend the interface.
- **Schema:** `db/schema.sql`. Tables: `events`, `users`, `live_game`,
  `key_value`.
- **Multi-tenancy:** One database serves every deployment. Every table has a
  `client_id` column from the `CLIENT` env var, and every query filters on it.
  A query without that filter reads another office's data.

## Workflows

### 1. Running the Server
- **Command:** `deno task dev`
- **Flags:** Note the usage of `--unstable-cron` and
  `--unstable-broadcast-channel`.
- **Database:** Uses local SQLite unless the Supabase env vars are set.

### 2. Type Checking
- **Command:** `deno task check`
- Ensure no type errors are introduced.

### 3. Modifying the API
- **Routes:** Add new routes in the relevant subfolder (e.g., `user/user.routes.ts`) and register them in `server.ts`.
- **Events:** If adding new event types that the server needs to validate (rare), check `event-store/`. Generally, the server treats events as opaque payloads to store and broadcast.

## Tech Stack
- **Deno** (TypeScript).
- **Oak** (HTTP Server).
- **Supabase Postgres** (Persistence), **SQLite** locally.

## Key Files
- `server.ts`: Entry point and middleware setup.
- `deno.json`: Task and import definitions.
- `event-store/event-store.ts`: Logic for persisting events.
- `db.ts`: Chooses the database implementation.
- `db/database.ts`: The database interface both implementations satisfy.
- `db/schema.sql`: The Postgres schema.
- `web-socket/web-socket-client-manager.ts`: Connected clients and broadcasts.

## Broadcasting
The connected WebSocket clients live in the memory of one server instance, and
the deployment runs several. A broadcast therefore goes out over a
`BroadcastChannel` first, so every instance sends it to its own clients. A write
can land on an instance that holds no clients at all. Never assume the instance
that handles a request is the instance a client is connected to.

# Setup:

## Need env file with some variables

`cp .env.example .env`

One server serves all clients. `CLIENTS` is a comma-separated list of the
clients it accepts, and each request names its client in the path:
`http://localhost:8000/local/events`.

The server uses local SQLite databases at `./data/<client>.db` unless
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set. With those set it uses
Supabase Postgres.

`CLIENT` is temporary. When it is set, the server also serves that client at
the root path (`/events`), for frontends that still use the old URL.

# Start server in dev mode

`deno task dev`

# Other: Start REPL if you wan to try out db stuff with repl

`deno repl -A`

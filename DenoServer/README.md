# Setup:

## Need env file with some variables

`cp .env.example .env`

The server uses a local SQLite database at `./data/local.db` unless `SUPABASE_URL`
and `SUPABASE_SECRET_KEY` are set. With those set it uses Supabase Postgres, and
`CLIENT` selects which deployment's data to read and write.

# Start server in dev mode

`deno task dev`

# Other: Start REPL if you wan to try out db stuff with repl

`deno repl -A`

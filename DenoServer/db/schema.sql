-- Supabase Postgres schema for TennisTable
-- Shared database — all deployments use client_id to isolate data

CREATE TABLE events (
  client_id TEXT NOT NULL,
  time      BIGINT NOT NULL,
  stream    TEXT NOT NULL,
  type      TEXT NOT NULL,
  data      JSONB,
  PRIMARY KEY (client_id, time)
);

CREATE TABLE users (
  client_id TEXT NOT NULL,
  username  TEXT NOT NULL,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'user',
  PRIMARY KEY (client_id, username)
);

CREATE TABLE live_game (
  client_id TEXT PRIMARY KEY,
  state     JSONB NOT NULL
);

CREATE TABLE key_value (
  client_id TEXT NOT NULL,
  key       TEXT NOT NULL,
  value     JSONB NOT NULL,
  PRIMARY KEY (client_id, key)
);

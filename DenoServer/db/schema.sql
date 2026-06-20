-- Supabase Postgres schema for TennisTable
-- Run this in each Supabase project's SQL editor

CREATE TABLE events (
  time    BIGINT PRIMARY KEY,
  stream  TEXT NOT NULL,
  type    TEXT NOT NULL,
  data    JSONB NOT NULL
);

CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  role     TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE live_game (
  id    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  state JSONB NOT NULL
);

CREATE TABLE key_value (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

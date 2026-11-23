-- PickMySeat bookings on PostgreSQL (Supabase). Used by the website's API routes on Vercel.
-- Run once:  npm run db:pg  (from the project folder, with DATABASE_URL in frontend/.env.local)
-- The movie catalogue still lives in frontend/src/lib/data.ts.

CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,                 -- ticket id, e.g. PMS1A2B3C4D
  movie_id         TEXT NOT NULL,
  theatre_id       TEXT NOT NULL,
  city             TEXT NOT NULL DEFAULT '',
  show_date        DATE,                             -- the screening's real date (India time)
  show_id          TEXT NOT NULL,
  show_key         TEXT NOT NULL,                    -- movieId|showId|YYYY-MM-DD
  show_time        TEXT NOT NULL DEFAULT '',
  format           TEXT NOT NULL DEFAULT '',
  seats            JSONB NOT NULL,
  snacks           JSONB NOT NULL DEFAULT '{}',
  total            INTEGER NOT NULL CHECK (total > 0),  -- rupees, calculated on the server
  status           TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
  payment_order_id TEXT UNIQUE,
  payment_id       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ                       -- end of the seat hold while paying; NULL once confirmed
);

-- One row per sold or held seat. The primary key makes selling the same seat twice impossible.
CREATE TABLE IF NOT EXISTS booked_seats (
  show_key   TEXT NOT NULL,
  seat_id    TEXT NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  PRIMARY KEY (show_key, seat_id)
);

CREATE INDEX IF NOT EXISTS bookings_pending_idx ON bookings (expires_at) WHERE status = 'pending';

-- Only the website's server (which connects as the database owner) may read or write these tables.
-- Row level security with no policies blocks Supabase's public REST API from touching them.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booked_seats ENABLE ROW LEVEL SECURITY;

-- ---------- Accounts ----------
-- Sign in with an email address or a 10-digit mobile number and a password (stored as an scrypt hash).
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Tickets belong to the account that bought them. 'blocked' rows are seats an admin took off sale.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'blocked'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_total_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_total_check CHECK (total >= 0);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, created_at DESC);

-- ---------- Catalogue (managed in the admin panel) ----------
-- Filled from frontend/src/lib/data.ts the first time the site starts with an empty database.
CREATE TABLE IF NOT EXISTS movies (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  lang       TEXT NOT NULL,
  genre      TEXT NOT NULL,
  rating     NUMERIC(3,1) NOT NULL DEFAULT 0,
  duration   TEXT NOT NULL DEFAULT '',
  year       INTEGER NOT NULL,
  blurb      TEXT NOT NULL DEFAULT '',
  hue        INTEGER NOT NULL DEFAULT 210,
  hue2       INTEGER NOT NULL DEFAULT 20,
  banner     TEXT,                      -- key art image URL
  trailer    TEXT,                      -- YouTube video id
  active     BOOLEAN NOT NULL DEFAULT true,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS theatres (
  id      TEXT PRIMARY KEY,
  city    TEXT NOT NULL,
  name    TEXT NOT NULL,
  km      NUMERIC(4,1) NOT NULL DEFAULT 1,
  formats TEXT[] NOT NULL,
  layout  TEXT NOT NULL,                -- one of the seat layouts in frontend/src/lib/layouts.ts
  active  BOOLEAN NOT NULL DEFAULT true
);

-- Showtimes set by an admin. A movie and theatre with no rows here get generated showtimes.
CREATE TABLE IF NOT EXISTS shows (
  id         TEXT PRIMARY KEY,
  movie_id   TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  theatre_id TEXT NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
  time       TEXT NOT NULL CHECK (time ~ '^[0-2][0-9]:[0-5][0-9]$'),   -- 24-hour HH:MM
  format     TEXT NOT NULL,
  UNIQUE (movie_id, theatre_id, time)
);

-- ---------- Ratings and reviews ----------
CREATE TABLE IF NOT EXISTS reviews (
  id         BIGSERIAL PRIMARY KEY,
  movie_id   TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (movie_id, user_id)            -- one review per person per movie
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatres ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ---------- Real show dates ----------
-- Shows used to be stored as "days from today" (day 0-6), which pointed at a different show after midnight.
-- They are now stored by their real date. The old column is kept, unused, so older copies still load.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS show_date DATE;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_day_check;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'day') THEN
    ALTER TABLE bookings ALTER COLUMN day DROP NOT NULL;
  END IF;
END $$;

-- PickMySeat database schema (SQLite)
-- Catalogue tables (movies, cities, theatres, snacks) are filled by seed.sql.
-- Booking tables (bookings, booked_seats) are filled by the backend at runtime.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS movies (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  lang      TEXT NOT NULL,
  genre     TEXT NOT NULL,
  rating    REAL NOT NULL,
  duration  TEXT NOT NULL,
  year      INTEGER NOT NULL,
  blurb     TEXT NOT NULL,
  banner    TEXT,            -- path under frontend/public, e.g. /posters/ramayana.png
  trailer   TEXT             -- YouTube video id
);

CREATE TABLE IF NOT EXISTS cities (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS theatres (
  id       TEXT PRIMARY KEY,
  city     TEXT NOT NULL REFERENCES cities(name),
  name     TEXT NOT NULL,
  km       REAL NOT NULL,     -- distance shown to the customer
  formats  TEXT NOT NULL,     -- comma separated, e.g. IMAX,4DX
  layout   TEXT NOT NULL      -- seat layout id used by the 2D map and 3D hall
);

CREATE TABLE IF NOT EXISTS snacks (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  price  INTEGER NOT NULL,    -- rupees
  emoji  TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id          TEXT PRIMARY KEY,                -- ticket id shown on the QR ticket
  movie_id    TEXT NOT NULL REFERENCES movies(id),
  theatre_id  TEXT NOT NULL REFERENCES theatres(id),
  city        TEXT NOT NULL,
  day         INTEGER NOT NULL,                -- 0 = today, 1 = tomorrow ...
  show_id     TEXT NOT NULL,
  show_key    TEXT NOT NULL,                   -- movie|show|day, identifies one screening
  show_time   TEXT NOT NULL,
  format      TEXT NOT NULL,
  seats       TEXT NOT NULL,                   -- JSON array of seat ids
  snacks      TEXT NOT NULL DEFAULT '{}',      -- JSON object snackId -> quantity
  total       INTEGER NOT NULL,                -- rupees, including fee
  status      TEXT NOT NULL DEFAULT 'confirmed', -- 'pending' while paying, then 'confirmed'
  expires_at  TEXT,                            -- end of the seat hold for a pending booking (UTC)
  payment_order_id TEXT UNIQUE,                -- Razorpay order id (order_...)
  payment_id  TEXT,                            -- Razorpay payment id (pay_...)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per seat sold. The primary key stops two people buying the same seat.
CREATE TABLE IF NOT EXISTS booked_seats (
  show_key    TEXT NOT NULL,
  seat_id     TEXT NOT NULL,
  booking_id  TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  PRIMARY KEY (show_key, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_show ON bookings(show_key);
CREATE INDEX IF NOT EXISTS idx_theatres_city ON theatres(city);

# PickMySeat

Movie ticket booking where you choose a seat by seeing the real view from it. Pick seats on a flat 2D map, then the camera flies into a 3D model of the theatre and sits you in that seat, with the trailer playing on the screen.

Live demo: https://bys-sooty.vercel.app

## Project structure

```
PICKMYSEAT/
├── frontend/              Next.js website and installable app (PWA)
│   ├── src/app/           Pages: home, movies, movie, seats, snacks, pay, ticket, my tickets
│   ├── src/components/    3D hero, 3D hall, seat camera, 2D seat map, posters, ticket card
│   ├── src/lib/           Movie/theatre data, seat layouts, showtimes, pricing, store, API client
│   └── public/            Posters, app icon, web manifest
├── backend/               Node.js REST API (no npm dependencies)
│   ├── src/server.js      Starts the server
│   ├── src/app.js         Routes and booking logic
│   ├── src/db.js          Opens SQLite, creates it from the schema and seed on first run
│   └── test/              API tests
├── database/              SQLite database
│   ├── schema.sql         Tables: movies, cities, theatres, snacks, bookings, booked_seats
│   ├── seed.sql           Catalogue data (generated)
│   └── generate-seed.mjs  Rebuilds seed.sql from frontend/src/lib/data.ts
└── docs/                  Project synopsis (PDF)
```

## Requirements

- Node.js 22.18 or newer (the backend uses Node's built-in SQLite)

## Run it

1. Install the frontend packages (once):

   ```bash
   npm run setup
   ```

2. Start the backend (terminal 1). It creates `database/pickmyseat.db` on first run.

   ```bash
   npm run dev:backend
   ```

3. Connect the frontend to the backend: copy `frontend/.env.example` to `frontend/.env.local`.

4. Start the frontend (terminal 2), then open http://localhost:3000.

   ```bash
   npm run dev:frontend
   ```

Skip steps 2 and 3 to run the website on its own in demo mode. Tickets are then kept only in the browser.

## API

Base URL: `http://localhost:4000/api`

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Server check |
| GET | `/movies` | All movies |
| GET | `/movies/:id` | One movie |
| GET | `/cities` | City names |
| GET | `/theatres?city=Mumbai` | Theatres in a city, nearest first |
| GET | `/snacks` | Snack menu |
| GET | `/shows/:showKey/booked-seats` | Seats already bought for a show (`showKey` = `movieId\|showId\|day`) |
| POST | `/bookings` | Books seats; returns `409` with the taken seats if someone got there first |
| GET | `/bookings/:id` | One booking (the ticket id) |

Seats are reserved in one database transaction, and `booked_seats` has a primary key on (show, seat), so the same seat can never be sold twice.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the API tests |
| `npm run build` | Production build of the frontend |
| `npm run db:seed` | Regenerates `database/seed.sql` after editing movies or theatres |
| `npm run db:reset` | Deletes the database and rebuilds it from the seed |

## Notes

- Payment is a demo. Nothing is charged and no card details are collected.
- Showtimes and the "already sold" seats are generated so every show looks busy. Real purchases from the backend are added on top.
- Movie posters and trailers belong to their owners and are used for demo purposes only.

# PickMySeat

Movie ticket booking where you choose a seat by seeing the real view from it. Pick seats on a flat 2D map, then the camera flies into a 3D model of the theatre and sits you in that seat, with the trailer playing on the screen.

Also: accounts (email or mobile number), tickets saved to the account and shareable by link, search and filters, ratings and reviews, and an admin panel for movies, theatres, showtimes, seat blocking, bookings and revenue.

Live demo: https://bys-sooty.vercel.app

## Project structure

```
PICKMYSEAT/
├── frontend/              Next.js website and installable app (PWA)
│   ├── src/app/           Pages: home, movies, movie, seats, snacks, pay, ticket, my tickets
│   ├── src/components/    3D hero, 3D hall, seat camera, 2D seat map, posters, ticket card
│   ├── src/app/api/       Server routes: catalogue, bookings, payments, accounts, reviews, admin
│   ├── src/lib/           Catalogue, seat layouts, showtimes, pricing, accounts, booking logic
│   ├── scripts/           pg-setup.mjs (creates the Postgres tables), make-admin.mjs
│   └── public/            Posters, app icon, web manifest
├── backend/               Node.js REST API (no npm dependencies)
│   ├── src/server.js      Starts the server
│   ├── src/app.js         Routes and booking logic
│   ├── src/db.js          Opens SQLite, creates it from the schema and seed on first run
│   └── test/              API tests
├── database/
│   ├── postgres/schema.sql  PostgreSQL (Supabase): users, movies, theatres, shows, bookings, booked_seats, reviews
│   ├── schema.sql         SQLite for the offline backend: movies, cities, theatres, snacks, bookings, booked_seats
│   ├── seed.sql           Catalogue data (generated)
│   └── generate-seed.mjs  Rebuilds seed.sql from frontend/src/lib/data.ts
├── android/               Android app (APK)
│   ├── app/src/main/      MainActivity (WebView), manifest, icons
│   ├── release/           PickMySeat.apk, ready to install
│   └── make_icons.py      Rebuilds the launcher icons from the logo
└── docs/                  Project synopsis (PDF) and its generator, logo files (brand/)
```

## Android app (APK)

`android/release/PickMySeat.apk` installs directly on an Android phone (Android 7.0 or newer). Copy it to the phone, open it, and allow "Install unknown apps" for your file manager when Android asks.

The app opens the live website (https://bys-sooty.vercel.app) full screen, so it has every feature of the site and updates whenever the site is redeployed. It adds an app icon and launch screen, the Back button, full-screen trailers, Razorpay payment windows, UPI apps and an offline screen. It needs the internet.

To rebuild it, open `android/` in Android Studio and choose **Build → Generate Signed App Bundle / APK**, or from a terminal:

```bash
cd android
gradlew assembleRelease
```

The release key (`pickmyseat-release.jks`) and its passwords (`keystore.properties`) stay on the PC that built the app and are not in git. Keep them: updates to an installed app must be signed with the same key. Without them, the build uses Android's debug key.

## Requirements

- Node.js 22.18 or newer (the backend uses Node's built-in SQLite)

## Run it

1. Install the frontend packages (once):

   ```bash
   npm run setup
   ```

2. Copy `frontend/.env.example` to `frontend/.env.local` and fill in `DATABASE_URL` and the Razorpay test keys (see the next two sections), then create the tables:

   ```bash
   npm run db:pg
   ```

3. Start the website, then open http://localhost:3000.

   ```bash
   npm run dev:frontend
   ```

Without `DATABASE_URL` the website runs on its own in demo mode: no accounts, and tickets are kept only in the browser.

The separate `backend/` (Node.js with SQLite) still works for offline use: `npm run dev:backend`, then set `NEXT_PUBLIC_API_URL=http://localhost:4000/api`. Accounts, admin and reviews need the PostgreSQL database instead.

## Database, accounts and admin (Supabase PostgreSQL)

The website's own API routes use a PostgreSQL database on Supabase. They store the catalogue, accounts, bookings, seat holds and reviews, so seat locking works on Vercel too.

1. In Supabase, open **Connect** and copy the **Session pooler** connection string (port 5432, works over IPv4). Don't use the transaction pooler (port 6543): it can stall when several queries arrive together.
2. Put it in `frontend/.env.local` as `DATABASE_URL=...`. If the password has special characters, percent-encode them (`@` becomes `%40`).
3. Create the tables (once, and again after schema changes; it is safe to re-run):

   ```bash
   npm run db:pg
   ```

   The first request fills the movies and theatres from `frontend/src/lib/data.ts`. After that, edit them in the admin panel.
4. On Vercel, add the same `DATABASE_URL` under **Settings → Environment Variables**, then redeploy.

**Accounts.** Customers sign up with a name, an email address or 10-digit mobile number, and a password (at least 8 characters, stored as an scrypt hash). The session is a signed HttpOnly cookie, valid for 30 days. When a database is connected, paying needs a signed-in customer, and tickets are saved to the account. Optional: set `AUTH_SECRET` to a long random string to sign the cookies; without it, a secret is derived from `DATABASE_URL`.

**Admin panel** (`/admin`). Sign up on the website, then give that account admin rights from this PC:

```bash
npm run make-admin -- your@email.com
```

Admins can add, edit, hide or delete movies (key art link, YouTube trailer) and theatres (city, formats, seat layout), set daily showtimes, block or release seats for a show, and see revenue, tickets, customers and every booking.

## Razorpay payments (test mode)

With Razorpay keys in the backend, the Pay button opens the real Razorpay Checkout window (UPI, cards, netbanking, wallets). Test mode never moves real money.

1. Create a free account at https://dashboard.razorpay.com and switch to **Test Mode**.
2. Go to **Account & Settings → API Keys** and generate a test key.
3. Copy `backend/.env.example` to `backend/.env` and fill in `RAZORPAY_KEY_ID` (starts with `rzp_test_`) and `RAZORPAY_KEY_SECRET`. Only test keys are accepted.
4. Restart the backend. It prints `Razorpay test mode on`.

How a payment works:

1. **Order.** The backend holds the seats for 10 minutes and creates a Razorpay order for the total (in paise).
2. **Checkout.** The browser opens Razorpay with that order. Card and UPI details go only to Razorpay.
3. **Verify.** Razorpay returns a signed result. The backend checks the HMAC-SHA256 signature with the secret key and only then confirms the booking.
4. **Cancel or expire.** Closing the window, or 10 minutes passing without payment, releases the seats.

**On Vercel (no separate backend):** the website has its own payment routes in `frontend/src/app/api/payments/`. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (test keys) under Vercel → Project → Settings → Environment Variables, then redeploy. Payments are created and signature-checked the same way, but seats are not held in a database there. Seat locking needs the full backend.

Test payment details (from Razorpay's test documentation):

| Method | Use |
| --- | --- |
| UPI | `success@razorpay` (or `failure@razorpay` to see a failed payment) |
| Card | `4111 1111 1111 1111`, any future expiry, any CVV, any OTP |
| Netbanking | Any bank, then **Success** on Razorpay's test page |

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
| POST | `/bookings` | Books seats without payment (only when Razorpay is off); `409` lists seats someone else got first |
| GET | `/bookings/:id` | One booking (the ticket id) |
| GET | `/payments/config` | Whether Razorpay test mode is on, the public key id, and whether a database is connected |
| POST | `/payments/order` | Holds the seats and creates a Razorpay order |
| POST | `/payments/verify` | Checks Razorpay's signature and confirms the booking |
| POST | `/payments/cancel` | Releases the seats when the payment window is closed |

The website (Next.js on Vercel) has these routes too, under `/api`, plus:

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/catalog` | Movies, theatres, admin showtimes and audience ratings |
| POST | `/auth/signup`, `/auth/login`, `/auth/logout` | Accounts (email or mobile number and password) |
| GET | `/auth/me`, `/me/tickets` | The signed-in account and its tickets |
| GET, POST, DELETE | `/reviews?movie=id` | Read, add or change, and delete your review |
| GET | `/admin/overview?q=` | Revenue, tickets, customers, sales by movie and day, bookings search (admins) |
| GET, POST, DELETE | `/admin/catalog`, `/admin/movies`, `/admin/theatres`, `/admin/shows`, `/admin/blocks` | Admin edits |

Seats are reserved in one database transaction, and `booked_seats` has a primary key on (show, seat), so the same seat can never be sold twice.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the offline backend's API tests |
| `npm run test:dates` | Checks the show date and time rules (India time) |
| `npm run build` | Production build of the frontend |
| `npm run db:seed` | Regenerates `database/seed.sql` after editing movies or theatres |
| `npm run db:reset` | Deletes the SQLite database and rebuilds it from the seed |
| `npm run db:pg` | Creates or updates the PostgreSQL tables (Supabase) |
| `npm run make-admin -- <email or mobile>` | Gives an account admin rights (`--remove` takes them away) |

## Notes

- Payments run only in Razorpay test mode. Without keys, payment is a demo screen. Nothing is ever charged.
- The server recalculates every price from the theatre layout and snack menu. If the browser's total differs (for example, someone edited it), the order is refused.
- Mobile numbers are not verified with an SMS code; that needs a paid SMS provider.
- Show dates and times are India Standard Time on every phone and on the server. A show is stored by its real date (`movie|show|2026-11-25`), so a booking made tonight for tomorrow still holds its seats after midnight. Shows that have started disappear from the page and are refused by the server; tickets are on sale for today and the next four days.
- Showtimes and the "already sold" seats are generated so every show looks busy. Real purchases from the backend are added on top.
- Movie posters and trailers belong to their owners and are used for demo purposes only.

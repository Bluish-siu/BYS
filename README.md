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
| GET | `/payments/config` | Whether Razorpay test mode is on, and the public key id |
| POST | `/payments/order` | Holds the seats and creates a Razorpay order |
| POST | `/payments/verify` | Checks Razorpay's signature and confirms the booking |
| POST | `/payments/cancel` | Releases the seats when the payment window is closed |

Seats are reserved in one database transaction, and `booked_seats` has a primary key on (show, seat), so the same seat can never be sold twice.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the API tests |
| `npm run build` | Production build of the frontend |
| `npm run db:seed` | Regenerates `database/seed.sql` after editing movies or theatres |
| `npm run db:reset` | Deletes the database and rebuilds it from the seed |

## Notes

- Payments run only in Razorpay test mode. Without keys, payment is a demo screen. Nothing is ever charged.
- The amount comes from the browser's price calculation. A production system should recalculate it on the server before creating the order.
- Showtimes and the "already sold" seats are generated so every show looks busy. Real purchases from the backend are added on top.
- Movie posters and trailers belong to their owners and are used for demo purposes only.

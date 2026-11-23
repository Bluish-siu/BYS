# PickMySeat

Movie ticket booking where you choose a seat by seeing the real view from it. Pick seats on a flat 2D map, then the camera flies into a 3D model of the theatre and sits you in that seat, with the trailer playing on the screen. In 3D you can tap any seat just to check its view, and add it only if you like it.

Also: accounts (sign in with email or mobile number, email confirmed with a code, forgot password), tickets saved to the account and shareable by link, cancellation with Razorpay refunds, QR check-in at the entrance, search and filters, ratings and reviews, and an admin panel.

Live demo: https://bys-sooty.vercel.app

## Project structure

```
PICKMYSEAT/
├── frontend/              Next.js website and its server (API routes)
│   ├── src/app/           Pages: home, movies, movie, seats, snacks, pay, ticket, my tickets, login, admin
│   ├── src/app/api/       Server: catalogue, bookings, payments, accounts, reviews, check-in, admin
│   ├── src/components/    3D hero, 3D hall, seat camera, 2D seat map, ticket card, QR scanner, reviews
│   ├── src/lib/           Catalogue, seat layouts, showtimes, dates (India time), prices, accounts, bookings, e-mail
│   ├── scripts/           pg-setup.mjs (database tables), make-admin.mjs, e2e.mjs and dates.test.ts (tests)
│   └── public/            Posters, app icon, web manifest
├── database/
│   └── schema.sql         PostgreSQL (Supabase): users, auth_codes, movies, theatres, shows, snacks, seat_prices,
│                          bookings, booked_seats, reviews
├── android/               Android app (APK)
│   ├── app/src/main/      MainActivity (WebView), manifest, icons
│   ├── release/           PickMySeat.apk, ready to install
│   └── make_icons.py      Rebuilds the launcher icons from the logo
└── docs/                  Project synopsis (PDF) and its generator, logo files (brand/)
```

One backend: the website's API routes (`frontend/src/app/api`) run as serverless functions on Vercel and use a PostgreSQL database on Supabase.

## Run it

Needs Node.js 22.18 or newer.

1. Install the packages (once):

   ```bash
   npm run setup
   ```

2. Copy `frontend/.env.example` to `frontend/.env.local` and fill in `DATABASE_URL` and the Razorpay test keys (see below), then create the tables:

   ```bash
   npm run db:pg
   ```

3. Start the website, then open http://localhost:3000.

   ```bash
   npm run dev:frontend
   ```

Without `DATABASE_URL` the website runs on its own in demo mode: no accounts, and tickets are kept only in the browser.

## Database (Supabase PostgreSQL)

1. In Supabase, open **Connect** and copy the **Session pooler** connection string (port 5432, works over IPv4). Don't use the transaction pooler (port 6543): it can stall when several queries arrive together.
2. Put it in `frontend/.env.local` as `DATABASE_URL=...`. Percent-encode special characters in the password (`@` becomes `%40`).
3. Create or update the tables (safe to re-run): `npm run db:pg`. The first request fills movies, theatres and snacks from `frontend/src/lib/data.ts`; after that, edit them in the admin panel.
4. On Vercel, add the same `DATABASE_URL` under **Settings → Environment Variables**, then redeploy.

Supabase pauses free projects after about a week without visits. Open the site a day before a demo, or resume the project in the Supabase dashboard.

## Accounts

- **Sign up** with a name, email, optional mobile number and a password (at least 8 characters, stored as an scrypt hash). **Sign in** with the email or the mobile number.
- **Confirm email.** When e-mail is set up (below), a 6-digit code is e-mailed at sign-up. Tickets can be bought once the email is confirmed. Codes last 10 minutes and allow 5 tries.
- **Forgot password.** A 6-digit code is e-mailed; entering it sets a new password and signs the account out on every other device. Without e-mail, an admin gives a temporary password from **Admin → Customers**.
- **Sessions** are a signed HttpOnly cookie, valid for 30 days. Optional: `AUTH_SECRET` (a long random string) signs them; otherwise a secret is derived from `DATABASE_URL`.
- Mobile numbers are not verified by SMS; that needs a paid SMS provider.

### E-mail (Gmail)

1. In your Google Account, turn on **2-Step Verification**.
2. Go to **Google Account → Security → App passwords**, create one called "PickMySeat", and copy the 16-letter password.
3. Add to `frontend/.env.local` and to Vercel's environment variables, then redeploy:

   ```
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   ```

For local testing, `MAIL_DEV=log` prints e-mails to the server log instead of sending them.

## Admin panel (`/admin`)

Sign up on the website, then give that account admin rights from this PC:

```bash
npm run make-admin -- your@email.com
```

| Tab | What admins do |
| --- | --- |
| Dashboard | Revenue, today's sales, tickets, customers, check-ins, refunds, 14-day chart, sales by movie; search bookings; **Cancel & refund** any booking (full refund) |
| Check-in | Scan the ticket QR with the phone camera (or type the ticket id). Each ticket works once, on its show's date; a second scan says "Already used" |
| Customers | Search accounts, give a temporary password, mark an email confirmed, make or remove admins |
| Movies, Theatres, Showtimes | Add, edit, hide or delete movies (key art link, YouTube trailer), theatres (city, formats, seat layout) and daily showtimes |
| Prices | Seat prices per theatre and section, and the snack menu (prices, new snacks, hide snacks) |
| Block seats | Take seats off sale for one show, and release them again |

## Booking rules

- **Seats are locked in the database.** One SQL statement inserts a booking and all its seats; the primary key on (show, seat) means a seat can never be sold twice, even when people tap Pay at the same moment.
- **Prices are calculated on the server** from the theatre's seat prices and the snack menu. If the browser's total differs, the order is refused.
- **Seats are held for 10 minutes** while paying. Closing the payment window, a failed payment, or starting again releases them.
- **Live seat map.** The 2D map and 3D hall refresh every 5 seconds, so seats others buy or start paying for appear without reloading.
- **Dates are India time.** A show is stored by its real date (`movie|show|2026-11-25`). Tickets are on sale for today and the next four days; shows that have started disappear and are refused by the server.
- **Cancellation.** Customers can cancel from the ticket page until 30 minutes before the show; the ticket and snacks are refunded through Razorpay (test mode), the ₹30 convenience fee is not. Admins can cancel any booking with a full refund. If Razorpay can't refund, nothing changes.

## Razorpay payments (test mode)

1. Create a free account at https://dashboard.razorpay.com and switch to **Test Mode**.
2. Go to **Account & Settings → API Keys** and generate a test key.
3. Add `RAZORPAY_KEY_ID` (starts with `rzp_test_`) and `RAZORPAY_KEY_SECRET` to `frontend/.env.local` and to Vercel. Only test keys are accepted.

How a payment works:

1. **Order.** The server checks the show and the price, holds the seats for 10 minutes, and creates a Razorpay order for the total (in paise).
2. **Checkout.** Razorpay opens with that order. Card and UPI details go only to Razorpay.
   - On the website, Razorpay's window reports back to the page.
   - In the Android app, Razorpay's **redirect flow** is used instead: the payment happens as normal page loads and Razorpay posts the result to `/api/payments/callback`. Pop-up windows inside apps often can't report back, which made payments fail there.
3. **Verify.** The server checks Razorpay's HMAC-SHA256 signature with the secret key, and only then confirms the booking.

Test payment details (from Razorpay's test documentation):

| Method | Use |
| --- | --- |
| UPI | `success@razorpay` (or `failure@razorpay` to see a failed payment) |
| Card | `4111 1111 1111 1111`, any future expiry, any CVV, any OTP |
| Netbanking | Any bank, then **Success** on Razorpay's test page |

## API

All under `/api`.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/catalog` | Movies, theatres, showtimes, snacks, seat prices and audience ratings |
| GET | `/shows/:showKey/booked-seats` | Seats sold, held or blocked for a show (`showKey` = `movieId\|showId\|YYYY-MM-DD`) |
| GET | `/payments/config` | Whether Razorpay test mode and the database are on |
| POST | `/payments/order` | Checks the booking and price, holds the seats, creates a Razorpay order |
| POST | `/payments/verify` | Checks Razorpay's signature and confirms the booking (website) |
| POST | `/payments/callback` | Razorpay's redirect flow (Android app) |
| POST | `/payments/cancel` | Releases the seats when the payment window is closed |
| POST | `/bookings` | Books without payment (only when Razorpay is off) |
| GET | `/bookings/:id` | One ticket (shared links) |
| POST | `/bookings/:id/cancel` | Customer cancels their ticket, with refund |
| POST | `/auth/signup`, `/auth/login`, `/auth/logout` | Accounts |
| POST | `/auth/verify` | Confirm the email with the code, or send a new code |
| POST | `/auth/forgot`, `/auth/reset` | Forgot password: e-mail a code, then set a new password |
| GET | `/auth/me`, `/me/tickets` | The signed-in account and its tickets |
| GET, POST, DELETE | `/reviews?movie=id` | Read, add or change, and delete your review |
| POST | `/admin/checkin` | Check a ticket in at the entrance |
| POST | `/admin/bookings/:id/cancel` | Admin cancels a booking with a full refund |
| GET, POST | `/admin/overview`, `/admin/users` | Dashboard and customers |
| GET, POST, DELETE | `/admin/catalog`, `/admin/movies`, `/admin/theatres`, `/admin/shows`, `/admin/prices`, `/admin/snacks`, `/admin/blocks` | Admin edits |

## Android app (APK)

`android/release/PickMySeat.apk` installs directly on an Android phone (Android 7.0 or newer). Copy it to the phone, open it, and allow "Install unknown apps" for your file manager when Android asks.

The app opens the live website full screen, so it has every feature of the site and updates whenever the site is redeployed. It adds an app icon and launch screen, the Back button, full-screen trailers, Razorpay's redirect payment flow, UPI apps, the phone's share sheet for tickets, the camera for the admin ticket scanner, and an offline screen.

To rebuild it, open `android/` in Android Studio and choose **Build → Generate Signed App Bundle / APK**, or:

```bash
cd android
gradlew assembleRelease
```

The release key (`pickmyseat-release.jks`) and its passwords (`keystore.properties`) stay on the PC that built the app and are not in git. Keep them: updates to an installed app must be signed with the same key.

## Tests

| Command | What it does |
| --- | --- |
| `npm test` | Show date and time rules (India time, midnight, started shows) |
| `npm run test:e2e` | 68 checks against the real database: accounts, email codes, forgot password, prices, blocking, seat locking, both payment flows, check-in, cancellation, refunds, reviews. Start the site first with `MAIL_DEV=log` (see the top of `frontend/scripts/e2e.mjs`). It removes everything it creates |

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run build` | Production build of the website |
| `npm run db:pg` | Creates or updates the database tables |
| `npm run make-admin -- <email or mobile>` | Gives an account admin rights (`--remove` takes them away) |

## Notes

- Payments run only in Razorpay test mode. Nothing is ever charged.
- Showtimes, and the "already sold" seats on every show, are generated so the demo looks busy. Real bookings are added on top, and admins can set real showtimes.
- Movie posters and trailers belong to their owners and are used for demo purposes only.

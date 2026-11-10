# Cineverse

A movie ticket booking demo with a 3D cinema hall you can walk around in.

## Features

- **3D panorama hero:** a ring of movie screens you can drag, spin and tap to book.
- **Movie pages:** key art header, a 5-day picker and theatres with showtimes per city.
- **3D seat picker:**
  - Each theatre has its own layout (sections, prices, aisles, recliners, sofas, loungers), modelled on Mumbai multiplexes.
  - Tap a seat and the camera moves to it so you see your view of the screen.
  - Drag to look around 360°, walk with WASD, arrow keys or the on-screen buttons.
  - Camera views: Overview, From stage, Back row, Bird's eye and an auto tour.
  - "Best seats" picks the best free seats together without crossing an aisle.
- **Booking flow:** seats, snacks, review, demo payment, then a QR ticket saved under "My tickets".

All movie, theatre and showtime data is dummy data. Payment is a demo: nothing is charged.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Built with

Next.js 14, React 18, TypeScript, Three.js with React Three Fiber, Tailwind CSS, Zustand and qrcode.

## Project layout

- `src/app` pages: home, movies, movie, booking steps (seats, snacks, pay), tickets
- `src/components` 3D hero, seat hall, hall model, posters, ticket card
- `src/lib` movie and theatre data, seat layouts, showtimes, pricing, store
- `public/posters` movie key art

Movie posters belong to their respective owners and are used here for demo purposes only.

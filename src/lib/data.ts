export type Movie = {
  id: string; title: string; lang: string; genre: string; rating: number;
  duration: string; year: number; blurb: string; hue: number; hue2: number;
  banner?: string; // widescreen key art in /public/posters
  trailer?: string; // YouTube video id, played on the 3D screen
};

export const movies: Movie[] = [
  { id: "ramayana", title: "Ramayana", lang: "Hindi", genre: "Mythological Epic", rating: 9.1, duration: "3h 05m", year: 2026, blurb: "The timeless epic of Rama, retold on a cosmic scale in IMAX 3D.", hue: 210, hue2: 20, banner: "/posters/ramayana.png", trailer: "T0Uduwg2W2w" },
  { id: "jailer-2", title: "Jailer 2", lang: "Tamil", genre: "Action", rating: 8.7, duration: "2h 45m", year: 2026, blurb: "Superstar Rajinikanth returns in the explosive sequel.", hue: 195, hue2: 28, banner: "/posters/jailer2.webp" },
  { id: "drishyam-conclusion", title: "Drishyam: The Conclusion", lang: "Hindi", genre: "Crime Thriller", rating: 8.5, duration: "2h 30m", year: 2026, blurb: "The final chapter of the gripping Drishyam saga.", hue: 180, hue2: 200, banner: "/posters/drishyam.webp" },
  { id: "prahaar", title: "Prahaar", lang: "Hindi", genre: "Biographical Drama", rating: 8.0, duration: "2h 20m", year: 2026, blurb: "The untold story of Ujjwal Nikam.", hue: 30, hue2: 10, banner: "/posters/prahaar.png" },
  { id: "neon-monsoon", title: "Neon Monsoon", lang: "Tamil", genre: "Sci-Fi Thriller", rating: 8.6, duration: "2h 31m", year: 2026, blurb: "In a rain-drenched megacity, a courier discovers a package that rewrites memories.", hue: 330, hue2: 260 },
  { id: "last-lighthouse", title: "The Last Lighthouse", lang: "Malayalam", genre: "Mystery", rating: 8.2, duration: "2h 08m", year: 2026, blurb: "A keeper on a remote island hears a signal from a ship that sank forty years ago.", hue: 200, hue2: 170 },
  { id: "raja-reborn", title: "Raja Reborn", lang: "Telugu", genre: "Action Epic", rating: 8.9, duration: "2h 55m", year: 2026, blurb: "A forgotten king returns to a modern city to reclaim what was stolen from his people.", hue: 28, hue2: 350 },
  { id: "kaveri-nights", title: "Kaveri Nights", lang: "Kannada", genre: "Romance Drama", rating: 7.9, duration: "2h 14m", year: 2026, blurb: "Two strangers share one long train ride along the river and one impossible secret.", hue: 150, hue2: 60 },
];

export const getMovie = (id: string) => movies.find((m) => m.id === id);

export const posterGradient = (m: Movie) =>
  `linear-gradient(155deg, hsl(${m.hue} 85% 55%), hsl(${m.hue2} 80% 22%) 70%, #07070c)`;

export type Theatre = { id: string; name: string; km: number; formats: string[]; layout: string };

export const cityTheatres: Record<string, Theatre[]> = {
  Mumbai: [
    { id: "mum-rcity", name: "INOX: R-City, Ghatkopar", km: 6.1, formats: ["IMAX", "2D"], layout: "ghatkopar" },
    { id: "mum-icon", name: "PVR ICON: Phoenix Palladium, Lower Parel", km: 2.4, formats: ["IMAX", "4DX"], layout: "palladium" },
    { id: "mum-lakeshore", name: "Cinepolis: Lake Shore, Thane", km: 9.8, formats: ["IMAX", "2D"], layout: "thane" },
    { id: "mum-miraj", name: "Miraj Cinemas: IMAX, Wadala", km: 4.3, formats: ["IMAX"], layout: "wadala" },
    { id: "mum-maison", name: "Maison INOX: Jio World Plaza, BKC", km: 3.1, formats: ["IMAX", "2D"], layout: "bkc" },
  ],
  Pune: [
    { id: "pun-phoenix", name: "PVR: Phoenix Marketcity", km: 2.2, formats: ["IMAX", "2D"], layout: "thane" },
    { id: "pun-amanora", name: "INOX: Amanora Mall", km: 4.0, formats: ["2D", "4DX"], layout: "ghatkopar" },
    { id: "pun-seasons", name: "Cinepolis: Seasons Mall", km: 5.6, formats: ["2D"], layout: "bkc" },
  ],
  Chennai: [
    { id: "che-skyline", name: "PVR: Skyline", km: 1.8, formats: ["IMAX", "2D"], layout: "palladium" },
    { id: "che-sathyam", name: "SPI: Sathyam", km: 3.2, formats: ["2D"], layout: "ghatkopar" },
    { id: "che-luxe", name: "Luxe Cinemas: Express Avenue", km: 4.5, formats: ["IMAX", "2D"], layout: "wadala" },
  ],
  Bengaluru: [
    { id: "blr-orion", name: "PVR: Orion Mall", km: 2.0, formats: ["IMAX", "2D"], layout: "palladium" },
    { id: "blr-forum", name: "INOX: Forum Mall", km: 3.6, formats: ["2D", "4DX"], layout: "bkc" },
    { id: "blr-garuda", name: "Cinepolis: Garuda Mall", km: 5.1, formats: ["2D"], layout: "thane" },
  ],
  Hyderabad: [
    { id: "hyd-prasads", name: "Prasads IMAX", km: 2.5, formats: ["IMAX"], layout: "wadala" },
    { id: "hyd-amb", name: "AMB Cinemas: Gachibowli", km: 4.2, formats: ["2D", "4DX"], layout: "bkc" },
    { id: "hyd-inorbit", name: "PVR: Inorbit Mall", km: 5.8, formats: ["2D"], layout: "ghatkopar" },
  ],
};
export const cities = Object.keys(cityTheatres);
export const theatresFor = (city: string) => cityTheatres[city] ?? cityTheatres.Mumbai;
// Falls back to a default theatre so bookings saved before the layouts changed still open.
export const findTheatre = (id: string) => Object.values(cityTheatres).flat().find((t) => t.id === id) ?? cityTheatres.Mumbai[0];

export type Snack = { id: string; name: string; price: number; emoji: string };
export const snacks: Snack[] = [
  { id: "popcorn-l", name: "Caramel Popcorn (L)", price: 320, emoji: "🍿" },
  { id: "popcorn-s", name: "Salted Popcorn (S)", price: 190, emoji: "🍿" },
  { id: "nachos", name: "Cheesy Nachos", price: 260, emoji: "🧀" },
  { id: "cola", name: "Cola (500ml)", price: 150, emoji: "🥤" },
  { id: "samosa", name: "Hot Samosa (2)", price: 110, emoji: "🥟" },
  { id: "combo", name: "Couple Combo", price: 540, emoji: "🎁" },
];

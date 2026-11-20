export type Movie = {
  id: string; title: string; lang: string; genre: string; rating: number;
  duration: string; year: number; blurb: string; hue: number; hue2: number;
  banner?: string; // widescreen key art in /public/posters
  trailer?: string; // YouTube video id, played on the 3D screen
};

export const movies: Movie[] = [
  { id: "ramayana", title: "Ramayana", lang: "Hindi", genre: "Mythological Epic", rating: 9.1, duration: "3h 05m", year: 2026, blurb: "The timeless epic of Rama, retold on a cosmic scale in IMAX 3D.", hue: 210, hue2: 20, banner: "/posters/ramayana.png", trailer: "T0Uduwg2W2w" },
  { id: "jailer-2", title: "Jailer 2", lang: "Tamil", genre: "Action", rating: 8.7, duration: "2h 45m", year: 2026, blurb: "Superstar Rajinikanth returns in the explosive sequel.", hue: 195, hue2: 28, banner: "/posters/jailer2.webp", trailer: "PWuJ5-WiEgY" },
  { id: "drishyam-conclusion", title: "Drishyam: The Conclusion", lang: "Hindi", genre: "Crime Thriller", rating: 8.5, duration: "2h 30m", year: 2026, blurb: "The final chapter of the gripping Drishyam saga.", hue: 180, hue2: 200, banner: "/posters/drishyam.webp", trailer: "BSZZwBaNQAA" },
  { id: "prahaar", title: "Prahaar", lang: "Hindi", genre: "Biographical Drama", rating: 8.0, duration: "2h 20m", year: 2026, blurb: "The untold story of Ujjwal Nikam.", hue: 30, hue2: 10, banner: "/posters/prahaar.png", trailer: "qGbvEhKhaWA" },
  { id: "avengers-doomsday", title: "Avengers: Doomsday", lang: "English", genre: "Superhero Action", rating: 8.8, duration: "2h 45m", year: 2026, blurb: "Earth's mightiest heroes face their darkest hour as a new ruler rises from the shadows.", hue: 140, hue2: 50, banner: "/posters/doomsday.jpg", trailer: "irVNGjRFZGk" },
  { id: "eetha", title: "Eetha", lang: "Hindi", genre: "Period Drama", rating: 8.4, duration: "2h 25m", year: 2026, blurb: "A lavish period drama set in the lantern-lit world of Maharashtra's folk stage.", hue: 28, hue2: 350, banner: "/posters/eetha.jpg", trailer: "nCa4BGy3MJ8" },
  { id: "dune-part-three", title: "Dune: Part Three", lang: "English", genre: "Sci-Fi Epic", rating: 9.0, duration: "2h 50m", year: 2026, blurb: "The final chapter of Denis Villeneuve's saga as Paul Atreides faces the empire he built.", hue: 32, hue2: 200, banner: "/posters/dune3.jpg", trailer: "_k6RThkfv_c" },
  { id: "hunger-games-sunrise", title: "The Hunger Games: Sunrise on the Reaping", lang: "English", genre: "Dystopian Action", rating: 8.3, duration: "2h 35m", year: 2026, blurb: "Haymitch's story returns to Panem on the eve of the Second Quarter Quell.", hue: 20, hue2: 45, banner: "/posters/hunger-games.jpg", trailer: "fS35YSjopjE" },
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

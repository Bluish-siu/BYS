// Seat layouts modelled on real Mumbai multiplexes: every theatre has its own tiers, prices,
// seat types and aisle gaps. Rows are numbered from the screen (A) to the back.

export type Kind = "classic" | "prime" | "plus" | "perfect" | "legroom" | "recliner" | "sofa" | "lounger";

export type SectionDef = { name: string; kind: Kind; price: number; rows: number; seats: number; gaps?: number[] };
export type LayoutDef = { id: string; sections: SectionDef[] };

export type SeatSpec = { id: string; num: number; x: number; group: number };
export type RowSpec = { idx: number; letter: string; section: string; kind: Kind; price: number; seats: SeatSpec[]; y: number; z: number; step: number };
export type Layout = {
  id: string; rows: RowSpec[]; legend: { kind: Kind; name: string; price: number }[];
  zLast: number; yLast: number; depth: number; height: number; seatIds: string[]; byId: Map<string, RowSpec>;
};

export const KIND_COLOR: Record<Kind, string> = {
  classic: "#b3121f", prime: "#2c47b8", plus: "#7a2fc0", perfect: "#d9a21b",
  legroom: "#17896b", recliner: "#a8652c", sofa: "#1f7a86", lounger: "#8a4b2a",
};

const PITCH: Record<Kind, number> = { classic: 0.6, prime: 0.6, plus: 0.62, perfect: 0.62, legroom: 0.68, recliner: 0.95, sofa: 1.45, lounger: 1.1 };
const ROW_STEP: Record<Kind, number> = { classic: 0.85, prime: 0.85, plus: 0.88, perfect: 0.88, legroom: 1.05, recliner: 1.25, sofa: 1.3, lounger: 1.3 };
const GAP = 0.9;
const MAX_W = 11.8;

const defs: LayoutDef[] = [
  { // INOX R-City, Ghatkopar
    id: "ghatkopar",
    sections: [
      { name: "Classic Rows", kind: "classic", price: 540, rows: 2, seats: 18, gaps: [9] },
      { name: "Prime Rows", kind: "prime", price: 760, rows: 4, seats: 22, gaps: [3, 19] },
      { name: "Picture Perfect", kind: "perfect", price: 1010, rows: 5, seats: 22, gaps: [3, 19] },
      { name: "Prime Plus Rows", kind: "plus", price: 760, rows: 2, seats: 24, gaps: [3, 21] },
    ],
  },
  { // Cinepolis Lake Shore, Thane
    id: "thane",
    sections: [
      { name: "Normal", kind: "classic", price: 1100, rows: 1, seats: 18, gaps: [3, 14] },
      { name: "Executive", kind: "prime", price: 1150, rows: 3, seats: 20, gaps: [3, 16] },
      { name: "Premium", kind: "plus", price: 1200, rows: 5, seats: 22, gaps: [3, 19] },
      { name: "Premium XL", kind: "perfect", price: 1300, rows: 1, seats: 22, gaps: [3, 19] },
      { name: "Premium Plus", kind: "plus", price: 1250, rows: 5, seats: 22, gaps: [3, 19] },
    ],
  },
  { // PVR ICON, Phoenix Palladium, Lower Parel
    id: "palladium",
    sections: [
      { name: "Classic Rows", kind: "classic", price: 1120, rows: 2, seats: 19 },
      { name: "Prime Rows", kind: "prime", price: 1360, rows: 4, seats: 24, gaps: [4, 20] },
      { name: "Picture Perfect", kind: "perfect", price: 1650, rows: 4, seats: 24, gaps: [4, 20] },
      { name: "Prime Plus Rows", kind: "plus", price: 1200, rows: 3, seats: 24, gaps: [4, 20] },
      { name: "Recliner Rows", kind: "recliner", price: 2770, rows: 1, seats: 12, gaps: [4, 8] },
    ],
  },
  { // Miraj Cinemas IMAX, Wadala
    id: "wadala",
    sections: [
      { name: "3D Lounger", kind: "lounger", price: 950, rows: 1, seats: 10 },
      { name: "3D Recliner IMAX", kind: "recliner", price: 1600, rows: 1, seats: 12, gaps: [4, 8] },
      { name: "3D Executive", kind: "prime", price: 1150, rows: 5, seats: 26, gaps: [4, 22] },
      { name: "3D Sofa", kind: "sofa", price: 1450, rows: 3, seats: 8, gaps: [4] },
    ],
  },
  { // Maison INOX, Jio World Plaza, BKC
    id: "bkc",
    sections: [
      { name: "Prime", kind: "prime", price: 610, rows: 4, seats: 22, gaps: [6, 17] },
      { name: "Xtra Legroom", kind: "legroom", price: 850, rows: 1, seats: 12, gaps: [6] },
      { name: "Picture Perfect", kind: "perfect", price: 960, rows: 5, seats: 22, gaps: [6, 17] },
      { name: "Prime Plus", kind: "plus", price: 800, rows: 1, seats: 22, gaps: [6, 17] },
      { name: "Xtra Legroom", kind: "legroom", price: 850, rows: 2, seats: 12, gaps: [6] },
    ],
  },
];

export function buildLayout(def: LayoutDef): Layout {
  const rows: RowSpec[] = [];
  let z = 1.6, y = 0, r = 0;
  def.sections.forEach((sec, si) => {
    for (let i = 0; i < sec.rows; i++) {
      const step = ROW_STEP[sec.kind];
      // stadium rise so every row clears the headrests in front
      if (r > 0) { z += step + (i === 0 ? 0.4 : 0); y += i === 0 ? 0.6 : 0.45; }
      const gaps = sec.gaps ?? [];
      let pitch = PITCH[sec.kind];
      if (sec.seats * pitch + gaps.length * GAP > MAX_W) pitch = (MAX_W - gaps.length * GAP) / sec.seats;
      const total = sec.seats * pitch + gaps.length * GAP;
      const letter = String.fromCharCode(65 + r);
      const seats: SeatSpec[] = [];
      let x = -total / 2 + pitch / 2, group = 0;
      for (let n = 0; n < sec.seats; n++) {
        if (gaps.includes(n)) { x += GAP; group++; }
        seats.push({ id: `${letter}${n + 1}`, num: n + 1, x, group });
        x += pitch;
      }
      rows.push({ idx: r, letter, section: sec.name, kind: sec.kind, price: sec.price, seats, y, z, step });
      r++;
    }
    void si;
  });
  const last = rows[rows.length - 1];
  const legend: Layout["legend"] = [];
  def.sections.forEach((s) => { if (!legend.some((l) => l.kind === s.kind && l.price === s.price)) legend.push({ kind: s.kind, name: s.name, price: s.price }); });
  const byId = new Map<string, RowSpec>();
  rows.forEach((row) => row.seats.forEach((s) => byId.set(s.id, row)));
  return {
    id: def.id, rows, legend, zLast: last.z, yLast: last.y, depth: last.z + 1.8, height: Math.max(9, last.y + 5.2),
    seatIds: rows.flatMap((row) => row.seats.map((s) => s.id)), byId,
  };
}

const cache = new Map<string, Layout>();
export function getLayout(id: string): Layout {
  let l = cache.get(id);
  if (!l) { l = buildLayout(defs.find((d) => d.id === id) ?? defs[0]); cache.set(id, l); }
  return l;
}

export const seatPriceIn = (layout: Layout, id: string) => layout.byId.get(id)?.price ?? 0;

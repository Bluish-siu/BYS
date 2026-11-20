"use client";
import { MutableRefObject, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Movie } from "@/lib/data";
import { KIND_COLOR, Kind, Layout } from "@/lib/layouts";
import { makeScreenTexture } from "./PosterTexture";
import type { HallInput } from "./SeatHall";

// Real cinema ratios: IMAX is the tall 1.9:1 frame, everything else is the wide 2.39:1 scope frame.
export type ScreenSpec = { w: number; h: number; aspect: number; pos: THREE.Vector3 };
export const screenSpec = (format: string): ScreenSpec => {
  const aspect = format === "IMAX" ? 1.9 : 2.39;
  const w = 17.6, h = w / aspect; // wall to wall
  return { w, h, aspect, pos: new THREE.Vector3(0, 1.0 + h / 2, -2.9) };
};
const HALL_W = 18;
const HW = HALL_W / 2;

// ---------- seat models: each seat is two meshes (fabric + dark hardware) to keep draw calls low ----------
const rb = (w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0) =>
  new RoundedBoxGeometry(w, h, d, 3, r).rotateX(rx).translate(x, y, z);

type SeatGeo = { fabric: THREE.BufferGeometry; dark: THREE.BufferGeometry };
// Parts mix indexed and non-indexed geometry, so flatten them all before merging.
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
const geoCache = new Map<Kind, SeatGeo>();

function standard(w: number, backH: number): SeatGeo {
  const cup = new THREE.CylinderGeometry(0.035, 0.03, 0.05, 12).translate(w / 2 + 0.035, 0.63, -0.12);
  return {
    fabric: merge([
      rb(w, 0.16, 0.5, 0.06, 0, 0.42, -0.02),
      rb(w, backH, 0.13, 0.06, 0, 0.42 + backH / 2, 0.22, 0.14),
      rb(w * 0.8, 0.2, 0.15, 0.07, 0, 0.42 + backH + 0.1, 0.27, 0.14),
      ]),
    dark: merge([
      rb(0.07, 0.08, 0.46, 0.03, -(w / 2 + 0.035), 0.58, 0),
      rb(0.07, 0.08, 0.46, 0.03, w / 2 + 0.035, 0.58, 0),
      cup,
      rb(0.12, 0.34, 0.3, 0.02, 0, 0.17, 0.05),
      ]),
  };
}

function recliner(w: number, long: boolean): SeatGeo {
  return {
    fabric: merge([
      rb(w, 0.2, 0.52, 0.08, 0, 0.38, 0),
      rb(w, 0.78, 0.16, 0.08, 0, 0.78, 0.2, 0.28),
      rb(w * 0.82, long ? 0.1 : 0.09, long ? 0.62 : 0.34, 0.04, 0, 0.3, long ? -0.5 : -0.4, -0.25),
      ]),
    dark: merge([
      rb(0.12, 0.18, 0.5, 0.04, -(w / 2 + 0.06), 0.5, 0),
      rb(0.12, 0.18, 0.5, 0.04, w / 2 + 0.06, 0.5, 0),
      rb(0.14, 0.34, 0.3, 0.02, 0, 0.17, 0.05),
      ]),
  };
}

function sofa(w: number): SeatGeo {
  return {
    fabric: merge([
      rb(w, 0.26, 0.66, 0.09, 0, 0.36, -0.02),
      rb(w, 0.86, 0.2, 0.09, 0, 0.8, 0.26, 0.1),
      rb(0.5, 0.3, 0.12, 0.06, -w * 0.22, 0.66, 0.1, 0.3),
      rb(0.5, 0.3, 0.12, 0.06, w * 0.22, 0.66, 0.1, 0.3),
      ]),
    dark: merge([
      rb(0.16, 0.5, 0.7, 0.05, -(w / 2 + 0.08), 0.5, 0),
      rb(0.16, 0.5, 0.7, 0.05, w / 2 + 0.08, 0.5, 0),
      rb(0.9, 0.18, 0.4, 0.02, 0, 0.09, 0.05),
      ]),
  };
}

function getSeatGeo(kind: Kind): SeatGeo {
  let g = geoCache.get(kind);
  if (!g) {
    g = kind === "recliner" ? recliner(0.7, false)
      : kind === "lounger" ? recliner(0.85, true)
      : kind === "sofa" ? sofa(1.2)
      : kind === "legroom" ? standard(0.56, 0.62)
      : kind === "plus" || kind === "perfect" ? standard(0.52, 0.72)
      : standard(0.5, 0.64);
    geoCache.set(kind, g);
  }
  return g;
}

const mat = (color: string, rough: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, ...extra });
const leather = new Set<Kind>(["recliner", "lounger"]);
const kindMat = new Map<Kind, THREE.MeshStandardMaterial>();
const getKindMat = (k: Kind) => {
  let m = kindMat.get(k);
  if (!m) { m = mat("#" + new THREE.Color(KIND_COLOR[k]).lerp(new THREE.Color("#15151c"), 0.38).getHexString(), leather.has(k) ? 0.5 : 0.9); kindMat.set(k, m); }
  return m;
};
const SOLD = mat("#3b3d47", 0.95);
const PICKED = mat("#2ee08a", 0.6, { emissive: new THREE.Color("#18c46c"), emissiveIntensity: 0.9 });
const DARK = mat("#17171c", 0.5, { metalness: 0.3 });

function Seat({ kind, state, x, y, z, onPick, input }: {
  kind: Kind; state: "free" | "sold" | "picked"; x: number; y: number; z: number; onPick: () => void; input: MutableRefObject<HallInput>;
}) {
  const g = getSeatGeo(kind);
  const m = state === "sold" ? SOLD : state === "picked" ? PICKED : getKindMat(kind);
  return (
    <group position={[x, y, z]} onClick={(e) => { e.stopPropagation(); if (state !== "sold" && !input.current.dragged) onPick(); }}>
      <mesh geometry={g.fabric} material={m} />
      <mesh geometry={g.dark} material={DARK} />
    </group>
  );
}

// ---------- procedural textures ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const carpet = (rx: number, ry: number) => canvasTex(256, 256, (g) => {
  g.fillStyle = "#14161f"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.12)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = "rgba(201,161,74,0.16)"; g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 64 + 32, y = j * 64 + 32;
    g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.closePath(); g.stroke();
  }
}, [rx, ry]);

const curtain = () => canvasTex(256, 64, (g) => {
  for (let x = 0; x < 256; x += 2) {
    const wave = 0.5 + 0.5 * Math.sin((x / 256) * Math.PI * 2 * 8);
    g.fillStyle = `rgb(${Math.round(70 + wave * 120)},${Math.round(8 + wave * 12)},${Math.round(16 + wave * 22)})`;
    g.fillRect(x, 0, 2, 64);
  }
});

const wallPanel = (rx: number) => canvasTex(128, 128, (g) => {
  g.fillStyle = "#2a2d3c"; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = "#3b4054"; g.fillRect(x + 2, 0, 12, 128);
    g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(x + 2, 0, 2, 128);
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x + 12, 0, 2, 128);
  }
}, [rx, 1]);

const ceilingTex = (rx: number, ry: number) => canvasTex(128, 128, (g) => {
  g.fillStyle = "#12131a"; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#1c1e28"; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  g.fillStyle = "#ffe2b0"; g.beginPath(); g.arc(64, 64, 3, 0, Math.PI * 2); g.fill();
}, [rx, ry]);


// Soft radial glow used behind the screen.
const haloTex = () => canvasTex(256, 256, (g) => {
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, "rgba(255,255,255,0.9)"); r.addColorStop(0.5, "rgba(255,255,255,0.25)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
});

export function Hall({ layout, format, movie, sold, picked, onPick, input }: {
  layout: Layout; format: string; movie: Movie; sold: Set<string>; picked: string[]; onPick: (id: string) => void; input: MutableRefObject<HallInput>;
}) {
  const D = layout.depth, H = layout.height;
  const L = D + 3.8, cz = (D - 3.8) / 2;
  const spec = useMemo(() => screenSpec(format), [format]);
  const screenTex = useMemo(() => makeScreenTexture(movie, spec.aspect), [movie, spec]);
  const halo = useMemo(haloTex, []);
  const tex = useMemo(() => ({
    floor: carpet(5, Math.round(L / 2.4)), backWall: wallPanel(9), step: carpet(4, 1), curtain: curtain(), wall: wallPanel(Math.round(L / 1.5)), ceiling: ceilingTex(6, Math.round(L / 2.2)),
  }), [L]);
  // Slightly curved screen: edges bend toward the audience like a real cinema screen.
  const screenGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(spec.w, spec.h, 64, 1);
    if (movie.trailer) return g; // a playing trailer sits on a flat screen so the video lines up
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2) * 0.008);
    g.computeVertexNormals();
    return g;
  }, [spec, movie.trailer]);
  const sy = spec.pos.y, sz = spec.pos.z;
  const r0 = layout.rows[0], rN = layout.rows[layout.rows.length - 1];
  const hf = Math.min(H - 2, sy + spec.h / 2 + 1.4); // ceiling is low above the screen and rises toward the back
  const slopeLen = Math.hypot(rN.z - r0.z, rN.y - r0.y);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, H - 1, D * 0.3]} intensity={45} color="#ffd9b0" />
      <pointLight position={[0, H - 1, D * 0.75]} intensity={35} color="#ffd9b0" />
      <pointLight position={[0, sy, sz + 2.5]} intensity={22} color={`hsl(${movie.hue} 70% 75%)`} />

      <mesh geometry={screenGeo} position={spec.pos.toArray()}>
        {movie.trailer
          ? <meshBasicMaterial colorWrite={false} side={THREE.DoubleSide} /> /* transparent cut-out: the trailer plays behind the canvas */
          : <meshBasicMaterial map={screenTex} toneMapped={false} side={THREE.DoubleSide} />}
      </mesh>
      {/* black frame and masking panels, glowing halo and a light strip under the screen */}
      <mesh position={[0, sy, sz - 0.06]}><boxGeometry args={[HALL_W - 0.05, spec.h + 0.5, 0.1]} /><meshStandardMaterial color="#030305" roughness={0.9} /></mesh>
      <mesh position={[0, sy, sz - 0.2]}>
        <planeGeometry args={[spec.w * 1.5, spec.h * 1.7]} />
        <meshBasicMaterial map={halo} color={`hsl(${movie.hue} 85% 55%)`} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, sy - spec.h / 2 - 0.5, sz + 0.05]}><boxGeometry args={[spec.w, 0.04, 0.04]} /><meshBasicMaterial color={`hsl(${movie.hue} 90% 70%)`} toneMapped={false} /></mesh>
      <mesh position={[0, 0.2, -2.4]}><boxGeometry args={[HALL_W - 0.6, 0.4, 2.2]} /><meshStandardMaterial color="#0e0e12" roughness={0.6} /></mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}><planeGeometry args={[HALL_W, L]} /><meshStandardMaterial map={tex.floor} roughness={1} /></mesh>
      <mesh position={[0, H / 2, -3.8]}><planeGeometry args={[HALL_W, H]} /><meshStandardMaterial map={tex.backWall} roughness={0.95} /></mesh>
      <mesh position={[0, H / 2, D]} rotation={[0, Math.PI, 0]}><planeGeometry args={[HALL_W, H]} /><meshStandardMaterial map={tex.backWall} roughness={0.9} /></mesh>
      {/* projection booth windows high on the back wall */}
      {[-3.6, -1.2, 1.2, 3.6].map((x) => (
        <mesh key={x} position={[x, layout.yLast + 3.5, D - 0.03]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.9, 0.5]} /><meshBasicMaterial color="#a9dcff" toneMapped={false} /></mesh>
      ))}
      {[-(HW - 0.9), HW - 0.9].map((x) => (
        <mesh key={x} position={[x, layout.yLast + 2.4, D - 0.03]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.6, 0.22]} /><meshBasicMaterial color="#27e07a" toneMapped={false} /></mesh>
      ))}
      <pointLight position={[0, layout.yLast + 3, D - 1]} intensity={22} color="#ffd9b0" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * HW, H / 2, cz]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[L, H]} /><meshStandardMaterial map={tex.wall} roughness={0.9} /></mesh>
          {[0.9, 2.6].map((o) => (
            <mesh key={o} position={[s * (HW - 0.06), (r0.y + rN.y) / 2 + o, (r0.z + rN.z) / 2]} rotation={[-Math.atan2(rN.y - r0.y, rN.z - r0.z), 0, 0]}>
              <boxGeometry args={[0.05, o < 1 ? 0.05 : 0.03, slopeLen]} /><meshBasicMaterial color={o < 1 ? "#ffcf8a" : "#8fb4ff"} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, (hf + H) / 2, cz]} rotation={[Math.PI / 2 - Math.atan2(H - hf, L), 0, 0]}><planeGeometry args={[HALL_W, Math.hypot(L, H - hf)]} /><meshStandardMaterial map={tex.ceiling} emissive="#ffd9a0" emissiveMap={tex.ceiling} emissiveIntensity={0.25} /></mesh>
      <mesh position={[-(HW - 0.2), 3.4, 0.6]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.6, 0.22]} /><meshBasicMaterial color="#27e07a" toneMapped={false} /></mesh>

      {layout.rows.map((row) => (
        <group key={row.letter}>
          <mesh position={[0, row.y / 2, row.z]}>
            <boxGeometry args={[HALL_W - 0.4, Math.max(row.y, 0.02), row.step + 0.02]} />
            <meshStandardMaterial map={tex.step} roughness={1} />
          </mesh>
          {/* amber step lights in every aisle gap */}
          {row.seats.map((s, i) => i > 0 && s.group !== row.seats[i - 1].group ? (
            <mesh key={s.id} position={[(s.x + row.seats[i - 1].x) / 2, row.y + 0.01, row.z - row.step / 2 + 0.05]}>
              <boxGeometry args={[0.7, 0.02, 0.04]} /><meshBasicMaterial color="#ffb347" toneMapped={false} />
            </mesh>
          ) : null)}
          {row.seats.map((s) => (
            <Seat key={s.id} kind={row.kind} x={s.x} y={row.y} z={row.z} input={input}
              state={sold.has(s.id) ? "sold" : picked.includes(s.id) ? "picked" : "free"} onPick={() => onPick(s.id)} />
          ))}
        </group>
      ))}
    </>
  );
}

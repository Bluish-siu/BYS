"use client";
import { MutableRefObject, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Movie } from "@/lib/data";
import { KIND_COLOR, Kind, Layout, RowSpec } from "@/lib/layouts";
import { makeScreenTexture } from "./PosterTexture";
import type { HallInput } from "./SeatHall";

export const SCREEN_POS = new THREE.Vector3(0, 3.5, -2.9);
const HALL_W = 13;

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
  if (!m) { m = mat(KIND_COLOR[k], leather.has(k) ? 0.45 : 0.92); kindMat.set(k, m); }
  return m;
};
const SOLD = mat("#2b2b31", 0.95);
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
  g.fillStyle = "#3a0a12"; g.fillRect(0, 0, 256, 256);
  for (let i = -2; i < 6; i++) for (let j = -2; j < 6; j++) {
    g.strokeStyle = "#8c1a28"; g.lineWidth = 6;
    g.beginPath(); g.arc(i * 64 + 32, j * 64 + 32, 28, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "#5c0f1b";
    g.beginPath(); g.arc(i * 64 + 32, j * 64 + 32, 14, 0, Math.PI * 2); g.stroke();
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
  g.fillStyle = "#14101a"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#c9a14a"; g.fillRect(0, 0, 4, 128);
  g.fillStyle = "#1c1624"; g.fillRect(14, 0, 100, 128);
}, [rx, 1]);

const ceilingTex = (rx: number, ry: number) => canvasTex(128, 128, (g) => {
  g.fillStyle = "#0b0b10"; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#1a1a22"; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  g.fillStyle = "#ffd9a0"; g.beginPath(); g.arc(64, 64, 4, 0, Math.PI * 2); g.fill();
}, [rx, ry]);

const groundNear = (rows: RowSpec[], z: number) => rows.reduce((b, r) => (Math.abs(r.z - z) < Math.abs(b.z - z) ? r : b), rows[0]).y;

export function Hall({ layout, movie, sold, picked, onPick, input }: {
  layout: Layout; movie: Movie; sold: Set<string>; picked: string[]; onPick: (id: string) => void; input: MutableRefObject<HallInput>;
}) {
  const D = layout.depth, H = layout.height;
  const L = D + 3.8, cz = (D - 3.8) / 2;
  const screenTex = useMemo(() => makeScreenTexture(movie), [movie]);
  const tex = useMemo(() => ({
    floor: carpet(5, Math.round(L / 2.4)), step: carpet(4, 1), curtain: curtain(), wall: wallPanel(Math.round(L / 1.5)), ceiling: ceilingTex(6, Math.round(L / 2.2)),
  }), [L]);
  // Slightly curved screen: edges bend toward the audience like a real cinema screen.
  const screenGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(9.8, 4.17, 48, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2) * 0.018);
    g.computeVertexNormals();
    return g;
  }, []);
  const sy = SCREEN_POS.y, sz = SCREEN_POS.z;
  const sconceZ = useMemo(() => { const a: number[] = []; for (let z = 2; z < D - 1; z += 3.2) a.push(z); return a; }, [D]);

  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[0, H - 1, D * 0.3]} intensity={45} color="#ffd9b0" />
      <pointLight position={[0, H - 1, D * 0.75]} intensity={35} color="#ffd9b0" />
      <pointLight position={[0, sy, sz + 2.5]} intensity={22} color={`hsl(${movie.hue} 70% 75%)`} />

      <mesh geometry={screenGeo} position={SCREEN_POS.toArray()}>
        <meshBasicMaterial map={screenTex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, sy, sz - 0.05]}><boxGeometry args={[11.4, 5.2, 0.1]} /><meshStandardMaterial color="#050507" roughness={0.9} /></mesh>
      <mesh position={[0, 0.2, -2.4]}><boxGeometry args={[12.6, 0.4, 2.2]} /><meshStandardMaterial color="#0e0e12" roughness={0.6} /></mesh>
      {[-5.6, 5.6].map((x) => (
        <mesh key={x} position={[x, 2.4, -3.2]}><boxGeometry args={[0.8, 2.4, 0.6]} /><meshStandardMaterial color="#0b0b0f" roughness={0.5} metalness={0.3} /></mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}><planeGeometry args={[HALL_W, L]} /><meshStandardMaterial map={tex.floor} roughness={1} /></mesh>
      <mesh position={[0, H / 2, -3.8]}><planeGeometry args={[HALL_W, H]} /><meshStandardMaterial color="#09090d" /></mesh>
      <mesh position={[0, H / 2, D]} rotation={[0, Math.PI, 0]}><planeGeometry args={[HALL_W, H]} /><meshStandardMaterial color="#0c0c12" /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 6.5, H / 2, cz]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[L, H]} /><meshStandardMaterial map={tex.wall} roughness={0.9} /></mesh>
          <mesh position={[s * 6.4, 4.2, -1.2]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[5.2, 8]} /><meshStandardMaterial map={tex.curtain} roughness={1} /></mesh>
          {sconceZ.map((z) => (
            <mesh key={z} position={[s * 6.42, groundNear(layout.rows, z) + 2.4, z]}>
              <boxGeometry args={[0.08, 0.5, 0.14]} /><meshBasicMaterial color="#ffd9a0" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, H, cz]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[HALL_W, L]} /><meshStandardMaterial map={tex.ceiling} emissive="#ffd9a0" emissiveMap={tex.ceiling} emissiveIntensity={0.25} /></mesh>
      <mesh position={[-6.3, 3.4, 0.6]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.6, 0.22]} /><meshBasicMaterial color="#27e07a" toneMapped={false} /></mesh>

      {layout.rows.map((row) => (
        <group key={row.letter}>
          <mesh position={[0, row.y / 2, row.z]}>
            <boxGeometry args={[12.8, Math.max(row.y, 0.02), row.step + 0.02]} />
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

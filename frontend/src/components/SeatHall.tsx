"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Movie } from "@/lib/data";
import type { Layout } from "@/lib/layouts";
import { Hall, screenSpec } from "./HallModel";

export type CamMode = "overview" | "stage" | "balcony" | "bird" | "seat" | "walk";

// Shared with the page: on-screen walk buttons write here, drag state is read by seats.
export type HallInput = { f: boolean; b: boolean; l: boolean; r: boolean; dragged: boolean };
export const newInput = (): HallInput => ({ f: false, b: false, l: false, r: false, dragged: false });

const EYE = 1.6;
const SIT_EYE = 1.22; // seated eye height, just above the headrest tops

const angles = (pos: THREE.Vector3, look: THREE.Vector3) => {
  const d = look.clone().sub(pos);
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
};
const lerpAngle = (a: number, b: number, k: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

type Rig = { layout: Layout; format: string; mode: CamMode; seat: string | null; input: MutableRefObject<HallInput>; onWalk: () => void };

function CameraRig({ layout, format, mode, seat, input, onWalk }: Rig) {
  const screen = useMemo(() => screenSpec(format), [format]);
  const { camera, gl, size } = useThree();
  const pos = useRef(camera.position.clone());
  // Opens looking straight down with the screen at the bottom, matching the 2D seat map, then swoops in.
  const yaw = useRef(Math.PI);
  const pitch = useRef(-1.5);
  const swoop = useRef(true);
  const goalPos = useRef<THREE.Vector3 | null>(null);
  const goalAng = useRef<{ yaw: number; pitch: number } | null>(null);
  const keys = useRef({ f: false, b: false, l: false, r: false });
  const drag = useRef<{ x: number; y: number; total: number } | null>(null);

  const bounds = useMemo(() => ({ x: 8.3, yMin: 0.5, yMax: layout.height - 0.4, zMin: -3.6, zMax: layout.zLast + 0.7 }), [layout]);
  const presets = useMemo(() => {
    const D = layout.depth;
    return {
      overview: { pos: new THREE.Vector3(0, Math.min(layout.yLast + 4.2, layout.height - 0.6), layout.zLast + 0.7), look: new THREE.Vector3(0, 1.8, D * 0.3) },
      stage: { pos: new THREE.Vector3(0, 1.7, -1.6), look: new THREE.Vector3(0, 2.6 + layout.yLast * 0.5, D * 0.6) },
      balcony: { pos: new THREE.Vector3(0, layout.yLast + 1.9, layout.zLast + 0.6), look: screen.pos.clone() },
      bird: { pos: new THREE.Vector3(0, layout.height - 0.7, D * 0.45), look: new THREE.Vector3(0, 0, D * 0.45 - 0.1) },
    };
  }, [layout]);
  const groundAt = (z: number) => {
    const first = layout.rows[0];
    if (z < first.z - 0.6) return 0;
    return layout.rows.reduce((b, r) => (Math.abs(r.z - z) < Math.abs(b.z - z) ? r : b), first).y;
  };

  // 360-degree look: drag anywhere on the canvas to turn the head, no limits on yaw.
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, total: 0 }; input.current.dragged = false; };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY; d.total += Math.abs(dx) + Math.abs(dy);
      if (d.total > 6) { input.current.dragged = true; goalAng.current = null; }
      yaw.current += dx * 0.0045;
      pitch.current = THREE.MathUtils.clamp(pitch.current + dy * 0.0045, -1.3, 1.3);
    };
    const up = () => { drag.current = null; setTimeout(() => { input.current.dragged = false; }, 0); };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [gl, input]);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = { w: "f", arrowup: "f", s: "b", arrowdown: "b", a: "l", arrowleft: "l", d: "r", arrowright: "r" };
    const set = (v: boolean) => (e: KeyboardEvent) => {
      const k = map[e.key.toLowerCase()];
      if (!k || (e.target as HTMLElement)?.tagName === "INPUT") return;
      keys.current[k] = v;
      if (v) onWalk();
    };
    const dn = set(true), up = set(false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [onWalk]);

  // Each mode change sets a glide target. Walking has none: you stay where you are.
  useEffect(() => {
    if (mode === "walk") {
      goalPos.current = null; goalAng.current = null;
      pos.current.y = groundAt(pos.current.z) + EYE;
      return;
    }
    let p: THREE.Vector3, look: THREE.Vector3;
    const row = seat ? layout.byId.get(seat) : undefined;
    const s = row?.seats.find((x) => x.id === seat);
    if (mode === "seat" && row && s) {
      p = new THREE.Vector3(s.x, row.y + SIT_EYE, row.z + 0.12);
      look = screen.pos.clone();
    } else {
      const pr = presets[mode === "seat" ? "overview" : mode];
      p = pr.pos; look = pr.look;
    }
    goalPos.current = p.clone();
    goalAng.current = angles(p, look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seat, layout, screen]);

  useFrame((_, dt) => {
    // the first move from the map view is a slower, cinematic swoop
    const k = Math.min(1, dt * (swoop.current ? 1.6 : 3.2));
    if (goalPos.current) {
      // Straight-line glide: a curved path would cut through walls and seats.
      pos.current.lerp(goalPos.current, k);
      if (pos.current.distanceTo(goalPos.current) < 0.02) { goalPos.current = null; swoop.current = false; }
    }
    if (goalAng.current) {
      yaw.current = lerpAngle(yaw.current, goalAng.current.yaw, k);
      pitch.current += (goalAng.current.pitch - pitch.current) * k;
      if (Math.abs(pitch.current - goalAng.current.pitch) < 0.002) goalAng.current = null;
    }
    if (mode === "walk") {
      const f = (keys.current.f || input.current.f ? 1 : 0) - (keys.current.b || input.current.b ? 1 : 0);
      const s = (keys.current.r || input.current.r ? 1 : 0) - (keys.current.l || input.current.l ? 1 : 0);
      if (f || s) {
        const speed = 3.2 * dt;
        pos.current.x += (-Math.sin(yaw.current) * f + Math.cos(yaw.current) * s) * speed;
        pos.current.z += (-Math.cos(yaw.current) * f - Math.sin(yaw.current) * s) * speed;
      }
      pos.current.y += (groundAt(pos.current.z) + EYE - pos.current.y) * Math.min(1, dt * 10);
    }
    pos.current.set(
      THREE.MathUtils.clamp(pos.current.x, -bounds.x, bounds.x),
      THREE.MathUtils.clamp(pos.current.y, bounds.yMin, bounds.yMax),
      THREE.MathUtils.clamp(pos.current.z, bounds.zMin, bounds.zMax),
    );
    camera.position.copy(pos.current);
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch.current, yaw.current, 0);
    // Sitting down, you focus on the screen: zoom in so it spans about 70 degrees of your view, whatever the window shape.
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const wantFov = mode === "seat"
      ? THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(35)) / aspect)), 40, 85)
      : 65;
    if (Math.abs(cam.fov - wantFov) > 0.05) { cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  });
  return null;
}

// Projects the flat screen's corners to pixels and warps the trailer iframe (behind the canvas) onto them.
function solve(A: number[][], b: number[]) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let m = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let t = b[i];
    for (let c = i + 1; c < n; c++) t -= A[i][c] * x[c];
    x[i] = t / A[i][i];
  }
  return x;
}

const IFW = 1600;
function TrailerLink({ format, frame }: { format: string; frame: MutableRefObject<HTMLIFrameElement | null> }) {
  const spec = useMemo(() => screenSpec(format), [format]);
  const ifh = IFW * 9 / 16; // the video is 16:9; it is scaled to cover the whole screen and the 3D frame trims the overflow
  const corners = useMemo(() => {
    const cw = Math.max(spec.w, (spec.h * 16) / 9) * 1.03, ch = (cw * 9) / 16;
    return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => new THREE.Vector3(sx * cw / 2, spec.pos.y + sy * ch / 2, spec.pos.z));
  }, [spec]);
  const { camera, size } = useThree();
  useFrame(() => {
    const el = frame.current;
    if (!el) return;
    camera.updateMatrixWorld();
    const pts: number[][] = [];
    for (const c of corners) {
      const v = c.clone().applyMatrix4(camera.matrixWorldInverse);
      if (v.z > -0.1) { el.style.opacity = "0"; return; } // screen behind the camera
      v.applyMatrix4(camera.projectionMatrix);
      // applyMatrix4 on a Vector3 divides by w already
      pts.push([(v.x * 0.5 + 0.5) * size.width, (-v.y * 0.5 + 0.5) * size.height]);
    }
    const src = [[0, 0], [IFW, 0], [IFW, ifh], [0, ifh]];
    const A: number[][] = [], b: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = pts[i];
      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
    }
    const h = solve(A, b);
    el.style.opacity = "1";
    el.style.width = IFW + "px"; el.style.height = ifh + "px";
    el.style.transform = `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
  });
  return null;
}

export default function SeatHall(props: {
  layout: Layout; format: string; movie: Movie; sold: Set<string>; picked: string[]; onPick: (id: string) => void;
  mode: CamMode; seat: string | null; input: MutableRefObject<HallInput>; onWalk: () => void;
}) {
  const trailer = props.movie.trailer;
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [muted, setMuted] = useState(true);
  const yt = (func: string, args: unknown[] = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  // Follow the player's real mute state, and try to turn sound on by itself (allowed once you have tapped the page).
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (typeof e.origin !== "string" || !e.origin.includes("youtube.com") || typeof e.data !== "string") return;
      try { const d = JSON.parse(e.data); if (typeof d?.info?.muted === "boolean") setMuted(d.info.muted); } catch { /* not ours */ }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const onLoad = () => {
    const w = frame.current?.contentWindow;
    w?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    [1200, 2800, 5000].forEach((t) => setTimeout(() => { yt("unMute"); yt("setVolume", [100]); yt("playVideo"); }, t));
  };
  const toggleSound = () => { if (muted) { yt("unMute"); yt("setVolume", [100]); yt("playVideo"); } else yt("mute"); };
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#050508", overflow: "hidden" }}>
      {trailer && (
        <iframe
          ref={frame}
          onLoad={onLoad}
          title="Trailer"
          src={`https://www.youtube.com/embed/${trailer}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer}&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&enablejsapi=1`}
          allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: "absolute", left: 0, top: 0, border: 0, transformOrigin: "0 0", width: IFW, height: (IFW * 9) / 16, opacity: 0, pointerEvents: "none", background: "#000" }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, opacity: trailer ? 0.999 : 1 }}>
        <Canvas camera={{ position: [0, props.layout.height - 0.7, (props.layout.rows[0].z + props.layout.zLast) / 2], fov: 65, far: 80 }} dpr={[1, 1.5]} gl={{ alpha: true, premultipliedAlpha: true }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)} style={{ touchAction: "none", background: "transparent" }}>
          {!trailer && <color attach="background" args={["#050508"]} />}
          <CameraRig layout={props.layout} format={props.format} mode={props.mode} seat={props.seat} input={props.input} onWalk={props.onWalk} />
          {trailer && <TrailerLink format={props.format} frame={frame} />}
          <Hall layout={props.layout} format={props.format} movie={props.movie} sold={props.sold} picked={props.picked} onPick={props.onPick} input={props.input} />
        </Canvas>
      </div>
      {trailer && (
        <button onClick={toggleSound} className="btn btn-ghost absolute bottom-3 left-3 z-10 !px-3 !py-1.5 text-xs backdrop-blur-md">{muted ? "🔇 Tap for sound" : "🔊 Mute"}</button>
      )}
    </div>
  );
}

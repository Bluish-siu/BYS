"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, Sparkles, Stars } from "@react-three/drei";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { movies } from "@/lib/data";
import { makeBannerTexture } from "./PosterTexture";

const featured = movies.slice(0, 6);
const N = featured.length;
const STEP = (Math.PI * 2) / N;
const R = 6;                 // ring radius: the camera stands at the centre, inside the ring
const SCREEN_ARC = STEP * 0.94;
const SCREEN_W = R * SCREEN_ARC;
const SCREEN_H = SCREEN_W / 2;
const AUTO_MS = 5200;
const INTRO_MS = 2600;

type HeroApi = { go: (i: number) => void };

// A screen bent around the viewer, like an IMAX screen seen from the middle of the hall.
function curvedPlane(w: number, h: number, radius: number) {
  const g = new THREE.PlaneGeometry(w, h, 48, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / radius;
    p.setXYZ(i, radius * Math.sin(a), p.getY(i), -radius * Math.cos(a));
  }
  g.computeVertexNormals();
  return g;
}

// Soft white rectangle used as a fake bloom halo behind each screen.
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.filter = "blur(18px)";
  g.fillStyle = "#fff";
  g.fillRect(40, 30, 176, 68);
  return new THREE.CanvasTexture(c);
}

const ease = (t: number) => 1 - Math.pow(1 - t, 4);

function Ring({ onFront, api }: { onFront: (i: number) => void; api: MutableRefObject<HeroApi | null> }) {
  const router = useRouter();
  const { gl, camera, size } = useThree();
  const ring = useRef<THREE.Group>(null!);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const vel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const moved = useRef(0);
  const timer = useRef(0);
  const lastFront = useRef(-1);
  const born = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const textures = useMemo(() => featured.map(makeBannerTexture), []);
  const screenGeo = useMemo(() => curvedPlane(SCREEN_W, SCREEN_H, R), []);
  // The halo sits well behind the screen: the front screen scales up 6% about the ring centre and must stay in front of it.
  const glowGeo = useMemo(() => curvedPlane(SCREEN_W * 1.35, SCREEN_H * 1.7, R + 1), []);
  const glowTex = useMemo(glowTexture, []);
  const screens = useRef<(THREE.Mesh | null)[]>([]);
  const glows = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const frontIndex = () => ((Math.round(-angle.current / STEP) % N) + N) % N;
  const rotateTo = (i: number) => {
    // pick the nearest equivalent angle so the ring turns the short way
    const want = -i * STEP;
    const k = Math.round((angle.current - want) / (Math.PI * 2));
    target.current = want + k * Math.PI * 2;
    timer.current = 0;
  };
  api.current = { go: (i) => { vel.current = 0; rotateTo(i); } };

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { dragging.current = true; lastX.current = e.clientX; moved.current = 0; vel.current = 0; target.current = null; };
    const move = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      moved.current += Math.abs(dx);
      angle.current += dx * 0.004;
      vel.current = dx * 0.004;
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (Math.abs(vel.current) < 0.002) { vel.current = 0; rotateTo(frontIndex()); }
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useFrame((state, dt) => {
    if (born.current === null) born.current = state.clock.elapsedTime;
    const t = Math.min(1, ((state.clock.elapsedTime - born.current) * 1000) / INTRO_MS);
    const e = ease(t);

    if (!dragging.current) {
      if (t >= 1) timer.current += dt * 1000;
      if (Math.abs(vel.current) > 0.0005) {
        angle.current += vel.current;
        vel.current *= 0.93;
        if (Math.abs(vel.current) <= 0.0005) { vel.current = 0; rotateTo(frontIndex()); }
      } else if (target.current !== null) {
        angle.current += (target.current - angle.current) * Math.min(1, dt * 5);
        if (Math.abs(target.current - angle.current) < 0.0008) { angle.current = target.current; target.current = null; }
      } else if (timer.current > AUTO_MS) {
        rotateTo(frontIndex() + 1);
      }
    } else timer.current = 0;

    // Intro: the ring spins in from behind you and rises out of the floor.
    ring.current.rotation.y = angle.current - (1 - e) * Math.PI * 1.2;
    ring.current.position.y = -(1 - e) * 4;

    const f = frontIndex();
    if (f !== lastFront.current) { lastFront.current = f; onFront(f); }
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
    featured.forEach((_, i) => {
      const a = i * STEP + angle.current;
      const c = Math.max(0, Math.cos(a));
      const front = c ** 8;
      mats.current[i]?.color.setScalar(0.3 + 0.7 * c * c);
      glows.current[i]?.color.setHSL(featured[i].hue / 360, 0.9, 0.55);
      if (glows.current[i]) glows.current[i]!.opacity = (0.15 + front * 0.85) * pulse * e;
      screens.current[i]?.scale.setScalar(1 + front * 0.06);
    });

    // Lens: wide enough on phones to see the whole screen, a dolly-in during the intro, and mouse parallax.
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const fit = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) / aspect));
    const fov = THREE.MathUtils.clamp(fit, 40, 100) + (1 - e) * 30;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const px = dragging.current ? 0 : pointer.current.x, py = pointer.current.y;
    cam.rotation.y += (-px * 0.07 - cam.rotation.y) * Math.min(1, dt * 3);
    cam.rotation.x += (-py * 0.04 + 0.07 - cam.rotation.x) * Math.min(1, dt * 3);
  });

  return (
    <group ref={ring}>
      {featured.map((m, i) => (
        <group key={m.id} rotation={[0, i * STEP, 0]}>
          <mesh geometry={glowGeo} position={[0, 0.75, 0]}>
            <meshBasicMaterial ref={(r) => { glows.current[i] = r; }} map={glowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh
            ref={(r) => { screens.current[i] = r; }}
            geometry={screenGeo}
            position={[0, 0.75, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (moved.current > 6) return;
              if (frontIndex() === i) router.push(`/movie/${m.id}`);
              else rotateTo(i);
            }}
          >
            <meshBasicMaterial ref={(r) => { mats.current[i] = r; }} map={textures[i]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -SCREEN_H / 2 - 0.3, 0]}>
      <circleGeometry args={[40, 64]} />
      <MeshReflectorMaterial
        blur={[400, 120]} resolution={512} mixBlur={1} mixStrength={25} roughness={1}
        depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#07070c" metalness={0.6} mirror={0.6}
      />
    </mesh>
  );
}

export default function Hero() {
  const [front, setFront] = useState(0);
  const api = useRef<HeroApi | null>(null);
  const m = featured[front];
  return (
    <section
      className="relative h-[calc(100svh-57px)] min-h-[560px] w-full select-none overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 35%, hsl(${m.hue} 70% 22%), #05050a 70%)`, transition: "background 1s" }}
    >
      <Canvas camera={{ position: [0, 0, 0.01], fov: 76, near: 0.1, far: 200 }} dpr={[1, 1.75]} style={{ touchAction: "pan-y" }}>
        <fog attach="fog" args={["#05050a", 14, 60]} />
        <ambientLight intensity={0.6} />
        <Stars radius={70} depth={40} count={3500} factor={3} fade speed={0.6} />
        <Sparkles count={120} scale={[16, 7, 16]} size={2.2} speed={0.35} opacity={0.6} color="#ffe6c4" />
        <Ring onFront={setFront} api={api} />
        <Floor />
      </Canvas>

      {/* top badge */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] font-semibold tracking-[0.25em] backdrop-blur md:left-8 md:top-6">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> NOW SHOWING · IMAX 3D
      </div>

      {/* title block */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/80 to-transparent px-5 pb-5 pt-20 md:px-12 md:pb-8">
        <div key={m.id} className="reveal mx-auto max-w-5xl text-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/60 md:text-xs">{m.lang} · {m.genre} · ★ {m.rating}</p>
          <h1 className="mt-1 text-5xl font-black leading-none tracking-tight text-white [text-shadow:0_6px_40px_rgba(0,0,0,0.9)] sm:text-6xl md:text-7xl">{m.title}</h1>
          <p className="mx-auto mt-2 hidden max-w-xl text-sm text-white/70 sm:block md:text-base">{m.blurb}</p>
          <div className="pointer-events-auto mt-4 flex justify-center gap-3">
            <Link href={`/movie/${m.id}`} className="btn btn-brand px-7 py-3 text-base shadow-[0_0_40px_rgba(255,61,90,0.55)]">Book tickets</Link>
            <Link href="/movies" className="btn btn-ghost px-6 py-3 text-base backdrop-blur">All movies</Link>
          </div>
        </div>
        {/* autoplay progress, one bar per screen */}
        <div className="pointer-events-auto mx-auto mt-5 flex max-w-md gap-2">
          {featured.map((f, i) => (
            <button key={f.id} aria-label={`Show ${f.title}`} onClick={() => api.current?.go(i)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
              {i === front && <span key={`${f.id}-${front}`} className="hero-progress block h-full rounded-full bg-white" />}
            </button>
          ))}
        </div>
        <p className="mt-3 hidden text-center text-xs text-white/40 md:block">Drag to spin the ring · tap a side screen to bring it forward · tap the front screen to book</p>
      </div>
    </section>
  );
}

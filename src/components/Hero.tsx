"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { movies } from "@/lib/data";
import { makeBannerTexture } from "./PosterTexture";

const featured = movies.slice(0, 6);
const N = featured.length;
const STEP = (Math.PI * 2) / N;
const RADIUS = 6.2;
const AUTO_MS = 5200;

function Ring({ onFront }: { onFront: (i: number) => void }) {
  const router = useRouter();
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null!);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const vel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const moved = useRef(0);
  const timer = useRef(0);
  const lastFront = useRef(-1);
  const textures = useMemo(() => featured.map(makeBannerTexture), []);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const frontIndex = () => ((Math.round(-angle.current / STEP) % N) + N) % N;
  const rotateTo = (i: number) => {
    // pick the nearest equivalent angle so the ring turns the short way
    const want = -i * STEP;
    const k = Math.round((angle.current - want) / (Math.PI * 2));
    target.current = want + k * Math.PI * 2;
  };

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { dragging.current = true; lastX.current = e.clientX; moved.current = 0; vel.current = 0; target.current = null; };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      moved.current += Math.abs(dx);
      angle.current += dx * 0.006;
      vel.current = dx * 0.006;
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

  useFrame((_, dt) => {
    if (!dragging.current) {
      timer.current += dt * 1000;
      if (Math.abs(vel.current) > 0.0005) {
        angle.current += vel.current;
        vel.current *= 0.93;
        if (Math.abs(vel.current) <= 0.0005) { vel.current = 0; rotateTo(frontIndex()); }
      } else if (target.current !== null) {
        angle.current += (target.current - angle.current) * Math.min(1, dt * 6);
        if (Math.abs(target.current - angle.current) < 0.001) { angle.current = target.current; target.current = null; }
      } else if (timer.current > AUTO_MS) {
        timer.current = 0;
        rotateTo(frontIndex() + 1);
      }
    } else timer.current = 0;

    group.current.rotation.y = angle.current;
    const f = frontIndex();
    if (f !== lastFront.current) { lastFront.current = f; onFront(f); }
    featured.forEach((_, i) => {
      const a = i * STEP + angle.current;
      const m = mats.current[i];
      const c = Math.max(0, Math.cos(a));
      if (m) m.color.setScalar(0.25 + 0.75 * c * c);
      group.current.children[i].scale.setScalar(1 + c ** 6 * 0.18);
    });
  });

  return (
    <group position={[0, 0.7, -RADIUS]}>
      <group ref={group}>
        {featured.map((m, i) => (
          <mesh
            key={m.id}
            position={[Math.sin(i * STEP) * RADIUS, 0, Math.cos(i * STEP) * RADIUS]}
            rotation={[0, i * STEP, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (moved.current > 6) return;
              if (frontIndex() === i) router.push(`/movie/${m.id}`);
              else { rotateTo(i); timer.current = 0; }
            }}
          >
            <planeGeometry args={[4.4, 2.2]} />
            <meshBasicMaterial ref={(r) => { mats.current[i] = r; }} map={textures[i]} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function Hero() {
  const [front, setFront] = useState(0);
  const m = featured[front];
  return (
    <section
      className="relative h-[78vh] min-h-[520px] w-full select-none overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 30%, hsl(${m.hue} 70% 28%), #07070c 70%)`, transition: "background .8s" }}
    >
      <Canvas camera={{ position: [0, 0, 7.4], fov: 45 }} dpr={[1, 1.75]} style={{ touchAction: "pan-y" }}>
        <Ring onFront={setFront} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent px-6 pb-8 pt-24 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{m.lang} · {m.genre} · ★ {m.rating}</p>
        <h1 className="mt-1 text-4xl font-black md:text-6xl">{m.title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/70">{m.blurb}</p>
        <p className="mt-3 text-xs text-white/50">Drag to spin. Tap a side screen to bring it forward, tap the front one to book.</p>
      </div>
    </section>
  );
}

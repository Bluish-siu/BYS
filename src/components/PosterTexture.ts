import * as THREE from "three";
import { Movie } from "@/lib/data";

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    images.set(src, p);
  }
  return p;
}

// Fills the canvas with the image like CSS object-fit: cover.
function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const s = Math.max(W / img.width, H / img.height);
  const w = img.width * s, h = img.height * s;
  g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line && g.measureText(line + w).width > maxW) { lines.push(line.trim()); line = ""; }
    line += w + " ";
  }
  lines.push(line.trim());
  return lines;
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Generated art for movies that have no real key art.
function paintGenerated(g: CanvasRenderingContext2D, m: Movie, W: number, H: number) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, `hsl(${m.hue} 80% 42%)`);
  bg.addColorStop(0.6, `hsl(${m.hue2} 70% 16%)`);
  bg.addColorStop(1, "#05050a");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const bloom = g.createRadialGradient(W * 0.68, H * 0.38, 10, W * 0.68, H * 0.38, W * 0.5);
  bloom.addColorStop(0, "rgba(255,240,220,0.7)"); bloom.addColorStop(0.4, "rgba(255,200,160,0.15)"); bloom.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = bloom; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(4,4,8,0.85)";
  let x = 0;
  while (x < W) { const w = W * 0.03 + ((x * 37) % (W * 0.04)), h = H * 0.12 + ((x * 91) % (H * 0.3)); g.fillRect(x, H - h, w, h); x += w + 4; }
  g.textAlign = "center"; g.fillStyle = "#fff"; g.shadowColor = "rgba(0,0,0,0.7)"; g.shadowBlur = 20;
  const size = Math.round(H * 0.16);
  g.font = `900 ${size}px sans-serif`;
  const lines = wrapText(g, m.title.toUpperCase(), W * 0.85);
  const y0 = H * 0.5 - ((lines.length - 1) * size) / 2;
  lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * size * 1.05));
  g.font = `600 ${Math.round(H * 0.045)}px sans-serif`; g.fillStyle = "rgba(255,255,255,0.8)"; g.shadowBlur = 6;
  g.fillText(`${m.lang.toUpperCase()}  ·  ${m.genre.toUpperCase()}`, W / 2, y0 + lines.length * size * 1.05 + H * 0.02);
  g.shadowBlur = 0;
}

function bannerTexture(m: Movie, W: number, H: number, overlay?: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const tex = finish(c);
  const paint = (img?: HTMLImageElement) => {
    if (img) drawCover(g, img, W, H); else paintGenerated(g, m, W, H);
    overlay?.(g);
    tex.needsUpdate = true;
  };
  paint();
  if (m.banner) loadImage(m.banner).then(paint).catch(() => {});
  return tex;
}

// Hero ring screens: widescreen key art.
export const makeBannerTexture = (m: Movie) => bannerTexture(m, 1024, 512);

// Cinema hall screen: same art with a vignette so it reads as a projected image.
export const makeScreenTexture = (m: Movie, aspect: number) => {
  const W = 2048, H = Math.round(W / aspect);
  return bannerTexture(m, W, H, (g) => {
    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
  });
};

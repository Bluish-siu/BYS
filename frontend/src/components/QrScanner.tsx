"use client";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

/**
 * Reads QR codes with the phone's back camera. Works in mobile browsers and inside the Android app.
 * Calls onCode once per new code; the same code is ignored for 4 seconds so one ticket isn't scanned twice.
 */
export default function QrScanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const last = useRef({ text: "", at: 0 });
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const g = canvas.getContext("2d", { willReadFrequently: true })!;
    const tick = () => {
      const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w);
        canvas.width = w; canvas.height = h;
        g.drawImage(v, 0, 0, w, h);
        const found = jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        const now = Date.now();
        if (found?.data && (found.data !== last.current.text || now - last.current.at > 4000)) {
          last.current = { text: found.data, at: now };
          cb.current(found.data);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("Camera not available. Allow camera access, or type the ticket id below."));
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-ink">
      <video ref={video} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
      {error && <p className="absolute inset-x-4 bottom-4 rounded-lg bg-black/70 p-2 text-center text-xs text-white">{error}</p>}
    </div>
  );
}

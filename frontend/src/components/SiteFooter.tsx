"use client";
import Link from "next/link";
import { setLite, useLite } from "@/lib/lite";

export default function SiteFooter() {
  const { ready, lite, choice, auto } = useLite();
  return (
    <footer className="space-y-3 px-6 py-10 text-center text-sm text-fg/50">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/download" className="font-semibold text-fg/70 hover:text-brand">📱 Get the Android app</Link>
        {ready && (
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={lite} onChange={(e) => setLite(e.target.checked)} className="h-4 w-4 accent-[#FF5A36]" />
            <span>Lite mode (less 3D, for slow phones){choice === "auto" && auto ? " · on for this device" : ""}</span>
          </label>
        )}
      </div>
      <p>PickMySeat is a college project. Payments run in Razorpay test mode. Movie posters and trailers belong to their owners.</p>
    </footer>
  );
}

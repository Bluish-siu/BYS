"use client";
import { useEffect, useState } from "react";
import { APP_DOWNLOAD, APP_LATEST, appVersion, isOlder } from "@/lib/app-version";

/** Inside an older Android app: a bar offering the new APK. Hidden in browsers and in the latest app. */
export default function AppUpdateBanner() {
  const [old, setOld] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const v = appVersion(navigator.userAgent);
    if (!v || !isOlder(v, APP_LATEST)) return;
    try { if (sessionStorage.getItem("pms-update-hidden") === APP_LATEST) return; } catch { /* ignore */ }
    setOld(v);
  }, []);
  if (!old || hidden) return null;
  return (
    <div className="flex items-center gap-3 bg-ink px-4 py-2.5 text-sm text-white">
      <span className="mr-auto">A new version of the app ({APP_LATEST}) is ready. You have {old}.</span>
      <a href={APP_DOWNLOAD} className="btn btn-brand !px-3 !py-1 text-xs">Update</a>
      <button aria-label="Hide" onClick={() => { setHidden(true); try { sessionStorage.setItem("pms-update-hidden", APP_LATEST); } catch { /* ignore */ } }} className="text-white/60">✕</button>
    </div>
  );
}

// The newest Android app. Bump this (and android/app/build.gradle) when a new APK is built,
// and copy the APK to frontend/public/download/PickMySeat.apk. Older apps then show "Update available".
export const APP_LATEST = "1.3";
export const APP_DOWNLOAD = "/download/PickMySeat.apk";

/** The app version from the user agent ("PickMySeatApp/1.2"), or null in a normal browser. */
export function appVersion(ua: string) {
  return ua.match(/PickMySeatApp\/(\d+(?:\.\d+)*)/)?.[1] ?? null;
}

/** True when version a is older than b ("1.2" < "1.10"). */
export function isOlder(a: string, b: string) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  }
  return false;
}

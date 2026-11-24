import Link from "next/link";
import { APP_DOWNLOAD, APP_LATEST } from "@/lib/app-version";

export const metadata = { title: "Get the PickMySeat Android app" };

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-4">
        <img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl shadow" />
        <div>
          <h1 className="text-3xl font-black">PickMySeat for Android</h1>
          <p className="text-fg/60">Version {APP_LATEST} · about 100 KB · Android 7.0 or newer</p>
        </div>
      </div>

      <a href={APP_DOWNLOAD} download className="btn btn-brand mt-6 w-full !py-4 text-base sm:w-auto">⬇ Download the app (APK)</a>

      <div className="card mt-8 space-y-3 p-5 text-sm">
        <p className="font-bold">How to install</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-fg/75">
          <li>Open this page on your Android phone and tap <b>Download the app</b>.</li>
          <li>Open the downloaded file. If Android asks, allow <b>Install unknown apps</b> for your browser or file manager.</li>
          <li>Tap <b>Install</b>. Updating? It installs over the old version and keeps you signed in.</li>
        </ol>
        <p className="text-fg/55">The app is installed directly, without the Play Store, so Android shows a warning about unknown apps. It is signed with PickMySeat&apos;s own key.</p>
      </div>

      <div className="card mt-4 space-y-2 p-5 text-sm">
        <p className="font-bold">What the app adds</p>
        <ul className="list-disc space-y-1 pl-5 text-fg/75">
          <li>Its own icon and full-screen view, with the phone&apos;s Back button</li>
          <li>Save tickets to your Gallery, to show at the entrance without internet</li>
          <li>Share tickets through WhatsApp or any app</li>
          <li>UPI apps open straight from Razorpay</li>
          <li>Tells you when a new version is ready</li>
        </ul>
      </div>
      <p className="mt-6 text-sm text-fg/50">On an iPhone or a computer? Use the website, it does everything the app does. <Link href="/" className="underline">Back to movies</Link></p>
    </div>
  );
}

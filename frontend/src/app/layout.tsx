import "./globals.css";
import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "PickMySeat - see your seat before you book",
  description: "A next-generation movie ticket booking experience.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bys-sooty.vercel.app"),
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon-32.png", type: "image/png", sizes: "32x32" }, { url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "PickMySeat - see your seat before you book",
    description: "Pick seats on a 2D map, then sit in them in a 3D cinema with the trailer playing.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PickMySeat" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  appleWebApp: { capable: true, title: "PickMySeat", statusBarStyle: "black-translucent" },
};
// viewport-fit=cover lets the app draw under the notch; the header and bottom bars pad with safe-area insets.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#07070c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Header />
        <main>{children}</main>
        <footer className="px-6 py-10 text-center text-sm text-white/40">Demo project. All movie data is dummy data.</footer>
      </body>
    </html>
  );
}

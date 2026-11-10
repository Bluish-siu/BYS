import "./globals.css";
import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = { title: "Cineverse - book movies in 3D", description: "A next-generation movie ticket booking experience." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

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

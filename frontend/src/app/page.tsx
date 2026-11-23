import Link from "next/link";
import Hero from "@/components/Hero";
import NowShowing from "@/components/NowShowing";

export default function Home() {
  return (
    <>
      <Hero />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">Now showing</h2>
          <Link href="/movies" className="text-sm font-semibold text-brand">Search &amp; filter →</Link>
        </div>
        <NowShowing />
      </section>
    </>
  );
}

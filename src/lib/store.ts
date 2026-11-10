"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Booking = {
  movieId: string; city: string; day: number; theatreId: string; showId: string; time: string; format: string;
  fill: number; seats: string[]; snacks: Record<string, number>;
};
export type Ticket = { id: string; booking: Booking; total: number; at: number };

type State = {
  city: string; setCity: (c: string) => void;
  booking: Booking | null; setBooking: (b: Booking | null) => void;
  patch: (p: Partial<Booking>) => void;
  tickets: Ticket[]; addTicket: (t: Ticket) => void;
};

export const useStore = create<State>()(persist((set) => ({
  city: "Mumbai", setCity: (city) => set({ city }),
  booking: null, setBooking: (booking) => set({ booking }),
  patch: (p) => set((s) => (s.booking ? { booking: { ...s.booking, ...p } } : s)),
  tickets: [], addTicket: (t) => set((s) => ({ tickets: [t, ...s.tickets] })),
}), { name: "cineverse" }));

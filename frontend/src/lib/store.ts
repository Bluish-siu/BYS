"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { istDate } from "./dates";

export type Booking = {
  movieId: string; city: string; date: string; theatreId: string; showId: string; time: string; format: string;
  fill: number; seats: string[]; snacks: Record<string, number>;
};
export type Ticket = {
  id: string; booking: Booking; total: number; at: number; paymentId?: string;
  // From the server when available:
  status?: "confirmed" | "cancelled"; checkedInAt?: number; cancelledAt?: number; refundAmount?: number; refundId?: string; mine?: boolean;
};

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
  tickets: [], addTicket: (t) => set((s) => ({ tickets: [t, ...s.tickets.filter((x) => x.id !== t.id)] })),
}), {
  name: "pickmyseat",
  // Version 1: shows use their real date instead of "days from today" (version 0).
  version: 1,
  migrate: (old, version) => {
    type OldTicket = Ticket & { booking: Booking & { day?: number } };
    const st = old as Omit<State, "tickets"> & { tickets?: OldTicket[] };
    if (version < 1) {
      st.booking = null; // a half-finished booking from before: start it again
      st.tickets = (st.tickets ?? []).map((t) => ({
        ...t,
        booking: { ...t.booking, date: t.booking.date ?? istDate(t.booking.day ?? 0, t.at) },
      }));
    }
    return st;
  },
}));

"use client";
import { useEffect } from "react";
import { useStore } from "zustand";
import { catalogStore, loadCatalog } from "./catalog";

/** The catalogue for a component. Re-renders when the database copy arrives. */
export function useCatalog() {
  const cat = useStore(catalogStore, (s) => s.cat);
  useEffect(() => { loadCatalog(); }, []);
  return cat;
}

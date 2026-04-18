"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

const STORAGE_KEY = "partner-center-favorites";

/* ── Context ── */
interface FavoritesCtx {
  favorites: string[];
  toggle: (href: string) => void;
  isFavorite: (href: string) => boolean;
}

const FavoritesContext = createContext<FavoritesCtx>({
  favorites: [],
  toggle: () => {},
  isFavorite: () => false,
});

/* ── Provider (dashboard layout 에 감싸줌) ── */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  const toggle = useCallback((href: string) => {
    setFavorites((prev) => {
      const next = prev.includes(href)
        ? prev.filter((h) => h !== href)
        : [...prev, href];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (href: string) => favorites.includes(href),
    [favorites]
  );

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

/* ── Hook ── */
export function useFavorites() {
  return useContext(FavoritesContext);
}

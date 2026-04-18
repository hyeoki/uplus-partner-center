"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { toggleFavoriteMenu } from "@/app/actions/favorites";

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

/* ── Provider — DB에서 받은 초기값으로 시작, 토글 시 서버에 영구 저장 ── */
export function FavoritesProvider({
  children,
  initial = [],
}: {
  children: ReactNode;
  initial?: string[];
}) {
  const [favorites, setFavorites] = useState<string[]>(initial);

  const toggle = useCallback((href: string) => {
    // optimistic update — 즉시 UI 반영
    setFavorites((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href],
    );
    // 서버에 저장 (실패 시 다음 페이지 이동에서 동기화됨)
    void toggleFavoriteMenu(href).then((next) => {
      // 서버 응답이 정답이므로 동기화
      setFavorites(next);
    });
  }, []);

  const isFavorite = useCallback(
    (href: string) => favorites.includes(href),
    [favorites],
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

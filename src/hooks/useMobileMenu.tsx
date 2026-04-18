"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface Ctx {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
}

const MobileMenuContext = createContext<Ctx>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {},
});

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <MobileMenuContext.Provider
      value={{
        mobileOpen,
        setMobileOpen,
        toggleMobile: () => setMobileOpen((v) => !v),
      }}
    >
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}

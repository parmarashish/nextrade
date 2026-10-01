'use client';

import React, { createContext, useContext, useState } from 'react';

interface NavState {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
}

const NavContext = createContext<NavState>({ navOpen: false, setNavOpen: () => {} });

/** navOpen: drawer open on phones / expanded overlay on tablets. */
export function NavProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  return <NavContext.Provider value={{ navOpen, setNavOpen }}>{children}</NavContext.Provider>;
}

export const useNav = () => useContext(NavContext);

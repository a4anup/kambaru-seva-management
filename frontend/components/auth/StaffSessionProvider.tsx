"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface StaffSession {
  id: string;
  displayName: string;
  role: string;
}

const StaffSessionContext = createContext<StaffSession | null>(null);

export function StaffSessionProvider({
  staff,
  children,
}: {
  staff: StaffSession | null;
  children: ReactNode;
}) {
  return (
    <StaffSessionContext.Provider value={staff}>
      {children}
    </StaffSessionContext.Provider>
  );
}

export function useStaffSession() {
  return useContext(StaffSessionContext);
}

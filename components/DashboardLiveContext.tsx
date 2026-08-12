"use client";

import { createContext, useContext } from "react";

export interface DashboardLiveValue {
  characterBalance: number;
  platformName: string;
  userEmail: string;
  isMaintenance: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

export const DashboardLiveContext = createContext<DashboardLiveValue | null>(
  null
);

export function useDashboardLive(): DashboardLiveValue {
  const ctx = useContext(DashboardLiveContext);
  if (!ctx) {
    return {
      characterBalance: 0,
      platformName: "BIKIN AI",
      userEmail: "",
      isMaintenance: false,
      onRefresh: () => {},
      onLogout: () => {},
      onDeleteAccount: () => {},
    };
  }
  return ctx;
}

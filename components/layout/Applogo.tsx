"use client";

import { useState, useEffect } from "react";

function getPlatformName(): string {
  if (typeof window === "undefined") return "BIKIN AI";
  try {
    return localStorage.getItem("founder_config_platform_name") || "BIKIN AI";
  } catch {
    return "BIKIN AI";
  }
}

function getPlatformLogo(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("founder_config_platform_logo") || "";
  } catch {
    return "";
  }
}

export function AppLogo({ className }: { className?: string }) {
  const [platformName, setPlatformName] = useState("BIKIN AI");
  const [platformLogo, setPlatformLogo] = useState("");

  useEffect(() => {
    setPlatformName(getPlatformName());
    setPlatformLogo(getPlatformLogo());
    const handler = () => {
      setPlatformName(getPlatformName());
      setPlatformLogo(getPlatformLogo());
    };
    window.addEventListener("storage", handler);
    // Custom event for same-tab real-time updates
    window.addEventListener("founder-config-updated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("founder-config-updated", handler);
    };
  }, []);

  if (platformLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={platformLogo}
        alt={platformName}
        className={`h-8 w-auto object-contain ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      className={`font-bold tracking-tight text-emerald-600 ${className ?? ""}`}
    >
      {platformName}
    </span>
  );
}
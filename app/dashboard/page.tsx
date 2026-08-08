"use client";

import React, { useState, useEffect } from "react";
import TampilanHP from "@/components/responsive/TampilanHP";
import TampilanTablet from "@/components/responsive/TampilanTablet";
import TampilanLaptop from "@/components/responsive/TampilanLaptop";
import TampilanPC from "@/components/responsive/TampilanPC";

type DeviceType = "HP" | "TABLET" | "LAPTOP" | "PC";

export default function DashboardPage() {
  const [device, setDevice] = useState<DeviceType>("PC");
  const [maxInputChars, setMaxInputChars] = useState<number>(500);

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem("founder_config_max_input_chars");
      const parsedValue = Number(storedValue ?? "");
      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        setMaxInputChars(Math.max(50, Math.min(parsedValue, 5000)));
      }
    } catch {
      // ignore localStorage failures
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDevice("HP");
      } else if (width >= 640 && width < 1024) {
        setDevice("TABLET");
      } else if (width >= 1024 && width < 1280) {
        setDevice("LAPTOP");
      } else {
        setDevice("PC");
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950">
      {device === "HP" && <TampilanHP maxInputChars={maxInputChars} />}
      {device === "TABLET" && <TampilanTablet maxInputChars={maxInputChars} />}
      {device === "LAPTOP" && <TampilanLaptop maxInputChars={maxInputChars} />}
      {device === "PC" && <TampilanPC maxInputChars={maxInputChars} />}
    </div>
  );
}
"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * HOOK PREFERENSI FITUR (sisi user) — tombol geser aktif/nonaktif fitur.
 * Tersimpan di localStorage per perangkat. Semua hook yang memakai ini akan
 * sinkron lewat event `bikinAI-feature-prefs`.
 */
const KEY = "bikinAI_feature_prefs_disabled";
const EVENT = "bikinAI-feature-prefs";

function readDisabled(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeDisabled(list: string[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useFeaturePrefs() {
  const [disabled, setDisabled] = useState<string[]>([]);

  useEffect(() => {
    setDisabled(readDisabled());
    const onEvent = () => setDisabled(readDisabled());
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  /** true = fitur TAMPIL di beranda (belum dinonaktifkan user). */
  const isEnabled = useCallback((slug: string) => !disabled.includes(slug), [disabled]);

  /** Balik status aktif/nonaktif sebuah fitur. */
  const toggleFeature = useCallback((slug: string) => {
    setDisabled((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      writeDisabled(next);
      return next;
    });
  }, []);

  /** Kembalikan semua fitur tampil. */
  const resetAllFeatures = useCallback(() => {
    setDisabled([]);
    writeDisabled([]);
  }, []);

  return { isEnabled, toggleFeature, resetAllFeatures, hiddenCount: disabled.length };
}
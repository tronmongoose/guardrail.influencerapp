"use client";

import { useEffect, useState } from "react";

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export function useIsDebugUser(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cached ?? false);

  useEffect(() => {
    if (cached !== null) {
      setEnabled(cached);
      return;
    }
    if (!inflight) {
      inflight = fetch("/api/me/debug-access")
        .then((r) => (r.ok ? r.json() : { enabled: false }))
        .then((j: { enabled?: boolean }) => {
          cached = Boolean(j.enabled);
          return cached;
        })
        .catch(() => {
          cached = false;
          return false;
        });
    }
    let active = true;
    inflight.then((v) => {
      if (active) setEnabled(v);
    });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}

"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GenerationNotification } from "./GenerationNotification";
import { GenerationDebugPanel } from "./GenerationDebugPanel";
import { useIsDebugUser } from "./useIsDebugUser";

interface GenerationContextType {
  startGeneration: (programId: string) => void;
  dismissGeneration: (programId: string) => void;
  activeGenerations: string[];
}

const GenerationContext = createContext<GenerationContextType | null>(null);

export function useGeneration() {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error("useGeneration must be used within a GenerationProvider");
  }
  return context;
}

interface GenerationProviderProps {
  children: ReactNode;
}

export function GenerationProvider({ children }: GenerationProviderProps) {
  const [activeGenerations, setActiveGenerations] = useState<string[]>([]);
  const isDebug = useIsDebugUser();
  const pathname = usePathname();
  const editProgramId = pathname?.match(/^\/programs\/([^/]+)\/edit/)?.[1] ?? null;
  const debugProgramId = activeGenerations[0] ?? editProgramId;

  const startGeneration = useCallback((programId: string) => {
    setActiveGenerations((prev) => {
      if (prev.includes(programId)) return prev;
      return [...prev, programId];
    });
  }, []);

  const dismissGeneration = useCallback((programId: string) => {
    setActiveGenerations((prev) => prev.filter((id) => id !== programId));
  }, []);

  return (
    <GenerationContext.Provider value={{ startGeneration, dismissGeneration, activeGenerations }}>
      {children}

      {/* Render notifications for all active generations */}
      {activeGenerations.map((programId) => (
        <GenerationNotification
          key={programId}
          programId={programId}
          onComplete={() => dismissGeneration(programId)}
          onDismiss={() => dismissGeneration(programId)}
        />
      ))}

      {/* Debug panel — allowlisted creators, mounted any time there's an active
          generation OR they're on a /programs/[id]/edit page (so they can
          inspect past jobs even when nothing's running). */}
      {isDebug && debugProgramId && (
        <GenerationDebugPanel programId={debugProgramId} />
      )}
    </GenerationContext.Provider>
  );
}

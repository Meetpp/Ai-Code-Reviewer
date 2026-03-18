"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { FileSuggestion } from "@/components/FileReviewDrawer";

export interface AcceptedEntry {
  filePath: string;
  index: number;
  suggestion: FileSuggestion;
}

interface AcceptedChangesContextValue {
  accepted: AcceptedEntry[];
  rejected: Set<string>;                // key: `${filePath}::${index}`
  totalAccepted: number;
  affectedFiles: string[];
  acceptSuggestion: (filePath: string, index: number, suggestion: FileSuggestion) => void;
  rejectSuggestion: (filePath: string, index: number) => void;
  undoSuggestion: (filePath: string, index: number) => void;
  isAccepted: (filePath: string, index: number) => boolean;
  isRejected: (filePath: string, index: number) => boolean;
  clearAll: () => void;
  /** Returns changes grouped by file, ready for the create-pr API */
  getChangesForPR: () => { filePath: string; changes: FileSuggestion[] }[];
}

const AcceptedChangesContext = createContext<AcceptedChangesContextValue | null>(null);

export function AcceptedChangesProvider({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState<AcceptedEntry[]>([]);
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const key = (filePath: string, index: number) => `${filePath}::${index}`;

  const acceptSuggestion = useCallback(
    (filePath: string, index: number, suggestion: FileSuggestion) => {
      setAccepted((prev) => {
        // Replace if already exists, otherwise append
        const exists = prev.findIndex((e) => e.filePath === filePath && e.index === index);
        if (exists >= 0) return prev;
        return [...prev, { filePath, index, suggestion }];
      });
      // Remove from rejected if it was there
      setRejected((prev) => {
        const next = new Set(prev);
        next.delete(key(filePath, index));
        return next;
      });
    },
    []
  );

  const rejectSuggestion = useCallback((filePath: string, index: number) => {
    // Remove from accepted
    setAccepted((prev) => prev.filter((e) => !(e.filePath === filePath && e.index === index)));
    setRejected((prev) => new Set(prev).add(key(filePath, index)));
  }, []);

  const undoSuggestion = useCallback((filePath: string, index: number) => {
    setAccepted((prev) => prev.filter((e) => !(e.filePath === filePath && e.index === index)));
    setRejected((prev) => {
      const next = new Set(prev);
      next.delete(key(filePath, index));
      return next;
    });
  }, []);

  const isAccepted = useCallback(
    (filePath: string, index: number) =>
      accepted.some((e) => e.filePath === filePath && e.index === index),
    [accepted]
  );

  const isRejected = useCallback(
    (filePath: string, index: number) => rejected.has(key(filePath, index)),
    [rejected]
  );

  const clearAll = useCallback(() => {
    setAccepted([]);
    setRejected(new Set());
  }, []);

  const getChangesForPR = useCallback(() => {
    const map = new Map<string, FileSuggestion[]>();
    for (const entry of accepted) {
      if (!map.has(entry.filePath)) map.set(entry.filePath, []);
      map.get(entry.filePath)!.push(entry.suggestion);
    }
    return Array.from(map.entries()).map(([filePath, changes]) => ({ filePath, changes }));
  }, [accepted]);

  const affectedFiles = [...new Set(accepted.map((e) => e.filePath))];

  return (
    <AcceptedChangesContext.Provider
      value={{
        accepted,
        rejected,
        totalAccepted: accepted.length,
        affectedFiles,
        acceptSuggestion,
        rejectSuggestion,
        undoSuggestion,
        isAccepted,
        isRejected,
        clearAll,
        getChangesForPR,
      }}
    >
      {children}
    </AcceptedChangesContext.Provider>
  );
}

export function useAcceptedChanges() {
  const ctx = useContext(AcceptedChangesContext);
  if (!ctx) throw new Error("useAcceptedChanges must be used inside AcceptedChangesProvider");
  return ctx;
}

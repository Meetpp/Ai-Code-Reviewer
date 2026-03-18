"use client";

import { useState, useEffect, useCallback } from "react";
import { useAcceptedChanges } from "@/context/AcceptedChangesContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface FileSuggestion {
  title: string;
  lineNumber: number;
  lineEnd?: number;
  currentCode: string;
  suggestedFix: string;
  explanation: string;
  type: "bug" | "performance" | "refactor" | "security" | "style" | "best-practice" | "code-smell";
  severity: "error" | "warning" | "info";
  diff: {
    before: string[];
    after: string[];
  };
}

interface FileReviewDrawerProps {
  jobId: string;
  filePath: string | null;
  onClose: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  bug:             { label: "Bug",           color: "bg-red-900/60 text-red-300 border-red-700" },
  performance:     { label: "Performance",   color: "bg-orange-900/60 text-orange-300 border-orange-700" },
  refactor:        { label: "Refactor",      color: "bg-purple-900/60 text-purple-300 border-purple-700" },
  security:        { label: "Security",      color: "bg-red-900/60 text-red-300 border-red-700" },
  style:           { label: "Style",         color: "bg-blue-900/60 text-blue-300 border-blue-700" },
  "best-practice": { label: "Best Practice", color: "bg-green-900/60 text-green-300 border-green-700" },
  "code-smell":    { label: "Code Smell",    color: "bg-yellow-900/60 text-yellow-300 border-yellow-700" },
};

const SEVERITY_CONFIG: Record<string, { dot: string; border: string; acceptedBorder: string }> = {
  error:   { dot: "bg-red-400",    border: "border-l-red-500",    acceptedBorder: "border-l-green-500" },
  warning: { dot: "bg-yellow-400", border: "border-l-yellow-500", acceptedBorder: "border-l-green-500" },
  info:    { dot: "bg-blue-400",   border: "border-l-blue-500",   acceptedBorder: "border-l-green-500" },
};

export function FileReviewDrawer({ jobId, filePath, onClose }: FileReviewDrawerProps) {
  const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Set<number>>(new Set());

  const {
    acceptSuggestion,
    rejectSuggestion,
    undoSuggestion,
    isAccepted,
    isRejected,
  } = useAcceptedChanges();

  const fetchReview = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setExpandedDiffs(new Set());

    try {
      const res = await fetch(`${API_URL}/api/review/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, filePath }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze file");
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch suggestions");
    } finally {
      setLoading(false);
    }
  }, [jobId, filePath]);

  useEffect(() => {
    if (filePath) fetchReview();
  }, [filePath, fetchReview]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function toggleDiff(index: number) {
    setExpandedDiffs((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  if (!filePath) return null;

  const fileName = filePath.split("/").pop() ?? filePath;
  const errorCount   = suggestions.filter((s) => s.severity === "error").length;
  const warnCount    = suggestions.filter((s) => s.severity === "warning").length;
  const infoCount    = suggestions.filter((s) => s.severity === "info").length;
  const acceptedCount = suggestions.filter((_, i) => isAccepted(filePath, i)).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <FileIcon />
              <h2 className="text-white font-semibold text-base truncate">{fileName}</h2>
            </div>
            <p className="text-gray-500 text-xs truncate">{filePath}</p>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-red-900/40 text-red-400 border border-red-800">
                    {errorCount} error{errorCount !== 1 ? "s" : ""}
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800">
                    {warnCount} warning{warnCount !== 1 ? "s" : ""}
                  </span>
                )}
                {infoCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-900/40 text-blue-400 border border-blue-800">
                    {infoCount} info
                  </span>
                )}
                {acceptedCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-green-900/40 text-green-400 border border-green-800">
                    ✓ {acceptedCount} accepted
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchReview}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50 border border-gray-700"
            >
              <RefreshIcon spinning={loading} />
              Re-analyze
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Analyzing file…</p>
            </div>
          )}

          {error && !loading && (
            <div className="m-4 p-4 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
              <span className="text-3xl">✓</span>
              <p className="text-white font-medium">No issues found</p>
              <p className="text-gray-500 text-sm">This file looks clean!</p>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="p-4 space-y-4">
              {suggestions.map((suggestion, index) => {
                const sevConfig  = SEVERITY_CONFIG[suggestion.severity] ?? SEVERITY_CONFIG.info;
                const typeConf   = TYPE_CONFIG[suggestion.type] ?? { label: suggestion.type, color: "bg-gray-800 text-gray-300 border-gray-700" };
                const accepted   = isAccepted(filePath, index);
                const rejected   = isRejected(filePath, index);
                const isDiffOpen = expandedDiffs.has(index);
                const hasDiff    = suggestion.diff.before.length > 0 || suggestion.diff.after.length > 0;

                return (
                  <div
                    key={index}
                    className={`rounded-xl border border-l-4 overflow-hidden transition-all ${
                      accepted
                        ? "border-green-800/60 border-l-green-500 bg-green-950/20"
                        : rejected
                          ? "border-gray-800/40 border-l-gray-700 bg-gray-900/20 opacity-50"
                          : `border-gray-800 ${sevConfig.border} bg-gray-900/60`
                    }`}
                  >
                    {/* Card header */}
                    <div className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${accepted ? "bg-green-400" : sevConfig.dot}`} />
                          <span className="text-white font-medium text-sm">{suggestion.title}</span>
                          {accepted && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-green-900/50 text-green-400 border border-green-800">
                              ✓ Accepted
                            </span>
                          )}
                          {rejected && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-500 border border-gray-700">
                              Rejected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded border text-xs font-medium ${typeConf.color}`}>
                            {typeConf.label}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-xs font-mono border border-gray-700">
                            L{suggestion.lineNumber}{suggestion.lineEnd && suggestion.lineEnd !== suggestion.lineNumber ? `–${suggestion.lineEnd}` : ""}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-400 text-sm leading-relaxed">{suggestion.explanation}</p>
                    </div>

                    {/* Code blocks */}
                    <div className="px-4 pb-3 space-y-2">
                      <div>
                        <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">Current</span>
                        <pre className="mt-1 p-3 rounded-lg bg-red-950/30 border border-red-900/40 text-red-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          <span className="select-none text-red-600 mr-1">−</span>{suggestion.currentCode}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">Suggested Fix</span>
                        <pre className="mt-1 p-3 rounded-lg bg-green-950/30 border border-green-900/40 text-green-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          <span className="select-none text-green-600 mr-1">+</span>{suggestion.suggestedFix}
                        </pre>
                      </div>
                    </div>

                    {/* Accept / Reject / Undo actions */}
                    <div className="px-4 pb-3 flex items-center gap-2">
                      {!accepted && !rejected && (
                        <>
                          <button
                            onClick={() => acceptSuggestion(filePath, index, suggestion)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/40 hover:bg-green-800/60 text-green-400 hover:text-green-300 border border-green-800 text-xs font-medium transition-all"
                          >
                            <CheckIcon /> Accept
                          </button>
                          <button
                            onClick={() => rejectSuggestion(filePath, index)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-800/50 text-red-400 hover:text-red-300 border border-red-800/60 text-xs font-medium transition-all"
                          >
                            <XIcon /> Reject
                          </button>
                        </>
                      )}
                      {(accepted || rejected) && (
                        <button
                          onClick={() => undoSuggestion(filePath, index)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 text-xs font-medium transition-all"
                        >
                          <UndoIcon /> Undo
                        </button>
                      )}
                    </div>

                    {/* Diff toggle */}
                    {hasDiff && (
                      <div className="border-t border-gray-800">
                        <button
                          onClick={() => toggleDiff(index)}
                          className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
                        >
                          <span className="flex items-center gap-1.5"><DiffIcon /> View diff</span>
                          <span>{isDiffOpen ? "▲" : "▼"}</span>
                        </button>
                        {isDiffOpen && (
                          <div className="border-t border-gray-800">
                            <DiffView before={suggestion.diff.before} after={suggestion.diff.after} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600 shrink-0 flex items-center justify-between">
          <span>
            {suggestions.length > 0
              ? `${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""} — click Re-analyze to refresh`
              : "Powered by AI code review"}
          </span>
          {acceptedCount > 0 && (
            <span className="text-green-500 font-medium">
              {acceptedCount} / {suggestions.length} accepted
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Diff view ────────────────────────────────────────────────────────────────

function DiffView({ before, after }: { before: string[]; after: string[] }) {
  if (before.length === 0 && after.length === 0) return null;
  return (
    <div className="font-mono text-xs bg-gray-950">
      {before.map((line, i) => (
        <div key={`b-${i}`} className="flex items-start px-4 py-0.5 bg-red-950/20 border-l-2 border-red-700">
          <span className="text-red-600 w-4 shrink-0 select-none">−</span>
          <span className="text-red-300 whitespace-pre-wrap break-all">{line}</span>
        </div>
      ))}
      {after.map((line, i) => (
        <div key={`a-${i}`} className="flex items-start px-4 py-0.5 bg-green-950/20 border-l-2 border-green-700">
          <span className="text-green-600 w-4 shrink-0 select-none">+</span>
          <span className="text-green-300 whitespace-pre-wrap break-all">{line}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
function DiffIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

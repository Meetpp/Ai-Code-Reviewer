"use client";

import { useState } from "react";
import { useAcceptedChanges } from "@/context/AcceptedChangesContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface CreatePRPanelProps {
  jobId: string;
  repoUrl: string;
}

type PanelState = "collapsed" | "expanded" | "creating" | "success" | "error";

interface PRResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

export function CreatePRPanel({ jobId, repoUrl }: CreatePRPanelProps) {
  const { totalAccepted, affectedFiles, getChangesForPR, clearAll } = useAcceptedChanges();

  const [state, setState] = useState<PanelState>("collapsed");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [prTitle, setPrTitle] = useState("AI Code Review Fixes");
  const [result, setResult] = useState<PRResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Only show the bar if there are accepted changes
  if (totalAccepted === 0 && state === "collapsed") {
    return null;
  }

  async function handleCreatePR() {
    if (!githubToken.trim()) {
      setErrorMsg("GitHub Personal Access Token is required");
      return;
    }

    setState("creating");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/review/create-pr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          githubToken: githubToken.trim(),
          acceptedChanges: getChangesForPR(),
          prTitle: prTitle.trim() || "AI Code Review Fixes",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create PR");

      setResult(data as PRResult);
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create PR");
      setState("error");
    }
  }

  function handleReset() {
    setState("collapsed");
    setResult(null);
    setErrorMsg("");
    setGithubToken("");
    clearAll();
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (state === "success" && result) {
    return (
      <div className="fixed bottom-6 right-6 z-30 w-full max-w-md">
        <div className="bg-gray-900 border border-green-700 rounded-2xl shadow-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-900/60 border border-green-700 flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-semibold">Pull Request Created!</p>
              <p className="text-gray-400 text-xs">Branch: <code className="text-gray-300">{result.branchName}</code></p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={result.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors"
            >
              <ExternalLinkIcon /> View PR #{result.prNumber}
            </a>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Collapsed bar ─────────────────────────────────────────────────────────
  if (state === "collapsed") {
    return (
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setState("expanded")}
          className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
        >
          <GitBranchIcon />
          <div className="text-left">
            <p className="text-sm font-semibold leading-tight">Create Pull Request</p>
            <p className="text-xs text-blue-200">
              {totalAccepted} change{totalAccepted !== 1 ? "s" : ""} · {affectedFiles.length} file{affectedFiles.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ChevronUpIcon />
        </button>
      </div>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-30 w-full max-w-md">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <GitBranchIcon className="text-blue-400" />
            <span className="text-white font-semibold">Create Pull Request</span>
          </div>
          <button
            onClick={() => setState("collapsed")}
            className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
          >
            <ChevronDownIcon />
          </button>
        </div>

        {/* Accepted changes summary */}
        <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Accepted Changes</p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {getChangesForPR().map(({ filePath, changes }) => (
              <div key={filePath} className="flex items-center justify-between gap-2">
                <span className="text-gray-300 text-xs truncate font-mono">
                  {filePath.split("/").pop()}
                </span>
                <span className="text-xs text-blue-400 shrink-0">
                  {changes.length} fix{changes.length !== 1 ? "es" : ""}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {totalAccepted} suggestion{totalAccepted !== 1 ? "s" : ""} across {affectedFiles.length} file{affectedFiles.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={clearAll}
              className="text-gray-600 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          {/* PR Title */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
              PR Title
            </label>
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              placeholder="AI Code Review Fixes"
            />
          </div>

          {/* GitHub Token */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
              GitHub Personal Access Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors font-mono"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showToken ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Needs <code className="text-gray-500">repo</code> scope.{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=AI+Code+Reviewer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 underline"
              >
                Generate token ↗
              </a>
            </p>
          </div>

          {/* Repo info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/60">
            <RepoIcon />
            <span className="text-gray-400 text-xs truncate">{repoUrl}</span>
          </div>

          {/* Error */}
          {state === "error" && errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreatePR}
              disabled={state === "creating" || !githubToken.trim() || totalAccepted === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/40 disabled:text-blue-700 text-white text-sm font-semibold transition-all"
            >
              {state === "creating" ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating PR…
                </>
              ) : (
                <>
                  <GitBranchIcon />
                  Create PR
                </>
              )}
            </button>
            <button
              onClick={() => setState("collapsed")}
              disabled={state === "creating"}
              className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GitBranchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 100 6 3 3 0 000-6zm0 0c0-3.314 2.686-6 6-6m0 0a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}
function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
function ChevronUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
function RepoIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

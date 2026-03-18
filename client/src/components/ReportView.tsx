"use client";

import { useState } from "react";
import { FileReviewDrawer } from "./FileReviewDrawer";

interface ReviewReport {
  repoUrl: string;
  generatedAt: string;
  overview: {
    totalFiles: number;
    totalLines: number;
    languages: { name: string; files: number; percentage: number }[];
    largeFiles: { file: string; lines: number }[];
  };
  qualityScore: {
    overall: number;
    breakdown: {
      codeSmells: number;
      complexity: number;
      maintainability: number;
      bestPractices: number;
    };
  };
  issues: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    byCategory: Record<string, number>;
    topIssues: { file: string; line?: number; severity: string; message: string; category: string }[];
  };
  suggestions: {
    summary: string;
    readability: string[];
    refactoring: string[];
    performance: string[];
    security: string[];
    bestPractices: string[];
    architectureSuggestions: string[];
    testSuggestions: string[];
  };
  frameworks: { name: string; version?: string; category: string }[];
  folderStructure: string[];
}

export function ReportView({ report, jobId }: { report: ReviewReport; jobId: string }) {
  const [drawerFile, setDrawerFile] = useState<string | null>(null);

  const scoreColor =
    report.qualityScore.overall >= 80
      ? "text-green-400"
      : report.qualityScore.overall >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const scoreRingColor =
    report.qualityScore.overall >= 80
      ? "stroke-green-400"
      : report.qualityScore.overall >= 60
        ? "stroke-yellow-400"
        : "stroke-red-400";

  // Group issues by file for the file-list view
  const fileGroups = buildFileGroups(report.issues.topIssues);

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Code Review Report</h1>
            <p className="text-gray-400 mt-1 text-sm break-all">{report.repoUrl}</p>
            <p className="text-gray-500 text-xs mt-1">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Score + Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quality Score */}
          <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50 flex flex-col items-center">
            <h2 className="text-sm font-medium text-gray-400 mb-4">Quality Score</h2>
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#1f2937" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  className={scoreRingColor}
                  strokeWidth="8"
                  strokeDasharray={`${(report.qualityScore.overall / 100) * 327} 327`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-3xl font-bold ${scoreColor}`}>{report.qualityScore.overall}</span>
              </div>
            </div>
            <div className="mt-4 w-full space-y-2 text-sm">
              <ScoreRow label="Code Smells" score={report.qualityScore.breakdown.codeSmells} />
              <ScoreRow label="Complexity" score={report.qualityScore.breakdown.complexity} />
              <ScoreRow label="Maintainability" score={report.qualityScore.breakdown.maintainability} />
              <ScoreRow label="Best Practices" score={report.qualityScore.breakdown.bestPractices} />
            </div>
          </div>

          {/* Project Stats */}
          <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50">
            <h2 className="text-sm font-medium text-gray-400 mb-4">Project Overview</h2>
            <div className="space-y-3">
              <Stat label="Total Files" value={report.overview.totalFiles.toLocaleString()} />
              <Stat label="Lines of Code" value={report.overview.totalLines.toLocaleString()} />
              <Stat label="Issues Found" value={report.issues.total.toString()} />
              <Stat label="Frameworks" value={report.frameworks.length.toString()} />
            </div>
            {report.overview.languages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h3 className="text-xs text-gray-500 mb-2">Languages</h3>
                <div className="space-y-1">
                  {report.overview.languages.slice(0, 5).map((lang) => (
                    <div key={lang.name} className="flex justify-between text-sm">
                      <span className="text-gray-300">{lang.name}</span>
                      <span className="text-gray-500">{lang.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Frameworks */}
          <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50">
            <h2 className="text-sm font-medium text-gray-400 mb-4">Detected Technologies</h2>
            {report.frameworks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {report.frameworks.map((fw) => (
                  <span
                    key={fw.name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-sm"
                  >
                    <span className="text-white">{fw.name}</span>
                    {fw.version && <span className="text-gray-500 text-xs">{fw.version}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No frameworks detected</p>
            )}
          </div>
        </div>

        {/* Issues */}
        <Section title="Issues Found">
          <div className="flex gap-4 mb-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-red-900/30 text-red-400 border border-red-800">
              {report.issues.errors} errors
            </span>
            <span className="px-3 py-1 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800">
              {report.issues.warnings} warnings
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800">
              {report.issues.info} info
            </span>
          </div>

          {fileGroups.length > 0 ? (
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {fileGroups.map((group) => (
                <FileGroup
                  key={group.filePath}
                  group={group}
                  onOpenReview={() => setDrawerFile(group.filePath)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No issues found. Great job!</p>
          )}
        </Section>

        {/* AI Suggestions */}
        <Section title="AI Suggestions">
          <p className="text-gray-300 mb-6">{report.suggestions.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SuggestionCategory title="Readability" items={report.suggestions.readability} />
            <SuggestionCategory title="Refactoring" items={report.suggestions.refactoring} />
            <SuggestionCategory title="Performance" items={report.suggestions.performance} />
            <SuggestionCategory title="Security" items={report.suggestions.security} />
            <SuggestionCategory title="Best Practices" items={report.suggestions.bestPractices} />
            <SuggestionCategory title="Architecture" items={report.suggestions.architectureSuggestions} />
            <SuggestionCategory title="Testing" items={report.suggestions.testSuggestions} />
          </div>
        </Section>

        {/* Folder Structure */}
        {report.folderStructure.length > 0 && (
          <Section title="Folder Structure">
            <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
              {report.folderStructure.join("\n")}
            </pre>
          </Section>
        )}
      </div>

      {/* File Review Drawer */}
      <FileReviewDrawer
        jobId={jobId}
        filePath={drawerFile}
        onClose={() => setDrawerFile(null)}
      />
    </>
  );
}

// ─── File grouping ───────────────────────────────────────────────────────────

interface FileGroup {
  filePath: string;
  fileName: string;
  issues: { line?: number; severity: string; message: string; category: string }[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

function buildFileGroups(
  topIssues: { file: string; line?: number; severity: string; message: string; category: string }[]
): FileGroup[] {
  const map = new Map<string, FileGroup>();

  for (const issue of topIssues) {
    if (!map.has(issue.file)) {
      map.set(issue.file, {
        filePath: issue.file,
        fileName: issue.file.split("/").pop() ?? issue.file,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });
    }
    const group = map.get(issue.file)!;
    group.issues.push({ line: issue.line, severity: issue.severity, message: issue.message, category: issue.category });
    if (issue.severity === "error") group.errorCount++;
    else if (issue.severity === "warning") group.warningCount++;
    else group.infoCount++;
  }

  return Array.from(map.values()).sort((a, b) => (b.errorCount + b.warningCount) - (a.errorCount + a.warningCount));
}

// ─── FileGroup row ───────────────────────────────────────────────────────────

function FileGroup({ group, onOpenReview }: { group: FileGroup; onOpenReview: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
      {/* File header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 w-4"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>

        <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>

        <span className="text-gray-200 text-sm font-medium truncate flex-1 min-w-0">{group.fileName}</span>
        <span className="text-gray-600 text-xs truncate hidden sm:block flex-1 min-w-0">{group.filePath}</span>

        {/* Severity badges */}
        <div className="flex items-center gap-1 shrink-0">
          {group.errorCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-red-900/40 text-red-400">{group.errorCount}</span>
          )}
          {group.warningCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-900/40 text-yellow-400">{group.warningCount}</span>
          )}
          {group.infoCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-900/40 text-blue-400">{group.infoCount}</span>
          )}
        </div>

        {/* Info / AI review button */}
        <button
          onClick={onOpenReview}
          title="View AI suggestions for this file"
          className="ml-1 shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 hover:text-blue-300 border border-blue-800/50 hover:border-blue-600 transition-all text-xs font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          AI Review
        </button>
      </div>

      {/* Expanded issues list */}
      {expanded && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {group.issues.map((issue, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 px-4 py-2 text-xs ${
                issue.severity === "error"
                  ? "bg-red-900/10"
                  : issue.severity === "warning"
                    ? "bg-yellow-900/10"
                    : "bg-blue-900/10"
              }`}
            >
              <span
                className={`mt-0.5 font-semibold uppercase ${
                  issue.severity === "error"
                    ? "text-red-400"
                    : issue.severity === "warning"
                      ? "text-yellow-400"
                      : "text-blue-400"
                }`}
              >
                {issue.severity}
              </span>
              <span className="text-gray-300 flex-1">{issue.message}</span>
              {issue.line && (
                <span className="text-gray-600 font-mono whitespace-nowrap">:{issue.line}</span>
              )}
              <span className="text-gray-700 whitespace-nowrap">{issue.category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "bg-green-400" : score >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 flex-1">{label}</span>
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-gray-500 text-xs w-8 text-right">{score}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function SuggestionCategory({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-300 mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
            <span className="text-blue-400 mt-1 shrink-0">&#8227;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

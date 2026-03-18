import { AnalysisResult } from "./analysis.service";
import { FrameworkInfo } from "./framework.service";
import { AISuggestions } from "./ai.service";

export interface ReviewReport {
  repoUrl: string;
  generatedAt: string;
  overview: ProjectOverview;
  qualityScore: QualityScore;
  issues: IssuesSummary;
  suggestions: AISuggestions;
  frameworks: FrameworkInfo[];
  folderStructure: string[];
}

interface ProjectOverview {
  totalFiles: number;
  totalLines: number;
  languages: { name: string; files: number; percentage: number }[];
  largeFiles: { file: string; lines: number }[];
}

interface QualityScore {
  overall: number;
  breakdown: {
    codeSmells: number;
    complexity: number;
    maintainability: number;
    bestPractices: number;
  };
}

interface IssuesSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byCategory: Record<string, number>;
  topIssues: { file: string; line?: number; severity: string; message: string; category: string }[];
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  ".js": "JavaScript",
  ".jsx": "JavaScript (JSX)",
  ".ts": "TypeScript",
  ".tsx": "TypeScript (TSX)",
  ".py": "Python",
  ".java": "Java",
  ".go": "Go",
  ".rb": "Ruby",
  ".php": "PHP",
  ".rs": "Rust",
  ".c": "C",
  ".cpp": "C++",
  ".css": "CSS",
  ".scss": "SCSS",
  ".html": "HTML",
  ".vue": "Vue",
  ".svelte": "Svelte",
};

export function buildReport(
  repoUrl: string,
  analysis: AnalysisResult,
  frameworks: FrameworkInfo[],
  suggestions: AISuggestions
): ReviewReport {
  const languages = Object.entries(analysis.filesByExtension)
    .filter(([ext]) => EXT_TO_LANGUAGE[ext])
    .map(([ext, count]) => ({
      name: EXT_TO_LANGUAGE[ext],
      files: count,
      percentage: Math.round((count / analysis.totalFiles) * 100),
    }))
    .sort((a, b) => b.files - a.files);

  const errors = analysis.issues.filter((i) => i.severity === "error").length;
  const warnings = analysis.issues.filter((i) => i.severity === "warning").length;
  const info = analysis.issues.filter((i) => i.severity === "info").length;

  const byCategory: Record<string, number> = {};
  for (const issue of analysis.issues) {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
  }

  const qualityScore = calculateScore(analysis);

  return {
    repoUrl,
    generatedAt: new Date().toISOString(),
    overview: {
      totalFiles: analysis.totalFiles,
      totalLines: analysis.totalLines,
      languages,
      largeFiles: analysis.largeFiles,
    },
    qualityScore,
    issues: {
      total: analysis.issues.length,
      errors,
      warnings,
      info,
      byCategory,
      topIssues: analysis.issues.slice(0, 30).map((i) => ({
        file: i.file,
        line: i.line,
        severity: i.severity,
        message: i.message,
        category: i.category,
      })),
    },
    suggestions,
    frameworks,
    folderStructure: analysis.folderStructure,
  };
}

function calculateScore(analysis: AnalysisResult): QualityScore {
  const filesRatio = analysis.totalFiles > 0 ? 1 : 0;

  // Code smells score (fewer is better)
  const smellCount = analysis.issues.filter((i) => i.category === "code-smell").length;
  const codeSmells = Math.max(0, 100 - smellCount * 5);

  // Complexity score
  const complexCount = analysis.complexFunctions.length;
  const complexity = Math.max(0, 100 - complexCount * 10);

  // Maintainability (based on large files and deep nesting)
  const largeFileCount = analysis.largeFiles.length;
  const nestingIssues = analysis.issues.filter((i) => i.message.includes("nesting")).length;
  const maintainability = Math.max(0, 100 - largeFileCount * 8 - nestingIssues * 12);

  // Best practices
  const todoCount = analysis.issues.filter((i) => i.category === "todo").length;
  const anyCount = analysis.issues.filter((i) => i.category === "typescript").length;
  const bestPractices = Math.max(0, 100 - todoCount * 2 - anyCount * 3);

  const overall = Math.round(
    (codeSmells * 0.25 + complexity * 0.25 + maintainability * 0.25 + bestPractices * 0.25) * filesRatio
  );

  return {
    overall,
    breakdown: {
      codeSmells: Math.round(codeSmells),
      complexity: Math.round(complexity),
      maintainability: Math.round(maintainability),
      bestPractices: Math.round(bestPractices),
    },
  };
}

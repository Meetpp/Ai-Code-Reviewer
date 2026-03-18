import OpenAI from "openai";
import * as path from "path";
import { AnalysisResult } from "./analysis.service";
import { FrameworkInfo } from "./framework.service";

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

export interface AISuggestions {
  summary: string;
  readability: string[];
  refactoring: string[];
  performance: string[];
  security: string[];
  bestPractices: string[];
  architectureSuggestions: string[];
  testSuggestions: string[];
}

export async function generateAISuggestions(
  analysis: AnalysisResult,
  frameworks: FrameworkInfo[]
): Promise<AISuggestions> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return generateFallbackSuggestions(analysis, frameworks);
  }

  const openai = new OpenAI({ apiKey });

  const prompt = buildPrompt(analysis, frameworks);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert code reviewer. Provide actionable, specific suggestions. Respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content) as AISuggestions;
    }
  } catch (err) {
    console.error("AI generation failed, using fallback:", err);
  }

  return generateFallbackSuggestions(analysis, frameworks);
}

function buildPrompt(analysis: AnalysisResult, frameworks: FrameworkInfo[]): string {
  const issuesSummary = analysis.issues.slice(0, 20).map((i) => `- [${i.severity}] ${i.file}: ${i.message}`).join("\n");
  const frameworkList = frameworks.map((f) => `${f.name} (${f.category})`).join(", ");
  const extensions = Object.entries(analysis.filesByExtension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(", ");

  return `Analyze this codebase and provide improvement suggestions as JSON with these keys:
summary (string), readability (string[]), refactoring (string[]), performance (string[]), security (string[]), bestPractices (string[]), architectureSuggestions (string[]), testSuggestions (string[]).

Project stats:
- Total files: ${analysis.totalFiles}
- Total lines: ${analysis.totalLines}
- File types: ${extensions}
- Frameworks: ${frameworkList || "None detected"}
- Issues found: ${analysis.issues.length}
- Complex functions: ${analysis.complexFunctions.length}
- Large files: ${analysis.largeFiles.length}

Top issues:
${issuesSummary || "No major issues found"}

Complex functions:
${analysis.complexFunctions.slice(0, 10).map((f) => `- ${f.file}: ${f.name} (${f.lines} lines)`).join("\n") || "None"}

Folder structure:
${analysis.folderStructure.slice(0, 20).join("\n") || "Flat structure"}

Provide 3-5 specific, actionable suggestions per category. Reference the actual frameworks and issues found.`;
}

function generateFallbackSuggestions(
  analysis: AnalysisResult,
  frameworks: FrameworkInfo[]
): AISuggestions {
  const suggestions: AISuggestions = {
    summary: `Project contains ${analysis.totalFiles} files with ${analysis.totalLines} lines of code. Found ${analysis.issues.length} issues across the codebase.`,
    readability: [],
    refactoring: [],
    performance: [],
    security: [],
    bestPractices: [],
    architectureSuggestions: [],
    testSuggestions: [],
  };

  // Generate context-aware fallback suggestions
  if (analysis.largeFiles.length > 0) {
    suggestions.refactoring.push(
      `Split large files into smaller modules. Found ${analysis.largeFiles.length} files over 300 lines.`
    );
  }

  if (analysis.complexFunctions.length > 0) {
    suggestions.refactoring.push(
      `Refactor complex functions — ${analysis.complexFunctions.length} functions exceed 50 lines.`
    );
  }

  const consoleIssues = analysis.issues.filter((i) => i.category === "code-smell");
  if (consoleIssues.length > 0) {
    suggestions.bestPractices.push(
      `Remove ${consoleIssues.length} console statements. Use a proper logging library instead.`
    );
  }

  const todoIssues = analysis.issues.filter((i) => i.category === "todo");
  if (todoIssues.length > 0) {
    suggestions.bestPractices.push(
      `Address ${todoIssues.length} TODO/FIXME comments found in the codebase.`
    );
  }

  const anyTypeIssues = analysis.issues.filter((i) => i.category === "typescript");
  if (anyTypeIssues.length > 0) {
    suggestions.readability.push(
      `Replace ${anyTypeIssues.length} usages of 'any' type with specific TypeScript types.`
    );
  }

  // Framework-specific suggestions
  const hasReact = frameworks.some((f) => f.name === "React");
  const hasNext = frameworks.some((f) => f.name === "Next.js");
  const hasExpress = frameworks.some((f) => f.name === "Express");
  const hasTailwind = frameworks.some((f) => f.name === "Tailwind CSS");
  const hasTS = frameworks.some((f) => f.name === "TypeScript");

  if (hasReact) {
    suggestions.performance.push("Use React.memo() for expensive components that re-render with same props.");
    suggestions.bestPractices.push("Extract reusable logic into custom hooks.");
  }

  if (hasNext) {
    suggestions.performance.push("Use Next.js Server Components for data-fetching pages.");
    suggestions.bestPractices.push("Implement proper loading.tsx and error.tsx boundaries.");
  }

  if (hasExpress) {
    suggestions.security.push("Add rate limiting middleware (express-rate-limit) to API endpoints.");
    suggestions.security.push("Implement input validation with a library like zod or joi.");
    suggestions.bestPractices.push("Use async error handling middleware to catch unhandled promise rejections.");
  }

  if (hasTailwind) {
    suggestions.readability.push("Extract repeated Tailwind class combinations into component abstractions.");
  }

  if (!hasTS && analysis.filesByExtension[".js"]) {
    suggestions.bestPractices.push("Consider migrating to TypeScript for better type safety and developer experience.");
  }

  if (!frameworks.some((f) => f.category === "testing")) {
    suggestions.testSuggestions.push("No testing framework detected. Add Jest or Vitest for unit testing.");
    suggestions.testSuggestions.push("Consider adding Playwright or Cypress for end-to-end testing.");
  }

  suggestions.architectureSuggestions.push("Organize code using a clear separation of concerns (services, controllers, models).");
  suggestions.readability.push("Use consistent naming conventions across the codebase.");
  suggestions.performance.push("Implement lazy loading for non-critical modules and assets.");
  suggestions.security.push("Keep dependencies up to date and audit for known vulnerabilities (npm audit).");

  return suggestions;
}

const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript", ".jsx": "jsx", ".ts": "typescript", ".tsx": "tsx",
  ".py": "python", ".java": "java", ".go": "go", ".rb": "ruby",
  ".php": "php", ".rs": "rust", ".c": "c", ".cpp": "cpp",
  ".css": "css", ".scss": "scss", ".html": "html", ".vue": "vue", ".svelte": "svelte",
};

export async function generateFileReview(
  filePath: string,
  fileContent: string
): Promise<FileSuggestion[]> {
  const ext = path.extname(filePath).toLowerCase();
  const lang = EXT_TO_LANG[ext] || "text";

  // Truncate very large files to stay within token limits
  const MAX_CHARS = 10000;
  const truncated = fileContent.length > MAX_CHARS;
  const content = truncated ? fileContent.slice(0, MAX_CHARS) + "\n// ... (file truncated for review)" : fileContent;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return generateFallbackFileReview(filePath, fileContent);
  }

  const openai = new OpenAI({ apiKey });

  const prompt = `You are an expert code reviewer. Analyze the following ${lang} file and return specific, line-level improvement suggestions.

File: ${filePath}
\`\`\`${lang}
${content}
\`\`\`

Return a JSON object with a "suggestions" array. Each suggestion must include:
- "title": short descriptive title (string)
- "lineNumber": the line number where the issue starts (number, 1-based)
- "lineEnd": optional end line for multi-line issues (number)
- "currentCode": the exact problematic code snippet from the file (string)
- "suggestedFix": the improved replacement code (string)
- "explanation": why this is an issue and how the fix helps (string)
- "type": one of "bug", "performance", "refactor", "security", "style", "best-practice", "code-smell"
- "severity": one of "error", "warning", "info"
- "diff": object with "before" (array of strings, lines being replaced) and "after" (array of strings, replacement lines)

Return 3 to 8 of the most impactful suggestions. Be specific — reference exact line numbers and code. Only output valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer. Provide specific, actionable line-level suggestions. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.items || []);
      return arr as FileSuggestion[];
    }
  } catch (err) {
    console.error("File review AI generation failed:", err);
  }

  return generateFallbackFileReview(filePath, fileContent);
}

function generateFallbackFileReview(filePath: string, fileContent: string): FileSuggestion[] {
  const lines = fileContent.split("\n");
  const suggestions: FileSuggestion[] = [];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (/console\.(log|warn|error|debug)\(/.test(trimmed) && suggestions.length < 3) {
      suggestions.push({
        title: "Remove console statement",
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: "// Use a proper logging library instead",
        explanation: "Console statements should be removed before production. Use a structured logging library (e.g. pino, winston) for better control over log levels and output.",
        type: "code-smell",
        severity: "warning",
        diff: { before: [line], after: ["  // TODO: replace with logger.debug(...)"] },
      });
    }

    if (/:\s*any(\s|;|,|\))/.test(trimmed) && suggestions.length < 5) {
      suggestions.push({
        title: "Avoid 'any' type — use explicit TypeScript type",
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: trimmed.replace(/:\s*any/g, ": unknown"),
        explanation: "Using 'any' defeats the purpose of TypeScript. Replace with a specific type or 'unknown' and add proper type narrowing.",
        type: "best-practice",
        severity: "warning",
        diff: { before: [line], after: [line.replace(/:\s*any/g, ": unknown")] },
      });
    }

    if (/\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(trimmed) && suggestions.length < 6) {
      suggestions.push({
        title: "Unresolved TODO comment",
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: "// Resolve or track this in your issue tracker",
        explanation: "TODO/FIXME comments indicate incomplete work. Track these as issues in your project tracker and remove the inline comment once resolved.",
        type: "code-smell",
        severity: "info",
        diff: { before: [line], after: [] },
      });
    }
  });

  if (suggestions.length === 0) {
    suggestions.push({
      title: "Add API key to enable AI-powered file reviews",
      lineNumber: 1,
      currentCode: fileContent.split("\n")[0] || "",
      suggestedFix: "Set OPENAI_API_KEY in server/.env to get detailed AI suggestions",
      explanation: "AI-powered file review requires an OpenAI API key. The static analysis above uses pattern matching only. Add your key to unlock full line-by-line AI suggestions.",
      type: "best-practice",
      severity: "info",
      diff: { before: [], after: [] },
    });
  }

  return suggestions;
}

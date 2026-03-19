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
  const ext = path.extname(filePath).toLowerCase();
  const isTS = [".ts", ".tsx"].includes(ext);
  const isJSX = [".jsx", ".tsx"].includes(ext);
  const MAX = 8;

  const push = (s: FileSuggestion) => { if (suggestions.length < MAX) suggestions.push(s); };

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)?.[1] ?? "";

    // ── console.* ──
    const consoleMatch = trimmed.match(/console\.(log|warn|error|debug)\((.{0,50})/);
    if (consoleMatch) {
      const method = consoleMatch[1];
      const args = consoleMatch[2].replace(/\);?\s*$/, "").trim();
      push({
        title: `Remove console.${method}(${args.slice(0, 20)}${args.length > 20 ? "…" : ""})`,
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: `logger.${method}(${args})`,
        explanation: `\`console.${method}(${args})\` leaks to the browser/stdout in production. Replace with a structured logger so you can control output per environment.`,
        type: "code-smell",
        severity: "warning",
        diff: { before: [line], after: [`${indent}// TODO: replace with logger.${method}(${args})`] },
      });
    }

    // ── any type ──
    const anyMatch = trimmed.match(/(\w+)\s*:\s*any(\s|;|,|\))/);
    if (anyMatch && isTS) {
      const varName = anyMatch[1];
      const fixed = trimmed.replace(/:\s*any/, ": unknown");
      push({
        title: `Replace \`${varName}: any\` with a proper type`,
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: fixed,
        explanation: `\`${varName}: any\` disables type-checking for this binding. Use \`unknown\` with a type guard, or define an interface that describes the actual shape.`,
        type: "best-practice",
        severity: "warning",
        diff: { before: [line], after: [line.replace(/:\s*any/, ": unknown")] },
      });
    }

    // ── TODO / FIXME / HACK ──
    const todoMatch = trimmed.match(/\/\/\s*(TODO|FIXME|HACK|XXX)[:\s]*(.*)/i);
    if (todoMatch) {
      const tag = todoMatch[1].toUpperCase();
      const detail = todoMatch[2].trim();
      push({
        title: `Unresolved ${tag}${detail ? `: "${detail.slice(0, 35)}"` : ""}`,
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: detail ? `// Track in issue tracker: ${detail}` : `// Create a ticket and remove this comment`,
        explanation: `This ${tag}${detail ? ` ("${detail}")` : ""} marks incomplete work. Move it to your issue tracker so it doesn't get lost in the code.`,
        type: "code-smell",
        severity: "info",
        diff: { before: [line], after: [] },
      });
    }

    // ── Empty catch block ──
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
      push({
        title: "Empty catch block swallows errors silently",
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: trimmed.replace(/\{\s*\}/, "{ /* log or rethrow */ }"),
        explanation: "An empty catch block hides failures. At minimum log the error, or rethrow if you can't handle it here.",
        type: "bug",
        severity: "error",
        diff: { before: [line], after: [line.replace(/\{\s*\}/, "{ /* log or rethrow */ }")] },
      });
    }

    // ── Nested ternary ──
    if (/\?[^:]+\?/.test(trimmed)) {
      push({
        title: "Nested ternary is hard to read",
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: "// Refactor into an if/else or a helper function",
        explanation: "Nested ternaries reduce readability. Extract the logic into an if/else block or a small named function so intent is clearer.",
        type: "refactor",
        severity: "warning",
        diff: { before: [line], after: [`${indent}// TODO: refactor nested ternary into if/else`] },
      });
    }

    // ── Very long line (> 150 chars) ──
    if (line.length > 150 && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
      push({
        title: `Line is ${line.length} chars — consider splitting`,
        lineNumber: lineNum,
        currentCode: trimmed.slice(0, 60) + "…",
        suggestedFix: "// Break into multiple lines or extract variables",
        explanation: `At ${line.length} characters this line is hard to scan. Split it into multiple lines or extract sub-expressions into named variables.`,
        type: "style",
        severity: "info",
        diff: { before: [line.slice(0, 80) + "…"], after: [`${indent}// TODO: split long line`] },
      });
    }

    // ── import * as (barrel import) ──
    const barrelMatch = trimmed.match(/import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/);
    if (barrelMatch) {
      const alias = barrelMatch[1];
      const mod = barrelMatch[2];
      push({
        title: `Barrel import \`* as ${alias}\` from "${mod}"`,
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: `import { /* only what you need */ } from "${mod}"`,
        explanation: `\`import * as ${alias}\` pulls in everything from "${mod}", which hurts tree-shaking and increases bundle size. Import only the exports you use.`,
        type: "performance",
        severity: "warning",
        diff: { before: [line], after: [`${indent}import { /* needed exports */ } from "${mod}";`] },
      });
    }

    // ── Hardcoded color / magic string in JSX ──
    if (isJSX && /className=.*#[0-9a-fA-F]{3,8}/.test(trimmed)) {
      push({
        title: "Hardcoded color value in className",
        lineNumber: lineNum,
        currentCode: trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : ""),
        suggestedFix: "// Extract color to a CSS variable or Tailwind config",
        explanation: "Hardcoded hex colors scattered in JSX are hard to maintain. Centralize them in your Tailwind config or CSS custom properties for consistency.",
        type: "style",
        severity: "info",
        diff: { before: [line], after: [`${indent}// TODO: move color to theme config`] },
      });
    }

    // ── useState without type param in TS ──
    const useStateMatch = trimmed.match(/useState\(\s*\)/);
    if (useStateMatch && isTS) {
      push({
        title: "useState() with no initial value or type",
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: trimmed.replace("useState()", "useState<Type>(initialValue)"),
        explanation: "Calling `useState()` with no argument and no type parameter defaults to `undefined`. Add an explicit type like `useState<string>(\"\")` so consumers don't have to null-check.",
        type: "best-practice",
        severity: "warning",
        diff: { before: [line], after: [line.replace("useState()", "useState<Type>(initialValue)")] },
      });
    }

    // ── document.querySelector / getElementById (in React/JSX) ──
    if (isJSX && /document\.(querySelector|getElementById|getElementsBy)/.test(trimmed)) {
      const domMethod = trimmed.match(/document\.(\w+)/)?.[1] ?? "querySelector";
      push({
        title: `Direct DOM access via \`document.${domMethod}\``,
        lineNumber: lineNum,
        currentCode: trimmed,
        suggestedFix: "// Use useRef() instead of direct DOM access",
        explanation: `In React, direct DOM access via \`document.${domMethod}\` bypasses the virtual DOM and can cause bugs. Use \`useRef()\` and attach it to the JSX element.`,
        type: "bug",
        severity: "error",
        diff: { before: [line], after: [`${indent}// TODO: replace document.${domMethod} with useRef()`] },
      });
    }

    // ── Hardcoded API URL / secret-looking string ──
    const secretMatch = trimmed.match(/(["'])(https?:\/\/[^"']{10,}|sk-[a-zA-Z0-9]{10,}|ghp_[a-zA-Z0-9]+)\1/);
    if (secretMatch) {
      const val = secretMatch[2].slice(0, 25) + "…";
      push({
        title: `Hardcoded value "${val}" — use env variable`,
        lineNumber: lineNum,
        currentCode: trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : ""),
        suggestedFix: "// Move to environment variable (process.env.XXX)",
        explanation: `Hardcoded URLs or tokens like "${val}" should live in environment variables so they can change between environments without code changes.`,
        type: "security",
        severity: "error",
        diff: { before: [line], after: [`${indent}// TODO: move to process.env`] },
      });
    }
  });

  // ── File-level: no "use client" in .tsx with hooks ──
  if (isJSX && /use(State|Effect|Ref|Callback|Memo|Context)\s*\(/.test(fileContent) && !fileContent.startsWith('"use client"') && !fileContent.startsWith("'use client'")) {
    push({
      title: 'Missing "use client" directive — file uses React hooks',
      lineNumber: 1,
      currentCode: lines[0] || "",
      suggestedFix: '"use client";',
      explanation: "This file uses React hooks but doesn't have a \"use client\" directive. In Next.js App Router this will fail at runtime. Add it as the first line.",
      type: "bug",
      severity: "error",
      diff: { before: [lines[0] || ""], after: ['"use client";', "", lines[0] || ""] },
    });
  }

  // ── File-level: very long file ──
  if (lines.length > 300) {
    push({
      title: `File is ${lines.length} lines — consider splitting`,
      lineNumber: 1,
      currentCode: lines[0] || "",
      suggestedFix: "// Split into smaller, focused modules",
      explanation: `At ${lines.length} lines this file does too much. Extract logical sections (helpers, types, sub-components) into their own files for better maintainability.`,
      type: "refactor",
      severity: "info",
      diff: { before: [], after: [] },
    });
  }

  // If still nothing found — say the file looks clean, no filler "add API key" card
  if (suggestions.length === 0) {
    suggestions.push({
      title: "No issues detected — file looks clean",
      lineNumber: 1,
      currentCode: lines[0] || "",
      suggestedFix: "// No changes needed",
      explanation: "Static analysis found no common issues in this file. For deeper review (logic bugs, architecture, naming), set OPENAI_API_KEY in server/.env.",
      type: "best-practice",
      severity: "info",
      diff: { before: [], after: [] },
    });
  }

  return suggestions;
}

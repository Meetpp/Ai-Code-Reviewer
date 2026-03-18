import fs from "fs/promises";
import path from "path";

export interface AnalysisResult {
  totalFiles: number;
  totalLines: number;
  filesByExtension: Record<string, number>;
  issues: CodeIssue[];
  complexFunctions: ComplexFunction[];
  duplicates: DuplicateBlock[];
  folderStructure: string[];
  largeFiles: { file: string; lines: number }[];
}

export interface CodeIssue {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
  category: string;
}

export interface ComplexFunction {
  file: string;
  name: string;
  lines: number;
  complexity: string;
}

export interface DuplicateBlock {
  files: string[];
  lines: number;
  snippet: string;
}

const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rb", ".php",
  ".css", ".scss", ".html", ".vue", ".svelte", ".rs", ".c", ".cpp",
]);

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "vendor",
  "__pycache__", ".cache", "coverage", ".nyc_output",
]);

export async function analyzeCode(repoPath: string): Promise<AnalysisResult> {
  const files = await collectFiles(repoPath, repoPath);
  const filesByExtension: Record<string, number> = {};
  const issues: CodeIssue[] = [];
  const complexFunctions: ComplexFunction[] = [];
  const largeFiles: { file: string; lines: number }[] = [];
  let totalLines = 0;

  for (const filePath of files) {
    const ext = path.extname(filePath);
    filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;

    if (!CODE_EXTENSIONS.has(ext)) continue;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      totalLines += lines.length;
      const relPath = path.relative(repoPath, filePath);

      if (lines.length > 300) {
        largeFiles.push({ file: relPath, lines: lines.length });
        issues.push({
          file: relPath,
          severity: "warning",
          message: `File has ${lines.length} lines — consider splitting into smaller modules`,
          category: "file-size",
        });
      }

      analyzeFileContent(content, relPath, lines, issues, complexFunctions);
    } catch {
      // skip unreadable files
    }
  }

  const duplicates = findDuplicatePatterns(files, repoPath);
  const folderStructure = await getFolderStructure(repoPath);

  return {
    totalFiles: files.length,
    totalLines,
    filesByExtension,
    issues,
    complexFunctions,
    duplicates,
    folderStructure,
    largeFiles,
  };
}

function analyzeFileContent(
  content: string,
  filePath: string,
  lines: string[],
  issues: CodeIssue[],
  complexFunctions: ComplexFunction[]
) {
  // Check for console.log statements
  lines.forEach((line, i) => {
    if (/console\.(log|debug|info)\(/.test(line) && !/\/\//.test(line.split("console")[0])) {
      issues.push({
        file: filePath,
        line: i + 1,
        severity: "warning",
        message: "Console statement found — remove before production",
        category: "code-smell",
      });
    }
  });

  // Check for TODO/FIXME/HACK comments
  lines.forEach((line, i) => {
    const match = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX)[\s:](.*)/i);
    if (match) {
      issues.push({
        file: filePath,
        line: i + 1,
        severity: "info",
        message: `${match[1].toUpperCase()}: ${match[2].trim()}`,
        category: "todo",
      });
    }
  });

  // Check for long functions
  const funcRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\(.*\)\s*\{)/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1] || match[2] || match[3];
    const startPos = match.index;
    const funcBody = extractFunctionBody(content, startPos);
    if (funcBody) {
      const funcLines = funcBody.split("\n").length;
      if (funcLines > 50) {
        complexFunctions.push({
          file: filePath,
          name: funcName,
          lines: funcLines,
          complexity: funcLines > 100 ? "high" : "medium",
        });
        issues.push({
          file: filePath,
          severity: "warning",
          message: `Function '${funcName}' is ${funcLines} lines long — consider refactoring`,
          category: "complexity",
        });
      }
    }
  }

  // Check for deeply nested code
  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of lines) {
    currentNesting += (line.match(/{/g) || []).length;
    currentNesting -= (line.match(/}/g) || []).length;
    maxNesting = Math.max(maxNesting, currentNesting);
  }
  if (maxNesting > 5) {
    issues.push({
      file: filePath,
      severity: "warning",
      message: `Deep nesting detected (${maxNesting} levels) — consider extracting logic`,
      category: "complexity",
    });
  }

  // Check for magic numbers
  const magicNumberRegex = /[^.\w](\d{2,})[^.\w\d]/g;
  let magicMatch;
  while ((magicMatch = magicNumberRegex.exec(content)) !== null) {
    const num = parseInt(magicMatch[1]);
    if (num > 1 && num !== 100 && num !== 1000) {
      const lineNum = content.substring(0, magicMatch.index).split("\n").length;
      // Only report first few
      const existingMagic = issues.filter(
        (i) => i.file === filePath && i.category === "magic-number"
      );
      if (existingMagic.length < 3) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: "info",
          message: `Magic number ${num} — consider using a named constant`,
          category: "magic-number",
        });
      }
    }
  }

  // Check for any type usage in TypeScript
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    lines.forEach((line, i) => {
      if (/:\s*any\b/.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          severity: "warning",
          message: "Usage of 'any' type — consider using a specific type",
          category: "typescript",
        });
      }
    });
  }
}

function extractFunctionBody(content: string, startPos: number): string | null {
  let braceCount = 0;
  let started = false;
  let bodyStart = startPos;

  for (let i = startPos; i < content.length && i < startPos + 10000; i++) {
    if (content[i] === "{") {
      if (!started) bodyStart = i;
      started = true;
      braceCount++;
    } else if (content[i] === "}") {
      braceCount--;
      if (started && braceCount === 0) {
        return content.substring(bodyStart, i + 1);
      }
    }
  }
  return null;
}

function findDuplicatePatterns(files: string[], repoPath: string): DuplicateBlock[] {
  // Simplified duplicate detection — tracks repeated file names (indicating possible duplication)
  const fileNames = new Map<string, string[]>();
  for (const file of files) {
    const name = path.basename(file);
    const ext = path.extname(file);
    if (!CODE_EXTENSIONS.has(ext)) continue;
    if (!fileNames.has(name)) fileNames.set(name, []);
    fileNames.get(name)!.push(path.relative(repoPath, file));
  }

  const duplicates: DuplicateBlock[] = [];
  for (const [name, paths] of fileNames) {
    if (paths.length > 1) {
      duplicates.push({
        files: paths,
        lines: 0,
        snippet: `Multiple files named '${name}' found`,
      });
    }
  }
  return duplicates;
}

async function collectFiles(dir: string, rootDir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(fullPath, rootDir)));
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // skip unreadable directories
  }
  return files;
}

async function getFolderStructure(repoPath: string, depth = 2): Promise<string[]> {
  const structure: string[] = [];

  async function walk(dir: string, currentDepth: number, prefix: string) {
    if (currentDepth > depth) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name));
      for (const d of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
        structure.push(`${prefix}${d.name}/`);
        await walk(path.join(dir, d.name), currentDepth + 1, prefix + "  ");
      }
    } catch {
      // skip
    }
  }

  await walk(repoPath, 0, "");
  return structure;
}

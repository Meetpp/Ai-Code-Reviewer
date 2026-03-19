# AI Code Reviewer — Feature Documentation

> **Project:** AI Code Reviewer
> **Stack:** Next.js (Client) · Express + TypeScript (Server) · OpenAI GPT-4o-mini
> **Last Updated:** March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Code Structure](#2-architecture--code-structure)
3. [Features](#3-features)
4. [How Prompts Work](#4-how-prompts-work)
5. [User Flow](#5-user-flow)
6. [API Reference](#6-api-reference)

---

## 1. Project Overview

AI Code Reviewer is a full-stack tool that **clones a public GitHub/GitLab/Bitbucket repo**, scans it for code quality issues, generates AI-powered suggestions, and optionally creates a pull request with **review comments** (not code replacements) on the flagged lines.

### What It Does

| Capability | Description |
|---|---|
| **Repo Cloning** | Shallow-clones any public repo via URL |
| **Static Analysis** | Scans for console leaks, `any` types, TODOs, deep nesting, large files, complex functions |
| **Framework Detection** | Auto-detects React, Next.js, Express, Tailwind, testing libs, etc. |
| **Quality Scoring** | Calculates a 0–100 score across 4 dimensions |
| **AI Suggestions** | Codebase-level + file-level review via OpenAI (with smart fallback) |
| **Accept / Reject** | User picks which suggestions to keep |
| **PR Creation** | Creates a GitHub PR that adds inline review comments — **no code is replaced** |

---

## 2. Architecture & Code Structure

```
code-reviewr/
├── client/                          # Next.js frontend
│   └── src/
│       ├── app/
│       │   ├── page.tsx             # Home — orchestrates the full review flow
│       │   ├── layout.tsx           # Root layout
│       │   └── globals.css          # Tailwind global styles
│       ├── components/
│       │   ├── SubmitForm.tsx        # Repo URL input form
│       │   ├── StatusBar.tsx         # Progress indicator (cloning → analyzing → done)
│       │   ├── ReportView.tsx        # Full report: score, issues, AI suggestions
│       │   ├── FileReviewDrawer.tsx  # Slide-over panel for per-file AI review
│       │   └── CreatePRPanel.tsx     # Floating panel to create a GitHub PR
│       └── context/
│           └── AcceptedChangesContext.tsx  # Tracks accepted/rejected suggestions
│
├── server/                          # Express backend
│   └── src/
│       ├── index.ts                 # Express entry point (CORS, routes, health check)
│       ├── routes/
│       │   └── review.ts            # REST endpoints: submit, status, file, create-pr
│       └── services/
│           ├── git.service.ts       # Clone & cleanup repos (shallow, --depth 1)
│           ├── analysis.service.ts  # Static code analysis (issues, complexity, metrics)
│           ├── framework.service.ts # Tech stack detection from package.json / configs
│           ├── ai.service.ts        # OpenAI integration + fallback pattern matching
│           ├── report.service.ts    # Builds the final ReviewReport with quality score
│           └── github.service.ts    # GitHub API: create branch, add comments, open PR
```

### Key Data Flow

```
User enters repo URL
  → POST /api/review/submit
    → cloneRepo()          (git.service)
    → analyzeCode()        (analysis.service)
    → detectFrameworks()   (framework.service)
    → generateAISuggestions()  (ai.service)
    → buildReport()        (report.service)
  → GET /api/review/status/:id  (polling every 2s)
  → Report displayed on client

User clicks a file
  → POST /api/review/file
    → generateFileReview()  (ai.service)
  → FileReviewDrawer opens with suggestions

User accepts suggestions → clicks "Create PR"
  → POST /api/review/create-pr
    → createGitHubPR()  (github.service)
    → Adds review comments above flagged lines (does NOT replace code)
```

---

## 3. Features

### 3.1 Repository Submission

**Component:** `SubmitForm.tsx`
**Endpoint:** `POST /api/review/submit`

User pastes a public repo URL. Supported hosts: GitHub, GitLab, Bitbucket.
The server clones with `git clone --depth 1` (fast, minimal bandwidth).

### 3.2 Static Code Analysis

**Service:** `analysis.service.ts`

Scans every file and detects:

| Issue | Severity | Category |
|---|---|---|
| `console.log/warn/error` calls | warning | code-smell |
| `// TODO`, `// FIXME`, `// HACK` | info | todo |
| Functions > 50 lines | warning | complexity |
| Nesting > 5 levels deep | warning | complexity |
| Magic numbers (unnamed constants) | info | code-smell |
| `: any` in TypeScript files | warning | typescript |
| Files > 300 lines | info | large-file |

**Output:** `AnalysisResult` — total files, total lines, file extension breakdown, issues array, complex functions list, folder structure.

### 3.3 Framework Detection

**Service:** `framework.service.ts`

Reads `package.json` (and config files like `tsconfig.json`, `tailwind.config.js`) to detect:

- **Frontend:** React, Vue, Angular, Svelte, Next.js, Nuxt
- **Backend:** Express, Fastify, NestJS, Koa
- **Styling:** Tailwind CSS, styled-components, Sass
- **Testing:** Jest, Vitest, Mocha, Playwright, Cypress
- **Languages:** TypeScript, Python, Go, Rust

### 3.4 Quality Score

**Service:** `report.service.ts`

Calculates a **0–100 composite score** from 4 equally weighted dimensions:

| Dimension | Penalizes |
|---|---|
| Code Smells (25%) | Console statements, magic numbers |
| Complexity (25%) | Long functions, deep nesting |
| Maintainability (25%) | Large files, missing structure |
| Best Practices (25%) | `any` types, TODO comments |

Displayed as an animated circular progress ring in `ReportView.tsx`.

### 3.5 AI-Powered Review (Codebase Level)

**Service:** `ai.service.ts` → `generateAISuggestions()`

Returns suggestions across 7 categories:
`readability`, `refactoring`, `performance`, `security`, `bestPractices`, `architectureSuggestions`, `testSuggestions`

Each category contains 3–5 actionable string suggestions.

### 3.6 AI-Powered Review (File Level)

**Service:** `ai.service.ts` → `generateFileReview()`

When the user clicks a file, the server sends that file's content to OpenAI and gets back 3–8 line-level `FileSuggestion` items containing:

- `lineNumber` — exact line
- `currentCode` / `suggestedFix` — before/after
- `severity` — error | warning | info
- `type` — bug | performance | refactor | security | style | best-practice | code-smell
- `diff` — before/after line arrays

### 3.7 Accept / Reject / Undo

**Context:** `AcceptedChangesContext.tsx`

| Action | What Happens |
|---|---|
| **Accept** | Suggestion stored in context, card turns green |
| **Reject** | Suggestion greyed out, card fades |
| **Undo** | Resets suggestion to neutral state |

Accepted suggestions are grouped by file via `getChangesForPR()` for the PR step.

### 3.8 Pull Request Creation (Comment-Only)

**Service:** `github.service.ts` → `createGitHubPR()`
**Component:** `CreatePRPanel.tsx`

When the user clicks "Create PR":

1. Creates a new branch `ai-review-fixes-{timestamp}`
2. For each accepted suggestion, **inserts a comment block above the flagged line** — the original code stays untouched:

```
// AI Review [type] (severity): title
// Suggestion: suggestedFix
// Reason: explanation
```

3. Opens a PR against the default branch with a summary of all review comments.

**The PR does NOT modify any source code — it only adds review comments.**

---

## 4. How Prompts Work

The AI service sends two types of prompts to **OpenAI GPT-4o-mini**.

### 4.1 Codebase-Level Prompt

**System message:**
```
You are an expert code reviewer. Provide actionable, specific suggestions.
Respond with valid JSON only.
```

**User message (built by `buildPrompt()`):**
```
Analyze this codebase and provide improvement suggestions as JSON with these keys:
summary (string), readability (string[]), refactoring (string[]),
performance (string[]), security (string[]), bestPractices (string[]),
architectureSuggestions (string[]), testSuggestions (string[]).

Project stats:
- Total files: {totalFiles}
- Total lines: {totalLines}
- File types: .ts: 24, .tsx: 8, .css: 2
- Frameworks: React (frontend), Express (backend)
- Issues found: {count}
- Complex functions: {count}
- Large files: {count}

Top issues:
- [warning] src/api.ts: console.log found
- [warning] src/utils.ts: any type usage
...

Complex functions:
- src/parser.ts: parseData (82 lines)
...

Folder structure:
src/
  components/
  services/
...

Provide 3-5 specific, actionable suggestions per category.
Reference the actual frameworks and issues found.
```

**Config:** `temperature: 0.3`, `response_format: json_object`

---

### 4.2 File-Level Prompt

**System message:**
```
You are an expert code reviewer. Provide specific, actionable line-level
suggestions. Always respond with valid JSON only.
```

**User message:**
```
You are an expert code reviewer. Analyze the following {language} file
and return specific, line-level improvement suggestions.

File: {filePath}
```{language}
{fileContent — truncated at 10,000 chars if needed}
```

Return a JSON object with a "suggestions" array. Each suggestion must include:
- "title": short descriptive title (string)
- "lineNumber": the line number where the issue starts (number, 1-based)
- "lineEnd": optional end line for multi-line issues (number)
- "currentCode": the exact problematic code snippet (string)
- "suggestedFix": the improved replacement code (string)
- "explanation": why this is an issue and how the fix helps (string)
- "type": one of "bug", "performance", "refactor", "security",
          "style", "best-practice", "code-smell"
- "severity": one of "error", "warning", "info"
- "diff": { "before": string[], "after": string[] }

Return 3 to 8 of the most impactful suggestions. Be specific —
reference exact line numbers and code. Only output valid JSON.
```

**Config:** `temperature: 0.2`, `response_format: json_object`

---

### 4.3 Fallback (No API Key)

When `OPENAI_API_KEY` is not set, `generateFallbackFileReview()` uses **regex pattern matching** to generate dynamic suggestions:

| Pattern | Example Title Generated |
|---|---|
| `console.log(userData)` | `Remove console.log() call` — references `userData` |
| `data: any` | `Replace \`data: any\` with a specific type` — names the variable |
| `// TODO: add validation` | `Unresolved TODO: "add validation"` — quotes the actual text |

These are **context-aware**: every suggestion title, explanation, and fix references the actual matched code, not generic strings.

---

## 5. User Flow

```
┌─────────────────────┐
│  1. Paste repo URL   │
│     (SubmitForm)     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  2. Wait for scan    │
│     (StatusBar)      │
│  cloning → analyzing │
│  → generating → done │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  3. View report      │
│     (ReportView)     │
│  Score • Issues •    │
│  AI suggestions      │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  4. Click a file     │
│  (FileReviewDrawer)  │
│  Line-level review   │
│  Accept / Reject     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  5. Create PR        │
│  (CreatePRPanel)     │
│  Adds review comments│
│  No code replaced    │
└─────────────────────┘
```

---

## 6. API Reference

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `POST` | `/api/review/submit` | `{ repoUrl }` | `{ jobId, status }` |
| `GET` | `/api/review/status/:jobId` | — | `{ id, status, report, error }` |
| `POST` | `/api/review/file` | `{ jobId, filePath }` | `{ suggestions: FileSuggestion[] }` |
| `POST` | `/api/review/create-pr` | `{ jobId, githubToken, acceptedChanges, prTitle? }` | `{ prUrl, prNumber, branchName }` |
| `GET` | `/api/health` | — | `{ status: "ok" }` |

### Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `3001` | Server port |
| `OPENAI_API_KEY` | No | — | Enables AI review (fallback works without it) |
| `NEXT_PUBLIC_API_URL` | No | `""` | Client → server base URL |

---

*Generated for AI Code Reviewer — March 2026*

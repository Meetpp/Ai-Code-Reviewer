import fs from "fs/promises";
import path from "path";

export interface FrameworkInfo {
  name: string;
  version?: string;
  category: "frontend" | "backend" | "styling" | "testing" | "build" | "language" | "database" | "other";
}

interface DetectionRule {
  name: string;
  category: FrameworkInfo["category"];
  packageNames?: string[];
  files?: string[];
  devOnly?: boolean;
}

const DETECTION_RULES: DetectionRule[] = [
  // Frontend frameworks
  { name: "React", category: "frontend", packageNames: ["react"] },
  { name: "Next.js", category: "frontend", packageNames: ["next"] },
  { name: "Vue.js", category: "frontend", packageNames: ["vue"] },
  { name: "Nuxt.js", category: "frontend", packageNames: ["nuxt"] },
  { name: "Angular", category: "frontend", packageNames: ["@angular/core"] },
  { name: "Svelte", category: "frontend", packageNames: ["svelte"] },
  { name: "Remix", category: "frontend", packageNames: ["@remix-run/react"] },
  { name: "Astro", category: "frontend", packageNames: ["astro"] },

  // Backend frameworks
  { name: "Express", category: "backend", packageNames: ["express"] },
  { name: "Fastify", category: "backend", packageNames: ["fastify"] },
  { name: "NestJS", category: "backend", packageNames: ["@nestjs/core"] },
  { name: "Hono", category: "backend", packageNames: ["hono"] },
  { name: "Koa", category: "backend", packageNames: ["koa"] },

  // Styling
  { name: "Tailwind CSS", category: "styling", packageNames: ["tailwindcss"], files: ["tailwind.config.js", "tailwind.config.ts"] },
  { name: "Styled Components", category: "styling", packageNames: ["styled-components"] },
  { name: "Sass", category: "styling", packageNames: ["sass", "node-sass"] },
  { name: "Emotion", category: "styling", packageNames: ["@emotion/react"] },

  // Testing
  { name: "Jest", category: "testing", packageNames: ["jest"], devOnly: true },
  { name: "Vitest", category: "testing", packageNames: ["vitest"], devOnly: true },
  { name: "Cypress", category: "testing", packageNames: ["cypress"], devOnly: true },
  { name: "Playwright", category: "testing", packageNames: ["@playwright/test"], devOnly: true },

  // Build tools
  { name: "Vite", category: "build", packageNames: ["vite"] },
  { name: "Webpack", category: "build", packageNames: ["webpack"] },
  { name: "esbuild", category: "build", packageNames: ["esbuild"] },
  { name: "Turbopack", category: "build", files: ["turbo.json"] },

  // Languages
  { name: "TypeScript", category: "language", packageNames: ["typescript"], files: ["tsconfig.json"] },

  // Databases
  { name: "Prisma", category: "database", packageNames: ["prisma", "@prisma/client"], files: ["prisma/schema.prisma"] },
  { name: "Drizzle", category: "database", packageNames: ["drizzle-orm"] },
  { name: "Mongoose", category: "database", packageNames: ["mongoose"] },
  { name: "TypeORM", category: "database", packageNames: ["typeorm"] },
];

export async function detectFrameworks(repoPath: string): Promise<FrameworkInfo[]> {
  const detected: FrameworkInfo[] = [];
  const seen = new Set<string>();

  // Read package.json
  try {
    const pkgJson = JSON.parse(
      await fs.readFile(path.join(repoPath, "package.json"), "utf-8")
    );
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    };

    for (const rule of DETECTION_RULES) {
      if (seen.has(rule.name)) continue;
      if (rule.packageNames) {
        for (const pkgName of rule.packageNames) {
          if (allDeps[pkgName]) {
            detected.push({
              name: rule.name,
              version: allDeps[pkgName],
              category: rule.category,
            });
            seen.add(rule.name);
            break;
          }
        }
      }
    }
  } catch {
    // No package.json or not a JS project
  }

  // Check for config files
  for (const rule of DETECTION_RULES) {
    if (seen.has(rule.name)) continue;
    if (rule.files) {
      for (const file of rule.files) {
        try {
          await fs.access(path.join(repoPath, file));
          detected.push({ name: rule.name, category: rule.category });
          seen.add(rule.name);
          break;
        } catch {
          // file doesn't exist
        }
      }
    }
  }

  // Detect Python projects
  try {
    await fs.access(path.join(repoPath, "requirements.txt"));
    detected.push({ name: "Python", category: "language" });

    const reqs = await fs.readFile(path.join(repoPath, "requirements.txt"), "utf-8");
    if (reqs.includes("django")) detected.push({ name: "Django", category: "backend" });
    if (reqs.includes("flask")) detected.push({ name: "Flask", category: "backend" });
    if (reqs.includes("fastapi")) detected.push({ name: "FastAPI", category: "backend" });
  } catch {}

  // Detect Go projects
  try {
    await fs.access(path.join(repoPath, "go.mod"));
    detected.push({ name: "Go", category: "language" });
  } catch {}

  // Detect Rust projects
  try {
    await fs.access(path.join(repoPath, "Cargo.toml"));
    detected.push({ name: "Rust", category: "language" });
  } catch {}

  return detected;
}

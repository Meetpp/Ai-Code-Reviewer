import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

const REPOS_DIR = path.join(process.cwd(), "repos");

export async function cloneRepo(repoUrl: string): Promise<string> {
  await fs.mkdir(REPOS_DIR, { recursive: true });

  const repoId = uuidv4();
  const repoPath = path.join(REPOS_DIR, repoId);

  // Normalize URL — remove trailing .git if present, then add .git
  const normalizedUrl = repoUrl.replace(/\.git\/?$/, "") + ".git";

  const git = simpleGit();
  // Disable interactive prompts so private repos fail fast
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

  try {
    await git.env(env).clone(normalizedUrl, repoPath, ["--depth", "1", "--single-branch"]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("could not read Username") || message.includes("Authentication failed")) {
      throw new Error("Repository not found or is private. Please make sure the repository is public and the URL is correct.");
    }
    if (message.includes("not found") || message.includes("does not exist")) {
      throw new Error("Repository not found. Please check the URL and try again.");
    }

    throw new Error(`Failed to clone repository: ${message}`);
  }

  return repoPath;
}

export async function cleanupRepo(repoPath: string): Promise<void> {
  await fs.rm(repoPath, { recursive: true, force: true });
}

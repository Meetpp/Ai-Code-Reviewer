import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

const REPOS_DIR = path.join(process.cwd(), "repos");
const CLONE_TIMEOUT_MS = 60_000; // 60 seconds

export async function cloneRepo(repoUrl: string): Promise<string> {
  await fs.mkdir(REPOS_DIR, { recursive: true });

  const repoId = uuidv4();
  const repoPath = path.join(REPOS_DIR, repoId);

  // Normalize URL — strip trailing .git then add it back
  const normalizedUrl = repoUrl.replace(/\.git\/?$/, "") + ".git";

  const git = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS },
  });

  // Disable interactive prompts so private repos fail fast instead of hanging
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -o BatchMode=yes" };

  try {
    await git.env(env).clone(normalizedUrl, repoPath, [
      "--depth", "1",
      "--single-branch",
      "--no-tags",
    ]);
  } catch (err) {
    // Clean up any partial clone directory
    await fs.rm(repoPath, { recursive: true, force: true }).catch(() => {});

    const message = err instanceof Error ? err.message : String(err);

    if (
      message.includes("could not read Username") ||
      message.includes("Authentication failed") ||
      message.includes("invalid credentials")
    ) {
      throw new Error(
        "Repository not found or is private. Make sure the repository is public and the URL is correct."
      );
    }
    if (
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("Repository not found")
    ) {
      throw new Error("Repository not found. Please check the URL and try again.");
    }
    if (message.includes("timed out") || message.includes("timeout")) {
      throw new Error(
        "Clone timed out. The repository may be too large or the network is slow."
      );
    }

    throw new Error(`Failed to clone repository: ${message}`);
  }

  return repoPath;
}

export async function cleanupRepo(repoPath: string): Promise<void> {
  await fs.rm(repoPath, { recursive: true, force: true });
}

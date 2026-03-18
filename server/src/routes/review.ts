import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { cloneRepo, cleanupRepo } from "../services/git.service";
import { analyzeCode } from "../services/analysis.service";
import { detectFrameworks } from "../services/framework.service";
import { generateAISuggestions, generateFileReview } from "../services/ai.service";
import { buildReport, ReviewReport } from "../services/report.service";

const router = Router();

interface ReviewJob {
  id: string;
  status: "pending" | "cloning" | "analyzing" | "generating" | "complete" | "error";
  repoUrl: string;
  repoPath?: string;
  report?: ReviewReport;
  error?: string;
  createdAt: Date;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const jobs = new Map<string, ReviewJob>();

const CLEANUP_DELAY_MS = 60 * 60 * 1000; // 1 hour

router.post("/submit", async (req: Request, res: Response) => {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== "string") {
    res.status(400).json({ error: "repoUrl is required" });
    return;
  }

  const urlPattern = /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/.+\/.+/;
  if (!urlPattern.test(repoUrl)) {
    res.status(400).json({ error: "Invalid repository URL. Supported: GitHub, GitLab, Bitbucket" });
    return;
  }

  const jobId = uuidv4();
  const job: ReviewJob = {
    id: jobId,
    status: "pending",
    repoUrl,
    createdAt: new Date(),
  };
  jobs.set(jobId, job);

  res.json({ jobId, status: job.status });

  processReview(job).catch((err) => {
    job.status = "error";
    job.error = err instanceof Error ? err.message : "Unknown error";
  });
});

router.get("/status/:jobId", (req: Request<{ jobId: string }>, res: Response) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    report: job.report || null,
    error: job.error || null,
  });
});

router.post("/file", async (req: Request, res: Response) => {
  const { jobId, filePath } = req.body;

  if (!jobId || !filePath) {
    res.status(400).json({ error: "jobId and filePath are required" });
    return;
  }

  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "complete" || !job.repoPath) {
    res.status(400).json({ error: "Review not complete or repository no longer available" });
    return;
  }

  // Prevent path traversal
  const repoRoot = path.resolve(job.repoPath);
  const fullPath = path.resolve(repoRoot, filePath);
  if (!fullPath.startsWith(repoRoot + path.sep) && fullPath !== repoRoot) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }

  try {
    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const suggestions = await generateFileReview(filePath, fileContent);
    res.json({ suggestions });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ error: "File not found in repository" });
    } else {
      console.error("File review error:", err);
      res.status(500).json({ error: "Failed to analyze file" });
    }
  }
});

async function processReview(job: ReviewJob) {
  try {
    job.status = "cloning";
    job.repoPath = await cloneRepo(job.repoUrl);

    job.status = "analyzing";
    const [analysisResult, frameworks] = await Promise.all([
      analyzeCode(job.repoPath),
      detectFrameworks(job.repoPath),
    ]);

    job.status = "generating";
    const aiSuggestions = await generateAISuggestions(analysisResult, frameworks);

    job.report = buildReport(job.repoUrl, analysisResult, frameworks, aiSuggestions);
    job.status = "complete";

    // Schedule cleanup after 1 hour to allow file-level analysis
    job.cleanupTimer = setTimeout(async () => {
      if (job.repoPath) {
        await cleanupRepo(job.repoPath).catch(() => {});
        job.repoPath = undefined;
      }
      jobs.delete(job.id);
    }, CLEANUP_DELAY_MS);
  } catch (err) {
    job.status = "error";
    job.error = err instanceof Error ? err.message : "Unknown error";
    if (job.repoPath) {
      await cleanupRepo(job.repoPath).catch(() => {});
      job.repoPath = undefined;
    }
  }
}

export { router as reviewRouter };

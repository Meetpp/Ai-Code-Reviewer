"use client";

import { useState } from "react";
import { SubmitForm } from "@/components/SubmitForm";
import { ReportView } from "@/components/ReportView";
import { StatusBar } from "@/components/StatusBar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

type JobStatus = "idle" | "pending" | "cloning" | "analyzing" | "generating" | "complete" | "error";

export default function HomePage() {
  const [status, setStatus] = useState<JobStatus>("idle");
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(repoUrl: string) {
    setStatus("pending");
    setReport(null);
    setJobId(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/review/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }

      const { jobId: id } = await res.json();
      setJobId(id);
      pollStatus(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  async function pollStatus(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/review/status/${jobId}`);
        const data = await res.json();

        setStatus(data.status);

        if (data.status === "complete" && data.report) {
          clearInterval(interval);
          setReport(data.report);
        } else if (data.status === "error") {
          clearInterval(interval);
          setError(data.error || "Review failed");
        }
      } catch {
        clearInterval(interval);
        setError("Lost connection to server");
        setStatus("error");
      }
    }, 2000);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {!report ? (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Automated Code Review
            </h1>
            <p className="text-gray-400 text-lg">
              Paste your repository URL and get instant code quality feedback, improvement suggestions, and best practice recommendations.
            </p>
          </div>

          <SubmitForm onSubmit={handleSubmit} disabled={status !== "idle" && status !== "error"} />

          {status !== "idle" && status !== "complete" && (
            <StatusBar status={status} error={error} />
          )}

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              title="Code Analysis"
              description="Detects code smells, complexity issues, duplicate code, and naming convention problems."
            />
            <FeatureCard
              title="AI Suggestions"
              description="Get AI-powered recommendations for refactoring, performance, security, and best practices."
            />
            <FeatureCard
              title="Framework Detection"
              description="Automatically detects your tech stack and provides framework-specific suggestions."
            />
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => {
              setReport(null);
              setJobId(null);
              setStatus("idle");
              setError(null);
            }}
            className="mb-8 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>&larr;</span> New Review
          </button>
          <ReportView report={report} jobId={jobId ?? ""} />
        </div>
      )}
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50">
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

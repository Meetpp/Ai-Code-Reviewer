"use client";

interface StatusBarProps {
  status: string;
  error: string | null;
}

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Submitting review request...",
  cloning: "Cloning repository...",
  analyzing: "Analyzing codebase...",
  generating: "Generating AI suggestions...",
  error: "An error occurred",
};

export function StatusBar({ status, error }: StatusBarProps) {
  const isError = status === "error";

  return (
    <div
      className={`mt-6 rounded-xl p-4 flex items-center gap-3 ${
        isError
          ? "bg-red-900/30 border border-red-800 text-red-300"
          : "bg-blue-900/30 border border-blue-800 text-blue-300"
      }`}
    >
      {!isError && (
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      )}
      <span className="text-sm">
        {isError ? error || "Something went wrong" : STATUS_MESSAGES[status] || "Processing..."}
      </span>
    </div>
  );
}

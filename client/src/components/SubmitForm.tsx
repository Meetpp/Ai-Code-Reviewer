"use client";

import { useState } from "react";

interface SubmitFormProps {
  onSubmit: (repoUrl: string) => void;
  disabled: boolean;
}

export function SubmitForm({ onSubmit, disabled }: SubmitFormProps) {
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim() && !disabled) {
      onSubmit(url.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/user/repo"
        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-5 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        disabled={disabled}
        required
      />
      <button
        type="submit"
        disabled={disabled || !url.trim()}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-8 py-3.5 rounded-xl transition-all"
      >
        {disabled ? "Reviewing..." : "Review"}
      </button>
    </form>
  );
}

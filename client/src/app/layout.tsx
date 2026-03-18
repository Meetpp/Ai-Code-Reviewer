import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Reviewr - Automated Code Review",
  description: "Submit your repository URL and receive automated code review feedback and improvement suggestions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                CR
              </div>
              <span className="text-xl font-bold">Code Reviewr</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-gray-400">
              <a href="/" className="hover:text-white transition-colors">Home</a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

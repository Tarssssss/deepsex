"use client";

import { FileCode, FlaskConical, Hash, FolderTree, KeyRound, type LucideIcon } from "lucide-react";
import { DeepSeekLogo } from "@/components/brand/DeepSeekLogo";

interface ExamplePrompt {
  icon: LucideIcon;
  title: string;
  description: string;
  prompt: string;
}

const EXAMPLES: ExamplePrompt[] = [
  {
    icon: FileCode,
    title: "Refactor fizzbuzz",
    description: "Split into smaller functions and add JSDoc",
    prompt:
      "Refactor src/fizzbuzz.js into smaller functions and add JSDoc",
  },
  {
    icon: FlaskConical,
    title: "Write & run a test",
    description: "Test the fizzbuzz function, then execute it",
    prompt: "Write a test file for the fizzbuzz function and run it",
  },
  {
    icon: Hash,
    title: "Generate primes",
    description: "Create src/primes.js, print primes to 50, then run",
    prompt:
      "Create a new src/primes.js that prints primes up to 50, then run it",
  },
  {
    icon: FolderTree,
    title: "Explain the workspace",
    description: "Walk through what every file does",
    prompt: "Explain what every file in this workspace does",
  },
];

/**
 * Welcome screen shown when the conversation is empty. Centered hero +
 * a grid of clickable example prompts.
 */
export function EmptyState({
  onPick,
  needsKey,
  onConfigureKey,
}: {
  onPick: (prompt: string) => void;
  needsKey?: boolean;
  onConfigureKey?: () => void;
}) {
  return (
    <div className="ds-fade-up mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 text-center">
      <DeepSeekLogo size={48} />

      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-text">
        DeepSeek Codex
      </h1>
      <p className="mt-2 max-w-md text-[0.9375rem] text-muted">
        Your AI coding agent — reads, edits, and runs code in a sandbox.
      </p>

      {needsKey && (
        <button
          type="button"
          onClick={onConfigureKey}
          className="ds-card ds-focus mt-6 flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-brand">
            <KeyRound className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">
              Add your DeepSeek API key to start
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Paste it here — stored locally in your browser, no .env editing needed.
            </span>
          </span>
        </button>
      )}

      <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {EXAMPLES.map((ex) => {
          const Icon = ex.icon;
          return (
            <button
              key={ex.title}
              type="button"
              onClick={() => onPick(ex.prompt)}
              className="ds-card ds-focus group flex w-full items-start gap-3 p-4 text-left transition-colors hover:border-brand"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-brand transition-colors">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text">
                  {ex.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                  {ex.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

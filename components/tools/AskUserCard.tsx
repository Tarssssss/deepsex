"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import type { UserQuestion } from "@/lib/types";

/**
 * Interactive clarifying-question UI for the ask_user tool. Renders option
 * chips (single- or multi-select) plus an "Other" free-text fallback, then
 * returns the selected label(s) keyed by question text.
 */
export function AskUserCard({
  questions,
  answers,
  pending,
  onAnswer,
}: {
  questions: UserQuestion[];
  answers?: Record<string, string>;
  pending?: boolean;
  onAnswer?: (answers: Record<string, string>) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});

  const answered = !!answers && Object.keys(answers).length > 0;

  function toggle(q: UserQuestion, label: string) {
    setSelected((prev) => {
      const cur = prev[q.question] ?? [];
      if (q.multiSelect) {
        return {
          ...prev,
          [q.question]: cur.includes(label)
            ? cur.filter((l) => l !== label)
            : [...cur, label],
        };
      }
      return { ...prev, [q.question]: [label] };
    });
  }

  function submit() {
    const out: Record<string, string> = {};
    for (const q of questions) {
      const picks = [...(selected[q.question] ?? [])];
      const free = other[q.question]?.trim();
      if (free) picks.push(free);
      out[q.question] = picks.join(", ");
    }
    onAnswer?.(out);
  }

  const canSubmit = questions.every(
    (q) => (selected[q.question]?.length ?? 0) > 0 || other[q.question]?.trim()
  );

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q) => {
        const picks = selected[q.question] ?? [];
        return (
          <div key={q.question}>
            <div className="mb-2 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-brand" />
              <span className="text-sm font-medium text-text">{q.question}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const active = picks.includes(opt.label);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={answered || !pending}
                    onClick={() => toggle(q, opt.label)}
                    title={opt.description}
                    className={`ds-focus rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-default ${
                      active
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-surface text-muted hover:border-border-strong"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {pending && !answered && (
              <input
                type="text"
                value={other[q.question] ?? ""}
                onChange={(e) =>
                  setOther((p) => ({ ...p, [q.question]: e.target.value }))
                }
                placeholder="Other…"
                className="ds-focus mt-2 w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-xs text-text placeholder:text-faint focus:outline-none"
              />
            )}
          </div>
        );
      })}

      {answered ? (
        <p className="text-xs text-muted">
          Answered:{" "}
          <span className="text-text">
            {Object.values(answers!).filter(Boolean).join(" · ") || "(dismissed)"}
          </span>
        </p>
      ) : pending ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={!canSubmit}
            onClick={submit}
          >
            Submit
          </button>
        </div>
      ) : null}
    </div>
  );
}

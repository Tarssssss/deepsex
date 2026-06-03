import { FileDiff } from "lucide-react";

interface DiffViewProps {
  diff: string;
  path?: string;
}

type DiffLineKind = "add" | "del" | "hunk" | "fileheader" | "context";

interface ParsedLine {
  kind: DiffLineKind;
  text: string;
}

function isFileHeader(line: string): boolean {
  return (
    line.startsWith("+++") ||
    line.startsWith("---") ||
    line.startsWith("Index:") ||
    line.startsWith("===") ||
    line.startsWith("diff ") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file")
  );
}

function classify(line: string): DiffLineKind {
  if (line.startsWith("@@")) return "hunk";
  if (isFileHeader(line)) return "fileheader";
  // +++/--- already caught as file headers above
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "context";
}

export function DiffView({ diff, path }: DiffViewProps) {
  const rawLines = diff.replace(/\n$/, "").split("\n");
  const parsed: ParsedLine[] = rawLines.map((text) => ({
    kind: classify(text),
    text,
  }));

  const adds = parsed.filter((l) => l.kind === "add").length;
  const dels = parsed.filter((l) => l.kind === "del").length;

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
      {path && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileDiff className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="truncate font-mono text-xs text-text">{path}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-xs">
            <span className="text-success">+{adds}</span>
            <span className="text-error">-{dels}</span>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <pre className="min-w-full font-mono text-xs leading-relaxed">
          {parsed.map((line, i) => {
            if (line.kind === "fileheader") {
              return (
                <div
                  key={i}
                  className="px-3 py-px whitespace-pre text-faint opacity-60"
                >
                  {line.text || " "}
                </div>
              );
            }
            if (line.kind === "hunk") {
              return (
                <div
                  key={i}
                  className="bg-surface-2 px-3 py-px whitespace-pre text-muted"
                >
                  {line.text}
                </div>
              );
            }
            if (line.kind === "add") {
              return (
                <div
                  key={i}
                  className="px-3 py-px whitespace-pre"
                  style={{
                    background: "var(--diff-add-bg)",
                    color: "var(--diff-add-text)",
                  }}
                >
                  {line.text}
                </div>
              );
            }
            if (line.kind === "del") {
              return (
                <div
                  key={i}
                  className="px-3 py-px whitespace-pre"
                  style={{
                    background: "var(--diff-del-bg)",
                    color: "var(--diff-del-text)",
                  }}
                >
                  {line.text}
                </div>
              );
            }
            return (
              <div
                key={i}
                className="px-3 py-px whitespace-pre text-muted"
              >
                {line.text || " "}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

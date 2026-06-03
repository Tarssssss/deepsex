interface CommandOutputProps {
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

const MAX_CHARS = 4000;

function truncate(text: string): { body: string; truncated: boolean } {
  if (text.length <= MAX_CHARS) return { body: text, truncated: false };
  return { body: text.slice(0, MAX_CHARS), truncated: true };
}

export function CommandOutput({
  command,
  stdout,
  stderr,
  exitCode,
}: CommandOutputProps) {
  const out = stdout ? truncate(stdout) : null;
  const err = stderr ? truncate(stderr) : null;
  const hasExit = typeof exitCode === "number";

  return (
    <div
      className="overflow-hidden rounded-[10px] border border-border font-mono text-xs"
      style={{ background: "var(--code-bg)" }}
    >
      {command && (
        <div className="flex items-start gap-2 border-b border-border px-3 py-2">
          <span className="select-none text-faint">$</span>
          <span className="min-w-0 flex-1 break-all whitespace-pre-wrap text-text">
            {command}
          </span>
          {hasExit && (
            <span
              className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium ${
                exitCode === 0 ? "text-success" : "text-error"
              }`}
              style={{
                background:
                  exitCode === 0
                    ? "var(--success-soft)"
                    : "var(--error-soft)",
              }}
            >
              exit {exitCode}
            </span>
          )}
        </div>
      )}

      {(out || err) && (
        <div className="overflow-x-auto px-3 py-2">
          {out && (
            <pre className="whitespace-pre-wrap break-words text-muted">
              {out.body}
              {out.truncated && (
                <span className="text-faint italic">
                  {"\n"}… output truncated
                </span>
              )}
            </pre>
          )}
          {err && (
            <pre className="mt-1 whitespace-pre-wrap break-words text-error">
              {err.body}
              {err.truncated && (
                <span className="text-faint italic">
                  {"\n"}… output truncated
                </span>
              )}
            </pre>
          )}
        </div>
      )}

      {!command && !out && !err && hasExit && (
        <div className="px-3 py-2">
          <span
            className={`rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium ${
              exitCode === 0 ? "text-success" : "text-error"
            }`}
            style={{
              background:
                exitCode === 0 ? "var(--success-soft)" : "var(--error-soft)",
            }}
          >
            exit {exitCode}
          </span>
        </div>
      )}
    </div>
  );
}

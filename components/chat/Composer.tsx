"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_ROWS = 8;

/**
 * Bottom input area. Auto-growing textarea, Enter-to-send (Shift+Enter for a
 * newline), and a send/stop button. Purely presentational — the parent
 * positions it (e.g. sticky at the bottom).
 */
export function Composer({
  onSend,
  busy,
  onStop,
  disabled,
}: {
  onSend: (text: string) => void;
  busy?: boolean;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const styles = window.getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const paddingY =
      parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const maxHeight = lineHeight * MAX_ROWS + paddingY;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(resize, [value, resize]);

  useEffect(() => {
    function onResize() {
      resize();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resize]);

  const send = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy) send();
    }
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="w-full">
      <div className="ds-card flex items-end gap-2 rounded-2xl p-2 pl-3.5 transition-colors focus-within:border-border-strong">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask DeepSeek Codex to build, edit, or run something…"
          className="ds-focus max-h-60 min-h-[1.5rem] flex-1 resize-none self-center bg-transparent py-1.5 text-[0.9375rem] leading-relaxed text-text placeholder:text-faint focus:outline-none disabled:opacity-60"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop"
            className="ds-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text transition-colors hover:bg-surface-2"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
            title="Send"
            className="ds-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[var(--brand-contrast)] transition-colors hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <p className="mt-1.5 px-1 text-center text-xs text-faint">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}

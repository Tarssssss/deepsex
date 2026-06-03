"use client";

import type { ApprovalMode, UIMessage } from "@/lib/types";
import { DeepSeekLogo } from "@/components/brand/DeepSeekLogo";
import { ToolCallCard } from "@/components/tools/ToolCallCard";
import { Markdown } from "./Markdown";
import { Reasoning } from "./Reasoning";

/**
 * Renders a single chat message.
 *  - user: right-aligned brand bubble
 *  - assistant: left-aligned full width with avatar, reasoning, markdown, tools
 */
export function MessageItem({
  message,
  approvalMode,
  awaitingApprovalIds,
  onApprove,
  onReject,
}: {
  message: UIMessage;
  approvalMode: ApprovalMode;
  awaitingApprovalIds?: Set<string>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="ds-fade-up flex justify-end">
        <div className="max-w-[80%] rounded-[var(--radius-lg)] bg-brand px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-[var(--brand-contrast)] shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const hasContent = message.content.trim().length > 0;
  const hasTools = (message.tools?.length ?? 0) > 0;
  const showCaret = message.streaming && !hasContent && !hasTools;

  return (
    <div className="ds-fade-up flex gap-3">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
        <DeepSeekLogo size={18} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {message.reasoning ? (
          <Reasoning text={message.reasoning} streaming={message.streaming} />
        ) : null}

        {hasContent ? (
          <Markdown>{message.content}</Markdown>
        ) : null}

        {showCaret ? <span className="ds-cursor text-text" /> : null}

        {hasTools ? (
          <div className="mt-3 flex flex-col gap-2">
            {message.tools!.map((tool) => (
              <ToolCallCard
                key={tool.id}
                tool={tool}
                needsApproval={
                  awaitingApprovalIds
                    ? awaitingApprovalIds.has(tool.id)
                    : tool.status === "pending"
                }
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

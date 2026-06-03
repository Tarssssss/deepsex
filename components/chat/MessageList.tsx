"use client";

import { useEffect, useRef } from "react";
import type { ApprovalMode, UIMessage } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { ThinkingIndicator } from "./ThinkingIndicator";

/**
 * Scrollable conversation column. Auto-scrolls to the bottom as messages
 * arrive or stream. Shows a thinking indicator while we wait for the
 * assistant's first token.
 */
export function MessageList({
  messages,
  approvalMode,
  awaitingApprovalIds,
  pendingQuestionIds,
  onApprove,
  onReject,
  onAnswer,
  busy,
}: {
  messages: UIMessage[];
  approvalMode: ApprovalMode;
  awaitingApprovalIds?: Set<string>;
  pendingQuestionIds?: Set<string>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onAnswer?: (id: string, answers: Record<string, string>) => void;
  busy?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const last = messages[messages.length - 1];
  const streamingTail = last?.role === "assistant" && last.streaming;

  // Auto-scroll on new messages and during streaming.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, last?.content, last?.reasoning, last?.tools, streamingTail]);

  const waitingForAssistant = busy && last?.role === "user";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            approvalMode={approvalMode}
            awaitingApprovalIds={awaitingApprovalIds}
            pendingQuestionIds={pendingQuestionIds}
            onApprove={onApprove}
            onReject={onReject}
            onAnswer={onAnswer}
          />
        ))}

        {waitingForAssistant ? (
          <div className="flex gap-3">
            <span className="h-7 w-7 shrink-0" aria-hidden />
            <ThinkingIndicator />
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

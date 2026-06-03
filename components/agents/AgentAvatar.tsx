import type { CustomAgent } from "@/lib/types";

/** Accent-tile initials avatar — the one place an agent's accent color shows. */
export function AgentAvatar({
  agent,
  size = 28,
}: {
  agent: Pick<CustomAgent, "name" | "accent">;
  size?: number;
}) {
  const initials = agent.name.trim().slice(0, 2).toUpperCase() || "··";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[8px] font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: agent.accent,
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

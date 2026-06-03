import type { ReactNode } from "react";
import { DeepSeekWordmark } from "@/components/brand/DeepSeekLogo";

interface HeaderProps {
  right?: ReactNode;
}

export function Header({ right }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md">
      <DeepSeekWordmark />
      {right ? (
        <div className="flex items-center gap-2">{right}</div>
      ) : null}
    </header>
  );
}

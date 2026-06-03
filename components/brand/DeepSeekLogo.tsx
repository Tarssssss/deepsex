/**
 * DeepSeek brand mark — an original, tasteful glyph.
 *
 * A rounded square tile in brand blue holding a simple white whale/wave
 * silhouette. Not a copy of any trademarked logo: a clean geometric mark
 * that reads well from ~20px up to 48px.
 */

interface DeepSeekLogoProps {
  size?: number;
  className?: string;
}

export function DeepSeekLogo({ size = 24, className }: DeepSeekLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="DeepSeek"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rounded tile in brand blue */}
      <rect width="48" height="48" rx="12" fill="var(--brand)" />

      {/* Stylized whale + wave, drawn in white. A friendly rounded body,
          an arcing back, a spout spark, and a wave swell beneath it. */}
      <g fill="#ffffff">
        {/* Wave swell beneath the whale */}
        <path
          d="M9 32c3.4 0 3.4 3 6.8 3s3.4-3 6.8-3 3.4 3 6.8 3 3.4-3 6.8-3 3.4 3 6.8 3v4c-3.4 0-3.4-3-6.8-3s-3.4 3-6.8 3-3.4-3-6.8-3-3.4 3-6.8 3-3.4-3-6.8-3z"
          opacity="0.55"
        />
        {/* Whale body: rounded back arcing up-right with a soft tail */}
        <path d="M14 28c0-7.2 5.4-13 12.6-13 4 0 7.2 1.7 9.4 4.3-1.1-.5-2.3-.8-3.6-.8-5.4 0-9.6 4.2-9.6 9.7 0 .9.1 1.7.3 2.5-2.3.6-4.9.9-7.7.9-.4 0-.9 0-1.4-.1A12.9 12.9 0 0 1 14 28z" />
        {/* Tail fluke */}
        <path d="M35.5 17.4c1.8.5 3.4 1.5 4.6 2.9-.6 1.7-1.9 2.9-3.6 3.3.5-2.1.3-4.3-1-6.2z" />
        {/* Spout spark */}
        <circle cx="33.4" cy="13.2" r="2" />
      </g>
    </svg>
  );
}

interface DeepSeekWordmarkProps {
  className?: string;
}

export function DeepSeekWordmark({ className }: DeepSeekWordmarkProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ""}`.trim()}
    >
      <DeepSeekLogo size={26} />
      <span className="flex items-center gap-1.5 text-[15px] leading-none tracking-tight">
        <span className="font-semibold text-brand">DeepSeek</span>
        <span className="font-semibold text-text">Codex</span>
      </span>
    </span>
  );
}

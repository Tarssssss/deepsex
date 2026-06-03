"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Themed markdown renderer for chat content.
 *
 * Uses react-markdown + remark-gfm (tables, strikethrough, task lists) and
 * rehype-highlight (adds `hljs` classes to fenced code). Styling is driven
 * entirely by our design tokens via the `components` overrides — we do not
 * rely on @tailwindcss/typography (not installed) or a clashing hljs theme.
 */

const components: Components = {
  p: ({ children }) => (
    <p className="my-2 leading-7 first:mt-0 last:mb-0">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1.5 text-base font-semibold first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 marker:text-faint">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-faint">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-brand underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-text">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-4 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border-strong pl-3 text-muted italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border-strong">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t border-border px-3 py-1.5 align-top">{children}</td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /\blanguage-/.test(className ?? "");
    if (isBlock) {
      // Inside a <pre>; let the pre handle the surface. Keep hljs classes.
      return (
        <code
          className={`${className ?? ""} font-mono text-[0.8125rem] leading-relaxed`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-[var(--radius-sm)] bg-[var(--code-bg)] px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-[var(--radius)] border border-border bg-[var(--code-bg)] p-3 text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-ds text-[0.9375rem] text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

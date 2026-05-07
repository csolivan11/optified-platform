/**
 * Minimal markdown renderer for article bodies.
 *
 * Article bodies use a deliberately constrained markdown subset:
 *   # H1 / ## H2 / ### H3 / #### H4
 *   paragraphs (blank-line separated)
 *   - bullet lists / 1. numbered lists
 *   **bold**, *italic*, `code`
 *
 * No tables, no images, no nested lists, no HTML pass-through.
 * Keeping this in-house means zero dependencies, exact brand styling,
 * and predictable output. If we later need a richer set, swap in
 * react-markdown.
 *
 * Author content is trusted (only admins write it via RLS), so this
 * renderer escapes HTML defensively but doesn't attempt a sanitizer.
 */
import { Fragment } from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Inline formatting: bold, italic, code. Order matters — code first so
 * we don't process markdown inside backticks.
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = escapeHtml(text);
  let key = 0;

  // Tokenize sequentially. Each pattern returns the matched element +
  // pushes preceding text, then advances `remaining`.
  const patterns: Array<{ re: RegExp; render: (m: RegExpExecArray) => React.ReactNode }> = [
    { re: /`([^`]+)`/, render: (m) => <code key={key++} className="px-1.5 py-0.5 rounded bg-card text-foreground font-mono text-[0.85em]">{m[1]}</code> },
    { re: /\*\*([^*]+)\*\*/, render: (m) => <strong key={key++} className="font-semibold text-foreground">{m[1]}</strong> },
    { re: /\*([^*]+)\*/, render: (m) => <em key={key++} className="italic">{m[1]}</em> },
  ];

  while (remaining.length > 0) {
    let earliest: { idx: number; len: number; node: React.ReactNode } | null = null;
    for (const p of patterns) {
      const m = p.re.exec(remaining);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, len: m[0].length, node: p.render(m) };
      }
    }
    if (!earliest) {
      parts.push(<Fragment key={key++}>{remaining}</Fragment>);
      break;
    }
    if (earliest.idx > 0) {
      parts.push(<Fragment key={key++}>{remaining.slice(0, earliest.idx)}</Fragment>);
    }
    parts.push(earliest.node);
    remaining = remaining.slice(earliest.idx + earliest.len);
  }
  return parts;
}

interface MarkdownProps {
  source: string;
  className?: string;
}

export function Markdown({ source, className }: MarkdownProps) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const cls =
        level === 1 ? "text-h1 mt-8 mb-4" :
        level === 2 ? "text-h2 mt-8 mb-3" :
        level === 3 ? "text-h3 mt-6 mb-2" :
        "text-base font-semibold mt-4 mb-2";
      const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={key++} className={cls}>{renderInline(text)}</Tag>);
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc list-outside pl-5 space-y-2 mb-5 text-body text-muted-foreground marker:text-muted-foreground/40">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal list-outside pl-5 space-y-2 mb-5 text-body text-muted-foreground marker:text-muted-foreground/40">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Paragraph: collect consecutive non-blank, non-block lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={key++} className="text-body-lg text-muted-foreground leading-relaxed mb-5">
          {renderInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return <div className={className}>{blocks}</div>;
}

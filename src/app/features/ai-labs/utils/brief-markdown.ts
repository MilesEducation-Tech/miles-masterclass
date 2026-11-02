/**
 * Markdown → HTML for the AI Lab brief's `problem_statement`.
 *
 * Deliberately tiny and dependency-free: the brief uses headings, lists, bold,
 * italics, inline code and links, and nothing else needs Markdown here. Safety
 * comes first — every `& < > " '` is escaped before any tag is produced, so the
 * only HTML in the output is what this function writes. The result is bound
 * with a plain `[innerHTML]`, so Angular's sanitizer runs on it as well.
 *
 * A plain module with no Angular imports. Ported from miles-masterclass-v3.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Bold, italics, inline code and http(s) links, on already-escaped text. */
function inline(text: string): string {
  return (
    text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      // Only http(s) — anything else (javascript:, data:) stays as text.
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      )
  );
}

export function renderBriefMarkdown(src: string | null | undefined): string {
  const lines = escapeHtml(src ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);

    if (!line) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      const tag = heading[1].length <= 2 ? 'h4' : 'h5';
      out.push(`<${tag}>${inline(heading[2])}</${tag}>`);
    } else if (bullet || numbered) {
      flushParagraph();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();
  return out.join('');
}

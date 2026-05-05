/**
 * risup-editor-plugin, a RisuAI plugin for editing character lorebooks, prompts, and settings
 * Copyright (C) 2026 nevaeh5379
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * Minimal markdown → safe HTML renderer for the preview pane.
 *
 * Supports: headings (#..######), paragraphs, **bold**, *italic*, _italic_,
 * `code`, ```code blocks```, [links](url), images ![alt](src), unordered
 * lists (- *), ordered lists (1.), blockquotes (>), horizontal rules (---),
 * line breaks. All output is HTML-escaped except for the inline tokens we
 * generate ourselves — no raw HTML passthrough, so an entry can't inject
 * scripts.
 *
 * This is intentionally simple. RisuAI's full CBS/markdown-it pipeline lives
 * in the host and is not exposed via the V3 API; once it is, swap this out.
 */

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(s: string): string {
  let out = escapeHTML(s)

  // Inline code: `code` (process before bold/italic so * inside ` is safe)
  out = out.replace(/`([^`\n]+?)`/g, '<code>$1</code>')

  // Images: ![alt](src) — must precede links
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, alt, src, title) => {
      const t = title ? ` title="${title}"` : ''
      return `<img src="${src}" alt="${alt}"${t} />`
    }
  )

  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  // Bold: **text** or __text__
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  out = out.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,!?)]|$)/g, '$1<em>$2</em>')
  out = out.replace(/(^|[\s(])_([^_\n]+?)_(?=[\s.,!?)]|$)/g, '$1<em>$2</em>')

  // Strikethrough: ~~text~~
  out = out.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>')

  return out
}

export function renderMarkdown(src: string): string {
  if (!src) return ''
  const lines = src.replace(/\r\n/g, '\n').split('\n')

  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block ```
    const fenceMatch = /^```(\w*)\s*$/.exec(line)
    if (fenceMatch) {
      const lang = fenceMatch[1]
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing fence
      const langCls = lang ? ` class="language-${lang}"` : ''
      out.push(`<pre><code${langCls}>${escapeHTML(buf.join('\n'))}</code></pre>`)
      continue
    }

    // Heading
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr />')
      i++
      continue
    }

    // Blockquote (consecutive > lines)
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`)
      continue
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        buf.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${buf.join('')}</ul>`)
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${buf.join('')}</ol>`)
      continue
    }

    // Blank line: paragraph break
    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    // Paragraph: gather consecutive non-blank, non-special lines
    const buf: string[] = []
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    if (buf.length) out.push(`<p>${renderInline(buf.join('<br />'))}</p>`)
  }

  return out.join('\n')
}

/**
 * Substitute basic CBS-style placeholders. The full CBS pipeline lives in the
 * host and is not yet exposed; this covers the common cases users see.
 */
export function substitutePlaceholders(
  src: string,
  ctx: { char?: string; user?: string }
): string {
  return src
    .replace(/\{\{char\}\}/gi, ctx.char ?? '{{char}}')
    .replace(/\{\{user\}\}/gi, ctx.user ?? '{{user}}')
}

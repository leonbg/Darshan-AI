import React from 'react';

const HEBREW_CHAR_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const LATIN_CHAR_RE = /[A-Za-z\u00C0-\u024F]/;
const NIQQUD_AND_MARKS_RE = /[\u0591-\u05C7]/g;
const STRAY_BIDI_CONTROLS_RE = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Thresholds for promoting an embedded Hebrew run from an inline isolated chip
 * (<bdi class="hebrew-inline">) to a dedicated full-width RTL block
 * (.hebrew-embedded-block) so multi-line Hebrew always starts at top-right
 * and flows strictly downwards (top-to-bottom), never wrapping awkwardly
 * inside an LTR line box.
 */
const MAX_INLINE_HEBREW_WORDS = 2;
const MAX_INLINE_BASE_CHARS = 15;

export type BidiSegmentType = 'ltr' | 'hebrew-inline' | 'hebrew-block';

export interface BidiSegment {
  type: BidiSegmentType;
  text: string;
}

const WRAPPER_PAIRS: Array<[string, string]> = [
  ['«', '»'],
  ['“', '”'],
  ['"', '"'],
  ['(', ')'],
  ['[', ']'],
];

/**
 * Strips stray directional override/isolate control characters that can invert
 * visual line or character order.
 */
export function sanitizeBidiControls(text?: string | null): string {
  if (!text) return '';
  return String(text).replace(STRAY_BIDI_CONTROLS_RE, '');
}

/**
 * Returns true if the text contains at least one Hebrew character.
 */
export function containsHebrew(text?: string | null): boolean {
  if (!text) return false;
  return HEBREW_CHAR_RE.test(text);
}

/**
 * Returns true if the text has more Hebrew letters than Latin letters
 * (used to decide whether an entire input box should default to RTL).
 */
export function isPredominantlyHebrew(text?: string | null): boolean {
  if (!text) return false;
  const heMatches = text.match(/[\u05D0-\u05EA\uFB1D-\uFB4F]/g);
  const latMatches = text.match(/[A-Za-z\u00C0-\u024F]/g);
  const heCount = heMatches ? heMatches.length : 0;
  const latCount = latMatches ? latMatches.length : 0;
  return heCount > 0 && heCount > latCount;
}

function isHebrewConnectorChar(ch: string): boolean {
  return (
    ch === ' ' ||
    ch === '\t' ||
    ch === '\u00A0' ||
    ch === '-' ||
    ch === '–' ||
    ch === '—' ||
    ch === ',' ||
    ch === '.' ||
    ch === ';' ||
    ch === ':' ||
    ch === '!' ||
    ch === '?' ||
    ch === "'" ||
    ch === '’' ||
    ch === '"' ||
    ch === '“' ||
    ch === '”' ||
    ch === '«' ||
    ch === '»' ||
    ch === '(' ||
    ch === ')' ||
    ch === '[' ||
    ch === ']' ||
    ch === '/' ||
    ch === '·' ||
    ch === '•' ||
    (ch >= '0' && ch <= '9')
  );
}

function classifyHebrewRun(hebrewText: string): 'hebrew-inline' | 'hebrew-block' {
  const trimmed = hebrewText.trim();
  if (trimmed.includes('\n')) return 'hebrew-block';
  const words = trimmed
    .split(/\s+/)
    .filter((w) => HEBREW_CHAR_RE.test(w));
  const baseLength = trimmed.replace(NIQQUD_AND_MARKS_RE, '').length;
  if (words.length > MAX_INLINE_HEBREW_WORDS || baseLength > MAX_INLINE_BASE_CHARS) {
    return 'hebrew-block';
  }
  return 'hebrew-inline';
}

/**
 * Segments a single line of text into LTR runs, short inline Hebrew terms,
 * and multi-word Hebrew passages promoted to RTL blocks.
 */
export function segmentMixedBidiLine(rawLine: string): BidiSegment[] {
  const line = sanitizeBidiControls(rawLine);
  if (!line) return [];
  if (!HEBREW_CHAR_RE.test(line)) {
    return [{ type: 'ltr', text: line }];
  }
  if (!LATIN_CHAR_RE.test(line)) {
    // Pure Hebrew line (no Latin characters)
    const kind = classifyHebrewRun(line);
    return [{ type: kind === 'hebrew-inline' && line.trim().length <= 16 ? 'hebrew-inline' : 'hebrew-block', text: line.trim() }];
  }

  const rawTokens: Array<{ isHebrew: boolean; text: string }> = [];
  let cursor = 0;
  const len = line.length;

  while (cursor < len) {
    // Find next Hebrew character
    let heStart = cursor;
    while (heStart < len && !HEBREW_CHAR_RE.test(line[heStart])) {
      heStart++;
    }

    if (heStart >= len) {
      rawTokens.push({ isHebrew: false, text: line.slice(cursor) });
      break;
    }

    // Scan forward from heStart across contiguous Hebrew characters and internal connectors
    // as long as another Hebrew character follows before any Latin character.
    let heEnd = heStart + 1;
    let scan = heEnd;
    while (scan < len) {
      const ch = line[scan];
      if (HEBREW_CHAR_RE.test(ch)) {
        scan++;
        heEnd = scan;
      } else if (isHebrewConnectorChar(ch)) {
        scan++;
      } else {
        break;
      }
    }

    // Include trailing Hebrew geresh/apostrophe (e.g., ה', ד', וגו', וכו') attached to the last Hebrew letter
    if (
      heEnd < len &&
      (line[heEnd] === "'" || line[heEnd] === '’') &&
      !(heStart > 0 && (line[heStart - 1] === "'" || line[heStart - 1] === '‘' || line[heStart - 1] === '’'))
    ) {
      heEnd++;
    }

    if (heStart > cursor) {
      rawTokens.push({ isHebrew: false, text: line.slice(cursor, heStart) });
    }
    rawTokens.push({ isHebrew: true, text: line.slice(heStart, heEnd) });
    cursor = heEnd;
  }

  // Classify Hebrew tokens and absorb balanced surrounding quotes/parens when promoted to 'hebrew-block'
  const segments: BidiSegment[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    if (!tok.isHebrew) {
      segments.push({ type: 'ltr', text: tok.text });
      continue;
    }

    const kind = classifyHebrewRun(tok.text);
    if (kind === 'hebrew-inline') {
      segments.push({ type: 'hebrew-inline', text: tok.text });
      continue;
    }

    // For 'hebrew-block', check if the immediately preceding LTR segment ends with
    // opening quotes/parens and the immediately following LTR segment starts with
    // the matching closing quotes/parens (up to 2 nested wrappers, e.g. («...»)).
    let blockText = tok.text.trim();
    const prevSeg = segments.length > 0 && segments[segments.length - 1].type === 'ltr'
      ? segments[segments.length - 1]
      : null;
    const nextTok = i + 1 < rawTokens.length && !rawTokens[i + 1].isHebrew
      ? rawTokens[i + 1]
      : null;

    if (prevSeg && nextTok) {
      let absorbed = true;
      let guard = 0;
      while (absorbed && guard < 2) {
        absorbed = false;
        guard++;
        const prevTrimEnd = prevSeg.text.replace(/[ \t]+$/, '');
        const nextTrimStart = nextTok.text.replace(/^[ \t]+/, '');
        if (!prevTrimEnd || !nextTrimStart) break;

        const lastOpen = prevTrimEnd[prevTrimEnd.length - 1];
        const punctBeforeCloseMatch = nextTrimStart.match(/^([.!?:;]+)?(.*)$/s);
        const punctBeforeClose = punctBeforeCloseMatch?.[1] || '';
        const afterPunct = punctBeforeCloseMatch?.[2] ?? nextTrimStart;

        for (const [openCh, closeCh] of WRAPPER_PAIRS) {
          if (lastOpen === openCh && afterPunct.startsWith(closeCh)) {
            prevSeg.text = prevTrimEnd.slice(0, -1);
            nextTok.text = afterPunct.slice(closeCh.length);
            blockText = `${openCh}${blockText}${punctBeforeClose}${closeCh}`;
            absorbed = true;
            break;
          }
        }
      }
    }

    // Trim trailing horizontal spaces before the block and orphan punctuation/spaces after the block
    if (prevSeg) {
      prevSeg.text = prevSeg.text.replace(/[ \t]+$/, '');
      if (!prevSeg.text) {
        segments.pop();
      }
    }
    if (nextTok) {
      // Prevent orphan sentence punctuation (e.g. a lone "." or ", " at the start of the resumed Spanish line)
      nextTok.text = nextTok.text.replace(/^[ \t]*[.,;:]+[ \t]*/, '').replace(/^[ \t]+/, '');
    }

    segments.push({ type: 'hebrew-block', text: blockText });
  }

  return segments.filter((s) => s.text.length > 0);
}

/**
 * Segments a paragraph (which may contain single '\n' line breaks) into ordered
 * BidiSegments, merging consecutive 'hebrew-block' lines with '\n' so multi-line
 * Hebrew passages stay in a single top-to-bottom RTL block.
 */
export function segmentMixedBidiParagraph(rawParagraph: string): BidiSegment[] {
  const clean = sanitizeBidiControls(rawParagraph);
  if (!clean) return [];
  if (!HEBREW_CHAR_RE.test(clean)) {
    return [{ type: 'ltr', text: clean }];
  }

  const lines = clean.split('\n');
  const merged: BidiSegment[] = [];

  lines.forEach((line, lineIdx) => {
    const lineSegs = segmentMixedBidiLine(line);
    if (lineSegs.length === 0) {
      if (lineIdx < lines.length - 1 && merged.length > 0 && merged[merged.length - 1].type === 'ltr') {
        merged[merged.length - 1].text += '\n';
      }
      return;
    }

    lineSegs.forEach((seg, segIdx) => {
      const prev = merged.length > 0 ? merged[merged.length - 1] : null;
      const isNewLineStart = segIdx === 0 && lineIdx > 0;

      if (seg.type === 'hebrew-block' && prev && prev.type === 'hebrew-block') {
        prev.text = `${prev.text}\n${seg.text}`;
      } else if (seg.type === 'ltr' && prev && prev.type === 'ltr' && isNewLineStart) {
        prev.text = `${prev.text}\n${seg.text}`;
      } else {
        if (isNewLineStart && seg.type !== 'hebrew-block' && prev && prev.type !== 'hebrew-block') {
          merged.push({ type: 'ltr', text: '\n' });
        }
        merged.push({ ...seg });
      }
    });
  });

  return merged;
}

/**
 * Renders inline markdown (**bold**, *italic*, `code`) safely as React nodes
 * without dangerouslySetInnerHTML.
 */
function renderFormattedLtrSpan(text: string, enableMarkdown: boolean, keyPrefix: string): React.ReactNode {
  if (!enableMarkdown || (!text.includes('*') && !text.includes('`'))) {
    return text;
  }

  const tokenRe = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(tokenRe);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={`${keyPrefix}-i-${idx}`} className="text-sky-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="px-1 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
  });
}

export interface BidiTextProps {
  text?: string | null;
  className?: string;
  /**
   * Optional wrapper tag. Defaults to React.Fragment when className is omitted,
   * or 'div' when paragraphs=true, or 'span' otherwise.
   */
  as?: 'div' | 'p' | 'span' | 'blockquote';
  /**
   * When true, splits text on double newlines (\n\n+) into spaced paragraphs.
   */
  paragraphs?: boolean;
  paragraphClassName?: string;
  enableInlineMarkdown?: boolean;
}

/**
 * Universal BiDi-aware text renderer for Spanish prose containing embedded Hebrew.
 * - Short Hebrew terms (1–3 words) render inline inside isolated <bdi dir="rtl"> chips
 *   that never split mid-phrase across lines.
 * - Multi-word Hebrew citations (4+ words or >22 base chars) automatically render
 *   in a dedicated right-aligned RTL block (.hebrew-embedded-block) so line 1 starts
 *   at the top-right and wraps strictly top-to-bottom.
 */
export const BidiText: React.FC<BidiTextProps> = React.memo(
  ({
    text,
    className,
    as,
    paragraphs = false,
    paragraphClassName,
    enableInlineMarkdown = false,
  }) => {
    if (!text) return null;
    const clean = sanitizeBidiControls(text);

    if (paragraphs) {
      const blocks = clean.split(/\n\n+/).filter((b) => b.trim().length > 0);
      const Tag = as || 'div';
      return (
        <Tag className={className}>
          {blocks.map((para, pIdx) => {
            const segments = segmentMixedBidiParagraph(para.trim());
            return (
              <div
                key={`p-${pIdx}`}
                dir="ltr"
                className={paragraphClassName || 'whitespace-pre-line'}
              >
                {segments.map((seg, sIdx) => {
                  const key = `p-${pIdx}-s-${sIdx}`;
                  if (seg.type === 'hebrew-block') {
                    return (
                      <span
                        key={key}
                        dir="rtl"
                        lang="he"
                        className="hebrew-embedded-block"
                      >
                        {seg.text}
                      </span>
                    );
                  }
                  if (seg.type === 'hebrew-inline') {
                    return (
                      <bdi key={key} dir="rtl" lang="he" className="hebrew-inline">
                        {seg.text}
                      </bdi>
                    );
                  }
                  return (
                    <React.Fragment key={key}>
                      {renderFormattedLtrSpan(seg.text, enableInlineMarkdown, key)}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </Tag>
      );
    }

    const segments = segmentMixedBidiParagraph(clean);
    const rendered = segments.map((seg, sIdx) => {
      const key = `s-${sIdx}`;
      if (seg.type === 'hebrew-block') {
        return (
          <span key={key} dir="rtl" lang="he" className="hebrew-embedded-block">
            {seg.text}
          </span>
        );
      }
      if (seg.type === 'hebrew-inline') {
        return (
          <bdi key={key} dir="rtl" lang="he" className="hebrew-inline">
            {seg.text}
          </bdi>
        );
      }
      return (
        <React.Fragment key={key}>
          {renderFormattedLtrSpan(seg.text, enableInlineMarkdown, key)}
        </React.Fragment>
      );
    });

    if (!as && !className) {
      return <>{rendered}</>;
    }

    const Wrapper = as || 'span';
    return (
      <Wrapper dir="ltr" className={className}>
        {rendered}
      </Wrapper>
    );
  }
);

/**
 * BiDi-safe Markdown renderer for ExegesisFollowUp and structured study notes.
 */
export const BidiMarkdown: React.FC<{ content?: string | null }> = React.memo(({ content }) => {
  if (!content) return null;
  const lines = sanitizeBidiControls(content).split('\n');

  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="text-base font-bold text-sky-300 mt-4 mb-2 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span>
                <BidiText text={trimmed.slice(4)} enableInlineMarkdown />
              </span>
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="text-lg font-bold text-white mt-5 mb-2 pb-1 border-b border-slate-700/60"
            >
              <BidiText text={trimmed.slice(3)} enableInlineMarkdown />
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-xl font-extrabold text-white mt-6 mb-3">
              <BidiText text={trimmed.slice(2)} enableInlineMarkdown />
            </h2>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="my-2.5 p-3 rounded-xl bg-slate-950/70 border-l-4 border-l-sky-400 text-slate-300 italic text-xs sm:text-sm"
            >
              <BidiText text={trimmed.slice(2)} enableInlineMarkdown />
            </blockquote>
          );
        }
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const itemText = trimmed.replace(/^(\*|-)\s+/, '');
          return (
            <li
              key={idx}
              className="ml-4 list-disc text-slate-300 text-xs sm:text-sm my-1 leading-relaxed"
            >
              <BidiText text={itemText} enableInlineMarkdown />
            </li>
          );
        }
        if (trimmed === '---') {
          return <hr key={idx} className="my-4 border-slate-700/60" />;
        }
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        return (
          <div key={idx} dir="ltr" className="text-xs sm:text-sm text-slate-200 leading-relaxed my-1.5">
            <BidiText text={line} enableInlineMarkdown />
          </div>
        );
      })}
    </>
  );
});

function escapeHtmlLocal(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats inline text with embedded Hebrew for Printable HTML / Word (.doc) exports.
 * Uses <bdi dir="rtl"> for short terms and <span dir="rtl" class="hebrew-embedded-block">
 * for multi-word embedded Hebrew citations.
 */
export function formatBidiInlineHtml(rawText?: string | null): string {
  if (!rawText) return '';
  const segments = segmentMixedBidiParagraph(rawText);
  return segments
    .map((seg) => {
      if (seg.type === 'hebrew-block') {
        return `<span dir="rtl" lang="he" class="hebrew-embedded-block">${escapeHtmlLocal(
          seg.text
        ).replace(/\n/g, '<br/>')}</span>`;
      }
      if (seg.type === 'hebrew-inline') {
        return `<bdi dir="rtl" lang="he" class="hebrew-inline">${escapeHtmlLocal(seg.text)}</bdi>`;
      }
      return escapeHtmlLocal(seg.text).replace(/\n/g, '<br/>');
    })
    .join('');
}

/**
 * Formats multi-paragraph prose into sibling <p class="..."> (LTR) and
 * <p dir="rtl" align="right" class="hebrew-embedded-block"> blocks so Microsoft Word,
 * Google Docs, LibreOffice, and browser print all render multi-line Hebrew
 * strictly top-to-bottom and right-aligned.
 */
export function formatBidiParagraphsHtml(
  rawText?: string | null,
  paragraphClass = 'body-p'
): string {
  if (!rawText) return '';
  const paragraphs = sanitizeBidiControls(rawText)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const htmlOut: string[] = [];

  for (const para of paragraphs) {
    const segments = segmentMixedBidiParagraph(para);
    let currentLtrBuffer = '';

    const flushLtr = () => {
      const trimmed = currentLtrBuffer.trim();
      if (trimmed) {
        htmlOut.push(`<p class="${paragraphClass}" dir="ltr">${trimmed}</p>`);
      }
      currentLtrBuffer = '';
    };

    for (const seg of segments) {
      if (seg.type === 'hebrew-block') {
        flushLtr();
        htmlOut.push(
          `<p class="hebrew-embedded-block" dir="rtl" lang="he" align="right">${escapeHtmlLocal(
            seg.text
          ).replace(/\n/g, '<br/>')}</p>`
        );
      } else if (seg.type === 'hebrew-inline') {
        currentLtrBuffer += `<bdi dir="rtl" lang="he" class="hebrew-inline">${escapeHtmlLocal(
          seg.text
        )}</bdi>`;
      } else {
        currentLtrBuffer += escapeHtmlLocal(seg.text).replace(/\n/g, '<br/>');
      }
    }

    flushLtr();
  }

  return htmlOut.join('\n');
}

/**
 * Splits a text block for Canvas PDF / RTF rendering into ordered LTR and RTL blocks.
 * Short inline Hebrew phrases (1–3 words) inside LTR blocks have spaces replaced by
 * non-breaking spaces (\u00A0) so Canvas/RTF word-wrapping never splits a short
 * inline Hebrew phrase across two lines, while longer Hebrew passages become
 * dedicated 'rtl' blocks rendered right-aligned from top to bottom.
 */
export function splitTextIntoBidiBlocksForExport(
  rawText?: string | null
): Array<{ direction: 'ltr' | 'rtl'; text: string }> {
  if (!rawText) return [];
  const segments = segmentMixedBidiParagraph(rawText);
  const blocks: Array<{ direction: 'ltr' | 'rtl'; text: string }> = [];
  let ltrBuffer = '';

  const flushLtr = () => {
    const trimmed = ltrBuffer.trim();
    if (trimmed) {
      blocks.push({ direction: 'ltr', text: trimmed });
    }
    ltrBuffer = '';
  };

  for (const seg of segments) {
    if (seg.type === 'hebrew-block') {
      flushLtr();
      blocks.push({ direction: 'rtl', text: seg.text.trim() });
    } else if (seg.type === 'hebrew-inline') {
      // Bind spaces inside short 1-3 word inline Hebrew with NBSP so word-wrappers keep it on 1 line
      const nonBreakingHebrew = seg.text.trim().replace(/\s+/g, '\u00A0');
      ltrBuffer += nonBreakingHebrew;
    } else {
      ltrBuffer += seg.text;
    }
  }

  flushLtr();
  return blocks;
}

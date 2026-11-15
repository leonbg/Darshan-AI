import {
  DerashaExecutiveSummary,
  DerashaExecutiveSummaryPillar,
  FinalDerasha,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
} from '../types';
import { getDurationBadgeLabel, getMethodologyMeta } from './methodologyCatalog';

function cleanWhitespace(text?: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function firstSentences(text: string, maxSentences = 2, maxChars = 340): string {
  const cleaned = cleanWhitespace(text);
  if (!cleaned) return '';

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) {
    return cleaned.length > maxChars
      ? `${cleaned.slice(0, maxChars - 1).trim()}…`
      : cleaned;
  }

  let acc = '';
  for (let i = 0; i < Math.min(maxSentences, sentences.length); i++) {
    const candidate = `${acc} ${sentences[i].trim()}`.trim();
    if (candidate.length > maxChars && acc.length > 0) break;
    acc = candidate;
  }

  if (acc.length > maxChars) {
    return `${acc.slice(0, maxChars - 1).trim()}…`;
  }
  return acc;
}

function buildCoreSourcesDigest(
  derasha: FinalDerasha | null,
  sources: VerifiedSefariaSource[]
): string[] {
  const digest: string[] = [];
  const seen = new Set<string>();

  for (const s of sources || []) {
    const ref = cleanWhitespace(s.ref);
    if (!ref || seen.has(ref.toLowerCase())) continue;
    seen.add(ref.toLowerCase());
    digest.push(s.heRef ? `${ref} (${s.heRef})` : ref);
    if (digest.length >= 6) return digest;
  }

  for (const echo of derasha?.canonicalAnalysis?.verifiedEchoes || []) {
    const ref = cleanWhitespace(echo.ref);
    if (!ref || seen.has(ref.toLowerCase())) continue;
    seen.add(ref.toLowerCase());
    digest.push(ref);
    if (digest.length >= 6) return digest;
  }

  return digest;
}

function computeReadingSeconds(summary: {
  headlineThesis: string;
  abstractNarrative: string;
  keyPillars: DerashaExecutiveSummaryPillar[];
  practicalTakeaway: string;
}): number {
  const fullText = [
    summary.headlineThesis,
    summary.abstractNarrative,
    ...summary.keyPillars.map((p) => `${p.label} ${p.takeaway}`),
    summary.practicalTakeaway,
  ]
    .join(' ')
    .trim();
  const wordCount = fullText ? fullText.split(/\s+/).length : 0;
  return Math.max(25, Math.min(180, Math.round((wordCount / 180) * 60)));
}

/**
 * Returns the persisted executive summary if present, or deterministically
 * derives a complete executive summary from any active or archived FinalDerasha.
 */
export function resolveDerashaExecutiveSummary(
  derasha: FinalDerasha | null,
  phase1Data?: Phase1AnalysisResult | null,
  sources: VerifiedSefariaSource[] = []
): DerashaExecutiveSummary {
  const sourcesDigest = buildCoreSourcesDigest(derasha, sources);
  const existing = derasha?.executiveSummary;

  if (
    existing &&
    cleanWhitespace(existing.headlineThesis) &&
    cleanWhitespace(existing.abstractNarrative)
  ) {
    const keyPillars = (existing.keyPillars || [])
      .filter((p) => cleanWhitespace(p.label) && cleanWhitespace(p.takeaway))
      .slice(0, 5);
    const practicalTakeaway =
      cleanWhitespace(existing.practicalTakeaway) ||
      cleanWhitespace(derasha?.practicalConclusion?.dailyAction) ||
      cleanWhitespace(derasha?.practicalConclusion?.hashkafa) ||
      'Llevar la enseñanza del estudio a una acción ética consciente hoy.';
    const mergedSources =
      existing.coreSourcesDigest && existing.coreSourcesDigest.length > 0
        ? existing.coreSourcesDigest
        : sourcesDigest;

    return {
      headlineThesis: cleanWhitespace(existing.headlineThesis),
      abstractNarrative: cleanWhitespace(existing.abstractNarrative),
      keyPillars,
      coreSourcesDigest: mergedSources,
      practicalTakeaway,
      estimatedReadingSec:
        existing.estimatedReadingSec && existing.estimatedReadingSec > 0
          ? existing.estimatedReadingSec
          : computeReadingSeconds({
              headlineThesis: existing.headlineThesis,
              abstractNarrative: existing.abstractNarrative,
              keyPillars,
              practicalTakeaway,
            }),
    };
  }

  // Deterministic synthesis for archived or legacy Derashot without a stored summary
  const headlineThesis =
    cleanWhitespace(derasha?.morphologicalSynthesis?.keyTheologicalInsight) ||
    cleanWhitespace(derasha?.practicalConclusion?.hashkafa) ||
    firstSentences(derasha?.openingExordium || '', 1, 210) ||
    cleanWhitespace(derasha?.derashaTitle) ||
    cleanWhitespace(phase1Data?.title) ||
    'Síntesis exegética de la tradición de la Torá.';

  const exordiumPart = firstSentences(derasha?.openingExordium || '', 2, 360);
  const canonicalPart = firstSentences(
    derasha?.canonicalAnalysis?.synthesis || '',
    1,
    220
  );
  const abstractNarrative =
    [exordiumPart, canonicalPart && canonicalPart !== exordiumPart ? canonicalPart : '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    cleanWhitespace(phase1Data?.liturgicalContext) ||
    'Estudio estructurado a partir de las fuentes clásicas del canon judío.';

  const keyPillars: DerashaExecutiveSummaryPillar[] = [];
  if (derasha?.methodologySections && derasha.methodologySections.length > 0) {
    for (const sec of derasha.methodologySections.slice(0, 4)) {
      const label = cleanWhitespace(sec.title || sec.spanishSubtitle);
      const takeaway =
        cleanWhitespace(sec.keyTakeaway) ||
        firstSentences(sec.exposition || '', 1, 200);
      if (label && takeaway) {
        keyPillars.push({ label, takeaway });
      }
    }
  } else if (derasha?.pardes) {
    const pillars = [
      derasha.pardes.pshat,
      derasha.pardes.remez,
      derasha.pardes.drash,
      derasha.pardes.sod,
    ];
    for (const p of pillars) {
      if (!p) continue;
      const label = cleanWhitespace(p.title);
      const takeaway =
        cleanWhitespace(p.keyTakeaway) || firstSentences(p.exposition || '', 1, 200);
      if (label && takeaway) {
        keyPillars.push({ label, takeaway });
      }
    }
  }

  const practicalTakeaway =
    cleanWhitespace(derasha?.practicalConclusion?.dailyAction) ||
    cleanWhitespace(derasha?.practicalConclusion?.prayerKavanah) ||
    cleanWhitespace(derasha?.practicalConclusion?.hashkafa) ||
    'Aplicar esta enseñanza en la conducta ética y la intención espiritual diaria.';

  const estimatedReadingSec = computeReadingSeconds({
    headlineThesis,
    abstractNarrative,
    keyPillars,
    practicalTakeaway,
  });

  return {
    headlineThesis,
    abstractNarrative,
    keyPillars,
    coreSourcesDigest: sourcesDigest,
    practicalTakeaway,
    estimatedReadingSec,
  };
}

/**
 * Formats an executive summary into clean plain text / Markdown for clipboard copy.
 */
export function buildDerashaSummaryShareText(
  derasha: FinalDerasha,
  summary: DerashaExecutiveSummary,
  phase1Data?: Phase1AnalysisResult | null
): string {
  const title = derasha.derashaTitle || phase1Data?.title || 'Resumen de Drashá';
  const methodMeta = getMethodologyMeta(
    derasha.metodologia || phase1Data?.detectedMetodologia || 'PARDES'
  );
  const durationLabel = getDurationBadgeLabel(derasha.duracion || phase1Data?.duracion);

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push(`Darshán AI · ${methodMeta.shortLabel} · ${durationLabel}`);
  lines.push('');
  lines.push(`**Tesis Central:** ${summary.headlineThesis}`);
  lines.push('');
  lines.push('## Síntesis de la Drashá');
  lines.push(summary.abstractNarrative);

  if (summary.keyPillars.length > 0) {
    lines.push('');
    lines.push('## Puntos Clave');
    summary.keyPillars.forEach((p, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      lines.push(`${num}. **${p.label}:** ${p.takeaway}`);
    });
  }

  lines.push('');
  lines.push(`**Aplicación Práctica:** ${summary.practicalTakeaway}`);

  if (summary.coreSourcesDigest.length > 0) {
    lines.push('');
    lines.push(`**Fuentes Clave:** ${summary.coreSourcesDigest.join(' · ')}`);
  }

  return lines.join('\n');
}

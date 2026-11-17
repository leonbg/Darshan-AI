import {
  Phase1AnalysisResult,
  FinalDerasha,
  VerifiedSefariaSource,
  FollowUpItem,
  type MorphologyItem,
  TheologicalKeys,
} from '../../types';
import {
  ExportScope,
  EditableFormat,
  MethodologyDisplayMeta,
  METHODOLOGY_DISPLAY_LIST,
  getMethodologyMeta,
  NormalizedExportSection,
  getDurationBadgeLabel,
  resolveLessonSectionsForExport,
} from '../methodologyCatalog';
import { resolveDerashaExecutiveSummary } from '../derashaSummary';

export {
  type ExportScope,
  type EditableFormat,
  type MethodologyDisplayMeta,
  METHODOLOGY_DISPLAY_LIST,
  getMethodologyMeta,
  type NormalizedExportSection,
  type MorphologyItem,
  getDurationBadgeLabel,
  resolveLessonSectionsForExport,
};

export interface LessonExportData {
  query: string;
  phase1: Phase1AnalysisResult | null;
  sources: VerifiedSefariaSource[];
  derasha: FinalDerasha | null;
  followUps?: FollowUpItem[];
  scope?: ExportScope;
}

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function makeSafeSlug(input: string, fallback = 'leccion-drasha'): string {
  const slug = (input || fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function cleanExportText(text?: string): string {
  return (text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface EnrichedExportSource {
  ref: string;
  heRef?: string;
  category: string;
  url: string;
  rationale?: string;
  hebrewClean: string;
  spanishClean: string;
  englishClean: string;
}

export function resolveEnrichedSourcesForExport(
  sources: VerifiedSefariaSource[],
  derasha: FinalDerasha | null,
  phase1: Phase1AnalysisResult | null
): EnrichedExportSource[] {
  return (sources || []).map((src) => {
    const hebrewClean = cleanExportText(src.hebrewText);
    const phase3Spanish = derasha?.canonicalAnalysis?.spanishTranslations?.find(
      (t) => t.ref.toLowerCase() === src.ref.toLowerCase()
    )?.spanishTranslation;
    const directSpanish = cleanExportText(src.spanishTranslation || phase3Spanish || '');
    const rawTranslation = cleanExportText(src.translation || '');

    const spanishClean = directSpanish || rawTranslation;
    const englishClean =
      directSpanish && rawTranslation && rawTranslation !== directSpanish
        ? rawTranslation
        : '';

    const matchedPred = phase1?.sefariaReferences?.find(
      (r) =>
        r.ref.toLowerCase() === src.ref.toLowerCase() ||
        src.ref.toLowerCase().includes(r.ref.toLowerCase()) ||
        r.ref.toLowerCase().includes(src.ref.toLowerCase())
    );

    return {
      ref: src.ref,
      heRef: src.heRef || matchedPred?.heRef,
      category: matchedPred?.category || 'Fuente Canónica',
      url: src.url || `https://www.sefaria.org/${encodeURIComponent(src.ref)}`,
      rationale: cleanExportText(matchedPred?.rationale || src.directConnectionSnippet),
      hebrewClean,
      spanishClean,
      englishClean,
    };
  });
}

export function resolveExtraPardesCardsIfSeparate(
  derasha: FinalDerasha | null,
  primarySections: NormalizedExportSection[]
): NormalizedExportSection[] {
  if (!derasha?.pardes) return [];
  const p = derasha.pardes;
  const pardesCandidates: NormalizedExportSection[] = [
    {
      id: 'extra-pardes-pshat',
      orderLabel: 'PARDÉS I',
      hebrewTerm: 'פְּשָׁט',
      spanishSubtitle: 'Pshat · Sentido Literal y Contextual',
      title: p.pshat?.title || 'Pshat — Sentido Literal',
      content: p.pshat?.exposition || '',
      keyInsight: p.pshat?.keyTakeaway || '',
    },
    {
      id: 'extra-pardes-remez',
      orderLabel: 'PARDÉS II',
      hebrewTerm: 'רֶמֶז',
      spanishSubtitle: 'Rémez · Alusión e Intertextualidad',
      title: p.remez?.title || 'Rémez — Nivel Alusivo',
      content: p.remez?.exposition || '',
      keyInsight: p.remez?.keyTakeaway || '',
    },
    {
      id: 'extra-pardes-drash',
      orderLabel: 'PARDÉS III',
      hebrewTerm: 'דְּרָשׁ',
      spanishSubtitle: 'Drash · Exégesis Homilética y Midráshica',
      title: p.drash?.title || 'Drash — Exégesis Homilética',
      content: p.drash?.exposition || '',
      keyInsight: p.drash?.keyTakeaway || '',
    },
    {
      id: 'extra-pardes-sod',
      orderLabel: 'PARDÉS IV',
      hebrewTerm: 'סוֹד',
      spanishSubtitle: 'Sod · Dimensión Interior y Mística',
      title: p.sod?.title || 'Sod — Dimensión Interior',
      content: p.sod?.exposition || '',
      keyInsight: p.sod?.keyTakeaway || '',
    },
  ].filter((c) => Boolean(c.content.trim()));

  return pardesCandidates.filter(
    (cand) =>
      !primarySections.some(
        (sec) =>
          sec.content.trim() === cand.content.trim() ||
          (sec.title.trim() === cand.title.trim() &&
            sec.content.slice(0, 80) === cand.content.slice(0, 80))
      )
  );
}

export interface NormalizedTheologicalKeyEntry {
  id: string;
  label: string;
  hebrew: string;
  title: string;
  explanation: string;
  hebrewQuote?: string;
  subDetails: string[];
}

export function normalizeTheologicalKeysForExport(
  tk?: TheologicalKeys | null
): NormalizedTheologicalKeyEntry[] {
  if (!tk) return [];
  const entries: NormalizedTheologicalKeyEntry[] = [];

  if (tk.textualParallelism) {
    const tp = tk.textualParallelism;
    entries.push({
      id: 'textual-parallelism',
      label: 'I. Paralelismo Textual (Gezerá Shavá / Hekesh)',
      hebrew: 'גְּזֵרָה שָׁוָה וְהֶקֵּשׁ',
      title: tp.title || 'Paralelismo Textual e Intertextualidad',
      explanation: tp.explanation || '',
      hebrewQuote: tp.hebrewQuote,
      subDetails: [
        tp.sourceRef ? `Fuente Canónica: ${tp.sourceRef}` : '',
        tp.connectionToPrayer ? `Conexión Litúrgica / Exegética: ${tp.connectionToPrayer}` : '',
      ].filter(Boolean),
    });
  }

  if (tk.grammaticalDichotomy) {
    const gd = tk.grammaticalDichotomy;
    entries.push({
      id: 'grammatical-dichotomy',
      label: 'II. Dicotomía Gramatical (Dikduk VeLashón)',
      hebrew: 'דִּקדּוּק וְלָשׁוֹן',
      title: gd.title || 'Dicotomía Gramatical y Verbal',
      explanation: gd.explanation || '',
      subDetails: [
        gd.verbAnalysis ? `Análisis Verbal: ${gd.verbAnalysis}` : '',
        gd.watchmakerRefutation ? `Implicación Teológica: ${gd.watchmakerRefutation}` : '',
        gd.liturgicalEcho ? `Eco Litúrgico: ${gd.liturgicalEcho}` : '',
      ].filter(Boolean),
    });
  }

  if (tk.technicalTerm) {
    const tt = tk.technicalTerm;
    entries.push({
      id: 'technical-term',
      label: 'III. Término Técnico y Halájico (Munaj Maftéaj)',
      hebrew: 'מוּנָח מַפְתֵּחַ',
      title: tt.title || 'Término Técnico y Normativo',
      explanation: tt.explanation || '',
      subDetails: [
        tt.mishnaSource ? `Fuente Normativa (Mishná / Halajá): ${tt.mishnaSource}` : '',
        tt.prescribedBlessing ? `Prescripción / Aplicación: ${tt.prescribedBlessing}` : '',
      ].filter(Boolean),
    });
  }

  if (tk.kabbalisticArchitecture) {
    const ka = tk.kabbalisticArchitecture;
    entries.push({
      id: 'kabbalistic-architecture',
      label: 'IV. Arquitectura Cabalística y Estructural (Mivné HaSod)',
      hebrew: 'מִבְנֶה הַסּוֹד',
      title: ka.title || 'Arquitectura Interior y Estructura',
      explanation: ka.explanation || '',
      subDetails: [
        ka.sefiraConnection ? `Dimensión / Sefirá: ${ka.sefiraConnection}` : '',
        ka.prooftext ? `Versículo de Apoyo: ${ka.prooftext}` : '',
        ka.liturgicalStructure ? `Estructura Litúrgica: ${ka.liturgicalStructure}` : '',
      ].filter(Boolean),
    });
  }

  return entries.filter((e) => Boolean(e.explanation || e.subDetails.length > 0));
}

export { resolveDerashaExecutiveSummary };

/**
 * Triggers a direct browser download for a Blob.
 */
export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * Attempts to share a generated file via the Web Share API (`navigator.share({ files })`),
 * and automatically falls back to downloading the file if the browser/device does not support
 * file sharing.
 */
export async function shareOrDownloadFile(params: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
  preferShare: boolean;
}): Promise<'shared' | 'downloaded'> {
  const { blob, filename, title, text, preferShare } = params;

  if (preferShare && typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  downloadBlobFile(blob, filename);
  return 'downloaded';
}

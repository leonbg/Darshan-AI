import {
  Phase1AnalysisResult,
  FinalDerasha,
  VerifiedSefariaSource,
  FollowUpItem,
  MorphologyItem,
  TheologicalKeys,
} from '../types';
import {
  ExportScope,
  EditableFormat,
  MethodologyDisplayMeta,
  METHODOLOGY_DISPLAY_LIST,
  getMethodologyMeta,
  NormalizedExportSection,
  getDurationBadgeLabel,
  resolveLessonSectionsForExport,
} from './methodologyCatalog';
import { resolveDerashaExecutiveSummary } from './derashaSummary';

export {
  type ExportScope,
  type EditableFormat,
  type MethodologyDisplayMeta,
  METHODOLOGY_DISPLAY_LIST,
  getMethodologyMeta,
  type NormalizedExportSection,
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

/**
 * Generates clean Markdown (.md) open editable document including ALL cards,
 * additional source texts, analyses, and breakdowns.
 */
export function buildEditableMarkdown(data: LessonExportData): string {
  const { query, phase1, sources, derasha, followUps = [], scope = 'full_derasha' } = data;
  const title = derasha?.derashaTitle || phase1?.title || query || 'Lección de Torá';
  const methodMeta = getMethodologyMeta(
    derasha?.metodologia || phase1?.detectedMetodologia || 'PARDES'
  );
  const durationLabel = getDurationBadgeLabel(derasha?.duracion || phase1?.duracion);
  const audienceTone = derasha?.audienciaOTono || '';
  const complementaryIds =
    derasha?.metodologiasComplementarias || phase1?.metodologiasComplementarias || [];
  const complementaryLabels = complementaryIds
    .map((m) => getMethodologyMeta(m).label)
    .join(', ');

  const sections = resolveLessonSectionsForExport(derasha, scope);
  const extraPardesCards = resolveExtraPardesCardsIfSeparate(derasha, sections);
  const enrichedSources = resolveEnrichedSourcesForExport(sources, derasha, phase1);
  const theologicalKeyEntries = normalizeTheologicalKeysForExport(
    derasha?.theologicalKeys || phase1?.theologicalKeys
  );
  const halakhicVal = derasha?.halakhicValidation || phase1?.halakhicValidation;
  const executiveSummary = derasha
    ? resolveDerashaExecutiveSummary(derasha, phase1, sources)
    : null;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push(
    `> **Darshán AI** · Metodología Principal: **${methodMeta.label} (${methodMeta.hebrewLabel})** · Formato: **${durationLabel}**`
  );
  if (complementaryLabels) {
    lines.push(`> **Metodologías Complementarias:** ${complementaryLabels}`);
  }
  if (audienceTone) {
    lines.push(`> **Audiencia / Tono:** ${audienceTone}`);
  }
  lines.push(`> **Tema / Consulta:** ${query}`);
  if (halakhicVal?.validatorSummary) {
    lines.push(`> **Validador Halájico del Pipeline:** ${halakhicVal.validatorSummary}`);
  }
  if (phase1?.logicGateReason) {
    lines.push(`> **Compuerta Metodológica:** ${phase1.logicGateReason}`);
  }
  lines.push('');

  if (executiveSummary) {
    lines.push('## Resumen Ejecutivo de la Drashá');
    lines.push('');
    lines.push(`**Tesis Central:** ${executiveSummary.headlineThesis}`);
    lines.push('');
    lines.push(executiveSummary.abstractNarrative);
    if (executiveSummary.keyPillars.length > 0) {
      lines.push('');
      lines.push('### Puntos Clave');
      executiveSummary.keyPillars.forEach((p, idx) => {
        lines.push(`${idx + 1}. **${p.label}:** ${p.takeaway}`);
      });
    }
    lines.push('');
    lines.push(`* **Aplicación Práctica:** ${executiveSummary.practicalTakeaway}`);
    if (executiveSummary.coreSourcesDigest.length > 0) {
      lines.push(`* **Fuentes Clave:** ${executiveSummary.coreSourcesDigest.join(' · ')}`);
    }
    lines.push('');
  }

  if (phase1?.primaryHebrew || phase1?.liturgicalContext) {
    lines.push('## 1. Pasuk Central y Contexto Litúrgico-Canónico');
    lines.push('');
    if (phase1?.primaryHebrew) {
      lines.push(`### ${phase1.primaryHebrew}`);
    }
    if (phase1?.transliteration) {
      lines.push(`* **Transliteración:** *${phase1.transliteration}*`);
    }
    if (phase1?.literalSpanishTranslation) {
      lines.push(`* **Traducción Literal:** "${phase1.literalSpanishTranslation}"`);
    }
    if (phase1?.liturgicalContext) {
      lines.push(`* **Contexto Litúrgico y Canónico:** ${phase1.liturgicalContext}`);
    }
    lines.push('');
  }

  if (derasha?.openingExordium) {
    lines.push('## 2. Exordio y Planteamiento Central');
    lines.push('');
    lines.push(derasha.openingExordium);
    lines.push('');
  }

  if (sections.length > 0) {
    lines.push(`## 3. Tarjetas de Desarrollo Exegético (${methodMeta.label})`);
    lines.push('');
    sections.forEach((sec, idx) => {
      const prefix = sec.isComplementary
        ? `[Aporte Complementario · ${sec.spanishSubtitle}] `
        : `[${sec.orderLabel} · ${sec.spanishSubtitle}] `;
      lines.push(`### ${prefix}${sec.title} ${sec.hebrewTerm ? `(${sec.hebrewTerm})` : ''}`);
      lines.push('');
      lines.push(sec.content);
      lines.push('');
      if (sec.keyInsight) {
        lines.push(`> **Enseñanza Clave:** «${sec.keyInsight}»`);
        lines.push('');
      }
      if (idx < sections.length - 1) {
        lines.push('---');
        lines.push('');
      }
    });
  }

  if (extraPardesCards.length > 0) {
    lines.push('## 3B. Tarjetas de los Cuatro Niveles del PARDÉS (Pshat, Rémez, Drash, Sod)');
    lines.push('');
    extraPardesCards.forEach((sec) => {
      lines.push(`### [${sec.orderLabel} · ${sec.spanishSubtitle}] ${sec.title} (${sec.hebrewTerm})`);
      lines.push('');
      lines.push(sec.content);
      lines.push('');
      if (sec.keyInsight) {
        lines.push(`> **Enseñanza Clave:** «${sec.keyInsight}»`);
        lines.push('');
      }
    });
  }

  if (derasha?.practicalConclusion) {
    const pc = derasha.practicalConclusion;
    lines.push(`## 4. ${pc.title || 'Conclusión Práctica y Enseñanza Ética (Halajá y Musar)'}`);
    lines.push('');
    if (pc.hashkafa) {
      lines.push(`* **Visión (Hashkafá):** ${pc.hashkafa}`);
    }
    if (pc.prayerKavanah) {
      lines.push(`* **Kavaná Interior:** ${pc.prayerKavanah}`);
    }
    if (pc.dailyAction) {
      lines.push(`* **Acción Práctica Cotidiana (Halajá / Musar):** ${pc.dailyAction}`);
    }
    lines.push('');
  }

  if (
    (phase1?.morphologicalBreakdown && phase1.morphologicalBreakdown.length > 0) ||
    derasha?.morphologicalSynthesis
  ) {
    lines.push('## 5. Desglose Morfológico y Raíces Hebreas (Shoresh)');
    lines.push('');
    if (derasha?.morphologicalSynthesis?.summary) {
      lines.push(`**Síntesis Filológica y Gramatical:** ${derasha.morphologicalSynthesis.summary}`);
      lines.push('');
    }
    if (derasha?.morphologicalSynthesis?.keyTheologicalInsight) {
      lines.push(
        `> **Revelación Morfológica Central:** «${derasha.morphologicalSynthesis.keyTheologicalInsight}»`
      );
      lines.push('');
    }
    if (phase1?.morphologicalBreakdown && phase1.morphologicalBreakdown.length > 0) {
      lines.push(
        '| Término Hebreo | Shoresh (Raíz) | Significado de Raíz | Binyán / Tiempo | Implicación Exegética |'
      );
      lines.push('| :--- | :--- | :--- | :--- | :--- |');
      phase1.morphologicalBreakdown.forEach((m: MorphologyItem) => {
        lines.push(
          `| **${m.hebrewWord}** | \`${m.root}\` | ${m.rootMeaning} | ${m.binyan} (${m.tense}) | ${m.theologicalImplication} |`
        );
      });
      lines.push('');
    }
  }

  if (theologicalKeyEntries.length > 0) {
    lines.push('## 6. Las 4 Claves Teológicas y Exegéticas del Estudio');
    lines.push('');
    theologicalKeyEntries.forEach((entry) => {
      lines.push(`### ${entry.label} (${entry.hebrew}) — ${entry.title}`);
      if (entry.hebrewQuote) {
        lines.push(`* **Cita Hebrea:** ${entry.hebrewQuote}`);
      }
      lines.push(entry.explanation);
      entry.subDetails.forEach((d) => {
        lines.push(`* ${d}`);
      });
      lines.push('');
    });
  }

  if (
    derasha?.canonicalAnalysis?.synthesis ||
    (derasha?.canonicalAnalysis?.verifiedEchoes &&
      derasha.canonicalAnalysis.verifiedEchoes.length > 0) ||
    enrichedSources.length > 0
  ) {
    lines.push('## 7. Análisis Canónico y Fuentes Verificadas en Sefaria');
    lines.push('');
    if (derasha?.canonicalAnalysis?.synthesis) {
      lines.push(`### Síntesis Intertextual del Canon`);
      lines.push(derasha.canonicalAnalysis.synthesis);
      lines.push('');
    }
    if (
      derasha?.canonicalAnalysis?.verifiedEchoes &&
      derasha.canonicalAnalysis.verifiedEchoes.length > 0
    ) {
      lines.push('### Ecos Canónicos e Hilos Exegéticos');
      derasha.canonicalAnalysis.verifiedEchoes.forEach((echo) => {
        lines.push(`* **${echo.ref}:** ${echo.connection}`);
      });
      lines.push('');
    }
    if (enrichedSources.length > 0) {
      lines.push(`### Textos Completos de las Fuentes Canónicas (${enrichedSources.length})`);
      lines.push('');
      enrichedSources.forEach((src, i) => {
        lines.push(
          `#### ${i + 1}. ${src.ref} ${src.heRef ? `(${src.heRef})` : ''} — [${src.category}]`
        );
        if (src.rationale) {
          lines.push(`* **Razón Exegética / Relevancia:** ${src.rationale}`);
        }
        if (src.hebrewClean) {
          lines.push(`* **Texto Hebreo Original:** ${src.hebrewClean}`);
        }
        if (src.spanishClean) {
          lines.push(`* **Traducción / Texto en Español:** "${src.spanishClean}"`);
        }
        if (src.englishClean) {
          lines.push(`* **Traducción en Inglés (Sefaria):** "${src.englishClean}"`);
        }
        lines.push(`* **Enlace Sefaria:** ${src.url}`);
        lines.push('');
      });
    }
  }

  const suppressExternal = Boolean(halakhicVal?.externalPhilosophyInjectionDisabled);
  const externalSources = !suppressExternal
    ? derasha?.externalSources?.length
      ? derasha.externalSources
      : phase1?.externalSources || []
    : [];
  const formalContrast = !suppressExternal
    ? derasha?.formalContrast || phase1?.formalContrast
    : undefined;
  const externalDetection = !suppressExternal
    ? derasha?.externalThinkerDetection || phase1?.externalThinkerDetection
    : undefined;
  const hasExternalContrast =
    !suppressExternal &&
    (externalDetection?.detected ||
      formalContrast?.isComparativeStudy ||
      externalSources.length > 0);

  if (hasExternalContrast) {
    lines.push('## 8. Contraste Exegético Formal y Fuentes Comparadas');
    lines.push('');
    if (externalDetection?.detected) {
      lines.push(
        `* **Pensador / Marco Comparado:** ${externalDetection.thinkerName} (${externalDetection.specificPhilosophicalConcept})`
      );
      if (externalDetection.universalityVsSpecificityMatrix) {
        const mat = externalDetection.universalityVsSpecificityMatrix;
        lines.push(`* **Pretensión Universal Externa:** ${mat.externalConceptUniversalClaim}`);
        lines.push(`* **Horizonte Universal de la Torá:** ${mat.torahUniversalHorizon}`);
        lines.push(`* **Especificidad de la Mitzvá:** ${mat.torahCommandmentSpecificity}`);
        lines.push(`* **Síntesis de Cosmovisión:** ${mat.worldviewContrastSynthesis}`);
      }
    }
    if (formalContrast?.universalidadVsEspecificidad) {
      const u = formalContrast.universalidadVsEspecificidad;
      lines.push(`### ${u.title || 'Universalidad vs. Especificidad del Pacto'}`);
      lines.push(`* **Universalismo Externo:** ${u.externalUniversalism}`);
      lines.push(`* **Dimensión Universal en la Torá:** ${u.torahUniversalDimension}`);
      lines.push(`* **Especificidad Normativa de la Mitzvá:** ${u.torahCommandmentSpecificity}`);
      lines.push(`* **Síntesis Exegética:** ${u.exegeticalSynthesis}`);
      lines.push('');
    }
    if (formalContrast?.fuentesInternasVsExternas) {
      const f = formalContrast.fuentesInternasVsExternas;
      lines.push(`### ${f.title || 'Fuentes Internas vs. Fuentes Externas'}`);
      lines.push(`* **Naturaleza de las Fuentes Internas:** ${f.internalTorahSourcesNature}`);
      lines.push(`* **Naturaleza de las Fuentes Externas:** ${f.externalSourcesNature}`);
      lines.push(`* **Contraste de Locus Normativo:** ${f.normativeLocusContrast}`);
      lines.push(`* **Regla Hermenéutica:** ${f.hermeneuticalRule}`);
      lines.push('');
    }
    if (externalSources.length > 0) {
      externalSources.forEach((ext) => {
        lines.push(`### ${ext.author} — *${ext.workTitle}* (${ext.canonicalLocus})`);
        if (ext.originalQuote) {
          lines.push(`* **Cita Original:** "${ext.originalQuote}"`);
        }
        if (ext.spanishTranslation) {
          lines.push(`* **Traducción al Español:** "${ext.spanishTranslation}"`);
        }
        if (ext.philosophicalThesis) {
          lines.push(`* **Tesis Filosófica:** ${ext.philosophicalThesis}`);
        }
        if (ext.torahContrastPoint) {
          lines.push(`* **Punto de Contraste con la Torá:** ${ext.torahContrastPoint}`);
        }
        lines.push('');
      });
    }
  }

  if (
    derasha?.contemporaryMasters?.readings &&
    derasha.contemporaryMasters.readings.length > 0
  ) {
    lines.push('## 9. Lecturas de Maestros Contemporáneos de la Torá');
    lines.push('');
    if (derasha.contemporaryMasters.overview) {
      lines.push(`> **Eje Articulador:** ${derasha.contemporaryMasters.overview}`);
      lines.push('');
    }
    derasha.contemporaryMasters.readings.forEach((reading) => {
      lines.push(
        `### ${reading.masterName} (${reading.masterTitle}) — *${reading.cycleOrSeries}*`
      );
      lines.push(`* **Título de Lectura:** ${reading.readingTitle}`);
      lines.push(`* **Pregunta Central:** ${reading.centralQuestion}`);
      lines.push(`* **Tesis Central:** ${reading.coreThesis}`);
      lines.push('');
      lines.push(reading.detailedExposition);
      lines.push('');
      if (reading.keyQuoteOrConcept) {
        lines.push(`> **Cita / Concepto Clave:** «${reading.keyQuoteOrConcept}»`);
        lines.push('');
      }
      if (reading.practicalTakeaway) {
        lines.push(`* **Enseñanza Práctica:** ${reading.practicalTakeaway}`);
        lines.push('');
      }
    });
  }

  if (followUps.length > 0) {
    lines.push('## 10. Diálogo Exegético y Preguntas de Ampliación');
    lines.push('');
    followUps.forEach((f, idx) => {
      lines.push(`### P${idx + 1}: ${f.question}`);
      lines.push('');
      lines.push(f.answer);
      if (f.relatedSefariaReferences && f.relatedSefariaReferences.length > 0) {
        lines.push('');
        lines.push(
          `* **Referencias Citadas:** ${f.relatedSefariaReferences
            .map((r) => `${r.ref} (${r.rationale})`)
            .join(' · ')}`
        );
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

/**
 * Helper to encode any string into RTF 1.5 ASCII with signed 16-bit Unicode escapes (\uN?)
 */
function toRtfUnicode(text: string): string {
  if (!text) return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x0a) {
      out += '\\par\n';
    } else if (code === 0x0d) {
      continue;
    } else if (code === 0x5c || code === 0x7b || code === 0x7d) {
      out += '\\' + text[i];
    } else if (code >= 0x20 && code <= 0x7e) {
      out += text[i];
    } else {
      const signed = code > 32767 ? code - 65536 : code;
      out += `\\u${signed}?`;
    }
  }
  return out;
}

/**
 * Generates an Open Rich Text Format (.rtf) Blob including ALL cards,
 * additional source texts, analyses, and breakdowns.
 */
export function generateOpenRtfBlob(data: LessonExportData): Blob {
  const { query, phase1, sources, derasha, followUps = [], scope = 'full_derasha' } = data;
  const title = derasha?.derashaTitle || phase1?.title || query || 'Lección de Torá';
  const methodMeta = getMethodologyMeta(
    derasha?.metodologia || phase1?.detectedMetodologia || 'PARDES'
  );
  const durationLabel = getDurationBadgeLabel(derasha?.duracion || phase1?.duracion);
  const sections = resolveLessonSectionsForExport(derasha, scope);
  const extraPardesCards = resolveExtraPardesCardsIfSeparate(derasha, sections);
  const enrichedSources = resolveEnrichedSourcesForExport(sources, derasha, phase1);
  const theologicalKeyEntries = normalizeTheologicalKeysForExport(
    derasha?.theologicalKeys || phase1?.theologicalKeys
  );
  const halakhicVal = derasha?.halakhicValidation || phase1?.halakhicValidation;
  const executiveSummary = derasha
    ? resolveDerashaExecutiveSummary(derasha, phase1, sources)
    : null;

  const rtf: string[] = [];
  rtf.push(
    '{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0' +
      '{\\fonttbl{\\f0\\froman\\fcharset0 Georgia;}{\\f1\\fswiss\\fcharset0 Arial;}{\\f2\\froman\\fcharset177 Times New Roman;}}' +
      '{\\colortbl ;\\red15\\green23\\blue42;\\red3\\green105\\blue161;\\red71\\green85\\blue105;\\red180\\green83\\blue9;}' +
      '\\paperw11906\\paperh16838\\margl1134\\margr1134\\margt1134\\margb1134'
  );

  rtf.push(
    `\\pard\\sa120\\f1\\fs18\\cf2\\b ${toRtfUnicode(
      `DARSHÁN AI · ${methodMeta.label.toUpperCase()} (${methodMeta.hebrewLabel}) · ${durationLabel.toUpperCase()}`
    )}\\b0\\par`
  );

  rtf.push(`\\pard\\sa180\\f0\\fs40\\cf1\\b ${toRtfUnicode(title)}\\b0\\par`);
  rtf.push(
    `\\pard\\sa160\\f1\\fs20\\cf3\\i ${toRtfUnicode(`Consulta / Tema de estudio: ${query}`)}\\i0\\par`
  );

  if (phase1?.liturgicalContext || halakhicVal?.validatorSummary || phase1?.logicGateReason) {
    if (phase1?.liturgicalContext) {
      rtf.push(
        `\\pard\\sa80\\f0\\fs20\\cf1\\b ${toRtfUnicode('Contexto Litúrgico: ')}\\b0 ${toRtfUnicode(
          phase1.liturgicalContext
        )}\\par`
      );
    }
    if (halakhicVal?.validatorSummary) {
      rtf.push(
        `\\pard\\sa80\\f0\\fs20\\cf2\\b ${toRtfUnicode('Validador Halájico: ')}\\b0 ${toRtfUnicode(
          halakhicVal.validatorSummary
        )}\\par`
      );
    }
    if (phase1?.logicGateReason) {
      rtf.push(
        `\\pard\\sa140\\f0\\fs20\\cf3\\i ${toRtfUnicode(
          `Compuerta Metodológica: ${phase1.logicGateReason}`
        )}\\i0\\par`
      );
    }
  }

  if (executiveSummary) {
    rtf.push(
      `\\pard\\sa100\\f0\\fs26\\cf2\\b ${toRtfUnicode('Resumen Ejecutivo de la Drashá')}\\b0\\par`
    );
    rtf.push(
      `\\pard\\sa100\\f0\\fs22\\cf1\\b ${toRtfUnicode('Tesis Central: ')}\\b0 ${toRtfUnicode(
        executiveSummary.headlineThesis
      )}\\par`
    );
    rtf.push(
      `\\pard\\sa120\\sl300\\slmult1\\f0\\fs22\\cf1 ${toRtfUnicode(
        executiveSummary.abstractNarrative
      )}\\par`
    );
    executiveSummary.keyPillars.forEach((p, idx) => {
      rtf.push(
        `\\pard\\sa60\\f0\\fs21\\cf1\\b ${toRtfUnicode(`${idx + 1}. ${p.label}: `)}\\b0 ${toRtfUnicode(
          p.takeaway
        )}\\par`
      );
    });
    rtf.push(
      `\\pard\\sa180\\f0\\fs21\\cf2\\b ${toRtfUnicode('Aplicación Práctica: ')}\\b0 ${toRtfUnicode(
        executiveSummary.practicalTakeaway
      )}\\par`
    );
  }

  if (phase1?.primaryHebrew) {
    rtf.push(
      `\\pard\\qc\\sa140\\f2\\fs34\\cf1\\b ${toRtfUnicode(phase1.primaryHebrew)}\\b0\\par`
    );
    if (phase1.transliteration) {
      rtf.push(
        `\\pard\\qc\\sa80\\f0\\fs20\\cf2\\i ${toRtfUnicode(phase1.transliteration)}\\i0\\par`
      );
    }
    if (phase1.literalSpanishTranslation) {
      rtf.push(
        `\\pard\\qc\\sa240\\f0\\fs22\\cf1 ${toRtfUnicode(
          `«${phase1.literalSpanishTranslation}»`
        )}\\par`
      );
    }
  }

  if (derasha?.openingExordium) {
    rtf.push(
      `\\pard\\sa120\\f0\\fs26\\cf2\\b ${toRtfUnicode('Exordio y Planteamiento Central')}\\b0\\par`
    );
    rtf.push(
      `\\pard\\sa240\\sl300\\slmult1\\f0\\fs23\\cf1 ${toRtfUnicode(
        derasha.openingExordium
      )}\\par`
    );
  }

  const appendRtfSection = (sec: NormalizedExportSection) => {
    const headerLine = `${sec.orderLabel}. ${sec.title} ${sec.hebrewTerm ? `(${sec.hebrewTerm})` : ''}`;
    rtf.push(`\\pard\\sa80\\f0\\fs28\\cf2\\b ${toRtfUnicode(headerLine)}\\b0\\par`);
    if (sec.spanishSubtitle) {
      rtf.push(
        `\\pard\\sa120\\f1\\fs18\\cf4\\b ${toRtfUnicode(sec.spanishSubtitle.toUpperCase())}\\b0\\par`
      );
    }
    const paragraphs = (sec.content || '').split(/\n\n+/).filter(Boolean);
    paragraphs.forEach((p) => {
      rtf.push(
        `\\pard\\sa180\\sl300\\slmult1\\f0\\fs23\\cf1 ${toRtfUnicode(p.trim())}\\par`
      );
    });
    if (sec.keyInsight) {
      rtf.push(
        `\\pard\\li360\\ri360\\sa240\\f0\\fs22\\cf2\\b ${toRtfUnicode(
          `Enseñanza Clave: «${sec.keyInsight}»`
        )}\\b0\\par`
      );
    }
  };

  sections.forEach(appendRtfSection);

  if (extraPardesCards.length > 0) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs28\\cf2\\b ${toRtfUnicode(
        'Tarjetas de los Cuatro Niveles del PARDÉS (Pshat, Rémez, Drash, Sod)'
      )}\\b0\\par`
    );
    extraPardesCards.forEach(appendRtfSection);
  }

  if (derasha?.practicalConclusion) {
    const pc = derasha.practicalConclusion;
    rtf.push(
      `\\pard\\sa120\\f0\\fs28\\cf2\\b ${toRtfUnicode(
        pc.title || 'Conclusión Práctica y Compromiso Ético'
      )}\\b0\\par`
    );
    if (pc.hashkafa) {
      rtf.push(
        `\\pard\\sa120\\f0\\fs22\\cf1\\b ${toRtfUnicode('Visión (Hashkafá): ')}\\b0 ${toRtfUnicode(
          pc.hashkafa
        )}\\par`
      );
    }
    if (pc.prayerKavanah) {
      rtf.push(
        `\\pard\\sa120\\f0\\fs22\\cf1\\b ${toRtfUnicode('Kavaná Interior: ')}\\b0 ${toRtfUnicode(
          pc.prayerKavanah
        )}\\par`
      );
    }
    if (pc.dailyAction) {
      rtf.push(
        `\\pard\\sa160\\f0\\fs22\\cf1\\b ${toRtfUnicode(
          'Acción Práctica Cotidiana: '
        )}\\b0 ${toRtfUnicode(pc.dailyAction)}\\par`
      );
    }
  }

  if (
    (phase1?.morphologicalBreakdown && phase1.morphologicalBreakdown.length > 0) ||
    derasha?.morphologicalSynthesis
  ) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs26\\cf2\\b ${toRtfUnicode(
        'Raíces Hebreas (Shoresh) y Análisis Morfológico'
      )}\\b0\\par`
    );
    if (derasha?.morphologicalSynthesis?.summary) {
      rtf.push(
        `\\pard\\sa100\\f0\\fs21\\cf1 ${toRtfUnicode(
          derasha.morphologicalSynthesis.summary
        )}\\par`
      );
    }
    if (derasha?.morphologicalSynthesis?.keyTheologicalInsight) {
      rtf.push(
        `\\pard\\sa120\\f0\\fs21\\cf2\\b ${toRtfUnicode(
          `Revelación Morfológica: «${derasha.morphologicalSynthesis.keyTheologicalInsight}»`
        )}\\b0\\par`
      );
    }
    (phase1?.morphologicalBreakdown || []).forEach((m: MorphologyItem) => {
      rtf.push(
        `\\pard\\sa100\\f0\\fs21\\cf1\\b ${toRtfUnicode(
          `${m.hebrewWord} — Raíz: ${m.root} (${m.rootMeaning}) [${m.binyan} · ${m.tense}]`
        )}\\b0 : ${toRtfUnicode(m.theologicalImplication)}\\par`
      );
    });
  }

  if (theologicalKeyEntries.length > 0) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs26\\cf2\\b ${toRtfUnicode(
        'Las 4 Claves Teológicas y Exegéticas'
      )}\\b0\\par`
    );
    theologicalKeyEntries.forEach((entry) => {
      rtf.push(
        `\\pard\\sa80\\f0\\fs22\\cf2\\b ${toRtfUnicode(
          `${entry.label} (${entry.hebrew}) — ${entry.title}`
        )}\\b0\\par`
      );
      rtf.push(`\\pard\\sa80\\f0\\fs21\\cf1 ${toRtfUnicode(entry.explanation)}\\par`);
      entry.subDetails.forEach((d) => {
        rtf.push(`\\pard\\sa60\\f0\\fs20\\cf3 ${toRtfUnicode(`• ${d}`)}\\par`);
      });
    });
  }

  if (derasha?.canonicalAnalysis?.synthesis || enrichedSources.length > 0) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs26\\cf2\\b ${toRtfUnicode(
        `Análisis Canónico y Fuentes Verificadas en Sefaria (${enrichedSources.length})`
      )}\\b0\\par`
    );
    if (derasha?.canonicalAnalysis?.synthesis) {
      rtf.push(
        `\\pard\\sa100\\f0\\fs21\\cf1\\b ${toRtfUnicode(
          'Síntesis Canónica: '
        )}\\b0 ${toRtfUnicode(derasha.canonicalAnalysis.synthesis)}\\par`
      );
    }
    (derasha?.canonicalAnalysis?.verifiedEchoes || []).forEach((echo) => {
      rtf.push(
        `\\pard\\sa80\\f0\\fs20\\cf2 ${toRtfUnicode(
          `• Eco Canónico (${echo.ref}): ${echo.connection}`
        )}\\par`
      );
    });
    enrichedSources.forEach((src, i) => {
      rtf.push(
        `\\pard\\sa60\\f1\\fs20\\cf2\\b ${toRtfUnicode(
          `${i + 1}. ${src.ref} ${src.heRef ? `(${src.heRef})` : ''} [${src.category}]`
        )}\\b0\\par`
      );
      if (src.rationale) {
        rtf.push(
          `\\pard\\sa60\\f0\\fs19\\cf2\\i ${toRtfUnicode(
            `Relevancia Exegética: ${src.rationale}`
          )}\\i0\\par`
        );
      }
      if (src.hebrewClean) {
        rtf.push(`\\pard\\sa80\\f2\\fs22\\cf1 ${toRtfUnicode(src.hebrewClean)}\\par`);
      }
      if (src.spanishClean) {
        rtf.push(
          `\\pard\\sa80\\f0\\fs20\\cf3 ${toRtfUnicode(
            `Traducción en Español: «${src.spanishClean}»`
          )}\\par`
        );
      }
      if (src.englishClean) {
        rtf.push(
          `\\pard\\sa120\\f0\\fs19\\cf3 ${toRtfUnicode(
            `Texto en Inglés (Sefaria): «${src.englishClean}»`
          )}\\par`
        );
      }
    });
  }

  if (
    derasha?.contemporaryMasters?.readings &&
    derasha.contemporaryMasters.readings.length > 0
  ) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs26\\cf2\\b ${toRtfUnicode(
        'Lecturas de Maestros Contemporáneos de la Torá'
      )}\\b0\\par`
    );
    if (derasha.contemporaryMasters.overview) {
      rtf.push(
        `\\pard\\sa100\\f0\\fs21\\cf1\\i ${toRtfUnicode(
          derasha.contemporaryMasters.overview
        )}\\i0\\par`
      );
    }
    derasha.contemporaryMasters.readings.forEach((r) => {
      rtf.push(
        `\\pard\\sa80\\f0\\fs22\\cf2\\b ${toRtfUnicode(
          `${r.masterName} (${r.masterTitle}) — ${r.cycleOrSeries}: ${r.readingTitle}`
        )}\\b0\\par`
      );
      rtf.push(
        `\\pard\\sa80\\f0\\fs21\\cf1\\b ${toRtfUnicode('Tesis Central: ')}\\b0 ${toRtfUnicode(
          r.coreThesis
        )}\\par`
      );
      rtf.push(
        `\\pard\\sa100\\f0\\fs21\\cf1 ${toRtfUnicode(r.detailedExposition)}\\par`
      );
      if (r.keyQuoteOrConcept) {
        rtf.push(
          `\\pard\\sa80\\f0\\fs20\\cf2\\i ${toRtfUnicode(
            `Cita / Concepto Clave: «${r.keyQuoteOrConcept}»`
          )}\\i0\\par`
        );
      }
      if (r.practicalTakeaway) {
        rtf.push(
          `\\pard\\sa140\\f0\\fs20\\cf3 ${toRtfUnicode(
            `Enseñanza Práctica: ${r.practicalTakeaway}`
          )}\\par`
        );
      }
    });
  }

  if (followUps.length > 0) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs26\\cf2\\b ${toRtfUnicode(
        'Diálogo Exegético y Preguntas de Ampliación'
      )}\\b0\\par`
    );
    followUps.forEach((f, idx) => {
      rtf.push(
        `\\pard\\sa80\\f0\\fs22\\cf2\\b ${toRtfUnicode(
          `P${idx + 1}: ${f.question}`
        )}\\b0\\par`
      );
      rtf.push(`\\pard\\sa140\\f0\\fs21\\cf1 ${toRtfUnicode(f.answer)}\\par`);
    });
  }

  rtf.push('}');
  return new Blob([rtf.join('\n')], { type: 'application/rtf;charset=utf-8' });
}

/**
 * Builds the complete printable & editable HTML document including ALL cards,
 * additional source texts, analyses, and breakdowns.
 */
export function buildLessonPrintableHtml(
  data: LessonExportData,
  options?: { forWordDoc?: boolean; editableInBrowser?: boolean }
): string {
  const { query, phase1, sources, derasha, followUps = [], scope = 'full_derasha' } = data;
  const forWord = Boolean(options?.forWordDoc);
  const editableInBrowser = Boolean(options?.editableInBrowser);

  const title = derasha?.derashaTitle || phase1?.title || query || 'Lección de Torá';
  const methodMeta = getMethodologyMeta(
    derasha?.metodologia || phase1?.detectedMetodologia || 'PARDES'
  );
  const durationLabel = getDurationBadgeLabel(derasha?.duracion || phase1?.duracion);
  const audienceTone = derasha?.audienciaOTono || '';
  const complementaryIds =
    derasha?.metodologiasComplementarias || phase1?.metodologiasComplementarias || [];
  const complementaryLabels = complementaryIds
    .map((m) => getMethodologyMeta(m).label)
    .join(', ');

  const sections = resolveLessonSectionsForExport(derasha, scope);
  const extraPardesCards = resolveExtraPardesCardsIfSeparate(derasha, sections);
  const enrichedSources = resolveEnrichedSourcesForExport(sources, derasha, phase1);
  const theologicalKeyEntries = normalizeTheologicalKeysForExport(
    derasha?.theologicalKeys || phase1?.theologicalKeys
  );
  const halakhicVal = derasha?.halakhicValidation || phase1?.halakhicValidation;
  const suppressExternal = Boolean(halakhicVal?.externalPhilosophyInjectionDisabled);
  const externalSources = !suppressExternal
    ? derasha?.externalSources?.length
      ? derasha.externalSources
      : phase1?.externalSources || []
    : [];
  const formalContrast = !suppressExternal
    ? derasha?.formalContrast || phase1?.formalContrast
    : undefined;
  const externalDetection = !suppressExternal
    ? derasha?.externalThinkerDetection || phase1?.externalThinkerDetection
    : undefined;
  const hasExternalContrast =
    !suppressExternal &&
    (externalDetection?.detected ||
      formalContrast?.isComparativeStudy ||
      externalSources.length > 0);

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const renderSectionHtmlBlock = (sec: NormalizedExportSection) => {
    const paragraphs = (sec.content || '')
      .split(/\n\n+/)
      .filter(Boolean)
      .map((p) => `<p class="body-p">${escapeHtml(p.trim())}</p>`)
      .join('');

    const badgeColor = sec.isComplementary ? '#92400e' : '#0369a1';
    const badgeBg = sec.isComplementary ? '#fef3c7' : '#e0f2fe';

    return `
      <div class="section-block">
        <div class="section-header">
          <span class="section-badge" style="color:${badgeColor};background:${badgeBg};">
            ${escapeHtml(sec.orderLabel)} · ${escapeHtml(sec.spanishSubtitle)}
          </span>
          <table style="width:100%;border:none;border-collapse:collapse;margin-top:4px;">
            <tr>
              <td style="text-align:left;vertical-align:baseline;padding:0;">
                <h2 class="section-title">${escapeHtml(sec.title)}</h2>
              </td>
              ${
                sec.hebrewTerm
                  ? `<td style="text-align:right;vertical-align:baseline;padding:0;" dir="rtl">
                      <span class="hebrew-term" dir="rtl">${escapeHtml(sec.hebrewTerm)}</span>
                     </td>`
                  : ''
              }
            </tr>
          </table>
        </div>
        <div class="section-content">
          ${paragraphs}
        </div>
        ${
          sec.keyInsight
            ? `<div class="insight-box">
                <strong>Enseñanza Clave:</strong> «${escapeHtml(sec.keyInsight)}»
              </div>`
            : ''
        }
      </div>
    `;
  };

  const sectionsHtml = sections.map(renderSectionHtmlBlock).join('\n');

  const extraPardesHtml =
    extraPardesCards.length > 0
      ? `
      <div class="section-block">
        <h2 class="section-title" style="color:#0369a1;">Tarjetas de los Cuatro Niveles del PARDÉS (Pshat, Rémez, Drash, Sod)</h2>
        ${extraPardesCards.map(renderSectionHtmlBlock).join('\n')}
      </div>`
      : '';

  const validatorAndContextHtml =
    phase1?.liturgicalContext || halakhicVal?.validatorSummary || phase1?.logicGateReason
      ? `
      <div class="section-block" style="background:#f8fafc;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;">
        <div class="meta-kicker" style="margin-bottom:4px;">Contexto Litúrgico y Auditoría Metodológica del Pipeline</div>
        ${
          phase1?.liturgicalContext
            ? `<p class="body-p" style="margin-bottom:6px;"><strong>Contexto Litúrgico y Canónico:</strong> ${escapeHtml(
                phase1.liturgicalContext
              )}</p>`
            : ''
        }
        ${
          halakhicVal?.validatorSummary
            ? `<p class="body-p" style="margin-bottom:6px;"><strong>Validador Halájico:</strong> ${escapeHtml(
                halakhicVal.validatorSummary
              )}</p>`
            : ''
        }
        ${
          phase1?.logicGateReason
            ? `<p class="body-p" style="margin-bottom:0;"><strong>Compuerta Metodológica:</strong> ${escapeHtml(
                phase1.logicGateReason
              )}</p>`
            : ''
        }
      </div>`
      : '';

  const morphologyHtml =
    (phase1?.morphologicalBreakdown && phase1.morphologicalBreakdown.length > 0) ||
    derasha?.morphologicalSynthesis
      ? `
      <div class="section-block">
        <h2 class="section-title">Tarjeta de Raíces Hebreas (Shoresh) y Desglose Morfológico</h2>
        ${
          derasha?.morphologicalSynthesis?.summary
            ? `<p class="body-p"><strong>Síntesis Filológica y Gramatical:</strong> ${escapeHtml(
                derasha.morphologicalSynthesis.summary
              )}</p>`
            : ''
        }
        ${
          derasha?.morphologicalSynthesis?.keyTheologicalInsight
            ? `<div class="insight-box" style="margin-bottom:12px;"><strong>Revelación Morfológica Central:</strong> «${escapeHtml(
                derasha.morphologicalSynthesis.keyTheologicalInsight
              )}»</div>`
            : ''
        }
        ${
          phase1?.morphologicalBreakdown && phase1.morphologicalBreakdown.length > 0
            ? `<table class="data-table">
                <thead>
                  <tr>
                    <th>Término Hebreo</th>
                    <th>Shoresh (Raíz)</th>
                    <th>Significado Raíz</th>
                    <th>Binyán / Tiempo</th>
                    <th>Implicación Exegética</th>
                  </tr>
                </thead>
                <tbody>
                  ${phase1.morphologicalBreakdown
                    .map(
                      (m: MorphologyItem) => `
                    <tr>
                      <td dir="rtl" style="font-family:'Frank Ruhl Libre','Times New Roman',serif;font-size:15pt;font-weight:bold;text-align:right;">${escapeHtml(
                        m.hebrewWord
                      )}</td>
                      <td><strong>${escapeHtml(m.root)}</strong></td>
                      <td>${escapeHtml(m.rootMeaning)}</td>
                      <td>${escapeHtml(m.binyan)} (${escapeHtml(m.tense)})</td>
                      <td>${escapeHtml(m.theologicalImplication)}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
            : ''
        }
      </div>
    `
      : '';

  const theologicalKeysHtml =
    theologicalKeyEntries.length > 0
      ? `
      <div class="section-block">
        <h2 class="section-title">Tarjeta de Las 4 Claves Teológicas y Exegéticas</h2>
        ${theologicalKeyEntries
          .map(
            (entry) => `
          <div class="source-item">
            <div class="source-ref">
              <strong>${escapeHtml(entry.label)} — ${escapeHtml(entry.title)}</strong>
              <span dir="rtl" style="float:right;font-family:'Frank Ruhl Libre',serif;">${escapeHtml(
                entry.hebrew
              )}</span>
            </div>
            ${
              entry.hebrewQuote
                ? `<p class="hebrew-quote" dir="rtl">${escapeHtml(entry.hebrewQuote)}</p>`
                : ''
            }
            <p class="body-p" style="margin-bottom:6px;">${escapeHtml(entry.explanation)}</p>
            ${entry.subDetails
              .map(
                (d) => `<p class="source-trans" style="margin-top:3px;">• ${escapeHtml(d)}</p>`
              )
              .join('')}
          </div>`
          )
          .join('')}
      </div>
    `
      : '';

  const sourcesHtml =
    derasha?.canonicalAnalysis?.synthesis ||
    (derasha?.canonicalAnalysis?.verifiedEchoes &&
      derasha.canonicalAnalysis.verifiedEchoes.length > 0) ||
    enrichedSources.length > 0
      ? `
      <div class="section-block">
        <h2 class="section-title">Tarjeta de Análisis Canónico y Fuentes Verificadas en Sefaria (${
          enrichedSources.length
        })</h2>
        ${
          derasha?.canonicalAnalysis?.synthesis
            ? `<p class="body-p"><strong>Síntesis Intertextual del Canon:</strong> ${escapeHtml(
                derasha.canonicalAnalysis.synthesis
              )}</p>`
            : ''
        }
        ${
          derasha?.canonicalAnalysis?.verifiedEchoes &&
          derasha.canonicalAnalysis.verifiedEchoes.length > 0
            ? `<div class="insight-box" style="margin-bottom:14px;">
                <strong>Ecos Canónicos e Hilos Exegéticos Verificados:</strong>
                ${derasha.canonicalAnalysis.verifiedEchoes
                  .map(
                    (e) =>
                      `<p style="margin:4px 0 0 0;">• <strong>${escapeHtml(
                        e.ref
                      )}:</strong> ${escapeHtml(e.connection)}</p>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${enrichedSources
          .map(
            (src, idx) => `
          <div class="source-item">
            <div class="source-ref">
              <strong>${idx + 1}. ${escapeHtml(src.ref)}</strong> (${escapeHtml(src.category)})
              ${
                src.heRef
                  ? `<span dir="rtl" style="float:right;font-family:'Frank Ruhl Libre',serif;">${escapeHtml(
                      src.heRef
                    )}</span>`
                  : ''
              }
            </div>
            ${
              src.rationale
                ? `<p style="font-size:10pt;color:#0369a1;margin:0 0 6px 0;"><strong>Relevancia Exegética:</strong> ${escapeHtml(
                    src.rationale
                  )}</p>`
                : ''
            }
            ${
              src.hebrewClean
                ? `<p class="hebrew-quote" dir="rtl">${escapeHtml(src.hebrewClean)}</p>`
                : ''
            }
            ${
              src.spanishClean
                ? `<p class="source-trans"><strong>Traducción / Texto en Español:</strong> «${escapeHtml(
                    src.spanishClean
                  )}»</p>`
                : ''
            }
            ${
              src.englishClean
                ? `<p class="source-trans" style="margin-top:4px;color:#475569;"><strong>Texto en Inglés (Sefaria):</strong> «${escapeHtml(
                    src.englishClean
                  )}»</p>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  const externalContrastHtml = hasExternalContrast
    ? `
      <div class="section-block">
        <h2 class="section-title">Tarjeta de Contraste Exegético Formal y Fuentes Comparadas</h2>
        ${
          externalDetection?.thinkerName
            ? `<p class="body-p"><strong>Marco Comparado:</strong> ${escapeHtml(
                externalDetection.thinkerName
              )} (${escapeHtml(externalDetection.specificPhilosophicalConcept || '')})</p>`
            : ''
        }
        ${
          formalContrast?.universalidadVsEspecificidad
            ? `<div class="source-item">
                <div class="source-ref"><strong>${escapeHtml(
                  formalContrast.universalidadVsEspecificidad.title ||
                    'Universalidad vs. Especificidad del Pacto'
                )}</strong></div>
                <p class="source-trans">• <strong>Universalismo Externo:</strong> ${escapeHtml(
                  formalContrast.universalidadVsEspecificidad.externalUniversalism
                )}</p>
                <p class="source-trans">• <strong>Dimensión Universal en la Torá:</strong> ${escapeHtml(
                  formalContrast.universalidadVsEspecificidad.torahUniversalDimension
                )}</p>
                <p class="source-trans">• <strong>Especificidad de la Mitzvá:</strong> ${escapeHtml(
                  formalContrast.universalidadVsEspecificidad.torahCommandmentSpecificity
                )}</p>
                <p class="source-trans">• <strong>Síntesis Exegética:</strong> ${escapeHtml(
                  formalContrast.universalidadVsEspecificidad.exegeticalSynthesis
                )}</p>
              </div>`
            : ''
        }
        ${
          formalContrast?.fuentesInternasVsExternas
            ? `<div class="source-item">
                <div class="source-ref"><strong>${escapeHtml(
                  formalContrast.fuentesInternasVsExternas.title ||
                    'Fuentes Internas vs. Fuentes Externas'
                )}</strong></div>
                <p class="source-trans">• <strong>Fuentes Internas:</strong> ${escapeHtml(
                  formalContrast.fuentesInternasVsExternas.internalTorahSourcesNature
                )}</p>
                <p class="source-trans">• <strong>Fuentes Externas:</strong> ${escapeHtml(
                  formalContrast.fuentesInternasVsExternas.externalSourcesNature
                )}</p>
                <p class="source-trans">• <strong>Regla Hermenéutica:</strong> ${escapeHtml(
                  formalContrast.fuentesInternasVsExternas.hermeneuticalRule
                )}</p>
              </div>`
            : ''
        }
        ${externalSources
          .map(
            (ext) => `
          <div class="source-item">
            <div class="source-ref"><strong>${escapeHtml(ext.author)}</strong> — <em>${escapeHtml(
              ext.workTitle
            )}</em> (${escapeHtml(ext.canonicalLocus)})</div>
            ${
              ext.spanishTranslation || ext.originalQuote
                ? `<p class="source-trans">«${escapeHtml(
                    ext.spanishTranslation || ext.originalQuote
                  )}»</p>`
                : ''
            }
            ${
              ext.torahContrastPoint
                ? `<p class="source-trans" style="margin-top:4px;color:#92400e;"><strong>Contraste con la Torá:</strong> ${escapeHtml(
                    ext.torahContrastPoint
                  )}</p>`
                : ''
            }
          </div>`
          )
          .join('')}
      </div>`
    : '';

  const contemporaryMastersHtml =
    derasha?.contemporaryMasters?.readings &&
    derasha.contemporaryMasters.readings.length > 0
      ? `
      <div class="section-block">
        <h2 class="section-title">Tarjeta de Lecturas de Maestros Contemporáneos de la Torá</h2>
        ${
          derasha.contemporaryMasters.overview
            ? `<p class="body-p"><strong>Eje Articulador Contemporáneo:</strong> ${escapeHtml(
                derasha.contemporaryMasters.overview
              )}</p>`
            : ''
        }
        ${derasha.contemporaryMasters.readings
          .map(
            (r) => `
          <div class="source-item">
            <div class="source-ref">
              <strong>${escapeHtml(r.masterName)}</strong> (${escapeHtml(
              r.masterTitle
            )}) — <em>${escapeHtml(r.cycleOrSeries)}</em>
            </div>
            <p class="body-p" style="margin-bottom:4px;"><strong>${escapeHtml(
              r.readingTitle
            )}</strong></p>
            <p class="body-p" style="margin-bottom:6px;"><strong>Tesis Central:</strong> ${escapeHtml(
              r.coreThesis
            )}</p>
            <p class="body-p" style="margin-bottom:6px;">${escapeHtml(r.detailedExposition)}</p>
            ${
              r.keyQuoteOrConcept
                ? `<div class="insight-box" style="margin-bottom:6px;"><strong>Cita / Concepto Clave:</strong> «${escapeHtml(
                    r.keyQuoteOrConcept
                  )}»</div>`
                : ''
            }
            ${
              r.practicalTakeaway
                ? `<p class="source-trans" style="color:#047857;"><strong>Enseñanza Práctica:</strong> ${escapeHtml(
                    r.practicalTakeaway
                  )}</p>`
                : ''
            }
          </div>`
          )
          .join('')}
      </div>`
      : '';

  const followUpsHtml =
    followUps.length > 0
      ? `
      <div class="section-block">
        <h2 class="section-title">Tarjeta de Diálogo Exegético y Preguntas de Ampliación (${
          followUps.length
        })</h2>
        ${followUps
          .map(
            (fu, idx) => `
          <div class="source-item">
            <p style="font-weight:bold;color:#0369a1;margin:0 0 6px 0;">Pregunta ${
              idx + 1
            }: ${escapeHtml(fu.question)}</p>
            <p class="body-p">${escapeHtml(fu.answer)}</p>
            ${
              fu.relatedSefariaReferences && fu.relatedSefariaReferences.length > 0
                ? `<p class="source-trans" style="color:#0369a1;"><strong>Referencias Citadas:</strong> ${escapeHtml(
                    fu.relatedSefariaReferences
                      .map((r) => `${r.ref} (${r.rationale})`)
                      .join(' · ')
                  )}</p>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  const conclusionHtml = derasha?.practicalConclusion
    ? `
      <div class="conclusion-box">
        <div style="font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:#0369a1;margin-bottom:4px;">
          Conclusión Práctica · Halajá y Musar Cotidiano
        </div>
        <h2 class="section-title" style="margin-top:0;">${escapeHtml(
          derasha.practicalConclusion.title || 'Enseñanza Práctica y Aplicación'
        )}</h2>
        ${
          derasha.practicalConclusion.hashkafa
            ? `<p class="body-p"><strong>Visión (Hashkafá):</strong> ${escapeHtml(
                derasha.practicalConclusion.hashkafa
              )}</p>`
            : ''
        }
        ${
          derasha.practicalConclusion.prayerKavanah
            ? `<p class="body-p"><strong>Kavaná Interior:</strong> ${escapeHtml(
                derasha.practicalConclusion.prayerKavanah
              )}</p>`
            : ''
        }
        ${
          derasha.practicalConclusion.dailyAction
            ? `<p class="body-p" style="margin-bottom:0;"><strong>Acción Práctica Cotidiana:</strong> ${escapeHtml(
                derasha.practicalConclusion.dailyAction
              )}</p>`
            : ''
        }
      </div>
    `
    : '';

  const wordXmlNamespaces = forWord
    ? `xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"`
    : '';

  const wordHeadXml = forWord
    ? `<!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->`
    : '';

  return `<!DOCTYPE html>
<html lang="es" ${wordXmlNamespaces}>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} — Darshán AI</title>
  ${wordHeadXml}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400&family=Frank+Ruhl+Libre:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 16mm 16mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: ${forWord ? '0' : '24px'};
      font-family: 'Cormorant Garamond', 'Georgia', 'Times New Roman', serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.65;
      font-size: 12pt;
    }
    .page-wrap {
      max-width: 780px;
      margin: 0 auto;
    }
    .doc-header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .meta-kicker {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #0369a1;
      margin-bottom: 6px;
    }
    .doc-title {
      font-size: 22pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px 0;
      line-height: 1.2;
    }
    .doc-subtitle {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 9.5pt;
      color: #475569;
      margin: 0;
    }
    .pasuk-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-right: 4px solid #0284c7;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
      text-align: center;
    }
    .pasuk-hebrew {
      font-family: 'Frank Ruhl Libre', 'Times New Roman', serif;
      font-size: 19pt;
      font-weight: 700;
      color: #0f172a;
      direction: rtl;
      margin: 0 0 6px 0;
      line-height: 1.55;
    }
    .pasuk-translit {
      font-size: 10.5pt;
      font-style: italic;
      color: #0369a1;
      margin: 0 0 4px 0;
    }
    .pasuk-spanish {
      font-size: 11.5pt;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }
    .opening-hook {
      font-size: 12.5pt;
      font-style: italic;
      color: #1e293b;
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    .section-block {
      margin-bottom: 22px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    .section-badge {
      display: inline-block;
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .section-title {
      font-size: 15.5pt;
      font-weight: 700;
      color: #0f172a;
      margin: 6px 0 6px 0;
    }
    .hebrew-term {
      font-family: 'Frank Ruhl Libre', 'Times New Roman', serif;
      font-size: 16pt;
      font-weight: 700;
      color: #0369a1;
      direction: rtl;
    }
    .body-p {
      font-size: 12pt;
      line-height: 1.68;
      color: #1e293b;
      margin: 0 0 10px 0;
      text-align: justify;
    }
    .insight-box {
      background: #f8fafc;
      border-left: 3px solid #0284c7;
      padding: 9px 14px;
      margin-top: 10px;
      font-size: 11pt;
      color: #0f172a;
    }
    .conclusion-box {
      background: #f0f9ff;
      border: 1.5px solid #7dd3fc;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 22px 0;
      page-break-inside: avoid;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 10pt;
    }
    .data-table th, .data-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
    }
    .data-table th {
      background: #f1f5f9;
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 8.5pt;
      text-transform: uppercase;
      color: #334155;
    }
    .source-item {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 10px;
      background: #fcfcfd;
    }
    .source-ref {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 9.5pt;
      color: #0369a1;
      margin-bottom: 6px;
    }
    .hebrew-quote {
      font-family: 'Frank Ruhl Libre', 'Times New Roman', serif;
      font-size: 13.5pt;
      direction: rtl;
      text-align: right;
      color: #0f172a;
      margin: 4px 0 6px 0;
      line-height: 1.6;
    }
    .source-trans {
      font-size: 10.5pt;
      color: #334155;
      margin: 0;
    }
    .doc-footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 8.5pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    .editable-banner {
      background: #ecfeff;
      border: 1px solid #67e8f9;
      color: #0e7490;
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 9.5pt;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 18px;
    }
    @media print {
      body { padding: 0; }
      .editable-banner { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page-wrap" ${editableInBrowser ? 'contenteditable="true" spellcheck="true"' : ''}>
    ${
      editableInBrowser
        ? `<div class="editable-banner" contenteditable="false">
            <strong>Modo Documento Abierto Editable:</strong> Puedes hacer clic en cualquier párrafo o título de esta página para editarlo directamente antes de guardarlo o imprimirlo en PDF (Ctrl+P / Cmd+P).
          </div>`
        : ''
    }
    <header class="doc-header">
      <div class="meta-kicker">
        Darshán AI · ${escapeHtml(methodMeta.label)} (${escapeHtml(
    methodMeta.hebrewLabel
  )}) · ${escapeHtml(durationLabel)}
      </div>
      <h1 class="doc-title">${escapeHtml(title)}</h1>
      <p class="doc-subtitle">
        <strong>Tema / Consulta:</strong> ${escapeHtml(query)}${
    complementaryLabels
      ? ` · <strong>Metodologías Complementarias:</strong> ${escapeHtml(complementaryLabels)}`
      : ''
  }${
    audienceTone ? ` · <strong>Audiencia/Tono:</strong> ${escapeHtml(audienceTone)}` : ''
  } · <strong>Fecha:</strong> ${escapeHtml(dateStr)}
      </p>
    </header>

    ${validatorAndContextHtml}

    ${(() => {
      const execSummary = derasha
        ? resolveDerashaExecutiveSummary(derasha, phase1, sources)
        : null;
      if (!execSummary) return '';
      return `
      <div class="section-block" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px 18px;">
        <div class="meta-kicker" style="margin-bottom:4px;">Resumen Ejecutivo de la Drashá</div>
        <p class="body-p" style="font-weight:700;color:#0f172a;margin-bottom:6px;">
          Tesis Central: ${escapeHtml(execSummary.headlineThesis)}
        </p>
        <p class="body-p" style="margin-bottom:8px;">
          ${escapeHtml(execSummary.abstractNarrative)}
        </p>
        ${
          execSummary.keyPillars.length > 0
            ? `<ul style="margin:0 0 8px 18px;padding:0;font-size:11pt;color:#1e293b;">
                ${execSummary.keyPillars
                  .map(
                    (p) =>
                      `<li style="margin-bottom:4px;"><strong>${escapeHtml(p.label)}:</strong> ${escapeHtml(
                        p.takeaway
                      )}</li>`
                  )
                  .join('')}
               </ul>`
            : ''
        }
        <p class="body-p" style="margin-bottom:0;font-size:11pt;color:#0369a1;">
          <strong>Aplicación Práctica:</strong> ${escapeHtml(execSummary.practicalTakeaway)}
        </p>
      </div>`;
    })()}

    ${
      phase1?.primaryHebrew
        ? `<div class="pasuk-banner">
            <p class="pasuk-hebrew" dir="rtl">${escapeHtml(phase1.primaryHebrew)}</p>
            ${
              phase1.transliteration
                ? `<p class="pasuk-translit">${escapeHtml(phase1.transliteration)}</p>`
                : ''
            }
            ${
              phase1.literalSpanishTranslation
                ? `<p class="pasuk-spanish">«${escapeHtml(
                    phase1.literalSpanishTranslation
                  )}»</p>`
                : ''
            }
          </div>`
        : ''
    }

    ${
      derasha?.openingExordium
        ? `<div class="opening-hook">${escapeHtml(derasha.openingExordium)}</div>`
        : ''
    }

    <main>
      ${sectionsHtml}
      ${extraPardesHtml}
      ${conclusionHtml}
      ${morphologyHtml}
      ${theologicalKeysHtml}
      ${sourcesHtml}
      ${externalContrastHtml}
      ${contemporaryMastersHtml}
      ${followUpsHtml}
    </main>

    <footer class="doc-footer">
      <span>Darshán AI · Estudio Exegético y Homilético Completo (Todas las Tarjetas y Desgloses)</span>
      <span>Fuentes canónicas verificadas con Sefaria · ${escapeHtml(dateStr)}</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Generates an editable Microsoft Word / Google Docs / LibreOffice (.doc) Blob
 */
export function generateWordDocBlob(data: LessonExportData): Blob {
  const html = buildLessonPrintableHtml(data, { forWordDoc: true });
  return new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
}

/**
 * Generates an open editable HTML document Blob.
 */
export function generateEditableHtmlBlob(data: LessonExportData): Blob {
  const html = buildLessonPrintableHtml(data, { editableInBrowser: true });
  return new Blob([html], {
    type: 'text/html;charset=utf-8',
  });
}

/**
 * Prints the lesson inside a hidden iframe (iframe-compatible, no window.open).
 */
export function printLessonViaHiddenIframe(data: LessonExportData): void {
  const htmlContent = buildLessonPrintableHtml(data);
  const existingIframe = document.getElementById('darshan-print-iframe');
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'darshan-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Error invoking iframe print:', err);
      }
    }, 450);
  }
}

/**
 * Packs an array of JPEG data URLs (one per A4 page) into a valid multi-page
 * PDF 1.4 binary Blob (`application/pdf`).
 */
function buildPdfBlobFromJpegPages(
  pages: { jpegBytes: Uint8Array; widthPx: number; heightPx: number }[]
): Blob {
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr);
    byteLength += arr.byteLength;
  };

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    byteLength += arr.byteLength;
  };

  const startObj = (objNum: number) => {
    offsets[objNum] = byteLength;
    pushStr(`${objNum} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(3 + i * 3);
  }

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${
      pages.length
    } >>`
  );
  endObj();

  pages.forEach((p, i) => {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;

    const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(
      2
    )} 0 0 cm\n/Im0 Do\nQ`;
    const contentBytes = encoder.encode(contentStream);

    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(
        2
      )} ${pageHeightPt.toFixed(
        2
      )}] /Resources << /XObject << /Im0 ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr(`\nendstream`);
    endObj();

    startObj(imageObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  });

  const totalObjs = 2 + pages.length * 3;
  const xrefOffset = byteLength;

  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const combined = new Uint8Array(byteLength);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.byteLength;
  }

  return new Blob([combined.buffer], { type: 'application/pdf' });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Renders the complete lesson onto multi-page high-DPI A4 canvases (with full RTL Hebrew
 * & Spanish typography) and returns a real binary `.pdf` Blob (`application/pdf`) ready
 * for direct download or native sharing (`navigator.share({ files })`).
 * Includes ALL cards, additional source texts, analyses, and breakdowns.
 */
export async function generateLessonPdfBlob(data: LessonExportData): Promise<Blob> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font wait failure
    }
  }

  const { query, phase1, sources, derasha, followUps = [], scope = 'full_derasha' } = data;
  const title = derasha?.derashaTitle || phase1?.title || query || 'Lección de Torá';
  const methodMeta = getMethodologyMeta(
    derasha?.metodologia || phase1?.detectedMetodologia || 'PARDES'
  );
  const durationLabel = getDurationBadgeLabel(derasha?.duracion || phase1?.duracion);
  const audienceTone = derasha?.audienciaOTono || '';
  const complementaryIds =
    derasha?.metodologiasComplementarias || phase1?.metodologiasComplementarias || [];
  const complementaryLabels = complementaryIds
    .map((m) => getMethodologyMeta(m).label)
    .join(', ');

  const sections = resolveLessonSectionsForExport(derasha, scope);
  const extraPardesCards = resolveExtraPardesCardsIfSeparate(derasha, sections);
  const enrichedSources = resolveEnrichedSourcesForExport(sources, derasha, phase1);
  const theologicalKeyEntries = normalizeTheologicalKeysForExport(
    derasha?.theologicalKeys || phase1?.theologicalKeys
  );
  const halakhicVal = derasha?.halakhicValidation || phase1?.halakhicValidation;
  const suppressExternal = Boolean(halakhicVal?.externalPhilosophyInjectionDisabled);
  const externalSources = !suppressExternal
    ? derasha?.externalSources?.length
      ? derasha.externalSources
      : phase1?.externalSources || []
    : [];
  const formalContrast = !suppressExternal
    ? derasha?.formalContrast || phase1?.formalContrast
    : undefined;
  const externalDetection = !suppressExternal
    ? derasha?.externalThinkerDetection || phase1?.externalThinkerDetection
    : undefined;
  const hasExternalContrast =
    !suppressExternal &&
    (externalDetection?.detected ||
      formalContrast?.isComparativeStudy ||
      externalSources.length > 0);

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const W = 1240;
  const H = 1754;
  const marginX = 86;
  const topMargin = 88;
  const bottomMargin = 100;
  const contentW = W - marginX * 2;

  const canvases: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D;
  let y = topMargin;

  const createNewPage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, W, H);
    context.fillStyle = '#0284c7';
    context.fillRect(marginX, 42, contentW, 4);
    canvases.push(canvas);
    ctx = context;
    y = topMargin;
  };

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > H - bottomMargin) {
      createNewPage();
    }
  };

  const wrapLines = (text: string, font: string, maxWidth: number): string[] => {
    ctx.font = font;
    const paragraphs = (text || '').split(/\n+/);
    const lines: string[] = [];
    for (const para of paragraphs) {
      const words = para.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const candidate = `${current} ${words[i]}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = words[i];
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  };

  const drawTextBlock = (
    text: string,
    opts: {
      font: string;
      color: string;
      lineHeight: number;
      x?: number;
      maxWidth?: number;
      align?: CanvasTextAlign;
      direction?: CanvasDirection;
      leftBarColor?: string;
    }
  ) => {
    const maxW = opts.maxWidth ?? contentW;
    const lines = wrapLines(text, opts.font, maxW);
    const drawX = opts.x ?? marginX;
    for (const line of lines) {
      ensureSpace(opts.lineHeight + 4);
      if (opts.leftBarColor) {
        ctx.fillStyle = opts.leftBarColor;
        ctx.fillRect(marginX, y - opts.lineHeight + 8, 4, opts.lineHeight);
      }
      ctx.save();
      ctx.font = opts.font;
      ctx.fillStyle = opts.color;
      ctx.textAlign = opts.align || 'left';
      ctx.direction = opts.direction || 'ltr';
      ctx.fillText(line, drawX, y);
      ctx.restore();
      y += opts.lineHeight;
    }
  };

  const drawMajorCardBanner = (
    kicker: string,
    cardTitle: string,
    accentHex = '#0369a1',
    bgHex = '#f0f9ff'
  ) => {
    ensureSpace(95);
    y += 8;
    ctx.fillStyle = bgHex;
    ctx.fillRect(marginX, y - 18, contentW, 60);
    ctx.fillStyle = accentHex;
    ctx.fillRect(marginX, y - 18, 7, 60);

    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.font = '700 15px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = accentHex;
    ctx.fillText(kicker.toUpperCase(), marginX + 18, y + 4);

    ctx.font = '700 25px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(cardTitle, marginX + 18, y + 31);

    y += 62;
  };

  createNewPage();

  // 1. Header Kicker
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = '700 17px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillStyle = '#0369a1';
  ctx.fillText(
    `DARSHÁN AI · ${methodMeta.label.toUpperCase()} (${methodMeta.hebrewLabel}) · ${durationLabel.toUpperCase()}`,
    marginX,
    y
  );
  y += 38;

  // 2. Main Title
  drawTextBlock(title, {
    font: '700 40px "Cormorant Garamond", Georgia, serif',
    color: '#0f172a',
    lineHeight: 46,
  });

  // Subtitle / Query / Complementary / Audience
  y += 4;
  const subParts = [`Consulta: ${query}`, `Fecha: ${dateStr}`];
  if (complementaryLabels) {
    subParts.push(`Metodologías Complementarias: ${complementaryLabels}`);
  }
  if (audienceTone) {
    subParts.push(`Audiencia / Tono: ${audienceTone}`);
  }
  drawTextBlock(subParts.join(' · '), {
    font: '500 17px "Plus Jakarta Sans", Arial, sans-serif',
    color: '#475569',
    lineHeight: 25,
  });

  y += 10;
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(marginX, y, contentW, 2);
  y += 24;

  // 2B. Contexto Litúrgico y Validador Halájico del Pipeline
  if (phase1?.liturgicalContext || halakhicVal?.validatorSummary || phase1?.logicGateReason) {
    ensureSpace(80);
    ctx.font = '700 15px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = '#0369a1';
    ctx.fillText(
      'CONTEXTO LITÚRGICO-CANÓNICO Y AUDITORÍA METODOLÓGICA DEL PIPELINE',
      marginX,
      y
    );
    y += 24;

    if (phase1?.liturgicalContext) {
      drawTextBlock(`Contexto Litúrgico y Canónico: ${phase1.liturgicalContext}`, {
        font: '400 20px "Cormorant Garamond", Georgia, serif',
        color: '#1e293b',
        lineHeight: 27,
        x: marginX + 12,
        maxWidth: contentW - 16,
        leftBarColor: '#0284c7',
      });
      y += 4;
    }

    if (halakhicVal?.validatorSummary) {
      drawTextBlock(`Validador Halájico: ${halakhicVal.validatorSummary}`, {
        font: '700 19px "Cormorant Garamond", Georgia, serif',
        color: '#0c4a6e',
        lineHeight: 26,
        x: marginX + 12,
        maxWidth: contentW - 16,
        leftBarColor: '#0369a1',
      });
      y += 4;
    }

    if (phase1?.logicGateReason) {
      drawTextBlock(`Compuerta Metodológica: ${phase1.logicGateReason}`, {
        font: 'italic 19px "Cormorant Garamond", Georgia, serif',
        color: '#334155',
        lineHeight: 26,
        x: marginX + 12,
        maxWidth: contentW - 16,
        leftBarColor: '#64748b',
      });
    }
    y += 14;
  }

  // 3. Primary Hebrew Pasuk Box
  if (phase1?.primaryHebrew) {
    const hebFont = '700 34px "Frank Ruhl Libre", "Times New Roman", serif';
    const hebLines = wrapLines(phase1.primaryHebrew, hebFont, contentW - 64);
    const transFont = 'italic 20px "Cormorant Garamond", Georgia, serif';
    const transLines = phase1.transliteration
      ? wrapLines(phase1.transliteration, transFont, contentW - 64)
      : [];
    const spanFont = '600 22px "Cormorant Garamond", Georgia, serif';
    const spanLines = phase1.literalSpanishTranslation
      ? wrapLines(`«${phase1.literalSpanishTranslation}»`, spanFont, contentW - 64)
      : [];

    const boxH =
      36 +
      hebLines.length * 44 +
      (transLines.length ? transLines.length * 28 + 8 : 0) +
      (spanLines.length ? spanLines.length * 30 + 10 : 0);

    ensureSpace(boxH + 24);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(marginX, y, contentW, boxH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(marginX, y, contentW, boxH);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(marginX + contentW - 6, y, 6, boxH);

    let boxY = y + 38;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.font = hebFont;
    ctx.fillStyle = '#0f172a';
    hebLines.forEach((l) => {
      ctx.fillText(l, marginX + contentW / 2, boxY);
      boxY += 44;
    });

    ctx.direction = 'ltr';
    if (transLines.length > 0) {
      boxY += 4;
      ctx.font = transFont;
      ctx.fillStyle = '#0369a1';
      transLines.forEach((l) => {
        ctx.fillText(l, marginX + contentW / 2, boxY);
        boxY += 28;
      });
    }
    if (spanLines.length > 0) {
      boxY += 6;
      ctx.font = spanFont;
      ctx.fillStyle = '#1e293b';
      spanLines.forEach((l) => {
        ctx.fillText(l, marginX + contentW / 2, boxY);
        boxY += 30;
      });
    }
    ctx.textAlign = 'left';
    y += boxH + 26;
  }

  // 3B. Executive Summary (Resumen Ejecutivo de la Drashá)
  const pdfExecutiveSummary = derasha
    ? resolveDerashaExecutiveSummary(derasha, phase1, sources)
    : null;
  if (pdfExecutiveSummary) {
    drawMajorCardBanner(
      'Visión Panorámica · Lectura Rápida',
      'Resumen Ejecutivo de la Drashá',
      '#0369a1',
      '#f0f9ff'
    );
    drawTextBlock(`Tesis Central: ${pdfExecutiveSummary.headlineThesis}`, {
      font: '700 22px "Cormorant Garamond", Georgia, serif',
      color: '#0f172a',
      lineHeight: 30,
    });
    y += 6;
    drawTextBlock(pdfExecutiveSummary.abstractNarrative, {
      font: '400 21px "Cormorant Garamond", Georgia, serif',
      color: '#1e293b',
      lineHeight: 29,
    });
    y += 8;
    pdfExecutiveSummary.keyPillars.forEach((p, idx) => {
      drawTextBlock(`${idx + 1}. ${p.label}: ${p.takeaway}`, {
        font: '400 20px "Cormorant Garamond", Georgia, serif',
        color: '#1e293b',
        lineHeight: 27,
        x: marginX + 12,
        maxWidth: contentW - 18,
      });
      y += 4;
    });
    drawTextBlock(`Aplicación Práctica: ${pdfExecutiveSummary.practicalTakeaway}`, {
      font: '700 20px "Cormorant Garamond", Georgia, serif',
      color: '#0369a1',
      lineHeight: 28,
    });
    y += 18;
  }

  // 4. Opening Exordium
  if (derasha?.openingExordium) {
    ensureSpace(85);
    ctx.font = '700 16px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = '#0369a1';
    ctx.fillText('EXORDIO Y PLANTEAMIENTO CENTRAL DE LA DRASHÁ', marginX, y);
    y += 28;

    drawTextBlock(derasha.openingExordium, {
      font: 'italic 23px "Cormorant Garamond", Georgia, serif',
      color: '#1e293b',
      lineHeight: 32,
      x: marginX + 18,
      maxWidth: contentW - 32,
      leftBarColor: '#0284c7',
    });
    y += 18;
  }

  // 5. Helper to render a Lesson Card (Primary, Complementary, or PARDES)
  const renderSectionCardOnCanvas = (sec: NormalizedExportSection) => {
    ensureSpace(120);
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.font = '700 15px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = sec.isComplementary ? '#b45309' : '#0369a1';
    ctx.fillText(
      `${sec.orderLabel} · ${sec.spanishSubtitle.toUpperCase()}`,
      marginX,
      y
    );

    if (sec.hebrewTerm) {
      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = '700 28px "Frank Ruhl Libre", "Times New Roman", serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText(sec.hebrewTerm, marginX + contentW, y + 6);
      ctx.restore();
    }

    y += 32;
    drawTextBlock(sec.title, {
      font: '700 29px "Cormorant Garamond", Georgia, serif',
      color: '#0f172a',
      lineHeight: 36,
      maxWidth: contentW - 120,
    });

    const bodyFont = '400 22px "Cormorant Garamond", Georgia, serif';
    const paragraphs = (sec.content || '').split(/\n\n+/).filter(Boolean);
    for (const para of paragraphs) {
      drawTextBlock(para, {
        font: bodyFont,
        color: '#1e293b',
        lineHeight: 31,
      });
      y += 10;
    }

    if (sec.keyInsight) {
      const insFont = '700 20px "Cormorant Garamond", Georgia, serif';
      const insLines = wrapLines(`Enseñanza Clave: «${sec.keyInsight}»`, insFont, contentW - 36);
      const boxH = insLines.length * 28 + 22;
      ensureSpace(boxH + 16);
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(marginX, y - 6, contentW, boxH);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(marginX, y - 6, 4, boxH);
      let iy = y + 18;
      ctx.font = insFont;
      ctx.fillStyle = '#0f172a';
      insLines.forEach((l) => {
        ctx.fillText(l, marginX + 18, iy);
        iy += 28;
      });
      y += boxH + 16;
    }

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(marginX, y, contentW, 1.5);
    y += 24;
  };

  for (const sec of sections) {
    renderSectionCardOnCanvas(sec);
  }

  // 5B. Extra PARDES Cards if distinct from primary methodology sections
  if (extraPardesCards.length > 0) {
    drawMajorCardBanner(
      '4 Niveles Exegéticos Adicionales',
      'Tarjetas PARDÉS (Pshat, Rémez, Drash, Sod)',
      '#0284c7',
      '#f0f9ff'
    );
    for (const sec of extraPardesCards) {
      renderSectionCardOnCanvas(sec);
    }
  }

  // 6. Practical Conclusion Card
  if (derasha?.practicalConclusion) {
    const pc = derasha.practicalConclusion;
    drawMajorCardBanner(
      'Conclusión Práctica · Halajá y Musar Cotidiano',
      pc.title || 'Enseñanza Práctica y Aplicación',
      '#0369a1',
      '#e0f2fe'
    );

    const items = [
      pc.hashkafa ? `1. Visión (Hashkafá): ${pc.hashkafa}` : '',
      pc.prayerKavanah ? `2. Kavaná Interior: ${pc.prayerKavanah}` : '',
      pc.dailyAction ? `3. Acción Práctica Cotidiana (Halajá / Musar): ${pc.dailyAction}` : '',
    ].filter(Boolean);

    items.forEach((item) => {
      drawTextBlock(item, {
        font: '400 21px "Cormorant Garamond", Georgia, serif',
        color: '#1e293b',
        lineHeight: 29,
        x: marginX + 10,
        maxWidth: contentW - 20,
      });
      y += 8;
    });
    y += 14;
  }

  // 7. Tarjeta de Desglose Morfológico y Raíces Hebreas (Shoresh)
  if (
    (phase1?.morphologicalBreakdown && phase1.morphologicalBreakdown.length > 0) ||
    derasha?.morphologicalSynthesis
  ) {
    drawMajorCardBanner(
      'Tarjeta de Análisis Filológico y Gramatical',
      'Desglose Morfológico y Raíces Hebreas (Shoresh)',
      '#4f46e5',
      '#eef2ff'
    );

    if (derasha?.morphologicalSynthesis?.summary) {
      drawTextBlock(
        `Síntesis Filológica y Gramatical: ${derasha.morphologicalSynthesis.summary}`,
        {
          font: '400 21px "Cormorant Garamond", Georgia, serif',
          color: '#1e293b',
          lineHeight: 29,
        }
      );
      y += 8;
    }

    if (derasha?.morphologicalSynthesis?.keyTheologicalInsight) {
      drawTextBlock(
        `Revelación Morfológica Central: «${derasha.morphologicalSynthesis.keyTheologicalInsight}»`,
        {
          font: '700 20px "Cormorant Garamond", Georgia, serif',
          color: '#3730a3',
          lineHeight: 28,
          x: marginX + 14,
          maxWidth: contentW - 20,
          leftBarColor: '#4f46e5',
        }
      );
      y += 12;
    }

    for (const m of phase1?.morphologicalBreakdown || []) {
      ensureSpace(90);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(marginX, y - 20, contentW, 30);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '700 18px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#312e81';
      ctx.fillText(
        `Raíz (Shoresh): ${m.root} — ${m.rootMeaning} · [${m.binyan} · ${m.tense}]`,
        marginX + 10,
        y
      );

      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = '700 24px "Frank Ruhl Libre", "Times New Roman", serif';
      ctx.fillStyle = '#4338ca';
      ctx.fillText(m.hebrewWord, marginX + contentW - 10, y + 2);
      ctx.restore();

      y += 28;
      drawTextBlock(`Implicación Exegética: ${m.theologicalImplication}`, {
        font: '400 20px "Cormorant Garamond", Georgia, serif',
        color: '#334155',
        lineHeight: 28,
        x: marginX + 12,
        maxWidth: contentW - 20,
      });
      y += 10;
    }
  }

  // 8. Tarjeta de Las 4 Claves Teológicas y Exegéticas
  if (theologicalKeyEntries.length > 0) {
    drawMajorCardBanner(
      'Tarjeta de Claves Hermenéuticas',
      'Las 4 Claves Teológicas y Exegéticas del Estudio',
      '#0f766e',
      '#f0fdfa'
    );

    for (const k of theologicalKeyEntries) {
      ensureSpace(95);
      ctx.fillStyle = '#ccfbf1';
      ctx.fillRect(marginX, y - 20, contentW, 30);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '700 17px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#115e59';
      ctx.fillText(`${k.label} — ${k.title}`, marginX + 10, y);

      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = '700 21px "Frank Ruhl Libre", "Times New Roman", serif';
      ctx.fillStyle = '#0f766e';
      ctx.fillText(k.hebrew, marginX + contentW - 10, y);
      ctx.restore();

      y += 28;
      if (k.hebrewQuote) {
        drawTextBlock(k.hebrewQuote, {
          font: '700 22px "Frank Ruhl Libre", "Times New Roman", serif',
          color: '#0f172a',
          lineHeight: 30,
          x: marginX + contentW - 12,
          maxWidth: contentW - 24,
          align: 'right',
          direction: 'rtl',
        });
        y += 4;
      }

      drawTextBlock(k.explanation, {
        font: '400 20px "Cormorant Garamond", Georgia, serif',
        color: '#1e293b',
        lineHeight: 28,
        x: marginX + 12,
        maxWidth: contentW - 20,
      });

      for (const detail of k.subDetails) {
        drawTextBlock(`• ${detail}`, {
          font: '400 19px "Cormorant Garamond", Georgia, serif',
          color: '#0f766e',
          lineHeight: 26,
          x: marginX + 18,
          maxWidth: contentW - 26,
        });
      }
      y += 10;
    }
  }

  // 9. Tarjeta de Análisis Canónico y TODAS las Fuentes Verificadas en Sefaria (sin truncar)
  if (
    derasha?.canonicalAnalysis?.synthesis ||
    (derasha?.canonicalAnalysis?.verifiedEchoes &&
      derasha.canonicalAnalysis.verifiedEchoes.length > 0) ||
    enrichedSources.length > 0
  ) {
    drawMajorCardBanner(
      `Tarjeta de Fuentes Canónicas Verificadas (${enrichedSources.length})`,
      'Análisis Intertextual y Textos Completos de Sefaria.org',
      '#0284c7',
      '#f0f9ff'
    );

    if (derasha?.canonicalAnalysis?.synthesis) {
      drawTextBlock(
        `Síntesis Intertextual del Canon: ${derasha.canonicalAnalysis.synthesis}`,
        {
          font: '400 21px "Cormorant Garamond", Georgia, serif',
          color: '#1e293b',
          lineHeight: 29,
        }
      );
      y += 10;
    }

    if (
      derasha?.canonicalAnalysis?.verifiedEchoes &&
      derasha.canonicalAnalysis.verifiedEchoes.length > 0
    ) {
      ensureSpace(60);
      ctx.font = '700 16px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText('ECOS CANÓNICOS E HILOS EXEGÉTICOS VERIFICADOS:', marginX, y);
      y += 24;

      for (const echo of derasha.canonicalAnalysis.verifiedEchoes) {
        drawTextBlock(`• ${echo.ref}: ${echo.connection}`, {
          font: '400 20px "Cormorant Garamond", Georgia, serif',
          color: '#0c4a6e',
          lineHeight: 27,
          x: marginX + 12,
          maxWidth: contentW - 20,
        });
        y += 4;
      }
      y += 10;
    }

    for (let i = 0; i < enrichedSources.length; i++) {
      const src = enrichedSources[i];
      ensureSpace(100);

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(marginX, y - 20, contentW, 30);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '700 17px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText(
        `${i + 1}. ${src.ref} (${src.category})`,
        marginX + 10,
        y
      );

      if (src.heRef) {
        ctx.save();
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.font = '700 21px "Frank Ruhl Libre", "Times New Roman", serif';
        ctx.fillStyle = '#0c4a6e';
        ctx.fillText(src.heRef, marginX + contentW - 10, y);
        ctx.restore();
      }
      y += 28;

      if (src.rationale) {
        drawTextBlock(`Relevancia Exegética: ${src.rationale}`, {
          font: 'italic 19px "Cormorant Garamond", Georgia, serif',
          color: '#0369a1',
          lineHeight: 26,
          x: marginX + 12,
          maxWidth: contentW - 20,
        });
        y += 4;
      }

      if (src.hebrewClean) {
        drawTextBlock(src.hebrewClean, {
          font: '700 23px "Frank Ruhl Libre", "Times New Roman", serif',
          color: '#0f172a',
          lineHeight: 32,
          x: marginX + contentW - 12,
          maxWidth: contentW - 28,
          align: 'right',
          direction: 'rtl',
        });
        y += 4;
      }

      if (src.spanishClean) {
        drawTextBlock(`Traducción / Texto en Español: «${src.spanishClean}»`, {
          font: '400 20px "Cormorant Garamond", Georgia, serif',
          color: '#1e293b',
          lineHeight: 28,
          x: marginX + 12,
          maxWidth: contentW - 20,
        });
        y += 4;
      }

      if (src.englishClean) {
        drawTextBlock(`Texto en Inglés (Sefaria): «${src.englishClean}»`, {
          font: '400 18px "Cormorant Garamond", Georgia, serif',
          color: '#475569',
          lineHeight: 25,
          x: marginX + 12,
          maxWidth: contentW - 20,
        });
      }

      y += 12;
    }
  }

  // 10. Tarjeta de Contraste Exegético Formal y Fuentes Comparadas (si aplica)
  if (hasExternalContrast) {
    drawMajorCardBanner(
      'Tarjeta de Contraste Exegético Formal',
      'Universalidad vs. Especificidad del Pacto y Fuentes Comparadas',
      '#b45309',
      '#fffbeb'
    );

    if (externalDetection?.thinkerName) {
      drawTextBlock(
        `Pensador / Marco Comparado: ${externalDetection.thinkerName} (${
          externalDetection.specificPhilosophicalConcept || ''
        })`,
        {
          font: '700 20px "Cormorant Garamond", Georgia, serif',
          color: '#92400e',
          lineHeight: 28,
        }
      );
      y += 6;
    }

    if (formalContrast?.universalidadVsEspecificidad) {
      const u = formalContrast.universalidadVsEspecificidad;
      drawTextBlock(
        `${u.title || 'Universalidad vs. Especificidad'}: ${u.exegeticalSynthesis} (Universalidad Torá: ${u.torahUniversalDimension} · Especificidad Mitzvá: ${u.torahCommandmentSpecificity})`,
        {
          font: '400 20px "Cormorant Garamond", Georgia, serif',
          color: '#1e293b',
          lineHeight: 28,
        }
      );
      y += 6;
    }

    if (formalContrast?.fuentesInternasVsExternas) {
      const f = formalContrast.fuentesInternasVsExternas;
      drawTextBlock(
        `${f.title || 'Fuentes Internas vs. Externas'}: ${f.hermeneuticalRule}`,
        {
          font: '400 20px "Cormorant Garamond", Georgia, serif',
          color: '#1e293b',
          lineHeight: 28,
        }
      );
      y += 10;
    }

    for (const ext of externalSources) {
      ensureSpace(85);
      drawTextBlock(
        `• ${ext.author} — ${ext.workTitle} (${ext.canonicalLocus})`,
        {
          font: '700 20px "Cormorant Garamond", Georgia, serif',
          color: '#92400e',
          lineHeight: 28,
          x: marginX + 8,
          maxWidth: contentW - 12,
        }
      );

      if (ext.spanishTranslation || ext.originalQuote) {
        drawTextBlock(
          `Cita: «${ext.spanishTranslation || ext.originalQuote}»`,
          {
            font: 'italic 19px "Cormorant Garamond", Georgia, serif',
            color: '#334155',
            lineHeight: 27,
            x: marginX + 16,
            maxWidth: contentW - 24,
          }
        );
      }

      if (ext.torahContrastPoint) {
        drawTextBlock(`Contraste con la Torá: ${ext.torahContrastPoint}`, {
          font: '400 19px "Cormorant Garamond", Georgia, serif',
          color: '#78350f',
          lineHeight: 27,
          x: marginX + 16,
          maxWidth: contentW - 24,
        });
      }
      y += 10;
    }
  }

  // 11. Tarjeta de Lecturas de Maestros Contemporáneos de la Torá
  if (
    derasha?.contemporaryMasters?.readings &&
    derasha.contemporaryMasters.readings.length > 0
  ) {
    drawMajorCardBanner(
      'Tarjeta de Pensamiento Judío Moderno y Contemporáneo',
      'Lecturas de Maestros Contemporáneos de la Torá',
      '#6d28d9',
      '#f5f3ff'
    );

    if (derasha.contemporaryMasters.overview) {
      drawTextBlock(
        `Eje Articulador: ${derasha.contemporaryMasters.overview}`,
        {
          font: 'italic 21px "Cormorant Garamond", Georgia, serif',
          color: '#4c1d95',
          lineHeight: 29,
        }
      );
      y += 10;
    }

    for (const r of derasha.contemporaryMasters.readings) {
      ensureSpace(110);
      ctx.fillStyle = '#ede9fe';
      ctx.fillRect(marginX, y - 20, contentW, 30);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '700 17px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillStyle = '#4c1d95';
      ctx.fillText(
        `${r.masterName} (${r.masterTitle}) — ${r.cycleOrSeries}`,
        marginX + 10,
        y
      );
      y += 28;

      drawTextBlock(`${r.readingTitle} — Tesis Central: ${r.coreThesis}`, {
        font: '700 20px "Cormorant Garamond", Georgia, serif',
        color: '#1e1b4b',
        lineHeight: 28,
        x: marginX + 12,
        maxWidth: contentW - 20,
      });
      y += 4;

      drawTextBlock(r.detailedExposition, {
        font: '400 20px "Cormorant Garamond", Georgia, serif',
        color: '#1e293b',
        lineHeight: 28,
        x: marginX + 12,
        maxWidth: contentW - 20,
      });

      if (r.keyQuoteOrConcept) {
        y += 4;
        drawTextBlock(`Cita / Concepto Clave: «${r.keyQuoteOrConcept}»`, {
          font: 'italic 19px "Cormorant Garamond", Georgia, serif',
          color: '#5b21b6',
          lineHeight: 27,
          x: marginX + 18,
          maxWidth: contentW - 28,
          leftBarColor: '#7c3aed',
        });
      }

      if (r.practicalTakeaway) {
        y += 4;
        drawTextBlock(`Enseñanza Práctica: ${r.practicalTakeaway}`, {
          font: '400 19px "Cormorant Garamond", Georgia, serif',
          color: '#065f46',
          lineHeight: 27,
          x: marginX + 12,
          maxWidth: contentW - 20,
        });
      }

      y += 14;
    }
  }

  // 12. Tarjeta de Diálogo Exegético y Preguntas de Ampliación (Follow-Ups)
  if (followUps.length > 0) {
    drawMajorCardBanner(
      `Tarjeta de Diálogo Exegético (${followUps.length})`,
      'Preguntas de Ampliación y Respuestas del Estudio',
      '#0369a1',
      '#f0f9ff'
    );

    for (let idx = 0; idx < followUps.length; idx++) {
      const f = followUps[idx];
      ensureSpace(90);
      drawTextBlock(`P${idx + 1}: ${f.question}`, {
        font: '700 21px "Cormorant Garamond", Georgia, serif',
        color: '#0c4a6e',
        lineHeight: 29,
        x: marginX + 8,
        maxWidth: contentW - 12,
      });
      y += 4;

      drawTextBlock(f.answer, {
        font: '400 20px "Cormorant Garamond", Georgia, serif',
        color: '#1e293b',
        lineHeight: 28,
        x: marginX + 14,
        maxWidth: contentW - 20,
      });

      if (f.relatedSefariaReferences && f.relatedSefariaReferences.length > 0) {
        y += 4;
        drawTextBlock(
          `Referencias Citadas: ${f.relatedSefariaReferences
            .map((r) => `${r.ref} (${r.rationale})`)
            .join(' · ')}`,
          {
            font: 'italic 18px "Cormorant Garamond", Georgia, serif',
            color: '#0369a1',
            lineHeight: 25,
            x: marginX + 14,
            maxWidth: contentW - 20,
          }
        );
      }
      y += 14;
    }
  }

  // Stamp page numbers and footers on every page
  const totalPages = canvases.length;
  canvases.forEach((canvas, idx) => {
    const c = canvas.getContext('2d')!;
    c.direction = 'ltr';
    c.fillStyle = '#cbd5e1';
    c.fillRect(marginX, H - 72, contentW, 1);
    c.font = '500 15px "Plus Jakarta Sans", Arial, sans-serif';
    c.fillStyle = '#64748b';
    c.textAlign = 'left';
    c.fillText(
      `Darshán AI · ${methodMeta.shortLabel} · Todas las Tarjetas, Desgloses y Fuentes Sefaria`,
      marginX,
      H - 44
    );
    c.textAlign = 'right';
    c.fillText(`Página ${idx + 1} de ${totalPages}`, marginX + contentW, H - 44);
  });

  const jpegPages = canvases.map((canvas) => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return {
      jpegBytes: dataUrlToUint8Array(dataUrl),
      widthPx: W,
      heightPx: H,
    };
  });

  return buildPdfBlobFromJpegPages(jpegPages);
}

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

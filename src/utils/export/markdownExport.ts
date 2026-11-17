import {
  LessonExportData,
  type MorphologyItem,
  getMethodologyMeta,
  getDurationBadgeLabel,
  resolveLessonSectionsForExport,
  resolveEnrichedSourcesForExport,
  resolveExtraPardesCardsIfSeparate,
  normalizeTheologicalKeysForExport,
  resolveDerashaExecutiveSummary,
} from './shared';

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

  const halakhicConsultation =
    derasha?.halakhicConsultation || phase1?.halakhicConsultation;
  if (
    halakhicConsultation?.active &&
    halakhicConsultation.directQuotes.length > 0
  ) {
    lines.push(
      `## 8. Módulo Halájico · Citas Breves y Directas del Shulján Aruj (${halakhicConsultation.consultedBranchLabels.join(
        ' · '
      )})`
    );
    lines.push('');
    lines.push(
      '> **Política Exegética:** Filosofía externa y comparativa omitida estrictamente en temas de Halajá.'
    );
    lines.push('');
    halakhicConsultation.directQuotes.forEach((q, idx) => {
      lines.push(
        `### ${idx + 1}. ${q.simanSeifLabel} — ${q.topicLabel} (${q.focusBranchLabel})`
      );
      lines.push(`* **Hebreo:** ${q.briefHebrewQuote}`);
      lines.push(`* **Traducción Directa:** «${q.briefSpanishQuote}»`);
      if (q.mejaberAndRamaNote) {
        lines.push(`* **Mejaber / Ramá:** ${q.mejaberAndRamaNote}`);
      }
      lines.push(`* **Sefaria:** ${q.sefariaUrl}`);
      lines.push('');
    });

    if (
      halakhicConsultation.mishnatHaDorotQuotes &&
      halakhicConsultation.mishnatHaDorotQuotes.length > 0
    ) {
      lines.push('### Mishnat HaDorot · Dictamen Halájico por Generaciones');
      lines.push('');
      halakhicConsultation.mishnatHaDorotQuotes.forEach((mq, idx) => {
        lines.push(
          `#### ${idx + 1}. [${mq.generationLabel} · ${mq.periodLabel}] ${mq.authorityName} — sobre ${mq.sourceSimanSeifLabel} (${mq.ref})`
        );
        lines.push(`* **Hebreo:** ${mq.hebrewText}`);
        lines.push(`* **Traducción:** ${mq.spanishTranslation}`);
        if (mq.rulingEvolutionNote) {
          lines.push(`* **Dictamen Generacional:** ${mq.rulingEvolutionNote}`);
        }
        lines.push(`* **Sefaria:** ${mq.sefariaUrl}`);
        lines.push('');
      });
    }
  }

  const suppressExternal = Boolean(
    halakhicVal?.externalPhilosophyInjectionDisabled ||
      halakhicConsultation?.externalPhilosophyOmitted
  );
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

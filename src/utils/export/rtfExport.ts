import {
  LessonExportData,
  type NormalizedExportSection,
  type MorphologyItem,
  getMethodologyMeta,
  getDurationBadgeLabel,
  resolveLessonSectionsForExport,
  resolveEnrichedSourcesForExport,
  resolveExtraPardesCardsIfSeparate,
  normalizeTheologicalKeysForExport,
  resolveDerashaExecutiveSummary,
} from './shared';
import {
  sanitizeBidiControls,
  splitTextIntoBidiBlocksForExport,
} from '../bidiText';

/**
 * Helper to encode any string into RTF 1.5 ASCII with signed 16-bit Unicode escapes (\uN?)
 */
function toRtfUnicode(rawText: string): string {
  const text = sanitizeBidiControls(rawText);
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

function pushBidiRtfProse(rtf: string[], text: string, ltrHeader = '\\pard\\sa180\\sl300\\slmult1\\f0\\fs23\\cf1') {
  const blocks = splitTextIntoBidiBlocksForExport(text);
  for (const blk of blocks) {
    if (blk.direction === 'rtl') {
      rtf.push(
        `\\pard\\rtlpar\\qr\\li240\\ri240\\sa140\\sl320\\slmult1\\f2\\fs26\\cf1\\b ${toRtfUnicode(
          blk.text
        )}\\b0\\par`
      );
    } else {
      rtf.push(`${ltrHeader} ${toRtfUnicode(blk.text)}\\par`);
    }
  }
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
    pushBidiRtfProse(
      rtf,
      derasha.openingExordium,
      '\\pard\\sa200\\sl300\\slmult1\\f0\\fs23\\cf1\\i'
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
      pushBidiRtfProse(rtf, p.trim(), '\\pard\\sa180\\sl300\\slmult1\\f0\\fs23\\cf1');
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

  const rtfHalakhicConsultation =
    derasha?.halakhicConsultation || phase1?.halakhicConsultation;
  if (
    rtfHalakhicConsultation?.active &&
    rtfHalakhicConsultation.directQuotes.length > 0
  ) {
    rtf.push(
      `\\pard\\sa140\\f0\\fs26\\cf2\\b ${toRtfUnicode(
        `Módulo Halájico · Citas Directas del Shulján Aruj (${rtfHalakhicConsultation.consultedBranchLabels.join(
          ' · '
        )})`
      )}\\b0\\par`
    );
    rtf.push(
      `\\pard\\sa100\\f0\\fs19\\cf3\\i ${toRtfUnicode(
        'Filosofía externa o comparativa omitida estrictamente en temas de Halajá.'
      )}\\i0\\par`
    );
    rtfHalakhicConsultation.directQuotes.forEach((q, idx) => {
      rtf.push(
        `\\pard\\sa60\\f1\\fs20\\cf2\\b ${toRtfUnicode(
          `${idx + 1}. ${q.simanSeifLabel} — ${q.topicLabel} [${q.focusBranchLabel}]`
        )}\\b0\\par`
      );
      rtf.push(
        `\\pard\\sa60\\f2\\fs22\\cf1 ${toRtfUnicode(q.briefHebrewQuote)}\\par`
      );
      rtf.push(
        `\\pard\\sa80\\f0\\fs20\\cf1 ${toRtfUnicode(
          `«${q.briefSpanishQuote}»`
        )}\\par`
      );
      if (q.mejaberAndRamaNote) {
        rtf.push(
          `\\pard\\sa100\\f0\\fs19\\cf3 ${toRtfUnicode(
            `Mejaber / Ramá: ${q.mejaberAndRamaNote}`
          )}\\par`
        );
      }
    });

    if (
      rtfHalakhicConsultation.mishnatHaDorotQuotes &&
      rtfHalakhicConsultation.mishnatHaDorotQuotes.length > 0
    ) {
      rtf.push(
        `\\pard\\sa100\\f0\\fs22\\cf2\\b ${toRtfUnicode(
          'Mishnat HaDorot · Dictamen por Generaciones'
        )}\\b0\\par`
      );
      rtfHalakhicConsultation.mishnatHaDorotQuotes.forEach((mq, idx) => {
        rtf.push(
          `\\pard\\sa40\\f1\\fs19\\cf2\\b ${toRtfUnicode(
            `${idx + 1}. [${mq.generationLabel} · ${mq.periodLabel}] ${mq.authorityName} (sobre ${mq.sourceSimanSeifLabel}) · ${mq.ref}`
          )}\\b0\\par`
        );
        rtf.push(
          `\\pard\\sa40\\f2\\fs21\\cf1 ${toRtfUnicode(mq.hebrewText)}\\par`
        );
        rtf.push(
          `\\pard\\sa60\\f0\\fs19\\cf1 ${toRtfUnicode(mq.spanishTranslation)}\\par`
        );
        if (mq.rulingEvolutionNote) {
          rtf.push(
            `\\pard\\sa80\\f0\\fs18\\cf3 ${toRtfUnicode(
              `Dictamen generacional: ${mq.rulingEvolutionNote}`
            )}\\par`
          );
        }
      });
    }
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

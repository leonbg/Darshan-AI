import {
  LessonExportData,
  type NormalizedExportSection,
  type MorphologyItem,
  escapeHtml,
  getMethodologyMeta,
  getDurationBadgeLabel,
  resolveLessonSectionsForExport,
  resolveEnrichedSourcesForExport,
  resolveExtraPardesCardsIfSeparate,
  normalizeTheologicalKeysForExport,
  resolveDerashaExecutiveSummary,
} from './shared';

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
  const halakhicConsultation =
    derasha?.halakhicConsultation || phase1?.halakhicConsultation;
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
      ${
        halakhicConsultation?.active && halakhicConsultation.directQuotes.length > 0
          ? `<div class="section-block" style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:14px 18px;">
              <h2 class="section-title" style="color:#065f46;border-bottom-color:#a7f3d0;">Módulo Halájico · Citas Directas del Shulján Aruj (${escapeHtml(
                halakhicConsultation.consultedBranchLabels.join(' · ')
              )})</h2>
              <p class="body-p" style="font-size:10.5pt;color:#047857;margin-bottom:10px;">
                <strong>Criterio del Pipeline:</strong> Filosofía externa o comparativa omitida estrictamente.
              </p>
              ${halakhicConsultation.directQuotes
                .map(
                  (q) => `<div class="source-item" style="border-color:#a7f3d0;background:#ffffff;">
                    <div class="source-ref" style="color:#065f46;"><strong>${escapeHtml(
                      q.simanSeifLabel
                    )}</strong> · ${escapeHtml(q.topicLabel)} <span style="font-size:9.5pt;color:#475569;">(${escapeHtml(
                    q.focusBranchLabel
                  )})</span></div>
                    <p class="pasuk-hebrew" dir="rtl" style="font-size:12pt;margin:4px 0;">«${escapeHtml(
                      q.briefHebrewQuote
                    )}»</p>
                    <p class="source-trans">«${escapeHtml(q.briefSpanishQuote)}»</p>
                    ${
                      q.mejaberAndRamaNote
                        ? `<p class="source-trans" style="margin-top:4px;color:#0369a1;"><strong>Mejaber / Ramá:</strong> ${escapeHtml(
                            q.mejaberAndRamaNote
                          )}</p>`
                        : ''
                    }
                  </div>`
                )
                .join('')}
              ${
                halakhicConsultation.mishnatHaDorotQuotes &&
                halakhicConsultation.mishnatHaDorotQuotes.length > 0
                  ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #a7f3d0;">
                      <h3 style="margin:0 0 8px 0;font-size:12pt;color:#92400e;">Mishnat HaDorot · Dictamen por Generaciones</h3>
                      ${halakhicConsultation.mishnatHaDorotQuotes
                        .map(
                          (mq) => `<div class="source-item" style="border-color:#fde68a;background:#fffbeb;">
                            <div class="source-ref" style="color:#92400e;"><strong>${escapeHtml(
                              mq.authorityName
                            )}</strong> · ${escapeHtml(mq.generationLabel)} (${escapeHtml(
                            mq.periodLabel
                          )}) <span style="font-size:9.5pt;color:#065f46;">[Sobre ${escapeHtml(
                            mq.sourceSimanSeifLabel
                          )} · ${escapeHtml(mq.ref)}]</span></div>
                            <p class="pasuk-hebrew" dir="rtl" style="font-size:11.5pt;margin:4px 0;">«${escapeHtml(
                              mq.hebrewText
                            )}»</p>
                            <p class="source-trans">${escapeHtml(mq.spanishTranslation)}</p>
                            ${
                              mq.rulingEvolutionNote
                                ? `<p class="source-trans" style="margin-top:4px;color:#78350f;"><strong>Dictamen generacional:</strong> ${escapeHtml(
                                    mq.rulingEvolutionNote
                                  )}</p>`
                                : ''
                            }
                          </div>`
                        )
                        .join('')}
                    </div>`
                  : ''
              }
            </div>`
          : ''
      }
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

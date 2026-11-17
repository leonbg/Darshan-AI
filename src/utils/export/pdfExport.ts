import {
  LessonExportData,
  type NormalizedExportSection,
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
    const paragraphs = sanitizeBidiControls(text || '').split(/\n+/);
    const lines: string[] = [];
    for (const para of paragraphs) {
      // Split only on regular ASCII spaces/tabs so \u00A0 inside short inline Hebrew phrases stays unbroken
      const words = para.trim().split(/[ \t]+/).filter(Boolean);
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

  const drawSingleDirectionBlock = (
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
      rightBarX?: number;
      rightBarColor?: string;
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
      if (opts.rightBarColor && opts.rightBarX !== undefined) {
        ctx.fillStyle = opts.rightBarColor;
        ctx.fillRect(opts.rightBarX, y - opts.lineHeight + 8, 4, opts.lineHeight);
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
    if (opts.direction === 'rtl') {
      drawSingleDirectionBlock(text, opts);
      return;
    }

    const maxW = opts.maxWidth ?? contentW;
    const baseLeftX = opts.x ?? marginX;
    const bidiBlocks = splitTextIntoBidiBlocksForExport(text);

    for (const block of bidiBlocks) {
      if (block.direction === 'rtl') {
        y += 4;
        const rtlLineH = Math.max(opts.lineHeight + 4, 33);
        const rightEdgeX = baseLeftX + maxW;
        drawSingleDirectionBlock(block.text, {
          font: '700 23px "Frank Ruhl Libre", "Times New Roman", serif',
          color: '#0f172a',
          lineHeight: rtlLineH,
          x: rightEdgeX - 14,
          maxWidth: Math.max(maxW - 28, 220),
          align: 'right',
          direction: 'rtl',
          leftBarColor: opts.leftBarColor,
          rightBarX: rightEdgeX - 4,
          rightBarColor: '#0284c7',
        });
        y += 4;
      } else {
        drawSingleDirectionBlock(block.text, opts);
      }
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

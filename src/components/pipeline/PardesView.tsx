import React, { useState, useMemo, useCallback } from 'react';
import {
  Layers,
  Copy,
  Check,
  Sparkles,
  Share2,
  Printer,
  Download,
} from 'lucide-react';
import {
  FinalDerasha,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
  MethodologySectionItem,
  DerashaMethodology,
  PardesLevelKey,
} from '../../types';
import {
  getDepthLabelEs,
  hasCustomOutputPreferences,
  summarizeOutputPreferencesEs,
} from '../../utils/outputPreferences';
import {
  BidiText,
  formatBidiInlineHtml,
  formatBidiParagraphsHtml,
} from '../../utils/bidiText';

interface PardesViewProps {
  derasha: FinalDerasha;
  query?: string;
  phase1?: Phase1AnalysisResult | null;
  sources?: VerifiedSefariaSource[];
  onOpenExportPardes?: () => void;
}

export function getMethodologyHeaderMeta(metodologia?: DerashaMethodology): {
  code: DerashaMethodology;
  kicker: string;
  title: string;
  hebrewStamp: string;
  subtitle: string;
} {
  switch (metodologia) {
    case 'MESILAT_YESHARIM_SISTEMATICO':
      return {
        code: 'MESILAT_YESHARIM_SISTEMATICO',
        kicker: 'Esquema Sistemático del Ramjal · Moshé Jaim Luzzatto',
        title: 'Arquitectura en 4 Partes del Mesilat Yesharim',
        hebrewStamp: 'מְסִלַּת יְשָׁרִים',
        subtitle:
          '1. Mahut (Definición) · 2. Jalakim (Ramificaciones) · 3. Dérej Kinyanó (Adquisición) · 4. Mafsidayv (Obstáculos)',
      };
    case 'PIRKE_AVOT_EXEGETICO':
      return {
        code: 'PIRKE_AVOT_EXEGETICO',
        kicker: 'Exégesis Ética y Contrastiva Clásica · Sabiduría de los Padres',
        title: 'Análisis Tripartito de Pirké Avot',
        hebrewStamp: 'פִּרְקֵי אָבוֹת',
        subtitle:
          '1. Contexto del Tanaíta · 2. Rambam (Justo Medio) vs. Rabenu Yoná y Maharal · 3. Principio Vivo',
      };
    case 'MUSAR_TRANSFORMATIVO':
      return {
        code: 'MUSAR_TRANSFORMATIVO',
        kicker: 'Movimiento de Musar · Rabí Israel Salanter',
        title: 'Laboratorio Ético y Contabilidad del Alma',
        hebrewStamp: 'חֶשְׁבּוֹן הַנֶּפֶשׁ',
        subtitle:
          '1. Punto Focal (Fricción Concreta) · 2. Diagnóstico del Néfesh · 3. Jeshbón HaNéfesh (Ejercicio Semanal)',
      };
    case 'WISSENSCHAFT_DES_JUDENTUMS':
    case 'FILOLOGIA_LITURGICA_WISSENSCHAFT':
      return {
        code: 'WISSENSCHAFT_DES_JUDENTUMS',
        kicker: 'Método Histórico-Filológico · Wissenschaft des Judentums',
        title: 'Investigación Filológica e Histórica de las Fuentes Judías',
        hebrewStamp: 'חָכְמַת יִשְׂרָאֵל',
        subtitle:
          '1. Crítica Textual y Manuscritos · 2. Redacción Tanaítica y Amoraica · 3. Contexto Histórico y Normativo · 4. Exégesis Teológica Comparada',
      };
    case 'EVOLUCION_CONCEPTUAL':
      return {
        code: 'EVOLUCION_CONCEPTUAL',
        kicker: 'Genealogía y Evolución del Concepto · 4 Estratos de la Tradición',
        title: 'Evolución del Concepto: Torá · Cábala · Musar · Jasidut',
        hebrewStamp: 'הִתְפַּתְּחוּת הַמּוּשָׂג',
        subtitle:
          '1. Torá y Jazal · 2. Árbol de la Vida (Cábala) · 3. Escuela del Musar · 4. Jasidut (Besht, Jabad, Breslev, Gur)',
      };
    case 'FILOSOFIA_CONTRASTIVA':
      return {
        code: 'FILOSOFIA_CONTRASTIVA',
        kicker: 'Majshévet Yisrael frente a Filosofías Universales · Kuzari, Rambam y Maharal',
        title: 'Diálogo Filosófico Contrastivo',
        hebrewStamp: 'מַחְשֶׁבֶת יִשְׂרָאֵל',
        subtitle:
          '1. Tesis Filosófica y Convergencias · 2. Frontera Teológica · 3. Respuesta Canónica · 4. Síntesis y Elevación',
      };
    default:
      return {
        code: 'PARDES',
        kicker: 'Hermenéutica Rabínica · Cuatro Niveles Concéntricos',
        title: 'Las Cuatro Dimensiones del Pardés',
        hebrewStamp: 'פַּרְדֵּס',
        subtitle: '1. Pshat (Literal) · 2. Rémez (Alusivo) · 3. Drash (Homilético) · 4. Sod (Místico)',
      };
  }
}

export function resolveActiveSections(derasha: FinalDerasha): MethodologySectionItem[] {
  if (Array.isArray(derasha.methodologySections) && derasha.methodologySections.length >= 3) {
    return derasha.methodologySections;
  }

  return [
    {
      key: 'pshat',
      stepNumber: 1,
      hebrewBadge: 'פ',
      hebrewTerm: 'פְּשָׁט',
      spanishSubtitle: '1. Pshat · Literal y Contextual',
      title: derasha.pardes.pshat.title,
      exposition: derasha.pardes.pshat.exposition,
      keyTakeaway: derasha.pardes.pshat.keyTakeaway,
    },
    {
      key: 'remez',
      stepNumber: 2,
      hebrewBadge: 'ר',
      hebrewTerm: 'רֶמֶז',
      spanishSubtitle: '2. Rémez · Alusión Ética y Filosófica',
      title: derasha.pardes.remez.title,
      exposition: derasha.pardes.remez.exposition,
      keyTakeaway: derasha.pardes.remez.keyTakeaway,
    },
    {
      key: 'drash',
      stepNumber: 3,
      hebrewBadge: 'ד',
      hebrewTerm: 'דְּרַשׁ',
      spanishSubtitle: '3. Drash · Interpretación Homilética y Midráshica',
      title: derasha.pardes.drash.title,
      exposition: derasha.pardes.drash.exposition,
      keyTakeaway: derasha.pardes.drash.keyTakeaway,
    },
    {
      key: 'sod',
      stepNumber: 4,
      hebrewBadge: 'ס',
      hebrewTerm: 'סוֹד',
      spanishSubtitle: '4. Sod · Dimensión Profunda y Mística',
      title: derasha.pardes.sod.title,
      exposition: derasha.pardes.sod.exposition,
      keyTakeaway: derasha.pardes.sod.keyTakeaway,
    },
  ];
}

/**
 * Generates the complete, clean block of the active methodology cards.
 */
export function buildPardesBlockShareText(
  derasha: FinalDerasha,
  query?: string,
  phase1?: Phase1AnalysisResult | null,
  sources?: VerifiedSefariaSource[]
): string {
  const lines: string[] = [];
  const meta = getMethodologyHeaderMeta(derasha.metodologia);
  const title = derasha.derashaTitle || phase1?.title || query || meta.title;

  lines.push(`*FICHAS DE ESTUDIO (${meta.code} — ${meta.hebrewStamp})*`);
  lines.push(`*${title}*`);
  if (derasha.audienciaOTono) {
    lines.push(`_Enfoque: ${derasha.audienciaOTono}_`);
  }
  if (phase1?.primaryHebrew) {
    lines.push(`${phase1.primaryHebrew}`);
    if (phase1.transliteration || phase1.literalSpanishTranslation) {
      lines.push(
        `«${phase1.transliteration || ''}» — ${phase1.literalSpanishTranslation || ''}`.trim()
      );
    }
  }
  lines.push('');

  const sections = resolveActiveSections(derasha);

  sections.forEach((sec) => {
    lines.push(`*[${sec.hebrewBadge} · ${sec.hebrewTerm}] ${sec.spanishSubtitle.toUpperCase()}*`);
    lines.push(`*${sec.title}*`);
    lines.push(`${sec.exposition.trim()}`);
    lines.push(`• *Clave:* ${sec.keyTakeaway.trim()}`);
    lines.push('');
  });

  if (derasha.practicalConclusion) {
    lines.push(`*CONCLUSIÓN Y LLAMADA A LA ACCIÓN (${derasha.practicalConclusion.title})*`);
    lines.push(`• *Hashkafá:* ${derasha.practicalConclusion.hashkafa.trim()}`);
    lines.push(`• *Kavaná:* ${derasha.practicalConclusion.prayerKavanah.trim()}`);
    lines.push(`• *Acción práctica:* ${derasha.practicalConclusion.dailyAction.trim()}`);
    lines.push('');
  }

  if (sources && sources.length > 0) {
    lines.push(`*Fuentes Canónicas (Sefaria v3):*`);
    sources.forEach((s) => {
      lines.push(`• ${s.ref}${s.heRef ? ` (${s.heRef})` : ''}`);
    });
    lines.push('');
  }

  lines.push(`_Darshán AI · Metodología ${meta.code} (Tradición Judía / Sefaria)_`);
  return lines.join('\n');
}

export function buildPardesPrintableHtml(
  derasha: FinalDerasha,
  query?: string,
  phase1?: Phase1AnalysisResult | null,
  sources?: VerifiedSefariaSource[]
): string {
  const meta = getMethodologyHeaderMeta(derasha.metodologia);
  const title = derasha.derashaTitle || phase1?.title || query || meta.title;
  const escapeHtml = (str?: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const palettes = [
    { color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
    { color: '#4338ca', bg: '#eef2ff', border: '#a5b4fc' },
    { color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
    { color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc' },
  ];

  const sections = resolveActiveSections(derasha);

  const sourcesHtml =
    sources && sources.length > 0
      ? `
    <div class="sources-box">
      <div class="section-kicker">FUENTES CANÓNICAS MASORÉTICAS VERIFICADAS (SEFARIA v3)</div>
      <div class="sources-grid">
        ${sources
          .map(
            (s) => `
          <div class="source-item">
            <div class="source-ref">${escapeHtml(s.ref)} ${
              s.heRef ? `<span class="he-inline">(${escapeHtml(s.heRef)})</span>` : ''
            }</div>
            <div class="source-he" dir="rtl">${escapeHtml(s.hebrewText)}</div>
            <div class="source-es">«${escapeHtml(s.spanishTranslation || s.translation)}»</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>`
      : '';

  const cardsHtml = sections
    .map((sec, idx) => {
      const p = palettes[idx % palettes.length];
      return `
    <div class="pardes-card" style="border-color: ${p.border};">
      <div class="card-header" style="background: ${p.bg}; border-bottom-color: ${p.border};">
        <div class="letter-badge" style="color: ${p.color}; border-color: ${p.border};">${escapeHtml(
        sec.hebrewBadge
      )}</div>
        <div>
          <div class="pillar-meta">
            <span class="pillar-he" style="color: ${p.color};">${escapeHtml(sec.hebrewTerm)}</span>
            <span class="pillar-level" style="color: ${p.color};">${escapeHtml(
        sec.spanishSubtitle
      )}</span>
          </div>
          <h3 class="pillar-title">${escapeHtml(sec.title)}</h3>
        </div>
      </div>
      <div class="card-body">
        ${formatBidiParagraphsHtml(sec.exposition, 'exposition')}
        <div class="takeaway" style="background: ${p.bg}; border: 1px solid ${p.border};">
          <strong style="color: ${p.color};">Síntesis / Ejercicio:</strong> ${formatBidiInlineHtml(
        sec.keyTakeaway
      )}
        </div>
      </div>
    </div>
  `;
    })
    .join('');

  const conclusionHtml = derasha.practicalConclusion
    ? `
    <div class="conclusion-box">
      <div class="section-kicker">CONCLUSIÓN Y LLAMADA A LA ACCIÓN MORAL / ESPIRITUAL</div>
      <h3 class="conclusion-title">${escapeHtml(derasha.practicalConclusion.title)}</h3>
      <ul class="conclusion-list">
        <li><strong>Visión del Mundo (Hashkafá):</strong> ${formatBidiInlineHtml(
          derasha.practicalConclusion.hashkafa
        )}</li>
        <li><strong>Kavaná e Introspección:</strong> ${formatBidiInlineHtml(
          derasha.practicalConclusion.prayerKavanah
        )}</li>
        <li><strong>Acción Práctica (Tikún Midot):</strong> ${formatBidiInlineHtml(
          derasha.practicalConclusion.dailyAction
        )}</li>
      </ul>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Hoja de Estudio (${escapeHtml(meta.code)}) — ${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      line-height: 1.55;
    }
    .sheet-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .brand {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0369a1;
      margin-bottom: 4px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 6px 0;
      color: #0f172a;
    }
    .query-sub {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .hebrew-stamp {
      font-size: 22px;
      font-weight: 700;
      color: #0369a1;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 6px 14px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .primary-verse {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      text-align: center;
    }
    .primary-he {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .primary-trans {
      font-size: 13px;
      font-style: italic;
      color: #334155;
    }
    .exordium {
      font-style: italic;
      font-size: 13.5px;
      color: #334155;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
    }
    .section-kicker {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 8px;
    }
    .sources-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 18px;
    }
    .sources-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .source-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .source-ref {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 3px;
    }
    .source-he {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .source-es {
      font-size: 11.5px;
      color: #334155;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }
    .pardes-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      background: #ffffff;
    }
    .card-header {
      padding: 10px 14px;
      border-bottom: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .letter-badge {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .pillar-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
    }
    .pillar-he {
      font-size: 14px;
    }
    .pillar-title {
      font-size: 14px;
      margin: 2px 0 0 0;
      color: #0f172a;
    }
    .card-body {
      padding: 12px 14px;
    }
    .exposition {
      font-size: 12.5px;
      margin: 0 0 10px 0;
      color: #1e293b;
      text-align: justify;
    }
    .hebrew-inline {
      display: inline-block;
      direction: rtl;
      unicode-bidi: isolate;
      text-align: right;
      white-space: nowrap;
      font-family: 'Frank Ruhl Libre', 'Times New Roman', serif;
      font-weight: 600;
    }
    .hebrew-embedded-block {
      display: block;
      width: 100%;
      direction: rtl;
      unicode-bidi: isolate;
      text-align: right;
      font-family: 'Frank Ruhl Libre', 'Times New Roman', serif;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.75;
      color: #0f172a;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-right: 3px solid #0284c7;
      border-radius: 6px;
      padding: 6px 10px;
      margin: 6px 0;
    }
    .takeaway {
      padding: 8px 10px;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11.5px;
      color: #0f172a;
    }
    .conclusion-box {
      border: 1.5px solid #94a3b8;
      border-radius: 10px;
      padding: 12px 16px;
      background: #f8fafc;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 18px;
    }
    .conclusion-title {
      font-size: 14px;
      margin: 0 0 6px 0;
    }
    .conclusion-list {
      margin: 0;
      padding-left: 18px;
      font-size: 12px;
    }
    .conclusion-list li {
      margin-bottom: 4px;
    }
    .footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
    @media (max-width: 680px) {
      .cards-grid, .sources-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="sheet-header">
    <div>
      <div class="brand">Darshán AI · Metodología ${escapeHtml(meta.code)} (${escapeHtml(
    meta.kicker
  )})</div>
      <h1>${escapeHtml(title)}</h1>
      ${
        query
          ? `<p class="query-sub"><strong>Tema / Fuente:</strong> ${escapeHtml(query)}</p>`
          : ''
      }
      ${
        derasha.audienciaOTono
          ? `<p class="query-sub"><strong>Audiencia y tono:</strong> ${escapeHtml(
              derasha.audienciaOTono
            )}</p>`
          : ''
      }
    </div>
    <div class="hebrew-stamp" dir="rtl">${escapeHtml(meta.hebrewStamp)}</div>
  </div>

  ${
    phase1?.primaryHebrew
      ? `<div class="primary-verse">
          <div class="primary-he" dir="rtl">${escapeHtml(phase1.primaryHebrew)}</div>
          <div class="primary-trans">«${escapeHtml(phase1.transliteration)}» — ${escapeHtml(
          phase1.literalSpanishTranslation
        )}</div>
        </div>`
      : ''
  }

  ${
    derasha.openingExordium
      ? `<div class="exordium">«${escapeHtml(derasha.openingExordium)}»</div>`
      : ''
  }

  <div class="section-kicker">${escapeHtml(meta.title.toUpperCase())} (${escapeHtml(
    meta.subtitle
  )})</div>
  <div class="cards-grid">
    ${cardsHtml}
  </div>

  ${conclusionHtml}

  ${sourcesHtml}

  <div class="footer">
    Generado con Darshán AI · Fuentes exclusivamente de la tradición judía verificadas en la Biblioteca de Sefaria
  </div>
</body>
</html>`;
}

export function triggerPrintHtmlDocument(htmlContent: string) {
  try {
    const existingFrame = document.getElementById('darshan-print-frame') as HTMLIFrameElement | null;
    if (existingFrame) {
      existingFrame.remove();
    }
    const iframe = document.createElement('iframe');
    iframe.id = 'darshan-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
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
        } catch {
          window.print();
        }
      }, 350);
    } else {
      window.print();
    }
  } catch {
    window.print();
  }
}

const CARD_COLOR_THEMES = [
  {
    activeTab: 'bg-emerald-400 text-slate-950 font-semibold',
    border: 'border-emerald-500/40 hover:border-emerald-500/60',
    bgGlow: 'from-emerald-950/20 to-transparent',
    accentText: 'text-emerald-400',
    cardBg: 'bg-emerald-950/15',
  },
  {
    activeTab: 'bg-indigo-400 text-slate-950 font-semibold',
    border: 'border-indigo-500/40 hover:border-indigo-500/60',
    bgGlow: 'from-indigo-950/20 to-transparent',
    accentText: 'text-indigo-400',
    cardBg: 'bg-indigo-950/15',
  },
  {
    activeTab: 'bg-amber-400 text-slate-950 font-semibold',
    border: 'border-amber-500/40 hover:border-amber-500/60',
    bgGlow: 'from-amber-950/20 to-transparent',
    accentText: 'text-amber-400',
    cardBg: 'bg-amber-950/15',
  },
  {
    activeTab: 'bg-sky-400 text-slate-950 font-semibold',
    border: 'border-sky-500/40 hover:border-sky-500/60',
    bgGlow: 'from-sky-950/20 to-transparent',
    accentText: 'text-sky-400',
    cardBg: 'bg-sky-950/15',
  },
];

export const PardesView: React.FC<PardesViewProps> = React.memo(({
  derasha,
  query,
  phase1,
  sources,
  onOpenExportPardes,
}) => {
  const [activeKey, setActiveKey] = useState<string>('all');
  const [copiedPillar, setCopiedPillar] = useState<string | null>(null);
  const [copiedBlock, setCopiedBlock] = useState(false);

  const meta = useMemo(() => getMethodologyHeaderMeta(derasha.metodologia), [derasha.metodologia]);
  const sections = useMemo(() => resolveActiveSections(derasha), [derasha]);

  const handleCopyPillar = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPillar(key);
    setTimeout(() => setCopiedPillar(null), 1500);
  }, []);

  const handleCopyAllPardesBlock = useCallback(() => {
    const blockText = buildPardesBlockShareText(derasha, query, phase1, sources);
    navigator.clipboard.writeText(blockText);
    setCopiedBlock(true);
    setTimeout(() => setCopiedBlock(false), 2000);
  }, [derasha, query, phase1, sources]);

  const handlePrintAllPardesCards = useCallback(() => {
    const html = buildPardesPrintableHtml(derasha, query, phase1, sources);
    triggerPrintHtmlDocument(html);
  }, [derasha, query, phase1, sources]);

  const handleDownloadPrintableSheet = useCallback(() => {
    const html = buildPardesPrintableHtml(derasha, query, phase1, sources);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (derasha.derashaTitle || query || 'drasha')
      .slice(0, 28)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    a.download = `fichas-${meta.code.toLowerCase()}-${slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [derasha, query, phase1, sources, meta.code]);

  const displayedSections = useMemo(
    () => (activeKey === 'all' ? sections : sections.filter((s) => s.key === activeKey)),
    [activeKey, sections]
  );

  return (
    <div className="editorial-surface rounded-2xl p-5 sm:p-7 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>{meta.kicker}</span>
            </div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h3 className="font-editorial text-xl sm:text-2xl font-bold text-white">
                {meta.title}
              </h3>
              <span className="font-hebrew text-sky-400 text-xl sm:text-2xl font-bold" dir="rtl">
                {meta.hebrewStamp}
              </span>
            </div>
            <p className="text-xs text-slate-400">{meta.subtitle}</p>
            {derasha.outputPreferences && hasCustomOutputPreferences(derasha.outputPreferences) && (
              <p className="text-[11px] text-amber-300/90 font-medium">
                Personalización aplicada: {summarizeOutputPreferencesEs(derasha.outputPreferences)}
              </p>
            )}
          </div>

          {/* Bulk Export / Share / Print Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllPardesBlock}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition cursor-pointer"
              title="Copiar todas las fichas de esta metodología en bloque al portapapeles"
            >
              {copiedBlock ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">¡Fichas Copiadas!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar {sections.length} Fichas en Bloque</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintAllPardesCards}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition cursor-pointer"
              title="Imprimir hoja de estudio con las fichas en bloque"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Imprimir Fichas</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPrintableSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition cursor-pointer"
              title="Descargar hoja de estudio imprimible"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Descargar Hoja</span>
            </button>

            {onOpenExportPardes && (
              <button
                type="button"
                onClick={onOpenExportPardes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
                title="Abrir opciones de compartir e impresión"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>Compartir / Exportar</span>
              </button>
            )}
          </div>
        </div>

        {/* View toggle tabs */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#090f1d] border border-slate-800 text-xs overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveKey('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeKey === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vista en Cuadrícula ({sections.length} Secciones)
            </button>
            {sections.map((sec, idx) => {
              const colorTheme = CARD_COLOR_THEMES[idx % CARD_COLOR_THEMES.length];
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => setActiveKey(sec.key)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeKey === sec.key ? colorTheme.activeTab : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-hebrew font-bold">{sec.hebrewBadge}</span>
                  <span>{sec.spanishSubtitle.split('·')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Exordium Quote (full hairline border, no border-l-4) */}
      {derasha.openingExordium && (
        <div className="p-4 sm:p-5 rounded-xl bg-[#090f1d]/90 border border-slate-800 text-slate-300 font-editorial italic text-sm sm:text-base leading-relaxed">
          « <BidiText text={derasha.openingExordium} /> »
        </div>
      )}

      {/* Sections Grid */}
      <div
        className={`grid grid-cols-1 ${
          activeKey === 'all'
            ? sections.length === 3
              ? 'lg:grid-cols-3'
              : 'lg:grid-cols-2'
            : ''
        } gap-5`}
      >
        {displayedSections.map((sec, idx) => {
          const colorClasses = CARD_COLOR_THEMES[idx % CARD_COLOR_THEMES.length];
          const secKeyLower = (sec.key || '').toLowerCase() as PardesLevelKey;
          const isPardesLevel =
            secKeyLower === 'pshat' ||
            secKeyLower === 'remez' ||
            secKeyLower === 'drash' ||
            secKeyLower === 'sod';
          const isPrioritized =
            isPardesLevel &&
            Boolean(derasha.outputPreferences?.prioritizedLevels?.includes(secKeyLower));
          const customDepth =
            isPardesLevel && derasha.outputPreferences?.pardesDepth?.[secKeyLower];

          return (
            <div
              key={sec.key}
              className={`rounded-2xl border ${
                isPrioritized ? 'border-amber-400/60 hover:border-amber-300/80' : colorClasses.border
              } ${colorClasses.cardBg} bg-gradient-to-b ${colorClasses.bgGlow} p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all relative overflow-hidden`}
            >
              <div className="space-y-4">
                {/* Section top bar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#090f1d] border border-slate-800 flex items-center justify-center shrink-0">
                      <span className="font-hebrew text-2xl font-bold text-white leading-none">
                        {sec.hebrewBadge}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-hebrew text-base font-bold text-white" dir="rtl">
                          {sec.hebrewTerm}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className={`font-semibold ${colorClasses.accentText}`}>
                          {sec.spanishSubtitle}
                        </span>
                        {isPrioritized && (
                          <span className="text-[11px] font-bold text-amber-300">
                            · Prioritario
                          </span>
                        )}
                        {customDepth && customDepth !== 'estandar' && (
                          <span className="text-[11px] font-medium text-slate-400">
                            · {getDepthLabelEs(customDepth)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-editorial text-base sm:text-lg font-bold text-slate-100 mt-0.5">
                        {sec.title}
                      </h4>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyPillar(
                        `${sec.spanishSubtitle} (${sec.hebrewTerm})\n${sec.title}\n\n${sec.exposition}\n\nClave: ${sec.keyTakeaway}`,
                        sec.key
                      )
                    }
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                    title={`Copiar sección ${sec.spanishSubtitle}`}
                  >
                    {copiedPillar === sec.key ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Main exposition */}
                <BidiText
                  as="div"
                  paragraphs
                  text={sec.exposition}
                  className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans space-y-3"
                />
              </div>

              {/* Key Takeaway Banner */}
              <div className="p-3.5 rounded-xl bg-[#090f1d]/90 border border-slate-800/90 flex items-start gap-2.5 text-xs sm:text-sm">
                <Sparkles className={`w-4 h-4 ${colorClasses.accentText} shrink-0 mt-0.5`} />
                <div className="text-slate-300 min-w-0 flex-1">
                  <strong className={colorClasses.accentText}>Principio / Ejercicio:</strong>{' '}
                  <BidiText text={sec.keyTakeaway} className="text-slate-100" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

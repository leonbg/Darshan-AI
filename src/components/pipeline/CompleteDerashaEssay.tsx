import React, { useState, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Share2,
  Printer,
  Copy,
  Check,
  Compass,
  Clock,
  Layers,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  FileText,
  FileEdit,
  Download,
  Languages,
  ExternalLink,
} from 'lucide-react';
import {
  Phase1AnalysisResult,
  FinalDerasha,
  VerifiedSefariaSource,
  FollowUpItem,
  DerashaDuration,
  DerashaMethodology,
} from '../../types';
import {
  getMethodologyMeta,
  METHODOLOGY_DISPLAY_LIST,
  resolveLessonSectionsForExport,
  buildEditableMarkdown,
  generateLessonPdfBlob,
  generateWordDocBlob,
  generateOpenRtfBlob,
  makeSafeSlug,
  shareOrDownloadFile,
} from '../../utils/documentExport';
import { evaluateSourceTranslationStatus, stripAllHtml } from '../../services/sefaria';

interface CompleteDerashaEssayProps {
  derasha: FinalDerasha;
  phase1Data: Phase1AnalysisResult | null;
  sources: VerifiedSefariaSource[];
  followUps?: FollowUpItem[];
  onOpenExport: () => void;
  onSwitchToCards: () => void;
  onAskFollowUpPrompt?: (prompt: string) => void;
  onChangeDurationOrComplementary?: (
    newDuration: DerashaDuration,
    extraMethodology?: DerashaMethodology
  ) => void;
  isRegeneratingDuration?: boolean;
  onTranslateSource?: (
    ref: string,
    hebrewText: string,
    englishText: string
  ) => Promise<void>;
  onTranslateAllSources?: () => Promise<void>;
  isTranslatingRef?: string | null;
  isTranslatingAll?: boolean;
}

const SECTION_ACCENTS = [
  {
    badge: 'text-sky-300 bg-sky-500/15 border-sky-500/35',
    borderL: 'border-l-sky-400',
    hebrewColor: 'text-sky-300',
  },
  {
    badge: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/35',
    borderL: 'border-l-indigo-400',
    hebrewColor: 'text-indigo-300',
  },
  {
    badge: 'text-amber-300 bg-amber-500/15 border-amber-500/35',
    borderL: 'border-l-amber-400',
    hebrewColor: 'text-amber-300',
  },
  {
    badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35',
    borderL: 'border-l-emerald-400',
    hebrewColor: 'text-emerald-300',
  },
  {
    badge: 'text-purple-300 bg-purple-500/15 border-purple-500/35',
    borderL: 'border-l-purple-400',
    hebrewColor: 'text-purple-300',
  },
];

export const CompleteDerashaEssay: React.FC<CompleteDerashaEssayProps> = React.memo(({
  derasha,
  phase1Data,
  sources,
  followUps = [],
  onOpenExport,
  onSwitchToCards,
  onAskFollowUpPrompt,
  onChangeDurationOrComplementary,
  isRegeneratingDuration = false,
  onTranslateSource,
  onTranslateAllSources,
  isTranslatingRef,
  isTranslatingAll = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAddMethodPicker, setShowAddMethodPicker] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showInlineSources, setShowInlineSources] = useState(false);

  const evaluatedSources = useMemo(
    () =>
      (sources || []).map((source) => {
        const phase3Trans = derasha.canonicalAnalysis?.spanishTranslations?.find(
          (t) => t.ref.toLowerCase() === source.ref.toLowerCase()
        )?.spanishTranslation;
        return {
          source,
          ...evaluateSourceTranslationStatus(source, phase3Trans),
        };
      }),
    [sources, derasha.canonicalAnalysis?.spanishTranslations]
  );
  const untranslatedSefariaSources = useMemo(
    () => evaluatedSources.filter((s) => !s.hasSpanish),
    [evaluatedSources]
  );

  const activeMethodId =
    derasha.metodologia || phase1Data?.detectedMetodologia || 'PARDES';
  const methodMeta = useMemo(() => getMethodologyMeta(activeMethodId), [activeMethodId]);
  const activeDuration: DerashaDuration =
    derasha.duracion || phase1Data?.duracion || '10_MIN';
  const complementaryIds =
    derasha.metodologiasComplementarias ||
    phase1Data?.metodologiasComplementarias ||
    [];

  const sections = useMemo(
    () => resolveLessonSectionsForExport(derasha, 'full_derasha'),
    [derasha]
  );
  const primarySections = useMemo(
    () => sections.filter((s) => !s.isComplementary),
    [sections]
  );
  const complementarySections = useMemo(
    () => sections.filter((s) => s.isComplementary),
    [sections]
  );

  const allWords = useMemo(
    () =>
      [
        derasha.openingExordium || '',
        ...sections.map((s) => `${s.title} ${s.content} ${s.keyInsight}`),
        derasha.practicalConclusion?.hashkafa || '',
        derasha.practicalConclusion?.prayerKavanah || '',
        derasha.practicalConclusion?.dailyAction || '',
      ]
        .join(' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    [derasha, sections]
  );

  const durationBadgeLabel =
    activeDuration === '5_MIN'
      ? 'Drashá Breve · 5 min'
      : activeDuration === '30_MIN'
      ? 'Shiur Magistral · 30 min'
      : 'Drashá Estándar · 10 min';

  const handleCopyFullEssay = useCallback(async () => {
    const fullText = buildEditableMarkdown({
      query: derasha.derashaTitle || phase1Data?.title || 'Estudio de Torá',
      phase1: phase1Data,
      sources,
      derasha,
      followUps,
      scope: 'full_derasha',
    });

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onOpenExport();
    }
  }, [derasha, phase1Data, sources, followUps, onOpenExport]);

  const handleQuickPdfExport = useCallback(async (preferShare: boolean) => {
    setIsExportingPdf(true);
    setExportStatus('Generando PDF con todas las tarjetas, fuentes, análisis y desgloses...');
    try {
      const slug = makeSafeSlug(
        derasha.derashaTitle || phase1Data?.title || 'leccion-drasha'
      );
      const blob = await generateLessonPdfBlob({
        query: derasha.derashaTitle || phase1Data?.title || 'Estudio de Torá',
        phase1: phase1Data,
        sources,
        derasha,
        followUps,
        scope: 'full_derasha',
      });
      const res = await shareOrDownloadFile({
        blob,
        filename: `drasha-${slug}.pdf`,
        title: `${derasha.derashaTitle} — PDF Darshán AI`,
        text: `${derasha.derashaTitle} (${methodMeta.label} · ${durationBadgeLabel} · Todas las tarjetas, raíces y fuentes)`,
        preferShare,
      });
      setExportStatus(
        res === 'shared'
          ? 'Lección completa compartida en formato PDF (.pdf)'
          : `PDF completo guardado: drasha-${slug}.pdf`
      );
    } catch (err) {
      console.warn('Error generating quick PDF:', err);
      onOpenExport();
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => setExportStatus(null), 3500);
    }
  }, [derasha, phase1Data, sources, followUps, methodMeta.label, durationBadgeLabel, onOpenExport]);

  const handleQuickEditableWord = useCallback(async () => {
    const slug = makeSafeSlug(
      derasha.derashaTitle || phase1Data?.title || 'leccion-drasha'
    );
    const blob = generateWordDocBlob({
      query: derasha.derashaTitle || phase1Data?.title || 'Estudio de Torá',
      phase1: phase1Data,
      sources,
      derasha,
      followUps,
      scope: 'full_derasha',
    });
    await shareOrDownloadFile({
      blob,
      filename: `drasha-${slug}.doc`,
      title: `${derasha.derashaTitle} — Documento Editable (.doc)`,
      text: `Versión editable en Word / Google Docs: ${derasha.derashaTitle}`,
      preferShare: false,
    });
    setExportStatus(`Guardado en formato editable Word: drasha-${slug}.doc`);
    setTimeout(() => setExportStatus(null), 3500);
  }, [derasha, phase1Data, sources, followUps]);

  const handleQuickOpenRtf = useCallback(async () => {
    const slug = makeSafeSlug(
      derasha.derashaTitle || phase1Data?.title || 'leccion-drasha'
    );
    const blob = generateOpenRtfBlob({
      query: derasha.derashaTitle || phase1Data?.title || 'Estudio de Torá',
      phase1: phase1Data,
      sources,
      derasha,
      followUps,
      scope: 'full_derasha',
    });
    await shareOrDownloadFile({
      blob,
      filename: `drasha-${slug}.rtf`,
      title: `${derasha.derashaTitle} — Formato Abierto Editable (.rtf)`,
      text: `Versión abierta editable (.rtf): ${derasha.derashaTitle}`,
      preferShare: false,
    });
    setExportStatus(`Guardado en formato abierto editable: drasha-${slug}.rtf`);
    setTimeout(() => setExportStatus(null), 3500);
  }, [derasha, phase1Data, sources, followUps]);

  const availableAdditionalMethodologies = useMemo(
    () =>
      METHODOLOGY_DISPLAY_LIST.filter(
        (m) => m.id !== methodMeta.id && !complementaryIds.includes(m.id)
      ),
    [methodMeta.id, complementaryIds]
  );

  return (
    <article className="editorial-surface rounded-3xl overflow-hidden border border-sky-500/25 shadow-2xl">
      {/* Top Editorial Banner */}
      <div className="relative bg-gradient-to-b from-sky-950/45 via-[#0c1427] to-[#0b1120] p-6 sm:p-10 border-b border-slate-800/90">
        {/* Top Metadata & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-500/15 border border-sky-500/35 text-sky-300 text-xs font-semibold tracking-wide">
              <Compass className="w-3.5 h-3.5" />
              <span>{methodMeta.shortLabel}</span>
              <span className="font-hebrew text-sm text-sky-200 ml-1" dir="rtl">
                {methodMeta.hebrewLabel}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {durationBadgeLabel} ({allWords} palabras)
              </span>
            </span>

            {complementaryIds.map((compId) => {
              const compMeta = getMethodologyMeta(compId);
              return (
                <span
                  key={compId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>{compMeta.shortLabel}</span>
                </span>
              );
            })}
          </div>

          {/* Action Toolbar: Direct PDF, Editable Word (.doc), Open Format (.rtf), Copy & Full Modal */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickPdfExport(false)}
              disabled={isExportingPdf}
              title="Descargar directamente la lección completa en archivo PDF (.pdf)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Generando PDF...' : 'Guardar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPdfExport(true)}
              disabled={isExportingPdf}
              title="Compartir el archivo PDF (.pdf) por WhatsApp, correo o sistema"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir PDF</span>
            </button>

            <button
              type="button"
              onClick={handleQuickEditableWord}
              title="Guardar en formato editable Microsoft Word / Google Docs (.doc)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-indigo-200 text-xs font-semibold transition cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5 text-indigo-300" />
              <span>Editable .DOC</span>
            </button>

            <button
              type="button"
              onClick={handleQuickOpenRtf}
              title="Guardar en formato abierto universal (.rtf) para LibreOffice, OpenOffice, Pages o WordPad"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-200 text-xs font-semibold transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-300" />
              <span>Abierto .RTF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyFullEssay}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Más Formatos</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <div className="mb-4 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-between">
            <span>{exportStatus}</span>
            <button
              type="button"
              onClick={onOpenExport}
              className="underline text-emerald-300 hover:text-white ml-3 cursor-pointer"
            >
              Abrir centro de exportación
            </button>
          </div>
        )}

        {/* Main Derashá Title */}
        <h2 className="font-editorial text-2xl sm:text-4xl lg:text-[2.6rem] font-bold text-white leading-[1.15] tracking-tight mb-6">
          {derasha.derashaTitle}
        </h2>

        {/* Central Hebrew Pasuk / Quotation Callout */}
        {phase1Data?.primaryHebrew && (
          <div className="rounded-2xl bg-[#070c18]/90 border border-sky-500/25 p-5 sm:p-6 mb-6 shadow-inner">
            <div className="flex flex-col gap-3">
              <p
                className="font-hebrew text-2xl sm:text-3xl text-white font-bold leading-relaxed text-right"
                dir="rtl"
              >
                {phase1Data.primaryHebrew}
              </p>

              {phase1Data.transliteration && (
                <p className="text-xs sm:text-sm text-sky-300/90 italic font-serif">
                  {phase1Data.transliteration}
                </p>
              )}

              {phase1Data.literalSpanishTranslation && (
                <p className="font-editorial text-base sm:text-lg text-slate-200 border-t border-slate-800/80 pt-3">
                  «{phase1Data.literalSpanishTranslation}»
                </p>
              )}
            </div>
          </div>
        )}

        {/* Opening Exordium */}
        {derasha.openingExordium && (
          <div className="relative pl-4 sm:pl-6 border-l-2 border-sky-400">
            <div className="text-[11px] font-bold uppercase tracking-widest text-sky-400 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Exordio y Planteamiento Central</span>
            </div>
            <p className="font-editorial text-lg sm:text-xl text-slate-100 leading-relaxed italic whitespace-pre-line">
              {derasha.openingExordium}
            </p>
          </div>
        )}
      </div>

      {/* Main Continuous Body of the Primary Methodology */}
      <div className="p-6 sm:p-10 space-y-10 bg-[#0b1120]">
        {primarySections.map((sec, idx) => {
          const accent = SECTION_ACCENTS[idx % SECTION_ACCENTS.length];
          return (
            <section
              key={sec.id}
              className="relative space-y-4 pb-8 border-b border-slate-800/80 last:border-b-0 last:pb-0"
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${accent.badge}`}
                    >
                      {sec.orderLabel} · {sec.spanishSubtitle}
                    </span>
                  </div>
                  <h3 className="font-editorial text-xl sm:text-2xl font-bold text-white pt-1">
                    {sec.title}
                  </h3>
                </div>

                {sec.hebrewTerm && (
                  <span
                    className={`font-hebrew text-xl sm:text-2xl font-bold ${accent.hebrewColor}`}
                    dir="rtl"
                  >
                    {sec.hebrewTerm}
                  </span>
                )}
              </div>

              {/* Prose Content */}
              <div className="font-editorial text-base sm:text-[1.15rem] text-slate-200 leading-[1.8] space-y-4 whitespace-pre-line">
                {sec.content}
              </div>

              {/* Key Insight Callout */}
              {sec.keyInsight && (
                <div
                  className={`mt-4 pl-4 py-2.5 pr-4 rounded-r-xl bg-slate-900/75 border-l-4 ${accent.borderL}`}
                >
                  <p className="text-xs sm:text-sm font-medium text-slate-200">
                    <strong className="text-sky-300 uppercase tracking-wider text-[10px] mr-2">
                      Enseñanza Clave:
                    </strong>
                    «{sec.keyInsight}»
                  </p>
                </div>
              )}
            </section>
          );
        })}

        {/* Complementary Methodology Sections */}
        {complementarySections.length > 0 && (
          <div className="pt-4 space-y-6 border-t-2 border-indigo-500/30">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-300">
                  Aportes de Metodologías Complementarias Integradas
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Enriquecimiento cruzado ({durationBadgeLabel})
              </span>
            </div>

            {complementarySections.map((sec) => (
              <section
                key={sec.id}
                className="rounded-2xl bg-indigo-950/20 border border-indigo-500/30 p-5 sm:p-7 space-y-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/40 text-indigo-200">
                      <span>{sec.orderLabel}</span>
                      <span>·</span>
                      <span>{sec.methodologyLabel || sec.spanishSubtitle}</span>
                    </span>
                    <h4 className="font-editorial text-xl sm:text-2xl font-bold text-white pt-1">
                      {sec.title}
                    </h4>
                  </div>
                  {sec.hebrewTerm && (
                    <span
                      className="font-hebrew text-xl sm:text-2xl font-bold text-indigo-300"
                      dir="rtl"
                    >
                      {sec.hebrewTerm}
                    </span>
                  )}
                </div>

                <div className="font-editorial text-base sm:text-[1.12rem] text-slate-200 leading-[1.8] space-y-4 whitespace-pre-line">
                  {sec.content}
                </div>

                {sec.keyInsight && (
                  <div className="mt-3 pl-4 py-2.5 pr-4 rounded-r-xl bg-slate-900/80 border-l-4 border-l-indigo-400">
                    <p className="text-xs sm:text-sm font-medium text-slate-200">
                      <strong className="text-indigo-300 uppercase tracking-wider text-[10px] mr-2">
                        Aporte Complementario:
                      </strong>
                      «{sec.keyInsight}»
                    </p>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {/* Practical Conclusion & Ethical Application integrated inside the essay */}
        {derasha.practicalConclusion && (
          <section className="mt-8 rounded-2xl bg-gradient-to-br from-sky-950/40 via-[#0d162c] to-slate-900/90 border border-sky-500/30 p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400 block">
                  Conclusión Práctica y Compromiso Ético
                </span>
                <h3 className="font-editorial text-xl sm:text-2xl font-bold text-white">
                  {derasha.practicalConclusion.title ||
                    'Aplicación para la Vida Cotidiana'}
                </h3>
              </div>
              <span
                className="font-hebrew text-xl text-sky-300 font-bold"
                dir="rtl"
              >
                הֲלָכָה לְמַעֲשֶׂה
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {derasha.practicalConclusion.hashkafa && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    1. Visión (Hashkafá)
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {derasha.practicalConclusion.hashkafa}
                  </p>
                </div>
              )}

              {derasha.practicalConclusion.prayerKavanah && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    2. Kavaná Interior
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {derasha.practicalConclusion.prayerKavanah}
                  </p>
                </div>
              )}

              {derasha.practicalConclusion.dailyAction && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    3. Acción Práctica (Halajá / Musar)
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {derasha.practicalConclusion.dailyAction}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Contraste Exegético Formal y Fuentes Externas Consultadas */}
        {(() => {
          const activeThinkerDetection =
            derasha.externalThinkerDetection || phase1Data?.externalThinkerDetection;
          const activeFormalContrast = derasha.formalContrast || phase1Data?.formalContrast;
          const activeExternalSources =
            (derasha.externalSources && derasha.externalSources.length > 0
              ? derasha.externalSources
              : phase1Data?.externalSources) || [];

          if (
            !activeThinkerDetection?.detected &&
            !activeFormalContrast &&
            activeExternalSources.length === 0
          ) {
            return null;
          }

          return (
            <section className="rounded-2xl bg-[#091224] border border-amber-500/35 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 block">
                    {activeThinkerDetection?.detected
                      ? `Módulo del Pipeline · Pensador Externo Detectado (${activeThinkerDetection.thinkerName})`
                      : 'Estudio Comparativo · Contraste Exegético Formal'}
                  </span>
                  <h4 className="text-base sm:text-lg font-serif font-bold text-white">
                    {activeThinkerDetection?.detected
                      ? `${activeThinkerDetection.thinkerName} (${activeThinkerDetection.specificPhilosophicalConcept}) frente a la Cosmovisión del Judaísmo`
                      : activeFormalContrast?.externalThinkerOrTradition
                      ? `${activeFormalContrast.externalThinkerOrTradition} frente a la Tradición de la Torá`
                      : 'Contraste Filosófico y Exegético'}
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-amber-200/90 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg">
                  Eijá Rabá 2:13 · Jojmá ba-Goyim taamín
                </span>
              </div>

              {activeThinkerDetection?.detected && (
                <div className="p-4 sm:p-5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block">
                        Análisis Explícito del Pipeline · Universalidad vs. Especificidad del Mandamiento
                      </span>
                      <p className="text-xs sm:text-sm text-slate-200 font-medium mt-0.5">
                        Concepto externo detectado:{' '}
                        <strong className="text-white">
                          {activeThinkerDetection.specificPhilosophicalConcept}
                        </strong>{' '}
                        <span className="text-slate-400">
                          ({activeThinkerDetection.eraAndTradition})
                        </span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-400/35 text-rose-200 font-mono text-[11px]">
                      {activeThinkerDetection.forcedExegeticalSefariaRefs.length} fuentes exegéticas forzadas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm leading-relaxed">
                    <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block">
                        1. Pretensión de Universalidad en {activeThinkerDetection.thinkerName}
                      </span>
                      <p className="text-slate-200">
                        {
                          activeThinkerDetection.universalityVsSpecificityMatrix
                            .externalConceptUniversalClaim
                        }
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/75 border border-sky-500/30 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300 block">
                        2. Horizonte Universal en la Cosmovisión Judía
                      </span>
                      <p className="text-slate-200">
                        {
                          activeThinkerDetection.universalityVsSpecificityMatrix
                            .torahUniversalHorizon
                        }
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/75 border border-amber-500/30 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                        3. Especificidad del Mandamiento en la Torá (Mitzvá)
                      </span>
                      <p className="text-slate-200">
                        {
                          activeThinkerDetection.universalityVsSpecificityMatrix
                            .torahCommandmentSpecificity
                        }
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/75 border border-emerald-500/30 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block">
                        4. Síntesis de Cosmovisión (Teonomía Relacional y Hashkafá)
                      </span>
                      <p className="text-slate-200">
                        {
                          activeThinkerDetection.universalityVsSpecificityMatrix
                            .worldviewContrastSynthesis
                        }
                      </p>
                    </div>
                  </div>

                  {/* Forced Exegetical Sefaria Sources Table */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                      Fuentes Exegéticas Canónicas Forzadas por el Pipeline para el Contraste:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {activeThinkerDetection.forcedExegeticalSefariaRefs.map((fRef) => {
                        const axisBadge =
                          fRef.contrastRole === 'UNIVERSALIDAD_TORAH'
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            : fRef.contrastRole === 'ESPECIFICIDAD_MITZVA'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                        const axisLabel =
                          fRef.contrastRole === 'UNIVERSALIDAD_TORAH'
                            ? 'Universalidad'
                            : fRef.contrastRole === 'ESPECIFICIDAD_MITZVA'
                            ? 'Especificidad Mitzvá'
                            : 'Cosmovisión Judía';
                        return (
                          <div
                            key={fRef.ref}
                            className="p-3 rounded-xl bg-slate-950/85 border border-slate-800/90 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-bold text-white">
                                {fRef.ref} · {fRef.heRef}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${axisBadge}`}
                              >
                                {axisLabel}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              {fRef.roleLabelEs}
                            </span>
                            <p className="text-[11px] text-slate-300 leading-snug">
                              {fRef.rationale}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeFormalContrast && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Eje I: Universalidad vs Especificidad del Mandamiento */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-500/25 space-y-3">
                    <h5 className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">
                      {activeFormalContrast.universalidadVsEspecificidad.title}
                    </h5>
                    <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      <p>
                        <strong className="text-white">Postura de la Fuente Externa: </strong>
                        {activeFormalContrast.universalidadVsEspecificidad.externalUniversalism}
                      </p>
                      <p>
                        <strong className="text-sky-300">Dimensión Universal en la Torá: </strong>
                        {activeFormalContrast.universalidadVsEspecificidad.torahUniversalDimension}
                      </p>
                      <p>
                        <strong className="text-amber-200">
                          Especificidad del Mandamiento (Mitzvá):{' '}
                        </strong>
                        {
                          activeFormalContrast.universalidadVsEspecificidad
                            .torahCommandmentSpecificity
                        }
                      </p>
                      <div className="pt-2 border-t border-slate-800/80 text-slate-200 italic">
                        <strong className="text-emerald-300 not-italic">
                          Síntesis Exegética:{' '}
                        </strong>
                        {activeFormalContrast.universalidadVsEspecificidad.exegeticalSynthesis}
                      </div>
                    </div>
                  </div>

                  {/* Eje II: Fuentes Internas de la Torá vs Fuentes Externas */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-sky-500/25 space-y-3">
                    <h5 className="text-xs sm:text-sm font-bold text-sky-300 uppercase tracking-wider">
                      {activeFormalContrast.fuentesInternasVsExternas.title}
                    </h5>
                    <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      <p>
                        <strong className="text-amber-200">
                          Naturaleza de las Fuentes Internas de la Torá:{' '}
                        </strong>
                        {activeFormalContrast.fuentesInternasVsExternas.internalTorahSourcesNature}
                      </p>
                      <p>
                        <strong className="text-white">
                          Naturaleza de las Fuentes Externas Consultadas:{' '}
                        </strong>
                        {activeFormalContrast.fuentesInternasVsExternas.externalSourcesNature}
                      </p>
                      <p>
                        <strong className="text-sky-300">
                          Fuente Interna del Yo vs. Fuente Externa del Pacto:{' '}
                        </strong>
                        {activeFormalContrast.fuentesInternasVsExternas.normativeLocusContrast}
                      </p>
                      <div className="pt-2 border-t border-slate-800/80 text-amber-200/90 text-xs font-medium">
                        {activeFormalContrast.fuentesInternasVsExternas.hermeneuticalRule}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeExternalSources.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Fuentes Externas Consultadas para el Estudio Comparativo ({activeExternalSources.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeExternalSources.map((ext) => (
                      <div
                        key={ext.id}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">
                              {ext.author} · <span className="italic">{ext.workTitle}</span>
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {ext.canonicalLocus} ({ext.tradition} · {ext.originalLanguage})
                            </span>
                          </div>
                          {ext.sourceUrl && (
                            <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                              Fuente Externa
                            </span>
                          )}
                        </div>
                        <blockquote className="text-xs text-slate-300 italic border-l-2 border-amber-500/40 pl-3 py-0.5">
                          «{ext.originalQuote}»
                        </blockquote>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          <strong className="text-slate-400">Traducción: </strong>
                          {ext.spanishTranslation}
                        </p>
                        {ext.torahContrastPoint && (
                          <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 leading-relaxed">
                            <strong>Contraste con la Torá: </strong>
                            {ext.torahContrastPoint}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* Proactive Sefaria English-to-Spanish Translation Proposal Banner */}
        {evaluatedSources.length > 0 && (
          <div className="rounded-2xl bg-[#091122] border border-sky-500/30 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-300 shrink-0 mt-0.5">
                  <Languages className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                    <span>
                      {untranslatedSefariaSources.length > 0
                        ? `Textos de Sefaria en inglés (${untranslatedSefariaSources.length} sin traducción al español)`
                        : `Fuentes de Sefaria traducidas al español (${evaluatedSources.length})`}
                    </span>
                  </span>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {untranslatedSefariaSources.length > 0
                      ? 'Sefaria proporciona muchas citas canónicas únicamente en hebreo e inglés. ¿Deseas traducirlas al español para tu lectura y tus documentos PDF / Word?'
                      : 'Todas las citas canónicas de Sefaria de esta lección cuentan con traducción al español.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {untranslatedSefariaSources.length > 0 && onTranslateAllSources && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineSources(true);
                      onTranslateAllSources();
                    }}
                    disabled={isTranslatingAll || Boolean(isTranslatingRef)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-60"
                  >
                    {isTranslatingAll ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Traduciendo al español...</span>
                      </>
                    ) : (
                      <>
                        <Languages className="w-3.5 h-3.5" />
                        <span>
                          Traducir {untranslatedSefariaSources.length === 1 ? '1 texto' : `los ${untranslatedSefariaSources.length} textos`} al Español
                        </span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowInlineSources(!showInlineSources)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-sky-300 transition cursor-pointer"
                >
                  <span>
                    {showInlineSources
                      ? 'Ocultar textos de Sefaria'
                      : `Ver citas de Sefaria (${evaluatedSources.length})`}
                  </span>
                </button>
              </div>
            </div>

            {showInlineSources && (
              <div className="pt-3 border-t border-slate-800/90 space-y-3">
                {evaluatedSources.map(
                  ({ source, hasSpanish, spanishText, hasEnglish, englishText }, idx) => {
                    const isTranslatingThis =
                      isTranslatingRef === source.ref || (isTranslatingAll && !hasSpanish);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <strong className="text-white">{source.ref}</strong>
                            {source.heRef && (
                              <span className="font-hebrew text-sky-400 font-bold" dir="rtl">
                                {source.heRef}
                              </span>
                            )}
                            {hasSpanish ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                                En Español
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold">
                                En Inglés (Sefaria)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {!hasSpanish && onTranslateSource && (
                              <button
                                type="button"
                                onClick={() =>
                                  onTranslateSource(
                                    source.ref,
                                    source.hebrewText,
                                    englishText
                                  )
                                }
                                disabled={isTranslatingThis}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
                              >
                                {isTranslatingThis ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Traduciendo...</span>
                                  </>
                                ) : (
                                  <>
                                    <Languages className="w-3 h-3" />
                                    <span>Traducir al español</span>
                                  </>
                                )}
                              </button>
                            )}
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-slate-400 hover:text-sky-300 inline-flex items-center gap-1"
                            >
                              <span>Sefaria</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {source.hebrewText && (
                          <p
                            dir="rtl"
                            className="font-hebrew text-base sm:text-lg text-slate-100 text-right leading-relaxed"
                          >
                            {stripAllHtml(source.hebrewText)}
                          </p>
                        )}

                        {hasSpanish ? (
                          <p className="text-xs sm:text-sm text-emerald-100/95 leading-relaxed">
                            « {spanishText} »
                          </p>
                        ) : hasEnglish ? (
                          <p className="text-xs sm:text-sm text-slate-300 italic leading-relaxed">
                            « {englishText} »
                          </p>
                        ) : null}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}

        {/* Interactive Duration & Complementary Methodology Expansion Bar */}
        {onChangeDurationOrComplementary && (
          <div className="rounded-2xl bg-[#080d1a] border border-slate-800/90 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    ¿Deseas ajustar la extensión o enriquecer con otra metodología?
                  </span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Cambia entre 5 min (breve), 10 min (estándar) o 30 min (shiur magistral) o suma otra escuela exegética.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['5_MIN', '10_MIN', '30_MIN'] as DerashaDuration[]).map((d) => {
                  const isCurrent = activeDuration === d;
                  const label =
                    d === '5_MIN' ? '5 min' : d === '10_MIN' ? '10 min' : '30 min';
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={isRegeneratingDuration || isCurrent}
                      onClick={() => onChangeDurationOrComplementary(d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                      } disabled:opacity-60`}
                    >
                      {isRegeneratingDuration && isCurrent ? (
                        <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
                      ) : null}
                      {label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={isRegeneratingDuration}
                  onClick={() => setShowAddMethodPicker(!showAddMethodPicker)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-indigo-200 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sumar Metodología</span>
                </button>
              </div>
            </div>

            {showAddMethodPicker && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <p className="text-[11px] text-slate-400">
                  Selecciona una metodología adicional para integrarla a esta drashá (se ampliará automáticamente a formato 10 o 30 min):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableAdditionalMethodologies.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isRegeneratingDuration}
                      onClick={() => {
                        setShowAddMethodPicker(false);
                        const targetDur: DerashaDuration =
                          activeDuration === '5_MIN' ? '10_MIN' : activeDuration;
                        onChangeDurationOrComplementary(targetDur, m.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-950/60 border border-slate-700/80 hover:border-indigo-500/40 text-xs text-slate-200 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-indigo-400" />
                      <span>{m.shortLabel}</span>
                      <span className="font-hebrew text-indigo-300" dir="rtl">
                        {m.hebrewLabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Quick Action Bar */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToCards}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Ver en Fichas Estructurales</span>
            </button>

            {onAskFollowUpPrompt && (
              <button
                type="button"
                onClick={() => onAskFollowUpPrompt('')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-xs font-bold text-sky-200 transition cursor-pointer shadow-sm"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-sky-300" />
                <span>Continuar Conversación / Acotar o Profundizar Estudio ↓</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickPdfExport(false)}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleQuickEditableWord}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-xs font-semibold text-indigo-200 transition cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Guardar Word (.doc)</span>
            </button>

            <button
              type="button"
              onClick={handleQuickOpenRtf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-semibold text-emerald-200 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Formato Abierto (.rtf)</span>
            </button>

            <button
              type="button"
              onClick={onOpenExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs font-semibold text-sky-300 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Todos los Formatos</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});

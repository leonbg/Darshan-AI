import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Share2,
  Printer,
  Layers,
  BookOpen,
  FileEdit,
  Sparkles,
  FileCode,
  Edit3,
} from 'lucide-react';
import {
  Phase1AnalysisResult,
  FinalDerasha,
  VerifiedSefariaSource,
  FollowUpItem,
} from '../../types';
import {
  ExportScope,
  LessonExportData,
  getMethodologyMeta,
  buildEditableMarkdown,
  generateLessonPdfBlob,
  generateWordDocBlob,
  generateOpenRtfBlob,
  generateEditableHtmlBlob,
  printLessonViaHiddenIframe,
  resolveLessonSectionsForExport,
  resolveEnrichedSourcesForExport,
  resolveExtraPardesCardsIfSeparate,
  normalizeTheologicalKeysForExport,
  getDurationBadgeLabel,
  makeSafeSlug,
  shareOrDownloadFile,
} from '../../utils/documentExport';
import { BidiText } from '../../utils/bidiText';

export type { ExportScope };

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  phase1: Phase1AnalysisResult | null;
  sources: VerifiedSefariaSource[];
  derasha: FinalDerasha | null;
  followUps?: FollowUpItem[];
  initialScope?: ExportScope;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  query,
  phase1,
  sources,
  derasha,
  followUps = [],
  initialScope = 'full_derasha',
}) => {
  const [scope, setScope] = useState<ExportScope>(initialScope);
  const [viewTab, setViewTab] = useState<'visual' | 'markdown'>('visual');
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customNote, setCustomNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setScope(initialScope);
      setCustomTitle(
        derasha?.derashaTitle || phase1?.title || query || 'Lección de Torá'
      );
    }
  }, [isOpen, initialScope, derasha?.derashaTitle, phase1?.title, query]);

  if (!isOpen) return null;

  // Build effective derasha with optional user customization before export
  const effectiveDerasha: FinalDerasha | null = derasha
    ? {
        ...derasha,
        derashaTitle: customTitle.trim() || derasha.derashaTitle,
        openingExordium: customNote.trim()
          ? `${customNote.trim()}\n\n${derasha.openingExordium}`
          : derasha.openingExordium,
      }
    : null;

  const exportPayload: LessonExportData = {
    query,
    phase1,
    sources,
    derasha: effectiveDerasha,
    followUps,
    scope,
  };

  const title =
    effectiveDerasha?.derashaTitle || phase1?.title || query || 'Lección de Torá';
  const slug = makeSafeSlug(title);
  const methodMeta = getMethodologyMeta(
    effectiveDerasha?.metodologia || phase1?.detectedMetodologia || 'PARDES'
  );
  const durationLabel = getDurationBadgeLabel(
    effectiveDerasha?.duracion || phase1?.duracion
  );
  const sections = resolveLessonSectionsForExport(effectiveDerasha, scope);
  const extraPardesCards = resolveExtraPardesCardsIfSeparate(
    effectiveDerasha,
    sections
  );
  const enrichedSources = resolveEnrichedSourcesForExport(
    sources,
    effectiveDerasha,
    phase1
  );
  const theologicalKeyEntries = normalizeTheologicalKeysForExport(
    effectiveDerasha?.theologicalKeys || phase1?.theologicalKeys
  );
  const halakhicVal =
    effectiveDerasha?.halakhicValidation || phase1?.halakhicValidation;
  const markdownText = buildEditableMarkdown(exportPayload);

  const showTempFeedback = (msg: string) => {
    setShareFeedback(msg);
    setTimeout(() => setShareFeedback(null), 4000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
      setCopied(true);
      showTempFeedback('Texto completo copiado al portapapeles');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = markdownText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      showTempFeedback('Texto completo copiado al portapapeles');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 1. PDF Export (Direct Download or Native Share)
  const handleExportPdf = async (preferShare: boolean) => {
    setIsGeneratingPdf(true);
    setShareFeedback(
      'Generando archivo PDF (.pdf) con todas las tarjetas, fuentes, análisis y desgloses...'
    );
    try {
      const blob = await generateLessonPdfBlob(exportPayload);
      const filename = `drasha-${slug}.pdf`;
      const result = await shareOrDownloadFile({
        blob,
        filename,
        title: `${title} — PDF Darshán AI`,
        text: `${title} (${methodMeta.label} · ${durationLabel} · Todas las tarjetas, raíces y fuentes)`,
        preferShare,
      });
      showTempFeedback(
        result === 'shared'
          ? `Archivo PDF completo compartido (${filename})`
          : `Archivo PDF completo descargado: ${filename}`
      );
    } catch (err) {
      console.warn('Error generating PDF blob:', err);
      printLessonViaHiddenIframe(exportPayload);
      showTempFeedback('Abriendo diálogo de impresión / Guardar como PDF...');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Vector Print-to-PDF via Hidden Iframe
  const handlePrintVectorPdf = () => {
    printLessonViaHiddenIframe(exportPayload);
    showTempFeedback(
      'Abriendo vista de impresión / Guardar como PDF vectorial...'
    );
  };

  // 3. Editable Microsoft Word / Google Docs (.doc)
  const handleExportWordDoc = async (preferShare: boolean) => {
    const blob = generateWordDocBlob(exportPayload);
    const filename = `drasha-${slug}.doc`;
    const result = await shareOrDownloadFile({
      blob,
      filename,
      title: `${title} — Documento Word Editable (.doc)`,
      text: `Lección editable en Word / Google Docs: ${title}`,
      preferShare,
    });
    showTempFeedback(
      result === 'shared'
        ? `Documento Word (.doc) compartido`
        : `Guardado en formato Word editable: ${filename}`
    );
  };

  // 4. Open Rich Text Format (.rtf) — LibreOffice, OpenOffice, WordPad, Pages, Word
  const handleExportOpenRtf = async (preferShare: boolean) => {
    const blob = generateOpenRtfBlob(exportPayload);
    const filename = `drasha-${slug}.rtf`;
    const result = await shareOrDownloadFile({
      blob,
      filename,
      title: `${title} — Formato Abierto Editable (.rtf)`,
      text: `Lección en formato abierto universal (.rtf): ${title}`,
      preferShare,
    });
    showTempFeedback(
      result === 'shared'
        ? `Documento abierto (.rtf) compartido`
        : `Guardado en formato abierto universal: ${filename}`
    );
  };

  // 5. Open Markdown (.md) — Obsidian, Notion, Logseq, Editor de texto
  const handleExportMarkdown = async (preferShare: boolean) => {
    const blob = new Blob([markdownText], {
      type: 'text/markdown;charset=utf-8',
    });
    const filename = `drasha-${slug}.md`;
    const result = await shareOrDownloadFile({
      blob,
      filename,
      title: `${title} — Markdown Abierto (.md)`,
      text: `Lección en formato Markdown abierto (.md): ${title}`,
      preferShare,
    });
    showTempFeedback(
      result === 'shared'
        ? `Archivo Markdown (.md) compartido`
        : `Guardado en formato Markdown abierto: ${filename}`
    );
  };

  // 6. Open Editable Web Document (.html with contenteditable)
  const handleExportEditableHtml = async () => {
    const blob = generateEditableHtmlBlob(exportPayload);
    const filename = `drasha-editable-${slug}.html`;
    await shareOrDownloadFile({
      blob,
      filename,
      title: `${title} — Documento Web Editable (.html)`,
      text: `Documento web editable (.html): ${title}`,
      preferShare: false,
    });
    showTempFeedback(`Guardado documento web editable: ${filename}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#0e1629] border border-sky-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial text-lg sm:text-xl font-bold text-white">
                Compartir en PDF o Guardar en Formato Editable
              </h3>
              <p className="text-xs text-slate-400">
                Incluye todas las tarjetas, fuentes verificadas en Sefaria, raíces hebreas, claves y desgloses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scope Switcher */}
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setScope('full_derasha')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  scope === 'full_derasha'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Estudio y Tarjetas Completas</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('pardes_cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  scope === 'pardes_cards'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Vista por Tarjetas</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Export & Share Control Panel */}
        <div className="px-5 py-4 bg-[#0a1020] border-b border-slate-800/90 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Card 1: PDF Download, Share & Vector Print */}
            <div className="rounded-2xl bg-slate-900/90 border border-sky-500/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. Formato PDF (.pdf)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Todas las tarjetas + fuentes + desgloses
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportPdf(false)}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs transition cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingPdf
                      ? 'Generando PDF...'
                      : 'Descargar PDF (.pdf)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportPdf(true)}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 font-semibold text-xs transition cursor-pointer disabled:opacity-60"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartir PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintVectorPdf}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-sky-400" />
                  <span>Imprimir / PDF Vectorial</span>
                </button>
              </div>
            </div>

            {/* Card 2: Editable Formats (.doc Word + Open Formats .rtf / .md / .html) */}
            <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>2. Guardar en Formato Editable (Word o Abierto)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  100% modificable
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportWordDoc(false)}
                  title="Editable en Microsoft Word, Google Docs, LibreOffice Writer y Apple Pages"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-100 font-bold text-xs transition cursor-pointer"
                >
                  <FileEdit className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Word Editable (.doc)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportOpenRtf(false)}
                  title="Formato Abierto Rich Text (.rtf) compatible con LibreOffice, OpenOffice, WordPad, TextEdit y Word"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-semibold text-xs transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Abierto Universal (.rtf)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportMarkdown(false)}
                  title="Formato Abierto Markdown (.md) para Obsidian, Notion o cualquier editor de texto"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Markdown (.md)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportEditableHtml}
                  title="Documento web abierto (.html) que permite editar el texto directamente en el navegador"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Web Editable (.html)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Utility Row: Personalize before saving, Share Editable, Copy */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingCustom(!isEditingCustom)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  isEditingCustom
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isEditingCustom
                    ? 'Ocultar edición de título / dedicatoria'
                    : 'Personalizar título o añadir nota antes de exportar'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExportWordDoc(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-indigo-300 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir .DOC</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportOpenRtf(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-emerald-300 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir .RTF</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>Copiar Todo el Texto</span>
                  </>
                )}
              </button>
            </div>

            {/* Preview Mode Switcher */}
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewTab('visual')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewTab === 'visual'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Vista Documento
              </button>
              <button
                type="button"
                onClick={() => setViewTab('markdown')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewTab === 'markdown'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Texto Editable (.md)
              </button>
            </div>
          </div>

          {/* Optional Quick Customization Fields */}
          {isEditingCustom && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/30">
              <div>
                <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                  Título personalizado para el documento:
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                  placeholder="Título de la drashá..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                  Dedicatoria, comunidad o nota introductoria (opcional):
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                  placeholder="Ej. Shabat Shalom · Comunidad Beit..."
                />
              </div>
            </div>
          )}

          {/* Status Feedback Banner */}
          {shareFeedback && (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
          )}
        </div>

        {/* Preview Content Area */}
        <div className="p-5 overflow-y-auto flex-1 bg-[#080d1a]">
          {viewTab === 'visual' ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Document Header Preview */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-widest text-sky-400 font-bold">
                    Darshán AI · {methodMeta.label} ({methodMeta.hebrewLabel}) ·{' '}
                    {durationLabel}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {sections.length + extraPardesCards.length} tarjetas ·{' '}
                    {enrichedSources.length} fuentes Sefaria ·{' '}
                    {phase1?.morphologicalBreakdown?.length || 0} raíces
                  </span>
                </div>
                <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-white">
                  {title}
                </h2>
                <p className="text-xs text-slate-400">
                  Consulta: <span className="text-slate-200">{query}</span>
                </p>

                {(phase1?.liturgicalContext || halakhicVal?.validatorSummary) && (
                  <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/25 space-y-1 text-xs text-slate-300">
                    {phase1?.liturgicalContext && (
                      <p>
                        <strong className="text-sky-300">
                          Contexto Litúrgico:
                        </strong>{' '}
                        {phase1.liturgicalContext}
                      </p>
                    )}
                    {halakhicVal?.validatorSummary && (
                      <p>
                        <strong className="text-emerald-300">
                          Validador Halájico:
                        </strong>{' '}
                        {halakhicVal.validatorSummary}
                      </p>
                    )}
                  </div>
                )}

                {phase1?.primaryHebrew && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-center space-y-1">
                    <p
                      className="font-hebrew text-xl sm:text-2xl text-sky-300 font-bold"
                      dir="rtl"
                    >
                      {phase1.primaryHebrew}
                    </p>
                    {phase1.transliteration && (
                      <p className="text-xs text-sky-200/80 italic">
                        {phase1.transliteration}
                      </p>
                    )}
                    {phase1.literalSpanishTranslation && (
                      <p className="text-xs sm:text-sm text-slate-300 font-editorial">
                        «{phase1.literalSpanishTranslation}»
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Opening Exordium Preview */}
              {effectiveDerasha?.openingExordium && (
                <div className="rounded-2xl bg-sky-950/25 border border-sky-500/30 p-4 sm:p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-1">
                    Exordio y Planteamiento Central
                  </div>
                  <BidiText
                    as="div"
                    paragraphs
                    text={effectiveDerasha.openingExordium}
                    className="font-editorial text-base text-slate-200 italic leading-relaxed space-y-2"
                  />
                </div>
              )}

              {/* All Lesson Sections Preview */}
              <div className="space-y-3">
                {[...sections, ...extraPardesCards].map((sec) => (
                  <div
                    key={sec.id}
                    className={`rounded-2xl border p-5 space-y-3 ${
                      sec.isComplementary
                        ? 'bg-indigo-950/20 border-indigo-500/35'
                        : 'bg-slate-900/75 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-2.5">
                      <div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider block ${
                            sec.isComplementary
                              ? 'text-indigo-300'
                              : 'text-sky-400'
                          }`}
                        >
                          {sec.orderLabel} · {sec.spanishSubtitle}
                        </span>
                        <h4 className="font-editorial text-lg font-bold text-white mt-0.5">
                          {sec.title}
                        </h4>
                      </div>
                      {sec.hebrewTerm && (
                        <span
                          className="font-hebrew text-xl font-bold text-sky-300"
                          dir="rtl"
                        >
                          {sec.hebrewTerm}
                        </span>
                      )}
                    </div>

                    <BidiText
                      as="div"
                      paragraphs
                      text={sec.content}
                      className="text-sm text-slate-200 leading-relaxed space-y-2"
                    />

                    {sec.keyInsight && (
                      <div className="p-3 rounded-xl bg-slate-950/80 border-l-2 border-sky-400 text-xs text-slate-200">
                        <strong className="text-sky-300">Enseñanza Clave:</strong>{' '}
                        «<BidiText text={sec.keyInsight} />»
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Practical Conclusion Preview */}
              {effectiveDerasha?.practicalConclusion && (
                <div className="rounded-2xl bg-sky-950/30 border border-sky-500/30 p-5 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 block">
                    Tarjeta de Conclusión Práctica y Aplicación
                  </span>
                  <h4 className="font-editorial text-lg font-bold text-white">
                    {effectiveDerasha.practicalConclusion.title}
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-200 pt-1">
                    {effectiveDerasha.practicalConclusion.hashkafa && (
                      <div>
                        <strong className="text-sky-300">Visión (Hashkafá):</strong>{' '}
                        <BidiText text={effectiveDerasha.practicalConclusion.hashkafa} />
                      </div>
                    )}
                    {effectiveDerasha.practicalConclusion.prayerKavanah && (
                      <div>
                        <strong className="text-amber-300">Kavaná Interior:</strong>{' '}
                        <BidiText text={effectiveDerasha.practicalConclusion.prayerKavanah} />
                      </div>
                    )}
                    {effectiveDerasha.practicalConclusion.dailyAction && (
                      <div>
                        <strong className="text-emerald-300">
                          Acción Práctica Cotidiana:
                        </strong>{' '}
                        <BidiText text={effectiveDerasha.practicalConclusion.dailyAction} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Morphological Breakdown Card Preview */}
              {((phase1?.morphologicalBreakdown &&
                phase1.morphologicalBreakdown.length > 0) ||
                effectiveDerasha?.morphologicalSynthesis) && (
                <div className="rounded-2xl bg-indigo-950/20 border border-indigo-500/30 p-5 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 block">
                    Tarjeta de Desglose Morfológico y Raíces Hebreas (Shoresh)
                  </span>
                  {effectiveDerasha?.morphologicalSynthesis?.summary && (
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {effectiveDerasha.morphologicalSynthesis.summary}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(phase1?.morphologicalBreakdown || []).map((m, idx) => (
                      <div
                        key={`${m.hebrewWord}-${idx}`}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-indigo-300">
                            Raíz: {m.root} ({m.rootMeaning})
                          </span>
                          <span
                            className="font-hebrew text-lg font-bold text-white"
                            dir="rtl"
                          >
                            {m.hebrewWord}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {m.binyan} · {m.tense}
                        </p>
                        <p className="text-slate-200">
                          {m.theologicalImplication}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4 Theological Keys Card Preview */}
              {theologicalKeyEntries.length > 0 && (
                <div className="rounded-2xl bg-teal-950/20 border border-teal-500/30 p-5 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300 block">
                    Tarjeta de Las 4 Claves Teológicas y Exegéticas
                  </span>
                  <div className="space-y-2.5 text-xs text-slate-200">
                    {theologicalKeyEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-teal-300">
                            {entry.label} — {entry.title}
                          </strong>
                          <span
                            className="font-hebrew text-sm text-teal-200"
                            dir="rtl"
                          >
                            {entry.hebrew}
                          </span>
                        </div>
                        <p className="text-slate-200">{entry.explanation}</p>
                        {entry.subDetails.map((d, i) => (
                          <p key={i} className="text-[11px] text-slate-400">
                            • {d}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Canonical Analysis & All Verified Sefaria Sources Card Preview */}
              {(effectiveDerasha?.canonicalAnalysis?.synthesis ||
                enrichedSources.length > 0) && (
                <div className="rounded-2xl bg-slate-900/90 border border-sky-500/30 p-5 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 block">
                    Tarjeta de Análisis Canónico y Fuentes de Sefaria (
                    {enrichedSources.length})
                  </span>
                  {effectiveDerasha?.canonicalAnalysis?.synthesis && (
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {effectiveDerasha.canonicalAnalysis.synthesis}
                    </p>
                  )}
                  <div className="space-y-2.5">
                    {enrichedSources.map((src, i) => (
                      <div
                        key={`${src.ref}-${i}`}
                        className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sky-300">
                            {i + 1}. {src.ref} ({src.category})
                          </span>
                          {src.heRef && (
                            <span
                              className="font-hebrew text-sm text-sky-200"
                              dir="rtl"
                            >
                              {src.heRef}
                            </span>
                          )}
                        </div>
                        {src.rationale && (
                          <p className="text-[11px] text-sky-300/90 italic">
                            Relevancia: {src.rationale}
                          </p>
                        )}
                        {src.hebrewClean && (
                          <p
                            className="font-hebrew text-base text-white text-right leading-relaxed"
                            dir="rtl"
                          >
                            {src.hebrewClean}
                          </p>
                        )}
                        {src.spanishClean && (
                          <p className="text-slate-200">«{src.spanishClean}»</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contemporary Masters Card Preview */}
              {effectiveDerasha?.contemporaryMasters?.readings &&
                effectiveDerasha.contemporaryMasters.readings.length > 0 && (
                  <div className="rounded-2xl bg-purple-950/20 border border-purple-500/30 p-5 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300 block">
                      Tarjeta de Lecturas de Maestros Contemporáneos
                    </span>
                    {effectiveDerasha.contemporaryMasters.overview && (
                      <p className="text-xs text-slate-300 italic">
                        {effectiveDerasha.contemporaryMasters.overview}
                      </p>
                    )}
                    <div className="space-y-2.5">
                      {effectiveDerasha.contemporaryMasters.readings.map(
                        (r, idx) => (
                          <div
                            key={`${r.masterName}-${idx}`}
                            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-purple-300">
                                {r.masterName} ({r.masterTitle}) —{' '}
                                {r.cycleOrSeries}
                              </strong>
                            </div>
                            <p className="text-slate-200 font-semibold">
                              {r.readingTitle}: {r.coreThesis}
                            </p>
                            <BidiText
                              as="div"
                              paragraphs
                              text={r.detailedExposition}
                              className="text-slate-300 space-y-1.5"
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Follow-Ups Card Preview */}
              {followUps.length > 0 && (
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 block">
                    Tarjeta de Diálogo Exegético y Ampliaciones (
                    {followUps.length})
                  </span>
                  {followUps.map((f, i) => (
                    <div
                      key={f.id || i}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="font-bold text-sky-300">
                        P{i + 1}: <BidiText text={f.question} />
                      </div>
                      <BidiText
                        as="div"
                        paragraphs
                        text={f.answer}
                        className="text-slate-200 space-y-1.5"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-all">
              {markdownText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

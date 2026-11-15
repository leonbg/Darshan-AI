import React, { useMemo, useState, useCallback } from 'react';
import {
  Copy,
  Check,
  Scroll,
  Layers,
  Share2,
  BookOpen,
  Compass,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  FinalDerasha,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
} from '../../types';
import {
  getDurationBadgeLabel,
  getMethodologyMeta,
} from '../../utils/methodologyCatalog';
import {
  buildDerashaSummaryShareText,
  resolveDerashaExecutiveSummary,
} from '../../utils/derashaSummary';
import { getToneMeta } from '../../utils/toneAdvisor';

interface DerashaSummaryCardProps {
  derasha: FinalDerasha;
  phase1Data: Phase1AnalysisResult | null;
  sources: VerifiedSefariaSource[];
  onSwitchToEssay: () => void;
  onSwitchToCards: () => void;
  onOpenExport: () => void;
}

export const DerashaSummaryCard: React.FC<DerashaSummaryCardProps> = React.memo(
  ({
    derasha,
    phase1Data,
    sources,
    onSwitchToEssay,
    onSwitchToCards,
    onOpenExport,
  }) => {
    const [copied, setCopied] = useState(false);

    const summary = useMemo(
      () => resolveDerashaExecutiveSummary(derasha, phase1Data, sources),
      [derasha, phase1Data, sources]
    );

    const methodMeta = useMemo(
      () =>
        getMethodologyMeta(
          derasha.metodologia || phase1Data?.detectedMetodologia || 'PARDES'
        ),
      [derasha.metodologia, phase1Data?.detectedMetodologia]
    );

    const durationLabel = useMemo(
      () => getDurationBadgeLabel(derasha.duracion || phase1Data?.duracion),
      [derasha.duracion, phase1Data?.duracion]
    );

    const activeToneMeta = useMemo(
      () =>
        derasha.resolvedTone || phase1Data?.resolvedTone
          ? getToneMeta(derasha.resolvedTone || phase1Data?.resolvedTone)
          : null,
      [derasha.resolvedTone, phase1Data?.resolvedTone]
    );

    const handleCopySummary = useCallback(async () => {
      const text = buildDerashaSummaryShareText(derasha, summary, phase1Data);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        onOpenExport();
      }
    }, [derasha, summary, phase1Data, onOpenExport]);

    const readingSeconds = summary.estimatedReadingSec || 60;

    return (
      <article className="editorial-surface rounded-3xl overflow-hidden border border-sky-500/25 shadow-2xl">
        {/* Editorial Header */}
        <div className="bg-gradient-to-b from-sky-950/40 via-[#0c1427] to-[#0b1120] p-6 sm:p-9 border-b border-slate-800/90 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-widest text-sky-400">
                <Compass className="w-3.5 h-3.5" />
                <span>Resumen Ejecutivo</span>
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-medium text-slate-200">
                {methodMeta.shortLabel}
              </span>
              <span className="font-hebrew text-sky-300 text-sm" dir="rtl">
                {methodMeta.hebrewLabel}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300/90 font-medium">
                {durationLabel}
              </span>
              {activeToneMeta && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-300/90 font-medium">
                    {activeToneMeta.shortLabel}
                  </span>
                </>
              )}
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 text-slate-400 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Lectura ~{readingSeconds} s</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Resumen copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>Copiar Resumen</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs font-semibold text-sky-300 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          <h2 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-[1.18] tracking-tight text-balance">
            {derasha.derashaTitle || phase1Data?.title || 'Resumen de la Drashá'}
          </h2>

          {/* Compact Primary Hebrew Reference */}
          {phase1Data?.primaryHebrew && (
            <div className="rounded-2xl bg-[#070c18]/85 border border-slate-800/90 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {phase1Data.literalSpanishTranslation && (
                <p className="font-editorial text-sm sm:text-base text-slate-300 italic">
                  «{phase1Data.literalSpanishTranslation}»
                </p>
              )}
              <p
                className="font-hebrew text-xl sm:text-2xl text-white font-bold text-right shrink-0"
                dir="rtl"
              >
                {phase1Data.primaryHebrew}
              </p>
            </div>
          )}
        </div>

        {/* Summary Content Body */}
        <div className="p-6 sm:p-9 space-y-8 bg-[#0b1120]">
          {/* Tesis Central */}
          <section className="rounded-2xl bg-[#070c18]/90 border border-sky-500/25 p-5 sm:p-6 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400 block">
              Tesis Central de la Drashá
            </span>
            <p className="font-editorial text-lg sm:text-xl text-white leading-relaxed font-semibold text-balance">
              {summary.headlineThesis}
            </p>
          </section>

          {/* Síntesis Narrativa */}
          <section className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block">
              Síntesis Narrativa (Visión Panorámica)
            </span>
            <p className="font-editorial text-base sm:text-[1.12rem] text-slate-200 leading-[1.8]">
              {summary.abstractNarrative}
            </p>
          </section>

          {/* Pilares y Puntos Clave */}
          {summary.keyPillars.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Ejes Argumentales y Puntos Clave
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {summary.keyPillars.length} puntos medulares
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.keyPillars.map((pillar, idx) => (
                  <div
                    key={`${idx}-${pillar.label}`}
                    className="rounded-2xl bg-[#090f1d]/90 border border-slate-800/90 p-4 sm:p-5 space-y-2"
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs font-bold text-sky-400 tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-editorial text-base sm:text-lg font-bold text-white leading-snug">
                        {pillar.label}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {pillar.takeaway}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Aplicación Práctica + Fuentes Canónicas Clave */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl bg-[#081224]/80 border border-emerald-500/25 p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  Aplicación Práctica (Halajá y Musar)
                </span>
              </div>
              <p className="font-editorial text-base text-slate-100 leading-relaxed">
                {summary.practicalTakeaway}
              </p>
            </section>

            <section className="rounded-2xl bg-[#090f1d]/90 border border-slate-800/90 p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-300">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Fuentes Canónicas de Sefaria
                  </span>
                </div>
                {sources.length > 0 && (
                  <span className="text-xs text-slate-500 tabular-nums">
                    {sources.length} verificadas
                  </span>
                )}
              </div>
              {summary.coreSourcesDigest.length > 0 ? (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {summary.coreSourcesDigest.join(' · ')}
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Fuentes clásicas integradas en el cuerpo de la Drashá.
                </p>
              )}
            </section>
          </div>

          {/* Navigation Footer */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSwitchToEssay}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer"
              >
                <Scroll className="w-3.5 h-3.5" />
                <span>Leer Drashá Completa</span>
              </button>

              <button
                type="button"
                onClick={onSwitchToCards}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Ver en Fichas por Sección</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs font-semibold text-sky-300 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Exportar Documento Completo</span>
            </button>
          </div>
        </div>
      </article>
    );
  }
);

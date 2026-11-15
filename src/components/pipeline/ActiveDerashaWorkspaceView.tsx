import React, { useState, useCallback, useMemo } from 'react';
import {
  Scroll,
  Layers,
  Share2,
  Type,
  BookOpen,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  DerashaDuration,
  DerashaMethodology,
  FinalDerasha,
  FollowUpItem,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
} from '../../types';
import { ExportScope } from '../layout/ExportModal';
import { AtrilReadingScale } from '../../hooks/useAtrilPreferences';
import { CompleteDerashaEssay } from './CompleteDerashaEssay';
import { PardesView } from './PardesView';
import { PracticalConclusionCard } from './PracticalConclusionCard';
import { ExegesisFollowUp } from './ExegesisFollowUp';
import { CanonicalSourcesCard } from './CanonicalSourcesCard';
import { MorphologyCard } from './MorphologyCard';
import { TheologicalKeysCard } from './TheologicalKeysCard';
import { ContemporaryMastersCard } from './ContemporaryMastersCard';

interface ActiveDerashaWorkspaceViewProps {
  query: string;
  phase1Data: Phase1AnalysisResult | null;
  verifiedSources: VerifiedSefariaSource[];
  finalDerasha: FinalDerasha;
  followUps: FollowUpItem[];
  isExpanding: boolean;
  isRegeneratingDuration: boolean;
  translatingRef: string | null;
  isTranslatingAll: boolean;
  isLoadingMasters: boolean;
  readingScale: AtrilReadingScale;
  scaleClass: string;
  typographyClass: string;
  onCycleReadingScale: () => void;
  onToggleAtrilConfig: () => void;
  onOpenExportWithScope: (scope: ExportScope) => void;
  onAskFollowUp: (question: string) => Promise<void>;
  onRefineFullStudy: (refinedQuery: string) => void;
  onChangeDurationOrComplementary: (
    newDuration: DerashaDuration,
    extraMethodology?: DerashaMethodology
  ) => Promise<void>;
  onTranslateSource: (ref: string, hebrewText: string, englishText: string) => Promise<void>;
  onTranslateAllSources: () => Promise<void>;
  onRequestMasterReadings: (
    focusMaster: 'all' | 'sacks' | 'gordon' | 'soloveitchik' | 'hirsch',
    specificAngle?: string
  ) => Promise<void>;
}

export const ActiveDerashaWorkspaceView: React.FC<ActiveDerashaWorkspaceViewProps> = React.memo(
  ({
    query,
    phase1Data,
    verifiedSources,
    finalDerasha,
    followUps,
    isExpanding,
    isRegeneratingDuration,
    translatingRef,
    isTranslatingAll,
    isLoadingMasters,
    readingScale,
    scaleClass,
    typographyClass,
    onCycleReadingScale,
    onToggleAtrilConfig,
    onOpenExportWithScope,
    onAskFollowUp,
    onRefineFullStudy,
    onChangeDurationOrComplementary,
    onTranslateSource,
    onTranslateAllSources,
    onRequestMasterReadings,
  }) => {
    const [viewMode, setViewMode] = useState<'essay' | 'cards'>('essay');
    const [isDeepBreakdownOpen, setIsDeepBreakdownOpen] = useState(false);

    const handleSelectEssayView = useCallback(() => setViewMode('essay'), []);
    const handleSelectCardsView = useCallback(() => setViewMode('cards'), []);
    const handleToggleDeepBreakdown = useCallback(
      () => setIsDeepBreakdownOpen((prev) => !prev),
      []
    );

    const handleOpenFullExport = useCallback(
      () => onOpenExportWithScope('full_derasha'),
      [onOpenExportWithScope]
    );
    const handleOpenPardesExport = useCallback(
      () => onOpenExportWithScope('full_derasha'),
      [onOpenExportWithScope]
    );
    const handleOpenCurrentViewExport = useCallback(
      () => onOpenExportWithScope('full_derasha'),
      [onOpenExportWithScope]
    );

    const handleAskFollowUpPrompt = useCallback(
      (prompt: string) => {
        const el = document.getElementById('followup-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          const inputEl = document.getElementById('followup-input');
          if (inputEl) inputEl.focus();
        }, 250);
        if (prompt && prompt.trim()) {
          onAskFollowUp(prompt);
        }
      },
      [onAskFollowUp]
    );

    const handleMastersFollowUp = useCallback(
      (q: string) => {
        onAskFollowUp(q);
        const el = document.getElementById('followup-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      },
      [onAskFollowUp]
    );

    const effectiveExternalSources = useMemo(
      () => finalDerasha?.externalSources || phase1Data?.externalSources,
      [finalDerasha?.externalSources, phase1Data?.externalSources]
    );

    const effectiveFormalContrast = useMemo(
      () => finalDerasha?.formalContrast || phase1Data?.formalContrast,
      [finalDerasha?.formalContrast, phase1Data?.formalContrast]
    );

    const effectiveDerashaTitle = useMemo(
      () => finalDerasha?.derashaTitle || phase1Data?.title,
      [finalDerasha?.derashaTitle, phase1Data?.title]
    );

    return (
      <div className={`space-y-6 pt-1 ${scaleClass} ${typographyClass}`}>
        {/* Minimal Sticky Switcher: Drashá Completa vs Fichas + Modo Atril (A / A+ / A++) + Exportar */}
        <div className="sticky top-16 z-30 py-2.5 bg-[#0b1120]/95 backdrop-blur-md border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#090f1d] p-1 rounded-xl border border-slate-800 text-xs gap-1">
              <button
                type="button"
                onClick={handleSelectEssayView}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'essay'
                    ? 'bg-sky-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Scroll className="w-3.5 h-3.5" />
                <span>Drashá Completa</span>
              </button>
              <button
                type="button"
                onClick={handleSelectCardsView}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'cards'
                    ? 'bg-sky-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Fichas por Sección</span>
              </button>
            </div>

            {/* Modo Atril / Tamaño de Lectura */}
            <button
              type="button"
              onClick={onCycleReadingScale}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                readingScale !== 'normal'
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-semibold'
                  : 'bg-[#090f1d] border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Alternar tamaño de letra para lectura en atril (A -> A+ -> A++)"
            >
              <Type className="w-3.5 h-3.5" />
              <span>
                {readingScale === 'bima'
                  ? 'Modo Bimá (A++)'
                  : readingScale === 'atril'
                  ? 'Modo Atril (A+)'
                  : 'Letra Atril (A+)'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleAtrilConfig}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#090f1d] border border-slate-800 text-slate-400 hover:text-amber-200 transition cursor-pointer whitespace-nowrap"
              title="Abrir selector de fuentes (Serif, Sans Serif, Hebreo Tradicional)"
            >
              <span>Fuentes</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCurrentViewExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 transition-all cursor-pointer whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir PDF / Guardar Editable (.doc · .rtf)</span>
          </button>
        </div>

        {/* Vista A: Discurso Continuo de la Drashá */}
        {viewMode !== 'cards' ? (
          <section id="complete-essay-section">
            <CompleteDerashaEssay
              derasha={finalDerasha}
              phase1Data={phase1Data}
              sources={verifiedSources}
              followUps={followUps}
              onOpenExport={handleOpenFullExport}
              onSwitchToCards={handleSelectCardsView}
              onAskFollowUpPrompt={handleAskFollowUpPrompt}
              onChangeDurationOrComplementary={onChangeDurationOrComplementary}
              isRegeneratingDuration={isRegeneratingDuration}
              onTranslateSource={onTranslateSource}
              onTranslateAllSources={onTranslateAllSources}
              isTranslatingRef={translatingRef}
              isTranslatingAll={isTranslatingAll}
            />
          </section>
        ) : (
          /* Vista B: Fichas Estructurales + Conclusión Práctica */
          <div className="space-y-6">
            <section id="pardes-section">
              <PardesView
                derasha={finalDerasha}
                query={query}
                phase1={phase1Data}
                sources={verifiedSources}
                onOpenExportPardes={handleOpenPardesExport}
              />
            </section>

            {finalDerasha.practicalConclusion && (
              <section id="conclusion-section">
                <PracticalConclusionCard
                  conclusion={finalDerasha.practicalConclusion}
                  onExport={handleOpenPardesExport}
                />
              </section>
            )}
          </div>
        )}

        {/* MESA DIRECTA Y SIEMPRE VISIBLE PARA CONTINUAR LA CONVERSACIÓN */}
        <section id="followup-section" className="scroll-mt-24">
          <ExegesisFollowUp
            onAskQuestion={onAskFollowUp}
            onRefineFullStudy={onRefineFullStudy}
            followUps={followUps}
            isLoading={isExpanding}
            query={query}
            derashaTitle={effectiveDerashaTitle}
          />
        </section>

        {/* ABANICO DESPLEGABLE AL FINAL: Desglose Morfológico, Claves, Fuentes Sefaria y Maestros */}
        <section className="editorial-surface rounded-2xl overflow-hidden border border-slate-800/90">
          <button
            type="button"
            onClick={handleToggleDeepBreakdown}
            className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-900/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-editorial font-bold text-white">
                  {isDeepBreakdownOpen
                    ? 'Ocultar abanico de desglose técnico y fuentes'
                    : 'Abrir abanico de desglose profundo (Raíces Hebreas, Fuentes Sefaria y Maestros)'}
                </h3>
                <p className="text-xs text-slate-400">
                  Morfología gramatical, {verifiedSources.length} fuentes verificadas en Sefaria y lecturas de Jonathan Sacks / Rab Gordon.
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#090f1d] border border-slate-800 text-xs font-medium text-sky-300 shrink-0">
              <span>{isDeepBreakdownOpen ? 'Cerrar' : 'Ver desglose'}</span>
              {isDeepBreakdownOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>

          {isDeepBreakdownOpen && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 space-y-8 bg-[#080d1a]/60">
              {verifiedSources.length > 0 && (
                <section id="sources-section">
                  <CanonicalSourcesCard
                    sources={verifiedSources}
                    canonicalAnalysis={finalDerasha?.canonicalAnalysis}
                    externalSources={effectiveExternalSources}
                    formalContrast={effectiveFormalContrast}
                    onTranslateSource={onTranslateSource}
                    onTranslateAllSources={onTranslateAllSources}
                    isTranslatingRef={translatingRef}
                    isTranslatingAll={isTranslatingAll}
                  />
                </section>
              )}

              {phase1Data?.morphologicalBreakdown && (
                <section id="morphology-section">
                  <MorphologyCard
                    primaryHebrew={phase1Data.primaryHebrew}
                    transliteration={phase1Data.transliteration}
                    literalSpanishTranslation={phase1Data.literalSpanishTranslation}
                    liturgicalContext={phase1Data.liturgicalContext}
                    items={phase1Data.morphologicalBreakdown}
                    synthesis={finalDerasha?.morphologicalSynthesis}
                  />
                </section>
              )}

              {phase1Data?.theologicalKeys && (
                <section id="theological-keys-section">
                  <TheologicalKeysCard keys={phase1Data.theologicalKeys} />
                </section>
              )}

              <section id="contemporary-masters-section">
                <ContemporaryMastersCard
                  synthesis={finalDerasha.contemporaryMasters}
                  onRequestMoreReadings={onRequestMasterReadings}
                  onAskFollowUp={handleMastersFollowUp}
                  isLoading={isLoadingMasters}
                />
              </section>
            </div>
          )}
        </section>
      </div>
    );
  }
);

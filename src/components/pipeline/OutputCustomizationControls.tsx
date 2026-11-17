import React from 'react';
import {
  SlidersHorizontal,
  Star,
  RotateCcw,
  Compass,
  RefreshCw,
} from 'lucide-react';
import {
  ConclusionLength,
  DerashaOutputPreferences,
  PardesAnalysisDepth,
  PardesLevelKey,
} from '../../types';
import {
  CONCLUSION_LENGTH_OPTIONS,
  PARDES_DEPTH_OPTIONS,
  PARDES_LEVEL_META,
  PARDES_LEVEL_ORDER,
  hasCustomOutputPreferences,
  normalizeDerashaOutputPreferences,
} from '../../utils/outputPreferences';

interface OutputCustomizationControlsProps {
  preferences: DerashaOutputPreferences;
  onChangePardesDepth: (level: PardesLevelKey, depth: PardesAnalysisDepth) => void;
  onTogglePrioritizedLevel: (level: PardesLevelKey) => void;
  onChangeConclusionLength: (length: ConclusionLength) => void;
  onApplyAllPardesDepth?: (depth: PardesAnalysisDepth) => void;
  onResetPreferences: () => void;
  disabled?: boolean;
  compact?: boolean;
  /** Optional live re-synthesis button when an active Drashá is already loaded */
  onApplyAndRegenerate?: () => void;
  isRegenerating?: boolean;
  hasUnsavedStudyChanges?: boolean;
}

export const OutputCustomizationControls: React.FC<OutputCustomizationControlsProps> = React.memo(
  ({
    preferences,
    onChangePardesDepth,
    onTogglePrioritizedLevel,
    onChangeConclusionLength,
    onApplyAllPardesDepth,
    onResetPreferences,
    disabled = false,
    compact = false,
    onApplyAndRegenerate,
    isRegenerating = false,
    hasUnsavedStudyChanges = false,
  }) => {
    const normalized = normalizeDerashaOutputPreferences(preferences);
    const isCustomized = hasCustomOutputPreferences(normalized);

    return (
      <div
        className={`rounded-xl bg-[#090f1d]/90 border border-slate-800 ${
          compact ? 'p-3.5 space-y-3.5' : 'p-4 sm:p-5 space-y-5'
        }`}
      >
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                {compact
                  ? '5. Personalización de Salida: Niveles PARDÉS y Conclusión Final'
                  : 'Personalización de Salida: Profundidad PARDÉS, Prioridades y Conclusión'}
              </span>
            </span>
            <p className="text-[11px] text-slate-400">
              Ajusta la extensión analítica de cada nivel del PARDÉS, marca qué niveles priorizar y define el detalle de la conclusión práctica.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onApplyAllPardesDepth && (
              <div className="inline-flex items-center gap-1 rounded-lg bg-[#070c18] border border-slate-800 p-0.5 text-[10px]">
                <span className="px-1.5 text-slate-500 whitespace-nowrap">Todos:</span>
                {PARDES_DEPTH_OPTIONS.map((opt) => {
                  const allMatch = PARDES_LEVEL_ORDER.every(
                    (lvl) => normalized.pardesDepth[lvl] === opt.id
                  );
                  return (
                    <button
                      key={`all-${opt.id}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => onApplyAllPardesDepth(opt.id)}
                      className={`px-2 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                        allMatch
                          ? 'bg-slate-800 text-sky-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {isCustomized && (
              <button
                type="button"
                disabled={disabled}
                onClick={onResetPreferences}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-amber-300 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar estándar</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 PARDES Levels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PARDES_LEVEL_ORDER.map((lvlKey) => {
            const meta = PARDES_LEVEL_META[lvlKey];
            const activeDepth = normalized.pardesDepth[lvlKey];
            const isPrioritized = normalized.prioritizedLevels.includes(lvlKey);
            const activeDepthMeta =
              PARDES_DEPTH_OPTIONS.find((d) => d.id === activeDepth) ||
              PARDES_DEPTH_OPTIONS[1];

            return (
              <div
                key={lvlKey}
                className={`p-3 rounded-xl border transition space-y-2.5 ${
                  isPrioritized
                    ? meta.activeBorder
                    : 'bg-[#070c18] border-slate-800/90'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${meta.accentText}`}>
                        {meta.label}
                      </span>
                      <span
                        className="font-hebrew text-xs text-slate-400"
                        dir="rtl"
                      >
                        {meta.hebrewLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                      {meta.focusDescription}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onTogglePrioritizedLevel(lvlKey)}
                    aria-pressed={isPrioritized}
                    title={
                      isPrioritized
                        ? `Quitar prioridad de ${meta.label}`
                        : `Priorizar ${meta.label} en la generación de la Drashá`
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      isPrioritized
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                    }`}
                  >
                    <Star
                      className={`w-3 h-3 ${
                        isPrioritized ? 'fill-slate-950 text-slate-950' : 'text-amber-300'
                      }`}
                    />
                    <span>{isPrioritized ? 'Prioritario' : 'Priorizar'}</span>
                  </button>
                </div>

                {/* Segmented Depth Control */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    Profundidad: <strong className="text-slate-300">{activeDepthMeta.shortHint}</strong>
                  </span>
                  <div className="inline-flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-0.5 gap-0.5">
                    {PARDES_DEPTH_OPTIONS.map((opt) => {
                      const isSelected = activeDepth === opt.id;
                      return (
                        <button
                          key={`${lvlKey}-${opt.id}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => onChangePardesDepth(lvlKey, opt.id)}
                          title={opt.wordGuidance}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-sky-400 text-slate-950 font-semibold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Final Conclusion Desired Length */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Extensión de la Conclusión Final (Hashkafá, Kavaná y Acción Práctica)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CONCLUSION_LENGTH_OPTIONS.map((opt) => {
              const isSelected = normalized.conclusionLength === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeConclusionLength(opt.id)}
                  className={`text-left px-3 py-2 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-400/60 text-white'
                      : 'bg-[#070c18] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold whitespace-nowrap">{opt.label}</span>
                    <span
                      className={`text-[10px] whitespace-nowrap ${
                        isSelected ? 'text-emerald-300 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {opt.shortHint}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Apply & Re-synthesize Action (for Active Workspace or Settings Modal) */}
        {onApplyAndRegenerate && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {hasUnsavedStudyChanges
                ? 'Tienes cambios respecto a la Drashá actual en pantalla.'
                : 'Re-sintetiza la Drashá actual conservando las fuentes ya verificadas en Sefaria.'}
            </span>
            <button
              type="button"
              disabled={disabled || isRegenerating}
              onClick={onApplyAndRegenerate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>
                {isRegenerating
                  ? 'Re-sintetizando Drashá...'
                  : 'Aplicar y regenerar Drashá'}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }
);

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Check,
  RefreshCw,
  Sparkles,
  Database,
  FileText,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { PipelineStage } from '../../types';

interface PhaseProgressIndicatorProps {
  currentStage: PipelineStage;
  currentRefIndex?: number;
  totalRefs?: number;
  error?: string | null;
  elapsedSeconds?: number;
  maxWaitSeconds?: number;
  methodologyDecisionSeconds?: number;
  lessonElaborationBudgetSeconds?: number;
  wasPrewarmed?: boolean;
  onCancel?: () => void;
  onStageTimeout?: () => void;
}

export const PhaseProgressIndicator: React.FC<PhaseProgressIndicatorProps> = React.memo(({
  currentStage,
  currentRefIndex = 0,
  totalRefs = 0,
  error,
  elapsedSeconds: externalElapsedSeconds,
  maxWaitSeconds = 420,
  methodologyDecisionSeconds = 0,
  lessonElaborationBudgetSeconds = 420,
  wasPrewarmed = false,
  onCancel,
  onStageTimeout,
}) => {
  const [internalElapsed, setInternalElapsed] = useState<number>(0);
  const onStageTimeoutRef = useRef(onStageTimeout);
  onStageTimeoutRef.current = onStageTimeout;

  const isRunning =
    currentStage === 'phase1_morphology' ||
    currentStage === 'phase2_sefaria' ||
    currentStage === 'phase3_derasha';

  // Self-contained per-stage timer so App.tsx does not need to re-render every second during generation
  useEffect(() => {
    setInternalElapsed(0);
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setInternalElapsed((prev) => {
        const next = prev + 1;
        if (next >= maxWaitSeconds) {
          onStageTimeoutRef.current?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentStage, isRunning, maxWaitSeconds]);

  const displayElapsedSeconds =
    typeof externalElapsedSeconds === 'number' && externalElapsedSeconds > 0
      ? externalElapsedSeconds
      : internalElapsed;

  const phases = useMemo(
    () => [
      {
        id: 'phase1_morphology',
        num: 1,
        title: 'Fase 1: Morfología & Referencias',
        subtitle: wasPrewarmed
          ? 'Completado en 2º plano durante escogencia de metodología (0s consumidos)'
          : 'Análisis de raíces trilíteras, binyan y deducción de fuentes canónicas judías',
        icon: Sparkles,
      },
      {
        id: 'phase2_sefaria',
        num: 2,
        title: 'Fase 2: Verificación en Biblioteca Sefaria',
        subtitle: wasPrewarmed
          ? 'Fuentes masoréticas pre-cargadas durante escogencia de metodología (0s consumidos)'
          : totalRefs > 0
          ? `Recuperando textos hebreos masoréticos y traducciones (${currentRefIndex}/${totalRefs})`
          : 'Consulta en paralelo a los textos canónicos de Sefaria',
        icon: Database,
      },
      {
        id: 'phase3_derasha',
        num: 3,
        title: 'Fase 3: Elaboración de la Lección (Drashá)',
        subtitle: `Reloj reiniciado a 0s · Presupuesto íntegro de ${lessonElaborationBudgetSeconds}s exclusivos para redactar`,
        icon: FileText,
      },
    ],
    [wasPrewarmed, totalRefs, currentRefIndex, lessonElaborationBudgetSeconds]
  );

  if (currentStage === 'idle') return null;

  const isLongWaitWarning = isRunning && displayElapsedSeconds >= 180;

  const getStatus = (phaseId: string) => {
    if (error) return 'error';
    if (currentStage === 'complete') return 'done';

    if (currentStage === 'phase1_morphology') {
      if (phaseId === 'phase1_morphology') return 'active';
      return 'pending';
    }
    if (currentStage === 'phase2_sefaria') {
      if (phaseId === 'phase1_morphology') return 'done';
      if (phaseId === 'phase2_sefaria') return 'active';
      return 'pending';
    }
    if (currentStage === 'phase3_derasha') {
      if (phaseId === 'phase1_morphology' || phaseId === 'phase2_sefaria') return 'done';
      if (phaseId === 'phase3_derasha') return 'active';
      return 'pending';
    }
    return 'pending';
  };

  return (
    <div className="bg-[#1e293b]/85 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Relojes Independientes · Escogencia de Metodología vs. Elaboración de la Lección</span>
          {isRunning && !error && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
          )}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {methodologyDecisionSeconds > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
              title="Tiempo invertido escogiendo metodologías: aislado en su propio reloj, 0 segundos descontados del tiempo de elaboración de la lección."
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Escogencia: {methodologyDecisionSeconds}s (0s descontados)</span>
            </span>
          )}

          {isRunning && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border ${
                isLongWaitWarning
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                  : 'bg-slate-900/90 border-slate-800 text-sky-300'
              }`}
              title={`Reloj exclusivo de la fase actual (${maxWaitSeconds}s máx.). El tiempo de escogencia entre metodologías no consume ni un segundo de la elaboración de la lección.`}
            >
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {currentStage === 'phase3_derasha' ? 'Elaboración de lección' : 'Fase actual'}:{' '}
                {displayElapsedSeconds}s / {maxWaitSeconds}s
              </span>
            </span>
          )}

          {isRunning && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Detener / Acotar consulta</span>
            </button>
          )}

          {currentStage === 'complete' && (
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Drashá Generada con Éxito</span>
            </span>
          )}
        </div>
      </div>

      {/* Warning banner when wait exceeds 180 seconds */}
      {isLongWaitWarning && (
        <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/35 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Espera prolongada detectada ({displayElapsedSeconds}s):</strong> El análisis está
              tomando más tiempo de lo habitual. Si supera los {maxWaitSeconds}s se detendrá
              automáticamente para solicitar una aclaración o indicar disponibilidad.
            </span>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
            >
              Acotar pregunta ahora
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {phases.map((phase) => {
          const status = getStatus(phase.id);

          return (
            <div
              key={phase.id}
              className={`relative rounded-xl p-3.5 border transition-all ${
                status === 'active'
                  ? 'bg-sky-500/10 border-sky-500/50 shadow-md shadow-sky-500/10'
                  : status === 'done'
                  ? 'bg-slate-900/60 border-emerald-500/30 text-slate-300'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition ${
                    status === 'active'
                      ? 'bg-sky-500 text-slate-950 animate-pulse'
                      : status === 'done'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {status === 'done' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : status === 'active' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  ) : (
                    <span>{phase.num}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`text-xs font-semibold truncate ${
                        status === 'active'
                          ? 'text-sky-300'
                          : status === 'done'
                          ? 'text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      {phase.title}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-400 line-clamp-2">
                    {phase.subtitle}
                  </p>
                </div>
              </div>

              {status === 'active' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-b-xl overflow-hidden">
                  <div className="h-full bg-white/40 animate-pulse w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

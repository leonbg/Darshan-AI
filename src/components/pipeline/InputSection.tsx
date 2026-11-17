import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlignRight,
  AlignLeft,
  Feather,
  X,
  RotateCcw,
  Layers,
  Footprints,
  BookOpen,
  Flame,
  Scale,
  GitBranch,
  Wand2,
  Users,
  Cpu,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ScrollText,
  Clock,
  PlusCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  DerashaMethodology,
  DerashaDuration,
  DerashaTone,
  MethodologyDeliberationResult,
  ArchivedDerashaEntry,
  DerashaRelationType,
} from '../../types';
import {
  resolvePipelineMethodology,
  DERASHA_DURATION_OPTIONS,
  ResolvedMethodology,
} from '../../utils/methodologyLogicGates';
import {
  AUDIENCE_BASE_PRESETS,
  DERASHA_TONE_OPTIONS,
  extractAudienceLabel,
  getToneMeta,
  resolveDerashaTone,
} from '../../utils/toneAdvisor';
import { parseCrossDerashaComparisonCommand } from '../../services/archiveService';

interface InputSectionProps {
  query: string;
  onChangeQuery: (val: string) => void;
  metodologia: DerashaMethodology;
  onChangeMetodologia: (val: DerashaMethodology) => void;
  duracion: DerashaDuration;
  onChangeDuracion: (val: DerashaDuration) => void;
  metodologiasComplementarias: DerashaMethodology[];
  onChangeMetodologiasComplementarias: (val: DerashaMethodology[]) => void;
  audienciaOTono: string;
  onChangeAudienciaOTono: (val: string) => void;
  tonoHomiletico?: DerashaTone;
  onChangeTonoHomiletico?: (val: DerashaTone) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isRtl: boolean;
  onToggleRtl: () => void;
  onDeliberateMethodology?: () => void;
  isDeliberatingMethodology?: boolean;
  deliberationResult?: MethodologyDeliberationResult | null;
  isPrewarmedReady?: boolean;
  isPrewarmingSources?: boolean;
  methodologyDecisionSeconds?: number;
  lessonElaborationBudgetSeconds?: number;
  onFanOpenChange?: (isOpen: boolean) => void;
  archivedEntries?: ArchivedDerashaEntry[];
  onRequestClarification?: () => void;
  onRunCrossComparison?: (params: {
    numbers: number[];
    relationType: DerashaRelationType;
    userHypothesis: string;
  }) => void;
  onReturnHome?: () => void;
  homeResetSignal?: number;
  isHomeTapArmed?: boolean;
  onClearOrReturnHome?: () => void;
  onOpenUserManualModal?: () => void;
  collapseFanSignal?: number;
  isEvaluatingQuery?: boolean;
}

export const METHODOLOGY_OPTIONS: Array<{
  id: DerashaMethodology;
  label: string;
  shortCode: string;
  hebrewTag: string;
  structureSummary: string;
  exampleTopic: string;
}> = [
  {
    id: 'AUTO',
    label: 'Automático (Compuerta Inteligente)',
    shortCode: 'AUTO',
    hebrewTag: 'זִהוּי חָכָם',
    structureSummary:
      'Detecta automáticamente la metodología óptima según las palabras clave de tu consulta.',
    exampleTopic:
      '¿Qué es la iluminación desde la perspectiva del budismo frente a la luz de la Torá, y cómo se compara el Olam HaBá judío frente al Nirvana, el Valhalla y el Cielo e Infierno?',
  },
  {
    id: 'WISSENSCHAFT_DES_JUDENTUMS',
    label: 'Wissenschaft des Judentums (Histórico-Filológico)',
    shortCode: 'WISSENSCHAFT_DES_JUDENTUMS',
    hebrewTag: 'חָכְמַת יִשְׂרָאֵל וּבִקֹּרֶת הַנֻּסָּח',
    structureSummary:
      '4 fases: 1. Crítica Textual y Manuscritos · 2. Redacción Tanaítica y Amoraica · 3. Contexto Histórico y Normativo · 4. Exégesis Teológica Comparada',
    exampleTopic:
      '¿Cómo evolucionó históricamente la institución de la sinagoga y la lectura pública de la Torá desde la época de Esdras el Escriba hasta la Mishná y el Talmud?',
  },
  {
    id: 'EVOLUCION_CONCEPTUAL',
    label: 'Evolución del Concepto (4 Visiones)',
    shortCode: 'EVOLUCION_CONCEPTUAL',
    hebrewTag: 'הִתְפַּתְּחוּת הַמּוּשָׂג',
    structureSummary:
      '1. Torá y Jazal · 2. Árbol de la Vida (Cábala) · 3. Musar · 4. Jasidut (diferencias entre escuelas)',
    exampleTopic:
      'Analizar el concepto de Jésed (חֶסֶד): cómo se escribe y concibe en la Torá, en el Árbol de la Vida de la Cábala, según el Musar y su evolución y diferencias dentro de la Jasidut (Baal Shem Tov, Jabad/Tania, Breslev y Sfat Emet)',
  },
  {
    id: 'PARDES',
    label: 'PARDÉS Clásico',
    shortCode: 'PARDES',
    hebrewTag: 'פַּרְדֵּס',
    structureSummary: '4 niveles: 1. Pshat · 2. Rémez · 3. Drash · 4. Sod',
    exampleTopic:
      '¿Por qué en Parashat Toledot (Génesis 27) la obtención de la bendición por Yaakov es vista por Jazal como la rectificación del orden espiritual frente a Esav?',
  },
  {
    id: 'MESILAT_YESHARIM_SISTEMATICO',
    label: 'Mesilat Yesharim Sistemático',
    shortCode: 'MESILAT_YESHARIM_SISTEMATICO',
    hebrewTag: 'מְסִלַּת יְשָׁרִים',
    structureSummary: 'Ramjal (4 partes): 1. Mahut · 2. Jalakim · 3. Dérej Kinyanó · 4. Mafsidayv',
    exampleTopic:
      'La virtud de Zerizut (Diligencia y entusiasmo espiritual) frente a la inercia y postergación según Mesillat Yesharim 6–9',
  },
  {
    id: 'PIRKE_AVOT_EXEGETICO',
    label: 'Pirké Avot Exegético',
    shortCode: 'PIRKE_AVOT_EXEGETICO',
    hebrewTag: 'פִּרְקֵי אָבוֹת',
    structureSummary: '3 partes: 1. Contexto del Tanaíta · 2. Rambam vs. Rabenu Yoná / Maharal · 3. Principio Vivo',
    exampleTopic:
      'Pirkei Avot 1:14 — Hilel dice: «Si yo no soy para mí, ¿quién será para mí? Y cuando soy solo para mí, ¿qué soy? Y si no es ahora, ¿cuándo?»',
  },
  {
    id: 'MUSAR_TRANSFORMATIVO',
    label: 'Musar Transformativo',
    shortCode: 'MUSAR_TRANSFORMATIVO',
    hebrewTag: 'מוּסָר וְחֶשְׁבּוֹן הַנֶּפֶשׁ',
    structureSummary: 'R. Israel Salanter (3 partes): 1. Punto Focal · 2. Diagnóstico del Néfesh · 3. Jeshbón HaNéfesh',
    exampleTopic:
      'La fricción entre conocer la importancia de juzgar al prójimo favorablemente (Pirkei Avot 1:6) y la reacción automática de crítica o enojo cuando nos sentimos heridos',
  },
  {
    id: 'FILOSOFIA_CONTRASTIVA',
    label: 'Diálogo Filosófico y Comparativo',
    shortCode: 'FILOSOFIA_CONTRASTIVA',
    hebrewTag: 'מַחְשֶׁבֶת יִשְׂרָאֵל וּפִילוֹסוֹפְיָה',
    structureSummary:
      '4 partes: 1. Fuentes Internas de la Torá vs. Fuentes Externas · 2. Universalidad vs. Especificidad del Mandamiento · 3. Fuentes Canónicas · 4. Síntesis',
    exampleTopic:
      'Contraste comparativo sobre el destino de las almas (Olam HaBá frente a Nirvana, Valhalla, Cielo e Infierno y los requisitos para acceder a cada uno), la Iluminación en el Budismo frente a la Torá, la Alegoría de la Caverna de Platón, Cicerón o el Imperativo Categórico de Kant',
  },
];

export const InputSection: React.FC<InputSectionProps> = React.memo(({
  query,
  onChangeQuery,
  metodologia,
  onChangeMetodologia,
  duracion,
  onChangeDuracion,
  metodologiasComplementarias,
  onChangeMetodologiasComplementarias,
  audienciaOTono,
  onChangeAudienciaOTono,
  tonoHomiletico = 'AUTO',
  onChangeTonoHomiletico,
  onSubmit,
  isLoading,
  isRtl,
  onToggleRtl,
  onDeliberateMethodology,
  isDeliberatingMethodology = false,
  deliberationResult = null,
  isPrewarmedReady = false,
  isPrewarmingSources = false,
  methodologyDecisionSeconds = 0,
  lessonElaborationBudgetSeconds = 150,
  onFanOpenChange,
  archivedEntries = [],
  onRequestClarification,
  onRunCrossComparison,
  onReturnHome,
  homeResetSignal = 0,
  isHomeTapArmed: isHomeTapArmedProp,
  onClearOrReturnHome,
  onOpenUserManualModal,
  collapseFanSignal = 0,
  isEvaluatingQuery = false,
}) => {
  // Collapsed by default so the UI stays clean and uncluttered
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [showGateDetails, setShowGateDetails] = useState<boolean>(false);
  const [localHomeTapArmed, setLocalHomeTapArmed] = useState<boolean>(false);
  const lastClearTapAtRef = useRef<number>(0);
  const clearArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHomeTapArmed = isHomeTapArmedProp ?? localHomeTapArmed;

  useEffect(() => {
    return () => {
      if (clearArmTimerRef.current) {
        clearTimeout(clearArmTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (homeResetSignal > 0) {
      setIsConfigOpen(false);
      setShowGateDetails(false);
      setLocalHomeTapArmed(false);
      lastClearTapAtRef.current = 0;
      onFanOpenChange?.(false);
    }
  }, [homeResetSignal, onFanOpenChange]);

  useEffect(() => {
    if (collapseFanSignal > 0) {
      setIsConfigOpen(false);
      setShowGateDetails(false);
      onFanOpenChange?.(false);
    }
  }, [collapseFanSignal, onFanOpenChange]);

  const handleClearOrDoubleTapHome = useCallback(() => {
    if (onClearOrReturnHome) {
      onClearOrReturnHome();
      return;
    }

    const now = Date.now();
    const isSecondTap = now - lastClearTapAtRef.current <= 2200;

    if (clearArmTimerRef.current) {
      clearTimeout(clearArmTimerRef.current);
      clearArmTimerRef.current = null;
    }

    if (isSecondTap) {
      lastClearTapAtRef.current = 0;
      setLocalHomeTapArmed(false);
      setIsConfigOpen(false);
      setShowGateDetails(false);
      onFanOpenChange?.(false);
      onChangeQuery('');
      onReturnHome?.();
      return;
    }

    // 1st tap: Clear the query box and arm a 2nd-tap window to return to start
    onChangeQuery('');
    lastClearTapAtRef.current = now;
    setLocalHomeTapArmed(true);

    const inputEl = document.getElementById('query-input') as HTMLTextAreaElement | null;
    if (inputEl) {
      inputEl.focus();
    }

    clearArmTimerRef.current = setTimeout(() => {
      lastClearTapAtRef.current = 0;
      setLocalHomeTapArmed(false);
      clearArmTimerRef.current = null;
    }, 2200);
  }, [onClearOrReturnHome, onChangeQuery, onReturnHome, onFanOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (query.trim() && !isLoading) {
          onSubmit();
        }
      }
    },
    [query, isLoading, onSubmit]
  );

  const pipelinePreview = useMemo(
    () =>
      resolvePipelineMethodology(
        query,
        metodologia,
        duracion,
        metodologiasComplementarias
      ),
    [query, metodologia, duracion, metodologiasComplementarias]
  );
  const gateEvaluation = pipelinePreview.evaluation;

  const toneEvaluation = useMemo(
    () =>
      resolveDerashaTone(
        tonoHomiletico,
        query,
        pipelinePreview.resolvedMethodology,
        gateEvaluation.halakhicValidation
      ),
    [
      tonoHomiletico,
      query,
      pipelinePreview.resolvedMethodology,
      gateEvaluation.halakhicValidation,
    ]
  );
  const activeToneMeta = useMemo(
    () => getToneMeta(toneEvaluation.resolvedTone),
    [toneEvaluation.resolvedTone]
  );
  const activeAudienceLabel = useMemo(
    () => extractAudienceLabel(audienciaOTono),
    [audienciaOTono]
  );

  const detectedCrossComparison = useMemo(
    () => parseCrossDerashaComparisonCommand(query),
    [query]
  );

  const enforcedMeta = useMemo(
    () =>
      METHODOLOGY_OPTIONS.find((m) => m.id === gateEvaluation.enforcedMethodology) ||
      METHODOLOGY_OPTIONS[2],
    [gateEvaluation.enforcedMethodology]
  );

  const normalizedMetodologia: DerashaMethodology =
    metodologia === 'FILOLOGIA_LITURGICA_WISSENSCHAFT'
      ? 'WISSENSCHAFT_DES_JUDENTUMS'
      : metodologia;

  const activeMethodologyMeta = useMemo(
    () =>
      METHODOLOGY_OPTIONS.find((m) => m.id === normalizedMetodologia) ||
      METHODOLOGY_OPTIONS[0],
    [normalizedMetodologia]
  );

  const matchesCurrentDeliberation = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return Boolean(
      trimmed &&
        deliberationResult &&
        deliberationResult.query.trim().toLowerCase() === trimmed
    );
  }, [deliberationResult, query]);

  const effectiveDisplayMeta = useMemo(() => {
    if (gateEvaluation.externalThinkerDetection?.detected) {
      return enforcedMeta;
    }
    if (normalizedMetodologia === 'AUTO') {
      if (matchesCurrentDeliberation && deliberationResult?.recommendedPrimary) {
        return (
          METHODOLOGY_OPTIONS.find((m) => m.id === deliberationResult.recommendedPrimary) ||
          enforcedMeta
        );
      }
      return enforcedMeta;
    }
    return activeMethodologyMeta;
  }, [
    gateEvaluation.externalThinkerDetection?.detected,
    normalizedMetodologia,
    matchesCurrentDeliberation,
    deliberationResult?.recommendedPrimary,
    enforcedMeta,
    activeMethodologyMeta,
  ]);

  const activeThinkerDetection = gateEvaluation.externalThinkerDetection;

  const activeDurationMeta = useMemo(
    () =>
      DERASHA_DURATION_OPTIONS.find((d) => d.id === duracion) ||
      DERASHA_DURATION_OPTIONS[1],
    [duracion]
  );

  const toggleComplementaryMethodology = useCallback(
    (targetId: DerashaMethodology) => {
      if (targetId === 'AUTO' || targetId === effectiveDisplayMeta.id) return;
      const maxAllowed = duracion === '5_MIN' ? 0 : duracion === '10_MIN' ? 1 : 2;
      if (maxAllowed === 0) {
        onChangeDuracion('10_MIN');
        onChangeMetodologiasComplementarias([targetId]);
        return;
      }

      const exists = metodologiasComplementarias.includes(targetId);
      if (exists) {
        onChangeMetodologiasComplementarias(
          metodologiasComplementarias.filter((m) => m !== targetId)
        );
      } else {
        const next = [...metodologiasComplementarias, targetId].slice(-maxAllowed);
        onChangeMetodologiasComplementarias(next);
      }
    },
    [
      effectiveDisplayMeta.id,
      duracion,
      metodologiasComplementarias,
      onChangeDuracion,
      onChangeMetodologiasComplementarias,
    ]
  );

  const getMethodologyIcon = useCallback((id: DerashaMethodology) => {
    switch (id) {
      case 'AUTO':
        return <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
      case 'WISSENSCHAFT_DES_JUDENTUMS':
      case 'FILOLOGIA_LITURGICA_WISSENSCHAFT':
        return <ScrollText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'EVOLUCION_CONCEPTUAL':
        return <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case 'PARDES':
        return <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'MESILAT_YESHARIM_SISTEMATICO':
        return <Footprints className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'PIRKE_AVOT_EXEGETICO':
        return <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'MUSAR_TRANSFORMATIVO':
        return <Flame className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'FILOSOFIA_CONTRASTIVA':
        return <Scale className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
  }, []);

  const handleToggleConfigFan = useCallback(() => {
    const nextOpen = !isConfigOpen;
    setIsConfigOpen(nextOpen);
    if (onFanOpenChange) {
      onFanOpenChange(nextOpen);
    }
    if (
      nextOpen &&
      query.trim().length >= 2 &&
      onDeliberateMethodology &&
      !isDeliberatingMethodology &&
      !matchesCurrentDeliberation
    ) {
      onDeliberateMethodology();
    }
  }, [
    isConfigOpen,
    onFanOpenChange,
    query,
    onDeliberateMethodology,
    isDeliberatingMethodology,
    isPrewarmingSources,
    deliberationResult,
    matchesCurrentDeliberation,
  ]);

  return (
    <section
      id="study-desk"
      className="relative rounded-2xl p-5 sm:p-7 bg-gradient-to-b from-[#0f1d38] via-[#0b1529] to-[#081020] border-2 border-sky-400/60 shadow-[0_0_45px_-10px_rgba(56,189,248,0.28)] ring-1 ring-sky-300/20 transition-all"
    >
      <div className="space-y-4">
        {/* Highlighted Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-sky-300 block">
              Mesa Principal de Estudio · Desarrollo Exegético y Halájico
            </span>
            <label
              htmlFor="query-input"
              className="flex items-center gap-2 font-editorial text-lg sm:text-2xl font-bold text-white tracking-tight"
            >
              <Feather className="w-5 h-5 text-sky-400 shrink-0" />
              <span>Tema, Pasaje o Concepto a Desarrollar</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {onOpenUserManualModal && (
              <button
                type="button"
                onClick={onOpenUserManualModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-amber-200 hover:text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                title="Abrir el Manual de Usuario paso a paso (atajo: ? o F1)"
                aria-label="Abrir Manual de Usuario"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Manual de Usuario</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleRtl}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                isRtl
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
              title="Alternar dirección del texto (LTR Español / RTL Hebreo)"
            >
              {isRtl ? (
                <AlignRight className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isRtl ? 'RTL · עברית' : 'LTR · Español'}</span>
            </button>
          </div>
        </div>

        {/* Highlighted Main Input Box with Integrated Clear / Double-Tap Home Button */}
        <div className="relative">
          <textarea
            id="query-input"
            rows={3}
            dir={isRtl ? 'rtl' : 'ltr'}
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe aquí el tema, pasaje bíblico/talmúdico, ley halájica (Shulján Aruj, Minhag, Núsaj) o concepto a desarrollar..."
            className={`w-full px-4 py-3.5 rounded-xl bg-[#050a14] border-2 border-sky-500/40 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 text-white placeholder-slate-400 text-base sm:text-lg leading-relaxed transition outline-none resize-y min-h-[104px] shadow-inner ${
              isRtl ? 'font-hebrew text-right text-xl leading-relaxed pl-32' : 'font-sans pr-32'
            }`}
          />

          <button
            type="button"
            onClick={handleClearOrDoubleTapHome}
            className={`absolute top-2.5 ${
              isRtl ? 'left-2.5' : 'right-2.5'
            } inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer select-none shadow-sm z-10 ${
              isHomeTapArmed
                ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-[0_0_16px_-3px_rgba(251,191,36,0.65)]'
                : 'bg-slate-800/95 hover:bg-slate-700 border-slate-600/80 hover:border-sky-400/60 text-slate-100 hover:text-white'
            }`}
            title="1 toque: limpiar recuadro de consulta · 2 toques: volver al inicio de la aplicación (cierra historial o cualquier sección)"
            aria-label="Limpiar recuadro de consulta o tocar dos veces para volver al inicio"
          >
            {isHomeTapArmed ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>2º toque: Inicio</span>
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Limpiar</span>
              </>
            )}
          </button>
        </div>

        {/* Live Indicator when a Natural Language Cross-Derashá Comparison Command is Detected */}
        {detectedCrossComparison && detectedCrossComparison.isCrossDerashaComparison && (
          <div className="p-3.5 rounded-xl bg-indigo-950/35 border border-indigo-500/40 space-y-2.5 text-xs animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-bold text-indigo-200">
                  Comparación Cruzada de Derashot Detectada:{' '}
                  <span className="text-white">
                    {detectedCrossComparison.numbers.map((n) => `Derashá #${n}`).join(' × ')}
                  </span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 font-mono text-[10px]">
                Modo: {detectedCrossComparison.relationType}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {detectedCrossComparison.numbers.map((num) => {
                const match = archivedEntries.find((e) => e.sequenceNumber === num);
                return (
                  <span
                    key={num}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-slate-200"
                  >
                    <strong className="text-sky-400">#{num}:</strong>
                    <span>{match ? match.title : `Derashá #${num}`}</span>
                  </span>
                );
              })}
            </div>

            {onRunCrossComparison && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400">
                  Elige el ángulo dialéctico o presiona comparar directamente:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['RELACION', 'CONTRADICCION', 'COMPLEMENTO', 'INTEGRAL'] as DerashaRelationType[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          onRunCrossComparison({
                            numbers: detectedCrossComparison.numbers,
                            relationType: mode,
                            userHypothesis: detectedCrossComparison.userHypothesis,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          detectedCrossComparison.relationType === mode
                            ? 'bg-indigo-400 text-slate-950'
                            : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
                        }`}
                      >
                        Comparar: {mode}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compact Pipeline Indicator when an External Philosopher/Thinker is Detected */}
        {activeThinkerDetection?.detected && (
          <div className="px-3 py-2 rounded-xl bg-rose-950/25 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-rose-200">
              <Scale className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                Contraste filosófico activo:{' '}
                <strong className="text-white">{activeThinkerDetection.thinkerName}</strong>{' '}
                <span className="text-slate-400">
                  ({activeThinkerDetection.forcedExegeticalSefariaRefs.length} fuentes canónicas de apoyo)
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Compact Halakhic Validator Indicator */}
        {gateEvaluation.halakhicValidation?.isPurelyHalakhic && (
          <div className="px-3 py-2 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Enfoque halájico (Shulján Aruj · Mejaber y Ramá):{' '}
                <strong className="text-white">
                  {gateEvaluation.halakhicValidation.halakhicDomainLabels.join(' · ') || 'Halajá y Minhag'}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Compact Single-Line Bar: Active Methodology + Lesson Duration (5m / 10m / 30m) + Generate Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left: Method toggle + Duration selector */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleToggleConfigFan}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#090f1d] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 transition cursor-pointer"
              title="Abrir o cerrar el abanico de decisión metodológica (el tiempo de decisión no consume tiempo de generación de la Drashá)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>
                Método:{' '}
                <strong className="text-white">{effectiveDisplayMeta.label}</strong>
                {activeThinkerDetection?.detected ? (
                  <span className="text-rose-300 ml-1">(Forzado: Pensador Externo)</span>
                ) : (
                  normalizedMetodologia === 'AUTO' && (
                    <span className="text-amber-300/90 ml-1">(Auto)</span>
                  )
                )}
                {pipelinePreview.complementaryMethodologies.length > 0 && (
                  <span className="text-sky-300 ml-1.5 font-medium">
                    +{pipelinePreview.complementaryMethodologies.length} aporte
                    {pipelinePreview.complementaryMethodologies.length > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              {isConfigOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Compact Lesson Duration Selector: 5 min | 10 min | 30 min */}
            <div
              className="inline-flex items-center gap-1 bg-[#090f1d] border border-slate-800 rounded-xl p-1"
              title={activeDurationMeta.description}
            >
              <span className="inline-flex items-center gap-1 px-2 text-[11px] text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Duración:</span>
              </span>
              {DERASHA_DURATION_OPTIONS.map((opt) => {
                const isSelected = duracion === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeDuracion(opt.id)}
                    disabled={isLoading}
                    title={`${opt.label} (${opt.targetWordsRange})`}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Compact Tone Pill */}
            <button
              type="button"
              onClick={handleToggleConfigFan}
              title={toneEvaluation.advisoryReason}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition cursor-pointer ${activeToneMeta.badgeClass}`}
            >
              <Feather className="w-3 h-3 shrink-0" />
              <span>
                Tono:{' '}
                <strong>
                  {tonoHomiletico === 'AUTO'
                    ? `Auto · ${activeToneMeta.shortLabel}`
                    : activeToneMeta.shortLabel}
                </strong>
              </span>
            </button>

            {isPrewarmedReady && !isLoading && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium"
                title="Las raíces hebreas y fuentes de Sefaria ya fueron pre-cargadas durante tu decisión metodológica: la Drashá se generará directo en Fase 3 con el 100% de su tiempo."
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fuentes listas · Fase 3 directa</span>
              </span>
            )}
          </div>

          {/* Right: Logic Gate badge + Acotar + Clear + Primary Generate Button */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {query.trim().length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!isConfigOpen) {
                      handleToggleConfigFan();
                    }
                    setShowGateDetails(true);
                  }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-mono bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 text-amber-300 transition cursor-pointer"
                  title={`Compuerta Lógica #${gateEvaluation.gateNumber}: ${gateEvaluation.gateTitle}`}
                >
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>Puerta #{gateEvaluation.gateNumber}</span>
                </button>

                {onRequestClarification && (
                  <button
                    type="button"
                    onClick={onRequestClarification}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 transition cursor-pointer"
                    title="Ver acotaciones y ángulos metodológicos sugeridos para tu consulta"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Acotar</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={isLoading || isEvaluatingQuery || !query.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-sm disabled:opacity-50 disabled:pointer-events-none transition cursor-pointer"
            >
              {isLoading || isEvaluatingQuery ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{isEvaluatingQuery && !isLoading ? 'Evaluando consulta...' : 'Generando...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Generar Drashá ({activeDurationMeta.shortLabel})</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* COLLAPSIBLE FAN: Only visible when the user clicks to open it */}
        {isConfigOpen && (
          <div className="pt-4 mt-2 border-t border-slate-800/80 space-y-4 animate-fadeIn">
            {/* Compact Independent Methodology Decision Bar + Background Pre-warming Status */}
            <div className="px-3.5 py-2.5 rounded-xl bg-[#070c18] border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  Escogencia de metodología:{' '}
                  <strong className="text-sky-300 font-mono">{methodologyDecisionSeconds}s</strong>{' '}
                  <span className="text-slate-400">
                    (Reloj aislado · Elaboración de la lección mantiene{' '}
                    <strong className="text-emerald-300 font-mono">
                      {lessonElaborationBudgetSeconds}s
                    </strong>{' '}
                    íntegros)
                  </span>
                </span>
                {isPrewarmedReady ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>· Fuentes Sefaria pre-cargadas (ahorro en Fase 1 y 2)</span>
                  </span>
                ) : isPrewarmingSources ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-sky-300">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>· Adelantando raíces y Sefaria en 2º plano...</span>
                  </span>
                ) : null}
              </div>

              {onDeliberateMethodology && (
                <button
                  type="button"
                  onClick={onDeliberateMethodology}
                  disabled={isDeliberatingMethodology || !query.trim()}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isDeliberatingMethodology ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                      <span>Evaluando...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Recomendación IA</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Deep AI Methodology Deliberation Results (if evaluated) */}
            {matchesCurrentDeliberation && deliberationResult && (
              <div className="p-3.5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>
                      Dictamen Calibrado Multi-Metodológico
                      {deliberationResult.deliberationTimeMs !== undefined
                        ? ` (${(deliberationResult.deliberationTimeMs / 1000).toFixed(2)}s · sin descontar tiempo a la Drashá)`
                        : ''}
                    </span>
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {deliberationResult.decisionCalibration?.needsClarification &&
                      onRequestClarification && (
                        <button
                          type="button"
                          onClick={onRequestClarification}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-semibold text-[11px] transition cursor-pointer"
                        >
                          Acotar consulta
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => {
                        onChangeMetodologia(deliberationResult.recommendedPrimary);
                        const targetComp =
                          duracion === '30_MIN'
                            ? deliberationResult.recommendedComplementaryFor30Min
                            : duracion === '10_MIN'
                            ? deliberationResult.recommendedComplementaryFor10Min
                            : [];
                        onChangeMetodologiasComplementarias(targetComp);
                        if (deliberationResult.recommendedTone) {
                          onChangeTonoHomiletico?.(deliberationResult.recommendedTone);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-semibold text-[11px] transition cursor-pointer"
                    >
                      Aplicar combinación recomendada
                    </button>
                  </div>
                </div>

                {deliberationResult.decisionCalibration && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/90 text-slate-200">
                      Confianza metodológica:{' '}
                      <strong className="text-sky-300 font-mono">
                        {Math.round(deliberationResult.decisionCalibration.primaryConfidence * 100)}%
                      </strong>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md border ${
                        deliberationResult.decisionCalibration.needsClarification
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : 'bg-emerald-950/35 border-emerald-500/35 text-emerald-200'
                      }`}
                    >
                      Especificidad:{' '}
                      <strong className="font-mono">
                        {deliberationResult.decisionCalibration.specificityNormalized}%
                      </strong>{' '}
                      · {deliberationResult.decisionCalibration.specificityLevelLabel}
                    </span>

                    {deliberationResult.decisionCalibration.isPurelyHalakhic ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/35 border border-emerald-500/35 text-emerald-200">
                        Ámbito halájico normativo (
                        {Math.round(
                          deliberationResult.decisionCalibration.halakhicProbability * 100
                        )}
                        %)
                      </span>
                    ) : deliberationResult.decisionCalibration.requiresExternalContrast ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/35 border border-rose-500/35 text-rose-200">
                        Contraste filosófico externo (
                        {Math.round(
                          deliberationResult.decisionCalibration.externalContrastProbability * 100
                        )}
                        %)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                        Exégesis interna de la Torá
                      </span>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {deliberationResult.deliberationSummary}
                </p>

                {deliberationResult.candidates.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {deliberationResult.candidates.slice(0, 3).map((cand) => {
                      const meta =
                        METHODOLOGY_OPTIONS.find((m) => m.id === cand.methodology) ||
                        METHODOLOGY_OPTIONS[3];
                      const barWidthClass =
                        cand.relevanceScore >= 85
                          ? 'w-full'
                          : cand.relevanceScore >= 70
                          ? 'w-4/5'
                          : cand.relevanceScore >= 55
                          ? 'w-3/5'
                          : cand.relevanceScore >= 40
                          ? 'w-2/5'
                          : cand.relevanceScore >= 25
                          ? 'w-1/4'
                          : cand.relevanceScore >= 12
                          ? 'w-1/6'
                          : 'w-1/12';
                      return (
                        <div
                          key={cand.methodology}
                          className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white text-[11px] truncate">
                              {meta.label.split('(')[0].trim()}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[10px]">
                              {cand.relevanceScore}%
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden">
                            <div className={`h-full bg-sky-400/80 rounded-full ${barWidthClass}`} />
                          </div>
                          <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                            {cand.whyApplicable}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Methodology Selector (7 cols) */}
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>1. Metodología Principal</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeQuery(effectiveDisplayMeta.exampleTopic)}
                    className="text-[11px] text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
                  >
                    Cargar ejemplo de {effectiveDisplayMeta.label} →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {METHODOLOGY_OPTIONS.map((opt) => {
                    const isSelected = normalizedMetodologia === opt.id;
                    const isFullWidth = opt.id === 'AUTO';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeMetodologia(opt.id)}
                        disabled={isLoading}
                        className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                          isFullWidth ? 'sm:col-span-2' : ''
                        } ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-400/60 text-white'
                            : 'bg-[#090f1d]/80 border-slate-800/90 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                            {getMethodologyIcon(opt.id)}
                            <span>{opt.label}</span>
                          </span>
                          <span className="font-hebrew text-xs text-slate-400" dir="rtl">
                            {opt.hebrewTag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {opt.structureSummary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration & Multi-Methodology Contributions + Audience & Tone (5 cols) */}
              <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                {/* Duration & Cross-Methodology Contributions */}
                <div className="p-3.5 rounded-xl bg-[#090f1d]/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>2. Duración y Aportes Multi-Metodológicos</span>
                    </span>
                    <span className="text-[11px] text-sky-300 font-medium">
                      {activeDurationMeta.targetWordsRange}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {activeDurationMeta.description}
                  </p>

                  {duracion === '5_MIN' ? (
                    <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                      En la lección de <strong className="text-white">5 minutos</strong> se aplica solo la metodología principal. Elige <strong className="text-sky-300">10 min</strong> o <strong className="text-sky-300">30 min</strong> para entrelazar aportes de otras metodologías.
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium flex items-center gap-1">
                          <PlusCircle className="w-3 h-3 text-sky-400" />
                          <span>
                            Metodologías que aportan ({pipelinePreview.complementaryMethodologies.length} de{' '}
                            {duracion === '10_MIN' ? '1' : '2'}):
                          </span>
                        </span>
                        {metodologiasComplementarias.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onChangeMetodologiasComplementarias([])}
                            className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                          >
                            Restaurar sugerencia automática
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {METHODOLOGY_OPTIONS.filter(
                          (m) => m.id !== 'AUTO' && m.id !== effectiveDisplayMeta.id
                        ).map((opt) => {
                          const isActiveComp = pipelinePreview.complementaryMethodologies.includes(
                            opt.id as ResolvedMethodology
                          );
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleComplementaryMethodology(opt.id)}
                              disabled={isLoading}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border transition cursor-pointer ${
                                isActiveComp
                                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-200 font-semibold'
                                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                              }`}
                            >
                              {getMethodologyIcon(opt.id)}
                              <span>{opt.label.split('(')[0].trim()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Audience & Homiletic Tone */}
                <div className="space-y-3 p-3.5 rounded-xl bg-[#090f1d]/90 border border-slate-800">
                  {/* 3A. Audience */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>3. Audiencia</span>
                      </span>
                      <span className="text-[11px] text-amber-300/90 truncate">
                        {activeAudienceLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {AUDIENCE_BASE_PRESETS.map((aud) => {
                        const active = activeAudienceLabel === aud.id;
                        return (
                          <button
                            key={aud.id}
                            type="button"
                            onClick={() => onChangeAudienciaOTono(aud.id)}
                            disabled={isLoading}
                            className={`text-left px-2.5 py-1.5 rounded-xl text-[11px] border transition cursor-pointer ${
                              active
                                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 font-semibold'
                                : 'bg-[#070c18] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <div className="truncate">{aud.id}</div>
                            <div className="text-[10px] text-slate-500 font-normal truncate">
                              {aud.subtitle}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3B. Homiletic Tone */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Feather className="w-3.5 h-3.5 text-sky-400" />
                        <span>4. Tono de la Drashá</span>
                      </span>
                      <span className="text-[11px] text-sky-300 truncate">
                        {tonoHomiletico === 'AUTO'
                          ? `Sugerido: ${activeToneMeta.shortLabel}`
                          : activeToneMeta.shortLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {DERASHA_TONE_OPTIONS.map((toneOpt) => {
                        const active = tonoHomiletico === toneOpt.id;
                        return (
                          <button
                            key={toneOpt.id}
                            type="button"
                            onClick={() => onChangeTonoHomiletico?.(toneOpt.id)}
                            disabled={isLoading}
                            title={`${toneOpt.description} Ideal para: ${toneOpt.idealTopicsHint}`}
                            className={`text-left px-2.5 py-1.5 rounded-xl text-[11px] border transition cursor-pointer ${
                              active
                                ? 'bg-sky-500/15 border-sky-400/60 text-white font-semibold'
                                : 'bg-[#070c18] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{toneOpt.shortLabel}</span>
                              <span className="font-hebrew text-[10px] text-slate-500 shrink-0" dir="rtl">
                                {toneOpt.hebrewLabel}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal truncate">
                              {toneOpt.idealTopicsHint}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className={`p-2 rounded-lg border text-[11px] leading-snug ${
                        toneEvaluation.suitability === 'no_recomendado'
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                          : 'bg-slate-950/80 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <span className="font-semibold">
                        {toneEvaluation.suitability === 'no_recomendado'
                          ? 'Aviso de adecuación temática: '
                          : 'Enfoque retórico: '}
                      </span>
                      {toneEvaluation.advisoryReason}
                    </div>
                  </div>
                </div>

                {/* Optional collapsible detail of the Logic-Gate keywords */}
                <div className="pt-2 border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => setShowGateDetails(!showGateDetails)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-sky-300 transition cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {showGateDetails
                        ? 'Ocultar diagnóstico de Compuerta Lógica'
                        : `Ver diagnóstico de Compuerta Lógica (#${gateEvaluation.gateNumber})`}
                    </span>
                  </button>

                  {showGateDetails && (
                    <div className="mt-2 p-3 rounded-xl bg-[#070c18] border border-slate-800/90 space-y-2 text-[11px]">
                      <div className="font-semibold text-sky-300">
                        {gateEvaluation.gateTitle}
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        {gateEvaluation.explanation}
                      </p>
                      {gateEvaluation.matchedKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {gateEvaluation.matchedKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono text-[10px]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});


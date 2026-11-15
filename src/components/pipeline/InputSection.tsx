import React, { useState, useMemo, useCallback } from 'react';
import {
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlignRight,
  AlignLeft,
  Feather,
  X,
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
  History,
  Trash2,
  FileText,
  Youtube,
} from 'lucide-react';
import {
  DerashaMethodology,
  DerashaDuration,
  MethodologyDeliberationResult,
  ArchivedDerashaEntry,
  DerashaRelationType,
} from '../../types';
import {
  evaluateMethodologyLogicGates,
  resolvePipelineMethodology,
  DERASHA_DURATION_OPTIONS,
  ResolvedMethodology,
} from '../../utils/methodologyLogicGates';
import { parseCrossDerashaComparisonCommand } from '../../services/archiveService';
import { extractYouTubeUrlFromText } from '../../services/api';

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
  onOpenArchivedDerasha?: (entry: ArchivedDerashaEntry) => void;
  onDeleteArchivedDerasha?: (sequenceNumber: number) => void;
  onOpenFullArchive?: () => void;
  onRequestClarification?: () => void;
  onRunCrossComparison?: (params: {
    numbers: number[];
    relationType: DerashaRelationType;
    userHypothesis: string;
  }) => void;
  onOpenYouTubeStudio?: (youtubeUrl: string) => void;
}

export function detectMethodologyFromQuery(query: string): ResolvedMethodology {
  return evaluateMethodologyLogicGates(query).enforcedMethodology;
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

export const AUDIENCE_PRESETS = [
  'Comunidad general · Inspirador y práctico',
  'Bet Midrash · Rigor académico y analítico',
  'Jóvenes y familias · Pedagógico y vivencial',
  'Introspección personal · Contemplativo y ético',
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
  onOpenArchivedDerasha,
  onDeleteArchivedDerasha,
  onOpenFullArchive,
  onRequestClarification,
  onRunCrossComparison,
  onOpenYouTubeStudio,
}) => {
  // Collapsed by default so the UI stays clean and uncluttered
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [showGateDetails, setShowGateDetails] = useState<boolean>(false);
  const [isQuickHistoryOpen, setIsQuickHistoryOpen] = useState<boolean>(false);
  const [confirmDeleteSeq, setConfirmDeleteSeq] = useState<number | null>(null);

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

  const detectedCrossComparison = useMemo(
    () => parseCrossDerashaComparisonCommand(query),
    [query]
  );

  const detectedYoutubeUrl = useMemo(
    () => extractYouTubeUrlFromText(query),
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

  const effectiveDisplayMeta = useMemo(
    () =>
      gateEvaluation.externalThinkerDetection?.detected || normalizedMetodologia === 'AUTO'
        ? enforcedMeta
        : activeMethodologyMeta,
    [gateEvaluation.externalThinkerDetection?.detected, normalizedMetodologia, enforcedMeta, activeMethodologyMeta]
  );

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
      query.trim().length >= 10 &&
      onDeliberateMethodology &&
      !isDeliberatingMethodology &&
      !isPrewarmingSources &&
      (!deliberationResult || deliberationResult.query !== query.trim())
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
            <button
              type="button"
              onClick={() => {
                setIsQuickHistoryOpen((prev) => !prev);
                setConfirmDeleteSeq(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
                isQuickHistoryOpen
                  ? 'bg-amber-500/15 text-amber-200 border-amber-400/50'
                  : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:text-white hover:border-amber-400/40'
              }`}
              title="Abrir historial de Derashot anteriores para consultarlas o eliminar las que no sean de interés"
            >
              <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Historial ({archivedEntries.length})</span>
            </button>

            <button
              type="button"
              onClick={onToggleRtl}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
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

        {/* Inline Quick History Drawer when user clicks the Historial button */}
        {isQuickHistoryOpen && (
          <div className="p-3.5 rounded-xl bg-[#060c18] border border-amber-500/35 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-white">
                  Historial de Derashot Anteriores ({archivedEntries.length})
                </span>
              </div>
              <div className="flex items-center gap-3">
                {onOpenFullArchive && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickHistoryOpen(false);
                      onOpenFullArchive();
                    }}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    Ir al Comparador Completo →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsQuickHistoryOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  title="Cerrar historial rápido"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {archivedEntries.length === 0 ? (
              <p className="text-slate-400 py-3 text-center">
                Aún no hay Derashot guardadas en el historial.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {[...archivedEntries]
                  .sort((a, b) => b.sequenceNumber - a.sequenceNumber)
                  .map((entry) => {
                    const isConfirming = confirmDeleteSeq === entry.sequenceNumber;
                    return (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-lg bg-[#0b1326] border border-slate-800/90 hover:border-slate-700 transition space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsQuickHistoryOpen(false);
                              if (onOpenArchivedDerasha) {
                                onOpenArchivedDerasha(entry);
                              } else {
                                onChangeQuery(entry.query);
                              }
                            }}
                            className="text-left min-w-0 flex-1 group cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="font-mono font-bold text-sky-400">
                                Derashá #{entry.sequenceNumber}
                              </span>
                              <span>·</span>
                              <span>{entry.methodology}</span>
                            </div>
                            <p className="font-semibold text-slate-100 group-hover:text-sky-300 truncate mt-0.5">
                              {entry.title}
                            </p>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setIsQuickHistoryOpen(false);
                                if (onOpenArchivedDerasha) {
                                  onOpenArchivedDerasha(entry);
                                } else {
                                  onChangeQuery(entry.query);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-[11px] font-semibold text-sky-200 transition cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Abrir</span>
                            </button>

                            {onDeleteArchivedDerasha && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteSeq(
                                    isConfirming ? null : entry.sequenceNumber
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] transition cursor-pointer ${
                                  isConfirming
                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                                    : 'bg-slate-900 hover:bg-rose-950/50 border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300'
                                }`}
                                title="Eliminar esta Derashá del histórico"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Eliminar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {isConfirming && onDeleteArchivedDerasha && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-rose-500/30 text-[11px]">
                            <span className="text-rose-200 font-medium">
                              ¿Eliminar Derashá #{entry.sequenceNumber} del histórico?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSeq(null)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteSeq(null);
                                  onDeleteArchivedDerasha(entry.sequenceNumber);
                                }}
                                className="px-2.5 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold cursor-pointer"
                              >
                                Sí, eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Highlighted Main Input Box */}
        <textarea
          id="query-input"
          rows={3}
          dir={isRtl ? 'rtl' : 'ltr'}
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe aquí el tema, pasaje bíblico/talmúdico, ley halájica (Shulján Aruj, Minhag, Núsaj) o concepto a desarrollar..."
          className={`w-full px-4 py-3.5 rounded-xl bg-[#050a14] border-2 border-sky-500/40 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 text-white placeholder-slate-400 text-base sm:text-lg leading-relaxed transition outline-none resize-y min-h-[96px] shadow-inner ${
            isRtl ? 'font-hebrew text-right text-xl leading-relaxed' : 'font-sans'
          }`}
        />

        {/* Quick Shortcut when user pastes a YouTube URL in the main study box */}
        {detectedYoutubeUrl && onOpenYouTubeStudio && (
          <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/35 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Youtube className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-slate-200 font-medium">
                Video de YouTube detectado · Genera ilustraciones vectoriales SVG y animación escénica automáticamente.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenYouTubeStudio(detectedYoutubeUrl)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-400 hover:bg-rose-300 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>Crear Ilustraciones y Animación</span>
            </button>
          </div>
        )}

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

        {/* Live Pipeline Module Indicator when an External Philosopher/Thinker is Detected */}
        {activeThinkerDetection?.detected && (
          <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/35 space-y-2.5 text-xs animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold text-rose-200">
                  Módulo del Pipeline Activo · Pensador Externo Detectado:{' '}
                  <span className="text-white">{activeThinkerDetection.thinkerName}</span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/30 text-rose-200 font-mono text-[10px]">
                Búsqueda Exegética Forzada ({activeThinkerDetection.forcedExegeticalSefariaRefs.length} fuentes Sefaria)
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-amber-300">Concepto a contrastar con la cosmovisión judía:</strong>{' '}
              {activeThinkerDetection.specificPhilosophicalConcept} ·{' '}
              <span className="text-slate-400">
                El pipeline fuerza el contraste explícito de{' '}
                <strong className="text-sky-300">Universalidad vs. Especificidad del Mandamiento</strong>.
              </span>
            </p>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {activeThinkerDetection.forcedExegeticalSefariaRefs.map((refObj) => {
                const badgeColor =
                  refObj.contrastRole === 'UNIVERSALIDAD_TORAH'
                    ? 'bg-sky-500/15 border-sky-400/35 text-sky-200'
                    : refObj.contrastRole === 'ESPECIFICIDAD_MITZVA'
                    ? 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                    : 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200';
                const axisLabel =
                  refObj.contrastRole === 'UNIVERSALIDAD_TORAH'
                    ? 'Universalidad'
                    : refObj.contrastRole === 'ESPECIFICIDAD_MITZVA'
                    ? 'Especificidad Mitzvá'
                    : 'Cosmovisión / Teonomía';
                return (
                  <span
                    key={refObj.ref}
                    title={refObj.rationale}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-medium ${badgeColor}`}
                  >
                    <span className="font-bold">
                      {refObj.ref} ({refObj.heRef})
                    </span>
                    <span className="opacity-75">· {axisLabel}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Pipeline Halakhic Validator Indicator: Automatically disables external philosophical citations on purely Halakhic queries */}
        {gateEvaluation.halakhicValidation?.isPurelyHalakhic && (
          <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/35 space-y-2 text-xs animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-200">
                  Validador Halájico del Pipeline Activo ·{' '}
                  <span className="text-white">
                    Consulta de Carácter Puramente Halájico
                  </span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 font-mono text-[10px]">
                Citas Filosóficas Externas: DESACTIVADAS
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-emerald-300">Dominios halájicos detectados:</strong>{' '}
              {gateEvaluation.halakhicValidation.halakhicDomainLabels.join(' · ')}.{' '}
              <span className="text-slate-400">
                El validador desactiva automáticamente toda inyección de citas filosóficas externas o comparativas (Kant, Platón, Cicerón, etc.) y restringe el estudio a fuentes internas de Halajá, Talmud, Rambam,{' '}
                <strong className="text-amber-300">Shulján Aruj (Mejaber y Ramá)</strong>,{' '}
                <strong className="text-sky-300">Minhag y Núsaj</strong>.
              </span>
            </p>

            {gateEvaluation.halakhicValidation.recommendedHalakhicSources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {gateEvaluation.halakhicValidation.recommendedHalakhicSources.map((srcRef) => (
                  <span
                    key={srcRef}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-medium text-emerald-200"
                  >
                    <ScrollText className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{srcRef}</span>
                  </span>
                ))}
              </div>
            )}
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

                <button
                  type="button"
                  onClick={() => onChangeQuery('')}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition cursor-pointer"
                  title="Limpiar consulta"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpiar</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-sm disabled:opacity-50 disabled:pointer-events-none transition cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Generando...</span>
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
            {deliberationResult && deliberationResult.query === query.trim() && (
              <div className="p-3.5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>
                      Dictamen de Deliberación Multi-Metodológica
                      {deliberationResult.deliberationTimeMs
                        ? ` (${(deliberationResult.deliberationTimeMs / 1000).toFixed(1)}s · sin descontar tiempo a la Drashá)`
                        : ''}
                    </span>
                  </span>

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
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-semibold text-[11px] transition cursor-pointer"
                  >
                    Aplicar combinación recomendada
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {deliberationResult.deliberationSummary}
                </p>

                {deliberationResult.candidates.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {deliberationResult.candidates.slice(0, 3).map((cand) => {
                      const meta =
                        METHODOLOGY_OPTIONS.find((m) => m.id === cand.methodology) ||
                        METHODOLOGY_OPTIONS[3];
                      return (
                        <div
                          key={cand.methodology}
                          className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white text-[11px] truncate">
                              {meta.label.split('(')[0].trim()}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[10px]">
                              {cand.relevanceScore}%
                            </span>
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

                {/* Audience & Tone */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>3. Audiencia y Tono</span>
                    </span>
                    <span className="text-[11px] text-amber-300/90 truncate">
                      {audienciaOTono}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {AUDIENCE_PRESETS.map((preset) => {
                      const active = audienciaOTono === preset;
                      const [audTitle, audTone] = preset.split('·').map((s) => s.trim());
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => onChangeAudienciaOTono(preset)}
                          disabled={isLoading}
                          className={`text-left px-2.5 py-2 rounded-xl text-[11px] border transition cursor-pointer ${
                            active
                              ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 font-semibold'
                              : 'bg-[#090f1d] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <div className="truncate">{audTitle}</div>
                          {audTone && (
                            <div className="text-[10px] text-slate-500 font-normal truncate">
                              {audTone}
                            </div>
                          )}
                        </button>
                      );
                    })}
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


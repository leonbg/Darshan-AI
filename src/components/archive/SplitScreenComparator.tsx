import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
} from '../../types';
import {
  Columns2,
  Eye,
  ArrowLeftRight,
  Lock,
  Unlock,
  Zap,
  Layers,
  Link2,
  FileText,
} from 'lucide-react';

export type HighlightFilterMode = 'ALL' | 'CONTRADICCION' | 'COMPLEMENTO' | 'RELACION';

export interface AnnotatedSegment {
  text: string;
  highlightType: 'CONTRADICCION' | 'COMPLEMENTO' | 'RELACION' | 'NONE';
  matchedKeywords: string[];
  explanation: string;
}

const STOPWORDS_ES = new Set([
  'para', 'como', 'pero', 'entre', 'sobre', 'desde', 'hasta', 'cuando', 'donde',
  'porque', 'aunque', 'mientras', 'hacia', 'según', 'segun', 'contra', 'mediante',
  'durante', 'tanto', 'como', 'este', 'esta', 'estos', 'estas', 'aquel', 'aquella',
  'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'mismo',
  'misma', 'cada', 'cual', 'quien', 'cuyo', 'donde', 'tiene', 'tienen', 'puede',
  'pueden', 'debe', 'deben', 'hacer', 'hace', 'sino', 'también', 'tambien',
  'solo', 'sólo', 'más', 'mas', 'menos', 'muy', 'bien', 'mal', 'así', 'asi',
  'drasha', 'derasha', 'derashot', 'estudio', 'análisis', 'analisis', 'parte',
  'nivel', 'niveles', 'texto', 'fuente', 'fuentes', 'parece', 'ambas', 'ambos',
]);

export function extractSignificantTerms(text: string): string[] {
  if (!text) return [];
  const rawWords = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS_ES.has(w));
  return Array.from(new Set(rawWords));
}

export function annotateDerashaTextWithPipelineHighlights(
  entry: ArchivedDerashaEntry,
  otherEntry: ArchivedDerashaEntry,
  comparison: ComparativeDerashaAnalysisResult | null
): AnnotatedSegment[] {
  const fullRaw = [
    entry.centralIdea,
    entry.essaySummary,
    ...(entry.finalDerasha?.methodologySections?.map(
      (s) => `${s.title}: ${s.exposition} (${s.keyTakeaway})`
    ) || []),
  ]
    .filter(Boolean)
    .join('\n\n');

  const rawParagraphs = fullRaw
    .split(/\n{2,}|(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 25);

  const uniqueParagraphs: string[] = [];
  for (const p of rawParagraphs) {
    if (!uniqueParagraphs.some((existing) => existing.includes(p.slice(0, 45)))) {
      uniqueParagraphs.push(p);
    }
  }

  const contradictionSourceText = comparison
    ? `${comparison.pointsOfContradictionOrTension}`
    : `autonomía heteronomía individual colectivo universal particular razón revelación deber externo interno`;

  const complementaritySourceText = comparison
    ? `${comparison.pointsOfComplementarity} ${comparison.dialecticalSynthesisAndHomileticBridge}`
    : `${entry.centralIdea} ${otherEntry.centralIdea} síntesis complemento integración puente`;

  const relationshipSourceText = comparison
    ? `${comparison.pointsOfRelationship}`
    : `${entry.sourcesSummary} ${otherEntry.sourcesSummary}`;

  const contradictionTerms = extractSignificantTerms(contradictionSourceText);
  const complementarityTerms = extractSignificantTerms(complementaritySourceText);
  const relationshipTerms = extractSignificantTerms(relationshipSourceText);

  return uniqueParagraphs.slice(0, 8).map((paragraph, idx) => {
    const normP = paragraph
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const matchedContra = contradictionTerms.filter((t) => normP.includes(t));
    const matchedComp = complementarityTerms.filter((t) => normP.includes(t));
    const matchedRel = relationshipTerms.filter((t) => normP.includes(t));

    const hasContrastMarker =
      /\b(mientras que|sin embargo|por el contrario|a diferencia|oposici[oó]n|tensi[oó]n|frente a|no obstante|rechaza|l[ií]mite|autonom[ií]a|heteronom[ií]a|individual|garant[ií]a|exclusiv)\b/i.test(
        paragraph
      );
    const hasComplementMarker =
      /\b(complementa|integra|completa|une|puente|armoniza|junto con|comunidad|responsabilidad|mutua|eilu|ambos|s[ií]ntesis|acci[oó]n)\b/i.test(
        paragraph
      );

    const contraScore = matchedContra.length * 2 + (hasContrastMarker ? 3 : 0);
    const compScore = matchedComp.length * 1.8 + (hasComplementMarker ? 2.5 : 0);
    const relScore = matchedRel.length * 1.5;

    if (contraScore >= 3 && contraScore >= compScore) {
      return {
        text: paragraph,
        highlightType: 'CONTRADICCION',
        matchedKeywords: matchedContra.slice(0, 4),
        explanation: comparison
          ? `Fricción dialéctica (Majloket) con Derashá #${otherEntry.sequenceNumber}: conecta con la tensión identificada por el pipeline («${comparison.pointsOfContradictionOrTension.slice(0, 140)}...»).`
          : `Punto de contraste estructural frente al enfoque de la Derashá #${otherEntry.sequenceNumber}.`,
      };
    }

    if (compScore >= 2.5 && compScore >= relScore) {
      return {
        text: paragraph,
        highlightType: 'COMPLEMENTO',
        matchedKeywords: matchedComp.slice(0, 4),
        explanation: comparison
          ? `Complementariedad (Eilu v'Eilu) con Derashá #${otherEntry.sequenceNumber}: aporta la dimensión que completa a la otra Derashá («${comparison.pointsOfComplementarity.slice(0, 140)}...»).`
          : `Dimensión complementaria que amplía la tesis de la Derashá #${otherEntry.sequenceNumber}.`,
      };
    }

    if (relScore >= 2 || idx === 0) {
      return {
        text: paragraph,
        highlightType: 'RELACION',
        matchedKeywords: matchedRel.slice(0, 4),
        explanation: comparison
          ? `Hilo conductor compartido con Derashá #${otherEntry.sequenceNumber} («${comparison.pointsOfRelationship.slice(0, 140)}...»).`
          : `Raíz conceptual y exegética vinculada con la Derashá #${otherEntry.sequenceNumber}.`,
      };
    }

    return {
      text: paragraph,
      highlightType: 'NONE',
      matchedKeywords: [],
      explanation: '',
    };
  });
}

interface SplitScreenComparatorProps {
  archive: ArchivedDerashaEntry[];
  comparativeStudies: ComparativeDerashaAnalysisResult[];
  activeComparison: ComparativeDerashaAnalysisResult | null;
  selectedNumbers: number[];
  isComparing: boolean;
  onSetSelectedNumbers: (nums: number[]) => void;
  onRunComparison: (params: {
    numbers: number[];
    relationType: DerashaRelationType;
    userHypothesis: string;
  }) => void;
  onOpenArchivedDerasha: (entry: ArchivedDerashaEntry) => void;
}

export const SplitScreenComparator: React.FC<SplitScreenComparatorProps> = ({
  archive,
  comparativeStudies,
  activeComparison,
  selectedNumbers,
  isComparing,
  onSetSelectedNumbers,
  onRunComparison,
  onOpenArchivedDerasha,
}) => {
  const [isSplitScreenOpen, setIsSplitScreenOpen] = useState<boolean>(true);
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilterMode>('ALL');
  const [leftSeqNum, setLeftSeqNum] = useState<number>(() => selectedNumbers[0] || 1);
  const [rightSeqNum, setRightSeqNum] = useState<number>(() => selectedNumbers[1] || 5);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef<boolean>(false);

  useEffect(() => {
    const nums =
      activeComparison?.comparedNumbers && activeComparison.comparedNumbers.length >= 2
        ? activeComparison.comparedNumbers
        : selectedNumbers;
    if (nums.length >= 2) {
      setLeftSeqNum(nums[0]);
      setRightSeqNum(nums[1]);
    } else if (nums.length === 1 && archive.length >= 2) {
      setLeftSeqNum(nums[0]);
      const fallbackRight = archive.find((a) => a.sequenceNumber !== nums[0])?.sequenceNumber || 2;
      setRightSeqNum(fallbackRight);
    }
  }, [selectedNumbers, activeComparison, archive]);

  const leftEntry = useMemo(
    () => archive.find((a) => a.sequenceNumber === leftSeqNum) || archive[0] || null,
    [archive, leftSeqNum]
  );
  const rightEntry = useMemo(
    () =>
      archive.find((a) => a.sequenceNumber === rightSeqNum) ||
      archive.find((a) => a.sequenceNumber !== leftEntry?.sequenceNumber) ||
      archive[1] ||
      null,
    [archive, rightSeqNum, leftEntry]
  );

  const matchingComparisonForSplit = useMemo(() => {
    if (!leftEntry || !rightEntry) return activeComparison;
    if (
      activeComparison &&
      activeComparison.comparedNumbers.includes(leftEntry.sequenceNumber) &&
      activeComparison.comparedNumbers.includes(rightEntry.sequenceNumber)
    ) {
      return activeComparison;
    }
    return (
      comparativeStudies.find(
        (st) =>
          st.comparedNumbers.includes(leftEntry.sequenceNumber) &&
          st.comparedNumbers.includes(rightEntry.sequenceNumber)
      ) || activeComparison
    );
  }, [activeComparison, comparativeStudies, leftEntry, rightEntry]);

  const leftAnnotatedSegments = useMemo(() => {
    if (!leftEntry || !rightEntry) return [];
    return annotateDerashaTextWithPipelineHighlights(
      leftEntry,
      rightEntry,
      matchingComparisonForSplit
    );
  }, [leftEntry, rightEntry, matchingComparisonForSplit]);

  const rightAnnotatedSegments = useMemo(() => {
    if (!leftEntry || !rightEntry) return [];
    return annotateDerashaTextWithPipelineHighlights(
      rightEntry,
      leftEntry,
      matchingComparisonForSplit
    );
  }, [leftEntry, rightEntry, matchingComparisonForSplit]);

  const handlePaneScroll = (source: 'left' | 'right') => {
    if (!syncScroll || isSyncingScrollRef.current) return;
    const srcEl = source === 'left' ? leftPaneRef.current : rightPaneRef.current;
    const dstEl = source === 'left' ? rightPaneRef.current : leftPaneRef.current;
    if (!srcEl || !dstEl) return;

    isSyncingScrollRef.current = true;
    const maxSrc = srcEl.scrollHeight - srcEl.clientHeight;
    const maxDst = dstEl.scrollHeight - dstEl.clientHeight;
    if (maxSrc > 0 && maxDst > 0) {
      const ratio = srcEl.scrollTop / maxSrc;
      dstEl.scrollTop = ratio * maxDst;
    }
    setTimeout(() => {
      isSyncingScrollRef.current = false;
    }, 40);
  };

  if (!leftEntry || !rightEntry) return null;

  return (
    <div
      id="split-screen-comparator"
      className="rounded-2xl bg-gradient-to-b from-[#0c162c] via-[#091122] to-[#070c18] border border-sky-500/40 overflow-hidden shadow-2xl"
    >
      {/* Barra Superior de la Pantalla Dividida */}
      <div className="px-4 sm:px-6 py-4 bg-[#070c18]/90 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
            <Columns2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
                Vista Interactiva de Pantalla Dividida · Javruta Lado a Lado
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 font-mono text-[11px] font-bold text-sky-200">
                Derashá #{leftEntry.sequenceNumber} ⇄ Derashá #{rightEntry.sequenceNumber}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-editorial font-bold text-white mt-0.5">
              Comparación Lado a Lado con Resaltado Automático de Contradicciones y Complementariedades
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSyncScroll((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              syncScroll
                ? 'bg-sky-500/15 border-sky-400/50 text-sky-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Sincronizar el desplazamiento vertical de ambas Derashot al leer lado a lado"
          >
            {syncScroll ? (
              <Lock className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{syncScroll ? 'Scroll Sincronizado' : 'Scroll Independiente'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSplitScreenOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {isSplitScreenOpen ? 'Contraer Pantalla Dividida' : 'Desplegar Pantalla Dividida'}
            </span>
          </button>
        </div>
      </div>

      {isSplitScreenOpen && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Selector de Derashot Izquierda/Derecha + Filtro de Resaltado Automático */}
          <div className="p-3.5 rounded-xl bg-[#060a14] border border-slate-800/90 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                  Columna Izquierda:
                </span>
                <select
                  value={leftEntry.sequenceNumber}
                  onChange={(e) => {
                    const newLeft = parseInt(e.target.value, 10);
                    setLeftSeqNum(newLeft);
                    onSetSelectedNumbers([newLeft, rightEntry.sequenceNumber]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0b1326] border border-sky-500/40 text-xs font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {archive.map((item) => (
                    <option key={item.sequenceNumber} value={item.sequenceNumber}>
                      #{item.sequenceNumber} · {item.title.slice(0, 42)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const prevLeft = leftEntry.sequenceNumber;
                  const prevRight = rightEntry.sequenceNumber;
                  setLeftSeqNum(prevRight);
                  setRightSeqNum(prevLeft);
                  onSetSelectedNumbers([prevRight, prevLeft]);
                }}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 transition cursor-pointer"
                title="Intercambiar columna izquierda y derecha"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  Columna Derecha:
                </span>
                <select
                  value={rightEntry.sequenceNumber}
                  onChange={(e) => {
                    const newRight = parseInt(e.target.value, 10);
                    setRightSeqNum(newRight);
                    onSetSelectedNumbers([leftEntry.sequenceNumber, newRight]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0b1326] border border-indigo-500/40 text-xs font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {archive.map((item) => (
                    <option key={item.sequenceNumber} value={item.sequenceNumber}>
                      #{item.sequenceNumber} · {item.title.slice(0, 42)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={isComparing || leftEntry.sequenceNumber === rightEntry.sequenceNumber}
                onClick={() => {
                  onSetSelectedNumbers([leftEntry.sequenceNumber, rightEntry.sequenceNumber]);
                  onRunComparison({
                    numbers: [leftEntry.sequenceNumber, rightEntry.sequenceNumber],
                    relationType: 'INTEGRAL',
                    userHypothesis: `Comparar en pantalla dividida la Derashá #${leftEntry.sequenceNumber} y la Derashá #${rightEntry.sequenceNumber}: resaltar sus contradicciones dialécticas y sus puntos de complementariedad.`,
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                {isComparing
                  ? 'Ejecutando Pipeline...'
                  : `Actualizar Contraste #${leftEntry.sequenceNumber} vs #${rightEntry.sequenceNumber}`}
              </button>
            </div>

            {/* Filtros de Resaltado Automático */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">Resaltar en texto:</span>
              <button
                type="button"
                onClick={() => setHighlightFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  highlightFilter === 'ALL'
                    ? 'bg-white text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                Todo
              </button>
              <button
                type="button"
                onClick={() => setHighlightFilter('CONTRADICCION')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  highlightFilter === 'CONTRADICCION'
                    ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                    : 'bg-rose-950/25 border-rose-500/30 text-rose-300 hover:bg-rose-950/40'
                }`}
              >
                <Zap className="w-3 h-3 text-rose-400" />
                <span>
                  Contradicciones (
                  {
                    [...leftAnnotatedSegments, ...rightAnnotatedSegments].filter(
                      (s) => s.highlightType === 'CONTRADICCION'
                    ).length
                  }
                  )
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHighlightFilter('COMPLEMENTO')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  highlightFilter === 'COMPLEMENTO'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                    : 'bg-amber-950/25 border-amber-500/30 text-amber-300 hover:bg-amber-950/40'
                }`}
              >
                <Layers className="w-3 h-3 text-amber-400" />
                <span>
                  Complementariedades (
                  {
                    [...leftAnnotatedSegments, ...rightAnnotatedSegments].filter(
                      (s) => s.highlightType === 'COMPLEMENTO'
                    ).length
                  }
                  )
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHighlightFilter('RELACION')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  highlightFilter === 'RELACION'
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-sky-950/25 border-sky-500/30 text-sky-300 hover:bg-sky-950/40'
                }`}
              >
                <Link2 className="w-3 h-3 text-sky-400" />
                <span>
                  Vínculos (
                  {
                    [...leftAnnotatedSegments, ...rightAnnotatedSegments].filter(
                      (s) => s.highlightType === 'RELACION'
                    ).length
                  }
                  )
                </span>
              </button>
            </div>
          </div>

          {/* Resumen Sintético de Fricción vs. Complementariedad detectado por el Pipeline */}
          {matchingComparisonForSplit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                onClick={() =>
                  setHighlightFilter(
                    highlightFilter === 'CONTRADICCION' ? 'ALL' : 'CONTRADICCION'
                  )
                }
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  highlightFilter === 'CONTRADICCION'
                    ? 'bg-rose-950/45 border-rose-400 ring-1 ring-rose-400/40'
                    : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    <span>Contradicción / Fricción Detectada (Majloket)</span>
                  </span>
                  <span className="text-[10px] text-rose-300/80 underline">
                    {highlightFilter === 'CONTRADICCION' ? 'Ver todo' : 'Filtrar en texto'}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">
                  {matchingComparisonForSplit.pointsOfContradictionOrTension}
                </p>
              </div>

              <div
                onClick={() =>
                  setHighlightFilter(
                    highlightFilter === 'COMPLEMENTO' ? 'ALL' : 'COMPLEMENTO'
                  )
                }
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  highlightFilter === 'COMPLEMENTO'
                    ? 'bg-amber-950/45 border-amber-400 ring-1 ring-amber-400/40'
                    : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Complementariedad Detectada (Eilu v&apos;Eilu)</span>
                  </span>
                  <span className="text-[10px] text-amber-300/80 underline">
                    {highlightFilter === 'COMPLEMENTO' ? 'Ver todo' : 'Filtrar en texto'}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">
                  {matchingComparisonForSplit.pointsOfComplementarity}
                </p>
              </div>
            </div>
          )}

          {/* DOS COLUMNAS LADO A LADO (PANTALLA DIVIDIDA INTERACTIVA) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {[
              {
                side: 'left' as const,
                entry: leftEntry,
                segments: leftAnnotatedSegments,
                ref: leftPaneRef,
                accentBadge: 'bg-sky-400 text-slate-950',
                borderAccent: 'border-sky-500/35',
              },
              {
                side: 'right' as const,
                entry: rightEntry,
                segments: rightAnnotatedSegments,
                ref: rightPaneRef,
                accentBadge: 'bg-indigo-400 text-slate-950',
                borderAccent: 'border-indigo-500/35',
              },
            ].map(({ side, entry, segments, ref, accentBadge, borderAccent }) => {
              const pipelineThesis = matchingComparisonForSplit?.perDerashaCoreThesis?.find(
                (t) => t.sequenceNumber === entry.sequenceNumber
              );

              const visibleSegments =
                highlightFilter === 'ALL'
                  ? segments
                  : segments.filter((s) => s.highlightType === highlightFilter);

              return (
                <div
                  key={`${side}-${entry.sequenceNumber}`}
                  className={`rounded-2xl bg-[#060b16] border ${borderAccent} flex flex-col overflow-hidden`}
                >
                  <div className="p-4 bg-[#091124] border-b border-slate-800/90 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold ${accentBadge}`}
                        >
                          Derashá #{entry.sequenceNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                          {entry.methodology}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenArchivedDerasha(entry)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-[11px] font-semibold text-sky-200 transition cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Abrir en Mesa de Estudio</span>
                      </button>
                    </div>

                    <h4 className="font-editorial text-base sm:text-lg font-bold text-white leading-snug">
                      {entry.title}
                    </h4>

                    <div className="text-[11px] text-sky-300/90 flex items-center gap-1.5 flex-wrap">
                      <strong>Fuentes canónicas:</strong>
                      <span>{pipelineThesis?.keySource || entry.sourcesSummary}</span>
                    </div>

                    {pipelineThesis && (
                      <div className="p-2.5 rounded-xl bg-[#050912] border border-slate-800/90 text-xs text-slate-300 space-y-1">
                        <div>
                          <strong className="text-sky-300">Tesis central:</strong>{' '}
                          {pipelineThesis.coreThesis}
                        </div>
                        <div className="text-[11px] text-amber-200/90">
                          <strong>Ángulo normativo/filosófico:</strong>{' '}
                          {pipelineThesis.normativeOrPhilosophicalAngle}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    ref={ref}
                    onScroll={() => handlePaneScroll(side)}
                    className="p-4 space-y-3.5 max-h-[520px] overflow-y-auto flex-1"
                  >
                    {visibleSegments.length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#091020] border border-slate-800 text-xs text-slate-400 text-center">
                        No hay fragmentos con el filtro seleccionado en esta columna.{' '}
                        <button
                          type="button"
                          onClick={() => setHighlightFilter('ALL')}
                          className="text-sky-300 underline ml-1 cursor-pointer"
                        >
                          Mostrar todos los párrafos
                        </button>
                      </div>
                    ) : (
                      visibleSegments.map((seg, sIdx) => {
                        const isContra = seg.highlightType === 'CONTRADICCION';
                        const isComp = seg.highlightType === 'COMPLEMENTO';
                        const isRel = seg.highlightType === 'RELACION';

                        const cardStyle = isContra
                          ? 'bg-rose-950/30 border-l-4 border-l-rose-400 border border-rose-500/35'
                          : isComp
                          ? 'bg-amber-950/25 border-l-4 border-l-amber-400 border border-amber-500/35'
                          : isRel
                          ? 'bg-sky-950/25 border-l-4 border-l-sky-400 border border-sky-500/30'
                          : 'bg-[#091020]/70 border border-slate-800/80';

                        return (
                          <div
                            key={sIdx}
                            className={`p-3.5 rounded-xl transition-all space-y-2 ${cardStyle}`}
                          >
                            {seg.highlightType !== 'NONE' && (
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    isContra
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                      : isComp
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  }`}
                                >
                                  {isContra && <Zap className="w-3 h-3 text-rose-400" />}
                                  {isComp && <Layers className="w-3 h-3 text-amber-400" />}
                                  {isRel && <Link2 className="w-3 h-3 text-sky-400" />}
                                  <span>
                                    {isContra
                                      ? 'Contradicción / Fricción (Majloket)'
                                      : isComp
                                      ? 'Complementariedad (Eilu v’Eilu)'
                                      : 'Vínculo Exegético Compartido'}
                                  </span>
                                </span>

                                {seg.matchedKeywords.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {seg.matchedKeywords.map((kw) => (
                                      <span
                                        key={kw}
                                        className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono text-slate-300"
                                      >
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <p className="font-editorial text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-line">
                              {seg.text}
                            </p>

                            {seg.explanation && (
                              <p
                                className={`text-[11px] pt-2 border-t leading-snug ${
                                  isContra
                                    ? 'border-rose-500/25 text-rose-200/90'
                                    : isComp
                                    ? 'border-amber-500/25 text-amber-200/90'
                                    : 'border-sky-500/25 text-sky-200/90'
                                }`}
                              >
                                {seg.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

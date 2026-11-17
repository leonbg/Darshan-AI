import React, { useState } from 'react';
import {
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
} from '../../types';
import { BidiText } from '../../utils/bidiText';
import {
  Sparkles,
  Link2,
  Zap,
  Layers,
  Send,
  History,
} from 'lucide-react';

interface ComparativeStudyResultViewProps {
  activeComparison: ComparativeDerashaAnalysisResult | null;
  comparativeStudies: ComparativeDerashaAnalysisResult[];
  isComparing: boolean;
  onRunComparison: (params: {
    numbers: number[];
    relationType: DerashaRelationType;
    userHypothesis: string;
  }) => void;
  onSelectSavedComparison: (study: ComparativeDerashaAnalysisResult) => void;
}

export const ComparativeStudyResultView: React.FC<ComparativeStudyResultViewProps> = ({
  activeComparison,
  comparativeStudies,
  isComparing,
  onRunComparison,
  onSelectSavedComparison,
}) => {
  const [followUpHypothesis, setFollowUpHypothesis] = useState('');

  return (
    <>
      {activeComparison && (
        <div
          id="active-derasha-comparison-result"
          className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#0f1b36] to-[#080f1f] border border-sky-400/50 space-y-6 shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-sky-400 text-slate-950 font-mono text-xs font-bold">
                  {activeComparison.comparedNumbers.map((n) => `Derashá #${n}`).join(' × ')}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/35 text-amber-300 text-xs font-semibold">
                  Enfoque: {activeComparison.relationType}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-editorial font-bold text-white mt-2">
                {activeComparison.synthesisTitle}
              </h3>
              {activeComparison.userHypothesis && (
                <p className="text-xs text-slate-300 mt-1 italic">
                  Planteamiento analizado: «{activeComparison.userHypothesis}»
                </p>
              )}
            </div>
          </div>

          {/* Executive Verdict */}
          <div className="p-4 rounded-xl bg-sky-950/35 border border-sky-500/35 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Veredicto Exegético y Filosófico sobre tu Hipótesis</span>
            </div>
            <BidiText
              as="div"
              paragraphs
              text={activeComparison.executiveVerdict}
              className="text-sm text-slate-100 leading-relaxed space-y-2"
            />
          </div>

          {/* Per-Derasha Thesis Cards */}
          {activeComparison.perDerashaCoreThesis?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeComparison.perDerashaCoreThesis.map((item) => (
                <div
                  key={item.sequenceNumber}
                  className="p-4 rounded-xl bg-[#070c18] border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-xs font-bold">
                      Derashá #{item.sequenceNumber}
                    </span>
                    <span className="text-[11px] text-amber-300 font-medium">
                      {item.keySource}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <BidiText
                    as="div"
                    text={item.coreThesis}
                    className="text-xs text-slate-300 leading-relaxed"
                  />
                  <div className="text-[11px] text-sky-300/90 pt-1 border-t border-slate-800/80">
                    <strong>Ángulo normativo/filosófico:</strong>{' '}
                    <BidiText text={item.normativeOrPhilosophicalAngle} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3 Pillars of Comparison: Relación, Contradicción, Complementariedad */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#070c18] border border-emerald-500/30 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>1. Relación y Vínculo</span>
              </div>
              <BidiText
                as="div"
                paragraphs
                text={activeComparison.pointsOfRelationship}
                className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#070c18] border border-rose-500/30 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-rose-400" />
                <span>2. Tensión o Contradicción (Majloket)</span>
              </div>
              <BidiText
                as="div"
                paragraphs
                text={activeComparison.pointsOfContradictionOrTension}
                className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#070c18] border border-amber-500/30 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>3. Complementariedad (Eilu v&apos;Eilu)</span>
              </div>
              <BidiText
                as="div"
                paragraphs
                text={activeComparison.pointsOfComplementarity}
                className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2"
              />
            </div>
          </div>

          {/* Higher Dialectical Synthesis */}
          <div className="p-4 rounded-xl bg-[#070c18] border border-indigo-500/35 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              4. Síntesis Homilética Superior: Cómo unir ambas Derashot en una enseñanza maestra
            </div>
            <BidiText
              as="div"
              paragraphs
              text={activeComparison.dialecticalSynthesisAndHomileticBridge}
              className="text-sm text-slate-200 leading-relaxed space-y-2"
            />

            {activeComparison.canonicalBridgeSources?.length > 0 && (
              <div className="pt-3 mt-3 border-t border-slate-800/90 flex flex-wrap gap-2">
                {activeComparison.canonicalBridgeSources.map((src, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-sky-300"
                  >
                    <strong>{src.ref}:</strong> {src.rationale}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Direct Follow-Up on this Comparison */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!followUpHypothesis.trim() || isComparing) return;
              onRunComparison({
                numbers: activeComparison.comparedNumbers,
                relationType: activeComparison.relationType,
                userHypothesis: followUpHypothesis.trim(),
              });
              setFollowUpHypothesis('');
            }}
            className="pt-2 flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={followUpHypothesis}
              onChange={(e) => setFollowUpHypothesis(e.target.value)}
              placeholder={`Repreguntar o acotar sobre el contraste entre ${activeComparison.comparedNumbers
                .map((n) => `#${n}`)
                .join(' y ')}...`}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#070c18] border border-slate-700 focus:border-sky-400 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!followUpHypothesis.trim() || isComparing}
              className="px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Profundizar Contraste</span>
            </button>
          </form>
        </div>
      )}

      {/* Saved Comparative Studies History */}
      {comparativeStudies.length > 1 && (
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-sky-400" />
            <span>Análisis comparativos recientes guardados:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {comparativeStudies.slice(0, 6).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectSavedComparison(st)}
                className={`px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer ${
                  activeComparison?.id === st.id
                    ? 'bg-sky-500/20 border-sky-400 text-white'
                    : 'bg-[#070c18] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <strong className="font-mono text-sky-400">
                  {st.comparedNumbers.map((n) => `#${n}`).join('×')}
                </strong>{' '}
                · {st.synthesisTitle.slice(0, 48)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

import React from 'react';
import { BookA, Check, Copy } from 'lucide-react';
import { MorphologyItem } from '../../types';
import { BidiText } from '../../utils/bidiText';

interface MorphologyCardProps {
  primaryHebrew?: string;
  transliteration?: string;
  literalSpanishTranslation?: string;
  liturgicalContext?: string;
  items: MorphologyItem[];
  synthesis?: {
    summary: string;
    keyTheologicalInsight: string;
  };
}

export const MorphologyCard: React.FC<MorphologyCardProps> = React.memo(({
  primaryHebrew,
  transliteration,
  literalSpanishTranslation,
  liturgicalContext,
  items,
  synthesis,
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopy = React.useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  }, []);

  return (
    <div className="editorial-surface rounded-2xl p-5 sm:p-7 space-y-6">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <BookA className="w-3.5 h-3.5 text-sky-400" />
            <span>Filología y Gramática Hebraica · Raíces Trilíteras (Shorashim)</span>
          </div>
          <h3 className="font-editorial text-xl sm:text-2xl font-bold text-white">
            Desglose Morfológico y Filológico
          </h3>
        </div>

        {liturgicalContext && (
          <div className="text-xs text-slate-400 self-start sm:self-auto">
            <span>Contexto:</span>{' '}
            <strong className="text-sky-300 font-medium">{liturgicalContext}</strong>
          </div>
        )}
      </div>

      {/* Liturgical phrase showcase banner */}
      {primaryHebrew && (
        <div className="p-5 rounded-xl bg-[#090f1d] border border-slate-800 text-center space-y-2 relative overflow-hidden">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            Texto Vocalizado con Nikkud
          </div>
          <p
            dir="rtl"
            className="font-hebrew text-2xl sm:text-3xl text-sky-200 font-bold tracking-wide leading-relaxed"
          >
            {primaryHebrew}
          </p>
          {transliteration && (
            <p className="text-xs sm:text-sm text-slate-300 font-editorial italic">
              « {transliteration} »
            </p>
          )}
          {literalSpanishTranslation && (
            <p className="text-xs sm:text-sm text-slate-400">
              Traducción literal: <span className="text-slate-200">{literalSpanishTranslation}</span>
            </p>
          )}
        </div>
      )}

      {/* Synthesis Insight if available */}
      {synthesis && (
        <div className="p-4 sm:p-5 rounded-xl bg-sky-950/20 border border-sky-500/25 space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-sky-400">
            Síntesis Teológica de la Gramática
          </h4>
          <BidiText
            as="div"
            text={synthesis.summary}
            className="text-sm text-slate-200 leading-relaxed"
          />
          {synthesis.keyTheologicalInsight && (
            <div className="p-3 rounded-lg bg-[#090f1d]/80 border border-slate-800 text-xs text-sky-200">
              <strong className="text-sky-300">Enseñanza medular:</strong>{' '}
              <BidiText text={synthesis.keyTheologicalInsight} />
            </div>
          )}
        </div>
      )}

      {/* Morphology items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl bg-[#090f1d]/80 border border-slate-800 p-4 space-y-3 hover:border-sky-500/40 transition group"
          >
            {/* Word header */}
            <div className="flex items-start justify-between">
              <div>
                <span
                  dir="rtl"
                  className="font-hebrew text-2xl font-bold text-white block group-hover:text-sky-300 transition"
                >
                  {item.hebrewWord}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Significado: <strong className="text-slate-200">{item.rootMeaning}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(`${item.hebrewWord} (Raíz: ${item.root})`, idx)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                title="Copiar raíz"
              >
                {copiedIndex === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Unboxed grammatical metadata line */}
            <div className="text-xs text-slate-300 pt-1 border-t border-slate-800/80 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Raíz:{' '}
                <strong dir="rtl" className="font-hebrew text-sm text-sky-300">
                  {item.root}
                </strong>
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 font-medium">{item.binyan}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">{item.tense}</span>
            </div>

            {/* Theological implication */}
            <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/80 leading-relaxed">
              <span className="text-sky-400 font-semibold block mb-0.5">
                Implicación Teológica:
              </span>
              <BidiText
                as="div"
                text={item.theologicalImplication}
                className="text-slate-300 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});


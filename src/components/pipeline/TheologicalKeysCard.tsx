import React, { useState } from 'react';
import { Compass, Copy, Check } from 'lucide-react';
import { TheologicalKeys } from '../../types';
import { BidiText } from '../../utils/bidiText';

interface TheologicalKeysCardProps {
  keys: TheologicalKeys;
}

export const TheologicalKeysCard: React.FC<TheologicalKeysCardProps> = React.memo(({ keys }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = React.useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const { textualParallelism, grammaticalDichotomy, technicalTerm, kabbalisticArchitecture } = keys;

  return (
    <div className="editorial-surface rounded-2xl p-5 sm:p-7 space-y-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Tradición Rabínica · Tanaj, Jazal y Rishonim</span>
          </div>
          <h3 className="font-editorial text-xl sm:text-2xl font-bold text-white">
            Claves Teológicas y Filológicas Profundas
          </h3>
          <p className="text-xs text-slate-400">
            Paralelismo canónico, filología hebraica, tradición midráshica/halájica y arquitectura cabalística
          </p>
        </div>
      </div>

      {/* The 4 core theological keys */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Paralelismo Textual */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-3 hover:border-sky-500/40 transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                1
              </span>
              <h4 className="text-sm font-bold text-sky-300">
                {textualParallelism.title || 'Intertextualidad Canónica en el Tanaj y Jazal'}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(`${textualParallelism.title}\n\n${textualParallelism.explanation}\n\nFuente: ${textualParallelism.sourceRef}`, 'p1')}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
              title="Copiar clave"
            >
              {copiedKey === 'p1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <BidiText
            as="div"
            text={textualParallelism.explanation}
            className="text-xs sm:text-sm text-slate-300 leading-relaxed"
          />

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-1.5">
            <div className="text-slate-400 text-[11px]">
              <span className="font-semibold text-sky-400">
                Fuente canónica: {textualParallelism.sourceRef}
              </span>
            </div>
            {textualParallelism.hebrewQuote && (
              <p
                dir="rtl"
                className="font-hebrew text-sm sm:text-base text-slate-100 text-right leading-relaxed"
              >
                {textualParallelism.hebrewQuote}
              </p>
            )}
            <div className="text-slate-400 italic">
              « <BidiText text={textualParallelism.connectionToPrayer} /> »
            </div>
          </div>
        </div>

        {/* 2. Elección Gramatical y Filológica */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-3 hover:border-indigo-500/40 transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold flex items-center justify-center border border-indigo-500/30">
                2
              </span>
              <h4 className="text-sm font-bold text-indigo-300">
                {grammaticalDichotomy.title || 'Análisis Filológico y Exegético'}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(`${grammaticalDichotomy.title}\n\n${grammaticalDichotomy.explanation}\n\n${grammaticalDichotomy.watchmakerRefutation}`, 'p2')}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
              title="Copiar clave"
            >
              {copiedKey === 'p2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <BidiText
            as="div"
            text={grammaticalDichotomy.explanation}
            className="text-xs sm:text-sm text-slate-300 leading-relaxed"
          />

          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1.5">
            <div className="text-indigo-300 font-semibold">
              <BidiText text={grammaticalDichotomy.verbAnalysis} />
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed">
              <strong className="text-indigo-200">Implicación en la Hashkafá:</strong>{' '}
              <BidiText text={grammaticalDichotomy.watchmakerRefutation} />
            </div>
            {grammaticalDichotomy.liturgicalEcho && (
              <div className="text-indigo-300/90 text-[11px] italic">
                Resonancia en la tradición: « <BidiText text={grammaticalDichotomy.liturgicalEcho} /> »
              </div>
            )}
          </div>
        </div>

        {/* 3. Concepto Técnico en Jazal y Rishonim */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-3 hover:border-emerald-500/40 transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                3
              </span>
              <h4 className="text-sm font-bold text-emerald-300">
                {technicalTerm.title || 'Enseñanza de Jazal (Talmud y Midrash)'}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(`${technicalTerm.title}\n\n${technicalTerm.explanation}\n\nFuente: ${technicalTerm.mishnaSource}`, 'p3')}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
              title="Copiar clave"
            >
              {copiedKey === 'p3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <BidiText
            as="div"
            text={technicalTerm.explanation}
            className="text-xs sm:text-sm text-slate-300 leading-relaxed"
          />

          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-300 text-[11px] font-semibold">
              <span>Fuente rabínica: {technicalTerm.mishnaSource}</span>
            </div>
            <div className="text-slate-300 text-[11px]">
              <strong className="text-emerald-200">Principio tradicional:</strong>{' '}
              <BidiText text={technicalTerm.prescribedBlessing} />
            </div>
          </div>
        </div>

        {/* 4. Correspondencia Cabalística */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-3 hover:border-amber-500/40 transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                4
              </span>
              <h4 className="text-sm font-bold text-amber-300">
                {kabbalisticArchitecture.title || 'Dimensión Interior (Zóhar y Sefirot)'}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(`${kabbalisticArchitecture.title}\n\n${kabbalisticArchitecture.explanation}\n\nSefirot: ${kabbalisticArchitecture.sefiraConnection}`, 'p4')}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
              title="Copiar clave"
            >
              {copiedKey === 'p4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <BidiText
            as="div"
            text={kabbalisticArchitecture.explanation}
            className="text-xs sm:text-sm text-slate-300 leading-relaxed"
          />

          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/20 text-xs space-y-1">
            <div className="text-amber-300 font-semibold text-[11px]">
              <BidiText text={kabbalisticArchitecture.sefiraConnection} />
            </div>
            <div className="text-slate-300 text-[11px]">
              <strong className="text-amber-200">Prueba bíblica:</strong>{' '}
              <BidiText text={kabbalisticArchitecture.prooftext} />
            </div>
            <div className="text-slate-400 text-[11px] italic">
              Aplicación espiritual: <BidiText text={kabbalisticArchitecture.liturgicalStructure} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});


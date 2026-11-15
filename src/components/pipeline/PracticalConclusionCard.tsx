import React, { useState } from 'react';
import { Compass, HeartHandshake, Eye, Sparkles, Copy, Check, Share2 } from 'lucide-react';
import { FinalDerasha } from '../../types';

interface PracticalConclusionCardProps {
  conclusion: FinalDerasha['practicalConclusion'];
  onExport: () => void;
}

export const PracticalConclusionCard: React.FC<PracticalConclusionCardProps> = React.memo(({
  conclusion,
  onExport,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = React.useCallback(() => {
    const text = `CONCLUSIÓN PRÁCTICA (HASHKAFÁ & VIDA COTIDIANA): ${conclusion.title}\n\n` +
      `1. Visión del Mundo (Hashkafá):\n${conclusion.hashkafa}\n\n` +
      `2. Kavaná en la Tefilá:\n${conclusion.prayerKavanah}\n\n` +
      `3. Aplicación Ética en la Vida Diaria (Tikún Midot):\n${conclusion.dailyAction}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [conclusion]);

  return (
    <div className="editorial-surface rounded-2xl p-5 sm:p-7 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>Conclusión Práctica · Hashkafá y Conducta</span>
          </div>
          <h3 className="font-editorial text-lg sm:text-xl font-bold text-white">
            {conclusion.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar conclusión</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir / PDF</span>
          </button>
        </div>
      </div>

      {/* 3 Pillars of practical conclusion */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hashkafa */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
            <Eye className="w-4 h-4" />
            <span>1. Cosmovisión (Hashkafá)</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {conclusion.hashkafa}
          </p>
        </div>

        {/* Tefilah Kavanah */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>2. Kavaná en el Estudio y la Tefilá</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {conclusion.prayerKavanah}
          </p>
        </div>

        {/* Daily Action */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <HeartHandshake className="w-4 h-4" />
            <span>3. Vida Diaria (Tikún Midot)</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {conclusion.dailyAction}
          </p>
        </div>
      </div>
    </div>
  );
});


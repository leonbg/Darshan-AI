import React, { useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Sparkles,
  RefreshCw,
  Quote,
  HelpCircle,
  Compass,
  Award,
  Flame,
  Scale,
  MessageSquarePlus,
  Copy,
  Check,
} from 'lucide-react';
import { ContemporaryMasterReading, MasterReadingsSynthesis } from '../../types';

interface ContemporaryMastersCardProps {
  synthesis?: MasterReadingsSynthesis;
  onRequestMoreReadings: (focusMaster: 'all' | 'sacks' | 'gordon' | 'soloveitchik' | 'hirsch', specificAngle?: string) => Promise<void>;
  onAskFollowUp?: (question: string) => void;
  isLoading?: boolean;
}

export const ContemporaryMastersCard: React.FC<ContemporaryMastersCardProps> = React.memo(({
  synthesis,
  onRequestMoreReadings,
  onAskFollowUp,
  isLoading = false,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'sacks' | 'gordon' | 'other'>('all');
  const [customAngle, setCustomAngle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const readings: ContemporaryMasterReading[] = synthesis?.readings || [];

  const filteredReadings = useMemo(
    () =>
      readings.filter((r) => {
        if (selectedFilter === 'all') return true;
        if (selectedFilter === 'sacks')
          return r.masterId === 'sacks' || r.masterName.toLowerCase().includes('sacks');
        if (selectedFilter === 'gordon')
          return (
            r.masterId === 'gordon' ||
            r.masterName.toLowerCase().includes('gordon') ||
            r.masterName.toLowerCase().includes('jabad') ||
            r.masterName.toLowerCase().includes('rebe')
          );
        return r.masterId !== 'sacks' && r.masterId !== 'gordon';
      }),
    [readings, selectedFilter]
  );

  const handleCopy = useCallback((reading: ContemporaryMasterReading) => {
    const text = `${reading.masterName} (${reading.cycleOrSeries})\nTítulo: ${reading.readingTitle}\nPregunta central: ${reading.centralQuestion}\nTesis: ${reading.coreThesis}\n\n${reading.detailedExposition}\n\nConcepto clave: "${reading.keyQuoteOrConcept}"`;
    navigator.clipboard.writeText(text);
    setCopiedId(reading.id);
    setTimeout(() => setCopiedId(null), 1800);
  }, []);

  const getMasterStyle = useCallback((reading: ContemporaryMasterReading) => {
    const isSacks =
      reading.masterId === 'sacks' || reading.masterName.toLowerCase().includes('sacks');
    const isGordon =
      reading.masterId === 'gordon' ||
      reading.masterName.toLowerCase().includes('gordon') ||
      reading.masterName.toLowerCase().includes('jabad');

    if (isSacks) {
      return {
        badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        cardBorder: 'border-amber-500/25 hover:border-amber-400/40',
        accentText: 'text-amber-300',
        quoteBorder: 'border-l-amber-400 bg-amber-950/20',
        icon: <Award className="w-4 h-4 text-amber-400" />,
        schoolLabel: 'Covenant & Conversation • Ciclos Anuales',
      };
    }

    if (isGordon) {
      return {
        badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        cardBorder: 'border-sky-500/25 hover:border-sky-400/40',
        accentText: 'text-sky-300',
        quoteBorder: 'border-l-sky-400 bg-sky-950/20',
        icon: <Flame className="w-4 h-4 text-sky-400" />,
        schoolLabel: 'Jabad-Lubavitch • Jumash con Rashi, Tania & Sijot',
      };
    }

    return {
      badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      cardBorder: 'border-purple-500/25 hover:border-purple-400/40',
      accentText: 'text-purple-300',
      quoteBorder: 'border-l-purple-400 bg-purple-950/20',
      icon: <Scale className="w-4 h-4 text-purple-400" />,
      schoolLabel: 'Pensamiento Rabínico Contemporáneo',
    };
  }, []);

  return (
    <div className="bg-[#1e293b]/90 border border-amber-500/30 rounded-3xl p-5 sm:p-8 shadow-xl shadow-amber-950/10 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/80 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wide uppercase">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Lecturas Polifónicas & Ciclos Anuales de la Parashá</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Maestros Contemporáneos: Rabino Jonathan Sacks & Rab Yehoshua Gordon (Jabad)
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            {synthesis?.overview ||
              'Explora cómo grandes pensadores contemporáneos revisitan la misma Parashá o pasaje año tras año, descubriendo en cada ciclo anual una faceta distinta: desde la filosofía ética de Covenant & Conversation hasta la calidez jasídica de Jumash con Rashi, el Tania y Likkutei Sijot.'}
          </p>
        </div>

        {synthesis?.detectedParashaOrTopic && (
          <div className="self-start lg:self-center shrink-0 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-right">
            <span className="text-[10px] uppercase tracking-widest text-amber-400/80 block font-semibold">
              Sección / Parashá Vinculada
            </span>
            <span className="text-sm sm:text-base font-bold text-white">
              {synthesis.detectedParashaOrTopic}
            </span>
          </div>
        )}
      </div>

      {/* Filter & Cycle Generator Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedFilter === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            Todas las Lecturas ({readings.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('sacks')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedFilter === 'sacks'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800/80 text-amber-300 hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Rabino Jonathan Sacks (Ciclos Anuales)</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('gordon')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedFilter === 'gordon'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800/80 text-sky-300 hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Rab Yehoshua Gordon / Jabad</span>
          </button>
        </div>

        {/* Quick Action Buttons to Generate Specific Multi-Year Cycles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRequestMoreReadings('sacks', 'Comparar 3 años/ciclos distintos de Covenant & Conversation de Jonathan Sacks (Ética, Liderazgo y Espiritualidad)')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>+ Ciclos de Jonathan Sacks</span>
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRequestMoreReadings('gordon', 'Profundizar en el shiur de Rab Yehoshua Gordon: Jumash con Rashi, Tania y Likkutei Sijot del Rebe')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>+ Shiurim de Rab Gordon (Jabad)</span>
          </button>
        </div>
      </div>

      {/* Custom Angle Explorer Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!customAngle.trim() || isLoading) return;
          onRequestMoreReadings('all', customAngle.trim());
          setCustomAngle('');
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={customAngle}
          onChange={(e) => setCustomAngle(e.target.value)}
          placeholder="Ej: ¿Cómo analiza Jonathan Sacks este tema desde la psicología moral vs el liderazgo, o qué dice Rab Gordon en el Tania?"
          className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={isLoading || !customAngle.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-bold text-xs sm:text-sm transition-all disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5 shadow-md"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Consultando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Explorar Ciclo / Enfoque</span>
            </>
          )}
        </button>
      </form>

      {/* Readings Grid */}
      {filteredReadings.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
          <BookOpen className="w-8 h-8 text-amber-400 mx-auto opacity-80" />
          <p className="text-sm text-slate-300 font-medium">
            Haz clic en los botones superiores para cargar las lecturas anuales de Rabino Jonathan Sacks y Rab Yehoshua Gordon sobre este pasaje.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredReadings.map((reading, index) => {
            const style = getMasterStyle(reading);

            return (
              <div
                key={reading.id || index}
                className={`bg-slate-900/85 border ${style.cardBorder} rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4 transition-all shadow-lg`}
              >
                <div className="space-y-4">
                  {/* Top Master Badge & Cycle Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${style.badgeBg}`}>
                        {style.icon}
                        <span>{reading.masterName}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {reading.masterTitle} • <span className={style.accentText}>{reading.cycleOrSeries}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(reading)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Copiar esta lectura"
                    >
                      {copiedId === reading.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Angle & Title */}
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                      Ángulo de estudio: <strong className="text-slate-200">{reading.perspectiveAngle}</strong>
                    </span>
                    <h4 className="text-lg sm:text-xl font-bold text-white font-serif leading-snug">
                      «{reading.readingTitle}»
                    </h4>
                  </div>

                  {/* Central Question */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>La Pregunta Central de este Ciclo:</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                      {reading.centralQuestion}
                    </p>
                  </div>

                  {/* Core Thesis & Detailed Exposition */}
                  <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <p className="font-semibold text-white">
                      <span className={style.accentText}>Tesis Central: </span>
                      {reading.coreThesis}
                    </p>
                    <div className="space-y-2 text-slate-300/95 whitespace-pre-line">
                      {reading.detailedExposition}
                    </div>
                  </div>

                  {/* Key Quote or Concept */}
                  <blockquote className={`p-3.5 rounded-xl border-l-4 ${style.quoteBorder} text-xs sm:text-sm italic text-slate-200`}>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 not-italic">
                      <Quote className="w-3 h-3" />
                      <span>Idea Fuerza / Sello del Maestro</span>
                    </div>
                    «{reading.keyQuoteOrConcept}»
                  </blockquote>
                </div>

                {/* Footer: Practical Takeaway & Ask Follow-up */}
                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="text-xs text-slate-300">
                    <strong className="text-emerald-400 font-semibold">Aplicación Vital: </strong>
                    {reading.practicalTakeaway}
                  </div>

                  {onAskFollowUp && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskFollowUp(
                          `Profundiza en la lectura "${reading.readingTitle}" de ${reading.masterName} (${reading.cycleOrSeries}): ¿cómo se articula su tesis con el texto hebreo original y qué otras enseñanzas dio sobre este punto?`
                        )
                      }
                      className="w-full py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-semibold text-sky-300 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Ampliar este enfoque en el Diálogo Exegético</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

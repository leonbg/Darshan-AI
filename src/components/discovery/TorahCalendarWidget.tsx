import React, { useState } from 'react';
import {
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Scroll,
  ArrowRight,
  Flame,
  Clock,
  Compass,
} from 'lucide-react';
import { TorahCalendarData, CalendarAliyah, UpcomingLiturgicalEvent, SuggestedDerashaTopic } from '../../types';

interface TorahCalendarWidgetProps {
  calendar: TorahCalendarData | null;
  isLoading: boolean;
  onChangeParams: (params: { diaspora?: boolean; date?: string }) => void;
  onSelectReadingForAnalysis: (readingQuery: string, autoSubmit?: boolean) => void;
}

export const TorahCalendarWidget: React.FC<TorahCalendarWidgetProps> = ({
  calendar,
  isLoading,
  onChangeParams,
  onSelectReadingForAnalysis,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'aliyot'>('events');

  if (!calendar && isLoading) {
    return (
      <div className="bg-[#1e293b]/70 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800" />
          <div className="h-4 w-56 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (!calendar) return null;

  const { parasha, haftarah, dafYomi, upcomingEvents = [], suggestedTopics = [] } = calendar;
  const nextEvent = upcomingEvents[0];

  const handleAnalyzeFullParasha = () => {
    if (!parasha) return;
    const q = `Parashat ${parasha.nameEs} (${parasha.nameHe} — ${parasha.fullRef}): Análisis exegético PARDÉS y lecturas anuales de Rabino Jonathan Sacks y Rab Yehoshua Gordon`;
    onSelectReadingForAnalysis(q, true);
  };

  const handleAnalyzeAliyah = (aliyah: CalendarAliyah) => {
    if (!parasha) return;
    const q = `${aliyah.label} de Parashat ${parasha.nameEs} (${aliyah.ref}): Análisis de raíces, comentario de Rashi y enseñanza jasídica/ética`;
    onSelectReadingForAnalysis(q, true);
  };

  const handleAnalyzeHaftarah = () => {
    if (!haftarah) return;
    const q = `Haftará de ${parasha ? `Parashat ${parasha.nameEs}` : 'la semana'} (${haftarah.displayEn} — ${haftarah.ref}): Conexión profética con la lectura de la Torá`;
    onSelectReadingForAnalysis(q, true);
  };

  const handleSelectEvent = (ev: UpcomingLiturgicalEvent, combineWithParasha: boolean) => {
    const promptToUse =
      combineWithParasha && ev.combinedWithParashaPrompt
        ? ev.combinedWithParashaPrompt
        : ev.suggestedDerashaPrompt;
    onSelectReadingForAnalysis(promptToUse, true);
  };

  const handleSelectSuggestedTopic = (topic: SuggestedDerashaTopic) => {
    onSelectReadingForAnalysis(topic.prompt, true);
  };

  return (
    <div className="bg-[#1e293b]/85 border border-slate-800 rounded-2xl px-4 py-3.5 sm:px-5 shadow-md transition-all">
      {/* Compact Single-Line Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Hebrew Date + Weekly Parasha + Nearest Upcoming Event Pill */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>{calendar.hebrewDateStr}</span>
          </div>

          <span className="text-slate-700 hidden sm:inline">|</span>

          {parasha && (
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Parashá:</span>
              <strong className="text-sm sm:text-base font-bold text-white">
                {parasha.nameEs}
              </strong>
              <span className="font-hebrew text-base text-sky-300 font-semibold" dir="rtl">
                ({parasha.nameHe})
              </span>
              <span className="text-xs font-mono text-slate-400 hidden lg:inline">
                {parasha.fullRef}
              </span>
            </div>
          )}

          {nextEvent && (
            <>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(true);
                  setActiveTab('events');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                title="Ver próximas fiestas y sugerencias de Derashá"
              >
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span>
                  Próximo: <strong>{nextEvent.titleEs}</strong> (
                  {nextEvent.daysUntil === 0
                    ? 'Hoy'
                    : nextEvent.daysUntil === 1
                    ? 'Mañana'
                    : `en ${nextEvent.daysUntil}d`}
                  )
                </span>
              </button>
            </>
          )}
        </div>

        {/* Right: Clean Primary CTA + Expand Drawer Button */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          {parasha && (
            <button
              type="button"
              onClick={handleAnalyzeFullParasha}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-semibold text-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Estudiar Parashá</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-medium text-slate-300 transition-colors"
          >
            <span>{isExpanded ? 'Cerrar calendario' : 'Fiestas y Aliyot'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Drawer: Only shown when user clicks "Fiestas y Aliyot" */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
          {/* Sub-navigation inside Drawer + Diaspora/Date Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-fit text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('events')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'events'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Próximas Fiestas y Temas Sugeridos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('aliyot')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'aliyot'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Scroll className="w-3.5 h-3.5" />
                <span>7 Aliyot, Haftará y Daf Yomi</span>
              </button>
            </div>

            {/* Diaspora / Israel + Date Selector */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => onChangeParams({ diaspora: true, date: calendar.gregorianDate })}
                  className={`px-2 py-1 rounded-md font-medium ${
                    calendar.diaspora ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Diáspora
                </button>
                <button
                  type="button"
                  onClick={() => onChangeParams({ diaspora: false, date: calendar.gregorianDate })}
                  className={`px-2 py-1 rounded-md font-medium ${
                    !calendar.diaspora ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Israel
                </button>
              </div>

              <input
                type="date"
                value={calendar.gregorianDate}
                onChange={(e) => {
                  if (e.target.value) {
                    onChangeParams({ diaspora: calendar.diaspora, date: e.target.value });
                  }
                }}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* TAB 1: Upcoming Holidays & Suggested Derashá Themes */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {upcomingEvents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {upcomingEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-slate-900/75 border border-slate-800/90 hover:border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-amber-300 font-semibold">{ev.categoryLabelEs}</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {ev.daysUntil === 0
                              ? 'Hoy'
                              : ev.daysUntil === 1
                              ? 'Mañana'
                              : `En ${ev.daysUntil} días`}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-bold text-white">{ev.titleEs}</h4>
                          <span className="font-hebrew text-sm text-amber-200" dir="rtl">
                            {ev.titleHe}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {ev.memoEs}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleSelectEvent(ev, false)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold text-xs transition-colors text-center"
                        >
                          Estudiar Fiesta
                        </button>
                        {ev.combinedWithParashaPrompt && parasha && (
                          <button
                            type="button"
                            onClick={() => handleSelectEvent(ev, true)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs transition-colors text-center"
                          >
                            + Unir a Parashá
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Weekly Derashá Angles */}
              {suggestedTopics.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Sugerencias para la Derashá:</span>
                  </span>
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSelectSuggestedTopic(topic)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-xs text-slate-300 hover:text-white transition-all"
                    >
                      <span className="text-sky-400 font-semibold">{topic.badge}:</span>
                      <span>{topic.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 7 Aliyot, Haftarah & Daf Yomi */}
          {activeTab === 'aliyot' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                {haftarah && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Haftará:</span>
                    <strong className="text-amber-300">{haftarah.displayEn}</strong>
                    <span className="font-hebrew text-slate-300">({haftarah.displayHe})</span>
                    <button
                      type="button"
                      onClick={handleAnalyzeHaftarah}
                      className="text-sky-400 hover:underline font-semibold ml-1"
                    >
                      Analizar →
                    </button>
                  </div>
                )}
                {dafYomi && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Daf Yomi:</span>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectReadingForAnalysis(`Daf Yomi: Talmud ${dafYomi.ref} (${dafYomi.displayHe})`, false)
                      }
                      className="text-indigo-300 hover:underline font-semibold"
                    >
                      {dafYomi.displayEn} ({dafYomi.displayHe})
                    </button>
                  </div>
                )}
              </div>

              {parasha && parasha.aliyot && parasha.aliyot.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {parasha.aliyot.map((aliyah) => (
                    <button
                      key={aliyah.number}
                      type="button"
                      onClick={() => handleAnalyzeAliyah(aliyah)}
                      className="group text-left p-2.5 rounded-xl bg-slate-900/75 hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-sky-300">
                        <span>{aliyah.label}</span>
                        <span className="font-hebrew text-amber-300">{aliyah.hebrewLabel}</span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 group-hover:text-slate-200 mt-1 flex items-center justify-between">
                        <span>{aliyah.ref}</span>
                        <ArrowRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

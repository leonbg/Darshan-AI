import React, { useState, useEffect } from 'react';
import {
  Compass,
  Scroll,
  Flame,
  Footprints,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import {
  TorahCalendarData,
  CalendarAliyah,
  UpcomingLiturgicalEvent,
  SuggestedDerashaTopic,
} from '../../types';
import { SAMPLE_QUERIES, SampleQuery } from '../../data/samples';
import { MesilatYesharimShotsCard } from './MesilatYesharimShotsCard';

export type HubTab = 'parasha' | 'festividades' | 'musar' | 'preguntas';

interface SuggestedTopicsHubProps {
  calendar: TorahCalendarData | null;
  isLoadingCalendar: boolean;
  onChangeCalendarParams: (params: { diaspora?: boolean; date?: string }) => void;
  onSelectTopic: (studyQuery: string, autoSubmit: boolean) => void;
  onSelectSample: (sample: SampleQuery) => void;
  requestedTab?: { tab: HubTab; timestamp: number } | null;
}

export const ANNUAL_FESTIVALS_LIBRARY: Array<{
  id: string;
  titleEs: string;
  titleHe: string;
  seasonEs: string;
  keySources: string;
  prompt: string;
}> = [
  {
    id: 'shabat',
    titleEs: 'Shabat Kódesh',
    titleHe: 'שַׁבָּת קֹדֶשׁ',
    seasonEs: 'Santuario en el Tiempo (Semanal)',
    keySources: 'Exodus 20:8-11 · Shabbat 119b · Genesis 2:1-3',
    prompt:
      '¿Cómo transforma el Shabat nuestra relación con la creación, el trabajo (Melajá) y la libertad interior según el Tanaj, el Talmud (Shabat 119b) y el pensamiento judío clásico?',
  },
  {
    id: 'pesaj',
    titleEs: 'Pésaj (Libertad y Éxodo)',
    titleHe: 'פֶּסַח',
    seasonEs: '15 de Nisán · Primavera',
    keySources: 'Exodus 12:14 · Pesachim 116b · Maharal (Guevurot Hashem)',
    prompt:
      '¿Cuál es la diferencia en la Torá y en la Hagadá de Pésaj (Pesajim 116b) entre la libertad física (Yetzíat Mitzráyim) y la libertad espiritual que culmina en la entrega de la Torá en el Sinaí?',
  },
  {
    id: 'shavuot',
    titleEs: 'Shavuot (Matán Torá)',
    titleHe: 'שָׁבועוֹת',
    seasonEs: '6 de Siván · Revelación en el Sinaí',
    keySources: 'Exodus 19:5-6 · Shabbat 88a · Ruth 1:16',
    prompt:
      '¿Por qué el Talmud (Shabat 88a) y el Libro de Rut enseñan que la entrega de la Torá en Shavuot requiere tanto el compromiso del Sinaí («Naasé ve-Nishmá») como la bondad amorosa (Jésed)?',
  },
  {
    id: 'rosh-hashana',
    titleEs: 'Rosh Hashaná',
    titleHe: 'רֹאשׁ הַשָּׁנָה',
    seasonEs: '1 de Tishrei · Día del Juicio y Shofar',
    keySources: 'Leviticus 23:24 · Rosh Hashanah 16a · Hilchot Teshuvah 3:4',
    prompt:
      '¿Cuál es el significado espiritual del toque del Shofar en Rosh Hashaná según Maimónides (Hiljot Teshuvá 3:4) y cómo despierta al alma del letargo moral?',
  },
  {
    id: 'yom-kipur',
    titleEs: 'Yom Kipur (Teshuvá y Expiación)',
    titleHe: 'יוֹם כִּפּוּר',
    seasonEs: '10 de Tishrei · Día del Perdón',
    keySources: 'Leviticus 16:30 · Yoma 85b · Hilchot Teshuvah 2:1-2',
    prompt:
      '¿Por qué enseña la Mishná en Yoma 85b que Yom Kipur expía las transgresiones entre el ser humano y Dios, pero no las ofensas contra el prójimo hasta apaciguarlo y pedirle perdón directamente?',
  },
  {
    id: 'sucot',
    titleEs: 'Sucot (La Cabaña y la Alegría)',
    titleHe: 'סֻכּוֹת',
    seasonEs: '15 de Tishrei · Zman Simjatenu',
    keySources: 'Leviticus 23:42-43 · Sukkah 2a · Kohelet',
    prompt:
      '¿Por qué la Torá nos ordena salir de nuestra casa permanente para habitar en la fragilidad temporal de la Sucá (Levítico 23:42) precisamente para alcanzar la verdadera alegría (Zman Simjatenu)?',
  },
  {
    id: 'januca',
    titleEs: 'Janucá (La Luz de la Menorá)',
    titleHe: 'חֲנֻכָּה',
    seasonEs: '25 de Kislev · Fiesta de las Luminarias',
    keySources: 'Shabbat 21b · Zechariah 4:6 · Maharal (Ner Mitzvá)',
    prompt:
      '¿Cuál es el contraste histórico y filosófico entre la estética exterior de Grecia y la luz interior de la Torá (Shabat 21b: «Mehadrín min ha-Mehadrín») en la festividad de Janucá?',
  },
  {
    id: 'purim',
    titleEs: 'Purim (Providencia Oculta)',
    titleHe: 'פּוּרִים',
    seasonEs: '14 de Adar · Meguilat Ester',
    keySources: 'Esther 4:14 · Megillah 7a · Shabbat 88a',
    prompt:
      '¿Cómo revela el Libro de Ester (Hester Panim, el ocultamiento del Rostro Divino) la presencia de Dios detrás de la historia humana y por qué el Talmud (Shabat 88a) afirma que en Purim Israel reconfirmó la Torá por amor?',
  },
];

export const SuggestedTopicsHub: React.FC<SuggestedTopicsHubProps> = React.memo(({
  calendar,
  isLoadingCalendar,
  onChangeCalendarParams,
  onSelectTopic,
  onSelectSample,
  requestedTab,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<HubTab>('parasha');

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab.tab);
      setIsOpen(true);
    }
  }, [requestedTab]);

  const parasha = calendar?.parasha || null;
  const haftarah = calendar?.haftarah || null;
  const dafYomi = calendar?.dafYomi || null;
  const upcomingEvents = calendar?.upcomingEvents || [];
  const suggestedTopics = calendar?.suggestedTopics || [];
  const nextEvent = upcomingEvents[0];

  const openToTab = (tab: HubTab) => {
    setActiveTab(tab);
    setIsOpen(true);
  };

  const handleAnalyzeFullParasha = () => {
    if (!parasha) return;
    const q = `¿Cuál es el mensaje central de Parashat ${parasha.nameEs} (${parasha.nameHe} — ${parasha.fullRef}) según la exégesis PARDÉS y las lecturas de Rabino Jonathan Sacks y Rab Yehoshua Gordon?`;
    onSelectTopic(q, true);
  };

  const handleAnalyzeAliyah = (aliyah: CalendarAliyah) => {
    if (!parasha) return;
    const q = `¿Qué enseñanza fundamental contiene la ${aliyah.label} de Parashat ${parasha.nameEs} (${aliyah.ref}) según Rashi y la tradición jasídica?`;
    onSelectTopic(q, true);
  };

  const handleAnalyzeHaftarah = () => {
    if (!haftarah) return;
    const q = `¿Cómo se conecta el mensaje profético de la Haftará (${haftarah.displayEn} — ${haftarah.ref}) con ${
      parasha ? `Parashat ${parasha.nameEs}` : 'la lectura de la Torá de esta semana'
    }?`;
    onSelectTopic(q, true);
  };

  const handleSelectEvent = (ev: UpcomingLiturgicalEvent, combineWithParasha: boolean) => {
    const promptToUse =
      combineWithParasha && ev.combinedWithParashaPrompt
        ? ev.combinedWithParashaPrompt
        : ev.suggestedDerashaPrompt;
    onSelectTopic(promptToUse, true);
  };

  const handleSelectSuggestedTopic = (topic: SuggestedDerashaTopic) => {
    onSelectTopic(topic.prompt, true);
  };

  return (
    <section
      id="suggested-topics-hub"
      className="editorial-surface rounded-2xl overflow-hidden transition-all border border-slate-800/90"
    >
      {/* Main Header Row (Immediately visible right below the Study Desk) */}
      <div className="px-5 py-4 sm:px-6 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#090f1d]/90">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-widest text-amber-400/90 flex flex-wrap items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>02 · Sugerencias de Estudio: Parashá Semanal, Festividades y Musar</span>
            {calendar?.hebrewDateStr && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-sky-300 font-semibold normal-case tracking-normal">
                  {calendar.hebrewDateStr}
                </span>
              </>
            )}
          </div>

          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="font-editorial text-lg sm:text-xl font-bold text-white tracking-tight">
              Parashat HaShavúa, Festividades Judías y Biblioteca
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              {parasha ? `Esta semana: Parashat ${parasha.nameEs} (${parasha.nameHe})` : 'Parashá semanal'}
              {nextEvent ? ` · Próxima fecha: ${nextEvent.titleEs}` : ''}
            </p>
          </div>
        </div>

        {/* Interactive Category Controls */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="inline-flex flex-wrap items-center bg-[#070b16] p-1 rounded-xl border border-slate-800 text-xs gap-1">
            <button
              type="button"
              onClick={() => openToTab('parasha')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isOpen && activeTab === 'parasha'
                  ? 'bg-sky-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Scroll className="w-3.5 h-3.5" />
              <span>Parashá{parasha ? `: ${parasha.nameEs}` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => openToTab('festividades')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isOpen && activeTab === 'festividades'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Festividades</span>
            </button>

            <button
              type="button"
              onClick={() => openToTab('musar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isOpen && activeTab === 'musar'
                  ? 'bg-emerald-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Musar Diario</span>
            </button>

            <button
              type="button"
              onClick={() => openToTab('preguntas')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isOpen && activeTab === 'preguntas'
                  ? 'bg-indigo-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Preguntas Clásicas</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{isOpen ? 'Ocultar panel' : 'Desplegar'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* When collapsed, still show a 1-line quick study strip so Parashá and Festividades are never hidden */}
      {!isOpen && (
        <div className="px-5 py-3 border-t border-slate-800/80 bg-[#070b16]/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {parasha && (
              <button
                type="button"
                onClick={handleAnalyzeFullParasha}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <Scroll className="w-3.5 h-3.5 text-sky-400" />
                <span>Estudiar Parashat {parasha.nameEs} ({parasha.nameHe})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {nextEvent && (
              <button
                type="button"
                onClick={() => handleSelectEvent(nextEvent, false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Estudiar {nextEvent.titleEs}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openToTab('festividades')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer whitespace-nowrap"
            >
              <span>Ver todas las Festividades (Pésaj, Shavuot, Yom Kipur, Sucot...)</span>
            </button>
          </div>
        </div>
      )}

      {/* Expandable Body when user opens Temas Sugeridos */}
      {isOpen && (
        <div className="p-5 sm:p-7 border-t border-slate-800/90 bg-[#090f1d]/70 space-y-5">
          {/* Context Bar & Diaspora/Date Selector */}
          {(activeTab === 'parasha' || activeTab === 'festividades') && calendar && (
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 text-xs">
              <div className="text-slate-400 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  Ciclo litúrgico sincronizado con Sefaria ·{' '}
                  <strong className="text-slate-200">{calendar.hebrewDateStr}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeCalendarParams({ diaspora: true, date: calendar.gregorianDate })
                    }
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      calendar.diaspora
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Diáspora
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeCalendarParams({ diaspora: false, date: calendar.gregorianDate })
                    }
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      !calendar.diaspora
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
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
                      onChangeCalendarParams({
                        diaspora: calendar.diaspora,
                        date: e.target.value,
                      });
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* TAB 1: PARASHÁ DE LA SEMANA                                */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'parasha' && (
            <div className="space-y-4">
              {isLoadingCalendar && !calendar && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Consultando calendario litúrgico en Sefaria...
                </div>
              )}

              {parasha ? (
                <>
                  {/* Main Weekly Parasha Card */}
                  <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wider text-sky-400 font-medium">
                        Parashat HaShavúa · {parasha.fullRef}
                      </div>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h4 className="font-editorial text-xl sm:text-2xl font-bold text-white">
                          Parashat {parasha.nameEs}
                        </h4>
                        <span className="font-hebrew text-xl text-sky-300 font-semibold" dir="rtl">
                          {parasha.nameHe}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAnalyzeFullParasha}
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Estudiar Parashat {parasha.nameEs}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Haftarah & Daf Yomi Row */}
                  {(haftarah || dafYomi) && (
                    <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                      {haftarah && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Haftará:</span>
                          <strong className="text-amber-300">{haftarah.displayEn}</strong>
                          <span className="font-hebrew text-slate-300">({haftarah.displayHe})</span>
                          <button
                            type="button"
                            onClick={handleAnalyzeHaftarah}
                            className="text-sky-400 hover:text-sky-300 underline underline-offset-4 font-semibold ml-1 cursor-pointer"
                          >
                            Estudiar Haftará →
                          </button>
                        </div>
                      )}
                      {dafYomi && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Daf Yomi:</span>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTopic(
                                `¿Cuál es la enseñanza central del Daf Yomi de hoy en el Talmud (${dafYomi.ref} — ${dafYomi.displayHe})?`,
                                false
                              );
                              setIsOpen(false);
                            }}
                            className="text-indigo-300 hover:text-indigo-200 underline underline-offset-4 font-semibold cursor-pointer"
                          >
                            {dafYomi.displayEn} ({dafYomi.displayHe})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 7 Aliyot Grid */}
                  {parasha.aliyot && parasha.aliyot.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="text-xs font-medium text-slate-400 block">
                        O selecciona una Aliyá específica de Parashat {parasha.nameEs}:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {parasha.aliyot.map((aliyah) => (
                          <button
                            key={aliyah.number}
                            type="button"
                            onClick={() => handleAnalyzeAliyah(aliyah)}
                            className="group text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
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
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                  No se encontró una Parashá semanal ordinaria para esta fecha (puede coincidir con una festividad especial). Revisa la pestaña de Festividades.
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* TAB 2: FESTIVIDADES Y CALENDARIO LITÚRGICO                 */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'festividades' && (
            <div className="space-y-6">
              {/* Live Upcoming Calendar Events */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    Próximas Fechas del Calendario Hebreo en Vivo
                  </span>
                </div>
                {upcomingEvents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {upcomingEvents.slice(0, 6).map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="text-amber-300 font-medium">{ev.categoryLabelEs}</span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <Clock className="w-3 h-3 text-sky-400" />
                              {ev.daysUntil === 0
                                ? 'Hoy'
                                : ev.daysUntil === 1
                                ? 'Mañana'
                                : `En ${ev.daysUntil} días`}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="font-editorial text-base font-bold text-white">{ev.titleEs}</h4>
                            <span className="font-hebrew text-sm text-amber-200" dir="rtl">
                              {ev.titleHe}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {ev.memoEs}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleSelectEvent(ev, false)}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold text-xs transition-colors text-center cursor-pointer whitespace-nowrap"
                          >
                            Estudiar Fiesta
                          </button>
                          {ev.combinedWithParashaPrompt && parasha && (
                            <button
                              type="button"
                              onClick={() => handleSelectEvent(ev, true)}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs transition-colors text-center cursor-pointer whitespace-nowrap"
                            >
                              + Unir a Parashá
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                    Cargando festividades próximas...
                  </div>
                )}
              </div>

              {/* Complete Annual Cycle of Jewish Holidays (Moed) */}
              <div className="space-y-3 pt-4 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">
                    Ciclo Anual de Festividades Judías (Moed · Shabat, Pésaj, Shavuot, Yom Kipur, Sucot, Janucá, Purim)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Haz clic en cualquier festividad para generar su Derashá
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ANNUAL_FESTIVALS_LIBRARY.map((fest) => (
                    <button
                      key={fest.id}
                      type="button"
                      onClick={() => onSelectTopic(fest.prompt, true)}
                      className="text-left p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col justify-between gap-2.5 group cursor-pointer"
                    >
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-editorial font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                            {fest.titleEs}
                          </span>
                          <span className="font-hebrew text-sm text-amber-300 shrink-0" dir="rtl">
                            {fest.titleHe}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{fest.seasonEs}</div>
                        <div className="text-[10px] font-mono text-sky-300/90 pt-0.5">
                          {fest.keySources}
                        </div>
                      </div>

                      <div className="text-[11px] font-semibold text-amber-300 flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                        <span>Estudiar {fest.titleEs.split('(')[0].trim()}</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {suggestedTopics.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Ángulos sugeridos combinados:</span>
                  </span>
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSelectSuggestedTopic(topic)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      <span className="text-sky-400 font-semibold">{topic.badge} ·</span>
                      <span>{topic.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* TAB 3: MUSAR — SHOTS DE MESILAT YESHARIM (SEFARIA API)     */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'musar' && (
            <MesilatYesharimShotsCard
              onExploreInFullDerasha={(studyQuestion, autoSubmit) => {
                onSelectTopic(studyQuestion, autoSubmit);
                setIsOpen(false);
              }}
            />
          )}

          {/* ---------------------------------------------------------- */}
          {/* TAB 4: PREGUNTAS GENERALES DE ESTUDIO                      */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'preguntas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {SAMPLE_QUERIES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    onSelectSample(sample);
                    setIsOpen(false);
                  }}
                  className="text-left p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between gap-2 group cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-sky-300 group-hover:text-sky-200">
                        {sample.label}
                      </span>
                      <span className="text-[11px] text-slate-500">{sample.description}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {sample.query}
                    </p>
                  </div>
                  <div className="text-[11px] font-semibold text-sky-400 flex items-center gap-1 pt-1">
                    <span>Seleccionar esta pregunta</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});

import React, { useState, useEffect } from 'react';
import { MesilatYesharimShot } from '../../types';
import { requestMesilatShot, requestTranslateSource } from '../../services/api';
import { isLikelyEnglishText } from '../../services/sefaria';
import {
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowRight,
  Languages,
} from 'lucide-react';

interface MesilatYesharimShotsCardProps {
  onExploreInFullDerasha: (studyQuestion: string, autoSubmit: boolean) => void;
}

interface MidaCatalogOption {
  slug: string;
  stepNumber: number;
  nameHe: string;
  nameTranslit: string;
  nameEs: string;
  defaultChapter: number;
  shortDesc: string;
}

const MIDDOT_LADDER: MidaCatalogOption[] = [
  {
    slug: 'deber-del-hombre',
    stepNumber: 1,
    nameHe: 'חוֹבַת הָאָדָם בְּעוֹלָמוֹ',
    nameTranslit: 'Jovat HaAdam BeOlamó',
    nameEs: 'El Propósito en el Mundo',
    defaultChapter: 1,
    shortDesc: 'Claridad de propósito vital (Cap. 1)',
  },
  {
    slug: 'zehirut',
    stepNumber: 2,
    nameHe: 'זְהִירוּת',
    nameTranslit: 'Zehirut',
    nameEs: 'Cuidado y Conciencia',
    defaultChapter: 2,
    shortDesc: 'Autoexamen y atención consciente (Cap. 2–5)',
  },
  {
    slug: 'zerizut',
    stepNumber: 3,
    nameHe: 'זְרִיזוּת',
    nameTranslit: 'Zerizut',
    nameEs: 'Diligencia y Entusiasmo',
    defaultChapter: 6,
    shortDesc: 'Vencer la inercia y la postergación (Cap. 6–9)',
  },
  {
    slug: 'nekiyut',
    stepNumber: 4,
    nameHe: 'נְקִיּוּת',
    nameTranslit: 'Nekiyut',
    nameEs: 'Limpieza Moral',
    defaultChapter: 10,
    shortDesc: 'Refinar rasgos sutiles del carácter (Cap. 10–12)',
  },
  {
    slug: 'perishut',
    stepNumber: 5,
    nameHe: 'פְּרִישׁוּת',
    nameTranslit: 'Perishut',
    nameEs: 'Autodominio y Sobriedad',
    defaultChapter: 13,
    shortDesc: 'Libertad frente al exceso material (Cap. 13–15)',
  },
  {
    slug: 'tahara',
    stepNumber: 6,
    nameHe: 'טָהֳרָה',
    nameTranslit: 'Tahará',
    nameEs: 'Pureza de Intención',
    defaultChapter: 16,
    shortDesc: 'Sinceridad de corazón sin segundas intenciones (Cap. 16–18)',
  },
  {
    slug: 'jasidut',
    stepNumber: 7,
    nameHe: 'חֲסִידוּת',
    nameTranslit: 'Jasidut',
    nameEs: 'Devoción y Bondad Amorosa',
    defaultChapter: 19,
    shortDesc: 'Ir más allá de la letra de la ley por amor (Cap. 19–21)',
  },
  {
    slug: 'anava',
    stepNumber: 8,
    nameHe: 'עֲנָוָה',
    nameTranslit: 'Anavá',
    nameEs: 'Humildad Interior',
    defaultChapter: 22,
    shortDesc: 'Reconocer nuestros dones sin soberbia (Cap. 22–23)',
  },
  {
    slug: 'yirat-jet',
    stepNumber: 9,
    nameHe: 'יִרְאַת חֵטְא',
    nameTranslit: 'Yirat Jet',
    nameEs: 'Reverencia Moral',
    defaultChapter: 24,
    shortDesc: 'Sensibilidad ante el impacto de cada acto (Cap. 24–25)',
  },
  {
    slug: 'kedusha',
    stepNumber: 10,
    nameHe: 'קְדוּשָׁה',
    nameTranslit: 'Kedushá',
    nameEs: 'Santidad Cotidiana',
    defaultChapter: 26,
    shortDesc: 'Elevar lo físico en conexión con lo Divino (Cap. 26)',
  },
];

export const MesilatYesharimShotsCard: React.FC<MesilatYesharimShotsCardProps> = ({
  onExploreInFullDerasha,
}) => {
  const [selectedMida, setSelectedMida] = useState<MidaCatalogOption>(MIDDOT_LADDER[1]); // Default: Zehirut / Cuidado
  const [paragraph, setParagraph] = useState<number>(1);
  const [shot, setShot] = useState<MesilatYesharimShot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showOriginalText, setShowOriginalText] = useState<boolean>(true);
  const [actionCompleted, setActionCompleted] = useState<boolean>(false);
  const [isTranslatingExcerpt, setIsTranslatingExcerpt] = useState<boolean>(false);

  const handleTranslateShotExcerpt = async () => {
    if (!shot) return;
    setIsTranslatingExcerpt(true);
    try {
      const res = await requestTranslateSource({
        ref: shot.sefariaRef,
        hebrewText: shot.hebrewExcerpt,
        englishText: shot.englishExcerpt || shot.spanishTranslation,
      });
      if (res.spanishTranslation) {
        setShot((prev) =>
          prev ? { ...prev, spanishTranslation: res.spanishTranslation } : prev
        );
      }
    } catch (err) {
      console.warn('Warning translating Mesilat shot excerpt:', err);
    } finally {
      setIsTranslatingExcerpt(false);
    }
  };

  const loadShot = async (mida: MidaCatalogOption, paraNum: number) => {
    setIsLoading(true);
    setActionCompleted(false);
    try {
      const data = await requestMesilatShot({
        chapter: mida.defaultChapter,
        paragraph: paraNum,
      });
      setShot(data);
    } catch (err) {
      console.warn('Warning loading Mesilat Yesharim shot:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!shot && !isLoading) {
      loadShot(selectedMida, paragraph);
    }
  }, []);

  const handleSelectMida = (mida: MidaCatalogOption) => {
    setSelectedMida(mida);
    setParagraph(1);
    loadShot(mida, 1);
  };

  const handleNextParagraph = () => {
    const nextPara = (paragraph % 5) + 1;
    setParagraph(nextPara);
    loadShot(selectedMida, nextPara);
  };

  const sefariaUrl =
    shot?.sefariaUrl ||
    (shot?.sefariaRef
      ? `https://www.sefaria.org/${encodeURIComponent(shot.sefariaRef.replace(/\s+/g, '_'))}?lang=bi`
      : 'https://www.sefaria.org/Mesillat_Yesharim');

  return (
    <div className="space-y-4">
      {/* 10 Rungs (Peldaños / Middot) Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">
            Escalera de *Mesilat Yesharim* (El Ramjal) — Selecciona un Peldaño / Midá:
          </span>
          <a
            href={sefariaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            <span>Ver en Sefaria.org</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {MIDDOT_LADDER.map((m) => {
            const isSelected = selectedMida.slug === m.slug;
            return (
              <button
                key={m.slug}
                type="button"
                disabled={isLoading}
                onClick={() => handleSelectMida(m)}
                className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {m.stepNumber}
                </span>
                <div>
                  <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>{m.nameTranslit}</span>
                    <span className="font-hebrew text-amber-300 text-xs">{m.nameHe}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">{m.nameEs}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-200">
              Extrayendo texto de Mesilat Yesharim desde la Biblioteca de Sefaria...
            </p>
            <p className="text-xs text-slate-400">
              Estructurando Shot de Musar ({selectedMida.nameTranslit} • {selectedMida.nameEs})
            </p>
          </div>
        </div>
      )}

      {/* Shot Content */}
      {!isLoading && shot && (
        <div className="space-y-4">
          {/* Top Shot Header: Nivel / Rasgo (Midá) */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                  Peldaño {shot.ladderStepNumber} de 10 • Midá (Rasgo)
                </span>
                <span className="text-xs font-mono text-sky-400 bg-sky-950/50 border border-sky-500/30 px-2 py-0.5 rounded">
                  {shot.sefariaRef} ({shot.sefariaHeRef})
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2.5 flex-wrap pt-1">
                <span>{shot.middahNameEs}</span>
                <span className="font-hebrew text-2xl text-amber-400 font-normal">
                  {shot.middahNameHe}
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleNextParagraph}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
                title="Extraer otro párrafo de este peldaño desde Sefaria"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Otro Shot ({selectedMida.nameTranslit})</span>
              </button>
            </div>
          </div>

          {/* 4 Structured Pillars of the Musar Shot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Definición Breve según el Ramjal */}
            <div className="p-4 rounded-xl bg-slate-900/75 border border-sky-500/25 flex flex-col justify-between space-y-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sky-400">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    1. Definición Breve (El Ramjal)
                  </h4>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {shot.briefDefinition}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                Concepto raíz en <span className="italic">Mesilat Yesharim</span>
              </div>
            </div>

            {/* 2. Obstáculo Común en la vida cotidiana */}
            <div className="p-4 rounded-xl bg-slate-900/75 border border-rose-500/25 flex flex-col justify-between space-y-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    2. Obstáculo Común
                  </h4>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {shot.commonObstacle}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                Fricción psicológica y espiritual diaria
              </div>
            </div>

            {/* 3. Acción del Día (Microejercicio práctico) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-900/90 border border-emerald-500/35 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      3. Acción del Día (Microejercicio)
                    </h4>
                  </div>
                </div>
                <p className="text-sm text-emerald-100/95 leading-relaxed font-medium">
                  {shot.dailyAction}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActionCompleted(!actionCompleted)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  actionCompleted
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {actionCompleted
                    ? '¡Compromiso del día asumido!'
                    : 'Asumir este microejercicio hoy'}
                </span>
              </button>
            </div>
          </div>

          {/* Adaptación Contemporánea (Chabad.org / Aish Latino style) */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enfoque Práctico Contemporáneo (Estilo Jabad / Aish Latino)</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {shot.chabadOrAishInsight}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onExploreInFullDerasha(
                  `¿Cómo se aplica el peldaño de ${shot.middahNameEs} en Mesilat Yesharim (${shot.sefariaRef}) a los dilemas éticos y espirituales de nuestra vida actual?`,
                  true
                )
              }
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-sm"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Usar como Tema de Estudio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Collapsible Canonical Source from Sefaria API v3 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOriginalText(!showOriginalText)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/70"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>
                  Texto Canónico del Ramjal en Sefaria ({shot.sefariaRef}) — Hebreo Vocalizado y Traducción al Español
                </span>
              </span>
              {showOriginalText ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showOriginalText && (
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-slate-800/80">
                {/* Hebrew Text */}
                <div
                  dir="rtl"
                  className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 font-hebrew text-lg sm:text-xl leading-relaxed text-amber-100"
                >
                  {shot.hebrewExcerpt}
                </div>

                {/* Spanish / English Translation with Proposal if in English */}
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/90 flex flex-col justify-between space-y-3">
                  {isLikelyEnglishText(shot.spanishTranslation) ? (
                    <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-500/35 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-sky-200">
                        Sefaria entregó este fragmento en inglés. ¿Deseas traducirlo al español?
                      </span>
                      <button
                        type="button"
                        onClick={handleTranslateShotExcerpt}
                        disabled={isTranslatingExcerpt}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        {isTranslatingExcerpt ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Traduciendo...</span>
                          </>
                        ) : (
                          <>
                            <Languages className="w-3 h-3" />
                            <span>Traducir al Español</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                    «{shot.spanishTranslation}»
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <span>Rabí Moshé Jaim Luzzatto (Ramjal, 1740)</span>
                    <a
                      href={sefariaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Abrir capítulo en Sefaria</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

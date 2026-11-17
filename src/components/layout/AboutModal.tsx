import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Compass,
  Layers,
  ScrollText,
  GitBranch,
  Footprints,
  BookOpen,
  Flame,
  Scale,
  Wand2,
  CheckCircle2,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'methodologies' | 'verification';

interface MethodologyGuideEntry {
  id: string;
  gateLabel: string;
  title: string;
  hebrewTitle: string;
  accentClass: string;
  icon: React.ReactNode;
  summary: string;
  structure: string[];
  whenToUse: string;
  keyAuthorities: string;
}

const OTHER_METHODOLOGIES: MethodologyGuideEntry[] = [
  {
    id: 'WISSENSCHAFT_DES_JUDENTUMS',
    gateLabel: 'Puerta 1 · Histórico-Filológica',
    title: 'Wissenschaft des Judentums',
    hebrewTitle: 'חָכְמַת יִשְׂרָאֵל וּבִקֹּרֶת הַנֻּסָּח',
    accentClass: 'border-amber-500/35 bg-amber-950/20 text-amber-300',
    icon: <ScrollText className="w-4 h-4 text-amber-400 shrink-0" />,
    summary:
      'Investigación histórica, filológica y redaccional del texto sagrado, la liturgia del Sidur y la evolución institucional del judaísmo.',
    structure: [
      '1. Crítica textual y manuscritos (Genizá de El Cairo, variantes de Núsaj)',
      '2. Estratos de redacción tanaítica, amoraica y geónica',
      '3. Contexto histórico, sociológico y normativo',
      '4. Síntesis teológica comparada',
    ],
    whenToUse:
      'Historia de la sinagoga, origen de plegarias, manuscritos antiguos y diferencias históricas de ritos.',
    keyAuthorities: 'Zunz, Elbogen, Lieberman, Rav Kasher, Talmud Yerushalmi y Bavli.',
  },
  {
    id: 'EVOLUCION_CONCEPTUAL',
    gateLabel: 'Puerta 2 · Genealogía en 4 Estratos',
    title: 'Evolución del Concepto (4 Visiones)',
    hebrewTitle: 'הִשְׁתַּלְשְׁלוּת הָרַעְיוֹן',
    accentClass: 'border-cyan-500/35 bg-cyan-950/20 text-cyan-300',
    icon: <GitBranch className="w-4 h-4 text-cyan-400 shrink-0" />,
    summary:
      'Traza cómo nace y se transforma una idea espiritual o teológica desde la Torá escrita hasta las distintas escuelas jasídicas.',
    structure: [
      '1. Torá Escrita y Literatura de Jazal (Talmud y Midrash)',
      '2. Cábala y Árbol de la Vida (Sefirot, Zóhar, Arizal)',
      '3. Tradición del Musar clásico',
      '4. Jasidut y contraste entre escuelas (Besht, Jabad/Tania, Breslev, Sfat Emet)',
    ],
    whenToUse:
      'Conceptos como Jésed, Guevurá, Teshuvá, Bitajón, Devekut o Kedushá vistos a través de los siglos.',
    keyAuthorities: 'Zóhar, Ramak, Tania (Alter Rebe), Likutei Moharán, Sfat Emet.',
  },
  {
    id: 'FILOSOFIA_CONTRASTIVA',
    gateLabel: 'Puerta 3 · Diálogo Filosófico',
    title: 'Filosofía Contrastiva (Majshévet Yisrael)',
    hebrewTitle: 'מַחְשֶׁבֶת יִשְׂרָאֵל וּפִילוֹסוֹפְיָה',
    accentClass: 'border-rose-500/35 bg-rose-950/20 text-rose-300',
    icon: <Scale className="w-4 h-4 text-rose-400 shrink-0" />,
    summary:
      'Compara con rigor intelectual las fuentes internas de la Torá frente a sistemas filosóficos o religiones externas citadas explícitamente.',
    structure: [
      '1. Planteamiento de fuentes judías frente a la corriente externa consultada',
      '2. Universalidad ética vs. especificidad del Pacto y la Mitzvá',
      '3. Respaldo en fuentes canónicas verificadas',
      '4. Síntesis judía diferenciada sin sincretismo',
    ],
    whenToUse:
      'Solo cuando preguntas por pensadores o tradiciones externas (Platón, Aristóteles, Kant, Estoicos, Budismo, etc.).',
    keyAuthorities: 'Saadia Gaón, Kuzari (Yehudá HaLeví), Moreh Nevujim (Rambam), Rav Sacks.',
  },
  {
    id: 'PIRKE_AVOT_EXEGETICO',
    gateLabel: 'Puerta 4 · Máximas Tanaíticas',
    title: 'Pirké Avot Exegético',
    hebrewTitle: 'פִּרְקֵי אָבוֹת',
    accentClass: 'border-yellow-500/35 bg-yellow-950/20 text-yellow-300',
    icon: <BookOpen className="w-4 h-4 text-yellow-400 shrink-0" />,
    summary:
      'Desmenuza aforismos de los Sabios de la Mishná contrastando sus grandes comentaristas medievales y renacentistas.',
    structure: [
      '1. Biografía e impronta espiritual del Tanaíta (Hilel, Shamái, R. Akiva, Ben Zoma)',
      '2. Debate clásico entre comentaristas: Rambam vs. Rabenu Yoná y Maharal',
      '3. Principio vivo aplicado a la vida ética contemporánea',
    ],
    whenToUse:
      'Cualquier capítulo o mishná de Pirké Avot («Si no soy para mí…», «En tres cosas se sostiene el mundo…»).',
    keyAuthorities: 'Rambam (Shemoná Perakim / Avot), Rabenu Yoná de Gerona, Maharal (Derej Jaim).',
  },
  {
    id: 'MESILAT_YESHARIM_SISTEMATICO',
    gateLabel: 'Puerta 5 · Escalera Ética del Ramjal',
    title: 'Mesilat Yesharim Sistemático',
    hebrewTitle: 'מְסִלַּת יְשָׁרִים',
    accentClass: 'border-emerald-500/35 bg-emerald-950/20 text-emerald-300',
    icon: <Footprints className="w-4 h-4 text-emerald-400 shrink-0" />,
    summary:
      'Anatomía sistemática de una virtud (Midá) siguiendo la arquitectura precisa de Rabí Moshé Jaim Luzzatto (Ramjal).',
    structure: [
      '1. Mahut (מַהוּת): Definición y esencia exacta de la virtud',
      '2. Jalakim (חֲלָקִים): Divisiones y niveles prácticos',
      '3. Dérej Kinyanó (דֶּרֶךְ קִנְיָנוֹ): Método concreto para adquirirla',
      '4. Mafsidayv (מַפְסִידָיו): Obstáculos y trampas que la destruyen',
    ],
    whenToUse:
      'Estudio estructurado de virtudes: Zehirut (cuidado), Zerizut (diligencia), Nekiyut, Perishut, Anavá (humildad).',
    keyAuthorities: 'Rabí Moshé Jaim Luzzatto (Ramjal), Mesilat Yesharim y Dérej Hashem.',
  },
  {
    id: 'MUSAR_TRANSFORMATIVO',
    gateLabel: 'Puerta 6 · Psicología Moral',
    title: 'Musar Transformativo',
    hebrewTitle: 'מוּסָר וְחֶשְׁבּוֹן הַנֶּפֶשׁ',
    accentClass: 'border-indigo-500/35 bg-indigo-950/20 text-indigo-300',
    icon: <Flame className="w-4 h-4 text-indigo-400 shrink-0" />,
    summary:
      'Laboratorio de introspección emocional para cerrar la brecha entre lo que la mente sabe y cómo reacciona el carácter.',
    structure: [
      '1. Punto focal de la tensión interna o conducta reactiva',
      '2. Diagnóstico del Néfesh: raíz del interés propio (Negiá) y automatismos',
      '3. Ejercicios concretos de Jeshbón HaNéfesh (balance cotidiano)',
    ],
    whenToUse:
      'Conflictos emocionales, ira, envidia, orgullo, ansiedad, crítica interpersonal o falta de constancia.',
    keyAuthorities: 'Rabí Israel Salanter, Alter de Kelm, Rav Eliahu Dessler (Mijtav MeEliahu).',
  },
];

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('methodologies');

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-methodologies-title"
    >
      <div className="bg-[#0d1526] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-800 bg-[#090f1d]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-400/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 id="about-methodologies-title" className="text-base sm:text-lg font-bold text-white">
                Guía de Metodologías (PARDÉS y 6 Métodos) &amp; Verificación
              </h2>
              <p className="text-xs text-slate-400">
                Las 7 Puertas Lógicas de exégesis judaica, el Módulo Halájico y el flujo canónico en Sefaria
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar guía metodológica"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#0a1120] border-b border-slate-800/90 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('methodologies')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'methodologies'
                ? 'bg-sky-400 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>PARDÉS y las 7 Metodologías</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'verification'
                ? 'bg-emerald-400 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verificación en 3 Fases &amp; Halajá</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed flex-1">
          {activeTab === 'methodologies' ? (
            <>
              {/* Featured: PARDÉS Clásico */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#090f1d] border border-sky-500/35 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300 block">
                      Puerta 7 (Base Clásica) · Exégesis en 4 Niveles
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>PARDÉS Clásico</span>
                      <span className="font-hebrew text-xl text-sky-400">פַּרְדֵּס</span>
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300">
                  El término <strong>PARDÉS</strong> (literalmente <em>«Huerto»</em>) es un acrónimo de los cuatro niveles concéntricos de interpretación de la Torá, la Halajá y la liturgia judía. Es también la puerta que se combina con el <strong>Módulo Halájico</strong> cuando preguntas por leyes prácticas o el <em>Shulján Aruj</em>:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25">
                    <span className="font-hebrew text-base font-bold text-emerald-400 block mb-0.5">
                      פ - פְּשָׁט (Pshat)
                    </span>
                    <span className="font-semibold text-[11px] text-emerald-300 uppercase tracking-wider block mb-1">
                      Sentido Literal y Normativo
                    </span>
                    <p className="text-xs text-slate-400">
                      Gramática hebraica pura, raíces, contexto histórico original y dictamen jurídico básico.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/25">
                    <span className="font-hebrew text-base font-bold text-indigo-400 block mb-0.5">
                      ר - רֶמֶז (Rémez)
                    </span>
                    <span className="font-semibold text-[11px] text-indigo-300 uppercase tracking-wider block mb-1">
                      Sentido Alusivo y Filosófico
                    </span>
                    <p className="text-xs text-slate-400">
                      Pistas intertextuales, alusiones éticas, acrósticos y valores numéricos (Guematriá).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/25">
                    <span className="font-hebrew text-base font-bold text-amber-400 block mb-0.5">
                      ד - דְּרַשׁ (Drash)
                    </span>
                    <span className="font-semibold text-[11px] text-amber-300 uppercase tracking-wider block mb-1">
                      Sentido Homilético
                    </span>
                    <p className="text-xs text-slate-400">
                      Exégesis rabínica, relatos midráshicos, debates talmúdicos y aplicación ética comunitaria.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/25">
                    <span className="font-hebrew text-base font-bold text-sky-400 block mb-0.5">
                      ס - סוֹד (Sod)
                    </span>
                    <span className="font-semibold text-[11px] text-sky-300 uppercase tracking-wider block mb-1">
                      Sentido Místico e Interior
                    </span>
                    <p className="text-xs text-slate-400">
                      Secretos de la Cábala, Sefirot, rectificación (Tikún) e intención interior (Kavaná).
                    </p>
                  </div>
                </div>
              </div>

              {/* Other 6 Methodologies */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Las Demás Metodologías Disponibles (Puertas Lógicas 1 a 6)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Seleccionables manualmente o en combinación (10 min / 30 min)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {OTHER_METHODOLOGIES.map((method) => (
                    <div
                      key={method.id}
                      className="p-4 rounded-xl bg-[#090f1d] border border-slate-800 space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400 block">
                              {method.gateLabel}
                            </span>
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                              {method.icon}
                              <span>{method.title}</span>
                            </h4>
                          </div>
                          <span
                            className="font-hebrew text-xs text-slate-400 shrink-0"
                            dir="rtl"
                          >
                            {method.hebrewTitle}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{method.summary}</p>

                        <ul className="space-y-1 text-[11px] text-slate-400 bg-[#060a14] border border-slate-800/80 rounded-lg p-2.5">
                          {method.structure.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
                        <p className="text-slate-300">
                          <strong className="text-sky-300">Ideal para:</strong> {method.whenToUse}
                        </p>
                        <p className="text-slate-400">
                          <strong className="text-slate-200">Fuentes típicas:</strong>{' '}
                          {method.keyAuthorities}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AUTO Gate & Multi-Methodology Summary */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-slate-300">
                  <strong className="text-amber-200 block text-sm">
                    Modo Automático (Compuerta Inteligente) y Aportes Combinados
                  </strong>
                  <p>
                    Si dejas activo <strong>AUTO</strong>, el sistema analiza tu pregunta antes de generar y escoge la puerta óptima de las 7 metodologías. En lecciones de <strong>10 min</strong> puedes añadir <strong>1 metodología complementaria</strong>, y en <strong>30 min (Shiur Magistral)</strong> hasta <strong>2 aportes complementarios</strong> que enriquecen la exposición principal sin mezclar fuentes ajenas.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              {/* Anti-Hallucination 3-phase flow */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#090f1d] border border-emerald-500/30 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Flujo de Verificación Canónica Antialucinación (3 Fases)</span>
                </h3>
                <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <div className="flex gap-3 items-start p-3 rounded-xl bg-[#060a14] border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <strong className="text-white block">Fase 1 · Desglose Filológico</strong>
                      Se analizan las raíces trilíteras (<em>shoresh</em>), morfología verbal (<em>binyan</em>), claves teológicas y se deducen las referencias exactas a verificar.
                    </div>
                  </div>
                  <div className="flex gap-3 items-start p-3 rounded-xl bg-[#060a14] border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <strong className="text-white block">Fase 2 · Descarga Directa desde Sefaria</strong>
                      Se consulta en vivo la biblioteca canónica de Sefaria para recuperar el texto original hebreo/arameo y su traducción verificada antes de redactar nada.
                    </div>
                  </div>
                  <div className="flex gap-3 items-start p-3 rounded-xl bg-[#060a14] border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <strong className="text-white block">Fase 3 · Redacción Fidedigna</strong>
                      La Drashá se construye únicamente sobre las fuentes descargadas en la Fase 2, impidiendo versículos inventados o citas apócrifas.
                    </div>
                  </div>
                </div>
              </div>

              {/* Halakhic Module & Mishnat HaDorot */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#090f1d] border border-slate-800 space-y-2.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Módulo Halájico (Shulján Aruj) y Mishnat HaDorot</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Cuando la consulta trata sobre Halajá normativa interna (<em>Shabat, Kashrut, Avelut, Tefilá, Minhag</em>), se activa una protección estricta anti-intrusión que bloquea filósofos externos, cita el <strong>Shulján Aruj</strong> (Mejaber y Ramá) con precisión de <em>Simán:Seif</em> y habilita <strong>Mishnat HaDorot</strong> para consultar en Sefaria el desarrollo cronológico desde <em>Jazal</em> y <em>Rishonim</em> hasta <em>Ajaronim Clásicos</em> y <em>Poskim Contemporáneos</em>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-[#090f1d] text-xs text-slate-400">
          <span>7 Metodologías Hermenéuticas · Fuentes reales de Sefaria</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-sky-400 hover:bg-sky-300 text-slate-950 transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

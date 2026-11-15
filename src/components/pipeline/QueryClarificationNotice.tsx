import React from 'react';
import {
  Clock,
  HelpCircle,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Edit3,
  Cpu,
} from 'lucide-react';
import { evaluateMethodologyLogicGates } from '../../utils/methodologyLogicGates';

export interface ClarificationState {
  mode: 'clarification_needed' | 'timeout_unavailable';
  originalQuery: string;
  reason: string;
  suggestedRefinements: string[];
}

interface QueryClarificationNoticeProps {
  state: ClarificationState;
  onSelectRefinement: (refinedQuery: string) => void;
  onForceOriginalQuery: () => void;
  onDismissAndEdit: () => void;
}

export function buildRefinementsForQuery(rawQuery: string): string[] {
  const cleaned = rawQuery.trim().replace(/[¿?¡!]+/g, '').trim();
  const lower = cleaned.toLowerCase();

  // 1. Rosh Jódesh (1 o 2 días) & Halel
  if (
    lower.includes('rosh jodesh') ||
    lower.includes('rosh jódesh') ||
    lower.includes('rosh chodesh') ||
    lower.includes('jodesh') ||
    lower.includes('jódesh') ||
    lower.includes('mes que termina') ||
    lower.includes('halel') ||
    lower.includes('hallel')
  ) {
    return [
      '¿Por qué Rosh Jódesh es de 1 o de 2 días dependiendo de cuántos días tiene el mes que termina (Jódesh Jaser de 29 días vs. Jódesh Malé de 30 días) según el Shulján Aruj (Oraj Jaim 427:1) y Rambam (Hiljot Kidush HaJódesh 8:4)?',
      '¿Cuál es la Halajá y el motivo talmúdico de la diferencia entre Halel Completo (Halel Shalem) y Medio Halel (Jatsi Halel) en Rosh Jódesh y Pésaj según Arjin 10a y Taanit 28b?',
      '¿Cuál es la disputa de Minhag y Halajá entre el Shulján Aruj (Rabí Yosef Karo, rito sefardí) y el Ramá (Rabí Moshé Isserles, rito ashkenazí) en Oraj Jaim 422:2 sobre recitar berajá en el Medio Halel?',
      'Evolución del concepto de renovación lunar (Jódesh, raíz ח-ד-ש) a través de las 4 visiones: 1. Torá y Jazal · 2. Árbol de la Vida (Cábala) · 3. Musar · 4. Jasidut',
    ];
  }

  // 2. Shulján Aruj, Minhag, Núsaj, Halajá y Kashrut
  if (
    lower.includes('shuljan') ||
    lower.includes('shulján') ||
    lower.includes('minhag') ||
    lower.includes('mi jag') ||
    lower.includes('nusaj') ||
    lower.includes('núsaj') ||
    lower.includes('costumbre') ||
    lower.includes('alaja') ||
    lower.includes('alajá') ||
    lower.includes('halaja') ||
    lower.includes('halajá') ||
    lower.includes('kashrut') ||
    lower.includes('kosher') ||
    lower.includes('sefard') ||
    lower.includes('ashkenaz')
  ) {
    return [
      '¿Cómo articula el Shulján Aruj la relación entre la ley base de Rabí Yosef Karo (El Mejaber · tradición Sefardí / Edot HaMizraj) y el «mantel» (HaMapá) del Ramá (tradición Ashkenazí) en el cumplimiento práctico de las Mitzvot?',
      '¿Cuál es la diferencia conceptual y halájica entre Halajá (ley normativa), Minhag (costumbre comunitaria ancestral: «Minhag Yisrael Torá hi») y Núsaj (rito litúrgico: Sefarad, Ashkenaz, Ari/Jasídico y Teimaní) según Shulján Aruj Oraj Jaim 68:1 y Yoré Deá 214:1?',
      'Fundamentos de Kashrut en el Shulján Aruj (Yoré Deá 87:1–3): la prohibición de Basar BeJalav (carne y leche), los tiempos de espera según cada Minhag y su sentido ético',
      '¿Por qué Rosh Jódesh se celebra 1 o 2 días según si el mes saliente tiene 29 días (Jaser) o 30 días (Malé) en el Shulján Aruj (Oraj Jaim 427:1) y cómo afecta al recitado del Medio Halel?',
    ];
  }

  // 3. Parashat Toledot / Yaakov & Esav
  if (lower.includes('esav') || lower.includes('esaú') || lower.includes('yaakov') || lower.includes('engaño') || lower.includes('toldot') || lower.includes('toledot')) {
    return [
      '¿Por qué Targum Onkelos y Rashi explican que Yaakov tomó la bendición de Yitzjak «con sabiduría» (be-jojmá) en Génesis 27:35?',
      '¿Cómo explica el Midrash Bereshit Rabá 65:10 la ceguera de Yitzjak y la visión profética de Rivká en Parashat Toldot?',
      'La venta de la primogenitura de Esav (Génesis 25:29-34): diagnóstico del Néfesh y la fricción entre el impulso inmediato y la visión trascendente en el Musar Transformativo',
      'Evolución del concepto de Emet (Verdad de Yaakov) en las 4 visiones: 1. Torá y Jazal · 2. Árbol de la Vida (Tiféret en la Cábala) · 3. Musar · 4. Jasidut',
    ];
  }

  // 4. Shemá Israel
  if (lower.includes('shema') || lower.includes('shemá') || lower.includes('dalet') || lower.includes('reish') || lower.includes('ejad')) {
    return [
      '¿Por qué la letra Dálet de Ejad en el Shemá (Deuteronomio 6:4) se escribe agrandada para no confundirse con la Reish de Ajer?',
      '¿Por qué las letras Áyin y Dálet agrandadas en el Shemá forman la palabra Ed (Testigo) según la exégesis del PARDÉS?',
      'Historia litúrgica y crítica textual del recitado del Shemá y sus bendiciones desde la Mishná Berajot hasta la Guenizá de El Cairo (Wissenschaft des Judentums)',
      'Las leyes de Kavaná en el primer versículo del Shemá según el Shulján Aruj (Oraj Jaim 61:1-6), el Mejaber y el Ramá',
    ];
  }

  // 5. Shabat
  if (lower.includes('shabat') || lower.includes('shabbat') || lower.includes('oneg') || lower.includes('melaj')) {
    return [
      '¿Cuál es el significado espiritual de Shabat como «Me’ein Olam HaBá» (anticipo del Mundo Venidero) en el Talmud y la Cábala?',
      '¿Cómo se complementan «Shamor» (guardar) y «Zajor» (recordar) el Shabat según el Talmud (Shevuot 20b), Rashi y el Shulján Aruj (Oraj Jaim 271:1)?',
      'Evolución del concepto de Oneg Shabat y Neshamá Yeterá (Beitzá 16a) a través de las 4 visiones: Torá, Árbol de la Vida (Cábala), Musar y Jasidut',
      'El concepto de Melajá en Shabat (Shabat 73a): por qué el descanso sabático se define como cese de transformación creativa (las 39 Melajot del Mishkán)',
    ];
  }

  // 6. Gate 1: Wissenschaft des Judentums (Sinagoga, Sidur, Amidá, Guenizá, Manuscritos, Esdras, Sotá 40a)
  if (
    lower.includes('sinagoga') ||
    lower.includes('sidur') ||
    lower.includes('amida') ||
    lower.includes('amidá') ||
    lower.includes('gueniza') ||
    lower.includes('guenizá') ||
    lower.includes('manuscrito') ||
    lower.includes('esdras') ||
    lower.includes('modim') ||
    lower.includes('sota') ||
    lower.includes('sotá') ||
    lower.includes('wissenschaft') ||
    lower.includes('historia') ||
    lower.includes('filolog')
  ) {
    return [
      `¿Cómo evolucionó históricamente «${cleaned}» desde la época de Esdras el Escriba y el Segundo Templo hasta su codificación en la Mishná y el Talmud según la crítica histórico-filológica (Wissenschaft des Judentums)?`,
      `Análisis de crítica textual y manuscritos sobre «${cleaned}»: comparación de variantes entre el rito palestinense (Guenizá de El Cairo / Talmud Yerushalmi) y el rito babilónico (Seder Rav Amram Gaón)`,
      `El debate redaccional de los Tanaím y Amoraím en torno a «${cleaned}» (Sotá 40a, Berajot 33a) y su recepción en los códigos medievales (Rashi, Tosafot, Rambam y Majzor Vitry)`,
      `Estudio halájico sobre «${cleaned}» en el Shulján Aruj (Mejaber y Ramá) y las diferencias de Minhag y Núsaj`,
    ];
  }

  // 7. Gate 3: Pensadores Externos y Filosofía Contrastiva (Kant, Platón, Cicerón, Aristóteles, Estoicismo, Spinoza, Budismo, Nirvana, Olam HaBá)
  if (
    lower.includes('kant') ||
    lower.includes('platon') ||
    lower.includes('platón') ||
    lower.includes('ciceron') ||
    lower.includes('cicerón') ||
    lower.includes('aristoteles') ||
    lower.includes('aristóteles') ||
    lower.includes('estoic') ||
    lower.includes('seneca') ||
    lower.includes('séneca') ||
    lower.includes('spinoza') ||
    lower.includes('nietzsche') ||
    lower.includes('kierkegaard') ||
    lower.includes('buda') ||
    lower.includes('budismo') ||
    lower.includes('nirvana') ||
    lower.includes('valhalla') ||
    lower.includes('olam haba') ||
    lower.includes('olam habá') ||
    lower.includes('filosof')
  ) {
    return [
      `Contraste exegético formal entre «${cleaned}» y la cosmovisión de la Torá: Universalidad de la ley moral frente a la Especificidad del Mandamiento (Proverbios 6:23 «Ki Ner Mitzvá veTorá Or», Kidushín 31a y Sanhedrín 56a)`,
      `Autonomía de la razón filosófica en «${cleaned}» frente a la Teonomía relacional del Pacto (Brit) en el pensamiento judío (Rambam en Moreh Nevujim, Yehudá HaLeví en el Kuzari y Rav Kook)`,
      `Primacía de la acción ética concreta («Lo ha-midrash hu ha-ikar elá ha-maasé», Pirké Avot 1:17) frente a la contemplación abstracta en diálogo con «${cleaned}»`,
      `Comparación teológica sobre el destino del alma: el Olam HaBá en el Talmud (Sanhedrín 10:1) y Maimónides frente a la perspectiva de «${cleaned}»`,
    ];
  }

  // 8. Gate 4: Pirké Avot y Máximas Tanaíticas
  if (
    lower.includes('avot') ||
    lower.includes('hilel') ||
    lower.includes('hillel') ||
    lower.includes('shamai') ||
    lower.includes('shammai') ||
    lower.includes('ben zoma') ||
    lower.includes('ben zomá') ||
    lower.includes('akiva') ||
    lower.includes('tarfon') ||
    lower.includes('tarfón')
  ) {
    return [
      `Análisis exegético de «${cleaned}» en Pirké Avot contrastando la lectura filosófica de Rambam (Shemoná Perakim) con la lectura ética de Rabenu Yoná de Gerona y el Maharal de Praga (Dérej Jaim)`,
      `El contexto histórico-espiritual del Tanaíta en «${cleaned}» (Pirké Avot) y cómo su máxima responde a los desafíos éticos y comunitarios de su generación`,
      `Pirkei Avot 1:14 — Hilel dice: «Si yo no soy para mí, ¿quién será para mí? Y cuando soy solo para mí, ¿qué soy? Y si no es ahora, ¿cuándo?»`,
      `La fricción entre comprender intelectualmente la enseñanza de «${cleaned}» y la reacción emocional automática según el Musar Transformativo de Rabí Israel Salanter`,
    ];
  }

  // 9. Gate 5: Mesilat Yesharim y Virtudes del Ramjal
  if (
    lower.includes('mesilat') ||
    lower.includes('mesillat') ||
    lower.includes('ramjal') ||
    lower.includes('luzzatto') ||
    lower.includes('zehirut') ||
    lower.includes('zerizut') ||
    lower.includes('nekiyut') ||
    lower.includes('perishut') ||
    lower.includes('tahara') ||
    lower.includes('tahará') ||
    lower.includes('anava') ||
    lower.includes('anavá') ||
    lower.includes('humildad') ||
    lower.includes('diligencia')
  ) {
    return [
      `Análisis sistemático de la virtud de «${cleaned}» según el Ramjal en Mesilat Yesharim: 1. Definición esencial (Mahut) · 2. Divisiones (Jalakim) · 3. Medios de adquisición (Dérej Kinyanó) · 4. Obstáculos (Mafsidayv)`,
      `El lugar de «${cleaned}» en la escalera espiritual de Rabí Pinjás ben Yaír (Talmud Avodá Zarah 20b) y cómo articula el ascenso ético en Mesilat Yesharim`,
      `Evolución del concepto de «${cleaned}» a través de las 4 visiones: 1. Torá y Jazal · 2. Árbol de la Vida (Cábala) · 3. Musar (Mesilat Yesharim) · 4. Jasidut`,
      `Diagnóstico del Néfesh y Jeshbón HaNéfesh sobre los obstáculos emocionales para vivir «${cleaned}» según Rabí Israel Salanter`,
    ];
  }

  // 10. Gate 6: Musar Transformativo (Ira, Orgullo, Envidia, Pereza, Lashón Hará, Salanter, Jeshbón HaNéfesh)
  if (
    lower.includes('ira') ||
    lower.includes('enojo') ||
    lower.includes('kaas') ||
    lower.includes('orgullo') ||
    lower.includes('soberbia') ||
    lower.includes('gaava') ||
    lower.includes('gaavá') ||
    lower.includes('envidia') ||
    lower.includes('kina') ||
    lower.includes('kiná') ||
    lower.includes('pereza') ||
    lower.includes('atzlut') ||
    lower.includes('lashon') ||
    lower.includes('lashón') ||
    lower.includes('musar') ||
    lower.includes('salanter') ||
    lower.includes('jeshbon') ||
    lower.includes('jeshbón')
  ) {
    return [
      `Diagnóstico del Néfesh y Jeshbón HaNéfesh sobre «${cleaned}» según el Musar Transformativo de Rabí Israel Salanter: la fricción entre lo que el intelecto comprende y la reacción automática`,
      `Las raíces internas de «${cleaned}» en las fuerzas del alma según Orjot Tzadikim, Jovot HaLevavot y el Mijtav MeEliahu de Rav Dessler`,
      `Análisis sistemático de la rectificación de «${cleaned}» según el esquema de 4 partes del Mesilat Yesharim del Ramjal (Mahut, Jalakim, Dérej Kinyanó y Mafsidayv)`,
      `Enseñanza de Pirké Avot (Ben Zomá en Avot 4:1 y Rabí Levitas en Avot 4:4) sobre el dominio de la inclinación y la transformación de «${cleaned}»`,
    ];
  }

  // 11. Gate 2: Conceptos Espirituales (Jésed, Teshuvá, Kedushá, Emuná, Bitajón, Tzedaká, Simjá)
  if (
    lower.includes('jesed') ||
    lower.includes('jésed') ||
    lower.includes('chesed') ||
    lower.includes('teshuva') ||
    lower.includes('teshuvá') ||
    lower.includes('kedusha') ||
    lower.includes('kedushá') ||
    lower.includes('emuna') ||
    lower.includes('emuná') ||
    lower.includes('bitajon') ||
    lower.includes('bitajón') ||
    lower.includes('tzedaka') ||
    lower.includes('tzedaká') ||
    lower.includes('simja') ||
    lower.includes('simjá')
  ) {
    return [
      `Evolución del concepto de «${cleaned}» en las 4 visiones: 1. Raíz en la Torá y Jazal · 2. En el Árbol de la Vida de la Cábala (Sefirot) · 3. Según el Musar · 4. En la Jasidut (Baal Shem Tov, Jabad/Tania, Breslev y Sfat Emet)`,
      `Análisis exegético en los 4 niveles del PARDÉS (Pshat, Rémez, Drash y Sod) de las fuentes bíblicas y talmúdicas fundamentales sobre «${cleaned}»`,
      `Cómo adquirir y cultivar la virtud de «${cleaned}» paso a paso según la arquitectura sistemática del Mesilat Yesharim del Ramjal`,
      `La fricción entre conocer el ideal de «${cleaned}» y la reacción automática cotidiana según el Musar Transformativo y Jeshbón HaNéfesh de Rabí Israel Salanter`,
    ];
  }

  const topicLabel = cleaned.length > 0 && cleaned.length <= 60 ? cleaned : 'este concepto';

  return [
    `Análisis exegético en los 4 niveles del PARDÉS (Pshat, Rémez, Drash y Sod) sobre «${topicLabel}» en el Tanaj, Rashi, el Talmud y el Zóhar`,
    `Evolución del concepto de «${topicLabel}» en las 4 visiones: 1. En la Torá y Jazal · 2. En el Árbol de la Vida de la Cábala · 3. Según el Musar · 4. En la Jasidut (Baal Shem Tov, Tania, Breslev y Sfat Emet)`,
    `Investigación histórico-filológica y crítica textual (Wissenschaft des Judentums) sobre el origen, las fuentes tanaíticas/amoraicas y el desarrollo de «${topicLabel}»`,
    `Análisis sistemático de «${topicLabel}» según la escalera ética del Mesilat Yesharim del Ramjal y las máximas de Pirké Avot`,
  ];
}

export const QueryClarificationNotice: React.FC<QueryClarificationNoticeProps> = ({
  state,
  onSelectRefinement,
  onForceOriginalQuery,
  onDismissAndEdit,
}) => {
  const [customRefinement, setCustomRefinement] = React.useState(state.originalQuery || '');
  const isTimeout = state.mode === 'timeout_unavailable';
  const currentGate = React.useMemo(
    () => evaluateMethodologyLogicGates(state.originalQuery || ''),
    [state.originalQuery]
  );

  React.useEffect(() => {
    setCustomRefinement(state.originalQuery || '');
  }, [state.originalQuery]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRefinement.trim()) return;
    onSelectRefinement(customRefinement.trim());
  };

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 border shadow-xl space-y-4 transition-all ${
        isTimeout
          ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
          : 'bg-sky-950/30 border-sky-500/40 text-slate-100'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
              isTimeout
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-sky-500/20 border-sky-500/40 text-sky-300'
            }`}
          >
            {isTimeout ? <Clock className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isTimeout
                  ? 'No hay respuestas disponibles de momento (Espera muy larga)'
                  : 'Acotar o precisar la consulta para profundizar el estudio'}
              </h3>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isTimeout
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                }`}
              >
                {isTimeout ? 'Tiempo límite alcanzado' : 'Acotaciones y Puertas Lógicas'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300">
                <Cpu className="w-3 h-3 text-sky-400" />
                <span>
                  Puerta #{currentGate.gateNumber}: {currentGate.enforcedMethodology}
                </span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {state.reason}
            </p>
          </div>
        </div>
      </div>

      {/* Direct Inline Input Box to Acotar / Continue right here */}
      <form
        onSubmit={handleCustomSubmit}
        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
      >
        <label className="block text-xs font-bold text-sky-200">
          Escribe o ajusta aquí mismo cómo deseas acotar o continuar tu estudio:
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customRefinement}
            onChange={(e) => setCustomRefinement(e.target.value)}
            placeholder="Escribe aquí tu pregunta acotada o el punto que deseas profundizar..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-400 text-xs sm:text-sm text-white placeholder-slate-500 outline-none"
          />
          <button
            type="submit"
            disabled={!customRefinement.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <span>Continuar Estudio con Esta Pregunta</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Concrete Suggested Clarifications with Logic Gate Indicator */}
      <div className="space-y-2.5 pt-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>
            O selecciona directamente una acotación sugerida (con su Puerta Lógica y metodología):
          </span>
        </span>

        <div className="grid grid-cols-1 gap-2">
          {state.suggestedRefinements.map((refinement, idx) => {
            const optionGate = evaluateMethodologyLogicGates(refinement);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectRefinement(refinement)}
                className="group text-left p-3.5 rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-slate-800 hover:border-sky-400/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1.5 flex-1">
                  <span className="text-xs sm:text-sm text-slate-200 group-hover:text-white leading-relaxed block">
                    {refinement}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300">
                      <Cpu className="w-3 h-3 text-sky-400" />
                      <span>
                        Puerta #{optionGate.gateNumber} · {optionGate.enforcedMethodology}
                      </span>
                    </span>
                    {optionGate.halakhicValidation?.isPurelyHalakhic && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                        Validador Halájico Activo
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Consultar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={onDismissAndEdit}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Ir al cuadro principal superior</span>
        </button>

        <button
          type="button"
          onClick={onForceOriginalQuery}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            isTimeout
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>
            {isTimeout
              ? 'Reintentar consulta original ahora'
              : 'Continuar de todos modos con la consulta general'}
          </span>
        </button>
      </div>
    </div>
  );
};


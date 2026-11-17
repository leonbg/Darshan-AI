import { validatePurelyHalakhicQuery } from '../src/utils/halakhicPipelineValidator.ts';
import { detectExternalThinkerAndForceExegeticalSearch } from '../src/utils/externalThinkerDetector.ts';
import { getToneRhetoricalDirectives } from '../src/utils/toneAdvisor.ts';
import { normalizeUserStudyQuery } from './queryNormalization.ts';
import { decideMethodologyCache } from './aiClient.ts';

// Helper: Logic-Gate Router in the analysis pipeline that detects query keywords to internally configure the methodology
export function resolveEffectiveMethodology(requestedMetodologia: string, query: string): string {
  const m = (requestedMetodologia || 'AUTO').toUpperCase().trim();
  if (m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT') {
    return 'WISSENSCHAFT_DES_JUDENTUMS';
  }

  const q = (query || '').trim();
  if (!q) return m && m !== 'AUTO' ? m : 'PARDES';

  const halakhicCheck = validatePurelyHalakhicQuery(q);

  // Dedicated External Thinker Detector Module: automatically forces FILOSOFIA_CONTRASTIVA whenever an external philosopher/thinker is mentioned (disabled for purely Halakhic topics)
  const externalThinkerDetection = halakhicCheck.externalPhilosophyInjectionDisabled
    ? detectExternalThinkerAndForceExegeticalSearch('')
    : detectExternalThinkerAndForceExegeticalSearch(q);
  if (externalThinkerDetection.detected && !halakhicCheck.externalPhilosophyInjectionDisabled) {
    return 'FILOSOFIA_CONTRASTIVA';
  }

  // Gate 1: Historical Concepts, Liturgical Philology & Textual Criticism -> WISSENSCHAFT_DES_JUDENTUMS
  const isHistoricalOrWissenschaft =
    /(?<![a-záéíóúñ])(hist[oó]ric[oa]s?|historia\s+(?:de|redaccional|textual|lit[uú]rgica)|redaccional(?:es)?|origen\s+hist[oó]rico|contexto\s+hist[oó]rico|desarrollo\s+hist[oó]rico|evoluci[oó]n\s+hist[oó]rica|[eé]poca\s+(?:del\s+segundo\s+templo|tana[ií]tica|amoraica|ge[oó]nica|medieval)|per[ií]odo\s+hist[oó]rico|siglo\s+[ivx\d]+|antig[üu]edad|modim(?:\s+de[- ]?raban[aá]n)?|yotzer\s+bereshit|amid[aá]h?|shemon[eé]\s+esr[eé]|dieciocho\s+bendiciones|jatimat\s+beraj[aá]|gueniz[aá]|geniz[aá]|manuscritos?|c[oó]dices?|rito\s+palestinense|rito\s+babil[oó]nico|tradici[oó]n\s+babil[oó]nica|ecd[oó]tica|cr[ií]tica\s+textual|variantes?\s+textuales|filolog[ií]a|filol[oó]gic[oa]s?|amram\s+ga[oó]n|saadia\s+ga[oó]n|majzor\s+vitry|sidur|siddur|n[uú]saj|sot[aá]h?\s+40a|yerushalmi|talmud\s+de\s+jerusal[eé]n|wissenschaft|heinemann|elbogen|stefan\s+reif|uri\s+ehrlich|fleischer|liturgia|lit[uú]rgic[oa]s?)(?![a-záéíóúñ])/i.test(
      q
    );

  // Gate 2: Multi-Strata Evolution (Torá + Cábala/Árbol de la Vida + Musar + Jasidut)
  const gate2Matches = [
    /(?<![a-záéíóúñ])evoluci[oó]n(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])[aá]rbol de la vida(?![a-záéíóúñ])/i,
    /\betz\s+jaim\b/i,
    /(?<![a-záéíóúñ])sefir(?:ot|[aá])(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:c[aá]bala|kabal[aá]|z[oó]har|arizal)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:jasidut|jas[ií]dic[oa]s?|baal shem tov|besht|tania|jabad|breslev|sfat emet|kotzk)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])c[oó]mo se (?:escribe|concibe)(?![a-záéíóúñ])/i,
    /\bdiferencias\b.*\b(?:visiones|corrientes|escuelas|tradiciones)\b/i,
  ].filter((rx) => rx.test(q)).length;

  const isMultiStrataEvolution =
    gate2Matches >= 2 ||
    (gate2Matches >= 1 &&
      /(?<![a-záéíóúñ])([aá]rbol de la vida|etz jaim|sefirot|jasidut)(?![a-záéíóúñ])/i.test(q));

  // Gate 5 & Gate 6: Virtues, Character Traits & Personal Growth -> MESILAT_YESHARIM_SISTEMATICO or MUSAR_TRANSFORMATIVO
  const gateVirtueScore = [
    /\b(?:mesilat|mesillat|ramjal|luzzatto)\b/i,
    /(?<![a-záéíóúñ])(?:virtud|virtudes|midd[aá]|midot|rasgo|rasgos de car[aá]cter|car[aá]cter(?:\s+moral)?|conducta|adquirir|cultivar)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:crecimiento\s+personal|desarrollo\s+personal|superaci[oó]n(?:\s+personal)?|automejora|mejorar\s+como\s+persona|transformaci[oó]n\s+personal|trabajo\s+interior|rectificaci[oó]n\s+del\s+car[aá]cter|tik[uú]n\s+hamidot)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:zehirut|vigilancia|zerizut|diligencia|nekiyut|limpieza|perishut|abstenci[oó]n|tahar[aá]|pureza|jasidut|piedad|anav[aá]|humildad|yirat jet|kedush[aá]|santidad)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:j[eé]sed|chesed|bondad|generosidad|compasi[oó]n|empat[ií]a|dar|netin[aá])(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:paciencia|savlanut|gratitud|hakarat hatov|agradecimiento|bitaj[oó]n|confianza|integridad|emet|verdad|modestia|tzniut|templanza|autodominio|autocontrol)(?![a-záéíóúñ])/i,
  ].filter((rx) => rx.test(q)).length;

  const gateMusarFrictionScore = [
    /(?<![a-záéíóúñ])(?:jeshb[oó]n\s*han[eé]fesh|contabilidad del alma|salanter|kelm|novardok|dessler|musar)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:ira|enojo|enojarse|c[oó]lera|rabia|kaas|impaciencia|reactividad)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:orgullo|soberbia|ego|vanidad|arrogancia|gaav[aá]|kavod|honor)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:envidia|celos|kin[aá]|comparaci[oó]n|resentimiento|rencor)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:pereza|apat[ií]a|inercia|postergaci[oó]n|procrastinaci[oó]n|atzlut|desgano)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:cr[ií]tica|criticar|juzgar|prejuicio|chisme|lash[oó]n har[aá]|maledicencia)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:fricci[oó]n|reacci[oó]n autom[aá]tica|impulso|h[aá]bito|mal\s+h[aá]bito|yetzer har[aá]|autoenga[ñn]o|negi[aá]|sesgo|defecto de car[aá]cter)(?![a-záéíóúñ])/i,
    /(?<![a-záéíóúñ])(?:ansiedad|angustia|miedo|temor|preocupaci[oó]n|control)(?![a-záéíóúñ])/i,
  ].filter((rx) => rx.test(q)).length;

  const hasExplicitInternalHalakhaOrLiturgy =
    halakhicCheck.externalPhilosophyInjectionDisabled ||
    /(?<![a-záéíóúñ])(halel|hallel|jats[ií]\s+halel|halel\s+shalem|halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|shulj[aá]n\s+aruj|mishn[eé]\s+tor[aá]|pesajim|taanit|arj[ií]n|arakhin|berajot|rosh\s+j[oó]desh|modim|yotzer\s+bereshit|amid[aá]h?|shemon[eé]\s+esr[eé]|dieciocho\s+bendiciones|gueniz[aá]|geniz[aá]|sot[aá]h?\s+40a|wissenschaft|amram\s+ga[oó]n|saadia\s+ga[oó]n|majzor\s+vitry)(?![a-záéíóúñ])/i.test(
      q
    );

  const isPhilosophicalContrast =
    !hasExplicitInternalHalakhaOrLiturgy &&
    (/(?<![a-záéíóúñ])(estoic(?:ismo|o|os|a)|ataraxia|amor fati|apatheia|dicotom[ií]a del control|epicteto|marco aurelio|s[eé]neca|arist[oó]teles|plat[oó]n|plat[oó]nic[oa]s?|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|recta\s+ratio|lex\s+naturae|budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|destino\s+de\s+las\s+almas|nirvana|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno|s[oó]crates|kant|kantian[oa]s?|imperativo\s+categ[oó]rico|fuentes?\s+internas?\s+(?:y|o|vs\.?|frente\s+a)\s+fuentes?\s+externas?|universalidad\s+(?:o|y|frente\s+a(?:\s+la)?|vs\.?)\s+especificidad|especificidad\s+del\s+mandamiento|spinoza|descartes|nietzsche|existencialismo|epicure[ií]smo|utilitarismo|humanismo secular|filosof[ií]a\s+comparada|religiones\s+comparadas|kuzari|moreh nevujim|disputa\s+de\s+barcelona|vikuaj)(?![a-záéíóúñ])/i.test(
      q
    ) ||
      (/(?<![a-záéíóúñ])(mash[ií]aj|mashiach|mes[ií]as)(?![a-záéíóúñ])/i.test(q) &&
        /(?<![a-záéíóúñ])(cristian(?:ismo|o|a|os|as)?|jes[uú]s|cristo|nicea|calcedonia|encarnaci[oó]n|trinidad|segunda\s+venida|parus[ií]a|pecado\s+original|diferencias?|caracterizar|desglosar|comparar|contraste)(?![a-záéíóúñ])/i.test(
          q
        )));

  const cachedCalibrated = decideMethodologyCache.get(q.toLowerCase());
  const calibratedRequiresContrast = Boolean(
    cachedCalibrated?.decisionCalibration?.requiresExternalContrast
  );
  const calibratedIsPureHalakha = Boolean(
    cachedCalibrated?.decisionCalibration?.isPurelyHalakhic
  );

  // If user explicitly picked a non-AUTO methodology, honor it unless:
  // 1) The UI was on default PARDES and the query explicitly asks for a philosophical contrast, OR
  // 2) The UI had a sticky FILOSOFIA_CONTRASTIVA from a previous comparative study, while the current query is an internal Jewish/Halakhic topic with no external thinker
  if (m && m !== 'AUTO') {
    if (m === 'PARDES' && (isPhilosophicalContrast || calibratedRequiresContrast) && !calibratedIsPureHalakha) {
      return 'FILOSOFIA_CONTRASTIVA';
    }
    if (
      m === 'FILOSOFIA_CONTRASTIVA' &&
      (calibratedIsPureHalakha || (!isPhilosophicalContrast && !calibratedRequiresContrast))
    ) {
      // Fall through to automatic internal Jewish methodology selection below
    } else {
      return m;
    }
  }

  if (cachedCalibrated?.recommendedPrimary) {
    return cachedCalibrated.recommendedPrimary;
  }

  if (isMultiStrataEvolution) {
    return 'EVOLUCION_CONCEPTUAL';
  }

  // Gate 3: Philosophical Contrast (Kant, Plato's Cave, Cicero, Stoicism, Aristotle, etc.)
  if (isPhilosophicalContrast) {
    return 'FILOSOFIA_CONTRASTIVA';
  }

  const isPureHalelOrHalakhaWithoutHistoricalRequest =
    /(?<![a-záéíóúñ])(halel|hallel|halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|shulj[aá]n\s+aruj)(?![a-záéíóúñ])/i.test(
      q
    ) &&
    !/(?<![a-záéíóúñ])(hist[oó]ric[oa]s?|historia|redaccional|manuscritos?|gueniz[aá]|geniz[aá]|wissenschaft|filolog[ií]a|ecd[oó]tica|amram\s+ga[oó]n|saadia\s+ga[oó]n)(?![a-záéíóúñ])/i.test(
      q
    );

  if (isHistoricalOrWissenschaft && !isPureHalelOrHalakhaWithoutHistoricalRequest) {
    return 'WISSENSCHAFT_DES_JUDENTUMS';
  }

  // Gate 4: Tannaitic Maxims / Pirkei Avot
  const isPirkeiAvot =
    /(?<![a-záéíóúñ])(pirk[eé]i?\s+avot|(?:mishn[aá]\s+)?avot\s+\d+[:.]\d+|hilel|hillel|shamai|shammai|ben zom[aá]|ben azai|ant[ií]gonos|rab[ií] tarf[oó]n|rab[aá]n gamliel|rab[ií] akiva|tana[ií]ta)(?![a-záéíóúñ])/i.test(
      q
    );

  if (isPirkeiAvot && gateMusarFrictionScore === 0 && gateVirtueScore === 0) {
    return 'PIRKE_AVOT_EXEGETICO';
  }

  if (gateVirtueScore > 0 || gateMusarFrictionScore > 0) {
    const preferMesilat =
      /(?<![a-záéíóúñ])(mesilat|mesillat|ramjal|luzzatto|mahut|derej kinyan[oó]|virtud|virtudes)(?![a-záéíóúñ])/i.test(
        q
      ) ||
      (gateVirtueScore > gateMusarFrictionScore &&
        !/(?<![a-záéíóúñ])(fricci[oó]n|salanter|jeshb[oó]n|reacci[oó]n autom[aá]tica|impulso|crecimiento personal)(?![a-záéíóúñ])/i.test(
          q
        ));
    return preferMesilat ? 'MESILAT_YESHARIM_SISTEMATICO' : 'MUSAR_TRANSFORMATIVO';
  }

  // Gate 7: Default Biblical / Halakhic / Liturgical / Exegetical PARDES
  return 'PARDES';
}

// Helper: Resolve complementary methodologies according to lesson duration ('5_MIN' -> 0, '10_MIN' -> 1, '30_MIN' -> 2)
export function resolveComplementaryMethodologies(
  primaryMetodologia: string,
  query: string,
  duracion: string,
  rawComplementary?: string[]
): string[] {
  const d = (duracion || '10_MIN').toUpperCase().trim();
  const maxComp = d === '5_MIN' ? 0 : d === '30_MIN' ? 2 : 1;
  if (maxComp === 0) return [];

  const primary =
    primaryMetodologia === 'FILOLOGIA_LITURGICA_WISSENSCHAFT'
      ? 'WISSENSCHAFT_DES_JUDENTUMS'
      : (primaryMetodologia || 'PARDES').toUpperCase().trim();

  const q = (query || '').trim();
  const { isComparativeTopic } = normalizeUserStudyQuery(q);
  const halakhicCheck = validatePurelyHalakhicQuery(q);
  const thinkerDet = halakhicCheck.externalPhilosophyInjectionDisabled
    ? detectExternalThinkerAndForceExegeticalSearch('')
    : detectExternalThinkerAndForceExegeticalSearch(q);
  const allowFilosofiaContrastiva =
    !halakhicCheck.externalPhilosophyInjectionDisabled &&
    (primary === 'FILOSOFIA_CONTRASTIVA' || isComparativeTopic || thinkerDet.detected);

  const userProvided = Array.isArray(rawComplementary)
    ? rawComplementary
        .map((m) =>
          m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT'
            ? 'WISSENSCHAFT_DES_JUDENTUMS'
            : String(m || '').toUpperCase().trim()
        )
        .filter(
          (m) =>
            m &&
            m !== 'AUTO' &&
            m !== primary &&
            (allowFilosofiaContrastiva || m !== 'FILOSOFIA_CONTRASTIVA')
        )
    : [];

  const candidates: string[] = [...userProvided];

  if (
    /(?<![a-záéíóúñ])([aá]rbol de la vida|etz jaim|sefirot|c[aá]bala|jasidut|evoluci[oó]n)(?![a-záéíóúñ])/i.test(
      q
    )
  ) {
    candidates.push('EVOLUCION_CONCEPTUAL');
  }
  if (
    /(?<![a-záéíóúñ])(virtud|virtudes|midd[aá]|midot|zehirut|zerizut|anav[aá]|humildad|mesilat|ramjal)(?![a-záéíóúñ])/i.test(
      q
    )
  ) {
    candidates.push('MESILAT_YESHARIM_SISTEMATICO');
  }
  if (
    /(?<![a-záéíóúñ])(crecimiento personal|car[aá]cter|conducta|ira|enojo|orgullo|ego|fricci[oó]n|jeshb[oó]n|musar)(?![a-záéíóúñ])/i.test(
      q
    )
  ) {
    candidates.push('MUSAR_TRANSFORMATIVO');
  }
  if (
    /(?<![a-záéíóúñ])(hist[oó]ric[oa]s?|historia|redaccional|manuscritos|gueniz[aá]|modim|amid[aá]h?|dieciocho\s+bendiciones|cr[ií]tica textual|wissenschaft|sot[aá]h?\s+40a)(?![a-záéíóúñ])/i.test(
      q
    )
  ) {
    candidates.push('WISSENSCHAFT_DES_JUDENTUMS');
  }
  if (/(?<![a-záéíóúñ])(pirk[eé]i?\s+avot|hilel|shamai|ben zom[aá]|tana[ií]ta)(?![a-záéíóúñ])/i.test(q)) {
    candidates.push('PIRKE_AVOT_EXEGETICO');
  }
  if (
    allowFilosofiaContrastiva &&
    /(?<![a-záéíóúñ])(estoicismo|filosof[ií]a|ataraxia|kuzari|moreh nevujim|kant|plat[oó]n|cicer[oó]n|buda|budismo)(?![a-záéíóúñ])/i.test(
      q
    )
  ) {
    candidates.push('FILOSOFIA_CONTRASTIVA');
  }

  // Default complementary pairings by primary methodology
  const defaultMap: Record<string, string[]> = {
    WISSENSCHAFT_DES_JUDENTUMS: ['PARDES', 'EVOLUCION_CONCEPTUAL', 'MUSAR_TRANSFORMATIVO'],
    EVOLUCION_CONCEPTUAL: ['MESILAT_YESHARIM_SISTEMATICO', 'MUSAR_TRANSFORMATIVO', 'PARDES'],
    MESILAT_YESHARIM_SISTEMATICO: ['MUSAR_TRANSFORMATIVO', 'EVOLUCION_CONCEPTUAL', 'PARDES'],
    MUSAR_TRANSFORMATIVO: ['MESILAT_YESHARIM_SISTEMATICO', 'PIRKE_AVOT_EXEGETICO', 'PARDES'],
    PIRKE_AVOT_EXEGETICO: ['MUSAR_TRANSFORMATIVO', 'MESILAT_YESHARIM_SISTEMATICO', 'PARDES'],
    FILOSOFIA_CONTRASTIVA: ['PIRKE_AVOT_EXEGETICO', 'MUSAR_TRANSFORMATIVO', 'PARDES'],
    PARDES: ['MESILAT_YESHARIM_SISTEMATICO', 'MUSAR_TRANSFORMATIVO', 'EVOLUCION_CONCEPTUAL'],
  };

  candidates.push(...(defaultMap[primary] || ['PARDES', 'MUSAR_TRANSFORMATIVO']));

  const unique = Array.from(new Set(candidates)).filter(
    (m) =>
      m !== primary &&
      (!halakhicCheck.externalPhilosophyInjectionDisabled ||
        m !== 'FILOSOFIA_CONTRASTIVA')
  );
  return unique.slice(0, maxComp);
}

// Helper: Brief summary of what a complementary methodology contributes when woven into a 10-min or 30-min lesson
export function getComplementaryContributionBrief(compMethod: string): string {
  switch (compMethod) {
    case 'WISSENSCHAFT_DES_JUDENTUMS':
    case 'FILOLOGIA_LITURGICA_WISSENSCHAFT':
      return 'WISSENSCHAFT_DES_JUDENTUMS (Aporte Histórico-Filológico y Crítica Textual aplicada estrictamente al concepto consultado: desarrollo en el Tanaj, Talmud Bavli/Yerushalmi, códigos geónicos y erudición histórica)';
    case 'EVOLUCION_CONCEPTUAL':
      return 'EVOLUCION_CONCEPTUAL (Aporte de Genealogía en 4 Visiones: contraste de cómo evoluciona el concepto entre la Torá/Jazal, el Árbol de la Vida de la Cábala, el Musar y las escuelas de la Jasidut como Besht, Jabad/Tania y Breslev)';
    case 'MESILAT_YESHARIM_SISTEMATICO':
      return 'MESILAT_YESHARIM_SISTEMATICO (Aporte Sistemático del Ramjal: definición analítica Mahut, estrategia práctica de adquisición Dérej Kinyanó y obstáculos sutiles Mafsidayv)';
    case 'MUSAR_TRANSFORMATIVO':
      return 'MUSAR_TRANSFORMATIVO (Aporte de Psicología del Néfesh y Jeshbón HaNéfesh según Rabí Israel Salanter y Rav Dessler: diagnóstico del sesgo interior/negiá y ejercicio introspectivo concreto para la semana)';
    case 'PIRKE_AVOT_EXEGETICO':
      return 'PIRKE_AVOT_EXEGETICO (Aporte Contrastivo Clásico: contraposición entre el justo medio racionalista del Rambam y la devoción interior de Rabenu Yoná o la metafísica del Maharal de Praga)';
    case 'FILOSOFIA_CONTRASTIVA':
      return 'FILOSOFIA_CONTRASTIVA (Aporte de Diálogo Filosófico: contraste exegético formal sobre Universalidad vs. Especificidad del Mandamiento y Fuentes Internas de la Torá vs. Fuentes Externas)';
    default:
      return 'PARDES (Aporte Hermenéutico Multinivel: articulación entre el sentido literal Pshat, la alusión Rémez, la homilética Drash y el secreto místico Sod)';
  }
}

// Helper: Duration and multi-methodology expansion instructions
export function getDurationAndComplementaryInstructions(
  primaryMetodologia: string,
  duracion: string,
  complementaryMethodologies: string[]
): string {
  const d = (duracion || '10_MIN').toUpperCase().trim();

  if (d === '5_MIN') {
    return `PARÁMETRO DE DURACIÓN Y EXTENSIÓN: "5_MIN" (Lección de 5 minutos · Concisa y Directa).
- Extensión objetivo de 'fullStructuredDerashaMarkdown': 500 a 700 palabras (~5 minutos de exposición hablada).
- Enfoque: Desarrolla de forma directa, nítida y concentrada ÚNICAMENTE las secciones de la metodología principal ("${primaryMetodologia}"), sin desvíos secundarios, ideal para una intervención breve de púlpito o estudio rápido.`;
  }

  if (d === '30_MIN') {
    const compList = complementaryMethodologies.map(getComplementaryContributionBrief).join('\n   • ');
    return `PARÁMETRO DE DURACIÓN Y EXTENSIÓN: "30_MIN" (Shiur Magistral de 30 minutos · Estudio Profundo Multi-Metodológico).
- Extensión objetivo de 'fullStructuredDerashaMarkdown': 1.900 a 2.600 palabras (~30 minutos de clase o Shiur completo).
- ARQUITECTURA MULTI-METODOLÓGICA OBLIGATORIA:
  1. Desarrolla con máxima amplitud y citas textuales todas las fases de la metodología principal ("${primaryMetodologia}").
  2. AMPLÍA EL CONTENIDO integrando formalmente los aportes de estas ${complementaryMethodologies.length} metodologías complementarias para enriquecer la complejidad de la consulta:
   • ${compList}
  3. En el arreglo 'methodologySections', incluye primero todas las secciones de la metodología principal ("${primaryMetodologia}") y AGREGA ${complementaryMethodologies.length} secciones adicionales (con su campo 'sourceMethodology' correspondiente) tituladas explícitamente con el aporte de cada metodología complementaria.
  4. En 'fullStructuredDerashaMarkdown', dedica subsecciones amplias (##) a estos aportes cruzados e incluye preguntas de Javruta / debate de Bet Midrash para sostener una clase de media hora.`;
  }

  // Default: 10_MIN
  const compList = complementaryMethodologies.map(getComplementaryContributionBrief).join('\n   • ');
  return `PARÁMETRO DE DURACIÓN Y EXTENSIÓN: "10_MIN" (Drashá de 10 minutos · Desarrollo Completo + Aporte Complementario).
- Extensión objetivo de 'fullStructuredDerashaMarkdown': 1.000 a 1.400 palabras (~10 minutos de exposición hablada).
- ENRIQUECIMIENTO CON METODOLOGÍA COMPLEMENTARIA:
  1. Desarrolla de forma rigurosa todas las secciones de la metodología principal ("${primaryMetodologia}").
  2. Además, amplía y enriquece la lección incorporando un aporte específico desde la metodología complementaria:
   • ${compList}
  3. En el arreglo 'methodologySections', incluye las secciones de "${primaryMetodologia}" y AGREGA 1 sección complementaria final (indicando su 'sourceMethodology') que ilumine el tema desde esta segunda perspectiva metodológica.`;
}

// Helper: Methodology-specific instructions for the Rabbinic & Pedagogical Assistant
export function getMethodologyInstructions(
  metodologia: string,
  audienciaOTono: string,
  resolvedTone: 'MOTIVACION' | 'ADVERTENCIA_CAUTELA' | 'LLAMADO_ACCION' | 'ASPIRACIONAL' | 'ANALITICO_SOBRIO' = 'ASPIRACIONAL',
  isSensitivePastoralContext = false
): string {
  const m = (metodologia || 'PARDES').toUpperCase();
  const toneDirectives = getToneRhetoricalDirectives(resolvedTone, isSensitivePastoralContext);
  const antiMetaRule = `REGLA CRÍTICA DE EJECUCIÓN EXEGÉTICA REAL (PROHIBICIÓN DE METADEFINICIONES):
- JAMÁS dediques el cuerpo de una sección a definir qué significa teóricamente esa etapa o método (por ejemplo, NO escribas «El Pshat es el nivel literal...», «El Rémez es la alusión...», «Mahut significa la definición esencial según el Ramjal...», «El Punto Focal consiste en aislar...»). El lector ya conoce el método: quiere el ESTUDIO REAL de su tema.
- En cada sección, entra DIRECTAMENTE a analizar la consulta concreta del usuario aplicando las herramientas de esa etapa y citando los términos hebreos (shorashim) y fuentes verificadas de Sefaria que te fueron entregadas.`;
  const toneNote = `PARÁMETRO "audiencia_o_tono": "${audienciaOTono || 'Comunidad general · Inspirador y práctico'}". Adapta rigurosamente el registro lingüístico, la densidad conceptual, las metáforas pedagógicas y el enfoque práctico a esta audiencia.\n\n${antiMetaRule}\n\n${toneDirectives}`;

  if (m === 'WISSENSCHAFT_DES_JUDENTUMS' || m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT') {
    return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "WISSENSCHAFT_DES_JUDENTUMS" (Investigación Histórico-Filológica y Crítica Textual · Método de la Wissenschaft des Judentums):
Actúa como un investigador experto en historia judía, filología hebrea, crítica textual y el método histórico-filológico de la Wissenschaft des Judentums aplicado EXCLUSIVAMENTE al tema específico preguntado por el usuario (PROHIBIDO mencionar "Modim", "Modim anajnu" o "Yotzer Bereshit" a menos que la consulta del usuario pregunte explícitamente por Modim).
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 4 secciones base de 'methodologySections' estrictamente en estas 4 fases metodológicas aplicadas al tema consultado:
1. Crítica Textual y Evidencia de Manuscritos (בִּקֹּרֶת הַנֻּסָּח וְכִתְבֵי הַיָּד):
   - Analiza las fuentes primarias, variantes textuales e historia documental del texto o concepto consultado por el usuario en el Tanaj, la literatura del Segundo Templo, los manuscritos medievales y los códigos clásicos.
2. Historia de la Redacción Tanaítica y Amoraica (תּוֹלְדוֹת הָעֲרִיכָה בַּתַּלְמוּדִים):
   - Disecciona los pasajes del Talmud Babilónico, el Talmud de Jerusalén y los Midrashim que debaten el tema consultado por el usuario, desglosando las posturas de los sabios Tanaítas y Amoraítas.
3. Análisis Funcional, Histórico y Normativo (פְּרַגְמָטִיקָה וְהֶקְשֵׁר הִיסְטוֹרִי):
   - Examina cómo funcionaba este concepto, institución o práctica en la vida comunitaria, ética o espiritual judía y su codificación en los Rishonim (Rashi, Rambam, Ramban, Tosafot).
4. Exégesis Teológica Comparada y Erudición Académica (תֵּאוֹלוֹגְיָה הַשְׁוָאָתִית וּמֶחְקָר):
   - Sintetiza las conclusiones de la investigación filológica e histórica contemporánea y responde con claridad todas las preguntas planteadas por el usuario.`;
  }

  if (m === 'EVOLUCION_CONCEPTUAL') {
    return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "EVOLUCION_CONCEPTUAL" (Genealogía y Evolución del Concepto a través de 4 Estratos: 1. Torá y Jazal · 2. Árbol de la Vida / Cábala · 3. Musar · 4. Jasidut y sus Escuelas):
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 4 secciones base de 'methodologySections' estrictamente en estas 4 etapas comparativas:
1. En la Torá Escrita y Jazal (שֹׁרֶשׁ בַּתּוֹרָה וּבְחֲזַ״ל — Ortografía, Raíz y Pacto): Explica cómo se escribe el término en hebreo (letras, raíz trilítera/shóresh y matices semánticos), cómo aparece en la Torá y el Tanaj (ej. para Jésed: חֶסֶד, pacto leal, Jésed shel Emet, Abraham Avinu) y cómo lo codifican los Sabios del Talmud y el Midrash (ej. Guemilut Jasadim).
2. En el Árbol de la Vida de la Cábala (עֵץ חַיִּים וְהַקַּבָּלָה — Ontología Sefirótica): Analiza cómo se concibe este concepto en el Zóhar, el Pardés Rimonim (Ramak) y el Etz Jaim (Arizal): su posición exacta en el Árbol de la Vida (las 10 Sefirot), su columna (derecha, izquierda o central), su flujo divino y cómo interactúa con su opuesto complementario (ej. Jésed como primera Sefirá de construcción/Zéir Anpín frente a Guevurá y armonizada en Tiféret).
3. Según el Movimiento del Musar (תִּקּוּן הַמִּדּוֹת בַּמּוּסָר — Psicología Ética y Carácter): Explica cómo el Musar (Ramjal en Mesilat Yesharim, Tómer Devorá, Rabí Israel Salanter, Alter de Kelm y Rav Eliahu Dessler en Mijtav MeEliahu con el Koaj HaNetiná) baja este concepto de los mundos superiores a la conducta humana: qué exige en la práctica interpersonal, cómo se educa y qué distorsiones del ego o intereses ocultos (negiá) lo falsifican.
4. En la Jasidut y Síntesis de Diferencias (פְּנִימִיּוּת הַחֲסִידוּת וְהִתְפַּתְּחוּת הַמּוּשָׂג — Escuelas Jasídicas y Evolución): Expón cómo la Jasidut interioriza el concepto y contrasta los matices entre sus propias corrientes: el Baal Shem Tov (vitalidad y cercanía divina), Jabad / Tania del Alter Rebe (emoción nacida de la contemplación intelectual de Jojmá-Biná-Daat frente a emoción natural), Breslev (plegaria y anhelo), Sfat Emet / Gur o Pshisja-Kotzk (verdad radical). Cierra esta sección sintetizando con total claridad la evolución histórica y las diferencias de enfoque entre Torá, Cábala, Musar y Jasidut.`;
  }

  if (m === 'MESILAT_YESHARIM_SISTEMATICO') {
    return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "MESILAT_YESHARIM_SISTEMATICO" (Esquema sistemático del Ramjal - Rabí Moshé Jaim Luzzatto):
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 4 secciones base de 'methodologySections' estrictamente en estas 4 partes del Ramjal:
1. Mahut (מַהוּת — Definición esencial y frontera conceptual): Define con precisión analítica la esencia del rasgo moral (middá) o mitzvá, distinguiéndolo de imitaciones superficiales.
2. Jalakim / Bikurim (חֲלָקִים — Ramificaciones prácticas): Desglosa sus partes y manifestaciones concretas en el pensamiento (Majshavá), la palabra (Dibur) y la acción (Maasé).
3. Dérej Kinyanó (דֶּרֶךְ קִנְיָנוֹ — Estrategia de adquisición): Expón la estrategia psicológica, el estudio reflexivo y los pasos graduales para adquirir e interiorizar esta virtud.
4. Mafsidayv (מַפְסִידָיו — Obstáculos y detractores): Analiza los factores que destruyen o sabotean este rasgo (trampas del ego, pereza, entorno social y autojustificaciones habituales).`;
  }

  if (m === 'PIRKE_AVOT_EXEGETICO') {
    return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "PIRKE_AVOT_EXEGETICO" (Análisis ético y contrastivo clásico de Pirké Avot):
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 3 secciones base de 'methodologySections' estrictamente en estas 3 partes:
1. Contexto del Tanaíta (קוֹל הַתַּנָּא — La voz del Sabio): Presenta al Tanaíta o sabio autor de la máxima, su linaje en la cadena de la Masorah y el dilema histórico, ético y espiritual de su generación.
2. Análisis Contrastivo (מַחְלוֹקֶת לְשֵׁם שָׁמַיִם — Rambam vs. Rabenu Yoná / Maharal): Contrapón con rigor la visión racionalista y aristotélica del Rambam (Maimónides, doctrina del justo medio / Shmoná Perakim) frente a la devoción interior y penitencial de Rabenu Yoná de Gerona o la arquitectura metafísica del Maharal de Praga (Dérej Jaim).
3. Principio Vivo (הֲלָכָה לְמַעֲשֶׂה — Ética contemporánea): Síntesis transformadora de la máxima aplicada a los dilemas éticos, interpersonales y espirituales de la vida contemporánea.`;
  }

  if (m === 'MUSAR_TRANSFORMATIVO') {
    return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "MUSAR_TRANSFORMATIVO" (Movimiento de Musar — Rabí Israel Salanter, Alter de Kelm, Alter de Novardok, Rav Dessler):
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 3 secciones base de 'methodologySections' estrictamente en estas 3 partes:
1. Punto Focal (נְקֻדַּת הַהִתְבּוֹנְנוּת — Fricción conductual concreta): Aísla una sola frase canónica o una fricción conductual y ética sumamente concreta donde suele haber brecha entre lo que la mente sabe y lo que el corazón hace.
2. Diagnóstico del Néfesh (אִבְחוּן הַנֶּפֶשׁ — Psicología de las fuerzas inconscientes): Diagnostica con bisturí ético qué emoción automática, orgullo (kavod), sesgo de interés propio (negiá) o apatía nubla la acción recta.
3. Contabilidad del Alma (חֶשְׁבּוֹן הַנֶּפֶשׁ — Jeshbón HaNéfesh): Formula una pregunta reflexiva frontal e ineludible y diseña un ejercicio introspectivo y conductual tangible (Kabalah le-maasé) para practicar durante la semana.`;
  }

  if (m === 'FILOSOFIA_CONTRASTIVA') {
    return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "FILOSOFIA_CONTRASTIVA" (Contraste Exegético Formal: Fuentes Internas de la Torá frente a la Fuente Externa Específicamente Consultada por el Usuario):
PROHIBICIÓN ESTRICTA: Cita ÚNICAMENTE al pensador o tradición externa que el usuario haya mencionado explícitamente en su consulta (jamás introduzcas a Kant, Platón ni Cicerón si la consulta no pregunta por ellos).
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 4 secciones base de 'methodologySections' estrictamente en estas 4 partes analíticas y exegéticas:
1. Eje I — La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (הַבְחָנָה בֵּין מְקוֹרוֹת פְּנִימִיִּים לְחִיצוֹנִיִּים):
   - Aplica la regla epistemológica de *Eijá Rabá 2:13*: «Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín» (sabiduría filosófica en las naciones vs. Torá del Pacto). Cita las **Fuentes Externas consultadas** para el autor preguntado y contrástalas con las **Fuentes Internas de la Torá**.
   - Analiza además el origen del deber: **Fuente Interna autónoma** frente a **Fuente Externa Trascendente y Relacional-Teonómica** (*Kidushín 31a*: «Gadol ha-metzuvé ve-osé») interiorizada en el corazón (*Deuteronomio 30:14*; *Pirké Avot 2:4*).
2. Eje II — La Universalidad frente a la Especificidad del Mandamiento (אוּנִיבֶרְסָלִיּוּת מוּל פְּרָטָנוּת הַמִּצְוָה):
   - Analiza cómo la fuente externa consultada concibe la universalidad abstracta frente a cómo la Torá conjuga **Universalidad ética** (7 Leyes de Noé en *Sanhedrín 56a* y *Tzelem Elohim* en *Génesis 1:27*) con la **Especificidad concreta del Mandamiento (Mitzvá)**:
   - En *Proverbios 6:23* («Ner Mitzvá ve-Torá Or»), la *Mitzvá* específica es una vela concreta que ilumina el paso particular aquí abajo (*Éxodo 24:7*: «Naasé ve-nishmá»; *Pirké Avot 3:17*).
   - En la Halajá, la especificidad del mandamiento prioriza la vida concreta (**Pikuaj Néfesh**, *Yoma 85b*), la equidad contextual (**Lifnim Mishurat HaDin**, *Deuteronomio 6:18*) y la justicia graduada (*Deuteronomio 15:7-8*; *Miqueas 6:8*).
3. Respuesta desde las Fuentes Canónicas de la Torá (מַעֲנֵה מְקוֹרוֹת הַתּוֹרָה — Tanaj, Talmud, Rambam, Kuzari y Maharal):
   - Desarrolla el diálogo directo entre los textos primarios de la fuente externa consultada y los textos hebreos de Sefaria (*Shemoná Perakim* del Rambam, *Kuzari* de Rabí Yehudá Haleví, *Tiféret Yisrael* del Maharal).
4. Síntesis Exegética y Elevación Práctica (בֵּרוּר וְהַעֲלָאָה — Dirá BeTajtonim y Acción Moral):
   - Sintetiza el contraste formal en una llamada a la acción ética y espiritual concreta.`;
  }

  // Default: PARDES
  return `${toneNote}

DIRECTRIZ ESTRUCTURAL OBLIGATORIA — METODOLOGÍA "PARDES" (פַּרְדֵּס — Los 4 niveles de la exégesis rabínica):
Debes estructurar tanto el discurso continuo ('fullStructuredDerashaMarkdown') como las 4 secciones base de 'methodologySections' estrictamente en estas 4 secciones claras:
1. Pshat (פְּשָׁט — Nivel literal y contextual): Sentido directo, gramatical, filológico e histórico del texto según Rashi, Ibn Ezra, Rashbam y Radak.
2. Rémez (רֶמֶז — Nivel de alusión ética y filosófica): Alusiones intertextuales, patrones numéricos o conceptuales y resonancias filosóficas en la Torá.
3. Drash (דְּרַשׁ — Nivel de interpretación homilética y midráshica): Enseñanzas de Jazal en el Talmud y el Midrash Rabá, lecciones morales y dialéctica rabínica.
4. Sod (סוֹד — Nivel de dimensión profunda o mística): Dimensión interior del alma y del cosmos según el Zóhar, el Arizal, las Sefirot y la Jasidut.`;
}

export function hasExplicitServerCitationOrCalendar(rawQuery: string): boolean {
  const q = (rawQuery || '').trim();
  if (!q) return false;
  if (/\[Calendario Hebreo/i.test(q)) return true;
  return /\b(?:g[eé]nesis|bereshit|[eé]xodo|shemot|lev[ií]tico|vayikr[aá]|n[uú]meros|bamidbar|deuteronomio|devarim|salmos?|tehil[ií]m|proverbios|mishl[eé]|isa[ií]as|jerem[ií]as|ezequiel|daniel|ester|rut|eclesiast[eé]s|koh[eé]let|cantar|avot|berajot|berakhot|shabat|shabbat|pesajim|pesachim|yom[aá]|suk[aá]|taanit|meguil[aá]|megillah|jagig[aá]|kidush[ií]n|kiddushin|bava|sanhedr[ií]n|makot|avod[aá]|menajot|jul[ií]n|arjin|arakhin|sot[aá]h?|oraj\s+jaim|orach\s+chayim|yor[eé]\s+de[aá]|mesil+at\s+yesharim)\s+\d+/i.test(
    q
  );
}

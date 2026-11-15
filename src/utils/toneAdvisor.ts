import {
  DerashaMethodology,
  DerashaTone,
  HalakhicPipelineValidation,
  ResolvedDerashaTone,
} from '../types';

export interface DerashaToneOptionMeta {
  id: DerashaTone;
  shortLabel: string;
  label: string;
  hebrewLabel: string;
  description: string;
  idealTopicsHint: string;
  badgeClass: string;
}

export const DERASHA_TONE_OPTIONS: DerashaToneOptionMeta[] = [
  {
    id: 'AUTO',
    shortLabel: 'Automático',
    label: 'Automático (según el tema)',
    hebrewLabel: 'מֻתְאָם לַנּוֹשֵׂא',
    description:
      'Detecta el tono homilético más adecuado según tu pregunta, las fuentes y la metodología activa.',
    idealTopicsHint: 'Todo tipo de consultas',
    badgeClass: 'bg-sky-500/15 border-sky-500/35 text-sky-200',
  },
  {
    id: 'MOTIVACION',
    shortLabel: 'Motivación y Aliento',
    label: 'Motivación y Aliento (Jizuk)',
    hebrewLabel: 'עִדּוּד וְחִזּוּק',
    description:
      'Fortalece el ánimo, valida las pruebas cotidianas e impulsa a superar el desánimo o la postergación.',
    idealTopicsHint: 'Zerizut, Teshuvá desde el amor, resiliencia, Breslev / Azamrá',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200',
  },
  {
    id: 'ADVERTENCIA_CAUTELA',
    shortLabel: 'Advertencia y Cautela',
    label: 'Advertencia, Cautela y Peligro Ético',
    hebrewLabel: 'זְהִירוּת וְאַזְהָרָה',
    description:
      'Advierte con lucidez sobre riesgos morales, autoengaño, vicios del carácter o fronteras halájicas.',
    idealTopicsHint: 'Lashón Hará, Gaavá, Mafsidayv, Negiá, Koraj / Becerro de Oro',
    badgeClass: 'bg-rose-500/15 border-rose-500/35 text-rose-200',
  },
  {
    id: 'LLAMADO_ACCION',
    shortLabel: 'Llamado a la Acción',
    label: 'Llamado a la Acción (Kabalá LeMaasé)',
    hebrewLabel: 'קְרִיאָה לְמַעֲשֶׂה',
    description:
      'Traduce la enseñanza en responsabilidad concreta, urgencia moral y pasos tangibles para esta semana.',
    idealTopicsHint: 'Tzedaká, Jésed práctico, Pirké Avot 1:14/1:17, Shabat y festividades',
    badgeClass: 'bg-amber-500/15 border-amber-500/35 text-amber-200',
  },
  {
    id: 'ASPIRACIONAL',
    shortLabel: 'Aspiracional',
    label: 'Aspiracional y Visión Trascendente',
    hebrewLabel: 'שְׁאִיפָה וְרוֹמְמוּת',
    description:
      'Eleva la mirada hacia el propósito superior, la dignidad de la Neshamá, la santidad y el horizonte mesiánico.',
    idealTopicsHint: 'Tzelem Elohim, Kedushá, Olam HaBá, Mashíaj, Cábala / Sefirot',
    badgeClass: 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200',
  },
  {
    id: 'ANALITICO_SOBRIO',
    shortLabel: 'Analítico / Sobrio',
    label: 'Analítico y Expositivo Sobrio',
    hebrewLabel: 'עִיּוּן מֶחְקָרִי',
    description:
      'Prioriza la precisión histórico-filológica o halájica sin énfasis exhortativo adicional.',
    idealTopicsHint: 'Wissenschaft des Judentums, manuscritos, Núsaj y Halajá descriptiva',
    badgeClass: 'bg-slate-700/40 border-slate-600/60 text-slate-200',
  },
];

export const AUDIENCE_BASE_PRESETS = [
  { id: 'Comunidad general', subtitle: 'Púlpito · Sinagoga y estudio abierto' },
  { id: 'Bet Midrash', subtitle: 'Rigor académico, fuentes y debate' },
  { id: 'Jóvenes y familias', subtitle: 'Pedagógico, cercano y vivencial' },
  { id: 'Introspección personal', subtitle: 'Contemplativo y trabajo interior' },
];

export interface ToneResolutionResult {
  requestedTone: DerashaTone;
  resolvedTone: ResolvedDerashaTone;
  recommendedTone: ResolvedDerashaTone;
  suitability: 'optimo' | 'viable' | 'no_recomendado';
  advisoryReason: string;
  recommendationReason: string;
  isSensitivePastoralContext: boolean;
}

const WARNING_AND_CAUTION_REGEX =
  /(?<![a-záéíóúñ])(?:lash[oó]n\s+har[aá]|maledicencia|calumnia|chisme|envidia|celos|odio\s+gratuito|sinat\s+jinam|orgullo|gaav[aá]|soberbia|arrogancia|ego[ií]smo|negi[aá]|autoenga[ñn]o|peligro|advertencia|cautela|precauci[oó]n|riesgo|trampa|tropiezo|becerro\s+de\s+oro|koraj|k[oó]raj|diluvio|n[oó]aj|eij[aá]|tish[aá]\s+be[- ]?av|destrucci[oó]n\s+del\s+templo|idolatr[ií]a|avod[aá]\s+zar[aá]|mafsidayv|obst[aá]culos|detractores|tentaci[oó]n|yetzer\s+har[aá]|yom\s+kipur|unesan[eé]\s+tokef|desviaci[oó]n|sincretismo|deja\s+de\s+ser\s+jud[ií]o|jud[ií]os?\s+mesi[aá]nicos?|ira|enojo|rencor)(?![a-záéíóúñ])/i;

const CALL_TO_ACTION_REGEX =
  /(?<![a-záéíóúñ])(?:llamado\s+a\s+la\s+acci[oó]n|acci[oó]n\s+concreta|maas[eé]|tzedak[aá]|caridad|justicia\s+social|pobre|hu[eé]rfano|viuda|pr[oó]jimo|amar\s+al\s+pr[oó]jimo|guemilut\s+jasadim|tik[uú]n\s+olam|responsabilidad\s+(?:colectiva|c[ií]vica|moral)|compromiso|h[aá]bito|pr[aá]ctica\s+semanal|si\s+no\s+es\s+ahora|cu[aá]ndo|pirk[eé]\s+avot\s+1:1[47]|kabal[aá]\s+le[- ]?maas[eé]|actuar|ayudar|solidaridad)(?![a-záéíóúñ])/i;

const MOTIVATION_REGEX =
  /(?<![a-záéíóúñ])(?:motivaci[oó]n|[aá]nimo|des[aá]nimo|pereza|atzlut|procrastinaci[oó]n|postergaci[oó]n|zerizut|diligencia|entusiasmo|teshuv[aá]|arrepentimiento|volver\s+a\s+empezar|fracaso|ca[ií]da|adversidad|miedo|angustia|ansiedad|resiliencia|esperanza|alegr[ií]a|simj[aá]|breslev|azamr[aá]|fortaleza|jizuk|perseverancia|no\s+te\s+corresponde\s+terminar|pirk[eé]\s+avot\s+2:16|empezar\s+de\s+nuevo)(?![a-záéíóúñ])/i;

const ASPIRATIONAL_REGEX =
  /(?<![a-záéíóúñ])(?:aspiracional|prop[oó]sito|sentido\s+de\s+la\s+vida|olam\s+hab[aá]|mundo\s+venidero|destino\s+de\s+las\s+almas|mash[ií]aj|mes[ií]as|redenci[oó]n|gueul[aá]|iluminaci[oó]n|or\s+haganuz|devekut|c[aá]bala|sefirot|[aá]rbol\s+de\s+la\s+vida|tzelem\s+elohim|imagen\s+de\s+dios|kedush[aá]|santidad|dir[aá]\s+betajtonim|luz\s+a\s+las\s+naciones|elevaci[oó]n|trascendencia|grandeza\s+del\s+hombre)(?![a-záéíóúñ])/i;

const SENSITIVE_PASTORAL_REGEX =
  /(?<![a-záéíóúñ])(?:avelut|duelo|luto|shiv[aá]h?|shloshim|yahrzeit|fallecimiento|muerte\s+de\s+un\s+ser\s+querido|enfermedad|pikuaj\s+n[eé]fesh|depresi[oó]n|sufrimiento)(?![a-záéíóúñ])/i;

export function normalizeDerashaTone(raw?: unknown): DerashaTone {
  const val = String(raw || '')
    .trim()
    .toUpperCase();
  if (
    val === 'MOTIVACION' ||
    val === 'ADVERTENCIA_CAUTELA' ||
    val === 'LLAMADO_ACCION' ||
    val === 'ASPIRACIONAL' ||
    val === 'ANALITICO_SOBRIO' ||
    val === 'AUTO'
  ) {
    return val;
  }
  return 'AUTO';
}

export function getToneMeta(tone?: DerashaTone): DerashaToneOptionMeta {
  const norm = normalizeDerashaTone(tone);
  return DERASHA_TONE_OPTIONS.find((t) => t.id === norm) || DERASHA_TONE_OPTIONS[0];
}

export function extractAudienceLabel(audienciaOTono: string): string {
  const clean = String(audienciaOTono || '').trim();
  if (!clean) return 'Comunidad general';
  const firstSegment = clean.split('·')[0]?.trim();
  return firstSegment || 'Comunidad general';
}

export function composeAudienceAndTone(
  audienceBaseOrFull: string,
  tone: DerashaTone,
  resolvedTone?: ResolvedDerashaTone
): string {
  const audience = extractAudienceLabel(audienceBaseOrFull);
  const effectiveTone =
    tone !== 'AUTO' ? tone : resolvedTone || 'MOTIVACION';
  const meta = getToneMeta(effectiveTone);
  if (tone === 'AUTO' && !resolvedTone) {
    return `${audience} · Tono automático según el tema`;
  }
  return `${audience} · ${meta.shortLabel}`;
}

export function recommendToneForTopic(
  query: string,
  resolvedMethodology: Exclude<DerashaMethodology, 'AUTO'>,
  halakhicValidation?: HalakhicPipelineValidation
): {
  recommendedTone: ResolvedDerashaTone;
  reason: string;
  isSensitivePastoralContext: boolean;
} {
  const q = String(query || '').trim();
  const isSensitivePastoralContext = SENSITIVE_PASTORAL_REGEX.test(q);

  if (isSensitivePastoralContext) {
    return {
      recommendedTone: 'MOTIVACION',
      reason:
        'Se detectó un tema sensible (duelo o cuidado de la vida): se recomienda un tono de consuelo, fortaleza (Jizuk) y prudencia pastoral.',
      isSensitivePastoralContext: true,
    };
  }

  if (WARNING_AND_CAUTION_REGEX.test(q)) {
    return {
      recommendedTone: 'ADVERTENCIA_CAUTELA',
      reason:
        'La consulta aborda riesgos éticos, trampas del carácter o fronteras doctrinales donde un tono de advertencia y cautela (Zehirut) aporta claridad.',
      isSensitivePastoralContext: false,
    };
  }

  if (CALL_TO_ACTION_REGEX.test(q)) {
    return {
      recommendedTone: 'LLAMADO_ACCION',
      reason:
        'El tema exige traducción directa a hechos concretos (Maasé, Tzedaká o compromiso comunitario semanal).',
      isSensitivePastoralContext: false,
    };
  }

  if (MOTIVATION_REGEX.test(q)) {
    return {
      recommendedTone: 'MOTIVACION',
      reason:
        'La pregunta trata sobre superación personal, diligencia (Zerizut), retorno o resiliencia; el tono de motivación y aliento (Jizuk) potencia su impacto.',
      isSensitivePastoralContext: false,
    };
  }

  if (ASPIRATIONAL_REGEX.test(q)) {
    return {
      recommendedTone: 'ASPIRACIONAL',
      reason:
        'El eje conceptual apunta a la trascendencia, el propósito del alma o la visión cósmica; el tono aspiracional realza la profundidad teológica.',
      isSensitivePastoralContext: false,
    };
  }

  if (
    resolvedMethodology === 'WISSENSCHAFT_DES_JUDENTUMS' ||
    resolvedMethodology === 'FILOLOGIA_LITURGICA_WISSENSCHAFT' ||
    halakhicValidation?.isPurelyHalakhic
  ) {
    return {
      recommendedTone: 'ANALITICO_SOBRIO',
      reason:
        'Consulta de corte histórico-filológico o halájico descriptivo; el tono analítico sobrio mantiene la precisión técnica y documental.',
      isSensitivePastoralContext: false,
    };
  }

  if (resolvedMethodology === 'MUSAR_TRANSFORMATIVO') {
    return {
      recommendedTone: 'ADVERTENCIA_CAUTELA',
      reason:
        'En Musar Transformativo, diagnosticar la fricción del ego (Negiá) requiere un tono lúcido de cautela y autoexamen.',
      isSensitivePastoralContext: false,
    };
  }

  if (resolvedMethodology === 'MESILAT_YESHARIM_SISTEMATICO') {
    return {
      recommendedTone: 'MOTIVACION',
      reason:
        'La adquisición gradual de virtudes en Mesilat Yesharim armoniza con un tono de aliento y paso práctico.',
      isSensitivePastoralContext: false,
    };
  }

  if (resolvedMethodology === 'PIRKE_AVOT_EXEGETICO') {
    return {
      recommendedTone: 'LLAMADO_ACCION',
      reason:
        'Las máximas de Pirké Avot culminan naturalmente en un llamado práctico a la acción ética.',
      isSensitivePastoralContext: false,
    };
  }

  if (
    resolvedMethodology === 'EVOLUCION_CONCEPTUAL' ||
    resolvedMethodology === 'FILOSOFIA_CONTRASTIVA'
  ) {
    return {
      recommendedTone: 'ASPIRACIONAL',
      reason:
        'El diálogo entre estratos cabalísticos, filosóficos y la Torá cobra fuerza con un horizonte aspiracional.',
      isSensitivePastoralContext: false,
    };
  }

  return {
    recommendedTone: 'ASPIRACIONAL',
    reason:
      'Para exégesis general en PARDÉS, el tono aspiracional conecta los cuatro estratos textuales con un propósito vital elevado.',
    isSensitivePastoralContext: false,
  };
}

export function resolveDerashaTone(
  requestedTone: DerashaTone | string | undefined,
  query: string,
  resolvedMethodology: Exclude<DerashaMethodology, 'AUTO'>,
  halakhicValidation?: HalakhicPipelineValidation
): ToneResolutionResult {
  const normalizedReq = normalizeDerashaTone(requestedTone);
  const rec = recommendToneForTopic(query, resolvedMethodology, halakhicValidation);
  const resolvedTone: ResolvedDerashaTone =
    normalizedReq === 'AUTO' ? rec.recommendedTone : normalizedReq;

  if (normalizedReq === 'AUTO') {
    return {
      requestedTone: 'AUTO',
      resolvedTone,
      recommendedTone: rec.recommendedTone,
      suitability: 'optimo',
      advisoryReason: rec.reason,
      recommendationReason: rec.reason,
      isSensitivePastoralContext: rec.isSensitivePastoralContext,
    };
  }

  const isScholarlyOrHalakhic =
    resolvedMethodology === 'WISSENSCHAFT_DES_JUDENTUMS' ||
    resolvedMethodology === 'FILOLOGIA_LITURGICA_WISSENSCHAFT' ||
    Boolean(halakhicValidation?.isPurelyHalakhic);

  if (rec.isSensitivePastoralContext && resolvedTone === 'ADVERTENCIA_CAUTELA') {
    return {
      requestedTone: normalizedReq,
      resolvedTone,
      recommendedTone: rec.recommendedTone,
      suitability: 'no_recomendado',
      advisoryReason:
        'En consultas sobre duelo o cuidado de la vida, evita un tono severo o acusatorio; se recomienda «Motivación y Aliento» o cuidado pastoral compasivo.',
      recommendationReason: rec.reason,
      isSensitivePastoralContext: true,
    };
  }

  if (isScholarlyOrHalakhic && resolvedTone === 'ADVERTENCIA_CAUTELA') {
    return {
      requestedTone: normalizedReq,
      resolvedTone,
      recommendedTone: rec.recommendedTone,
      suitability: 'no_recomendado',
      advisoryReason:
        'Para consultas histórico-filológicas o normativas descriptivas, un tono de advertencia/peligro puede sonar forzado; se sugiere «Analítico / Sobrio» o «Llamado a la Acción».',
      recommendationReason: rec.reason,
      isSensitivePastoralContext: false,
    };
  }

  if (resolvedTone === rec.recommendedTone) {
    return {
      requestedTone: normalizedReq,
      resolvedTone,
      recommendedTone: rec.recommendedTone,
      suitability: 'optimo',
      advisoryReason: `Tono plenamente afín al tema: ${rec.reason}`,
      recommendationReason: rec.reason,
      isSensitivePastoralContext: rec.isSensitivePastoralContext,
    };
  }

  const chosenMeta = getToneMeta(resolvedTone);
  return {
    requestedTone: normalizedReq,
    resolvedTone,
    recommendedTone: rec.recommendedTone,
    suitability: 'viable',
    advisoryReason: `Tono elegido manualmente (${chosenMeta.shortLabel}). Sugerencia automática para este tema: ${getToneMeta(rec.recommendedTone).shortLabel}.`,
    recommendationReason: rec.reason,
    isSensitivePastoralContext: rec.isSensitivePastoralContext,
  };
}

export function getToneRhetoricalDirectives(
  resolvedTone: ResolvedDerashaTone,
  isSensitivePastoralContext = false
): string {
  const sensitivityGuard = isSensitivePastoralContext
    ? '\n- SALVAGUARDA PASTORAL OBLIGATORIA: Dado que el tema toca duelo o fragilidad de la vida, mantén compasión rabínica absoluta, evita cualquier culpabilización y jamás emitas diagnósticos médicos.'
    : '';

  switch (resolvedTone) {
    case 'MOTIVACION':
      return `TONO HOMILÉTICO ACTIVO: "MOTIVACIÓN Y ALIENTO (עִדּוּד וְחִזּוּק — JIZUK)".
- En el Exordio ('openingExordium'), valida con empatía la dificultad humana real y abre un horizonte luminoso de posibilidad y renovación.
- En cada sección metodológica, subraya cómo la Torá y Jazal fortalecen el espíritu frente al desánimo o la inercia (enfatiza la Misericordia Divina, el valor de cada pequeño avance y el regreso desde el amor).
- En la Conclusión Práctica ('practicalConclusion'), entrega palabras de impulso concreto y esperanza tangible para comenzar hoy mismo.${sensitivityGuard}`;

    case 'ADVERTENCIA_CAUTELA':
      return `TONO HOMILÉTICO ACTIVO: "ADVERTENCIA, CAUTELA Y PREVENCIÓN ÉTICA (זְהִירוּת וְאַזְהָרָה — ZEHIRUT)".
- En el Exordio ('openingExordium'), señala con lucidez y seriedad rabínica el punto ciego, riesgo moral o peligro espiritual que el texto advierte si se descuida.
- En el desarrollo, desglosa los mecanismos de autoengaño (negiá), las consecuencias en el alma y la comunidad, y las señales tempranas de alerta basadas en fuentes canónicas, sin caer en fatalismo ni en melodrama vacío.
- En la Conclusión Práctica ('practicalConclusion'), convierte la cautela en un cerco protector constructivo (Seyag) y en vigilancia ética serena y responsable.${sensitivityGuard}`;

    case 'LLAMADO_ACCION':
      return `TONO HOMILÉTICO ACTIVO: "LLAMADO A LA ACCIÓN (קְרִיאָה לְמַעֲשֶׂה — KABALÁ LEMAASÉ)".
- En el Exordio ('openingExordium'), conecta de inmediato la pregunta con la responsabilidad histórica y cotidiana del oyente («Lo ha-midrash hu ha-ikar ela ha-maasé» — Pirké Avot 1:17).
- Usa un estilo directo, interpelador y constructivo: cada sección debe responder "¿qué nos exige hacer esta fuente hoy en la familia, la comunidad o el trabajo?".
- En la Conclusión Práctica ('practicalConclusion'), en 'dailyAction' enumera explícitamente **3 acciones concretas y verificables** para ejecutar esta misma semana.${sensitivityGuard}`;

    case 'ASPIRACIONAL':
      return `TONO HOMILÉTICO ACTIVO: "ASPIRACIONAL Y VISIÓN TRASCENDENTE (שְׁאִיפָה וְרוֹמְמוּת — GADLUT HAADAM)".
- En el Exordio ('openingExordium'), eleva la consulta hacia el propósito superior de la creación, la dignidad de haber sido creados *Betzelem Elohim* y el llamado a santificar la historia.
- En cada sección metodológica, conecta los detalles textuales con la gran arquitectura espiritual del judaísmo (hacer de este mundo una morada para lo Divino, *Dirá BeTajtonim*).
- En la Conclusión Práctica ('practicalConclusion'), invita a vivir con visión amplia, nobleza interior y vocación de luz en lo cotidiano.${sensitivityGuard}`;

    case 'ANALITICO_SOBRIO':
    default:
      return `TONO HOMILÉTICO ACTIVO: "ANALÍTICO Y EXPOSITIVO SOBRIO (עִיּוּן מֶחְקָרִי)".
- Mantén un tono claro, preciso, objetivo y erudito, privilegiando la fidelidad filológica, documental o halájica por encima de recursos retóricos emocionales.
- En 'practicalConclusion', sintetiza criterios normativos o de estudio riguroso aplicables sin forzar exhortaciones dramáticas.${sensitivityGuard}`;
  }
}

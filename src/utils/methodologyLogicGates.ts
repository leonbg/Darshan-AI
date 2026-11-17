import {
  DerashaMethodology,
  DerashaDuration,
  ExternalThinkerPipelineDetection,
  HalakhicPipelineValidation,
  HalakhicShulchanArukhConsultation,
} from '../types';
import { detectExternalThinkerAndForceExegeticalSearch } from './externalThinkerDetector';
import { validatePurelyHalakhicQuery } from './halakhicPipelineValidator';
import { consultHalakhicShulchanArukhModule } from './halakhicShulchanArukhModule';

export type ResolvedMethodology = Exclude<DerashaMethodology, 'AUTO'>;

export interface DurationConfigMeta {
  id: DerashaDuration;
  shortLabel: string;
  label: string;
  minutes: number;
  targetWordsRange: string;
  complementaryCount: number;
  description: string;
}

export const DERASHA_DURATION_OPTIONS: DurationConfigMeta[] = [
  {
    id: '5_MIN',
    shortLabel: '5 min',
    label: '5 min · Esencial y Directa',
    minutes: 5,
    targetWordsRange: '500–700 palabras',
    complementaryCount: 0,
    description:
      'Enfoque conciso de púlpito centrado en 1 sola metodología principal con aplicación inmediata.',
  },
  {
    id: '10_MIN',
    shortLabel: '10 min',
    label: '10 min · Profunda + 1 Aporte Complementario',
    minutes: 10,
    targetWordsRange: '1.000–1.400 palabras',
    complementaryCount: 1,
    description:
      'Desarrolla la metodología principal e integra un aporte complementario de una 2.ª metodología afín.',
  },
  {
    id: '30_MIN',
    shortLabel: '30 min',
    label: '30 min · Shiur Magistral Multi-Metodológico',
    minutes: 30,
    targetWordsRange: '1.900–2.600 palabras',
    complementaryCount: 2,
    description:
      'Clase completa (Shiur) que articula la metodología principal con aportes de 2 metodologías adicionales, fuentes amplias y preguntas de estudio.',
  },
];

export interface LogicGateEvaluation {
  gateId:
    | 'GATE_1_HISTORICAL_WISSENSCHAFT'
    | 'GATE_2_MULTISTRATA_EVOLUTION'
    | 'GATE_3_PHILOSOPHICAL_CONTRAST'
    | 'GATE_4_PIRKEI_AVOT_TANNAITIC'
    | 'GATE_5_VIRTUES_MESILAT_YESHARIM'
    | 'GATE_6_CHARACTER_FRICTION_MUSAR'
    | 'GATE_7_BIBLICAL_PARDES_DEFAULT';
  gateNumber: number;
  gateTitle: string;
  enforcedMethodology: ResolvedMethodology;
  alternativeMethodology?: ResolvedMethodology;
  recommendedComplementary: ResolvedMethodology[];
  matchedKeywords: string[];
  confidence: 'alta' | 'media' | 'base';
  explanation: string;
  isVirtueOrCharacterTrait: boolean;
  isHistoricalConcept: boolean;
  externalThinkerDetection?: ExternalThinkerPipelineDetection;
  halakhicValidation?: HalakhicPipelineValidation;
  halakhicConsultation?: HalakhicShulchanArukhConsultation;
}

interface GateRule {
  gateId: LogicGateEvaluation['gateId'];
  gateNumber: number;
  gateTitle: string;
  methodology: ResolvedMethodology;
  alternative?: ResolvedMethodology;
  defaultComplementary: ResolvedMethodology[];
  isVirtueOrCharacterTrait: boolean;
  isHistoricalConcept: boolean;
  patterns: Array<{ label: string; regex: RegExp }>;
  explanationTemplate: (matches: string[]) => string;
}

const LOGIC_GATE_RULES: GateRule[] = [
  {
    gateId: 'GATE_1_HISTORICAL_WISSENSCHAFT',
    gateNumber: 1,
    gateTitle: 'Compuerta 1 · Conceptos Históricos y Crítica Textual (WISSENSCHAFT_DES_JUDENTUMS)',
    methodology: 'WISSENSCHAFT_DES_JUDENTUMS',
    alternative: 'PARDES',
    defaultComplementary: ['PARDES', 'EVOLUCION_CONCEPTUAL'],
    isVirtueOrCharacterTrait: false,
    isHistoricalConcept: true,
    patterns: [
      {
        label: 'Conceptos Históricos / Historia',
        regex:
          /(?<![a-záéíóúñ])(?:hist[oó]ric[oa]s?|hist[oó]ricamente|evolucion[oó]\s+hist[oó]ricamente|historia\s+(?:de|redaccional|textual|lit[uú]rgica)|redaccional(?:es)?|estratos?\s+(?:tana[ií]ticos?|amoraicos?|redaccionales?)|origen\s+hist[oó]rico|contexto\s+hist[oó]rico|desarrollo\s+hist[oó]rico|evoluci[oó]n\s+hist[oó]rica|[eé]poca\s+(?:de\s+esdras|tana[ií]tica|amoraica|ge[oó]nica|medieval|del\s+segundo\s+templo)|esdras\s+el\s+escriba|instituci[oó]n\s+de\s+la\s+sinagoga|segundo\s+templo|siglo\s+[ivx\d]+|antig[üu]edad)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Modim / Modim de-Rabanán',
        regex: /(?<![a-záéíóúñ])modim(?:\s+de[- ]?raban[aá]n)?(?![a-záéíóúñ])/i,
      },
      { label: 'Yotzer Bereshit', regex: /\byotzer\s+bereshit\b/i },
      {
        label: 'Amidá / Halel / Liturgia',
        regex:
          /(?<![a-záéíóúñ])(?:amid[aá]h?|shemon[eé]\s+esr[eé]|dieciocho\s+bendiciones|jatimat\s+beraj[aá]|halel|hallel|jats[ií]\s+halel|halel\s+shalem|medio\s+halel|halel\s+completo|liturgia|lit[uú]rgic[oa]s?)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Guenizá / Manuscritos / Crítica Textual',
        regex:
          /(?<![a-záéíóúñ])(?:gueniz[aá]|geniz[aá]|manuscritos?|c[oó]dices?|rito\s+palestinense|rito\s+babil[oó]nico|tradici[oó]n\s+babil[oó]nica|ecd[oó]tica|cr[ií]tica\s+textual|variantes?\s+textuales|historia\s+de\s+la\s+redacci[oó]n|redacci[oó]n\s+talm[uú]dica)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Códigos Geónicos y Halájicos (Amram / Saadia / Vitry / Shulján Aruj)',
        regex:
          /(?<![a-záéíóúñ])(?:amram\s+ga[oó]n|saadia\s+ga[oó]n|majzor\s+vitry|sidur|siddur|n[uú]saj|nusjaot|shulj[aá]n\s+aruj|mishn[aá]\s+berur[aá]|mejaber|ram[aá]|rem[aá]|minhag|minhaguim|mi\s+jag)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Sotá 40a / Yerushalmi',
        regex: /(?<![a-záéíóúñ])(?:sot[aá]h?\s+40a|yerushalmi|talmud\s+de\s+jerusal[eé]n)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Wissenschaft / Erudición Académica',
        regex:
          /(?<![a-záéíóúñ])(?:wissenschaft|heinemann|elbogen|stefan\s+reif|uri\s+ehrlich|fleischer|filolog[ií]a(?:\s+hist[oó]rica|\s+lit[uú]rgica)?|filol[oó]gic[oa]s?)(?![a-záéíóúñ])/i,
      },
    ],
    explanationTemplate: (matches) =>
      `Pipeline detectó conceptos históricos, crítico-litúrgicos o comparación de Núsaj y Minhag (${matches.slice(0, 4).join(', ')}). Se configura automáticamente la metodología WISSENSCHAFT_DES_JUDENTUMS.`,
  },
  {
    gateId: 'GATE_2_MULTISTRATA_EVOLUTION',
    gateNumber: 2,
    gateTitle: 'Compuerta 2 · Genealogía Multi-Estrato (Torá · Cábala · Musar · Jasidut)',
    methodology: 'EVOLUCION_CONCEPTUAL',
    alternative: 'PARDES',
    defaultComplementary: ['MESILAT_YESHARIM_SISTEMATICO', 'WISSENSCHAFT_DES_JUDENTUMS'],
    isVirtueOrCharacterTrait: false,
    isHistoricalConcept: false,
    patterns: [
      {
        label: 'evolución del concepto',
        regex: /(?<![a-záéíóúñ])evoluci[oó]n(?:\s+del\s+concepto)?(?![a-záéíóúñ])/i,
      },
      { label: 'Árbol de la Vida', regex: /(?<![a-záéíóúñ])[aá]rbol\s+de\s+la\s+vida(?![a-záéíóúñ])/i },
      { label: 'Etz Jaim', regex: /\betz\s+jaim\b/i },
      { label: 'Sefirot / Sefirá', regex: /(?<![a-záéíóúñ])sefir(?:ot|[aá])(?![a-záéíóúñ])/i },
      { label: 'Cábala', regex: /(?<![a-záéíóúñ])(?:c[aá]bala|kabal[aá]|z[oó]har|arizal)(?![a-záéíóúñ])/i },
      {
        label: 'Jasidut / Escuelas jasídicas',
        regex:
          /(?<![a-záéíóúñ])(?:jasidut|jas[ií]dic[oa]s?|baal\s+shem\s+tov|besht|tania|jabad|breslev|sfat\s+emet|kotzk)(?![a-záéíóúñ])/i,
      },
      { label: 'cómo se escribe / concibe', regex: /(?<![a-záéíóúñ])c[oó]mo\s+se\s+(?:escribe|concibe)(?![a-záéíóúñ])/i },
      {
        label: 'diferencias entre visiones',
        regex: /\bdiferencias\b.*\b(?:visiones|corrientes|escuelas|tradiciones)\b/i,
      },
    ],
    explanationTemplate: (matches) =>
      `Pipeline detectó estudio transversal en múltiples corrientes (${matches.slice(0, 4).join(', ')}). Se configura EVOLUCION_CONCEPTUAL (Torá · Cábala · Musar · Jasidut).`,
  },
  {
    gateId: 'GATE_3_PHILOSOPHICAL_CONTRAST',
    gateNumber: 3,
    gateTitle: 'Compuerta 3 · Contraste Exegético Formal y Fuentes Externas (Majshévet Yisrael vs. Filosofía y Cosmovisiones)',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    alternative: 'PIRKE_AVOT_EXEGETICO',
    defaultComplementary: ['PIRKE_AVOT_EXEGETICO', 'MUSAR_TRANSFORMATIVO'],
    isVirtueOrCharacterTrait: false,
    isHistoricalConcept: false,
    patterns: [
      {
        label: 'Kant / Imperativo Categórico',
        regex:
          /\b(?:kant|kantian[oa]s?|imperativo\s+categ[oó]rico|imperativo\s+de\s+hunt|grundlegung|deontolog[ií]a\s+kantiana)\b/i,
      },
      {
        label: 'Platón / Alegoría de la Caverna',
        regex:
          /\b(?:plat[oó]n|plat[oó]nic[oa]s?|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|caverna\s+de\s+plat[oó]n|rep[uú]blica\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas|eutifr[oó]n|fed[oó]n|timeo)\b/i,
      },
      {
        label: 'Cicerón / De Officiis y Ley Natural',
        regex:
          /\b(?:cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae)\b/i,
      },
      {
        label: 'Iluminación Budista / Budismo frente al Judaísmo',
        regex:
          /\b(?:budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|iluminaci[oó]n\s+budista)\b/i,
      },
      {
        label: 'Destino de las Almas: Olam HaBá vs. Nirvana, Valhalla, Cielo e Infierno',
        regex:
          /\b(?:nirvana|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno|campos\s+el[ií]seos|samsara|destino\s+de\s+las\s+almas)\b/i,
      },
      {
        label: 'Mashíaj del Judaísmo vs. Caracterización del Mesías del Cristianismo',
        regex:
          /\b(?:mes[ií]as\s+del\s+cristianismo|mash[ií]aj.*cristian|cristian.*mash[ií]aj|cristian.*mes[ií]as|disputa\s+de\s+barcelona|vikuaj|pecado\s+original|segunda\s+venida|parus[ií]a|encarnaci[oó]n)\b/i,
      },
      {
        label: 'Fuentes Internas de la Torá vs. Fuentes Externas',
        regex:
          /\b(?:fuentes?\s+internas?\s+(?:y|o|vs\.?|frente\s+a)\s+fuentes?\s+externas?|fuentes?\s+externas?\s+filos[oó]ficas?|autonom[ií]a\s+moral\s+kantiana|heteronom[ií]a\s+vs\.?\s+autonom[ií]a)\b/i,
      },
      {
        label: 'Universalidad vs. Especificidad del Mandamiento',
        regex:
          /\b(?:universalidad\s+(?:o|y|frente\s+a(?:\s+la)?|vs\.?)\s+especificidad|especificidad\s+del\s+mandamiento)\b/i,
      },
      { label: 'Estoicismo / Estoicos', regex: /\bestoic(?:ismo|o|os|a)\b/i },
      {
        label: 'Ataraxia / Amor fati',
        regex: /\b(?:ataraxia|amor\s+fati|apatheia|dicotom[ií]a\s+del\s+control)\b/i,
      },
      {
        label: 'Filósofos clásicos',
        regex: /\b(?:epicteto|marco\s+aurelio|s[eé]neca|arist[oó]teles|s[oó]crates|fil[oó]n\s+de\s+alejandr[ií]a)\b/i,
      },
      {
        label: 'Filosofía moderna',
        regex:
          /\b(?:spinoza|descartes|nietzsche|existencialismo|epicure[ií]smo|utilitarismo|humanismo\s+secular|hermann\s+cohen|rosenzweig|levinas)\b/i,
      },
      {
        label: 'Filosofía Comparada / Religiones Comparadas',
        regex:
          /\b(?:filosof[ií]a\s+comparada|religiones\s+comparadas|filosof[ií]a\s+occidental|filosof[ií]a\s+griega)\b/i,
      },
      {
        label: 'Kuzari / Moreh Nevujim',
        regex: /\b(?:kuzari|moreh\s+nevujim|gu[ií]a\s+de\s+los\s+perplejos)\b/i,
      },
    ],
    explanationTemplate: (matches) =>
      `Pipeline detectó estudio comparativo con pensadores o tradiciones externas (${matches.slice(0, 4).join(', ')}). Se activa FILOSOFIA_CONTRASTIVA.`,
  },
  {
    gateId: 'GATE_4_PIRKEI_AVOT_TANNAITIC',
    gateNumber: 4,
    gateTitle: 'Compuerta 4 · Exégesis de Máximas Tanaíticas (Pirké Avot)',
    methodology: 'PIRKE_AVOT_EXEGETICO',
    alternative: 'MUSAR_TRANSFORMATIVO',
    defaultComplementary: ['MUSAR_TRANSFORMATIVO', 'MESILAT_YESHARIM_SISTEMATICO'],
    isVirtueOrCharacterTrait: false,
    isHistoricalConcept: false,
    patterns: [
      { label: 'Pirké Avot', regex: /(?<![a-záéíóúñ])pirk[eé]i?\s+avot(?![a-záéíóúñ])/i },
      { label: 'Mishná Avot', regex: /(?<![a-záéíóúñ])(?:mishn[aá]\s+)?avot\s+\d+[:.]\d+\b/i },
      { label: 'Hilel / Shamai', regex: /\b(?:hilel|hillel|shamai|shammai)\b/i },
      {
        label: 'Sabios de la Mishná',
        regex:
          /(?<![a-záéíóúñ])(?:ben\s+zom[aá]|ben\s+azai|ant[ií]gonos|rab[ií]\s+tarf[oó]n|rab[aá]n\s+gamliel|rab[ií]\s+akiva|tana[ií]ta)(?![a-záéíóúñ])/i,
      },
    ],
    explanationTemplate: (matches) =>
      `Pipeline detectó fuente o sabio tanaítico (${matches.slice(0, 4).join(', ')}). Se configura PIRKE_AVOT_EXEGETICO.`,
  },
  {
    gateId: 'GATE_6_CHARACTER_FRICTION_MUSAR',
    gateNumber: 6,
    gateTitle: 'Compuerta 6 · Rasgos de Carácter, Crecimiento Personal y Fricción (MUSAR_TRANSFORMATIVO)',
    methodology: 'MUSAR_TRANSFORMATIVO',
    alternative: 'MESILAT_YESHARIM_SISTEMATICO',
    defaultComplementary: ['MESILAT_YESHARIM_SISTEMATICO', 'EVOLUCION_CONCEPTUAL'],
    isVirtueOrCharacterTrait: true,
    isHistoricalConcept: false,
    patterns: [
      {
        label: 'Crecimiento Personal / Automejora',
        regex:
          /(?<![a-záéíóúñ])(?:crecimiento\s+personal|desarrollo\s+personal|superaci[oó]n\s+personal|automejora|mejorar\s+como\s+persona|transformaci[oó]n\s+personal|cambio\s+de\s+h[aá]bitos?|trabajar\s+en\s+uno\s+mismo)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Rasgos de Carácter / Conducta',
        regex:
          /(?<![a-záéíóúñ])(?:rasgos?\s+de\s+car[aá]cter|car[aá]cter|conducta|comportamiento|defecto\s+de\s+car[aá]cter|psicolog[ií]a\s+moral)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Jeshbón HaNéfesh / Salanter',
        regex: /(?<![a-záéíóúñ])(?:jeshb[oó]n\s*han[eé]fesh|contabilidad\s+del\s+alma|salanter|kelm|novardok|dessler)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Ira / Enojo (Kaas)',
        regex: /(?<![a-záéíóúñ])(?:ira|enojo|enojarse|c[oó]lera|rabia|kaas|impaciencia|reactividad)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Orgullo / Ego (Gaavá / Kavod)',
        regex: /(?<![a-záéíóúñ])(?:orgullo|soberbia|ego|vanidad|arrogancia|gaav[aá]|kavod|b[uú]squeda\s+de\s+honor)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Envidia / Celos (Kiná)',
        regex: /(?<![a-záéíóúñ])(?:envidia|celos|kin[aá]|comparaci[oó]n|resentimiento|rencor)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Pereza / Apatía (Atzlut)',
        regex: /(?<![a-záéíóúñ])(?:pereza|apat[ií]a|inercia|postergaci[oó]n|procrastinaci[oó]n|atzlut|desgano)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Juicio / Crítica / Lashón Hará',
        regex: /(?<![a-záéíóúñ])(?:cr[ií]tica|criticar|juzgar|prejuicio|chisme|lash[oó]n\s+har[aá]|maledicencia)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Fricción conductual / Hábito',
        regex:
          /(?<![a-záéíóúñ])(?:fricci[oó]n|reacci[oó]n\s+autom[aá]tica|impulso|yetzer\s+har[aá]|autoenga[ñn]o|negi[aá]|sesgo|h[aá]bito)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Ansiedad / Miedo',
        regex: /(?<![a-záéíóúñ])(?:ansiedad|angustia|miedo|temor|preocupaci[oó]n)(?![a-záéíóúñ])/i,
      },
    ],
    explanationTemplate: (matches) =>
      `Pipeline detectó rasgos de carácter, crecimiento personal o fricción ética (${matches.slice(0, 4).join(', ')}). Se configura automáticamente MUSAR_TRANSFORMATIVO (alternativa directa: MESILAT_YESHARIM_SISTEMATICO).`,
  },
  {
    gateId: 'GATE_5_VIRTUES_MESILAT_YESHARIM',
    gateNumber: 5,
    gateTitle: 'Compuerta 5 · Virtudes y Adquisición Sistemática del Carácter (MESILAT_YESHARIM_SISTEMATICO)',
    methodology: 'MESILAT_YESHARIM_SISTEMATICO',
    alternative: 'MUSAR_TRANSFORMATIVO',
    defaultComplementary: ['MUSAR_TRANSFORMATIVO', 'EVOLUCION_CONCEPTUAL'],
    isVirtueOrCharacterTrait: true,
    isHistoricalConcept: false,
    patterns: [
      { label: 'Mesilat Yesharim / Ramjal', regex: /\b(?:mesilat|mesillat|ramjal|luzzatto)\b/i },
      {
        label: 'Virtud / Midot / Adquirir virtud',
        regex:
          /(?<![a-záéíóúñ])(?:virtud|virtudes|midd[aá]|midot|adquirir\s+la\s+virtud|cultivar\s+la\s+virtud|[eé]tica\s+de\s+las\s+virtudes)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Escalera del Ramjal',
        regex:
          /(?<![a-záéíóúñ])(?:zehirut|vigilancia|zerizut|diligencia|nekiyut|limpieza|perishut|abstenci[oó]n|tahar[aá]|pureza|piedad|anav[aá]|humildad|yirat\s+jet|kedush[aá]|santidad)(?![a-záéíóúñ])/i,
      },
      {
        label: 'Bondad / Jésed / Generosidad',
        regex: /(?<![a-záéíóúñ])(?:j[eé]sed|chesed|bondad|generosidad|compasi[oó]n|empat[ií]a|altruismo|netin[aá])(?![a-záéíóúñ])/i,
      },
      {
        label: 'Paciencia / Gratitud / Confianza',
        regex:
          /(?<![a-záéíóúñ])(?:paciencia|savlanut|gratitud|hakarat\s+hatov|agradecimiento|bitaj[oó]n|confianza|integridad|emet|verdad|modestia|tzniut)(?![a-záéíóúñ])/i,
      },
    ],
    explanationTemplate: (matches) =>
      `Pipeline detectó estudio de virtudes o rasgos éticos (${matches.slice(0, 4).join(', ')}). Se configura automáticamente MESILAT_YESHARIM_SISTEMATICO (alternativa directa: MUSAR_TRANSFORMATIVO).`,
  },
];

function computeComplementaryList(
  primary: ResolvedMethodology,
  evaluations: Array<{ rule: GateRule; score: number }>,
  fallbackDefaults: ResolvedMethodology[],
  allowPhilosophicalContrast = false
): ResolvedMethodology[] {
  const scoredOthers = evaluations
    .filter(
      (e) =>
        e.rule.methodology !== primary &&
        e.score > 0 &&
        (allowPhilosophicalContrast || e.rule.methodology !== 'FILOSOFIA_CONTRASTIVA')
    )
    .sort((a, b) => b.score - a.score)
    .map((e) => e.rule.methodology);

  const combined = Array.from(
    new Set([...scoredOthers, ...fallbackDefaults, 'PARDES' as ResolvedMethodology])
  ).filter(
    (m) => m !== primary && (allowPhilosophicalContrast || m !== 'FILOSOFIA_CONTRASTIVA')
  );

  return combined.slice(0, 3);
}

export function evaluateMethodologyLogicGates(query: string): LogicGateEvaluation {
  const cleanQuery = (query || '').trim();
  const halakhicValidation = validatePurelyHalakhicQuery(cleanQuery);
  const halakhicConsultation = consultHalakhicShulchanArukhModule(cleanQuery, halakhicValidation);
  const result = evaluateMethodologyLogicGatesInternal(cleanQuery, halakhicValidation);
  return {
    ...result,
    halakhicValidation,
    ...(halakhicConsultation.active ? { halakhicConsultation } : {}),
  };
}

function evaluateMethodologyLogicGatesInternal(
  cleanQuery: string,
  halakhicValidation: HalakhicPipelineValidation
): LogicGateEvaluation {

  if (!cleanQuery) {
    return {
      gateId: 'GATE_7_BIBLICAL_PARDES_DEFAULT',
      gateNumber: 7,
      gateTitle: 'Compuerta 7 · Exégesis Clásica en 4 Niveles (PARDÉS)',
      enforcedMethodology: 'PARDES',
      alternativeMethodology: 'MESILAT_YESHARIM_SISTEMATICO',
      recommendedComplementary: ['MESILAT_YESHARIM_SISTEMATICO', 'EVOLUCION_CONCEPTUAL'],
      matchedKeywords: [],
      confidence: 'base',
      explanation: 'Sin palabras clave específicas aún: se emplea por defecto la hermenéutica clásica PARDÉS.',
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Dedicated External Thinker Detector Module (Kant, Platón, Cicerón, Aristóteles, Epicteto, Spinoza, Nietzsche, Buda, etc.)
  // Automatically disabled when halakhicValidation.externalPhilosophyInjectionDisabled is true
  const externalThinkerDetection = halakhicValidation.externalPhilosophyInjectionDisabled
    ? undefined
    : detectExternalThinkerAndForceExegeticalSearch(cleanQuery);

  const evaluations = LOGIC_GATE_RULES.map((rule) => {
    const matchedKeywords: string[] = [];
    for (const p of rule.patterns) {
      if (p.regex.test(cleanQuery)) {
        matchedKeywords.push(p.label);
      }
    }
    return {
      rule,
      matchedKeywords,
      score: matchedKeywords.length,
    };
  });

  const gateHistorical = evaluations.find((e) => e.rule.gateId === 'GATE_1_HISTORICAL_WISSENSCHAFT')!;
  const gateEvolution = evaluations.find((e) => e.rule.gateId === 'GATE_2_MULTISTRATA_EVOLUTION')!;
  const gatePhilosophy = evaluations.find((e) => e.rule.gateId === 'GATE_3_PHILOSOPHICAL_CONTRAST')!;
  const gateAvot = evaluations.find((e) => e.rule.gateId === 'GATE_4_PIRKEI_AVOT_TANNAITIC')!;
  const gateVirtues = evaluations.find((e) => e.rule.gateId === 'GATE_5_VIRTUES_MESILAT_YESHARIM')!;
  const gateMusar = evaluations.find((e) => e.rule.gateId === 'GATE_6_CHARACTER_FRICTION_MUSAR')!;

  // Priority Override: If the External Thinker Detector module identifies an external philosopher or thinker,
  // immediately force Gate 3 (FILOSOFIA_CONTRASTIVA) + Forced Exegetical Sefaria Search + Universality vs Specificity Matrix
  if (
    externalThinkerDetection?.detected &&
    !halakhicValidation.externalPhilosophyInjectionDisabled
  ) {
    const primary: ResolvedMethodology = 'FILOSOFIA_CONTRASTIVA';
    const combinedKeywords = Array.from(
      new Set([
        `${externalThinkerDetection.thinkerName} (${externalThinkerDetection.specificPhilosophicalConcept.split('(')[0].trim()})`,
        externalThinkerDetection.eraAndTradition,
        ...gatePhilosophy.matchedKeywords,
      ])
    );
    return {
      gateId: 'GATE_3_PHILOSOPHICAL_CONTRAST',
      gateNumber: 3,
      gateTitle: `Módulo Detector de Pensador Externo · ${externalThinkerDetection.thinkerName} vs. Cosmovisión de la Torá`,
      enforcedMethodology: primary,
      alternativeMethodology: 'PIRKE_AVOT_EXEGETICO',
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gatePhilosophy.rule.defaultComplementary,
        true
      ),
      matchedKeywords: combinedKeywords,
      confidence: 'alta',
      explanation: `Módulo Detector de Pensador Externo activado para ${externalThinkerDetection.thinkerName} (${externalThinkerDetection.specificPhilosophicalConcept}). Se fuerza búsqueda de ${externalThinkerDetection.forcedExegeticalSefariaRefs.length} fuentes exegéticas canónicas (${externalThinkerDetection.forcedExegeticalSefariaRefs.map((r) => `${r.ref} (${r.heRef})`).slice(0, 3).join(', ')}) para contrastar Universalidad vs. Especificidad del Mandamiento.`,
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: false,
      externalThinkerDetection,
      halakhicValidation,
    };
  }

  // Gate 2 wins when multi-strata evolution across traditions is requested or explicit conceptual evolution is asked
  const hasExplicitEvolutionPhrase =
    /(?<![a-záéíóúñ])(evoluci[oó]n\s+del\s+concepto|evoluci[oó]n\s+conceptual|c[oó]mo\s+evoluciona\s+el\s+concepto|cuatro\s+visiones|4\s+visiones|a\s+trav[eé]s\s+de\s+las\s+corrientes|[aá]rbol\s+de\s+la\s+vida|etz\s+jaim)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  if (
    (gateEvolution.score >= 2 &&
      /(?<![a-záéíóúñ])([aá]rbol\s+de\s+la\s+vida|arbol\s+de\s+la\s+vida|etz\s+jaim|sefirot|c[aá]bala|jasidut|jasidismo|baal\s+shem\s+tov|tania|breslev|sfat\s+emet|cuatro\s+visiones|4\s+visiones|evoluci[oó]n\s+del\s+concepto|evoluci[oó]n\s+conceptual)(?![a-záéíóúñ])/i.test(
        cleanQuery
      )) ||
    (gateEvolution.score >= 1 && hasExplicitEvolutionPhrase)
  ) {
    const combinedMatches = Array.from(
      new Set([...gateEvolution.matchedKeywords, ...gateVirtues.matchedKeywords])
    );
    const primary = gateEvolution.rule.methodology;
    return {
      gateId: gateEvolution.rule.gateId,
      gateNumber: gateEvolution.rule.gateNumber,
      gateTitle: gateEvolution.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: gateVirtues.score > 0 ? 'MESILAT_YESHARIM_SISTEMATICO' : 'PARDES',
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gateEvolution.rule.defaultComplementary
      ),
      matchedKeywords: combinedMatches,
      confidence: 'alta',
      explanation: gateEvolution.rule.explanationTemplate(combinedMatches),
      isVirtueOrCharacterTrait: gateVirtues.score > 0 || gateMusar.score > 0,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Gate 3: Philosophical Contrast & External Sources (never triggers on purely internal Halakhic, Minhag, Núsaj or liturgical topics)
  const hasExplicitInternalHalakhaOrLiturgy =
    halakhicValidation.externalPhilosophyInjectionDisabled ||
    /(?<![a-záéíóúñ])(halel|hallel|jats[ií]\s+halel|halel\s+shalem|halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|shulj[aá]n\s+aruj|mishn[aá]\s+berur[aá]|mishn[eé]\s+tor[aá]|oraj\s+jaim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|mejaber|ram[aá]|rem[aá]|minhag|minhaguim|mi\s+jag|n[uú]saj|nusjaot|sefard[ií](?:es|m|ta|tas)?|ashkenaz[ií](?:es|m)?|edot\s+hamizraj|teiman[ií]|pesajim|taanit|arj[ií]n|arakhin|berajot|rosh\s+j[oó]desh|modim|yotzer\s+bereshit|amid[aá]h?|shemon[eé]\s+esr[eé]|dieciocho\s+bendiciones|gueniz[aá]|geniz[aá]|sot[aá]h?\s+40a|wissenschaft|amram\s+ga[oó]n|saadia\s+ga[oó]n|majzor\s+vitry)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  if (gatePhilosophy.score >= 1 && !hasExplicitInternalHalakhaOrLiturgy) {
    const primary = gatePhilosophy.rule.methodology;
    return {
      gateId: gatePhilosophy.rule.gateId,
      gateNumber: gatePhilosophy.rule.gateNumber,
      gateTitle: gatePhilosophy.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: gatePhilosophy.rule.alternative,
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gatePhilosophy.rule.defaultComplementary,
        true
      ),
      matchedKeywords: gatePhilosophy.matchedKeywords,
      confidence: gatePhilosophy.score >= 2 ? 'alta' : 'media',
      explanation: gatePhilosophy.rule.explanationTemplate(gatePhilosophy.matchedKeywords),
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Gate 1: Historical Concepts, Liturgical Philology & Textual Criticism -> WISSENSCHAFT_DES_JUDENTUMS
  // Note: If the user asks about Halel, Shulján Aruj, Minhag or Halajá in general without historical/philological keywords, prefer PARDES (with Halakhic/Shulján Aruj Pshat & Drash) and WISSENSCHAFT_DES_JUDENTUMS as complementary
  const hasExplicitHistoricalCriticalMarkers =
    /(?<![a-záéíóúñ])(hist[oó]ric[oa]s?|historia|evolucion[oó]|evoluci[oó]n\s+hist[oó]rica|origen\s+hist[oó]rico|or[ií]genes|desarrollo\s+hist[oó]rico|redaccional|redacci[oó]n|estratos?|manuscritos?|c[oó]dices?|gueniz[aá]|geniz[aá]|wissenschaft|filolog[ií]a|filol[oó]gico|ecd[oó]tica|cr[ií]tica\s+textual|variantes?\s+textuales|rito\s+palestinense|rito\s+babil[oó]nico|amram\s+ga[oó]n|saadia\s+ga[oó]n|esdras|segundo\s+templo|[eé]poca\s+(?:tana[ií]tica|amoraica|ge[oó]nica|medieval)|sot[aá]h?\s+40a|majzor\s+vitry|heinemann|elbogen|fleischer|zuntz)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  const isPureHalelOrHalakhaWithoutHistoricalRequest =
    (halakhicValidation.isPurelyHalakhic ||
      /(?<![a-záéíóúñ])(halel|hallel|halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|shulj[aá]n\s+aruj|mishn[aá]\s+berur[aá]|minhag|minhaguim|mi\s+jag|oraj\s+jaim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|mejaber|ram[aá]|rem[aá]|costumbres?|cumplimiento)(?![a-záéíóúñ])/i.test(
        cleanQuery
      )) &&
    !hasExplicitHistoricalCriticalMarkers;

  if (gateHistorical.score >= 1 && !isPureHalelOrHalakhaWithoutHistoricalRequest) {
    const primary: ResolvedMethodology = 'WISSENSCHAFT_DES_JUDENTUMS';
    return {
      gateId: gateHistorical.rule.gateId,
      gateNumber: gateHistorical.rule.gateNumber,
      gateTitle: gateHistorical.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: gateHistorical.rule.alternative,
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gateHistorical.rule.defaultComplementary
      ),
      matchedKeywords: gateHistorical.matchedKeywords,
      confidence: gateHistorical.score >= 2 ? 'alta' : 'media',
      explanation: gateHistorical.rule.explanationTemplate(gateHistorical.matchedKeywords),
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: true,
      halakhicValidation,
    };
  }

  // Gate 4: Pirkei Avot Tannaitic Maxims (takes precedence when Avot/Tannaim are cited, unless query is explicitly about psychological friction / Salanter Musar)
  const hasExplicitPsychologicalFrictionMarker =
    /(?<![a-záéíóúñ])(fricci[oó]n\s+entre|reacci[oó]n\s+autom[aá]tica|israel\s+salanter|salanter|jeshb[oó]n\s+ha-?n[eé]fesh|contabilidad\s+del\s+alma)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  if (gateAvot.score >= 1 && !hasExplicitPsychologicalFrictionMarker) {
    const primary = gateAvot.rule.methodology;
    return {
      gateId: gateAvot.rule.gateId,
      gateNumber: gateAvot.rule.gateNumber,
      gateTitle: gateAvot.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: gateAvot.rule.alternative,
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gateAvot.rule.defaultComplementary
      ),
      matchedKeywords: gateAvot.matchedKeywords,
      confidence: 'alta',
      explanation: gateAvot.rule.explanationTemplate(gateAvot.matchedKeywords),
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Gate 5 & Gate 6: Virtues, Character Traits & Personal Growth -> MESILAT_YESHARIM_SISTEMATICO or MUSAR_TRANSFORMATIVO
  if (gateVirtues.score > 0 || gateMusar.score > 0) {
    const hasExplicitMesilatMarker =
      /(?<![a-záéíóúñ])(mesilat|mesillat|ramjal|luzzatto|mahut|derej\s+kinyan[oó]|mafsidayv|pelda[ñn]o|escalera\s+de\s+pinj[aá]s|virtud|virtudes|zerizut|zehirut|nekiyut|perishut|tahar[aá])(?![a-záéíóúñ])/i.test(
        cleanQuery
      );

    const useMesilat =
      !hasExplicitPsychologicalFrictionMarker &&
      (hasExplicitMesilatMarker ||
        (gateVirtues.score > 0 && gateMusar.score === 0) ||
        gateVirtues.score > gateMusar.score);

    const winner = useMesilat ? gateVirtues : gateMusar;
    const combinedVirtueKeywords = Array.from(
      new Set([
        ...winner.matchedKeywords,
        ...(useMesilat ? gateMusar.matchedKeywords : gateVirtues.matchedKeywords),
      ])
    );

    const primary = winner.rule.methodology;
    return {
      gateId: winner.rule.gateId,
      gateNumber: winner.rule.gateNumber,
      gateTitle: winner.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: winner.rule.alternative,
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        winner.rule.defaultComplementary
      ),
      matchedKeywords: combinedVirtueKeywords,
      confidence: combinedVirtueKeywords.length >= 2 ? 'alta' : 'media',
      explanation: winner.rule.explanationTemplate(combinedVirtueKeywords),
      isVirtueOrCharacterTrait: true,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Gate 4 fallback if Avot matched alongside friction marker
  if (gateAvot.score >= 1) {
    const primary = gateAvot.rule.methodology;
    return {
      gateId: gateAvot.rule.gateId,
      gateNumber: gateAvot.rule.gateNumber,
      gateTitle: gateAvot.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: gateAvot.rule.alternative,
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gateAvot.rule.defaultComplementary
      ),
      matchedKeywords: gateAvot.matchedKeywords,
      confidence: 'alta',
      explanation: gateAvot.rule.explanationTemplate(gateAvot.matchedKeywords),
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Gate 2 fallback if single evolution keyword matched
  if (gateEvolution.score >= 1) {
    const primary = gateEvolution.rule.methodology;
    return {
      gateId: gateEvolution.rule.gateId,
      gateNumber: gateEvolution.rule.gateNumber,
      gateTitle: gateEvolution.rule.gateTitle,
      enforcedMethodology: primary,
      alternativeMethodology: 'PARDES',
      recommendedComplementary: computeComplementaryList(
        primary,
        evaluations,
        gateEvolution.rule.defaultComplementary
      ),
      matchedKeywords: gateEvolution.matchedKeywords,
      confidence: 'media',
      explanation: gateEvolution.rule.explanationTemplate(gateEvolution.matchedKeywords),
      isVirtueOrCharacterTrait: false,
      isHistoricalConcept: false,
      halakhicValidation,
    };
  }

  // Gate 7: Default Biblical / Halakhic / Liturgical / Exegetical PARDES
  return {
    gateId: 'GATE_7_BIBLICAL_PARDES_DEFAULT',
    gateNumber: 7,
    gateTitle: 'Compuerta 7 · Exégesis Bíblica, Halájica y Teológica en 4 Niveles (PARDÉS)',
    enforcedMethodology: 'PARDES',
    alternativeMethodology: isPureHalelOrHalakhaWithoutHistoricalRequest
      ? 'WISSENSCHAFT_DES_JUDENTUMS'
      : 'MESILAT_YESHARIM_SISTEMATICO',
    recommendedComplementary: isPureHalelOrHalakhaWithoutHistoricalRequest
      ? ['WISSENSCHAFT_DES_JUDENTUMS', 'EVOLUCION_CONCEPTUAL']
      : ['MESILAT_YESHARIM_SISTEMATICO', 'MUSAR_TRANSFORMATIVO'],
    matchedKeywords:
      halakhicValidation.isPurelyHalakhic && halakhicValidation.matchedHalakhicTerms.length > 0
        ? halakhicValidation.matchedHalakhicTerms
        : isPureHalelOrHalakhaWithoutHistoricalRequest
        ? ['Halajá, Shulján Aruj, Minhag y Núsaj (Mejaber vs. Ramá)']
        : ['Pasaje bíblico / Exégesis general'],
    confidence: isPureHalelOrHalakhaWithoutHistoricalRequest ? 'alta' : 'base',
    explanation: halakhicValidation.isPurelyHalakhic
      ? halakhicValidation.validatorSummary
      : isPureHalelOrHalakhaWithoutHistoricalRequest
      ? 'Consulta sobre leyes (Halajá), cumplimiento, Shulján Aruj y matices de Minhag y Núsaj dentro del judaísmo: se aplica PARDÉS (con codificación del Shulján Aruj y glosas del Ramá en Pshat y Drash) e historia de ritos/costumbres como aporte complementario.'
      : 'Consulta exegética o teológica general: se aplica la estructura clásica PARDÉS (Pshat, Rémez, Drash y Sod).',
    isVirtueOrCharacterTrait: false,
    isHistoricalConcept: false,
    halakhicValidation,
  };
}

/**
 * Pipeline resolver: automatically configures the internal methodology and any complementary
 * methodologies according to the selected lesson duration ('5_MIN', '10_MIN', '30_MIN').
 */
export function resolvePipelineMethodology(
  query: string,
  requestedMethodology?: DerashaMethodology,
  duracion: DerashaDuration = '10_MIN',
  userComplementary?: DerashaMethodology[]
): {
  resolvedMethodology: ResolvedMethodology;
  complementaryMethodologies: ResolvedMethodology[];
  evaluation: LogicGateEvaluation;
} {
  const evaluation = evaluateMethodologyLogicGates(query);
  const isComparativeQuery =
    Boolean(evaluation.externalThinkerDetection?.detected) ||
    evaluation.gateId === 'GATE_3_PHILOSOPHICAL_CONTRAST' ||
    requestedMethodology === 'FILOSOFIA_CONTRASTIVA';

  const allowComparative =
    !evaluation.halakhicValidation?.externalPhilosophyInjectionDisabled && isComparativeQuery;

  let primary: ResolvedMethodology;
  if (
    evaluation.externalThinkerDetection?.detected &&
    !evaluation.halakhicValidation?.externalPhilosophyInjectionDisabled
  ) {
    // Hard Pipeline Override: Whenever an external thinker/philosopher (Kant, Platón, Cicerón, etc.) is detected,
    // force FILOSOFIA_CONTRASTIVA so the pipeline guarantees exegetical contrast and Universality vs. Specificity analysis.
    primary = 'FILOSOFIA_CONTRASTIVA';
  } else if (!requestedMethodology || requestedMethodology === 'AUTO') {
    primary = evaluation.enforcedMethodology;
  } else if (requestedMethodology === 'FILOLOGIA_LITURGICA_WISSENSCHAFT') {
    primary = 'WISSENSCHAFT_DES_JUDENTUMS';
  } else if (
    requestedMethodology === 'FILOSOFIA_CONTRASTIVA' &&
    evaluation.halakhicValidation?.externalPhilosophyInjectionDisabled
  ) {
    // Guard against sticky FILOSOFIA_CONTRASTIVA on purely Halakhic/liturgical topics (Rezos, Festividades, Kashrut, Minhag):
    // fall back to the query's natural internal methodology (e.g. PARDES or WISSENSCHAFT_DES_JUDENTUMS).
    primary =
      evaluation.enforcedMethodology === 'FILOSOFIA_CONTRASTIVA'
        ? 'PARDES'
        : evaluation.enforcedMethodology;
  } else if (
    requestedMethodology === 'PARDES' &&
    evaluation.gateId === 'GATE_3_PHILOSOPHICAL_CONTRAST' &&
    !evaluation.halakhicValidation?.externalPhilosophyInjectionDisabled
  ) {
    primary = 'FILOSOFIA_CONTRASTIVA';
  } else {
    primary = requestedMethodology;
  }

  const maxComplementary = duracion === '5_MIN' ? 0 : duracion === '10_MIN' ? 1 : 2;

  if (maxComplementary === 0) {
    return {
      resolvedMethodology: primary,
      complementaryMethodologies: [],
      evaluation,
    };
  }

  // Filter valid user-selected complementary methodologies, excluding sticky FILOSOFIA_CONTRASTIVA when the query is not comparative or is purely Halakhic
  const cleanedUserComp = (userComplementary || [])
    .filter(
      (m): m is ResolvedMethodology =>
        Boolean(
          m &&
            m !== 'AUTO' &&
            m !== primary &&
            (allowComparative || m !== 'FILOSOFIA_CONTRASTIVA')
        )
    )
    .map((m) => (m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT' ? 'WISSENSCHAFT_DES_JUDENTUMS' : m));

  const autoPool = [
    evaluation.enforcedMethodology,
    ...evaluation.recommendedComplementary,
    'PARDES' as ResolvedMethodology,
    'MUSAR_TRANSFORMATIVO' as ResolvedMethodology,
  ].filter((m) => m !== primary && (allowComparative || m !== 'FILOSOFIA_CONTRASTIVA'));

  const mergedComplementary = Array.from(new Set([...cleanedUserComp, ...autoPool])).slice(
    0,
    maxComplementary
  );

  return {
    resolvedMethodology: primary,
    complementaryMethodologies: mergedComplementary,
    evaluation,
  };
}


export interface MorphologyItem {
  hebrewWord: string;
  root: string;
  rootMeaning: string;
  binyan: string;
  tense: string;
  theologicalImplication: string;
}

export interface SefariaRefPrediction {
  ref: string;
  heRef?: string;
  rationale: string;
  category?: 'Tanaj' | 'Mishná' | 'Talmud' | 'Liturgia' | 'Midrash' | 'Halajá';
  exactQuoteHebrew?: string;
}

export interface TheologicalKeys {
  textualParallelism: {
    title: string;
    explanation: string;
    sourceRef: string;
    hebrewQuote?: string;
    connectionToPrayer: string;
  };
  grammaticalDichotomy: {
    title: string;
    explanation: string;
    verbAnalysis: string; // e.g. "Osé (presente continuo) vs Asá / Bará (pasado cerrado)"
    watchmakerRefutation: string; // "Refutación del Dios relojero: renovación constante (Jidush Maasé Bereshit)"
    liturgicalEcho: string; // e.g. "Hamejadesh betubó bejol yom tamid maasé bereshit"
  };
  technicalTerm: {
    title: string;
    explanation: string; // "Maasé Bereshit (Cosmogonía) vs Maasé Merkavá (Mística)"
    mishnaSource: string; // "Mishnah Berakhot 9:2"
    prescribedBlessing: string; // "Baruj... Osé maasé bereshit ante fenómenos naturales"
  };
  kabbalisticArchitecture: {
    title: string;
    explanation: string;
    sefiraConnection: string; // "Bereshit = Sefirá de Jojmá primordial"
    prooftext: string; // "Salmo 104:24 'Kulam bejojmá asita'"
    liturgicalStructure: string; // "Baruj Omer Veosé, Baruj Gozer Umkayem, Baruj Osé Bereshit"
  };
}

export interface ExternalComparativeSource {
  id: string;
  author: string;
  workTitle: string;
  canonicalLocus: string;
  tradition?: string;
  originalLanguage: string;
  originalQuote: string;
  spanishTranslation: string;
  philosophicalThesis: string;
  torahContrastPoint: string;
  sourceUrl: string;
  retrievedVia: string;
}

export interface FormalExegeticalContrast {
  isComparativeStudy: boolean;
  externalThinkerOrTradition: string;
  thesisSummary: string;
  universalidadVsEspecificidad: {
    title: string;
    externalUniversalism: string;
    torahUniversalDimension: string;
    torahCommandmentSpecificity: string;
    exegeticalSynthesis: string;
  };
  fuentesInternasVsExternas: {
    title: string;
    internalTorahSourcesNature: string;
    externalSourcesNature: string;
    normativeLocusContrast: string;
    hermeneuticalRule: string;
  };
}

export interface ExternalThinkerForcedRef {
  ref: string;
  heRef: string;
  category: 'Tanaj' | 'Mishná' | 'Talmud' | 'Midrash' | 'Halajá';
  contrastRole: 'UNIVERSALIDAD_TORAH' | 'ESPECIFICIDAD_MITZVA' | 'TEONOMIA_COSMOVISION';
  roleLabelEs: string;
  rationale: string;
}

export interface ExternalThinkerPipelineDetection {
  detected: boolean;
  thinkerId: string;
  thinkerName: string;
  eraAndTradition: string;
  specificPhilosophicalConcept: string;
  externalPrimaryWorks: string;
  forcedMethodology: 'FILOSOFIA_CONTRASTIVA';
  pipelineActionSummary: string;
  forcedExegeticalSefariaRefs: ExternalThinkerForcedRef[];
  universalityVsSpecificityMatrix: {
    externalConceptUniversalClaim: string;
    torahUniversalHorizon: string;
    torahCommandmentSpecificity: string;
    worldviewContrastSynthesis: string;
  };
}

export type HalakhicDomainCategory =
  | 'LEYES_REZOS_Y_LITURGIA'
  | 'FESTIVIDADES_Y_SHABAT'
  | 'KASHRUT_Y_LEYES_ALIMENTARIAS'
  | 'CODIGOS_MINHAG_Y_SHULJAN_ARUJ'
  | 'CICLO_DE_VIDA_Y_HALAJA_PRACTICA';

export interface HalakhicPipelineValidation {
  isPurelyHalakhic: boolean;
  externalPhilosophyInjectionDisabled: boolean;
  hasExplicitExternalPhilosopherOrReligion: boolean;
  halakhicDomains: HalakhicDomainCategory[];
  halakhicDomainLabels: string[];
  matchedHalakhicTerms: string[];
  recommendedHalakhicSources: string[];
  validatorSummary: string;
  systemPromptGuard: string;
}

export type HalakhicConsultationFocus =
  | 'REZOS'
  | 'FESTIVIDADES'
  | 'KASHRUT'
  | 'CICLO_DE_VIDA'
  | 'HALAJA_GENERAL';

export interface ShulchanArukhDirectQuote {
  id: string;
  ref: string;
  heRef: string;
  simanSeifLabel: string;
  focusBranch: HalakhicConsultationFocus;
  focusBranchLabel: string;
  topicLabel: string;
  briefHebrewQuote: string;
  briefSpanishQuote: string;
  mejaberAndRamaNote?: string;
  sefariaUrl: string;
  verifiedFromSefaria?: boolean;
}

export type HalakhicGenerationEra =
  | 'CHAZAL'
  | 'RISHONIM'
  | 'EARLY_ACHARONIM'
  | 'CLASSIC_ACHARONIM'
  | 'CONTEMPORARY_POSKIM';

export interface MishnatHaDorotQuote {
  id: string;
  sourceShulchanArukhRef: string;
  sourceSimanSeifLabel: string;
  generationEra: HalakhicGenerationEra;
  generationLabel: string;
  periodLabel: string;
  authorityName: string;
  ref: string;
  heRef: string;
  hebrewText: string;
  englishText?: string;
  spanishTranslation: string;
  rulingEvolutionNote?: string;
  sefariaUrl: string;
  verifiedFromSefaria: boolean;
}

export interface HalakhicShulchanArukhConsultation {
  active: boolean;
  consultedBranches: HalakhicConsultationFocus[];
  consultedBranchLabels: string[];
  matchedSubtopics: string[];
  consultedSefariaRefs: string[];
  directQuotes: ShulchanArukhDirectQuote[];
  externalPhilosophyOmitted: boolean;
  moduleSummary: string;
  systemPromptDirective: string;
  mishnatHaDorotQuotes?: MishnatHaDorotQuote[];
  mishnatHaDorotFetchedAt?: string;
}

export interface Phase1AnalysisResult {
  title: string;
  primaryHebrew: string;
  transliteration: string;
  literalSpanishTranslation: string;
  liturgicalContext: string;
  morphologicalBreakdown: MorphologyItem[];
  theologicalKeys?: TheologicalKeys;
  sefariaReferences: SefariaRefPrediction[];
  preVerifiedSources?: VerifiedSefariaSource[];
  externalSources?: ExternalComparativeSource[];
  formalContrast?: FormalExegeticalContrast;
  externalThinkerDetection?: ExternalThinkerPipelineDetection;
  halakhicValidation?: HalakhicPipelineValidation;
  halakhicConsultation?: HalakhicShulchanArukhConsultation;
  detectedMetodologia?: DerashaMethodology;
  metodologiasComplementarias?: DerashaMethodology[];
  duracion?: DerashaDuration;
  tonoHomiletico?: DerashaTone;
  resolvedTone?: ResolvedDerashaTone;
  toneAdvisory?: string;
  logicGateReason?: string;
  stageTimingsMs?: {
    stage1MorphologyMs: number;
    stage2SefariaMs: number;
    externalSourcesMs?: number;
    totalPhase1And2Ms: number;
    cacheHit: boolean;
  };
}

export interface VerifiedSefariaSource {
  ref: string;
  heRef: string;
  hebrewText: string;
  translation: string;
  spanishTranslation?: string;
  versionTitle?: string;
  url: string;
  verified: boolean;
  statusText?: string;
  directConnectionSnippet?: string;
}

export type DerashaMethodology =
  | 'AUTO'
  | 'PARDES'
  | 'WISSENSCHAFT_DES_JUDENTUMS'
  | 'FILOLOGIA_LITURGICA_WISSENSCHAFT'
  | 'EVOLUCION_CONCEPTUAL'
  | 'MESILAT_YESHARIM_SISTEMATICO'
  | 'PIRKE_AVOT_EXEGETICO'
  | 'MUSAR_TRANSFORMATIVO'
  | 'FILOSOFIA_CONTRASTIVA';

export type DerashaDuration = '5_MIN' | '10_MIN' | '30_MIN';

export type DerashaTone =
  | 'AUTO'
  | 'MOTIVACION'
  | 'ADVERTENCIA_CAUTELA'
  | 'LLAMADO_ACCION'
  | 'ASPIRACIONAL'
  | 'ANALITICO_SOBRIO';

export type ResolvedDerashaTone = Exclude<DerashaTone, 'AUTO'>;

export interface CalibratedQueryDecisionMetrics {
  primaryConfidence: number; // 0 to 1
  toneConfidence: number; // 0 to 1
  halakhicProbability: number; // 0.01 to 0.99
  isPurelyHalakhic: boolean;
  externalContrastProbability: number; // 0.01 to 0.99
  requiresExternalContrast: boolean;
  specificityScore: number; // 0 to 3 weighted rubric score
  specificityNormalized: number; // 0 to 100
  specificityLevelLabel: string;
  specificityConfidence: number; // 0 to 1
  needsClarification: boolean;
}

export interface MethodologyCandidateAnalysis {
  methodology: Exclude<DerashaMethodology, 'AUTO'>;
  relevanceScore: number; // 0 to 100 calibrated probability percentage
  calibratedProbability?: number; // 0 to 1 exact calibrated probability
  role: 'primary' | 'complementary' | 'optional';
  whyApplicable: string;
  expectedContribution: string;
  keySourceHint?: string;
}

export interface MethodologyDeliberationResult {
  query: string;
  recommendedPrimary: Exclude<DerashaMethodology, 'AUTO'>;
  recommendedComplementaryFor10Min: Array<Exclude<DerashaMethodology, 'AUTO'>>;
  recommendedComplementaryFor30Min: Array<Exclude<DerashaMethodology, 'AUTO'>>;
  recommendedTone?: ResolvedDerashaTone;
  toneRationale?: string;
  deliberationSummary: string;
  candidates: MethodologyCandidateAnalysis[];
  decisionCalibration?: CalibratedQueryDecisionMetrics;
  deliberationTimeMs?: number;
}

export interface PardesPillar {
  hebrewPillar: string;
  title: string;
  exposition: string;
  keyTakeaway: string;
}

export interface MethodologySectionItem {
  key: string;
  stepNumber: number;
  hebrewBadge: string;
  hebrewTerm: string;
  spanishSubtitle: string;
  title: string;
  exposition: string;
  keyTakeaway: string;
  sourceMethodology?: DerashaMethodology;
}

export interface ContemporaryMasterReading {
  id: string;
  masterId: 'sacks' | 'gordon' | 'soloveitchik' | 'hirsch' | 'leibowitz';
  masterName: string;
  masterTitle: string;
  cycleOrSeries: string;
  perspectiveAngle: string;
  readingTitle: string;
  centralQuestion: string;
  coreThesis: string;
  detailedExposition: string;
  keyQuoteOrConcept: string;
  practicalTakeaway: string;
}

export interface MasterReadingsSynthesis {
  detectedParashaOrTopic: string;
  overview: string;
  readings: ContemporaryMasterReading[];
}

export interface DerashaExecutiveSummaryPillar {
  label: string;
  takeaway: string;
}

export interface DerashaExecutiveSummary {
  headlineThesis: string;
  abstractNarrative: string;
  keyPillars: DerashaExecutiveSummaryPillar[];
  coreSourcesDigest: string[];
  practicalTakeaway: string;
  estimatedReadingSec?: number;
}

export interface FinalDerasha {
  derashaTitle: string;
  openingExordium: string;
  fullStructuredDerashaMarkdown: string;
  executiveSummary?: DerashaExecutiveSummary;
  metodologia?: DerashaMethodology;
  metodologiasComplementarias?: DerashaMethodology[];
  duracion?: DerashaDuration;
  audienciaOTono?: string;
  tonoHomiletico?: DerashaTone;
  resolvedTone?: ResolvedDerashaTone;
  toneAdvisory?: string;
  methodologySections?: MethodologySectionItem[];
  theologicalKeys?: TheologicalKeys;
  morphologicalSynthesis: {
    summary: string;
    keyTheologicalInsight: string;
  };
  canonicalAnalysis: {
    synthesis: string;
    verifiedEchoes: Array<{
      ref: string;
      connection: string;
    }>;
    spanishTranslations?: Array<{
      ref: string;
      spanishTranslation: string;
    }>;
  };
  pardes: {
    pshat: PardesPillar;
    remez: PardesPillar;
    drash: PardesPillar;
    sod: PardesPillar;
  };
  contemporaryMasters?: MasterReadingsSynthesis;
  externalSources?: ExternalComparativeSource[];
  formalContrast?: FormalExegeticalContrast;
  externalThinkerDetection?: ExternalThinkerPipelineDetection;
  halakhicValidation?: HalakhicPipelineValidation;
  halakhicConsultation?: HalakhicShulchanArukhConsultation;
  practicalConclusion: {
    title: string;
    hashkafa: string;
    prayerKavanah: string;
    dailyAction: string;
  };
  stageTimingsMs?: {
    stage3LlmMs: number;
    markdownAssemblyMs: number;
    totalPhase3Ms: number;
    cacheHit: boolean;
  };
}

export interface FollowUpItem {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  suggestedNextQuestions?: string[];
  relatedSefariaReferences?: Array<{ ref: string; rationale: string }>;
}

export interface CalendarAliyah {
  number: number; // 1 to 7, or 8 for Maftir
  label: string; // e.g. "1ª Aliyá (Rishón)", "2ª Aliyá (Shení)", ... "Maftir"
  hebrewLabel: string; // "ראשון", "שני", etc.
  ref: string; // e.g. "Genesis 23:1-23:16"
}

export interface UpcomingLiturgicalEvent {
  id: string;
  titleEn: string;
  titleEs: string;
  titleHe: string;
  date: string; // YYYY-MM-DD
  hdate: string; // Hebrew date string
  daysUntil: number;
  category: 'major' | 'minor' | 'roshchodesh' | 'fast' | 'shabbat' | 'modern';
  categoryLabelEs: string;
  torahReading?: string;
  memoEs: string;
  suggestedDerashaPrompt: string;
  combinedWithParashaPrompt?: string;
}

export interface SuggestedDerashaTopic {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  prompt: string;
}

export interface TorahCalendarData {
  gregorianDate: string; // YYYY-MM-DD
  hebrewDateStr: string; // e.g. "25 de Jeshván 5787"
  hebrewDateHebrew: string; // e.g. "כ״ה בְּחֶשְׁוָן תשפ״ז"
  diaspora: boolean;
  parasha: {
    nameEn: string;
    nameEs: string;
    nameHe: string;
    fullRef: string;
    heRef: string;
    description?: string;
    aliyot: CalendarAliyah[];
  } | null;
  haftarah: {
    displayEn: string;
    displayHe: string;
    ref: string;
  } | null;
  dafYomi?: {
    displayEn: string;
    displayHe: string;
    ref: string;
  } | null;
  dailyMishnah?: {
    displayEn: string;
    displayHe: string;
    ref: string;
  } | null;
  dailyRambam?: {
    displayEn: string;
    displayHe: string;
    ref: string;
  } | null;
  upcomingEvents?: UpcomingLiturgicalEvent[];
  suggestedTopics?: SuggestedDerashaTopic[];
}

export interface MesilatYesharimShot {
  id: string;
  chapter: number;
  paragraph: number;
  sefariaRef: string; // e.g. "Mesillat Yesharim 2:1"
  sefariaHeRef: string; // e.g. "מסילת ישרים ב׳:א׳"
  sefariaUrl: string;
  middahNameEs: string; // e.g. "Zehirut / Cuidado y Vigilancia Espiritual"
  middahNameHe: string; // e.g. "מִדַּת הַזְּהִירוּת"
  ladderStepNumber: number; // 1 to 10 on the Ladder of Pinchas ben Yair
  hebrewExcerpt: string; // Real Hebrew text from Sefaria v3
  englishExcerpt: string; // Real English translation from Sefaria v3
  spanishTranslation: string; // Faithful Spanish translation of the Ramchal's paragraph
  briefDefinition: string; // Definición breve según el Ramjal
  commonObstacle: string; // Obstáculo común en la vida cotidiana
  dailyAction: string; // Microejercicio práctico (Acción del día)
  chabadOrAishInsight: string; // Adaptación contemporánea estilo Chabad.org / Aish Latino
}

export type PipelineStage = 'idle' | 'phase1_morphology' | 'phase2_sefaria' | 'phase3_derasha' | 'complete' | 'error';

export type DerashaRelationType = 'RELACION' | 'CONTRADICCION' | 'COMPLEMENTO' | 'INTEGRAL';

export interface ArchivedDerashaEntry {
  id: string;
  sequenceNumber: number;
  title: string;
  query: string;
  methodology: DerashaMethodology;
  complementaryMethodologies?: DerashaMethodology[];
  duration: DerashaDuration;
  audienceOrTone: string;
  centralIdea: string;
  essaySummary: string;
  sourcesSummary: string;
  createdAt: string;
  updatedAt: string;
  phase1Data?: Phase1AnalysisResult;
  verifiedSources?: VerifiedSefariaSource[];
  finalDerasha?: FinalDerasha;
  followUps?: FollowUpItem[];
}

export interface ComparativeDerashaAnalysisResult {
  id: string;
  comparedNumbers: number[];
  comparedTitles: string[];
  relationType: DerashaRelationType;
  userHypothesis: string;
  synthesisTitle: string;
  executiveVerdict: string;
  perDerashaCoreThesis: Array<{
    sequenceNumber: number;
    title: string;
    coreThesis: string;
    keySource: string;
    normativeOrPhilosophicalAngle: string;
  }>;
  pointsOfRelationship: string;
  pointsOfContradictionOrTension: string;
  pointsOfComplementarity: string;
  dialecticalSynthesisAndHomileticBridge: string;
  canonicalBridgeSources: Array<{
    ref: string;
    rationale: string;
  }>;
  suggestedFollowUpQuestions: string[];
  createdAt: string;
}

export interface ActiveStudySnapshot {
  query: string;
  metodologia: DerashaMethodology;
  duracion: DerashaDuration;
  metodologiasComplementarias: DerashaMethodology[];
  audienciaOTono: string;
  tonoHomiletico?: DerashaTone;
  phase1Data: Phase1AnalysisResult;
  verifiedSources: VerifiedSefariaSource[];
  finalDerasha: FinalDerasha;
  followUps: FollowUpItem[];
  savedAt: string;
}

export interface SystemSafePointSnapshot {
  id: string;
  label: string;
  description: string;
  triggerType: 'baseline' | 'manual' | 'auto' | 'emergency';
  isPinnedBaseline?: boolean;
  createdAt: string;
  checksum: string;
  version: string;
  stats: {
    archiveCount: number;
    comparativeCount: number;
    hasActiveStudy: boolean;
    activeStudyTitle?: string;
  };
  payload: {
    archive: ArchivedDerashaEntry[];
    comparativeStudies: ComparativeDerashaAnalysisResult[];
    activeStudy: ActiveStudySnapshot | null;
  };
}



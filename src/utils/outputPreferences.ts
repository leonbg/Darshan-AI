import {
  ConclusionLength,
  DerashaOutputPreferences,
  PardesAnalysisDepth,
  PardesLevelKey,
} from '../types';

export const PARDES_LEVEL_ORDER: PardesLevelKey[] = ['pshat', 'remez', 'drash', 'sod'];

export const PARDES_LEVEL_META: Record<
  PardesLevelKey,
  {
    key: PardesLevelKey;
    label: string;
    hebrewLabel: string;
    hebrewLetter: string;
    focusDescription: string;
    accentText: string;
    activeBorder: string;
  }
> = {
  pshat: {
    key: 'pshat',
    label: 'Pshat',
    hebrewLabel: 'פְּשָׁט',
    hebrewLetter: 'פ',
    focusDescription: 'Sentido literal, sintaxis bíblica y contexto histórico (Rashi, Ibn Ezra, Rashbam).',
    accentText: 'text-emerald-300',
    activeBorder: 'border-emerald-500/45 bg-emerald-950/20',
  },
  remez: {
    key: 'remez',
    label: 'Rémez',
    hebrewLabel: 'רֶמֶז',
    hebrewLetter: 'ר',
    focusDescription: 'Alusión filosófica, paralelismos intertextuales y estructura conceptual.',
    accentText: 'text-indigo-300',
    activeBorder: 'border-indigo-500/45 bg-indigo-950/20',
  },
  drash: {
    key: 'drash',
    label: 'Drash',
    hebrewLabel: 'דְּרַשׁ',
    hebrewLetter: 'ד',
    focusDescription: 'Exégesis homilética, Talmud, Midrash Rabá y enseñanza ética de Jazal.',
    accentText: 'text-amber-300',
    activeBorder: 'border-amber-500/45 bg-amber-950/20',
  },
  sod: {
    key: 'sod',
    label: 'Sod',
    hebrewLabel: 'סוֹד',
    hebrewLetter: 'ס',
    focusDescription: 'Dimensión interior del alma, Zóhar, Sefirot y pensamiento jasídico.',
    accentText: 'text-sky-300',
    activeBorder: 'border-sky-500/45 bg-sky-950/20',
  },
};

export const PARDES_DEPTH_OPTIONS: Array<{
  id: PardesAnalysisDepth;
  label: string;
  wordGuidance: string;
  shortHint: string;
}> = [
  {
    id: 'breve',
    label: 'Breve',
    wordGuidance: '1 párrafo conciso y directo (~70–110 palabras), con cita esencial sin rodeos',
    shortHint: '1 párrafo directo',
  },
  {
    id: 'estandar',
    label: 'Estándar',
    wordGuidance: '2 a 3 párrafos bien desarrollados (~150–230 palabras) con citas y comentaristas clásicos',
    shortHint: '2–3 párrafos',
  },
  {
    id: 'profundo',
    label: 'Profundo',
    wordGuidance: '3 a 5 párrafos exhaustivos (~280–420 palabras) con múltiples comentaristas, términos hebreos y matices dialécticos',
    shortHint: '3–5 párrafos',
  },
];

export const CONCLUSION_LENGTH_OPTIONS: Array<{
  id: ConclusionLength;
  label: string;
  shortHint: string;
  guidance: string;
}> = [
  {
    id: 'concisa',
    label: 'Concisa',
    shortHint: '1–2 oraciones por bloque',
    guidance:
      'Redactar cada subsección (hashkafa, prayerKavanah, dailyAction) en 1 a 2 oraciones directas, claras y memorables (~75–110 palabras en total).',
  },
  {
    id: 'estandar',
    label: 'Estándar',
    shortHint: '2–3 oraciones equilibradas',
    guidance:
      'Redactar cada subsección (hashkafa, prayerKavanah, dailyAction) en 2 a 3 oraciones equilibradas que integren cosmovisión, tefilá y conducta (~140–210 palabras en total).',
  },
  {
    id: 'detallada',
    label: 'Detallada',
    shortHint: '3–5 oraciones y pasos prácticos',
    guidance:
      'Redactar una conclusión amplia y transformadora con 3 a 5 oraciones ricas por subsección (hashkafa, prayerKavanah, dailyAction), incluyendo pasos concretos para la semana y el Shabat (~260–380 palabras en total).',
  },
];

export const DEFAULT_DERASHA_OUTPUT_PREFERENCES: DerashaOutputPreferences = {
  pardesDepth: {
    pshat: 'estandar',
    remez: 'estandar',
    drash: 'estandar',
    sod: 'estandar',
  },
  prioritizedLevels: [],
  conclusionLength: 'estandar',
};

function isValidDepth(val: any): val is PardesAnalysisDepth {
  return val === 'breve' || val === 'estandar' || val === 'profundo';
}

function isValidLevel(val: any): val is PardesLevelKey {
  return val === 'pshat' || val === 'remez' || val === 'drash' || val === 'sod';
}

function isValidConclusionLength(val: any): val is ConclusionLength {
  return val === 'concisa' || val === 'estandar' || val === 'detallada';
}

export function normalizeDerashaOutputPreferences(
  raw?: Partial<DerashaOutputPreferences> | null
): DerashaOutputPreferences {
  const depthInput: Partial<Record<PardesLevelKey, PardesAnalysisDepth>> =
    raw && typeof raw.pardesDepth === 'object' && raw.pardesDepth ? raw.pardesDepth : {};

  const pardesDepth: Record<PardesLevelKey, PardesAnalysisDepth> = {
    pshat: isValidDepth(depthInput.pshat) ? depthInput.pshat : 'estandar',
    remez: isValidDepth(depthInput.remez) ? depthInput.remez : 'estandar',
    drash: isValidDepth(depthInput.drash) ? depthInput.drash : 'estandar',
    sod: isValidDepth(depthInput.sod) ? depthInput.sod : 'estandar',
  };

  const seenLevels = new Set<PardesLevelKey>();
  const prioritizedLevels: PardesLevelKey[] = [];
  if (Array.isArray(raw?.prioritizedLevels)) {
    for (const lvl of raw.prioritizedLevels) {
      if (isValidLevel(lvl) && !seenLevels.has(lvl)) {
        seenLevels.add(lvl);
        prioritizedLevels.push(lvl);
      }
    }
  }
  // Keep canonical PARDES order so keys and prompts remain deterministic
  const orderedPriority = PARDES_LEVEL_ORDER.filter((lvl) => prioritizedLevels.includes(lvl));

  const conclusionLength: ConclusionLength = isValidConclusionLength(raw?.conclusionLength)
    ? raw.conclusionLength
    : 'estandar';

  return {
    pardesDepth,
    prioritizedLevels: orderedPriority,
    conclusionLength,
  };
}

export function areOutputPreferencesEqual(
  a?: Partial<DerashaOutputPreferences> | null,
  b?: Partial<DerashaOutputPreferences> | null
): boolean {
  const na = normalizeDerashaOutputPreferences(a);
  const nb = normalizeDerashaOutputPreferences(b);
  return (
    na.conclusionLength === nb.conclusionLength &&
    na.pardesDepth.pshat === nb.pardesDepth.pshat &&
    na.pardesDepth.remez === nb.pardesDepth.remez &&
    na.pardesDepth.drash === nb.pardesDepth.drash &&
    na.pardesDepth.sod === nb.pardesDepth.sod &&
    na.prioritizedLevels.length === nb.prioritizedLevels.length &&
    na.prioritizedLevels.every((lvl, idx) => lvl === nb.prioritizedLevels[idx])
  );
}

export function hasCustomOutputPreferences(
  prefs?: Partial<DerashaOutputPreferences> | null
): boolean {
  return !areOutputPreferencesEqual(prefs, DEFAULT_DERASHA_OUTPUT_PREFERENCES);
}

export function serializeOutputPreferencesKey(
  prefs?: Partial<DerashaOutputPreferences> | null
): string {
  const n = normalizeDerashaOutputPreferences(prefs);
  return [
    `p=${n.pardesDepth.pshat}`,
    `r=${n.pardesDepth.remez}`,
    `d=${n.pardesDepth.drash}`,
    `s=${n.pardesDepth.sod}`,
    `prio=${n.prioritizedLevels.join('+') || 'none'}`,
    `conc=${n.conclusionLength}`,
  ].join(';');
}

export function summarizeOutputPreferencesEs(
  prefs?: Partial<DerashaOutputPreferences> | null
): string {
  const n = normalizeDerashaOutputPreferences(prefs);
  const parts: string[] = [];

  if (n.prioritizedLevels.length > 0) {
    const names = n.prioritizedLevels.map((lvl) => PARDES_LEVEL_META[lvl].label).join(', ');
    parts.push(`Prioridad: ${names}`);
  }

  const customDepths = PARDES_LEVEL_ORDER.filter((lvl) => n.pardesDepth[lvl] !== 'estandar');
  if (customDepths.length > 0) {
    if (customDepths.length === 4 && new Set(customDepths.map((l) => n.pardesDepth[l])).size === 1) {
      const uniform = PARDES_DEPTH_OPTIONS.find((d) => d.id === n.pardesDepth.pshat)?.label;
      parts.push(`PARDÉS: ${uniform}`);
    } else {
      const summary = customDepths
        .map(
          (lvl) =>
            `${PARDES_LEVEL_META[lvl].label} (${
              PARDES_DEPTH_OPTIONS.find((d) => d.id === n.pardesDepth[lvl])?.label ||
              n.pardesDepth[lvl]
            })`
        )
        .join(' · ');
      parts.push(summary);
    }
  }

  if (n.conclusionLength !== 'estandar') {
    const concLabel =
      CONCLUSION_LENGTH_OPTIONS.find((c) => c.id === n.conclusionLength)?.label ||
      n.conclusionLength;
    parts.push(`Conclusión ${concLabel}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Salida estándar';
}

export function getDepthLabelEs(depth: PardesAnalysisDepth): string {
  return PARDES_DEPTH_OPTIONS.find((d) => d.id === depth)?.label || 'Estándar';
}

export function getConclusionLengthLabelEs(length: ConclusionLength): string {
  return CONCLUSION_LENGTH_OPTIONS.find((c) => c.id === length)?.label || 'Estándar';
}

export function buildOutputPreferencesPromptDirectives(
  rawPrefs?: Partial<DerashaOutputPreferences> | null,
  metodologia = 'PARDES'
): string {
  const prefs = normalizeDerashaOutputPreferences(rawPrefs);
  const isCustom = hasCustomOutputPreferences(prefs);
  const concMeta =
    CONCLUSION_LENGTH_OPTIONS.find((c) => c.id === prefs.conclusionLength) ||
    CONCLUSION_LENGTH_OPTIONS[1];

  const depthLines = PARDES_LEVEL_ORDER.map((lvl) => {
    const meta = PARDES_LEVEL_META[lvl];
    const depth = prefs.pardesDepth[lvl];
    const depthMeta =
      PARDES_DEPTH_OPTIONS.find((d) => d.id === depth) || PARDES_DEPTH_OPTIONS[1];
    const isPrioritized = prefs.prioritizedLevels.includes(lvl);
    return `  - **${meta.label} (${meta.hebrewLabel})** — Profundidad: **${depthMeta.label.toUpperCase()}**${
      isPrioritized ? ' · [NIVEL PRIORITARIO DEL ESTUDIANTE]' : ''
    }: ${depthMeta.wordGuidance}.${
      isPrioritized
        ? ' Al estar marcado como PRIORITARIO, otórgale mayor peso analítico (~1.5x más detalle que los niveles no prioritarios), cita explícitamente comentaristas primarios de este estrato y formula un keyTakeaway especialmente agudo.'
        : ''
    }`;
  }).join('\n');

  const priorityDirective =
    prefs.prioritizedLevels.length > 0
      ? `\n- PRIORIZACIÓN EXEGÉTICA EXPLÍCITA: El estudiante ha marcado como prioritarios los niveles **${prefs.prioritizedLevels
          .map((l) => `${PARDES_LEVEL_META[l].label} (${PARDES_LEVEL_META[l].hebrewLabel})`)
          .join(', ')}**. Mantén presentes los cuatro estratos para conservar el equilibrio rabínico, pero concentra el centro de gravedad discursivo, la densidad de fuentes verificadas de Sefaria y las aplicaciones prácticas en los niveles priorizados.${
          metodologia !== 'PARDES'
            ? ` Aunque la metodología estructural principal sea "${metodologia}", asegúrate de entrelazar explícitamente estos pesos de profundidad y prioridad PARDÉS dentro de tus secciones metodológicas y en la articulación hermenéutica.`
            : ''
        }`
      : metodologia !== 'PARDES' && isCustom
      ? `\n- INTEGRACIÓN PARDÉS EN "${metodologia}": Respeta las profundidades solicitadas para Pshat, Rémez, Drash y Sod al dosificar cuánto análisis literal, alusivo, midráshico o místico incorporas en las secciones de "${metodologia}".`
      : '';

  return `PREFERENCIAS DE PERSONALIZACIÓN DE SALIDA (PARDÉS Y CONCLUSIÓN FINAL):
- CONFIGURACIÓN DE PROFUNDIDAD POR NIVEL PARDÉS:
${depthLines}${priorityDirective}
- EXTENSIÓN DE LA CONCLUSIÓN FINAL ('practicalConclusion'): **${concMeta.label.toUpperCase()}** (${concMeta.shortHint}).
  * Directriz obligatoria para 'practicalConclusion': ${concMeta.guidance}`;
}

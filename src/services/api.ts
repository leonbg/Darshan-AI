import {
  Phase1AnalysisResult,
  FinalDerasha,
  VerifiedSefariaSource,
  MasterReadingsSynthesis,
  TorahCalendarData,
  MesilatYesharimShot,
  UpcomingLiturgicalEvent,
  SuggestedDerashaTopic,
  DerashaMethodology,
  DerashaDuration,
  DerashaTone,
  MethodologyDeliberationResult,
  YouTubeVisualAnalysisResult,
  YouTubeVisualStyle,
  YouTubeOutputMode,
  YouTubeAspectRatio,
  YouTubeImageQualityTier,
  YouTubeGeneratedVideoClip,
} from '../types';
import {
  buildClientMethodologyDeliberationFallback,
  buildClientPhase1Fallback,
  buildClientPhase3DerashaFallback,
} from './pipelineFallbackEngine';

export interface HealthStatus {
  status: string;
  timestamp: string;
}

const FORBIDDEN_NT_BOOKS_REGEX =
  /\b(Juan|Mateo|Marcos|Lucas|Hechos|Romanos|1\s*Corintios|2\s*Corintios|Corintios|G[áa]latas|Efesios|Filipenses|Colosenses|Tesalonicenses|Timoteo|Tito|Filem[óo]n|Hebreos|Santiago|1\s*Pedro|2\s*Pedro|Apocalipsis|John|Matthew|Mark|Luke|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Hebrews|Revelation)\s+\d+:\d+(?:-\d+)?/gi;

function sanitizeStrictJewishText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text.replace(
    /["«][^"»]*["»]\s*\(\s*(?:Juan|Mateo|Marcos|Lucas|John|Matthew|Mark|Luke)\s+\d+:\d+[^)]*\)/gi,
    '«No juzgará según la vista de sus ojos» (Isaías 11:3; I Samuel 16:7; Talmud Bavli Sanhedrín 6b)'
  );
  cleaned = cleaned.replace(FORBIDDEN_NT_BOOKS_REGEX, 'I Samuel 16:7 / Sanhedrín 6b');
  return cleaned;
}

function sanitizeStrictJewishObject<T>(obj: T): T {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return sanitizeStrictJewishText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => {
        if (item && typeof item === 'object' && typeof item.ref === 'string') {
          return !FORBIDDEN_NT_BOOKS_REGEX.test(item.ref);
        }
        return true;
      })
      .map((item) => sanitizeStrictJewishObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      out[k] = sanitizeStrictJewishObject(v);
    }
    return out as T;
  }
  return obj;
}

export class LongWaitTimeoutError extends Error {
  constructor(
    message = 'No hay respuestas disponibles de momento (el tiempo de espera ha superado el límite). Por favor solicita una aclaración o acota tu consulta.'
  ) {
    super(message);
    this.name = 'LongWaitTimeoutError';
  }
}

class HtmlFallbackResponseError extends Error {
  constructor(endpointLabel: string) {
    super(
      `No hay respuestas disponibles de momento en ${endpointLabel} (el servidor se está actualizando). Intenta nuevamente en unos segundos.`
    );
    this.name = 'HtmlFallbackResponseError';
  }
}

export function resolveApiUrl(endpointPath: string): string {
  if (/^https?:\/\//i.test(endpointPath)) return endpointPath;
  return endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
}

/**
 * Fetches JSON from a backend route with automatic retry if the container/server
 * is waking up and temporarily returns HTML or 502/503/504, bounded by a strict timeout.
 */
async function fetchServerJsonWithRetry<T>(
  url: string,
  options: RequestInit,
  endpointLabel: string,
  maxAttempts = 4,
  timeoutMs = 300000
): Promise<T> {
  let lastErr: any = null;
  const resolvedUrl = resolveApiUrl(url);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resolvedUrl, {
        ...options,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timer);

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      const trimmed = rawText.trim();

      const isHtml =
        contentType.includes('text/html') ||
        trimmed.startsWith('<!doctype') ||
        trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<html');

      if (isHtml) {
        lastErr = new HtmlFallbackResponseError(endpointLabel);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
          continue;
        }
        throw new LongWaitTimeoutError(lastErr.message);
      }

      if (!response.ok) {
        if (
          (response.status === 502 || response.status === 503 || response.status === 504) &&
          attempt < maxAttempts
        ) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
          continue;
        }
        let errMsg = `No hay respuestas disponibles de momento (${response.status}) en ${endpointLabel}`;
        if (trimmed.startsWith('{')) {
          try {
            const parsedErr = JSON.parse(trimmed);
            if (parsedErr?.error) errMsg = parsedErr.error;
          } catch {
            // ignore
          }
        }
        if (
          errMsg.includes('tiempo de espera') ||
          errMsg.includes('No hay respuestas disponibles de momento')
        ) {
          throw new LongWaitTimeoutError(errMsg);
        }
        throw new Error(errMsg);
      }

      return JSON.parse(trimmed) as T;
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === 'AbortError' || err instanceof LongWaitTimeoutError) {
        throw new LongWaitTimeoutError(
          err?.message && err?.name === 'LongWaitTimeoutError'
            ? err.message
            : 'No hay respuestas disponibles de momento (tiempo de espera agotado). Por favor aclara o acota tu consulta.'
        );
      }
      lastErr = err;
      if (err instanceof HtmlFallbackResponseError && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
        continue;
      }
      if (attempt >= maxAttempts) {
        throw lastErr;
      }
    }
  }

  throw (
    lastErr ||
    new LongWaitTimeoutError(`No hay respuestas disponibles de momento en ${endpointLabel}`)
  );
}

export async function checkServerHealth(): Promise<HealthStatus> {
  try {
    const data = await fetchServerJsonWithRetry<HealthStatus>(
      '/api/health',
      { headers: { Accept: 'application/json' } },
      '/api/health',
      2,
      8000
    );
    return data;
  } catch {
    return {
      status: 'initializing',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function requestDecideMethodology(
  query: string,
  signal?: AbortSignal
): Promise<MethodologyDeliberationResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const res = await fetchServerJsonWithRetry<MethodologyDeliberationResult>(
      '/api/decide-methodology',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, tema_o_fuente: query }),
        signal,
      },
      '/api/decide-methodology',
      1,
      60000
    );
    return sanitizeStrictJewishObject(res);
  } catch (err: any) {
    if (signal?.aborted) throw err;
    return sanitizeStrictJewishObject(buildClientMethodologyDeliberationFallback(query));
  }
}

export async function requestPhase1Analysis(
  query: string,
  options?: {
    metodologia?: DerashaMethodology;
    metodologias_complementarias?: DerashaMethodology[];
    duracion?: DerashaDuration;
    audiencia_o_tono?: string;
    tono_homiletico?: DerashaTone;
  }
): Promise<Phase1AnalysisResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const res = await fetchServerJsonWithRetry<Phase1AnalysisResult>(
      '/api/analyze-roots',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          tema_o_fuente: query,
          metodologia: options?.metodologia || 'PARDES',
          metodologias_complementarias: options?.metodologias_complementarias || [],
          duracion: options?.duracion || '10_MIN',
          audiencia_o_tono: options?.audiencia_o_tono || 'Comunidad general · Inspirador y práctico',
          ...(options?.tono_homiletico ? { tono_homiletico: options.tono_homiletico } : {}),
        }),
      },
      '/api/analyze-roots',
      4,
      240000
    );
    return sanitizeStrictJewishObject(res);
  } catch {
    return sanitizeStrictJewishObject(
      buildClientPhase1Fallback(query, {
        metodologia: options?.metodologia,
        metodologias_complementarias: options?.metodologias_complementarias,
        duracion: options?.duracion,
        tono_homiletico: options?.tono_homiletico,
      })
    );
  }
}

export async function requestPhase3Derasha(payload: {
  query: string;
  tema_o_fuente?: string;
  metodologia?: DerashaMethodology;
  metodologias_complementarias?: DerashaMethodology[];
  duracion?: DerashaDuration;
  audiencia_o_tono?: string;
  tono_homiletico?: DerashaTone;
  title: string;
  primaryHebrew: string;
  transliteration: string;
  literalSpanishTranslation: string;
  liturgicalContext: string;
  theologicalKeys?: any;
  morphologicalBreakdown: any[];
  verifiedSources: VerifiedSefariaSource[];
  externalSources?: any[];
  formalContrast?: any;
}): Promise<FinalDerasha> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const res = await fetchServerJsonWithRetry<FinalDerasha>(
      '/api/generate-derasha',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      '/api/generate-derasha',
      4,
      600000
    );
    return sanitizeStrictJewishObject(res);
  } catch {
    return sanitizeStrictJewishObject(buildClientPhase3DerashaFallback(payload));
  }
}

export async function requestExpandDerasha(payload: {
  question: string;
  derashaContext: any;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<{
  answer: string;
  suggestedNextQuestions: string[];
  relatedSefariaReferences?: Array<{ ref: string; rationale: string }>;
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const res = await fetchServerJsonWithRetry<{
    answer: string;
    suggestedNextQuestions: string[];
    relatedSefariaReferences?: Array<{ ref: string; rationale: string }>;
  }>(
    '/api/expand-derasha',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    '/api/expand-derasha',
    3,
    240000
  );
  return sanitizeStrictJewishObject(res);
}

export async function requestTranslateSource(payload: {
  ref: string;
  hebrewText: string;
  englishText?: string;
}): Promise<{ ref: string; spanishTranslation: string; notes?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  return await fetchServerJsonWithRetry(
    '/api/translate-source',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    '/api/translate-source',
    3,
    240000
  );
}

export async function requestTranslateSourcesBatch(
  sources: Array<{ ref: string; hebrewText: string; englishText?: string }>
): Promise<Array<{ ref: string; spanishTranslation: string; notes?: string }>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const res = await fetchServerJsonWithRetry<{
    translations: Array<{ ref: string; spanishTranslation: string; notes?: string }>;
  }>(
    '/api/translate-source',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ sources }),
    },
    '/api/translate-source',
    3,
    240000
  );
  return res.translations || [];
}

export async function requestMasterReadings(payload: {
  query: string;
  title?: string;
  primaryHebrew?: string;
  verifiedSources?: VerifiedSefariaSource[];
  focusMaster?: 'all' | 'sacks' | 'gordon' | 'soloveitchik' | 'hirsch';
  specificAngle?: string;
}): Promise<MasterReadingsSynthesis> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const res = await fetchServerJsonWithRetry<MasterReadingsSynthesis>(
    '/api/master-readings',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    '/api/master-readings',
    3,
    240000
  );
  return sanitizeStrictJewishObject(res);
}

// ============================================================================
// Client-Side Direct Fallback for Torah Calendar (Sefaria + Hebcal CORS APIs)
// ============================================================================

const PARASHA_SPANISH_MAP_CLIENT: Record<string, string> = {
  Bereshit: 'Bereshit (En el principio)',
  Noach: 'Nóaj (Noé)',
  'Lech-Lecha': 'Lej Lejá (Vete para ti)',
  Vayera: 'Vayerá (Y apareció)',
  'Chayei Sara': 'Jayei Sará (La vida de Sará)',
  Toldot: 'Toldot (Generaciones)',
  Vayetzei: 'Vayetze (Y salió)',
  Vayishlach: 'Vayishlaj (Y envió)',
  Vayeshev: 'Vayéshev (Y habitó)',
  Miketz: 'Miketz (Al cabo de)',
  Vayigash: 'Vayigash (Y se acercó)',
  Vayechi: 'Vayejí (Y vivió)',
  Shemot: 'Shemot (Nombres)',
  Vaera: 'Vaerá (Y me aparecí)',
  Bo: 'Bo (Ven)',
  Beshalach: 'Beshalaj (Cuando envió)',
  Yitro: 'Yitró (Jetro)',
  Mishpatim: 'Mishpatim (Leyes)',
  Terumah: 'Terumá (Ofrenda)',
  Tetzaveh: 'Tetzavé (Y ordenarás)',
  'Ki Tisa': 'Ki Tisá (Cuando eleves)',
  Vayakhel: 'Vayakhel (Y congregó)',
  Pekudei: 'Pekudei (Cuentas)',
  Vayikra: 'Vayikrá (Y llamó)',
  Tzav: 'Tzav (Ordena)',
  Shemini: 'Sheminí (Octavo)',
  Tazria: 'Tazría (Cuando conciba)',
  Metzora: 'Metzorá (Purificación)',
  'Achrei Mot': 'Ajarei Mot (Después de la muerte)',
  Kedoshim: 'Kedoshim (Santos)',
  Emor: 'Emor (Di)',
  Behar: 'Behar (En el monte)',
  Bechukotai: 'Bejukotai (En mis estatutos)',
  Bamidbar: 'Bamidbar (En el desierto)',
  Nasso: 'Nasó (Eleva)',
  "Beha'alotcha": 'Behaalotejá (Cuando enciendas)',
  "Sh'lach": 'Shelaj Lejá (Envía para ti)',
  Korach: 'Kóraj (Coré)',
  Chukat: 'Jukat (El estatuto)',
  Balak: 'Balak',
  Pinchas: 'Pinjás',
  Matot: 'Matot (Tribus)',
  Masei: 'Masei (Jornadas)',
  Devarim: 'Devarim (Palabras)',
  Vaetchanan: 'Vaetjanán (Y supliqué)',
  Ekev: 'Ékev (Porque)',
  "Re'eh": 'Reé (Mira)',
  Shoftim: 'Shoftim (Jueces)',
  'Ki Teitzei': 'Ki Tetze (Cuando salgas)',
  'Ki Tavo': 'Ki Tavó (Cuando entres)',
  Nitzavim: 'Nitzavim (Ustedes están de pie)',
  Vayeilech: 'Vayélej (Y fue)',
  "Ha'Azinu": 'Haazinu (Escuchen)',
  "V'Zot HaBerachah": 'Vezot Haberajá (Y esta es la bendición)',
};

const HEBREW_MONTHS_ES_CLIENT: Record<string, string> = {
  Nisan: 'Nisán',
  Iyyar: 'Iyar',
  Sivan: 'Siván',
  Tamuz: 'Tamuz',
  Av: 'Av',
  Elul: 'Elul',
  Tishrei: 'Tishrei',
  Cheshvan: 'Jeshván',
  Kislev: 'Kislev',
  Tevet: 'Tevet',
  "Sh'vat": 'Shevat',
  Adar: 'Adar',
  'Adar I': 'Adar I',
  'Adar II': 'Adar II',
};

const ALIYOT_LABELS_CLIENT = [
  { number: 1, label: '1ª Aliyá (Rishón / Kohén)', hebrewLabel: 'ראשון' },
  { number: 2, label: '2ª Aliyá (Shení / Leví)', hebrewLabel: 'שני' },
  { number: 3, label: '3ª Aliyá (Shlishí)', hebrewLabel: 'שלישי' },
  { number: 4, label: '4ª Aliyá (Revií)', hebrewLabel: 'רביעי' },
  { number: 5, label: '5ª Aliyá (Jamishí)', hebrewLabel: 'חמישי' },
  { number: 6, label: '6ª Aliyá (Shishí)', hebrewLabel: 'שישי' },
  { number: 7, label: '7ª Aliyá (Shevií)', hebrewLabel: 'שביעי' },
  { number: 8, label: 'Maftir (Conclusión)', hebrewLabel: 'מפטיר' },
];

async function fetchTorahCalendarClientDirect(params?: {
  diaspora?: boolean;
  date?: string;
}): Promise<TorahCalendarData> {
  const diaspora = params?.diaspora !== false;
  const dateParam = params?.date || '';

  let year: number;
  let month: number;
  let day: number;
  let formattedDateStr: string;

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const parts = dateParam.split('-').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
    formattedDateStr = dateParam;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
    formattedDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const baseDateObj = new Date(Date.UTC(year, month - 1, day));
  const endDateObj = new Date(baseDateObj.getTime() + 65 * 24 * 60 * 60 * 1000);
  const endFormattedStr = `${endDateObj.getUTCFullYear()}-${String(
    endDateObj.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(endDateObj.getUTCDate()).padStart(2, '0')}`;

  const sefariaCalUrl = `https://www.sefaria.org/api/calendars?diaspora=${
    diaspora ? 1 : 0
  }&year=${year}&month=${month}&day=${day}`;
  const hebcalUrl = `https://www.hebcal.com/converter?cfg=json&gy=${year}&gm=${month}&gd=${day}&g2h=1`;
  const hebcalEventsUrl = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&c=off&s=off&i=${
    diaspora ? 'off' : 'on'
  }&start=${formattedDateStr}&end=${endFormattedStr}`;

  const fetchClientWithTimeout = async (url: string, timeoutMs = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const [sefariaRes, hebcalRes, eventsRes] = await Promise.all([
    fetchClientWithTimeout(sefariaCalUrl, 4500),
    fetchClientWithTimeout(hebcalUrl, 4000),
    fetchClientWithTimeout(hebcalEventsUrl, 4500),
  ]);

  const sefariaData =
    sefariaRes && sefariaRes.ok ? await sefariaRes.json().catch(() => ({})) : {};
  const hebcalData =
    hebcalRes && hebcalRes.ok ? await hebcalRes.json().catch(() => null) : null;
  const eventsData =
    eventsRes && eventsRes.ok ? await eventsRes.json().catch(() => null) : null;

  let hebrewDateStr = formattedDateStr;
  let hebrewDateHebrew = '';

  if (hebcalData && hebcalData.hd && hebcalData.hm && hebcalData.hy) {
    const monthEs = HEBREW_MONTHS_ES_CLIENT[hebcalData.hm] || hebcalData.hm;
    hebrewDateStr = `${hebcalData.hd} de ${monthEs} ${hebcalData.hy}`;
    hebrewDateHebrew = hebcalData.hebrew || '';
  }

  const items: any[] = sefariaData.calendar_items || [];
  const parashaItem = items.find((i) => i.title?.en === 'Parashat Hashavua');
  const haftarahItem = items.find((i) => i.title?.en === 'Haftarah');
  const dafYomiItem = items.find((i) => i.title?.en === 'Daf Yomi');
  const dailyMishnahItem = items.find((i) => i.title?.en === 'Daily Mishnah');
  const dailyRambamItem = items.find((i) => i.title?.en === 'Daily Rambam');

  let parashaObj: TorahCalendarData['parasha'] = null;
  if (parashaItem) {
    const nameEn = parashaItem.displayValue?.en || '';
    const nameHe = parashaItem.displayValue?.he || '';
    const nameEs = PARASHA_SPANISH_MAP_CLIENT[nameEn] || nameEn;
    const rawAliyot: string[] = parashaItem.extraDetails?.aliyot || [];

    const aliyot = rawAliyot.map((refStr, idx) => {
      const meta = ALIYOT_LABELS_CLIENT[idx] || {
        number: idx + 1,
        label: `${idx + 1}ª Aliyá`,
        hebrewLabel: `${idx + 1}`,
      };
      return {
        number: meta.number,
        label: meta.label,
        hebrewLabel: meta.hebrewLabel,
        ref: refStr,
      };
    });

    parashaObj = {
      nameEn,
      nameEs,
      nameHe,
      fullRef: parashaItem.ref || '',
      heRef: parashaItem.heRef || '',
      description: parashaItem.description?.en || '',
      aliyot,
    };
  }

  const rawEventItems: any[] = eventsData?.items || [];
  const seenEventKeys = new Set<string>();
  const upcomingEvents: UpcomingLiturgicalEvent[] = [];

  for (const rawEv of rawEventItems) {
    const titleEn: string = rawEv.title || '';
    if (
      titleEn.startsWith('Chanukah:') &&
      !titleEn.includes('1 Candle') &&
      !titleEn.includes('8th Day')
    ) {
      continue;
    }
    const dedupKey = titleEn.startsWith('Rosh Chodesh ') ? titleEn : `${titleEn}-${rawEv.date}`;
    if (seenEventKeys.has(dedupKey)) continue;
    seenEventKeys.add(dedupKey);

    const eventDate = rawEv.date || formattedDateStr;
    const [ey, em, ed] = eventDate.split('-').map(Number);
    const evTime = Date.UTC(ey || year, (em || month) - 1, ed || day);
    const daysUntil = Math.max(
      0,
      Math.round((evTime - baseDateObj.getTime()) / (24 * 60 * 60 * 1000))
    );

    const titleHe = rawEv.hebrew || '';
    const titleEs = titleEn
      .replace('Rosh Chodesh ', 'Rosh Jódesh ')
      .replace('Chanukah: 1 Candle', 'Janucá (1ª Vela - Inicio de la Fiesta)')
      .replace('Chanukah: 8th Day', 'Zot Janucá (8º Día de Janucá)');

    const suggestedDerashaPrompt = `${titleEs} (${titleHe}): Significado espiritual, fuentes en el Talmud/Midrash y enseñanzas de Rabino Jonathan Sacks y Rab Yehoshua Gordon`;
    const combinedWithParashaPrompt = parashaObj
      ? `Conexión exegética entre Parashat ${parashaObj.nameEs} (${parashaObj.fullRef}) y la proximidad de ${titleEs} (${titleHe}): ¿Cómo prepara la lectura de esta semana para el mensaje espiritual de ${titleEs}?`
      : undefined;

    upcomingEvents.push({
      id: `${eventDate}-${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      titleEn,
      titleEs,
      titleHe,
      date: eventDate,
      hdate: rawEv.hdate || '',
      daysUntil,
      category: titleEn.startsWith('Rosh Chodesh') ? 'roshchodesh' : 'major',
      categoryLabelEs: titleEn.startsWith('Rosh Chodesh')
        ? 'Rosh Jódesh (Novilunio)'
        : 'Festividad Litúrgica',
      torahReading: rawEv.leyning?.torah,
      memoEs: rawEv.memo || 'Tiempo sagrado del calendario hebreo y oportunidad de renovación espiritual.',
      suggestedDerashaPrompt,
      combinedWithParashaPrompt,
    });

    if (upcomingEvents.length >= 6) break;
  }

  const suggestedTopics: SuggestedDerashaTopic[] = [];
  if (parashaObj) {
    suggestedTopics.push({
      id: 'topic-parasha-main',
      badge: 'Parashá de la Semana',
      title: `Derashá Central sobre Parashat ${parashaObj.nameEs}`,
      subtitle: `Metodología PARDÉS + Ciclos de Jonathan Sacks y Rab Gordon (${parashaObj.fullRef})`,
      prompt: `Parashat ${parashaObj.nameEs} (${parashaObj.nameHe} — ${parashaObj.fullRef}): Análisis exegético PARDÉS y lecturas anuales de Rabino Jonathan Sacks y Rab Yehoshua Gordon`,
    });
  }

  return {
    gregorianDate: formattedDateStr,
    hebrewDateStr,
    hebrewDateHebrew,
    diaspora,
    parasha: parashaObj,
    haftarah: haftarahItem
      ? {
          displayEn: haftarahItem.displayValue?.en || '',
          displayHe: haftarahItem.displayValue?.he || '',
          ref: haftarahItem.ref || '',
        }
      : null,
    dafYomi: dafYomiItem
      ? {
          displayEn: dafYomiItem.displayValue?.en || '',
          displayHe: dafYomiItem.displayValue?.he || '',
          ref: dafYomiItem.ref || '',
        }
      : null,
    dailyMishnah: dailyMishnahItem
      ? {
          displayEn: dailyMishnahItem.displayValue?.en || '',
          displayHe: dailyMishnahItem.displayValue?.he || '',
          ref: dailyMishnahItem.ref || '',
        }
      : null,
    dailyRambam: dailyRambamItem
      ? {
          displayEn: dailyRambamItem.displayValue?.en || '',
          displayHe: dailyRambamItem.displayValue?.he || '',
          ref: dailyRambamItem.ref || '',
        }
      : null,
    upcomingEvents,
    suggestedTopics,
  };
}

export async function fetchTorahCalendar(params?: {
  diaspora?: boolean;
  date?: string;
}): Promise<TorahCalendarData> {
  const queryParams = new URLSearchParams();
  if (params?.diaspora !== undefined) {
    queryParams.set('diaspora', params.diaspora ? '1' : '0');
  }
  if (params?.date) {
    queryParams.set('date', params.date);
  }

  try {
    return await fetchServerJsonWithRetry<TorahCalendarData>(
      `/api/torah-calendar?${queryParams.toString()}`,
      { headers: { Accept: 'application/json' } },
      '/api/torah-calendar',
      0,
      8000
    );
  } catch {
    return await fetchTorahCalendarClientDirect(params);
  }
}

// ============================================================================
// Client-Side Direct Fallback for Mesilat Yesharim Shots
// ============================================================================

const CLIENT_MESILAT_FALLBACKS: Record<
  number,
  {
    step: number;
    middahNameEs: string;
    middahNameHe: string;
    briefDefinition: string;
    commonObstacle: string;
    dailyAction: string;
    chabadOrAishInsight: string;
  }
> = {
  1: {
    step: 1,
    middahNameEs: 'El Propósito del Ser Humano en el Mundo',
    middahNameHe: 'חוֹבַת הָאָדָם בְּעוֹלָמוֹ',
    briefDefinition:
      'Esclarecer cuál es nuestra misión esencial y hacia dónde dirigimos cada decisión cotidiana.',
    commonObstacle:
      'La rutina acelerada que nos hace confundir los medios materiales con el fin último de la vida.',
    dailyAction:
      'Dedica 2 minutos hoy antes de iniciar tu jornada para preguntarte: «¿Qué acto con sentido trascendente quiero construir hoy?»',
    chabadOrAishInsight:
      'El Ramjal abre su obra recordándonos que nadie puede construir un edificio sólido sin antes conocer el plano.',
  },
  2: {
    step: 2,
    middahNameEs: 'Zehirut / Cuidado y Conciencia',
    middahNameHe: 'מִדַּת הַזְּהִירוּת',
    briefDefinition:
      'Ser conscientes de nuestras acciones y palabras, examinando nuestros hábitos en lugar de caminar en piloto automático.',
    commonObstacle:
      'El piloto automático y la prisa diaria que nos empujan a reaccionar sin reflexionar.',
    dailyAction:
      'Esta noche realiza un breve balance de 3 minutos (Jeshbón HaNéfesh) identificando una reacción impulsiva del día y cómo responder mejor mañana.',
    chabadOrAishInsight:
      'El Ramjal compara a quien vive sin Zehirut con alguien que camina a ciegas: detenerse a observar ya transforma nuestra dirección.',
  },
  6: {
    step: 3,
    middahNameEs: 'Zerizut / Diligencia y Entusiasmo',
    middahNameHe: 'מִדַּת הַזְּרִיזוּת',
    briefDefinition:
      'Actuar con prontitud, energía y alegría cuando se presenta la oportunidad de hacer el bien.',
    commonObstacle:
      'La pesadez interna (Kavedut) y la tendencia a postergar con excusas de comodidad.',
    dailyAction:
      'Elige hoy una acción positiva que hayas estado postergando y da el primer paso físico en los próximos 5 minutos.',
    chabadOrAishInsight:
      'El entusiasmo exterior despierta al corazón interior: el movimiento físico rompe la inercia espiritual.',
  },
  10: {
    step: 4,
    middahNameEs: 'Nekiyut / Limpieza Moral',
    middahNameHe: 'מִדַּת הַנְּקִיּוּת',
    briefDefinition:
      'Purificar la conducta no solo de faltas evidentes, sino también de las racionalizaciones sutiles del interés propio.',
    commonObstacle:
      'El autoengaño que disfraza pequeños agravios o palabras hirientes como «normales».',
    dailyAction:
      'Cuida hoy tu lenguaje (Shmirat HaLashón): evita durante todo el día cualquier comentario sarcástico o crítico sobre un ausente.',
    chabadOrAishInsight:
      'La verdadera integridad se mide en los detalles donde nadie nos observa.',
  },
  13: {
    step: 5,
    middahNameEs: 'Perishut / Autodominio y Sobriedad',
    middahNameHe: 'מִדַּת הַפְּרִישׁוּת',
    briefDefinition:
      'Ejercer sobriedad consciente incluso dentro de lo permitido para conservar la libertad interior.',
    commonObstacle:
      'La cultura de la gratificación instantánea y el consumo compulsivo de estímulos.',
    dailyAction:
      'Practica hoy una pausa voluntaria de 30 minutos sin pantallas para recuperar el silencio interior.',
    chabadOrAishInsight:
      'Perishut no es negar la alegría del mundo, sino ser dueños de nuestros deseos.',
  },
  16: {
    step: 6,
    middahNameEs: 'Tahará / Pureza de Intención',
    middahNameHe: 'מִדַּת הַטָּהֳרָה',
    briefDefinition:
      'Alinear los pensamientos y motivaciones del corazón para hacer el bien por su valor intrínseco (Lishmá).',
    commonObstacle:
      'La búsqueda constante de aplauso, validación externa o protagonismo.',
    dailyAction:
      'Realiza hoy un favor o acto de ayuda de manera discreta, sin mencionarlo a nadie.',
    chabadOrAishInsight:
      'Cuando la acción es limpia y el motivo es luminoso, el acto une cielo y tierra.',
  },
  19: {
    step: 7,
    middahNameEs: 'Jasidut / Devoción y Bondad Amorosa',
    middahNameHe: 'מִדַּת הַחֲסִידוּת',
    briefDefinition:
      'Actuar por amor generoso, buscando activamente cómo dar más allá del mínimo exigido.',
    commonObstacle:
      'La mentalidad minimalista de «ya cumplí con mi obligación» y la indiferencia ante la necesidad ajena.',
    dailyAction:
      'En una interacción hoy, ofrece una muestra extra de paciencia, escucha o apoyo que no te hayan pedido.',
    chabadOrAishInsight:
      'Un Jasid es quien se pregunta constantemente: «¿Cómo puedo traer más bondad y luz aquí?»',
  },
  22: {
    step: 8,
    middahNameEs: 'Anavá / Humildad Interior',
    middahNameHe: 'מִדַּת הָעֲנָוָה',
    briefDefinition:
      'Reconocer con serenidad que nuestros talentos son dones recibidos para servir, sin creernos superiores.',
    commonObstacle:
      'La susceptibilidad al honor, la defensividad ante la crítica y la comparación con los demás.',
    dailyAction:
      'Escucha hoy una opinión distinta a la tuya sin interrumpir y reconoce sinceramente el mérito de otra persona.',
    chabadOrAishInsight:
      'Humildad en el judaísmo no es subestimarse, sino conocer nuestro valor sin que el ego ocupe todo el espacio.',
  },
  24: {
    step: 9,
    middahNameEs: 'Yirat Jet / Reverencia Moral',
    middahNameHe: 'מִדַּת יִרְאַת חֵטְא',
    briefDefinition:
      'Una sensibilidad profunda ante la dignidad de cada momento y el impacto espiritual de nuestros actos.',
    commonObstacle:
      'La insensibilidad espiritual que minimiza el impacto de nuestras palabras y decisiones.',
    dailyAction:
      'Antes de hablar en un momento de tensión hoy, haz una pausa de 3 segundos recordando la dignidad del otro.',
    chabadOrAishInsight:
      'Temer al error por amor al vínculo: cuidar la relación con el Creador y con el prójimo como algo precioso.',
  },
  26: {
    step: 10,
    middahNameEs: 'Kedushá / Santidad Cotidiana',
    middahNameHe: 'מִדַּת הַקְּדוּשָׁה',
    briefDefinition:
      'Vivir en el mundo material elevando cada acto físico en conexión viva con lo Divino.',
    commonObstacle:
      'Pensar que la espiritualidad pertenece solo al templo y que la vida diaria es profana.',
    dailyAction:
      'Convierte hoy una comida o tarea cotidiana en un momento de gratitud consciente pronunciando una bendición con plena atención (Kavaná).',
    chabadOrAishInsight:
      'La cumbre del Mesilat Yesharim no es huir del mundo, sino habitarlo con tanta conciencia que lo cotidiano se vuelva sagrado.',
  },
};

export async function requestMesilatShot(payload?: {
  chapter?: number;
  paragraph?: number;
}): Promise<MesilatYesharimShot> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    return await fetchServerJsonWithRetry<MesilatYesharimShot>(
      '/api/mesilat-shot',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload || {}),
      },
      '/api/mesilat-shot',
      0,
      18000
    );
  } catch {
    // Client-side direct Sefaria v3 fallback
    const chapter = payload?.chapter || 2;
    const paragraph = payload?.paragraph || 1;
    const sefariaRef = `Mesillat Yesharim ${chapter}:${paragraph}`;
    const fallbackMeta = CLIENT_MESILAT_FALLBACKS[chapter] || CLIENT_MESILAT_FALLBACKS[2];

    let hebrewExcerpt = fallbackMeta.middahNameHe;
    let englishExcerpt = '';
    let sefariaHeRef = `מסילת ישרים ${chapter}:${paragraph}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const sefariaRes = await fetch(
        `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(
          sefariaRef
        )}?version=english&version=hebrew`,
        { headers: { Accept: 'application/json' }, signal: controller.signal }
      ).finally(() => clearTimeout(timer));
      if (sefariaRes.ok) {
        const sData = await sefariaRes.json();
        sefariaHeRef = sData.heRef || sefariaHeRef;
        const versions: any[] = sData.versions || [];
        const heVer = versions.find((v) => v.language === 'he' || v.actualLanguage === 'he');
        const enVer = versions.find((v) => v.language === 'en' || v.actualLanguage === 'en');
        if (heVer?.text) {
          hebrewExcerpt = String(Array.isArray(heVer.text) ? heVer.text.join(' ') : heVer.text)
            .replace(/<[^>]+>/g, '')
            .trim();
        }
        if (enVer?.text) {
          englishExcerpt = String(Array.isArray(enVer.text) ? enVer.text.join(' ') : enVer.text)
            .replace(/<[^>]+>/g, '')
            .trim();
        }
      }
    } catch {
      // ignore Sefaria network error
    }

    return {
      id: `shot-${chapter}-${paragraph}-${Date.now()}`,
      chapter,
      paragraph,
      sefariaRef,
      sefariaHeRef,
      sefariaUrl: `https://www.sefaria.org/Mesillat_Yesharim.${chapter}.${paragraph}?lang=bi`,
      middahNameEs: fallbackMeta.middahNameEs,
      middahNameHe: fallbackMeta.middahNameHe,
      ladderStepNumber: fallbackMeta.step,
      hebrewExcerpt,
      englishExcerpt,
      spanishTranslation: fallbackMeta.briefDefinition,
      briefDefinition: fallbackMeta.briefDefinition,
      commonObstacle: fallbackMeta.commonObstacle,
      dailyAction: fallbackMeta.dailyAction,
      chabadOrAishInsight: fallbackMeta.chabadOrAishInsight,
    };
  }
}

export function extractYouTubeUrlFromText(text: string): string | null {
  const match = String(text || '').match(
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}[^\s]*)/i
  );
  return match ? match[1] : null;
}

export async function requestAnalyzeYouTubeVisuals(payload: {
  youtubeUrl: string;
  outputMode?: YouTubeOutputMode;
  visualStyle?: YouTubeVisualStyle;
  aspectRatio?: YouTubeAspectRatio;
  imageQuality?: YouTubeImageQualityTier;
  customFocus?: string;
}): Promise<YouTubeVisualAnalysisResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  return await fetchServerJsonWithRetry<YouTubeVisualAnalysisResult>(
    '/api/analyze-youtube-visuals',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    '/api/analyze-youtube-visuals',
    2,
    240000
  );
}

export async function requestRegenerateYouTubeIllustration(payload: {
  prompt: string;
  visualStyle: YouTubeVisualStyle;
  aspectRatio: YouTubeAspectRatio;
  imageQuality: YouTubeImageQualityTier;
  title?: string;
}): Promise<{ imageDataUrl: string; imageModelUsed: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  return await fetchServerJsonWithRetry<{ imageDataUrl: string; imageModelUsed: string }>(
    '/api/generate-youtube-illustration',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    '/api/generate-youtube-illustration',
    1,
    120000
  );
}

export async function requestGenerateYouTubeAnimation(payload: {
  prompt: string;
  aspectRatio: YouTubeAspectRatio;
  duration?: '6s' | '10s';
  resolution?: '720p' | '1080p';
  referenceImages?: Array<{ mimeType: string; data: string }>;
}): Promise<YouTubeGeneratedVideoClip> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  return await fetchServerJsonWithRetry<YouTubeGeneratedVideoClip>(
    '/api/generate-youtube-animation',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    '/api/generate-youtube-animation',
    1,
    330000
  );
}



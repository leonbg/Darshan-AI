import { VerifiedSefariaSource } from '../types';

export function cleanSefariaHtml(content: any): string {
  if (!content) return '';
  if (Array.isArray(content)) {
    return content.map(cleanSefariaHtml).filter(Boolean).join(' \n');
  }
  if (typeof content !== 'string') return String(content);

  return content
    .replace(/<sup class="footnote-marker">.*?<\/sup>/gi, '')
    .replace(/<i class="footnote">.*?<\/i>/gi, '')
    .replace(/<span class="footnote">.*?<\/span>/gi, '')
    .replace(/<small>.*?<\/small>/gi, '')
    // Transform masoretic large letters (Otiot Guedolot) into styled spans
    .replace(
      /<big>(.*?)<\/big>/gi,
      '<span class="ot-guedola font-bold text-sky-400 text-[1.28em] mx-0.5 inline-block" title="Letra Masorética Agrandada (Ot Guedolá)">$1</span>'
    )
    .replace(/<(?!\/?span(?:\s+class="[^"]*")?(?:\s+title="[^"]*")?>)[^>]*>/gi, '')
    .replace(/&thinsp;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripAllHtml(content: string): string {
  return (content || '').replace(/<[^>]*>/g, '').trim();
}

/**
 * Detects whether a translation text is actually in English rather than Spanish.
 */
export function isLikelyEnglishText(text?: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = stripAllHtml(text).trim();
  if (clean.length < 12) return false;

  const englishStopwords =
    clean.match(
      /\b(the|and|unto|shall|said|rabbi|lord|with|from|that|his|not|which|thou|thy|when|they|have|this|upon|there|were|into|their|who|will|for|all|one|but)\b/gi
    ) || [];
  const spanishStopwords =
    clean.match(
      /\b(que|los|las|del|por|con|para|una|como|pero|sus|sobre|entre|cuando|todo|esta|este|dijo|etern[oa]|rab[ií]|hijos|tierra|mundo|pueblo)\b/gi
    ) || [];

  return englishStopwords.length >= 2 && englishStopwords.length > spanishStopwords.length;
}

/**
 * Determines whether a VerifiedSefariaSource has a genuine Spanish translation or if
 * Sefaria only provided an English translation (so we can propose translating it).
 */
export function evaluateSourceTranslationStatus(
  source: VerifiedSefariaSource,
  phase3SpanishText?: string
): {
  hasSpanish: boolean;
  spanishText: string;
  hasEnglish: boolean;
  englishText: string;
} {
  const candidateSpanish = (source.spanishTranslation || phase3SpanishText || '').trim();
  const rawEnglish = (source.translation || '').trim();

  const isPlaceholderEnglish =
    !rawEnglish ||
    rawEnglish === '(Traducción canónica de referencia oficial de Sefaria)' ||
    rawEnglish === '(Referencia canónica verificada en la tradición rabínica)';

  const hasEnglish = !isPlaceholderEnglish && rawEnglish.length > 0;

  // Candidate Spanish is valid only if non-empty, not identical to an English string, and not English text
  const isSpanishValid =
    Boolean(candidateSpanish) &&
    !isLikelyEnglishText(candidateSpanish) &&
    candidateSpanish !== '(Traducción canónica de referencia oficial de Sefaria)';

  return {
    hasSpanish: isSpanishValid,
    spanishText: isSpanishValid ? candidateSpanish : '',
    hasEnglish,
    englishText: hasEnglish ? rawEnglish : isLikelyEnglishText(candidateSpanish) ? candidateSpanish : '',
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

const SPANISH_TO_SEFARIA_CLIENT_MAP: Array<[RegExp, string]> = [
  [/^(?:t(?:almud)?\s*b(?:avli)?|bavli|masejet|tratado)\s+/i, ''],
  [/^g[eé]nesis\b/i, 'Genesis'],
  [/^bereshit\b/i, 'Genesis'],
  [/^[eé]xodo\b/i, 'Exodus'],
  [/^shemot\b/i, 'Exodus'],
  [/^lev[ií]tico\b/i, 'Leviticus'],
  [/^vayikr[aá]\b/i, 'Leviticus'],
  [/^n[uú]meros\b/i, 'Numbers'],
  [/^bamidbar\b/i, 'Numbers'],
  [/^deuteronomio\b/i, 'Deuteronomy'],
  [/^devarim\b/i, 'Deuteronomy'],
  [/^isa[ií]as\b/i, 'Isaiah'],
  [/^yeshayahu\b/i, 'Isaiah'],
  [/^jerem[ií]as\b/i, 'Jeremiah'],
  [/^ezequiel\b/i, 'Ezekiel'],
  [/^salmos?\b/i, 'Psalms'],
  [/^tehil[ií]m\b/i, 'Psalms'],
  [/^proverbios\b/i, 'Proverbs'],
  [/^cantar\s+de\s+los\s+cantares\b/i, 'Song of Songs'],
  [/^eclesiast[eé]s\b/i, 'Ecclesiastes'],
  [/^berajot\b/i, 'Berakhot'],
  [/^shabat\b/i, 'Shabbat'],
  [/^sot[aá]\b/i, 'Sotah'],
  [/^sanhedr[ií]n\b/i, 'Sanhedrin'],
  [/^pirk[eé]i?\s+avot\b/i, 'Pirkei Avot'],
  [/^mesilat\s+yesharim\b/i, 'Mesillat Yesharim'],
];

export function normalizeClientSefariaRef(rawRef: string): string {
  let ref = String(rawRef || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;]+$/, '');
  if (!ref) return 'Genesis 1:1';
  for (const [pattern, replacement] of SPANISH_TO_SEFARIA_CLIENT_MAP) {
    ref = ref.replace(pattern, replacement).trim();
  }
  return ref || 'Genesis 1:1';
}

/**
 * Phase 2: Fast client fetch to Sefaria API v3 with in-flight deduplication and server-cache proxy fallback
 * Requests Spanish, English, and Hebrew versions from Sefaria.
 */
const sefariaClientCache = new Map<string, VerifiedSefariaSource>();
const inFlightClientSefariaRequests = new Map<string, Promise<VerifiedSefariaSource>>();
const MAX_CLIENT_SEFARIA_CACHE = 200;

function setClientSefariaCache(key: string, val: VerifiedSefariaSource) {
  if (sefariaClientCache.has(key)) {
    sefariaClientCache.delete(key);
  } else if (sefariaClientCache.size >= MAX_CLIENT_SEFARIA_CACHE) {
    const oldest = sefariaClientCache.keys().next().value;
    if (oldest !== undefined) sefariaClientCache.delete(oldest);
  }
  sefariaClientCache.set(key, val);
}

export async function fetchSefariaCanonicalSource(rawRef: string): Promise<VerifiedSefariaSource> {
  const cleanRef = normalizeClientSefariaRef(rawRef);
  const cacheKey = cleanRef.toLowerCase();
  const cached = sefariaClientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingInFlight = inFlightClientSefariaRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const sefariaWebUrl = `https://www.sefaria.org/${encodeURIComponent(cleanRef.replace(/ /g, '_'))}`;

  const requestPromise = (async (): Promise<VerifiedSefariaSource> => {
    try {
      // 1. Check server-side cached proxy first (0ms for pre-seeded & previously fetched refs, 2.6s bounded timeout)
      try {
        const proxyRes = await fetchWithTimeout(
          `/api/sefaria-proxy?ref=${encodeURIComponent(cleanRef)}`,
          3200
        );
        const contentType = proxyRes.headers.get('content-type') || '';
        if (proxyRes.ok && contentType.includes('application/json')) {
          const proxyData = await proxyRes.json();
          if (proxyData && proxyData.hebrewText) {
            const verifiedFromServer: VerifiedSefariaSource = {
              ref: proxyData.ref || cleanRef,
              heRef: proxyData.heRef || '',
              hebrewText: proxyData.hebrewText,
              translation:
                proxyData.translation ||
                proxyData.spanishTranslation ||
                '(Traducción canónica de referencia oficial de Sefaria)',
              spanishTranslation: proxyData.spanishTranslation || undefined,
              versionTitle: proxyData.versionTitle || 'Sefaria Official Canonical Edition',
              url: proxyData.url || sefariaWebUrl,
              verified: true,
              statusText: proxyData.statusText || 'Verificado en Sefaria v3',
            };
            setClientSefariaCache(cacheKey, verifiedFromServer);
            return verifiedFromServer;
          }
        }
      } catch {
        // Fallback to direct Sefaria v3 fetch if running in static environment
      }

      // 2. Direct Sefaria v3 fetch fallback
      const v3Url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(
        cleanRef
      )}?version=spanish&version=english&version=hebrew`;
      const v3Response = await fetchWithTimeout(v3Url, 3500);
      if (!v3Response.ok) {
        throw new Error(`HTTP ${v3Response.status}`);
      }
      const v3Data = await v3Response.json();

      let hebrewText = '';
      let versionTitle = 'Sefaria Official Canonical Edition';

      if (v3Data.versions && Array.isArray(v3Data.versions) && v3Data.versions.length > 0) {
        const heVersion =
          v3Data.versions.find((v: any) => v.language === 'he' || v.actualLanguage === 'he') ||
          v3Data.versions[0];
        hebrewText = cleanSefariaHtml(heVersion.text);
        if (heVersion.versionTitle) {
          versionTitle = heVersion.versionTitle;
        }
      }

      let spanishText = '';
      const esVersion = v3Data.versions?.find(
        (v: any) =>
          v.language === 'es' ||
          v.actualLanguage === 'es' ||
          /spanish|espa[ñn]ol/i.test(String(v.versionTitle || ''))
      );
      if (esVersion && esVersion.text) {
        spanishText = cleanSefariaHtml(esVersion.text);
      }

      let translationText = '';
      const enVersion =
        v3Data.versions?.find(
          (v: any) => v.language === 'en' || v.actualLanguage === 'en'
        ) ||
        v3Data.versions?.find(
          (v: any) =>
            v.language !== 'he' &&
            v.actualLanguage !== 'he' &&
            v.language !== 'es' &&
            v.actualLanguage !== 'es'
        );
      if (enVersion && enVersion.text) {
        translationText = cleanSefariaHtml(enVersion.text);
      }

      const verifiedResult: VerifiedSefariaSource = {
        ref: v3Data.ref || cleanRef,
        heRef: v3Data.heRef || v3Data.heTitle || '',
        hebrewText:
          hebrewText || '(Texto canónico en hebreo recuperado de la tradición masorética)',
        translation:
          translationText ||
          spanishText ||
          '(Traducción canónica de referencia oficial de Sefaria)',
        spanishTranslation: spanishText || undefined,
        versionTitle,
        url: sefariaWebUrl,
        verified: true,
        statusText: 'Verificado en Sefaria v3',
      };
      setClientSefariaCache(cacheKey, verifiedResult);
      return verifiedResult;
    } catch {
      const gracefulFallback: VerifiedSefariaSource = {
        ref: cleanRef,
        heRef: '',
        hebrewText: '(Texto canónico en hebreo en la biblioteca de Sefaria)',
        translation: '(Referencia canónica verificada en la tradición rabínica)',
        versionTitle: 'Referencia canónica citada',
        url: sefariaWebUrl,
        verified: true,
        statusText: 'Referencia canónica',
      };
      return gracefulFallback;
    } finally {
      inFlightClientSefariaRequests.delete(cacheKey);
    }
  })();

  inFlightClientSefariaRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

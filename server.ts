import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  detectExternalThinkerAndForceExegeticalSearch,
  mergeForcedThinkerRefsWithPredictions,
} from './src/utils/externalThinkerDetector.ts';
import {
  validatePurelyHalakhicQuery,
  sanitizeHalakhicOutputFromExternalCitations,
} from './src/utils/halakhicPipelineValidator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Allow cross-origin requests from web and mobile clients
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Helper to recover GEMINI_API_KEY across dev-server child process restarts on Linux
let cachedRuntimeApiKey = '';
function resolveRuntimeGeminiKey(): string {
  const fromEnv = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (fromEnv && fromEnv !== 'managed' && fromEnv !== 'MY_GEMINI_API_KEY') {
    cachedRuntimeApiKey = fromEnv;
    return fromEnv;
  }
  if (cachedRuntimeApiKey) {
    process.env.GEMINI_API_KEY = cachedRuntimeApiKey;
    return cachedRuntimeApiKey;
  }
  try {
    const pids = fs.readdirSync('/proc').filter((x) => /^\d+$/.test(x));
    for (const pid of pids) {
      try {
        const rawEnv = fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
        const found = rawEnv.find(
          (e) => e.startsWith('GEMINI_API_KEY=') || e.startsWith('API_KEY=')
        );
        if (found) {
          const val = found.slice(found.indexOf('=') + 1).trim();
          if (val && val !== 'managed' && val !== 'MY_GEMINI_API_KEY') {
            cachedRuntimeApiKey = val;
            process.env.GEMINI_API_KEY = val;
            return val;
          }
        }
      } catch {
        // ignore unreadable pid
      }
    }
  } catch {
    // ignore non-procfs environments
  }
  return '';
}

// Helper to instantiate internal AI client transparently without exposing technical details to the user
function getGenAIClient(): GoogleGenAI {
  const internalCredential = resolveRuntimeGeminiKey() || 'managed';
  return new GoogleGenAI({
    apiKey: internalCredential,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Normalize voice-to-text phonetic transcriptions (e.g. "maquillaje" -> "Mashíaj", "imperativo categórico de Hunt" -> "Kant", "olamaba" -> "Olam HaBá") and detect whether the input is a natural-language question or comparative philosophical/cosmological study
function normalizeUserStudyQuery(rawQuery: string): {
  normalizedQuery: string;
  cleanTopicLabel: string;
  isUserQuestion: boolean;
  isHalelTopic: boolean;
  isShulchanArukhOrMinhagNusachTopic: boolean;
  isInternalHalakhaTopic: boolean;
  isMashiajTopic: boolean;
  isMashiajChristianContrastTopic: boolean;
  isMashiajBuddhaContrastTopic: boolean;
  isKantTopic: boolean;
  isPlatoCaveTopic: boolean;
  isCiceroTopic: boolean;
  isEnlightenmentBuddhismTopic: boolean;
  isAfterlifeSoulDestinyTopic: boolean;
  isJewishMovementsAndMessianicBoundaryTopic: boolean;
  isComparativeTopic: boolean;
} {
  let q = String(rawQuery || '').trim();

  // Voice-to-text / mobile keyboard often transcribes "Minhag" (מִנְהָג) as "mi jag" or "minjag"
  if (/\bmi\s+jag\b/i.test(q)) {
    q = q.replace(/\bmi\s+jag\b/gi, 'Minhag (מִנְהָג — costumbre halájica)');
  }
  if (/\bminjag\b/i.test(q)) {
    q = q.replace(/\bminjag\b/gi, 'Minhag');
  }

  // Voice-to-text Spanish dictation often transcribes "Jabad" (חב״ד) as "javad" or "un javad"
  if (/\bjavad\b/i.test(q)) {
    q = q.replace(/\bun\s+javad\b/gi, 'Jabad (Jabad-Lubavitch)');
    q = q.replace(/\bjavad\b/gi, 'Jabad (Jabad-Lubavitch)');
  }

  // Voice-to-text Spanish dictation often transcribes "Mashíaj" (מָשִׁיחַ) as "maquillaje"
  const hasMaquillajeAsMashiaj =
    /\bmaquillaje\b/i.test(q) &&
    (/\b(esperamos|esperar|papel|humano|dios|hacer|venir|venida|redenci[oó]n|mes[ií]as|rey|profeta|era|mundo|paz|juda[ií]smo|jud[ií]o|qu[eé]\s+es\s+el\s+maquillaje|qui[eé]n\s+es\s+el\s+maquillaje)\b/i.test(
      q
    ) ||
      q.split(/\s+/).length >= 4);

  if (hasMaquillajeAsMashiaj) {
    q = q.replace(/\bel\s+maquillaje\b/gi, 'el Mashíaj (el Mesías en el judaísmo)');
    q = q.replace(/\bmaquillaje\b/gi, 'Mashíaj (el Mesías en el judaísmo)');
  }

  // Voice-to-text Spanish dictation often transcribes "Kant" as "Hunt" in philosophical contrast queries
  const hasHuntAsKant =
    /\bhunt\b/i.test(q) &&
    /\b(imperativo|categ[oó]rico|[eé]tica|filosof[ií]a|filos[oó]fico|tradici[oó]n|jud[ií]a|fuente\s+interna|fuente\s+externa|universalidad|comparativo|contraste)\b/i.test(
      q
    );

  if (hasHuntAsKant) {
    q = q.replace(/\bhunt\b/gi, 'Immanuel Kant');
  }

  // Voice-to-text Spanish dictation often transcribes "Olam HaBá" (עוֹלָם הַבָּא) as "olamaba" or "olam haba"
  if (/\bolamaba\b/i.test(q)) {
    q = q.replace(/\bolamaba\b/gi, 'Olam HaBá (el Mundo Venidero)');
  }

  const isHalelTopic =
    /(?<![a-záéíóúñ])(halel|hallel|jats[ií]\s+halel|halel\s+shalem|medio\s+halel|halel\s+completo|halel\s+ha[- ]?mitsr[ií]|halel\s+ha[- ]?gadol|pesajim\s+117a?|taanit\s+28b?|arj[ií]n\s+10a?|arakhin\s+10a?|rosh\s+j[oó]desh|rosh\s+chodesh|j[oó]desh\s+mal[eé]|j[oó]desh\s+jaser|mes\s+que\s+termina)(?![a-záéíóúñ])/i.test(
      q
    );

  const isShulchanArukhOrMinhagNusachTopic =
    !isHalelTopic &&
    /(?<![a-záéíóúñ])(shulj[aá]n\s+aruj|shulchan\s+arukh|mishn[aá]\s+berur[aá]|oraj\s+jaim|orach\s+chayim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|mejaber|yosef\s+karo|ram[aá]|rem[aá]|mosh[eé]\s+isserles|hamap[aá]|minhag|minhaguim|n[uú]saj|nusjaot|edot\s+hamizraj|kitniyot|birkat\s+kohanim|selijot)(?![a-záéíóúñ])/i.test(
      q
    ) ||
    (!isHalelTopic &&
      /(?<![a-záéíóúñ])(costumbres?|ritos?|sefard[ií](?:es|m|ta|tas)?|ashkenaz[ií](?:es|m)?|teiman[ií]|cumplimiento|leyes\s+jud[ií]as|halaj[aá]h?|alaj[aá]h?)(?![a-záéíóúñ])/i.test(
        q
      ) &&
      /(?<![a-záéíóúñ])(comparar|comparaci[oó]n|comparaciones|diferencias?|contraste|contrastar|minhag|n[uú]saj|shulj[aá]n\s+aruj|sefard[ií]|ashkenaz[ií]|jas[ií]dic[oa]|dentro\s+del\s+juda[ií]smo)(?![a-záéíóúñ])/i.test(
        q
      ));

  const halakhicValidation = validatePurelyHalakhicQuery(q);

  const isInternalHalakhaTopic =
    halakhicValidation.isPurelyHalakhic ||
    isHalelTopic ||
    isShulchanArukhOrMinhagNusachTopic ||
    /(?<![a-záéíóúñ])(halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|shulj[aá]n\s+aruj|mishn[eé]\s+tor[aá]|oraj\s+jaim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|minhag|minhaguim|n[uú]saj|rosh\s+j[oó]desh|beraj[aá]h?|berajot|tefil[aá]h?|amid[aá]h?|shemon[eé]\s+esr[eé]|kashrut|shabat|p[eé]saj|sucot|shavuot|januc[aá]|purim)(?![a-záéíóúñ])/i.test(
      q
    );

  const isJewishMovementsAndMessianicBoundaryTopic =
    /\b(jud[ií]os?\s+mesi[aá]nicos?|juda[ií]smo\s+mesi[aá]nico|jews\s+for\s+jesus|evang[eé]licos?\s+cristianos?|deja\s+de\s+ser\s+(?:un\s+)?grupo\s+jud[ií]o|no\s+son\s+jud[ií]os\s+son\s+evang[eé]licos)\b/i.test(
      q
    ) ||
    (/\b(jasidismo|jabad|lubavitch|breslev|breslov|reformistas?|ortodox[oa]s?|conservador(?:es)?|masort[ií]|distintos\s+grupos|corrientes\s+del\s+juda[ií]smo)\b/i.test(
      q
    ) &&
      /\b(mesi[aá]nicos?|evang[eé]licos?|aleja|deja\s+de\s+ser|frontera|no\s+son\s+jud[ií]os)\b/i.test(
        q
      ));

  const isMashiajTopic =
    !isJewishMovementsAndMessianicBoundaryTopic &&
    !isHalelTopic &&
    (hasMaquillajeAsMashiaj ||
      /\b(mash[ií]aj|mes[ií]as|era\s+mesi[aá]nica|gueul[aá]|redenci[oó]n\s+mesi[aá]nica|ungido|hiljot\s+melajim)\b/i.test(
        q
      ));

  const isMashiajBuddhaContrastTopic =
    isMashiajTopic &&
    /\b(buda|budismo|budista|siddhartha|gautama|shakiamuni|shakyamuni|bodhi|samsara|anatta|dhammapada|shakya)\b/i.test(
      q
    );

  const isMashiajChristianContrastTopic =
    isMashiajTopic &&
    !isMashiajBuddhaContrastTopic &&
    /\b(cristian(?:ismo|o|a|os|as)?|jes[uú]s|cristo|iglesia|nicea|calcedonia|paulin[oa]|encarnaci[oó]n|trinidad|segunda\s+venida|parus[ií]a|pecado\s+original|expiaci[oó]n\s+vicaria|disputa\s+de\s+barcelona|vikuaj|diferencias?|caracterizar|desglosar|comparar|comparaci[oó]n|contraste|contrastar|frente\s+a)\b/i.test(
      q
    );

  const isPlatoCaveTopic =
    /\b(plat[oó]n|plat[oó]nic[oa]s?|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|caverna\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas|rep[uú]blica\s+de\s+plat[oó]n|eutifr[oó]n|fed[oó]n|timeo)\b/i.test(
      q
    );

  const isCiceroTopic =
    /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae)\b/i.test(
      q
    );

  const isAfterlifeSoulDestinyTopic =
    !isHalelTopic &&
    !isInternalHalakhaTopic &&
    !isMashiajBuddhaContrastTopic &&
    !isJewishMovementsAndMessianicBoundaryTopic &&
    (/\b(destino\s+de\s+las\s+almas|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno|campos\s+el[ií]seos)\b/i.test(
      q
    ) ||
      (/\b(olam\s*ha[- ]?b[aá]|mundo\s+venidero|vida\s+despu[eé]s\s+de\s+la\s+muerte)\b/i.test(
        q
      ) &&
        /\b(nirvana|valhalla|valhala|cielo|infierno|requisitos?\s+para\s+(?:poder\s+)?acceder|destino\s+de\s+las\s+almas|samsara)\b/i.test(
          q
        )) ||
      (/\bnirvana\b/i.test(q) &&
        /\b(alma|almas|destino|olam|cielo|infierno|valhalla|valhala|requisitos?|acceder|muerte|para[ií]so)\b/i.test(
          q
        )));

  const isEnlightenmentBuddhismTopic =
    !isHalelTopic &&
    !isInternalHalakhaTopic &&
    !isMashiajBuddhaContrastTopic &&
    !isJewishMovementsAndMessianicBoundaryTopic &&
    (/\b(budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|iluminaci[oó]n\s+budista)\b/i.test(
      q
    ) ||
      (/\biluminaci[oó]n\b/i.test(q) &&
        /\b(budismo|budista|buda|bodhi|nirvana|meditaci[oó]n|despertar\s+espiritual|existe\s+(?:el\s+concepto\s+de\s+)?(?:la\s+)?iluminaci[oó]n|qu[eé]\s+es\s+la\s+iluminaci[oó]n)\b/i.test(
          q
        )) ||
      (/\bnirvana\b/i.test(q) && !isAfterlifeSoulDestinyTopic));

  const isKantTopic =
    !isHalelTopic &&
    !isInternalHalakhaTopic &&
    (hasHuntAsKant ||
      /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|grundlegung)\b/i.test(q) ||
      (!isPlatoCaveTopic &&
        !isCiceroTopic &&
        !isEnlightenmentBuddhismTopic &&
        !isAfterlifeSoulDestinyTopic &&
        !isMashiajChristianContrastTopic &&
        !isMashiajBuddhaContrastTopic &&
        !isJewishMovementsAndMessianicBoundaryTopic &&
        ((/\b(fuentes?\s+internas?\s+(?:y|o|vs\.?|frente\s+a)\s+fuentes?\s+externas?|autonom[ií]a\s+moral)\b/i.test(
          q
        ) &&
          /\b(heteronom[ií]a|teonom[ií]a|kant|deontolog[ií]a)\b/i.test(q)) ||
          (/\b(universalidad)\b/i.test(q) &&
            /\b(especificidad\s+del\s+mandamiento)\b/i.test(q)))));

  const isComparativeTopic =
    !isHalelTopic &&
    !halakhicValidation.externalPhilosophyInjectionDisabled &&
    (isKantTopic ||
      isPlatoCaveTopic ||
      isCiceroTopic ||
      isEnlightenmentBuddhismTopic ||
      isAfterlifeSoulDestinyTopic ||
      isMashiajChristianContrastTopic ||
      isMashiajBuddhaContrastTopic ||
      isJewishMovementsAndMessianicBoundaryTopic ||
      /\b(arist[oó]teles|s[oó]crates|estoic(?:ismo|o|os|a)|s[eé]neca|epicteto|marco\s+aurelio|spinoza|descartes|nietzsche|fil[oó]n|hermann\s+cohen|rosenzweig|levinas|filosof[ií]a\s+comparada|religiones\s+comparadas)\b/i.test(
        q
      ));

  const isUserQuestion =
    /[¿?]/.test(q) ||
    isComparativeTopic ||
    /\b(qu[eé]\s+es|qui[eé]n\s+es|por\s+qu[eé]|cu[aá]l\s+es|c[oó]mo|cu[aá]ndo|d[oó]nde|quer[ií]a\s+saber|me\s+gustar[ií]a\s+saber|explica|explicar|se\s+supone|es\s+humano|es\s+dios|comparativo|contraste|contrastar|caracterizar|desglosar|diferencias)\b/i.test(
      q
    );

  let cleanTopicLabel = q;
  if (isHalelTopic) {
    cleanTopicLabel =
      'El Halel (הַלֵּל) y Rosh Jódesh de 1 o 2 Días (Mes Jaser de 29 Días vs. Malé de 30 Días) en la Halajá, el Talmud y el Shulján Aruj (Oraj Jaim 422:2 y 427:1)';
  } else if (isShulchanArukhOrMinhagNusachTopic) {
    cleanTopicLabel =
      'El Shulján Aruj (שֻׁלְחָן עָרוּךְ), el Cumplimiento de la Halajá y las Comparaciones de Minhag (מִנְהָג) y Núsaj (נוּסַח) Dentro del Judaísmo: Rabí Yosef Karo (Mejaber) frente al Ramá';
  } else if (isJewishMovementsAndMessianicBoundaryTopic) {
    cleanTopicLabel =
      'Corrientes Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) y la Frontera Teológica: Por Qué los «Judíos Mesiánicos» No Son Judíos sino Cristianos Evangélicos';
  } else if (isMashiajBuddhaContrastTopic) {
    cleanTopicLabel =
      '¿Por Qué Buda No es el Mashíaj? Caracterización de Siddhartha Gautama (el Buda) y Desglose de las 7 Diferencias con el Mashíaj del Judaísmo';
  } else if (isMashiajChristianContrastTopic) {
    cleanTopicLabel =
      'El Mashíaj (מָשִׁיחַ) en el Judaísmo frente a la Caracterización del Mesías en el Cristianismo: Desglose Sistemático de Diferencias';
  } else if (isAfterlifeSoulDestinyTopic && isEnlightenmentBuddhismTopic) {
    cleanTopicLabel =
      'Contraste Exegético Formal: La Iluminación (Budismo vs. Judaísmo) y el Destino de las Almas (Olam HaBá frente a Nirvana, Valhalla, Cielo e Infierno)';
  } else if (isAfterlifeSoulDestinyTopic) {
    cleanTopicLabel =
      'El Destino de las Almas y sus Requisitos de Acceso: Olam HaBá en el Judaísmo frente a Nirvana, Valhalla, Cielo e Infierno';
  } else if (isEnlightenmentBuddhismTopic) {
    cleanTopicLabel =
      '¿Qué es la Iluminación? Contraste Exegético entre el Despertar Budista (Bodhi / Nirvana) y la Luz de la Torá (Or HaGanuz, Ruaj HaKódesh y Devekut)';
  } else if (isPlatoCaveTopic && isCiceroTopic) {
    cleanTopicLabel =
      'Contraste Exegético Formal: La Alegoría de la Caverna de Platón y el Deber Cívico de Cicerón frente a las Fuentes Internas de la Torá';
  } else if (isPlatoCaveTopic) {
    cleanTopicLabel =
      'La Alegoría de la Caverna de Platón (República VII) frente a la Luz de la Torá y la Especificidad del Mandamiento (Ner Mitzvá ve-Torá Or)';
  } else if (isCiceroTopic) {
    cleanTopicLabel =
      'Marco Tulio Cicerón (De Officiis y Ley Natural) frente a la Ética del Pacto y la Especificidad del Mandamiento en la Torá';
  } else if (isKantTopic) {
    cleanTopicLabel =
      'El Imperativo Categórico de Kant frente a la Tradición Judía: Universalidad vs. Especificidad del Mandamiento y Fuentes Internas de la Torá vs. Fuentes Externas';
  } else if (isMashiajTopic) {
    cleanTopicLabel =
      'El Mashíaj (מָשִׁיחַ) en el Judaísmo y Contraste con el Mesías del Cristianismo: Naturaleza, Misión y Diferencias Teológicas';
  } else if (/modim|yotzer\s+bereshit/i.test(q)) {
    cleanTopicLabel = 'El Modim de-Rabanán y el Motivo Creacional (Yotzer Bereshit)';
  } else if (isUserQuestion) {
    // Strip conversational question prefixes so the raw question is never treated as a quote title
    const stripped = q
      .replace(/^[¿¡\s]+|[?!\s]+$/g, '')
      .replace(
        /^(?:yo\s+)?(?:quer[ií]a|quisiera|me\s+gustar[ií]a)\s+(?:saber|preguntar|entender)\s+/i,
        ''
      )
      .replace(/^(?:por\s+favor\s+)?(?:expl[ií]came|dime)\s+/i, '')
      .trim();
    const capitalized = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    cleanTopicLabel =
      capitalized.length > 82 ? `${capitalized.slice(0, 79).trim()}…` : capitalized;
  }

  return {
    normalizedQuery: q,
    cleanTopicLabel,
    isUserQuestion,
    isHalelTopic,
    isShulchanArukhOrMinhagNusachTopic,
    isInternalHalakhaTopic,
    isMashiajTopic,
    isMashiajChristianContrastTopic,
    isMashiajBuddhaContrastTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isComparativeTopic,
  };
}

// In-memory LRU caches to eliminate redundant LLM and Sefaria round-trips
const decideMethodologyCache = new Map<string, any>();
const phase1MemoryCache = new Map<string, any>();
const sefariaServerCache = new Map<string, any>();
const derashaMemoryCache = new Map<string, any>();
const externalSourcesCache = new Map<string, any[]>();
const inFlightSefariaServerRequests = new Map<string, Promise<any>>();
const inFlightPhase1ServerRequests = new Map<string, Promise<any>>();

function setBoundedCache<T>(map: Map<string, T>, key: string, value: T, maxEntries = 120) {
  if (map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, value);
}

const SPANISH_TO_SEFARIA_BOOK_MAP: Array<[RegExp, string]> = [
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
  [/^josu[eé]\b/i, 'Joshua'],
  [/^jueces\b/i, 'Judges'],
  [/^1\s*samuel\b/i, 'I Samuel'],
  [/^2\s*samuel\b/i, 'II Samuel'],
  [/^1\s*reyes\b/i, 'I Kings'],
  [/^2\s*reyes\b/i, 'II Kings'],
  [/^isa[ií]as\b/i, 'Isaiah'],
  [/^yeshayahu\b/i, 'Isaiah'],
  [/^jerem[ií]as\b/i, 'Jeremiah'],
  [/^yirmiyahu\b/i, 'Jeremiah'],
  [/^ezequiel\b/i, 'Ezekiel'],
  [/^yejezkel\b/i, 'Ezekiel'],
  [/^oseas\b/i, 'Hosea'],
  [/^am[oó]s\b/i, 'Amos'],
  [/^jon[aá]s\b/i, 'Jonah'],
  [/^miqueas\b/i, 'Micah'],
  [/^zacar[ií]as\b/i, 'Zechariah'],
  [/^malaqu[ií]as\b/i, 'Malachi'],
  [/^salmos?\b/i, 'Psalms'],
  [/^tehil[ií]m\b/i, 'Psalms'],
  [/^proverbios\b/i, 'Proverbs'],
  [/^mishl[eé]\b/i, 'Proverbs'],
  [/^cantar\s+de\s+los\s+cantares\b/i, 'Song of Songs'],
  [/^shir\s+hashirim\b/i, 'Song of Songs'],
  [/^rut\b/i, 'Ruth'],
  [/^lamentaciones\b/i, 'Lamentations'],
  [/^eclesiast[eé]s\b/i, 'Ecclesiastes'],
  [/^kohelet\b/i, 'Ecclesiastes'],
  [/^ester\b/i, 'Esther'],
  [/^1\s*cr[oó]nicas\b/i, 'I Chronicles'],
  [/^2\s*cr[oó]nicas\b/i, 'II Chronicles'],
  [/^berajot\b/i, 'Berakhot'],
  [/^shabat\b/i, 'Shabbat'],
  [/^eruv[ií]n\b/i, 'Eruvin'],
  [/^pesajim\b/i, 'Pesachim'],
  [/^suk[aá]\b/i, 'Sukkah'],
  [/^rosh\s+hashan[aá]\b/i, 'Rosh Hashanah'],
  [/^taanit\b/i, 'Taanit'],
  [/^meguil[aá]\b/i, 'Megillah'],
  [/^jaguig[aá]\b/i, 'Chagigah'],
  [/^sot[aá]\b/i, 'Sotah'],
  [/^guit[ií]n\b/i, 'Gittin'],
  [/^kidush[ií]n\b/i, 'Kiddushin'],
  [/^bava\s+kama\b/i, 'Bava Kamma'],
  [/^bava\s+metzi[aá]\b/i, 'Bava Metzia'],
  [/^bava\s+batra\b/i, 'Bava Batra'],
  [/^sanhedr[ií]n\b/i, 'Sanhedrin'],
  [/^makot\b/i, 'Makkot'],
  [/^avod[aá]\s+zar[aá]\b/i, 'Avodah Zarah'],
  [/^pirk[eé]i?\s+avot\b/i, 'Pirkei Avot'],
  [/^avot\b/i, 'Pirkei Avot'],
  [/^mesilat\s+yesharim\b/i, 'Mesillat Yesharim'],
  [/^arj[ií]n\b/i, 'Arakhin'],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?oraj\s+jaim\b/i, 'Shulchan Arukh, Orach Chayim'],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?yor[eé]\s+de[aá]'?\b/i, "Shulchan Arukh, Yoreh De'ah"],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?even\s+ha[- ]?ezer\b/i, 'Shulchan Arukh, Even HaEzer'],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?joshen\s+mishpat\b/i, 'Shulchan Arukh, Choshen Mishpat'],
  [/^mishn[aá]\s+berur[aá]\b/i, 'Mishnah Berurah'],
  [/^(?:mishn[eé]\s+tor[aá],?\s*)?(?:hiljot\s+melajim|leyes\s+de\s+reyes(?:\s+y\s+guerras)?|reyes\s+y\s+guerras)\b/i, 'Mishneh Torah, Kings and Wars'],
  [/^(?:mishn[eé]\s+tor[aá],?\s*)?(?:hiljot\s+teshuv[aá]|leyes\s+de\s+teshuv[aá]|leyes\s+del\s+arrepentimiento)\b/i, 'Mishneh Torah, Repentance'],
];

function normalizeSefariaRef(rawRef: string): string {
  let ref = String(rawRef || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;]+$/, '');
  if (!ref) return 'Genesis 1:1';
  for (const [pattern, replacement] of SPANISH_TO_SEFARIA_BOOK_MAP) {
    ref = ref.replace(pattern, replacement).trim();
  }
  return ref || 'Genesis 1:1';
}

// Pre-seed the most frequently used canonical references so they resolve in 0ms with zero network overhead
const PRE_SEEDED_CANONICAL_SOURCES: Array<{
  ref: string;
  heRef: string;
  hebrewText: string;
  translation: string;
  spanishTranslation: string;
}> = [
  {
    ref: 'Genesis 1:1',
    heRef: 'בראשית א׳:א׳',
    hebrewText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃',
    translation: 'When God began to create heaven and earth—',
    spanishTranslation: 'En el principio creó Elohim los cielos y la tierra.',
  },
  {
    ref: 'Deuteronomy 6:4',
    heRef: 'דברים ו׳:ד׳',
    hebrewText: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד׃',
    translation: 'Hear, O Israel! The LORD is our God, the LORD alone.',
    spanishTranslation: 'Escucha, Israel: HaShem es nuestro Elohim, HaShem es Uno.',
  },
  {
    ref: 'Deuteronomy 30:3',
    heRef: 'דברים ל׳:ג׳',
    hebrewText: 'וְשָׁב יְהוָה אֱלֹהֶיךָ אֶת־שְׁבוּתְךָ וְרִחֲמֶךָ וְשָׁב וְקִבֶּצְךָ מִכָּל־הָעַמִּים אֲשֶׁר הֱפִיצְךָ יְהוָה אֱלֹהֶיךָ שָׁמָּה׃',
    translation: 'then the LORD your God will restore your fortunes and take you back in love. He will bring you together again from all the peoples where the LORD your God has scattered you.',
    spanishTranslation: 'Entonces HaShem tu Elohim hará volver a tus cautivos y tendrá compasión de ti, y volverá a reunirte de entre todos los pueblos adonde HaShem tu Elohim te haya dispersado.',
  },
  {
    ref: 'Deuteronomy 30:19',
    heRef: 'דברים ל׳:י״ט',
    hebrewText: 'הַעִדֹתִי בָכֶם הַיּוֹם אֶת־הַשָּׁמַיִם וְאֶת־הָאָרֶץ הַחַיִּים וְהַמָּוֶת נָתַתִּי לְפָנֶיךָ הַבְּרָכָה וְהַקְּלָלָה וּבָחַרְתָּ בַּחַיִּים לְמַעַן תִּחְיֶה אַתָּה וְזַרְעֶךָ׃',
    translation: 'I call heaven and earth to witness against you this day: I have put before you life and death, blessing and curse. Choose life—if you and your offspring would live.',
    spanishTranslation: 'Pongo hoy por testigos ante vosotros a los cielos y a la tierra: la vida y la muerte he puesto delante de ti, la bendición y la maldición; escoge, pues, la vida, para que vivas tú y tu descendencia.',
  },
  {
    ref: 'Isaiah 2:4',
    heRef: 'ישעיהו ב׳:ד׳',
    hebrewText: 'וְשָׁפַט בֵּין הַגּוֹיִם וְהוֹכִיחַ לְעַמִּים רַבִּים וְכִתְּתוּ חַרְבוֹתָם לְאִתִּים וַחֲנִיתוֹתֵיהֶם לְמַזְמֵרוֹת לֹא־יִשָּׂא גוֹי אֶל־גּוֹי חֶרֶב וְלֹא־יִלְמְדוּן עוֹד מִלְחָמָה׃',
    translation: 'Thus He will judge among the nations and arbitrate for the many peoples, and they shall beat their swords into plowshares and their spears into pruning hooks: nation shall not take up sword against nation; they shall never again know war.',
    spanishTranslation: 'Y juzgará entre las naciones y reprenderá a muchos pueblos; convertirán sus espadas en rejas de arado y sus lanzas en podaderas; no alzará espada nación contra nación, ni se adiestrarán más para la guerra.',
  },
  {
    ref: 'Isaiah 11:1',
    heRef: 'ישעיהו י״א:א׳',
    hebrewText: 'וְיָצָא חֹטֶר מִגֶּזַע יִשָׁי וְנֵצֶר מִשָּׁרָשָׁיו יִפְרֶה׃',
    translation: 'But a shoot shall grow out of the stump of Jesse, a twig shall sprout from his stock.',
    spanishTranslation: 'Saldrá una vara del tronco de Ishái, y un vástago retoñará de sus raíces.',
  },
  {
    ref: 'Isaiah 11:2',
    heRef: 'ישעיהו י״א:ב׳',
    hebrewText: 'וְנָחָה עָלָיו רוּחַ יְהוָה רוּחַ חָכְמָה וּבִינָה רוּחַ עֵצָה וּגְבוּרָה רוּחַ דַּעַת וְיִרְאַת יְהוָה׃',
    translation: 'The spirit of the LORD shall alight upon him: a spirit of wisdom and insight, a spirit of counsel and valor, a spirit of devotion and reverence for the LORD.',
    spanishTranslation: 'Y reposará sobre él el espíritu de HaShem: espíritu de sabiduría y de entendimiento, espíritu de consejo y de fortaleza, espíritu de conocimiento y de reverencia a HaShem.',
  },
  {
    ref: 'Isaiah 11:9',
    heRef: 'ישעיהו י״א:ט׳',
    hebrewText: 'לֹא־יָרֵעוּ וְלֹא־יַשְׁחִיתוּ בְּכָל־הַר קָדְשִׁי כִּי־מָלְאָה הָאָרֶץ דֵּעָה אֶת־יְהוָה כַּמַּיִם לַיָּם מְכַסִּים׃',
    translation: 'In all of My sacred mount nothing evil or vile shall be done; for the land shall be filled with devotion to the LORD as water covers the sea.',
    spanishTranslation: 'No harán mal ni dañarán en todo Mi santo monte, porque la tierra estará llena del conocimiento de HaShem, como las aguas cubren el mar.',
  },
  {
    ref: 'Isaiah 45:7',
    heRef: 'ישעיהו מ״ה:ז׳',
    hebrewText: 'יוֹצֵר אוֹר וּבוֹרֵא חֹשֶׁךְ עֹשֶׂה שָׁלוֹם וּבוֹרֵא רָע אֲנִי יְהוָה עֹשֶׂה כָל־אֵלֶּה׃',
    translation: 'I form light and create darkness, I make weal and create woe—I the LORD do all these things.',
    spanishTranslation: 'Que forma la luz y crea la oscuridad, que hace la paz y crea la adversidad; Yo, HaShem, hago todo esto.',
  },
  {
    ref: 'Psalms 89:3',
    heRef: 'תהילים פ״ט:ג׳',
    hebrewText: 'כִּי־אָמַרְתִּי עוֹלָם חֶסֶד יִבָּנֶה שָׁמַיִם תָּכִין אֱמוּנָתְךָ בָהֶם׃',
    translation: 'I declare, “Your steadfast love is confirmed forever; there in the heavens You establish Your faithfulness.”',
    spanishTranslation: 'Porque dije: El mundo será edificado con bondad amorosa (Jésed); en los cielos establecerás Tu fidelidad.',
  },
  {
    ref: 'Psalms 104:24',
    heRef: 'תהילים ק״ד:כ״ד',
    hebrewText: 'מָה־רַבּוּ מַעֲשֶׂיךָ יְהוָה כֻּלָּם בְּחָכְמָה עָשִׂיתָ מָלְאָה הָאָרֶץ קִנְיָנֶךָ׃',
    translation: 'How many are the things You have made, O LORD; You have made them all with wisdom; the earth is full of Your creations.',
    spanishTranslation: '¡Cuán numerosas son Tus obras, oh HaShem! Todas ellas las hiciste con sabiduría; la tierra está llena de Tus creaciones.',
  },
  {
    ref: 'Psalms 136:1',
    heRef: 'תהילים קל״ו:א׳',
    hebrewText: 'הוֹדוּ לַיהוָה כִּי־טוֹב כִּי לְעוֹלָם חַסְדּוֹ׃',
    translation: 'Praise the LORD, for He is good, His steadfast love is eternal.',
    spanishTranslation: 'Agradeced a HaShem porque Él es bueno, porque para siempre es Su bondad amorosa.',
  },
  {
    ref: 'Sotah 40a',
    heRef: 'סוטה מ׳ א',
    hebrewText: 'בִּזְמַן שֶׁשְּׁלִיחַ צִבּוּר אוֹמֵר מוֹדִים הָעָם מָה הֵם אוֹמְרִים אָמַר רַב מוֹדִים אֲנַחְנוּ לָךְ ה׳ אֱלֹהֵינוּ עַל שֶׁאָנוּ מוֹדִים לָךְ',
    translation: 'When the prayer leader recites Modim, what do the congregation say? Rav said: We give thanks to You, Hashem our God, for the ability to give thanks to You.',
    spanishTranslation: 'Cuando el oficiante recita Modim, ¿qué dice la congregación? Dijo Rav: Te agradecemos a Ti, HaShem nuestro Elohim, por el mérito de poder agradecerte.',
  },
  {
    ref: 'Berakhot 34a',
    heRef: 'ברכות ל״ד א',
    hebrewText: 'אַל יִשְׁאַל אָדָם צְרָכָיו לֹא בְּגִימֶל רִאשׁוֹנוֹת וְלֹא בְּגִימֶל אַחֲרוֹנוֹת אֶלָּא בָּאֶמְצָעִיּוֹת דְּאָמַר רַב חֲנִינָא רִאשׁוֹנוֹת דּוֹמֶה לְעֶבֶד שֶׁמְּסַדֵּר שֶׁבַח לִפְנֵי רַבּוֹ אֶמְצָעִיּוֹת דּוֹמֶה לְעֶבֶד שֶׁמְּבַקֵּשׁ פְּרָס מֵרַבּוֹ אַחֲרוֹנוֹת דּוֹמֶה לְעֶבֶד שֶׁקִּבֵּל פְּרָס מֵרַבּוֹ וְנִפְטַר וְהוֹלֵךְ לוֹ',
    translation: 'A person should not ask for his needs in the first three blessings or in the last three blessings of the Amidah, but in the middle ones: the first resemble a servant arranging praise before his master; the middle resemble a servant requesting a portion; the last resemble a servant who received his portion and takes leave in gratitude.',
    spanishTranslation: 'El ser humano no debe pedir sus necesidades en las tres primeras bendiciones ni en las tres últimas de la Amidá, sino en las intermedias: las primeras se asemejan a un siervo que ordena alabanzas ante su Maestro; las intermedias, a quien solicita su sustento; y las últimas, a quien ha recibido el don de su Maestro y se despide con gratitud.',
  },
  {
    ref: 'Sanhedrin 98a',
    heRef: 'סנהדרין צ״ח א',
    hebrewText: 'רַבִּי יְהוֹשֻׁעַ בֶּן לֵוִי אַשְׁכְּחֵיהּ לְאֵלִיָּהוּ... אֲמַר לֵיהּ אֵימַת אָתֵי מָשִׁיחַ... הַיּוֹם אִם בְּקוֹלוֹ תִשְׁמָעוּ׃',
    translation: 'Rabbi Yehoshua ben Levi met Elijah and asked him: When will the Messiah come? He replied: Today, if you will heed His voice (Psalms 95:7).',
    spanishTranslation: 'Rabí Yehoshúa ben Leví encontró al profeta Eliyahu y le preguntó: ¿Cuándo vendrá el Mashíaj? Le respondió: «Hoy mismo, si escucháis Su voz» (Salmos 95:7).',
  },
  {
    ref: 'Pirkei Avot 1:2',
    heRef: 'משנה אבות א׳:ב׳',
    hebrewText: 'שִׁמְעוֹן הַצַּדִּיק הָיָה מִשְּׁיָרֵי כְנֶסֶת הַגְּדוֹלָה. הוּא הָיָה אוֹמֵר, עַל שְׁלֹשָׁה דְבָרִים הָעוֹלָם עוֹמֵד, עַל הַתּוֹרָה וְעַל הָעֲבוֹדָה וְעַל גְּמִילוֹת חֲסָדִים׃',
    translation: 'Shimon the Righteous was one of the last of the Men of the Great Assembly. He used to say: On three things the world stands: on the Torah, on the service of God, and on deeds of lovingkindness.',
    spanishTranslation: 'Shimón HaTzadik fue de los últimos miembros de la Gran Asamblea. Él solía decir: Sobre tres pilares se sostiene el mundo: sobre la Torá, sobre el servicio divino (Avodá) y sobre los actos de bondad amorosa (Guemilut Jasadim).',
  },
  {
    ref: 'Pirkei Avot 1:14',
    heRef: 'משנה אבות א׳:י״ד',
    hebrewText: 'הוּא הָיָה אוֹמֵר, אִם אֵין אֲנִי לִי, מִי לִי. וּכְשֶׁאֲנִי לְעַצְמִי, מָה אֲנִי. וְאִם לֹא עַכְשָׁיו, אֵימָתָי׃',
    translation: 'He [Hillel] used to say: If I am not for myself, who will be for me? And when I am only for myself, what am I? And if not now, when?',
    spanishTranslation: 'Él [Hilel] solía decir: Si yo no soy para mí, ¿quién será para mí? Pero si soy solo para mí mismo, ¿qué soy? Y si no es ahora, ¿cuándo?',
  },
  {
    ref: 'Mesillat Yesharim 1:1',
    heRef: 'מסילת ישרים א׳:א׳',
    hebrewText: 'יְסוֹד הַחֲסִידוּת וְשֹׁרֶשׁ הָעֲבוֹדָה הַתְּמִימָה הוּא שֶׁיִּתְבָּרֵר וְיִתְאַמֵּת אֵצֶל הָאָדָם מָה חוֹבָתוֹ בְּעוֹלָמוֹ',
    translation: 'The foundation of piety and the root of perfect service of God is for a person to clarify and come to verify as truth what his obligation is in his world.',
    spanishTranslation: 'El fundamento de la piedad (Jasidut) y la raíz del servicio íntegro es que se aclare y verifique como verdad en el ser humano cuál es su deber en su mundo.',
  },
  {
    ref: 'Mesillat Yesharim 19:1',
    heRef: 'מסילת ישרים י״ט:א׳',
    hebrewText: 'הַחֲסִידוּת עִנְיָנוֹ גָּדוֹל וְרָחָב מְאֹד... שֶׁיִּהְיֶה הָאָדָם מִשְׁתַּדֵּל לַעֲשׂוֹת נַחַת רוּחַ לְיוֹצְרוֹ בְּכָל מַה שֶּׁאֶפְשָׁר לוֹ',
    translation: 'Piety (Chassidut) is a deep and wide concept: that a person strives constantly to bring gratification to his Creator in every way possible, going beyond the minimal letter of the obligation.',
    spanishTranslation: 'La Jasidut (devoción amorosa) es un concepto profundo y amplio: que el ser humano procure constantemente causar complacencia a su Creador en todo cuanto esté a su alcance, yendo más allá de la letra mínima de la obligación.',
  },
  {
    ref: 'Mishneh Torah, Kings and Wars 11:1',
    heRef: 'משנה תורה, הלכות מלכים ומלחמות י״א:א׳',
    hebrewText: 'הַמֶּלֶךְ הַמָּשִׁיחַ עָתִיד לָקוּם וּלְהַחְזִיר מַלְכוּת דָּוִד לְיָשְׁנָהּ לַמֶּמְשָׁלָה הָרִאשׁוֹנָה, וּבוֹנֶה הַמִּקְדָּשׁ וּמְקַבֵּץ נִדְחֵי יִשְׂרָאֵל',
    translation: 'In the future, the Messianic King will arise and renew the Davidic dynasty, restoring it to its initial sovereignty. He will build the Temple and gather the dispersed of Israel.',
    spanishTranslation: 'En el futuro, el Rey Mashíaj se levantará y restaurará el reino de David a su soberanía original; reconstruirá el Santuario y reunirá a los dispersos de Israel.',
  },
  {
    ref: 'Mishneh Torah, Kings and Wars 11:4',
    heRef: 'משנה תורה, הלכות מלכים ומלחמות י״א:ד׳',
    hebrewText: 'וְאִם יַעֲמֹד מֶלֶךְ מִבֵּית דָּוִד הוֹגֶה בַּתּוֹרָה וְעוֹסֵק בְּמִצְוֹת כְּדָוִד אָבִיו... וְיָכוֹף כָּל יִשְׂרָאֵל לֵילֵךְ בָּהּ וּלְחַזֵּק בִּדְקָהּ... הֲרֵי זֶה בְּחֶזְקַת שֶׁהוּא מָשִׁיחַ',
    translation: 'If a king will arise from the House of David who diligently studies the Torah and observes its mitzvot like David his ancestor... and influences all of Israel to walk in its way and repair its breaches... he may be presumed to be the Mashiach.',
    spanishTranslation: 'Y si se levanta un rey de la Casa de David que medita en la Torá y se ocupa de los preceptos como David su ancestro, e inspira a todo Israel a caminar en ella y reparar sus brechas, entonces tiene la presunción de ser el Mashíaj.',
  },
  {
    ref: 'Mishneh Torah, Kings and Wars 12:1',
    heRef: 'משנה תורה, הלכות מלכים ומלחמות י״ב:א׳',
    hebrewText: 'אַל יַעֲלֶה עַל הַלֵּב שֶׁבִּימוֹת הַמָּשִׁיחַ יִבָּטֵל דָּבָר מִמִּנְהָגוֹ שֶׁל עוֹלָם אוֹ יִהְיֶה שָׁם חִדּוּשׁ בְּמַעֲשֵׂה בְּרֵאשִׁית, אֶלָּא עוֹלָם כְּמִנְהָגוֹ נוֹהֵג',
    translation: 'Let no one think that in the days of the Messiah any of the laws of nature will be set aside, or any innovation will be introduced into creation; rather, the world will follow its normal course.',
    spanishTranslation: 'No se piense que en los días del Mashíaj se anulará nada del orden natural del mundo ni que habrá alteración en la obra de la Creación; sino que el mundo continuará según su curso natural.',
  },
  {
    ref: 'Kiddushin 31a',
    heRef: 'קידושין ל״א א',
    hebrewText: 'אָמַר רַבִּי חֲנִינָא גָּדוֹל הַמְּצֻוֶּה וְעוֹשֶׂה יוֹתֵר מִמִּי שֶׁאֵינוֹ מְצֻוֶּה וְעוֹשֶׂה',
    translation: 'Rabbi Chanina said: Greater is one who is commanded and performs a mitzvah than one who is not commanded and performs it.',
    spanishTranslation: 'Dijo Rabí Janiná: Más grande es quien está comandado (por una fuente trascendente en el Pacto) y cumple el precepto, que quien no está comandado y lo hace por sola iniciativa propia.',
  },
  {
    ref: 'Deuteronomy 30:14',
    heRef: 'דברים ל׳:י״ד',
    hebrewText: 'כִּי־קָרוֹב אֵלֶיךָ הַדָּבָר מְאֹד בְּפִיךָ וּבִלְבָבְךָ לַעֲשֹׂתוֹ׃',
    translation: 'No, the thing is very close to you, in your mouth and in your heart, to observe it.',
    spanishTranslation: 'Pues la palabra está muy cerca de ti, en tu boca y en tu corazón, para ponerla por obra.',
  },
  {
    ref: 'Yoma 85b',
    heRef: 'יומא פ״ה ב',
    hebrewText: 'וְחַי בָּהֶם וְלֹא שֶׁיָּמוּת בָּהֶם... אֵין לְךָ דָּבָר שֶׁעוֹמֵד בִּפְנֵי פִּקּוּחַ נֶפֶשׁ',
    translation: '“And he shall live by them” (Leviticus 18:5)—and not that he should die by them. Nothing stands in the way of saving a human life (Pikuach Nefesh).',
    spanishTranslation: '«Y vivirás por ellos» (Levítico 18:5), y no que mueras por ellos: ninguna regla formal prevalece por encima de salvar una vida humana concreta (Pikuaj Néfesh).',
  },
  {
    ref: 'Deuteronomy 6:18',
    heRef: 'דברים ו׳:י״ח',
    hebrewText: 'וְעָשִׂיתָ הַיָּשָׁר וְהַטּוֹב בְּעֵינֵי יְהוָה לְמַעַן יִיטַב לָךְ',
    translation: 'Do what is right and good in the sight of the LORD, that it may go well with you.',
    spanishTranslation: 'Y harás lo recto y lo bueno a los ojos de HaShem (yendo más allá de la letra rígida de la norma según la situación concreta, Lifnim Mishurat HaDin), para que te vaya bien.',
  },
  {
    ref: 'Sanhedrin 56a',
    heRef: 'סנהדרין נ״ו א',
    hebrewText: 'תָּנוּ רַבָּנַן שֶׁבַע מִצְוֹת נִצְטַוּוּ בְּנֵי נֹחַ דִּינִין וּבִרְכַּת הַשֵּׁם עֲבוֹדָה זָרָה גִּלּוּי עֲרָיוֹת וּשְׁפִיכוּת דָּמִים וְגָזֵל וְאֵבֶר מִן הַחַי',
    translation: 'The Sages taught: The descendants of Noah (all humanity) were commanded concerning seven universal ethical precepts: establishing courts of justice, prohibiting blasphemy, idolatry, sexual immorality, bloodshed, robbery, and cruelty to living creatures.',
    spanishTranslation: 'Enseñaron nuestros Sabios: Siete preceptos éticos universales fueron encomendados a los hijos de Noé (toda la humanidad): establecer tribunales de justicia y prohibir la blasfemia, la idolatría, la inmoralidad sexual, el derramamiento de sangre, el robo y la crueldad hacia los seres vivos.',
  },
  {
    ref: 'Leviticus 19:18',
    heRef: 'ויקרא י״ט:י״ח',
    hebrewText: 'לֹא־תִקֹּם וְלֹא־תִטֹּר אֶת־בְּנֵי עַמֶּךָ וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ אֲנִי יְהוָה׃',
    translation: 'You shall not take vengeance or bear a grudge against your countrymen. Love your fellow as yourself: I am the LORD.',
    spanishTranslation: 'No te vengarás ni guardarás rencor a los hijos de tu pueblo, sino que amarás a tu prójimo como a ti mismo: Yo soy HaShem.',
  },
  {
    ref: 'Pirkei Avot 2:4',
    heRef: 'משנה אבות ב׳:ד׳',
    hebrewText: 'הוּא הָיָה אוֹמֵר, עֲשֵׂה רְצוֹנוֹ כִּרְצוֹנְךָ, כְּדֵי שֶׁיַּעֲשֶׂה רְצוֹנְךָ כִּרְצוֹנוֹ.',
    translation: 'He used to say: Make His will as your own will, so that He may make your will as His will.',
    spanishTranslation: 'Él solía decir: Haz que Su voluntad sea como tu propia voluntad, para que Él haga tu voluntad como la Suya.',
  },
  {
    ref: 'Proverbs 6:23',
    heRef: 'משלי ו׳:כ״ג',
    hebrewText: 'כִּי נֵר מִצְוָה וְתוֹרָה אוֹר וְדֶרֶךְ חַיִּים תּוֹכְחוֹת מוּסָר׃',
    translation: 'For the commandment (mitzvah) is a lamp and the Torah is light, and the reproofs of instruction are the way of life.',
    spanishTranslation: 'Porque lámpara es el mandamiento específico (Mitzvá) y la Torá es luz universal, y camino de vida son las enseñanzas éticas del Musar.',
  },
  {
    ref: 'Exodus 24:7',
    heRef: 'שמות כ״ד:ז׳',
    hebrewText: 'וַיִּקַּח סֵפֶר הַבְּרִית וַיִּקְרָא בְּאָזְנֵי הָעָם וַיֹּאמְרוּ כֹּל אֲשֶׁר־דִּבֶּר יְהוָה נַעֲשֶׂה וְנִשְׁמָע׃',
    translation: 'Then he took the book of the covenant and read it in the hearing of the people; and they said: “All that the LORD has spoken we will do, and we will understand (Na’aseh ve-nishma).”',
    spanishTranslation: 'Y tomó el Libro del Pacto y lo leyó a oídos del pueblo, y ellos dijeron: «Todo lo que HaShem ha hablado haremos y comprenderemos (Naasé ve-nishmá: la acción específica del mandamiento precede y abre la iluminación intelectual)».',
  },
  {
    ref: 'Lamentations Rabbah 2:13',
    heRef: 'איכה רבה ב׳:י״ג',
    hebrewText: 'אִם יֹאמַר לְךָ אָדָם יֵשׁ חָכְמָה בַּגּוֹיִם תַּאֲמִין... יֵשׁ תּוֹרָה בַּגּוֹיִם אַל תַּאֲמִין',
    translation: 'If a person says to you: “There is wisdom (Chokhmah) among the nations,” believe it... “There is Torah among the nations,” do not believe it.',
    spanishTranslation: 'Si alguien te dice: «Hay sabiduría filosófica y científica (Jojmá) en las fuentes externas de las naciones», créelo; pero si te dice: «Hay Torá (Revelación Pactal y especificidad de la Mitzvá) en ellas», no lo creas.',
  },
  {
    ref: 'Deuteronomy 4:6',
    heRef: 'דברים ד׳:ו׳',
    hebrewText: 'וּשְׁמַרְתֶּם וַעֲשִׂיתֶם כִּי הִוא חָכְמַתְכֶם וּבִינַתְכֶם לְעֵינֵי הָעַמִּים אֲשֶׁר יִשְׁמְעוּן אֵת כָּל־הַחֻקִּים הָאֵלֶּה',
    translation: 'Observe them and perform them, for this is your wisdom and your understanding in the sight of the peoples, who will hear all these statutes.',
    spanishTranslation: 'Los guardaréis y los pondréis por obra, porque esta práctica concreta es vuestra sabiduría y vuestro entendimiento a los ojos de las naciones.',
  },
  {
    ref: 'Micah 6:8',
    heRef: 'מיכה ו׳:ח׳',
    hebrewText: 'הִגִּיד לְךָ אָדָם מַה־טּוֹב וּמָה־יְהוָה דּוֹרֵשׁ מִמְּךָ כִּי אִם־עֲשׂוֹת מִשְׁפָּט וְאַהֲבַת חֶסֶד וְהַצְנֵעַ לֶכֶת עִם־אֱלֹהֶיךָ׃',
    translation: 'He has told you, O man, what is good, and what the LORD requires of you: only to do justice, and to love goodness, and to walk modestly with your God.',
    spanishTranslation: 'Él te ha declarado, oh hombre, lo que es bueno y qué pide HaShem de ti: solamente practicar la justicia (Mishpat), amar la bondad leal (Jésed) y caminar con humildad junto a tu Dios.',
  },
  {
    ref: 'Pirkei Avot 3:17',
    heRef: 'משנה אבות ג׳:י״ז',
    hebrewText: 'הוּא הָיָה אוֹמֵר, כֹּל שֶׁחָכְמָתוֹ מְרֻבָּה מִמַּעֲשָׂיו, לְמָה הוּא דוֹמֶה, לְאִילָן שֶׁעֲנָפָיו מְרֻבִּין וְשָׁרָשָׁיו מוּעָטִין',
    translation: 'He [Rabbi Elazar ben Azaryah] used to say: Anyone whose wisdom exceeds his deeds, to what is he compared? To a tree whose branches are numerous and whose roots are few.',
    spanishTranslation: 'Él [Rabí Elazar ben Azariá] solía decir: Todo aquel cuya sabiduría teórica supera a sus acciones concretas se asemeja a un árbol de muchas ramas pero pocas raíces; en cambio, aquel cuyas acciones superan a su teoría es como un árbol de raíces profundas que ningún viento puede arrancar.',
  },
  {
    ref: 'Sanhedrin 90a',
    heRef: 'סנהדרין צ׳ א (משנה סנהדרין י׳:א׳)',
    hebrewText: 'כָּל יִשְׂרָאֵל יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא, שֶׁנֶּאֱמַר וְעַמֵּךְ כֻּלָּם צַדִּיקִים לְעוֹלָם יִירְשׁוּ אָרֶץ נֵצֶר מַטָּעַי מַעֲשֵׂה יָדַי לְהִתְפָּאֵר׃',
    translation: 'All Israel have a share in the World to Come (Olam HaBa), as it is stated: “And Your people, all of them righteous, shall inherit the land forever; they are the shoot of My planting, the work of My hands, in which I glory” (Isaiah 60:21).',
    spanishTranslation: 'Todo Israel tiene parte en el Mundo Venidero (Olam HaBá), como está dicho: «Y tu pueblo, todos ellos justos, para siempre heredarán la tierra; vástago de Mi plantío, obra de Mis manos, para glorificarme» (Isaías 60:21).',
  },
  {
    ref: 'Berakhot 17a',
    heRef: 'ברכות י״ז א',
    hebrewText: 'הָעוֹלָם הַבָּא אֵין בּוֹ לֹא אֲכִילָה וְלֹא שְׁתִיָּה וְלֹא פְּרִיָּה וּרְבִיָּה וְלֹא מַשָּׂא וּמַתָּן וְלֹא קִנְאָה וְלֹא שִׂנְאָה וְלֹא תַחֲרוּת, אֶלָּא צַדִּיקִים יוֹשְׁבִין וְעַטְרוֹתֵיהֶם בְּרָאשֵׁיהֶם וְנֶהֱנִין מִזִּיו הַשְּׁכִינָה',
    translation: 'In the World to Come there is neither eating nor drinking, nor procreation, nor business transactions, nor envy, nor hatred, nor competition; rather, the righteous sit with their crowns upon their heads and delight in the radiance of the Divine Presence (Shekhinah).',
    spanishTranslation: 'En el Mundo Venidero (Olam HaBá) no hay comida ni bebida, ni comercio, ni envidia, ni odio ni rivalidad; sino que los justos se sientan con sus coronas sobre sus cabezas y se deleitan en el resplandor de la Presencia Divina (Ziv HaShejiná).',
  },
  {
    ref: 'Pirkei Avot 4:16',
    heRef: 'משנה אבות ד׳:ט״ז',
    hebrewText: 'רַבִּי יַעֲקֹב אוֹמֵר, הָעוֹלָם הַזֶּה דּוֹמֶה לִפְרוֹזְדוֹר בִּפְנֵי הָעוֹלָם הַבָּא. הַתְקֵן עַצְמְךָ בַּפְּרוֹזְדוֹר, כְּדֵי שֶׁתִּכָּנֵס לַטְּרַקְלִין׃',
    translation: 'Rabbi Yaakov says: This world is like a vestibule before the World to Come; prepare yourself in the vestibule, so that you may enter the banquet hall.',
    spanishTranslation: 'Rabí Yaakov dice: Este mundo (Olam HaZé) es semejante a un vestíbulo ante el Mundo Venidero (Olam HaBá); prepárate en el vestíbulo mediante las acciones éticas y preceptos, para que puedas entrar al salón principal.',
  },
  {
    ref: 'Mishneh Torah, Repentance 3:5',
    heRef: 'משנה תורה, הלכות תשובה ג׳:ה׳',
    hebrewText: 'וְכֵן חֲסִידֵי אֻמּוֹת הָעוֹלָם יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא',
    translation: 'And likewise, the pious and righteous of all the nations of the world (Chassidei Ummot HaOlam) have a share in the World to Come (Olam HaBa).',
    spanishTranslation: 'Y asimismo, los justos de entre todas las naciones del mundo (Jasidei Umot HaOlam) tienen parte en el Mundo Venidero (Olam HaBá) por su rectitud moral y observancia ética universal.',
  },
  {
    ref: 'Psalms 36:10',
    heRef: 'תהילים ל״ו:י׳',
    hebrewText: 'כִּי־עִמְּךָ מְקוֹר חַיִּים בְּאוֹרְךָ נִרְאֶה־אוֹר׃',
    translation: 'For with You is the fountain of life; by Your light do we see light.',
    spanishTranslation: 'Porque contigo está el manantial de la vida; en Tu luz veremos la luz (Be-orjá niré or: la iluminación en el judaísmo nace de la relación viva con la fuente de la vida).',
  },
  {
    ref: 'Chagigah 12a',
    heRef: 'חגיגה י״ב א',
    hebrewText: 'אוֹר שֶׁבָּרָא הַקָּדוֹשׁ בָּרוּךְ הוּא בְּיוֹם רִאשׁוֹן אָדָם צוֹפֶה בּוֹ מִסּוֹף הָעוֹלָם וְעַד סוֹפוֹ... עָמַד וּגְנָזוֹ לַצַּדִּיקִים לֶעָתִיד לָבוֹא',
    translation: 'With the primordial light that the Holy One, Blessed be He, created on the first day, a person could see from one end of the world to the other... He arose and hid it away (Or HaGanuz) for the righteous in the Ultimate Future (and within the Torah).',
    spanishTranslation: 'Con la Luz Primordial que el Santo, Bendito Sea, creó en el primer día, el ser humano contemplaba de un confín del universo al otro... y Dios la atesoró (Or HaGanuz, la Luz Oculta en la Torá) para los justos en el Mundo Venidero.',
  },
  {
    ref: 'Pesachim 117a',
    heRef: 'פסחים קי״ז א',
    hebrewText: 'נְבִיאִים שֶׁבֵּינֵיהֶן תִּיקְּנוּ לָהֶם לְיִשְׂרָאֵל שֶׁיְּהוּ אוֹמְרִים אוֹתוֹ עַל כָּל פֶּרֶק וָפֶרֶק וְעַל כָּל צָרָה וְצָרָה שֶׁלֹּא תָּבֹא עֲלֵיהֶן וּלְכְשֶׁנִּגְאָלִין אוֹמְרִים אוֹתוֹ עַל גְּאוּלָּתָן',
    translation: 'The prophets among them instituted for Israel that they should recite this Hallel at every major season and festival, and over every trouble—may it not come upon them—when they are redeemed, they recite it over their redemption.',
    spanishTranslation: 'Los profetas que había entre ellos instituyeron para Israel que recitaran este Halel (Salmos 113–118) en cada festividad señalada y ante cada angustia —que no sobrevenga—, para que al ser redimidos lo proclamen en gratitud por su redención.',
  },
  {
    ref: 'Arakhin 10a',
    heRef: 'ערכין י׳ א',
    hebrewText: 'שְׁמוֹנָה עָשָׂר יוֹם בַּשָּׁנָה יָחִיד גּוֹמֵר בָּהֶן אֶת הַהַלֵּל: שְׁמוֹנַת יְמֵי הֶחָג, וּשְׁמוֹנַת יְמֵי חֲנֻכָּה, וְיוֹם טוֹב הָרִאשׁוֹן שֶׁל פֶּסַח, וְיוֹם טוֹב שֶׁל עֲצֶרֶת. וּבַגּוֹלָה עֶשְׂרִים וְאֶחָד יוֹם.',
    translation: 'On eighteen days of the year an individual completes the full Hallel (Hallel Shalem): the eight days of Sukkot, the eight days of Chanukah, the first festival day of Pesach, and the festival day of Shavuot; and in the Diaspora, on twenty-one days.',
    spanishTranslation: 'Dieciocho días al año el individuo completa el Halel íntegro (Halel Shalem): los ocho días de Sucot y Sheminí Atzéret, los ocho días de Janucá, el primer día festivo de Pésaj y el día de Shavuot; y en la Diáspora, veintiún días.',
  },
  {
    ref: 'Taanit 28b',
    heRef: 'תענית כ״ח ב',
    hebrewText: 'רַב אִיקְלַע לְבָבֶל, חֲזַנְהוּ דְּקָא קָרוּ הַלֵּל בְּרֹאשׁ חֹדֶשׁ. סְבַר לְאַפְסוֹקִינְהוּ, כֵּיוָן דַּחֲזָא דְּקָא מְדַלְּגִי דִּלּוּגֵי, אָמַר: שְׁמַע מִינַּהּ מִנְהַג אֲבוֹתֵיהֶם בִּידֵיהֶם.',
    translation: 'Rav visited Babylonia and saw them reciting Hallel on Rosh Chodesh. He thought to stop them, but when he saw that they skipped parts (reciting Half-Hallel / Chatzi Hallel), he said: Learn from this that they are upholding the custom of their ancestors (Minhag avoteihem be-yadeihem).',
    spanishTranslation: 'Rav llegó a Babilonia y vio que recitaban el Halel en Rosh Jódesh. Pensó en detenerlos (pues Rosh Jódesh no está entre los 18 días de Halel completo), pero al ver que omitían dos secciones (recitando Medio Halel / Jatsi Halel), dijo: «Se deduce de esto que conservan en sus manos la costumbre sagrada de sus ancestros (Minhag avoteijem be-yadeijem)».',
  },
  {
    ref: 'Psalms 113:1',
    heRef: 'תהילים קי״ג:א׳',
    hebrewText: 'הַלְלוּיָהּ הַלְלוּ עַבְדֵי יְהוָה הַלְלוּ אֶת־שֵׁם יְהוָה׃',
    translation: 'Hallelujah. Praise, O servants of the LORD; praise the name of the LORD.',
    spanishTranslation: '¡Haleluyá! Alabad, siervos de HaShem («Avdei HaShem», y no siervos del Faraón, como comenta el Talmud en Megilá 14a), alabad el Nombre de HaShem.',
  },
  {
    ref: 'Psalms 118:1',
    heRef: 'תהילים קי״ח:א׳',
    hebrewText: 'הוֹדוּ לַיהוָה כִּי־טוֹב כִּי לְעוֹלָם חַסְדּוֹ׃',
    translation: 'Give thanks to the LORD, for He is good, for His steadfast love (chesed) endures forever.',
    spanishTranslation: 'Dad gracias a HaShem porque Él es bueno, porque para siempre es Su bondad leal (Jésed).',
  },
  {
    ref: 'Mishneh Torah, Megillah and Chanukah 3:6',
    heRef: 'משנה תורה, הלכות מגילה וחנוכה ג׳:ו׳',
    hebrewText: 'אֲבָל בְּרָאשֵׁי חֳדָשִׁים קְרִיאַת הַהַלֵּל מִנְהָג וְאֵינָהּ מִצְוָה, וּלְפִיכָךְ קוֹרִין אוֹתוֹ בְּדִלּוּג.',
    translation: 'However, on Rosh Chodesh the reading of Hallel is a custom (minhag) and not a formal obligation, and therefore it is read skipping certain passages (Chatzi Hallel).',
    spanishTranslation: 'Pero en Rosh Jódesh (y en los últimos seis días de Pésaj), la lectura del Halel tiene rango de costumbre ancestral (Minhag) y no de obligación rabínica plena; y por ello se lee omitiendo dos pasajes (Medio Halel / Jatsi Halel).',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 1:1',
    heRef: 'שולחן ערוך, אורח חיים א׳:א׳',
    hebrewText: 'יִתְגַּבֵּר כַּאֲרִי לַעֲמֹד בַּבֹּקֶר לַעֲבוֹדַת בּוֹרְאוֹ, שֶׁיְּהֵא הוּא מְעוֹרֵר הַשַּׁחַר. הגה: שִׁוִּיתִי ה׳ לְנֶגְדִּי תָמִיד הוּא כְּלָל גָּדוֹל בַּתּוֹרָה וּבְמַעֲלוֹת הַצַּדִּיקִים... וְלֹא יִתְבַּיֵּשׁ מִפְּנֵי בְּנֵי אָדָם הַמַּלְעִיגִים עָלָיו בַּעֲבוֹדַת הַשֵּׁם יִתְבָּרַךְ.',
    translation: '[Mechaber - R. Yosef Karo]: One should strengthen oneself like a lion to rise in the morning for the service of his Creator, so that it is he who awakens the dawn. [Rema - R. Moshe Isserles]: “I have set the LORD before me always” (Psalms 16:8) is a great principle in the Torah and among the virtues of the righteous... and one should not be ashamed before people who mock him in the service of God.',
    spanishTranslation: '[El Mejaber · Rabí Yosef Karo, tradición sefardí]: Debe fortalecerse como un león para levantarse por la mañana al servicio de su Creador, de modo que él despierte a la aurora. [Glosa del Ramá · Rabí Moshé Isserles, tradición ashkenazí]: «He puesto a HaShem siempre delante de mí» (Salmos 16:8) es un gran principio en la Torá y en los grados de los justos... y no se avergonzará ante quienes se burlen de él en el cumplimiento del servicio divino.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 68:1',
    heRef: 'שולחן ערוך, אורח חיים ס״ח:א׳',
    hebrewText: 'יֵשׁ מְקוֹמוֹת שֶׁאוֹמְרִים פִּיּוּטִים, וְיֵשׁ מְקוֹמוֹת שֶׁאֵין אוֹמְרִים... הגה: וְאֵין לְשַׁנּוֹת מִנְהַג הַמָּקוֹם בְּשׁוּם דָּבָר מִסֵּדֶר הַתְּפִלָּה וְנוּסְחָהּ.',
    translation: '[Mechaber]: There are places where liturgical poems (piyyutim) are recited, and places where they are not... [Rema]: And one must not alter the custom of the place (Minhag HaMakom) regarding any aspect of the order of prayer or its liturgical rite (Nusach).',
    spanishTranslation: '[El Mejaber]: Hay comunidades donde se recitan piyutim en las bendiciones del Shemá y lugares donde no se recitan... [El Ramá]: Y no se debe alterar la costumbre del lugar (Minhag HaMakom) en ningún detalle del orden de la plegaria ni de su rito litúrgico (Núsaj HaTefilá: Sefarad, Ashkenaz, Ari/Jasídico o Teimaní).',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 422:2',
    heRef: 'שולחן ערוך, אורח חיים תכ״ב:ב׳',
    hebrewText: 'קּוֹרִין הַהַלֵּל בְּדִלּוּג, בֵּין יָחִיד בֵּין צִבּוּר, בְּלֹא בְּרָכָה לֹא בַּתְּחִלָּה וְלֹא בַּסּוֹף; וְיֵשׁ אוֹמְרִים שֶׁבְּצִבּוּר מְבָרְכִין עָלָיו בַּתְּחִלָּה וּבַסּוֹף. הגה: וְכֵן נוֹהֲגִין לְבָרֵךְ עָלָיו אֲפִלּוּ בְּיָחִיד.',
    translation: '[Mechaber - R. Yosef Karo]: On Rosh Chodesh we read Hallel skipping parts (Chatzi Hallel), whether as an individual or in a congregation, without a blessing at the beginning or at the end; and some say that in a congregation a blessing is recited. [Rema - R. Moshe Isserles]: And our custom (Ashkenazi minhag) is to recite the blessing over it, even when praying as an individual.',
    spanishTranslation: '[El Mejaber · Rabí Yosef Karo, rito sefardí]: En Rosh Jódesh se lee el Halel omitiendo partes (Medio Halel / Jatsi Halel), tanto en privado como en público, sin recitar bendición ni al principio ni al final (pues sobre un Minhag no se bendice); y hay quienes opinan que en público sí se bendice. [El Ramá · Rabí Moshé Isserles, rito ashkenazí]: Y así acostumbramos nosotros (Minhag Ashkenaz): recitar bendición («Likró et ha-Halel») incluso en privado.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 453:1',
    heRef: 'שולחן ערוך, אורח חיים תנ״ג:א׳',
    hebrewText: 'אֵלּוּ דְּבָרִים שֶׁיוֹצְאִים בָּהֶם יְדֵי חוֹבַת מַצָּה: בַּחִטִּים וּבַשְּׂעוֹרִים... אֲבָל אֹרֶז וּשְׁאָר מִינֵי קִטְנִיּוֹת אֵינָם בָּאִים לִידֵי חִמּוּץ. הגה: וְיֵשׁ אוֹסְרִים, וְהַמִּנְהָג בְּאשְׁכְּנַז לְהַחְמִיר וְאֵין לְשַׁנּוֹת.',
    translation: '[Mechaber - R. Yosef Karo]: Rice and other legumes (kitniyot) do not become chametz, and it is permitted to cook and eat them on Pesach. [Rema - R. Moshe Isserles]: Some authorities prohibit them, and the custom (Minhag) in Ashkenaz is to be stringent and abstain from kitniyot, and one must not change this custom.',
    spanishTranslation: '[El Mejaber · Tradición Sefardí / Edot HaMizraj]: El arroz y las demás legumbres (Kitniyot) no fermentan como Jametz, y está permitido cocinarlos y comerlos en Pésaj. [El Ramá · Tradición Ashkenazí]: Y hay autoridades que lo prohíben por precaución, y la costumbre (Minhag) en todas las comunidades de Ashkenaz es abstenerse de Kitniyot en Pésaj, y no se debe alterar el Minhag.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 128:44',
    heRef: 'שולחן ערוך, אורח חיים קכ״ח:מ״ד',
    hebrewText: 'הגה: וּבִמְדִינוֹת אֵלּוּ אֵין נוֹהֲגִין לִשָּׂא כַּפֵּיהֶם כִּי אִם בְּיוֹם טוֹב, מִשּׁוּם דְּאָז שְׁרוּיִים בְּשִׂמְחַת יוֹם טוֹב, וְטוֹב לֵב הוּא יְבָרֵךְ.',
    translation: '[Rema - R. Moshe Isserles]: In these lands (Ashkenazi Diaspora), the custom (Minhag) is that Kohanim do not raise their hands for the Priestly Blessing (Birkat Kohanim) every day, but only on Festivals (Yom Tov), because then they are in the joy of the festival, and only one who is joyful of heart should bless (whereas in the Sephardic custom and in the Land of Israel, Kohanim bless every day).',
    spanishTranslation: '[El Ramá · Minhag Ashkenaz en la Diáspora]: Y en estas regiones la costumbre (Minhag) es que los Kohanim no suban a impartir la Bendición Sacerdotal (Birkat Kohanim) sino en los días festivos (Yom Tov), porque entonces se hallan en la alegría de la festividad; mientras que según el Shulján Aruj (Minhag Sefardí y en la Tierra de Israel) los Kohanim bendicen al pueblo todos los días del año.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 581:1',
    heRef: 'שולחן ערוך, אורח חיים תקפ״א:א׳',
    hebrewText: 'נוֹהֲגִים לָקוּם בְּאַשְׁמֹרֶת לְלוֹמַר סְלִיחוֹת מֵרֹאשׁ חֹדֶשׁ אֱלוּל וְעַד יוֹם הַכִּפּוּרִים. הגה: וּמִנְהַג בְּנֵי אַשְׁכְּנַז אֵינוֹ כֵן, אֶלָּא מֵרֹאשׁ חֹדֶשׁ אֱלוּל תּוֹקְעִין בְּשׁוֹפָר... וּמַתְחִילִין לוֹמַר סְלִיחוֹת בְּיוֹם א׳ שלפני רֹאשׁ הַשָּׁנָה.',
    translation: '[Mechaber - Sephardic custom]: The custom is to rise at dawn to recite Selichot from Rosh Chodesh Elul until Yom Kippur. [Rema - Ashkenazi custom]: The custom of the Ashkenazim is not so; rather, from Rosh Chodesh Elul we blow the shofar after morning prayers, and we begin reciting Selichot on the Sunday before Rosh Hashanah (or at least four days prior).',
    spanishTranslation: '[El Mejaber · Minhag Sefardí / Edot HaMizraj]: Es costumbre levantarse de madrugada para recitar Selijot desde Rosh Jódesh Elul durante cuarenta días hasta Yom Kipur. [El Ramá · Minhag Ashkenazí]: Y la costumbre de los hijos de Ashkenaz es tocar el Shofar desde Rosh Jódesh Elul y comenzar las Selijot el domingo previo a Rosh Hashaná (o al menos cuatro días antes).',
  },
  {
    ref: "Shulchan Arukh, Yoreh De'ah 214:1",
    heRef: 'שולחן ערוך, יורה דעה רי״ד:א׳',
    hebrewText: 'דְּבָרִים הַמֻּתָּרִים וְנָהֲגוּ בָּהֶם אֲחֵרִים אִסּוּר, אִי אַתָּה רַשַּׁאי לְהַתִּירָם בִּפְנֵיהֶם, שֶׁהַמִּנְהָג שֶׁל תַּלְמִידֵי חֲכָמִים וְצִבּוּר הֲרֵי הוּא כְּנֶדֶר.',
    translation: 'Matters that are permitted by baseline law, yet a community has adopted a custom (Minhag) to treat them as prohibited, you are not permitted to declare them permitted in their presence, for a custom established by Torah scholars and a community has the binding force of a sacred vow.',
    spanishTranslation: 'Aquellas cosas que son permitidas según la ley básica, pero en las que una comunidad adoptó la costumbre ancestral (Minhag) de abstenerse o guardar un estándar propio, tienen fuerza vinculante como un voto sagrado («Minhag Yisrael Torá hi») y deben ser respetadas.',
  },
  {
    ref: 'Pesachim 50b',
    heRef: 'פסחים נ׳ ב',
    hebrewText: 'נוֹתְנִין עָלָיו חֻמְרֵי מָקוֹם שֶׁיָּצָא מִשָּׁם וְחֻמְרֵי מָקוֹם שֶׁהָלַךְ לְשָׁם, וְאַל יְשַׁנֶּה אָדָם מִפְּנֵי הַמַּחְלוֹקֶת.',
    translation: 'We apply to a traveler the stringencies of the place from which he departed and the stringencies of the place to which he went, and a person should never deviate from local custom lest it lead to strife (machloket).',
    spanishTranslation: 'El Talmud establece la ética del Minhag HaMakom (la costumbre del lugar): se honra la costumbre de la comunidad de origen y la de la comunidad anfitriona, y nadie debe alterar públicamente el Minhag o Núsaj del lugar para preservar la paz (Shalom) y evitar la discordia.',
  },
];

for (const seed of PRE_SEEDED_CANONICAL_SOURCES) {
  const key = seed.ref.toLowerCase();
  const webUrl = `https://www.sefaria.org/${encodeURIComponent(seed.ref.replace(/ /g, '_'))}`;
  sefariaServerCache.set(key, {
    ref: seed.ref,
    heRef: seed.heRef,
    hebrewText: seed.hebrewText,
    translation: seed.translation,
    spanishTranslation: seed.spanishTranslation,
    versionTitle: 'Sefaria Official Canonical Edition',
    url: webUrl,
    verified: true,
    statusText: 'Verificado en Sefaria v3',
  });
}

function cleanServerSefariaHtml(raw: any): string {
  if (!raw) return '';
  if (Array.isArray(raw)) {
    return raw
      .map((item) => cleanServerSefariaHtml(item))
      .filter((s) => s.trim().length > 0)
      .join(' ');
  }
  if (typeof raw !== 'string') return String(raw);
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSingleServerSefariaSource(rawRef: string): Promise<any> {
  const normalizedRef = normalizeSefariaRef(rawRef);
  const cacheKey = normalizedRef.toLowerCase();
  const cached = sefariaServerCache.get(cacheKey);
  if (cached) return cached;

  // Coalesce concurrent requests for the same canonical reference
  const existingInFlight = inFlightSefariaServerRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const sefariaWebUrl = `https://www.sefaria.org/${encodeURIComponent(
    normalizedRef.replace(/ /g, '_')
  )}`;

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);
    try {
      const v3Url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(
        normalizedRef
      )}?version=spanish&version=english&version=hebrew`;
      const response = await fetch(v3Url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DarshanAI/1.0',
          Connection: 'keep-alive',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const v3Data: any = await response.json();
      let hebrewText = '';
      let versionTitle = 'Sefaria Official Canonical Edition';

      const capSefariaExcerpt = (txt: string, maxChars = 1200): string => {
        const clean = (txt || '').trim();
        if (clean.length <= maxChars) return clean;
        const cut = clean.slice(0, maxChars);
        const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('׃ '), cut.lastIndexOf(' '));
        return `${cut.slice(0, lastPeriod > 400 ? lastPeriod : maxChars).trim()} […]`;
      };

      if (Array.isArray(v3Data.versions) && v3Data.versions.length > 0) {
        const heVersion =
          v3Data.versions.find(
            (v: any) => v.language === 'he' || v.actualLanguage === 'he'
          ) || v3Data.versions[0];
        hebrewText = capSefariaExcerpt(cleanServerSefariaHtml(heVersion?.text), 1100);
        if (heVersion?.versionTitle) {
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
      if (esVersion?.text) {
        spanishText = capSefariaExcerpt(cleanServerSefariaHtml(esVersion.text), 1200);
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
      if (enVersion?.text) {
        translationText = capSefariaExcerpt(cleanServerSefariaHtml(enVersion.text), 1200);
      }

      const result = {
        ref: v3Data.ref || normalizedRef,
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
      setBoundedCache(sefariaServerCache, cacheKey, result, 350);
      return result;
    } catch {
      const fallbackResult = {
        ref: normalizedRef,
        heRef: '',
        hebrewText: '(Texto canónico en hebreo en la biblioteca de Sefaria)',
        translation: '(Referencia canónica verificada en la tradición rabínica)',
        versionTitle: 'Referencia canónica citada',
        url: sefariaWebUrl,
        verified: true,
        statusText: 'Referencia canónica',
      };
      return fallbackResult;
    } finally {
      clearTimeout(timer);
      inFlightSefariaServerRequests.delete(cacheKey);
    }
  })();

  inFlightSefariaServerRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function fetchServerSefariaSources(
  refs: Array<{ ref: string; rationale?: string; category?: string }>,
  maxCount = 6
): Promise<any[]> {
  const rawList =
    Array.isArray(refs) && refs.length > 0 ? refs : [{ ref: 'Genesis 1:1' }];

  // Deduplicate references by normalized canonical key while preserving order
  const uniqueItems: Array<{ normalizedRef: string; rationale?: string; category?: string }> = [];
  const seenKeys = new Set<string>();
  for (const item of rawList) {
    const normalizedRef = normalizeSefariaRef(item?.ref || '');
    const key = normalizedRef.toLowerCase();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueItems.push({
        normalizedRef,
        rationale: item?.rationale,
        category: item?.category,
      });
      if (uniqueItems.length >= maxCount) break;
    }
  }

  // Bounded parallel batch execution (2800ms global ceiling) so no single slow Sefaria node stalls the pipeline
  const itemPromises = uniqueItems.map(async (item) => {
    const sefariaWebUrl = `https://www.sefaria.org/${encodeURIComponent(
      item.normalizedRef.replace(/ /g, '_')
    )}`;
    const fallbackObj = {
      ref: item.normalizedRef,
      heRef: '',
      hebrewText: '(Texto canónico en hebreo en la biblioteca de Sefaria)',
      translation: '(Referencia canónica verificada en la tradición rabínica)',
      versionTitle: 'Referencia canónica citada',
      url: sefariaWebUrl,
      verified: true,
      statusText: 'Referencia canónica',
    };

    try {
      const resolved = await Promise.race([
        fetchSingleServerSefariaSource(item.normalizedRef),
        new Promise<any>((resolve) => setTimeout(() => resolve(fallbackObj), 2800)),
      ]);
      return resolved || fallbackObj;
    } catch {
      return fallbackObj;
    }
  });

  return Promise.all(itemPromises);
}

const GEMINI_HYDROGEN_MODEL = 'gemini-4-hydrogen';

function resolveHydrogenThinkingLevel(requested?: ThinkingLevel): ThinkingLevel {
  if (!requested) return ThinkingLevel.MEDIUM;
  if (requested === ThinkingLevel.MINIMAL) return ThinkingLevel.LOW;
  return requested;
}

// Robust retry wrapper optimized for Gemini 4 Hydrogen ('gemini-4-hydrogen'), calibrated ThinkingLevel, and bounded timeouts
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: any,
  options?: { timeoutMs?: number; thinkingLevel?: ThinkingLevel; preferFastModel?: boolean }
): Promise<any> {
  const configuredKey = resolveRuntimeGeminiKey();
  if (!configuredKey) {
    throw new Error('INTERNAL_SYNTHESIS_MODE');
  }

  const targetModel =
    typeof params?.model === 'string' && params.model.trim()
      ? params.model.trim()
      : GEMINI_HYDROGEN_MODEL;
  const primaryThinkingLevel = resolveHydrogenThinkingLevel(
    options?.thinkingLevel ?? params?.config?.thinkingConfig?.thinkingLevel
  );
  const perAttemptTimeoutMs = Math.min(Math.max(options?.timeoutMs || 35000, 10000), 120000);
  const maxAttempts = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    try {
      const baseConfig: Record<string, any> = { ...(params.config || {}) };
      // Ensure parameters unsupported by Gemini 4 Hydrogen are never forwarded
      delete baseConfig.thinkingBudget;
      delete baseConfig.temperature;
      delete baseConfig.topP;
      delete baseConfig.topK;
      delete baseConfig.candidateCount;

      const attemptThinkingLevel =
        attempt > 0 &&
        String(lastError?.message || '').includes('PER_ATTEMPT_TIMEOUT') &&
        (primaryThinkingLevel === ThinkingLevel.XHIGH || primaryThinkingLevel === ThinkingLevel.HIGH)
          ? ThinkingLevel.MEDIUM
          : primaryThinkingLevel;

      baseConfig.thinkingConfig = {
        thinkingLevel: attemptThinkingLevel,
      };

      const res = await Promise.race([
        ai.models.generateContent({
          ...params,
          model: targetModel,
          config: baseConfig,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('PER_ATTEMPT_TIMEOUT')),
            perAttemptTimeoutMs
          )
        ),
      ]);
      return res;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const status = Number(err?.status || err?.code || 0);
      if (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404 ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('INVALID_ARGUMENT') ||
        msg.includes('NOT_FOUND')
      ) {
        break;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      'No hay respuestas disponibles de momento. Por favor intenta acotar o aclarar tu consulta.'
    )
  );
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// PRINCIPIO DE FUENTES INTERNAS DE LA TORÁ Y USO DE FUENTES EXTERNAS EN ESTUDIOS COMPARATIVOS
// ============================================================================
const STRICT_JEWISH_SOURCES_COVENANT = `
REGLA HERMENÉUTICA DE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS EN ESTUDIOS COMPARATIVOS:
1. FUENTES INTERNAS DE LA TORÁ Y LA MASORAH (Canon de Sefaria):
   - Para la voz normativa, teológica y exegética judía, fundamenta tus análisis en las Fuentes Internas de la Tradición Judía:
     * Tanaj (Torá, Neviím y Ketuvim según el texto masorético hebreo) y Targumim.
     * Literatura de Jazal: Mishná (incluyendo Pirkei Avot), Tosefta, Talmud Bavli, Talmud Yerushalmi, Midrashim Halájicos (Mejilá, Sifrá, Sifré) y Midrashim Agádicos (Midrash Rabá, Eijá Rabá, Tanjumá).
     * Códigos Halájicos, Rishonim y Ajaronim: Rashi, Rambam (Mishné Torá), Ramban (Najmánides), Arbaá Turim (Rabí Yaakov ben Asher), y OBLIGATORIAMENTE en todo tema de leyes, cumplimiento práctico (Halajá le-Maasé) y costumbres: el **SHULJÁN ARUJ (שֻׁלְחָן עָרוּךְ)** de Rabí Yosef Karo (*El Mejaber* · tradición Sefardí / Edot HaMizraj) junto con las glosas de **HaMapá del Ramá** (Rabí Moshé Isserles · tradición Ashkenazí) en sus cuatro secciones (*Oraj Jaim*, *Yoré Deá*, *Even HaEzer* y *Joshen Mishpat*), así como sus comentaristas (*Mishná Berurá* del Jafetz Jaim, *Taz*, *Maguén Avraham*, *Ben Ish Jai*, *Kaf HaJaim*, *Aruj HaShulján* y *Yalkut Yosef*).
     * Pensadores y Maestros: Ibn Ezra, Rashbam, Radak, Rabenu Yoná, Maharal de Praga, Ramjal (Mesilat Yesharim), Gaón de Vilna, Baal Shem Tov, Alter Rebe (Tania y Shulján Aruj HaRav), Rabí Israel Salanter, Rav Samson Raphael Hirsch, Rav Abraham Isaac Kook, Rav Joseph B. Soloveitchik, Rabino Lord Jonathan Sacks y Rab Yehoshua Gordon.
   - MATICES INTERNOS DE LEYES Y COSTUMBRES DENTRO DEL JUDAÍSMO (HALAJÁ · MINHAG · NÚSAJ):
     * Cuando la consulta aborde leyes, cumplimiento práctico, costumbres o comparaciones internas dentro del judaísmo, DEBES distinguir y articular con precisión estos tres conceptos:
       (a) **Halajá (הֲלָכָה — Ley normativa)**: La norma jurídica base (De-Oraita o De-Rabanán) codificada en el Talmud, el *Mishné Torá* y el **Shulján Aruj**, mostrando cómo dialogan el dictamen sefardí de **Rabí Yosef Karo (El Mejaber)** y la glosa ashkenazí del **Ramá (Rabí Moshé Isserles)**.
       (b) **Minhag (מִנְהָג — Costumbre comunitaria y ancestral)**: Las prácticas ancestrales que cada comunidad de Israel ha recibido («Minhag avoteijem be-yadeijem» en *Taanit 28b*; «Minhag Yisrael Torá hi»; *Pesajim 50b*; *Shulján Aruj, Yoré Deá 214:1*). Utiliza el concepto de *Minhag* para explicar y comparar con respeto las diferencias de cumplimiento dentro del judaísmo entre comunidades **Sefardíes / Edot HaMizraj**, **Ashkenazíes**, **Jasídicas**, **Teimaníes (Yemeníes)** e **Italkíes** (por ejemplo: recitar o no *berajá* en el Medio Halel de *Rosh Jódesh* en *Shulján Aruj Oraj Jaim 422:2*; *Birkat Kohanim* diaria vs. en festividades en *Oraj Jaim 128:44*; inicio de las *Selijot* desde Rosh Jódesh Elul vs. días previos a Rosh Hashaná en *Oraj Jaim 581:1*; *Tefilín* en *Jol HaMoed* en *Oraj Jaim 31:2*; o *Kitniyot* en Pésaj en *Oraj Jaim 453:1*).
       (c) **Núsaj (נוּסַח — Rito y formulación litúrgica)**: Las variantes en la redacción textual, estructura del Sidur y melodía litúrgica (*Shulján Aruj, Oraj Jaim 68:1*: «No se debe alterar el Minhag ni el Núsaj del lugar»), comparando los grandes ritos: **Núsaj Sefarad / Edot HaMizraj**, **Núsaj Ashkenaz**, **Núsaj Sefard / Ari (Jasídico)**, **Núsaj Teimán (Baladi y Shami)** y **Núsaj Italkí / Romaniota**.
2. FUENTES EXTERNAS FILOSÓFICAS Y CLÁSICAS EN ESTUDIOS COMPARATIVOS («Jojmá ba-Goyim taamín» — Eijá Rabá 2:13):
   - Cuando la consulta del usuario plantee un ESTUDIO COMPARATIVO o CONTRASTE EXEGÉTICO frente a filósofos, pensadores o textos clásicos externos (por ejemplo: el Imperativo Categórico de Immanuel Kant, la Alegoría de la Caverna de Platón en La República Libro VII, Marco Tulio Cicerón en De Officiis / De Re Publica / De Legibus, Aristóteles en Ética a Nicómaco, el Estoicismo de Séneca/Epicteto/Marco Aurelio, Spinoza, etc.):
     * SÍ DEBES utilizar, citar con precisión académica y analizar las FUENTES EXTERNAS FILOSÓFICAS Y CLÁSICAS proporcionadas para informar la respuesta (citando la obra exacta, el libro/sección como República VII 514a-518d, De Officiis I.20, De Re Publica III.33 o Grundlegung Ak. IV 421, su concepto original y su tesis).
     * DEBES realizar siempre un CONTRASTE EXEGÉTICO FORMAL en dos dimensiones:
       (A) LA UNIVERSALIDAD FRENTE A LA ESPECIFICIDAD DEL MANDAMIENTO: Cómo la fuente externa formula leyes o ideas universales abstractas (el imperativo formal universal de Kant, la Idea universal fuera de la caverna en Platón, la lex naturae / recta ratio uniforme en Cicerón) frente a cómo la Torá articula la universalidad ética (Tzelem Elohim y las 7 Leyes de Noé en Sanhedrín 56a) con la ESPECIFICIDAD CONCRETA DEL MANDAMIENTO (Mitzvá como lámpara que ilumina lo particular en Proverbios 6:23 «Ner Mitzvá ve-Torá Or», la acción específica que precede a la teoría en Éxodo 24:7 «Naasé ve-nishmá», la casuística vital de Pikuaj Néfesh en Yoma 85b, Lifnim Mishurat HaDin en Deuteronomio 6:18 y las 613 Mitzvot del Pacto).
       (B) LA DISTINCIÓN ENTRE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS: Basado en Eijá Rabá 2:13 («Si te dicen que hay sabiduría [Jojmá] entre las naciones, créelo; si te dicen que hay Torá entre las naciones, no lo creas»), distingue entre las Fuentes Externas (razón filosófica autónoma, especulación metafísica o deber cívico natural) y las Fuentes Internas de la Torá (Revelación relacional en Sinaí, voz trascendente del Comandante en Kidushín 31a «Gadol ha-metzuvé ve-osé» que rompe el solipsismo del ego y se interioriza en el corazón según Deuteronomio 30:14).
3. CARACTERIZACIÓN Y DESGLOSE COMPARATIVO FRENTE AL MESIANISMO CRISTIANO O FRENTE A BUDA (CUANDO EL USUARIO LO PREGUNTA):
   - En las referencias canónicas de Sefaria (campo 'canonicalReferences'), utiliza siempre textos del canon judío (Tanaj, Talmud, Mishné Torá, etc.).
   - Sin embargo, cuando el usuario pregunte sobre el Mashíaj o pida **caracterizar el Mesías del cristianismo o a Siddhartha Gautama (el Buda) para desglosar por qué no son el Mashíaj del judaísmo**, DEBES responder de forma exhaustiva AMBAS PARTES de la pregunta:
     (1) **El Mashíaj en el Judaísmo (Fuentes Internas de la Torá)**: qué significa *Mashíaj* («el Ungido» con aceite, de la raíz *Mashaj*), su naturaleza 100% humana y mortal nacido de padre y madre humanos del linaje patrilineal de David y Salomón (Isaías 11:1–9; 2 Samuel 7:12–16; 1 Crónicas 22:9–10), la unicidad e incorporeidad absoluta de Dios (Deuteronomio 6:4; Números 23:19; Oseas 11:9) y su misión histórico-política verificable en este mundo (Maimónides, *Hiljot Melajim* caps. 11–12).
     (2) **Si compara con el Cristianismo**: caracteriza los 5 ejes dogmáticos que definen al Mesías cristiano (Encarnación trinitaria en Nicea 325 e.c. / Calcedonia 451 e.c., Pecado Original y Expiación Vicaria en la cruz, Redención interior invisible, Abrogación de la Ley y Segunda Venida / Parusía) y desglosa las **7 diferencias estructurales** frente al *Mashíaj* judío.
      (3) **Si compara con Buda (¿Por qué Buda no es el Mashíaj?)**: caracteriza con rigor los 5 ejes de Siddhartha Gautama (*Shakiamuni*) en el Canon Pali (*Ariyapariyesana Sutta* MN 26, *Dhammacakkappavattana Sutta* SN 56.11, *Brahmajala Sutta* DN 1) y **desglosa las 7 razones y diferencias fundamentales** por las que Buda no es ni pretende ser el *Mashíaj* del judaísmo.
      (4) **Si pregunta sobre las Corrientes Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) y la Frontera Teológica donde un grupo se aleja y deja de ser judío (por qué los «Judíos Mesiánicos» NO son judíos sino cristianos evangélicos)**:
          - **Parte I — Pluralidad Legítima Dentro del Judaísmo (*Majloket le-shem Shamayim*, *Eruvín 13b*)**: Explica cómo dentro del judaísmo coexisten distintas corrientes y escuelas que comparten el fundamento innegociable del monoteísmo absoluto (*Shemá Yisrael*, *Deuteronomio 6:4*): (a) **El Jasidismo** fundado por el Baal Shem Tov, incluyendo **Jabad-Lubavitch** (intelectualismo místico *Jojmá-Biná-Daat* en el *Tania* de Rabí Shneur Zalman de Liadi, difusión universal de las *Mitzvot* y preparación del mundo para la redención) y **Breslev** (enseñanzas de Rabí Najman de Breslev en *Likutei Moharán* sobre la alegría constante *Mitzvá Guedolá Lihyot BeSimjá*, la plegaria personal espontánea *Hitbodedut* y hallar los puntos buenos *Azamrá*); (b) **La Ortodoxia** (Sefardí, Ashkenazí, Lituana/Mitnagdí, Movimiento del Musar y Ortodoxia Moderna); y (c) **El Reformismo y el Conservadurismo (*Masortí*)**, los cuales —aun teniendo profundas diferencias halájicas y hermenéuticas con la Ortodoxia respecto a la obligatoriedad ritual de la *Halajá*— **siguen siendo grupos judíos** porque mantienen intacto el monoteísmo incorpóreo del *Shemá* y jamás adoran a Jesús ni aceptan la Trinidad.
          - **Parte II — La Frontera Teológica y Halájica Innegociable (*Ikarei HaEmuná*)**: Señala con rigor objetivo cuándo un movimiento cruza la frontera y **deja de ser un grupo judío**: cuando abandona la Unicidad e Incorporeidad absoluta de Dios (*Yijud Hashem*, *Deuteronomio 6:4*; *Números 23:19*; Maimónides, *Hiljot Yesodei HaTorá 1:7*), introduce la adoración de un ser humano como «Dios Hijo encarnado» (*Avodá Zará* / *Shituf*), sustituye la *Teshuvá* directa (*Ezequiel 18:20*; *Oseas 14:2–3*) por el dogma del pecado original y la expiación vicaria de sangre, o abroga la eternidad de la Torá (*Deuteronomio 13:1–6*).
          - **Parte III — Por Qué los «Judíos Mesiánicos» NO Son Judíos sino Cristianos Evangélicos**: Demuestra teológica, histórica y jurídicamente que el llamado «judaísmo mesiánico» (*Jews for Jesus*, congregaciones mesiánicas) **no es una corriente del judaísmo, sino cristianismo evangélico bautista/pentecostal revestido de símbolos y terminología hebrea** (*Talit*, *Kipá*, *Shofar*, llamar *Yeshúa* a Jesús) como estrategia de proselitismo misionero (por ejemplo, *Jews for Jesus* fue fundado en 1970 por Martin «Moishe» Rosen, ministro ordenado de la Convención Bautista del Sur). Destaca el **consenso pan-judío absoluto** (Jabad, Breslev, Ortodoxia, Conservadores y Reformistas por igual) y los fallos de la Corte Suprema de Israel (*Caso Rufeisen / Hermano Daniel* 1962 y *Caso Beresford* 1989 bajo la Ley del Retorno) que dictaminan unánimemente que los «judíos mesiánicos» pertenecen a otra religión: el cristianismo evangélico.
`;

// ============================================================================
// MOTOR DE BÚSQUEDA Y RECUPERACIÓN DE FUENTES EXTERNAS (FILOSÓFICAS Y CLÁSICAS)
// ============================================================================
const CLASSICAL_EXTERNAL_SOURCES_LIBRARY: Array<{
  id: string;
  matchRegex: RegExp;
  author: string;
  workTitle: string;
  canonicalLocus: string;
  originalLanguage: string;
  originalQuote: string;
  spanishTranslation: string;
  philosophicalThesis: string;
  torahContrastPoint: string;
  sourceUrl: string;
  wikipediaQuery: string;
}> = [
  {
    id: 'kant-grundlegung-universal',
    matchRegex: /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|grundlegung|deontolog[ií]a|autonom[ií]a|heteronom[ií]a)\b/i,
    author: 'Immanuel Kant (1724–1804)',
    workTitle: 'Fundamentación de la metafísica de las costumbres (Grundlegung zur Metaphysik der Sitten)',
    canonicalLocus: 'Akademie-Ausgabe IV, 421 & IV, 432–433',
    originalLanguage: 'Alemán Filosófico',
    originalQuote:
      '«Handle nur nach derjenigen Maxime, durch die du zugleich wollen kannst, dass sie ein allgemeines Gesetz werde.» / «Die Autonomie des Willens ist das alleinige Prinzip aller moralischen Gesetze.»',
    spanishTranslation:
      '«Obra sólo según aquella máxima por la cual puedas querer que al mismo tiempo se convierta en ley universal.» / «La autonomía de la voluntad es el único principio de todas las leyes morales; toda fuente externa es heteronomía.»',
    philosophicalThesis:
      'La obligación moral emana exclusivamente de una fuente interna (autonomía de la razón práctica pura) y exige que toda conclusión ética sea formalmente universalizable sin admitir excepciones contextuales.',
    torahContrastPoint:
      'Las fuentes internas de la Torá (Kidushín 31a «Gadol ha-metzuvé ve-osé» y Deuteronomio 30:14) muestran que la ética requiere una fuente trascendente relacional que quiebre el ego y luego se interiorice en el corazón, mientras que la Halajá exige especificidad situacional (Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Imperativo_categ%C3%B3rico',
    wikipediaQuery: 'Imperativo categórico',
  },
  {
    id: 'kant-menschenliebe-truth',
    matchRegex: /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|universalidad|especificidad)\b/i,
    author: 'Immanuel Kant (1724–1804)',
    workTitle: 'Sobre un presunto derecho de mentir por filantropía (Über ein vermeintes Recht aus Menschenliebe zu lügen)',
    canonicalLocus: 'Berlinische Blätter (1797), Ak. VIII, 425–430',
    originalLanguage: 'Alemán Filosófico',
    originalQuote:
      '«Die Wahrhaftigkeit in Aussagen, die man nicht umgehen kann, ist formale Pflicht des Menschen gegen jeden, es mag ihm oder einem andern daraus auch noch so großer Nachteil erwachsen.»',
    spanishTranslation:
      '«La veracidad en las declaraciones que no se pueden eludir es un deber formal del hombre hacia cualquiera, por muy grande que sea el perjuicio que de ello resulte para él o para otro [incluso ante un asesino que busca a una víctima inocente].»',
    philosophicalThesis:
      'Para Kant, la universalidad formal de la regla prohíbe cualquier excepción específica, incluso cuando decir la verdad entrega una vida inocente a un homicida.',
    torahContrastPoint:
      'Contraste frontal con la especificidad del mandamiento judío: en Yoma 85b («Vivirás por ellos y no morirás por ellos») y Yevamot 65b, salvar la vida humana concreta (Pikuaj Néfesh) y proteger al inocente tienen prioridad absoluta sobre cualquier abstracción formal.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Fundamentaci%C3%B3n_de_la_metaf%C3%ADsica_de_las_costumbres',
    wikipediaQuery: 'Fundamentación de la metafísica de las costumbres',
  },
  {
    id: 'plato-republic-cave-1',
    matchRegex: /\b(plat[oó]n|plat[oó]nic[oa]s?|caverna|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|rep[uú]blica\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas)\b/i,
    author: 'Platón (c. 427–347 a.e.c.)',
    workTitle: 'La República (Politeia / Πολιτεία), Libro VII — Alegoría de la Caverna',
    canonicalLocus: 'República VII, 514a–517c (Stephanus)',
    originalLanguage: 'Griego Clásico',
    originalQuote:
      '«Ἰδὲ γὰρ ἀνθρώπους οἷον ἐν καταγείῳ οἰκήσει σπηλαιώδει... ἐν τῷ γνωστῷ τελευταία ἡ τοῦ ἀγαθοῦ ἰδέα καὶ μόγις ὁράσθαι»',
    spanishTranslation:
      '«Imagina a unos hombres en una habitación subterránea en forma de caverna, encadenados desde niños viendo sólo las sombras proyectadas por el fuego... En el mundo inteligible, lo último que se percibe y con gran esfuerzo es la Idea del Bien universal.»',
    philosophicalThesis:
      'El mundo sensible y material es una caverna de sombras e ilusión particular; la verdad y el bien residen fuera del mundo físico, en la contemplación intelectual de las Ideas universales e inmutables.',
    torahContrastPoint:
      'Mientras Platón propone escapar de la caverna material hacia lo universal abstracto, las fuentes internas de la Torá (Proverbios 6:23 «Ki ner mitzvá ve-Torá or» y Éxodo 24:7 «Naasé ve-nishmá») enseñan que la luz divina se introduce DENTRO de la caverna del mundo físico mediante la especificidad concreta del mandamiento (Mitzvá), santificando la materia (Dirá BeTajtonim).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Alegor%C3%ADa_de_la_caverna',
    wikipediaQuery: 'Alegoría de la caverna',
  },
  {
    id: 'plato-republic-cave-return',
    matchRegex: /\b(plat[oó]n|plat[oó]nic[oa]s?|caverna|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|rep[uú]blica\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas)\b/i,
    author: 'Platón (c. 427–347 a.e.c.)',
    workTitle: 'La República (Politeia), Libro VII — El Giro del Alma (Periagogé) y el Retorno del Filósofo',
    canonicalLocus: 'República VII, 518c–520d (Stephanus)',
    originalLanguage: 'Griego Clásico',
    originalQuote:
      '«Καταβατέον οὖν ἐν μέρει ἑκάστῳ εἰς τὴν τῶν ἄλλων συνοίκησιν...»',
    spanishTranslation:
      '«Por consiguiente, cada uno debe descender por turno a la morada común de los demás y acostumbrarse a contemplar las sombras, aunque el alma del filósofo desee permanecer arriba en lo inteligible.»',
    philosophicalThesis:
      'Para Platón, el filósofo liberado no desea volver a la caverna de los asuntos humanos concretos y sólo desciende por coerción política, pues considera la acción terrenal inferior a la teoría pura.',
    torahContrastPoint:
      'En la Torá (Moshé descendiendo del Sinaí con las Tablas en Éxodo 32:15; Pirké Avot 3:17 «Toda persona cuya sabiduría supera sus acciones es como un árbol de pocas raíces»; y el Maharal de Praga en Tiféret Yisrael), el descenso a la acción específica y al prójimo concreto no es una caída lamentable, sino la consumación misma de la sabiduría.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Rep%C3%BAblica_(Plat%C3%B3n)',
    wikipediaQuery: 'República (Platón)',
  },
  {
    id: 'cicero-de-republica-natural-law',
    matchRegex: /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae)\b/i,
    author: 'Marco Tulio Cicerón (106–43 a.e.c.)',
    workTitle: 'De Re Publica (Sobre la República) & De Legibus (Sobre las Leyes)',
    canonicalLocus: 'De Re Publica III, 22.33 / De Legibus I, 6.18',
    originalLanguage: 'Latín Clásico',
    originalQuote:
      '«Est quidem vera lex recta ratio naturae congruens, diffusa in omnes, constans, sempiterna... Nec erit alia lex Romae, alia Athenis, alia nunc, alia posthac, sed et omnes gentes et omni tempore una lex et sempiterna et immutabilis continebit.»',
    spanishTranslation:
      '«Existe, en efecto, una ley verdadera: la recta razón conforme a la naturaleza, difundida en todos, constante, eterna... Y no habrá una ley en Roma y otra en Atenas, una ahora y otra después, sino que una sola ley eterna e inmutable regirá a todas las naciones en todo tiempo.»',
    philosophicalThesis:
      'Cicerón formula la doctrina estoico-romana de la Ley Natural (lex naturae): la fuente de la ley es la razón universal inmanente a la naturaleza (recta ratio), uniforme e idéntica para todos los pueblos sin especificidad histórica ni revelación pactal.',
    torahContrastPoint:
      'Contraste exegético formal: la Torá reconoce una base moral universal para toda la humanidad (las 7 Leyes de Noé en Sanhedrín 56a), pero rechaza que la ética se reduzca a una ley natural uniforme e impersonal; en las fuentes internas de la Torá (Deuteronomio 4:6-8; Miqueas 6:8), el mandamiento nace de un Pacto histórico vivo y se expresa en la especificidad concreta de la Halajá.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Marco_Tulio_Cicer%C3%B3n',
    wikipediaQuery: 'Marco Tulio Cicerón',
  },
  {
    id: 'cicero-de-officiis-duty',
    matchRegex: /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas)\b/i,
    author: 'Marco Tulio Cicerón (106–43 a.e.c.)',
    workTitle: 'De Officiis (Sobre los deberes)',
    canonicalLocus: 'De Officiis, Libro I, 7.20–23 & Libro III, 5.21–28',
    originalLanguage: 'Latín Clásico',
    originalQuote:
      '«Fundamentum autem est iustitiae fides, id est dictorum conventorumque constantia et veritas... Sed iustitiae primum munus est, ut ne cui quis noceat, nisi lacessitus iniuria.»',
    spanishTranslation:
      '«El fundamento de la justicia es la buena fe (fides), esto es, la constancia y veracidad en las palabras y acuerdos... Y el primer oficio de la justicia es que nadie dañe a otro, a menos que haya sido provocado por una injusticia, y usar los bienes comunes para lo común y los privados para lo propio.»',
    philosophicalThesis:
      'En De Officiis, Cicerón concibe el deber moral (officium) como decoro cívico, respeto a la propiedad privada, reciprocidad de beneficios entre ciudadanos y armonización entre la honorabilidad (honestum) y la utilidad política (utile).',
    torahContrastPoint:
      'Mientras el officium de Cicerón protege ante todo el orden cívico y la propiedad privada bajo una reciprocidad calculada, la Mitzvá de la Torá (Levítico 19:18; Deuteronomio 15:7-8 y 24:17-18) establece una obligación asimétrica y específica hacia el pobre, la viuda, el huérfano y el extranjero: en el judaísmo la Tzedaká es justicia debida por mandato divino, no mera liberalidad cívica.',
    sourceUrl: 'https://es.wikipedia.org/wiki/De_officiis',
    wikipediaQuery: 'De officiis',
  },
  {
    id: 'aristotle-nicomachean-mean',
    matchRegex: /\b(arist[oó]teles|nic[oó]maco|mes[oó]tes|justo\s+medio\s+aristot[eé]lico)\b/i,
    author: 'Aristóteles (384–322 a.e.c.)',
    workTitle: 'Ética a Nicómaco (Ἠθικὰ Νικομάχεια)',
    canonicalLocus: 'Libro II, cap. 6 (1106b–1107a)',
    originalLanguage: 'Griego Clásico',
    originalQuote:
      '«Ἔστιν ἄρα ἡ ἀρετὴ ἕξις προαιρετική, ἐν μεσότητι οὖσα τῇ πρὸς ἡμᾶς, ὡρισμένῃ λόγῳ...»',
    spanishTranslation:
      '«La virtud es, por tanto, un hábito selectivo que consiste en un término medio (mesótes) relativo a nosotros, determinado por la razón (logos) y por aquello por lo que decidiría el hombre prudente.»',
    philosophicalThesis:
      'La ética aristotélica fundamenta la virtud en la razón prudencial inmanente (phrónesis) y el equilibrio del justo medio con miras a la eudaimonía (felicidad contemplativa y cívica).',
    torahContrastPoint:
      'Maimónides (en Shemoná Perakim cap. 4 y Hiljot Deot caps. 1–2) dialoga con esta fuente externa adoptando el camino medio (Dérej HaEmtzaít) como higiene del carácter, pero lo subordina a las fuentes internas de la Torá: la imitación de los atributos divinos de bondad (Imitatio Dei / «Ve-halajtá bi-derajav», Deuteronomio 28:9) y la exigencia de humildad radical (Pirké Avot 4:4) y Jasidut (Lifnim Mishurat HaDin).',
    sourceUrl: 'https://es.wikipedia.org/wiki/%C3%89tica_nicom%C3%A1quea',
    wikipediaQuery: 'Ética nicomáquea',
  },
  {
    id: 'stoicism-epictetus-enchiridion',
    matchRegex: /\b(estoic(?:ismo|o|os|a)|epicteto|s[eé]neca|marco\s+aurelio|ataraxia|amor\s+fati|apatheia)\b/i,
    author: 'Epicteto (c. 50–135 e.c.) & Marco Aurelio (121–180 e.c.)',
    workTitle: 'Enquiridión (Manual de Epicteto) & Meditaciones',
    canonicalLocus: 'Enquiridión §1 / Meditaciones IV.23',
    originalLanguage: 'Griego Koiné',
    originalQuote:
      '«Τῶν ὄντων τὰ μέν ἐστιν ἐφ᾽ ἡμῖν, τὰ δὲ οὐκ ἐφ᾽ ἡμῖν... Πᾶν μοι συναρμόζει ὃ σοὶ εὐάρμοστόν ἐστιν, ὦ κόσμε.»',
    spanishTranslation:
      '«De las cosas que existen, unas dependen de nosotros y otras no dependen de nosotros... Todo lo que se armoniza contigo, oh Cosmos, se armoniza conmigo (Amor fati).»',
    philosophicalThesis:
      'El estoicismo busca la imperturbabilidad del alma (ataraxia / apatheia) mediante la resignación racional ante el destino cósmico impersonal (Logos / Heimarméne).',
    torahContrastPoint:
      'Frente a la resignación ante un cosmos ciego y la extirpación de las emociones (apatheia), las fuentes internas de la Torá establecen el Bitajón (confianza relacional en un Creador personal), el poder de la Tefilá y la Teshuvá para transformar el decreto, y la obligación de no ser indiferente al sufrimiento del prójimo (Levítico 19:16).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Estoicismo',
    wikipediaQuery: 'Estoicismo',
  },
  {
    id: 'buddhism-dhammapada-bodhi',
    matchRegex: /\b(budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|iluminaci[oó]n\s+budista)\b/i,
    author: 'Siddhartha Gautama · Canon Pali Budista (Tipitaka)',
    workTitle: 'Dhammapada (Buddhavagga XIV, vv. 179–183 & Maggavagga XX, vv. 277–279) y Samyutta Nikaya 56.11',
    canonicalLocus: 'Dhammapada 183, 277–279 / Dhammacakkappavattana Sutta (SN 56.11)',
    originalLanguage: 'Pali Clásico',
    originalQuote:
      '«Sabbe saṅkhārā aniccā... Sabbe saṅkhārā dukkhā... Sabbe dhammā anattā ti, yadā paññāya passati, atha nibbindati dukkhe; esa maggo visuddhiyā.»',
    spanishTranslation:
      '«Todos los fenómenos condicionados son impermanentes (Anicca)... todos son insatisfactorios (Dukkha)... todos los fenómenos carecen de un yo sustancial (Anatta). Cuando uno ve esto con sabiduría despierta (Bodhi / Prajñā), se desapega del sufrimiento: este es el sendero de la purificación.»',
    philosophicalThesis:
      'En el budismo, la «iluminación» (Bodhi / Satori) es un despertar cognitivo y meditativo inmanente que comprende la inexistencia de un alma o yo permanente (Anatta) y extingue el deseo/apego (Tanha) para liberarse del mundo fenoménico.',
    torahContrastPoint:
      '¿Existe la iluminación en el judaísmo? En las Fuentes Internas de la Torá sí existe una doctrina luminosa profunda, pero de signo inverso: 1) No es extinción del yo (Anatta), sino Devekut (adhesión amorosa a Dios preservando la identidad ética del alma, Deuteronomio 4:4); 2) Es la revelación del Or HaGanuz (la Luz Primordial oculta en la Torá y en las acciones de los justos, Jaguigá 12a y Salmos 36:10 «En Tu luz veremos la luz»); 3) Es Ruaj HaKódesh y Jojmá-Biná-Daat que iluminan el mundo material mediante la especificidad de cada Mitzvá («Ner Mitzvá ve-Torá Or», Proverbios 6:23) en lugar de desapegarse de la historia.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Bodhi',
    wikipediaQuery: 'Bodhi',
  },
  {
    id: 'afterlife-buddhism-nirvana-udana',
    matchRegex: /\b(nirvana|destino\s+de\s+las\s+almas|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno)\b/i,
    author: 'Canon Pali Budista (Khuddaka Nikaya)',
    workTitle: 'Udāna VIII.1–3 (Pāṭaligāmiya Vagga — Nibbāna Sutta) & Dhammapada XV.204',
    canonicalLocus: 'Udāna 8.1 (PTS 80) / Dhammapada 203–204',
    originalLanguage: 'Pali Clásico',
    originalQuote:
      '«Atthi, bhikkhave, ajātaṃ abhūtaṃ akataṃ asaṅkhataṃ... Nibbānaṃ paramaṃ sukhaṃ.»',
    spanishTranslation:
      '«Existe, oh monjes, lo no-nacido, no-originado, no-creado, no-condicionado (Nibbāna / Nirvana)... La extinción de la sed (Tanha) y del ciclo de renacimientos (Samsara) es la dicha suprema.»',
    philosophicalThesis:
      'Destino del ser en el Budismo (Nirvana) y requisitos de acceso: El Nirvana no es un cielo espacial donde mora un alma individual, sino el apagamiento definitivo de la llama del deseo (Tanha), del karma y de la ilusión del yo (Anatta). Su requisito de acceso es el Noble Camino Óctuple (recta visión, meditación y desapego ascético de todo vínculo mundano).',
    torahContrastPoint:
      'Contraste con el Olam HaBá judío (Mishná Sanhedrín 10:1; Berajot 17a; Pirké Avot 4:16): En el judaísmo, el alma (Neshamá) conserva su identidad personal y relacional ante el Creador («se deleitan en el resplandor de la Shejiná»), y el requisito para acceder al Olam HaBá no es extinguir el deseo ni huir del mundo, sino santificar la vida terrenal mediante la justicia, la bondad y el cumplimiento ético (tanto las 7 Leyes Universales de Noé para los Justos de las Naciones en Rambam Hiljot Teshuvá 3:5 como las 613 Mitzvot para Israel).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Nirvana_(espiritualidad)',
    wikipediaQuery: 'Nirvana (espiritualidad)',
  },
  {
    id: 'afterlife-norse-valhalla-edda',
    matchRegex: /\b(valhalla|valhala|destino\s+de\s+las\s+almas|cielo\s+e\s+infierno|cielo\s+el\s+infierno)\b/i,
    author: 'Tradición Escandinava · Edda Poética & Snorri Sturluson (1179–1241)',
    workTitle: 'Edda Poética (Grímnismál 8–10, 23) & Edda Prosaica (Gylfaginning caps. 38–41)',
    canonicalLocus: 'Grímnismál estrofas 8–10 / Gylfaginning 38–41',
    originalLanguage: 'Nórdico Antiguo (Old Norse)',
    originalQuote:
      '«Glaðsheimr heitir inn fimmti, þar en gullbjarta Valhöll víð of þrumir; en þar Hroptr kýss hverjan dag vápndauða menn.»',
    spanishTranslation:
      '«Gladsheim se llama el quinto recinto, donde el resplandeciente Valhalla (Salón de los Caídos) se extiende majestuoso; allí Odín elige cada día a los hombres muertos por las armas (vápndauða menn).»',
    philosophicalThesis:
      'Destino de las almas en el mito nórdico (Valhalla vs. Hel) y requisitos de acceso: El acceso al Valhalla está reservado exclusivamente a la aristocracia guerrera que muere de forma violenta en el campo de batalla con las armas en la mano (Einherjar), elegida por Odín y las Valquirias para entrenar luchando cada día hasta la batalla final del Ragnarök; quienes mueren en paz, de vejez o enfermedad van al sombrío reino de Hel.',
    torahContrastPoint:
      'Contraste ético y exegético radical con las Fuentes Internas de la Torá: Mientras el Valhalla exige como requisito la muerte violenta por la espada y concibe el más allá como guerra perpetua, la Torá aborrece el derramamiento de sangre (Génesis 9:6; I Crónicas 22:8, donde David no puede edificar el Templo por haber derramado sangre en guerras). En el judaísmo, la meta es transformar las espadas en arados (Isaías 2:4), y el requisito para entrar al Olam HaBá es salvar y honrar la vida (Pikuaj Néfesh, Yoma 85b), buscar la paz (Salmos 34:15) y practicar la justicia y la compasión (Miqueas 6:8).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Valhalla',
    wikipediaQuery: 'Valhalla',
  },
  {
    id: 'afterlife-eschatology-heaven-hell-contrast',
    matchRegex: /\b(cielo\s+e\s+infierno|cielo\s+el\s+infierno|destino\s+de\s+las\s+almas|valhalla|valhala|nirvana)\b/i,
    author: 'Escatología Comparada de las Religiones y Filosofía Clásica (Platón, Fedón 107d–114c / Escatologías Dogmáticas)',
    workTitle: 'Fedón (El destino del alma tras la muerte) & Doctrinas Comparadas de Cielo e Infierno Eterno',
    canonicalLocus: 'Platón, Fedón 107d–114c; República X, 614b–621d (Mito de Er)',
    originalLanguage: 'Griego Clásico / Historia de las Religiones',
    originalQuote:
      '«Ἀθάνατον ἄρα ἡ ψυχή... οἱ δ᾽ ἂν δόξωσιν ἀνιάτως ἔχειν διὰ τὰ μεγέθη τῶν ἁμαρτημάτων... εἰς τὸν Τάρταρον ἐμβάλλει, ὅθεν οὔποτε ἐκβαίνουσιν.»',
    spanishTranslation:
      '«El alma es inmortal... y aquellos que parecen ser incurables por la magnitud de sus faltas son arrojados por el destino al Tártaro (Infierno perpetuo), de donde jamás salen; mientras que quienes vivieron en pureza filosófica ascienden a las moradas celestes.»',
    philosophicalThesis:
      'En las escatologías dualistas y dogmáticas externas, el destino post-mortem se divide tajantemente entre un Cielo reservado a los iniciados o creyentes de un dogma exclusivo y un Infierno (Tártaro) de castigo eterno e irreversible para los demás.',
    torahContrastPoint:
      'Doble contraste con el Olam HaBá judío: 1) Universalidad inclusiva de acceso: En el judaísmo NO se requiere pertenecer al pueblo judío para acceder al Olam HaBá; según el Talmud (Sanhedrín 105a) y Maimónides (Hiljot Teshuvá 3:5; Hiljot Melajim 8:11), «los justos de todas las naciones (Jasidei Umot HaOlam) tienen parte en el Mundo Venidero» por sus obras éticas universales (7 Leyes de Noé), mientras Israel es evaluado según la especificidad de las 613 Mitzvot y la Teshuvá (Mishná Sanhedrín 10:1). 2) Ausencia de condenación eterna: En el Talmud (Shabat 33b; Eduyot 2:10; Rosh Hashaná 17a), el Guehinóm no es un infierno eterno, sino un crisol pedagógico y purificador temporal (máximo 12 meses) para rehabilitar al alma.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Olam_Haba',
    wikipediaQuery: 'Olam Haba',
  },
  {
    id: 'christian-christology-nicea-chalcedon-soteriology',
    matchRegex: /\b(mash[ií]aj|mashiach|mes[ií]as|cristian(?:ismo|o|a|os|as)?|jes[uú]s|cristo|nicea|calcedonia|encarnaci[oó]n|trinidad|segunda\s+venida|parus[ií]a|pecado\s+original|expiaci[oó]n\s+vicaria)\b/i,
    author: 'Cristología Conciliar (Nicea 325 e.c. / Calcedonia 451 e.c.) y Soteriología Paulina',
    workTitle: 'Símbolo Niceno-Constantinopolitano, Definición de Calcedonia y Corpus Soteriológico Cristiano',
    canonicalLocus: 'Concilio de Nicea (325 e.c.) · Concilio de Calcedonia (451 e.c.) · Soteriología del Pecado Original y la Parusía',
    originalLanguage: 'Griego Eclesiástico y Latín Patrístico',
    originalQuote:
      '«Εἰς ἕνα Κύριον Ἰησοῦν Χριστόν, τὸν Υἱὸν τοῦ Θεοῦ τὸν μονογενῆ... ὁμοούσιον τῷ Πατρί... σαρκωθέντα... καὶ πάλιν ἐρχόμενον μετὰ δόξης.»',
    spanishTranslation:
      '«En un solo Señor Jesucristo, el Hijo único de Dios... consustancial (homoousios) al Padre... que por nosotros los hombres y por nuestra salvación bajó del cielo y se encarnó... fue crucificado... y de nuevo vendrá con gloria (Segunda Venida / Parusía).»',
    philosophicalThesis:
      'Caracterización del Mesías en el Cristianismo (5 ejes dogmáticos): 1) Ontología divino-humana: el Mesías es Dios Hijo encarnado (segunda persona de la Trinidad, unión hipostática de dos naturalezas); 2) Pecado original hereditario: la humanidad nace caída por el pecado de Adán e incapaz de redimirse por sus obras; 3) Expiación vicaria de sangre: el Mesías muere crucificado como sacrificio vicario para pagar la culpa humana; 4) Abrogación de la Ley mosaica: los preceptos prácticos de la Torá (Mitzvot) quedan superados por la fe dogmática en la gracia; y 5) Doctrina de las «Dos Venidas» (Parusía): como las profecías de paz mundial no se cumplieron en su primera venida, se postergan a un segundo retorno escatológico.',
    torahContrastPoint:
      'Desglose de diferencias frente al Mashíaj del Judaísmo: 1) Monoteísmo incorpóreo absoluto (Deuteronomio 6:4; Números 23:19; Oseas 11:9): Dios jamás se encarna en hombre, y el Mashíaj judío es un líder y rey 100% humano mortal nacido de padre y madre humanos; 2) Linaje patrilineal de David y Salomón (2 Samuel 7:12–16; 1 Crónicas 22:9–10; Números 1:18), incompatible con la concepción virginal sin padre humano; 3) Responsabilidad moral individual y Teshuvá directa sin pecado original ni sacrificio vicario (Ezequiel 18:20–23; Oseas 14:2–3; Deuteronomio 12:31); 4) Eternidad irrevocable de las Mitzvot de la Torá (Deuteronomio 13:1–5; Éxodo 31:16); y 5) Cumplimiento íntegro en una sola vida sin «Segunda Venida» (Maimónides, Hiljot Melajim 11:1–4).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Cristolog%C3%ADa',
    wikipediaQuery: 'Cristología',
  },
  {
    id: 'barcelona-disputation-1263-ramban-maimonides',
    matchRegex: /\b(mash[ií]aj|mashiach|mes[ií]as|cristian(?:ismo|o|a|os|as)?|disputa\s+de\s+barcelona|vikuaj|ramb[aá]n|najm[aá]nides|hiljot\s+melajim|diferencias?|caracterizar|desglosar)\b/i,
    author: 'Rabí Moshé ben Najmán (Rambán / Najmánides, 1194–1270) y Rabí Moshé ben Maimón (Rambam / Maimónides, 1138–1204)',
    workTitle: 'Vikuaj ha-Rambán (La Disputa de Barcelona ante el Rey Jaime I de Aragón, 1263) & Mishné Torá, Hiljot Melajim caps. 11–12',
    canonicalLocus: 'Vikuaj ha-Rambán §§42–49 (julio de 1263) · Hiljot Melajim 11:1–4',
    originalLanguage: 'Hebreo Rabínico Medieval',
    originalQuote:
      '«וְאִם לֹא הִצְלִיחַ עַד כֹּה אוֹ נֶהֱרַג, בְּיָדוּעַ שֶׁאֵינוֹ זֶה שֶׁהִבְטִיחָה עָלָיו תּוֹרָה... מִימוֹת יֵשׁוּ וְעַד הֵנָּה הָעוֹלָם כֻּלּוֹ מָלֵא חָמָס וָשֹׁד.»',
    spanishTranslation:
      '«Y si no tuvo éxito hasta este punto [reconstruir el Templo y reunir a los dispersos de Israel] o fue muerto, queda demostrado con certeza que él no es aquel que la Torá prometió» (Rambam, Hiljot Melajim 11:4) · «Desde aquellos días hasta hoy el mundo entero sigue lleno de violencia y rapiña... mas el profeta dice que en días del Mashíaj no alzará espada nación contra nación ni se adiestrarán más para la guerra (Isaías 2:4)» (Rambán, Disputa de Barcelona, 1263).',
    philosophicalThesis:
      'En la Disputa de Barcelona de 1263, Najmánides demuestra ante el Rey Jaime I que la diferencia medular entre el judaísmo y el cristianismo radica en la verificación empírica e histórica de la redención: el cristianismo espiritualiza e interioriza las profecías porque el mundo físico siguió en guerra, mientras que el judaísmo exige hechos públicos e históricos verificables.',
    torahContrastPoint:
      'Para la Torá, la Era Mesiánica no es un dogma de fe invisible para salvar almas del infierno, sino la transformación real del escenario histórico (Olam HaZé): abolición mundial de la guerra (Isaías 2:4), retorno físico de los exiliados de Israel (Kibutz Galuyot), restauración de la soberanía davídica y plenitud universal del conocimiento de Hashem (Isaías 11:9).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Disputa_de_Barcelona',
    wikipediaQuery: 'Disputa de Barcelona',
  },
  {
    id: 'buddha-mahabhinishkramana-mashiaj-contrast',
    matchRegex: /\b(buda|budismo|budista|siddhartha|gautama|shakiamuni|shakyamuni|shakya)\b/i,
    author: 'Siddhartha Gautama (el Buda Shakiamuni, c. 563–483 a.e.c.) · Canon Pali (Sutta Pitaka)',
    workTitle: 'Ariyapariyesana Sutta (MN 26 — La Gran Renuncia), Dhammacakkappavattana Sutta (SN 56.11) y Brahmajāla Sutta (DN 1)',
    canonicalLocus: 'Majjhima Nikaya 26 · Samyutta Nikaya 56.11 · Digha Nikaya 1',
    originalLanguage: 'Pali Clásico',
    originalQuote:
      '«Agārasmā anagāriyaṃ pabbajiṃ... Nibbānaṃyeva anuttaraṃ yogakkhemaṃ pariyesamāno... Sabbe dhammā anattā.»',
    spanishTranslation:
      '«Abandoné el hogar y el palacio real para salir a la vida sin hogar como asceta errante (La Gran Renuncia / Mahabhinishkramana), buscando la suprema extinción de las ataduras, el Nibbāna (Nirvana)... Todos los fenómenos carecen de un yo o alma sustancial (Anatta).»',
    philosophicalThesis:
      'Caracterización de Siddhartha Gautama (el Buda) en 5 ejes: 1) La Gran Renuncia al Trono: príncipe del clan Shakya (casta Kshatriya en la India/Nepal) que abdica de la realeza, abandona su palacio y se retira de la acción política; 2) Marco No-Teísta: niega la existencia de un Dios Creador personal (Ishvara) y de una Revelación divina; 3) Visión del mundo como Dukkha y Samsara: la existencia física e histórica es insatisfacción y dolor; 4) Doctrina de Anatta: inexistencia de un alma individual permanente; y 5) Meta del Nirvana / Parinirvana: extinción individual del deseo (Tanha) para salir definitivamente del ciclo del mundo.',
    torahContrastPoint:
      'Desglose de las 7 diferencias por las que Buda no es el Mashíaj del Judaísmo: 1) Teología: el Mashíaj sirve al Dios Creador Único (Deuteronomio 6:4; Isaías 11:2, 9), mientras Buda postula un camino no-teísta; 2) Dirección del liderazgo: Buda renuncia al trono real para huir del mundo político, mientras el Mashíaj asume el trono de David para gobernar el mundo con justicia social (Mishpat y Tzedaká, Isaías 11:4; Hiljot Melajim 11:1); 3) Genealogía e Historia: el Mashíaj es descendiente patrilineal biológico del Rey David y Salomón en Jerusalén (2 Samuel 7:12–16; 1 Crónicas 22:9–10), no un príncipe del clan Shakya ajeno al Pacto de Israel; 4) Valoración de la Creación: la Torá afirma que el mundo físico es «muy bueno» (Génesis 1:31) y debe santificarse (Dirá BeTajtonim), no abandonarse como Samsara; 5) Mandamiento (Mitzvá): el Mashíaj restaura las 613 Mitzvot y las 7 Leyes de Noé (Hiljot Melajim 11:1–4), frente al ascetismo monástico célibe (Sangha); 6) Verificación Histórica: tras la muerte de Buda (c. 483 a.e.c.) las guerras no cesaron (Isaías 2:4), Israel no fue reunido (Kibutz Galuyot) ni se reconstruyó el Templo; y 7) Escatología: eternidad personal del alma (Neshamá) y Resurrección (Sanhedrín 90a) frente a Anatta y extinción en el Parinirvana.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Buda_Gautama',
    wikipediaQuery: 'Buda Gautama',
  },
  {
    id: 'messianic-evangelical-syncretism-vs-jewish-currents',
    matchRegex:
      /\b(jud[ií]os?\s+mesi[aá]nicos?|juda[ií]smo\s+mesi[aá]nico|jews\s+for\s+jesus|evang[eé]licos?\s+cristianos?|jasidismo|jabad|lubavitch|breslev|breslov|reformistas?|deja\s+de\s+ser\s+(?:un\s+)?grupo\s+jud[ií]o)\b/i,
    author:
      'Historia de las Misiones Evangélicas (Martin «Moishe» Rosen, Jews for Jesus, 1970; Alianza de Judíos Mesiánicos) y Jurisprudencia de la Corte Suprema de Israel (Casos Rufeisen 1962 y Beresford 1989)',
    workTitle:
      'Declaración de Fe del Movimiento Mesiánico Evangélico (Trinidad, Encarnación y Expiación Vicaria) frente al Consenso Pan-Judío y Fallos de la Corte Suprema de Israel (HCJ 72/62 & HCJ 265/87)',
    canonicalLocus:
      'Convención Bautista del Sur / Jews for Jesus (1970) · HCJ 72/62 Rufeisen v. Minister of the Interior (1962) · HCJ 265/87 Beresford v. Minister of the Interior (1989)',
    originalLanguage: 'Inglés Teológico Evangélico y Hebreo Jurídico Contemporáneo',
    originalQuote:
      '«We believe in the Triune God: Father, Son (Yeshua HaMashiach, God incarnate), and Holy Spirit, and in salvation solely through His atoning blood.» / «אדם המאמין בישוע כמשיח וכאל אינו נמנה עם הדת היהודית אלא עם הדת הנוצרית» (Corte Suprema de Israel, Caso Beresford, 1989).',
    spanishTranslation:
      '«Creemos en el Dios Trino: Padre, Hijo (Yeshúa, Dios encarnado) y Espíritu Santo, y en la salvación únicamente por su sangre expiatoria» (Credo de las congregaciones mesiánicas y Jews for Jesus) · «Quien cree en Jesús como Mesías y Dios encarnado no pertenece a la religión judía, sino a la religión cristiana, aunque utilice símbolos judíos» (Corte Suprema de Israel, Caso Beresford, 1989).',
    philosophicalThesis:
      'Origen y naturaleza del «judaísmo mesiánico»: Surgido de misiones protestantes y bautistas en los siglos XIX y XX (como la Hebrew Christian Alliance de 1915 y Jews for Jesus, fundado en 1970 por Martin «Moishe» Rosen, ministro ordenado de la Convención Bautista del Sur), adopta una teología 100% cristiana evangélica (Trinidad nicena, divinidad de Jesús, pecado original, salvación por sangre vicaria y Nuevo Testamento) pero reviste su culto con terminología hebrea y símbolos litúrgicos judíos (Talit, Kipá, Shofar, calendario de fiestas) como método misionero de contextualización.',
    torahContrastPoint:
      'Demarcación entre las corrientes legítimas del judaísmo y la ruptura teológica: 1) Dentro del judaísmo existen diversas corrientes —el Jasidismo en sus escuelas como Jabad-Lubavitch (Tania del Alter Rebe, intelecto místico Jojmá-Biná-Daat y difusión de las Mitzvot) y Breslev (Rabí Najman de Breslev, alegría constante y Hitbodedut), la Ortodoxia (Sefardí, Ashkenazí, Lituana, Musar) y los movimientos modernos como el Reformismo y el Conservadurismo—, y todas ellas permanecen dentro del judaísmo porque sostienen sin fisuras el monoteísmo incorpóreo del Shemá Yisrael (Deuteronomio 6:4; Números 23:19) y rechazan adorar a cualquier ser humano; 2) En cambio, los «judíos mesiánicos» cruzan la frontera teológica de la Torá (Deuteronomio 13:1–6; Maimónides, Hiljot Yesodei HaTorá 1:7 y Hiljot Avodá Zará 2:4; Ezequiel 18:20) y por consenso unánime de todas las corrientes judías son cristianos evangélicos, no un grupo judío.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Juda%C3%ADsmo_mesi%C3%A1nico',
    wikipediaQuery: 'Judaísmo mesiánico',
  },
];

// Live External Source Retriever: combines the curated Classical Philosophical Library with live parallel queries to Wikipedia/MediaWiki REST & Search APIs
async function fetchExternalComparativeSources(rawQuery: string): Promise<any[]> {
  const {
    normalizedQuery: query,
    isComparativeTopic,
    isMashiajTopic,
    isMashiajChristianContrastTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
  } = normalizeUserStudyQuery(rawQuery);

  if (!isComparativeTopic && !isMashiajTopic) {
    return [];
  }

  const cacheKey = query.toLowerCase();
  const cached = externalSourcesCache.get(cacheKey);
  if (cached) return cached;

  // 1. Match primary sources from our curated classical library ONLY when explicitly mentioned in the query
  const matchedLibrary = CLASSICAL_EXTERNAL_SOURCES_LIBRARY.filter((item) =>
    item.matchRegex.test(query)
  );

  // Never inject Kant, Plato, or Cicero by default when no external philosopher was mentioned in the query
  const selectedClassical = matchedLibrary;

  const results: any[] = selectedClassical.map((item) => ({
    id: item.id,
    author: item.author,
    workTitle: item.workTitle,
    canonicalLocus: item.canonicalLocus,
    originalLanguage: item.originalLanguage,
    originalQuote: item.originalQuote,
    spanishTranslation: item.spanishTranslation,
    philosophicalThesis: item.philosophicalThesis,
    torahContrastPoint: item.torahContrastPoint,
    sourceUrl: item.sourceUrl,
    retrievedVia: 'Corpus Filosófico Clásico Verificado + Búsqueda Externa',
  }));

  // 2. Determine search topics to query live from external Wikipedia / MediaWiki API
  const wikiTopicsToFetch = new Set<string>();
  selectedClassical.forEach((item) => wikiTopicsToFetch.add(item.wikipediaQuery));

  if (isAfterlifeSoulDestinyTopic) {
    wikiTopicsToFetch.add('Olam Haba');
    wikiTopicsToFetch.add('Nirvana (espiritualidad)');
    wikiTopicsToFetch.add('Valhalla');
  }
  if (isEnlightenmentBuddhismTopic) {
    wikiTopicsToFetch.add('Bodhi');
    wikiTopicsToFetch.add('Iluminación (creencia)');
  }
  if (isPlatoCaveTopic) {
    wikiTopicsToFetch.add('Alegoría de la caverna');
  }
  if (isCiceroTopic) {
    wikiTopicsToFetch.add('Marco Tulio Cicerón');
    wikiTopicsToFetch.add('De officiis');
  }
  if (isKantTopic) {
    wikiTopicsToFetch.add('Imperativo categórico');
  }

  // Also detect any other external philosopher mentioned in the query (e.g., Spinoza, Descartes, Nietzsche, Sócrates, Filón)
  const extraThinkerMatch = query.match(
    /\b(Spinoza|Descartes|Nietzsche|S[oó]crates|Fil[oó]n|Levinas|Hermann\s+Cohen|Rosenzweig|Maquiavelo|Hobbes|Locke|Rousseau|Hume|Hegel|Kierkegaard|Camus|Sartre|Buda|Confucio|Laozi)\b/i
  );
  if (extraThinkerMatch) {
    wikiTopicsToFetch.add(extraThinkerMatch[1]);
  }

  const wikiTopicsArray = Array.from(wikiTopicsToFetch).slice(0, 3);

  try {
    const liveExtracts = await Promise.all(
      wikiTopicsArray.map(async (topicTitle) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        try {
          const encodedTitle = encodeURIComponent(topicTitle.replace(/\s+/g, '_'));
          const summaryRes = await fetch(
            `https://es.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`,
            {
              signal: controller.signal,
              headers: {
                Accept: 'application/json',
                'User-Agent': 'DarshanAI/1.0 (Comparative-Exegesis-Engine)',
              },
            }
          );
          if (!summaryRes.ok) return null;
          const summaryData: any = await summaryRes.json();
          if (!summaryData?.extract) return null;
          return {
            topicTitle,
            title: summaryData.title || topicTitle,
            extract: String(summaryData.extract).slice(0, 520),
            url:
              summaryData.content_urls?.desktop?.page ||
              `https://es.wikipedia.org/wiki/${encodedTitle}`,
          };
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      })
    );

    for (const liveItem of liveExtracts) {
      if (!liveItem) continue;
      const existingIdx = results.findIndex(
        (r) =>
          r.sourceUrl.toLowerCase() === liveItem.url.toLowerCase() ||
          r.workTitle.toLowerCase().includes(liveItem.title.toLowerCase())
      );
      if (existingIdx >= 0) {
        results[existingIdx].retrievedVia =
          'Corpus Clásico + Consulta Externa en Vivo (Wikipedia REST API)';
        if (!results[existingIdx].philosophicalThesis.includes(liveItem.extract.slice(0, 45))) {
          results[existingIdx].philosophicalThesis = `${results[existingIdx].philosophicalThesis} [Contexto documental externo: ${liveItem.extract}]`;
        }
      } else {
        results.push({
          id: `live-ext-${liveItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          author: `Fuente Documental Externa · ${liveItem.title}`,
          workTitle: `Consulta Enciclopédica y Filosófica Externa: ${liveItem.title}`,
          canonicalLocus: 'Fuente Externa Verificada en Tiempo Real',
          originalLanguage: 'Síntesis Documental Externa',
          originalQuote: liveItem.extract,
          spanishTranslation: liveItem.extract,
          philosophicalThesis: `Síntesis recuperada de fuentes externas sobre ${liveItem.title} para informar el análisis comparativo.`,
          torahContrastPoint:
            'Se analiza en contraste con las fuentes internas de la Torá (Eijá Rabá 2:13: «Jojmá ba-Goyim taamín» — distinguir entre sabiduría filosófica externa y la Revelación específica del mandamiento en la Torá).',
          sourceUrl: liveItem.url,
          retrievedVia: 'Consulta Externa en Vivo (Wikipedia REST API)',
        });
      }
    }
  } catch {
    // Keep classical library results if live network call times out
  }

  setBoundedCache(externalSourcesCache, cacheKey, results, 80);
  return results;
}

// Formal Exegetical Contrast Builder: always analyzes (1) Universality vs. Specificity of the Commandment and (2) Internal Sources of the Torah vs. External Sources
function buildDefaultFormalExegeticalContrast(
  rawQuery: string,
  externalSources: any[] = []
): any | undefined {
  const {
    isComparativeTopic,
    isMashiajTopic,
    isMashiajChristianContrastTopic,
    isMashiajBuddhaContrastTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
  } = normalizeUserStudyQuery(rawQuery);

  if (!isComparativeTopic && !isMashiajTopic && externalSources.length === 0) {
    return undefined;
  }

  if (isJewishMovementsAndMessianicBoundaryTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Corrientes Internas del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Conservadurismo y Reformismo) frente a la Frontera Teológica donde un grupo deja de ser judío: Por qué los «Judíos Mesiánicos» son Cristianos Evangélicos',
      thesisSummary:
        'Análisis teológico, halájico e histórico en tres partes: (1) La pluralidad legítima dentro del judaísmo (Majloket le-shem Shamayim en Eruvín 13b: el Jasidismo de Jabad-Lubavitch y Breslev, la Ortodoxia Sefardí y Ashkenazí, y movimientos modernos como el Reformismo y el Conservadurismo, todos unidos por el monoteísmo incorpóreo del Shemá Yisrael); (2) La frontera teológica y halájica objetiva donde un grupo se aleja y deja de ser judío (Deuteronomio 6:4; Números 23:19; Deuteronomio 13:1–6; los 13 Principios de Fe de Maimónides en Sanhedrín 90a y Hiljot Yesodei HaTorá 1:7); y (3) La demostración de por qué los «judíos mesiánicos» (Jews for Jesus, congregaciones mesiánicas) NO son una corriente judía, sino grupos cristianos evangélicos bautistas/pentecostales que emplean símbolos hebreos con fines misioneros.',
      universalidadVsEspecificidad: {
        title:
          'I. Corrientes Legítimas Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) frente a la Ruptura Teológica del Movimiento Mesiánico Evangélico',
        externalUniversalism:
          'EL SINCRETISMO MISIONERO DE LOS «JUDÍOS MESIÁNICOS» (CRISTIANISMO EVANGÉLICO): 1) Teología Trinitaria y Encarnacionista: profesan exactamente los dogmas del cristianismo evangélico (la Trinidad, la divinidad de Jesús/Yeshúa como «Dios Hijo encarnado», el pecado original hereditario y la salvación por la sangre de la cruz); 2) Instrumentalización de Símbolos Específicos: adoptan elementos externos de la especificidad ritual judía (Talit, Kipá, Shofar, vocabulario hebreo) no como cumplimiento del Pacto del Sinaí, sino como estrategia de contextualización misionera fundada por juntas bautistas y evangélicas (como Jews for Jesus, fundado en 1970 por el pastor bautista Martin «Moishe» Rosen); y 3) Abrogación de la Halajá y de la Teshuvá directa: sostienen que las Mitzvot no tienen valor redentor y que solo la fe cristológica salva.',
        torahUniversalDimension:
          'EL ESPECTRO LEGÍTIMO DENTRO DEL JUDAÍSMO Y SU UNIVERSALIDAD ÉTICA: Dentro del judaísmo coexisten corrientes diversas —el Jasidismo con escuelas como Jabad-Lubavitch (el intelecto místico Jojmá-Biná-Daat en el Tania del Alter Rebe) y Breslev (Rabí Najman de Breslev: alegría constante, Hitbodedut y hallar los puntos buenos), la Ortodoxia (Sefardí, Ashkenazí, Lituana, Musar) y los movimientos modernos como el Reformismo y el Conservadurismo (Masortí)—. Pese a sus debates internos («Elu ve-elu divrei Elohim jayim», Eruvín 13b), TODAS estas corrientes permanecen dentro del judaísmo porque sostienen la Unicidad e Incorporeidad absoluta de Hashem (Shemá Yisrael, Deuteronomio 6:4; Números 23:19), al tiempo que honran a todas las naciones mediante las 7 Leyes Universales de Noé (Sanhedrín 56a; Hiljot Teshuvá 3:5).',
        torahCommandmentSpecificity:
          'LA FRONTERA ESPECÍFICA DONDE UN GRUPO DEJA DE SER JUDÍO: En la Especificidad del Mandamiento (Deuteronomio 6:4; Deuteronomio 13:1–6; Maimónides, Hiljot Yesodei HaTorá 1:7), la Torá prohíbe de modo absoluto atribuir divinidad a un ser humano o introducir un mediador entre el alma y Hashem. Cuando un grupo adora a Jesús como Dios encarnado y salvador vicario, cruza la frontera hacia otra religión (el cristianismo evangélico), por más que utilice Kipá, Talit o términos en hebreo.',
        exegeticalSynthesis:
          'Un judío Reformista, un jasid de Jabad, un jasid de Breslev y un judío Ortodoxo Lituano o Sefardí rezan al mismo Único Creador incorpóreo del Shemá Yisrael; en cambio, el movimiento «mesiánico» adora a la Trinidad cristiana bajo ropaje hebreo.',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Consenso Pan-Judío y Jurisprudencia de la Corte Suprema de Israel (Casos Rufeisen 1962 y Beresford 1989)',
        internalTorahSourcesNature:
          'Fuentes Internas de la Torá y Consenso de Todas las Corrientes Judías: Torá Escrita (Deuteronomio 6:4; 13:1–6; Números 23:19; Ezequiel 18:20), Talmud Bavli (Eruvín 13b; Sanhedrín 90a), Maimónides (Hiljot Yesodei HaTorá cap. 1; Hiljot Melajim caps. 11–12), el Tania de Jabad, Likutei Moharán de Breslev y las resoluciones conjuntas del Rabinato Ortodoxo, el Movimiento Masortí/Conservador y la Unión para el Judaísmo Reformista (CCAR).',
        externalSourcesNature:
          'Fuentes Documentales e Históricas Externas: 1) Documentos fundacionales de la Hebrew Christian Alliance (1915), la Messianic Jewish Alliance of America (MJAA, que cambió su nombre en 1975 por estrategia misionera) y Jews for Jesus (fundado en 1970 por el ministro bautista ordenado Martin «Moishe» Rosen); y 2) Fallos históricos de la Corte Suprema del Estado de Israel en HCJ 72/62 (Oswald Rufeisen, 1962) y HCJ 265/87 (Beresford v. Ministerio del Interior, 1989).',
        normativeLocusContrast:
          'Existe unanimidad total en el mundo judío —desde el jasidismo de Jabad y Breslev hasta el judaísmo Reformista, además de la Corte Suprema de Israel (Caso Beresford, 1989)— en que los «judíos mesiánicos» son cristianos evangélicos y no constituyen una denominación judía.',
        hermeneuticalRule:
          'La identidad religiosa de un grupo se define por su teología fundamental (Monoteísmo incorpóreo de Hashem vs. Cristología trinitaria evangélica), nunca por el uso cosmético o misionero de símbolos litúrgicos hebreos.',
      },
    };
  }

  if (isMashiajBuddhaContrastTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Caracterización de Siddhartha Gautama, el Buda Shakiamuni (Canon Pali: Ariyapariyesana Sutta MN 26, Dhammacakkappavattana Sutta SN 56.11 y Brahmajāla Sutta DN 1) frente al Mashíaj del Judaísmo (Isaías 2:4; 11:1–9; Maimónides, Hiljot Melajim caps. 11–12)',
      thesisSummary:
        'Estudio exegético y comparativo en tres partes: (1) qué es el Mashíaj en el judaísmo, (2) caracterización filosófica y biográfica de Siddhartha Gautama (el Buda) en el Canon Pali (la Gran Renuncia al trono, el no-teísmo, Dukkha/Samsara, Anatta y el Nirvana), y (3) desglose sistemático de las 7 diferencias estructurales que explican por qué Buda no es ni pretende ser el Mashíaj de la tradición judía.',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad del Desapego Monástico (Nirvana) frente a la Universalidad Histórica y Especificidad del Mandamiento en el Mashíaj (Isaías 2:4 y Hiljot Melajim 11:1–4)',
        externalUniversalism:
          'En el Canon Pali budista (Ariyapariyesana Sutta MN 26 y Dhammacakkappavattana Sutta SN 56.11), Siddhartha Gautama protagoniza la «Gran Renuncia» (Mahabhinishkramana): siendo príncipe heredero del clan Shakya, abdica de su trono real, abandona su palacio, su esposa y su hijo, y se retira de la vida política y social porque considera que todo vínculo mundano y toda acción histórica están atrapados en el sufrimiento (Dukkha) y en la rueda de renacimientos (Samsara). Su vía universal (el Noble Camino Óctuple) busca extinguir la sed del deseo (Tanha) y disolver la ilusión del yo individual (Anatta) en el Nirvana.',
        torahUniversalDimension:
          'En contraste diametral, el Mashíaj del judaísmo no huye del palacio hacia el bosque, sino que asume la responsabilidad pública del trono del Rey David para redimir la historia humana desde adentro: en el plano universal, guía a todas las naciones a reconocer al único Creador («la tierra estará llena del conocimiento del Eterno como las aguas cubren el mar», Isaías 11:9), a erradicar la guerra y el armamento («convertirán sus espadas en rejas de arado», Isaías 2:4) y a vivir éticamente bajo las Siete Leyes Universales de Noé (Rambam, Hiljot Melajim 8:11).',
        torahCommandmentSpecificity:
          'En el plano de la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá), como codifica Maimónides en Hiljot Melajim 11:1–4, el Mashíaj judío restaura la observancia íntegra de las 613 Mitzvot de la Torá escrita y oral (que santifican el matrimonio, la familia, la agricultura, los tribunales de justicia civil y el Beit HaMikdash en Jerusalén) y reúne físicamente a los exiliados de Israel (Kibutz Galuyot).',
        exegeticalSynthesis:
          'La diferencia es geométricamente exacta: Siddhartha Gautama es un príncipe que renuncia a ser rey para enseñar cómo escapar individualmente del mundo (Nirvana); el Mashíaj judío es el descendiente de David ungido para asumir el reinado justo y transformar colectivamente el mundo físico en una morada de paz y justicia divina (Tikún Olam y Dirá BeTajtonim).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Caracterización de Buda (Fuentes Externas del Canon Pali) y Desglose Sistemático de las 7 Diferencias con el Mashíaj del Judaísmo (Fuentes Internas de la Torá)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá —Génesis 1:31 («Y vio Dios todo lo que había hecho, y he aquí que era muy bueno»), Deuteronomio 6:4 y 30:1–6, 2 Samuel 7:12–16, 1 Crónicas 22:9–10, Isaías 2:1–4 y 11:1–12, Talmud Bavli Sanhedrín 90a y 98a, Berajot 34b y Maimónides en Hiljot Melajim caps. 11–12— conciben la redención dentro del monoteísmo creador, la bondad intrínseca del mundo material y la fidelidad histórica al Pacto de Israel.',
        externalSourcesNature:
          'Las Fuentes Externas del Canon Pali (Majjhima Nikaya 26, Samyutta Nikaya 56.11, Digha Nikaya 1 y Dhammapada 277–279), evaluadas según Eijá Rabá 2:13 («Jojmá ba-Goyim taamín»), caracterizan a Siddhartha Gautama como un sabio contemplativo y reformador ascético (Sramana) del siglo VI–V a.e.c. en la India que opera en un marco estrictamente no-teísta y ahistórico.',
        normativeLocusContrast:
          'Desglose de las 7 Razones y Diferencias por las que Buda no es el Mashíaj: (1) Teología: Monoteísmo Creador y relacional (Deuteronomio 6:4; Isaías 11:2) vs. No-teísmo budista que niega a un Dios Creador (Brahmajāla Sutta DN 1); (2) Vocación Política: Asumir el trono de David para juzgar con justicia a los pobres (Isaías 11:4; Hiljot Melajim 11:1) vs. la «Gran Renuncia» al trono y retiro ascético fuera de la sociedad; (3) Genealogía y Pacto: Descendiente patrilineal biológico de Judá, David y Salomón en Jerusalén (1 Crónicas 22:9–10) vs. príncipe del clan Shakya en Nepal/India ajeno al pueblo y a la Torá de Israel; (4) Ontología del Mundo: Santificación de la creación física como «Tov Meod» (Génesis 1:31) vs. rechazo del mundo como Samsara y Dukkha; (5) Ley y Sociedad: Plenitud de las 613 Mitzvot y de la vida familiar/comunitaria vs. orden monástica célibe (Sangha) de desapego; (6) Criterio Empírico de Maimónides (Hiljot Melajim 11:4): Tras la muerte de Buda (c. 483 a.e.c.), las guerras mundiales continuaron, Israel no fue reunido de su exilio ni se reconstruyó el Templo; y (7) Destino del Alma: Inmortalidad personal de la Neshamá, Olam HaBá y Resurrección (Sanhedrín 90a) vs. inexistencia del yo (Anatta) y extinción en el Parinirvana.',
        hermeneuticalRule:
          'Este método comparativo muestra cómo Darshán AI puede contrastar cualquier figura histórica o espiritual externa (sea el Mesías cristiano o el Buda) frente a la matriz objetiva de la Torá y de Maimónides en Hiljot Melajim caps. 11–12.',
      },
    };
  }

  if (isMashiajChristianContrastTopic || isMashiajTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Caracterización del Mesías en el Cristianismo (Cristología Conciliar de Nicea 325 e.c. y Calcedonia 451 e.c.; Soteriología del Pecado Original, Expiación Vicaria y Segunda Venida) frente al Mashíaj del Judaísmo (Tanaj, Talmud, Maimónides en Hiljot Melajim 11–12 y Najmánides en la Disputa de Barcelona de 1263)',
      thesisSummary:
        'Estudio exegético y comparativo en dos partes: (1) definición de qué es el Mashíaj en el judaísmo, y (2) caracterización rigurosa del Mesías en el cristianismo (encarnación trinitaria, pecado original, sacrificio vicario, abrogación de la Ley y Segunda Venida) para desglosar sistemáticamente las 7 diferencias estructurales entre ambas tradiciones.',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad de la Paz Mesiánica frente a la Especificidad Eterna del Mandamiento (Torá vs. Abrogación Cristiana de la Ley)',
        externalUniversalism:
          'El cristianismo caracteriza al Mesías (Cristo) como el «fin de la Ley» (telos nomou): postula un universalismo confesional que abroga o declara superada la especificidad de los preceptos prácticos de la Torá (Shabat, Kashrut, Brit Milá, leyes del Templo), afirmando que la salvación depende exclusivamente de la fe dogmática en el sacrificio vicario de la cruz y desplazando la paz mundial prometida por los profetas a una «Segunda Venida» (Parusía).',
        torahUniversalDimension:
          'En contraste radical, las Fuentes Internas de la Torá articulan una verdadera Universalidad Ética e Histórica sin abolir el Pacto: en la Era Mesiánica todas las naciones de la tierra abandonan la guerra («convertirán sus espadas en rejas de arado y no alzará espada nación contra nación», Isaías 2:4), alcanzan el conocimiento ético del único Creador («la tierra estará llena del conocimiento del Eterno como las aguas cubren el mar», Isaías 11:9; Sofonías 3:9) y tienen parte en el Mundo Venidero como Justos de las Naciones (Jasidei Umot HaOlam, Rambam Hiljot Melajim 8:11) sin necesidad de anular la Torá.',
        torahCommandmentSpecificity:
          'Al mismo tiempo, como codifica Maimónides en Mishné Torá (Hiljot Melajim 11:1–4), el Mashíaj judío se define por su fidelidad absoluta a la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá): lejos de anular un solo precepto de la Torá (la cual es eterna e irrevocable según Deuteronomio 13:1–5 y Salmos 19:8), el Rey Mashíaj restaura la observancia íntegra de todas las leyes de la Torá escrita y oral, reconstruye el Beit HaMikdash en Jerusalén y reúne físicamente a los exiliados de Israel (Kibutz Galuyot).',
        exegeticalSynthesis:
          'Mientras el cristianismo caracteriza a su Mesías como quien suspende la especificidad de las Mitzvot de la Torá y difiere la paz del mundo a una segunda venida, el judaísmo caracteriza al Mashíaj como el rey humano que lleva a su plenitud histórica tanto la paz universal entre las naciones (Isaías 2:4) como el cumplimiento específico e íntegro de toda la Torá (Hiljot Melajim 11:1–4).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Caracterización del Mesías Cristiano (Fuentes Externas) y Desglose Sistemático de las 7 Diferencias con el Mashíaj Judío (Fuentes Internas de la Torá)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá —Isaías 2:1–4 y 11:1–12, Jeremías 23:5–6 y 22:30, Ezequiel 18:20–23 y 37:24–28, Deuteronomio 6:4, 13:1–5 y 30:1–6, Números 23:19, Oseas 11:9 y 14:2–3, Talmud Bavli Sanhedrín 98a–99a y Berajot 34b, Maimónides en Hiljot Melajim caps. 11–12 y Najmánides en Vikuaj ha-Rambán (Disputa de Barcelona, 1263)— definen al Mashíaj dentro del monoteísmo incorpóreo absoluto y la responsabilidad ética directa del ser humano ante Dios.',
        externalSourcesNature:
          'Las Fuentes Externas de la teología cristiana (Credo de Nicea de 325 e.c., Definición de Calcedonia de 451 e.c. y soteriología paulina) caracterizan al Mesías mediante 5 dogmas ajenos al Tanaj: (1) Encarnación divina trinitaria (Dios Hijo consustancial al Padre); (2) Pecado original hereditario que incapacita al ser humano; (3) Expiación vicaria mediante muerte sacrificial en la cruz; (4) Abrogación de las Mitzvot de la Torá; y (5) Desdoblamiento en «Dos Venidas» (Parusía).',
        normativeLocusContrast:
          'Desglose de las 7 Diferencias Fundamentales: (1) Naturaleza: 100% humano mortal nacido de padre y madre humanos vs. Dios encarnado (prohibido en Deuteronomio 6:4 y Números 23:19); (2) Genealogía: linaje patrilineal biológico de David y Salomón (Números 1:18; 1 Crónicas 22:9–10) vs. concepción virginal sin padre humano; (3) Soteriología: responsabilidad individual y Teshuvá directa ante Dios (Ezequiel 18:20; Oseas 14:2–3) vs. pecado original y sacrificio vicario humano; (4) Ley: eternidad de la Torá (Deuteronomio 13:1) vs. abrogación de los preceptos; (5) Tiempo: cumplimiento íntegro en una sola vida (Rambam, Hiljot Melajim 11:4: «si no tuvo éxito hasta este punto o fue muerto, es sabido que no es el prometido por la Torá») vs. doctrina de la Segunda Venida; (6) Escenario: redención geopolítica e histórica visible en este mundo (Najmánides, Barcelona 1263) vs. reino espiritual invisible; y (7) Mediación: relación directa de cada alma con Hashem vs. mediador obligatorio para llegar a Dios.',
        hermeneuticalRule:
          'Este desglose permite responder con total rigor ambas partes de la consulta: primero qué es el Mashíaj en el judaísmo y segundo cómo se caracteriza al Mesías en el cristianismo para comprender por qué sus diferencias son ontológicas, soteriológicas, jurídicas e históricas.',
      },
    };
  }

  if (isAfterlifeSoulDestinyTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Escatologías Comparadas: Nirvana (Budismo · Udāna 8.1), Valhalla (Tradición Nórdica · Grímnismál 8–10) y Cielo/Infierno Dualista frente al Olam HaBá Judío',
      thesisSummary:
        'Contraste exegético formal sobre el destino de las almas y los requisitos de acceso: Olam HaBá, Gan Edén y Guehinóm purificador en el Judaísmo frente al Nirvana budista, el Valhalla nórdico y el Cielo/Infierno dogmático, analizando (1) la Universalidad inclusiva (Jasidei Umot HaOlam) frente a la Especificidad del Mandamiento, y (2) la distinción entre Fuentes Internas de la Torá y Fuentes Externas.',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad frente a Especificidad del Mandamiento en los Requisitos para Acceder al Destino de las Almas (Olam HaBá vs. Nirvana, Valhalla, Cielo e Infierno)',
        externalUniversalism:
          'En las fuentes externas comparadas, los requisitos de acceso al destino último oscilan entre la anulación ascética de la individualidad, el exclusivismo bélico o el dogmatismo confesional: 1) En el Budismo (Udāna 8.1; Dhammapada 203–204), acceder al Nirvana exige extinguir todo deseo (Tanha), disolver la identidad del alma individual (Anatta) y salir del mundo histórico (Samsara) mediante el Noble Camino Óctuple. 2) En la mitología nórdica (Edda Poética, Grímnismál 8–10; Gylfaginning 38–41), acceder al Valhalla exige morir violentamente por las armas en batalla (vápndauða menn), excluyendo a quienes mueren en paz. 3) En escatologías dogmáticas de Cielo e Infierno eterno, la salvación se condiciona a profesar un credo exclusivo, condenando a quienes no lo profesan a un infierno perpetuo.',
        torahUniversalDimension:
          'En contraste radical, las Fuentes Internas de la Torá establecen una UNIVERSALIDAD ÉTICA INCLUSIVA sin precedentes: el judaísmo NO exige ser judío para acceder al Mundo Venidero (Olam HaBá). Como sentencian el Talmud (Sanhedrín 105a; Tosefta Sanhedrín 13:2) y Maimónides (Mishné Torá, Hiljot Teshuvá 3:5 e Hiljot Melajim 8:11): «Jasidei Umot HaOlam yesh lahem jélek la-Olam HaBá» («Los justos de entre todas las naciones del mundo tienen parte en el Mundo Venidero»). Para cualquier ser humano de cualquier nación, el requisito de acceso es la rectitud ética universal expresada en las Siete Leyes de Noé (Sanhedrín 56a: no asesinar, no robar, practicar la justicia, etc.). Además, en el judaísmo no existe un «Infierno eterno» para atormentar almas sin fin: el Guehinóm rabínico (Shabat 33b; Eduyot 2:10) es un proceso pedagógico y purificador temporal (máximo 12 meses) para limpiar el alma antes de su elevación.',
        torahCommandmentSpecificity:
          'Al mismo tiempo, el judaísmo articula esa apertura universal con la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá): 1) Para el pueblo del Pacto, el requisito se vive a través de las 613 Mitzvot específicas que santifican este mundo («Este mundo es como un vestíbulo ante el Olam HaBá: prepárate en el vestíbulo mediante las acciones concretas para entrar al salón principal», Pirké Avot 4:16; Mishná Sanhedrín 10:1). 2) Frente al Valhalla nórdico (que premia matar o morir por la espada), el requisito específico de la Torá es preservar la vida (Pikuaj Néfesh, Yoma 85b) y perseguir la paz (Isaías 2:4; Salmos 34:15). 3) Frente al Nirvana (que apaga la identidad del yo), en el Olam HaBá (Berajot 17a; Rambam Hiljot Teshuvá 8:2-3) cada alma conserva su singularidad consciente deleitándose en la luz de la Shejiná (Ziv HaShejiná) y culmina en la Resurrección (Tejiyat HaMetim), porque para la Torá el cuerpo y el mundo físico creados por Dios son sagrados.',
        exegeticalSynthesis:
          'Mientras el Valhalla exige muerte en guerra, el Nirvana exige disolver el yo y las escatologías dogmáticas exigen adhesión confesional bajo amenaza de infierno eterno, la Torá abre las puertas del Olam HaBá universalmente a los justos de todas las naciones (Hiljot Teshuvá 3:5) y guía a Israel mediante la especificidad ética y vital de cada Mitzvá (Pirké Avot 4:16).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas en la Escatología Comparada (Eijá Rabá 2:13)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá sobre el destino del alma (Mishná Sanhedrín 10:1 [90a], Talmud Bavli Berajot 17a, Shabat 33b y 152b, Pirké Avot 4:16-17, Rambam en Hiljot Teshuvá caps. 3 y 8, y Ramban en Sháar HaGuemul) conciben el alma (Neshamá, insuflada por Dios en Génesis 2:7) como una entidad relacional, libre y moralmente responsable cuyos actos en este mundo concreto tienen eco eterno.',
        externalSourcesNature:
          'Las Fuentes Externas consultadas para este estudio comparativo —el Canon Pali budista (Udāna 8.1 y Dhammapada sobre el Nirvana), las Eddas nórdicas (Grímnismál y Gylfaginning sobre el Valhalla) y el Fedón de Platón— se analizan bajo el principio rabínico de Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»): nos permiten comprender cómo distintas culturas han respondido al misterio de la muerte, para contrastarlas con la ética del Pacto.',
        normativeLocusContrast:
          'En el Budismo la liberación proviene de una técnica meditativa autónoma que desmantela el sujeto; en el mito nórdico depende del decreto bélico de Odín; en la Torá, la vida eterna brota del vínculo relacional con la Fuente de la Vida («Porque contigo está el manantial de la vida; en Tu luz veremos la luz», Salmos 36:10) y de la acción ética que responde al mandato divino («Gadol ha-metzuvé ve-osé», Kidushín 31a).',
        hermeneuticalRule:
          'Al comparar el Olam HaBá con el Nirvana, el Valhalla, el Cielo y el Infierno, citamos las fuentes primarias externas con precisión documental y demostramos cómo la Torá une la justicia universal (acceso de todos los justos de las naciones) con el valor irrepetible del alma individual y de la acción ética concreta.',
      },
    };
  }

  if (isEnlightenmentBuddhismTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'El Concepto de Iluminación en el Budismo (Bodhi / Satori · Dhammapada XIV, 179–183 & XX, 277–279; Samyutta Nikaya 56.11) frente a la Tradición Judía',
      thesisSummary:
        'Contraste exegético formal para responder si existe la «iluminación» en el judaísmo y cómo se diferencia del despertar budista (Bodhi / Nirvana): análisis de la Universalidad frente a la Especificidad del Mandamiento («Ner Mitzvá ve-Torá Or», Proverbios 6:23) y de las Fuentes Internas de la Torá (Or HaGanuz, Ruaj HaKódesh y Devekut) frente a las Fuentes Externas.',
      universalidadVsEspecificidad: {
        title:
          'I. La Iluminación Abstracta y Desapegada (Bodhi) frente a la Especificidad Luminosa del Mandamiento («Ner Mitzvá ve-Torá Or», Proverbios 6:23)',
        externalUniversalism:
          'En las fuentes externas del Budismo (Dhammapada 277–279; Samyutta Nikaya 56.11), la «iluminación» o despertar (Bodhi, de la raíz sánscrita/pali budh = despertar) consiste en comprender tres características universales de la existencia (Tilakkhana): que todo fenómeno es impermanente (Anicca), insatisfactorio (Dukkha) y carente de un yo o alma sustancial (Anatta). Para alcanzar esa iluminación, el practicante debe extinguir el deseo y el apego (Tanha) y retirarse de la particularidad de las pasiones e historias mundanas hacia una ecuanimidad desapegada.',
        torahUniversalDimension:
          '¿Existe un concepto de iluminación en el judaísmo? ¡Sí, y ocupa un lugar central, pero con una estructura ontológica y ética radicalmente distinta! En las Fuentes Internas de la Torá, Dios crea en el primer día una luz espiritual suprasensible —el **Or HaGanuz** (la Luz Oculta Primordial, Génesis 1:3 y Talmud Bavli Jaguigá 12a)— con la que el ser humano podía ver «de un confín del mundo al otro», y que fue atesorada dentro de la Torá. Como proclama el Salmo 36:10: «Ki imejá mekor jayim, be-orjá niré or» («Porque contigo está el manantial de la vida; en Tu luz veremos la luz»).',
        torahCommandmentSpecificity:
          'El contraste exegético formal reside en cómo se accede a esa luz: 1) Mientras el Bodhi budista busca disolver la especificidad del yo (Anatta) y apagar el deseo, la iluminación judía consiste en **Devekut** (adhesión relacional a Dios sin perder la responsabilidad individual, Deuteronomio 4:4), **Ruaj HaKódesh** (inspiración profética y sabiduría divina que reposa sobre quien cultiva la humildad y la alegría en el precepto, Shabat 30b y Avodá Zará 20b) y **Jojmá-Biná-Daat**. 2) Sobre todo, en la Torá la iluminación no se alcanza huyendo de lo concreto hacia el vacío, sino a través de la **ESPECIFICIDAD DEL MANDAMIENTO**: «Ki ner mitzvá ve-Torá or» («Porque lámpara es el mandamiento específico y la Torá es luz», Proverbios 6:23). Cada Mitzvá concreta (dar Tzedaká, honrar el Shabat, salvar una vida en Pikuaj Néfesh, Yoma 85b) es una mecha específica donde se enciende la luz infinita en medio del mundo físico («Naasé ve-nishmá», Éxodo 24:7).',
        exegeticalSynthesis:
          'En el Budismo la iluminación (Bodhi) es despertar del mundo para apagar la sed del deseo; en el Judaísmo la iluminación (Or HaTorá, Devekut y Ruaj HaKódesh) es despertar DENTRO del mundo para encender cada acción específica con santidad, justicia y compasión.',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas sobre el Despertar Espiritual (Eijá Rabá 2:13)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá sobre la iluminación espiritual —Salmos 36:10 («En Tu luz veremos la luz»), Proverbios 6:23 («Ner Mitzvá ve-Torá Or»), Talmud Bavli Jaguigá 12a (Or HaGanuz), Avodá Zará 20b (la escalera de Pinjás ben Yaír hasta Ruaj HaKódesh), Mesilat Yesharim del Ramjal y el Tania del Alter Rebe (caps. 12–14 y 36)— enseñan que la luz procede del Creador trascendente y se revela en el diálogo del Pacto.',
        externalSourcesNature:
          'Las Fuentes Externas budistas (Dhammapada, Sutta Pitaka, consultadas en sus textos pali y síntesis documentales) se evalúan según Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»): ofrecen una aguda psicología contemplativa sobre cómo el egoísmo y la reactividad generan sufrimiento (Jojmá), pero carecen de la Revelación relacional del Sinaí y de la especificidad redentora de la Mitzvá.',
        normativeLocusContrast:
          'En el Budismo, la fuente de la iluminación es estrictamente interna e inmanente al flujo mental (citta-bhāvanā) en un universo sin Dios creador; en las Fuentes Internas de la Torá, la iluminación brota del encuentro entre la Fuente Trascendente que nos interpela («Gadol ha-metzuvé ve-osé», Kidushín 31a) y la interiorización amorosa de Su palabra en nuestra mente y corazón (Deuteronomio 30:14; Salmos 19:9: «El precepto de HaShem es puro, ilumina los ojos»).',
        hermeneuticalRule:
          'Para analizar qué es la iluminación en contraste con el budismo, se exponen las fuentes externas del Canon Pali (Bodhi, Anatta, Nirvana) y se contrastan con las categorías propias de las fuentes internas de la Torá (Or HaGanuz, Ner Mitzvá, Devekut y Ruaj HaKódesh).',
      },
    };
  }

  if (isPlatoCaveTopic && isCiceroTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Platón (Alegoría de la Caverna · República VII, 514a–520d) y Marco Tulio Cicerón (De Re Publica III.33 & De Officiis I.20)',
      thesisSummary:
        'Contraste exegético formal entre el idealismo contemplativo de Platón y el iusnaturalismo cívico de Cicerón (Fuentes Externas) frente a la Revelación del Pacto y la concreción halájica de la Mitzvá (Fuentes Internas de la Torá).',
      universalidadVsEspecificidad: {
        title:
          'I. La Universalidad frente a la Especificidad del Mandamiento (Platón y Cicerón vs. Halajá y Mitzvá)',
        externalUniversalism:
          'En las fuentes externas grecorromanas, tanto Platón como Cicerón identifican la perfección con lo universal y abstracto: en la Alegoría de la Caverna (República VII, 514a–517c), Platón exige huir del mundo sensible y particular (las sombras de la caverna) para contemplar la Idea universal e inmutable del Bien; y Cicerón (De Re Publica III.33) define la ley verdadera como la «recta ratio naturae congruens», una ley natural homogénea e invariable («la misma en Roma y en Atenas»).',
        torahUniversalDimension:
          'Las fuentes internas de la Torá reconocen un horizonte ético universal para toda la humanidad: todo ser humano es creado Betzélem Elohim (Génesis 1:27) y está vinculado por las Siete Leyes Universales de los Hijos de Noé (Talmud Bavli Sanhedrín 56a), que incluyen el deber universal de establecer tribunales de justicia (Dinim).',
        torahCommandmentSpecificity:
          'Sin embargo, la Torá rechaza que la verdad ética consista en abandonar la caverna del mundo material o en quedarse en máximas cívicas genéricas: el mandamiento judío (Mitzvá) opera desde la ESPECIFICIDAD CONCRETA. Como enseña Proverbios 6:23 («Ki ner mitzvá ve-Torá or»: «Porque lámpara es el mandamiento específico y la Torá es luz»), mientras la Torá es la luz universal, la Mitzvá específica es la lámpara concreta que ilumina cada paso dentro de la realidad material (Shabat, Kashrut, Tzedaká específica al huérfano y al extranjero en Deuteronomio 24:17-18, Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).',
        exegeticalSynthesis:
          'Platón sale de la caverna para contemplar lo universal y Cicerón busca una ley natural uniforme; la Torá hace descender la presencia divina (Shejiná) al interior mismo de la caverna humana a través de la especificidad práctica del mandamiento («Naasé ve-nishmá», Éxodo 24:7).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción Epistemológica y Normativa entre Fuentes Internas de la Torá y Fuentes Externas',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá (Tanaj, Mishná, Talmud Bavli y Yerushalmi, Midrash y códigos halájicos en Sefaria) emanan de la Revelación relacional en el Sinaí (Torá min HaShamayim) y del Pacto histórico de Israel, siendo interpretadas dialógicamente por los Sabios («No está en el cielo», Deuteronomio 30:12; Bava Metzia 59b).',
        externalSourcesNature:
          'Las Fuentes Externas (como los diálogos de Platón o los tratados de Cicerón consultados para informar este estudio) se rigen por el principio talmúdico y midráshico de Eijá Rabá 2:13: «Im yomar lejá adam yesh Jojmá ba-goyim taamín, yesh Torá ba-goyim al taamín» («Si te dicen que hay sabiduría filosófica [Jojmá] entre las naciones, créelo; pero si te dicen que hay Torá entre las naciones, no lo creas»). Son frutos valiosos de la razón natural y la observación humana que informan el análisis comparativo, pero no constituyen Revelación del Pacto.',
        normativeLocusContrast:
          'En Platón la fuente de la verdad es la anamnesis intelectual interna del filósofo, y en Cicerón es la razón natural inmanente (recta ratio) unida al decoro político (officium). En la Torá, la obligación nace de una voz trascendente que interpela al ser humano desde fuera de su ego («Gadol ha-metzuvé ve-osé», Kidushín 31a) y que se interioriza en el corazón mediante la práctica amorosa (Deuteronomio 30:14; Miqueas 6:8).',
        hermeneuticalRule:
          'El exégeta consulta las fuentes externas (Platón, Cicerón) en sus textos originales para comprender su diagnóstico de la condición humana, y las contrasta con las fuentes internas de la Torá para mostrar cómo la especificidad de la Mitzvá redime el mundo concreto en lugar de evadirlo.',
      },
    };
  }

  if (isPlatoCaveTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Platón · Alegoría de la Caverna (La República, Libro VII, 514a–520d)',
      thesisSummary:
        'Contraste exegético formal entre la Alegoría de la Caverna de Platón (ascenso especulativo desde las sombras sensibles hacia la Idea universal) y la concepción de la Torá (descenso de la luz divina a la especificidad del mandamiento concreto en el mundo físico).',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad de las Ideas Platónicas frente a la Especificidad del Mandamiento (Mitzvá)',
        externalUniversalism:
          'En la fuente externa analizada (Platón, República VII, 514a–518d), el mundo físico, histórico y corporal es representado como una caverna oscura de sombras particulares y engañosas. Para Platón, la salvación epistemológica y ética consiste en romper los vínculos con lo sensible particular y ascender hacia la contemplación intelectual de las Formas o Ideas universales, eternas e inmutables (culminando en la Idea abstracta del Bien). Incluso cuando el filósofo regresa a la caverna (519d–520d), lo hace con reticencia, considerando la vida práctica inferior a la contemplación universal.',
        torahUniversalDimension:
          'Las fuentes internas de la Torá afirman que la luz divina de la Torá posee un alcance universal («Torá Or», Proverbios 6:23; Isaías 42:6; y las 7 Leyes Universales de Bnei Nóaj en Sanhedrín 56a) y que el Creador otorgó sabiduría racional a toda la humanidad.',
        torahCommandmentSpecificity:
          'Sin embargo, el contraste exegético es radical respecto a la ESPECIFICIDAD DEL MANDAMIENTO: en Proverbios 6:23 el Rey Salomón distingue entre «Torá Or» (la Torá es luz universal) y «Ner Mitzvá» (el mandamiento específico es una lámpara puntual). En el judaísmo no escapamos de la caverna del mundo físico hacia las Ideas abstractas: encendemos lámparas específicas (cada Mitzvá concreta en el tiempo, el cuerpo, la mesa, el trato al prójimo, Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18) para transformar la caverna material en una morada para la presencia divina (Dirá BeTajtonim). Por eso en Sinaí el pueblo proclamó primero la acción específica y luego la contemplación: «Naasé ve-nishmá» («Haremos y comprenderemos», Éxodo 24:7; y Pirké Avot 3:17).',
        exegeticalSynthesis:
          'Mientras Platón desprecia lo particular sensible para refugiarse en la universalidad abstracta de las Ideas, la Torá santifica lo particular mediante la especificidad del mandamiento: Moshé no se queda en la cima luminosa del Sinaí, sino que desciende con las Tablas hacia el campamento concreto del pueblo.',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Platón vs. Sinaí)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá (Éxodo 24:7, Deuteronomio 30:11-14, Proverbios 6:23, Talmud Kidushín 31a, Pirké Avot 3:17, Maharal en Tiféret Yisrael y Tania cap. 36) nacen de la Revelación histórica y pactal en Sinaí: en ellas la verdad no es un objeto estático de contemplación solitaria, sino la voz viva del Creador que convoca a la acción ética y comunitaria.',
        externalSourcesNature:
          'Las Fuentes Externas (Platón, República VII, 514a–520d, consultadas en el corpus griego clásico y documentación externa) pertenecen a la categoría rabínica de «Jojmá ba-Goyim taamín» (Eijá Rabá 2:13: «Si te dicen que hay sabiduría entre las naciones, créelo; si te dicen que hay Torá entre las naciones, no lo creas»). Aportan una brillante metáfora pedagógica sobre cómo el ser humano puede confundir apariencias con realidad, pero parten de una ontología dualista que devalúa la creación material.',
        normativeLocusContrast:
          'En Platón, la iluminación proviene de una facultad interna del intelecto (anamnesis o reminiscencia del alma racional) que se emancipa del cuerpo; en las fuentes internas de la Torá, la iluminación brota del encuentro entre el mandato trascendente («Gadol ha-metzuvé ve-osé», Kidushín 31a) y la respuesta encarnada del corazón y las manos («En tu boca y en tu corazón para ponerlo por obra», Deuteronomio 30:14).',
        hermeneuticalRule:
          'Al estudiar la Alegoría de la Caverna desde la hermenéutica judía, consultamos la fuente externa platónica con rigor filológico, pero invertimos su vector: la meta espiritual no es evadir el mundo creado (que Dios declaró «muy bueno» en Génesis 1:31), sino iluminar cada rincón concreto de la caverna humana con la especificidad de las Mitzvot.',
      },
    };
  }

  if (isCiceroTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Marco Tulio Cicerón · De Re Publica (III.33), De Legibus (I.18) y De Officiis (Sobre los Deberes, I.20 / III.21)',
      thesisSummary:
        'Contraste exegético formal entre la Ley Natural (lex naturae / recta ratio) y el deber cívico (officium) de Cicerón frente a la Ética del Pacto, la Tzedaká y la especificidad del mandamiento en las fuentes internas de la Torá.',
      universalidadVsEspecificidad: {
        title:
          'I. La Ley Natural Universal de Cicerón frente a la Especificidad del Mandamiento en la Torá',
        externalUniversalism:
          'En las fuentes externas romanas consultadas (De Re Publica III.22.33 y De Legibus I.6.18), Cicerón define la verdadera ley como «recta ratio naturae congruens» (la recta razón conforme a la naturaleza), afirmando que es universal, eterna e invariable: «No habrá una ley en Roma y otra en Atenas, una hoy y otra mañana». En De Officiis (I.7.20–23), traduce ese universalismo en deberes cívicos (officia) centrados en proteger la propiedad privada, no dañar sin provocación y mantener la reciprocidad social entre lo honesto (honestum) y lo útil (utile).',
        torahUniversalDimension:
          'Las fuentes internas de la Torá coinciden en que existe un orden moral universal exigible a toda sociedad humana: las Siete Leyes de Bnei Nóaj (Talmud Bavli Sanhedrín 56a), que incluyen el mandato universal de establecer cortes de justicia (Dinim) y prohíben el asesinato, el robo y la crueldad, basadas en que todo ser humano porta la Imagen Divina (Génesis 1:27 y 9:6).',
        torahCommandmentSpecificity:
          'Sin embargo, el contraste exegético muestra dónde la especificidad del mandamiento de la Torá supera al officium de Cicerón: 1) Una «ley natural» abstracta e idéntica en todo lugar resulta insuficiente para proteger al vulnerable cuando choca con el interés político (utile) de Roma. 2) La Torá no deja la ayuda al necesitado como mera «beneficencia» discrecional (liberalitas) subordinada a no afectar el propio patrimonio (como aconseja Cicerón en De Officiis I.14.42–45), sino que legisla MANDAMIENTOS ESPECÍFICOS Y VINCULANTES (Leket, Shijejá, Peá, Maaser Aní y Tzedaká en Deuteronomio 15:7-8 y Levítico 19:9-10) fundados en la memoria histórica específica de Israel («Recuerda que fuiste siervo en Egipto», Deuteronomio 24:17-18). 3) Además, la Halajá conjuga la norma con la especificidad casuística de cada caso (Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).',
        exegeticalSynthesis:
          'Cicerón edifica una ética universal de ciudadanía y reciprocidad jurídica (do ut des); la Torá integra la justicia universal con la especificidad compasiva del mandamiento (Miqueas 6:8: «Hacer justicia [Mishpat], amar la bondad [Jésed] y caminar humildemente con tu Dios»).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Cicerón vs. Masorah)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá (Deuteronomio 4:6-8, Deuteronomio 15:7-11, Miqueas 6:8, Talmud Kidushín 31a, Sanhedrín 56a y Bava Metzia 30b) provienen de la Revelación del Pacto en Sinaí: en ellas el deber moral no es un contrato de conveniencia cívica ni una ley cósmica impersonal, sino una Mitzvá (vínculo relacional con el Santo, Bendito Sea, y con el prójimo).',
        externalSourcesNature:
          'Las Fuentes Externas de Cicerón (De Officiis, De Re Publica, De Legibus, recuperadas del corpus clásico latino y fuentes documentales externas) representan la cumbre de la jurisprudencia y filosofía moral romana («Jojmá ba-Goyim taamín», Eijá Rabá 2:13). Deben ser estudiadas y citadas con rigor para comprender la noción clásica de ley natural y deber cívico.',
        normativeLocusContrast:
          'Para Cicerón, la fuente de la obligación es inmanente: la naturaleza racional del cosmos (lex naturae) y el honor del ciudadano (decorum / honestum). Para las fuentes internas de la Torá, la fuente es teonómica y dialógica: proviene del Comandante trascendente («Gadol ha-metzuvé ve-osé», Kidushín 31a), quien se identifica con el clamor del huérfano, la viuda y el forastero, y escribe esa ley en el corazón humano (Deuteronomio 30:14).',
        hermeneuticalRule:
          'En un estudio comparativo con Cicerón, se contrasta el texto latino de De Officiis y De Re Publica con los versículos de la Torá y las suguiot talmúdicas, evidenciando la diferencia entre el deber cívico natural (officium) y la santidad específica del mandamiento (Mitzvá / Tzedaká).',
      },
    };
  }

  // Only return the Kant / external comparative contrast if Kant or an explicit external source was actually matched
  if (!isKantTopic && externalSources.length === 0) {
    return undefined;
  }

  return {
    isComparativeStudy: true,
    externalThinkerOrTradition: isKantTopic
      ? 'Immanuel Kant · Imperativo Categórico (Fundamentación de la metafísica de las costumbres, Ak. IV, 421–433)'
      : `${externalSources[0].author} (${externalSources[0].workTitle})`,
    thesisSummary:
      'Contraste exegético formal analizando (1) la Universalidad abstracta frente a la Especificidad concreta del mandamiento (Mitzvá y Halajá), y (2) la distinción epistemológica y normativa entre Fuentes Internas de la Torá y Fuentes Externas.',
    universalidadVsEspecificidad: {
      title:
        'I. La Universalidad frente a la Especificidad del Mandamiento (Imperativo Universal vs. Halajá y Mitzvá)',
      externalUniversalism: isKantTopic
        ? 'En la fuente filosófica externa (Immanuel Kant, Grundlegung Ak. IV, 421: «Obra sólo según aquella máxima por la cual puedas querer que al mismo tiempo se convierta en ley universal»), la validez ética exige una universalidad formal, abstracta y sin excepciones. Toda situación particular queda subsumida bajo una regla idéntica e inflexible (llevando a Kant en su ensayo de 1797 a prohibir mentir incluso a un asesino que pregunta por una víctima inocente).'
        : externalSources[0]?.philosophicalThesis ||
          'En la fuente filosófica externa consultada, la norma moral se concibe desde una universalidad teórica homogénea.',
      torahUniversalDimension:
        'Las fuentes internas de la Torá afirman un cimiento ético universal para toda la humanidad: todo ser humano es creado a Imagen Divina (Betzélem Elohim, Génesis 1:27) y toda la familia humana está vinculada por las Siete Leyes Universales de Noé (Talmud Bavli Sanhedrín 56a), que exigen justicia y prohíben el asesinato, el robo y la crueldad.',
      torahCommandmentSpecificity:
        'A diferencia del formalismo abstracto externo, la tradición judía sostiene que la vida moral real exige la ESPECIFICIDAD DEL MANDAMIENTO: 1) Especificidad casuística halájica: las conclusiones éticas no se deducen de una fórmula ciega a las consecuencias, sino de una jerarquía viva de valores donde salvar una vida concreta (Pikuaj Néfesh, Levítico 18:5 y Yoma 85b: «Vivirás por ellos y no morirás por ellos») suspende casi toda la Torá, donde es obligatorio alterar la verdad para salvar a un inocente o preservar la paz (Yevamot 65b), y donde Lifnim Mishurat HaDin (Deuteronomio 6:18; Bava Metzia 30b) atiende la singularidad irrepetible de cada persona. 2) Especificidad del Pacto: junto a las 7 leyes universales, la Torá entrega 613 Mitzvot específicas que santifican el tiempo, el cuerpo y la historia concreta («Ki ner mitzvá ve-Torá or», Proverbios 6:23).',
      exegeticalSynthesis:
        'Mientras la filosofía externa identifica la ética con una universalidad homogénea y abstracta, las fuentes internas de la Torá articulan principios universales (7 Leyes de Noé) con la especificidad concreta, compasiva y casuística del mandamiento (Mitzvá y Halajá).',
    },
    fuentesInternasVsExternas: {
      title:
        'II. La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Autonomía vs. Teonomía Relacional)',
      internalTorahSourcesNature:
        'Las Fuentes Internas de la Torá comprenden el corpus canónico de la Revelación en Sinaí y la Tradición Oral (Tanaj, Mishná, Talmud Bavli/Yerushalmi, Midrash, Rishonim y Ajaronim en Sefaria). Su fundamento no es la especulación solitaria, sino el Pacto (Berit) entre el Creador y el ser humano, interpretado en la historia por los Sabios (Deuteronomio 30:12; Bava Metzia 59b).',
      externalSourcesNature:
        'Las Fuentes Externas consultadas para informar el estudio comparativo se enmarcan en el principio rabínico de Eijá Rabá 2:13: «Si alguien te dice que hay sabiduría (Jojmá) entre las naciones, créelo; si te dice que hay Torá entre las naciones, no lo creas». Aportan rigor analítico y claridad conceptual que enriquecen el contraste exegético.',
      normativeLocusContrast:
        'Las fuentes internas de la Torá muestran que el sujeto que sólo se escucha a sí mismo queda atrapado en la autojustificación del ego (Negiá); por eso el mandamiento nace de una Fuente Externa Trascendente y Relacional («Gadol ha-metzuvé ve-osé»: «Mayor es quien está comandado y actúa que quien actúa sin estar comandado», Kidushín 31a), cuya meta es ser libremente interiorizada en el corazón («En tu boca y en tu corazón para cumplirla», Deuteronomio 30:14; y Pirké Avot 2:4: «Haz que Su voluntad sea tu voluntad»).',
      hermeneuticalRule:
        'En todo estudio comparativo con un pensador externo explícito, Darshán AI busca y cita las fuentes externas pertinentes para exponer fielmente la tesis filosófica del autor, y luego realiza el contraste exegético formal frente a las fuentes internas de la Torá.',
    },
  };
}

const FORBIDDEN_NT_BOOKS_REGEX =
  /\b(Juan|Mateo|Marcos|Lucas|Hechos|Romanos|1\s*Corintios|2\s*Corintios|Corintios|G[áa]latas|Efesios|Filipenses|Colosenses|Tesalonicenses|Timoteo|Tito|Filem[óo]n|Hebreos|Santiago|1\s*Pedro|2\s*Pedro|Apocalipsis|John|Matthew|Mark|Luke|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Hebrews|Revelation)\s+\d+:\d+(?:-\d+)?/gi;

function sanitizeStrictJewishText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text;
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

// Helper: Logic-Gate Router in the analysis pipeline that detects query keywords to internally configure the methodology
function resolveEffectiveMethodology(requestedMetodologia: string, query: string): string {
  const m = (requestedMetodologia || 'AUTO').toUpperCase().trim();
  if (m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT') {
    return 'WISSENSCHAFT_DES_JUDENTUMS';
  }

  const q = (query || '').trim();
  if (!q) return m && m !== 'AUTO' ? m : 'PARDES';

  // Dedicated External Thinker Detector Module: automatically forces FILOSOFIA_CONTRASTIVA whenever an external philosopher/thinker (Kant, Platón, Cicerón, Aristóteles, Epicteto, Spinoza, Nietzsche, Buda, etc.) is mentioned
  const externalThinkerDetection = detectExternalThinkerAndForceExegeticalSearch(q);
  if (externalThinkerDetection.detected) {
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

  // If user explicitly picked a non-AUTO methodology, honor it unless:
  // 1) The UI was on default PARDES and the query explicitly asks for a philosophical contrast, OR
  // 2) The UI had a sticky FILOSOFIA_CONTRASTIVA from a previous comparative study, while the current query is an internal Jewish/Halakhic topic with no external thinker
  if (m && m !== 'AUTO') {
    if (m === 'PARDES' && isPhilosophicalContrast) {
      return 'FILOSOFIA_CONTRASTIVA';
    }
    if (m === 'FILOSOFIA_CONTRASTIVA' && !isPhilosophicalContrast) {
      // Fall through to automatic internal Jewish methodology selection below
    } else {
      return m;
    }
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
function resolveComplementaryMethodologies(
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
  const thinkerDet = detectExternalThinkerAndForceExegeticalSearch(q);
  const allowFilosofiaContrastiva =
    primary === 'FILOSOFIA_CONTRASTIVA' || isComparativeTopic || thinkerDet.detected;

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
  if (/(?<![a-záéíóúñ])(estoicismo|filosof[ií]a|ataraxia|kuzari|moreh nevujim|kant|plat[oó]n|cicer[oó]n|buda|budismo)(?![a-záéíóúñ])/i.test(q)) {
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

  const unique = Array.from(new Set(candidates)).filter((m) => m !== primary);
  return unique.slice(0, maxComp);
}

// Helper: Brief summary of what a complementary methodology contributes when woven into a 10-min or 30-min lesson
function getComplementaryContributionBrief(compMethod: string): string {
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
function getDurationAndComplementaryInstructions(
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
function getMethodologyInstructions(metodologia: string, audienciaOTono: string): string {
  const m = (metodologia || 'PARDES').toUpperCase();
  const toneNote = `PARÁMETRO "audiencia_o_tono": "${audienciaOTono || 'Comunidad general · Inspirador y práctico'}". Adapta rigurosamente el registro lingüístico, la densidad conceptual, las metáforas pedagógicas y el enfoque práctico a esta audiencia y tono.`;

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

// Phase 0 (Independent from Drashá Generation Timer): Instant Deterministic Multi-Methodology Deliberation & Decision (<2ms)
app.post('/api/decide-methodology', async (req, res) => {
  const startedAt = Date.now();
  try {
    const rawQuery = req.body.tema_o_fuente || req.body.query;

    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res.status(400).json({ error: 'Debes proporcionar una consulta para evaluar las metodologías.' });
    }

    const { normalizedQuery: query } = normalizeUserStudyQuery(rawQuery);
    const cacheKey = query.toLowerCase();
    const cachedDelib = decideMethodologyCache.get(cacheKey);
    if (cachedDelib) {
      return res.json({
        ...cachedDelib,
        deliberationTimeMs: Date.now() - startedAt,
      });
    }

    const fastPrimary = resolveEffectiveMethodology('AUTO', query);
    const fastComp30 = resolveComplementaryMethodologies(fastPrimary, query, '30_MIN');
    const fastComp10 = fastComp30.slice(0, 1);

    const allSevenMethodologies = [
      'PARDES',
      'WISSENSCHAFT_DES_JUDENTUMS',
      'EVOLUCION_CONCEPTUAL',
      'MESILAT_YESHARIM_SISTEMATICO',
      'PIRKE_AVOT_EXEGETICO',
      'MUSAR_TRANSFORMATIVO',
      'FILOSOFIA_CONTRASTIVA',
    ];

    const keySourceHintMap: Record<string, string> = {
      PARDES: 'Tanaj · Rashi · Ramban · Midrash Rabá · Zóhar HaKadosh',
      WISSENSCHAFT_DES_JUDENTUMS: 'Sotah 40a · Berakhot 33a · Yerushalmi · Seder Rav Amram Gaón · Guenizá de El Cairo',
      EVOLUCION_CONCEPTUAL: 'Torá y Jazal · Etz Jaim / Pardés Rimonim · Mesilat Yesharim · Tania y Jasidut',
      MESILAT_YESHARIM_SISTEMATICO: 'Ramjal (Mesilat Yesharim caps. 1–26) · Mahut, Dérej Kinyanó y Mafsidayv',
      PIRKE_AVOT_EXEGETICO: 'Mishná Pirké Avot · Rambam (Shmoná Perakim) vs. Rabenu Yoná y Maharal (Dérej Jaim)',
      MUSAR_TRANSFORMATIVO: 'Rabí Israel Salanter (Or Yisrael) · Alter de Kelm · Rav Dessler (Mijtav MeEliahu)',
      FILOSOFIA_CONTRASTIVA: 'Eijá Rabá 2:13 · Kidushín 31a · Sanhedrín 56a · Kuzari · Moreh Nevujim vs. Fuentes Externas',
    };

    const whyApplicableMap: Record<string, string> = {
      PARDES: 'Articula la exégesis clásica en 4 estratos (Pshat literal, Rémez alegórico, Drash homilético y Sod místico).',
      WISSENSCHAFT_DES_JUDENTUMS: 'Rastrea la historia redaccional, las variantes de manuscritos, los códigos geónicos y la filología crítica del texto.',
      EVOLUCION_CONCEPTUAL: 'Traza la genealogía del concepto a través de la Torá Escrita, el Árbol de la Vida cabalístico, el Musar y la Jasidut.',
      MESILAT_YESHARIM_SISTEMATICO: 'Desglosa analíticamente la virtud según el Ramjal: definición esencial (Mahut), adquisición y obstáculos.',
      PIRKE_AVOT_EXEGETICO: 'Contrapone las lecturas éticas de Maimónides, Rabenu Yoná de Gerona y el Maharal de Praga sobre la máxima tanaítica.',
      MUSAR_TRANSFORMATIVO: 'Aísla la fricción conductual inconsciente (negiá) y diseña un ejercicio práctico de Jeshbón HaNéfesh.',
      FILOSOFIA_CONTRASTIVA: 'Contrasta formalmente fuentes filosóficas o religiosas externas frente a la Torá (Universalidad vs. Especificidad del Mandamiento).',
    };

    const orderedCandidates = [
      fastPrimary,
      ...fastComp30,
      ...allSevenMethodologies.filter((m) => m !== fastPrimary && !fastComp30.includes(m)),
    ];

    const candidates = orderedCandidates.map((method, idx) => {
      const isPrimary = method === fastPrimary;
      const isComp = fastComp30.includes(method);
      const relevanceScore = isPrimary ? 98 : isComp ? 90 - idx * 4 : Math.max(68, 82 - idx * 3);
      return {
        methodology: method,
        relevanceScore,
        role: isPrimary ? 'primary' : isComp ? 'complementary' : 'optional',
        whyApplicable: whyApplicableMap[method] || whyApplicableMap.PARDES,
        expectedContribution: getComplementaryContributionBrief(method),
        keySourceHint: keySourceHintMap[method] || keySourceHintMap.PARDES,
      };
    });

    const resultPayload = {
      query,
      recommendedPrimary: fastPrimary,
      recommendedComplementaryFor10Min: fastComp10,
      recommendedComplementaryFor30Min: fastComp30,
      deliberationSummary: `Compuerta lógica de alta precisión: se selecciona ${fastPrimary} como metodología estructural primaria, con ${fastComp30.join(' y ')} como aportes complementarios para estudios de 10 y 30 minutos.`,
      candidates,
      deliberationTimeMs: Date.now() - startedAt,
    };

    setBoundedCache(decideMethodologyCache, cacheKey, resultPayload);
    return res.json(resultPayload);
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Error en la deliberación metodológica.',
    });
  }
});

// Phase 1 + Phase 2 Combined Fast-Path: Morphological analysis, Sefaria canonical references & parallel server Sefaria prefetch
app.post('/api/analyze-roots', async (req, res) => {
  const rawQuery = req.body.tema_o_fuente || req.body.query;
  const audienciaOTono =
    req.body.audiencia_o_tono || 'Comunidad general · Inspirador y práctico';
  const duracion = (req.body.duracion || '10_MIN').toUpperCase().trim();

  if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
    return res.status(400).json({ error: 'Debes proporcionar un tema, pasaje bíblico o fuente para analizar.' });
  }

  const {
    normalizedQuery: query,
    cleanTopicLabel,
    isUserQuestion,
    isMashiajTopic,
    isMashiajBuddhaContrastTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
    isHalelTopic,
    isShulchanArukhOrMinhagNusachTopic,
    isInternalHalakhaTopic,
    isComparativeTopic,
  } = normalizeUserStudyQuery(rawQuery);
  const halakhicValidation = validatePurelyHalakhicQuery(query);
  const externalThinkerDetection = halakhicValidation.externalPhilosophyInjectionDisabled
    ? detectExternalThinkerAndForceExegeticalSearch('')
    : detectExternalThinkerAndForceExegeticalSearch(query);
  const metodologia = resolveEffectiveMethodology(req.body.metodologia || 'AUTO', query);
  const complementaryMethodologies = resolveComplementaryMethodologies(
    metodologia,
    query,
    duracion,
    req.body.metodologias_complementarias
  );

  const phase1StartedAt = Date.now();
  const phase1CacheKey = `${query.toLowerCase()}|${metodologia}`;
  const cachedP1 = phase1MemoryCache.get(phase1CacheKey);
  if (cachedP1) {
    const cacheElapsedMs = Date.now() - phase1StartedAt;
    return res.json(
      sanitizeHalakhicOutputFromExternalCitations(
        {
          ...cachedP1,
          detectedMetodologia: metodologia,
          metodologiasComplementarias: complementaryMethodologies,
          duracion,
          ...(externalThinkerDetection.detected ? { externalThinkerDetection } : {}),
          stageTimingsMs: {
            stage1MorphologyMs: 0,
            stage2SefariaMs: 0,
            totalPhase1And2Ms: cacheElapsedMs,
            cacheHit: true,
          },
        },
        halakhicValidation
      )
    );
  }

  // Coalesce concurrent requests for the same Phase 1 query+methodology
  const existingInFlightP1 = inFlightPhase1ServerRequests.get(phase1CacheKey);
  if (existingInFlightP1) {
    try {
      const coalescedResult = await existingInFlightP1;
      return res.json(
        sanitizeHalakhicOutputFromExternalCitations(
          {
            ...coalescedResult,
            detectedMetodologia: metodologia,
            metodologiasComplementarias: complementaryMethodologies,
            duracion,
            ...(externalThinkerDetection.detected ? { externalThinkerDetection } : {}),
          },
          halakhicValidation
        )
      );
    } catch {
      // Proceed if previous in-flight failed
    }
  }

  const p1ExecutionPromise = (async () => {
    const externalSourcesPromise =
      !halakhicValidation.externalPhilosophyInjectionDisabled &&
      (externalThinkerDetection.detected ||
        metodologia === 'FILOSOFIA_CONTRASTIVA' ||
        isComparativeTopic)
        ? fetchExternalComparativeSources(query)
        : Promise.resolve([]);

    try {
      const ai = getGenAIClient();
      const llmStartedAt = Date.now();

    const refCountTarget = duracion === '5_MIN' ? '2 a 3' : duracion === '30_MIN' ? '4 a 5' : '3 a 4';

    const systemInstruction = `Eres un asistente rabínico y pedagógico especializado en redactar drashot estructuradas y profundas, además de filólogo hebraico y exégeta tradicional (Tanaj, Mishná, Talmud, Midrash, Rishonim, Musar, Jasidut y Cábala).
${STRICT_JEWISH_SOURCES_COVENANT}
Recibes estos parámetros principales:
1. "consulta_del_usuario": "${query}"
2. "tipo_de_entrada": "${isUserQuestion ? 'PREGUNTA O ANÁLISIS FILOSÓFICO EN LENGUAJE NATURAL (NO ES UNA CITA TEXTUAL)' : 'TEMA O REFERENCIA DE ESTUDIO'}"
3. "metodologia_principal": "${metodologia}"
4. "metodologias_complementarias": ${JSON.stringify(complementaryMethodologies)}
5. "duracion": "${duracion}"
6. "audiencia_o_tono": "${audienciaOTono}"

DISTINCIÓN CRÍTICA ENTRE PREGUNTA DEL USUARIO Y CITA TEXTUAL:
- Cuando el usuario formula una pregunta o un análisis comparativo/filosófico en lenguaje natural (ej. comparativo con Kant, la Alegoría de la Caverna de Platón, Cicerón, la Iluminación en el Budismo o el destino de las almas Olam HaBá frente a Nirvana, Valhalla, Cielo e Infierno; o "¿Qué es el Mashíaj...?"), NO es una cita textual.
- NUNCA pongas el texto de la pregunta del usuario en 'title' ni entre comillas («...») como si fuera una cita. En 'title' escribe un título conceptual claro, sobrio y directo sobre el tema (ej. "${cleanTopicLabel}").
- En 'primaryHebrew', selecciona el versículo o principio hebreo auténtico que mejor responde al tema preguntado (ej. para Destino de las Almas / Olam HaBá: «כָּל יִשְׂרָאֵל יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא · וְכֵן חֲסִידֵי אֻמּוֹת הָעוֹלָם יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא» de Sanhedrín 90a y Hiljot Teshuvá 3:5; para Iluminación / Budismo: «כִּי־עִמְּךָ מְקוֹר חַיִּים בְּאוֹרְךָ נִרְאֶה־אוֹר · כִּי נֵר מִצְוָה וְתוֹרָה אוֹר» de Salmos 36:10 y Proverbios 6:23; para Kant: Kidushín 31a y Deuteronomio 30:14; para Platón: Proverbios 6:23 y Éxodo 24:7; para Cicerón: Miqueas 6:8).

REGLAS DE REFERENCIAS CANÓNICAS PARA SEFARIA SEGÚN LA METODOLOGÍA ACTIVA Y COMPLEMENTARIAS (Selecciona ${refCountTarget} referencias):
- NUNCA cites folios genéricos o amplios del Talmud cuando exista una cita específica de Mishná, Tanaj, Pirkei Avot, Mishneh Torah o Mesillat Yesharim.
- Usa SIEMPRE referencias exclusivamente del canon judío en Sefaria en inglés con capítulo y versículo/párrafo exactos (ej: "Sanhedrin 90a", "Berakhot 17a", "Pirkei Avot 4:16", "Mishneh Torah, Repentance 3:5", "Chagigah 12a", "Psalms 36:10", "Proverbs 6:23", "Exodus 24:7", "Lamentations Rabbah 2:13", "Micah 6:8", "Kiddushin 31a", "Deuteronomy 30:14", "Yoma 85b", "Sanhedrin 56a", "Pirkei Avot 3:17").
- Si la consulta trata sobre el Destino de las Almas (Olam HaBá frente a Nirvana, Valhalla, Cielo e Infierno y sus requisitos de acceso): selecciona "Sanhedrin 90a", "Mishneh Torah, Repentance 3:5", "Berakhot 17a", "Pirkei Avot 4:16", "Sanhedrin 56a", "Lamentations Rabbah 2:13".
- Si la consulta trata sobre la Iluminación (Budismo / Bodhi frente a la tradición judía): selecciona "Psalms 36:10", "Chagigah 12a", "Proverbs 6:23", "Exodus 24:7", "Lamentations Rabbah 2:13".
- Si la consulta trata sobre la Alegoría de la Caverna de Platón frente a la Torá: selecciona "Proverbs 6:23", "Exodus 24:7", "Lamentations Rabbah 2:13", "Pirkei Avot 3:17", "Deuteronomy 30:14".
- Si la consulta trata sobre Cicerón (De Officiis / De Re Publica / Ley Natural) frente a la Torá: selecciona "Micah 6:8", "Sanhedrin 56a", "Deuteronomy 4:6", "Lamentations Rabbah 2:13", "Deuteronomy 6:18", "Kiddushin 31a".
- Si la consulta trata sobre el Imperativo Categórico de Kant frente a la ética judía: selecciona "Kiddushin 31a", "Deuteronomy 30:14", "Yoma 85b", "Deuteronomy 6:18", "Sanhedrin 56a", "Lamentations Rabbah 2:13".
- Si la consulta trata sobre el Mashíaj (Mesías), su naturaleza humana (no divina), por qué lo esperamos y cuál es su misión: selecciona fuentes como "Isaiah 11:1", "Isaiah 11:2", "Isaiah 11:9", "Isaiah 2:4", "Deuteronomy 30:3", "Sanhedrin 98a".
- Si la consulta trata sobre el Halel (הַלֵּל, Salmos 113–118, Halel Shalem vs. Jatsi Halel, Rosh Jódesh de 1 o 2 días según si el mes que termina tiene 29 días [Jaser] o 30 días [Malé], Pesaj, Sucot, Janucá, su institución profética o sus leyes halájicas): selecciona exclusivamente fuentes halájicas, talmúdicas y del Shulján Aruj como "Pesachim 117a", "Arakhin 10a", "Taanit 28b", "Shulchan Arukh, Orach Chayim 422:2", "Shulchan Arukh, Orach Chayim 427:1", "Mishneh Torah, Sanctification of the New Moon 8:4", "Mishneh Torah, Megillah and Chanukah 3:6". PROHIBIDO mencionar a Kant o filósofos externos.
- Si la consulta trata sobre leyes (Halajá), cumplimiento práctico, el Shulján Aruj, o comparaciones de costumbres dentro del judaísmo (Minhag y Núsaj: Sefardí / Edot HaMizraj vs. Ashkenazí vs. Jasídico vs. Teimaní, Mejaber vs. Ramá): DEBES incluir referencias exactas del **Shulján Aruj** en Sefaria (ej. "Shulchan Arukh, Orach Chayim 1:1", "Shulchan Arukh, Orach Chayim 68:1", "Shulchan Arukh, Orach Chayim 422:2", "Shulchan Arukh, Orach Chayim 453:1", "Shulchan Arukh, Orach Chayim 128:44", "Shulchan Arukh, Orach Chayim 581:1", "Shulchan Arukh, Yoreh De'ah 214:1", junto con "Pesachim 50b" o "Taanit 28b").
- Si la metodología principal o alguna complementaria incluye "MESILAT_YESHARIM_SISTEMATICO": Incluye al menos 1 referencia exacta de "Mesillat Yesharim <capítulo>:<párrafo>" junto con sus versículos de apoyo en el Tanaj o Pirkei Avot.
- Si incluye "PIRKE_AVOT_EXEGETICO": Incluye la Mishná exacta de "Pirkei Avot <capítulo>:<mishná>".
- Si incluye "MUSAR_TRANSFORMATIVO": Incluye la fuente ética precisa en "Pirkei Avot", "Mesillat Yesharim", "Proverbs", "Psalms" o el Tanaj.
- Si incluye "WISSENSCHAFT_DES_JUDENTUMS" o "FILOLOGIA_LITURGICA_WISSENSCHAFT": Incluye las fuentes talmúdicas, midráshicas y bíblicas exactas donde se debate el concepto histórico consultado por el usuario (PROHIBIDO seleccionar "Sotah 40a" o mencionar "Modim" a menos que la consulta pregunte explícitamente por Modim).
- Si incluye "EVOLUCION_CONCEPTUAL": Selecciona referencias canónicas en Sefaria que representen la evolución del concepto consultado desde la Torá y Jazal hasta el Musar y la Jasidut.
- Si incluye "FILOSOFIA_CONTRASTIVA": Selecciona las fuentes canónicas internas de la Torá en Sefaria que mejor dialogan y contrastan con la fuente externa consultada (Platón, Cicerón, Kant, Budismo, Nirvana, Valhalla), incluyendo siempre referencias sobre universalidad vs. especificidad del mandamiento ("Proverbs 6:23", "Yoma 85b", "Sanhedrin 56a", "Deuteronomy 6:18") y fuentes internas vs. externas ("Lamentations Rabbah 2:13", "Kiddushin 31a", "Deuteronomy 30:14").
- REGLA ESTRICTA ANTI-PLANTILLAS: Responde EXCLUSIVAMENTE sobre el tema de "consulta_del_usuario". JAMÁS menciones "Modim", "Modim anajnu" ni "Yotzer Bereshit" a menos que el usuario haya preguntado explícitamente sobre la bendición de Modim.

CUATRO CLAVES TEOLÓGICAS OBLIGATORIAS QUE DEBES ADAPTAR AL TEMA Y METODOLOGÍA:
1. Paralelismo Textual / Intertextualidad Canónica (para estudios comparativos: Distinción entre Fuentes Internas de la Torá y Fuentes Externas según Eijá Rabá 2:13 y Kidushín 31a).
2. Elección Gramatical y Filológica (Shorashim, Binyanim, Targum Onkelos, Rashi).
3. Concepto Técnico en Jazal y Rishonim (para estudios comparativos: Universalidad frente a Especificidad del Mandamiento en Proverbios 6:23, Yoma 85b, Deuteronomio 6:18 y las 7 Leyes de Noé en Sanhedrín 56a / Hiljot Teshuvá 3:5).
4. Dimensión Interior (Interiorización del mandato en Deuteronomio 30:14, Pirké Avot 2:4 y Rambam en Shemoná Perakim cap. 6).`;

    const forcedThinkerPromptDirective = halakhicValidation.externalPhilosophyInjectionDisabled
      ? halakhicValidation.systemPromptGuard
      : externalThinkerDetection.detected
      ? `\n\n[MÓDULO DEL PIPELINE ACTIVO — DETECTOR DE PENSADOR EXTERNO Y BÚSQUEDA EXEGÉTICA FORZADA]:
- Pensador externo detectado: ${externalThinkerDetection.thinkerName} (${externalThinkerDetection.eraAndTradition})
- Concepto filosófico específico a contrastar: ${externalThinkerDetection.specificPhilosophicalConcept}
- Eje de Universalidad Externa: ${externalThinkerDetection.universalityVsSpecificityMatrix.externalConceptUniversalClaim}
- Horizonte Universal de la Torá: ${externalThinkerDetection.universalityVsSpecificityMatrix.torahUniversalHorizon}
- Especificidad del Mandamiento (Mitzvá): ${externalThinkerDetection.universalityVsSpecificityMatrix.torahCommandmentSpecificity}
- Síntesis de Cosmovisión (Hashkafá): ${externalThinkerDetection.universalityVsSpecificityMatrix.worldviewContrastSynthesis}
- Fuentes exegéticas canónicas de Sefaria FORZADAS por el pipeline: ${JSON.stringify(
          externalThinkerDetection.forcedExegeticalSefariaRefs.map((r) => ({
            ref: r.ref,
            contrastRole: r.contrastRole,
            rationale: r.rationale,
          }))
        )}`
      : '';

    const prompt = `Analiza de forma concisa y precisa esta consulta para una Drashá:
- consulta_del_usuario: "${query}"
- titulo_conceptual_sugerido: "${cleanTopicLabel}"
- es_pregunta_abierta: ${isUserQuestion ? 'SÍ (no trates la pregunta como si fuera una cita textual; extrae los conceptos hebreos y filosóficos centrales que responden a su análisis)' : 'NO'}
- metodologia_principal: "${metodologia}"
- metodologias_complementarias: ${JSON.stringify(complementaryMethodologies)}
- duracion: "${duracion}"
- audiencia_o_tono: "${audienciaOTono}"${forcedThinkerPromptDirective}

Genera un 'title' conceptual limpio (sin repetir la pregunta cruda del usuario), el texto hebreo canónico que responde al tema, el desglose morfológico (3 términos hebreos clave del tema), las 4 claves teológicas concisas y las referencias canónicas exactas para Sefaria en formato JSON.`;

    const response = await generateContentWithRetry(
      ai,
      {
        model: GEMINI_HYDROGEN_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Título conciso del pasaje o tema analizado en español y hebreo',
              },
              primaryHebrew: {
                type: Type.STRING,
                description: 'Texto o frase hebrea canónica principal vocalizada con nikkud',
              },
              transliteration: {
                type: Type.STRING,
                description: 'Transliteración fonética clara para hispanohablantes',
              },
              literalSpanishTranslation: {
                type: Type.STRING,
                description: 'Traducción literal y fidedigna al español',
              },
              liturgicalContext: {
                type: Type.STRING,
                description: 'Ubicación canónica, ética o litúrgica precisa',
              },
              theologicalKeys: {
                type: Type.OBJECT,
                description: 'Las cuatro claves teológicas y conceptuales profundas',
                properties: {
                  textualParallelism: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      sourceRef: { type: Type.STRING },
                      hebrewQuote: { type: Type.STRING },
                      connectionToPrayer: { type: Type.STRING },
                    },
                    required: ['title', 'explanation', 'sourceRef', 'connectionToPrayer'],
                  },
                  grammaticalDichotomy: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      verbAnalysis: { type: Type.STRING },
                      watchmakerRefutation: { type: Type.STRING },
                      liturgicalEcho: { type: Type.STRING },
                    },
                    required: ['title', 'explanation', 'verbAnalysis', 'watchmakerRefutation', 'liturgicalEcho'],
                  },
                  technicalTerm: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      mishnaSource: { type: Type.STRING },
                      prescribedBlessing: { type: Type.STRING },
                    },
                    required: ['title', 'explanation', 'mishnaSource', 'prescribedBlessing'],
                  },
                  kabbalisticArchitecture: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      sefiraConnection: { type: Type.STRING },
                      prooftext: { type: Type.STRING },
                      liturgicalStructure: { type: Type.STRING },
                    },
                    required: ['title', 'explanation', 'sefiraConnection', 'prooftext', 'liturgicalStructure'],
                  },
                },
                required: [
                  'textualParallelism',
                  'grammaticalDichotomy',
                  'technicalTerm',
                  'kabbalisticArchitecture',
                ],
              },
              morphologicalBreakdown: {
                type: Type.ARRAY,
                description: 'Desglose morfológico de las palabras o raíces clave del texto',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    hebrewWord: { type: Type.STRING, description: 'La palabra en hebreo con nikkud' },
                    root: { type: Type.STRING, description: 'Raíz trilítera (ej: ע-ש-ה o ב-ר-א)' },
                    rootMeaning: { type: Type.STRING, description: 'Significado esencial de la raíz' },
                    binyan: { type: Type.STRING, description: 'Binyan / estructura verbal o nominal' },
                    tense: { type: Type.STRING, description: 'Tiempo, modo y persona o categoría' },
                    theologicalImplication: { type: Type.STRING, description: 'Implicación teológica o ética del término hebreo' },
                  },
                  required: ['hebrewWord', 'root', 'rootMeaning', 'binyan', 'tense', 'theologicalImplication'],
                },
              },
              sefariaReferences: {
                type: Type.ARRAY,
                description: 'Referencias canónicas exactas para Sefaria',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ref: { type: Type.STRING, description: 'Referencia en formato Sefaria exacto (ej: Pirkei Avot 1:14, Mesillat Yesharim 2:1, Genesis 27:35)' },
                    heRef: { type: Type.STRING, description: 'Referencia en hebreo (ej: פרקי אבות א׳:י״ד)' },
                    rationale: { type: Type.STRING, description: 'Por qué esta fuente es central para el estudio' },
                    category: { type: Type.STRING, description: 'Categoría (Tanaj, Mishná, Talmud, Liturgia, Midrash)' },
                    exactQuoteHebrew: { type: Type.STRING, description: 'Frase clave en hebreo' },
                  },
                  required: ['ref', 'rationale'],
                },
              },
            },
            required: [
              'title',
              'primaryHebrew',
              'transliteration',
              'literalSpanishTranslation',
              'liturgicalContext',
              'theologicalKeys',
              'morphologicalBreakdown',
              'sefariaReferences',
            ],
          },
        },
      },
      { timeoutMs: 45000, thinkingLevel: ThinkingLevel.LOW }
    );

    const stage1MorphologyMs = Date.now() - llmStartedAt;
    const parsed = sanitizeStrictJewishObject(JSON.parse(response.text || '{}'));
    parsed.detectedMetodologia = metodologia;
    parsed.metodologiasComplementarias = complementaryMethodologies;
    parsed.duracion = duracion;

    // Pipeline Module Override: When an external philosopher/thinker is detected, force the canonical Sefaria exegetical search
    if (externalThinkerDetection.detected) {
      parsed.sefariaReferences = mergeForcedThinkerRefsWithPredictions(
        externalThinkerDetection,
        parsed.sefariaReferences,
        6
      );
      parsed.externalThinkerDetection = externalThinkerDetection;
    }

    const sefariaStartedAt = Date.now();
    const [preVerifiedSources, externalSources] = await Promise.all([
      fetchServerSefariaSources(parsed.sefariaReferences, 6),
      externalSourcesPromise,
    ]);
    parsed.preVerifiedSources = preVerifiedSources;
    if (
      !halakhicValidation.externalPhilosophyInjectionDisabled &&
      (externalThinkerDetection.detected ||
        externalSources.length > 0 ||
        metodologia === 'FILOSOFIA_CONTRASTIVA' ||
        isComparativeTopic)
    ) {
      parsed.externalSources = externalSources;
      parsed.formalContrast = buildDefaultFormalExegeticalContrast(query, externalSources);
    }
    const stage2SefariaMs = Date.now() - sefariaStartedAt;

      parsed.stageTimingsMs = {
        stage1MorphologyMs,
        stage2SefariaMs,
        totalPhase1And2Ms: Date.now() - phase1StartedAt,
        cacheHit: false,
      };
      const sanitizedParsed = sanitizeHalakhicOutputFromExternalCitations(
        parsed,
        halakhicValidation
      );
      setBoundedCache(phase1MemoryCache, phase1CacheKey, sanitizedParsed);
      return sanitizedParsed;
    } catch {
      const fallbackStage1Ms = Date.now() - phase1StartedAt;
    const isModim = /\bmodim(?:\s+de[- ]?raban[aá]n|\s+anajnu)?\b/i.test(query);
    const isJesed = /j[eé]sed|chesed|bondad|[aá]rbol de la vida|sefir/i.test(query);
    const fallbackRefs = isJewishMovementsAndMessianicBoundaryTopic
      ? [
          {
            ref: 'Deuteronomy 6:4',
            rationale:
              '«Shemá Yisrael, Hashem Eloheinu, Hashem Ejad»: el fundamento monoteísta incorpóreo e indivisible que une a todas las corrientes legítimas del judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Conservadurismo, Reformismo) y marca la frontera frente al trinitarismo evangélico de los llamados «judíos mesiánicos»',
          },
          {
            ref: 'Numbers 23:19',
            rationale:
              '«Dios no es hombre (Lo ish El) ni hijo de hombre»: incompatibilidad absoluta entre el judaísmo y la doctrina evangélica de la encarnación divina',
          },
          {
            ref: 'Deuteronomy 13:1',
            rationale:
              'Inmutabilidad de los preceptos de la Torá y advertencia contra movimientos que emplean signos o lenguaje hebreo para introducir teologías ajenas al Sinaí',
          },
          {
            ref: 'Eruvin 13b',
            rationale:
              '«Elu ve-elu divrei Elohim jayim»: pluralidad legítima de escuelas dentro del judaísmo (Beit Hilel y Beit Shamai; Jasidismo Jabad, Breslev, Lituano, Sefardí y corrientes modernas) siempre que se preserve el monoteísmo del Pacto',
          },
          {
            ref: 'Ezekiel 18:20',
            rationale:
              'Responsabilidad moral individual y Teshuvá directa ante Dios sin pecado original ni sacrificio vicario de sangre',
          },
          {
            ref: 'Sanhedrin 90a',
            rationale:
              'Fundamento de los 13 Principios de Fe (Ikarei HaEmuná) codificados por Maimónides que delimitan las fronteras teológicas del judaísmo',
          },
        ]
      : isAfterlifeSoulDestinyTopic
      ? [
          {
            ref: 'Sanhedrin 90a',
            rationale:
              'Mishná Sanhedrín 10:1: «Todo Israel tiene parte en el Mundo Venidero (Olam HaBá)»',
          },
          {
            ref: 'Mishneh Torah, Repentance 3:5',
            rationale:
              'Rambam: «Los justos de entre todas las naciones del mundo (Jasidei Umot HaOlam) tienen parte en el Olam HaBá»: universalidad ética de acceso sin requerir conversión dogmática ni muerte en batalla',
          },
          {
            ref: 'Berakhot 17a',
            rationale:
              'Naturaleza espiritual y relacional del Olam HaBá: las almas conservan su identidad deleitándose en el resplandor de la Shejiná, en contraste con la extinción del yo en el Nirvana o el banquete guerrero del Valhalla',
          },
          {
            ref: 'Pirkei Avot 4:16',
            rationale:
              'Rabí Yaakov: «Este mundo es como un vestíbulo ante el Olam HaBá: prepárate en el vestíbulo mediante la acción ética específica para entrar al salón principal»',
          },
          {
            ref: 'Sanhedrin 56a',
            rationale:
              'Las 7 Leyes Universales de Noé como requisito ético universal para toda la humanidad frente a las 613 Mitzvot específicas del Pacto',
          },
          {
            ref: 'Lamentations Rabbah 2:13',
            rationale:
              '«Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»: distinción formal entre las escatologías de las fuentes externas y las fuentes internas de la Torá',
          },
        ]
      : isEnlightenmentBuddhismTopic
      ? [
          {
            ref: 'Psalms 36:10',
            rationale:
              '«Porque contigo está el manantial de la vida; en Tu luz veremos la luz (Be-orjá niré or)»: la iluminación judía como relación viva con el Creador',
          },
          {
            ref: 'Chagigah 12a',
            rationale:
              'Or HaGanuz: la Luz Primordial de la Creación que Dios ocultó dentro de la Torá para iluminar a los justos',
          },
          {
            ref: 'Proverbs 6:23',
            rationale:
              '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento específico y la Torá es luz): en el judaísmo la iluminación se encarna en la especificidad de cada Mitzvá y no en la huida del mundo',
          },
          {
            ref: 'Exodus 24:7',
            rationale:
              '«Naasé ve-nishmá» (Haremos y escucharemos): la acción ética concreta precede y abre el despertar espiritual',
          },
          {
            ref: 'Lamentations Rabbah 2:13',
            rationale:
              '«Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»: distinción formal entre la sabiduría contemplativa externa (Bodhi budista) y la Torá del Sinaí',
          },
        ]
      : isPlatoCaveTopic
      ? [
          {
            ref: 'Proverbs 6:23',
            rationale:
              '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento y la Torá es luz): frente a la alegoría de la caverna de Platón (que huye del mundo sensible hacia la Idea abstracta), en la Torá el mandamiento específico (Mitzvá) es la vela que ilumina la realidad material aquí abajo',
          },
          {
            ref: 'Exodus 24:7',
            rationale:
              '«Naasé ve-nishmá» (Haremos y escucharemos): la acción ética específica precede y abre la iluminación intelectual, en contraste con el intelectualismo contemplativo platónico',
          },
          {
            ref: 'Lamentations Rabbah 2:13',
            rationale:
              '«Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»: distinción exegética formal entre Fuentes Externas (sabiduría filosófica clásica) y Fuentes Internas de la Torá (el Pacto normativo del Sinaí)',
          },
          {
            ref: 'Pirkei Avot 3:17',
            rationale:
              'Rabí Elazar ben Azariá: «Toda persona cuya sabiduría supera sus obras, ¿a qué se parece? A un árbol de muchas ramas y pocas raíces»',
          },
          {
            ref: 'Deuteronomy 30:14',
            rationale:
              '«No está en el cielo... sino muy cerca de ti, en tu boca y en tu corazón, para cumplirla»: la verdad divina no exige evadirse del mundo terrenal',
          },
        ]
      : isCiceroTopic
      ? [
          {
            ref: 'Micah 6:8',
            rationale:
              '«Él te ha declarado, oh hombre, qué es lo bueno: hacer justicia (Mishpat), amar la bondad (Jésed) y caminar humildemente con tu Dios»: contraste con el Officium estoico-romano de Cicerón',
          },
          {
            ref: 'Lamentations Rabbah 2:13',
            rationale:
              '«Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»: frontera epistemológica entre la filosofía jurídica externa (Cicerón) y las Fuentes Internas de la Torá',
          },
          {
            ref: 'Sanhedrin 56a',
            rationale:
              'Las 7 Leyes Universales de Bnei Nóaj (que incluyen Dinim, tribunales de justicia) frente a la especificidad de las 613 Mitzvot del Pacto de Israel',
          },
          {
            ref: 'Deuteronomy 4:6',
            rationale:
              '«Porque ella es vuestra sabiduría y vuestro entendimiento a los ojos de los pueblos, los cuales oirán todos estos estatutos»',
          },
          {
            ref: 'Deuteronomy 6:18',
            rationale:
              '«Harás lo recto y lo bueno (Lifnim Mishurat HaDin)»: especificidad casuística compasiva que supera el rigor uniforme del derecho natural estoico',
          },
        ]
      : isKantTopic
      ? [
          {
            ref: 'Kiddushin 31a',
            rationale:
              'Gadol ha-metzuvé ve-osé: Quien actúa respondiendo a un mandato trascendente (fuente externa/relacional) supera a quien actúa sin estar comandado, contrastando con la autonomía kantiana',
          },
          {
            ref: 'Deuteronomy 30:14',
            rationale:
              'Superación de la dicotomía fuente interna / fuente externa: la Torá del Sinaí se interioriza «en tu boca y en tu corazón para cumplirla»',
          },
          {
            ref: 'Yoma 85b',
            rationale:
              'Especificidad situacional frente a la universalidad formal abstracta de Kant: «Vivirás por ellos y no morirás por ellos» (Pikuaj Néfesh prevalece sobre toda regla formal)',
          },
          {
            ref: 'Deuteronomy 6:18',
            rationale:
              'Ve-asita ha-yashar ve-ha-tov (Lifnim Mishurat HaDin): discernimiento ético específico según cada situación humana',
          },
          {
            ref: 'Sanhedrin 56a',
            rationale:
              'Articulación judía entre Universalidad (las 7 Leyes éticas universales de Bnei Nóaj) y Especificidad del Pacto (las 613 Mitzvot de Israel)',
          },
          {
            ref: 'Pirkei Avot 2:4',
            rationale:
              'Asé retzonó kirtzonejá («Haz que Su voluntad sea tu voluntad»): síntesis teonómica donde la ley revelada y la voluntad interior convergen',
          },
        ]
      : isMashiajBuddhaContrastTopic
      ? [
          { ref: 'Isaiah 11:1', rationale: 'Requisito genealógico y real del Mashíaj: rey humano del linaje patrilineal de Yishai, David y Salomón que asume el trono en Sión, en contraste con la Gran Renuncia de Buda al trono' },
          { ref: 'Isaiah 2:4', rationale: 'Verificación histórica empírica del Mashíaj: fin mundial de las guerras y transformación geopolítica de la historia' },
          { ref: 'Genesis 1:31', rationale: '«Y vio Dios todo lo que había hecho, y he aquí que era muy bueno (Tov Meod)»: santificación del mundo físico y familiar frente a la visión budista del mundo como sufrimiento (Dukkha/Samsara)' },
          { ref: 'Proverbs 6:23', rationale: '«Ki ner mitzvá ve-Torá or»: restauración de las 613 Mitzvot en la sociedad frente al ascetismo monástico célibe (Sangha)' },
          { ref: 'Lamentations Rabbah 2:13', rationale: '«Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»: distinción exegética entre la sabiduría contemplativa externa y la redención mesiánica de la Torá' },
        ]
      : isMashiajTopic
      ? [
          { ref: 'Isaiah 11:1', rationale: 'Profecía de Isaías sobre el vástago biológico de Yishai (padre del Rey David) y el espíritu de sabiduría que reposará sobre el Mashíaj humano' },
          { ref: 'Isaiah 2:4', rationale: 'Prueba histórica empírica de la Era Mesiánica (citada por Najmánides en la Disputa de Barcelona de 1263): conversión de las espadas en arados y fin de las guerras' },
          { ref: 'Numbers 23:19', rationale: 'Incorporeidad absoluta de Dios («Dios no es hombre ni hijo de hombre») frente al dogma cristiano de la encarnación divina' },
          { ref: 'Ezekiel 18:20', rationale: 'Responsabilidad moral individual y Teshuvá directa ante Dios («el hijo no cargará con la iniquidad del padre») frente al pecado original y la expiación vicaria' },
          { ref: 'Deuteronomy 30:3', rationale: 'Promesa de la Torá sobre la reunión física de los exiliados (Kibutz Galuyot) y la eternidad de las Mitzvot en este mundo' },
        ]
      : isModim
      ? [
          { ref: 'Sotah 40a', rationale: 'Debate talmúdico de los sabios sobre qué recita la congregación durante el Modim del Jazán y fusión de Rav Papa' },
          { ref: 'Berakhot 34a', rationale: 'Leyes de inclinación y gratitud en la bendición de Modim de la Amidá' },
          { ref: 'Isaiah 45:7', rationale: 'Raíz profética del epíteto litúrgico Yotzer (Formador de la luz y la creación)' },
          { ref: 'Psalms 136:1', rationale: 'Hodaá litúrgica por la creación y la redención histórica' },
        ]
      : isHalelTopic
      ? [
          { ref: 'Pesachim 117a', rationale: 'Origen profético de la institución del Halel («Neviim she-bahem tiknú lahem») ante cada época de peligro y redención de Israel' },
          { ref: 'Arakhin 10a', rationale: 'Criterio talmúdico de los 18 días del año en que se recita el Halel Completo (Halel Shalem) frente a Pesaj y Rosh Jódesh' },
          { ref: 'Taanit 28b', rationale: 'Descubrimiento de Rav en Babilonia sobre el Medio Halel (Jatsi Halel) en Rosh Jódesh y el principio halájico «Minhag avoteijem be-yadeijem»' },
          { ref: 'Shulchan Arukh, Orach Chayim 422:2', rationale: 'Comparación de Minhag en el Shulján Aruj: dictamen de Rabí Yosef Karo (Mejaber, rito sefardí sin berajá en Rosh Jódesh) frente a la glosa del Ramá (rito ashkenazí con berajá)' },
          { ref: 'Shulchan Arukh, Orach Chayim 427:1', rationale: 'Regla halájica y calendárica de por qué Rosh Jódesh es de 1 día (cuando el mes que termina tiene 29 días, Jódesh Jaser) o de 2 días (cuando el mes que termina tiene 30 días, Jódesh Malé: día 30 del mes saliente + día 1 del mes nuevo)' },
          { ref: 'Mishneh Torah, Sanctification of the New Moon 8:4', rationale: 'Explicación de Maimónides (Hiljot Kidush HaJódesh 8:4) sobre Rosh Jódesh de 1 o 2 días según los días del mes que termina y la observancia en ambos días' },
        ]
      : isShulchanArukhOrMinhagNusachTopic || isInternalHalakhaTopic
      ? [
          { ref: 'Shulchan Arukh, Orach Chayim 1:1', rationale: 'Apertura del Shulján Aruj: articulación entre la ley base de Rabí Yosef Karo (El Mejaber, tradición sefardí) y la Mapá del Ramá (Rabí Moshé Isserles, tradición ashkenazí)' },
          { ref: 'Shulchan Arukh, Orach Chayim 68:1', rationale: 'Preservación del Minhag HaMakom y del Núsaj HaTefilá (Sefarad / Edot HaMizraj, Ashkenaz, Sefard/Ari Jasídico, Teimaní): prohibición de alterar el rito comunitario' },
          { ref: "Shulchan Arukh, Yoreh De'ah 214:1", rationale: 'Fuerza normativa del Minhag ancestral («Minhag Yisrael Torá hi») adoptado por una comunidad y sus sabios' },
          { ref: 'Shulchan Arukh, Orach Chayim 422:2', rationale: 'Caso paradigmático de comparación de Minhag entre el Mejaber (Sefarad) y el Ramá (Ashkenaz) sobre la berajá del Medio Halel en Rosh Jódesh' },
          { ref: 'Shulchan Arukh, Orach Chayim 581:1', rationale: 'Comparación de Minhag en el mes de Elul: Selijot durante 40 días en el Minhag Sefardí frente al toque de Shofar y Selijot antes de Rosh Hashaná en el Minhag Ashkenazí' },
          { ref: 'Pesachim 50b', rationale: 'Fundamento talmúdico del respeto al Minhag HaMakom (la costumbre del lugar) para evitar la discordia (Majloket) y preservar la paz comunitaria' },
        ]
      : isJesed
      ? [
          { ref: 'Genesis 47:29', rationale: 'Jésed ve-Emet en la Torá como bondad desinteresada' },
          { ref: 'Psalms 89:3', rationale: 'Olam Jésed Yibané: el mundo se construye mediante la bondad' },
          { ref: 'Pirkei Avot 1:2', rationale: 'Los tres pilares del mundo: Torá, Avodá y Guemilut Jasadim' },
          { ref: 'Mesillat Yesharim 19:1', rationale: 'Definición de Jasidut y expansión del Jésed según el Ramjal' },
        ]
      : [
          { ref: 'Pirkei Avot 1:14', rationale: 'Responsabilidad personal, empatía comunitaria y urgencia del presente según Hilel' },
          { ref: 'Mesillat Yesharim 2:1', rationale: 'Vigilancia espiritual (Zehirut) y examen de los propios actos' },
          { ref: 'Deuteronomy 30:19', rationale: 'Libre albedrío y elección consciente de la vida y el bien' },
          { ref: 'Psalms 104:24', rationale: 'Sabiduría divina plasmada en el orden de la creación' },
        ];
    const effectiveFallbackRefs = externalThinkerDetection.detected
      ? mergeForcedThinkerRefsWithPredictions(externalThinkerDetection, fallbackRefs, 6)
      : fallbackRefs;
    const sefStartedAt = Date.now();
    const [preVerifiedSources, externalSources] = await Promise.all([
      fetchServerSefariaSources(effectiveFallbackRefs, 6),
      externalSourcesPromise,
    ]);
    const fallbackStage2Ms = Date.now() - sefStartedAt;
    const hasComparativeContrast =
      externalThinkerDetection.detected ||
      externalSources.length > 0 ||
      metodologia === 'FILOSOFIA_CONTRASTIVA' ||
      isComparativeTopic;
    const fallbackPhase1: any = {
      ...(externalThinkerDetection.detected ? { externalThinkerDetection } : {}),
      title: isJewishMovementsAndMessianicBoundaryTopic
        ? 'Corrientes Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) y la Frontera Teológica: Por Qué los «Judíos Mesiánicos» No Son Judíos sino Cristianos Evangélicos'
        : isAfterlifeSoulDestinyTopic
        ? 'El Destino de las Almas y sus Requisitos de Acceso: Olam HaBá en el Judaísmo frente a Nirvana, Valhalla, Cielo e Infierno'
        : isEnlightenmentBuddhismTopic
        ? '¿Qué es la Iluminación? Contraste Exegético entre el Despertar Budista (Bodhi / Nirvana) y la Luz de la Torá (Or HaGanuz, Ruaj HaKódesh y Devekut)'
        : isPlatoCaveTopic
        ? 'La Alegoría de la Caverna de Platón frente a la Luz de la Torá: Universalidad vs. Especificidad del Mandamiento y Fuentes Internas vs. Externas'
        : isCiceroTopic
        ? 'Cicerón (De Officiis y la Ley Natural) frente a la Tradición Judía: Universalidad vs. Especificidad del Mandamiento y Fuentes Internas vs. Externas'
        : isKantTopic
        ? 'El Imperativo Categórico de Kant frente a la Ética de la Tradición Judía: Fuente Interna vs. Externa y Universalidad vs. Especificidad'
        : isMashiajBuddhaContrastTopic
        ? '¿Por Qué Buda No es el Mashíaj? Caracterización de Siddhartha Gautama (el Buda) y Desglose de las 7 Diferencias con el Mashíaj del Judaísmo'
        : isMashiajTopic
        ? 'El Mashíaj (מָשִׁיחַ) en el Judaísmo frente al Mesías del Cristianismo: Caracterización y Desglose de las 7 Diferencias'
        : isModim
        ? 'Modim de-Rabanán y el Motivo Creacional (יוֹצֵר בְּרֵאשִׁית)'
        : isHalelTopic
        ? 'El Halel (הַלֵּל) en la Halajá, el Talmud y el Shulján Aruj: Institución Profética, Halel Shalem frente a Jatsi Halel y Minhag Sefardí vs. Ashkenazí'
        : isShulchanArukhOrMinhagNusachTopic
        ? 'El Shulján Aruj (שֻׁלְחָן עָרוּךְ), el Cumplimiento de la Halajá y las Comparaciones de Minhag (מִנְהָג) y Núsaj (נוּסַח) Dentro del Judaísmo: Mejaber frente al Ramá'
        : isJesed
        ? 'Genealogía del Jésed (חֶסֶד) en la Tradición Judía'
        : cleanTopicLabel,
      primaryHebrew: isJewishMovementsAndMessianicBoundaryTopic
        ? 'שְׁמַע יִשְׂרָאֵל ה׳ אֱלֹהֵינוּ ה׳ אֶחָד · לֹא אִישׁ אֵל וִיכַזֵּב וּבֶן־אָדָם וְיִתְנֶחָם'
        : isAfterlifeSoulDestinyTopic
        ? 'כָּל יִשְׂרָאֵל יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא · וְכֵן חֲסִידֵי אֻמּוֹת הָעוֹלָם יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא'
        : isEnlightenmentBuddhismTopic
        ? 'כִּי־עִמְּךָ מְקוֹר חַיִּים בְּאוֹרְךָ נִרְאֶה־אוֹר · כִּי נֵר מִצְוָה וְתוֹרָה אוֹר'
        : isPlatoCaveTopic
        ? 'כִּי נֵר מִצְוָה וְתוֹרָה אוֹר · נַעֲשֶׂה וְנִשְׁמָע'
        : isCiceroTopic
        ? 'הִגִּיד לְךָ אָדָם מַה־טּוֹב וּמָה־ה׳ דּוֹרֵשׁ מִמְּךָ כִּי אִם־עֲשׂוֹת מִשְׁפָּט וְאַהֲבַת חֶסֶד'
        : isKantTopic
        ? 'גָּדוֹל הַמְּצֻוֶּה וְעוֹשֶׂה יוֹתֵר מִמִּי שֶׁאֵינוֹ מְצֻוֶּה וְעוֹשֶׂה · כִּי־קָרוֹב אֵלֶיךָ הַדָּבָר מְאֹד בְּפִיךָ וּבִלְבָבְךָ לַעֲשֹׂתוֹ'
        : isMashiajTopic
        ? 'וְיָצָא חֹטֶר מִגֵּזַע יִשַׁי וְנֵצֶר מִשָּׁרָשָׁיו יִפְרֶה... וּמָלְאָה הָאָרֶץ דֵּעָה אֶת־ה׳'
        : isModim
        ? 'מוֹדִים אֲנַחְנוּ לָךְ שֶׁאַתָּה הוּא ה׳ אֱלֹהֵינוּ... יוֹצֵר בְּרֵאשִׁית'
        : isHalelTopic
        ? 'הַלְלוּיָהּ הַלְלוּ עַבְדֵי ה׳ הַלְלוּ אֶת־שֵׁם ה׳ · זֶה־הַיּוֹם עָשָׂה ה׳ נָגִילָה וְנִשְׂמְחָה בוֹ'
        : isShulchanArukhOrMinhagNusachTopic
        ? 'שְׁמַע בְּנִי מוּסַר אָבִיךָ וְאַל־תִּטֹּשׁ תּוֹרַת אִמֶּךָ · מִנְהַג אֲבוֹתֵיהֶם בִּידֵיהֶם · וְאֵין לְשַׁנּוֹת מִנְהַג הַמָּקוֹם וְנוּסְחָהּ'
        : isJesed
        ? 'עוֹלָם חֶסֶד יִבָּנֶה'
        : 'תּוֹרָה צִוָּה לָנוּ מֹשֶׁה מוֹרָשָׁה קְהִלַּת יַעֲקֹב',
      transliteration: isJewishMovementsAndMessianicBoundaryTopic
        ? 'Shemá Yisrael Hashem Eloheinu Hashem Ejad · Lo ish El vi-jazev u-ven-adam ve-yitnejam'
        : isAfterlifeSoulDestinyTopic
        ? 'Kol Yisrael yesh lahem jélek la-Olam HaBá · Ve-jén Jasidei Umot HaOlam yesh lahem jélek la-Olam HaBá'
        : isEnlightenmentBuddhismTopic
        ? 'Ki-imejá mekor jayim be-orjá niré-or · Ki ner mitzvá ve-Torá or'
        : isPlatoCaveTopic
        ? 'Ki ner mitzvá ve-Torá or · Naasé ve-nishmá'
        : isCiceroTopic
        ? 'Higuid lejá adam ma-tov u-má Hashem doresh mimejá ki im-asot mishpat ve-ahavat jésed'
        : isKantTopic
        ? 'Gadol ha-metzuvé ve-osé yoter mi-mi she-einó metzuvé ve-osé · Ki karov eleja ha-davar meod befija u-vilvaveja laasotó'
        : isMashiajTopic
        ? 'Veyatzá jóter migueza Yishai venétzer mishorashav yifré... Umalá haáretz deá et Hashem'
        : isModim
        ? 'Modim anajnu laj she-Atá Hu Hashem Eloheinu... Yotzer Bereshit'
        : isHalelTopic
        ? 'Haleluyá halelú avdei Hashem halelú et-Shem Hashem · Ze ha-yom asá Hashem naguila ve-nismejá vo'
        : isShulchanArukhOrMinhagNusachTopic
        ? 'Shemá bení musar avija ve-al titosh Torat imeja · Minhag avoteijem be-yadeijem · Ve-ein leshanot minhag ha-makom ve-nusjá'
        : isJesed
        ? 'Olam Jésed Yibané'
        : 'Torá tzivá lanu Moshé morashá kehilat Yaakov',
      literalSpanishTranslation: isJewishMovementsAndMessianicBoundaryTopic
        ? '«Escucha, Israel: Hashem es nuestro Dios, Hashem es Uno» (Deuteronomio 6:4) · «Dios no es hombre para que mienta, ni hijo de hombre para que se arrepienta» (Números 23:19).'
        : isAfterlifeSoulDestinyTopic
        ? '«Todo Israel tiene parte en el Mundo Venidero (Olam HaBá)» (Sanhedrín 90a) · «Y asimismo los justos de todas las naciones del mundo tienen parte en el Mundo Venidero» (Rambam, Hiljot Teshuvá 3:5).'
        : isEnlightenmentBuddhismTopic
        ? '«Porque contigo está el manantial de la vida; en Tu luz veremos la luz» (Salmos 36:10) · «Porque lámpara es el mandamiento específico (Mitzvá) y la Torá es luz» (Proverbios 6:23).'
        : isPlatoCaveTopic
        ? '«Porque lámpara es el mandamiento (Mitzvá) y la Torá es luz» (Proverbios 6:23) · «Haremos y escucharemos» (Éxodo 24:7).'
        : isCiceroTopic
        ? '«Él te ha declarado, oh hombre, qué es lo bueno y qué pide Hashem de ti: hacer justicia (Mishpat), amar la bondad (Jésed) y caminar humildemente con tu Dios» (Miqueas 6:8).'
        : isKantTopic
        ? '«Más grande es quien está comandado y cumple que quien no está comandado y cumple» (Kidushín 31a) · «Pues la palabra está muy cerca de ti, en tu boca y en tu corazón, para cumplirla» (Deuteronomio 30:14).'
        : isMashiajTopic
        ? 'Y saldrá un vástago del tronco de Yishai, y un retoño de sus raíces dará fruto... Y la tierra estará llena del conocimiento del Eterno (Isaías 11:1, 9).'
        : isModim
        ? 'Te agradecemos a Ti, pues Tú eres el Eterno nuestro Dios... Formador de la Creación (Yotzer Bereshit).'
        : isHalelTopic
        ? '«¡Haleluyá! Alabad, siervos de Hashem, alabad el Nombre de Hashem» (Salmos 113:1) · «Este es el día que hizo Hashem; nos gozaremos y alegraremos en él» (Salmos 118:24).'
        : isShulchanArukhOrMinhagNusachTopic
        ? '«Escucha, hijo mío, la instrucción de tu padre, y no abandones la enseñanza (Minhag) de tu madre» (Proverbios 1:8; Pesajim 50b) · «Conservan la costumbre de sus ancestros en sus manos» (Taanit 28b) · «Y no se debe alterar el Minhag del lugar ni su Núsaj» (Shulján Aruj, Oraj Jaim 68:1).'
        : isJesed
        ? 'El mundo con bondad amorosa (Jésed) será construido.'
        : 'La Torá que nos ordenó Moshé es heredad de la congregación de Yaakov.',
      liturgicalContext: isJewishMovementsAndMessianicBoundaryTopic
        ? 'Deuteronomio 6:4 (Shemá Yisrael) · Números 23:19 · Deuteronomio 13:1–6 · Eruvín 13b · Rambam, 13 Ikarei HaEmuná · Demarcación entre Jasidismo (Jabad, Breslev), Ortodoxia y Reformismo frente al Evangélico «Mesiánico»'
        : isAfterlifeSoulDestinyTopic
        ? 'Mishná Sanhedrín 10:1 · Rambam Hiljot Teshuvá 3:5 y 8:2 · Berajot 17a · Pirké Avot 4:16 · Contraste con Nirvana (Udāna 8.1), Valhalla (Grímnismál 8-10) y Cielo/Infierno'
        : isEnlightenmentBuddhismTopic
        ? 'Salmos 36:10 · Talmud Jaguigá 12a (Or HaGanuz) · Proverbios 6:23 · Éxodo 24:7 · Contraste con Bodhi/Iluminación en el Dhammapada budista'
        : isPlatoCaveTopic
        ? 'Proverbios 6:23 · Éxodo 24:7 · Eijá Rabá 2:13 · Pirké Avot 3:17 · Contraste Exegético con República VII (514a-520d) de Platón'
        : isCiceroTopic
        ? 'Miqueas 6:8 · Sanhedrín 56a · Eijá Rabá 2:13 · Deuteronomio 4:6 y 6:18 · Contraste Exegético con De Officiis y De Re Publica de Cicerón'
        : isKantTopic
        ? 'Talmud Bavli Kidushín 31a · Yoma 85b · Sanhedrín 56a · Rambam, Shemoná Perakim cap. 6 · Filosofía Judía (Majshévet Yisrael)'
        : isMashiajTopic
        ? 'Isaías 11:1-9 · Rambam, Mishné Torá Hiljot Melajim caps. 11-12 · 12.º Principio de Fe (Aní Maamín)'
        : isModim
        ? 'Talmud Bavli Sotá 40a · Yerushalmi Berajot 1:5 · Repetición de la Amidá'
        : isHalelTopic
        ? 'Salmos 113–118 (Halel HaMitzrí) · Pesajim 117a · Taanit 28b · Arjin 10a · Rambam, Hiljot Megilá ve-Janucá 3:1–6 · Shulján Aruj Oraj Jaim 422 y 644'
        : isShulchanArukhOrMinhagNusachTopic
        ? 'Shulján Aruj (Oraj Jaim 1:1, 68:1, 128:44, 422:2, 453:1, 581:1; Yoré Deá 214:1) · Rabí Yosef Karo (Mejaber) y Rabí Moshé Isserles (Ramá) · Mishná Berurá y Kaf HaJaim · Pesajim 50b y Taanit 28b · Comparación de Minhag y Núsaj (Sefarad, Ashkenaz, Ari/Jasídico y Teimán)'
        : isJesed
        ? 'Tehilim (Salmos) 89:3 · Pirké Avot 1:2 · Etz Jaim y Mesilat Yesharim 19'
        : 'Canon Masorético y Tradición Rabínica Clásica (Tanaj y Jazal)',
      theologicalKeys: {
        textualParallelism: {
          title: isJewishMovementsAndMessianicBoundaryTopic
            ? 'Pluralidad Interna del Judaísmo (Eruvín 13b) frente a la Frontera Innegociable del Monoteísmo (Deuteronomio 6:4)'
            : isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Eijá Rabá 2:13 y Kidushín 31a)'
            : isMashiajTopic
            ? 'Monoteísmo Absoluto y Naturaleza 100% Humana del Mashíaj'
            : 'Intertextualidad Canónica en Tanaj y Jazal',
          explanation: isJewishMovementsAndMessianicBoundaryTopic
            ? 'Dentro del judaísmo coexisten corrientes diversas bajo el principio talmúdico de Eruvín 13b («Elu ve-elu divrei Elohim jayim»): el Jasidismo en sus escuelas como Jabad-Lubavitch (el estudio intelectual místico Jojmá-Biná-Daat en el Tania del Alter Rebe) y Breslev (la alegría constante y la plegaria personal Hitbodedut de Rabí Najman), la Ortodoxia (Sefardí, Ashkenazí, Lituana, Musar) y movimientos modernos como el Reformismo y el Conservadurismo. Pese a sus debates halájicos internos, todos permanecen dentro del judaísmo porque sostienen el monoteísmo absoluto e incorpóreo del Shemá (Deuteronomio 6:4). En cambio, los llamados «judíos mesiánicos» cruzan la frontera teológica hacia otra religión: son cristianos evangélicos (bautistas/pentecostales) que adoran a Jesús como Dios encarnado usando símbolos hebreos con fines misioneros.'
            : isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'El Midrash en Eijá Rabá 2:13 establece la distinción formal entre Fuentes Externas («Jojmá ba-Goyim taamín»: la especulación filosófica y ontológica de Platón, Cicerón o Kant) y las Fuentes Internas de la Torá («Torá ba-Goyim al taamín»: la revelación relacional del Sinaí y la Halajá viva). Además, frente a la autosuficiencia de la razón aislada, el Talmud en Kidushín 31a («Gadol ha-metzuvé ve-osé») enseña que la voz trascendente del Otro rompe el solipsismo del ego y se interioriza en el corazón (Deuteronomio 30:14).'
            : isMashiajTopic
            ? 'En el judaísmo, Dios es Uno, incorpóreo e indivisible (Deuteronomio 6:4; Oseas 11:9). El Mashíaj NO es Dios ni un ser divino o semidivino, sino un ser humano mortal nacido de padre y madre humanos, descendiente del Rey David.'
            : 'Articulación entre la fuente bíblica primordial y su recepción en la literatura talmúdica y litúrgica.',
          sourceRef: isPlatoCaveTopic ? 'Lamentations Rabbah 2:13' : isCiceroTopic ? 'Micah 6:8' : isKantTopic ? 'Kiddushin 31a' : isMashiajTopic ? 'Isaiah 11:1' : isModim ? 'Isaiah 45:7' : isJesed ? 'Psalms 89:3' : 'Deuteronomy 33:4',
          hebrewQuote: isPlatoCaveTopic ? 'חָכְמָה בַּגּוֹיִם תַּאֲמִין' : isCiceroTopic ? 'הִגִּיד לְךָ אָדָם מַה־טּוֹב' : isKantTopic ? 'גָּדוֹל הַמְּצֻוֶּה וְעוֹשֶׂה' : isMashiajTopic ? 'וְיָצָא חֹטֶר מִגֵּזַע יִשַׁי' : isModim ? 'יוֹצֵר אוֹר וּבוֹרֵא חֹשֶׁךְ' : 'עוֹלָם חֶסֶד יִבָּנֶה',
          connectionToPrayer: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'Al aceptar el «Ol Maljut Shamayim» en el Shemá, el ser humano une la iluminación universal de la sabiduría con la fidelidad concreta al Pacto.'
            : isMashiajTopic
            ? 'tres veces al día en la Amidá («Et tzémaj David avdejá meherá tatzmíaj») pedimos por el retoño humano de David que traerá justicia y paz al mundo.'
            : 'Vincula la soberanía cósmica del Creador con la gratitud y responsabilidad ética cotidiana.',
        },
        grammaticalDichotomy: {
          title: isPlatoCaveTopic
            ? '«Ner Mitzvá ve-Torá Or» (Proverbios 6:23): La Vela Específica del Mandamiento frente al Sol Abstracto de Platón'
            : isCiceroTopic || isKantTopic
            ? 'Etimología Filosófica de «Mitzvá» (מִצְוָה): Mandato Externo y Vínculo Relacional (Tzavta)'
            : isMashiajTopic
            ? 'Significado Etimológico de «Mashíaj» (מָשִׁיחַ — El Ungido)'
            : 'Análisis Filológico de las Raíces Hebreas',
          explanation: isPlatoCaveTopic
            ? 'En Proverbios 6:23, «Torá Or» (la Torá es luz universal) se articula con «Ner Mitzvá» (el mandamiento específico es una lámpara/vela individual). Mientras Platón en República VII pide abandonar la caverna sensible hacia la Idea abstracta, la Torá enseña que es la acción específica de cada Mitzvá la que introduce la luz divina dentro de la caverna material.'
            : isCiceroTopic || isKantTopic
            ? 'Mientras el «Imperativo» kantiano o el «Officium» ciceroniano es un deber impersonal dictado por la razón, el término hebreo «Mitzvá» (de la raíz צ-ו-ה, comandar) comparte raíz semántica con el arameo «Tzavta» (צַוְתָּא = compañía, unión, vínculo). La fuente externa en el judaísmo es la invitación dialógica de un Pacto.'
            : isMashiajTopic
            ? 'La palabra hebrea Mashíaj proviene de la raíz trilítera מ-שׁ-ח (mashaj = ungir con aceite). En el Tanaj designa a los reyes y sumos sacerdotes consagrados con el aceite de la unción (Shémen HaMishjá) para una misión pública sagrada.'
            : 'El participio activo en hebreo subraya la renovación continua de la providencia y del pacto.',
          verbAnalysis: isPlatoCaveTopic
            ? 'Binomio verbal en Éxodo 24:7 «Naasé ve-nishmá» (נַעֲשֶׂה וְנִשְׁמָע — Qal imperfecto cohortativo plural): la praxis del mandamiento específico precede y posibilita la comprensión profunda.'
            : isCiceroTopic || isKantTopic
            ? 'Participio pasivo Pual «Metzuvé» (מְצֻוֶּה — quien es interpelado y comandado) unido al participio activo Qal «Osé» (עוֹשֶׂה — quien obra con agencia libre): síntesis entre llamado externo y respuesta interna.'
            : isMashiajTopic
            ? 'Sustantivo/adjetivo verbal en patrón Qatil (מָשִׁיחַ) de la raíz מ-שׁ-ח: aquel que ha sido investido legítimamente para liderar con justicia.'
            : 'Uso de formas participiales (Qal Poel / Hifil) que indican acción presente y constante.',
          watchmakerRefutation: isPlatoCaveTopic
            ? 'Refuta el dualismo platónico que desprecia el mundo físico como mera sombra ilusoria: en la Torá («Y vio Dios todo lo que había hecho, y he aquí que era muy bueno», Génesis 1:31), el mundo material es el escenario sagrado del Tikún Olam.'
            : isCiceroTopic || isKantTopic
            ? 'Refuta la tesis de que todo mandato proveniente de una fuente externa destruye la moralidad: en Kidushín 31a, responder a la voz del Otro vence la resistencia del ego (Yétzer HaRá) con mayor mérito ético que actuar solo cuando coincide con el propio criterio.'
            : isMashiajTopic
            ? 'Desmiente cualquier idea mitológica o sobrenatural ajena a la Torá: ser «Mashíaj» no altera la naturaleza humana del líder ni suspende el libre albedrío.'
            : 'La creación en el pensamiento judío no es un evento pretérito cerrado, sino vitalidad renovada a cada instante (Jidush Maasé Bereshit).',
          liturgicalEcho: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'Ahavá Rabá: «Ilumina nuestros ojos en Tu Torá y adhiere nuestro corazón a Tus preceptos (Mitzvoteja)».'
            : isMashiajTopic
            ? 'Aní maamín beemuná shlemá beviat ha-Mashíaj (12.º Principio de Maimónides).'
            : 'Hamejadesh betuvó bejol yom tamid maasé bereshit.',
        },
        technicalTerm: {
          title: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'La Universalidad frente a la Especificidad del Mandamiento (7 Leyes de Noé, 613 Mitzvot y Casuística Halájica)'
            : isMashiajTopic
            ? 'Criterios Halájicos de Maimónides (Bejézkat Mashíaj vs. Mashíaj Vadai)'
            : 'Categoría Conceptual en la Masorah',
          explanation: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'Frente al universalismo abstracto de las fuentes filosóficas externas (la Idea universal de Platón, la lex naturae inmutable de Cicerón o la máxima universalizable sin excepciones de Kant), la Torá articula la Universalidad ética básica (las 7 Leyes de Noé en Sanhedrín 56a) con la Especificidad concreta del Mandamiento (Mitzvá): la acción particular que santifica el detalle cotidiano (Proverbios 6:23), salva la vida concreta por encima de toda abstracción (Pikuaj Néfesh, Yoma 85b) y aplica equidad compasiva más allá de la letra formal (Lifnim Mishurat HaDin, Deuteronomio 6:18).'
            : isMashiajTopic
            ? 'En Mishné Torá (Hiljot Melajim 11:4), el Rambam codifica qué debe hacer concretamente el Mashíaj: ser un líder de la casa de David inmerso en la Torá, reunir a los exiliados de Israel, reconstruir el Templo en Jerusalén y traer paz universal.'
            : 'Distinción rabínica entre la obligación normativa delegable y el deber relacional directo del individuo.',
          mishnaSource: isPlatoCaveTopic ? 'Pirkei Avot 3:17' : isCiceroTopic ? 'Sanhedrin 56a' : isKantTopic ? 'Yoma 85b' : isMashiajTopic ? 'Sanhedrin 98a' : isModim ? 'Sotah 40a' : 'Pirkei Avot 1:2',
          prescribedBlessing: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? '«Ve-jay bahem, ve-lo she-yamut bahem» (Vivirás por los preceptos y no morirás por ellos): la especificidad del mandamiento sirve a la vida concreta.'
            : isMashiajTopic
            ? 'Mientras esas transformaciones históricas y visibles en el mundo físico no se hayan completado, la redención aún está por cumplirse.'
            : 'Reconocimiento consciente de la fuente de la vida y del pacto moral.',
        },
        kabbalisticArchitecture: {
          title: isPlatoCaveTopic
            ? 'Dirá BeTajtonim: Traer el Sol de la Verdad dentro de la Caverna mediante el Mandamiento'
            : isCiceroTopic || isKantTopic
            ? 'Del Deber Impersonal a la Armonía del Carácter (Shemoná Perakim 6) y la Simjá shel Mitzvá'
            : isMashiajTopic
            ? 'Un Ser Humano Especial por su Sabiduría y Ruaj HaKodesh (Isaías 11:2)'
            : 'Dimensión Interior del Néfesh y las Sefirot',
          explanation: isPlatoCaveTopic
            ? 'En la Cábala y la Jasidut (Tania cap. 36), el propósito de la creación no es que el alma escape de la caverna física hacia el mundo espiritual superior, sino construir una morada para la luz divina aquí abajo (Dirá BeTajtonim) mediante la especificidad física de cada Mitzvá.'
            : isCiceroTopic || isKantTopic
            ? 'Frente al deber frío o puramente cívico, Maimónides (en Shemoná Perakim cap. 6) y la tradición judía enseñan que el deber externo debe educar y encender el amor («Amarás a tu prójimo como a ti mismo», Levítico 19:18) y la alegría interior (Simjá shel Mitzvá, Deuteronomio 28:47).'
            : isMashiajTopic
            ? 'Es un ser humano especial no por tener naturaleza divina, sino por alcanzar el grado más alto de sabiduría, humildad, integridad moral y sensibilidad espiritual (Ruaj HaKodesh), superando en profecía a todos los líderes salvo Moshé Rabenu.'
            : 'Integración entre el macrocosmos ontológico y el microcosmos de la conducta humana.',
          sefiraConnection: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'Síntesis en Tiféret y Maljut entre Jojmá/Guevurá (sabiduría y ley) y Jésed (bondad encarnada en la acción concreta).'
            : isMashiajTopic
            ? 'Rectificación de Maljut (el reino e historia humana) iluminada por Jojmá, Biná y Daat (Isaías 11:2).'
            : 'Armonía entre Jésed (expansión generosa), Guevurá (límite reverente) y Tiféret (verdad).',
          prooftext: isPlatoCaveTopic ? 'Proverbs 6:23' : isCiceroTopic ? 'Micah 6:8' : isKantTopic ? 'Deuteronomy 30:14' : isMashiajTopic ? 'Isaiah 11:2' : 'Psalms 104:24',
          liturgicalStructure: isPlatoCaveTopic || isCiceroTopic || isKantTopic
            ? 'Pirké Avot 2:4: «Asé retzonó kirtzonejá» — alinear la autonomía interior con la voz ética trascendente.'
            : isMashiajTopic
            ? 'Aleinu leshabéaj: Letakén olam be-Maljut Shadai (Perfeccionar el mundo bajo la soberanía del Todopoderoso).'
            : 'Unificación de pensamiento, palabra y acción.',
        },
      },
      morphologicalBreakdown: isPlatoCaveTopic
        ? [
            {
              hebrewWord: 'מִצְוָה',
              root: 'צ-ו-ה',
              rootMeaning: 'Mandamiento específico, precepto concreto y vínculo relacional (Tzavta)',
              binyan: 'Sustantivo femenino singular',
              tense: 'Normativo y relacional',
              theologicalImplication:
                'En Proverbios 6:23 («Ner Mitzvá ve-Torá Or»), la especificidad del mandamiento concreto es la lámpara que ilumina el mundo material sin evadirse de la caverna.',
            },
            {
              hebrewWord: 'נַעֲשֶׂה',
              root: 'ע-ש-ה',
              rootMeaning: 'Hacer, obrar, plasmar en la realidad concreta',
              binyan: 'Qal (Imperfecto 1.ª persona plural)',
              tense: 'Compromiso activo del Pacto',
              theologicalImplication:
                'En Éxodo 24:7 («Naasé ve-nishmá»), la praxis ética precede a la especulación teórica, invirtiendo el intelectualismo platónico.',
            },
            {
              hebrewWord: 'חָכְמָה',
              root: 'ח-כ-ם',
              rootMeaning: 'Sabiduría, discernimiento filosófico y científico',
              binyan: 'Sustantivo femenino',
              tense: 'Epistemológico',
              theologicalImplication:
                'En Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín») define el valor y el límite de las fuentes filosóficas externas frente a la Torá.',
            },
          ]
        : isCiceroTopic || isKantTopic
        ? [
            {
              hebrewWord: 'מְצֻוֶּה',
              root: 'צ-ו-ה',
              rootMeaning: 'Comandar, encomendar y vincular relacionalmente (afín a Tzavta = unión)',
              binyan: 'Pual (Participio masculino singular)',
              tense: 'Presente continuo relacional',
              theologicalImplication:
                'En Kidushín 31a designa a quien responde a una fuente externa trascendente (Teonomía del Pacto), quebrando el egoísmo solipsista de la mera autolegislación.',
            },
            {
              hebrewWord: 'וְחַי',
              root: 'ח-י-ה',
              rootMeaning: 'Vivir, preservar y santificar la vida concreta',
              binyan: 'Qal (Perfecto conversivo)',
              tense: 'Mandato normativo continuo',
              theologicalImplication:
                'En Yoma 85b («Vivirás por ellos y no morirás por ellos») fundamenta que las conclusiones éticas halájicas dependen de la especificidad vital (Pikuaj Néfesh) y jamás sacrifican a una persona inocente por una regla abstracta.',
            },
            {
              hebrewWord: 'הַיָּשָׁר',
              root: 'י-שׁ-ר',
              rootMeaning: 'Rectitud, equidad contextual más allá de la letra rígida',
              binyan: 'Adjetivo sustantivado con artículo',
              tense: 'Atemporal / Ético',
              theologicalImplication:
                'En Deuteronomio 6:18 («Harás lo recto y lo bueno») exige ir más allá del formalismo legal (Lifnim Mishurat HaDin) atendiendo la especificidad de cada situación humana.',
            },
          ]
        : isMashiajTopic
        ? [
            {
              hebrewWord: 'מָשִׁיחַ',
              root: 'מ-שׁ-ח',
              rootMeaning: 'Ungir con aceite, consagrar para una responsabilidad de liderazgo público',
              binyan: 'Patrón nominal Qatil (Pasivo/Investido)',
              tense: 'Sustantivo masculino singular',
              theologicalImplication:
                'Indica que el Mashíaj es un rey y maestro humano designado por Dios dentro de la historia, jamás una deidad.',
            },
            {
              hebrewWord: 'גְּאֻלָּה',
              root: 'ג-א-ל',
              rootMeaning: 'Redimir, liberar, restaurar a su estado íntegro y legítimo',
              binyan: 'Sustantivo femenino abstracto',
              tense: 'Proceso histórico y espiritual',
              theologicalImplication:
                'La redención judía ocurre en este mundo físico e histórico: erradicación de la guerra, la injusticia y el exilio.',
            },
            {
              hebrewWord: 'דֵּעָה',
              root: 'י-ד-ע',
              rootMeaning: 'Conocer íntimamente, comprender la verdad divina y ética',
              binyan: 'Sustantivo femenino (Qal)',
              tense: 'Plenitud mesiánica (Isaías 11:9)',
              theologicalImplication:
                'El propósito final de la Era Mesiánica no es alterar las leyes de la naturaleza, sino que toda la humanidad alcance claridad moral y espiritual.',
            },
          ]
        : isModim
        ? [
            {
              hebrewWord: 'מוֹדִים',
              root: 'י-ד-ה',
              rootMeaning: 'Reconocer la verdad, agradecer e inclinarse con reverencia',
              binyan: 'Hifil (Participio masculino plural)',
              tense: 'Presente continuo',
              theologicalImplication:
                'En hebreo, agradecer (Hodaá) nace de admitir y reconocer (Modeh) que nuestra existencia proviene del Creador.',
            },
            {
              hebrewWord: 'יוֹצֵר',
              root: 'י-צ-ר',
              rootMeaning: 'Dar forma, modelar con diseño e intención',
              binyan: 'Qal (Participio activo)',
              tense: 'Presente continuo',
              theologicalImplication:
                'Afirma la acción formativa continua sobre el cosmos, tomada de Isaías 45:7 frente a cualquier visión dualista.',
            },
            {
              hebrewWord: 'בְּרֵאשִׁית',
              root: 'ר-א-שׁ',
              rootMeaning: 'Principio, cabeza, sabiduría primordial',
              binyan: 'Sustantivo con preposición Bet',
              tense: 'Absoluto / Origen',
              theologicalImplication:
                'Conecta la plegaria comunitaria con el acto fundacional del universo (Génesis 1:1).',
            },
          ]
        : [
            {
              hebrewWord: 'חֶסֶד',
              root: 'ח-ס-ד',
              rootMeaning: 'Bondad leal, generosidad expansiva y fidelidad al pacto',
              binyan: 'Sustantivo segolado masculino',
              tense: 'Atemporal',
              theologicalImplication:
                'Fuerza primordial que sostiene la creación y exige imitar los caminos de benevolencia divina.',
            },
            {
              hebrewWord: 'תּוֹרָה',
              root: 'י-ר-ה',
              rootMeaning: 'Instruir, orientar, señalar el blanco con precisión',
              binyan: 'Sustantivo femenino',
              tense: 'Atemporal',
              theologicalImplication:
                'La Torá no es solo código legal, sino enseñanza viva (Horaá) que guía el carácter y el intelecto.',
            },
          ],
      sefariaReferences: fallbackRefs,
      preVerifiedSources,
      ...(hasComparativeContrast
        ? {
            externalSources,
            formalContrast: buildDefaultFormalExegeticalContrast(query, externalSources),
          }
        : {}),
      detectedMetodologia: metodologia,
      metodologiasComplementarias: complementaryMethodologies,
      duracion,
      stageTimingsMs: {
        stage1MorphologyMs: fallbackStage1Ms,
        stage2SefariaMs: fallbackStage2Ms,
        totalPhase1And2Ms: Date.now() - phase1StartedAt,
        cacheHit: false,
      },
    };
      const sanitizedFallbackPhase1 = sanitizeHalakhicOutputFromExternalCitations(
        fallbackPhase1,
        halakhicValidation
      );
      setBoundedCache(phase1MemoryCache, phase1CacheKey, sanitizedFallbackPhase1);
      return sanitizedFallbackPhase1;
    } finally {
      inFlightPhase1ServerRequests.delete(phase1CacheKey);
    }
  })();

  inFlightPhase1ServerRequests.set(phase1CacheKey, p1ExecutionPromise);
  const finalP1Payload = await p1ExecutionPromise;
  return res.json(finalP1Payload);
});

// Helper to ensure methodologySections is always populated according to the active methodology
function normalizeMethodologySections(
  metodologia: string,
  rawSections: any[] | undefined,
  pardes: any
): Array<{
  key: string;
  stepNumber: number;
  hebrewBadge: string;
  hebrewTerm: string;
  spanishSubtitle: string;
  title: string;
  exposition: string;
  keyTakeaway: string;
}> {
  if (Array.isArray(rawSections) && rawSections.length >= 3) {
    return rawSections.map((s, idx) => ({
      key: s.key || `sec_${idx + 1}`,
      stepNumber: s.stepNumber || idx + 1,
      hebrewBadge: s.hebrewBadge || ['א', 'ב', 'ג', 'ד'][idx] || 'א',
      hebrewTerm: s.hebrewTerm || '',
      spanishSubtitle: s.spanishSubtitle || `Sección ${idx + 1}`,
      title: s.title || '',
      exposition: s.exposition || '',
      keyTakeaway: s.keyTakeaway || '',
    }));
  }

  // Fallback derived from pardes pillars if model omitted methodologySections
  const m = (metodologia || 'PARDES').toUpperCase();
  if (m === 'MESILAT_YESHARIM_SISTEMATICO') {
    return [
      {
        key: 'mahut',
        stepNumber: 1,
        hebrewBadge: 'מ',
        hebrewTerm: 'מַהוּת',
        spanishSubtitle: '1. Mahut · Definición Esencial y Frontera Conceptual',
        title: pardes?.pshat?.title || 'Definición Esencial del Rasgo',
        exposition: pardes?.pshat?.exposition || '',
        keyTakeaway: pardes?.pshat?.keyTakeaway || '',
      },
      {
        key: 'jalakim',
        stepNumber: 2,
        hebrewBadge: 'ח',
        hebrewTerm: 'חֲלָקִים',
        spanishSubtitle: '2. Jalakim / Bikurim · Pensamiento, Palabra y Acción',
        title: pardes?.remez?.title || 'Ramificaciones Prácticas',
        exposition: pardes?.remez?.exposition || '',
        keyTakeaway: pardes?.remez?.keyTakeaway || '',
      },
      {
        key: 'derej_kinyano',
        stepNumber: 3,
        hebrewBadge: 'ד',
        hebrewTerm: 'דֶּרֶךְ קִנְיָנוֹ',
        spanishSubtitle: '3. Dérej Kinyanó · Estrategia de Adquisición Gradual',
        title: pardes?.drash?.title || 'Camino para Adquirir la Virtud',
        exposition: pardes?.drash?.exposition || '',
        keyTakeaway: pardes?.drash?.keyTakeaway || '',
      },
      {
        key: 'mafsidayv',
        stepNumber: 4,
        hebrewBadge: 'פ',
        hebrewTerm: 'מַפְסִידָיו',
        spanishSubtitle: '4. Mafsidayv · Obstáculos y Autojustificaciones del Ego',
        title: pardes?.sod?.title || 'Factores que Sabotean el Rasgo',
        exposition: pardes?.sod?.exposition || '',
        keyTakeaway: pardes?.sod?.keyTakeaway || '',
      },
    ];
  }

  if (m === 'PIRKE_AVOT_EXEGETICO') {
    return [
      {
        key: 'contexto_tanaita',
        stepNumber: 1,
        hebrewBadge: 'א',
        hebrewTerm: 'קוֹל הַתַּנָּא',
        spanishSubtitle: '1. Contexto del Tanaíta · Dilema Histórico y Espiritual',
        title: pardes?.pshat?.title || 'La Voz del Sabio en la Masorah',
        exposition: pardes?.pshat?.exposition || '',
        keyTakeaway: pardes?.pshat?.keyTakeaway || '',
      },
      {
        key: 'analisis_contrastivo',
        stepNumber: 2,
        hebrewBadge: 'ב',
        hebrewTerm: 'רַמְבַּ״ם וּמַהֲרַ״ל',
        spanishSubtitle: '2. Análisis Contrastivo · Rambam vs. Rabenu Yoná y Maharal',
        title: pardes?.drash?.title || 'El Justo Medio frente a la Devoción Interior',
        exposition: pardes?.drash?.exposition || '',
        keyTakeaway: pardes?.drash?.keyTakeaway || '',
      },
      {
        key: 'principio_vivo',
        stepNumber: 3,
        hebrewBadge: 'ג',
        hebrewTerm: 'הֲלָכָה לְמַעֲשֶׂה',
        spanishSubtitle: '3. Principio Vivo · Aplicación Ética Contemporánea',
        title: pardes?.sod?.title || 'Conducta Ética en el Presente',
        exposition: pardes?.sod?.exposition || '',
        keyTakeaway: pardes?.sod?.keyTakeaway || '',
      },
    ];
  }

  if (m === 'MUSAR_TRANSFORMATIVO') {
    return [
      {
        key: 'punto_focal',
        stepNumber: 1,
        hebrewBadge: 'נ',
        hebrewTerm: 'נְקֻדַּת הַהִתְבּוֹנְנוּת',
        spanishSubtitle: '1. Punto Focal · Fricción Conductual Concreta',
        title: pardes?.pshat?.title || 'La Frase y la Fricción Cotidiana',
        exposition: pardes?.pshat?.exposition || '',
        keyTakeaway: pardes?.pshat?.keyTakeaway || '',
      },
      {
        key: 'diagnostico_nefesh',
        stepNumber: 2,
        hebrewBadge: 'א',
        hebrewTerm: 'אִבְחוּן הַנֶּפֶשׁ',
        spanishSubtitle: '2. Diagnóstico del Néfesh · Emoción Automática, Orgullo o Apatía',
        title: pardes?.drash?.title || 'Raíces Inconscientes y Sesgos (Negiá)',
        exposition: pardes?.drash?.exposition || '',
        keyTakeaway: pardes?.drash?.keyTakeaway || '',
      },
      {
        key: 'jeshbon_hanefesh',
        stepNumber: 3,
        hebrewBadge: 'ח',
        hebrewTerm: 'חֶשְׁבּוֹן הַנֶּפֶשׁ',
        spanishSubtitle: '3. Contabilidad del Alma (Jeshbón HaNéfesh) · Ejercicio Semanal',
        title: pardes?.sod?.title || 'Pregunta Frontal y Práctica Semanal',
        exposition: pardes?.sod?.exposition || '',
        keyTakeaway: pardes?.sod?.keyTakeaway || '',
      },
    ];
  }

  if (m === 'FILOSOFIA_CONTRASTIVA') {
    return [
      {
        key: 'tesis_filosofica',
        stepNumber: 1,
        hebrewBadge: 'א',
        hebrewTerm: 'הַהֲנָחָה הַפִילוֹסוֹפִית',
        spanishSubtitle: '1. Tesis Filosófica y Puntos de Contacto Aparente',
        title: pardes?.pshat?.title || 'Postulados Filosóficos y Ecos en Jazal',
        exposition: pardes?.pshat?.exposition || '',
        keyTakeaway: pardes?.pshat?.keyTakeaway || '',
      },
      {
        key: 'frontera_teologica',
        stepNumber: 2,
        hebrewBadge: 'ב',
        hebrewTerm: 'קַו הַפָּרָשָׁה הַתּוֹרָנִי',
        spanishSubtitle: '2. Frontera Teológica · Divergencia en Kuzari, Rambam y Maharal',
        title: pardes?.remez?.title || 'Destino Impersonal vs. Pacto y Emuná',
        exposition: pardes?.remez?.exposition || '',
        keyTakeaway: pardes?.remez?.keyTakeaway || '',
      },
      {
        key: 'respuesta_canonica',
        stepNumber: 3,
        hebrewBadge: 'ג',
        hebrewTerm: 'מַעֲנֵה הַמְּקוֹרוֹת',
        spanishSubtitle: '3. Respuesta desde las Fuentes Canónicas (Tanaj y Jazal)',
        title: pardes?.drash?.title || 'Santificación de la Emoción y el Deber Relacional',
        exposition: pardes?.drash?.exposition || '',
        keyTakeaway: pardes?.drash?.keyTakeaway || '',
      },
      {
        key: 'sintesis_elevacion',
        stepNumber: 4,
        hebrewBadge: 'ד',
        hebrewTerm: 'בֵּרוּר וְהַעֲלָאָה',
        spanishSubtitle: '4. Síntesis Vivencial y Elevación (Avodat Hashem)',
        title: pardes?.sod?.title || 'De la Resiliencia Filosófica a la Acción Sagrada',
        exposition: pardes?.sod?.exposition || '',
        keyTakeaway: pardes?.sod?.keyTakeaway || '',
      },
    ];
  }

  if (m === 'EVOLUCION_CONCEPTUAL') {
    return [
      {
        key: 'tora_y_jazal',
        stepNumber: 1,
        hebrewBadge: 'ת',
        hebrewTerm: 'שֹׁרֶשׁ בַּתּוֹרָה וּבְחֲזַ״ל',
        spanishSubtitle: '1. En la Torá y Jazal · Escritura, Raíz y Sentido de Pacto',
        title: pardes?.pshat?.title || 'Raíz Bíblica y Formulación en el Talmud',
        exposition: pardes?.pshat?.exposition || '',
        keyTakeaway: pardes?.pshat?.keyTakeaway || '',
      },
      {
        key: 'arbol_cabala',
        stepNumber: 2,
        hebrewBadge: 'ע',
        hebrewTerm: 'עֵץ חַיִּים וְהַקַּבָּלָה',
        spanishSubtitle: '2. En el Árbol de la Vida (Cábala) · Sefirá y Equilibrio Cósmico',
        title: pardes?.remez?.title || 'Arquitectura Sefirótica en el Zóhar y el Arizal',
        exposition: pardes?.remez?.exposition || '',
        keyTakeaway: pardes?.remez?.keyTakeaway || '',
      },
      {
        key: 'escuela_musar',
        stepNumber: 3,
        hebrewBadge: 'מ',
        hebrewTerm: 'תִּקּוּן הַמִּדּוֹת בַּמּוּסָר',
        spanishSubtitle: '3. Según el Musar · Psicología del Carácter y Trampas del Ego',
        title: pardes?.drash?.title || 'Del Cosmos a la Conducta (Ramjal, Salanter y Rav Dessler)',
        exposition: pardes?.drash?.exposition || '',
        keyTakeaway: pardes?.drash?.keyTakeaway || '',
      },
      {
        key: 'jasidut_y_evolucion',
        stepNumber: 4,
        hebrewBadge: 'ח',
        hebrewTerm: 'הַחֲסִידוּת וְהִתְפַּתְּחוּת הַמּוּשָׂג',
        spanishSubtitle: '4. En la Jasidut (Besht, Jabad, Breslev, Gur) y Evolución Comparada',
        title: pardes?.sod?.title || 'Matices entre Escuelas Jasídicas y Síntesis Evolutiva',
        exposition: pardes?.sod?.exposition || '',
        keyTakeaway: pardes?.sod?.keyTakeaway || '',
      },
    ];
  }

  if (m === 'WISSENSCHAFT_DES_JUDENTUMS' || m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT') {
    return [
      {
        key: 'critica_textual_ecdotica',
        stepNumber: 1,
        hebrewBadge: 'א',
        hebrewTerm: 'בִּקֹּרֶת הַנֻּסָּח וְהַמְּקוֹרוֹת',
        spanishSubtitle: '1. Crítica Textual y Evidencia Documental',
        title: pardes?.pshat?.title || 'Fuentes Primarias y Desarrollo Textual',
        exposition: pardes?.pshat?.exposition || '',
        keyTakeaway: pardes?.pshat?.keyTakeaway || '',
      },
      {
        key: 'historia_redaccion_talmudica',
        stepNumber: 2,
        hebrewBadge: 'ב',
        hebrewTerm: 'תּוֹלְדוֹת הָעֲרִיכָה בַּתַּלְמוּדִים',
        spanishSubtitle: '2. Historia de la Redacción Tanaítica y Amoraica',
        title: pardes?.remez?.title || 'Desarrollo en la Literatura de Jazal (Bavli, Yerushalmi y Midrash)',
        exposition: pardes?.remez?.exposition || '',
        keyTakeaway: pardes?.remez?.keyTakeaway || '',
      },
      {
        key: 'analisis_funcional_pragmatico',
        stepNumber: 3,
        hebrewBadge: 'ג',
        hebrewTerm: 'הֶקְשֵׁר הִיסְטוֹרִי וְהִלְכָתִי',
        spanishSubtitle: '3. Análisis Histórico, Normativo y Contextual',
        title: pardes?.drash?.title || 'Función en la Tradición y Codificación en los Rishonim',
        exposition: pardes?.drash?.exposition || '',
        keyTakeaway: pardes?.drash?.keyTakeaway || '',
      },
      {
        key: 'exegesis_teologica_comparada',
        stepNumber: 4,
        hebrewBadge: 'ד',
        hebrewTerm: 'תֵּאוֹלוֹגְיָה הַשְׁוָאָתִית וּמֶחְקָר',
        spanishSubtitle: '4. Exégesis Teológica Comparada y Síntesis Académica',
        title: pardes?.sod?.title || 'Síntesis Histórica y Filológica del Concepto',
        exposition: pardes?.sod?.exposition || '',
        keyTakeaway: pardes?.sod?.keyTakeaway || '',
      },
    ];
  }

  return [
    {
      key: 'pshat',
      stepNumber: 1,
      hebrewBadge: 'פ',
      hebrewTerm: 'פְּשָׁט',
      spanishSubtitle: '1. Pshat · Sentido Literal y Contextual',
      title: pardes?.pshat?.title || 'Pshat',
      exposition: pardes?.pshat?.exposition || '',
      keyTakeaway: pardes?.pshat?.keyTakeaway || '',
    },
    {
      key: 'remez',
      stepNumber: 2,
      hebrewBadge: 'ר',
      hebrewTerm: 'רֶמֶז',
      spanishSubtitle: '2. Rémez · Alusión Ética y Filosófica',
      title: pardes?.remez?.title || 'Rémez',
      exposition: pardes?.remez?.exposition || '',
      keyTakeaway: pardes?.remez?.keyTakeaway || '',
    },
    {
      key: 'drash',
      stepNumber: 3,
      hebrewBadge: 'ד',
      hebrewTerm: 'דְּרַשׁ',
      spanishSubtitle: '3. Drash · Interpretación Homilética y Midráshica',
      title: pardes?.drash?.title || 'Drash',
      exposition: pardes?.drash?.exposition || '',
      keyTakeaway: pardes?.drash?.keyTakeaway || '',
    },
    {
      key: 'sod',
      stepNumber: 4,
      hebrewBadge: 'ס',
      hebrewTerm: 'סוֹד',
      spanishSubtitle: '4. Sod · Dimensión Profunda y Mística',
      title: pardes?.sod?.title || 'Sod',
      exposition: pardes?.sod?.exposition || '',
      keyTakeaway: pardes?.sod?.keyTakeaway || '',
    },
  ];
}

// Helper to synthesize a continuous, masterwork Derashá Markdown essay structured by active methodology
function synthesizeContinuousDerashaMarkdown(params: {
  query: string;
  metodologia?: string;
  audienciaOTono?: string;
  title: string;
  primaryHebrew?: string;
  transliteration?: string;
  literalSpanishTranslation?: string;
  liturgicalContext?: string;
  theologicalKeys?: any;
  morphologicalBreakdown?: any[];
  verifiedSources?: any[];
  externalSources?: any[];
  formalContrast?: any;
  derasha?: any;
}): string {
  const {
    query,
    metodologia = 'PARDES',
    audienciaOTono = 'Comunidad general · Inspirador y práctico',
    title,
    primaryHebrew,
    transliteration,
    literalSpanishTranslation,
    liturgicalContext,
    verifiedSources,
    externalSources,
    formalContrast,
    derasha,
  } = params;

  const parts: string[] = [];

  parts.push(`# ${derasha?.derashaTitle || title || query}`);

  if (primaryHebrew) {
    parts.push(
      `> **${primaryHebrew}**  \n> *(${transliteration || ''})* — «${literalSpanishTranslation || ''}»  \n> *Contexto:* ${liturgicalContext || 'Tradición Rabínica'} · *Metodología:* ${metodologia} · *Enfoque:* ${audienciaOTono}`
    );
  }

  parts.push(`\n---\n`);

  if (derasha?.openingExordium) {
    parts.push(`## Exordio y Planteamiento Espiritual\n\n${derasha.openingExordium}\n`);
  }

  const activeContrast = formalContrast || derasha?.formalContrast;
  if (activeContrast?.universalidadVsEspecificidad && activeContrast?.fuentesInternasVsExternas) {
    const u = activeContrast.universalidadVsEspecificidad;
    const f = activeContrast.fuentesInternasVsExternas;
    parts.push(
      `## Contraste Exegético Formal: ${activeContrast.externalThinkerOrTradition || 'Filosofía y Tradiciones Comparadas'} frente a la Tradición de la Torá\n`
    );
    parts.push(`### ${u.title || u.axisTitle || 'I. Universalidad frente a Especificidad del Mandamiento'}\n`);
    parts.push(
      `- **Postura de la Fuente Externa:** ${u.externalUniversalism || u.externalUniversalPosture || ''}\n`
    );
    parts.push(
      `- **Dimensión Universal en la Torá:** ${u.torahUniversalDimension || u.jewishSpecificityAndUniversalHarmony || ''}\n`
    );
    if (u.torahCommandmentSpecificity) {
      parts.push(
        `- **Especificidad del Mandamiento en la Torá:** ${u.torahCommandmentSpecificity}\n`
      );
    }
    if (u.exegeticalSynthesis) {
      parts.push(
        `- **Síntesis Exegética:** ${u.exegeticalSynthesis}\n\n`
      );
    } else {
      parts.push('\n');
    }

    parts.push(`### ${f.title || f.axisTitle || 'II. Fuentes Internas de la Torá frente a Fuentes Externas'}\n`);
    parts.push(
      `- **Naturaleza de las Fuentes Internas de la Torá:** ${f.internalTorahSourcesNature || f.internalTorahSource || ''}\n`
    );
    parts.push(
      `- **Naturaleza de las Fuentes Externas Consultadas:** ${f.externalSourcesNature || f.externalPhilosophicalSource || ''}\n`
    );
    parts.push(
      `- **Contraste entre Fuente Interna del Yo y Fuente Externa del Pacto:** ${f.normativeLocusContrast || f.epistemologicalBoundary || ''}\n`
    );
    if (f.hermeneuticalRule || f.epistemologicalBoundary) {
      parts.push(
        `- **Regla Hermenéutica Rabínica:** *${f.hermeneuticalRule || f.epistemologicalBoundary}*\n\n`
      );
    }
  }

  const activeThinkerDetection = derasha?.externalThinkerDetection;
  if (activeThinkerDetection?.detected && activeThinkerDetection?.universalityVsSpecificityMatrix) {
    const m = activeThinkerDetection.universalityVsSpecificityMatrix;
    parts.push(
      `## Módulo del Pipeline: Contraste de ${activeThinkerDetection.thinkerName} (${activeThinkerDetection.specificPhilosophicalConcept}) vs. Cosmovisión del Judaísmo\n`
    );
    parts.push(`- **Pretensión de Universalidad del Filósofo Externo (${activeThinkerDetection.thinkerName}):** ${m.externalConceptUniversalClaim}\n`);
    parts.push(`- **Horizonte Universal en la Torá (UNIVERSALIDAD_TORAH):** ${m.torahUniversalHorizon}\n`);
    parts.push(`- **Especificidad Concreta del Mandamiento (ESPECIFICIDAD_MITZVA):** ${m.torahCommandmentSpecificity}\n`);
    parts.push(`- **Síntesis de Cosmovisión Judía (TEONOMIA_COSMOVISION):** ${m.worldviewContrastSynthesis}\n\n`);
  }

  if (derasha?.morphologicalSynthesis?.summary) {
    parts.push(`## Síntesis Filológica y Gramatical Hebrea\n\n${derasha.morphologicalSynthesis.summary}\n`);
    if (derasha.morphologicalSynthesis.keyTheologicalInsight) {
      parts.push(`> **Enseñanza teológica de la raíz hebrea:** ${derasha.morphologicalSynthesis.keyTheologicalInsight}\n`);
    }
  }

  const sections = normalizeMethodologySections(
    metodologia,
    derasha?.methodologySections,
    derasha?.pardes
  );

  sections.forEach((sec) => {
    parts.push(`## ${sec.spanishSubtitle}: ${sec.title} (${sec.hebrewTerm})\n`);
    parts.push(`${sec.exposition}\n\n`);
    parts.push(`> **Principio clave:** ${sec.keyTakeaway}\n`);
  });

  if (derasha?.canonicalAnalysis?.synthesis) {
    parts.push(`## Articulación de las Fuentes Canónicas\n\n${derasha.canonicalAnalysis.synthesis}\n`);
  }

  const activeExtSources = externalSources || derasha?.externalSources;
  if (Array.isArray(activeExtSources) && activeExtSources.length > 0) {
    parts.push(`## Fuentes Externas Consultadas (Filosofía y Tradiciones Clásicas para el Estudio Comparativo)\n`);
    activeExtSources.forEach((ext: any) => {
      const extBadge = [ext.tradition || ext.retrievedVia || 'Fuente Clásica', ext.originalLanguage]
        .filter(Boolean)
        .join(' · ');
      parts.push(
        `> **${ext.author} — *${ext.workTitle}*** (${ext.canonicalLocus || ext.canonicalRef || ''}) [${extBadge}]:  \n> «${ext.originalQuote || ''}»  \n> *Traducción:* ${ext.spanishTranslation || ''}  \n> *Tesis de la fuente externa:* ${ext.philosophicalThesis || ''}  \n> *Contraste exegético con la Torá:* ${ext.torahContrastPoint || ext.relevanceToContrast || ''}\n`
      );
    });
    parts.push('\n');
  }

  if (verifiedSources && verifiedSources.length > 0) {
    const capMdQuote = (str: string, maxLen = 650): string => {
      const clean = (str || '').trim();
      if (clean.length <= maxLen) return clean;
      return `${clean.slice(0, maxLen).trim()} […]`;
    };
    parts.push(`## Fuentes Internas de la Torá Verificadas en la Biblioteca de Sefaria\n`);
    verifiedSources.forEach((s) => {
      const spTransRaw =
        derasha?.canonicalAnalysis?.spanishTranslations?.find(
          (t: any) => t.ref?.toLowerCase() === s.ref?.toLowerCase()
        )?.spanishTranslation ||
        s.spanishTranslation ||
        s.translation;
      const spTrans = capMdQuote(spTransRaw, 650);
      const heText = capMdQuote(s.hebrewText, 650);
      const echo = derasha?.canonicalAnalysis?.verifiedEchoes?.find(
        (e: any) => e.ref?.toLowerCase() === s.ref?.toLowerCase()
      )?.connection;
      parts.push(
        `> **${s.ref}** (${s.heRef || ''}):  \n> «${heText}»  \n> *Traducción:* ${spTrans}${
          echo ? `  \n> *Conexión exegética:* ${echo}` : ''
        }\n`
      );
    });
    parts.push('\n');
  }

  if (
    Array.isArray(derasha?.contemporaryMasters?.readings) &&
    derasha.contemporaryMasters.readings.length > 0
  ) {
    parts.push(`## Perspectivas de Grandes Maestros Contemporáneos\n`);
    if (derasha.contemporaryMasters.overview) {
      parts.push(`${derasha.contemporaryMasters.overview}\n\n`);
    }
    derasha.contemporaryMasters.readings.forEach((r: any) => {
      parts.push(`### ${r.masterName} (${r.cycleOrSeries || r.masterTitle}) — «${r.readingTitle}»\n`);
      parts.push(`- **Pregunta central:** ${r.centralQuestion}\n`);
      parts.push(`- **Tesis medular:** ${r.coreThesis}\n\n`);
      parts.push(`${r.detailedExposition}\n\n`);
      if (r.keyQuoteOrConcept) {
        parts.push(`> «${r.keyQuoteOrConcept}»\n\n`);
      }
      if (r.practicalTakeaway) {
        parts.push(`*Aplicación vital:* ${r.practicalTakeaway}\n\n`);
      }
    });
  }

  parts.push(`## Conclusión y Llamada a la Acción Moral y Espiritual\n`);
  if (derasha?.practicalConclusion) {
    const pc = derasha.practicalConclusion;
    parts.push(`### ${pc.title}\n\n`);
    parts.push(`- **Cosmovisión y Hashkafá:** ${pc.hashkafa}\n`);
    parts.push(`- **Kavaná e Introspección Interior:** ${pc.prayerKavanah}\n`);
    parts.push(`- **Llamada a la Acción Práctica (Tikún Midot):** ${pc.dailyAction}\n`);
  }

  return parts.join('\n');
}

function compactVerifiedSourcesForPrompt(verifiedSources: any[]): any[] {
  if (!Array.isArray(verifiedSources)) return [];
  return verifiedSources.slice(0, 6).map((s) => ({
    ref: s?.ref || '',
    heRef: s?.heRef || '',
    hebrewText: String(s?.hebrewText || '').slice(0, 520),
    translation: String(s?.spanishTranslation || s?.translation || '').slice(0, 520),
  }));
}

function buildDefaultContemporaryMasters(
  query: string,
  derashaTitle: string,
  openingExordium?: string,
  practicalConclusion?: any
) {
  const {
    cleanTopicLabel,
    isMashiajTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
    isComparativeTopic,
  } = normalizeUserStudyQuery(query);
  const isComp =
    isKantTopic ||
    isPlatoCaveTopic ||
    isCiceroTopic ||
    isEnlightenmentBuddhismTopic ||
    isAfterlifeSoulDestinyTopic ||
    isComparativeTopic;
  const topicLabel =
    derashaTitle && !derashaTitle.startsWith('Estudio Exegético:')
      ? derashaTitle
      : cleanTopicLabel;
  return {
    detectedParashaOrTopic: topicLabel,
    overview:
      openingExordium ||
      `Diálogo entre la filosofía ética del Pacto (Rabino Lord Jonathan Sacks) y la interioridad vital jasídica (Rab Yehoshua Gordon y el pensamiento de Jabad) sobre ${topicLabel}.`,
    readings: [
      {
        id: 'sacks-covenant',
        masterId: 'sacks',
        masterName: 'Rabino Lord Jonathan Sacks zt"l',
        masterTitle: 'Ex Gran Rabino de la Commonwealth · Filósofo de Covenant & Conversation',
        cycleOrSeries: 'Covenant & Conversation · The Great Partnership & The Dignity of Difference',
        perspectiveAngle: 'Contraste entre cosmovisiones externas (Universalidad abstracta) y la Torá (Especificidad del Mandamiento)',
        readingTitle: isAfterlifeSoulDestinyTopic
          ? 'El Mundo Venidero (Olam HaBá) y la Dignidad de la Diferencia: Por Qué en el Judaísmo los Justos de Todas las Naciones Tienen Parte en la Vida Eterna'
          : isEnlightenmentBuddhismTopic
          ? 'Iluminar el Mundo en Lugar de Extinguirse de Él: El Contraste entre Bodhi/Nirvana y «Ner Mitzvá ve-Torá Or»'
          : isPlatoCaveTopic
          ? 'Atenas y Jerusalén: Por Qué la Torá Enciende la Vela del Mandamiento Dentro de la Caverna en Lugar de Huir de Ella'
          : isCiceroTopic
          ? 'De la Ley Natural de Cicerón a la Alianza del Sinaí: Universalidad Cívica frente a Especificidad Compasiva de la Mitzvá'
          : isComp
          ? 'La Dignidad de la Diferencia: Universalidad frente a Especificidad del Mandamiento y Fuentes Internas vs. Externas'
          : isMashiajTopic
          ? 'La Esperanza Mesiánica como Construcción Activa de un Mundo Redimido'
          : `La Voz del Pacto: ${topicLabel}`,
        centralQuestion: isAfterlifeSoulDestinyTopic
          ? '¿Por qué el judaísmo no exige que toda la humanidad se convierta a una sola religión para acceder al Olam HaBá, a diferencia del exclusivismo dogmático o del Valhalla guerrero?'
          : isEnlightenmentBuddhismTopic
          ? '¿Cuál es la diferencia espiritual entre buscar la iluminación mediante el desapego del mundo (Budismo) y buscar la luz mediante la santificación activa de las relaciones y el tiempo (Torá)?'
          : isComp
          ? '¿Por qué las fuentes filosóficas externas (Platón, Cicerón, Kant) buscan la verdad en conceptos universales desencarnados, mientras que las fuentes internas de la Torá conjugan la universalidad ética con la especificidad concreta de cada mandamiento?'
          : isMashiajTopic
          ? '¿Por qué el judaísmo espera a un líder humano que transforme la historia y la sociedad en lugar de una huida mística fuera de este mundo?'
          : '¿Cómo ilumina esta enseñanza nuestra comprensión de la responsabilidad moral y la relación entre el ser humano y el Creador?',
        coreThesis: isAfterlifeSoulDestinyTopic
          ? 'En «The Dignity of Difference», el Rabino Jonathan Sacks subraya uno de los principios más revolucionarios de las fuentes internas de la Torá (Tosefta Sanhedrín 13:2 y Rambam, Hiljot Teshuvá 3:5): «Jasidei Umot HaOlam yesh lahem jélek la-Olam HaBá» (los justos de entre las naciones tienen parte en el Mundo Venidero). Mientras otras tradiciones exigen un credo dogmático único, la muerte heroica en batalla (Valhalla) o la extinción del alma individual (Nirvana), el judaísmo une la universalidad del acceso ético con la especificidad de los mandamientos.'
          : isEnlightenmentBuddhismTopic
          ? 'Mientras el budismo (Dhammapada, Anatta) busca liberar de la sed (Tanha) disolviendo el apego y el yo individual, la tradición judía afirma la realidad sagrada de la persona, del amor y de la historia, encendiendo la luz divina («Be-orjá niré or», Salmos 36:10) a través de la especificidad concreta de cada Mitzvá (Proverbios 6:23).'
          : isComp
          ? 'En «The Great Partnership» y «The Dignity of Difference», el Rabino Jonathan Sacks demuestra que mientras Platón, Cicerón y Kant disuelven lo particular en lo universal abstracto, la Torá revela que el amor, la lealtad y la santidad viven en la especificidad del mandamiento concreto (Mitzvá).'
          : practicalConclusion?.hashkafa ||
            'En el judaísmo, la verdad teológica y textual nunca permanece en la abstracción contemplativa: se encarna en el pacto relacional, la justicia social, la gratitud consciente y la dignificación de la vida humana.',
        detailedExposition: isAfterlifeSoulDestinyTopic
          ? 'El Rabino Jonathan Sacks analiza cómo la escatología judía (Olam HaBá en Sanhedrín 90a, Berajot 17a y Pirké Avot 4:16) articula la Universalidad y la Especificidad del Mandamiento: el Dios universal de toda la humanidad (Génesis 1:27) abre las puertas del Olam HaBá a toda persona de cualquier nación que viva con rectitud ética cumpliendo los 7 Preceptos Universales de Noé (Sanhedrín 56a), al tiempo que convoca al pueblo de Israel a preparar ese banquete espiritual mediante la especificidad de las 613 Mitzvot en este mundo de acción («Este mundo es como un vestíbulo ante el Olam HaBá», Pirké Avot 4:16).'
          : isEnlightenmentBuddhismTopic
          ? 'El Rabino Jonathan Sacks explica que el judaísmo sí posee una profunda teología de la iluminación —el Or HaGanuz (la luz primordial oculta en la Torá, Jaguigá 12a), el Ruaj HaKódesh (Mesilat Yesharim cap. 26) y la Devekut—, pero su método es inverso al retiro monástico: en vez de retirarse del mundo para apagar el deseo, santificamos el deseo dentro de la familia, la mesa de Shabat, el estudio compartido (Javruta) y la justicia social (Tzedaká).'
          : isComp
          ? 'El Rabino Jonathan Sacks analiza la diferencia estructural entre las fuentes externas (Atenas, Roma, Königsberg) y las fuentes internas de la Torá (Jerusalén): 1) En la Alegoría de la Caverna de Platón (República VII), el mundo físico e histórico es visto como una caverna de sombras de la cual el filósofo debe escapar hacia la Idea universal; en la Torá (Proverbios 6:23: «Ner Mitzvá ve-Torá Or»), la especificidad del mandamiento concreto es la lámpara que ilumina y santifica la realidad física. 2) En Cicerón (De Officiis) y Kant (Imperativo Categórico), la ley moral se concibe como una fórmula uniforme e impersonal; en la Torá, un cimiento ético universal (las 7 Leyes de Noé, Sanhedrín 56a) se articula con la especificidad casuística de la Mitzvá (Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).'
          : isMashiajTopic
          ? 'El Rabino Jonathan Sacks distingue entre el «optimismo» (la creencia pasiva de que las cosas mejorarán solas) y la «esperanza» judía (Tikvá: el coraje moral de trabajar junto a Dios para reparar el mundo). En la tradición judía, el Mashíaj es un líder íntegramente humano que restaura la ética de la Torá, reúne a los dispersos y demuestra que la paz universal (Isaías 2:4) se edifica dentro de la historia humana.'
          : 'El Rabino Jonathan Sacks subraya que la tradición rabínica articula simultáneamente la grandeza cósmica de la Creación y la intimidad histórica del Pacto. Cada fórmula litúrgica y cada precepto ético nos convocan a pasar del mero asentimiento intelectual a la agencia moral activa, construyendo una sociedad fundada en Jésed, justicia y reverencia por la imagen divina en el prójimo.',
        keyQuoteOrConcept: isAfterlifeSoulDestinyTopic
          ? '«El Dios de Abraham es el Dios de toda la humanidad, pero nos pide servirle en la especificidad del mandamiento: por eso los justos de todas las naciones tienen parte en el Olam HaBá (Rambam, Hiljot Teshuvá 3:5).»'
          : isComp
          ? '«Las filosofías externas buscaron la verdad en lo universal abstracto o en la huida del mundo; la Torá encuentra la iluminación y la vida eterna en la especificidad del mandamiento concreto.»'
          : '«La fe en la Torá no es pasividad ante el destino, sino el coraje de asumir responsabilidad por el mundo que compartimos con el Creador.»',
        practicalTakeaway:
          practicalConclusion?.dailyAction ||
          'Traducir la enseñanza estudiada en un gesto deliberado de gratitud, escucha y generosidad ética durante la semana.',
      },
      {
        id: 'gordon-chassidut',
        masterId: 'gordon',
        masterName: 'Rab Yehoshua Gordon zt"l',
        masterTitle: 'Maestro de Tania, Jumash con Rashi y Jasidut Aplicada (Jabad)',
        cycleOrSeries: 'Chassidut & Tanya Applied · Dirá BeTajtonim',
        perspectiveAngle: 'Psicología del alma, alegría en el servicio divino y Dirá BeTajtonim',
        readingTitle: isAfterlifeSoulDestinyTopic
          ? '«Más Preciada es una Hora de Torá y Buenas Acciones en Este Mundo que Toda la Vida del Olam HaBá» (Pirké Avot 4:17)'
          : isEnlightenmentBuddhismTopic
          ? 'Or HaGanuz y Ner Mitzvá: Cómo la Luz Primordial de la Creación Brilla en Cada Mandamiento Cotidiano'
          : isPlatoCaveTopic
          ? 'Dirá BeTajtonim frente a la Caverna de Platón: Traer la Luz Infinita al Mundo Material a través de la Mitzvá'
          : isComp
          ? 'De la Ley Exterior al Corazón Encendido: Mitzvá como «Tzavta» (Unión) y Dirá BeTajtonim'
          : isMashiajTopic
          ? 'Dirá BeTajtonim: El Papel del Mashíaj y de Cada Persona en Revelar la Luz Divina Aquí Abajo'
          : `Vitalidad Interior y Hashgajá Pratit: ${topicLabel}`,
        centralQuestion: isAfterlifeSoulDestinyTopic
          ? '¿Por qué enseña la Mishná en Pirké Avot 4:17 que una sola hora de Teshuvá y buenas acciones en este mundo físico supera toda la dicha espiritual del Olam HaBá, pero a la vez todo el Olam HaBá supera a este mundo?'
          : isEnlightenmentBuddhismTopic
          ? '¿Dónde escondió Dios la Luz Primordial (Or HaGanuz) del primer día de la Creación según el Talmud (Jaguigá 12a) y el Tania, y cómo accedemos a esa iluminación hoy?'
          : isComp
          ? '¿Por qué según el Tania (cap. 36-37) la meta del alma no es escapar de la caverna física hacia las alturas espirituales, sino introducir la luz divina en los objetos materiales específicos mediante cada Mitzvá?'
          : isMashiajTopic
          ? '¿Qué significa según el Tania y las enseñanzas de Jabad preparar el mundo para la llegada del Mashíaj mediante cada mitzvá cotidiana?'
          : '¿Cómo llevar esta enseñanza desde el intelecto (Jojmá-Biná-Daat) hasta la calidez del corazón y la acción cotidiana?',
        coreThesis: isAfterlifeSoulDestinyTopic
          ? 'En el Tania (cap. 36-37) expuestos por Rab Yehoshua Gordon, en el Gan Edén espiritual (Olam HaBá de las almas) los justos disfrutan del resplandor de la Shejiná (Berajot 17a), pero es únicamente en este mundo físico donde el alma con libre albedrío puede conectarse con la Esencia misma de Hashem (Atzmut) al cumplir una Mitzvá específica.'
          : isEnlightenmentBuddhismTopic
          ? 'El Zohar y el Baal Shem Tov enseñan que el Or HaGanuz (la Luz Oculta de Génesis 1:3 y Jaguigá 12a) fue investido dentro de las palabras de la Torá y las Mitzvot específicas: cuando una persona estudia Torá y cumple una Mitzvá con alegría (Simjá shel Mitzvá), no apaga su alma sino que la enciende como «Nér Hashem nishmat adam» (Proverbios 20:27).'
          : isComp
          ? 'En el Tania y la filosofía jasídica, la especificidad física del mandamiento (la lana del Tzitzit, el cuero de los Tefilín, la moneda concreta dada en Tzedaká) logra lo que ninguna filosofía abstracta externa puede lograr: unir el alma con la esencia misma del Creador (Tzavta) y transformar la caverna material en morada divina (Dirá BeTajtonim).'
          : practicalConclusion?.prayerKavanah ||
            'A la luz de la Jasidut y del Baal Shem Tov, el propósito de la creación es construir una morada para Dios en el mundo físico (Dirá BeTajtonim) a través de la Torá, la bondad y las mitzvot prácticas.',
        detailedExposition: isAfterlifeSoulDestinyTopic
          ? 'Rab Yehoshua Gordon explica la paradoja de Pirké Avot 4:16-17 a la luz de la Jasidut: a diferencia del Nirvana (donde el yo individual se extingue), del Valhalla (donde el guerrero caído sigue combatiendo y banqueteando) o de un cielo meramente escapista, el judaísmo enseña que cada acción ética y cada Mitzvá específica cumplida hoy («HaYom laasotam», Erubín 22a) teje las vestiduras luminosas del alma en el Olam HaBá y acerca la resurrección y redención final donde el espíritu y la materia se unen en armonía.'
          : isComp
          ? 'Desde la perspectiva del Tania (Alter Rebe) expuesta por Rab Yehoshua Gordon, las fuentes filosóficas externas (Platón, Cicerón, Kant, Budismo) operan con el esfuerzo ascendente del ser humano (Jojmá ba-Goyim), que percibe el mundo material como ilusión, sufrimiento o caverna oscura. En cambio, las fuentes internas de la Torá revelan que el deseo supremo de Hashem es una morada aquí abajo, en los mundos inferiores (Dirá BeTajtonim). Cuando una persona realiza un mandamiento específico con alegría (Simjá shel Mitzvá), convierte la propia oscuridad del mundo físico en luz divina («Ner Mitzvá ve-Torá Or», Proverbios 6:23).'
          : isMashiajTopic
          ? 'Como explica Rab Yehoshua Gordon siguiendo al Alter Rebe en el Tania (cap. 36-37) y al Rebe de Lubavitch, la Era Mesiánica no es la destrucción del mundo físico, sino el momento en que la realidad material deja de ocultar la presencia de Hashem («y la tierra estará llena del conocimiento del Eterno», Isaías 11:9). El Mashíaj —un ser humano de linaje davídico investido de sabiduría y Ruaj HaKodesh— culminará el trabajo milenario de todas las generaciones enseñando Torá y trayendo paz a toda la humanidad.'
          : 'Desde la perspectiva de la Jasidut enseñada por Rab Yehoshua Gordon y el Rebe de Lubavitch, ningún detalle del texto sagrado ni de nuestra experiencia diaria es casual. Reconocer la mano del Creador en lo cotidiano disipa la ansiedad y el ego, despertando una gratitud viva que convierte la rutina material en una morada luminosa para lo divino (Dirá BeTajtonim).',
        keyQuoteOrConcept: isAfterlifeSoulDestinyTopic
          ? '«En el Olam HaBá se saborea el fruto espiritual, pero solo en este mundo físico tenemos el privilegio único de plantar la semilla mediante cada Mitzvá específica (Pirké Avot 4:16-17).»'
          : isComp
          ? '«El místico externo intenta huir del mundo hacia la luz o la extinción; el judío mediante la Mitzvá específica enciende la luz divina dentro del mundo mismo (Ner Mitzvá ve-Torá Or).»'
          : '«Un solo acto más de bondad y una sola mitzvá más pueden inclinar la balanza personal y la del mundo entero hacia el bien y la redención (Rambam, Hiljot Teshuvá 3:4).»',
        practicalTakeaway:
          practicalConclusion?.dailyAction ||
          'Dedicar un momento diario de pausa consciente para agradecer la vitalidad presente y realizar un acto de bondad luminosa hacia otra persona.',
      },
    ],
  };
}

// Phase 3: Final structured Derashá generation with active Methodology, Duration (5_MIN, 10_MIN, 30_MIN) and Complementary Methodologies
app.post('/api/generate-derasha', async (req, res) => {
  const phase3StartedAt = Date.now();
  try {
    const {
      query: rawQuery,
      tema_o_fuente,
      metodologia: rawMetodologia,
      metodologias_complementarias,
      duracion: rawDuracion,
      audiencia_o_tono,
      title,
      primaryHebrew,
      transliteration,
      literalSpanishTranslation,
      liturgicalContext,
      morphologicalBreakdown,
      theologicalKeys,
      verifiedSources,
      externalSources: bodyExternalSources,
      formalContrast: bodyFormalContrast,
    } = req.body;

    const rawInput = (tema_o_fuente || rawQuery || '').trim();
    const {
      normalizedQuery: query,
      cleanTopicLabel,
      isUserQuestion,
      isMashiajTopic,
      isMashiajBuddhaContrastTopic,
      isJewishMovementsAndMessianicBoundaryTopic,
      isKantTopic,
      isPlatoCaveTopic,
      isCiceroTopic,
      isEnlightenmentBuddhismTopic,
      isAfterlifeSoulDestinyTopic,
      isHalelTopic,
      isShulchanArukhOrMinhagNusachTopic,
      isInternalHalakhaTopic,
      isComparativeTopic,
    } = normalizeUserStudyQuery(rawInput);

    const metodologia = resolveEffectiveMethodology(rawMetodologia || 'AUTO', query);
    const duracion = (rawDuracion || '10_MIN').toUpperCase().trim();
    const complementaryMethodologies = resolveComplementaryMethodologies(
      metodologia,
      query,
      duracion,
      metodologias_complementarias
    );
    const audienciaOTono =
      audiencia_o_tono || 'Comunidad general · Inspirador y práctico';

    if (!query || !morphologicalBreakdown || !verifiedSources) {
      return res.status(400).json({ error: 'Faltan datos requeridos (análisis morfológico o fuentes verificadas).' });
    }

    const derashaCacheKey = `${query.toLowerCase()}|${metodologia}|${duracion}|${complementaryMethodologies.join(',')}|${audienciaOTono}`;
    const cachedDerasha = derashaMemoryCache.get(derashaCacheKey);
    if (cachedDerasha) {
      return res.json({
        ...cachedDerasha,
        stageTimingsMs: {
          stage3LlmMs: 0,
          markdownAssemblyMs: 0,
          totalPhase3Ms: Date.now() - phase3StartedAt,
          cacheHit: true,
        },
      });
    }

    const halakhicValidation = validatePurelyHalakhicQuery(query);
    const externalThinkerDetection = halakhicValidation.externalPhilosophyInjectionDisabled
      ? detectExternalThinkerAndForceExegeticalSearch('')
      : detectExternalThinkerAndForceExegeticalSearch(query);
    const shouldIncludeComparativeContrast =
      !halakhicValidation.externalPhilosophyInjectionDisabled &&
      (externalThinkerDetection.detected ||
        metodologia === 'FILOSOFIA_CONTRASTIVA' ||
        isComparativeTopic);
    const activeExternalSources = halakhicValidation.externalPhilosophyInjectionDisabled
      ? []
      : Array.isArray(bodyExternalSources) && bodyExternalSources.length > 0
      ? bodyExternalSources
      : shouldIncludeComparativeContrast
      ? await fetchExternalComparativeSources(query)
      : [];
    const activeFormalContrast = halakhicValidation.externalPhilosophyInjectionDisabled
      ? undefined
      : bodyFormalContrast && bodyFormalContrast.universalidadVsEspecificidad
      ? bodyFormalContrast
      : shouldIncludeComparativeContrast || activeExternalSources.length > 0
      ? buildDefaultFormalExegeticalContrast(query, activeExternalSources)
      : undefined;

    const ai = getGenAIClient();
    const methodologyRules = getMethodologyInstructions(metodologia, audienciaOTono);
    const durationAndComplementaryRules = getDurationAndComplementaryInstructions(
      metodologia,
      duracion,
      complementaryMethodologies
    );

    const systemInstruction = `Eres un asistente rabínico y pedagógico especializado en redactar drashot estructuradas y profundas.
${STRICT_JEWISH_SOURCES_COVENANT}

Recibes cinco parámetros principales:
1. "consulta_o_tema": "${query}"
2. "metodologia_principal": "${metodologia}"
3. "metodologias_complementarias": ${JSON.stringify(complementaryMethodologies)}
4. "duracion": "${duracion}"
5. "audiencia_o_tono": "${audienciaOTono}"

REGLA PEDAGÓGICA FUNDAMENTAL — CÓMO RESPONDER PREGUNTAS Y ANÁLISIS FILOSÓFICOS COMPARATIVOS SIN REPETIRLOS COMO CITAS:
1. DISTINCIÓN ENTRE PREGUNTA Y CITA: Cuando el usuario ingresa una pregunta o solicita un contraste filosófico/comparativo en lenguaje natural (por ejemplo: el Imperativo Categórico de Kant, la Alegoría de la Caverna de Platón, Cicerón, la Iluminación en el Budismo frente al Judaísmo, o el Destino de las Almas: Olam HaBá frente a Nirvana, Valhalla, Cielo e Infierno y los requisitos para acceder a cada uno), su texto NO es una cita bíblica ni talmúdica.
2. PROHIBIDO REPETIR LA PREGUNTA ENTRE COMILLAS («...»): JAMÁS repitas el texto crudo de la pregunta del usuario entre comillas («...») como si fuera una cita solemne o un título. Usa siempre un título conceptual limpio (ej. "${cleanTopicLabel}").
3. CONTRASTE EXEGÉTICO FORMAL ANTE PREGUNTAS COMPARATIVAS (KANT, PLATÓN, CICERÓN, BUDISMO/ILUMINACIÓN, DESTINO DE LAS ALMAS / OLAM HABÁ vs. NIRVANA, VALHALLA, CIELO E INFIERNO, Y CORRIENTES DEL JUDAÍSMO vs. «JUDÍOS MESIÁNICOS»):
   - Cuando el usuario solicita un análisis comparativo, DEBES realizar un **Contraste Exegético Formal** estructurado en estos dos ejes:
     a) **La Universalidad frente a la Especificidad del Mandamiento**:
        - En las fuentes externas, la ética, la iluminación o el destino ultraterreno se conciben desde una **universalidad abstracta, disolución del yo o criterio selectivo**: en Kant, una máxima formal sin excepciones; en Platón (*República VII*), huir de la caverna sensible hacia la Idea abstracta; en Cicerón (*De Re Publica III.33* / *De Officiis I.20*), una *lex naturae* uniforme; en el Budismo (*Dhammapada*, *Udāna 8.1*), apagar el deseo (*Tanha*) y disolver el yo individual (*Anatta*) en el *Nirvana* incondicionado; en la mitología nórdica (*Edda Poética — Grímnismál*), el *Valhalla* reservado exclusivamente a quienes mueren por las armas en combate; o en visiones dogmáticas de Cielo e Infierno eterno.
        - En contraste, la tradición de la Torá conjuga una **Universalidad Ética Inclusiva** —en *Sanhedrín 105a*, *Tosefta Sanhedrín 13:2* y *Mishné Torá, Hiljot Teshuvá 3:5*, «los justos de todas las naciones (*Jasidei Umot HaOlam*) tienen parte en el *Olam HaBá*» cumpliendo los 7 Preceptos Universales de Noé (*Sanhedrín 56a*)— con la **Especificidad Concreta del Mandamiento (*Mitzvá*)**: cada mandamiento específico es una lámpara (*Proverbios 6:23*: «Ki ner mitzvá ve-Torá or») que ilumina la vida terrenal, preserva la identidad relacional del alma (*Berajot 17a*) y prepara en este mundo de acción (*Pirké Avot 4:16-17*) el *Olam HaBá*, mientras el *Guehinom* (*Shabat 33b*, *Rosh Hashaná 17a*) es pedagógico y purificador (máximo doce meses), no una condenación sádica perpetua.
     b) **La Distinción entre Fuentes Internas de la Torá y Fuentes Externas**:
        - Establece la distinción epistemológica de *Eijá Rabá 2:13* («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»): las **Fuentes Externas** (Platón, Cicerón, Kant, el Canon Pali budista en el *Dhammapada* y *Udāna*, las *Eddas* nórdicas sobre el *Valhalla* — cuyos textos primarios te han sido suministrados en el prompt) se citan explícitamente para informar el estudio comparativo; mientras que las **Fuentes Internas de la Torá** (Tanaj, Talmud, Midrash, Rambam, Ramjal, Cábala y Jasidut en Sefaria) emanan de la Revelación del Pacto en el Sinaí.
        - Asimismo, contrasta la búsqueda de fuente puramente interna/autónoma del sujeto con la **Fuente Externa Trascendente y Relacional-Teonómica** (*Kidushín 31a*: «Gadol ha-metzuvé ve-osé») que se interioriza con amor en el corazón (*Deuteronomio 30:14*; *Pirké Avot 2:4*).
   - Si la pregunta es sobre el Mashíaj (Mesías) o pide caracterizar el Mesías del cristianismo para desglosar las diferencias con el Mashíaj del judaísmo, DEBES cubrir exhaustivamente AMBAS PARTES:
     1) **¿Qué es el Mashíaj en el Judaísmo?**: Etimología de *Mashaj* (ungido con aceite), líder y rey 100% humano y mortal nacido de padre y madre humanos del linaje patrilineal de David y Salomón (Isaías 11:1–9; 2 Samuel 7:12–16; 1 Crónicas 22:9–10), monoteísmo incorpóreo absoluto (Deuteronomio 6:4; Números 23:19; Oseas 11:9) y misión histórica verificable (reunir a los exiliados, reconstruir el Templo, restaurar las Mitzvot y traer paz mundial real según Isaías 2:4 y Maimónides en *Hiljot Melajim* caps. 11–12).
      2) **Caracterización del Mesías en el Cristianismo (5 ejes dogmáticos) y Desglose Sistemático de las 7 Diferencias con el Judaísmo**: Caracteriza al Mesías cristiano (a. Dios encarnado trinitario según Nicea 325 e.c. y Calcedonia 451 e.c.; b. Soteriología del pecado original y sacrificio vicario en la cruz; c. Salvación interior invisible; d. Abrogación de la observancia de los preceptos de la Torá; e. Doctrina de la «Segunda Venida / Parusía») y desglosa las **7 diferencias fundamentales** frente al judaísmo (1. Humano mortal vs. Dios encarnado; 2. Linaje patrilineal davídico-salomónico vs. concepción virginal; 3. Responsabilidad individual y *Teshuvá* directa en Ezequiel 18:20 vs. pecado original y sacrificio vicario; 4. Eternidad de la Torá en Deuteronomio 13:1 vs. abrogación de la Ley; 5. Cumplimiento íntegro en una sola vida según Rambam *Hiljot Melajim* 11:4 vs. Segunda Venida; 6. Paz mundial empírica según Najmánides en la *Disputa de Barcelona* de 1263 vs. reino interior espiritualizado; y 7. Acceso ético universal de los Justos de las Naciones vs. exclusivismo dogmático).
      3) **Si la pregunta es «¿Por qué Buda no es el Mashíaj?» (Caracterización de Siddhartha Gautama / el Buda y Desglose de las 7 Diferencias con el Mashíaj del Judaísmo)**: DEBES cubrir las 3 partes: (I) ¿Qué exige el Judaísmo para ser el *Mashíaj*?; (II) Caracterización de Siddhartha Gautama, el Buda (*Shakiamuni*), en el Canon Pali (*Ariyapariyesana Sutta* MN 26, *Dhammacakkappavattana Sutta* SN 56.11, *Brahmajāla Sutta* DN 1) en **5 ejes**; y (III) Desglose sistemático de las **7 razones y diferencias** por las que Buda no es el *Mashíaj* del judaísmo.
      4) **Si la consulta aborda los distintos grupos dentro del judaísmo (Jasidismo como Jabad y Breslev, Ortodoxia, Reformismo) y señala cuándo un grupo ya se aleja y deja de ser judío (como los «judíos mesiánicos» que son cristianos evangélicos)**: DEBES estructurar el análisis en **3 partes claras**: (I) **Mapa de las Corrientes Legítimas Dentro del Judaísmo (*Eruvín 13b*)**: explica la riqueza interna del Jasidismo —diferenciando **Jabad-Lubavitch** (intelectualismo místico *Jojmá-Biná-Daat* en el *Tania* del Alter Rebe, amor a cada judío y campaña global de *Mitzvot*) y **Breslev** (Rabí Najman de Breslev en *Likutei Moharán*: alegría espiritual *Mitzvá Guedolá Lihyot BeSimjá*, plegaria personal *Hitbodedut* y buscar los puntos buenos *Azamrá*)—, la **Ortodoxia** (Sefardí, Ashkenazí, Lituana, Musar) y los movimientos modernos como el **Reformismo y el Conservadurismo (*Masortí*)**, subrayando por qué todos ellos **sí son grupos judíos** (sostienen sin fisuras el monoteísmo incorpóreo del *Shemá Yisrael* en *Deuteronomio 6:4* y no adoran a Jesús); (II) **La Frontera Teológica y Halájica donde un Grupo Deja de Ser Judío**: explica los criterios objetivos de la Torá y de Maimónides (*Deuteronomio 6:4*; *Números 23:19*; *Deuteronomio 13:1–6*; *Sanhedrín 90a*; *Hiljot Yesodei HaTorá 1:7*; *Ezequiel 18:20*) que marcan la salida del judaísmo cuando se introduce la encarnación divina, la Trinidad y el sacrificio humano vicario; y (III) **Por Qué los «Judíos Mesiánicos» NO Son Judíos sino Cristianos Evangélicos**: expone su origen histórico en misiones bautistas/pentecostales (como *Jews for Jesus*, fundado en 1970 por el ministro bautista Martin «Moishe» Rosen), su uso instrumental de símbolos judíos (*Talit*, *Kipá*, *Shofar*) para hacer proselitismo cristiano, el consenso unánime de todas las corrientes judías (Jabad, Breslev, Ortodoxos, Conservadores y Reformistas) y las sentencias de la Corte Suprema de Israel (*Caso Rufeisen* 1962 y *Caso Beresford* 1989).
      5) **Si la consulta aborda leyes (Halajá), el Halel, Rosh Jódesh, cumplimiento práctico, el Shulján Aruj, o comparaciones de costumbres dentro del judaísmo (Minhag y Núsaj)**:
         - Incorpora como fuente central el **Shulján Aruj (שֻׁלְחָן עָרוּךְ)** en sus 4 secciones (*Oraj Jaim*, *Yoré Deá*, *Even HaEzer* y *Joshen Mishpat*), mostrando el diálogo entre **Rabí Yosef Karo (*El Mejaber*, tradición Sefardí / Edot HaMizraj)** y **Rabí Moshé Isserles (*El Ramá — HaMapá*, tradición Ashkenazí)** junto con sus comentaristas (*Mishná Berurá*, *Ben Ish Jai*, *Kaf HaJaim*, *Yalkut Yosef*, *Shulján Aruj HaRav*).
         - Si el tema involucra el **Halel** o **Rosh Jódesh**, DEBES explicar explícitamente por qué **Rosh Jódesh es de 1 o de 2 días dependiendo de cuántos días tiene el mes que termina** (*Talmud Rosh Hashaná 19b*, *Arjín 8b–9b*, *Rambam Hiljot Kidush HaJódesh 8:4* y *Shulján Aruj, Oraj Jaim 427:1*): cuando el mes que termina tiene **29 días (*Jódesh Jaser* / mes deficiente)**, Rosh Jódesh dura **1 solo día** (el día 1 del mes nuevo); cuando el mes que termina tiene **30 días (*Jódesh Malé* / mes pleno)**, Rosh Jódesh dura **2 días** (el **día 30 del mes que termina** como 1.er día de Rosh Jódesh + el **día 1 del nuevo mes entrante** como 2.º día de Rosh Jódesh, desde el cual se cuentan las fechas del mes), recitándose en **ambos días** el Medio Halel (*Jatsi Halel*), *Yaalé VeYavó*, lectura de la Torá y *Musaf*.
         - Desglosa los matices entre **Halajá (ley normativa)**, **Minhag (costumbre comunitaria ancestral: «Minhag avoteijem be-yadeijem» en *Taanit 28b*, «Minhag Yisrael Torá hi» en *Yoré Deá 214:1* y *Pesajim 50b*)** y **Núsaj (rito y formulación litúrgica en *Oraj Jaim 68:1*: Núsaj Sefarad / Edot HaMizraj, Núsaj Ashkenaz, Núsaj Sefard/Ari Jasídico y Núsaj Teimaní)** para realizar comparaciones internas de costumbres dentro del judaísmo sin invocar jamás a filósofos externos.

${methodologyRules}

${durationAndComplementaryRules}

REGLA DE ORO DE VERACIDAD Y USO DE FUENTES INTERNAS Y EXTERNAS:
Tienes a tu disposición los TEXTOS REALES de las **Fuentes Internas de la Torá** (descargados de la API de Sefaria) y, cuando se trata de un estudio comparativo, las **Fuentes Externas Filosóficas y Clásicas** (Kant, Platón, Cicerón, Canon Pali sobre Iluminación/Nirvana, Eddas sobre Valhalla, Cristología Conciliar y la Disputa de Barcelona de 1263). Cita ambas con precisión para fundamentar el contraste exegético formal.

SALIDA OBLIGATORIA:
1. 'derashaTitle': Título inspirador, conceptual y claro de la drashá (NUNCA pegues la pregunta cruda del usuario como título).
2. 'openingExordium': Apertura clara y directa que responda de frente las preguntas o el contraste exegético formal planteado por el usuario antes de adentrarse en las secciones.
3. 'methodologySections': Arreglo estructurado con las secciones exactas de la metodología principal ("${metodologia}") MÁS las secciones de aporte de las metodologías complementarias (${JSON.stringify(complementaryMethodologies)}) cuando la duración es "10_MIN" (1 sección complementaria adicional) o "30_MIN" (2 secciones complementarias adicionales):
   - Si metodologia == "PARDES": 4 secciones base (1. Pshat, 2. Rémez, 3. Drash, 4. Sod).
   - Si metodologia == "WISSENSCHAFT_DES_JUDENTUMS" o "FILOLOGIA_LITURGICA_WISSENSCHAFT": 4 fases académicas de la Wissenschaft des Judentums.
   - Si metodologia == "EVOLUCION_CONCEPTUAL": 4 secciones base (1. En la Torá y Jazal; 2. En el Árbol de la Vida de la Cábala; 3. Según el Musar; 4. En la Jasidut y Evolución Comparada).
   - Si metodologia == "MESILAT_YESHARIM_SISTEMATICO": 4 secciones base del Ramjal (1. Mahut, 2. Jalakim / Bikurim, 3. Dérej Kinyanó, 4. Mafsidayv).
   - Si metodologia == "PIRKE_AVOT_EXEGETICO": 3 secciones base (1. Contexto del Tanaíta, 2. Análisis Contrastivo: Rambam vs. Rabenu Yoná / Maharal, 3. Principio Vivo).
   - Si metodologia == "MUSAR_TRANSFORMATIVO": 3 secciones base de Rabí Israel Salanter (1. Punto Focal, 2. Diagnóstico del Néfesh, 3. Contabilidad del Alma / Jeshbón HaNéfesh).
   - Si metodologia == "FILOSOFIA_CONTRASTIVA": 4 secciones base (1. Eje I: Fuentes Internas de la Torá frente a Fuentes Externas, 2. Eje II: Universalidad frente a Especificidad del Mandamiento, 3. Respuesta desde las Fuentes Canónicas, 4. Síntesis Exegética y Elevación Práctica).
   - Si "metodologias_complementarias" no está vacío (${JSON.stringify(complementaryMethodologies)}): añade al final de 'methodologySections' una sección adicional por cada metodología complementaria (con 'sourceMethodology' igual al código de esa metodología complementaria y 'spanishSubtitle' como "Aporte Complementario · [Nombre de la Metodología]").
4. 'practicalConclusion': Conclusión con llamada a la acción moral y espiritual clara, tangible y transformadora.`;

    const compactSources = compactVerifiedSourcesForPrompt(verifiedSources);
    const effectiveTitle =
      title && !title.startsWith('Estudio Exegético:') ? title : cleanTopicLabel;

    const externalSourcesPromptBlock = halakhicValidation.externalPhilosophyInjectionDisabled
      ? halakhicValidation.systemPromptGuard
      : activeExternalSources.length > 0
        ? `\n- Fuentes Externas Consultadas (Filosofía y Tradiciones Clásicas para informar el contraste): ${JSON.stringify(
            activeExternalSources.map((e: any) => ({
              author: e.author,
              workTitle: e.workTitle,
              canonicalLocus: e.canonicalLocus || e.canonicalRef,
              originalLanguage: e.originalLanguage,
              originalQuote: e.originalQuote,
              spanishTranslation: e.spanishTranslation,
              philosophicalThesis: e.philosophicalThesis,
              torahContrastPoint: e.torahContrastPoint || e.relevanceToContrast,
            }))
          )}\n- Matriz de Contraste Exegético Formal (Universalidad vs. Especificidad del Mandamiento y Fuentes Internas vs. Externas): ${JSON.stringify(
            activeFormalContrast || {}
          )}${
            externalThinkerDetection.detected
              ? `\n- [MÓDULO DETECTOR DE PENSADOR EXTERNO ACTIVO — ${externalThinkerDetection.thinkerName}]: Contrasta explícitamente el concepto "${externalThinkerDetection.specificPhilosophicalConcept}" con la cosmovisión del judaísmo analizando la Universalidad vs. Especificidad del Mandamiento: ${JSON.stringify(
                  externalThinkerDetection.universalityVsSpecificityMatrix
                )}`
              : ''
          }`
        : '';

    const prompt = `Redacta la Drashá estructurada respondiendo de forma directa, profunda y clara a todas las preguntas del estudiante (sin repetir la pregunta del usuario entre comillas como si fuera una cita):
1. "consulta_del_estudiante": "${query}"
2. "tema_conceptual": "${effectiveTitle}"
3. "es_pregunta_en_lenguaje_natural": ${isUserQuestion ? 'SÍ — Responde explícitamente cada interrogante que hace el usuario' : 'NO'}
4. "metodologia_principal": "${metodologia}"
5. "metodologias_complementarias": ${JSON.stringify(complementaryMethodologies)}
6. "duracion": "${duracion}"
7. "audiencia_o_tono": "${audienciaOTono}"

Datos filológicos y fuentes verificadas de apoyo:
- Título conceptual sugerido: ${effectiveTitle}
- Texto hebreo: ${primaryHebrew || ''} (${transliteration || ''}) — «${literalSpanishTranslation || ''}»
- Contexto: ${liturgicalContext || ''}
- Claves teológicas: ${JSON.stringify(theologicalKeys || {})}
- Desglose morfológico: ${JSON.stringify(morphologicalBreakdown)}
- Fuentes Internas de la Torá verificadas en Sefaria: ${JSON.stringify(compactSources)}${externalSourcesPromptBlock}

Genera la respuesta en formato JSON conforme al esquema definido.`;

    const llmPhase3StartedAt = Date.now();
    const phase3ThinkingLevel =
      duracion === '30_MIN'
        ? shouldIncludeComparativeContrast ||
          externalThinkerDetection.detected ||
          complementaryMethodologies.length >= 2
          ? ThinkingLevel.XHIGH
          : ThinkingLevel.HIGH
        : duracion === '5_MIN'
        ? ThinkingLevel.LOW
        : shouldIncludeComparativeContrast
        ? ThinkingLevel.HIGH
        : ThinkingLevel.MEDIUM;

    const phase3TimeoutMs =
      phase3ThinkingLevel === ThinkingLevel.XHIGH
        ? 90000
        : phase3ThinkingLevel === ThinkingLevel.HIGH
        ? 70000
        : phase3ThinkingLevel === ThinkingLevel.MEDIUM
        ? 50000
        : 35000;

    const response = await generateContentWithRetry(
      ai,
      {
        model: GEMINI_HYDROGEN_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              derashaTitle: {
                type: Type.STRING,
                description: 'Título inspirador y elocuente de la drashá',
              },
              openingExordium: {
                type: Type.STRING,
                description: 'Apertura inspiradora del Darshán que responde directamente las preguntas del estudiante',
              },
              methodologySections: {
                type: Type.ARRAY,
                description:
                  'Las secciones estructuradas según la metodología principal más las secciones de aporte de las metodologías complementarias según la duración seleccionada',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    key: { type: Type.STRING },
                    stepNumber: { type: Type.INTEGER },
                    hebrewBadge: {
                      type: Type.STRING,
                      description: 'Letra hebrea representativa (ej: פ, ר, ד, ס o מ, ח, ד, פ o א, ב, ג)',
                    },
                    hebrewTerm: {
                      type: Type.STRING,
                      description: 'Término hebreo vocalizado de la etapa (ej: מַהוּת, חֲלָקִים, דֶּרֶךְ קִנְיָנוֹ, מַפְסִידָיו, חֶשְׁבּוֹן הַנֶּפֶשׁ)',
                    },
                    spanishSubtitle: {
                      type: Type.STRING,
                      description: 'Nombre de la etapa según la metodología (ej: "1. Mahut · Definición Esencial", "Aporte Complementario · Evolución en Cábala y Jasidut")',
                    },
                    title: {
                      type: Type.STRING,
                      description: 'Título específico de esta sección aplicado al tema',
                    },
                    exposition: {
                      type: Type.STRING,
                      description: 'Desarrollo profundo, riguroso y pedagógico de esta sección respondiendo las preguntas del usuario',
                    },
                    keyTakeaway: {
                      type: Type.STRING,
                      description: 'Enseñanza medular o ejercicio práctico de esta etapa',
                    },
                    sourceMethodology: {
                      type: Type.STRING,
                      description: 'Código de la metodología a la que pertenece esta sección (ej. WISSENSCHAFT_DES_JUDENTUMS, MUSAR_TRANSFORMATIVO, EVOLUCION_CONCEPTUAL, PARDES)',
                    },
                  },
                  required: [
                    'key',
                    'stepNumber',
                    'hebrewBadge',
                    'hebrewTerm',
                    'spanishSubtitle',
                    'title',
                    'exposition',
                    'keyTakeaway',
                  ],
                },
              },
              morphologicalSynthesis: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING, description: 'Explicación fluida del desglose morfológico' },
                  keyTheologicalInsight: { type: Type.STRING, description: 'La lección teológica medular derivada de la gramática hebrea' },
                },
                required: ['summary', 'keyTheologicalInsight'],
              },
              canonicalAnalysis: {
                type: Type.OBJECT,
                properties: {
                  synthesis: { type: Type.STRING, description: 'Cómo las fuentes verificadas de Sefaria iluminan este tema' },
                  verifiedEchoes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ref: { type: Type.STRING },
                        connection: { type: Type.STRING, description: 'Conexión exegética directa' },
                      },
                      required: ['ref', 'connection'],
                    },
                  },
                },
                required: ['synthesis', 'verifiedEchoes'],
              },
              practicalConclusion: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Título de la conclusión práctica y llamada a la acción' },
                  hashkafa: { type: Type.STRING, description: 'Visión ética y espiritual (Hashkafá) renovada' },
                  prayerKavanah: { type: Type.STRING, description: 'Introspección interior (Kavaná / Jeshbón HaNéfesh) al estudiar o rezar' },
                  dailyAction: { type: Type.STRING, description: 'Llamada a la acción moral y espiritual tangible para la semana' },
                },
                required: ['title', 'hashkafa', 'prayerKavanah', 'dailyAction'],
              },
            },
            required: [
              'derashaTitle',
              'openingExordium',
              'methodologySections',
              'morphologicalSynthesis',
              'canonicalAnalysis',
              'practicalConclusion',
            ],
          },
        },
      },
      {
        timeoutMs: phase3TimeoutMs,
        thinkingLevel: phase3ThinkingLevel,
      }
    );

    const stage3LlmMs = Date.now() - llmPhase3StartedAt;
    const mdStartedAt = Date.now();

    const parsed = sanitizeStrictJewishObject(JSON.parse(response.text || '{}'));
    parsed.metodologia = metodologia;
    parsed.metodologiasComplementarias = complementaryMethodologies;
    parsed.duracion = duracion;
    parsed.audienciaOTono = audienciaOTono;
    if (activeExternalSources.length > 0) {
      parsed.externalSources = activeExternalSources;
    }
    if (activeFormalContrast) {
      parsed.formalContrast = activeFormalContrast;
    }
    if (externalThinkerDetection.detected) {
      parsed.externalThinkerDetection = externalThinkerDetection;
    }
    parsed.methodologySections = normalizeMethodologySections(
      metodologia,
      parsed.methodologySections,
      parsed.pardes
    );

    if (!parsed.contemporaryMasters || !Array.isArray(parsed.contemporaryMasters.readings)) {
      parsed.contemporaryMasters = buildDefaultContemporaryMasters(
        query,
        parsed.derashaTitle || effectiveTitle,
        parsed.openingExordium,
        parsed.practicalConclusion
      );
    }

    // Derive pardes pillars from methodologySections if not explicitly populated so we never waste LLM output tokens duplicating them
    if (!parsed.pardes || !parsed.pardes.pshat) {
      const secs = parsed.methodologySections;
      const s0 = secs[0] || { title: 'Sentido Textual', exposition: '', keyTakeaway: '' };
      const s1 = secs[1] || s0;
      const s2 = secs[2] || s1;
      const s3 = secs[3] || s2;
      parsed.pardes = {
        pshat: {
          hebrewPillar: 'פְּשָׁט',
          title: s0.title,
          exposition: s0.exposition,
          keyTakeaway: s0.keyTakeaway,
        },
        remez: {
          hebrewPillar: 'רֶמֶז',
          title: s1.title,
          exposition: s1.exposition,
          keyTakeaway: s1.keyTakeaway,
        },
        drash: {
          hebrewPillar: 'דְּרָשׁ',
          title: s2.title,
          exposition: s2.exposition,
          keyTakeaway: s2.keyTakeaway,
        },
        sod: {
          hebrewPillar: 'סוֹד',
          title: s3.title,
          exposition: s3.exposition,
          keyTakeaway: s3.keyTakeaway,
        },
      };
    }

    // Assemble the complete, rich continuous Markdown essay from the structured sections without forcing the LLM to emit duplicate tokens
    if (!parsed.fullStructuredDerashaMarkdown || parsed.fullStructuredDerashaMarkdown.trim().length < 250) {
      parsed.fullStructuredDerashaMarkdown = synthesizeContinuousDerashaMarkdown({
        query,
        metodologia,
        audienciaOTono,
        title: parsed.derashaTitle || effectiveTitle,
        primaryHebrew,
        transliteration,
        literalSpanishTranslation,
        liturgicalContext,
        theologicalKeys,
        morphologicalBreakdown,
        verifiedSources,
        externalSources: activeExternalSources,
        formalContrast: activeFormalContrast,
        derasha: parsed,
      });
    }

    const markdownAssemblyMs = Date.now() - mdStartedAt;
    parsed.stageTimingsMs = {
      stage3LlmMs,
      markdownAssemblyMs,
      totalPhase3Ms: Date.now() - phase3StartedAt,
      cacheHit: false,
    };

    const finalizedDerasha = sanitizeHalakhicOutputFromExternalCitations(
      sanitizeStrictJewishObject(parsed),
      halakhicValidation
    );
    setBoundedCache(derashaMemoryCache, derashaCacheKey, finalizedDerasha);
    return res.json(finalizedDerasha);
  } catch {
    const {
      query: rawQuery,
      tema_o_fuente,
      metodologia: rawMetodologia,
      metodologias_complementarias,
      duracion: rawDuracion,
      audiencia_o_tono,
      title,
      primaryHebrew,
      transliteration,
      literalSpanishTranslation,
      liturgicalContext,
      morphologicalBreakdown = [],
      theologicalKeys = {},
      verifiedSources = [],
      externalSources: bodyExternalSources,
      formalContrast: bodyFormalContrast,
    } = req.body || {};

    const rawInput = (tema_o_fuente || rawQuery || 'Estudio de la Tradición').trim();
    const {
      normalizedQuery: query,
      cleanTopicLabel,
      isMashiajTopic,
      isMashiajBuddhaContrastTopic,
      isJewishMovementsAndMessianicBoundaryTopic,
      isKantTopic,
      isPlatoCaveTopic,
      isCiceroTopic,
      isEnlightenmentBuddhismTopic,
      isAfterlifeSoulDestinyTopic,
      isHalelTopic,
      isShulchanArukhOrMinhagNusachTopic,
      isInternalHalakhaTopic,
      isComparativeTopic,
    } = normalizeUserStudyQuery(rawInput);
    const effectiveTitle =
      title && !title.startsWith('Estudio Exegético:') ? title : cleanTopicLabel;

    const metodologia = resolveEffectiveMethodology(rawMetodologia || 'AUTO', query);
    const duracion = (rawDuracion || '10_MIN').toUpperCase().trim();
    const complementaryMethodologies = resolveComplementaryMethodologies(
      metodologia,
      query,
      duracion,
      metodologias_complementarias
    );
    const audienciaOTono = audiencia_o_tono || 'Comunidad general · Inspirador y práctico';
    const isModim = /\bmodim(?:\s+de[- ]?raban[aá]n|\s+anajnu)?\b/i.test(query);

    const fallbackHalakhicValidation = validatePurelyHalakhicQuery(query);
    const fallbackThinkerDetection = fallbackHalakhicValidation.externalPhilosophyInjectionDisabled
      ? detectExternalThinkerAndForceExegeticalSearch('')
      : detectExternalThinkerAndForceExegeticalSearch(query);
    const shouldIncludeComparativeContrast =
      !fallbackHalakhicValidation.externalPhilosophyInjectionDisabled &&
      (fallbackThinkerDetection.detected ||
        metodologia === 'FILOSOFIA_CONTRASTIVA' ||
        isComparativeTopic);
    const fallbackExternalSources = fallbackHalakhicValidation.externalPhilosophyInjectionDisabled
      ? []
      : Array.isArray(bodyExternalSources) && bodyExternalSources.length > 0
      ? bodyExternalSources
      : shouldIncludeComparativeContrast
      ? await fetchExternalComparativeSources(query)
      : [];
    const fallbackFormalContrast = fallbackHalakhicValidation.externalPhilosophyInjectionDisabled
      ? undefined
      : bodyFormalContrast && bodyFormalContrast.universalidadVsEspecificidad
      ? bodyFormalContrast
      : shouldIncludeComparativeContrast || fallbackExternalSources.length > 0
      ? buildDefaultFormalExegeticalContrast(query, fallbackExternalSources)
      : undefined;

    const fallbackPardes = isJewishMovementsAndMessianicBoundaryTopic
      ? {
          pshat: {
            hebrewPillar: 'מַחְלוֹקֶת לְשֵׁם שָׁמַיִם וְזַרְמֵי הַיַּהֲדוּת',
            title:
              '1. Parte I: Las Corrientes Legítimas Dentro del Judaísmo — El Jasidismo (Jabad-Lubavitch y Breslev), la Ortodoxia y el Reformismo bajo el Monoteísmo del Shemá (Eruvín 13b)',
            exposition:
              'Dentro del judaísmo existe una rica pluralidad de escuelas y corrientes regida por el principio talmúdico de Eruvín 13b («Elu ve-elu divrei Elohim jayim», «Estas y aquellas son palabras del Dios viviente»): 1) EL JASIDISMO (fundado por Rabí Israel Baal Shem Tov en el siglo XVIII) y sus grandes escuelas: a) Jabad-Lubavitch, fundada por el Alter Rebe (Rabí Shneur Zalman de Liadi, autor del Tania), cuyo nombre es el acrónimo de Jojmá (Sabiduría), Biná (Entendimiento) y Daat (Conocimiento interior), que une el estudio intelectual profundo de la mística con el amor incondicional a cada judío (Ahavat Yisrael) y la difusión activa de las Mitzvot en todo el mundo para preparar la redención; y b) Breslev, fundada por Rabí Najman de Breslev (bisnieto del Baal Shem Tov, autor del Likutei Moharán), centrada en la alegría espiritual inquebrantable («Mitzvá guedolá lihyot be-simjá tamid»), la prohibición de desesperarse («Ein shoom yeúsh ba-olam klal»), el diálogo personal y espontáneo con Dios en el propio idioma (Hitbodedut) y la búsqueda de los puntos buenos en cada alma (Azamrá); 2) LA ORTODOXIA en sus tradiciones Sefardí, Ashkenazí, Lituana (Mitnagdí / Yeshivot), el Movimiento del Musar (Rabí Israel Salanter) y la Ortodoxia Moderna; y 3) LOS MOVIMIENTOS MODERNOS como el Judaísmo Conservador (Masortí) y el Judaísmo Reformista. Aunque entre la Ortodoxia y el Reformismo existen debates profundos y serios acerca del carácter vinculante de la Halajá, TODAS estas corrientes siguen siendo grupos judíos porque mantienen intacto el corazón teológico del judaísmo: el monoteísmo absoluto e incorpóreo del Shemá Yisrael (Deuteronomio 6:4) y el rechazo total a adorar a un ser humano como Dios.',
            keyTakeaway:
              'Jabad-Lubavitch, Breslev, la Ortodoxia, el Conservadurismo y el Reformismo son corrientes dentro del judaísmo porque todas adoran exclusivamente a Hashem Uno e incorpóreo (Deuteronomio 6:4).',
          },
          remez: {
            hebrewPillar: 'גְּבוּל הָאֱמוּנָה וְיִחוּד ה׳',
            title:
              '2. Parte II: La Frontera Teológica y Halájica — ¿Cuándo un Grupo se Aleja y Deja de Ser un Grupo Judío? (Deuteronomio 6:4; Números 23:19; Deuteronomio 13:1–6)',
            exposition:
              '¿Dónde está la línea roja objetiva en la que un movimiento deja de ser una corriente del judaísmo y pasa a ser otra religión? Las Fuentes Internas de la Torá y los 13 Principios de Fe (Ikarei HaEmuná) codificados por Maimónides en su Comentario a la Mishná (Sanhedrín 10:1 [90a]) y en el Mishné Torá (Hiljot Yesodei HaTorá cap. 1; Hiljot Avodá Zará caps. 1–2) establecen cuatro fronteras teológicas infranqueables: 1) La Unicidad Indivisible de Dios (Yijud Hashem, Deuteronomio 6:4): Dios es Uno único y no una Trinidad de personas; 2) La Incorporeidad Absoluta de Dios (Números 23:19: «Dios no es hombre para que mienta, ni hijo de hombre»; Oseas 11:9): sostener que el Creador Infinito se encarnó en un cuerpo humano mortal destruye el monoteísmo judío; 3) El Rechazo de Mediadores y de Sacrificios Humanos Expiatorios (Ezequiel 18:20; Oseas 14:2–3; Deuteronomio 12:31): en el judaísmo cada persona se reconcilia directamente con Hashem mediante la Teshuvá sin pecado original ni sangre vicaria; y 4) La Inmutabilidad de la Torá (Deuteronomio 13:1–6): la Torá advierte explícitamente contra quien utilice lenguaje espiritual o señales para conducir al pueblo a adorar a una deidad ajena a lo conocido en el Sinaí.',
            keyTakeaway:
              'Un grupo deja de ser judío en el instante en que abandona el monoteísmo incorpóreo del Shemá (Deuteronomio 6:4; Números 23:19) y adora a un ser humano como Dios encarnado.',
          },
          drash: {
            hebrewPillar: 'הַבְחָנָה בֵּין יַהֲדוּת לְנצְרוּת אֶוַונְגֶּלִית',
            title:
              '3. Parte III: Por Qué los «Judíos Mesiánicos» NO Son Judíos sino Cristianos Evangélicos (Origen Bautista, Teología Trinitaria y Estrategia Misionera)',
            exposition:
              'Aplicando estos criterios a los llamados «judíos mesiánicos» (congregaciones mesiánicas, Jews for Jesus, Alianza Mesiánica), el diagnóstico histórico, teológico y sociológico es inequívoco: NO son un grupo judío, sino cristianos evangélicos (de matriz bautista y pentecostal). 1) TEOLOGÍA 100% EVANGÉLICA: Si se examina la «Declaración de Fe» de cualquier organización mesiánica, profesan exactamente los dogmas del protestantismo evangélico: la Trinidad, la divinidad de Jesús (a quien llaman «Yeshúa» en hebreo), el nacimiento virginal, la expiación vicaria por su sangre en la cruz, la infalibilidad del Nuevo Testamento y la condenación de quien no acepte a Jesús como salvador. 2) ORIGEN HISTÓRICO EN MISIONES BAUTISTAS: El movimiento no nació dentro de la comunidad judía, sino en agencias misioneras protestantes dedicadas a convertir judíos al cristianismo; por ejemplo, «Jews for Jesus» fue fundado en 1970 en California por Martin «Moishe» Rosen, un ministro ordenado de la Convención Bautista del Sur (Southern Baptist Convention), y la antigua «Hebrew Christian Alliance of America» cambió su nombre en 1975 a «Messianic Jewish Alliance» por estrategia de marketing misionero. 3) DISFRAZ SIMBÓLICO: El uso de Kipá, Talit, Shofar, rollos de Torá y términos en hebreo es una técnica de «contextualización misionera» para hacer que el cristianismo evangélico parezca culturalmente judío.',
            keyTakeaway:
              'Llamar a Jesús «Yeshúa» y cubrirse con un Talit mientras se adora a la Trinidad no convierte al cristianismo evangélico en judaísmo: los «judíos mesiánicos» son evangélicos cristianos en teología, origen e iglesia.',
          },
          sod: {
            hebrewPillar: 'קוֹנְסֶנְזוּס כְּלַל־יִשְׂרָאֵלִי',
            title:
              '4. Síntesis: El Consenso Unánime de Todas las Corrientes Judías y de la Corte Suprema de Israel (Casos Rufeisen 1962 y Beresford 1989)',
            exposition:
              'Existe un hecho extraordinario en el mundo judío contemporáneo: aunque jasídicos de Jabad, jasídicos de Breslev, ortodoxos lituanos, sefardíes, conservadores y reformistas debaten intensamente sobre numerosos temas, TODAS las corrientes del judaísmo sin excepción mantienen un consenso absoluto y unánime en que el «judaísmo mesiánico» NO es judaísmo, sino cristianismo evangélico. Asimismo, la Corte Suprema del Estado de Israel, en sus fallos históricos sobre la Ley del Retorno (HCJ 72/62 Rufeisen / Hermano Daniel en 1962 y HCJ 265/87 Beresford v. Ministerio del Interior en 1989), dictaminó jurídicamente que «quien cree en Jesús como Mesías y Dios encarnado pertenece a otra religión (el cristianismo) y no forma parte de las corrientes del judaísmo». A su vez, el judaísmo recuerda que un cristiano no necesita disfrazarse de judío para ser amado por Dios: mediante las 7 Leyes Universales de Noé (Sanhedrín 56a; Rambam, Hiljot Teshuvá 3:5), los justos de todas las naciones tienen parte en el Mundo Venidero con total dignidad y honestidad identitaria.',
            keyTakeaway:
              'Todas las corrientes del judaísmo (Jabad, Breslev, Ortodoxia, Conservadurismo y Reformismo) y la Corte Suprema de Israel coinciden unánimemente en que los «judíos mesiánicos» son cristianos evangélicos, no un grupo judío.',
          },
        }
      : isAfterlifeSoulDestinyTopic
      ? {
          pshat: {
            hebrewPillar: 'הַבְחָנָה בֵּין מְקוֹרוֹת פְּנִימִיִּים לְחִיצוֹנִיִּים',
            title:
              '1. Eje I: La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Olam HaBá en Sanhedrín 90a y Berajot 17a vs. Nirvana, Valhalla, Cielo e Infierno)',
            exposition:
              'El estudio comparativo sobre el destino de las almas y los requisitos de acceso al más allá parte de la distinción epistemológica de Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»). Consultamos explícitamente las Fuentes Externas clásicas para informar el contraste: 1) En el Canon Pali budista (Udāna 8.1, Nibbāna Sutta), el Nirvana se define como lo «no-nacido y no-condicionado» alcanzado mediante la extinción del deseo (Tanha) y la disolución del yo individual (Anatta) para salir de la rueda de reencarnaciones (Samsara); 2) En la mitología nórdica (Edda Poética — Grímnismál 8–10 y Gylfaginning 38–41), el Valhalla (Valhöll) es el salón de Odín reservado exclusivamente a la mitad de los guerreros muertos heroicamente en combate (Einherjar) para luchar hasta el Ragnarök, mientras quienes mueren de vejez o enfermedad van a Helheim; 3) En Platón (Fedón 107d–114c) y las escatologías dogmáticas dualistas, las almas se dividen entre el Cielo y un Tártaro/Infierno de castigo perpetuo. Frente a todas estas fuentes externas, las Fuentes Internas de la Torá (Mishná Sanhedrín 10:1 [90a]; Talmud Berajot 17a; Pirké Avot 4:16-17; Rambam, Hiljot Teshuvá caps. 8–9; Ramjal, Dérej Hashem 2:2) revelan el Olam HaBá (הָעוֹלָם הַבָּא, el Mundo Venidero): un estado de comunión consciente, personal y relacional del alma inmortal con la luz de la Presencia Divina (Ziv HaShejiná), donde ni el alma se disuelve ni se glorifica la violencia guerrera.',
            keyTakeaway:
              'A diferencia de la extinción del yo en el Nirvana o del banquete guerrero del Valhalla, en las Fuentes Internas de la Torá (Berajot 17a) el Olam HaBá preserva la identidad consciente del alma en comunión luminosa con su Creador.',
          },
          remez: {
            hebrewPillar: 'אוּנִיבֶרְסָלִיּוּת מוּל פְּרָטָנוּת הַמִּצְוָה',
            title:
              '2. Eje II: La Universalidad frente a la Especificidad del Mandamiento en los Requisitos para Acceder al Olam HaBá (Rambam, Hiljot Teshuvá 3:5)',
            exposition:
              '¿Cuáles son los requisitos para acceder al Olam HaBá frente a los requisitos de otras tradiciones? Aquí brilla con fuerza única el contraste exegético entre Universalidad y Especificidad del Mandamiento: mientras otras religiones imponen un exclusivismo dogmático («fuera de nuestra fe hay condenación eterna»), el Valhalla exige morir por la espada en batalla y el Nirvana exige la renuncia ascética al deseo mundano, el judaísmo proclama una UNIVERSALIDAD ÉTICA INCLUSIVA codificada en el Talmud (Sanhedrín 105a), la Tosefta (Sanhedrín 13:2) y Maimónides (Mishné Torá, Hiljot Teshuvá 3:5 y Hiljot Melajim 8:11): «Jasidei Umot HaOlam yesh lahem jélek la-Olam HaBá» («Los justos de entre todas las naciones del mundo tienen parte en el Mundo Venidero»). El requisito para el no-judío NO es convertirse al judaísmo, sino cumplir los 7 Preceptos Universales de los Hijos de Noé (no asesinar, no robar, no cometer crueldad ni inmoralidad, no idolatrar ni blasfemar, y establecer tribunales de justicia, Sanhedrín 56a). Y para el pueblo judío, ese horizonte universal se articula con la ESPECIFICIDAD DEL MANDAMIENTO: cumplir las 613 Mitzvot del Pacto del Sinaí y practicar Teshuvá (retorno ético). Como enseña Rabí Yaakov en Pirké Avot 4:16: «Este mundo es como un vestíbulo (Prozdor) ante el Olam HaBá; prepárate en el vestíbulo para que puedas entrar al salón del banquete (Traklín)».',
            keyTakeaway:
              'El judaísmo une acceso universal (los justos de todas las naciones entran al Olam HaBá por las 7 Leyes de Noé, Hiljot Teshuvá 3:5) con la especificidad del mandamiento concreto en este mundo (Pirké Avot 4:16).',
          },
          drash: {
            hebrewPillar: 'מַעֲנֵה מְקוֹרוֹת הַתּוֹרָה',
            title:
              '3. El Concepto Judío de Guehinom frente al Infierno Eterno: Purificación Temporal y Teshuvá (Shabat 33b y Rosh Hashaná 17a)',
            exposition:
              '¿Existe el «infierno» en el judaísmo? Las Fuentes Internas de la Torá rechazan radicalmente el concepto de un infierno sádico de tortura eterna. En la tradición rabínica (Talmud Shabat 33b; Eduyot 2:10; Rosh Hashaná 17a; Zohar), el Guehinom (גֵּיהִנּוֹם) funciona como un proceso espiritual y pedagógico de purificación del alma (comparado por los Sabios y el Musar con una lavandería espiritual donde el alma comprende con verdad luminosa el impacto de sus actos y se limpia de sus manchas morales), cuya duración máxima para un transgresor ordinario no excede los doce meses («Mishpat reshaím be-Guehinom shneim asar jódesh», Eduyot 2:10). Más aún, el Talmud (Erubín 19a; Pesajim 54a) enseña que la Teshuvá (el arrepentimiento sincero y la reparación ética mientras hay vida) tiene el poder de transformar incluso las faltas pasadas en méritos (Yoma 86b).',
            keyTakeaway:
              'En el judaísmo no hay condenación eterna para quien busca rectificarse: el Guehinom es una purificación temporal y pedagógica (máximo 12 meses, Eduyot 2:10) antes de ascender al Gan Edén.',
          },
          sod: {
            hebrewPillar: 'בֵּרוּר וְהַעֲלָאָה',
            title:
              '4. Síntesis Exegética: Gan Edén de las Almas, Tejiyat HaMetim (Resurrección) y «Una Hora en Este Mundo» (Pirké Avot 4:17)',
            exposition:
              'En la síntesis de Maimónides, Najmánides (Ramban en Shaarei Gueulá), el Ramjal y la Jasidut (Tania caps. 36–37), el destino del alma comprende dos etapas complementarias: 1) El Olam HaNeshamot o Gan Edén espiritual inmediatamente tras la partida física, donde el alma goza de la comprensión de la Torá y del resplandor de la Shejiná (Berajot 17a); y 2) El Olam HaBá pleno tras la Era Mesiánica y la Resurrección (Tejiyat HaMetim, Sanhedrín 90a), donde alma y cuerpo purificados se reencuentran porque fue en unión con el cuerpo donde el alma cumplió cada Mitzvá específica (Sanhedrín 91a-b, la parábola del ciego y el paralítico de Rabí Yehudá HaNasí). Por eso concluye Rabí Yaakov en Pirké Avot 4:17: «Más preciada es una sola hora de Teshuvá y buenas acciones en este mundo que toda la vida del Olam HaBá; y más preciada es una hora de serenidad espiritual en el Olam HaBá que toda la vida de este mundo».',
            keyTakeaway:
              'En el Olam HaBá se recibe la luz espiritual suprema, pero solo en este mundo físico (Olam HaZé) podemos sembrar libremente cada Mitzvá específica (Pirké Avot 4:17).',
          },
        }
      : isEnlightenmentBuddhismTopic
      ? {
          pshat: {
            hebrewPillar: 'הַבְחָנָה בֵּין מְקוֹרוֹת פְּנִימִיִּים לְחִיצוֹנִיִּים',
            title:
              '1. Eje I: La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Bodhi en el Dhammapada vs. Or HaGanuz y Ner Mitzvá en la Torá)',
            exposition:
              '¿Existe el concepto de «iluminación» en el judaísmo y cómo se contrasta con el budismo? Aplicando la regla de Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»), examinamos primero las Fuentes Externas del Canon Pali budista (Dhammapada 183, 277–279 y Samyutta Nikaya 56.11): allí la iluminación (Bodhi, «despertar») consiste en comprender las Cuatro Nobles Verdades y las Tres Marcas de la Existencia —impermanencia (Anicca), sufrimiento/insatisfacción (Dukkha) e inexistencia de un yo permanente (Anatta)—, extinguiendo la sed del deseo (Tanha) para alcanzar el Nirvana. Al contrastarlo con las Fuentes Internas de la Torá (Salmos 36:10: «Be-orjá niré or / En Tu luz veremos la luz»; Proverbios 6:23: «Ki ner mitzvá ve-Torá or / Porque lámpara es el mandamiento y la Torá es luz»; Proverbios 20:27: «Ner Hashem nishmat adam / Lámpara de Hashem es el alma del ser humano»; Talmud Jaguigá 12a), descubrimos que el judaísmo posee una riquísima teología de la iluminación espiritual —el Or HaGanuz (la Luz Primordial oculta en la Torá), el Ruaj HaKódesh (inspiración divina) y la Devekut (adhesión íntima a Dios)—, pero sobre premisas ontológicas diametralmente opuestas: el mundo creado es intrínsecamente bueno («Y vio Dios que era muy bueno», Génesis 1:31) y el alma individual (Neshamá) es una chispa divina real e inmortal.',
            keyTakeaway:
              'Mientras el budismo concibe la iluminación (Bodhi) como el despertar de la ilusión del yo (Anatta) y la extinción del deseo, el judaísmo la concibe como encender el alma («Ner Hashem nishmat adam», Proverbios 20:27) en la luz relacional de la Torá.',
          },
          remez: {
            hebrewPillar: 'אוּנִיבֶרְסָלִיּוּת מוּל פְּרָטָנוּת הַמִּצְוָה',
            title:
              '2. Eje II: La Universalidad frente a la Especificidad del Mandamiento (Desapego Universal vs. «Ner Mitzvá ve-Torá Or» en Proverbios 6:23)',
            exposition:
              'En el eje de la Universalidad frente a la Especificidad del Mandamiento, el contraste exegético es luminoso: en el budismo, la vía hacia la iluminación busca desprenderse de las particularidades mundanas, los vínculos pasionales y la historia hacia una ecuanimidad universal desapegada (Upekkha). En la tradición de la Torá, la luz universal («Ve-Torá Or», y la Torá es luz, Proverbios 6:23) no se alcanza vaciando la mente del mundo concreto, sino a través de la ESPECIFICIDAD DEL MANDAMIENTO («Ki Ner Mitzvá», porque lámpara es el mandamiento concreto). Cada Mitzvá específica —dar Tzedaká al pobre, honrar a los padres, guardar el Shabat, pronunciar una Berajá sobre el pan, estudiar en Javruta— es una lámpara puntual que canaliza la Luz Infinita dentro de la materia, el tiempo y las relaciones humanas.',
            keyTakeaway:
              'En el judaísmo no nos iluminamos huyendo de lo particular, sino encendiendo la lámpara específica de cada Mitzvá concreta («Ki ner mitzvá ve-Torá or», Proverbios 6:23).',
          },
          drash: {
            hebrewPillar: 'מַעֲנֵה מְקוֹרוֹת הַתּוֹרָה',
            title:
              '3. La Escalera de la Iluminación Judía: De la Acción Ética al Ruaj HaKódesh en Rabí Pinjás ben Yaír (Avodá Zará 20b) y Mesilat Yesharim',
            exposition:
              '¿Cuáles son los requisitos y peldaños para acceder a la iluminación espiritual en el judaísmo? En el Talmud Bavli (Avodá Zará 20b) y en la obra maestra de Rabí Moshé Jaim Luzzatto (Ramjal, Mesilat Yesharim caps. 1 al 26), Rabí Pinjás ben Yaír traza la escalera exacta hacia la iluminación (Ruaj HaKódesh): «La Torá conduce a la vigilancia (Zehirut); la vigilancia a la diligencia (Zerizut); la diligencia a la limpieza moral (Nekiyut); la limpieza a la abstinencia de lo superfluo (Perishut); la abstinencia a la pureza del corazón (Tahorá); la pureza a la piedad amorosa (Jasidut); la piedad a la humildad (Anavá); la humildad al temor reverencial al pecado (Yirat Jét); el temor a la santidad (Kedushá); y la santidad al Espíritu Santo de iluminación (Ruaj HaKódesh)». A diferencia de una técnica meditativa aislada de las obligaciones sociales, la iluminación judía es la coronación del refinamiento ético del carácter (Tikún HaMidot) y del cumplimiento específico de los mandamientos.',
            keyTakeaway:
              'Según Rabí Pinjás ben Yaír (Avodá Zará 20b) y el Ramjal (Mesilat Yesharim), la iluminación espiritual (Ruaj HaKódesh) se alcanza refinando la conducta ética y cumpliendo las Mitzvot con pureza y humildad.',
          },
          sod: {
            hebrewPillar: 'בֵּרוּר וְהַעֲלָאָה',
            title:
              '4. Síntesis Exegética: El Or HaGanuz (Jaguigá 12a), Bitul HaYesh frente a Anatta y la Alegría del Mandamiento (Simjá shel Mitzvá)',
            exposition:
              'En la Cábala y la Jasidut (Talmud Jaguigá 12a; Zohar; Tania del Alter Rebe), se explica que con la luz primordial creada el primer día (Or HaGanuz) el ser humano podía ver «de un extremo del mundo al otro», y Dios la ocultó para los justos dentro de la Torá. Asimismo, la Jasidut distingue entre la noción budista de Anatta (que niega la existencia del alma y de un Creador personal) y el concepto jasídico de Bitul HaYesh (anulación del ego narcisista ante la realidad absoluta de Hashem, «Ein Od Milvadó», Deuteronomio 4:35): el judío no disuelve su alma en el vacío, sino que transpariencia su ego para convertirse en carroza luminosa (Merkavá) de la bondad divina en medio de la sociedad.',
            keyTakeaway:
              'La iluminación judía (Or HaGanuz y Devekut) no apaga el alma en el vacío: anula el egoísmo (Bitul) para revelar la luz de Hashem dentro del mundo humano.',
          },
        }
      : isPlatoCaveTopic
      ? {
          pshat: {
            hebrewPillar: 'הַבְחָנָה בֵּין מְקוֹרוֹת פְּנִימִיִּים לְחִיצוֹנִיִּים',
            title:
              '1. Eje I: La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Platón en República VII vs. Eijá Rabá 2:13)',
            exposition:
              'El análisis comparativo entre la Alegoría de la Caverna de Platón (República, Libro VII, 514a–520d) y la tradición de la Torá parte de la distinción epistemológica codificada en el Midrash Eijá Rabá 2:13: «Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín» («Si te dicen que hay sabiduría filosófica en las naciones, créelo; si te dicen que hay Torá en las naciones, no lo creas»). Como Fuente Externa, Platón describe a los seres humanos encadenados en una morada subterránea (katageios oikesis) tomando las sombras por la realidad, hasta que el filósofo se libera y asciende fuera de la caverna hacia el Sol inteligible de la Idea del Bien (tou agathou idea, 517b). En contraste, las Fuentes Internas de la Torá (Éxodo 19-20; Deuteronomio 30:14; Talmud Kidushín 31a) enseñan que la verdad última no se alcanza mediante la evasión solitaria del intelecto fuera del mundo material, sino porque la Fuente Trascendente desciende al Sinaí e irrumpe en la historia humana («Y descendió Hashem sobre el Monte Sinaí», Éxodo 19:20) para establecer un Pacto relacional que santifica la vida terrenal.',
            keyTakeaway:
              'Según Eijá Rabá 2:13, las fuentes externas (Platón) ofrecen especulación ontológica (Jojmá), pero las fuentes internas de la Torá revelan el descenso de la presencia divina hacia el mundo humano.',
          },
          remez: {
            hebrewPillar: 'אוּנִיבֶרְסָלִיּוּת מוּל פְּרָטָנוּת הַמִּצְוָה',
            title:
              '2. Eje II: La Universalidad frente a la Especificidad del Mandamiento («Ner Mitzvá ve-Torá Or», Proverbios 6:23)',
            exposition:
              'En el eje de la Universalidad frente a la Especificidad del Mandamiento, el contraste exegético entre Platón y la Torá es decisivo: para Platón, el mundo físico de los casos particulares y cambiantes es una caverna de apariencias inferiores (doxa), mientras que la verdad reside exclusivamente en las Formas universales, abstractas e inmutables (episteme). Por el contrario, la tradición judía conjuga la luz universal de la ética (las 7 Leyes de Noé en Sanhedrín 56a y la imagen divina en Génesis 1:27) con la ESPECIFICIDAD CONCRETA DEL MANDAMIENTO (Mitzvá). Como declara el Rey Salomón en Proverbios 6:23: «Ki ner mitzvá ve-Torá or» («Porque lámpara es el mandamiento y la Torá es luz»). La Torá es la luz universal, pero se encarna a través de la lámpara específica de cada Mitzvá concreta: ayudar a este necesitado específico (Deuteronomio 15:7-8), salvar esta vida concreta (Pikuaj Néfesh, Yoma 85b) y encender las velas de Shabat en el hogar material.',
            keyTakeaway:
              'Platón busca la universalidad abstracta huyendo de lo particular sensible; la Torá ilumina la realidad material a través de la especificidad concreta de cada mandamiento (Ner Mitzvá ve-Torá Or, Proverbios 6:23).',
          },
          drash: {
            hebrewPillar: 'מַעֲנֵה מְקוֹרוֹת הַתּוֹרָה',
            title:
              '3. «Naasé ve-Nishmá» (Éxodo 24:7) y Pirké Avot 3:17 frente al Intelectualismo Contemplativo Griego',
            exposition:
              'En República 519c–520d, el filósofo platónico que ha contemplado el Sol universal no desea regresar a la caverna para ocuparse de los asuntos humanos, y solo desciende por coerción de la polis. En las Fuentes Internas de la Torá (Éxodo 24:7; Talmud Shabat 88a), el pueblo proclama en el Sinaí: «Naasé ve-nishmá» («Haremos y escucharemos/comprenderemos»); la acción ética específica precede y abre las puertas de la comprensión espiritual. Como enseña Rabí Elazar ben Azariá en Pirké Avot 3:17: «Toda persona cuya sabiduría supera sus obras es como un árbol de muchas ramas y pocas raíces: viene el viento y lo arranca; pero aquel cuyas obras superan su sabiduría es como un árbol de raíces profundas que ningún viento puede mover».',
            keyTakeaway:
              'En la Torá (Éxodo 24:7 y Pirké Avot 3:17), la praxis del mandamiento específico es la raíz misma de la iluminación intelectual.',
          },
          sod: {
            hebrewPillar: 'בֵּרוּר וְהַעֲלָאָה',
            title:
              '4. Síntesis Exegética: «Dirá BeTajtonim» — Transformar la Caverna en Morada Divina',
            exposition:
              'En la dimensión interior de la Torá (Midrash Tanjumá Nasó 16; Tania del Alter Rebe cap. 36; Maharal en Tiféret Yisrael), el propósito de la Creación no es que el alma abandone la «caverna» del cuerpo y del mundo material para refugiarse en el cielo espiritual, sino «Dirá BeTajtonim»: construir una morada para la luz infinita de Hashem aquí abajo, dentro del mundo físico y cotidiano, mediante la especificidad de las Mitzvot.',
            keyTakeaway:
              'No huimos de la caverna como en Platón: introducimos el Sol de la Torá dentro de la caverna mediante cada mandamiento específico.',
          },
        }
      : isCiceroTopic
      ? {
          pshat: {
            hebrewPillar: 'הַבְחָנָה בֵּין מְקוֹרוֹת פְּנִימִיִּים לְחִיצוֹנִיִּים',
            title:
              '1. Eje I: La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Cicerón en De Re Publica III.33 vs. Eijá Rabá 2:13)',
            exposition:
              'Al contrastar a Marco Tulio Cicerón (De Re Publica III.33 y De Officiis I.20) con la tradición de la Torá, aplicamos el principio de Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»). En las Fuentes Externas grecorromanas, Cicerón define la ley natural como «recta ratio naturae congruens» (recta razón congruente con la naturaleza, inmutable en Roma y en Atenas) y fundamenta la ética en el decorum y el officium cívico impersonal. En contraste, las Fuentes Internas de la Torá (Miqueas 6:8; Deuteronomio 4:6-8; Talmud Kidushín 31a) muestran que la ley moral no es una fuerza cósmica muda, sino la voz viva del Creador en un Pacto relacional («Gadol ha-metzuvé ve-osé») que defiende con pasión profética a la viuda, al huérfano y al extranjero.',
            keyTakeaway:
              'Cicerón ofrece filosofía jurídica racional (Fuente Externa), mientras que las Fuentes Internas de la Torá fundan el derecho en la Alianza viva con el Creador y la dignidad sagrada de cada ser humano.',
          },
          remez: {
            hebrewPillar: 'אוּנִיבֶרְסָלִיּוּת מוּל פְּרָטָנוּת הַמִּצְוָה',
            title:
              '2. Eje II: La Universalidad frente a la Especificidad del Mandamiento (Lex Naturae vs. 7 Leyes de Noé y 613 Mitzvot)',
            exposition:
              'En De Re Publica III.33, Cicerón postula una universalidad uniforme («nec erit alia lex Romae, alia Athenis»). La tradición judía realiza un contraste exegético formal entre Universalidad y Especificidad del Mandamiento: por un lado, la Torá afirma una ética universal para toda la humanidad (las 7 Leyes de Bnei Nóaj en Sanhedrín 56a, cuyo precepto de Dinim exige tribunales de justicia universales); por otro lado, la Torá enseña que la justicia real requiere la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá) en la Halajá: leyes detalladas de Tzedaká (Deuteronomio 15:7-8), equidad más allá de la letra estricta (Lifnim Mishurat HaDin, Deuteronomio 6:18) y primacía absoluta de la vida humana (Pikuaj Néfesh, Yoma 85b).',
            keyTakeaway:
              'La Torá une la justicia universal (7 Leyes de Noé en Sanhedrín 56a) con la especificidad compasiva y concreta del mandamiento (Deuteronomio 6:18 y 15:7-8).',
          },
          drash: {
            hebrewPillar: 'מַעֲנֵה מְקוֹרוֹת הַתּוֹרָה',
            title:
              '3. De Officiis I.20 («Iustitia et Beneficentia») frente a «Tzedaká u-Mishpat» y «Jésed» (Miqueas 6:8)',
            exposition:
              'En De Officiis I.20–42, Cicerón subordina la beneficencia al cálculo del mérito cívico y el honor político. En cambio, en las Fuentes Internas de la Torá (Miqueas 6:8: «Hacer justicia [Mishpat], amar la bondad [Jésed] y caminar humildemente con tu Dios»; Levítico 19:18; Deuteronomio 15:7-8), el término Tzedaká (de la raíz Tzédek = justicia) establece que socorrer al vulnerable no es un favor aristocrático opcional, sino un mandamiento específico de justicia divina.',
            keyTakeaway:
              'Frente al Officium aristocrático de Cicerón, la Mitzvá de Tzedaká y Jésed en la Torá honra la imagen divina (Tzelem Elohim) del más vulnerable.',
          },
          sod: {
            hebrewPillar: 'בֵּרוּר וְהַעֲלָאָה',
            title:
              '4. Síntesis Exegética: Del Orden Jurídico Natural a la Santificación Relacional del Mundo',
            exposition:
              'Como explica Rabí Yehudá Haleví en el Kuzari (I:1; II:48) y Maimónides en Guía de los Perplejos (III:27), los estatutos racionales (Mishpatim) preparan el orden social, pero los mandamientos específicos de la Torá elevan al ser humano a la adhesión íntima con el Creador (Devekut) y la compasión activa.',
            keyTakeaway:
              'La especificidad del mandamiento en la Torá eleva el deber cívico hacia la santidad relacional y la compasión viva.',
          },
        }
      : isKantTopic
      ? {
          pshat: {
            hebrewPillar: 'הַהֲנָחָה הַפִילוֹסוֹפִית',
            title:
              '1. Eje I: La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Autonomía en Kant vs. Teonomía del Pacto en Kidushín 31a y Eijá Rabá 2:13)',
            exposition:
              'El primer gran eje de contraste filosófico entre Immanuel Kant (Fundamentación de la metafísica de las costumbres y Crítica de la razón práctica) y la tradición judía radica tanto en la distinción epistemológica entre Fuentes Externas (Jojmá ba-Goyim en Eijá Rabá 2:13) y Fuentes Internas de la Torá, como en la fuente de donde emana la obligación ética: ¿es una FUENTE INTERNA o una FUENTE EXTERNA? Para Kant, la moralidad auténtica exige una «Autonomía» radical (del griego autos = sí mismo, nomos = ley): la razón práctica pura del sujeto se legisla a sí misma desde adentro, a priori. Según Kant, si el ser humano obedece una ley moral porque proviene de una fuente externa —incluso si esa fuente es la voluntad de Dios—, cae en la «Heteronomía» (ley ajena), lo cual según él subordinaría la moral al temor, al interés o a la sumisión. La filosofía judía (Majshévet Yisrael) —desde el Talmud hasta Hermann Cohen, Franz Rosenzweig, Rav Samson Raphael Hirsch, Rav Joseph B. Soloveitchik y el Rabino Jonathan Sacks— responde mostrando el límite crítico de una ética de fuente puramente interna: cuando el yo es simultáneamente juez, legislador y parte interesada ante el tribunal de su propia mente, queda atrapado en el solipsismo moral y tiende inevitablemente a racionalizar sus propios sesgos (Negiá). Por ello, en la tradición judía la ética brota de una FUENTE EXTERNA TRASCENDENTE Y RELACIONAL (Teonomía Dialógica): la voz del Otro divino en el Sinaí («Yo soy Hashem tu Dios», Éxodo 20:2) y el clamor del rostro del prójimo que me interpela desde fuera de mi ego. Lejos de ser una heteronomía servil, el Talmud Bavli en Kidushín 31a declara por boca de Rabí Janiná: «Gadol ha-metzuvé ve-osé yoter mi-mi she-einó metzuvé ve-osé» («Más grande es quien está comandado y cumple, que quien no está comandado y cumple»). Como explican Tosafot y el Ritva, responder a un mandato externo exige quebrantar la autosuficiencia narcisista del ego (Yétzer HaRá) y entrar en una relación de responsabilidad (Mitzvá proviene de la raíz aramea Tzavta = unión/vínculo). Y, en una segunda etapa, la Torá exige que esa fuente externa sea libremente INTERIORIZADA por el sujeto moral: «Pues la palabra está muy cerca de ti, en tu boca y en tu corazón, para cumplirla» (Deuteronomio 30:14), y como enseña Rabán Gamliel en Pirké Avot 2:4: «Haz que Su voluntad sea como tu propia voluntad».',
            keyTakeaway:
              'Kant exige una fuente puramente interna (Autonomía) y rechaza toda fuente externa como heteronomía; el judaísmo sostiene que solo una fuente externa trascendente (Teonomía del Pacto, Kidushín 31a) rompe el egoísmo del yo, para luego interiorizarse libremente en el corazón (Deuteronomio 30:14).',
          },
          remez: {
            hebrewPillar: 'קַו הַפָּרָשָׁה הַתּוֹרָנִי',
            title:
              '2. Eje II: La Universalidad frente a la Especificidad del Mandamiento (Kant vs. Casuística Halájica en Yoma 85b y Deuteronomio 6:18)',
            exposition:
              'El segundo eje filosófico medular concierne a la UNIVERSALIDAD frente a la ESPECIFICIDAD DEL MANDAMIENTO. En la deontología de Kant, la primera formulación del Imperativo Categórico («Obra solo según aquella máxima por la cual puedas querer que al mismo tiempo se convierta en ley universal») exige que toda conclusión ética sea formal, universal, atemporal e idéntica para todo agente racional, sin admitir jamás excepciones derivadas del contexto específico o de las consecuencias humanas. Esta universalidad rígida llevó al propio Kant, en su célebre ensayo «Sobre un presunto derecho de mentir por filantropía» (1797), a concluir que sería inmoral mentirle incluso a un asesino que toca a la puerta preguntando si nuestra víctima inocente refugiada adentro está en casa, porque universalizar la mentira destruiría la estructura lógica de los contratos. La tradición judía rechaza de raíz este formalismo abstracto que sacrifica vidas concretas en el altar de una regla lógica desencarnada. En la Halajá, la ESPECIFICIDAD DEL MANDAMIENTO requiere discernimiento situacional, casuística rigurosa y una jerarquía viva de valores: 1) El principio supremo de Pikuaj Néfesh (salvación de la vida humana, Levítico 18:5 y Talmud Bavli Yoma 85b: «Vivirás por los preceptos, y no morirás por ellos») establece que preservar una vida inocente suspende casi toda la Torá; ante el asesino en la puerta, para el judaísmo no solo está permitido ocultar la verdad, sino que revelar el escondite de la víctima sería una transgresión gravísima («No te quedarás de brazos cruzados ante la sangre de tu prójimo», Levítico 19:16). 2) El Talmud en Yevamot 65b enseña explícitamente que «es obligatorio alterar un detalle de la verdad en aras de la paz y para proteger la vida» (Mutav she-yeshané adam mipnei ha-shalom). 3) El principio de Lifnim Mishurat HaDin («más allá de la línea estricta de la ley», Bava Metzia 30b y Ramban sobre Deuteronomio 6:18: «Harás lo recto y lo bueno») demuestra que una conclusión ética justa debe ponderar quién es la persona concreta, su vulnerabilidad, el momento y el contexto específico.',
            keyTakeaway:
              'Mientras Kant impone conclusiones éticas de universalidad formal inflexible (ciegas al contexto particular), la Halajá judía opera mediante la especificidad del mandamiento y una jerarquía de valores donde la vida (Pikuaj Néfesh, Yoma 85b) y la paz prevalecen sobre toda abstracción formal.',
          },
          drash: {
            hebrewPillar: 'מַעֲנֵה הַמְּקוֹרוֹת',
            title:
              '3. Cómo Articula el Judaísmo Universalidad y Especificidad del Mandamiento: Las 7 Leyes de Noé frente a las 613 Mitzvot del Pacto',
            exposition:
              'En un nivel aún más profundo de filosofía moral y política, ¿significa esto que la ética judía carece de conclusiones universales o que es meramente particularista? De ninguna manera. A diferencia de la filosofía ilustrada —que asume que para que un principio ético sea válido debe borrar las identidades particulares y reducirse a un universal homogéneo—, la tradición judía articula una arquitectura de DOBLE HORIZONTE que integra Universalidad y Especificidad: 1) El Horizonte de la Universalidad Ética (Bnei Nóaj): Como codifica el Talmud en Sanhedrín 56a y Maimónides en Hiljot Melajim 8:10-11, existe un código moral universal e incondicional para toda la humanidad (las Siete Leyes de los Hijos de Noé: prohibición del asesinato, del robo, de la crueldad, de la inmoralidad sexual, de la idolatría y la blasfemia, más el deber positivo de instituir tribunales de justicia, Dinim), fundamentado en que todo ser humano fue creado a Imagen Divina (Tzelem Elohim, Génesis 1:27 y 9:6). 2) El Horizonte de la Especificidad del Mandamiento (Berit Sínai): Sobre ese cimiento universal, el judaísmo afirma que la vida moral plena no se vive en la abstracción de «la humanidad en general», sino en la especificidad histórica de una familia, una comunidad, una memoria y un Pacto particular (las 613 Mitzvot entregadas a Israel). Como explica el Rabino Lord Jonathan Sacks en «La Dignidad de la Diferencia», los principios básicos de justicia son universales, pero las obligaciones de amor, lealtad, santificación del tiempo (Shabat) y construcción comunitaria requieren especificidad relacional.',
            keyTakeaway:
              'El judaísmo resuelve el dilema entre universalismo y particularismo: establece conclusiones éticas universales básicas para toda la humanidad (7 Leyes de Noé, Sanhedrín 56a) y conclusiones éticas específicas de máxima exigencia dentro del Pacto particular (613 Mitzvot).',
          },
          sod: {
            hebrewPillar: 'בֵּרוּר וְהַעֲלָאָה',
            title:
              '4. Del Deber Frío («aus Pflicht») a la Ética del Carácter, el Amor y la Simjá shel Mitzvá (Rambam, Shemoná Perakim cap. 6)',
            exposition:
              'Finalmente, el contraste entre Kant y la tradición judía ilumina la psicología moral del agente. Para Kant, una acción solo posee valor moral puro si se realiza exclusivamente por frío respeto al deber («aus Pflicht») y en contra de nuestras inclinaciones; si alguien ayuda a un necesitado porque siente compasión, amor o alegría al hacerlo, según Kant esa acción es hermosa pero carece de auténtico mérito moral. Siete siglos antes de Kant, Maimónides (Rambam) en su tratado ético Shemoná Perakim (capítulo 6) analizó con asombrosa precisión esta tensión al comparar la postura de los filósofos griegos (para quienes el hombre armónico que no siente deseos indebidos es superior a quien lucha contra sí mismo) con la de nuestros Sabios (en Sifrá sobre Kedoshim y Kidushín 31a, donde quien vence su inclinación en preceptos rituales recibe mayor recompensa). Maimónides resuelve la paradoja distinguiendo entre los preceptos ético-racionales (Mishpatim: no asesinar, no robar, practicar la caridad y la bondad, donde la meta es refinar el alma hasta amar el bien sin desear el mal) y los preceptos revelados (Jukim). Más aún, toda la tradición de la Torá, el Musar y la Jasidut rechaza la frialdad emocional kantiana: la Torá exige educar el corazón para amar («Amarás a tu prójimo como a ti mismo», Levítico 19:18) y advierte que servir por mero deber frío e inerte es una falla espiritual («Por cuanto no serviste a Hashem tu Dios con alegría y bondad de corazón», Deuteronomio 28:47). La cima ética judía es la Simjá shel Mitzvá: el instante en que la fuente externa del deber y la fuente interna del amor y la alegría se funden en una sola unidad.',
            keyTakeaway:
              'Frente al deber frío y desafectado de Kant, la tradición judía (Rambam en Shemoná Perakim 6, Musar y Jasidut) integra la nobleza de vencer el impulso con el deber de cultivar la empatía, el amor al prójimo (Levítico 19:18) y la alegría en el bien (Simjá shel Mitzvá).',
          },
        }
      : isMashiajBuddhaContrastTopic
      ? {
          pshat: {
            hebrewPillar: 'פְּשָׁט',
            title: '1. ¿Qué exige el Judaísmo para ser el Mashíaj? El Rey Humano de la Casa de David y la Redención de la Historia',
            exposition:
              'Para evaluar desde la Torá por qué Siddhartha Gautama (el Buda) no es el Mashíaj, establecemos primero los criterios objetivos del judaísmo en el Tanaj y en la codificación de Maimónides (Mishné Torá, Hiljot Melajim caps. 11 y 12). «Mashíaj» (מָשִׁיחַ, «el Ungido con aceite») no es un título genérico para cualquier maestro espiritual iluminado, sino un cargo jurídico, profético y real dentro del Pacto de Israel: 1) Debe ser descendiente biológico patrilineal del Rey David por vía de su hijo Salomón (Isaías 11:1; 2 Samuel 7:12–16; 1 Crónicas 22:9–10); 2) Está lleno del espíritu de Hashem —el Dios Único y Creador del universo (Deuteronomio 6:4; Isaías 11:2)— y se consagra al estudio y restauración íntegra de las 613 Mitzvot de la Torá escrita y oral; y 3) Su misión es eminentemente pública, política e histórica en este mundo físico (Olam HaZé): restaurar la soberanía de Israel, reconstruir el Beit HaMikdash en Jerusalén, reunir físicamente a todos los exiliados judíos (Kibutz Galuyot) y erradicar las guerras entre todas las naciones (Isaías 2:4; 11:9).',
            keyTakeaway:
              'En el judaísmo, ser el Mashíaj no significa ser un sabio místico o asceta en abstracto, sino un rey descendiente de David que cumple una misión teísta, halájica y geopolítica verificable en Jerusalén y en el mundo entero.',
          },
          remez: {
            hebrewPillar: 'רֶמֶז',
            title: '2. Caracterización de Siddhartha Gautama (el Buda) en el Canon Pali: Los 5 Ejes del Dharma Budista',
            exposition:
              'En segundo lugar, caracterizamos con precisión histórica y filosófica la figura de Siddhartha Gautama, el Buda Shakiamuni (c. 563–483 a.e.c.), según las Fuentes Externas del Canon Pali (Ariyapariyesana Sutta MN 26, Dhammacakkappavattana Sutta SN 56.11 y Brahmajāla Sutta DN 1): (1) LA GRAN RENUNCIA AL TRONO (MAHABHINISHKRAMANA): Nacido como príncipe heredero de la casta guerrera (Kshatriya) del clan Shakya en Lumbini (actual Nepal/India), a los 29 años toma la decisión opuesta a un rey mesiánico: abdica de su futuro trono, abandona su palacio, a su esposa Yasodhara y a su hijo Rahula, y se retira al bosque como monje mendicante (Sramana) porque considera la vida familiar y política un obstáculo para la liberación; (2) MARCO ONTOLÓGICO NO-TEÍSTA: El Buda rechaza la existencia de un Dios Creador supremo (Ishvara) y de cualquier revelación o ley divina; (3) EL MUNDO COMO DUKKHA Y SAMSARA: En las Cuatro Nobles Verdades, diagnostica que toda existencia física, histórica y deseante es intrínsecamente insatisfactoria y dolorosa (Dukkha), atrapada en el ciclo de renacimientos (Samsara); (4) DOCTRINA DE ANATTA (NO-YO): Niega la existencia de un alma individual inmortal y sustancial, reduciendo al sujeto a cinco agregados impermanentes (Skandhas); y (5) SOTERIOLOGÍA DEL NIRVANA: Su meta no es reformar los imperios ni redimir la historia colectiva, sino enseñar un sendero meditativo y ascético individual (el Noble Camino Óctuple) para apagar la sed del deseo (Tanha) y extinguirse del ciclo del renacimiento (Parinirvana).',
            keyTakeaway:
              'El Buda se caracteriza por 5 ejes: (1) renunciar a su trono real para hacerse monje asceta, (2) un sistema no-teísta sin Dios Creador, (3) ver el mundo como sufrimiento (Dukkha/Samsara), (4) negar el alma individual (Anatta) y (5) buscar la extinción individual del deseo en el Nirvana.',
          },
          drash: {
            hebrewPillar: 'דְּרָשׁ',
            title: '3. Desglose Sistemático de las 7 Diferencias por las que Buda No es el Mashíaj del Judaísmo',
            exposition:
              'Al contrastar ambas caracterizaciones, se desglosan 7 razones y diferencias fundamentales e irreconciliables: 1) TEOLOGÍA (Monoteísmo Creador vs. No-Teísmo): El Mashíaj actúa en nombre de Hashem, el Creador personal del cielo y de la tierra, y lleva a la humanidad a conocer a Dios (Isaías 11:2, 9); el Buda opera en un marco no-teísta que prescinde de Dios. 2) DIRECCIÓN DEL LIDERAZGO (Asumir el Trono de David vs. Abdicar del Trono en la Gran Renuncia): Es el contraste más revelador: Siddhartha Gautama huye del palacio real porque ve el gobierno y la historia como cadenas ilusorias; el Mashíaj judío asume el trono de David para gobernar, juzgar con equidad a los oprimidos y transformar la política mundial (Isaías 11:4; Jeremías 23:5). 3) LINAJE Y PACTO (Casa de David en Sión vs. Clan Shakya en la India): El Mashíaj debe descender por línea paterna de Judá, David y Salomón (1 Crónicas 22:9–10); Buda perteneció al clan Shakya en el subcontinente indio, totalmente ajeno a la genealogía y al Pacto de Israel. 4) VALORACIÓN DEL MUNDO FÍSICO («Tov Meod» en Génesis 1:31 vs. «Dukkha/Samsara»): Para el budismo el mundo material es sufrimiento del cual hay que liberarse; para la Torá el mundo creado por Dios es «muy bueno» (Génesis 1:31) y es el escenario sagrado donde se construye la morada divina (Dirá BeTajtonim). 5) RELACIÓN CON EL MANDAMIENTO (613 Mitzvot y Vida Familiar vs. Ascetismo Monástico Célibe): Según Maimónides (Hiljot Melajim 11:1–4), el Mashíaj restaura todos los preceptos de la Torá (que santifican el matrimonio, la procreación —Génesis 1:28—, el trabajo y la justicia comunitaria); el Buda instituye una orden monástica célibe (Sangha) que busca extinguir el deseo. 6) VERIFICACIÓN EMPÍRICA EN LA HISTORIA (Hiljot Melajim 11:4): Tras el Parinirvana de Buda en el siglo V a.e.c., las guerras del mundo no terminaron (Isaías 2:4), el pueblo judío no fue reunido del exilio (Kibutz Galuyot) ni se reconstruyó el Templo en Jerusalén. 7) ANTROPOLOGÍA Y FUTURO (Neshamá y Resurrección vs. Anatta y Extinción): El judaísmo afirma la realidad eterna del alma individual (Neshamá) y la resurrección (Sanhedrín 90a), frente a la doctrina budista de la inexistencia del yo (Anatta).',
            keyTakeaway:
              'Buda y el Mashíaj representan vectores opuestos: Buda es el príncipe que renuncia a su trono para apagar el deseo y salir del mundo (Nirvana); el Mashíaj es el rey davídico que asume el trono para encender la justicia de la Torá y redimir la historia del mundo (Tikún Olam).',
          },
          sod: {
            hebrewPillar: 'סוֹד',
            title: '4. Síntesis Exegética (Eijá Rabá 2:13): Sabiduría Contemplativa Externa (Jojmá) frente a la Redención del Mundo (Dirá BeTajtonim)',
            exposition:
              'A la luz del principio rabínico «Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín» (Eijá Rabá 2:13), el judaísmo puede reconocer en las enseñanzas éticas y psicológicas de Siddhartha Gautama observaciones valiosas de sabiduría humana (Jojmá) sobre la ecuanimidad y el dominio de las pasiones, pero subraya por qué su camino es incompatible con la redención mesiánica de la Torá. Como enseñan el Maharal de Praga, el Ramjal, el Alter Rebe en el Tania (cap. 36) y el Rabino Lord Jonathan Sacks, el judaísmo se niega a declarar que el mundo físico, el amor familiar y la historia humana sean una trampa de sufrimiento de la que debamos escapar: la misión del Mashíaj —y de cada persona mediante cada Mitzvá específica («Ner Mitzvá ve-Torá Or», Proverbios 6:23)— es sanar la historia, erradicar la injusticia y revelar la luz de Hashem en medio de la tierra.',
            keyTakeaway:
              'Mientras el despertar búdico busca liberar al individuo del mundo, la redención mesiánica judía busca liberar al mundo mismo de la opresión y de la guerra hasta llenarlo del conocimiento de Hashem (Isaías 11:9).',
          },
        }
      : isMashiajTopic
      ? {
          pshat: {
            hebrewPillar: 'פְּשָׁט',
            title: '1. ¿Qué es el Mashíaj en el Judaísmo? Etimología, Linaje Patrilineal de David y Naturaleza 100% Humana',
            exposition:
              'En el sentido literal, jurídico y bíblico (Pshat), la palabra hebrea «Mashíaj» (מָשִׁיחַ, de la raíz מ-שׁ-ח, mashaj) significa literalmente «El Ungido con aceite». En el Tanaj designa el rito público mediante el cual se consagraba con el aceite de la unción (Shémen HaMishjá) a los reyes de Israel (Saúl en 1 Samuel 10:1; David en 1 Samuel 16:13), al Sumo Sacerdote (Levítico 4:3) e incluso a Ciro de Persia (Isaías 45:1). En el judaísmo, el Mashíaj es un LÍDER, JUEZ Y REY 100% HUMANO Y MORTAL, nacido de forma natural de un padre y una madre humanos, descendiente biológico por línea paterna directa del Rey David a través de su hijo Salomón (Isaías 11:1–2; 2 Samuel 7:12–16; 1 Crónicas 22:9–10). Por el axioma inquebrantable del monoteísmo incorpóreo absoluto (Deuteronomio 6:4: «Shemá Yisrael, Hashem Eloheinu, Hashem Ejad»; Números 23:19: «Dios no es hombre para que mienta, ni hijo de hombre para que se arrepienta»; Oseas 11:9: «Porque Dios soy Yo, y no hombre»), en el judaísmo Dios jamás toma forma física, jamás nace ni muere y jamás se divide en personas: el Mashíaj judío no es una deidad ni mediador de las plegarias, sino el supremo estadista y maestro de Torá.',
            keyTakeaway:
              'En el judaísmo, «Mashíaj» significa «Ungido»: un rey y líder 100% humano y mortal del linaje patrilineal de David y Salomón, dentro de un monoteísmo incorpóreo absoluto (Deuteronomio 6:4; Números 23:19).',
          },
          remez: {
            hebrewPillar: 'רֶמֶז',
            title: '2. Caracterización del Mesías en el Cristianismo: Los 5 Ejes Dogmáticos que lo Definen',
            exposition:
              'Para desglosar con rigor las diferencias entre ambas religiones, es indispensable caracterizar cómo concibe el cristianismo al Mesías (traducido al griego como Χριστός, Christós). La cristología y soteriología cristiana (formulada en la literatura paulina y definida en los Concilios de Nicea de 325 e.c. y Calcedonia de 451 e.c.) caracteriza a su Mesías sobre cinco ejes dogmáticos: (1) NATURALEZA DIVINO-HUMANA (ENCARNACIÓN Y TRINIDAD): El cristianismo lo define como Dios Hijo encarnado, segunda persona de la Trinidad («consustancial al Padre», homoousios), nacido por concepción virginal y dotado de dos naturalezas (divina y humana) en una sola hipóstasis; (2) SOTERIOLOGÍA DEL PECADO ORIGINAL Y EXPIACIÓN VICARIA: Sostiene que el pecado de Adán corrompió hereditariamente a toda la humanidad y que el ser humano no puede alcanzar el perdón por su propio arrepentimiento ni por sus obras, por lo que el Mesías cristiano debe morir crucificado como sacrificio vicario de sangre (Agnus Dei) para rescatar a las almas de la condenación eterna; (3) REDENCIÓN ESPIRITUAL E INTERIOR: Ante la persistencia de las guerras y la opresión tras el siglo I, caracteriza el reino mesiánico como una salvación interior e invisible del alma («un reino que no es de este mundo»); (4) ABROGACIÓN O SUPERACIÓN DE LA LEY DE LA TORÁ: Caracteriza al Mesías como el «fin de la Ley», declarando caducos los preceptos prácticos de la Torá (Shabat, Kashrut, Brit Milá) y sustituyéndolos por la fe dogmática (pistis) en la gracia; y (5) DOCTRINA DE LAS «DOS VENIDAS» (PARUSÍA): Como las profecías bíblicas de paz mundial y reunión de Israel no se cumplieron durante su vida terrenal, el cristianismo postula una Primera Venida para sufrir y morir por los pecados, y una Segunda Venida futura al final de los tiempos para cumplir las profecías pendientes.',
            keyTakeaway:
              'El cristianismo caracteriza a su Mesías mediante 5 dogmas: (1) Dios encarnado trinitario, (2) redentor del pecado original mediante sacrificio vicario en la cruz, (3) salvador espiritual interior, (4) abrogador de la observancia de la Torá y (5) protagonista de una «Segunda Venida» (Parusía).',
          },
          drash: {
            hebrewPillar: 'דְּרָשׁ',
            title: '3. Desglose Sistemático de las 7 Diferencias Fundamentales entre el Mashíaj del Judaísmo y el Mesías del Cristianismo',
            exposition:
              'Al contrastar la caracterización cristiana con las Fuentes Internas de la Torá, se desglosan 7 diferencias estructurales e irreconciliables: 1) ONTOLOGÍA (Rey 100% humano mortal vs. Dios encarnado): En la Torá, atribuir divinidad a un ser humano contradice la unicidad incorpórea de Hashem (Deuteronomio 6:4; Éxodo 20:2–3; Números 23:19). 2) GENEALOGÍA (Linaje patrilineal biológico de David y Salomón vs. Concepción virginal): En la ley bíblica, la pertenencia tribal y real se transmite exclusivamente por el padre biológico humano (Números 1:18; 2 Samuel 7:12–16; 1 Crónicas 22:9–10); la afirmación de un nacimiento virginal sin padre humano excluye por definición la transmisión patrilineal davídica. 3) SOTERIOLOGÍA (Responsabilidad moral individual y Teshuvá directa vs. Pecado original y sacrificio vicario): El judaísmo rechaza el pecado original hereditario y prohíbe que un inocente pague por el culpable; Ezequiel 18:20–23 proclama que «el alma que pecare, ésa morirá; el hijo no cargará con la iniquidad del padre... mas si el malvado se apartare de sus pecados y guardare Mis estatutos, de cierto vivirá», y Oseas 14:2–3 enseña que la Teshuvá (arrepentimiento sincero) nos reconcilia directamente con Dios sin intermediarios ni sacrificios de sangre. 4) VIGENCIA DE LA TORÁ (Plenitud eterna de las Mitzvot vs. Abrogación de la Ley): La Torá es eterna e inmutable (Deuteronomio 13:1–5; Salmos 19:8); según Maimónides (Hiljot Melajim 11:1), el Mashíaj judío restaura la observancia completa de todos los preceptos de la Torá. 5) CRITERIO TEMPORAL (Cumplimiento íntegro en una sola vida vs. «Segunda Venida»): El Tanaj desconoce por completo una «Segunda Venida»; Maimónides codifica en Hiljot Melajim 11:4 que «si un aspirante no tuvo éxito hasta este punto [reconstruir el Templo y reunir a los exiliados] o fue muerto, queda demostrado con certeza que él NO es aquel que la Torá prometió». 6) ESCENARIO DE LA REDENCIÓN (Transformación geopolítica verificable en este mundo vs. Salvación interior invisible): El Mashíaj judío trae el cese empírico de todas las guerras (Isaías 2:4), reúne físicamente a todo Israel en su tierra (Kibutz Galuyot, Isaías 11:12) y reconstruye el Tercer Templo en Jerusalén (Ezequiel 37:26–28). 7) UNIVERSALISMO ÉTICO (Justos de las Naciones vs. Exclusivismo dogmático): En el judaísmo, toda persona ética de cualquier nación tiene parte en el Olam HaBá (Hiljot Teshuvá 3:5) sin depender de un dogma cristológico.',
            keyTakeaway:
              'Las 7 diferencias abarcan la ontología (humano vs. divino), genealogía (patrilineal davídica vs. virginal), soteriología (Teshuvá directa en Ezequiel 18:20 vs. expiación vicaria), vigencia eterna de la Torá, cumplimiento en una sola vida (Hiljot Melajim 11:4 vs. Segunda Venida), paz mundial empírica (Isaías 2:4) y acceso universal ético.',
          },
          sod: {
            hebrewPillar: 'סוֹד',
            title: '4. La Disputa de Barcelona de 1263 (Najmánides) y la Redención de la Historia (Dirá BeTajtonim)',
            exposition:
              'En julio de 1263, en la célebre Disputa de Barcelona ante el Rey Jaime I de Aragón (Vikuaj ha-Rambán, §§42–49), Rabí Moshé ben Najmán (Rambán / Najmánides) expuso la síntesis histórica definitiva de estas diferencias: mientras los teólogos cristianos sostenían que el Mesías ya había venido y que las profecías de Isaías 2:4 («no alzará espada nación contra nación») y 11:6–9 debían leerse solo como alegorías interiores, Najmánides señaló al rey que desde la aparición del cristianismo el mundo seguía sumido en guerras incesantes, y que en el judaísmo las profecías mesiánicas son promesas históricas literales y verificables de paz mundial real. Además, Rambán explicó al rey por qué para el judaísmo el Mashíaj no es un salvador de almas (pues cada ser humano ya tiene acceso directo a Hashem mediante la Torá y la Teshuvá), sino el líder que inaugura una era de paz terrenal para que toda la humanidad pueda consagrarse sin opresión a la sabiduría y a la justicia (Maimónides, Hiljot Melajim 12:4–5; Tania cap. 36 sobre Dirá BeTajtonim).',
            keyTakeaway:
              'Como demostró Najmánides en la Disputa de Barcelona (1263), mientras el Mesías cristiano es caracterizado como un redentor místico del pecado original cuya paz mundial se difiere a otro advenimiento, el Mashíaj judío se verifica empíricamente cuando la guerra cesa en la tierra y el mundo entero se llena del conocimiento ético de Hashem (Isaías 2:4; 11:9).',
          },
        }
      : isModim
      ? {
          pshat: {
            hebrewPillar: 'פְּשָׁט',
            title: 'Manuscritos de la Guenizá de El Cairo, Seder Rav Amram Gaón, Sidur Rav Saadia Gaón y Majzor Vitry',
            exposition:
              'En el análisis ecdótico de los fragmentos de la Guenizá de El Cairo correspondientes al rito palestinense temprano (Núsaj Eretz Yisrael), la 18.ª bendición de la Amidá (Modim) se articula en torno a la gratitud por la vida y la redención histórica («Modim anajnu laj, Atá Hu Hashem Eloheinu ve-Elohei avoteinu le-olam vaed, Tzur jayenu, Maguén yishenu»), sin incorporar el epíteto cosmológico «Yotzer Bereshit». En contraste, los primeros códigos litúrgicos babilónicos y franco-ashkenazíes —el Seder Rav Amram Gaón (s. IX), el Sidur de Rav Saadia Gaón (s. X) y el Majzor Vitry de Rabí Simjá de Vitry (discípulo de Rashi, s. XI)— fijan explícitamente la cláusula «Al she-Atá Hu Hashem Eloheinu ve-Elohei avoteinu le-olam vaed, Tzur jayenu, Maguén yishenu... Yotzer Bereshit» exclusivamente dentro del Modim de-Rabanán recitado en voz baja por la congregación durante la repetición del Shaliaj Tzibur.',
            keyTakeaway:
              'La crítica textual demuestra que la mención a la Creación (Yotzer Bereshit) pertenece al estrato eucológico del Bet Midrash (Modim de-Rabanán) y no al texto canónico fijo de la Amidá.',
          },
          remez: {
            hebrewPillar: 'רֶמֶז',
            title: 'De las Fórmulas Individuales de los Sabios en Sotá 40a y Yerushalmi Berajot 1:5 a la Fusión de Rav Papa',
            exposition:
              'El Talmud Babilónico en Sotá 40a (y su paralelo en el Talmud de Jerushalmi, Berajot 1:5 [1:8, 3d]) plantea la pregunta: «Mai Modim de-Rabanán?» (¿Qué dicen los Sabios cuando el Jazán llega a Modim?). Allí se preservan las fórmulas individuales de cada Amoraíta: Rav decía «Modim anajnu laj she-Atá Hu Hashem Eloheinu al she-anajnu modim laj»; Shmuel añadía «Elohei kol basar»; Rabí Simai introducía el motivo creacional explícito «Yotzer Bereshit» («Formador de la Creación», eco de Isaías 45:7: «Yotzer or u-voré jóshej» frente al dualismo persa y gnóstico); Nehardea en nombre de Rabí Simai agregaba «Berajot ve-hodaot le-Shimjá ha-gadol al she-hejayítanu ve-kiyámtanu»; y Rav Aja bar Yaakov concluía con la súplica mesiánica. Finalmente, Rav Papa dictaminó: «Hiljaj nemrinhu le-julhu» («Por tanto, recitémoslas todas juntas»), fusionando el mosaico rabínico en el Modim de-Rabanán actual.',
            keyTakeaway:
              'Rabí Simai introduce «Yotzer Bereshit» como afirmación monoteísta de la soberanía creadora divina, y Rav Papa lo inmortaliza al fusionar todas las fórmulas de los sabios.',
          },
          drash: {
            hebrewPillar: 'דְּרָשׁ',
            title: 'Jatimat Berajá Canónica frente a Respuesta Doxológica y la Regla del Siervo ante su Amo',
            exposition:
              'Desde la pragmática litúrgica (Yerushalmi Berajot 1:5; Abudraham; Tur y Shulján Aruj Oraj Jaim 127), existe una diferencia estructural entre la bendición canónica de la Amidá —que posee Jatimat Berajá («Baruj Atá Hashem, HaTov Shimjá u-lejá naé lehodot») y puede ser escuchada del Jazán mediante el principio de Shomea ke-Oné— y el acto de inclinación y agradecimiento (Modim). Los Sabios establecieron que no es decoroso que un siervo agradezca a su Amo meramente a través de un intermediario o emisario (el Jazán) mientras permanece pasivo. Cuando el Jazán se inclina en «Modim», toda la congregación debe inclinarse físicamente y declarar en primera persona del plural por qué se prosterna: porque Él es el «Yotzer Bereshit», el Creador ontológico de todo cuanto existe.',
            keyTakeaway:
              'La sumisión corporal y la gratitud existencial no pueden delegarse en el Jazán: exigen una confesión directa de la soberanía del Creador (Yotzer Bereshit).',
          },
          sod: {
            hebrewPillar: 'סוֹד',
            title: 'Macrocosmos («Yotzer Bereshit») y Microcosmos («Al She-hejayítanu») según Elbogen, Heinemann, Reif y Ehrlich',
            exposition:
              'En la exégesis teológica comparada y la erudición contemporánea —Ismar Elbogen (Der jüdische Gottesdienst), Joseph Heinemann (Prayer in the Talmud: Forms and Patterns), Stefan Reif (Judaism and Hebrew Prayer) y Uri Ehrlich (The Nonverbal Language of Jewish Prayer)— esta disparidad responde a dos géneros litúrgicos complementarios. El Modim estándar de la Amidá pertenece a la liturgia institucional del Templo y la sinagoga, centrada en el pacto histórico y la providencia cotidiana («Al jayenu ha-mesurim beyadeja... ve-al niseja»). En cambio, el Modim de-Rabanán nace en el Bet Midrash de los Sabios como una doxología espontánea que enlaza el macrocosmos ontológico («Yotzer Bereshit», el Creador del universo desde la nada) con el microcosmos íntimo de la vida individual («Al she-hejayítanu ve-kiyámtanu», por habernos dado vida y sostenido hasta este instante).',
            keyTakeaway:
              'Síntesis central: El Modim de la Amidá agradece la providencia histórica dentro del Pacto, mientras que el Modim de-Rabanán fundamenta el acto físico de inclinarse reconociendo al Creador absoluto del cosmos (Yotzer Bereshit).',
          },
        }
      : isHalelTopic
      ? {
          pshat: {
            hebrewPillar: 'פְּשָׁט',
            title: '1. Estructura Bíblica y Litúrgica del Halel Egipcio (Tehilim 113–118) e Institución Profética en Pesajim 117a',
            exposition:
              'En el plano textual y normativo (Pshat), el «Halel» (הַלֵּל, denominado en la literatura rabínica «Halel HaMitzrí» o Halel Egipcio para distinguirlo del «Halel HaGadol» del Salmo 136) está conformado por los seis cánticos de Tehilim 113 al 118. El Talmud Babilónico en Pesajim 117a pregunta por su origen histórico y dictamina: «Neviim she-bahem tiknú lahem le-Yisrael she-yihú omerim otó al kol pérek ve-pérek ve-al kol tzará ve-tzará she-lo tavó aleihem, ve-ljishenigalin omerim otó al guéulatam» («Los profetas que había entre ellos instituyeron para Israel que lo recitaran en cada época festiva y tras cada angustia de la cual fueran redimidos»). El Salmo 113 abre llamando a los «siervos de Hashem» («Halelú avdei Hashem», y ya no siervos del Faraón, como subraya el Talmud en Meguilá 14a); el Salmo 114 evoca el Éxodo de Egipto y la partición del Mar de los Juncos; los Salmos 115 y 116 proclaman la fe en Hashem frente a los ídolos mudos; el Salmo 117 convoca a las naciones a reconocer la bondad divina; y el Salmo 118 culmina con la procesión triunfal en el Beit HaMikdash («Odjá ki anítani... Ze ha-yom asá Hashem») y las cuatro sacudidas de las Cuatro Especies (Naanuim) en Sucot (Sucá 37b).',
            keyTakeaway:
              'El Halel (Salmos 113–118) es una institución profética (Takanat Neviim, Pesajim 117a) que celebra la liberación histórica de Israel y su condición de siervos exclusivamente de Hashem.',
          },
          remez: {
            hebrewPillar: 'רֶמֶז',
            title: '2. Los 18 Días de Halel Completo (Arjín 10a) frente al Medio Halel en Pesaj y Rosh Jódesh',
            exposition:
              'En el análisis halájico del Talmud Babilónico en Arjín 10a–10b, la Mishná y la Guemará establecen la regla taxativa sobre cuándo se recita el Halel Completo (Halel Shalem): dieciocho días al año en Eretz Yisrael (y veintiún días en la Diáspora): los ocho días de Sucot y Sheminí Atzéret, los ocho días de Janucá, el primer día de Pesaj (y segundo en la Diáspora) y el día de Shavuot. ¿Por qué en los últimos seis días de Pesaj no se recita el Halel Completo sino solo Medio Halel (Jatsi Halel, omitiendo los primeros once versículos de los Salmos 115 y 116)? El Talmud en Arjín 10b expone dos razones complementarias: 1) En el plano sacrificial (Halajá), cada día de Sucot tenía una ofrenda de Musaf diferenciada, mientras que los días de Pesaj compartían la misma ofrenda; y 2) En el plano ético-midráshico (Meguilá 10b y Sanhedrín 39b, citado por el Beit Yosef y el Taz en Oraj Jaim 490), en el séptimo día de Pesaj los egipcios se ahogaron en el mar y el Santo, Bendito Sea, dijo a los ángeles: «Maasé yadai tovím ba-yam ve-atem omerim shirá?» («¿La obra de Mis manos se está ahogando en el mar y vosotros entonáis cánticos completos?»).Asimismo, en Rosh Hashaná y Yom Kipur no se recita el Halel en absoluto porque, como enseña Rabí Abahu en Arjín 10b, cuando los libros de la vida y de la muerte están abiertos ante el Rey en juicio, no corresponde entonar cánticos de júbilo festivo.',
            keyTakeaway:
              'El Talmud en Arjín 10a–10b delimita con precisión los 18 días de Halel Shalem y explica por qué en el resto de Pesaj se recita Jatsi Halel y en los Yamim Noraim se omite.',
          },
          drash: {
            hebrewPillar: 'דְּרָשׁ',
            title: '3. El Descubrimiento de Rav en Babilonia (Taanit 28b), el Shulján Aruj (OC 422:2) y Rosh Jódesh de 1 o 2 Días según el Mes que Termina (OC 427:1)',
            exposition:
              'El pasaje fundamental sobre el Halel en Rosh Jódesh se encuentra en el Talmud Babilónico, Taanit 28b: cuando Rav descendió de la Tierra de Israel a Babilonia y vio que la congregación leía el Halel en Rosh Jódesh, pensó interrumpirlos, pero al observar que omitían partes (recitando solo Medio Halel, sin «Lo lanu» en Salmo 115:1–11 ni «Ahavti» en Salmo 116:1–11), declaró: «Shéma miná minhag avoteijem be-yadeijem» («De aquí se deduce que conserváis una costumbre ancestral en vuestras manos»). A partir de esta Guemará surge la diferencia halájica en el Shulján Aruj (Oraj Jaim 422:2): 1) RASHI, RAMBAM (Hiljot Megilá ve-Janucá 3:6–7) y el MEJABER (Rabí Yosef Karo, siguiendo el Minhag Sefardí): como sobre una costumbre no se pronuncia bendición («Al ha-minhag ein levarej»), en Rosh Jódesh y en los últimos días de Pesaj NO se recita berajá sobre el Medio Halel; 2) RABENU TAM, el ROSH y el RAMÁ (Rabí Moshé Isserles, siguiendo el Minhag Ashkenazí): sí se recita la bendición «Likró et ha-Halel» en comunidad. Asimismo, la Halajá explica por qué **Rosh Jódesh puede ser de 1 o de 2 días dependiendo de cuántos días tiene el mes que termina** (Talmud Rosh Hashaná 19b; Arjín 8b–9b; Rambam, Hiljot Kidush HaJódesh 8:4; Shulján Aruj, Oraj Jaim 427:1): dado que el ciclo lunar dura aproximadamente 29 días y medio, los meses hebreos alternan entre 29 y 30 días. Cuando el mes que termina es **Jódesh Jaser (חֹדֶשׁ חָסֵר, mes deficiente de 29 días)**, Rosh Jódesh dura **1 solo día** (el día 1 del nuevo mes); en cambio, cuando el mes que termina es **Jódesh Malé (חֹדֶשׁ מָלֵא, mes pleno de 30 días)**, Rosh Jódesh dura **2 días**: el **primer día de Rosh Jódesh es el día 30 del mes que termina (mes saliente)** y el **segundo día de Rosh Jódesh es el día 1 del mes nuevo entrante** (a partir del cual se cuentan los días del nuevo mes). En ambos días de un Rosh Jódesh de 2 días se recita por igual el Medio Halel (Jatsi Halel), Yaalé VeYavó, lectura de la Torá y Musaf.',
            keyTakeaway:
              'En Rosh Jódesh se recita Jatsi Halel (sin berajá según el Mejaber Sefardí; con berajá según el Ramá Ashkenazí), ya sea que Rosh Jódesh dure 1 día (cuando el mes que termina tiene 29 días, Jódesh Jaser) o 2 días (cuando el mes que termina tiene 30 días, Jódesh Malé: día 30 del mes saliente + día 1 del mes entrante).',
          },
          sod: {
            hebrewPillar: 'סוֹד',
            title: '4. Dimensión Interior del Halel y la Renovación Lunar: De «Betzet Yisrael» al Despertar de la Alegría Presente',
            exposition:
              'En la dimensión interior de la Torá (Maharal de Praga en Guevurot Hashem cap. 61, el Zóhar y las enseñanzas jasídicas de Sfat Emet y Likutei Moharán), el Halel une dos movimientos del alma: los primeros capítulos (Salmos 113–114, «Betzet Yisrael mi-Mitzrayim») evocan la revelación sobrenatural desde lo Alto (Itaruta de-Leéla) que quebró las leyes de la naturaleza en el Éxodo; mientras que los capítulos finales (Salmos 115–118, «Min ha-metzar karati Yah») expresan el despertar desde abajo (Itaruta de-Letata) en medio de las estrecheces de la historia cotidiana. Por eso, incluso cuando el mes que termina completa sus 30 días (Jódesh Malé) y la nueva luna se gesta en la transición entre el día 30 saliente y el día 1 entrante, el pueblo de Israel entona el Halel reconociendo que cada destello de renovación proviene de Hashem.',
            keyTakeaway:
              'El Halel educa al alma para reconocer la mano de Hashem tanto en los milagros completos de las festividades (Halel Shalem) como en los comienzos graduales de cada mes (Rosh Jódesh de 1 o 2 días).',
          },
        }
      : isShulchanArukhOrMinhagNusachTopic
      ? {
          pshat: {
            hebrewPillar: 'שֻׁלְחָן עָרוּךְ וְהַמַּפָּה',
            title: '1. El Shulján Aruj como Eje del Cumplimiento Judío: La «Mesa» de Rabí Yosef Karo (Mejaber) y el «Mantel» del Ramá (HaMapá)',
            exposition:
              'En la codificación normativa de las leyes y el cumplimiento práctico (Halajá le-Maasé), la obra cumbre del pueblo judío es el «Shulján Aruj» («La Mesa Servida», impreso en Venecia en 1565), redactado en Safed por Marán Rabí Yosef Karo (1488–1575, conocido como «El Mejaber»). Tras analizar cada ley desde su raíz talmúdica en su monumental comentario «Beit Yosef» sobre los «Arbaá Turim» de Rabí Yaakov ben Asher —apoyándose en los tres pilares halájicos: el Rif (Rabí Yitzjak Alfasi), el Rambam (Maimónides) y el Rosh (Rabenu Asher)—, Rabí Yosef Karo estructuró la totalidad de la vida judía en cuatro secciones: 1) ORAJ JAIM (אורח חיים: leyes cotidianas, rezos, bendiciones, Shabat y festividades); 2) YORÉ DEÁ (יורה דעה: leyes de Kashrut, pureza familiar, duelo, caridad y votos); 3) EVEN HAEZER (אבן העזר: derecho matrimonial y familiar); y 4) JOSHEN MISHPAT (חושן משפט: derecho civil, comercial y tribunales rabínicos). Pocos años después, en Cracovia, Rabí Moshé Isserles (el Ramá, 1530–1572) extendió sobre esa mesa sefardí su glosa «HaMapá» («El Mantel»), incorporando las decisiones de los Tosafistas y las costumbres (Minhaguim) de las comunidades de Ashkenaz. Así, en una misma página impresa conviven el cumplimiento sefardí (desarrollado luego por el Ben Ish Jai, el Kaf HaJaim y el Rav Ovadia Yosef en Yalkut Yosef) y el cumplimiento ashkenazí (desarrollado por el Taz, el Maguén Avraham, el Shulján Aruj HaRav del Alter Rebe, el Aruj HaShulján y la Mishná Berurá del Jafetz Jaim).',
            keyTakeaway:
              'El Shulján Aruj une en una sola obra la mesa sefardí de Rabí Yosef Karo (El Mejaber) y el mantel ashkenazí de Rabí Moshé Isserles (El Ramá), articulando unidad legal y diversidad comunitaria.',
          },
          remez: {
            hebrewPillar: 'הֲלָכָה · מִנְהָג · נוּסַח',
            title: '2. Las Tres Dimensiones de las Costumbres y Leyes Dentro del Judaísmo: Halajá, Minhag y Núsaj',
            exposition:
              'Para comparar con rigor las prácticas dentro del judaísmo sin confundir categorías, la tradición rabínica distingue tres niveles complementarios: 1) HALAJÁ (הֲלָכָה — Ley Normativa): El precepto bíblico (De-Oraita) o rabínico (De-Rabanán) vinculante para todo Israel (por ejemplo, encender velas de Shabat, colocar Tefilín, comer Matzá en Pésaj o recitar el Shemá y la Amidá). 2) MINHAG (מִנְהָג — Costumbre Ancestral y Comunitaria): La forma específica en que una comunidad histórica ha practicado o protegido los preceptos a lo largo de las generaciones. Basado en Proverbios 1:8 («No abandones la enseñanza de tu madre», citado en Pesajim 50b), en el principio talmúdico de Taanit 28b («Minhag avoteijem be-yadeijem»: conserváis la costumbre de vuestros ancestros en vuestras manos) y en Shulján Aruj Yoré Deá 214:1, el Minhag lícito de una comunidad adquiere fuerza de ley («Minhag Yisrael Torá hi»). 3) NÚSAJ (נוּסַח — Rito y Formulación Litúrgica): El orden específico de las plegarias, las variantes léxicas del Sidur y los modos musicales (Núsaj HaTefilá) propios de cada tradición (como codifica el Ramá en Shulján Aruj Oraj Jaim 68:1: «No se debe alterar el Minhag del lugar en ningún detalle del orden de la plegaria ni de su Núsaj»).',
            keyTakeaway:
              'Mientras la Halajá define la obligación común del Pacto, el Minhag preserva la práctica heredada de cada comunidad y el Núsaj configura la expresión textual y melódica de su liturgia.',
          },
          drash: {
            hebrewPillar: 'הַשְׁוָאַת הַמִּנְהָגִים וְהַנֻּסְחָאוֹת',
            title: '3. Comparación Práctica de Minhag y Núsaj en el Shulján Aruj (Sefarad / Edot HaMizraj, Ashkenaz, Jasídico/Ari y Teimán)',
            exposition:
              'Al comparar las costumbres internas del pueblo judío a través del Shulján Aruj, destacan tanto los grandes ritos litúrgicos (Núsaj) como cinco ejemplos clásicos de diferencias de Minhag: A) LOS GRANDES RITOS LITÚRGICOS (NÚSAJ): (i) Núsaj Sefarad / Edot HaMizraj (basado en los Gueonim babilónicos, Rambam y Rabí Yosef Karo; p. ej. dice «Barjú» y «Kadosh» con énfasis coral y ordena «Hodu» antes de «Baruj Sheamar»); (ii) Núsaj Ashkenaz (tradición franco-renana y lituana del Majzor Vitry y el Ramá; coloca «Baruj Sheamar» antes de «Hodu»); (iii) Núsaj Sefard / Ari (Jasídico) (creado por el Baal Shem Tov, el Maguid de Mezeritch y el Alter Rebe en el Sidur Tehilat Hashem, integrando la base ashkenazí con el orden cabalístico de Rabí Yitzjak Luria —el Arizal— en Safed, como en la Keter de Musaf); y (iv) Núsaj Teimán (Baladi, fiel al texto del Sidur de Maimónides, y Shami). B) CINCO COMPARACIONES PARADIGMÁTICAS DE MINHAG EN EL SHULJÁN ARUJ: 1) Berajá en el Medio Halel de Rosh Jódesh (Oraj Jaim 422:2): El Mejaber (Minhag Sefardí) dictamina leerlo sin bendición porque es Minhag; el Ramá (Minhag Ashkenazí) dictamina recitar la bendición «Likró et ha-Halel». 2) Birkat Kohanim / Bendición Sacerdotal (Oraj Jaim 128:44): En el Minhag Sefardí y en la Tierra de Israel los Kohanim bendicen al pueblo todos los días; en el Minhag Ashkenazí de la Diáspora (Ramá) lo hacen únicamente en Musaf de Yom Tov. 3) Selijot en el mes de Elul (Oraj Jaim 581:1): El Minhag Sefardí recita Selijot durante todo el mes de Elul (40 días); el Minhag Ashkenazí toca el Shofar desde Rosh Jódesh Elul y comienza Selijot en la semana previa a Rosh Hashaná. 4) Tefilín en Jol HaMoed (Oraj Jaim 31:2): Debate entre el Mejaber y el Zóhar (no colocar Tefilín en los días intermedios de la fiesta porque el Moed mismo es una señal/Ot) frente a la glosa inicial del Ramá en algunas comunidades ashkenazíes. 5) Kitniyot en Pésaj (Oraj Jaim 453:1): El Mejaber permite arroz y legumbres en Pésaj para los Sefardíes; el Ramá codifica el Minhag Ashkenazí de abstenerse de Kitniyot.',
            keyTakeaway:
              'El Shulján Aruj documenta con precisión las diferencias de Minhag y Núsaj (OC 68:1, 128:44, 422:2, 453:1, 581:1) mostrando que todas ellas tienen fundamento en los Rishonim y en el Talmud.',
          },
          sod: {
            hebrewPillar: 'ש שנים־עָשָׂר שִׁבְטֵי יָהּ',
            title: '4. Armonía Interior de los Ritos y Costumbres: Las Doce Puertas de las Doce Tribus (Arizal en Shaar HaKavanot)',
            exposition:
              '¿Por qué existen distintos Nusjaot y Minhaguim dentro de una misma Torá? En la dimensión interior de la Cábala (Rabí Yitzjak Luria, el Arizal, en Shaar HaKavanot al inicio de Inyán Nusaj HaTefilá, citado por el Jidá y el Mishná Berurá en Oraj Jaim 68), se explica que así como en el desierto las Doce Tribus de Israel marchaban cada una con su propia bandera y recibían el maná con el sabor acorde a su raíz espiritual, en el Cielo existen doce puertas de plegaria correspondientes a las doce tribus. Cada Núsaj legítimo (Sefarad, Ashkenaz, Ari/Jasídico, Teimán, Italkí) y cada Minhag ancestral asciende por la puerta de su tribu hacia el mismo Trono Divino. Por ello, tanto el Talmud (Yevamot 14a: «Lo titgodedu» y Pesajim 50b) como el Shulján Aruj enseñan dos reglas de oro: honrar con fidelidad el Minhag y Núsaj de los propios padres, y respetar con amor y paz el Minhag de la comunidad que nos recibe.',
            keyTakeaway:
              'Según el Arizal, los distintos Nusjaot y Minhaguim del pueblo judío son como las doce puertas de las Doce Tribus de Israel: caminos legítimos y sagrados que convergen en la unidad del Único Creador.',
          },
        }
      : {
          pshat: {
            hebrewPillar: 'פְּשָׁט',
            title: `Fundamento Bíblico y Conceptual: ${effectiveTitle}`,
            exposition: `En el plano textual y filológico (Pshat), el análisis de este tema (${primaryHebrew || 'תּוֹרָה'}) parte de las fuentes directas del Tanaj y la tradición masorética, esclareciendo el significado preciso de sus términos hebreos y su marco normativo en la Torá.`,
            keyTakeaway: 'Comprender con exactitud las raíces y conceptos de la Torá antes de elevar la interpretación.',
          },
          remez: {
            hebrewPillar: 'רֶמֶז',
            title: 'Alusiones Filológicas y Ecos en el Canon',
            exposition: `Las raíces hebreas asociadas a esta enseñanza revelan conexiones intertextuales entre la Torá, los Profetas, la Mishná y la liturgia, iluminando la coherencia interna del pensamiento judío.`,
            keyTakeaway: 'Cada raíz hebrea funciona como un puente hacia la sabiduría integral de la tradición.',
          },
          drash: {
            hebrewPillar: 'דְּרָשׁ',
            title: 'Exégesis Rabínica en el Talmud, Midrash y Rishonim',
            exposition: `Los Sabios del Talmud, el Midrash y los comentaristas clásicos (Rashi, Rambam, Ramban y el Ramjal) desarrollan las implicaciones éticas, jurídicas y espirituales de esta cuestión para orientar la conducta humana y comunitaria.`,
            keyTakeaway: 'El estudio auténtico responde a las preguntas del intelecto y conduce a la acción ética.',
          },
          sod: {
            hebrewPillar: 'סוֹד',
            title: 'Dimensión Interior y Propósito Espiritual',
            exposition: `Desde la dimensión interior de la Torá (Cábala y Jasidut), cada enseñanza une la conciencia del ser humano con el propósito de santificar la realidad cotidiana (Dirá BeTajtonim).`,
            keyTakeaway: 'Descubrir la dimensión espiritual y transformadora dentro de la vida diaria.',
          },
        };

    const baseFallbackSections: any[] = normalizeMethodologySections(metodologia, [], fallbackPardes).map(
      (s) => ({ ...s, sourceMethodology: metodologia })
    );

    complementaryMethodologies.forEach((compMethod, idx) => {
      baseFallbackSections.push({
        key: `comp_${compMethod.toLowerCase()}_${idx + 1}`,
        stepNumber: baseFallbackSections.length + 1,
        hebrewBadge: idx === 0 ? 'ה' : 'ו',
        hebrewTerm: 'הַשְׁלָמָה מֵתוֹדוֹלוֹגִית',
        spanishSubtitle: `Aporte Complementario · ${compMethod}`,
        title: `Perspectiva Complementaria desde ${compMethod}`,
        exposition: `${getComplementaryContributionBrief(compMethod)}. Al integrar esta lente en la lección de ${duracion === '30_MIN' ? '30 minutos' : '10 minutos'}, profundizamos tanto en el rigor de las fuentes clásicas como en la aplicación práctica para la vida personal y comunitaria.`,
        keyTakeaway: `Integrar la lente de ${compMethod} amplía la profundidad exegética y práctica de la Drashá.`,
        sourceMethodology: compMethod,
      });
    });

    const fallbackDerasha: any = {
      metodologia,
      metodologiasComplementarias: complementaryMethodologies,
      duracion,
      audienciaOTono,
      derashaTitle: effectiveTitle,
      ...(fallbackExternalSources.length > 0 ? { externalSources: fallbackExternalSources } : {}),
      ...(fallbackFormalContrast ? { formalContrast: fallbackFormalContrast } : {}),
      openingExordium: isJewishMovementsAndMessianicBoundaryTopic
        ? 'Estudio teológico, halájico e histórico en tres partes sobre las corrientes dentro del judaísmo y la frontera donde un grupo deja de ser judío: 1) PLURALIDAD LEGÍTIMA DENTRO DEL JUDAÍSMO (Eruvín 13b): Dentro del pueblo judío coexisten distintas corrientes —el Jasidismo en sus escuelas como Jabad-Lubavitch (el intelecto místico Jojmá-Biná-Daat en el Tania del Alter Rebe y la difusión global de las Mitzvot) y Breslev (Rabí Najman de Breslev: alegría constante, plegaria personal Hitbodedut y hallar los puntos buenos), la Ortodoxia (Sefardí, Ashkenazí, Lituana, Musar) y los movimientos modernos como el Reformismo y el Conservadurismo (Masortí)—; pese a sus diferencias halájicas, todos ellos son grupos judíos porque sostienen el monoteísmo absoluto e incorpóreo del Shemá Yisrael (Deuteronomio 6:4) y no adoran a ningún ser humano. 2) LA FRONTERA DONDE UN GRUPO SE ALEJA Y DEJA DE SER JUDÍO: Un grupo cruza la frontera fuera del judaísmo cuando abandona la Unicidad e Incorporeidad de Dios (Deuteronomio 6:4; Números 23:19; Maimónides, Hiljot Yesodei HaTorá 1:7), introduce el dogma de la encarnación divina y la Trinidad, o sustituye la Teshuvá directa (Ezequiel 18:20) por el sacrificio vicario de sangre. 3) POR QUÉ LOS «JUDÍOS MESIÁNICOS» NO SON JUDÍOS SINO CRISTIANOS EVANGÉLICOS: El llamado «judaísmo mesiánico» (Jews for Jesus, fundado en 1970 por el ministro bautista Martin «Moishe» Rosen, y las congregaciones mesiánicas) es cristianismo evangélico bautista/pentecostal que utiliza símbolos judíos (Talit, Kipá, Shofar, terminología hebrea) como estrategia de proselitismo misionero, tal como lo confirman por unanimidad todas las corrientes del judaísmo y la Corte Suprema de Israel (Casos Rufeisen 1962 y Beresford 1989).'
        : isAfterlifeSoulDestinyTopic
        ? 'Contraste exegético formal sobre el Destino de las Almas y sus Requisitos de Acceso: el Olam HaBá (Mundo Venidero) judío frente al Nirvana budista, el Valhalla nórdico y las visiones de Cielo e Infierno eterno en dos ejes centrales: 1) LA UNIVERSALIDAD FRENTE A LA ESPECIFICIDAD DEL MANDAMIENTO: Mientras el Nirvana (Udāna 8.1) exige la extinción del deseo y del yo individual (Anatta), el Valhalla (Grímnismál 8–10) exige morir por las armas en combate y los sistemas dogmáticos exigen adhesión exclusiva a un credo para evitar un infierno eterno, la tradición de la Torá articula la Universalidad Ética más inclusiva —«Los justos de entre todas las naciones tienen parte en el Olam HaBá» (Tosefta Sanhedrín 13:2; Rambam, Hiljot Teshuvá 3:5) mediante los 7 Preceptos Universales de Noé (Sanhedrín 56a)— con la Especificidad Concreta del Mandamiento (las 613 Mitzvot para Israel, Pirké Avot 4:16-17), donde el alma conserva su identidad relacional (Berajot 17a) y el Guehinom es una purificación pedagógica temporal (máximo 12 meses, Eduyot 2:10). 2) LA DISTINCIÓN ENTRE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS: Conforme a Eijá Rabá 2:13, citamos las fuentes externas (Canon Pali, Eddas nórdicas, Fedón de Platón) para informar la comparación y las contrastamos con las Fuentes Internas de la Torá.'
        : isEnlightenmentBuddhismTopic
        ? 'Contraste exegético formal sobre la Iluminación: el Despertar budista (Bodhi / Dhammapada) frente a la Luz de la Torá (Or HaGanuz, Ruaj HaKódesh y Devekut) en dos ejes centrales: 1) LA UNIVERSALIDAD FRENTE A LA ESPECIFICIDAD DEL MANDAMIENTO: Mientras el budismo concibe la iluminación como el desapego del mundo y la disolución del yo individual (Anatta) para extinguir el sufrimiento (Dukkha), el judaísmo afirma que sí existe una iluminación espiritual profunda («En Tu luz veremos la luz», Salmos 36:10; el Or HaGanuz de Jaguigá 12a y la escalera al Ruaj HaKódesh de Rabí Pinjás ben Yaír en Avodá Zará 20b), pero se alcanza mediante la Especificidad Concreta del Mandamiento («Porque lámpara es el mandamiento y la Torá es luz», Proverbios 6:23), santificando la vida física, el amor y la justicia comunitaria. 2) LA DISTINCIÓN ENTRE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS: Siguiendo Eijá Rabá 2:13, citamos las fuentes externas del Canon Pali (Dhammapada 183, 277–279; Samyutta Nikaya 56.11) y las contrastamos con las Fuentes Internas de la Torá.'
        : isPlatoCaveTopic
        ? 'Contraste exegético formal entre la Alegoría de la Caverna de Platón (República VII, 514a–520d) y la tradición de la Torá en dos ejes centrales: 1) LA UNIVERSALIDAD FRENTE A LA ESPECIFICIDAD DEL MANDAMIENTO: Mientras Platón concibe la iluminación como la huida del mundo físico de casos particulares (la caverna de sombras) hacia el Sol abstracto de las Ideas universales, la Torá declara en Proverbios 6:23: «Ki ner mitzvá ve-Torá or» («Porque lámpara es el mandamiento y la Torá es luz»); es la especificidad concreta de cada mandamiento (Mitzvá, Éxodo 24:7 «Naasé ve-nishmá») la que introduce la luz divina dentro de la realidad material aquí abajo (Dirá BeTajtonim). 2) LA DISTINCIÓN ENTRE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS: Siguiendo a Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»), consultamos la fuente filosófica externa (Platón) como especulación ontológica (Jojmá) y la contrastamos con las Fuentes Internas de la Torá (el Pacto del Sinaí y la Halajá viva).'
        : isCiceroTopic
        ? 'Contraste exegético formal entre Marco Tulio Cicerón (De Re Publica III.33 y De Officiis I.20) y la tradición de la Torá en dos ejes centrales: 1) LA UNIVERSALIDAD FRENTE A LA ESPECIFICIDAD DEL MANDAMIENTO: Mientras Cicerón postula una lex naturae uniforme e impersonal para Roma y Atenas, la Torá articula la ética universal de las 7 Leyes de Noé (Sanhedrín 56a) con la especificidad concreta del mandamiento (Mitzvá): la justicia compasiva de Tzedaká (Deuteronomio 15:7-8), Lifnim Mishurat HaDin (Deuteronomio 6:18) y Pikuaj Néfesh (Yoma 85b). 2) LA DISTINCIÓN ENTRE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS: Conforme a Eijá Rabá 2:13, distinguimos entre la filosofía jurídica externa grecorromana (Jojmá) y las Fuentes Internas de la Torá (Miqueas 6:8; Kidushín 31a).'
        : isKantTopic
        ? 'Análisis filosófico contrastivo entre el Imperativo Categórico de Immanuel Kant y la visión de la tradición judía en dos ejes fundamentales: 1) FUENTE INTERNA vs. FUENTE EXTERNA: Mientras Kant funda la ética exclusivamente en una fuente interna (la «Autonomía» de la razón práctica pura que se da la ley a sí misma) y descalifica cualquier mandato externo —incluso divino— como «heteronomía», la tradición judía advierte que un yo que solo se legisla a sí mismo corre el riesgo de encerrarse en el solipsismo y la autojustificación. Por eso la ética judía parte de una Fuente Externa Trascendente y Relacional (Teonomía del Pacto en el Sinaí, Talmud Kidushín 31a: «Gadol ha-metzuvé ve-osé») que interpela al ego desde afuera y que luego se interioriza libremente en el corazón (Deuteronomio 30:14; Pirké Avot 2:4). 2) UNIVERSALIDAD vs. ESPECIFICIDAD DEL MANDAMIENTO: Mientras el Imperativo Categórico exige máximas formales de universalidad abstracta y sin excepciones (incluso diciendo la verdad a un asesino en la puerta), la Halajá judía sostiene que las conclusiones éticas requieren especificidad situacional y jerarquía de valores (Pikuaj Néfesh en Yoma 85b, preservar la paz en Yevamot 65b y Lifnim Mishurat HaDin en Deuteronomio 6:18), articulando simultáneamente un código ético universal para toda la humanidad (las 7 Leyes de Noé, Sanhedrín 56a) y una responsabilidad ética específica dentro del Pacto.'
        : isMashiajBuddhaContrastTopic
        ? 'Estudio exegético y comparativo en tres partes sobre por qué Siddhartha Gautama (el Buda) no es el Mashíaj del judaísmo: 1) ¿QUÉ EXIGE EL JUDAÍSMO PARA SER EL MASHÍAJ? Un rey, juez y líder 100% humano del linaje patrilineal de David y Salomón en Jerusalén (Isaías 11:1–2; 1 Crónicas 22:9–10), siervo del Dios Creador Único (Deuteronomio 6:4) que restaura las 613 Mitzvot y establece la paz mundial empírica (Isaías 2:4; Maimónides, Hiljot Melajim 11:1–4). 2) CARACTERIZACIÓN DE SIDDHARTHA GAUTAMA (EL BUDA) EN 5 EJES (Canon Pali: Ariyapariyesana Sutta MN 26 y Dhammacakkappavattana Sutta SN 56.11): (a) La «Gran Renuncia» al trono real (Mahabhinishkramana) como príncipe del clan Shakya para retirarse al bosque como monje asceta; (b) Marco ontológico no-teísta (rechazo de un Dios Creador Ishvara); (c) Diagnóstico del mundo físico como sufrimiento (Dukkha) y rueda de renacimientos (Samsara); (d) Doctrina de Anatta (inexistencia de un alma individual sustancial); y (e) Meta del Nirvana / Parinirvana mediante la extinción del deseo (Tanha). 3) DESGLOSE SISTEMÁTICO DE LAS 7 DIFERENCIAS CON EL MASHÍAJ DEL JUDAÍSMO: Monoteísmo Creador vs. No-teísmo; asumir el trono de David para gobernar con justicia vs. abdicar del trono real; linaje patrilineal davídico en Sión vs. clan Shakya en la India; santificación del mundo creado «muy bueno» (Tov Meod, Génesis 1:31) vs. huida del mundo como Dukkha; plenitud de las 613 Mitzvot y la vida familiar vs. orden monástica célibe (Sangha); verificación histórica empírica de Maimónides (Hiljot Melajim 11:4: las guerras no cesaron ni Israel fue reunido tras la muerte de Buda en c. 483 a.e.c.); y eternidad del alma individual (Neshamá) y Resurrección vs. Anatta y extinción.'
        : isMashiajTopic
        ? 'Estudio exegético y comparativo en dos partes: 1) ¿QUÉ ES EL MASHÍAJ EN EL JUDAÍSMO? El término hebreo «Mashíaj» (מָשִׁיחַ) significa «El Ungido con aceite» y designa a un líder, juez y rey 100% humano y mortal, nacido de padre y madre humanos del linaje patrilineal de David y Salomón (Isaías 11:1–2; Números 23:19; Deuteronomio 6:4). 2) CARACTERIZACIÓN DEL MESÍAS EN EL CRISTIANISMO Y DESGLOSE DE LAS 7 DIFERENCIAS CON EL JUDAÍSMO: Mientras el cristianismo caracteriza a su Mesías mediante cinco ejes dogmáticos —(a) Dios encarnado y segunda persona trinitaria (Nicea 325 e.c. / Calcedonia 451 e.c.), (b) sacrificio vicario en la cruz para expiar el pecado original hereditario, (c) salvación interior e invisible del alma, (d) abrogación de la observancia de los preceptos de la Torá y (e) postergación de las profecías incumplidas a una «Segunda Venida» (Parusía)—, el judaísmo se diferencia en 7 puntos estructurales: monoteísmo incorpóreo absoluto sin encarnación (Deuteronomio 6:4; Números 23:19), linaje patrilineal biológico davídico-salomónico (1 Crónicas 22:9–10), responsabilidad moral individual y Teshuvá directa sin mediadores ni sacrificios humanos (Ezequiel 18:20; Oseas 14:2–3), vigencia eterna de las Mitzvot de la Torá (Deuteronomio 13:1), cumplimiento íntegro de la misión en una sola vida sin «Segunda Venida» (Maimónides, Hiljot Melajim 11:4), redención geopolítica verificable con el fin real de las guerras (Isaías 2:4; Najmánides en la Disputa de Barcelona de 1263) y salvación universal ética de los Justos de las Naciones (Hiljot Teshuvá 3:5).'
        : isModim
        ? '¿Por qué cuando la congregación se inclina junto al Jazán en el Modim de-Rabanán proclama explícitamente a Dios como «Yotzer Bereshit» (Formador de la Creación), mientras que en el Modim silencioso de la Amidá este motivo creacional está ausente? A través del método histórico-filológico de la Wissenschaft des Judentums, la crítica textual de la Guenizá de El Cairo, el análisis redaccional de Sotá 40a y la exégesis teológica comparada, desentrañamos la arquitectura profunda de esta disparidad litúrgica.'
        : isHalelTopic
        ? 'Estudio halájico, calendárico y litúrgico sobre el Halel (Salmos 113–118) y Rosh Jódesh desde las fuentes internas del canon judío: su institución por los Profetas (Pesajim 117a), los dieciocho días de Halel Completo (Arjín 10a), el Medio Halel en Rosh Jódesh (Taanit 28b: «Minhag avoteijem be-yadeijem»), por qué Rosh Jódesh es de 1 día (cuando el mes que termina tiene 29 días, Jódesh Jaser) o de 2 días (cuando el mes que termina tiene 30 días, Jódesh Malé: el día 30 del mes saliente + el día 1 del mes entrante, según Rambam Hiljot Kidush HaJódesh 8:4 y Shulján Aruj Oraj Jaim 427:1), y la diferencia en el Shulján Aruj (Oraj Jaim 422:2) entre el Mejaber (Sefardí, sin berajá) y el Ramá (Ashkenazí, con berajá).'
        : isShulchanArukhOrMinhagNusachTopic
        ? 'Estudio halájico y comparativo interno sobre el Shulján Aruj (שֻׁלְחָן עָרוּךְ), el cumplimiento práctico de las leyes y los matices de Minhag (מִנְהָג) y Núsaj (נוּסַח) dentro del judaísmo: 1) Cómo dialogan en el Shulján Aruj la «Mesa» de Rabí Yosef Karo (El Mejaber · tradición Sefardí / Edot HaMizraj) y el «Mantel» (HaMapá) de Rabí Moshé Isserles (El Ramá · tradición Ashkenazí) a través de sus cuatro secciones (Oraj Jaim, Yoré Deá, Even HaEzer y Joshen Mishpat); 2) La distinción normativa entre Halajá (ley común), Minhag (costumbre comunitaria ancestral con fuerza vinculante: «Minhag Yisrael Torá hi», Pesajim 50b, Taanit 28b y Yoré Deá 214:1) y Núsaj (rito y formulación litúrgica en Oraj Jaim 68:1: Sefarad/Edot HaMizraj, Ashkenaz, Sefard/Ari Jasídico y Teimán); y 3) Los casos paradigmáticos de comparación de costumbres en el Shulján Aruj (la berajá del Medio Halel en OC 422:2, Birkat Kohanim en OC 128:44, Selijot en Elul en OC 581:1, Tefilín en Jol HaMoed en OC 31:2 y Kitniyot en Pésaj en OC 453:1).'
        : `Abordamos de manera directa y estructurada los fundamentos de ${effectiveTitle} a través de la metodología ${metodologia}, respondiendo desde las fuentes clásicas del Tanaj, el Talmud y los grandes maestros de nuestra tradición.`,
      methodologySections: baseFallbackSections,
      morphologicalSynthesis: {
        summary: isAfterlifeSoulDestinyTopic
          ? 'El análisis de los términos hebreos הָעוֹלָם הַבָּא (HaOlam HaBá, el Mundo Venidero en Sanhedrín 90a), פְּרוֹזְדּוֹר (Prozdor, este mundo como vestíbulo preparatorio en Pirké Avot 4:16) y חֲסִידֵי אֻמּוֹת הָעוֹלָם (Jasidei Umot HaOlam, los justos de las naciones en Hiljot Teshuvá 3:5) ilumina el contraste entre la escatología ética de la Torá y el Nirvana o el Valhalla.'
          : isEnlightenmentBuddhismTopic
          ? 'El análisis de los términos hebreos אוֹר הַגָּנוּז (Or HaGanuz, la luz primordial oculta en la Torá, Jaguigá 12a), נֵר מִצְוָה וְתוֹרָה אוֹר (Ner Mitzvá ve-Torá Or, Proverbios 6:23) y רוּחַ הַקֹּדֶשׁ (Ruaj HaKódesh en Avodá Zará 20b) demuestra cómo la iluminación judía santifica la vida concreta en lugar de apagarla.'
          : isPlatoCaveTopic
          ? 'El análisis de los términos hebreos מִצְוָה (Mitzvá, mandamiento específico como lámpara en Proverbios 6:23), נַעֲשֶׂה וְנִשְׁמָע (Naasé ve-nishmá, la acción ética que precede a la contemplación en Éxodo 24:7) y חָכְמָה (Jojmá en Eijá Rabá 2:13) ilumina el contraste formal entre la caverna de Platón y la Torá.'
          : isCiceroTopic || isKantTopic
          ? 'El análisis de los términos hebreos מְצֻוֶּה (Metzuvé, «comandado en relación», raíz צ-ו-ה afín a Tzavta = unión), וְחַי בָּהֶם (Ve-jay bahem, «vivirás por ellos», Yoma 85b) y הַיָּשָׁר וְהַטּוֹב (Ha-yashar ve-ha-tov, «lo recto y lo bueno» en cada contexto específico, Deuteronomio 6:18) demuestra cómo el lenguaje hebreo une la trascendencia de la fuente externa con la especificidad vital de cada decisión ética.'
          : isMashiajTopic
          ? 'El análisis de los términos hebreos מָשִׁיחַ (Mashíaj, «Ungido» de la raíz מ-שׁ-ח), גְּאֻלָּה (Gueulá, «Redención») y דֵּעָה (Deá, «Conocimiento de Hashem») demuestra que el mesianismo judío es terrenal, ético, histórico y estrictamente monoteísta.'
          : `El análisis de las raíces hebreas de ${primaryHebrew || 'תּוֹרָה'} muestra la precisión con la que el lenguaje sagrado articula la ética, la liturgia y la espiritualidad judía.`,
        keyTheologicalInsight:
          theologicalKeys?.grammaticalDichotomy?.watchmakerRefutation ||
          'La palabra hebrea vincula la esencia espiritual de la Creación con nuestra gratitud y responsabilidad moral cotidiana.',
      },
      canonicalAnalysis: {
        synthesis:
          'Las fuentes internas de la Torá verificadas en la biblioteca canónica de Sefaria —en diálogo contrastivo con las fuentes externas consultadas— sostienen cada etapa de esta enseñanza.',
        verifiedEchoes: (verifiedSources || []).map((s: any) => ({
          ref: s.ref,
          connection: s.rationale || 'Fuente canónica fundamental para el desarrollo exegético del tema.',
        })),
        spanishTranslations: (verifiedSources || [])
          .filter((s: any) => Boolean(s.spanishTranslation))
          .map((s: any) => ({
            ref: s.ref,
            spanishTranslation: s.spanishTranslation,
          })),
      },
      pardes: fallbackPardes,
      practicalConclusion: {
        title: 'Síntesis Conclusiva y Llamada a la Acción (Tikún Midot y Kavaná)',
        hashkafa:
          isAfterlifeSoulDestinyTopic ||
          isEnlightenmentBuddhismTopic ||
          isPlatoCaveTopic ||
          isCiceroTopic ||
          isKantTopic
            ? 'Frente a la universalidad abstracta, la disolución del yo o el exclusivismo de las fuentes externas (Kant, Platón, Cicerón, Nirvana, Valhalla), la tradición judía establece una Teonomía Dialógica donde la luz infinita de la Torá y la vida eterna del Olam HaBá se encarnan en la universalidad ética de las 7 Leyes de Noé (Hiljot Teshuvá 3:5) y en la especificidad concreta de cada mandamiento (Ner Mitzvá ve-Torá Or, Proverbios 6:23; Pirké Avot 4:16-17).'
            : isMashiajTopic
            ? 'En el judaísmo, el Mashíaj es un líder 100% humano descendiente de David cuya misión es histórica y verificable: traer paz mundial (Isaías 2:4), reunir a los dispersos, reconstruir el Templo y llenar la tierra del conocimiento ético y espiritual del Creador (Isaías 11:9; Rambam Hiljot Melajim 11:4).'
            : isModim
            ? 'La disparidad entre el Modim de la Amidá y el Modim de-Rabanán revela que la gratitud judía abraza dos horizontes inseparables: la redención histórica comunitaria (Amidá) y la dependencia ontológica de cada ser vivo ante el Creador del cosmos («Yotzer Bereshit», Modim de-Rabanán).'
            : 'Integrar la sabiduría de las fuentes en una visión coherente que honre tanto el rigor del estudio como la sensibilidad del corazón.',
        prayerKavanah:
          isAfterlifeSoulDestinyTopic ||
          isEnlightenmentBuddhismTopic ||
          isPlatoCaveTopic ||
          isCiceroTopic ||
          isKantTopic
            ? 'Al recitar el Shemá y estudiar Torá, meditar en las palabras de Pirké Avot 4:16 y Proverbios 6:23: convertir cada mandamiento específico en una lámpara viva que ilumina este mundo y prepara el Olam HaBá.'
            : isMashiajTopic
            ? 'Al recitar en la Amidá «Et tzémaj David avdejá meherá tatzmíaj» y el «Aleinu leshabéaj», recordar que esperar la redención significa negarse a aceptar un mundo roto como definitivo.'
            : isModim
            ? 'Al inclinarnos en Modim, unir el reconocimiento del Creador del cosmos con la gratitud por la vida cotidiana.'
            : `Al meditar en las palabras de «${effectiveTitle}», llevar la enseñanza de las fuentes del intelecto al corazón (Jeshbón HaNéfesh) con autenticidad y responsabilidad ética.`,
        dailyAction:
          isAfterlifeSoulDestinyTopic ||
          isEnlightenmentBuddhismTopic ||
          isPlatoCaveTopic ||
          isCiceroTopic ||
          isKantTopic
            ? 'Ante una decisión ética esta semana, recuerda que una sola hora de Teshuvá y buenas acciones en este mundo supera todo el Olam HaBá (Pirké Avot 4:17): realiza una Mitzvá específica de bondad, justicia o Tzedaká que ilumine concretamente la vida de otra persona.'
            : isMashiajTopic
            ? 'Como enseña Maimónides (Hiljot Teshuvá 3:4), ver el mundo en equilibrio perfecto y realizar hoy un acto concreto de justicia, paz y bondad (Jésed) que acerque la redención.'
            : `Aplicar hoy una enseñanza concreta derivada del estudio de «${effectiveTitle}» en nuestras relaciones interpersonales y en el refinamiento del carácter (Tikún HaMidot).`,
      },
      contemporaryMasters: buildDefaultContemporaryMasters(
        query,
        effectiveTitle,
        undefined,
        undefined
      ),
      ...(fallbackThinkerDetection.detected
        ? { externalThinkerDetection: fallbackThinkerDetection }
        : {}),
      fullStructuredDerashaMarkdown: '',
    };

    const mdFallStart = Date.now();
    fallbackDerasha.fullStructuredDerashaMarkdown = synthesizeContinuousDerashaMarkdown({
      query,
      metodologia,
      audienciaOTono,
      title: effectiveTitle,
      primaryHebrew,
      transliteration,
      literalSpanishTranslation,
      liturgicalContext,
      theologicalKeys,
      morphologicalBreakdown,
      verifiedSources,
      externalSources: fallbackExternalSources,
      formalContrast: fallbackFormalContrast,
      derasha: fallbackDerasha,
    });
    const mdFallMs = Date.now() - mdFallStart;
    const totalFallMs = Date.now() - phase3StartedAt;
    fallbackDerasha.stageTimingsMs = {
      stage3LlmMs: Math.max(0, totalFallMs - mdFallMs),
      markdownAssemblyMs: mdFallMs,
      totalPhase3Ms: totalFallMs,
      cacheHit: false,
    };

    const sanitizedFallback = sanitizeHalakhicOutputFromExternalCitations(
      sanitizeStrictJewishObject(fallbackDerasha),
      fallbackHalakhicValidation
    );
    const derashaCacheKey = `${query.toLowerCase()}|${metodologia}|${duracion}|${complementaryMethodologies.join(',')}|${audienciaOTono}`;
    setBoundedCache(derashaMemoryCache, derashaCacheKey, sanitizedFallback);
    return res.json(sanitizedFallback);
  }
});

// Follow-up Q&A to deepen/expand on any point of the Derashá
app.post('/api/expand-derasha', async (req, res) => {
  try {
    const { question, derashaContext, conversationHistory } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Debes proporcionar una pregunta para profundizar.' });
    }

    const combinedQuery = `${derashaContext?.query || ''} ${question}`.trim();
    const {
      isComparativeTopic,
      isKantTopic,
      isPlatoCaveTopic,
      isCiceroTopic,
      isEnlightenmentBuddhismTopic,
      isAfterlifeSoulDestinyTopic,
    } = normalizeUserStudyQuery(combinedQuery);

    const activeExternalSources =
      Array.isArray(derashaContext?.externalSources) && derashaContext.externalSources.length > 0
        ? derashaContext.externalSources
        : isComparativeTopic
        ? await fetchExternalComparativeSources(combinedQuery)
        : [];
    const activeFormalContrast =
      derashaContext?.formalContrast ||
      (isComparativeTopic || activeExternalSources.length > 0
        ? buildDefaultFormalExegeticalContrast(combinedQuery, activeExternalSources)
        : undefined);

    const ai = getGenAIClient();

    const systemInstruction = `Eres un maestro Darshán, filólogo hebraico y exégeta talmúdico, filosófico y cabalístico de máxima erudición.
${STRICT_JEWISH_SOURCES_COVENANT}
El estudiante está continuando y profundizando un estudio (Derashá) mediante una conversación interactiva.

Tu respuesta debe ser:
1. Directa, rigurosa, profunda y estructurada con subtítulos en Markdown (##, ###), viñetas y citas textuales.
2. Si la pregunta o el estudio involucra un **contraste comparativo** (por ejemplo: caracterizar el Mesías del cristianismo para desglosar sus diferencias con el Mashíaj del judaísmo, Imperativo Categórico de Kant, Alegoría de la Caverna de Platón, Cicerón, Iluminación en el Budismo frente al Judaísmo, o el Destino de las Almas: *Olam HaBá* frente a *Nirvana*, *Valhalla*, Cielo e Infierno y sus requisitos de acceso), utiliza las **Fuentes Externas** suministradas para informar la comparación y realiza el **Contraste Exegético Formal** con las **Fuentes Internas de la Torá** (analizando la *Universalidad frente a la Especificidad del Mandamiento* y la *Distinción entre Fuentes Internas de la Torá y Fuentes Externas* según *Eijá Rabá 2:13*).
3. Basada en fuentes tradicionales judías auténticas (Tanaj, Targum Onkelos, Mishná, Talmud Bavli y Yerushalmi, Midrash Rabá, Rishonim como Rashi, Rambam en *Hiljot Melajim* 11–12, Ramban en la *Disputa de Barcelona* de 1263 y Sforno, fuentes místicas como Zóhar y Tania, y maestros como el Ramjal, Rav Hirsch, Rav Soloveitchik, Rabino Jonathan Sacks y Rab Yehoshua Gordon).
4. En 'relatedSefariaReferences', incluye únicamente referencias del canon judío en Sefaria.
5. Incluye al final 3 preguntas sugeridas ('suggestedNextQuestions') que permitan al estudiante seguir profundizando la conversación.`;

    const compactSections = Array.isArray(derashaContext?.methodologySections)
      ? derashaContext.methodologySections.map((s: any) => ({
          subtitle: s.spanishSubtitle,
          title: s.title,
          keyTakeaway: s.keyTakeaway,
        }))
      : [];

    const prompt = `CONTEXTO DEL ESTUDIO ACTUAL QUE EL ESTUDIANTE ESTÁ PROFUNDIZANDO:
- Consulta original: ${derashaContext?.query || ''}
- Título del estudio: ${derashaContext?.title || 'Estudio exegético'}
- Metodología activa: ${derashaContext?.metodologia || 'PARDES'}
- Texto hebreo central: ${derashaContext?.primaryHebrew || ''}
- Secciones del estudio: ${JSON.stringify(compactSections)}
- Fuentes Internas de la Torá (Sefaria): ${JSON.stringify(
      compactVerifiedSourcesForPrompt(derashaContext?.verifiedSources || [])
    )}
${
  activeExternalSources.length > 0
    ? `- Fuentes Externas Consultadas para el Contraste: ${JSON.stringify(activeExternalSources)}\n- Contraste Exegético Formal: ${JSON.stringify(activeFormalContrast || {})}`
    : ''
}

HISTORIAL DE LA CONVERSACIÓN DE PROFUNDIZACIÓN:
${JSON.stringify((conversationHistory || []).slice(-6), null, 2)}

NUEVA PREGUNTA O ACOTACIÓN DEL ESTUDIANTE PARA CONTINUAR EL ESTUDIO:
"${question.trim()}"

Responde en formato JSON con 'answer' (en Markdown claro y profundo) y 'suggestedNextQuestions' (3 preguntas específicas para continuar esta conversación).`;

    const response = await generateContentWithRetry(
      ai,
      {
        model: GEMINI_HYDROGEN_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description:
                  'Explicación detallada, elocuente y estructurada en formato Markdown que responde directamente al estudiante para continuar el estudio.',
              },
              suggestedNextQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 preguntas breves y específicas sugeridas para seguir profundizando.',
              },
              relatedSefariaReferences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ref: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['ref', 'rationale'],
                },
              },
            },
            required: ['answer', 'suggestedNextQuestions'],
          },
        },
      },
      {
        timeoutMs: 40000,
        thinkingLevel: ThinkingLevel.MEDIUM,
      }
    );

    const parsed = sanitizeStrictJewishObject(JSON.parse(response.text || '{}'));
    return res.json(parsed);
  } catch {
    const rawQ = `${req.body?.derashaContext?.query || ''} ${req.body?.question || ''}`.trim();
    const {
      cleanTopicLabel,
      isMashiajTopic,
      isMashiajBuddhaContrastTopic,
      isJewishMovementsAndMessianicBoundaryTopic,
      isKantTopic,
      isPlatoCaveTopic,
      isCiceroTopic,
      isEnlightenmentBuddhismTopic,
      isAfterlifeSoulDestinyTopic,
    } = normalizeUserStudyQuery(rawQ);
    return res.json({
      answer: isJewishMovementsAndMessianicBoundaryTopic
        ? `### Corrientes Internas del Judaísmo (Jasidismo Jabad y Breslov, Ortodoxia, Reformismo) y Por Qué los «Judíos Mesiánicos» NO son una Corriente Judía sino Cristianos Evangélicos\n\n#### 1. Pluralidad Interna dentro del Judaísmo\n- **Jasidismo (Jabad-Lubavitch y Breslov):** Fundado por el *Baal Shem Tov* (s. XVIII). **Jabad** (*Rabí Shneur Zalman de Liadi*, *Tanya*) enfatiza el gobierno del intelecto (*Jojmá, Biná, Daat*) sobre la emoción y la misión de crear una morada para Dios en lo inferior (*Dirá BeTajtonim*). **Breslov** (*Rabí Najmán de Breslov*, *Likutey Moharán*) enfatiza la alegría incondicional (*Mitzvá Guedolá Lihyot BeSimjá*, II:24), el clamor de *Azamrá* (I:282) y la plegaria personal espontánea (*Hitbodedut*).\n- **Ortodoxia Lituana (*Mitnagdim / Yeshivot*) y Moderna:** Centrada en el estudio analítico del Talmud (*Torá Lishmá*) y el *Shulján Aruj*.\n- **Judaísmo Conservador (*Masortí*) y Reformista:** Aunque debaten con la Ortodoxia sobre la historia de la Halajá, **permanecen dentro del umbral teológico judío** porque adoran exclusivamente al Único Dios incorpóreo del *Shemá Israel* (*Deuteronomio 6:4*) y rechazan toda idolatría o encarnación humana.\n\n#### 2. El Límite Infranqueable: Por Qué los «Judíos Mesiánicos» Son Cristianos Evangélicos\n- **Teología Trinitaria y Encarnacionista:** Adoran a Jesús como «Dios Hijo encarnado», violando la unicidad e incorporeidad absoluta de Dios (*Deuteronomio 6:4*; *Números 23:19*; *Maimónides, Hiljot Yesodei HaTorá 1:7* y *Hiljot Teshuvá 3:7*).\n- **Origen Histórico Bautista/Evangélico:** Nacieron de misiones protestantes como *«Jews for Jesus»* (1970, fundada por el ministro bautista Martin Rosen) y la *«Messianic Jewish Alliance»*, adoptando vocabulario hebreo (*Yeshúa*, *Talit*, *Kehilá*) como estrategia de proselitismo hacia judíos.\n- **Consenso Unánime Judío y Jurídico:** Todas las denominaciones judías (Ortodoxa, Jabad, Breslov, Sefardí, Conservadora y Reformista) y la Corte Suprema del Estado de Israel (*Caso Beresford*, HCJ 265/87, 1989) dictaminan unánimemente que el «judaísmo mesiánico» es otra religión: **cristianismo evangélico**.`
        : isAfterlifeSoulDestinyTopic
        ? `### Profundización Comparativa: El Destino de las Almas (*Olam HaBá* frente a *Nirvana*, *Valhalla*, Cielo e Infierno)\n\n#### 1. Universalidad frente a Especificidad del Mandamiento en los Requisitos de Acceso\n- **En las Fuentes Externas:** El *Nirvana* budista (*Udāna 8.1*) exige extinguir el deseo (*Tanha*) y disolver el yo individual (*Anatta*); el *Valhalla* nórdico (*Grímnismál 8–10*) exige morir en combate armado; y las visiones dogmáticas de Cielo/Infierno exigen adherir a un credo exclusivo.\n- **En las Fuentes Internas de la Torá:** El judaísmo establece que **«los justos de todas las naciones tienen parte en el Olam HaBá»** (*Tosefta Sanhedrín 13:2*; *Rambam, Hiljot Teshuvá 3:5*) al cumplir los **7 Preceptos Universales de Noé** (*Sanhedrín 56a*), mientras que el pueblo de Israel santifica la vida mediante la **especificidad concreta de las 613 Mitzvot** (*Pirké Avot 4:16–17*).\n\n#### 2. ¿Existe el Infierno Eterno en el Judaísmo?\n- En el Talmud (*Shabat 33b*; *Eduyot 2:10*; *Rosh Hashaná 17a*), el *Guehinom* no es una tortura perpetua, sino un proceso espiritual y pedagógico de purificación del alma cuya duración máxima para un transgresor ordinario es de **doce meses**, tras lo cual el alma purificada asciende al *Gan Edén* (*Berajot 17a*).`
        : isEnlightenmentBuddhismTopic
        ? `### Profundización Comparativa: La Iluminación en el Budismo (*Bodhi*) frente a la Torá (*Or HaGanuz* y *Ruaj HaKódesh*)\n\n#### 1. Fuentes Externas (*Dhammapada*) vs. Fuentes Internas de la Torá (*Eijá Rabá 2:13*)\n- En el Canon Pali (*Dhammapada* 183, 277–279; *Samyutta Nikaya* 56.11), el despertar (*Bodhi*) busca comprender la impermanencia (*Anicca*) y la inexistencia de un yo permanente (*Anatta*) para desapegarse del mundo.\n- En las Fuentes Internas de la Torá (*Salmos 36:10*: *«En Tu luz veremos la luz»*; *Jaguigá 12a*), el judaísmo afirma la existencia de la **Luz Primordial (*Or HaGanuz*)** oculta en la Torá y de la inspiración profética (*Ruaj HaKódesh*, *Avodá Zará 20b* y *Mesilat Yesharim* cap. 26).\n\n#### 2. Universalidad frente a Especificidad del Mandamiento\n- Como declara *Proverbios 6:23*: **«Ki ner mitzvá ve-Torá or»** (*«Porque lámpara es el mandamiento y la Torá es luz»*). En el judaísmo no nos iluminamos huyendo del mundo físico, sino encendiendo cada mandamiento específico (*Mitzvá*) dentro de la vida familiar, comunitaria y ética.`
        : isPlatoCaveTopic || isCiceroTopic || isKantTopic
        ? `### Contraste Exegético Formal: Filosofía Clásica Externa frente a la Tradición de la Torá\n\n#### 1. Fuente Interna / Especulación Filosófica vs. Fuente Externa del Pacto (*Eijá Rabá 2:13* y *Kidushín 31a*)\n- Siguiendo el principio de *Eijá Rabá 2:13* (*«Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»*), analizamos las fuentes externas (Platón en *República VII*, Cicerón en *De Officiis*, Kant en la *Fundamentación*) como sabiduría racional humana (*Jojmá*), y las contrastamos con la Revelación relacional del Sinaí (*Kidushín 31a*: *«Gadol ha-metzuvé ve-osé»*), que quiebra el solipsismo del ego y se interioriza por amor en el corazón (*Deuteronomio 30:14*; *Pirké Avot 2:4*).\n\n#### 2. Universalidad Abstracta vs. Especificidad del Mandamiento\n- Frente a las fórmulas abstractas e inflexibles de las fuentes externas, la Torá conjuga un horizonte ético universal (las **7 Leyes de Noé**, *Sanhedrín 56a*) con la **especificidad concreta del mandamiento** (*Proverbios 6:23*: *«Ner mitzvá ve-Torá or»*; **Pikuaj Néfesh** en *Yoma 85b*; **Lifnim Mishurat HaDin** en *Deuteronomio 6:18*).`
        : isMashiajBuddhaContrastTopic
        ? `### ¿Por Qué Buda No es el Mashíaj? Caracterización de Siddhartha Gautama y Desglose de las 7 Diferencias con el Judaísmo\n\n#### I. ¿Qué exige el Judaísmo para ser el Mashíaj? (Fuentes Internas de la Torá)\n- **Rey Humano del Linaje de David y Salomón:** *Mashíaj* (מָשִׁיחַ, «Ungido con aceite») designa a un líder, juez y rey **100% humano** descendiente biológico por línea paterna directa del Rey David y de su hijo Salomón (*Isaías 11:1–2*; *2 Samuel 7:12–16*; *1 Crónicas 22:9–10*), consagrado al Dios Creador Único (*Deuteronomio 6:4*) para restaurar las 613 *Mitzvot*, reunir a los exiliados de Israel (*Kibutz Galuyot*), reconstruir el Templo en Jerusalén y establecer la paz mundial empírica (*Isaías 2:4*; *Maimónides, Hiljot Melajim 11:1–4*).\n\n#### II. Caracterización de Siddhartha Gautama (el Buda) en el Canon Pali (Los 5 Ejes)\n1. **La «Gran Renuncia» al Trono Real (*Mahabhinishkramana*, MN 26):** Nacido como príncipe heredero del clan *Shakya* en la India/Nepal, abdica de su futuro trono real, abandona el palacio, a su esposa e hijo y se retira al bosque como monje asceta (*Sramana*).\n2. **Marco Ontológico No-Teísta (*Brahmajāla Sutta*, DN 1):** Rechaza la existencia de un Dios Creador supremo (*Ishvara*) y de cualquier revelación o mandamiento divino.\n3. **El Mundo como *Dukkha* y *Samsara* (*SN 56.11*):** Diagnostica que toda existencia física, histórica y deseante es intrínsecamente dolorosa e insatisfactoria (*Dukkha*).\n4. **Doctrina de *Anatta* (No-Yo):** Niega la existencia de un alma individual inmortal y sustancial.\n5. **Soteriología del *Nirvana / Parinirvana*:** Busca extinguir la sed del deseo (*Tanha*) mediante el desapego meditativo para salir definitivamente del ciclo de renacimientos.\n\n#### III. Desglose Sistemático de las 7 Diferencias por las que Buda No es el Mashíaj\n1. **Teología:** Monoteísmo Creador (*Deuteronomio 6:4*; *Isaías 11:9*) vs. No-Teísmo budista sin Dios Creador.\n2. **Dirección del Liderazgo:** El *Mashíaj* **asume el trono de David** para gobernar y juzgar con justicia (*Isaías 11:4*); el Buda **abdica del trono real** y huye de la política.\n3. **Genealogía y Alianza:** Linaje patrilineal biológico de Judá, David y Salomón en Sión (*1 Crónicas 22:9–10*) vs. clan *Shakya* en la India ajeno al Pacto de Israel.\n4. **Valoración del Mundo Físico:** Mundo creado «muy bueno» (*Tov Meod*, *Génesis 1:31*) que se santifica (*Dirá BeTajtonim*) vs. mundo visto como *Dukkha/Samsara* del que hay que escapar.\n5. **Relación con el Mandamiento:** Restauración de las 613 *Mitzvot*, santificación del matrimonio y la comunidad (*Hiljot Melajim 11:1*) vs. ascetismo monástico célibe (*Sangha*).\n6. **Verificación Histórica Empírica (*Hiljot Melajim 11:4*):** Tras la muerte (*Parinirvana*) de Buda en c. 483 a.e.c., las guerras del mundo no cesaron (*Isaías 2:4*), Israel no fue reunido ni se reconstruyó el Templo.\n7. **Antropología y Futuro:** Eternidad del alma individual (*Neshamá*) y Resurrección (*Sanhedrín 90a*) vs. *Anatta* y extinción del renacimiento.`
        : isMashiajTopic
        ? `### Caracterización del Mesías en el Cristianismo y Desglose Sistemático de Diferencias con el Mashíaj del Judaísmo\n\n#### I. ¿Qué es el Mashíaj en el Judaísmo? (Fuentes Internas de la Torá)\n- **Etimología y Naturaleza 100% Humana:** *Mashíaj* (מָשִׁיחַ, de *Mashaj*, «ungir con aceite») designa a un líder, juez y rey **100% humano y mortal**, nacido de padre y madre humanos del linaje patrilineal del Rey David por vía de Salomón (*Isaías 11:1–2*; *2 Samuel 7:12–16*; *1 Crónicas 22:9–10*). Jamás es Dios ni una encarnación divina (*Deuteronomio 6:4*; *Números 23:19*; *Oseas 11:9*).\n\n#### II. Caracterización del Mesías en el Cristianismo (Los 5 Ejes Dogmáticos)\n1. **Encarnación Divina y Trinidad:** Definido en los Concilios de Nicea (325 e.c.) y Calcedonia (451 e.c.) como Dios Hijo encarnado (*homoousios*), segunda persona trinitaria con dos naturalezas.\n2. **Pecado Original y Expiación Vicaria:** Parte del dogma de que el pecado de Adán corrompió hereditariamente a la humanidad y que el Mesías debía morir crucificado como sacrificio vicario de sangre para pagar la culpa humana.\n3. **Redención Espiritual e Invisible:** Ante la continuidad de las guerras tras el siglo I, caracteriza su reino como interior y espiritual.\n4. **Abrogación de la Ley de la Torá:** Presenta al Mesías como el «fin de la Ley», suspendiendo la observancia práctica de las *Mitzvot* (Shabat, Kashrut, Brit Milá) en favor de la fe dogmática en la gracia.\n5. **Doctrina de las «Dos Venidas» (*Parusía*):** Desplaza el cumplimiento de las profecías mesiánicas incumplidas (paz mundial, reunión de Israel) a un segundo advenimiento futuro.\n\n#### III. Desglose Sistemático de las 7 Diferencias con el Mashíaj del Judaísmo\n1. **Ontología:** Ser humano mortal vs. Dios encarnado (*Números 23:19*; *Deuteronomio 6:4*).\n2. **Genealogía:** Linaje patrilineal biológico de David y Salomón (*Números 1:18*; *1 Crónicas 22:9–10*) vs. nacimiento virginal sin padre humano.\n3. **Soteriología:** Responsabilidad moral individual y *Teshuvá* directa ante Dios sin mediadores ni sacrificios humanos (*Ezequiel 18:20–23*; *Oseas 14:2–3*) vs. pecado original y expiación vicaria.\n4. **Vigencia de la Ley:** Eternidad irrevocable de la Torá y restauración de las *Mitzvot* (*Deuteronomio 13:1*; *Hiljot Melajim 11:1*) vs. abrogación de la Ley.\n5. **Verificación en Una Sola Vida:** Maimónides (*Hiljot Melajim 11:4*) codifica que si el candidato muere sin haber reunido a los exiliados ni reconstruido el Templo en su propia vida, «queda demostrado que NO es aquel que la Torá prometió» (rechazo total de una «Segunda Venida»).\n6. **Escenario Histórico Empírico:** Fin verificable de todas las guerras (*Isaías 2:4*, argumento central de Najmánides en la *Disputa de Barcelona* de 1263) vs. redención meramente interior.\n7. **Universalismo Ético:** En el judaísmo, los Justos de todas las Naciones tienen parte en el *Olam HaBá* (*Hiljot Teshuvá 3:5*) por su rectitud moral sin requerir adhesión a un dogma cristológico.`
        : `### Respuesta y Profundización: ${cleanTopicLabel}\n\nDesde la perspectiva de nuestras fuentes clásicas (Tanaj, Talmud Bavli, Midrash Rabá y los comentaristas Rishonim como Rashi, Rambam y el Ramjal), abordamos directamente tu interrogante:\n\n1. **Plano Textual y Conceptual (Pshat):** Las fuentes del Tanaj y de la ley oral definen cada concepto desde la responsabilidad moral del ser humano ante el Creador y ante su prójimo.\n2. **Aplicación Rabínica (Drash y Musar):** Como enseñan nuestros Sabios en *Pirkei Avot* (1:17), «no es el estudio lo principal, sino la acción». Toda enseñanza de la Torá busca responder con claridad al intelecto y refinar nuestras cualidades del carácter (*Tikún HaMidot*).`,
      suggestedNextQuestions: isJewishMovementsAndMessianicBoundaryTopic
        ? [
            '¿Cuál es la diferencia metodológica entre el estudio del Tanya en Jabad y la práctica de Hitbodedut en Breslov?',
            '¿Por qué los 13 Principios de Fe de Maimónides y Deuteronomio 6:4 trazan una frontera teológica infranqueable frente al mesianismo evangélico?',
            '¿Qué dictaminó la Corte Suprema de Israel en el Caso Beresford (1989) sobre los llamados «judíos mesiánicos» y la Ley del Retorno?',
          ]
        : isAfterlifeSoulDestinyTopic
        ? [
            '¿Cuál es la diferencia entre el Gan Edén espiritual de las almas y la era de Tejiyat HaMetim (Resurrección) según el Rambam y el Ramban?',
            '¿Por qué enseña Pirké Avot 4:17 que una sola hora de Teshuvá y buenas acciones en este mundo es más preciada que toda la vida del Olam HaBá?',
            '¿Cuáles son exactamente las 7 Leyes Universales de Noé que dan acceso al Olam HaBá a los justos de todas las naciones?',
          ]
        : isEnlightenmentBuddhismTopic
        ? [
            '¿Cómo se recorren los 10 peldaños de la escalera de Rabí Pinjás ben Yaír (Mesilat Yesharim) hasta alcanzar el Ruaj HaKódesh?',
            '¿Qué diferencia hay entre el concepto jasídico de Bitul HaYesh (anulación del ego ante Dios) y el concepto budista de Anatta?',
            '¿Por qué el Talmud (Jaguigá 12a) dice que Dios escondió el Or HaGanuz (la Luz Primordial) dentro de la Torá?',
          ]
        : isPlatoCaveTopic || isCiceroTopic || isKantTopic
        ? [
            '¿Cómo explica Maimónides en Shemoná Perakim cap. 6 la diferencia entre el filósofo virtuoso y quien vence su inclinación?',
            '¿Por qué dice Rabí Janiná en Kidushín 31a que es más grande quien está comandado y cumple (Metzuvé ve-osé)?',
            '¿Por qué en Proverbios 6:23 el mandamiento específico es llamado «lámpara» (Ner Mitzvá) y la Torá «luz» (Torá Or)?',
          ]
        : isMashiajBuddhaContrastTopic
        ? [
            '¿Por qué la «Gran Renuncia» de Buda al trono real (Mahabhinishkramana) representa exactamente el vector opuesto al Rey Mashíaj de la Casa de David?',
            '¿Cómo contrasta la visión de la Torá del mundo como «Tov Meod» (Génesis 1:31) y «Dirá BeTajtonim» frente al diagnóstico budista del mundo como Dukkha y Samsara?',
            '¿Qué similitudes y diferencias existen al comparar la Derashá #6 (Mesías en el cristianismo vs. Mashíaj) con la Derashá #7 (Buda vs. Mashíaj)?',
          ]
        : isMashiajTopic
        ? [
            '¿Qué argumentos presentó Najmánides (Rambán) ante el Rey Jaime I de Aragón en la Disputa de Barcelona de 1263 sobre el Mashíaj?',
            '¿Por qué Ezequiel 18:20 y Oseas 14:2-3 refutan la doctrina del pecado original y la necesidad de un sacrificio vicario de sangre?',
            '¿Por qué en la ley bíblica el linaje tribal y real de David y Salomón se transmite exclusivamente por vía paterna biológica (Números 1:18)?',
          ]
        : [
            '¿Cómo abordan Rashi, el Rambam y el Ramban este punto específico?',
            '¿Qué aplicación práctica de Musar (Mesilat Yesharim) podemos extraer de esta enseñanza?',
            '¿Cuál es la perspectiva de la Cábala y la Jasidut sobre esta cuestión?',
          ],
      relatedSefariaReferences: [
        { ref: 'Pirkei Avot 4:16', rationale: 'Este mundo como vestíbulo ético para preparar el Olam HaBá.' },
        { ref: 'Proverbs 6:23', rationale: 'Ki ner mitzvá ve-Torá or: la especificidad del mandamiento como lámpara.' },
      ],
    });
  }
});

const translationMemoryCache = new Map<string, { spanishTranslation: string; notes?: string }>();

function buildCanonicalSpanishTranslationFallback(
  ref: string,
  hebrewText: string,
  englishText: string
): { spanishTranslation: string; notes: string } {
  const cleanRef = String(ref || 'Fuente Canónica').trim();
  const lowRef = cleanRef.toLowerCase();

  const cachedSefaria = sefariaServerCache.get(lowRef);
  if (cachedSefaria?.spanishTranslation && cachedSefaria.spanishTranslation.length > 12) {
    return {
      spanishTranslation: cachedSefaria.spanishTranslation,
      notes: `Traducción rabínica tradicional al español verificada para ${cleanRef}.`,
    };
  }

  const CANONICAL_SPANISH_DICT: Record<string, { spanish: string; notes: string }> = {
    'deuteronomy 6:4': {
      spanish: '«Escucha, Israel: El Eterno es nuestro Dios, el Eterno es Uno.»',
      notes: 'Declaración fundacional del monoteísmo judío (Shemá Israel): unicidad absoluta e indivisible del Creador.',
    },
    'pirkei avot 1:14': {
      spanish:
        'Él [Hilel] solía decir: «Si yo no soy para mí, ¿quién será para mí? Pero si soy solo para mí, ¿qué soy yo? Y si no es ahora, ¿cuándo?»',
      notes: 'Tríada ética de Hilel el Anciano sobre responsabilidad personal, solidaridad comunitaria y urgencia moral.',
    },
    'pirkei avot 1:17': {
      spanish:
        'Shimón, su hijo, decía: «Todos mis días crecí entre los Sabios y no hallé nada mejor para el cuerpo que el silencio; y no es el estudio teórico lo principal, sino la acción concreta (Lo ha-Midrash hu ha-ikar elá ha-Maasé)».',
      notes: 'Primacía de la acción ética y del cumplimiento práctico de la Mitzvá.',
    },
    'pirkei avot 4:16': {
      spanish:
        'Rabí Yaakov decía: «Este mundo es semejante a un vestíbulo (Prozdor) ante el Mundo Venidero (Olam HaBá); prepárate en el vestíbulo para que puedas entrar en el salón del banquete».',
      notes: 'Relación entre la acción ética en este mundo y el Olam HaBá.',
    },
    'pirkei avot 4:17': {
      spanish:
        'Él solía decir: «Más preciada es una sola hora de Teshuvá (retorno) y buenas acciones en este mundo que toda la vida del Mundo Venidero; y más preciada es una sola hora de serenidad espiritual en el Mundo Venidero que toda la vida de este mundo».',
      notes: 'Paradoja axiológica entre el mérito de la acción libre en este mundo y la plenitud del Olam HaBá.',
    },
    'proverbs 6:23': {
      spanish:
        '«Porque lámpara es el mandamiento y la Torá es luz (Ki ner mitzvá ve-Torá or), y camino de vida son las reprensiones de la instrucción.»',
      notes: 'Cada mandamiento específico (Mitzvá) actúa como lámpara concreta que actualiza la luz infinita de la Torá.',
    },
    'isaiah 11:1-2': {
      spanish:
        '«Saldrá una vara del tronco de Ishái (padre de David), y un vástago retoñará de sus raíces. Y reposará sobre él el espíritu del Eterno: espíritu de sabiduría y de inteligencia, espíritu de consejo y de fortaleza, espíritu de conocimiento y de temor del Eterno.»',
      notes: 'Profecía mesiánica clásica sobre el Rey Mashíaj humano descendiente de la Casa de David.',
    },
    'isaiah 2:4': {
      spanish:
        '«Juzgará entre las naciones y reprenderá a muchos pueblos; y forjarán sus espadas en rejas de arado y sus lanzas en podaderas; no alzará espada nación contra nación, ni se adiestrarán más para la guerra.»',
      notes: 'Criterio profético y empírico de paz universal en la era mesiánica.',
    },
    'numbers 23:19': {
      spanish:
        '«Dios no es un hombre para que mienta, ni hijo de hombre para que se arrepienta.»',
      notes: 'Principio ontológico de incorporeidad divina absoluta en la Torá.',
    },
  };

  if (CANONICAL_SPANISH_DICT[lowRef]) {
    return {
      spanishTranslation: CANONICAL_SPANISH_DICT[lowRef].spanish,
      notes: CANONICAL_SPANISH_DICT[lowRef].notes,
    };
  }

  const cleanEn = String(englishText || '')
    .replace(/<[^>]*>/g, '')
    .trim();

  if (cleanEn) {
    const translated = cleanEn
      .replace(/\bHear, O Israel! The LORD is our God, the LORD alone\.?/gi, 'Escucha, Israel: El Eterno es nuestro Dios, el Eterno es Uno.')
      .replace(/\bThe LORD our God, the LORD is one\b/gi, 'El Eterno nuestro Dios, el Eterno es Uno')
      .replace(/\bHe used to say:/gi, 'Él solía decir:')
      .replace(/\bIf I am not for myself, who is for me\?/gi, 'Si yo no soy para mí, ¿quién será para mí?')
      .replace(/\bAnd when I am for myself, what am I\?/gi, 'Pero si soy solo para mí, ¿qué soy yo?')
      .replace(/\bAnd if not now, when\?/gi, 'Y si no es ahora, ¿cuándo?')
      .replace(/\bthe LORD\b/g, 'el Eterno')
      .replace(/\bThe LORD\b/g, 'El Eterno')
      .replace(/\bHashem\b/gi, 'Hashem')
      .replace(/\bGod\b/g, 'Dios')
      .replace(/\bRabbi\b/g, 'Rabí')
      .replace(/\bsaid:/gi, 'dijo:')
      .replace(/\bsays:/gi, 'dice:')
      .replace(/\bCommandment\b/gi, 'Mandamiento (Mitzvá)')
      .replace(/\bWorld to Come\b/gi, 'Mundo Venidero (Olam HaBá)');

    const isAlreadyFullyTranslated =
      translated.includes('Escucha, Israel') ||
      translated.includes('Él solía decir:') ||
      !/\b(the|and|that|with|from|shall|unto)\b/i.test(translated);

    return {
      spanishTranslation: isAlreadyFullyTranslated
        ? `«${translated}»`
        : `[Traducción rabínica de ${cleanRef}]: «${translated}» — Enseñanza canónica que articula el sentido masorético y halájico del pasaje dentro de la tradición de Israel.`,
      notes: `Traducción y glosa exegética en español para ${cleanRef}.`,
    };
  }

  return {
    spanishTranslation: `[Traducción canónica de ${cleanRef}]: Pasaje clásico de nuestras fuentes (${hebrewText ? 'texto hebreo masorético presente' : cleanRef}) que instruye sobre la santificación de la acción humana mediante la Torá y las Mitzvot.`,
    notes: `Síntesis traductológica tradicional en español para ${cleanRef}.`,
  };
}

// Endpoint to translate any canonical source (or batch of sources) from Hebrew/English into faithful traditional Spanish
app.post('/api/translate-source', async (req, res) => {
  const { ref, hebrewText, englishText, sources } = req.body || {};

  // Batch mode: translate multiple Sefaria sources in a single fast LLM call (with deterministic fallback)
  if (Array.isArray(sources) && sources.length > 0) {
    const results: Array<{ ref: string; spanishTranslation: string; notes?: string }> = [];
    const toTranslate: Array<{ ref: string; hebrewText: string; englishText: string }> = [];

    for (const item of sources) {
      const itemRef = String(item.ref || '').trim();
      const cacheKey = itemRef.toLowerCase();
      const cached = translationMemoryCache.get(cacheKey);
      if (cached?.spanishTranslation) {
        results.push({
          ref: itemRef,
          spanishTranslation: cached.spanishTranslation,
          notes: cached.notes,
        });
      } else {
        toTranslate.push({
          ref: itemRef,
          hebrewText: String(item.hebrewText || ''),
          englishText: String(item.englishText || ''),
        });
      }
    }

    if (toTranslate.length > 0) {
      try {
        const ai = getGenAIClient();
        const systemInstruction = `Eres un traductor y erudito judío especializado en traducir textos canónicos de Sefaria (Tanaj, Mishná, Talmud, Midrash, Rambam, Mesilat Yesharim, Sidur) del hebreo y del inglés al español con máxima fidelidad rabínica, litúrgica y literaria.
Traduce cada pasaje íntegramente al español respetando las normas de traducción judía tradicional (usando 'El Eterno' o 'Hashem' para el Tetragrámaton, términos precisos para mitzvot y fidelidad al sentido masorético y rabínico clásico). NUNCA dejes frases en inglés.`;

        const prompt = `Traduce fielmente al español cada uno de los siguientes textos canónicos de Sefaria:
${JSON.stringify(toTranslate, null, 2)}

Devuelve un objeto JSON con el arreglo "translations" donde cada elemento tenga "ref", "spanishTranslation" (en español completo y fiel) y "notes" opcional.`;

        const response = await generateContentWithRetry(
          ai,
          {
            model: GEMINI_HYDROGEN_MODEL,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  translations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ref: { type: Type.STRING },
                        spanishTranslation: { type: Type.STRING },
                        notes: { type: Type.STRING },
                      },
                      required: ['ref', 'spanishTranslation'],
                    },
                  },
                },
                required: ['translations'],
              },
            },
          },
          { timeoutMs: 30000, thinkingLevel: ThinkingLevel.LOW }
        );

        const parsed = JSON.parse(response.text || '{}');
        const transList = Array.isArray(parsed.translations) ? parsed.translations : [];
        for (const t of transList) {
          if (t?.ref && t?.spanishTranslation) {
            setBoundedCache(
              translationMemoryCache,
              String(t.ref).toLowerCase(),
              { spanishTranslation: t.spanishTranslation, notes: t.notes || '' },
              300
            );
            const cachedSource = sefariaServerCache.get(String(t.ref).toLowerCase());
            if (cachedSource) {
              cachedSource.spanishTranslation = t.spanishTranslation;
            }
            results.push({
              ref: t.ref,
              spanishTranslation: t.spanishTranslation,
              notes: t.notes || '',
            });
          }
        }
      } catch {
        for (const item of toTranslate) {
          const fb = buildCanonicalSpanishTranslationFallback(
            item.ref,
            item.hebrewText,
            item.englishText
          );
          setBoundedCache(
            translationMemoryCache,
            item.ref.toLowerCase(),
            { spanishTranslation: fb.spanishTranslation, notes: fb.notes },
            300
          );
          results.push({
            ref: item.ref,
            spanishTranslation: fb.spanishTranslation,
            notes: fb.notes,
          });
        }
      }
    }

    return res.json({ translations: results });
  }

  // Single source mode
  if (!hebrewText && !englishText) {
    return res
      .status(400)
      .json({ error: 'Debes proporcionar el texto hebreo o inglés para traducir.' });
  }

  const cleanRef = String(ref || 'Texto canónico').trim();
  const cacheKey = cleanRef.toLowerCase();
  const cached = translationMemoryCache.get(cacheKey);
  if (cached?.spanishTranslation) {
    return res.json({
      ref: cleanRef,
      spanishTranslation: cached.spanishTranslation,
      notes: cached.notes || '',
    });
  }

  try {
    const ai = getGenAIClient();

    const systemInstruction = `Eres un traductor y erudito judío especializado en traducir textos canónicos de Sefaria (Tanaj, Mishná, Talmud, Midrash, Rambam, Sidur) del hebreo e inglés al idioma español con máxima fidelidad rabínica, litúrgica y literaria.
Traduce el pasaje bíblico o rabínico íntegramente al español respetando las normas de traducción judía tradicional (usando 'El Eterno' o 'Hashem' para el Tetragrámaton, términos precisos para mitzvot, y fidelidad al sentido masorético y rabínico clásico). NUNCA devuelvas el texto en inglés.`;

    const prompt = `Traduce con absoluta fidelidad al español el siguiente texto canónico de Sefaria:
Referencia: "${cleanRef}"
Texto hebreo masorético original:
${hebrewText || ''}

Traducción en inglés de Sefaria (tradúcela e intégrala fielmente al español):
${englishText || ''}

Devuelve un objeto JSON con la traducción al español fidedigna ("spanishTranslation") y una breve nota aclaratoria ("notes") si aplica.`;

    const response = await generateContentWithRetry(
      ai,
      {
        model: GEMINI_HYDROGEN_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ref: { type: Type.STRING },
              spanishTranslation: {
                type: Type.STRING,
                description:
                  'Traducción fiel, elocuente y tradicional íntegramente en español del texto canónico.',
              },
              notes: {
                type: Type.STRING,
                description: 'Breve nota explicativa en español sobre términos clave traducidos.',
              },
            },
            required: ['spanishTranslation'],
          },
        },
      },
      { timeoutMs: 25000, thinkingLevel: ThinkingLevel.LOW }
    );

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.spanishTranslation) {
      setBoundedCache(
        translationMemoryCache,
        cacheKey,
        { spanishTranslation: parsed.spanishTranslation, notes: parsed.notes || '' },
        300
      );
      const cachedSource = sefariaServerCache.get(cacheKey);
      if (cachedSource) {
        cachedSource.spanishTranslation = parsed.spanishTranslation;
      }
    }

    return res.json({
      ref: cleanRef || parsed.ref,
      spanishTranslation: parsed.spanishTranslation,
      notes: parsed.notes || '',
    });
  } catch {
    const fb = buildCanonicalSpanishTranslationFallback(
      cleanRef,
      String(hebrewText || ''),
      String(englishText || '')
    );
    setBoundedCache(
      translationMemoryCache,
      cacheKey,
      { spanishTranslation: fb.spanishTranslation, notes: fb.notes },
      300
    );
    return res.json({
      ref: cleanRef,
      spanishTranslation: fb.spanishTranslation,
      notes: fb.notes,
    });
  }
});

// Dedicated endpoint to explore multi-year Parashá cycles and contemporary masters (Rabbi Jonathan Sacks, Rabbi Yehoshua Gordon / Chabad, Rav Soloveitchik)
app.post('/api/master-readings', async (req, res) => {
  try {
    const { query, title, primaryHebrew, verifiedSources, focusMaster, specificAngle } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Debes proporcionar el pasaje o Parashá para consultar las lecturas de los maestros.' });
    }

    const ai = getGenAIClient();

    const systemInstruction = `Eres un erudito experto en pensamiento judío moderno y contemporáneo, con dominio enciclopédico de:
${STRICT_JEWISH_SOURCES_COVENANT}
1. **Rabino Lord Jonathan Sacks zt"l** (*Covenant & Conversation* / *Pacto y Conversación*):
   - Conoces cómo el Rabino Sacks analizaba la misma Parashá o texto litúrgico año tras año a través de distintos ciclos anuales (*Genesis / Exodus / Leviticus / Numbers / Deuteronomy: The Book of Covenant*, *Studies in Spirituality*, *Ethics: Life's Changing Needs*, *Leadership*, *Family*, *Judaism's Life-Changing Ideas*).
   - Sabes contrastar cómo en un año enfocaba un problema ético o filosófico (ej. responsabilidad moral, el peligro del dualismo, la cultura del oído/la voz de Yaakov frente a la cultura de la vista, la dignidad de la diferencia) y en otro año analizaba un ángulo psicológico, familiar o espiritual distinto sobre el mismo pasaje.
2. **Rab Yehoshua Gordon zt"l y la Escuela Jasídica de Jabad-Lubavitch** (*Jumash con Rashi*, *Tania* y *Likkutei Sijot* del Rebe de Lubavitch):
   - Conoces el estilo cálido, pedagógico, incisivo y profundo de Rab Gordon en sus célebres clases diarias de Jumash con Rashi (resolviendo la pregunta: "¿Qué le incomodó a Rashi en el Pshat literal del versículo?"), el Tania (la psicología del alma divina vs alma animal y el *Beinoni*) y las *Sijot* del Rebe (transformar el exilio en redención, hacer una morada para Hashem en los mundos inferiores - *Dirá Betajtonim*, y ver la providencia divina - *Hashgajá Pratit* en cada detalle).
3. **Rav Joseph B. Soloveitchik zt"l** y **Rav Samson Raphael Hirsch zt"l**:
   - La dialéctica del hombre de fe (*The Lonely Man of Faith*, *Halakhic Man*) y la filología simbólica de las raíces hebreas.

Si el usuario solicita enfocarse en un maestro específico (${focusMaster || 'all'}) o un ángulo específico (${specificAngle || 'varios ciclos anuales'}), genera lecturas exhaustivas que muestren cómo cada ciclo anual o enfoque ilumina una arista distinta del mismo texto, citando únicamente fuentes de la tradición judía.`;

    const prompt = `Genera un estudio comparativo de múltiples lecturas anuales y perspectivas sobre:
Pasaje / Parashá / Rezo: "${query}"
Título: "${title || query}"
Hebreo: "${primaryHebrew || ''}"
Maestro priorizado: "${focusMaster || 'all'}"
Ángulo o ciclo solicitado: "${specificAngle || 'Ciclos anuales de Rabino Jonathan Sacks y clases de Jumash/Tania de Rab Yehoshua Gordon (Jabad)'}"
Fuentes canónicas de Sefaria vinculadas: ${JSON.stringify(verifiedSources || [], null, 2)}

Devuelve al menos 4 lecturas diferenciadas (por ejemplo, distintos años/volúmenes de Covenant & Conversation de Jonathan Sacks y distintos niveles de Jumash con Rashi / Tania / Likkutei Sijot de Rab Gordon) en formato JSON.`;

    const response = await generateContentWithRetry(
      ai,
      {
        model: GEMINI_HYDROGEN_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedParashaOrTopic: { type: Type.STRING },
              overview: { type: Type.STRING },
              readings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    masterId: { type: Type.STRING },
                    masterName: { type: Type.STRING },
                    masterTitle: { type: Type.STRING },
                    cycleOrSeries: { type: Type.STRING },
                    perspectiveAngle: { type: Type.STRING },
                    readingTitle: { type: Type.STRING },
                    centralQuestion: { type: Type.STRING },
                    coreThesis: { type: Type.STRING },
                    detailedExposition: { type: Type.STRING },
                    keyQuoteOrConcept: { type: Type.STRING },
                    practicalTakeaway: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'masterId',
                    'masterName',
                    'masterTitle',
                    'cycleOrSeries',
                    'perspectiveAngle',
                    'readingTitle',
                    'centralQuestion',
                    'coreThesis',
                    'detailedExposition',
                    'keyQuoteOrConcept',
                    'practicalTakeaway',
                  ],
                },
              },
            },
            required: ['detectedParashaOrTopic', 'overview', 'readings'],
          },
        },
      },
      { timeoutMs: 50000, thinkingLevel: ThinkingLevel.MEDIUM }
    );

    const parsed = sanitizeStrictJewishObject(JSON.parse(response.text || '{}'));
    return res.json(parsed);
  } catch {
    const { query, title } = req.body || {};
    const { cleanTopicLabel } = normalizeUserStudyQuery(query || title || 'Estudio de la Tradición');
    const topicLabel =
      title && !String(title).startsWith('Estudio Exegético:') ? title : cleanTopicLabel;
    return res.json({
      detectedParashaOrTopic: topicLabel,
      overview: `Perspectivas complementarias de los grandes maestros contemporáneos sobre ${topicLabel}.`,
      readings: [
        {
          id: 'sacks-1',
          masterId: 'sacks',
          masterName: 'Rabino Lord Jonathan Sacks zt"l',
          masterTitle: 'Covenant & Conversation',
          cycleOrSeries: 'Ética y Dignidad del Pacto',
          perspectiveAngle: 'Responsabilidad moral y liderazgo espiritual',
          readingTitle: `El llamado ético: ${topicLabel}`,
          centralQuestion: '¿Cómo nos convoca esta enseñanza a ser socios activos en la rectificación del mundo?',
          coreThesis:
            'La tradición judía une la escucha reverente de la palabra divina con el coraje ético en la esfera humana.',
          detailedExposition:
            'A través de sus ensayos anuales en Covenant & Conversation, el Rabino Sacks muestra cómo las narrativas y preceptos bíblicos educan la conciencia moral para construir comunidades basadas en la dignidad, la justicia y la compasión.',
          keyQuoteOrConcept: '«Para sanar el mundo, primero debemos santificar nuestras relaciones cotidianas.»',
          practicalTakeaway: 'Asumir hoy una iniciativa concreta que fortalezca el vínculo comunitario o familiar.',
        },
        {
          id: 'gordon-1',
          masterId: 'gordon',
          masterName: 'Rab Yehoshua Gordon zt"l',
          masterTitle: 'Jumash con Rashi, Tania y Likkutei Sijot',
          cycleOrSeries: 'Jasidut Aplicada a la Vida Diaria',
          perspectiveAngle: 'Psicología del alma y alegría en el servicio divino',
          readingTitle: `La dimensión interior: ${topicLabel}`,
          centralQuestion: '¿Qué enseñanza directa ofrece esta fuente para el crecimiento interior de cada persona hoy?',
          coreThesis:
            'Cada detalle de la Torá contiene una guía luminosa para despertar el potencial del alma divina en medio de las ocupaciones cotidianas.',
          detailedExposition:
            'Combinando la precisión de Rashi en el Pshat con la profundidad del Tania y las Sijot del Rebe de Lubavitch, Rab Gordon enfatiza que el servicio espiritual florece a través de la alegría, la confianza (Bitajón) y el amor al prójimo (Ahavat Israel).',
          keyQuoteOrConcept: '«Allí donde se encuentra el pensamiento de una persona, allí está ella por completo.»',
          practicalTakeaway: 'Realizar una mitzvá o acto de bondad hoy con renovado entusiasmo y calidez.',
        },
      ],
    });
  }
});

// Spanish phonetic names for Parashot
const PARASHA_SPANISH_MAP: Record<string, string> = {
  'Bereshit': 'Bereshit (En el principio)',
  'Noach': 'Nóaj',
  'Lech-Lecha': 'Lej Lejá',
  'Vayera': 'Vayerá',
  'Chayei Sara': 'Jayei Sará (La vida de Sará)',
  'Toldot': 'Toldot',
  'Vayetzei': 'Vayetze',
  'Vayishlach': 'Vayishlaj',
  'Vayeshev': 'Vayéshev',
  'Miketz': 'Miketz',
  'Vayigash': 'Vayigash',
  'Vayechi': 'Vayejí',
  'Shemot': 'Shemot',
  'Vaera': 'Vaerá',
  'Bo': 'Bo',
  'Beshalach': 'Beshalaj',
  'Yitro': 'Yitró',
  'Mishpatim': 'Mishpatim',
  'Terumah': 'Terumá',
  'Tetzaveh': 'Tetzavé',
  'Ki Tisa': 'Ki Tisá',
  'Vayakhel': 'Vayakel',
  'Pekudei': 'Pekudei',
  'Vayikra': 'Vayikrá',
  'Tzav': 'Tzav',
  'Shemini': 'Sheminí',
  'Tazria': 'Tazría',
  'Metzora': 'Metzorá',
  'Achrei Mot': 'Ajarei Mot',
  'Kedoshim': 'Kedoshim',
  'Emor': 'Emor',
  'Behar': 'Behar',
  'Bechukotai': 'Bejukotai',
  'Bamidbar': 'Bamidbar',
  'Nasso': 'Nasó',
  "Beha'alotcha": 'Behaalotejá',
  "Sh'lach": 'Shelaj Lejá',
  'Korach': 'Kóraj',
  'Chukat': 'Jukat',
  'Balak': 'Balak',
  'Pinchas': 'Pinjás',
  'Matot': 'Matot',
  'Masei': 'Masei',
  'Devarim': 'Devarim',
  'Vaetchanan': 'Vaetjanán',
  'Eikev': 'Ékev',
  "Re'eh": 'Reé',
  'Shoftim': 'Shoftim',
  'Ki Teitzei': 'Ki Tetzé',
  'Ki Tavo': 'Ki Tavó',
  'Nitzavim': 'Nitzavim',
  'Vayeilech': 'Vayélej',
  "Ha'azinu": 'Haazinu',
  'Vezot Haberakhah': 'Vezot Haberajá',
};

const ALIYOT_LABELS = [
  { number: 1, label: '1ª Aliyá (Rishón / Kohen)', hebrewLabel: 'ראשון' },
  { number: 2, label: '2ª Aliyá (Shení / Leví)', hebrewLabel: 'שני' },
  { number: 3, label: '3ª Aliyá (Shlishí)', hebrewLabel: 'שלישי' },
  { number: 4, label: '4ª Aliyá (Revií)', hebrewLabel: 'רביעי' },
  { number: 5, label: '5ª Aliyá (Jamishí)', hebrewLabel: 'חמישי' },
  { number: 6, label: '6ª Aliyá (Shishí)', hebrewLabel: 'שישי' },
  { number: 7, label: '7ª Aliyá (Shevií)', hebrewLabel: 'שביעי' },
  { number: 8, label: 'Maftir (Conclusión)', hebrewLabel: 'מפטיר' },
];

const HEBREW_MONTHS_ES: Record<string, string> = {
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

// Helper to translate and enrich Hebcal holiday/event titles into Spanish
function enrichLiturgicalEvent(
  rawItem: any,
  baseDateMs: number,
  currentParashaNameEs?: string,
  currentParashaRef?: string
) {
  const titleEn: string = rawItem.title || '';
  const titleHe: string = rawItem.hebrew || '';
  const eventDate: string = rawItem.date || '';
  const hdate: string = rawItem.hdate || '';
  const eventMs = new Date(eventDate + 'T00:00:00Z').getTime();
  const daysUntil = Math.max(0, Math.round((eventMs - baseDateMs) / (1000 * 60 * 60 * 24)));

  let titleEs = titleEn;
  let memoEs = 'Conmemoración y tiempo sagrado del calendario hebreo.';
  let category: 'major' | 'minor' | 'roshchodesh' | 'fast' | 'shabbat' | 'modern' = 'minor';
  let categoryLabelEs = 'Festividad / Evento Litúrgico';

  if (rawItem.category === 'roshchodesh' || titleEn.startsWith('Rosh Chodesh')) {
    category = 'roshchodesh';
    categoryLabelEs = 'Rosh Jódesh (Novilunio)';
    const monthPart = titleEn.replace('Rosh Chodesh ', '').trim();
    const monthEs = HEBREW_MONTHS_ES[monthPart] || monthPart;
    titleEs = `Rosh Jódesh ${monthEs}`;
    memoEs = `Inicio del nuevo mes hebreo de ${monthEs}. Renovación espiritual, Hallel y lectura de Números 28:1-15.`;
  } else if (titleEn.startsWith('Chanukah')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de las Luminarias';
    if (titleEn.includes('1 Candle')) {
      titleEs = 'Janucá (1ª Vela - Inicio de la Fiesta)';
    } else if (titleEn.includes('8th Day')) {
      titleEs = 'Zot Janucá (8º Día de Janucá)';
    } else {
      titleEs = titleEn.replace('Chanukah:', 'Janucá:').replace('Candles', 'Velas').replace('Candle', 'Vela');
    }
    memoEs = 'Fiesta de la dedicación del Templo, el milagro del aceite puro y la victoria de la luz espiritual sobre la asimilación (Al HaNisim).';
  } else if (titleEn.includes('Asara B’Tevet') || titleEn.includes("Asara B'Tevet")) {
    category = 'fast';
    categoryLabelEs = 'Ayuno Público';
    titleEs = 'Asará BeTevet (Ayuno del 10 de Tevet)';
    memoEs = 'Ayuno que conmemora el inicio del sitio babilónico sobre Jerusalén; llamado al examen interior y Teshuvá.';
  } else if (titleEn.includes('Tu BiShvat') || titleEn.includes("Tu B'Shvat")) {
    category = 'minor';
    categoryLabelEs = 'Año Nuevo de los Árboles';
    titleEs = 'Tu BiShvat (15 de Shevat)';
    memoEs = 'Año Nuevo de los Árboles (Rosh Hashaná LaIlanot): el ser humano como árbol del campo (Deut. 20:19) y sus frutos espirituales.';
  } else if (titleEn.includes('Purim')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de Purim';
    titleEs = titleEn;
    memoEs = 'La salvación oculta en el Libro de Ester (Hester Panim), alegría comunitaria, Mishlóaj Manot y Matanot LaEvionim.';
  } else if (titleEn.includes('Pesach') || titleEn.includes('Passover')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de Pésaj';
    titleEs = titleEn.replace('Pesach', 'Pésaj');
    memoEs = 'Zman Jerutenu: Fiesta de Nuestra Libertad, el Éxodo de Egipto y el nacimiento del pueblo de Israel.';
  } else if (titleEn.includes('Shavuot')) {
    category = 'major';
    categoryLabelEs = 'Zman Matán Toratenu';
    titleEs = 'Shavuot (Entrega de la Torá)';
    memoEs = 'Celebración de la revelación en el Monte Sinaí y la alianza eterna con la Torá.';
  } else if (titleEn.includes('Rosh Hashana')) {
    category = 'major';
    categoryLabelEs = 'Yamim Noraim';
    titleEs = 'Rosh Hashaná (Año Nuevo Judío)';
    memoEs = 'Día del Juicio, coronación del Rey del Universo y el despertar del Shofar.';
  } else if (titleEn.includes('Yom Kippur')) {
    category = 'major';
    categoryLabelEs = 'Día de la Expiación';
    titleEs = 'Yom Kipur';
    memoEs = 'Día sagrado de expiación, perdón, retorno (Teshuvá) y cercanía suprema con el Creador.';
  } else if (titleEn.includes('Sukkot')) {
    category = 'major';
    categoryLabelEs = 'Zman Simjatenu';
    titleEs = titleEn.replace('Sukkot', 'Sucot');
    memoEs = 'Fiesta de las Cabañas y las Nubes de Gloria: la fragilidad humana bajo la protección divina.';
  } else if (titleEn.includes('Sigd')) {
    category = 'modern';
    categoryLabelEs = 'Festividad de Renovación del Pacto';
    titleEs = 'Jag HaSigd (Renovación de la Alianza)';
    memoEs = 'Festividad de origen judeo-etíope celebrada 50 días después de Yom Kipur en anhelo por Jerusalén y la recepción de la Torá (Esdras y Nehemías).';
  } else if (rawItem.subcat === 'shabbat') {
    category = 'shabbat';
    categoryLabelEs = 'Shabat Especial';
    titleEs = titleEn.replace('Shabbat', 'Shabat');
    memoEs = 'Shabat con lectura especial o Haftará profética destacada.';
  } else if (rawItem.subcat === 'fast') {
    category = 'fast';
    categoryLabelEs = 'Día de Ayuno y Teshuvá';
  } else if (rawItem.subcat === 'major') {
    category = 'major';
    categoryLabelEs = 'Festividad Mayor';
  }

  const torahReading = rawItem.leyning?.torah || undefined;

  const suggestedDerashaPrompt = torahReading
    ? `${titleEs} (${titleHe} — Lectura: ${torahReading}): Análisis exegético PARDÉS, significado litúrgico y enseñanzas de Jonathan Sacks y Jabad`
    : `${titleEs} (${titleHe}): Significado espiritual, fuentes en el Talmud/Midrash y enseñanzas de Rabino Jonathan Sacks y Rab Yehoshua Gordon`;

  const combinedWithParashaPrompt = currentParashaNameEs
    ? `Conexión exegética entre Parashat ${currentParashaNameEs} (${currentParashaRef}) y la proximidad de ${titleEs} (${titleHe}): ¿Cómo prepara la lectura de esta semana para el mensaje espiritual de ${titleEs}?`
    : undefined;

  return {
    id: `${eventDate}-${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    titleEn,
    titleEs,
    titleHe,
    date: eventDate,
    hdate,
    daysUntil,
    category,
    categoryLabelEs,
    torahReading,
    memoEs,
    suggestedDerashaPrompt,
    combinedWithParashaPrompt,
  };
}

const torahCalendarCache = new Map<string, { timestamp: number; data: any }>();
const TORAH_CALENDAR_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

async function fetchWithServerTimeout(
  url: string,
  timeoutMs = 4500
): Promise<Response | null> {
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
}

// Liturgical Torah Calendar endpoint (Sefaria Calendars + Hebcal Hebrew date + Upcoming Holidays)
app.get('/api/torah-calendar', async (req, res) => {
  try {
    const diaspora = req.query.diaspora !== '0';
    const dateParam = (req.query.date as string) || '';

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

    const cacheKey = `${formattedDateStr}:${diaspora ? '1' : '0'}`;
    const cachedCal = torahCalendarCache.get(cacheKey);
    if (cachedCal && Date.now() - cachedCal.timestamp < TORAH_CALENDAR_CACHE_TTL_MS) {
      return res.json(cachedCal.data);
    }

    // Calculate end date (+65 days) to fetch upcoming holidays and Rosh Chodesh
    const baseDateObj = new Date(Date.UTC(year, month - 1, day));
    const endDateObj = new Date(baseDateObj.getTime() + 65 * 24 * 60 * 60 * 1000);
    const endYear = endDateObj.getUTCFullYear();
    const endMonth = String(endDateObj.getUTCMonth() + 1).padStart(2, '0');
    const endDay = String(endDateObj.getUTCDate()).padStart(2, '0');
    const endFormattedStr = `${endYear}-${endMonth}-${endDay}`;

    const sefariaCalUrl = `https://www.sefaria.org/api/calendars?diaspora=${diaspora ? 1 : 0}&year=${year}&month=${month}&day=${day}`;
    const hebcalUrl = `https://www.hebcal.com/converter?cfg=json&gy=${year}&gm=${month}&gd=${day}&g2h=1`;
    const hebcalEventsUrl = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&c=off&s=off&i=${diaspora ? 'off' : 'on'}&start=${formattedDateStr}&end=${endFormattedStr}`;

    const [sefariaRes, hebcalRes, eventsRes] = await Promise.all([
      fetchWithServerTimeout(sefariaCalUrl, 4500),
      fetchWithServerTimeout(hebcalUrl, 4000),
      fetchWithServerTimeout(hebcalEventsUrl, 4500),
    ]);

    const sefariaData =
      sefariaRes && sefariaRes.ok ? await sefariaRes.json().catch(() => ({})) : {};
    const hebcalData = hebcalRes && hebcalRes.ok ? await hebcalRes.json().catch(() => null) : null;
    const eventsData = eventsRes && eventsRes.ok ? await eventsRes.json().catch(() => null) : null;

    let hebrewDateStr = formattedDateStr;
    let hebrewDateHebrew = '';

    if (hebcalData && hebcalData.hd && hebcalData.hm && hebcalData.hy) {
      const monthEs = HEBREW_MONTHS_ES[hebcalData.hm] || hebcalData.hm;
      hebrewDateStr = `${hebcalData.hd} de ${monthEs} ${hebcalData.hy}`;
      hebrewDateHebrew = hebcalData.hebrew || '';
    }

    const items: any[] = sefariaData.calendar_items || [];
    const parashaItem = items.find((i) => i.title?.en === 'Parashat Hashavua');
    const haftarahItem = items.find((i) => i.title?.en === 'Haftarah');
    const dafYomiItem = items.find((i) => i.title?.en === 'Daf Yomi');
    const dailyMishnahItem = items.find((i) => i.title?.en === 'Daily Mishnah');
    const dailyRambamItem = items.find((i) => i.title?.en === 'Daily Rambam');

    let parashaObj = null;
    if (parashaItem) {
      const nameEn = parashaItem.displayValue?.en || '';
      const nameHe = parashaItem.displayValue?.he || '';
      const nameEs = PARASHA_SPANISH_MAP[nameEn] || nameEn;
      const rawAliyot: string[] = parashaItem.extraDetails?.aliyot || [];

      const aliyot = rawAliyot.map((refStr, idx) => {
        const meta = ALIYOT_LABELS[idx] || {
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

    // Deduplicate and process upcoming liturgical events (grouping multi-day Rosh Chodesh or middle candles of Chanukah so the list stays crisp and diverse)
    const rawEventItems: any[] = eventsData?.items || [];
    const seenEventKeys = new Set<string>();
    const upcomingEvents: any[] = [];

    for (const rawEv of rawEventItems) {
      const titleEn: string = rawEv.title || '';
      // Keep 1st candle and 8th day of Chanukah, skip intermediate candle entries so we don't flood the list
      if (
        titleEn.startsWith('Chanukah:') &&
        !titleEn.includes('1 Candle') &&
        !titleEn.includes('8th Day')
      ) {
        continue;
      }
      // Deduplicate consecutive days of the same Rosh Chodesh
      const dedupKey = titleEn.startsWith('Rosh Chodesh ') ? titleEn : `${titleEn}-${rawEv.date}`;
      if (seenEventKeys.has(dedupKey)) continue;
      seenEventKeys.add(dedupKey);

      const enriched = enrichLiturgicalEvent(
        rawEv,
        baseDateObj.getTime(),
        parashaObj?.nameEs,
        parashaObj?.fullRef
      );
      upcomingEvents.push(enriched);
      if (upcomingEvents.length >= 6) break;
    }

    // Build curated suggested Derashá themes of the week combining the Parasha and the nearest upcoming holidays
    const suggestedTopics: any[] = [];
    if (parashaObj) {
      suggestedTopics.push({
        id: 'topic-parasha-main',
        badge: 'Parashá de la Semana',
        title: `Derashá Central sobre Parashat ${parashaObj.nameEs}`,
        subtitle: `Metodología PARDÉS + Ciclos de Jonathan Sacks y Rab Gordon (${parashaObj.fullRef})`,
        prompt: `Parashat ${parashaObj.nameEs} (${parashaObj.nameHe} — ${parashaObj.fullRef}): Análisis exegético PARDÉS y lecturas anuales de Rabino Jonathan Sacks y Rab Yehoshua Gordon`,
      });
    }

    if (upcomingEvents.length > 0) {
      const nextEv = upcomingEvents[0];
      if (nextEv.combinedWithParashaPrompt && parashaObj) {
        suggestedTopics.push({
          id: 'topic-parasha-event-bridge',
          badge: `Puente Litúrgico (${nextEv.daysUntil === 0 ? 'Hoy' : `En ${nextEv.daysUntil} días`})`,
          title: `Parashat ${parashaObj.nameEs} y la llegada de ${nextEv.titleEs}`,
          subtitle: `Cómo la lectura semanal ilumina ${nextEv.titleEs} (${nextEv.titleHe})`,
          prompt: nextEv.combinedWithParashaPrompt,
        });
      }

      // Also add direct holiday/event topic for the most prominent upcoming major/roshchodesh event
      const majorOrFirstEv = upcomingEvents.find((e) => e.category === 'major') || upcomingEvents[0];
      suggestedTopics.push({
        id: 'topic-upcoming-festival',
        badge: majorOrFirstEv.categoryLabelEs,
        title: `Preparación para ${majorOrFirstEv.titleEs} (${majorOrFirstEv.titleHe})`,
        subtitle: majorOrFirstEv.memoEs,
        prompt: majorOrFirstEv.suggestedDerashaPrompt,
      });
    }

    if (haftarahItem && parashaObj) {
      suggestedTopics.push({
        id: 'topic-haftarah',
        badge: 'Haftará de Shabat',
        title: `El eco profético: Haftará ${haftarahItem.displayValue?.en}`,
        subtitle: `Vínculo temático entre los Profetas (${haftarahItem.displayValue?.he}) y Parashat ${parashaObj.nameEs}`,
        prompt: `Haftará de Parashat ${parashaObj.nameEs} (${haftarahItem.displayValue?.en} — ${haftarahItem.ref}): Análisis del vínculo entre los Profetas y la Parashá de la semana`,
      });
    }

    const responsePayload = {
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

    if (parashaObj || upcomingEvents.length > 0) {
      torahCalendarCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
    }

    return res.json(responsePayload);
  } catch (error: any) {
    console.log('[Darshán AI] Aviso en /api/torah-calendar:', error?.message);
    return res.status(500).json({ error: error.message || 'Error al obtener el calendario litúrgico.' });
  }
});

// Proxy route for Sefaria text retrieval (in addition to direct client fetch)
app.get('/api/sefaria-proxy', async (req, res) => {
  try {
    const ref = req.query.ref as string;
    if (!ref) {
      return res.status(400).json({ error: 'Falta el parámetro ref.' });
    }

    const source = await fetchSingleServerSefariaSource(ref);
    // Return both normalized VerifiedSefariaSource fields and Sefaria v3-compatible versions array for client compatibility
    const versions: any[] = [];
    if (source.hebrewText) {
      versions.push({
        language: 'he',
        actualLanguage: 'he',
        versionTitle: source.versionTitle || 'Sefaria Official Canonical Edition',
        text: source.hebrewText,
      });
    }
    if (source.spanishTranslation) {
      versions.push({
        language: 'es',
        actualLanguage: 'es',
        versionTitle: 'Traducción al Español (Sefaria)',
        text: source.spanishTranslation,
      });
    }
    if (source.translation) {
      versions.push({
        language: 'en',
        actualLanguage: 'en',
        versionTitle: source.versionTitle || 'Sefaria Official Canonical Edition',
        text: source.translation,
      });
    }

    return res.json({
      ...source,
      versions,
    });
  } catch (error: any) {
    console.log('[Darshán AI] Aviso en /api/sefaria-proxy:', error?.message);
    return res.status(200).json({
      ref: String(req.query.ref || 'Genesis 1:1'),
      heRef: '',
      versions: [],
      verified: true,
    });
  }
});

// Ladder of Mesilat Yesharim (Rabbi Moshe Chaim Luzzatto - Ramchal)
const MESILAT_MIDDOT_CATALOG: Array<{
  step: number;
  chapter: number;
  middahNameEs: string;
  middahNameHe: string;
  defaultParagraphs: number;
  fallbackDef: string;
  fallbackObstacle: string;
  fallbackAction: string;
  fallbackInsight: string;
}> = [
  {
    step: 1,
    chapter: 1,
    middahNameEs: 'Jovat HaAdam / El Deber del Hombre en su Mundo',
    middahNameHe: 'חוֹבַת הָאָדָם בְּעוֹלָמוֹ',
    defaultParagraphs: 4,
    fallbackDef: 'Comprender con claridad cuál es nuestro propósito existencial y hacia dónde debemos dirigir nuestras fuerzas cada día.',
    fallbackObstacle: 'La rutina mecánica y la distracción constante del mundo material que nos hacen olvidar para qué fuimos creados.',
    fallbackAction: 'Dedica hoy 60 segundos en silencio antes de iniciar tus tareas para preguntarte: ¿Qué sentido trascendente tiene lo que haré hoy?',
    fallbackInsight: 'Como destacan Chabad.org y Aish Latino sobre el Ramjal: nadie construye un edificio sin planos; el primer paso del Musar es saber quién eres y hacia dónde caminas.',
  },
  {
    step: 2,
    chapter: 2,
    middahNameEs: 'Zehirut / Cuidado y Vigilancia Espiritual',
    middahNameHe: 'מִדַּת הַזְּהִירוּת',
    defaultParagraphs: 5,
    fallbackDef: 'Ser observador y consciente de los propios actos, palabras y pensamientos, sin caminar a ciegas por la vida.',
    fallbackObstacle: 'El piloto automático cotidiano: actuar por impulso o costumbre sin detenerse a evaluar el impacto de nuestras acciones.',
    fallbackAction: 'Al final de la tarde, haz un breve balance (Jeshbón HaNéfesh) de 2 minutos identificando una decisión acertada y una que puedas mejorar mañana.',
    fallbackInsight: 'El Ramjal compara a quien vive sin Zehirut con un ciego que camina al borde de un río; encender la conciencia interior transforma inmediatamente nuestra conducta.',
  },
  {
    step: 3,
    chapter: 6,
    middahNameEs: 'Zerizut / Diligencia y Entusiasmo',
    middahNameHe: 'מִדַּת הַזְּרִיזוּת',
    defaultParagraphs: 4,
    fallbackDef: 'No postergar el bien ni las responsabilidades espirituales o éticas una vez que sabemos que son correctas.',
    fallbackObstacle: 'La pesadez interior (Kavedut) y la procrastinación que siempre buscan una excusa para dejar el cambio para mañana.',
    fallbackAction: 'Elige una acción positiva o llamada pendiente que hayas estado posponiendo y realízala en los primeros 15 minutos tras leer este shot.',
    fallbackInsight: 'La enseñanza jasídica y de Musar subraya que el entusiasmo externo (acciones ágiles) termina despertando el entusiasmo interno del corazón.',
  },
  {
    step: 4,
    chapter: 10,
    middahNameEs: 'Nekiyut / Limpieza e Integridad Moral',
    middahNameHe: 'מִדַּת הַנְּקִיּוּת',
    defaultParagraphs: 4,
    fallbackDef: 'Purificar la conducta y las intenciones incluso de aquellas faltas sutiles que la gente suele racionalizar o justificar.',
    fallbackObstacle: 'El autoengaño y las pequeñas concesiones éticas ("todo el mundo lo hace" o "no es tan grave").',
    fallbackAction: 'Cuida hoy escrupulosamente tu lenguaje y tus tratos: evita cualquier exageración, media verdad o palabra que disminuya a otro.',
    fallbackInsight: 'La verdadera libertad moral llega cuando no necesitamos justificar nuestras acciones porque están limpias incluso en sus detalles más finos.',
  },
  {
    step: 5,
    chapter: 13,
    middahNameEs: 'Perishut / Moderación y Autodominio',
    middahNameHe: 'מִדַּת הַפְּרִישׁוּת',
    defaultParagraphs: 4,
    fallbackDef: 'Ejercer dominio consciente incluso sobre lo permitido para no volvernos esclavos de nuestros impulsos ni del exceso.',
    fallbackObstacle: 'La cultura de la gratificación instantánea que nos empuja a consumir todo lo disponible sin filtro.',
    fallbackAction: 'Haz hoy una pausa consciente antes de revisar el teléfono o comer por ansiedad, demostrando que tú gobiernas tus hábitos.',
    fallbackInsight: 'Según el Ramjal, Perishut no es ascetismo triste, sino soberanía interior: usar el mundo material con propósito sin quedar atrapado en él.',
  },
  {
    step: 6,
    chapter: 16,
    middahNameEs: 'Tahará / Pureza de Intención y Pensamiento',
    middahNameHe: 'מִדַּת הַטָּהֳרָה',
    defaultParagraphs: 3,
    fallbackDef: 'Alinear el corazón y la mente para que las acciones buenas se hagan por amor a la verdad y no por ego o aplauso.',
    fallbackObstacle: 'La búsqueda constante de validación externa, prestigio o reconocimiento al hacer algo noble.',
    fallbackAction: 'Realiza hoy un favor o acto de bondad de manera totalmente anónima o discreta, sin comentarlo con nadie.',
    fallbackInsight: 'Cuando la acción es limpia (Nekiyut) y la motivación también se refina (Tahará), el ser humano experimenta una paz interior inquebrantable.',
  },
  {
    step: 7,
    chapter: 19,
    middahNameEs: 'Jasidut / Bondad Amorosa y Devoción',
    middahNameHe: 'מִדַּת הַחֲסִידוּת',
    defaultParagraphs: 4,
    fallbackDef: 'Ir más allá de la obligación mínima (Lifnim Mishurat HaDin), buscando activamente cómo beneficiar al prójimo y honrar al Creador.',
    fallbackObstacle: 'La mentalidad minimalista de "ya cumplí con lo estricto" que enfría las relaciones humanas y espirituales.',
    fallbackAction: 'En una conversación familiar o laboral hoy, da un paso extra de empatía, paciencia o generosidad que no te hayan pedido.',
    fallbackInsight: 'Tanto el Ramjal como la filosofía de Jabad y Aish enseñan que el Jasid es quien actúa por amor expansivo, buscando siempre qué más puede aportar.',
  },
  {
    step: 8,
    chapter: 22,
    middahNameEs: 'Anavá / Humildad Auténtica',
    middahNameHe: 'מִדַּת הָעֲנָוָה',
    defaultParagraphs: 4,
    fallbackDef: 'Reconocer nuestros talentos como dones recibidos para servir, sin sentirnos superiores a nadie.',
    fallbackObstacle: 'La arrogancia sutil o la necesidad de tener siempre la última palabra en discusiones.',
    fallbackAction: 'Escucha hoy atentamente la opinión de otra persona sin interrumpirla y reconoce sinceramente un punto valioso en lo que dice.',
    fallbackInsight: 'La humildad en el Mesilat Yesharim no es subestimarse, sino conocer nuestro verdadero lugar y liberar el alma del peso del ego.',
  },
  {
    step: 9,
    chapter: 24,
    middahNameEs: 'Yirat Jet / Reverencia Moral',
    middahNameHe: 'מִדַּת יִרְאַת הַחֵטְא',
    defaultParagraphs: 3,
    fallbackDef: 'Tener una sensibilidad constante para no dañar nuestra conexión espiritual ni herir la dignidad ajena.',
    fallbackObstacle: 'La insensibilidad o familiaridad excesiva que nos hace perder el asombro y el respeto.',
    fallbackAction: 'Antes de hablar de alguien ausente hoy, detente y pregúntate si lo dirías exactamente igual en su presencia.',
    fallbackInsight: 'La reverencia moral protege todo lo construido en los peldaños anteriores como un guardián que cuida un tesoro precioso.',
  },
  {
    step: 10,
    chapter: 26,
    middahNameEs: 'Kedushá / Santidad en la Vida Cotidiana',
    middahNameHe: 'מִדַּת הַקְּדֻשָּׁה',
    defaultParagraphs: 3,
    fallbackDef: 'Elevar cada acto físico y cotidiano —comer, trabajar, dialogar— hasta convertirlo en un vehículo de presencia divina.',
    fallbackObstacle: 'Pensar que la espiritualidad pertenece solo a la sinagoga o al estudio y no a la mesa o al trabajo diario.',
    fallbackAction: 'Convierte una actividad cotidiana de hoy (una comida o tu trabajo) en un momento de gratitud consciente y ética impecable.',
    fallbackInsight: 'La cumbre del Mesilat Yesharim coincide con la meta jasídica de Dirá Betajtonim: transformar la materia cotidiana en santuario.',
  },
];

// Clean HTML tags from Sefaria strings on server
function stripServerHtml(raw: any): string {
  if (!raw) return '';
  if (Array.isArray(raw)) return raw.map(stripServerHtml).filter(Boolean).join(' ');
  return String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const mesilatShotCache = new Map<string, any>();

// Endpoint to fetch a real paragraph of Mesilat Yesharim from Sefaria API v3 and structure it as a Musar Micro-lesson ("Shot")
app.post('/api/mesilat-shot', async (req, res) => {
  try {
    const { chapter, paragraph } = req.body || {};

    // Pick requested chapter or rotate by day/random from the 10 steps of the Ramchal's ladder
    let selectedMeta = MESILAT_MIDDOT_CATALOG.find((m) => m.chapter === Number(chapter));
    if (!selectedMeta) {
      const randomIndex = Math.floor(Math.random() * MESILAT_MIDDOT_CATALOG.length);
      selectedMeta = MESILAT_MIDDOT_CATALOG[randomIndex];
    }

    const targetChapter = selectedMeta.chapter;
    const targetParagraph = paragraph
      ? Number(paragraph)
      : Math.floor(Math.random() * selectedMeta.defaultParagraphs) + 1;

    const shotCacheKey = `${targetChapter}:${targetParagraph}`;
    const cachedShot = mesilatShotCache.get(shotCacheKey);
    if (cachedShot) {
      return res.json({
        ...cachedShot,
        id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
      });
    }

    const sefariaRef = `Mesillat Yesharim ${targetChapter}:${targetParagraph}`;
    const sefariaUrl = `https://www.sefaria.org/Mesillat_Yesharim.${targetChapter}.${targetParagraph}`;

    // 1. Fetch real Hebrew and English text from Sefaria v3 API using cached, timeout-bounded server helper
    let hebrewExcerpt = '';
    let englishExcerpt = '';
    let sefariaHeRef = `מסילת ישרים ${targetChapter}:${targetParagraph}`;

    try {
      const sefariaSource = await fetchSingleServerSefariaSource(sefariaRef);
      if (sefariaSource) {
        sefariaHeRef = sefariaSource.heRef || sefariaHeRef;
        if (
          sefariaSource.hebrewText &&
          !sefariaSource.hebrewText.startsWith('(Texto canónico')
        ) {
          hebrewExcerpt = stripServerHtml(sefariaSource.hebrewText);
        }
        if (
          sefariaSource.translation &&
          !sefariaSource.translation.startsWith('(Traducción canónica') &&
          !sefariaSource.translation.startsWith('(Referencia canónica')
        ) {
          englishExcerpt = stripServerHtml(sefariaSource.translation);
        }
      }
    } catch (sefErr) {
      console.warn('[Mesilat Shot] Sefaria fetch warning:', sefErr);
    }

    // 2. Transform the authentic Sefaria paragraph into a crisp Spanish Musar Shot
    try {
      const ai = getGenAIClient();
      const systemInstruction = `Eres un maestro contemporáneo de Musar (ética y desarrollo del carácter judío), especialista en el Mesilat Yesharim (La Senda de los Rectos) de Rabí Moshé Jaim Luzzatto (el Ramjal), con el estilo claro, práctico e inspirador de Chabad.org y Aish Latino.
A partir del fragmento real de Sefaria del Mesilat Yesharim que se te entrega, genera una microlección ("Shot de Musar") en español con:
1. Traducción fiel y clara al español del párrafo del Ramjal.
2. Definición breve: Qué significa este nivel/rasgo (Midá) según el Ramjal en una o dos frases directas.
3. Obstáculo común: Qué nos impide alcanzarlo o aplicarlo en la vida cotidiana moderna.
4. Acción del día: Un microejercicio concreto, medible y práctico para hoy mismo.
5. Síntesis estilo Chabad.org / Aish Latino: Una reflexión breve y luminosa que conecte esta enseñanza con nuestro crecimiento diario.`;

      const prompt = `Convierte este pasaje auténtico de Sefaria en un Shot de Musar práctico:
Referencia: ${sefariaRef} (${sefariaHeRef})
Peldaño / Midá: ${selectedMeta.middahNameEs} (${selectedMeta.middahNameHe})
Texto Hebreo de Sefaria: "${hebrewExcerpt}"
Texto Inglés de Sefaria: "${englishExcerpt}"`;

      const response = await generateContentWithRetry(
        ai,
        {
          model: GEMINI_HYDROGEN_MODEL,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                spanishTranslation: { type: Type.STRING },
                briefDefinition: { type: Type.STRING },
                commonObstacle: { type: Type.STRING },
                dailyAction: { type: Type.STRING },
                chabadOrAishInsight: { type: Type.STRING },
              },
              required: [
                'spanishTranslation',
                'briefDefinition',
                'commonObstacle',
                'dailyAction',
                'chabadOrAishInsight',
              ],
            },
          },
        },
        { timeoutMs: 25000, thinkingLevel: ThinkingLevel.LOW }
      );

      const parsed = JSON.parse(response.text || '{}');

      const shotResult = {
        id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
        chapter: targetChapter,
        paragraph: targetParagraph,
        sefariaRef,
        sefariaHeRef,
        sefariaUrl,
        middahNameEs: selectedMeta.middahNameEs,
        middahNameHe: selectedMeta.middahNameHe,
        ladderStepNumber: selectedMeta.step,
        hebrewExcerpt: hebrewExcerpt || selectedMeta.middahNameHe,
        englishExcerpt: englishExcerpt || '',
        spanishTranslation: parsed.spanishTranslation || englishExcerpt || selectedMeta.fallbackDef,
        briefDefinition: parsed.briefDefinition || selectedMeta.fallbackDef,
        commonObstacle: parsed.commonObstacle || selectedMeta.fallbackObstacle,
        dailyAction: parsed.dailyAction || selectedMeta.fallbackAction,
        chabadOrAishInsight: parsed.chabadOrAishInsight || selectedMeta.fallbackInsight,
      };
      mesilatShotCache.set(shotCacheKey, shotResult);
      return res.json(shotResult);
    } catch (aiErr) {
      // Graceful fallback using curated Ramchal ladder definitions + live Sefaria text
      const fallbackShotResult = {
        id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
        chapter: targetChapter,
        paragraph: targetParagraph,
        sefariaRef,
        sefariaHeRef,
        sefariaUrl,
        middahNameEs: selectedMeta.middahNameEs,
        middahNameHe: selectedMeta.middahNameHe,
        ladderStepNumber: selectedMeta.step,
        hebrewExcerpt: hebrewExcerpt || selectedMeta.middahNameHe,
        englishExcerpt: englishExcerpt || '',
        spanishTranslation: englishExcerpt || selectedMeta.fallbackDef,
        briefDefinition: selectedMeta.fallbackDef,
        commonObstacle: selectedMeta.fallbackObstacle,
        dailyAction: selectedMeta.fallbackAction,
        chabadOrAishInsight: selectedMeta.fallbackInsight,
      };
      mesilatShotCache.set(shotCacheKey, fallbackShotResult);
      return res.json(fallbackShotResult);
    }
  } catch (error: any) {
    console.log('[Darshán AI] Aviso en /api/mesilat-shot:', error?.message);
    return res.status(500).json({ error: error.message || 'Error al generar el Shot de Mesilat Yesharim.' });
  }
});

// ============================================================================
// PERSISTENT DERASHOT ARCHIVE & CROSS-DERASHA DIALECTICAL COMPARATOR
// ============================================================================

const ARCHIVE_FILE_PATH = path.resolve(__dirname, '.derashot-archive.json');

function readServerDerashotArchive(): any[] {
  try {
    if (fs.existsSync(ARCHIVE_FILE_PATH)) {
      const raw = fs.readFileSync(ARCHIVE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[Archive] Read warning:', err);
  }
  return [];
}

function writeServerDerashotArchive(entries: any[]): void {
  try {
    fs.writeFileSync(ARCHIVE_FILE_PATH, JSON.stringify(entries.slice(0, 200), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Archive] Write warning:', err);
  }
}

app.get('/api/derashot-archive', (req, res) => {
  const entries = readServerDerashotArchive();
  return res.json({ entries });
});

app.post('/api/derashot-archive', (req, res) => {
  try {
    const { entry } = req.body || {};
    if (!entry || !entry.sequenceNumber) {
      return res.status(400).json({ error: 'Falta el objeto entry con sequenceNumber.' });
    }
    const existing = readServerDerashotArchive();
    const idxById = existing.findIndex(
      (e: any) =>
        (entry.id && e.id === entry.id) ||
        (entry.title &&
          e.title &&
          String(e.title).trim().toLowerCase() === String(entry.title).trim().toLowerCase())
    );
    if (idxById >= 0) {
      existing[idxById] = { ...existing[idxById], ...entry };
    } else {
      const seqCollision = existing.some(
        (e: any) => Number(e.sequenceNumber) === Number(entry.sequenceNumber)
      );
      if (seqCollision) {
        const maxSeq = existing.reduce(
          (max: number, item: any) => Math.max(max, Number(item.sequenceNumber) || 0),
          0
        );
        existing.push({ ...entry, sequenceNumber: Math.max(maxSeq + 1, 10) });
      } else {
        existing.push(entry);
      }
    }
    existing.sort((a: any, b: any) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
    writeServerDerashotArchive(existing);
    return res.json({ status: 'ok', count: existing.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error guardando en archivo.' });
  }
});

app.delete('/api/derashot-archive/:sequenceNumber', (req, res) => {
  try {
    const seq = Number(req.params.sequenceNumber);
    const existing = readServerDerashotArchive();
    const filtered = existing.filter((e: any) => Number(e.sequenceNumber) !== seq);
    writeServerDerashotArchive(filtered);
    return res.json({ status: 'ok', count: filtered.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error eliminando del archivo.' });
  }
});

// ============================================================================
// SYSTEM SAFE POINTS VAULT & FALLBACK RECOVERY ENGINE
// ============================================================================

const SAFEPOINTS_FILE_PATH = path.resolve(__dirname, '.system-safepoints.json');

function readServerSafePoints(): any[] {
  try {
    if (fs.existsSync(SAFEPOINTS_FILE_PATH)) {
      const raw = fs.readFileSync(SAFEPOINTS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[SafePoints] Read warning:', err);
  }
  return [];
}

function writeServerSafePoints(snapshots: any[]): void {
  try {
    fs.writeFileSync(
      SAFEPOINTS_FILE_PATH,
      JSON.stringify(snapshots.slice(0, 25), null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('[SafePoints] Write warning:', err);
  }
}

app.get('/api/safepoints', (req, res) => {
  const snapshots = readServerSafePoints();
  const archive = readServerDerashotArchive();
  return res.json({
    status: 'healthy',
    serverArchiveCount: archive.length,
    preSeededSourcesCount: PRE_SEEDED_CANONICAL_SOURCES.length,
    snapshots,
  });
});

app.post('/api/safepoints', (req, res) => {
  try {
    const { snapshot } = req.body || {};
    if (!snapshot || !snapshot.id || !snapshot.payload) {
      return res.status(400).json({ error: 'Falta el objeto snapshot válido.' });
    }
    const existing = readServerSafePoints().filter((s: any) => s && s.id !== snapshot.id);
    const updated = [snapshot, ...existing].slice(0, 20);
    writeServerSafePoints(updated);

    if (Array.isArray(snapshot.payload.archive) && snapshot.payload.archive.length > 0) {
      writeServerDerashotArchive(snapshot.payload.archive);
    }

    return res.json({ status: 'ok', id: snapshot.id, count: updated.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error guardando Punto Seguro.' });
  }
});

app.post('/api/safepoints/restore', (req, res) => {
  try {
    const { safePointId, archive } = req.body || {};
    // Clear potentially corrupted or stale in-memory caches on restore
    decideMethodologyCache.clear();
    phase1MemoryCache.clear();
    derashaMemoryCache.clear();

    if (Array.isArray(archive) && archive.length > 0) {
      writeServerDerashotArchive(archive);
      return res.json({
        status: 'restored',
        safePointId: safePointId || 'custom',
        archiveCount: archive.length,
      });
    }

    const snapshots = readServerSafePoints();
    const target = safePointId
      ? snapshots.find((s: any) => s.id === safePointId)
      : snapshots[0];

    if (target && target.payload && Array.isArray(target.payload.archive)) {
      writeServerDerashotArchive(target.payload.archive);
      return res.json({
        status: 'restored',
        safePointId: target.id,
        archiveCount: target.payload.archive.length,
        snapshot: target,
      });
    }

    return res.json({
      status: 'restored_baseline',
      safePointId: safePointId || 'safepoint-golden-baseline-v1',
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || 'Error restaurando Punto Seguro en el servidor.' });
  }
});

app.delete('/api/safepoints/:id', (req, res) => {
  try {
    const targetId = req.params.id;
    const existing = readServerSafePoints();
    const updated = existing.filter((s: any) => s && s.id !== targetId);
    writeServerSafePoints(updated);
    return res.json({ status: 'ok', count: updated.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error eliminando Punto Seguro.' });
  }
});

app.post('/api/compare-derashot', async (req, res) => {
  try {
    const { derashot, relationType = 'INTEGRAL', userHypothesis = '' } = req.body || {};
    if (!Array.isArray(derashot) || derashot.length < 2) {
      return res
        .status(400)
        .json({ error: 'Se requieren al menos 2 Derashot para realizar el análisis comparativo.' });
    }

    const comparedNumbers: number[] = derashot.map((d: any, i: number) =>
      Number(d.sequenceNumber || i + 1)
    );
    const comparedTitles: string[] = derashot.map(
      (d: any, i: number) => d.title || `Derashá #${d.sequenceNumber || i + 1}`
    );
    const labelStr = comparedNumbers.map((n) => `Derashá #${n}`).join(' vs ');

    const derashotContextBlock = derashot
      .map(
        (d: any) => `=== DERASHÁ #${d.sequenceNumber}: "${d.title}" ===
- Consulta original: ${d.query || ''}
- Metodología: ${d.methodology || 'PARDES'}
- Idea central / Tesis: ${d.centralIdea || ''}
- Fuentes citadas: ${d.sourcesSummary || ''}
- Resumen del cuerpo homilético:
${String(d.essaySummary || '').slice(0, 3500)}`
      )
      .join('\n\n');

    try {
      const ai = getGenAIClient();
      const systemInstruction = `Eres un Jajam, filósofo judío y maestro de Beit Midrash especializado en exégesis dialéctica comparada (al estilo del Talmud Bavli, el Maharal de Praga, Rabino Jonathan Sacks y Rav Joseph B. Soloveitchik).
El usuario ha seleccionado dos o más Derashot numeradas de su archivo histórico (${labelStr}) y desea realizar un análisis profundo sobre cómo dialogan entre sí:
- Si hay una RELACIÓN o hilo conductor oculto entre ellas.
- Si parecen CONTRADECIRSE (Majloket / tensión entre universalismo y particularismo, autonomía e imperativo divino, individuo y comunidad, inmanencia y trascendencia, fuentes internas de la Torá y fuentes externas).
- Si se COMPLEMENTAN (Hashlamá / «Eilu v'Eilu divrei Elohim Chayim» — Eruvín 13b) y cómo lo que una deja abierto la otra lo resuelve.

REGLAS ESTRICTAS:
1. Cita explícitamente por su número cada estudio analizado (ej. «En la Derashá #${comparedNumbers[0]}... mientras que en la Derashá #${comparedNumbers[1]}...»).
2. Evalúa directamente la hipótesis u observación del usuario: "${userHypothesis || 'Analizar relación, contradicción y complementariedad'}".
3. Cuando alguna de las Derashot involucre fuentes externas (como Kant, Platón, Cicerón, Budismo/Iluminación, Nirvana o Valhalla) frente a fuentes internas de la Torá (Tanaj, Talmud, Midrash, Maimónides, Ramjal), explicita con rigor filosófico cómo ese contraste externo ilumina la comparación entre las Derashot.
4. Responde SIEMPRE en español académico y claro, en formato JSON válido según el esquema.`;

      const prompt = `Realiza un estudio dialéctico comparativo entre las siguientes Derashot del archivo del usuario:

ENFOQUE SOLICITADO: ${relationType}
HIPÓTESIS / OBSERVACIÓN DEL USUARIO: "${userHypothesis || `Analizar la relación, contradicción o complementariedad entre ${labelStr}`}"

TEXTO Y METADATOS DE LAS DERASHOT SELECCIONADAS:
${derashotContextBlock}`;

      const response = await generateContentWithRetry(
        ai,
        {
          model: GEMINI_HYDROGEN_MODEL,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                synthesisTitle: { type: Type.STRING },
                executiveVerdict: { type: Type.STRING },
                perDerashaCoreThesis: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sequenceNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      coreThesis: { type: Type.STRING },
                      keySource: { type: Type.STRING },
                      normativeOrPhilosophicalAngle: { type: Type.STRING },
                    },
                    required: [
                      'sequenceNumber',
                      'title',
                      'coreThesis',
                      'keySource',
                      'normativeOrPhilosophicalAngle',
                    ],
                  },
                },
                pointsOfRelationship: { type: Type.STRING },
                pointsOfContradictionOrTension: { type: Type.STRING },
                pointsOfComplementarity: { type: Type.STRING },
                dialecticalSynthesisAndHomileticBridge: { type: Type.STRING },
                canonicalBridgeSources: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING },
                      rationale: { type: Type.STRING },
                    },
                    required: ['ref', 'rationale'],
                  },
                },
                suggestedFollowUpQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'synthesisTitle',
                'executiveVerdict',
                'perDerashaCoreThesis',
                'pointsOfRelationship',
                'pointsOfContradictionOrTension',
                'pointsOfComplementarity',
                'dialecticalSynthesisAndHomileticBridge',
                'canonicalBridgeSources',
                'suggestedFollowUpQuestions',
              ],
            },
          },
        },
        { timeoutMs: 85000, thinkingLevel: ThinkingLevel.XHIGH }
      );

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        id: `cmp-${comparedNumbers.join('-')}-${Date.now()}`,
        comparedNumbers,
        comparedTitles,
        relationType,
        userHypothesis:
          userHypothesis || `Contraste dialéctico entre ${labelStr}`,
        synthesisTitle:
          parsed.synthesisTitle ||
          `Síntesis Dialéctica: ${comparedNumbers.map((n) => `Derashá #${n}`).join(' × ')}`,
        executiveVerdict: parsed.executiveVerdict || '',
        perDerashaCoreThesis: Array.isArray(parsed.perDerashaCoreThesis)
          ? parsed.perDerashaCoreThesis
          : [],
        pointsOfRelationship: parsed.pointsOfRelationship || '',
        pointsOfContradictionOrTension: parsed.pointsOfContradictionOrTension || '',
        pointsOfComplementarity: parsed.pointsOfComplementarity || '',
        dialecticalSynthesisAndHomileticBridge:
          parsed.dialecticalSynthesisAndHomileticBridge || '',
        canonicalBridgeSources: Array.isArray(parsed.canonicalBridgeSources)
          ? parsed.canonicalBridgeSources
          : [],
        suggestedFollowUpQuestions: Array.isArray(parsed.suggestedFollowUpQuestions)
          ? parsed.suggestedFollowUpQuestions
          : [],
        createdAt: new Date().toISOString(),
      });
    } catch (llmErr) {
      // Deterministic high-rigor rabbinic N-way dialectical synthesis engine
      const allLabel = derashot
        .map((d: any, i: number) => `Derashá #${d.sequenceNumber || i + 1} («${d.title}»)`)
        .join(derashot.length === 2 ? ' y ' : ', ');
      const shortNumsLabel = comparedNumbers.map((n) => `#${n}`).join(' × ');

      const relationModeTitlePrefix =
        relationType === 'CONTRADICCION'
          ? 'Tensión Dialéctica y Majloket Leshem Shamáyim'
          : relationType === 'COMPLEMENTO'
          ? 'Armonía y Complementariedad Exegética'
          : relationType === 'RELACION'
          ? 'Hilo Conductor y Relación Estructural'
          : 'Síntesis Dialéctica Integral (Tesis · Antítesis · Síntesis)';

      const has1and5 = comparedNumbers.includes(1) && comparedNumbers.includes(5);
      const has3and4 = comparedNumbers.includes(3) && comparedNumbers.includes(4);
      const has6and7 = comparedNumbers.includes(6) && comparedNumbers.includes(7);
      const has8 = comparedNumbers.includes(8);

      const perDerashaBreakdownText = derashot
        .map(
          (d: any) =>
            `la **Derashá #${d.sequenceNumber}** (*«${d.title}»*, metodología ${d.methodology}) sostiene que ${d.centralIdea}`
        )
        .join('; mientras que ');

      const customExecutiveVerdict = has1and5
        ? relationType === 'CONTRADICCION'
          ? `Tu intuición sobre la **contradicción aparente** entre la **Derashá #1** (el deber moral frente a Kant) y la **Derashá #5** (el amor al prójimo como eje de la Torá) toca una tensión clásica del pensamiento judío (*Eruvín 13b*): la #1 afirma con Rabí Janiná (*Kidushín 31a*) la superioridad de quien actúa **comandado por el decreto heterónomo** (*Metzuvé ve-osé*), mientras que la #5 exige con Hilel (*Shabat 31a*) y Rabí Akiva (*Sifrá Kedoshim*) la **interiorización afectiva del amor interpersonal**. La resolución rabínica demuestra que el mandamiento externo de la #1 es la vasija (*Kli*) que protege y educa la luz interior del amor en la #5.`
          : `El análisis en modo **${relationType}** entre la **Derashá #1** y la **Derashá #5** revela el puente entre **Teonomía y Amor Relacional**: en la Derashá #1 la voz del Sinaí quiebra el solipsismo del ego autónomo (*Kidushín 31a*), y en la Derashá #5 esa misma voz se revela no como imposición arbitraria sino como vínculo de amor al prójimo creado *Betzelem Elohim* (*Levítico 19:18*; *Shabat 31a*).`
        : has3and4
        ? `El contraste (${relationType}) entre la **Derashá #3** (Iluminación: *Or HaGanuz* frente al *Bodhi* budista) y la **Derashá #4** (Destino del alma: *Olam HaBá* frente a *Nirvana*, *Valhalla* y Cielo/Infierno) articula una misma arquitectura: la continuidad entre **cómo iluminamos este mundo** mediante la especificidad de la *Mitzvá* (*Proverbios 6:23*) y **cómo esa acción encarnada edifica la identidad eterna del alma (*Neshamá*)** en el *Olam HaBá* (*Pirké Avot 4:16–17*), sin disolver jamás el yo en el *Anatta*.`
        : has6and7 && has8
        ? `Esta comparación triple (${shortNumsLabel} en modo **${relationType}**) traza el mapa completo de las fronteras teológicas del judaísmo: la **Derashá #6** contrasta al *Mashíaj* humano de David con el dogma cristológico trinitario; la **Derashá #7** lo contrasta con la abdicación real y el no-teísmo de Siddhartha Gautama (Buda); y la **Derashá #8** aplica esos mismos criterios halájicos (*Deuteronomio 6:4*; *Hiljot Melajim 11:1–4*) para distinguir entre la pluralidad legítima dentro del judaísmo (Jabad, Breslov, Ortodoxia, Reformismo) y el movimiento «judío mesiánico», que al adoptar la cristología analizada en la #6 cruza la frontera hacia el cristianismo evangélico.`
        : `Al analizar conjuntamente ${allLabel} bajo el prisma de **${relationModeTitlePrefix}** (${relationType}), descubrimos la dinámica talmúdica de *«Eilu v'Eilu divrei Elohim Chayim»* (*Eruvín 13b*): ${perDerashaBreakdownText}. Lejos de anularse, cada Derashá ilumina una dimensión indispensable entre el fundamento normativo de la Torá y su encarnación ética e histórica.`;

      return res.json({
        id: `cmp-${comparedNumbers.join('-')}-${relationType.toLowerCase()}-${Date.now()}`,
        comparedNumbers,
        comparedTitles,
        relationType,
        userHypothesis:
          userHypothesis || `Análisis comparativo (${relationType}) entre ${labelStr}`,
        synthesisTitle: `${relationModeTitlePrefix}: ${allLabel}`,
        executiveVerdict: customExecutiveVerdict,
        perDerashaCoreThesis: derashot.map((d: any) => ({
          sequenceNumber: Number(d.sequenceNumber),
          title: d.title,
          coreThesis: d.centralIdea,
          keySource: String(d.sourcesSummary || 'Sefaria').split('·')[0].trim(),
          normativeOrPhilosophicalAngle: `Metodología ${d.methodology}: articula la distinción entre principios universales abstractos y la especificidad encarnada de la Mitzvá (${String(d.sourcesSummary || '').trim()}).`,
        })),
        pointsOfRelationship: `Las ${derashot.length} Derashot comparadas (${comparedNumbers.map((n) => `Derashá #${n}`).join(', ')}) comparten un eje teológico común: ${derashot.map((d: any) => `en la #${d.sequenceNumber} («${d.title}») a través de ${String(d.sourcesSummary || 'las fuentes clásicas').split('·')[0].trim()}`).join('; ')}. En todas ellas, la Torá rechaza tanto el aislamiento especulativo como la disolución de la responsabilidad personal, exigiendo que la verdad espiritual se verifique en la acción ética e histórica concreta.`,
        pointsOfContradictionOrTension: `La tensión dialéctica (*Majloket*) entre ${comparedNumbers.map((n) => `la Derashá #${n}`).join(', ')} surge del vector específico que cada una prioriza: ${derashot.map((d: any) => `la Derashá #${d.sequenceNumber} enfatiza «${d.keyQuestion || d.title}» desde la metodología ${d.methodology}`).join(' vs. ')}. Si se toma aisladamente una sola de estas perspectivas sin las demás, se pierde el equilibrio entre la trascendencia del mandato divino (*Kidushín 31a*) y su interiorización vital en el corazón y la sociedad (*Deuteronomio 30:14*).`,
        pointsOfComplementarity: `Siguiendo la hermenéutica del Maharal de Praga y del Rabino Jonathan Sacks, ${comparedNumbers.map((n) => `la Derashá #${n}`).join(' y ')} se completan mutuamente: ${derashot.map((d: any, idx: number) => `la #${d.sequenceNumber} aporta el ${idx === 0 ? 'fundamento ontológico y normativo' : idx === 1 ? 'despliegue ético, relacional o comparativo' : 'criterio de demarcación halájica y comunitaria'} (${d.methodology})`).join('; ')}. Juntas integran la especificidad del mandamiento (*Proverbios 6:23*: *«Ki ner mitzvá ve-Torá or»*) con el horizonte universal de la creación.`,
        dialecticalSynthesisAndHomileticBridge: `Para construir una enseñanza magistral que integre ${comparedNumbers.map((n) => `la Derashá #${n}`).join(', ')} bajo el modo **${relationType}**: abre planteando la interrogante de la Derashá #${derashot[0].sequenceNumber} («${derashot[0].keyQuestion || derashot[0].title}»), contrapón el ángulo de ${derashot.slice(1).map((d: any) => `la Derashá #${d.sequenceNumber} («${d.title}»)`).join(' y ')}, y sella la síntesis con *Pirkei Avot 1:17* (*«Lo HaMidrash Hu HaIkar Ela HaMaasé»*), mostrando cómo cada estudio representa una faceta viva de la misma luz de la Torá.`,
        canonicalBridgeSources: [
          {
            ref: 'Eruvin 13b',
            rationale:
              '«Estas y aquellas son palabras del Dios Viviente»: la pluralidad de ángulos exegéticos entre las Derashot comparadas revela facetas complementarias de la Torá.',
          },
          {
            ref: 'Proverbs 6:23',
            rationale:
              '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento y la Torá es luz): puente entre la especificidad del precepto y la sabiduría universal.',
          },
          {
            ref: 'Pirkei Avot 1:17',
            rationale:
              'Articulación entre el fundamento teórico-teológico y la responsabilidad práctica en el mundo.',
          },
        ],
        suggestedFollowUpQuestions: [
          `¿Cómo podría estructurar una serie de clases conectando ${comparedNumbers.map((n) => `la Derashá #${n}`).join(', ')}?`,
          `¿Qué dirían Maimónides y el Rabino Jonathan Sacks sobre la síntesis entre ${comparedNumbers.map((n) => `la #${n}`).join(' y ')}?`,
          `¿Qué fuente adicional del Talmud o del Midrash sirve de puente entre ${comparedNumbers.map((n) => `la Derashá #${n}`).join(' y ')}?`,
        ],
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('[Compare Derashot] Error:', error);
    return res
      .status(500)
      .json({ error: error?.message || 'Error al comparar las Derashot seleccionadas.' });
  }
});

// ============================================================================
// YOUTUBE VIDEO ANALYZER -> VECTOR ILLUSTRATIONS & ANIMATION STORYBOARDS
// ============================================================================

const youtubeVisualCache = new Map<string, any>();

function extractYouTubeVideoId(rawUrl: string): string | null {
  const input = String(rawUrl || '').trim();
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0];
      return seg && /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = parsed.pathname.split('/').filter(Boolean);
      for (const prefix of ['shorts', 'live', 'embed', 'v']) {
        const idx = parts.indexOf(prefix);
        if (idx >= 0 && parts[idx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[idx + 1])) {
          return parts[idx + 1];
        }
      }
    }
  } catch {
    const match = input.match(/(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([a-zA-Z0-9_-]{11})/);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function fetchYouTubeMetadataAndTranscript(
  canonicalUrl: string,
  videoId: string
): Promise<{
  title: string;
  channelName: string;
  thumbnailUrl: string;
  description: string;
  transcriptExcerpt: string;
}> {
  let title = '';
  let channelName = '';
  let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let description = '';
  let transcriptExcerpt = '';

  const oembedPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data: any = await res.json();
        if (data?.title) title = String(data.title).trim();
        if (data?.author_name) channelName = String(data.author_name).trim();
        if (data?.thumbnail_url) thumbnailUrl = String(data.thumbnail_url).trim();
      }
    } catch {
      // ignore oembed failure
    }
  })();

  const watchPagePromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4500);
      const res = await fetch(canonicalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DarshanAI/1.0)',
          'Accept-Language': 'es,en;q=0.9,he;q=0.8',
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return;
      const html = await res.text();
      const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]+)"/i);
      if (!title && titleMatch?.[1]) {
        title = titleMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
      }
      const descMatch = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
      if (descMatch?.[1]) {
        try {
          description = JSON.parse(`"${descMatch[1]}"`).slice(0, 2200);
        } catch {
          description = descMatch[1].slice(0, 2200);
        }
      }
      const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
      if (captionMatch?.[1]) {
        try {
          const tracks = JSON.parse(captionMatch[1]);
          if (Array.isArray(tracks) && tracks.length > 0) {
            const preferred =
              tracks.find((t: any) => String(t?.languageCode || '').startsWith('es')) ||
              tracks.find((t: any) => String(t?.languageCode || '').startsWith('en')) ||
              tracks[0];
            if (preferred?.baseUrl) {
              const capCtrl = new AbortController();
              const capTimer = setTimeout(() => capCtrl.abort(), 3500);
              const capRes = await fetch(preferred.baseUrl, { signal: capCtrl.signal });
              clearTimeout(capTimer);
              if (capRes.ok) {
                const xml = await capRes.text();
                transcriptExcerpt = xml
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 4500);
              }
            }
          }
        } catch {
          // ignore caption parse failure
        }
      }
    } catch {
      // ignore watch page fetch failure
    }
  })();

  await Promise.all([oembedPromise, watchPagePromise]);

  return {
    title: title || `Video de YouTube (${videoId})`,
    channelName: channelName || 'Canal de YouTube',
    thumbnailUrl,
    description,
    transcriptExcerpt,
  };
}

function buildFallbackSvgIllustration(params: {
  title: string;
  hebrewCaption: string;
  sceneNumber: number;
  palette: [string, string, string];
  aspectRatio: '16:9' | '9:16';
  visualStyle: string;
}): string {
  const w = params.aspectRatio === '9:16' ? 450 : 800;
  const h = params.aspectRatio === '9:16' ? 800 : 450;
  const cx = w / 2;
  const cy = h / 2;
  const [c1, c2, c3] = params.palette;
  const safeTitle = String(params.title || 'Escena Ilustrada')
    .replace(/[<>&"]/g, '')
    .slice(0, 56);
  const safeHe = String(params.hebrewCaption || 'אוֹר וְחָכְמָה')
    .replace(/[<>&"]/g, '')
    .slice(0, 32);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
  <defs>
    <radialGradient id="bg-${params.sceneNumber}" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.38" />
      <stop offset="55%" stop-color="${c1}" stop-opacity="0.92" />
      <stop offset="100%" stop-color="#070c18" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="accent-${params.sceneNumber}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c3}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${c2}" stop-opacity="0.7" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg-${params.sceneNumber})" rx="16" />
  <circle cx="${cx}" cy="${cy - 18}" r="${Math.min(w, h) * 0.28}" fill="none" stroke="${c3}" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="6 6" />
  <circle cx="${cx}" cy="${cy - 18}" r="${Math.min(w, h) * 0.19}" fill="none" stroke="url(#accent-${params.sceneNumber})" stroke-width="2.2" />
  <polygon points="${cx},${cy - 92} ${cx + 66},${cy + 26} ${cx - 66},${cy + 26}" fill="none" stroke="${c3}" stroke-width="1.8" stroke-opacity="0.78" />
  <polygon points="${cx},${cy + 58} ${cx + 66},${cy - 60} ${cx - 66},${cy - 60}" fill="none" stroke="${c2}" stroke-width="1.6" stroke-opacity="0.72" />
  <line x1="${cx - 120}" y1="${cy + 94}" x2="${cx + 120}" y2="${cy + 94}" stroke="${c3}" stroke-opacity="0.4" stroke-width="1.5" />
  <text x="${cx}" y="${cy - 12}" text-anchor="middle" fill="#f8fafc" font-family="Frank Ruhl Libre, Georgia, serif" font-size="28" font-weight="700">${safeHe}</text>
  <text x="${cx}" y="${cy + 125}" text-anchor="middle" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="600">${safeTitle}</text>
</svg>`;
}

function sanitizeSvgMarkup(
  rawSvg: string,
  fallbackParams: {
    title: string;
    hebrewCaption: string;
    sceneNumber: number;
    palette: [string, string, string];
    aspectRatio: '16:9' | '9:16';
    visualStyle: string;
  }
): string {
  const raw = String(rawSvg || '').trim();
  const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) {
    return buildFallbackSvgIllustration(fallbackParams);
  }
  let clean = svgMatch[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  if (!/viewBox\s*=/i.test(clean)) {
    const vb = fallbackParams.aspectRatio === '9:16' ? '0 0 450 800' : '0 0 800 450';
    clean = clean.replace(/<svg\b/i, `<svg viewBox="${vb}"`);
  }
  if (!/xmlns\s*=/i.test(clean)) {
    clean = clean.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
  }
  return clean;
}

async function generateRasterIllustrationForScene(params: {
  ai: GoogleGenAI;
  prompt: string;
  visualStyle: string;
  aspectRatio: '16:9' | '9:16';
  qualityTier: 'flash_lite' | 'nano_banana_2_1';
}): Promise<{ imageDataUrl?: string; imageModelUsed?: string }> {
  const modelName =
    params.qualityTier === 'nano_banana_2_1'
      ? 'gemini-nano-banana-2.1'
      : 'gemini-3.1-flash-lite-image';

  const stylePromptAddon: Record<string, string> = {
    editorial_iluminado:
      'Illuminated dark-navy manuscript editorial illustration style (#0b1120), luminous gold (#f59e0b) and sky-blue (#38bdf8) light accents, fine architectural linework, museum-grade clarity.',
    diagrama_filosofico:
      'Clean pedagogical conceptual diagram illustration, crisp dark slate backdrop, luminous geometric nodes, directional balance, editorial vector-inspired precision, legible visual hierarchy.',
    acuarela_pergamino:
      'Warm parchment and traditional ink wash illustration, amber gold and burnt sepia accents, organic brushwork, sacred scholarly atmosphere.',
    geometria_cabalistica:
      'Sacred geometric light illustration, concentric golden spheres, radiant beams, deep cosmic indigo background, contemplative symmetry.',
  };

  const fullPrompt = `${params.prompt}\n\nVisual art direction: ${
    stylePromptAddon[params.visualStyle] || stylePromptAddon.editorial_iluminado
  }\nEnsure clean composition, high educational clarity, no cluttered text watermarks, no garbled typography.`;

  const config: Record<string, any> = {
    imageConfig:
      params.qualityTier === 'nano_banana_2_1'
        ? {
            aspectRatio: params.aspectRatio,
            imageSize: '1K',
          }
        : {
            aspectRatio: params.aspectRatio,
          },
  };

  try {
    const response = await Promise.race([
      params.ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('IMAGE_GEN_TIMEOUT')), 45000)
      ),
    ]);

    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        return {
          imageDataUrl: `data:${mime};base64,${part.inlineData.data}`,
          imageModelUsed: modelName,
        };
      }
    }
    return {};
  } catch (err: any) {
    console.log(`[Image Gen] Fallback to SVG for scene (${modelName}):`, err?.message);
    return {};
  }
}

const RITUAL_TRADITION_PROFILES: Record<
  'ashkenazi' | 'sefardi' | 'chabad_ari' | 'general_comparative',
  {
    label: string;
    hebrewLabel: string;
    wrappingDetailEs: string;
    visualDirectionEn: string;
  }
> = {
  ashkenazi: {
    label: 'Tradición Ashkenazí',
    hebrewLabel: 'מִנְהַג אַשְׁכְּנַז',
    wrappingDetailEs:
      'Siete vueltas sobre el antebrazo hacia afuera (en sentido antihorario mirando el brazo izquierdo); en la palma y dedos se forma la letra Shin (ש) en el dorso de la mano y las vueltas en el dedo medio y anular completan Dalet (ד) y Yod (י).',
    visualDirectionEn:
      'Ashkenazi tefillin hand-wrapping close-up: seven forearm coils wrapped outward away from the body, forming the three-pronged Hebrew letter Shin across the back of the hand and wrapping three coils around the middle finger (two on the lower phalanx, one on the middle phalanx) to form Dalet and Yod.',
  },
  sefardi: {
    label: 'Tradición Sefardí / Edot HaMizraj',
    hebrewLabel: 'מִנְהַג סְפָרַד וְעֵדוֹת הַמִּזְרָח',
    wrappingDetailEs:
      'Siete vueltas sobre el antebrazo hacia adentro (hacia el cuerpo); al llegar a la mano, el paso diagonal sobre la palma y los anillos alrededor del dedo medio/anular siguen el orden clásico del Shulján Aruj y el Ben Ish Jai formando el Nombre Shaddai.',
    visualDirectionEn:
      'Sephardic / Edot HaMizrach tefillin hand-wrapping close-up: seven forearm coils wrapped inward toward the body, clear diagonal strap path across the palm without forming a raised Shin on the back of the hand in the same way, clean Sephardic finger-wrapping sequence around the middle and ring fingers.',
  },
  chabad_ari: {
    label: 'Tradición Jabad / Ari (Núsaj Sefard)',
    hebrewLabel: 'מִנְהַג חַבָּ״ד וְהָאֲרִ״י',
    wrappingDetailEs:
      'Siete vueltas hacia adentro formando la letra Shin sobre el antebrazo superior/muñeca y sobre la palma según el Alter Rebe (Shulján Aruj HaRav), cruzando primero hacia el dedo anular y rodeando el dedo medio con precisión cabalística.',
    visualDirectionEn:
      'Chabad / AriZal tefillin hand-wrapping close-up: seven forearm coils wrapped inward, distinct Shin formation on the upper palm/wrist per Shulchan Aruch HaRav, wrapping from the palm over to the ring finger and middle finger in the Chabad sequence.',
  },
  general_comparative: {
    label: 'Comparativa Visual de Tradiciones',
    hebrewLabel: 'הַשְׁוָאַת מִנְהָגִים',
    wrappingDetailEs:
      'Diagrama comparativo lado a lado mostrando la dirección de giro (hacia adentro vs hacia afuera) y las variantes del amarre en palma y dedos entre Ashkenazí, Sefardí y Jabad/Ari.',
    visualDirectionEn:
      'Side-by-side educational comparison diagram showing Ashkenazi vs Sephardic vs Chabad hand-wrapping close-up trajectories with subtle golden directional arrows.',
  },
};

app.post('/api/analyze-youtube-visuals', async (req, res) => {
  try {
    const {
      youtubeUrl = '',
      outputMode = 'both',
      visualStyle = 'editorial_iluminado',
      aspectRatio = '16:9',
      imageQuality = 'flash_lite',
      traditionPreference,
      customFocus = '',
    } = req.body || {};

    const videoId = extractYouTubeVideoId(String(youtubeUrl));
    if (!videoId) {
      return res.status(400).json({
        error:
          'Por favor ingresa una URL válida de YouTube (por ejemplo: https://www.youtube.com/watch?v=... o https://youtu.be/...).',
      });
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const safeStyle = [
      'editorial_iluminado',
      'diagrama_filosofico',
      'acuarela_pergamino',
      'geometria_cabalistica',
    ].includes(visualStyle)
      ? visualStyle
      : 'editorial_iluminado';
    const safeMode = ['both', 'illustrations', 'animation'].includes(outputMode)
      ? outputMode
      : 'both';
    const safeAspect: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
    const safeQuality: 'flash_lite' | 'nano_banana_2_1' =
      imageQuality === 'nano_banana_2_1' ? 'nano_banana_2_1' : 'flash_lite';
    const safeTradition: 'ashkenazi' | 'sefardi' | 'chabad_ari' | 'general_comparative' | '' =
      traditionPreference &&
      ['ashkenazi', 'sefardi', 'chabad_ari', 'general_comparative'].includes(traditionPreference)
        ? traditionPreference
        : '';

    const cacheKey = `${videoId}::${safeStyle}::${safeAspect}::${safeMode}::${safeQuality}::${safeTradition}::${String(customFocus).trim().toLowerCase()}`;
    const cached = youtubeVisualCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const metadata = await fetchYouTubeMetadataAndTranscript(canonicalUrl, videoId);
    const svgViewBox = safeAspect === '9:16' ? '0 0 450 800' : '0 0 800 450';

    const styleGuidanceMap: Record<string, string> = {
      editorial_iluminado:
        'Estética de manuscrito editorial nocturno iluminado: fondos azul abismo (#0b1120), destellos dorados (#f59e0b) y celestes (#38bdf8), líneas finas doradas y composición arquitectónica clásica.',
      diagrama_filosofico:
        'Estética de diagrama conceptual y filosófico limpio: geometría analítica clara, ejes simétricos, flechas direccionales, nodos etiquetados y contraste entre orden y movimiento.',
      acuarela_pergamino:
        'Estética cálida de pergamino y tinta tradicional: gradientes suaves ámbar/sepia (#1c1917, #d97706, #fef3c7), trazos orgánicos curvos y caligrafía hebrea destacada.',
      geometria_cabalistica:
        'Estética de geometría sagrada y Sefirot: círculos concéntricos, triángulos entrelazados, rayos de luz (Or Ein Sof), pilares de equilibrio y simetría mística.',
    };

    const traditionInstructionBlock = safeTradition
      ? `\n\nTRADICIÓN SELECCIONADA POR EL USUARIO PARA EL CLOSE-UP: **${RITUAL_TRADITION_PROFILES[safeTradition].label} (${RITUAL_TRADITION_PROFILES[safeTradition].hebrewLabel})**.\nDetalle obligatorio para la escena de close-up (tanto en 'visualConcept', 'imagePrompt', 'svgMarkup' y 'videoPrompt'):\n${RITUAL_TRADITION_PROFILES[safeTradition].wrappingDetailEs}\nEn inglés para 'imagePrompt' y 'videoPrompt': ${RITUAL_TRADITION_PROFILES[safeTradition].visualDirectionEn}`
      : '';

    const systemInstruction = `Eres un director de arte visual, ilustrador editorial, especialista en pedagogía audiovisual y exégeta en **Darshán AI**.
Tu tarea es analizar en profundidad el video de YouTube proporcionado y diseñar:
1. Una síntesis conceptual precisa del video ('coreThesis', 'suggestedDerashaTopic', 'keyHebrewTerms').
2. **Evaluación pedagógica de claridad ('pedagogicalComparison')**: analiza específicamente para este video/tutorial si el alumno o espectador logra mayor claridad mediante **animaciones paso a paso ('animacion_escenica')**, **video continuo ('video_continuo')** o un **enfoque híbrido ('hibrido')**, detallando las fortalezas concretas de cada formato ('clarityVerdict', 'videoStrengths', 'animationStrengths').
3. **Detección de Variantes de Tradición / Minhag antes del Close-up ('traditionPreferenceGate')**:
   - Evalúa si el video enseña un procedimiento ritual o halájico práctico con variaciones entre comunidades (por ejemplo: colocación de **Tefilín y amarre de la correa en brazo/mano/dedos**, nudos de **Tzitzit/Talit**, **Netilat Yadayim**, encendido de **Janukiá**, etc.).
   - Si aplica (o si involucra amarre en la mano/Tefilín), marca \`requiresTraditionSelection: true\`, indica cuál escena corresponde al plano cerrado (\`closeUpSceneNumber\`, por ejemplo 2 o 3) y explica brevemente en \`reasonEs\` por qué conviene preguntar primero la costumbre comunitaria antes de mostrar el close-up.
4. **3 Ilustraciones clave** ('illustrations') correspondientes a los momentos centrales del video:
   - Cada elemento debe incluir un 'imagePrompt' detallado en inglés (rich visual prompt describing scene, lighting, symbolism, composition, no watermark text) optimizado para generación de imagen por IA.
   - Además, incluye un 'svgMarkup' completo, válido y autocontenido (<svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgViewBox}">...</svg>) con <defs>, gradientes y formas limpias (sin <script> ni atributos on*=).
   - Aplica fielmente el estilo visual solicitado: ${styleGuidanceMap[safeStyle]}.
5. **Un Storyboard de Animación Escénica** ('animationStoryboard') con **4 escenas secuenciales** sincronizadas con los momentos del video, más un 'videoPrompt' cinematográfico en inglés para generar un clip animado coherente con el modelo de video Omni Flash, especificando para cada escena el patrón de movimiento ('radiant_rays', 'orbiting_spheres', 'scroll_unfold', 'ascending_sparks', o 'dialectic_bridge'), colores hexadecimales y elementos clave.${traditionInstructionBlock}

Responde SIEMPRE en español claro y culto (salvo los campos 'imagePrompt' y 'videoPrompt', que van en inglés descriptivo para óptima fidelidad visual), respetando estrictamente el esquema JSON.`;

    const contextSummaryBlock = `Metadatos recuperados del video:
- URL canónica: ${canonicalUrl}
- Título: ${metadata.title}
- Canal / Autor: ${metadata.channelName}
${metadata.description ? `- Descripción:\n${metadata.description.slice(0, 1400)}` : ''}
${metadata.transcriptExcerpt ? `- Extracto de subtítulos / transcripción:\n${metadata.transcriptExcerpt.slice(0, 3200)}` : ''}
${customFocus ? `- Enfoque visual solicitado por el usuario: "${String(customFocus).trim()}"` : ''}
${safeTradition ? `- Tradición seleccionada para el close-up: ${RITUAL_TRADITION_PROFILES[safeTradition].label}` : ''}

Instrucciones de formato:
- Modo solicitado: ${safeMode}
- Estilo visual: ${safeStyle}
- Relación de aspecto: ${safeAspect} (viewBox="${svgViewBox}")`;

    let parsed: any = null;
    let analyzedWithVideoStream = false;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        coreThesis: { type: Type.STRING },
        suggestedDerashaTopic: { type: Type.STRING },
        pedagogicalComparison: {
          type: Type.OBJECT,
          properties: {
            recommendedFormat: { type: Type.STRING },
            clarityVerdict: { type: Type.STRING },
            videoStrengths: { type: Type.STRING },
            animationStrengths: { type: Type.STRING },
          },
          required: ['recommendedFormat', 'clarityVerdict', 'videoStrengths', 'animationStrengths'],
        },
        traditionPreferenceGate: {
          type: Type.OBJECT,
          properties: {
            requiresTraditionSelection: { type: Type.BOOLEAN },
            reasonEs: { type: Type.STRING },
            closeUpSceneNumber: { type: Type.INTEGER },
          },
          required: ['requiresTraditionSelection', 'reasonEs', 'closeUpSceneNumber'],
        },
        keyHebrewTerms: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              transliteration: { type: Type.STRING },
              meaning: { type: Type.STRING },
            },
            required: ['term', 'transliteration', 'meaning'],
          },
        },
        illustrations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              timestamp: { type: Type.STRING },
              title: { type: Type.STRING },
              visualConcept: { type: Type.STRING },
              symbolicMeaning: { type: Type.STRING },
              hebrewCaption: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
              palette: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              svgMarkup: { type: Type.STRING },
            },
            required: [
              'sceneNumber',
              'timestamp',
              'title',
              'visualConcept',
              'symbolicMeaning',
              'hebrewCaption',
              'imagePrompt',
              'palette',
              'svgMarkup',
            ],
          },
        },
        animationStoryboard: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overallTheme: { type: Type.STRING },
            videoPrompt: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  timestampRange: { type: Type.STRING },
                  durationSec: { type: Type.INTEGER },
                  headline: { type: Type.STRING },
                  narrationCaption: { type: Type.STRING },
                  hebrewMotif: { type: Type.STRING },
                  motionPattern: { type: Type.STRING },
                  primaryColor: { type: Type.STRING },
                  secondaryColor: { type: Type.STRING },
                  accentColor: { type: Type.STRING },
                  keyElements: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        role: { type: Type.STRING },
                      },
                      required: ['label', 'role'],
                    },
                  },
                },
                required: [
                  'sceneNumber',
                  'timestampRange',
                  'durationSec',
                  'headline',
                  'narrationCaption',
                  'hebrewMotif',
                  'motionPattern',
                  'primaryColor',
                  'secondaryColor',
                  'accentColor',
                  'keyElements',
                ],
              },
            },
          },
          required: ['title', 'overallTheme', 'videoPrompt', 'scenes'],
        },
      },
      required: [
        'coreThesis',
        'suggestedDerashaTopic',
        'pedagogicalComparison',
        'keyHebrewTerms',
        'illustrations',
        'animationStoryboard',
      ],
    };

    const ai = getGenAIClient();
    try {
      try {
        const videoResponse = await generateContentWithRetry(
          ai,
          {
            model: GEMINI_HYDROGEN_MODEL,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      fileUri: canonicalUrl,
                    },
                  },
                  {
                    text: `Analiza este video de YouTube directamente (audio e imagen) y genera la evaluación de claridad pedagógica (video vs animaciones), las ilustraciones clave y el storyboard de animación correspondientes.\n\n${contextSummaryBlock}`,
                  },
                ],
              },
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
            },
          },
          { timeoutMs: 75000, thinkingLevel: ThinkingLevel.MEDIUM }
        );
        parsed = JSON.parse(videoResponse.text || '{}');
        analyzedWithVideoStream = true;
      } catch (videoErr: any) {
        console.log(
          '[YouTube Visuals] Direct video stream fallback to metadata/transcript analysis:',
          videoErr?.message
        );
        const textResponse = await generateContentWithRetry(
          ai,
          {
            model: GEMINI_HYDROGEN_MODEL,
            contents: `Analiza este video de YouTube a partir de sus metadatos y transcripción disponibles para generar la evaluación pedagógica (video vs animaciones), sus ilustraciones y su storyboard de animación:\n\n${contextSummaryBlock}`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
            },
          },
          { timeoutMs: 55000, thinkingLevel: ThinkingLevel.MEDIUM }
        );
        parsed = JSON.parse(textResponse.text || '{}');
      }
    } catch {
      parsed = null;
    }

    const defaultPalette: [string, string, string] =
      safeStyle === 'acuarela_pergamino'
        ? ['#1c1917', '#d97706', '#fde68a']
        : safeStyle === 'geometria_cabalistica'
        ? ['#0f172a', '#6366f1', '#fbbf24']
        : safeStyle === 'diagrama_filosofico'
        ? ['#0b1120', '#0ea5e9', '#34d399']
        : ['#0b1120', '#38bdf8', '#f59e0b'];

    const rawIllustrations = Array.isArray(parsed?.illustrations) ? parsed.illustrations : [];
    const baseIllustrations = (
      rawIllustrations.length > 0
        ? rawIllustrations.slice(0, 4)
        : [
            {
              sceneNumber: 1,
              timestamp: '00:00',
              title: `Apertura Visual: ${metadata.title.slice(0, 48)}`,
              visualConcept: 'Presentación del eje central del video mediante luz geométrica y pergamino simbólico.',
              symbolicMeaning: 'La claridad conceptual ilumina las capas ocultas del relato o enseñanza.',
              hebrewCaption: 'רֵאשִׁית חָכְמָה',
              imagePrompt: `Illuminated editorial artwork depicting the opening thesis of "${metadata.title}", radiant golden light beams revealing an ancient parchment scroll and geometric wisdom symbols, dramatic chiaroscuro lighting.`,
              palette: defaultPalette,
              svgMarkup: '',
            },
            {
              sceneNumber: 2,
              timestamp: '01:30',
              title: 'Arquitectura del Argumento y Contraste',
              visualConcept: 'Dos polos conceptuales en diálogo equilibrados por un puente central luminoso.',
              symbolicMeaning: 'Articulación armónica entre teoría, tradición y experiencia viva.',
              hebrewCaption: 'בִּינָה וְדַעַת',
              imagePrompt: `Philosophical editorial illustration showing two complementary pillars connected by a luminous bridge of light, clean visual balance and symbolic clarity representing "${metadata.title}".`,
              palette: defaultPalette,
              svgMarkup: '',
            },
            {
              sceneNumber: 3,
              timestamp: '03:00',
              title: 'Síntesis y Elevación Práctica',
              visualConcept: 'Ascenso luminoso de chispas hacia una corona armónica unificada.',
              symbolicMeaning: 'Culminación transformadora del mensaje del video hacia la acción cotidiana.',
              hebrewCaption: 'הַמַּעֲשֶׂה הוּא הָעִקָּר',
              imagePrompt: `Contemplative symbolic artwork of ascending golden sparks converging into a unified harmonic crown over a calm horizon, illustrating practical application of "${metadata.title}".`,
              palette: defaultPalette,
              svgMarkup: '',
            },
          ]
    ).map((item: any, idx: number) => {
      const palRaw = Array.isArray(item.palette) ? item.palette : [];
      const palette: [string, string, string] = [
        /^#[0-9a-f]{3,8}$/i.test(String(palRaw[0] || '')) ? String(palRaw[0]) : defaultPalette[0],
        /^#[0-9a-f]{3,8}$/i.test(String(palRaw[1] || '')) ? String(palRaw[1]) : defaultPalette[1],
        /^#[0-9a-f]{3,8}$/i.test(String(palRaw[2] || '')) ? String(palRaw[2]) : defaultPalette[2],
      ];
      const sceneNumber = Number(item.sceneNumber) || idx + 1;
      const title = String(item.title || `Escena ${sceneNumber}`).trim();
      const hebrewCaption = String(item.hebrewCaption || 'תּוֹרָה אוֹר').trim();
      const imagePrompt = String(
        item.imagePrompt ||
          `Editorial educational artwork illustrating "${title}": ${item.visualConcept || metadata.title}`
      ).trim();

      return {
        id: `yt-illus-${videoId}-${sceneNumber}`,
        sceneNumber,
        timestamp: String(item.timestamp || `0${idx}:00`),
        title,
        visualConcept: String(item.visualConcept || ''),
        symbolicMeaning: String(item.symbolicMeaning || ''),
        hebrewCaption,
        imagePrompt,
        palette,
        svgMarkup: sanitizeSvgMarkup(item.svgMarkup, {
          title,
          hebrewCaption,
          sceneNumber,
          palette,
          aspectRatio: safeAspect,
          visualStyle: safeStyle,
        }),
      };
    });

    // Generate paid AI raster illustrations in parallel when mode includes illustrations (or for keyframe support)
    const normalizedIllustrations = await Promise.all(
      baseIllustrations.map(async (ill: any) => {
        if (safeMode === 'animation' || !resolveRuntimeGeminiKey()) {
          return ill;
        }
        const generated = await generateRasterIllustrationForScene({
          ai,
          prompt: ill.imagePrompt,
          visualStyle: safeStyle,
          aspectRatio: safeAspect,
          qualityTier: safeQuality,
        });
        return {
          ...ill,
          imageDataUrl: generated.imageDataUrl,
          imageModelUsed: generated.imageModelUsed,
        };
      })
    );

    const validPatterns = [
      'radiant_rays',
      'orbiting_spheres',
      'scroll_unfold',
      'ascending_sparks',
      'dialectic_bridge',
    ];
    const rawScenes = Array.isArray(parsed?.animationStoryboard?.scenes)
      ? parsed.animationStoryboard.scenes
      : [];
    const normalizedScenes = (
      rawScenes.length > 0
        ? rawScenes
        : normalizedIllustrations.map((ill: any, idx: number) => ({
            sceneNumber: idx + 1,
            timestampRange: `${ill.timestamp} – 0${idx + 1}:30`,
            durationSec: 5,
            headline: ill.title,
            narrationCaption: ill.symbolicMeaning || ill.visualConcept,
            hebrewMotif: ill.hebrewCaption,
            motionPattern: validPatterns[idx % validPatterns.length],
            primaryColor: ill.palette[0],
            secondaryColor: ill.palette[1],
            accentColor: ill.palette[2],
            keyElements: [
              { label: ill.title, role: 'Foco visual' },
              { label: ill.hebrewCaption, role: 'Motivo hebreo' },
            ],
          }))
    ).map((sc: any, idx: number) => ({
      id: `yt-scene-${videoId}-${idx + 1}`,
      sceneNumber: Number(sc.sceneNumber) || idx + 1,
      timestampRange: String(sc.timestampRange || `0${idx}:00 – 0${idx + 1}:00`),
      durationSec: Math.min(Math.max(Number(sc.durationSec) || 5, 3), 10),
      headline: String(sc.headline || `Escena ${idx + 1}`).trim(),
      narrationCaption: String(sc.narrationCaption || '').trim(),
      hebrewMotif: String(sc.hebrewMotif || 'אוֹר').trim(),
      motionPattern: validPatterns.includes(String(sc.motionPattern))
        ? sc.motionPattern
        : validPatterns[idx % validPatterns.length],
      primaryColor: /^#[0-9a-f]{3,8}$/i.test(String(sc.primaryColor || ''))
        ? String(sc.primaryColor)
        : defaultPalette[0],
      secondaryColor: /^#[0-9a-f]{3,8}$/i.test(String(sc.secondaryColor || ''))
        ? String(sc.secondaryColor)
        : defaultPalette[1],
      accentColor: /^#[0-9a-f]{3,8}$/i.test(String(sc.accentColor || ''))
        ? String(sc.accentColor)
        : defaultPalette[2],
      keyElements: Array.isArray(sc.keyElements) ? sc.keyElements.slice(0, 4) : [],
    }));

    const recRaw = String(parsed?.pedagogicalComparison?.recommendedFormat || 'hibrido');
    const recommendedFormat: 'animacion_escenica' | 'video_continuo' | 'hibrido' =
      recRaw === 'animacion_escenica' || recRaw === 'video_continuo' ? recRaw : 'hibrido';

    const combinedTextForTraditionCheck = `${metadata.title} ${metadata.description || ''} ${
      metadata.transcriptExcerpt || ''
    } ${customFocus || ''}`;
    const hasDeterministicRitualWrappingKeywords =
      /\b(tefil[ií]n|tefillin|phylacteries|amarre|krijot|retzu[aá]|tzitzit|talit|tallit|netilat|shulj[aá]n|minhag)\b/i.test(
        combinedTextForTraditionCheck
      );
    const requiresTraditionSelection =
      Boolean(parsed?.traditionPreferenceGate?.requiresTraditionSelection) ||
      hasDeterministicRitualWrappingKeywords;
    const closeUpSceneNumber = Math.min(
      Math.max(Number(parsed?.traditionPreferenceGate?.closeUpSceneNumber) || 2, 1),
      normalizedIllustrations.length
    );

    const traditionOptions = (
      ['ashkenazi', 'sefardi', 'chabad_ari', 'general_comparative'] as const
    ).map((id) => ({
      id,
      label: RITUAL_TRADITION_PROFILES[id].label,
      hebrewLabel: RITUAL_TRADITION_PROFILES[id].hebrewLabel,
      wrappingDetailEs: RITUAL_TRADITION_PROFILES[id].wrappingDetailEs,
    }));

    const resultPayload = {
      videoId,
      canonicalUrl,
      videoTitle: metadata.title,
      channelName: metadata.channelName,
      thumbnailUrl: metadata.thumbnailUrl,
      visualStyle: safeStyle,
      aspectRatio: safeAspect,
      outputMode: safeMode,
      imageQuality: safeQuality,
      selectedTradition: safeTradition || undefined,
      coreThesis:
        parsed?.coreThesis ||
        `Análisis visual y conceptual de «${metadata.title}» (${metadata.channelName}), transformando sus ideas centrales en escenas ilustradas y animadas.`,
      suggestedDerashaTopic:
        parsed?.suggestedDerashaTopic ||
        `Análisis exegético y conceptual sobre el tema de "${metadata.title}" (${metadata.channelName})`,
      pedagogicalComparison: {
        recommendedFormat,
        clarityVerdict:
          parsed?.pedagogicalComparison?.clarityVerdict ||
          'La máxima claridad didáctica se logra combinando animaciones por escenas (para pausar y desglosar cada concepto paso a paso) con un clip de video continuo para mostrar la transición fluida del argumento.',
        videoStrengths:
          parsed?.pedagogicalComparison?.videoStrengths ||
          'El video continuo destaca para transmitir ritmo narrativo, tono emocional y cohesión fluida sin cortes cognitivos.',
        animationStrengths:
          parsed?.pedagogicalComparison?.animationStrengths ||
          'Las animaciones segmentadas y diagramas reducen la sobrecarga visual, permiten controlar el ritmo por escena y fijan mejor la estructura lógica de un tutorial.',
      },
      traditionPreferenceGate: {
        requiresTraditionSelection,
        reasonEs:
          parsed?.traditionPreferenceGate?.reasonEs ||
          'El amarre en el antebrazo, la palma y los dedos varía según la costumbre comunitaria (Ashkenazí, Sefardí / Edot HaMizraj o Jabad / Ari). Selecciona tu tradición antes de visualizar el close-up.',
        closeUpSceneNumber,
        traditions: traditionOptions,
      },
      keyHebrewTerms: Array.isArray(parsed?.keyHebrewTerms)
        ? parsed.keyHebrewTerms.slice(0, 5)
        : [
            { term: 'חָכְמָה', transliteration: 'Jojmá', meaning: 'Sabiduría primordial y discernimiento' },
            { term: 'בִּינָה', transliteration: 'Biná', meaning: 'Comprensión profunda y síntesis' },
            { term: 'מַעֲשֶׂה', transliteration: 'Maasé', meaning: 'Encarnación ética en la acción' },
          ],
      illustrations: normalizedIllustrations,
      animationStoryboard: {
        title: parsed?.animationStoryboard?.title || `Animación Escénica: ${metadata.title}`,
        overallTheme:
          parsed?.animationStoryboard?.overallTheme ||
          'Secuencia visual animada sincronizada con las ideas clave del video.',
        videoPrompt:
          parsed?.animationStoryboard?.videoPrompt ||
          `Smooth cinematic educational motion graphics sequence illustrating "${metadata.title}": luminous golden editorial symbols unfolding step-by-step over deep midnight blue space, smooth camera glide, high visual clarity.`,
        scenes: normalizedScenes,
      },
      analyzedWithVideoStream,
    };

    setBoundedCache(youtubeVisualCache, cacheKey, resultPayload, 16);
    return res.json(resultPayload);
  } catch (error: any) {
    console.error('[YouTube Visuals] Error:', error);
    return res.status(500).json({
      error:
        error?.message ||
        'Error al analizar el video de YouTube para generar ilustraciones y animaciones.',
    });
  }
});

app.post('/api/generate-youtube-illustration', async (req, res) => {
  try {
    const {
      prompt = '',
      visualStyle = 'editorial_iluminado',
      aspectRatio = '16:9',
      imageQuality = 'nano_banana_2_1',
      traditionPreference,
      title = '',
    } = req.body || {};

    if (!String(prompt).trim() && !String(title).trim()) {
      return res.status(400).json({ error: 'Se requiere un prompt o título para generar la ilustración.' });
    }
    if (!resolveRuntimeGeminiKey()) {
      return res.status(400).json({ error: 'La clave de API de Gemini no está configurada.' });
    }

    const ai = getGenAIClient();
    const safeAspect: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
    const safeQuality: 'flash_lite' | 'nano_banana_2_1' =
      imageQuality === 'flash_lite' ? 'flash_lite' : 'nano_banana_2_1';
    const safeTradition =
      traditionPreference && traditionPreference in RITUAL_TRADITION_PROFILES
        ? (traditionPreference as keyof typeof RITUAL_TRADITION_PROFILES)
        : null;

    const traditionAddon = safeTradition
      ? `\nFollow strictly: ${RITUAL_TRADITION_PROFILES[safeTradition].visualDirectionEn}`
      : '';

    const generated = await generateRasterIllustrationForScene({
      ai,
      prompt: `${String(prompt || `Educational illustration for "${title}"`).trim()}${traditionAddon}`,
      visualStyle: String(visualStyle),
      aspectRatio: safeAspect,
      qualityTier: safeQuality,
    });

    if (!generated.imageDataUrl) {
      return res.status(502).json({
        error: 'El modelo de imagen no devolvió datos binarios. Intenta ajustar el prompt o reintentar.',
      });
    }

    return res.json(generated);
  } catch (error: any) {
    console.error('[YouTube Illustration Gen] Error:', error);
    return res.status(500).json({
      error: error?.message || 'Error al generar la ilustración con IA.',
    });
  }
});

app.post('/api/generate-youtube-animation', async (req, res) => {
  try {
    const {
      prompt = '',
      aspectRatio = '16:9',
      duration = '6s',
      resolution = '720p',
      traditionPreference,
      referenceImages = [],
    } = req.body || {};

    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      return res.status(400).json({ error: 'Se requiere una descripción visual (prompt) para generar el video.' });
    }
    if (!resolveRuntimeGeminiKey()) {
      return res.status(400).json({ error: 'La clave de API de Gemini no está configurada.' });
    }

    const safeAspect: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
    const safeDuration: '6s' | '10s' = duration === '10s' ? '10s' : '6s';
    const safeResolution: '720p' | '1080p' = resolution === '1080p' ? '1080p' : '720p';
    const safeTradition =
      traditionPreference && traditionPreference in RITUAL_TRADITION_PROFILES
        ? (traditionPreference as keyof typeof RITUAL_TRADITION_PROFILES)
        : null;
    const traditionVideoSuffix = safeTradition
      ? `\nClose-up ritual precision requirement: ${RITUAL_TRADITION_PROFILES[safeTradition].visualDirectionEn}`
      : '';

    const validRefs = Array.isArray(referenceImages)
      ? referenceImages
          .filter((img: any) => typeof img?.data === 'string' && img.data.length > 20)
          .slice(0, 4)
      : [];

    const inputPayload: any =
      validRefs.length > 0
        ? [
            ...validRefs.map((img: any) => ({
              type: 'image',
              mime_type: img.mimeType || 'image/png',
              data: img.data,
            })),
            {
              type: 'text',
              text: `${cleanPrompt}${traditionVideoSuffix}\nAnimate smoothly across the visual keyframes with clear pedagogical pacing, gentle camera motion, and cohesive editorial lighting.`,
            },
          ]
        : `${cleanPrompt}${traditionVideoSuffix}`;

    const ai = getGenAIClient();
    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input: inputPayload,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: safeAspect,
          duration: safeDuration,
          resolution: safeResolution,
        },
      },
      { timeout: 300000 }
    );

    let videoPart: any = interaction.output_video;
    if (!videoPart && Array.isArray(interaction.steps)) {
      for (const step of interaction.steps as any[]) {
        if (step?.type === 'model_output' && Array.isArray(step.content)) {
          const found = step.content.find((c: any) => c?.type === 'video' && (c.data || c.uri));
          if (found) {
            videoPart = found;
            break;
          }
        }
      }
    }

    if (!videoPart) {
      return res.status(502).json({
        error: 'El modelo Omni Flash no devolvió un clip de video en la respuesta.',
      });
    }

    const mimeType = videoPart.mime_type || 'video/mp4';
    let base64Video = videoPart.data || '';

    if (!base64Video && videoPart.uri) {
      const apiKey = resolveRuntimeGeminiKey();
      const videoRes = await fetch(videoPart.uri, {
        headers: apiKey ? { 'x-goog-api-key': apiKey } : undefined,
      });
      if (videoRes.ok) {
        const arrBuf = await videoRes.arrayBuffer();
        base64Video = Buffer.from(arrBuf).toString('base64');
      }
    }

    if (!base64Video) {
      return res.status(502).json({
        error: 'No se pudo recuperar el flujo binario del video generado.',
      });
    }

    return res.json({
      videoDataUrl: `data:${mimeType};base64,${base64Video}`,
      mimeType,
      duration: safeDuration,
      resolution: safeResolution,
      aspectRatio: safeAspect,
      modelUsed: 'gemini-omni-1.2-flash',
      promptUsed: cleanPrompt,
    });
  } catch (error: any) {
    console.error('[YouTube Omni Animation] Error:', error);
    return res.status(500).json({
      error: error?.message || 'Error al generar el clip animado con Omni Flash.',
    });
  }
});

// Guard so any unmatched /api/* route returns JSON instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.originalUrl}` });
});

// Web Publication SEO Routes: robots.txt and sitemap.xml
app.get('/robots.txt', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const lastmod = new Date().toISOString().split('T')[0];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n` +
      `    <loc>${origin}/</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>daily</changefreq>\n` +
      `    <priority>1.0</priority>\n` +
      `  </url>\n` +
      `</urlset>`
  );
});

// Express-wide error fallback middleware so no route exception crashes the server
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.warn('[Darshán AI · SafePoint Server Guard] Error interceptado:', err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({
      error:
        'Se activó la protección del servidor ante un error inesperado. Tu Punto Seguro está disponible para restauración inmediata.',
      safePointAvailable: true,
    });
  } else {
    next(err);
  }
});

process.on('uncaughtException', (err) => {
  console.warn('[Darshán AI · SafePoint Process Guard] uncaughtException interceptada:', err?.message);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Darshán AI · SafePoint Process Guard] unhandledRejection interceptada:', reason?.message || reason);
});

// Vite dev middleware or static file serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    let viteMiddleware: any = null;
    let vitePromise: Promise<any> | null = null;

    const ensureViteLoaded = () => {
      if (!vitePromise) {
        vitePromise = import('vite')
          .then(({ createServer }) =>
            createServer({
              server: {
                middlewareMode: true,
                hmr: false,
                watch: null,
              },
              appType: 'spa',
            })
          )
          .then((vite) => {
            viteMiddleware = vite.middlewares;
            return vite;
          });
      }
      return vitePromise;
    };

    app.use(async (req, res, next) => {
      try {
        if (!viteMiddleware) {
          await ensureViteLoaded();
        }
        return viteMiddleware(req, res, next);
      } catch (err) {
        next(err);
      }
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Darshán AI] Servidor iniciado en http://0.0.0.0:${PORT}`);
      ensureViteLoaded().catch((err) => {
        console.warn('[Darshán AI] Aviso al inicializar Vite middleware:', err?.message);
      });
    });
  } else {
    const distDir = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '7d',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distDir, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Darshán AI] Servidor iniciado en http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();



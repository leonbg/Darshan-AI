import { DerashaDuration, TorahCalendarData } from '../../types';

/**
 * Returns the maximum number of canonical Sefaria references to fetch for a given lesson duration.
 */
export function getMaxRefsForDuration(duracion: DerashaDuration): number {
  return duracion === '5_MIN' ? 3 : duracion === '30_MIN' ? 6 : 4;
}

/**
 * Enriches queries asking generally for "la parashá de la semana" or "próxima fiesta"
 * using live Torah calendar data.
 */
export function enrichQueryWithCalendar(
  rawQuery: string,
  calendarData: TorahCalendarData | null
): string {
  if (!calendarData) return rawQuery;
  const lower = rawQuery.toLowerCase();
  const mentionsWeeklyParasha =
    lower.includes('parasha de la semana') ||
    lower.includes('parashá de la semana') ||
    lower.includes('parasá de la semana') ||
    lower.includes('parasha de esta semana') ||
    lower.includes('parashá de esta semana') ||
    lower.includes('lectura de esta semana') ||
    lower.includes('lectura de la semana') ||
    lower.includes('parashat hashavua') ||
    lower === 'parasha' ||
    lower === 'parashá';

  const mentionsUpcomingFestival =
    lower.includes('proxima fiesta') ||
    lower.includes('próxima fiesta') ||
    lower.includes('proximas fiestas') ||
    lower.includes('próximas fiestas') ||
    lower.includes('proximo evento') ||
    lower.includes('próximo evento') ||
    lower.includes('fiesta cercana');

  const p = calendarData.parasha;
  const nextEv = calendarData.upcomingEvents?.[0];

  if (mentionsWeeklyParasha && p && !lower.includes(p.nameEn.toLowerCase())) {
    const evSuffix = nextEv
      ? ` | Próximo evento litúrgico: ${nextEv.titleEs} (${nextEv.titleHe})`
      : '';
    return `${rawQuery} [Calendario Hebreo (${calendarData.hebrewDateStr}): Parashat ${p.nameEs} / ${p.nameHe} (${p.fullRef})${evSuffix}]`;
  }

  if (mentionsUpcomingFestival && nextEv) {
    return `${rawQuery} [Calendario Hebreo (${calendarData.hebrewDateStr}): Próximo evento litúrgico: ${nextEv.titleEs} (${nextEv.titleHe}, en ${nextEv.daysUntil} días)${
      p ? ` en el marco de Parashat ${p.nameEs} (${p.fullRef})` : ''
    }]`;
  }

  return rawQuery;
}

/**
 * Rule 1: Detects overly brief or ambiguous queries before starting a long pipeline wait.
 */
export function isQueryTooBroadOrAmbiguous(rawQuery: string): boolean {
  const meaningfulChars = rawQuery
    .trim()
    .replace(/[^a-zA-Z0-9\u0590-\u05FFáéíóúüñÁÉÍÓÚÜÑ]/g, '');
  return meaningfulChars.length < 2;
}

/**
 * Checks whether a query contains an explicit canonical book/tractate + chapter/verse/folio citation.
 */
export function hasCanonicalCitationReference(rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return false;
  if (/\[Calendario Hebreo/i.test(q)) return true;
  return /\b(?:g[eé]nesis|bereshit|[eé]xodo|shemot|lev[ií]tico|vayikr[aá]|n[uú]meros|bamidbar|deuteronomio|devarim|salmos?|tehil[ií]m|proverbios|mishl[eé]|isa[ií]as|jerem[ií]as|ezequiel|daniel|ester|rut|eclesiast[eé]s|koh[eé]let|cantar|avot|berajot|berakhot|shabat|shabbat|pesajim|pesachim|yom[aá]|suk[aá]|taanit|meguil[aá]|megillah|jagig[aá]|kidush[ií]n|kiddushin|bava|sanhedr[ií]n|makot|avod[aá]|menajot|jul[ií]n|arjin|arakhin|sot[aá]h?|oraj\s+jaim|orach\s+chayim|yor[eé]\s+de[aá]|mesil+at\s+yesharim)\s+\d+/i.test(
    q
  );
}

/**
 * Determines whether a typed query is focused enough to prewarm Phase 1 & 2 in the background
 * without wasting quota on 1–2 word broad terms that will ask for clarification first.
 */
export function shouldAutoPrewarmQuery(rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (isQueryTooBroadOrAmbiguous(trimmed)) return false;
  if (hasCanonicalCitationReference(trimmed)) return true;
  const words = trimmed
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9\u0590-\u05FFáéíóúüñÁÉÍÓÚÜÑ]/g, ''))
    .filter((w) => w.length >= 2);
  return words.length >= 3;
}

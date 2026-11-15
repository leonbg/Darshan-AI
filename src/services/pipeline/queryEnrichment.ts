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
  const trimmed = rawQuery.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const hasSpecificRef = /\d+:\d+/.test(trimmed);
  const isHebrewPhrase = /[\u0590-\u05FF]/.test(trimmed) && words.length >= 2;
  if (hasSpecificRef || isHebrewPhrase) return false;
  return words.length < 3 || trimmed.length < 14;
}

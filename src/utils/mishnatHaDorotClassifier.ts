import type { HalakhicGenerationEra, MishnatHaDorotQuote } from '../types';

export interface GenerationEraMetadata {
  era: HalakhicGenerationEra;
  order: number;
  label: string;
  shortLabel: string;
  periodDefault: string;
  badgeClasses: string;
}

export const HALAKHIC_GENERATION_ORDER: HalakhicGenerationEra[] = [
  'CHAZAL',
  'RISHONIM',
  'EARLY_ACHARONIM',
  'CLASSIC_ACHARONIM',
  'CONTEMPORARY_POSKIM',
];

export const GENERATION_ERA_META: Record<HalakhicGenerationEra, GenerationEraMetadata> = {
  CHAZAL: {
    era: 'CHAZAL',
    order: 1,
    label: 'Jazal y Talmud (Torá Oral)',
    shortLabel: 'Jazal',
    periodDefault: 'siglos I–VI e.c.',
    badgeClasses: 'text-amber-200 bg-amber-500/15 border-amber-400/35',
  },
  RISHONIM: {
    era: 'RISHONIM',
    order: 2,
    label: 'Rishonim (Codificadores Medievales)',
    shortLabel: 'Rishonim',
    periodDefault: 'siglos XII–XIV e.c.',
    badgeClasses: 'text-sky-200 bg-sky-500/15 border-sky-400/35',
  },
  EARLY_ACHARONIM: {
    era: 'EARLY_ACHARONIM',
    order: 3,
    label: 'Nosei Keilim y Ajaronim Tempranos',
    shortLabel: 'Ajaronim Tempranos',
    periodDefault: 'siglos XVII–XVIII e.c.',
    badgeClasses: 'text-indigo-200 bg-indigo-500/15 border-indigo-400/35',
  },
  CLASSIC_ACHARONIM: {
    era: 'CLASSIC_ACHARONIM',
    order: 4,
    label: 'Ajaronim Clásicos (Síntesis Normativa)',
    shortLabel: 'Ajaronim Clásicos',
    periodDefault: 'siglos XIX–XX e.c.',
    badgeClasses: 'text-emerald-200 bg-emerald-500/15 border-emerald-400/35',
  },
  CONTEMPORARY_POSKIM: {
    era: 'CONTEMPORARY_POSKIM',
    order: 5,
    label: 'Poskim Contemporáneos y Responsa',
    shortLabel: 'Poskim Contemporáneos',
    periodDefault: 'siglos XX–XXI e.c.',
    badgeClasses: 'text-purple-200 bg-purple-500/15 border-purple-400/35',
  },
};

interface KnownHalakhicAuthorityRule {
  pattern: RegExp;
  era: HalakhicGenerationEra;
  authorityName: string;
  priority: number;
  fallbackPeriod: string;
}

const KNOWN_AUTHORITY_RULES: KnownHalakhicAuthorityRule[] = [
  // Classic Acharonim (XIX - early XX)
  {
    pattern: /Mishnah Berurah/i,
    era: 'CLASSIC_ACHARONIM',
    authorityName: 'Jafetz Jaim · Mishná Berurá',
    priority: 98,
    fallbackPeriod: '1884–1907 e.c.',
  },
  {
    pattern: /Biur Halacha/i,
    era: 'CLASSIC_ACHARONIM',
    authorityName: 'Jafetz Jaim · Biur Halajá',
    priority: 93,
    fallbackPeriod: '1884–1907 e.c.',
  },
  {
    pattern: /Arukh HaShulchan/i,
    era: 'CLASSIC_ACHARONIM',
    authorityName: 'Rav Yejiel Mijel Epstein · Aruj HaShulján',
    priority: 97,
    fallbackPeriod: '1884–1907 e.c.',
  },
  {
    pattern: /Kaf HaChayim/i,
    era: 'CLASSIC_ACHARONIM',
    authorityName: 'Rabí Yaakov Jaim Sofer · Kaf HaJaim',
    priority: 97,
    fallbackPeriod: '1904–1939 e.c.',
  },
  {
    pattern: /Ben Ish Hai/i,
    era: 'CLASSIC_ACHARONIM',
    authorityName: 'Rabí Yosef Jaim de Bagdad · Ben Ish Jai',
    priority: 96,
    fallbackPeriod: '1898 e.c.',
  },
  {
    pattern: /Kitzur Shulchan Arukh/i,
    era: 'CLASSIC_ACHARONIM',
    authorityName: 'Rabí Shlomó Ganzfried · Kitzur Shulján Aruj',
    priority: 89,
    fallbackPeriod: '1864 e.c.',
  },
  // Early Acharonim / Nosei Keilim (XVII - early XIX)
  {
    pattern: /Turei Zahav/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí David HaLevi · Turei Zahav (Taz)',
    priority: 95,
    fallbackPeriod: '1646 e.c.',
  },
  {
    pattern: /Siftei Kohen/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí Shabtai HaKohen · Shaj (Siftei Kohen)',
    priority: 95,
    fallbackPeriod: '1646 e.c.',
  },
  {
    pattern: /Magen Avraham/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí Avraham Gombiner · Maguén Avraham',
    priority: 94,
    fallbackPeriod: '1671 e.c.',
  },
  {
    pattern: /Beur HaGra/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Gaón de Vilna · Biur HaGra',
    priority: 93,
    fallbackPeriod: 's. XVIII e.c.',
  },
  {
    pattern: /Pitchei Teshuva/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí Avraham Zvi Eisenstadt · Pitjei Teshuvá',
    priority: 91,
    fallbackPeriod: '1836 e.c.',
  },
  {
    pattern: /Rabbi Akiva Eiger/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí Akiva Eiger · Hagahot',
    priority: 90,
    fallbackPeriod: 's. XVIII–XIX e.c.',
  },
  {
    pattern: /Peri Megadim/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí Yosef Teomim · Pri Megadim',
    priority: 88,
    fallbackPeriod: '1787 e.c.',
  },
  {
    pattern: /Ba'er Hetev/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Rabí Yehuda Ashkenazi · Baér Hetev',
    priority: 85,
    fallbackPeriod: '1730–1742 e.c.',
  },
  {
    pattern: /Eliyah Rabbah|Be'er HaGolah|Havot Yair|Chokhmat Shlomo|Binyan Tziyon/i,
    era: 'EARLY_ACHARONIM',
    authorityName: 'Nosei Keilim Clásicos',
    priority: 84,
    fallbackPeriod: 'siglos XVII–XIX e.c.',
  },
  // Rishonim (XII - XIV)
  {
    pattern: /Mishneh Torah/i,
    era: 'RISHONIM',
    authorityName: 'Rambam (Maimónides) · Mishné Torá',
    priority: 97,
    fallbackPeriod: '1170–1180 e.c.',
  },
  {
    pattern: /\bTur\b|Arba'ah Turim/i,
    era: 'RISHONIM',
    authorityName: 'Rabí Yaakov ben Asher · Arbaá Turim',
    priority: 92,
    fallbackPeriod: '1300–1340 e.c.',
  },
  {
    pattern: /Sefer Mitzvot Gadol/i,
    era: 'RISHONIM',
    authorityName: 'Rabí Moshé de Coucy · Semag',
    priority: 84,
    fallbackPeriod: 'c. 1240 e.c.',
  },
  {
    pattern: /Teshuvot Maharil/i,
    era: 'RISHONIM',
    authorityName: 'Maharil (Rabí Yaakov Moelin)',
    priority: 86,
    fallbackPeriod: 'c. 1420 e.c.',
  },
  // Contemporary Poskim (XX - XXI)
  {
    pattern: /Mishpetei Uziel/i,
    era: 'CONTEMPORARY_POSKIM',
    authorityName: 'Rav Ben-Tzion Meir Jai Uziel · Mishpetei Uziel',
    priority: 97,
    fallbackPeriod: '1935–1953 e.c.',
  },
  {
    pattern: /Peninei Halakhah/i,
    era: 'CONTEMPORARY_POSKIM',
    authorityName: 'Rav Eliezer Melamed · Peninei Halajá',
    priority: 96,
    fallbackPeriod: '1993–presente',
  },
  {
    pattern: /Responsa Benei Banim/i,
    era: 'CONTEMPORARY_POSKIM',
    authorityName: 'Rav Yehuda Herzl Henkin · Bnei Banim',
    priority: 92,
    fallbackPeriod: '1980–2004 e.c.',
  },
  {
    pattern: /B'Mareh HaBazak/i,
    era: 'CONTEMPORARY_POSKIM',
    authorityName: 'Responsa Contemporánea · BeMaré HaBazak',
    priority: 90,
    fallbackPeriod: '1992–presente',
  },
  {
    pattern: /Yalkut Yosef|Yabia Omer|Igrot Moshe|Tzitz Eliezer|Shevet HaLevi/i,
    era: 'CONTEMPORARY_POSKIM',
    authorityName: 'Poskim Contemporáneos',
    priority: 99,
    fallbackPeriod: 'siglos XX–XXI e.c.',
  },
];

export function stripHalakhicHtml(raw: unknown): string {
  if (!raw) return '';
  if (Array.isArray(raw)) {
    return raw.map(stripHalakhicHtml).filter(Boolean).join(' ');
  }
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatCompDateLabel(compDate: unknown, fallbackPeriod: string): string {
  if (!Array.isArray(compDate) || compDate.length === 0) return fallbackPeriod;
  const nums = compDate
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 2200);
  if (nums.length === 0) return fallbackPeriod;
  if (nums.length === 1 || nums[0] === nums[1]) {
    return `${nums[0]} e.c.`;
  }
  return `${Math.min(nums[0], nums[1])}–${Math.max(nums[0], nums[1])} e.c.`;
}

export interface ClassifiedSefariaLinkCandidate {
  ref: string;
  heRef: string;
  generationEra: HalakhicGenerationEra;
  generationLabel: string;
  periodLabel: string;
  authorityName: string;
  hebrewText: string;
  englishText: string;
  priority: number;
  sefariaUrl: string;
}

export function classifySefariaLinkCandidate(
  link: any
): ClassifiedSefariaLinkCandidate | null {
  if (!link || typeof link !== 'object') return null;

  const ref = String(link.ref || '').trim();
  const title = String(link.collectiveTitle?.en || link.index_title || ref).trim();
  const category = String(link.category || '').trim();

  if (!ref) return null;
  // Skip self-links to Shulchan Arukh itself so Mishnat HaDorot genuinely supplements it across generations
  if (/^Shulchan Arukh\b/i.test(title) || /^Shulchan Arukh\b/i.test(ref)) {
    return null;
  }

  const hebrewText = stripHalakhicHtml(link.he).slice(0, 950);
  const englishText = stripHalakhicHtml(link.text).slice(0, 950);
  if (!hebrewText && !englishText) return null;
  if (hebrewText.length < 18 && englishText.length < 25) return null;

  const compNums = Array.isArray(link.compDate)
    ? link.compDate.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];
  const primaryYear = compNums.length > 0 ? compNums[compNums.length - 1] : NaN;

  let era: HalakhicGenerationEra | null = null;
  let authorityName = title;
  let priority = 70;
  let fallbackPeriod = '';

  const matchedRule = KNOWN_AUTHORITY_RULES.find(
    (r) => r.pattern.test(title) || r.pattern.test(ref)
  );

  if (matchedRule) {
    era = matchedRule.era;
    authorityName =
      matchedRule.authorityName === 'Nosei Keilim Clásicos' ||
      matchedRule.authorityName === 'Poskim Contemporáneos'
        ? title
        : matchedRule.authorityName;
    priority = matchedRule.priority;
    fallbackPeriod = matchedRule.fallbackPeriod;
  } else if (/^(Talmud|Mishnah)$/i.test(category)) {
    era = 'CHAZAL';
    authorityName = `${category === 'Mishnah' ? 'Mishná' : 'Talmud'} · ${title}`;
    priority = 88;
    fallbackPeriod = 'siglos I–VI e.c.';
  } else if (/^(Halakhah|Responsa|Commentary)$/i.test(category)) {
    if (Number.isFinite(primaryYear)) {
      if (primaryYear <= 650) {
        era = 'CHAZAL';
        priority = 82;
      } else if (primaryYear <= 1520) {
        era = 'RISHONIM';
        priority = 80;
      } else if (primaryYear <= 1835) {
        era = 'EARLY_ACHARONIM';
        priority = 78;
      } else if (primaryYear <= 1945) {
        era = 'CLASSIC_ACHARONIM';
        priority = 81;
      } else {
        era = 'CONTEMPORARY_POSKIM';
        priority = 86;
      }
    } else if (/Responsa/i.test(category)) {
      era = 'CONTEMPORARY_POSKIM';
      priority = 84;
    } else {
      era = 'EARLY_ACHARONIM';
      priority = 72;
    }
  } else {
    // Skip non-halakhic/tangential links (e.g., generic Kabbalah or Tanakh unless already matched)
    return null;
  }

  const meta = GENERATION_ERA_META[era];
  const periodLabel = formatCompDateLabel(
    link.compDate,
    fallbackPeriod || meta.periodDefault
  );

  const heRef = String(link.heRef || link.sourceHeRef || ref).trim();
  return {
    ref,
    heRef,
    generationEra: era,
    generationLabel: meta.label,
    periodLabel,
    authorityName,
    hebrewText:
      hebrewText || '(Texto canónico en hebreo disponible en Sefaria)',
    englishText,
    priority,
    sefariaUrl: `https://www.sefaria.org/${encodeURIComponent(ref.replace(/ /g, '_'))}`,
  };
}

export function sortMishnatHaDorotChronologically(
  quotes: MishnatHaDorotQuote[]
): MishnatHaDorotQuote[] {
  return [...quotes].sort((a, b) => {
    const ordA = GENERATION_ERA_META[a.generationEra]?.order ?? 99;
    const ordB = GENERATION_ERA_META[b.generationEra]?.order ?? 99;
    if (ordA !== ordB) return ordA - ordB;
    return a.authorityName.localeCompare(b.authorityName, 'es');
  });
}

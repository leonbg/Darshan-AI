import {
  DerashaMethodology,
  DerashaDuration,
  FinalDerasha,
  MethodologySectionItem,
} from '../types';

export type ExportScope = 'full_derasha' | 'pardes_cards';
export type EditableFormat = 'doc' | 'rtf' | 'md' | 'html';

export interface MethodologyDisplayMeta {
  id: Exclude<DerashaMethodology, 'AUTO'>;
  shortLabel: string;
  label: string;
  hebrewLabel: string;
}

export const METHODOLOGY_DISPLAY_LIST: MethodologyDisplayMeta[] = [
  {
    id: 'PARDES',
    shortLabel: 'PARDÉS (4 Niveles)',
    label: 'PARDÉS · Exégesis Clásica en 4 Niveles',
    hebrewLabel: 'פַּרְדֵּ״ס',
  },
  {
    id: 'WISSENSCHAFT_DES_JUDENTUMS',
    shortLabel: 'Histórico-Crítica (Wissenschaft)',
    label: 'Wissenschaft des Judentums · Filología e Historia Textual',
    hebrewLabel: 'חָכְמַת יִשְׂרָאֵל',
  },
  {
    id: 'EVOLUCION_CONCEPTUAL',
    shortLabel: 'Genealogía Multi-Estrato',
    label: 'Evolución Conceptual (Torá · Cábala · Musar · Jasidut)',
    hebrewLabel: 'הִשְׁתַּלְשְׁלוּת הָרַעְיוֹן',
  },
  {
    id: 'MESILAT_YESHARIM_SISTEMATICO',
    shortLabel: 'Mesilat Yesharim (Ramjal)',
    label: 'Mesilat Yesharim Sistemático · Escalera Ética del Ramjal',
    hebrewLabel: 'מְסִלַּת יְשָׁרִים',
  },
  {
    id: 'PIRKE_AVOT_EXEGETICO',
    shortLabel: 'Pirké Avot Exegético',
    label: 'Exégesis de Máximas Tanaíticas · Pirké Avot',
    hebrewLabel: 'פִּרְקֵי אָבוֹת',
  },
  {
    id: 'MUSAR_TRANSFORMATIVO',
    shortLabel: 'Musar Transformativo',
    label: 'Musar Clásico y Psicología Moral · Jeshbón HaNéfesh',
    hebrewLabel: 'מוּסָר וְחֶשְׁבּוֹן הַנֶּפֶשׁ',
  },
  {
    id: 'FILOSOFIA_CONTRASTIVA',
    shortLabel: 'Filosofía Contrastiva',
    label: 'Majshévet Yisrael · Diálogo Filosófico Contrastivo',
    hebrewLabel: 'מַחְשֶׁבֶת יִשְׂרָאֵל',
  },
];

export function getMethodologyMeta(
  id?: DerashaMethodology
): MethodologyDisplayMeta {
  const normalized =
    !id || id === 'AUTO'
      ? 'PARDES'
      : id === 'FILOLOGIA_LITURGICA_WISSENSCHAFT'
      ? 'WISSENSCHAFT_DES_JUDENTUMS'
      : id;
  return (
    METHODOLOGY_DISPLAY_LIST.find((m) => m.id === normalized) ||
    METHODOLOGY_DISPLAY_LIST[0]
  );
}

export interface NormalizedExportSection {
  id: string;
  orderLabel: string;
  title: string;
  hebrewTerm: string;
  spanishSubtitle: string;
  content: string;
  keyInsight: string;
  isComplementary?: boolean;
  methodologyLabel?: string;
}

export function getDurationBadgeLabel(duracion?: DerashaDuration | string): string {
  if (duracion === '5_MIN') return 'Drashá Breve · 5 min';
  if (duracion === '30_MIN') return 'Shiur Magistral · 30 min';
  return 'Drashá Estándar · 10 min';
}

/**
 * Extracts the ordered sections of the lesson so that exports include the
 * active methodology sections AND any complementary methodologies.
 */
export function resolveLessonSectionsForExport(
  derasha: FinalDerasha | null,
  scope: ExportScope = 'full_derasha'
): NormalizedExportSection[] {
  if (!derasha) return [];

  const primaryMethod = derasha.metodologia || 'PARDES';

  if (
    scope === 'full_derasha' &&
    derasha.methodologySections &&
    derasha.methodologySections.length > 0
  ) {
    return derasha.methodologySections.map(
      (sec: MethodologySectionItem, idx: number) => {
        const isComp = Boolean(
          sec.sourceMethodology && sec.sourceMethodology !== primaryMethod
        );
        const compMeta = isComp ? getMethodologyMeta(sec.sourceMethodology) : null;
        return {
          id: sec.key || `sec-${idx + 1}`,
          orderLabel: sec.hebrewBadge || `${sec.stepNumber || idx + 1}`,
          title: sec.title || `Sección ${idx + 1}`,
          hebrewTerm: sec.hebrewTerm || sec.hebrewBadge || '',
          spanishSubtitle:
            sec.spanishSubtitle ||
            (compMeta
              ? `Aporte Complementario · ${compMeta.shortLabel}`
              : 'Desarrollo Exegético'),
          content: sec.exposition || '',
          keyInsight: sec.keyTakeaway || '',
          isComplementary: isComp,
          methodologyLabel: compMeta?.label,
        };
      }
    );
  }

  const p = derasha.pardes;
  if (!p) return [];

  return [
    {
      id: 'pshat',
      orderLabel: 'I · Pshat',
      title: p.pshat.title || 'Pshat — El Sentido Literal e Histórico',
      hebrewTerm: p.pshat.hebrewPillar || 'פְּשָׁט',
      spanishSubtitle: 'Nivel I · Literal y Contextual',
      content: p.pshat.exposition || '',
      keyInsight: p.pshat.keyTakeaway || '',
    },
    {
      id: 'remez',
      orderLabel: 'II · Rémez',
      title: p.remez.title || 'Rémez — La Alusión Filológica y Simbólica',
      hebrewTerm: p.remez.hebrewPillar || 'רֶמֶז',
      spanishSubtitle: 'Nivel II · Alusión y Estructura',
      content: p.remez.exposition || '',
      keyInsight: p.remez.keyTakeaway || '',
    },
    {
      id: 'drash',
      orderLabel: 'III · Drash',
      title: p.drash.title || 'Drash — Homilética, Midrash y Ética',
      hebrewTerm: p.drash.hebrewPillar || 'דְּרַשׁ',
      spanishSubtitle: 'Nivel III · Exégesis Homilética',
      content: p.drash.exposition || '',
      keyInsight: p.drash.keyTakeaway || '',
    },
    {
      id: 'sod',
      orderLabel: 'IV · Sod',
      title: p.sod.title || 'Sod — La Dimensión Interior y Mística',
      hebrewTerm: p.sod.hebrewPillar || 'סוֹד',
      spanishSubtitle: 'Nivel IV · Misterio Interior',
      content: p.sod.exposition || '',
      keyInsight: p.sod.keyTakeaway || '',
    },
  ];
}

import {
  ActiveStudySnapshot,
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  SystemSafePointSnapshot,
} from '../types';
import {
  INITIAL_SEEDED_DERASHOT,
  loadLocalArchive,
  loadLocalComparativeStudies,
  mergeArchiveEntriesSafely,
  saveLocalArchive,
  saveLocalComparativeStudies,
} from './archiveService';
import { resolveApiUrl } from './api';

export const SAFEPOINTS_STORAGE_KEY = 'darshan_system_safepoints_v1';
export const LAST_STUDY_STORAGE_KEY = 'darshan_last_study_v2';
export const GOLDEN_BASELINE_ID = 'safepoint-golden-baseline-v1';
export const GOLDEN_HALAKHIC_V2_BASELINE_ID = 'safepoint-golden-baseline-v2';
export const AUTO_SAFEPOINT_ID = 'safepoint-auto-latest-v1';

/**
 * Deterministic lightweight FNV-1a hex checksum for snapshot integrity verification.
 */
export function computeSnapshotChecksum(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SP-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Builds the Halakhic v2.0 Master Fallback Active Study from Derashá #10
 * (Halel, Shulján Aruj, Minhag y Núsaj with Halakhic Validator active and zero external philosophy).
 */
export function buildHalakhicV2BaselineActiveStudy(): ActiveStudySnapshot {
  const seed10 =
    INITIAL_SEEDED_DERASHOT.find((d) => d.sequenceNumber === 10) ||
    INITIAL_SEEDED_DERASHOT[INITIAL_SEEDED_DERASHOT.length - 1];
  return {
    query: seed10.query,
    metodologia: seed10.methodology,
    duracion: seed10.duration,
    metodologiasComplementarias: seed10.complementaryMethodologies || ['PARDES'],
    audienciaOTono: seed10.audienceOrTone,
    savedAt: '2026-11-12T05:40:00.000Z',
    phase1Data: {
      title: seed10.title,
      primaryHebrew: 'הַלְלוּ־יָהּ הַלְלוּ עַבְדֵי ה׳ הַלְלוּ אֶת־שֵׁם ה׳',
      transliteration: 'Halelú-Yah, halelú avdei Hashem, halelú et-shem Hashem',
      literalSpanishTranslation:
        '¡Alabad a Yah! Alabad, siervos del Eterno, alabad el Nombre del Eterno.',
      liturgicalContext:
        'Tehilim 113:1 · Shulján Aruj Óraj Jaim 422:2 y 427:1 · Rosh Jódesh de 1 o 2 días (Mes Jaser 29 días vs. Malé 30 días) · Minhag y Núsaj Sefardí vs. Ashkenazí',
      morphologicalBreakdown: [
        {
          hebrewWord: 'הַלְלוּ',
          root: 'ה-ל-ל',
          rootMeaning: 'Alabar, hacer resplandecer, irradiar claridad.',
          binyan: 'Piel (Imperativo plural)',
          tense: 'Imperativo comunitario',
          theologicalImplication:
            'El Halel es proclamación de la soberanía y rescate divino en la historia de Israel, articulada según las leyes del Shulján Aruj y el Minhag de cada comunidad.',
        },
        {
          hebrewWord: 'חָסֵר וּמָלֵא',
          root: 'ח-ס-ר / מ-ל-א',
          rootMeaning: 'Deficiente (mes de 29 días = 1 día de Rosh Jódesh) y Pleno (mes de 30 días = 2 días de Rosh Jódesh).',
          binyan: 'Adjetivos calificativos calendáricos',
          tense: 'Atemporal',
          theologicalImplication:
            'Según tenga 29 o 30 días el mes que termina, Rosh Jódesh dura 1 día (día 1 del nuevo mes) o 2 días (día 30 del mes saliente + día 1 del mes nuevo), recitándose Jatsi Halel en ambos días.',
        },
        {
          hebrewWord: 'מִנְהָג',
          root: 'נ-ה-ג',
          rootMeaning: 'Conducir, guiar, caminar según una pauta transmitida.',
          binyan: 'Sustantivo deverbal',
          tense: 'Atemporal',
          theologicalImplication:
            '«Minhag Israel Torá hi»: las diferencias entre el Mejaber (Sefardí) y el Ramá (Ashkenazí) reflejan facetas legítimas de la tradición halájica.',
        },
      ],
      sefariaReferences: [
        {
          ref: 'Shulchan Arukh, Orach Chayim 422:2',
          heRef: 'שולחן ערוך אורח חיים תכ״ב:ב',
          rationale:
            'Debate halájico fundamental sobre la bendición en Medio Halel de Rosh Jódesh entre el Mejaber y la glosa del Ramá.',
          category: 'Halajá',
        },
        {
          ref: 'Shulchan Arukh, Orach Chayim 427:1',
          heRef: 'שולחן ערוך אורח חיים תכ״ז:א',
          rationale:
            'Por qué Rosh Jódesh es de 1 o 2 días dependiendo de cuántos días tiene el mes que termina (Jódesh Jaser de 29 días vs. Jódesh Malé de 30 días).',
          category: 'Halajá',
        },
        {
          ref: 'Mishneh Torah, Sanctification of the New Moon 8:4',
          heRef: 'משנה תורה, הלכות קידוש החודש ח׳:ד׳',
          rationale:
            'Explicación astronómica y halájica de Maimónides: el día 30 del mes saliente pleno es el primer día de Rosh Jódesh y el día 1 del nuevo mes es el segundo.',
          category: 'Halajá',
        },
        {
          ref: 'Taanit 28b',
          heRef: 'תענית כ״ח ב',
          rationale: 'Relato de Rav en Babilonia («Minhag avoteijem bideijem») sobre el Medio Halel en Rosh Jódesh.',
          category: 'Talmud',
        },
      ],
      detectedMetodologia: 'EVOLUCION_CONCEPTUAL',
      metodologiasComplementarias: ['PARDES'],
      duracion: '10_MIN',
    },
    verifiedSources: [
      {
        ref: 'Shulchan Arukh, Orach Chayim 422:2',
        heRef: 'שולחן ערוך אורח חיים תכ״ב:ב',
        hebrewText:
          'קוֹרִין הַלֵּל בְּרֹאשׁ חֹדֶשׁ בְּדִילּוּג, וְאֵין מְבָרְכִין עָלָיו... הגה: וְיֵשׁ אוֹמְרִים דִּמְבָרְכִים עָלָיו, וְכֵן נוֹהֲגִין בְּמִקְצָת מְקוֹמוֹת.',
        translation:
          'We read Hallel on Rosh Chodesh with omissions (Half Hallel), and we do not recite a blessing over it... Gloss of the Rema: And some say that one does recite a blessing over it, and such is the custom in many Ashkenazi communities.',
        spanishTranslation:
          'Se lee el Halel en Rosh Jódesh omitiendo pasajes (Medio Halel), y según el Mejaber no se recita bendición sobre él... Glosa del Ramá: Y hay quienes sostienen que sí se recita bendición sobre él, y así se acostumbra en las comunidades Ashkenazíes.',
        url: 'https://www.sefaria.org/Shulchan_Arukh%2C_Orach_Chayim.422.2',
        verified: true,
        statusText: 'Verificado en Biblioteca Sefaria (Respaldo Canónico)',
      },
      {
        ref: 'Shulchan Arukh, Orach Chayim 427:1',
        heRef: 'שולחן ערוך אורח חיים תכ״ז:א',
        hebrewText:
          'הֶחֳדָשִׁים יֵשׁ מֵהֶם מְלֵאִים וְיֵשׁ מֵהֶם חֲסֵרִים; הַחֹדֶשׁ שֶׁהוּא כ״ט יוֹם נִקְרָא חָסֵר וְרֹאשׁ חֹדֶשׁ שֶׁלְּאַחֲרָיו אֵינוֹ אֶלָּא יוֹם אֶחָד, וְהַחֹדֶשׁ שֶׁהוּא ל׳ יוֹם נִקְרָא מָלֵא וְרֹאשׁ חֹדֶשׁ שֶׁלְּאַחֲרָיו הוּא שְׁנֵי יָמִים: יוֹם ל׳ שֶׁל חֹדֶשׁ הָעוֹבֵר וְיוֹם א׳ שֶׁל חֹדֶשׁ הַבָּא.',
        translation:
          'Among the months some are full (30 days) and some are deficient (29 days). When the ending month has 29 days, the following Rosh Chodesh is 1 day; when the ending month has 30 days, the following Rosh Chodesh is 2 days: the 30th day of the outgoing month and the 1st day of the incoming month.',
        spanishTranslation:
          'Entre los meses hebreos hay meses plenos (Malé, de 30 días) y meses deficientes (Jaser, de 29 días): si el mes que termina tiene 29 días, Rosh Jódesh es de 1 solo día (el día 1 del nuevo mes); si el mes que termina tiene 30 días, Rosh Jódesh es de 2 días: el día 30 del mes que termina y el día 1 del nuevo mes.',
        url: 'https://www.sefaria.org/Shulchan_Arukh%2C_Orach_Chayim.427.1',
        verified: true,
        statusText: 'Verificado en Biblioteca Sefaria (Respaldo Canónico)',
      },
      {
        ref: 'Taanit 28b',
        heRef: 'תענית כ״ח ב',
        hebrewText: 'רַב אִיקְלַע לְבָבֶל, חֲזָנְהוּ דְּקָא קָרוּ הַלֵּל בְּרֵישׁ יַרְחָא... אָמַר: שְׁמַע מִינַּהּ מִנְהַג אֲבוֹתֵיהֶם בִּידֵיהֶם.',
        translation:
          'Rav visited Babylonia and saw them reciting Hallel on Rosh Chodesh with omissions. He said: Infer from this that they hold fast to the custom of their ancestors.',
        spanishTranslation:
          'Rav llegó a Babilonia y vio que leían el Halel en Rosh Jódesh omitiendo pasajes. Dijo: De aquí se deduce que conservan en sus manos la costumbre de sus padres (Minhag avoteijem bideijem).',
        url: 'https://www.sefaria.org/Taanit.28b',
        verified: true,
        statusText: 'Verificado en Biblioteca Sefaria (Respaldo Canónico)',
      },
    ],
    finalDerasha: {
      derashaTitle: seed10.title,
      openingExordium: seed10.centralIdea,
      fullStructuredDerashaMarkdown: seed10.essaySummary,
      metodologia: seed10.methodology,
      metodologiasComplementarias: seed10.complementaryMethodologies,
      duracion: seed10.duration,
      audienciaOTono: seed10.audienceOrTone,
      morphologicalSynthesis: {
        summary:
          'La raíz ה-ל-ל (Halel), la polaridad calendárica חָסֵר וּמָלֵא (Jaser 29 días = 1 día de Rosh Jódesh vs. Malé 30 días = 2 días de Rosh Jódesh) y el concepto de Minhag (מִנְהָג) articulan la alabanza litúrgica dentro del Shulján Aruj.',
        keyTheologicalInsight: seed10.centralIdea,
      },
      canonicalAnalysis: {
        synthesis: seed10.sourcesSummary,
        verifiedEchoes: [
          {
            ref: 'Shulchan Arukh, Orach Chayim 422:2',
            connection:
              'Contraste directo entre el Mejaber (sin Berajá en Medio Halel) y la glosa del Ramá (con Berajá según Minhag Ashkenaz).',
          },
          {
            ref: 'Shulchan Arukh, Orach Chayim 427:1',
            connection:
              'Regla calendárica y halájica de Rosh Jódesh de 1 o 2 días según si el mes que termina tiene 29 días (Jódesh Jaser) o 30 días (Jódesh Malé).',
          },
          {
            ref: 'Taanit 28b',
            connection: 'Fundamento talmúdico de Minhag avoteijem bideijem en la lectura del Halel.',
          },
        ],
      },
      pardes: {
        pshat: {
          hebrewPillar: 'פְּשָׁט',
          title: 'Norma del Halel en el Shulján Aruj (Oraj Jaim 422:2)',
          exposition: seed10.centralIdea,
          keyTakeaway: 'Shulchan Arukh, Orach Chayim 422:2 · Pesachim 117a · Arakhin 10a',
        },
        remez: {
          hebrewPillar: 'רֹאשׁ חֹדֶשׁ א׳ אוֹ ב׳ יָמִים',
          title: '¿Por qué Rosh Jódesh es de 1 o 2 Días según Cuántos Días Tiene el Mes que Termina? (Oraj Jaim 427:1)',
          exposition:
            'Como el ciclo lunar dura ~29 días y medio, los meses hebreos tienen 29 días (Jódesh Jaser) o 30 días (Jódesh Malé). Si el mes que termina tiene 29 días, Rosh Jódesh dura 1 solo día (el día 1 del nuevo mes). Si el mes que termina tiene 30 días, Rosh Jódesh dura 2 días: el día 30 del mes saliente (1.er día de Rosh Jódesh) y el día 1 del mes nuevo (2.º día de Rosh Jódesh, desde el cual se cuentan las fechas del mes), recitándose en ambos días el Medio Halel, Yaalé VeYavó y Musaf.',
          keyTakeaway: 'Shulchan Arukh, Orach Chayim 427:1 · Mishneh Torah, Hiljot Kidush HaJódesh 8:4 · Rosh Hashaná 19b',
        },
        drash: {
          hebrewPillar: 'דְּרַשׁ',
          title: 'Comparación Interna de Minhag y Núsaj Sin Filosofía Externa',
          exposition: seed10.essaySummary,
          keyTakeaway: seed10.centralIdea,
        },
        sod: {
          hebrewPillar: 'סוֹד',
          title: 'Unidad de Israel en la Pluralidad de Nusjaot',
          exposition:
            'Cada Núsaj y Minhag ancestral representa un sendero sagrado dentro de las doce tribus de Israel.',
          keyTakeaway: 'Honrar el Minhag comunitario con rigor halájico y Kavaná.',
        },
      },
      practicalConclusion: {
        title: 'Aplicación Práctica Halájica',
        hashkafa: seed10.centralIdea,
        prayerKavanah:
          'Recitar el Halel con alegría, de pie y respetando fielmente el Minhag y Núsaj de la congregación, tanto cuando Rosh Jódesh es de 1 día como en ambos días cuando es de 2 días.',
        dailyAction:
          'Verificar en Shabat Mevajarim y en el calendario si el mes que termina tiene 29 días (Rosh Jódesh de 1 día) o 30 días (Rosh Jódesh de 2 días: día 30 del mes saliente + día 1 del mes entrante).',
      },
    },
    followUps: [],
  };
}

/**
 * Builds the default Golden Baseline Active Study from Derashá #1 so that
 * falling back to the baseline safe point can also populate the Study Desk if needed.
 */
export function buildGoldenBaselineActiveStudy(): ActiveStudySnapshot {
  const seed1 = INITIAL_SEEDED_DERASHOT[0];
  return {
    query: seed1.query,
    metodologia: seed1.methodology,
    duracion: seed1.duration,
    metodologiasComplementarias: seed1.complementaryMethodologies || ['PARDES'],
    audienciaOTono: seed1.audienceOrTone,
    savedAt: '2026-11-11T07:00:00.000Z',
    phase1Data: {
      title: seed1.title,
      primaryHebrew: 'גָּדוֹל הַמְּצֻוֶּה וְעוֹשֶׂה יוֹתֵר מִמִּי שֶׁאֵינוֹ מְצֻוֶּה וְעוֹשֶׂה',
      transliteration: 'Gadol HaMetzuvé veOsé yoter miMi sheEinó Metzuvé veOsé',
      literalSpanishTranslation:
        'Más grande es quien está comandado (en el Pacto) y actúa, que quien no está comandado y actúa por sola iniciativa propia.',
      liturgicalContext: 'Talmud Bavli Kiddushin 31a · Ética Teonómica de la Alianza frente a la Autonomía Formal',
      morphologicalBreakdown: [
        {
          hebrewWord: 'מְצֻוֶּה',
          root: 'צ-ו-ה',
          rootMeaning: 'Ordenar, vincular, conectar (emparentado con Tzavta = unión/compañía).',
          binyan: 'Pual (Participio pasivo)',
          tense: 'Presente continuo',
          theologicalImplication:
            'El mandamiento en la Torá no es alienación heterónoma, sino vínculo relacional con el Comandante divino.',
        },
        {
          hebrewWord: 'וְעוֹשֶׂה',
          root: 'ע-ש-ה',
          rootMeaning: 'Hacer, concretar en la realidad física e histórica.',
          binyan: 'Paal (Qal)',
          tense: 'Participio activo',
          theologicalImplication:
            'La ética judía exige la encarnación práctica en actos específicos (Mitzvot), no solo buena voluntad abstracta.',
        },
      ],
      sefariaReferences: [
        {
          ref: 'Kiddushin 31a',
          heRef: 'קידושין ל״א א',
          rationale: 'Principio talmúdico de Rabí Janiná sobre la grandeza de actuar dentro del Pacto.',
          category: 'Talmud',
        },
        {
          ref: 'Deuteronomy 30:14',
          heRef: 'דברים ל׳:י״ד',
          rationale: 'Cercanía e interiorización del mandamiento en la boca y el corazón.',
          category: 'Tanaj',
        },
        {
          ref: 'Sanhedrin 56a',
          heRef: 'סנהדרין נ״ו א',
          rationale: 'Las 7 Leyes Universales de Bnei Nóaj como horizonte ético universal de la Torá.',
          category: 'Talmud',
        },
        {
          ref: 'Proverbs 6:23',
          heRef: 'משלי ו׳:כ״ג',
          rationale: 'Ki Ner Mitzvá veTorá Or: la especificidad del precepto como lámpara y la Torá como luz universal.',
          category: 'Tanaj',
        },
      ],
      detectedMetodologia: 'FILOSOFIA_CONTRASTIVA',
      metodologiasComplementarias: ['PARDES', 'EVOLUCION_CONCEPTUAL'],
      duracion: '10_MIN',
    },
    verifiedSources: [
      {
        ref: 'Kiddushin 31a',
        heRef: 'קידושין ל״א א',
        hebrewText: 'אָמַר רַבִּי חֲנִינָא גָּדוֹל הַמְּצֻוֶּה וְעוֹשֶׂה יוֹתֵר מִמִּי שֶׁאֵינוֹ מְצֻוֶּה וְעוֹשֶׂה',
        translation:
          'Rabbi Chanina said: Greater is one who is commanded and performs a mitzvah than one who is not commanded and performs it.',
        spanishTranslation:
          'Dijo Rabí Janiná: Más grande es quien está comandado (por una fuente trascendente en el Pacto) y cumple el precepto, que quien no está comandado y lo hace por sola iniciativa propia.',
        url: 'https://www.sefaria.org/Kiddushin.31a',
        verified: true,
        statusText: 'Verificado en Biblioteca Sefaria',
      },
      {
        ref: 'Deuteronomy 30:14',
        heRef: 'דברים ל׳:י״ד',
        hebrewText: 'כִּי־קָרוֹב אֵלֶיךָ הַדָּבָר מְאֹד בְּפִיךָ וּבִלְבָבְךָ לַעֲשֹׂתוֹ׃',
        translation: 'No, the thing is very close to you, in your mouth and in your heart, to observe it.',
        spanishTranslation:
          'Pues la palabra está muy cerca de ti, en tu boca y en tu corazón, para ponerla por obra.',
        url: 'https://www.sefaria.org/Deuteronomy.30.14',
        verified: true,
        statusText: 'Verificado en Biblioteca Sefaria',
      },
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        hebrewText: 'כִּי נֵר מִצְוָה וְתוֹרָה אוֹר וְדֶרֶךְ חַיִּים תּוֹכְחוֹת מוּסָר׃',
        translation:
          'For the commandment (mitzvah) is a lamp and the Torah is light, and the reproofs of instruction are the way of life.',
        spanishTranslation:
          'Porque lámpara es el mandamiento específico (Mitzvá) y la Torá es luz universal, y camino de vida son las enseñanzas éticas del Musar.',
        url: 'https://www.sefaria.org/Proverbs.6.23',
        verified: true,
        statusText: 'Verificado en Biblioteca Sefaria',
      },
    ],
    finalDerasha: {
      derashaTitle: seed1.title,
      openingExordium: seed1.centralIdea,
      fullStructuredDerashaMarkdown: seed1.essaySummary,
      metodologia: seed1.methodology,
      metodologiasComplementarias: seed1.complementaryMethodologies,
      duracion: seed1.duration,
      audienciaOTono: seed1.audienceOrTone,
      morphologicalSynthesis: {
        summary:
          'La raíz צ-ו-ה (Tzavá / Mitzvá) comparte campo semántico con Tzavta (vínculo/conexión), revelando que el deber en la Torá une al ser humano con el Creador y con el prójimo.',
        keyTheologicalInsight: seed1.centralIdea,
      },
      canonicalAnalysis: {
        synthesis: seed1.sourcesSummary,
        verifiedEchoes: [
          {
            ref: 'Kiddushin 31a',
            connection: 'Fundamento de la teonomía relacional frente a la autonomía aislada.',
          },
          {
            ref: 'Proverbs 6:23',
            connection: 'Articulación entre la lámpara del precepto particular y la luz universal de la Torá.',
          },
        ],
      },
      pardes: {
        pshat: {
          hebrewPillar: 'פְּשָׁט',
          title: 'Sentido Literal y Filosófico: Autonomía vs. Alianza',
          exposition: seed1.centralIdea,
          keyTakeaway: 'Kiddushin 31a · Deuteronomy 30:14',
        },
        remez: {
          hebrewPillar: 'רֶמֶז',
          title: 'Universalidad frente a Especificidad de la Mitzvá',
          exposition: seed1.essaySummary,
          keyTakeaway: 'Proverbs 6:23 · Sanhedrin 56a',
        },
        drash: {
          hebrewPillar: 'דְּרַשׁ',
          title: 'Desarrollo Exegético Completo',
          exposition: seed1.essaySummary,
          keyTakeaway: seed1.centralIdea,
        },
        sod: {
          hebrewPillar: 'סוֹד',
          title: 'Dimensión Interior: Mitzvá como Tzavta (Unión)',
          exposition:
            'En la dimensión interior, cada Mitzvá concreta tiende un puente entre el Infinito y la acción finita cotidiana.',
          keyTakeaway: 'Transformar el deber moral en vínculo vivo de Alianza.',
        },
      },
      practicalConclusion: {
        title: 'Síntesis Ética y Práctica',
        hashkafa: seed1.centralIdea,
        prayerKavanah:
          'Reconocer cada precepto como un diálogo de amor y responsabilidad con el Creador y el prójimo.',
        dailyAction:
          'Realizar hoy una acción concreta de bondad y justicia recordando que nuestra respuesta al mandato construye comunidad.',
      },
    },
    followUps: [],
  };
}

/**
 * Returns the immutable Golden Baseline Safe Point Snapshot (Master v2.0 Backup & Fallback).
 * Includes all 10 canonical Derashot (#1 to #10), Halakhic Validator, and Shulján Aruj / Minhag / Núsaj study.
 */
export function getGoldenBaselineSafePoint(): SystemSafePointSnapshot {
  const archive = [...INITIAL_SEEDED_DERASHOT];
  const activeStudy = buildHalakhicV2BaselineActiveStudy();
  const payload = {
    archive,
    comparativeStudies: [],
    activeStudy,
  };
  return {
    id: GOLDEN_BASELINE_ID,
    label: 'Versión de Respaldo y Fallback v2.0 (Validador Halájico + Shulján Aruj · #1–#10)',
    description:
      'Respaldo maestro inmutable v2.0 con las 10 Derashot canónicas (#1 a #10), Validador Halájico Puro activo (cero filosofía externa en Halajá), Shulján Aruj (Mejaber/Ramá, Minhag y Núsaj) y motor de fallback determinista offline.',
    triggerType: 'baseline',
    isPinnedBaseline: true,
    createdAt: '2026-11-12T05:00:00.000Z',
    checksum: computeSnapshotChecksum(payload),
    version: '2.0.0-halakhic-fallback',
    stats: {
      archiveCount: archive.length,
      comparativeCount: 0,
      hasActiveStudy: true,
      activeStudyTitle: activeStudy.finalDerasha.derashaTitle,
    },
    payload,
  };
}

/**
 * Reads the currently saved active study from localStorage safely.
 */
export function readCurrentActiveStudySafely(): ActiveStudySnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_STUDY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.finalDerasha && parsed.phase1Data) {
      return {
        query: parsed.query || '',
        metodologia: parsed.metodologia || 'AUTO',
        duracion: parsed.duracion || '10_MIN',
        metodologiasComplementarias: Array.isArray(parsed.metodologiasComplementarias)
          ? parsed.metodologiasComplementarias
          : [],
        audienciaOTono: parsed.audienciaOTono || 'Comunidad general · Inspirador y práctico',
        phase1Data: parsed.phase1Data,
        verifiedSources: Array.isArray(parsed.verifiedSources) ? parsed.verifiedSources : [],
        finalDerasha: parsed.finalDerasha,
        followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
        savedAt: parsed.savedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Loads all available Safe Points from localStorage, always pinning the Golden Baseline first.
 */
export function loadLocalSafePoints(): SystemSafePointSnapshot[] {
  const golden = getGoldenBaselineSafePoint();
  try {
    const raw = localStorage.getItem(SAFEPOINTS_STORAGE_KEY);
    if (!raw) {
      const initialList = [golden];
      localStorage.setItem(SAFEPOINTS_STORAGE_KEY, JSON.stringify(initialList));
      return initialList;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [golden];
    }
    const validCustom = parsed.filter(
      (sp: SystemSafePointSnapshot) =>
        sp &&
        typeof sp.id === 'string' &&
        sp.id !== GOLDEN_BASELINE_ID &&
        sp.id !== GOLDEN_HALAKHIC_V2_BASELINE_ID &&
        sp.payload &&
        Array.isArray(sp.payload.archive)
    );
    return [golden, ...validCustom];
  } catch {
    return [golden];
  }
}

/**
 * Saves the Safe Points list to localStorage (keeping Golden Baseline + up to 14 recent snapshots).
 */
export function saveLocalSafePoints(snapshots: SystemSafePointSnapshot[]): void {
  const golden = getGoldenBaselineSafePoint();
  const others = snapshots
    .filter((s) => s && s.id !== GOLDEN_BASELINE_ID && s.id !== GOLDEN_HALAKHIC_V2_BASELINE_ID)
    .slice(0, 14);
  try {
    localStorage.setItem(SAFEPOINTS_STORAGE_KEY, JSON.stringify([golden, ...others]));
  } catch {
    // If quota is tight, keep Golden + 4 most recent
    try {
      localStorage.setItem(
        SAFEPOINTS_STORAGE_KEY,
        JSON.stringify([golden, ...others.slice(0, 4)])
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Creates a new Safe Point snapshot from the current application state, saves it locally,
 * and syncs it to the server vault (/api/safepoints).
 */
export function createSystemSafePoint(params: {
  label?: string;
  description?: string;
  triggerType: 'manual' | 'auto' | 'emergency';
  archive?: ArchivedDerashaEntry[];
  comparativeStudies?: ComparativeDerashaAnalysisResult[];
  activeStudy?: ActiveStudySnapshot | null;
}): SystemSafePointSnapshot {
  const archive = mergeArchiveEntriesSafely(
    INITIAL_SEEDED_DERASHOT,
    params.archive || loadLocalArchive()
  );
  const comparativeStudies = params.comparativeStudies || loadLocalComparativeStudies();
  const activeStudy =
    params.activeStudy !== undefined ? params.activeStudy : readCurrentActiveStudySafely();

  const nowIso = new Date().toISOString();
  const formattedDate = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isAuto = params.triggerType === 'auto';
  const id = isAuto ? AUTO_SAFEPOINT_ID : `safepoint-${params.triggerType}-${Date.now()}`;

  const defaultLabel = isAuto
    ? `Punto Seguro Automático (${formattedDate})`
    : params.triggerType === 'emergency'
    ? `Respaldo de Emergencia Pre-Fallo (${formattedDate})`
    : `Punto Seguro Manual (${formattedDate})`;

  const payload = {
    archive,
    comparativeStudies,
    activeStudy,
  };

  const snapshot: SystemSafePointSnapshot = {
    id,
    label: (params.label || '').trim() || defaultLabel,
    description:
      (params.description || '').trim() ||
      `Estado verificado con ${archive.length} Derashot (#1–#${
        archive[archive.length - 1]?.sequenceNumber || archive.length
      })${
        activeStudy?.finalDerasha?.derashaTitle
          ? ` y estudio activo «${activeStudy.finalDerasha.derashaTitle}»`
          : ''
      }.`,
    triggerType: params.triggerType,
    isPinnedBaseline: false,
    createdAt: nowIso,
    checksum: computeSnapshotChecksum(payload),
    version: '1.0.0',
    stats: {
      archiveCount: archive.length,
      comparativeCount: comparativeStudies.length,
      hasActiveStudy: Boolean(activeStudy),
      activeStudyTitle: activeStudy?.finalDerasha?.derashaTitle,
    },
    payload,
  };

  const currentList = loadLocalSafePoints();
  const filtered = currentList.filter((item) => item.id !== id && item.id !== GOLDEN_BASELINE_ID);
  const updatedList = [getGoldenBaselineSafePoint(), snapshot, ...filtered];
  saveLocalSafePoints(updatedList);

  // Sync to server Safe Point vault in background
  fetch(resolveApiUrl('/api/safepoints'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot }),
  }).catch(() => {});

  return snapshot;
}

/**
 * Fetches server-stored Safe Points and merges them with local Safe Points.
 */
export async function syncSafePointsWithServer(): Promise<SystemSafePointSnapshot[]> {
  const local = loadLocalSafePoints();
  try {
    const res = await fetch(resolveApiUrl('/api/safepoints'));
    if (!res.ok) return local;
    const data = await res.json();
    if (!data || !Array.isArray(data.snapshots)) return local;

    const byId = new Map<string, SystemSafePointSnapshot>();
    local.forEach((sp) => byId.set(sp.id, sp));
    data.snapshots.forEach((srvSp: SystemSafePointSnapshot) => {
      if (srvSp && srvSp.id && srvSp.id !== GOLDEN_BASELINE_ID && srvSp.payload) {
        const existing = byId.get(srvSp.id);
        if (!existing || new Date(srvSp.createdAt) > new Date(existing.createdAt)) {
          byId.set(srvSp.id, srvSp);
        }
      }
    });

    const golden = getGoldenBaselineSafePoint();
    const others = Array.from(byId.values())
      .filter((s) => s.id !== GOLDEN_BASELINE_ID)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const merged = [golden, ...others];
    saveLocalSafePoints(merged);
    return merged;
  } catch {
    return local;
  }
}

/**
 * Restores a Safe Point by ID (or falls back to the latest valid Safe Point / Golden Baseline).
 * Updates localStorage and server state atomically and returns the restored snapshot.
 */
export async function restoreSystemSafePoint(
  safePointId?: string
): Promise<SystemSafePointSnapshot> {
  const allSnapshots = loadLocalSafePoints();
  let target = safePointId
    ? allSnapshots.find((s) => s.id === safePointId)
    : allSnapshots.find((s) => s.id === AUTO_SAFEPOINT_ID) ||
      allSnapshots.find((s) => !s.isPinnedBaseline) ||
      getGoldenBaselineSafePoint();

  if (!target || !target.payload) {
    target = getGoldenBaselineSafePoint();
  }

  const normalizedArchive = mergeArchiveEntriesSafely(
    INITIAL_SEEDED_DERASHOT,
    target.payload.archive || []
  );
  const normalizedComparisons = Array.isArray(target.payload.comparativeStudies)
    ? target.payload.comparativeStudies
    : [];
  const restoredActiveStudy =
    target.payload.activeStudy || buildGoldenBaselineActiveStudy();

  // 1. Write restored state to localStorage
  saveLocalArchive(normalizedArchive);
  saveLocalComparativeStudies(normalizedComparisons);
  try {
    localStorage.setItem(LAST_STUDY_STORAGE_KEY, JSON.stringify(restoredActiveStudy));
  } catch {
    // ignore quota errors
  }

  // 2. Sync restoration to server disk vault
  try {
    await fetch(resolveApiUrl('/api/safepoints/restore'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        safePointId: target.id,
        archive: normalizedArchive,
        comparativeStudies: normalizedComparisons,
      }),
    });
  } catch {
    // Even if offline, local restoration succeeded
  }

  return {
    ...target,
    payload: {
      archive: normalizedArchive,
      comparativeStudies: normalizedComparisons,
      activeStudy: restoredActiveStudy,
    },
  };
}

/**
 * Deletes a user-created Safe Point (cannot delete the Golden Baseline).
 */
export function deleteSystemSafePoint(safePointId: string): SystemSafePointSnapshot[] {
  if (safePointId === GOLDEN_BASELINE_ID) return loadLocalSafePoints();
  const current = loadLocalSafePoints();
  const updated = current.filter((s) => s.id !== safePointId);
  saveLocalSafePoints(updated);

  fetch(resolveApiUrl(`/api/safepoints/${encodeURIComponent(safePointId)}`), {
    method: 'DELETE',
  }).catch(() => {});

  return updated;
}

/**
 * Audits and self-heals the system storage state, fixing any corrupted JSON keys,
 * deduplicating sequenceNumbers in the Derashot archive, and ensuring a valid Safe Point exists.
 */
export async function verifyAndRepairSystemState(): Promise<{
  healthy: boolean;
  repairedIssues: string[];
  archiveCount: number;
  safePointsCount: number;
  checksum: string;
}> {
  const repairedIssues: string[] = [];

  // 1. Verify & normalize archive
  let rawArchiveCount = 0;
  try {
    const raw = localStorage.getItem('darshan_derashot_archive_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rawArchiveCount = parsed.length;
    }
  } catch {
    repairedIssues.push('Se reparó el JSON corrupto del archivo local de Derashot.');
  }

  const repairedArchive = loadLocalArchive();
  if (repairedArchive.length !== rawArchiveCount && rawArchiveCount > 0) {
    repairedIssues.push(
      `Se normalizaron las numeraciones secuenciales del archivo (#1 a #${repairedArchive.length}) sin colisiones.`
    );
  }
  saveLocalArchive(repairedArchive);

  // 2. Verify comparative studies
  try {
    const rawComp = localStorage.getItem('darshan_comparative_studies_v1');
    if (rawComp) JSON.parse(rawComp);
  } catch {
    saveLocalComparativeStudies([]);
    repairedIssues.push('Se limpió el registro temporal corrupto de estudios comparativos.');
  }

  // 3. Verify active study
  const active = readCurrentActiveStudySafely();
  if (!active) {
    const baselineActive = buildGoldenBaselineActiveStudy();
    try {
      localStorage.setItem(LAST_STUDY_STORAGE_KEY, JSON.stringify(baselineActive));
      repairedIssues.push(
        'Se restauró una Derashá base verificada en la Mesa de Estudio para lectura inmediata.'
      );
    } catch {
      // ignore
    }
  }

  // 4. Create or refresh automatic safe point
  const autoSp = createSystemSafePoint({
    triggerType: 'auto',
    archive: repairedArchive,
  });

  const allSafePoints = await syncSafePointsWithServer();

  return {
    healthy: true,
    repairedIssues,
    archiveCount: repairedArchive.length,
    safePointsCount: allSafePoints.length,
    checksum: autoSp.checksum,
  };
}

/**
 * Exports a Safe Point snapshot to a downloadable .json file on the user's device.
 */
export function exportSafePointToJsonFile(snapshot: SystemSafePointSnapshot): void {
  const dataStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const datePart = snapshot.createdAt.slice(0, 10);
  a.href = url;
  a.download = `darshan-safepoint-${snapshot.checksum.toLowerCase()}-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Validates and imports a Safe Point snapshot from a JSON string uploaded by the user.
 */
export function importSafePointFromJsonString(rawJson: string): SystemSafePointSnapshot {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('El archivo no contiene un objeto JSON válido.');
  }

  // Support importing either a full SystemSafePointSnapshot or a raw array of ArchivedDerashaEntry
  let archive: ArchivedDerashaEntry[] = [];
  let comparativeStudies: ComparativeDerashaAnalysisResult[] = [];
  let activeStudy: ActiveStudySnapshot | null = null;
  let label = 'Punto Seguro Importado';

  if (parsed.payload && Array.isArray(parsed.payload.archive)) {
    archive = parsed.payload.archive;
    comparativeStudies = Array.isArray(parsed.payload.comparativeStudies)
      ? parsed.payload.comparativeStudies
      : [];
    activeStudy = parsed.payload.activeStudy || null;
    if (parsed.label) label = `${parsed.label} (Importado)`;
  } else if (Array.isArray(parsed)) {
    archive = parsed;
  } else if (Array.isArray(parsed.entries)) {
    archive = parsed.entries;
  } else {
    throw new Error(
      'Formato de Punto Seguro no reconocido. Selecciona un archivo .json exportado por Darshán AI.'
    );
  }

  const mergedArchive = mergeArchiveEntriesSafely(INITIAL_SEEDED_DERASHOT, archive);
  return createSystemSafePoint({
    label,
    description: `Punto seguro importado desde archivo externo con ${mergedArchive.length} Derashot verificadas.`,
    triggerType: 'manual',
    archive: mergedArchive,
    comparativeStudies,
    activeStudy: activeStudy || readCurrentActiveStudySafely(),
  });
}

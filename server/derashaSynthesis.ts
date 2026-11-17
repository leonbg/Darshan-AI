import { normalizeUserStudyQuery } from './queryNormalization.ts';
import {
  hasCustomOutputPreferences,
  summarizeOutputPreferencesEs,
} from '../src/utils/outputPreferences.ts';
import type { PardesLevelKey } from '../src/types.ts';

export function normalizeMethodologySections(
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
export function synthesizeContinuousDerashaMarkdown(params: {
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

  const customSummaryLine =
    derasha?.outputPreferences && hasCustomOutputPreferences(derasha.outputPreferences)
      ? `  \n> *Personalización de salida:* ${summarizeOutputPreferencesEs(derasha.outputPreferences)}`
      : '';

  if (primaryHebrew) {
    parts.push(
      `> **${primaryHebrew}**  \n> *(${transliteration || ''})* — «${literalSpanishTranslation || ''}»  \n> *Contexto:* ${liturgicalContext || 'Tradición Rabínica'} · *Metodología:* ${metodologia} · *Enfoque:* ${audienciaOTono}${customSummaryLine}`
    );
  } else if (customSummaryLine) {
    parts.push(`> *Metodología:* ${metodologia} · *Enfoque:* ${audienciaOTono}${customSummaryLine}`);
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

  const prioritizedSet = new Set<PardesLevelKey>(
    Array.isArray(derasha?.outputPreferences?.prioritizedLevels)
      ? derasha.outputPreferences.prioritizedLevels
      : []
  );

  sections.forEach((sec) => {
    const keyLower = (sec.key || '').toLowerCase() as PardesLevelKey;
    const isPriority = prioritizedSet.has(keyLower);
    parts.push(
      `## ${sec.spanishSubtitle}: ${sec.title} (${sec.hebrewTerm})${isPriority ? ' · [Nivel Prioritario]' : ''}\n`
    );
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

export function compactVerifiedSourcesForPrompt(verifiedSources: any[]): any[] {
  if (!Array.isArray(verifiedSources)) return [];
  return verifiedSources.slice(0, 6).map((s) => ({
    ref: s?.ref || '',
    heRef: s?.heRef || '',
    hebrewText: String(s?.hebrewText || '').slice(0, 520),
    translation: String(s?.spanishTranslation || s?.translation || '').slice(0, 520),
  }));
}

export function buildDefaultContemporaryMasters(
  query: string,
  derashaTitle: string,
  openingExordium?: string,
  practicalConclusion?: any
) {
  const {
    cleanTopicLabel,
    isMashiajTopic,
    isPrayerPostureTopic,
    isGratitudeTopic,
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
        perspectiveAngle: isPrayerPostureTopic
          ? 'Lenguaje corporal del Pacto: por qué la postura educa el corazón antes de la palabra (Kuzari 3:5; Berajot 34b)'
          : isGratitudeTopic
          ? 'Por qué el pueblo judío se llama «Yehudim» (los agradecidos, Génesis 29:35) y el nexo entre Modé Aní y la felicidad moral'
          : 'Contraste entre cosmovisiones externas (Universalidad abstracta) y la Torá (Especificidad del Mandamiento)',
        readingTitle: isPrayerPostureTopic
          ? 'El Cuerpo que Ora: Cómo los Pies Juntos, la Inclinación en Baruj-Atá y Levantarse en Hashem Danzan entre Humildad y Dignidad'
          : isGratitudeTopic
          ? 'Somos Llamados «Yehudim» por Agradecer: De Lea en Génesis 29:35 a Modé Aní y Berajot 35a'
          : isAfterlifeSoulDestinyTopic
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
        centralQuestion: isPrayerPostureTopic
          ? '¿Por qué exige la Halajá (Oraj Jaim 95 y 113) posturas corporales tan precisas y únicamente cuatro inclinaciones en la Amidá, en lugar de dejar la reverencia solo como un sentimiento mental?'
          : isGratitudeTopic
          ? '¿Por qué la palabra misma con la que se define nuestra identidad («Yehudí», Génesis 29:35) deriva de agradecer (Hodaiá), y qué revela Modé Aní sobre la salud espiritual?'
          : isAfterlifeSoulDestinyTopic
          ? '¿Por qué el judaísmo no exige que toda la humanidad se convierta a una sola religión para acceder al Olam HaBá, a diferencia del exclusivismo dogmático o del Valhalla guerrero?'
          : isEnlightenmentBuddhismTopic
          ? '¿Cuál es la diferencia espiritual entre buscar la iluminación mediante el desapego del mundo (Budismo) y buscar la luz mediante la santificación activa de las relaciones y el tiempo (Torá)?'
          : isComp
          ? '¿Por qué las fuentes filosóficas externas (Platón, Cicerón, Kant) buscan la verdad en conceptos universales desencarnados, mientras que las fuentes internas de la Torá conjugan la universalidad ética con la especificidad concreta de cada mandamiento?'
          : isMashiajTopic
          ? '¿Por qué el judaísmo espera a un líder humano que transforme la historia y la sociedad en lugar de una huida mística fuera de este mundo?'
          : '¿Cómo ilumina esta enseñanza nuestra comprensión de la responsabilidad moral y la relación entre el ser humano y el Creador?',
        coreThesis: isPrayerPostureTopic
          ? 'Para el judaísmo, la mente humana es volátil y tiende a distraerse; por eso Rabí Yehudá Haleví (Kuzari 3:5), el Sefer HaJínuj (Mitzvá 16) y Maimónides (Hiljot Tefilá 5:4) enseñan que la postura del cuerpo —juntar los pies, bajar la mirada, posar las manos sobre el pecho y doblar rodillas y torso en «Baruj Atá»— despierta el asombro del corazón y evita que la reverencia se diluya en mera costumbre.'
          : isGratitudeTopic
          ? 'El Rabino Jonathan Sacks destacaba que la psicología positiva moderna apenas redescubrió lo que la Halajá enseña desde hace milenios en Modé Aní (Kitzur 1:2) y Berajot 35a: no es la felicidad la que produce gratitud, sino la gratitud disciplinada (Hakarat HaTov) la que engendra alegría, humildad y paz social.'
          : isAfterlifeSoulDestinyTopic
          ? 'En «The Dignity of Difference», el Rabino Jonathan Sacks subraya uno de los principios más revolucionarios de las fuentes internas de la Torá (Tosefta Sanhedrín 13:2 y Rambam, Hiljot Teshuvá 3:5): «Jasidei Umot HaOlam yesh lahem jélek la-Olam HaBá» (los justos de entre las naciones tienen parte en el Mundo Venidero). Mientras otras tradiciones exigen un credo dogmático único, la muerte heroica en batalla (Valhalla) o la extinción del alma individual (Nirvana), el judaísmo une la universalidad del acceso ético con la especificidad de los mandamientos.'
          : isEnlightenmentBuddhismTopic
          ? 'Mientras el budismo (Dhammapada, Anatta) busca liberar de la sed (Tanha) disolviendo el apego y el yo individual, la tradición judía afirma la realidad sagrada de la persona, del amor y de la historia, encendiendo la luz divina («Be-orjá niré or», Salmos 36:10) a través de la especificidad concreta de cada Mitzvá (Proverbios 6:23).'
          : isComp
          ? 'En «The Great Partnership» y «The Dignity of Difference», el Rabino Jonathan Sacks demuestra que mientras Platón, Cicerón y Kant disuelven lo particular en lo universal abstracto, la Torá revela que el amor, la lealtad y la santidad viven en la especificidad del mandamiento concreto (Mitzvá).'
          : practicalConclusion?.hashkafa ||
            'En el judaísmo, la verdad teológica y textual nunca permanece en la abstracción contemplativa: se encarna en el pacto relacional, la justicia social, la gratitud consciente y la dignificación de la vida humana.',
        detailedExposition: isPrayerPostureTopic
          ? 'El Rabino Jonathan Sacks solía destacar el equilibrio único de la Keriá en Berajot 12a y Oraj Jaim 113:4: mientras la reverencia humana frente a un déspota suele exigir encogerse o permanecer humillado, el judío dobla sus rodillas en «Baruj» y su espalda en «Atá», pero se yergue inmediatamente al pronunciar «Hashem» («El Eterno endereza a los encorvados», Salmos 146:8). Además, al limitar las inclinaciones a exactamente cuatro (inicio y cierre de Avot y de Modim, Berajot 34a), la Halajá protege el peso simbólico del gesto contra la inflación emocional.'
          : isGratitudeTopic
          ? 'El Rabino Jonathan Sacks explicaba que cuando Lea llamó a su cuarto hijo Yehudá diciendo «Esta vez agradeceré a Hashem» (Génesis 29:35), dio nombre a todo nuestro pueblo: ser judío («Yehudí») significa vivir desde el agradecimiento (Hodaiá). Al despertar con «Modé Aní» y recitar bendiciones antes de disfrutar del mundo (Berajot 35a), entrenamos la mirada para pasar del derecho exigido («me lo deben») al regalo agradecido.'
          : isAfterlifeSoulDestinyTopic
          ? 'El Rabino Jonathan Sacks analiza cómo la escatología judía (Olam HaBá en Sanhedrín 90a, Berajot 17a y Pirké Avot 4:16) articula la Universalidad y la Especificidad del Mandamiento: el Dios universal de toda la humanidad (Génesis 1:27) abre las puertas del Olam HaBá a toda persona de cualquier nación que viva con rectitud ética cumpliendo los 7 Preceptos Universales de Noé (Sanhedrín 56a), al tiempo que convoca al pueblo de Israel a preparar ese banquete espiritual mediante la especificidad de las 613 Mitzvot en este mundo de acción («Este mundo es como un vestíbulo ante el Olam HaBá», Pirké Avot 4:16).'
          : isEnlightenmentBuddhismTopic
          ? 'El Rabino Jonathan Sacks explica que el judaísmo sí posee una profunda teología de la iluminación —el Or HaGanuz (la luz primordial oculta en la Torá, Jaguigá 12a), el Ruaj HaKódesh (Mesilat Yesharim cap. 26) y la Devekut—, pero su método es inverso al retiro monástico: en vez de retirarse del mundo para apagar el deseo, santificamos el deseo dentro de la familia, la mesa de Shabat, el estudio compartido (Javruta) y la justicia social (Tzedaká).'
          : isComp
          ? 'El Rabino Jonathan Sacks analiza la diferencia estructural entre las fuentes externas (Atenas, Roma, Königsberg) y las fuentes internas de la Torá (Jerusalén): 1) En la Alegoría de la Caverna de Platón (República VII), el mundo físico e histórico es visto como una caverna de sombras de la cual el filósofo debe escapar hacia la Idea universal; en la Torá (Proverbios 6:23: «Ner Mitzvá ve-Torá Or»), la especificidad del mandamiento concreto es la lámpara que ilumina y santifica la realidad física. 2) En Cicerón (De Officiis) y Kant (Imperativo Categórico), la ley moral se concibe como una fórmula uniforme e impersonal; en la Torá, un cimiento ético universal (las 7 Leyes de Noé, Sanhedrín 56a) se articula con la especificidad casuística de la Mitzvá (Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).'
          : isMashiajTopic
          ? 'El Rabino Jonathan Sacks distingue entre el «optimismo» (la creencia pasiva de que las cosas mejorarán solas) y la «esperanza» judía (Tikvá: el coraje moral de trabajar junto a Dios para reparar el mundo). En la tradición judía, el Mashíaj es un líder íntegramente humano que restaura la ética de la Torá, reúne a los dispersos y demuestra que la paz universal (Isaías 2:4) se edifica dentro de la historia humana.'
          : 'El Rabino Jonathan Sacks subraya que la tradición rabínica articula simultáneamente la grandeza cósmica de la Creación y la intimidad histórica del Pacto. Cada fórmula litúrgica y cada precepto ético nos convocan a pasar del mero asentimiento intelectual a la agencia moral activa, construyendo una sociedad fundada en Jésed, justicia y reverencia por la imagen divina en el prójimo.',
        keyQuoteOrConcept: isPrayerPostureTopic
          ? '«Ante los hombres nos inclinamos por temor y quedamos sometidos; ante Dios nos inclinamos en Baruj-Atá para volver a ponernos de pie al pronunciar Su Nombre (Salmos 146:8).»'
          : isGratitudeTopic
          ? '«Quien aprende a comenzar el día diciendo Modé Aní descubre que la gratitud no es una emoción pasajera, sino el fundamento mismo de la alegría y de la sociedad del Pacto.»'
          : isAfterlifeSoulDestinyTopic
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
        perspectiveAngle: isPrayerPostureTopic
          ? 'Las 18 vértebras, el hueso Luz y la transformación de la letra Vav en Kaf (Bittul según Tania cap. 41)'
          : isGratitudeTopic
          ? 'Modé Aní sin el Nombre Divino, «Rabá Emunateja» (la fe que Dios tiene en ti cada mañana) y la Sefirá de Hod'
          : 'Psicología del alma, alegría en el servicio divino y Dirá BeTajtonim',
        readingTitle: isPrayerPostureTopic
          ? 'De la Vav Erguida a la Kaf Inclinada: Por Qué la Columna Entera (18 Vértebras) Se Dobla en Keriá según Berajot 28b y el Tania'
          : isGratitudeTopic
          ? '«Grande es Tu Fe en Mí»: Cómo Modé Aní, Elohai Neshamá y la Sefirá de Hod Transforman Cada Mañana en Dirá BeTajtonim'
          : isAfterlifeSoulDestinyTopic
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
        centralQuestion: isPrayerPostureTopic
          ? '¿Qué secreto encierra la enseñanza talmúdica (Berajot 28b) de que debemos inclinarnos hasta distender todas las 18 vértebras de la columna, y cómo se vincula con el hueso Luz y la anulación del ego (Bittul)?'
          : isGratitudeTopic
          ? '¿Por qué culmina Modé Aní diciendo «Rabá emunateja» («Grande es Tu fe») y cómo se unen el reconocimiento del alma devuelta y la Sefirá de Hod en la Jasidut?'
          : isAfterlifeSoulDestinyTopic
          ? '¿Por qué enseña la Mishná en Pirké Avot 4:17 que una sola hora de Teshuvá y buenas acciones en este mundo físico supera toda la dicha espiritual del Olam HaBá, pero a la vez todo el Olam HaBá supera a este mundo?'
          : isEnlightenmentBuddhismTopic
          ? '¿Dónde escondió Dios la Luz Primordial (Or HaGanuz) del primer día de la Creación según el Talmud (Jaguigá 12a) y el Tania, y cómo accedemos a esa iluminación hoy?'
          : isComp
          ? '¿Por qué según el Tania (cap. 36-37) la meta del alma no es escapar de la caverna física hacia las alturas espirituales, sino introducir la luz divina en los objetos materiales específicos mediante cada Mitzvá?'
          : isMashiajTopic
          ? '¿Qué significa según el Tania y las enseñanzas de Jabad preparar el mundo para la llegada del Mashíaj mediante cada mitzvá cotidiana?'
          : '¿Cómo llevar esta enseñanza desde el intelecto (Jojmá-Biná-Daat) hasta la calidez del corazón y la acción cotidiana?',
        coreThesis: isPrayerPostureTopic
          ? 'En Berajot 28b, las 18 vértebras corresponden exactamente a las 18 bendiciones originales de la Amidá. Como explica el Alter Rebe en el Tania (cap. 41) y la literatura jasídica, cuando una persona rígida («Iejidut» del ego, representada por la letra Vav ו) se dobla hasta formar la letra Kaf (כ — Kéter/recipiente vacío), convierte su cuerpo físico entero en un recipiente humilde (Bittul) para la vitalidad divina.'
          : isGratitudeTopic
          ? 'Rab Yehoshua Gordon explicaba dos joyas jasídicas sobre Modé Aní: primero, que agradecemos antes de lavarnos las manos porque el vínculo esencial de la Neshamá pura jamás se impurifica (Berajot 60b; Tania cap. 24); segundo, que «Rabá emunateja» no es solo nuestra fe en Hashem, sino Su confianza renovada en nosotros cada mañana al devolvernos el alma para que cumplamos nuestra misión en este mundo (Dirá BeTajtonim).'
          : isAfterlifeSoulDestinyTopic
          ? 'En el Tania (cap. 36-37) expuestos por Rab Yehoshua Gordon, en el Gan Edén espiritual (Olam HaBá de las almas) los justos disfrutan del resplandor de la Shejiná (Berajot 17a), pero es únicamente en este mundo físico donde el alma con libre albedrío puede conectarse con la Esencia misma de Hashem (Atzmut) al cumplir una Mitzvá específica.'
          : isEnlightenmentBuddhismTopic
          ? 'El Zohar y el Baal Shem Tov enseñan que el Or HaGanuz (la Luz Oculta de Génesis 1:3 y Jaguigá 12a) fue investido dentro de las palabras de la Torá y las Mitzvot específicas: cuando una persona estudia Torá y cumple una Mitzvá con alegría (Simjá shel Mitzvá), no apaga su alma sino que la enciende como «Nér Hashem nishmat adam» (Proverbios 20:27).'
          : isComp
          ? 'En el Tania y la filosofía jasídica, la especificidad física del mandamiento (la lana del Tzitzit, el cuero de los Tefilín, la moneda concreta dada en Tzedaká) logra lo que ninguna filosofía abstracta externa puede lograr: unir el alma con la esencia misma del Creador (Tzavta) y transformar la caverna material en morada divina (Dirá BeTajtonim).'
          : practicalConclusion?.prayerKavanah ||
            'A la luz de la Jasidut y del Baal Shem Tov, el propósito de la creación es construir una morada para Dios en el mundo físico (Dirá BeTajtonim) a través de la Torá, la bondad y las mitzvot prácticas.',
        detailedExposition: isPrayerPostureTopic
          ? 'Rab Yehoshua Gordon explicaba con vivacidad el Midrash (Vayikrá Rabá 18:1) y Berajot 28b: quienes rezaban inclinándose mecánicamente sin doblar la rigidez interior no recibían el flujo de la plegaria. En la Amidá juntamos los pies (Oraj Jaim 95:1) para dejar atrás las corridas del mundo y alinearnos como ángeles «de un solo pie recto» (Ezequiel 1:7); luego, en Avot y Modim, inclinamos rodillas, torso y columna entera para recordarle también al cuerpo —y al pequeño hueso Luz en la nuca, emblema de la resurrección— que nuestra vida depende a cada instante del Creador, elevándonos después con alegría en el Nombre de Hashem.'
          : isGratitudeTopic
          ? 'Rab Yehoshua Gordon enseñaba a la luz del Tania y del Rebe de Lubavitch que el orden de las dos primeras palabras del día —«Modé» antes que «Aní»— fija toda la arquitectura emocional de la jornada. Antes de que el «yo» egoico reclame derechos o preocupaciones, la persona pronuncia «Modé» (agradezco/reconozco, raíz compartida con la Sefirá de Hod). Incluso cuando Moshé tuvo que abstenerse de golpear el Nilo y el polvo de Egipto (Bava Kamma 92b; Rashi en Éxodo 7:19 y 8:12), nos mostró que la gratitud hacia todo instrumento de bien afina la sensibilidad del alma para percibir la Hashgajá Pratit en cada respiración («Kol ha-neshamá tehalel Yah», Bereshit Rabá 14:9).'
          : isAfterlifeSoulDestinyTopic
          ? 'Rab Yehoshua Gordon explica la paradoja de Pirké Avot 4:16-17 a la luz de la Jasidut: a diferencia del Nirvana (donde el yo individual se extingue), del Valhalla (donde el guerrero caído sigue combatiendo y banqueteando) o de un cielo meramente escapista, el judaísmo enseña que cada acción ética y cada Mitzvá específica cumplida hoy («HaYom laasotam», Erubín 22a) teje las vestiduras luminosas del alma en el Olam HaBá y acerca la resurrección y redención final donde el espíritu y la materia se unen en armonía.'
          : isComp
          ? 'Desde la perspectiva del Tania (Alter Rebe) expuesta por Rab Yehoshua Gordon, las fuentes filosóficas externas (Platón, Cicerón, Kant, Budismo) operan con el esfuerzo ascendente del ser humano (Jojmá ba-Goyim), que percibe el mundo material como ilusión, sufrimiento o caverna oscura. En cambio, las fuentes internas de la Torá revelan que el deseo supremo de Hashem es una morada aquí abajo, en los mundos inferiores (Dirá BeTajtonim). Cuando una persona realiza un mandamiento específico con alegría (Simjá shel Mitzvá), convierte la propia oscuridad del mundo físico en luz divina («Ner Mitzvá ve-Torá Or», Proverbios 6:23).'
          : isMashiajTopic
          ? 'Como explica Rab Yehoshua Gordon siguiendo al Alter Rebe en el Tania (cap. 36-37) y al Rebe de Lubavitch, la Era Mesiánica no es la destrucción del mundo físico, sino el momento en que la realidad material deja de ocultar la presencia de Hashem («y la tierra estará llena del conocimiento del Eterno», Isaías 11:9). El Mashíaj —un ser humano de linaje davídico investido de sabiduría y Ruaj HaKodesh— culminará el trabajo milenario de todas las generaciones enseñando Torá y trayendo paz a toda la humanidad.'
          : 'Desde la perspectiva de la Jasidut enseñada por Rab Yehoshua Gordon y el Rebe de Lubavitch, ningún detalle del texto sagrado ni de nuestra experiencia diaria es casual. Reconocer la mano del Creador en lo cotidiano disipa la ansiedad y el ego, despertando una gratitud viva que convierte la rutina material en una morada luminosa para lo divino (Dirá BeTajtonim).',
        keyQuoteOrConcept: isPrayerPostureTopic
          ? '«Quien no dobla sus vértebras en Modim corre el riesgo de endurecer el alma: cuando el cuerpo se vuelve una letra Kaf humilde en Keriá, Hashem lo corona al pronunciar Su Nombre (Berajot 28b; Tania 41).»'
          : isGratitudeTopic
          ? '«Que hayas despertado esta mañana significa que el Rey del universo renovó Su fe en ti ("Rabá emunateja"): responde poniendo Modé antes que Aní.»'
          : isAfterlifeSoulDestinyTopic
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

export function normalizeOrBuildExecutiveSummary(
  derashaObj: any,
  verifiedSources: any[] = [],
  fallbackTitle = 'Estudio de Torá'
) {
  const clean = (s?: string) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
  const firstSentence = (s?: string, maxLen = 220) => {
    const t = clean(s);
    if (!t) return '';
    const m = t.match(/[^.!?]+[.!?]+/);
    const sentence = m ? m[0].trim() : t;
    return sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1).trim()}…` : sentence;
  };

  const sourcesDigest: string[] = [];
  const seenRefs = new Set<string>();
  for (const s of verifiedSources || []) {
    const ref = clean(s?.ref);
    if (!ref || seenRefs.has(ref.toLowerCase())) continue;
    seenRefs.add(ref.toLowerCase());
    sourcesDigest.push(s?.heRef ? `${ref} (${clean(s.heRef)})` : ref);
    if (sourcesDigest.length >= 6) break;
  }
  if (sourcesDigest.length === 0) {
    for (const echo of derashaObj?.canonicalAnalysis?.verifiedEchoes || []) {
      const ref = clean(echo?.ref);
      if (!ref || seenRefs.has(ref.toLowerCase())) continue;
      seenRefs.add(ref.toLowerCase());
      sourcesDigest.push(ref);
      if (sourcesDigest.length >= 6) break;
    }
  }

  const raw = derashaObj?.executiveSummary || {};
  const headlineThesis =
    clean(raw.headlineThesis) ||
    clean(derashaObj?.morphologicalSynthesis?.keyTheologicalInsight) ||
    clean(derashaObj?.practicalConclusion?.hashkafa) ||
    firstSentence(derashaObj?.openingExordium, 210) ||
    clean(derashaObj?.derashaTitle) ||
    clean(fallbackTitle);

  const abstractNarrative =
    clean(raw.abstractNarrative) ||
    [
      firstSentence(derashaObj?.openingExordium, 340),
      firstSentence(derashaObj?.canonicalAnalysis?.synthesis, 220),
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Síntesis estructurada a partir de las fuentes clásicas verificadas de la tradición judía.';

  const rawPillars = Array.isArray(raw.keyPillars) ? raw.keyPillars : [];
  const normalizedPillars = rawPillars
    .map((p: any) => ({
      label: clean(p?.label),
      takeaway: clean(p?.takeaway),
    }))
    .filter((p: any) => p.label && p.takeaway)
    .slice(0, 5);

  const keyPillars =
    normalizedPillars.length > 0
      ? normalizedPillars
      : (Array.isArray(derashaObj?.methodologySections) ? derashaObj.methodologySections : [])
          .slice(0, 4)
          .map((sec: any) => ({
            label: clean(sec?.title || sec?.spanishSubtitle || 'Pilar Exegético'),
            takeaway:
              clean(sec?.keyTakeaway) || firstSentence(sec?.exposition, 200) || headlineThesis,
          }))
          .filter((p: any) => p.label && p.takeaway);

  const practicalTakeaway =
    clean(raw.practicalTakeaway) ||
    clean(derashaObj?.practicalConclusion?.dailyAction) ||
    clean(derashaObj?.practicalConclusion?.prayerKavanah) ||
    clean(derashaObj?.practicalConclusion?.hashkafa) ||
    'Aplicar esta enseñanza en la conducta ética y la intención espiritual diaria.';

  const words = [
    headlineThesis,
    abstractNarrative,
    ...keyPillars.map((p: any) => `${p.label} ${p.takeaway}`),
    practicalTakeaway,
  ]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    headlineThesis,
    abstractNarrative,
    keyPillars,
    coreSourcesDigest: sourcesDigest,
    practicalTakeaway,
    estimatedReadingSec: Math.max(25, Math.min(180, Math.round((words / 180) * 60))),
  };
}

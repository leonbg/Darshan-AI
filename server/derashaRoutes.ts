import type { Express } from 'express';
import { Type, ThinkingLevel } from '@google/genai';
import { detectExternalThinkerAndForceExegeticalSearch } from '../src/utils/externalThinkerDetector.ts';
import {
  validatePurelyHalakhicQuery,
  sanitizeHalakhicOutputFromExternalCitations,
} from '../src/utils/halakhicPipelineValidator.ts';
import {
  consultHalakhicShulchanArukhModule,
  enrichHalakhicConsultationWithVerifiedSources,
} from '../src/utils/halakhicShulchanArukhModule.ts';
import {
  composeAudienceAndTone,
  normalizeDerashaTone,
  resolveDerashaTone,
} from '../src/utils/toneAdvisor.ts';
import {
  distillTopicEssence,
  sanitizeDerashaQuotedQuestions,
} from '../src/utils/topicEssence.ts';
import {
  getGenAIClient,
  GEMINI_HYDROGEN_MODEL,
  logPipelineGeminiDiagnostic,
  GeminiHttpError,
  classifyGeminiRouteError,
  parseGeminiJsonSafely,
  generateContentWithRetry,
  setBoundedCache,
  derashaMemoryCache,
  inFlightPhase3ServerRequests,
} from './aiClient.ts';
import { normalizeUserStudyQuery } from './queryNormalization.ts';
import {
  STRICT_JEWISH_SOURCES_COVENANT,
  fetchExternalComparativeSources,
  buildDefaultFormalExegeticalContrast,
  sanitizeStrictJewishObject,
} from './externalSources.ts';
import {
  resolveEffectiveMethodology,
  resolveComplementaryMethodologies,
  getDurationAndComplementaryInstructions,
  getMethodologyInstructions,
} from './methodologyPrompts.ts';
import {
  normalizeMethodologySections,
  synthesizeContinuousDerashaMarkdown,
  compactVerifiedSourcesForPrompt,
  buildDefaultContemporaryMasters,
  normalizeOrBuildExecutiveSummary,
} from './derashaSynthesis.ts';

export function registerDerashaRoutes(app: Express) {
  // Phase 3: Final structured Derashá generation with active Methodology, Duration and Complementary Methodologies
  app.post('/api/generate-derasha', async (req, res) => {
    const phase3StartedAt = Date.now();
    const {
      query: rawQuery,
      tema_o_fuente,
      metodologia: rawMetodologia,
      metodologias_complementarias,
      duracion: rawDuracion,
      audiencia_o_tono,
      tono_homiletico,
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
    } = req.body || {};

    const rawInput = (tema_o_fuente || rawQuery || '').trim();
    const {
      normalizedQuery: query,
      cleanTopicLabel,
      isUserQuestion,
      isHalelTopic,
      isPrayerPostureTopic,
      isGratitudeTopic,
      subFocus,
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

    if (!query || !morphologicalBreakdown || !verifiedSources) {
      return res
        .status(400)
        .json({ error: 'Faltan datos requeridos (análisis morfológico o fuentes verificadas).' });
    }

    const halakhicValidation = validatePurelyHalakhicQuery(query);
    const halakhicConsultation = consultHalakhicShulchanArukhModule(query, halakhicValidation);
    const requestedTone = normalizeDerashaTone(tono_homiletico);
    const toneEval = resolveDerashaTone(
      requestedTone,
      query,
      metodologia as any,
      halakhicValidation
    );
    const audienciaOTono = tono_homiletico
      ? composeAudienceAndTone(
          audiencia_o_tono || 'Comunidad general',
          requestedTone,
          toneEval.resolvedTone
        )
      : audiencia_o_tono || 'Comunidad general · Inspirador y práctico';

    const derashaCacheKey = `${query.toLowerCase()}|${metodologia}|${duracion}|${complementaryMethodologies.join(',')}|${audienciaOTono}|${toneEval.resolvedTone}`;
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

    const existingInFlightP3 = inFlightPhase3ServerRequests.get(derashaCacheKey);
    if (existingInFlightP3) {
      try {
        const coalescedDerasha = await existingInFlightP3;
        return res.json({
          ...coalescedDerasha,
          stageTimingsMs: {
            stage3LlmMs: 0,
            markdownAssemblyMs: 0,
            totalPhase3Ms: Date.now() - phase3StartedAt,
            cacheHit: true,
          },
        });
      } catch (inFlightErr: any) {
        if (inFlightErr instanceof GeminiHttpError) {
          return res
            .status(inFlightErr.status)
            .json({ error: inFlightErr.message, errorCode: inFlightErr.errorCode });
        }
      }
    }

    const p3ExecutionPromise = (async () => {
      try {
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
        const methodologyRules = getMethodologyInstructions(
          metodologia,
          audienciaOTono,
          toneEval.resolvedTone,
          toneEval.isSensitivePastoralContext
        );
        const durationAndComplementaryRules = getDurationAndComplementaryInstructions(
          metodologia,
          duracion,
          complementaryMethodologies
        );

        const comparativePromptSection = halakhicValidation.externalPhilosophyInjectionDisabled
          ? `REGLA HALÁJICA ESTRICTA — MÓDULO DEL SHULJÁN ARUJ (OMISIÓN TOTAL DE FILOSOFÍA EXTERNA):
1. Esta consulta pertenece a la Halajá normativa (${halakhicConsultation.consultedBranchLabels.join(' · ') || 'Halajá'}). Está TERMINANTEMENTE PROHIBIDO inyectar filosofía externa o comparativa (ninguna mención a Kant, Platón, Cicerón, Aristóteles, Budismo, Nirvana, Valhalla ni contrastes filosóficos externos).
2. PROHIBIDO REPETIR LA PREGUNTA ENTRE COMILLAS («...»): Usa siempre un título conceptual limpio (ej. "${cleanTopicLabel}").
3. CITAS BREVES Y DIRECTAS DEL SHULJÁN ARUJ (PERTINENTES AL TEMA):
   - Incorpora como fuente central el **Shulján Aruj (שֻׁלְחָן עָרוּךְ)** estrictamente en los simanim correspondientes al tema consultado (*Yoré Deá 340–403* y *Oraj Jaim 55:1* para duelo/Avelut y Kadish; *Oraj Jaim* para leyes de Rezos y Festividades; *Yoré Deá 1–120* para Kashrut), integrando **citas breves y directas** con su **Simán y Seif exactos** y el diálogo entre **Rabí Yosef Karo (*El Mejaber*, tradición Sefardí)** y **Rabí Moshé Isserles (*El Ramá — HaMapá*, tradición Ashkenazí)**. NO inyectes simanim ajenos al tema (por ejemplo, nunca mezcles leyes de inclinaciones en la Amidá *Oraj Jaim 113* ni *Oraj Jaim 1:1* dentro de un estudio sobre Avelut/Kadish).${
     isHalelTopic
       ? `\n   - Dado que el tema involucra **Halel** o **Rosh Jódesh**, explica explícitamente cuándo dura 1 día (mes saliente de 29 días, *Jódesh Jaser*) o 2 días (mes saliente de 30 días, *Jódesh Malé*: día 30 del mes saliente + día 1 del mes entrante, según *Shulján Aruj, Oraj Jaim 427:1* y *Rambam Hiljot Kidush HaJódesh 8:4*).`
       : ''
   }
   ${halakhicConsultation.active ? halakhicConsultation.systemPromptDirective : halakhicValidation.systemPromptGuard}`
          : `REGLA PEDAGÓGICA FUNDAMENTAL — CÓMO RESPONDER PREGUNTAS Y ANÁLISIS FILOSÓFICOS COMPARATIVOS SIN REPETIRLOS COMO CITAS:
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
     2) **Caracterización del Mesías en el Cristianismo (5 ejes dogmáticos) y Desglose Sistemático de las 7 Diferencias con el Judaísmo**: Caracteriza al Mesías cristiano (a. Dios encarnado trinitario según Nicea 325 e.c. y Calcedonia 451 e.c.; b. Soteriología del pecado original y sacrificio vicario en la cruz; c. Salvación interior invisible; d. Abrogación de la observancia de los preceptos de la Torá; e. Doctrina de la «Segunda Venida / Parusía») y desglosa las **7 diferencias fundamentales** frente al judaísmo.
     3) **Si la pregunta es «¿Por qué Buda no es el Mashíaj?» (Caracterización de Siddhartha Gautama / el Buda y Desglose de las 7 Diferencias con el Mashíaj del Judaísmo)**: cubre (I) ¿Qué exige el Judaísmo para ser el *Mashíaj*?; (II) Caracterización de Siddhartha Gautama en el Canon Pali en **5 ejes**; y (III) Desglose sistemático de las **7 razones y diferencias**.
     4) **Si la consulta aborda los distintos grupos dentro del judaísmo (Jasidismo como Jabad y Breslev, Ortodoxia, Reformismo) y señala cuándo un grupo ya se aleja y deja de ser judío (como los «judíos mesiánicos» que son cristianos evangélicos)**: estructura el análisis en **3 partes claras** (Mapa de Corrientes Legítimas, Frontera Teológica y Halájica, y Por Qué los «Judíos Mesiánicos» NO son Judíos sino Cristianos Evangélicos).
     5) **Si la consulta aborda leyes (Halajá), el Halel, Rosh Jódesh, cumplimiento práctico, el Shulján Aruj, o comparaciones de costumbres dentro del judaísmo (Minhag y Núsaj)**:
        - Incorpora como fuente central el **Shulján Aruj (שֻׁלְחָן עָרוּךְ)** mostrando el diálogo entre **El Mejaber** y **El Ramá** junto con sus comentaristas (*Mishná Berurá*, *Ben Ish Jai*, *Kaf HaJaim*, *Yalkut Yosef*).
        - Si involucra el **Halel** o **Rosh Jódesh**, explica explícitamente cuándo dura 1 o 2 días (*Jódesh Jaser* de 29 días vs. *Jódesh Malé* de 30 días).`;

        const veracitySourcesInstruction = halakhicValidation.externalPhilosophyInjectionDisabled
          ? `REGLA DE ORO DE VERACIDAD Y USO EXCLUSIVO DE FUENTES INTERNAS Y SHULJÁN ARUJ:
Tienes a tu disposición los TEXTOS REALES de las **Fuentes Internas de la Torá y del Shulján Aruj** (descargados de la API de Sefaria y del módulo halájico interno). Integra directamente **citas breves y directas del Shulján Aruj** (*Oraj Jaim* y/o *Yoré Deá*) con su Simán y Seif precisos. OMITIR COMPLETAMENTE toda inyección o mención de filosofía externa o comparativa.`
          : `REGLA DE ORO DE VERACIDAD Y USO DE FUENTES INTERNAS Y EXTERNAS:
Tienes a tu disposición los TEXTOS REALES de las **Fuentes Internas de la Torá** (descargados de la API de Sefaria) y, cuando se trata de un estudio comparativo, las **Fuentes Externas Filosóficas y Clásicas** (Kant, Platón, Cicerón, Canon Pali sobre Iluminación/Nirvana, Eddas sobre Valhalla, Cristología Conciliar y la Disputa de Barcelona de 1263). Cita ambas con precisión para fundamentar el contraste exegético formal.`;

        const systemInstruction = `Eres un asistente rabínico y pedagógico especializado en redactar drashot estructuradas y profundas.
${STRICT_JEWISH_SOURCES_COVENANT}

Recibes cinco parámetros principales:
1. "consulta_o_tema": "${query}"
2. "metodologia_principal": "${metodologia}"
3. "metodologias_complementarias": ${JSON.stringify(complementaryMethodologies)}
4. "duracion": "${duracion}"
5. "audiencia_o_tono": "${audienciaOTono}"

${comparativePromptSection}

${methodologyRules}

${durationAndComplementaryRules}

${veracitySourcesInstruction}

REGLA ESTRICTA ANTI-PARÁFRASIS, ANTI-REPETICIÓN Y DENSIDAD TEMÁTICA:
- JAMÁS repitas literalmente la frase disyuntiva o conversacional de la pregunta del usuario ("el significado de X o significado de Y o por qué Z...") a lo largo de los títulos de sección, exordios, conclusiones o resúmenes. Nombra el tema una sola vez de forma concisa y limpia en 'derashaTitle' ("${cleanTopicLabel}"), y en el resto del texto utiliza sinónimos técnicos, hebraísmos y conceptos rabínicos concretos (prohibido rellenar párrafos repitiendo el título o la pregunta).
- NO te quedes en generalidades vagas sobre "Kavaná y Presencia": exige enseñanza sustantiva, fuentes con Simán/Seif o folio talmúdico y contenido concreto del que el estudiante realmente aprenda. Mantén el 100% de las citas estrictamente ceñidas al tema consultado (por ejemplo, si el estudio trata sobre *Avelut* y *Kadish*, prohíbe introducir leyes de inclinaciones de la Amidá *Oraj Jaim 113:1/113:4* o el despertar matutino *Oraj Jaim 1:1*).${
          isPrayerPostureTopic
            ? `\n- Dado que la consulta aborda la postura corporal, la reverencia o por qué inclinarse en el rezo (*Keriá* de inclinación / *Hishtajavaiá* / *Kidá* / pies juntos), DEBES enseñar en detalle: (1) *Oraj Jaim 95:1–2* (*Berajot 10b*; *Yevamot 105b*); (2) *Oraj Jaim 113:1* (*Berajot 34a*); (3) *Oraj Jaim 113:4* (*Berajot 12a*; *Salmos 146:8*); (4) *Berajot 28b* y *Vayikrá Rabá 18:1*; (5) *Megilá 22b* y *Oraj Jaim 127:1*; y (6) *Kuzari 3:5*, *Sefer HaJínuj 16* y *Tania cap. 41*.`
            : ''
        }${
          isGratitudeTopic
            ? `\n- Dado que la consulta aborda la gratitud (*Hakarat HaTov*), *Modé Aní*, *Elohai Neshamá*, *Hodaiá* o *Mizmor LeTodá*, DEBES enseñar con fuentes específicas: *Kitzur Shulján Aruj 1:2*, *Berajot 60b*, *Berajot 35a*, *Bava Kamma 92b*, *Salmos 100:4*, *Vayikrá Rabá 9:7* y *Jovot HaLevavot, Shaar HaBejiná*.`
            : ''
        }
${subFocus ? `- REGLA DE ACOTACIÓN Y AMPLIACIÓN SOBRE LA DRASHÁ ANTERIOR: El estudiante está acotando y ampliando el estudio previo específicamente hacia «${subFocus}». Conserva el tema base de la drashá anterior como eje central y desarrolla en profundidad ese ángulo específico en el exordio y en cada sección metodológica; PROHIBIDO dar una respuesta genérica desconectada de la drashá previa.` : ''}

SALIDA OBLIGATORIA:
1. 'derashaTitle': Título inspirador, conceptual y claro de la drashá que destile la esencia del tema (NUNCA pegues ni cites la pregunta cruda del usuario, ni la encierres entre comillas «...» o "...").
2. 'openingExordium': Apertura clara y directa que destile la esencia del tema y responda de frente las cuestiones o el contraste planteado por el usuario SIN citar ni repetir textualmente la pregunta entre comillas ni usar fórmulas redundantes.
3. 'methodologySections': Arreglo estructurado con las secciones exactas de la metodología principal ("${metodologia}") MÁS las secciones de aporte de las metodologías complementarias (${JSON.stringify(complementaryMethodologies)}) cuando la duración es "10_MIN" (1 sección complementaria adicional) o "30_MIN" (2 secciones complementarias adicionales).
4. 'practicalConclusion': Conclusión con llamada a la acción moral y espiritual clara, tangible y transformadora.
5. 'executiveSummary': Resumen ejecutivo de lectura rápida (~60 segundos) con la tesis central ('headlineThesis'), síntesis narrativa clara de 2 a 4 oraciones ('abstractNarrative'), los 3 o 4 puntos clave de la drashá ('keyPillars') y la enseñanza práctica inmediata ('practicalTakeaway').`;

        const compactSources = compactVerifiedSourcesForPrompt(verifiedSources);
        const effectiveTitle = distillTopicEssence(
          rawInput,
          title && !title.startsWith('Estudio Exegético:') ? title : cleanTopicLabel
        );

        const externalSourcesPromptBlock = halakhicValidation.externalPhilosophyInjectionDisabled
          ? halakhicConsultation.active
            ? `${halakhicValidation.systemPromptGuard}${halakhicConsultation.systemPromptDirective}`
            : halakhicValidation.systemPromptGuard
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
          duracion === '30_MIN' || shouldIncludeComparativeContrast || externalThinkerDetection.detected
            ? ThinkingLevel.MEDIUM
            : ThinkingLevel.LOW;

        const phase3TimeoutMs = phase3ThinkingLevel === ThinkingLevel.MEDIUM ? 54000 : 48000;

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
                        hebrewBadge: { type: Type.STRING },
                        hebrewTerm: { type: Type.STRING },
                        spanishSubtitle: { type: Type.STRING },
                        title: { type: Type.STRING },
                        exposition: { type: Type.STRING },
                        keyTakeaway: { type: Type.STRING },
                        sourceMethodology: { type: Type.STRING },
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
                      summary: { type: Type.STRING },
                      keyTheologicalInsight: { type: Type.STRING },
                    },
                    required: ['summary', 'keyTheologicalInsight'],
                  },
                  canonicalAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      synthesis: { type: Type.STRING },
                      verifiedEchoes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            ref: { type: Type.STRING },
                            connection: { type: Type.STRING },
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
                      title: { type: Type.STRING },
                      hashkafa: { type: Type.STRING },
                      prayerKavanah: { type: Type.STRING },
                      dailyAction: { type: Type.STRING },
                    },
                    required: ['title', 'hashkafa', 'prayerKavanah', 'dailyAction'],
                  },
                  executiveSummary: {
                    type: Type.OBJECT,
                    properties: {
                      headlineThesis: { type: Type.STRING },
                      abstractNarrative: { type: Type.STRING },
                      keyPillars: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            label: { type: Type.STRING },
                            takeaway: { type: Type.STRING },
                          },
                          required: ['label', 'takeaway'],
                        },
                      },
                      practicalTakeaway: { type: Type.STRING },
                    },
                    required: ['headlineThesis', 'abstractNarrative', 'keyPillars', 'practicalTakeaway'],
                  },
                },
                required: [
                  'derashaTitle',
                  'openingExordium',
                  'methodologySections',
                  'morphologicalSynthesis',
                  'canonicalAnalysis',
                  'practicalConclusion',
                  'executiveSummary',
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

        const parsed = sanitizeStrictJewishObject(
          parseGeminiJsonSafely(response.text, '/api/generate-derasha')
        );
        parsed.metodologia = metodologia;
        parsed.metodologiasComplementarias = complementaryMethodologies;
        parsed.duracion = duracion;
        parsed.audienciaOTono = audienciaOTono;
        parsed.tonoHomiletico = toneEval.requestedTone;
        parsed.resolvedTone = toneEval.resolvedTone;
        parsed.toneAdvisory = toneEval.advisoryReason;
        parsed.halakhicValidation = halakhicValidation;
        if (halakhicConsultation.active) {
          parsed.halakhicConsultation = enrichHalakhicConsultationWithVerifiedSources(
            halakhicConsultation,
            verifiedSources
          );
        }
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

        const sanitizedParsedQuestions = sanitizeDerashaQuotedQuestions(
          parsed,
          rawInput,
          distillTopicEssence(rawInput, parsed.derashaTitle || effectiveTitle)
        );
        Object.assign(parsed, sanitizedParsedQuestions);

        if (!parsed.contemporaryMasters || !Array.isArray(parsed.contemporaryMasters.readings)) {
          parsed.contemporaryMasters = buildDefaultContemporaryMasters(
            query,
            parsed.derashaTitle || effectiveTitle,
            parsed.openingExordium,
            parsed.practicalConclusion
          );
        }

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

        parsed.executiveSummary = normalizeOrBuildExecutiveSummary(
          parsed,
          verifiedSources,
          parsed.derashaTitle || effectiveTitle
        );

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

        const finalizedDerasha = sanitizeDerashaQuotedQuestions(
          sanitizeHalakhicOutputFromExternalCitations(
            sanitizeStrictJewishObject(parsed),
            halakhicValidation
          ),
          rawInput,
          parsed.derashaTitle || effectiveTitle
        );
        setBoundedCache(derashaMemoryCache, derashaCacheKey, finalizedDerasha);
        return finalizedDerasha;
      } catch (p3Err: any) {
        logPipelineGeminiDiagnostic('/api/generate-derasha', p3Err, GEMINI_HYDROGEN_MODEL);
        const classified = classifyGeminiRouteError(p3Err);
        throw new GeminiHttpError(classified.status, classified.code, classified.userMessage);
      } finally {
        inFlightPhase3ServerRequests.delete(derashaCacheKey);
      }
    })();

    inFlightPhase3ServerRequests.set(derashaCacheKey, p3ExecutionPromise);
    try {
      const finalP3Payload = await p3ExecutionPromise;
      return res.json(finalP3Payload);
    } catch (err: any) {
      const classified = classifyGeminiRouteError(err);
      return res.status(classified.status).json({
        error: classified.userMessage,
        errorCode: classified.code,
      });
    }
  });

  // Follow-up Q&A to deepen/expand on any point of the Derashá
  app.post('/api/expand-derasha', async (req, res) => {
    try {
      const { question, derashaContext, conversationHistory } = req.body || {};

      if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ error: 'Debes proporcionar una pregunta para profundizar.' });
      }

      const combinedQuery = `${derashaContext?.query || ''} ${question}`.trim();
      const { isComparativeTopic } = normalizeUserStudyQuery(combinedQuery);

      const combinedHalakhicValidation = validatePurelyHalakhicQuery(combinedQuery);
      const omitExternalPhilosophy =
        combinedHalakhicValidation.externalPhilosophyInjectionDisabled ||
        Boolean(
          derashaContext?.halakhicValidation?.externalPhilosophyInjectionDisabled ||
            derashaContext?.halakhicConsultation?.externalPhilosophyOmitted
        );
      const expandHalakhicConsultation = omitExternalPhilosophy
        ? consultHalakhicShulchanArukhModule(combinedQuery, {
            ...combinedHalakhicValidation,
            isPurelyHalakha: true,
            isPurelyHalakhic: true,
            externalPhilosophyInjectionDisabled: true,
          } as any)
        : consultHalakhicShulchanArukhModule(combinedQuery, combinedHalakhicValidation);

      const activeExternalSources = omitExternalPhilosophy
        ? []
        : Array.isArray(derashaContext?.externalSources) && derashaContext.externalSources.length > 0
        ? derashaContext.externalSources
        : isComparativeTopic
        ? await fetchExternalComparativeSources(combinedQuery)
        : [];
      const activeFormalContrast = omitExternalPhilosophy
        ? undefined
        : derashaContext?.formalContrast ||
          (isComparativeTopic || activeExternalSources.length > 0
            ? buildDefaultFormalExegeticalContrast(combinedQuery, activeExternalSources)
            : undefined);

      const ai = getGenAIClient();

      const expandRule2 = omitExternalPhilosophy
        ? `2. Esta consulta trata sobre Halajá normativa (${expandHalakhicConsultation.consultedBranchLabels.join(' · ') || 'Shulján Aruj'}). Integra directamente **citas breves y directas del Shulján Aruj** (*Oraj Jaim* y/o *Yoré Deá*) con su Simán y Seif precisos, señalando los matices entre **El Mejaber (Rabí Yosef Karo)** y **El Ramá (Rabí Moshé Isserles)** cuando proceda. PROHIBIDO inyectar o mencionar filosofía externa o comparativa (ninguna referencia a Kant, Platón, Cicerón, Budismo, Nirvana o Valhalla).`
        : `2. Si la pregunta o el estudio involucra un **contraste comparativo** (por ejemplo: caracterizar el Mesías del cristianismo para desglosar sus diferencias con el Mashíaj del judaísmo, Imperativo Categórico de Kant, Alegoría de la Caverna de Platón, Cicerón, Iluminación en el Budismo frente al Judaísmo, o el Destino de las Almas: *Olam HaBá* frente a *Nirvana*, *Valhalla*, Cielo e Infierno y sus requisitos de acceso), utiliza las **Fuentes Externas** suministradas para informar la comparación y realiza el **Contraste Exegético Formal** con las **Fuentes Internas de la Torá** (analizando la *Universalidad frente a la Especificidad del Mandamiento* y la *Distinción entre Fuentes Internas de la Torá y Fuentes Externas* según *Eijá Rabá 2:13*).`;

      const systemInstruction = `Eres un maestro Darshán, filólogo hebraico y exégeta talmúdico, filosófico y cabalístico de máxima erudición.
${STRICT_JEWISH_SOURCES_COVENANT}
El estudiante está continuando y profundizando un estudio (Derashá) mediante una conversación interactiva.

Tu respuesta debe ser:
1. Directa, rigurosa, profunda y estructurada con subtítulos en Markdown (##, ###), viñetas y citas textuales.
${expandRule2}
3. Basada en fuentes tradicionales judías auténticas (Tanaj, Targum Onkelos, Mishná, Talmud Bavli y Yerushalmi, Midrash Rabá, *Shulján Aruj* [*Oraj Jaim* / *Yoré Deá*], Rishonim como Rashi, Rambam y Ramban, y comentaristas clásicos como *Mishná Berurá* y *Ben Ish Jai* / *Yalkut Yosef*).
4. En 'relatedSefariaReferences', incluye únicamente referencias del canon judío en Sefaria.
5. Incluye al final 3 preguntas sugeridas ('suggestedNextQuestions') que permitan al estudiante seguir profundizando la conversación.
6. REGLA ANTI-PARÁFRASIS: No repitas ni parafrasees la pregunta del estudiante para rellenar texto; ve directo a las fuentes, distinciones halájicas, talmúdicas, filosóficas o místicas concretas.${
        omitExternalPhilosophy
          ? `\n${expandHalakhicConsultation.systemPromptDirective || combinedHalakhicValidation.systemPromptGuard}`
          : ''
      }`;

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
  expandHalakhicConsultation.active
    ? `- Módulo Halájico del Shulján Aruj Activo (${expandHalakhicConsultation.consultedBranchLabels.join(' · ')}): ${JSON.stringify(
        expandHalakhicConsultation.directQuotes.map((q) => ({
          ref: q.ref,
          siman: q.simanSeifLabel,
          hebrew: q.briefHebrewQuote,
          spanish: q.briefSpanishQuote,
          mejaberAndRamaNote: q.mejaberAndRamaNote,
        }))
      )}`
    : ''
}
${
  !omitExternalPhilosophy && activeExternalSources.length > 0
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

      const rawParsed = sanitizeStrictJewishObject(
        parseGeminiJsonSafely(response.text, '/api/expand-derasha')
      );
      const parsed = omitExternalPhilosophy
        ? sanitizeHalakhicOutputFromExternalCitations(rawParsed, combinedHalakhicValidation)
        : rawParsed;
      return res.json(parsed);
    } catch (expandErr: any) {
      logPipelineGeminiDiagnostic('/api/expand-derasha', expandErr, GEMINI_HYDROGEN_MODEL);
      const classified = classifyGeminiRouteError(expandErr);
      return res
        .status(classified.status)
        .json({ error: classified.userMessage, errorCode: classified.code });
    }
  });
}

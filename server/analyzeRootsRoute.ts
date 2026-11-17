import type { Express } from 'express';
import { Type, ThinkingLevel } from '@google/genai';
import {
  detectExternalThinkerAndForceExegeticalSearch,
  mergeForcedThinkerRefsWithPredictions,
} from '../src/utils/externalThinkerDetector.ts';
import {
  validatePurelyHalakhicQuery,
  sanitizeHalakhicOutputFromExternalCitations,
} from '../src/utils/halakhicPipelineValidator.ts';
import {
  consultHalakhicShulchanArukhModule,
  enrichHalakhicConsultationWithVerifiedSources,
  mergeHalakhicRefsWithPredictions,
} from '../src/utils/halakhicShulchanArukhModule.ts';
import {
  composeAudienceAndTone,
  normalizeDerashaTone,
  resolveDerashaTone,
} from '../src/utils/toneAdvisor.ts';
import {
  getGenAIClient,
  GEMINI_DECISION_MODEL,
  GEMINI_HYDROGEN_MODEL,
  logPipelineGeminiDiagnostic,
  GeminiHttpError,
  classifyGeminiRouteError,
  parseGeminiJsonSafely,
  generateContentWithRetry,
  setBoundedCache,
  decideMethodologyCache,
  phase1MemoryCache,
  inFlightPhase1ServerRequests,
} from './aiClient.ts';
import { normalizeUserStudyQuery } from './queryNormalization.ts';
import { fetchServerSefariaSources } from './sefariaService.ts';
import {
  STRICT_JEWISH_SOURCES_COVENANT,
  fetchExternalComparativeSources,
  buildDefaultFormalExegeticalContrast,
  sanitizeStrictJewishObject,
} from './externalSources.ts';
import {
  resolveEffectiveMethodology,
  resolveComplementaryMethodologies,
} from './methodologyPrompts.ts';
import { evaluateStudyQueryWithDecisionsApi } from './decisionsRouter.ts';

export function registerAnalyzeRootsRoute(app: Express) {
  // Phase 1 + Phase 2 Combined Fast-Path: Morphological analysis, Sefaria canonical references & parallel server Sefaria prefetch
  app.post('/api/analyze-roots', async (req, res) => {
    const body = req.body || {};
    const rawQuery = body.tema_o_fuente || body.query;
    const requestedTone = normalizeDerashaTone(body.tono_homiletico);
    const rawAudience = body.audiencia_o_tono || 'Comunidad general · Inspirador y práctico';
    const duracion = String(body.duracion || '10_MIN').toUpperCase().trim();

    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res
        .status(400)
        .json({ error: 'Debes proporcionar un tema, pasaje bíblico o fuente para analizar.' });
    }

    const {
      normalizedQuery: query,
      cleanTopicLabel,
      isUserQuestion,
      isHalelTopic,
      isMourningTopic,
      isPrayerPostureTopic,
      isGratitudeTopic,
      subFocus,
      isComparativeTopic,
    } = normalizeUserStudyQuery(rawQuery);

    const requestedMethodUpper = String(body.metodologia || 'AUTO').toUpperCase().trim();
    let calibratedDelib: any = decideMethodologyCache.get(query.toLowerCase()) || null;
    if (!calibratedDelib && requestedMethodUpper === 'AUTO') {
      try {
        calibratedDelib = await evaluateStudyQueryWithDecisionsApi(rawQuery, body.tono_homiletico);
      } catch (decErr: any) {
        logPipelineGeminiDiagnostic('/api/analyze-roots[decisions]', decErr, GEMINI_DECISION_MODEL);
        const classified = classifyGeminiRouteError(decErr);
        return res.status(classified.status).json({
          error: classified.userMessage,
          errorCode: classified.code,
        });
      }
    }

    const halakhicValidation =
      calibratedDelib?.halakhicValidation || validatePurelyHalakhicQuery(query);
    const halakhicConsultation = consultHalakhicShulchanArukhModule(query, halakhicValidation);
    const externalThinkerDetection = halakhicValidation.externalPhilosophyInjectionDisabled
      ? detectExternalThinkerAndForceExegeticalSearch('')
      : detectExternalThinkerAndForceExegeticalSearch(query);
    const metodologia = resolveEffectiveMethodology(body.metodologia || 'AUTO', query);
    const explicitComplementary =
      Array.isArray(body.metodologias_complementarias) &&
      body.metodologias_complementarias.length > 0
        ? body.metodologias_complementarias
        : calibratedDelib
        ? duracion === '30_MIN'
          ? calibratedDelib.recommendedComplementaryFor30Min
          : duracion === '10_MIN'
          ? calibratedDelib.recommendedComplementaryFor10Min
          : []
        : undefined;
    const complementaryMethodologies = resolveComplementaryMethodologies(
      metodologia,
      query,
      duracion,
      explicitComplementary
    );
    const effectiveToneInput =
      requestedTone === 'AUTO' && calibratedDelib?.recommendedTone
        ? calibratedDelib.recommendedTone
        : requestedTone;
    const p1ToneEval = resolveDerashaTone(
      effectiveToneInput,
      query,
      metodologia as any,
      halakhicValidation
    );
    const audienciaOTono =
      body.tono_homiletico || calibratedDelib?.recommendedTone
        ? composeAudienceAndTone(rawAudience, effectiveToneInput, p1ToneEval.resolvedTone)
        : rawAudience;

    const phase1StartedAt = Date.now();
    const phase1CacheKey = `${query.toLowerCase()}|${metodologia}`;
    const cachedP1 = phase1MemoryCache.get(phase1CacheKey);
    if (cachedP1) {
      const cacheElapsedMs = Date.now() - phase1StartedAt;
      const enrichedCachedConsult = halakhicConsultation.active
        ? enrichHalakhicConsultationWithVerifiedSources(
            halakhicConsultation,
            cachedP1.preVerifiedSources || []
          )
        : undefined;
      return res.json(
        sanitizeHalakhicOutputFromExternalCitations(
          {
            ...cachedP1,
            detectedMetodologia: metodologia,
            metodologiasComplementarias: complementaryMethodologies,
            duracion,
            tonoHomiletico: p1ToneEval.requestedTone,
            resolvedTone: p1ToneEval.resolvedTone,
            toneAdvisory: p1ToneEval.advisoryReason,
            halakhicValidation,
            ...(enrichedCachedConsult ? { halakhicConsultation: enrichedCachedConsult } : {}),
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
        const enrichedCoalescedConsult = halakhicConsultation.active
          ? enrichHalakhicConsultationWithVerifiedSources(
              halakhicConsultation,
              coalescedResult?.preVerifiedSources || []
            )
          : undefined;
        return res.json(
          sanitizeHalakhicOutputFromExternalCitations(
            {
              ...coalescedResult,
              detectedMetodologia: metodologia,
              metodologiasComplementarias: complementaryMethodologies,
              duracion,
              tonoHomiletico: p1ToneEval.requestedTone,
              resolvedTone: p1ToneEval.resolvedTone,
              toneAdvisory: p1ToneEval.advisoryReason,
              halakhicValidation,
              ...(enrichedCoalescedConsult ? { halakhicConsultation: enrichedCoalescedConsult } : {}),
              ...(externalThinkerDetection.detected ? { externalThinkerDetection } : {}),
            },
            halakhicValidation
          )
        );
      } catch (inFlightErr: any) {
        if (inFlightErr instanceof GeminiHttpError) {
          return res
            .status(inFlightErr.status)
            .json({ error: inFlightErr.message, errorCode: inFlightErr.errorCode });
        }
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
- Si la consulta trata sobre el Mashíaj (Mesías), su naturaleza humana (no divina), por qué lo esperamos y cuál es su misión: selecciona fuentes como "Isaiah 11:1", "Isaiah 11:2", "Isaiah 11:9", "Isaiah 2:4", "Deuteronomy 30:3", "Sanhedrin 98a".${
          isHalelTopic
            ? `\n- Si la consulta trata sobre el Halel (הַלֵּל, Salmos 113–118, Halel Shalem vs. Jatsi Halel, Rosh Jódesh de 1 o 2 días según si el mes que termina tiene 29 días [Jaser] o 30 días [Malé], Pesaj, Sucot, Janucá, su institución profética o sus leyes halájicas): selecciona exclusivamente fuentes halájicas, talmúdicas y del Shulján Aruj como "Pesachim 117a", "Arakhin 10a", "Taanit 28b", "Shulchan Arukh, Orach Chayim 422:2", "Shulchan Arukh, Orach Chayim 427:1", "Mishneh Torah, Sanctification of the New Moon 8:4", "Mishneh Torah, Megillah and Chanukah 3:6". PROHIBIDO mencionar a Kant o filósofos externos.`
            : ''
        }${
          isPrayerPostureTopic
            ? `\n- Si la consulta trata sobre la postura corporal, la reverencia o por qué inclinarse en la plegaria (Keriá de inclinación / Hishtajavaiá / Kidá / pies juntos): NO te limites a Oraj Jaim 98:1 sobre la Kavaná general; DEBES incluir "Shulchan Arukh, Orach Chayim 95:1", "Shulchan Arukh, Orach Chayim 95:2", "Shulchan Arukh, Orach Chayim 113:1", "Shulchan Arukh, Orach Chayim 113:4", "Berakhot 28b", "Berakhot 34b", "Psalms 146:8" y "Ezekiel 1:7".`
            : ''
        }${
          isGratitudeTopic
            ? `\n- Si la consulta trata sobre la gratitud (*Hakarat HaTov*), *Modé Aní*, *Elohai Neshamá*, *Hodaiá* o *Mizmor LeTodá*: DEBES incluir fuentes canónicas específicas de gratitud como "Kitzur Shulchan Arukh 1:2", "Berakhot 60b", "Berakhot 35a", "Psalms 100:4" y "Bava Kamma 92b".`
            : ''
        }${
          isMourningTopic
            ? `\n- Dado que la consulta trata sobre leyes del Duelo (*Avelut* / *Shivá* / *Shloshim* / *Keriá* de vestidura) y/o el *Kadish*: selecciona EXCLUSIVAMENTE fuentes pertinentes al duelo y al Kadish en Sefaria como "Shulchan Arukh, Yoreh De'ah 340:1", "Shulchan Arukh, Yoreh De'ah 376:4", "Shulchan Arukh, Yoreh De'ah 380:1", "Shulchan Arukh, Yoreh De'ah 394:1", "Shulchan Arukh, Orach Chayim 55:1", "Moed Katan 27b", "Sanhedrin 104a", "Shabbat 119b" y "Sotah 49a". PROHIBIDO incluir "Orach Chayim 1:1", "Orach Chayim 113:1" o "Orach Chayim 113:4".`
            : ''
        }
${subFocus ? `- ENFOQUE ACOTADO SOBRE ESTUDIO ANTERIOR: El estudiante está acotando y ampliando la drashá base centrándose específicamente en «${subFocus}». Mantén el tema principal de la drashá anterior como columna vertebral y selecciona fuentes morfológicas y textuales que integren ese enfoque específico sin convertirlo en un estudio genérico.` : ''}
- Si la consulta trata sobre leyes (Halajá), cumplimiento práctico, el Shulján Aruj, duelo/Avelut y Kadish (Yoré Deá 340–403 y Oraj Jaim 55:1), rezos (Tefilá, Shemá, Amidá, Berajot, Talit, Tefilín, Netilat Yadáim, Birkat HaMazón), festividades (Shabat, Pésaj, Shavuot, Rosh Hashaná, Yom Kipur, Sucot, Janucá, Purim, Rosh Jódesh) o Kashrut (carne y leche / Basar BeJalav, Taarovet, Tevilat Kelim, Hagualá, Bedikat Tolaim, Bishul Akum), o comparaciones de costumbres dentro del judaísmo (Minhag y Núsaj: Sefardí / Edot HaMizraj vs. Ashkenazí vs. Jasídico vs. Teimaní, Mejaber vs. Ramá): DEBES incluir referencias exactas y PERTINENTES AL TEMA del **Shulján Aruj** (*Oraj Jaim* y/o *Yoré Deá*) en Sefaria (ej. para Avelut/Kadish: "Shulchan Arukh, Yoreh De'ah 340:1", "Shulchan Arukh, Yoreh De'ah 376:4", "Shulchan Arukh, Yoreh De'ah 380:1", "Shulchan Arukh, Yoreh De'ah 394:1", "Shulchan Arukh, Orach Chayim 55:1"; para otros temas su sección específica) y OMITIR por completo toda filosofía externa o comparativa así como simanim ajenos al tema.
- Si la metodología principal o alguna complementaria incluye "MESILAT_YESHARIM_SISTEMATICO": Incluye al menos 1 referencia exacta de "Mesillat Yesharim <capítulo>:<párrafo>" junto con sus versículos de apoyo en el Tanaj o Pirkei Avot.
- Si incluye "PIRKE_AVOT_EXEGETICO": Incluye la Mishná exacta de "Pirkei Avot <capítulo>:<mishná>".
- Si incluye "MUSAR_TRANSFORMATIVO": Incluye la fuente ética precisa en "Pirkei Avot", "Mesillat Yesharim", "Proverbs", "Psalms" o el Tanaj.
- Si incluye "WISSENSCHAFT_DES_JUDENTUMS" o "FILOLOGIA_LITURGICA_WISSENSCHAFT": Incluye las fuentes talmúdicas, midráshicas y bíblicas exactas donde se debate el concepto histórico consultado por el usuario (PROHIBIDO seleccionar "Sotah 40a" o mencionar "Modim" a menos que la consulta pregunte explícitamente por Modim).
- Si incluye "EVOLUCION_CONCEPTUAL": Selecciona referencias canónicas en Sefaria que representen la evolución del concepto consultado desde la Torá y Jazal hasta el Musar y la Jasidut.
- Si incluye "FILOSOFIA_CONTRASTIVA": Selecciona las fuentes canónicas internas de la Torá en Sefaria que mejor dialogan y contrastan con la fuente externa consultada (Platón, Cicerón, Kant, Budismo, Nirvana, Valhalla), incluyendo siempre referencias sobre universalidad vs. especificidad del mandamiento ("Proverbs 6:23", "Yoma 85b", "Sanhedrin 56a", "Deuteronomy 6:18") y fuentes internas vs. externas ("Lamentations Rabbah 2:13", "Kiddushin 31a", "Deuteronomy 30:14").
- REGLA ESTRICTA ANTI-PLANTILLAS Y ANTI-PARÁFRASIS: Responde EXCLUSIVAMENTE sobre el tema de "consulta_del_usuario". JAMÁS repitas el fraseo disyuntivo o conversacional de la pregunta del usuario en 'title' ni como relleno en las claves teológicas. JAMÁS menciones "Modim", "Modim anajnu", "Oraj Jaim 113:1/113:4" (inclinaciones de la Amidá) ni "Yotzer Bereshit" a menos que el usuario haya preguntado explícitamente sobre esos temas.

CUATRO CLAVES TEOLÓGICAS OBLIGATORIAS QUE DEBES ADAPTAR AL TEMA Y METODOLOGÍA:
1. Paralelismo Textual / Intertextualidad Canónica (para estudios comparativos: Distinción entre Fuentes Internas de la Torá y Fuentes Externas según Eijá Rabá 2:13 y Kidushín 31a).
2. Elección Gramatical y Filológica (Shorashim, Binyanim, Targum Onkelos, Rashi).
3. Concepto Técnico en Jazal y Rishonim (para estudios comparativos: Universalidad frente a Especificidad del Mandamiento en Proverbios 6:23, Yoma 85b, Deuteronomio 6:18 y las 7 Leyes de Noé en Sanhedrín 56a / Hiljot Teshuvá 3:5).
4. Dimensión Interior (Interiorización del mandato en Deuteronomio 30:14, Pirké Avot 2:4 y Rambam en Shemoná Perakim cap. 6).`;

        const forcedThinkerPromptDirective = halakhicValidation.externalPhilosophyInjectionDisabled
          ? halakhicConsultation.active
            ? `${halakhicValidation.systemPromptGuard}${halakhicConsultation.systemPromptDirective}`
            : halakhicValidation.systemPromptGuard
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
                        required: [
                          'title',
                          'explanation',
                          'verbAnalysis',
                          'watchmakerRefutation',
                          'liturgicalEcho',
                        ],
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
                        required: [
                          'title',
                          'explanation',
                          'sefiraConnection',
                          'prooftext',
                          'liturgicalStructure',
                        ],
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
                        theologicalImplication: {
                          type: Type.STRING,
                          description: 'Implicación teológica o ética del término hebreo',
                        },
                      },
                      required: [
                        'hebrewWord',
                        'root',
                        'rootMeaning',
                        'binyan',
                        'tense',
                        'theologicalImplication',
                      ],
                    },
                  },
                  sefariaReferences: {
                    type: Type.ARRAY,
                    description: 'Referencias canónicas exactas para Sefaria',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ref: {
                          type: Type.STRING,
                          description:
                            'Referencia en formato Sefaria exacto (ej: Pirkei Avot 1:14, Mesillat Yesharim 2:1, Genesis 27:35)',
                        },
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
          { timeoutMs: 52000, thinkingLevel: ThinkingLevel.LOW }
        );

        const stage1MorphologyMs = Date.now() - llmStartedAt;
        const parsed = sanitizeStrictJewishObject(
          parseGeminiJsonSafely(response.text, '/api/analyze-roots')
        );
        parsed.detectedMetodologia = metodologia;
        parsed.metodologiasComplementarias = complementaryMethodologies;
        parsed.duracion = duracion;
        parsed.tonoHomiletico = p1ToneEval.requestedTone;
        parsed.resolvedTone = p1ToneEval.resolvedTone;
        parsed.toneAdvisory = p1ToneEval.advisoryReason;

        if (halakhicConsultation.active && !isGratitudeTopic && !isPrayerPostureTopic) {
          parsed.sefariaReferences = mergeHalakhicRefsWithPredictions(
            halakhicConsultation,
            parsed.sefariaReferences,
            6
          );
        } else if (externalThinkerDetection.detected) {
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
        parsed.halakhicValidation = halakhicValidation;
        if (halakhicConsultation.active) {
          parsed.halakhicConsultation = enrichHalakhicConsultationWithVerifiedSources(
            halakhicConsultation,
            preVerifiedSources
          );
        }
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
      } catch (p1Err: any) {
        logPipelineGeminiDiagnostic('/api/analyze-roots', p1Err, GEMINI_HYDROGEN_MODEL);
        const classified = classifyGeminiRouteError(p1Err);
        throw new GeminiHttpError(classified.status, classified.code, classified.userMessage);
      } finally {
        inFlightPhase1ServerRequests.delete(phase1CacheKey);
      }
    })();

    inFlightPhase1ServerRequests.set(phase1CacheKey, p1ExecutionPromise);
    try {
      const finalP1Payload = await p1ExecutionPromise;
      return res.json(finalP1Payload);
    } catch (err: any) {
      const classified = classifyGeminiRouteError(err);
      return res.status(classified.status).json({
        error: classified.userMessage,
        errorCode: classified.code,
      });
    }
  });
}

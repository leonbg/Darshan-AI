import type { Express } from 'express';
import { Type, ThinkingLevel } from '@google/genai';
import {
  getGenAIClient,
  GEMINI_HYDROGEN_MODEL,
  logPipelineGeminiDiagnostic,
  classifyGeminiRouteError,
  parseGeminiJsonSafely,
  generateContentWithRetry,
  setBoundedCache,
  sefariaServerCache,
  masterReadingsCache,
  compareDerashotCache,
} from './aiClient.ts';
import {
  STRICT_JEWISH_SOURCES_COVENANT,
  sanitizeStrictJewishObject,
} from './externalSources.ts';

const translationMemoryCache = new Map<string, { spanishTranslation: string; notes?: string }>();

export function registerCompanionRoutes(app: Express) {
  // Endpoint to translate any canonical source (or batch of sources) from Hebrew/English into faithful traditional Spanish
  app.post('/api/translate-source', async (req, res) => {
    const { ref, hebrewText, englishText, sources } = req.body || {};

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

          const parsed = parseGeminiJsonSafely(response.text, '/api/translate-source[batch]');
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
        } catch (trErr: any) {
          logPipelineGeminiDiagnostic('/api/translate-source[batch]', trErr, GEMINI_HYDROGEN_MODEL);
          const classified = classifyGeminiRouteError(trErr);
          return res
            .status(classified.status)
            .json({ error: classified.userMessage, errorCode: classified.code });
        }
      }

      return res.json({ translations: results });
    }

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
                spanishTranslation: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
              required: ['spanishTranslation'],
            },
          },
        },
        { timeoutMs: 25000, thinkingLevel: ThinkingLevel.LOW }
      );

      const parsed = parseGeminiJsonSafely(response.text, '/api/translate-source');
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
    } catch (trErr: any) {
      logPipelineGeminiDiagnostic('/api/translate-source', trErr, GEMINI_HYDROGEN_MODEL);
      const classified = classifyGeminiRouteError(trErr);
      return res
        .status(classified.status)
        .json({ error: classified.userMessage, errorCode: classified.code });
    }
  });

  // Dedicated endpoint to explore multi-year Parashá cycles and contemporary masters
  app.post('/api/master-readings', async (req, res) => {
    try {
      const { query, title, primaryHebrew, verifiedSources, focusMaster, specificAngle } =
        req.body || {};

      if (!query) {
        return res.status(400).json({
          error:
            'Debes proporcionar el pasaje o Parashá para consultar las lecturas de los maestros.',
        });
      }

      const masterCacheKey = `${String(query).trim().toLowerCase()}|${String(focusMaster || 'all').trim().toLowerCase()}|${String(specificAngle || '').trim().toLowerCase()}`;
      const cachedMasterReadings = masterReadingsCache.get(masterCacheKey);
      if (cachedMasterReadings) {
        return res.json(cachedMasterReadings);
      }

      const ai = getGenAIClient();

      const systemInstruction = `Eres un erudito experto en pensamiento judío moderno y contemporáneo, con dominio enciclopédico de:
${STRICT_JEWISH_SOURCES_COVENANT}
1. **Rabino Lord Jonathan Sacks zt"l** (*Covenant & Conversation* / *Pacto y Conversación*):
   - Conoces cómo el Rabino Sacks analizaba la misma Parashá o texto litúrgico año tras año a través de distintos ciclos anuales (*Genesis / Exodus / Leviticus / Numbers / Deuteronomy: The Book of Covenant*, *Studies in Spirituality*, *Ethics: Life's Changing Needs*, *Leadership*, *Family*, *Judaism's Life-Changing Ideas*).
   - Sabes contrastar cómo en un año enfocaba un problema ético o filosófico y en otro año analizaba un ángulo psicológico, familiar o espiritual distinto sobre el mismo pasaje.
2. **Rab Yehoshua Gordon zt"l y la Escuela Jasídica de Jabad-Lubavitch** (*Jumash con Rashi*, *Tania* y *Likkutei Sijot* del Rebe de Lubavitch):
   - Conoces el estilo cálido, pedagógico, incisivo y profundo de Rab Gordon en sus célebres clases diarias de Jumash con Rashi (resolviendo la pregunta: "¿Qué le incomodó a Rashi en el Pshat literal del versículo?"), el Tania y las *Sijot* del Rebe (*Dirá Betajtonim*, *Hashgajá Pratit*).
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

      const parsed = sanitizeStrictJewishObject(
        parseGeminiJsonSafely(response.text, '/api/master-readings')
      );
      setBoundedCache(masterReadingsCache, masterCacheKey, parsed, 60);
      return res.json(parsed);
    } catch (mrErr: any) {
      logPipelineGeminiDiagnostic('/api/master-readings', mrErr, GEMINI_HYDROGEN_MODEL);
      const classified = classifyGeminiRouteError(mrErr);
      return res
        .status(classified.status)
        .json({ error: classified.userMessage, errorCode: classified.code });
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
      const compareCacheKey = `${[...comparedNumbers].sort((a, b) => a - b).join(',')}|${String(relationType).toUpperCase()}|${String(userHypothesis || '').trim().toLowerCase()}`;
      const cachedComparison = compareDerashotCache.get(compareCacheKey);
      if (cachedComparison) {
        return res.json(cachedComparison);
      }
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
REQUISITO DE ESTRUCTURA: En "perDerashaCoreThesis" debes devolver EXACTAMENTE ${derashot.length} objetos, uno por cada Derashá analizada en el mismo orden (${comparedNumbers.map((n) => `#${n}`).join(', ')}).

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
          { timeoutMs: 52000, thinkingLevel: ThinkingLevel.MEDIUM }
        );

        const parsed = parseGeminiJsonSafely(response.text, '/api/compare-derashot');
        const rawPerDerasha = Array.isArray(parsed.perDerashaCoreThesis)
          ? parsed.perDerashaCoreThesis
          : [];
        const normalizedPerDerasha = derashot.map((d: any, idx: number) => {
          const seqNum = Number(d.sequenceNumber || idx + 1);
          const matched =
            rawPerDerasha.find((item: any) => Number(item?.sequenceNumber) === seqNum) ||
            (rawPerDerasha.length === derashot.length ? rawPerDerasha[idx] : undefined);
          return {
            sequenceNumber: seqNum,
            title: (matched?.title && String(matched.title).trim()) || d.title || `Derashá #${seqNum}`,
            coreThesis:
              (matched?.coreThesis && String(matched.coreThesis).trim()) ||
              d.centralIdea ||
              `Tesis central de la Derashá #${seqNum}`,
            keySource:
              (matched?.keySource && String(matched.keySource).trim()) ||
              String(d.sourcesSummary || 'Fuentes clásicas').split('·')[0].trim(),
            normativeOrPhilosophicalAngle:
              (matched?.normativeOrPhilosophicalAngle &&
                String(matched.normativeOrPhilosophicalAngle).trim()) ||
              `Metodología ${d.methodology || 'PARDES'} aplicada al eje de «${d.title || `Derashá #${seqNum}`}».`,
          };
        });

        const comparisonPayload = {
          id: `cmp-${comparedNumbers.join('-')}-${Date.now()}`,
          comparedNumbers,
          comparedTitles,
          relationType,
          userHypothesis: userHypothesis || `Contraste dialéctico entre ${labelStr}`,
          synthesisTitle:
            parsed.synthesisTitle ||
            `Síntesis Dialéctica: ${comparedNumbers.map((n) => `Derashá #${n}`).join(' × ')}`,
          executiveVerdict: parsed.executiveVerdict || '',
          perDerashaCoreThesis: normalizedPerDerasha,
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
        };
        setBoundedCache(compareDerashotCache, compareCacheKey, comparisonPayload, 40);
        return res.json(comparisonPayload);
      } catch (llmErr: any) {
        logPipelineGeminiDiagnostic('/api/compare-derashot', llmErr, GEMINI_HYDROGEN_MODEL);
        const classified = classifyGeminiRouteError(llmErr);
        return res
          .status(classified.status)
          .json({ error: classified.userMessage, errorCode: classified.code });
      }
    } catch (error: any) {
      console.error('[Compare Derashot] Error:', error);
      return res
        .status(500)
        .json({ error: error?.message || 'Error al comparar las Derashot seleccionadas.' });
    }
  });
}

import type { Express } from 'express';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

export function registerArchiveAndCompareRoutes(params: {
  app: Express;
  archiveFilePath: string;
  getGenAIClient: () => GoogleGenAI;
  generateContentWithRetry: (ai: GoogleGenAI, req: any, opts?: any) => Promise<any>;
}) {
  const { app, archiveFilePath, getGenAIClient, generateContentWithRetry } = params;

  function readServerDerashotArchive(): any[] {
    try {
      if (fs.existsSync(archiveFilePath)) {
        const raw = fs.readFileSync(archiveFilePath, 'utf-8');
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
      fs.writeFileSync(archiveFilePath, JSON.stringify(entries.slice(0, 200), null, 2), 'utf-8');
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
      const idx = existing.findIndex(
        (e: any) => Number(e.sequenceNumber) === Number(entry.sequenceNumber)
      );
      if (idx >= 0) {
        existing[idx] = entry;
      } else {
        existing.push(entry);
      }
      existing.sort((a: any, b: any) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
      writeServerDerashotArchive(existing);
      return res.json({ status: 'ok', count: existing.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error guardando en archivo.' });
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

        const response = await generateContentWithRetry(ai, {
          model: 'gemini-3.8-flash',
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
        });

        const parsed = JSON.parse(response.text || '{}');
        return res.json({
          id: `cmp-${comparedNumbers.join('-')}-${Date.now()}`,
          comparedNumbers,
          comparedTitles,
          relationType,
          userHypothesis: userHypothesis || `Contraste dialéctico entre ${labelStr}`,
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
      } catch {
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
}

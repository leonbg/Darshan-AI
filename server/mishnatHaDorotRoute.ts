import type { Express } from 'express';
import { Type, ThinkingLevel } from '@google/genai';
import {
  getGenAIClient,
  GEMINI_HYDROGEN_MODEL,
  logPipelineGeminiDiagnostic,
  parseGeminiJsonSafely,
  generateContentWithRetry,
  setBoundedCache,
} from './aiClient.ts';
import { normalizeSefariaRef } from './sefariaService.ts';
import { STRICT_JEWISH_SOURCES_COVENANT } from './externalSources.ts';
import {
  HALAKHIC_GENERATION_ORDER,
  classifySefariaLinkCandidate,
  sortMishnatHaDorotChronologically,
  type ClassifiedSefariaLinkCandidate,
} from '../src/utils/mishnatHaDorotClassifier.ts';
import type { HalakhicGenerationEra, MishnatHaDorotQuote } from '../src/types.ts';

interface InputRefItem {
  ref: string;
  simanSeifLabel?: string;
  topicLabel?: string;
}

interface CandidateWithSource extends ClassifiedSefariaLinkCandidate {
  sourceShulchanArukhRef: string;
  sourceSimanSeifLabel: string;
  sourceTopicLabel?: string;
}

const sefariaLinksCache = new Map<string, ClassifiedSefariaLinkCandidate[]>();
const inFlightLinksRequests = new Map<string, Promise<ClassifiedSefariaLinkCandidate[]>>();
const mishnatHaDorotCache = new Map<
  string,
  {
    quotes: MishnatHaDorotQuote[];
    generationsRepresented: HalakhicGenerationEra[];
    sourceRefsConsulted: string[];
    fetchedFromSefariaCount: number;
  }
>();

async function fetchClassifiedLinksForShulchanArukhRef(
  rawRef: string
): Promise<ClassifiedSefariaLinkCandidate[]> {
  const normalizedRef = normalizeSefariaRef(rawRef);
  const cacheKey = normalizedRef.toLowerCase();
  const cached = sefariaLinksCache.get(cacheKey);
  if (cached) return cached;

  const existingInFlight = inFlightLinksRequests.get(cacheKey);
  if (existingInFlight) return existingInFlight;

  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `https://www.sefaria.org/api/links/${encodeURIComponent(
        normalizedRef
      )}?with_text=1`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DarshanAI/1.0',
          Connection: 'keep-alive',
        },
      });
      if (!response.ok) {
        return [];
      }
      const rawLinks: any = await response.json();
      if (!Array.isArray(rawLinks)) {
        return [];
      }

      const classified: ClassifiedSefariaLinkCandidate[] = [];
      const seenRefs = new Set<string>();
      for (const link of rawLinks) {
        const candidate = classifySefariaLinkCandidate(link);
        if (!candidate) continue;
        const rKey = candidate.ref.toLowerCase();
        if (seenRefs.has(rKey)) continue;
        seenRefs.add(rKey);
        classified.push(candidate);
      }

      setBoundedCache(sefariaLinksCache, cacheKey, classified, 150);
      return classified;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      inFlightLinksRequests.delete(cacheKey);
    }
  })();

  inFlightLinksRequests.set(cacheKey, promise);
  return promise;
}

function selectDiverseGenerationalCandidates(
  allCandidates: CandidateWithSource[],
  eraFilter: HalakhicGenerationEra | 'ALL',
  maxTotal: number
): CandidateWithSource[] {
  const filtered =
    eraFilter === 'ALL'
      ? allCandidates
      : allCandidates.filter((c) => c.generationEra === eraFilter);

  // Sort by priority desc, preferring entries that have longer substantial text
  const sorted = [...filtered].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.hebrewText.length - a.hebrewText.length;
  });

  // Keep at most one candidate per (sourceShulchanArukhRef + authorityName) so we don't repeat 4 consecutive Mishnah Berurah seif-ketanim on the same law
  const bestPerSourceAuthority: CandidateWithSource[] = [];
  const seenSourceAuth = new Set<string>();
  const seenGlobalRef = new Set<string>();
  for (const cand of sorted) {
    const refKey = cand.ref.toLowerCase();
    const saKey = `${cand.sourceShulchanArukhRef.toLowerCase()}::${cand.authorityName.toLowerCase()}`;
    if (seenGlobalRef.has(refKey) || seenSourceAuth.has(saKey)) continue;
    seenGlobalRef.add(refKey);
    seenSourceAuth.add(saKey);
    bestPerSourceAuthority.push(cand);
  }

  if (eraFilter !== 'ALL') {
    return bestPerSourceAuthority.slice(0, maxTotal);
  }

  // Round-robin across the 5 halakhic generations to guarantee a balanced multi-generation chain
  const buckets = new Map<HalakhicGenerationEra, CandidateWithSource[]>();
  for (const era of HALAKHIC_GENERATION_ORDER) {
    buckets.set(
      era,
      bestPerSourceAuthority.filter((c) => c.generationEra === era)
    );
  }

  const picked: CandidateWithSource[] = [];
  const pickedRefs = new Set<string>();
  let round = 0;
  while (picked.length < maxTotal && round < 4) {
    let addedInRound = false;
    for (const era of HALAKHIC_GENERATION_ORDER) {
      if (picked.length >= maxTotal) break;
      const list = buckets.get(era) || [];
      const item = list[round];
      if (item && !pickedRefs.has(item.ref.toLowerCase())) {
        picked.push(item);
        pickedRefs.add(item.ref.toLowerCase());
        addedInRound = true;
      }
    }
    if (!addedInRound) break;
    round += 1;
  }

  // Fill any remaining capacity up to maxTotal
  for (const item of bestPerSourceAuthority) {
    if (picked.length >= maxTotal) break;
    if (!pickedRefs.has(item.ref.toLowerCase())) {
      picked.push(item);
      pickedRefs.add(item.ref.toLowerCase());
    }
  }

  return picked;
}

async function translateAndContextualizeQuotes(
  selected: CandidateWithSource[],
  studyQuery?: string
): Promise<Map<string, { spanishTranslation: string; rulingEvolutionNote: string }>> {
  const resultMap = new Map<
    string,
    { spanishTranslation: string; rulingEvolutionNote: string }
  >();
  if (selected.length === 0) return resultMap;

  try {
    const ai = getGenAIClient();
    const compactInputs = selected.map((c) => ({
      ref: c.ref,
      authorityName: c.authorityName,
      generationLabel: c.generationLabel,
      sourceSimanSeifLabel: c.sourceSimanSeifLabel,
      hebrewExcerpt: c.hebrewText.slice(0, 620),
      englishExcerpt: (c.englishText || '').slice(0, 480),
    }));

    const systemInstruction = `Eres un erudito posék y traductor rabínico especializado en la cadena halájica generacional («Mishnat HaDorot»: Jazal → Rishonim → Nosei Keilim/Ajaronim Tempranos → Ajaronim Clásicos → Poskim Contemporáneos).
${STRICT_JEWISH_SOURCES_COVENANT}
Para cada cita real extraída de Sefaria que suplementa el Shulján Aruj:
1. "spanishTranslation": Traduce fiel y claramente al español el contenido normativo del pasaje hebreo/inglés (máx. 2–3 oraciones precisas, usando terminología halájica tradicional en español como Hashem, Mitzvá, Simán, Seif, Berajá). Si es un comentario extenso, resume fielmente su dictamen central sin inventar datos ajenos al texto.
2. "rulingEvolutionNote": En 1 oración breve y sustantiva, explica el aporte específico de esta generación respecto al Shulján Aruj (p. ej., fuente talmúdica originaria, precisión entre Mejaber/Ramá, detalle práctico de Mishná Berurá o Kaf HaJaim, o aplicación en responsa contemporánea).
PROHIBIDO introducir filosofía externa o no judía.`;

    const prompt = `Traduce y contextualiza el aporte generacional de las siguientes ${compactInputs.length} fuentes reales de Sefaria${
      studyQuery ? ` (consulta del estudiante: "${studyQuery}")` : ''
    }:
${JSON.stringify(compactInputs, null, 2)}

Devuelve JSON con el arreglo "items" conteniendo { "ref", "spanishTranslation", "rulingEvolutionNote" } para cada referencia.`;

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
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ref: { type: Type.STRING },
                    spanishTranslation: { type: Type.STRING },
                    rulingEvolutionNote: { type: Type.STRING },
                  },
                  required: ['ref', 'spanishTranslation', 'rulingEvolutionNote'],
                },
              },
            },
            required: ['items'],
          },
        },
      },
      { timeoutMs: 24000, thinkingLevel: ThinkingLevel.LOW }
    );

    const parsed = parseGeminiJsonSafely(response.text, '/api/mishnat-hadorot');
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    for (const item of items) {
      if (item?.ref && item?.spanishTranslation) {
        resultMap.set(String(item.ref).toLowerCase(), {
          spanishTranslation: String(item.spanishTranslation).trim(),
          rulingEvolutionNote: String(item.rulingEvolutionNote || '').trim(),
        });
      }
    }
  } catch (err: any) {
    logPipelineGeminiDiagnostic('/api/mishnat-hadorot', err, GEMINI_HYDROGEN_MODEL);
    // Graceful degradation: caller still renders verified Sefaria Hebrew + English excerpts
  }

  return resultMap;
}

export function registerMishnatHaDorotRoute(app: Express): void {
  app.post('/api/mishnat-hadorot', async (req, res) => {
    try {
      const body = req.body || {};
      const rawRefs: InputRefItem[] = Array.isArray(body.refs) ? body.refs : [];
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const rawEra = String(body.eraFilter || 'ALL').toUpperCase().trim();
      const eraFilter: HalakhicGenerationEra | 'ALL' = (
        ['CHAZAL', 'RISHONIM', 'EARLY_ACHARONIM', 'CLASSIC_ACHARONIM', 'CONTEMPORARY_POSKIM'].includes(
          rawEra
        )
          ? rawEra
          : 'ALL'
      ) as HalakhicGenerationEra | 'ALL';

      const normalizedInputRefs = rawRefs
        .map((r) => ({
          ref: normalizeSefariaRef(r?.ref || ''),
          simanSeifLabel:
            String(r?.simanSeifLabel || '').trim() ||
            normalizeSefariaRef(r?.ref || '').replace(/^Shulchan Arukh,\s*/i, ''),
          topicLabel: r?.topicLabel ? String(r.topicLabel).trim() : undefined,
        }))
        .filter((r) => Boolean(r.ref))
        .slice(0, 4);

      if (normalizedInputRefs.length === 0) {
        return res.status(400).json({
          error: 'Debes proporcionar al menos una referencia del Shulján Aruj para consultar Mishnat HaDorot.',
        });
      }

      const cacheKey = `${normalizedInputRefs
        .map((r) => r.ref.toLowerCase())
        .sort()
        .join('|')}::${eraFilter}`;
      const cachedPayload = mishnatHaDorotCache.get(cacheKey);
      if (cachedPayload) {
        return res.json({
          ...cachedPayload,
          cacheHit: true,
        });
      }

      // Fetch Sefaria links across all consulted Shulchan Arukh simanim in parallel
      const linksPerRef = await Promise.all(
        normalizedInputRefs.map(async (input) => ({
          input,
          links: await fetchClassifiedLinksForShulchanArukhRef(input.ref),
        }))
      );

      const allCandidates: CandidateWithSource[] = [];
      for (const group of linksPerRef) {
        for (const cand of group.links) {
          allCandidates.push({
            ...cand,
            sourceShulchanArukhRef: group.input.ref,
            sourceSimanSeifLabel: group.input.simanSeifLabel,
            sourceTopicLabel: group.input.topicLabel,
          });
        }
      }

      const maxQuotes = eraFilter === 'ALL' ? 8 : 6;
      const selected = selectDiverseGenerationalCandidates(allCandidates, eraFilter, maxQuotes);

      const translationsMap = await translateAndContextualizeQuotes(selected, query);

      const quotes: MishnatHaDorotQuote[] = sortMishnatHaDorotChronologically(
        selected.map((c, idx) => {
          const translated = translationsMap.get(c.ref.toLowerCase());
          const fallbackSpanish = c.englishText
            ? `Referencia canónica (${c.ref}): ${c.englishText.slice(0, 420)}`
            : `Dictamen en hebreo de ${c.authorityName} (${c.ref}) vinculado directamente en Sefaria a ${c.sourceSimanSeifLabel}.`;
          return {
            id: `mhd-${c.generationEra.toLowerCase()}-${idx}-${c.ref
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .slice(0, 32)}`,
            sourceShulchanArukhRef: c.sourceShulchanArukhRef,
            sourceSimanSeifLabel: c.sourceSimanSeifLabel,
            generationEra: c.generationEra,
            generationLabel: c.generationLabel,
            periodLabel: c.periodLabel,
            authorityName: c.authorityName,
            ref: c.ref,
            heRef: c.heRef,
            hebrewText: c.hebrewText,
            ...(c.englishText ? { englishText: c.englishText } : {}),
            spanishTranslation: translated?.spanishTranslation || fallbackSpanish,
            ...(translated?.rulingEvolutionNote
              ? { rulingEvolutionNote: translated.rulingEvolutionNote }
              : {}),
            sefariaUrl: c.sefariaUrl,
            verifiedFromSefaria: true,
          };
        })
      );

      const generationsRepresented = Array.from(
        new Set(quotes.map((q) => q.generationEra))
      ) as HalakhicGenerationEra[];

      const responsePayload = {
        quotes,
        generationsRepresented,
        sourceRefsConsulted: normalizedInputRefs.map((r) => r.ref),
        fetchedFromSefariaCount: allCandidates.length,
      };

      if (quotes.length > 0) {
        setBoundedCache(mishnatHaDorotCache, cacheKey, responsePayload, 80);
      }

      return res.json({
        ...responsePayload,
        cacheHit: false,
      });
    } catch (error: any) {
      console.error('[Mishnat HaDorot] Error:', error?.message || error);
      return res.status(500).json({
        error: 'No se pudieron recuperar los dictámenes generacionales de Mishnat HaDorot en este momento.',
      });
    }
  });
}

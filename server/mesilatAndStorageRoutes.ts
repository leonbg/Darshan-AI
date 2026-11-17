import type express from 'express';
import fs from 'fs';
import path from 'path';
import { Type, ThinkingLevel } from '@google/genai';
import {
  getGenAIClient,
  GEMINI_HYDROGEN_MODEL,
  generateContentWithRetry,
  parseGeminiJsonSafely,
  setBoundedCache,
  clearAllPipelineCaches,
} from './aiClient.ts';
import {
  PRE_SEEDED_CANONICAL_SOURCES,
  fetchSingleServerSefariaSource,
  stripServerHtml,
} from './sefariaService.ts';

// Ladder of Mesilat Yesharim (Rabbi Moshe Chaim Luzzatto - Ramchal)
const MESILAT_MIDDOT_CATALOG: Array<{
  step: number;
  chapter: number;
  middahNameEs: string;
  middahNameHe: string;
  defaultParagraphs: number;
  fallbackDef: string;
  fallbackObstacle: string;
  fallbackAction: string;
  fallbackInsight: string;
}> = [
  {
    step: 1,
    chapter: 1,
    middahNameEs: 'Jovat HaAdam / El Deber del Hombre en su Mundo',
    middahNameHe: 'חוֹבַת הָאָדָם בְּעוֹלָמוֹ',
    defaultParagraphs: 4,
    fallbackDef: 'Comprender con claridad cuál es nuestro propósito existencial y hacia dónde debemos dirigir nuestras fuerzas cada día.',
    fallbackObstacle: 'La rutina mecánica y la distracción constante del mundo material que nos hacen olvidar para qué fuimos creados.',
    fallbackAction: 'Dedica hoy 60 segundos en silencio antes de iniciar tus tareas para preguntarte: ¿Qué sentido trascendente tiene lo que haré hoy?',
    fallbackInsight: 'Como destacan Chabad.org y Aish Latino sobre el Ramjal: nadie construye un edificio sin planos; el primer paso del Musar es saber quién eres y hacia dónde caminas.',
  },
  {
    step: 2,
    chapter: 2,
    middahNameEs: 'Zehirut / Cuidado y Vigilancia Espiritual',
    middahNameHe: 'מִדַּת הַזְּהִירוּת',
    defaultParagraphs: 5,
    fallbackDef: 'Ser observador y consciente de los propios actos, palabras y pensamientos, sin caminar a ciegas por la vida.',
    fallbackObstacle: 'El piloto automático cotidiano: actuar por impulso o costumbre sin detenerse a evaluar el impacto de nuestras acciones.',
    fallbackAction: 'Al final de la tarde, haz un breve balance (Jeshbón HaNéfesh) de 2 minutos identificando una decisión acertada y una que puedas mejorar mañana.',
    fallbackInsight: 'El Ramjal compara a quien vive sin Zehirut con un ciego que camina al borde de un río; encender la conciencia interior transforma inmediatamente nuestra conducta.',
  },
  {
    step: 3,
    chapter: 6,
    middahNameEs: 'Zerizut / Diligencia y Entusiasmo',
    middahNameHe: 'מִדַּת הַזְּרִיזוּת',
    defaultParagraphs: 4,
    fallbackDef: 'No postergar el bien ni las responsabilidades espirituales o éticas una vez que sabemos que son correctas.',
    fallbackObstacle: 'La pesadez interior (Kavedut) y la procrastinación que siempre buscan una excusa para dejar el cambio para mañana.',
    fallbackAction: 'Elige una acción positiva o llamada pendiente que hayas estado posponiendo y realízala en los primeros 15 minutos tras leer este shot.',
    fallbackInsight: 'La enseñanza jasídica y de Musar subraya que el entusiasmo externo (acciones ágiles) termina despertando el entusiasmo interno del corazón.',
  },
  {
    step: 4,
    chapter: 10,
    middahNameEs: 'Nekiyut / Limpieza e Integridad Moral',
    middahNameHe: 'מִדַּת הַנְּקִיּוּת',
    defaultParagraphs: 4,
    fallbackDef: 'Purificar la conducta y las intenciones incluso de aquellas faltas sutiles que la gente suele racionalizar o justificar.',
    fallbackObstacle: 'El autoengaño y las pequeñas concesiones éticas ("todo el mundo lo hace" o "no es tan grave").',
    fallbackAction: 'Cuida hoy escrupulosamente tu lenguaje y tus tratos: evita cualquier exageración, media verdad o palabra que disminuya a otro.',
    fallbackInsight: 'La verdadera libertad moral llega cuando no necesitamos justificar nuestras acciones porque están limpias incluso en sus detalles más finos.',
  },
  {
    step: 5,
    chapter: 13,
    middahNameEs: 'Perishut / Moderación y Autodominio',
    middahNameHe: 'מִדַּת הַפְּרִישׁוּת',
    defaultParagraphs: 4,
    fallbackDef: 'Ejercer dominio consciente incluso sobre lo permitido para no volvernos esclavos de nuestros impulsos ni del exceso.',
    fallbackObstacle: 'La cultura de la gratificación instantánea que nos empuja a consumir todo lo disponible sin filtro.',
    fallbackAction: 'Haz hoy una pausa consciente antes de revisar el teléfono o comer por ansiedad, demostrando que tú gobiernas tus hábitos.',
    fallbackInsight: 'Según el Ramjal, Perishut no es ascetismo triste, sino soberanía interior: usar el mundo material con propósito sin quedar atrapado en él.',
  },
  {
    step: 6,
    chapter: 16,
    middahNameEs: 'Tahará / Pureza de Intención y Pensamiento',
    middahNameHe: 'מִדַּת הַטָּהֳרָה',
    defaultParagraphs: 3,
    fallbackDef: 'Alinear el corazón y la mente para que las acciones buenas se hagan por amor a la verdad y no por ego o aplauso.',
    fallbackObstacle: 'La búsqueda constante de validación externa, prestigio o reconocimiento al hacer algo noble.',
    fallbackAction: 'Realiza hoy un favor o acto de bondad de manera totalmente anónima o discreta, sin comentarlo con nadie.',
    fallbackInsight: 'Cuando la acción es limpia (Nekiyut) y la motivación también se refina (Tahará), el ser humano experimenta una paz interior inquebrantable.',
  },
  {
    step: 7,
    chapter: 19,
    middahNameEs: 'Jasidut / Bondad Amorosa y Devoción',
    middahNameHe: 'מִדַּת הַחֲסִידוּת',
    defaultParagraphs: 4,
    fallbackDef: 'Ir más allá de la obligación mínima (Lifnim Mishurat HaDin), buscando activamente cómo beneficiar al prójimo y honrar al Creador.',
    fallbackObstacle: 'La mentalidad minimalista de "ya cumplí con lo estricto" que enfría las relaciones humanas y espirituales.',
    fallbackAction: 'En una conversación familiar o laboral hoy, da un paso extra de empatía, paciencia o generosidad que no te hayan pedido.',
    fallbackInsight: 'Tanto el Ramjal como la filosofía de Jabad y Aish enseñan que el Jasid es quien actúa por amor expansivo, buscando siempre qué más puede aportar.',
  },
  {
    step: 8,
    chapter: 22,
    middahNameEs: 'Anavá / Humildad Auténtica',
    middahNameHe: 'מִדַּת הָעֲנָוָה',
    defaultParagraphs: 4,
    fallbackDef: 'Reconocer nuestros talentos como dones recibidos para servir, sin sentirnos superiores a nadie.',
    fallbackObstacle: 'La arrogancia sutil o la necesidad de tener siempre la última palabra en discusiones.',
    fallbackAction: 'Escucha hoy atentamente la opinión de otra persona sin interrumpirla y reconoce sinceramente un punto valioso en lo que dice.',
    fallbackInsight: 'La humildad en el Mesilat Yesharim no es subestimarse, sino conocer nuestro verdadero lugar y liberar el alma del peso del ego.',
  },
  {
    step: 9,
    chapter: 24,
    middahNameEs: 'Yirat Jet / Reverencia Moral',
    middahNameHe: 'מִדַּת יִרְאַת הַחֵטְא',
    defaultParagraphs: 3,
    fallbackDef: 'Tener una sensibilidad constante para no dañar nuestra conexión espiritual ni herir la dignidad ajena.',
    fallbackObstacle: 'La insensibilidad o familiaridad excesiva que nos hace perder el asombro y el respeto.',
    fallbackAction: 'Antes de hablar de alguien ausente hoy, detente y pregúntate si lo dirías exactamente igual en su presencia.',
    fallbackInsight: 'La reverencia moral protege todo lo construido en los peldaños anteriores como un guardián que cuida un tesoro precioso.',
  },
  {
    step: 10,
    chapter: 26,
    middahNameEs: 'Kedushá / Santidad en la Vida Cotidiana',
    middahNameHe: 'מִדַּת הַקְּדֻשָּׁה',
    defaultParagraphs: 3,
    fallbackDef: 'Elevar cada acto físico y cotidiano —comer, trabajar, dialogar— hasta convertirlo en un vehículo de presencia divina.',
    fallbackObstacle: 'Pensar que la espiritualidad pertenece solo a la sinagoga o al estudio y no a la mesa o al trabajo diario.',
    fallbackAction: 'Convierte una actividad cotidiana de hoy (una comida o tu trabajo) en un momento de gratitud consciente y ética impecable.',
    fallbackInsight: 'La cumbre del Mesilat Yesharim coincide con la meta jasídica de Dirá Betajtonim: transformar la materia cotidiana en santuario.',
  },
];

export function registerMesilatShotRoute(app: express.Express): void {
  const mesilatShotCache = new Map<string, any>();
  
  // Endpoint to fetch a real paragraph of Mesilat Yesharim from Sefaria API v3 and structure it as a Musar Micro-lesson ("Shot")
  app.post('/api/mesilat-shot', async (req, res) => {
    try {
      const { chapter, paragraph } = req.body || {};
  
      // Pick requested chapter or rotate by day/random from the 10 steps of the Ramchal's ladder
      let selectedMeta = MESILAT_MIDDOT_CATALOG.find((m) => m.chapter === Number(chapter));
      if (!selectedMeta) {
        const randomIndex = Math.floor(Math.random() * MESILAT_MIDDOT_CATALOG.length);
        selectedMeta = MESILAT_MIDDOT_CATALOG[randomIndex];
      }
  
      const targetChapter = selectedMeta.chapter;
      const parsedParagraph = Number(paragraph);
      const targetParagraph =
        Number.isFinite(parsedParagraph) && parsedParagraph >= 1
          ? Math.floor(parsedParagraph)
          : Math.floor(Math.random() * selectedMeta.defaultParagraphs) + 1;
  
      const shotCacheKey = `${targetChapter}:${targetParagraph}`;
      const cachedShot = mesilatShotCache.get(shotCacheKey);
      if (cachedShot) {
        return res.json({
          ...cachedShot,
          id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
        });
      }
  
      const sefariaRef = `Mesillat Yesharim ${targetChapter}:${targetParagraph}`;
      const sefariaUrl = `https://www.sefaria.org/Mesillat_Yesharim.${targetChapter}.${targetParagraph}`;
  
      // 1. Fetch real Hebrew and English text from Sefaria v3 API using cached, timeout-bounded server helper
      let hebrewExcerpt = '';
      let englishExcerpt = '';
      let sefariaHeRef = `מסילת ישרים ${targetChapter}:${targetParagraph}`;
  
      try {
        const sefariaSource = await fetchSingleServerSefariaSource(sefariaRef);
        if (sefariaSource) {
          sefariaHeRef = sefariaSource.heRef || sefariaHeRef;
          if (
            sefariaSource.hebrewText &&
            !sefariaSource.hebrewText.startsWith('(Texto canónico')
          ) {
            hebrewExcerpt = stripServerHtml(sefariaSource.hebrewText);
          }
          if (
            sefariaSource.translation &&
            !sefariaSource.translation.startsWith('(Traducción canónica') &&
            !sefariaSource.translation.startsWith('(Referencia canónica')
          ) {
            englishExcerpt = stripServerHtml(sefariaSource.translation);
          }
        }
      } catch (sefErr) {
        console.warn('[Mesilat Shot] Sefaria fetch warning:', sefErr);
      }
  
      // 2. Transform the authentic Sefaria paragraph into a crisp Spanish Musar Shot
      try {
        const ai = getGenAIClient();
        const systemInstruction = `Eres un maestro contemporáneo de Musar (ética y desarrollo del carácter judío), especialista en el Mesilat Yesharim (La Senda de los Rectos) de Rabí Moshé Jaim Luzzatto (el Ramjal), con el estilo claro, práctico e inspirador de Chabad.org y Aish Latino.
  A partir del fragmento real de Sefaria del Mesilat Yesharim que se te entrega, genera una microlección ("Shot de Musar") en español con:
  1. Traducción fiel y clara al español del párrafo del Ramjal.
  2. Definición breve: Qué significa este nivel/rasgo (Midá) según el Ramjal en una o dos frases directas.
  3. Obstáculo común: Qué nos impide alcanzarlo o aplicarlo en la vida cotidiana moderna.
  4. Acción del día: Un microejercicio concreto, medible y práctico para hoy mismo.
  5. Síntesis estilo Chabad.org / Aish Latino: Una reflexión breve y luminosa que conecte esta enseñanza con nuestro crecimiento diario.`;
  
        const prompt = `Convierte este pasaje auténtico de Sefaria en un Shot de Musar práctico:
  Referencia: ${sefariaRef} (${sefariaHeRef})
  Peldaño / Midá: ${selectedMeta.middahNameEs} (${selectedMeta.middahNameHe})
  Texto Hebreo de Sefaria: "${hebrewExcerpt}"
  Texto Inglés de Sefaria: "${englishExcerpt}"`;
  
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
                  spanishTranslation: { type: Type.STRING },
                  briefDefinition: { type: Type.STRING },
                  commonObstacle: { type: Type.STRING },
                  dailyAction: { type: Type.STRING },
                  chabadOrAishInsight: { type: Type.STRING },
                },
                required: [
                  'spanishTranslation',
                  'briefDefinition',
                  'commonObstacle',
                  'dailyAction',
                  'chabadOrAishInsight',
                ],
              },
            },
          },
          { timeoutMs: 25000, thinkingLevel: ThinkingLevel.LOW }
        );
  
        const parsed = parseGeminiJsonSafely(response.text, '/api/mesilat-shot');
  
        const shotResult = {
          id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
          chapter: targetChapter,
          paragraph: targetParagraph,
          sefariaRef,
          sefariaHeRef,
          sefariaUrl,
          middahNameEs: selectedMeta.middahNameEs,
          middahNameHe: selectedMeta.middahNameHe,
          ladderStepNumber: selectedMeta.step,
          hebrewExcerpt: hebrewExcerpt || selectedMeta.middahNameHe,
          englishExcerpt: englishExcerpt || '',
          spanishTranslation: parsed.spanishTranslation || englishExcerpt || selectedMeta.fallbackDef,
          briefDefinition: parsed.briefDefinition || selectedMeta.fallbackDef,
          commonObstacle: parsed.commonObstacle || selectedMeta.fallbackObstacle,
          dailyAction: parsed.dailyAction || selectedMeta.fallbackAction,
          chabadOrAishInsight: parsed.chabadOrAishInsight || selectedMeta.fallbackInsight,
        };
        setBoundedCache(mesilatShotCache, shotCacheKey, shotResult, 60);
        return res.json(shotResult);
      } catch (aiErr) {
        // Graceful fallback using curated Ramchal ladder definitions + live Sefaria text
        const fallbackShotResult = {
          id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
          chapter: targetChapter,
          paragraph: targetParagraph,
          sefariaRef,
          sefariaHeRef,
          sefariaUrl,
          middahNameEs: selectedMeta.middahNameEs,
          middahNameHe: selectedMeta.middahNameHe,
          ladderStepNumber: selectedMeta.step,
          hebrewExcerpt: hebrewExcerpt || selectedMeta.middahNameHe,
          englishExcerpt: englishExcerpt || '',
          spanishTranslation: englishExcerpt || selectedMeta.fallbackDef,
          briefDefinition: selectedMeta.fallbackDef,
          commonObstacle: selectedMeta.fallbackObstacle,
          dailyAction: selectedMeta.fallbackAction,
          chabadOrAishInsight: selectedMeta.fallbackInsight,
        };
        setBoundedCache(mesilatShotCache, shotCacheKey, fallbackShotResult, 60);
        return res.json(fallbackShotResult);
      }
    } catch (error: any) {
      console.log('[Darshán AI] Aviso en /api/mesilat-shot:', error?.message);
      return res.status(500).json({ error: error.message || 'Error al generar el Shot de Mesilat Yesharim.' });
    }
  });
}

export function registerArchiveAndSafePointRoutes(app: express.Express, rootDir: string): void {
  const preSeededSourcesCount = PRE_SEEDED_CANONICAL_SOURCES.length;
  const ARCHIVE_FILE_PATH = path.resolve(rootDir, '.derashot-archive.json');
  
  function readServerDerashotArchive(): any[] {
    try {
      if (fs.existsSync(ARCHIVE_FILE_PATH)) {
        const raw = fs.readFileSync(ARCHIVE_FILE_PATH, 'utf-8');
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
      fs.writeFileSync(ARCHIVE_FILE_PATH, JSON.stringify(entries.slice(0, 200), null, 2), 'utf-8');
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
      const idxById = existing.findIndex(
        (e: any) =>
          (entry.id && e.id === entry.id) ||
          (entry.title &&
            e.title &&
            String(e.title).trim().toLowerCase() === String(entry.title).trim().toLowerCase())
      );
      if (idxById >= 0) {
        existing[idxById] = { ...existing[idxById], ...entry };
      } else {
        const seqCollision = existing.some(
          (e: any) => Number(e.sequenceNumber) === Number(entry.sequenceNumber)
        );
        if (seqCollision) {
          const maxSeq = existing.reduce(
            (max: number, item: any) => Math.max(max, Number(item.sequenceNumber) || 0),
            0
          );
          existing.push({ ...entry, sequenceNumber: Math.max(maxSeq + 1, 10) });
        } else {
          existing.push(entry);
        }
      }
      existing.sort((a: any, b: any) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
      writeServerDerashotArchive(existing);
      return res.json({ status: 'ok', count: existing.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error guardando en archivo.' });
    }
  });
  
  app.delete('/api/derashot-archive/:sequenceNumber', (req, res) => {
    try {
      const seq = Number(req.params.sequenceNumber);
      const existing = readServerDerashotArchive();
      const filtered = existing.filter((e: any) => Number(e.sequenceNumber) !== seq);
      writeServerDerashotArchive(filtered);
      return res.json({ status: 'ok', count: filtered.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error eliminando del archivo.' });
    }
  });
  
  // ============================================================================
  // SYSTEM SAFE POINTS VAULT & FALLBACK RECOVERY ENGINE
  // ============================================================================
  
  const SAFEPOINTS_FILE_PATH = path.resolve(rootDir, '.system-safepoints.json');
  
  function readServerSafePoints(): any[] {
    try {
      if (fs.existsSync(SAFEPOINTS_FILE_PATH)) {
        const raw = fs.readFileSync(SAFEPOINTS_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('[SafePoints] Read warning:', err);
    }
    return [];
  }
  
  function writeServerSafePoints(snapshots: any[]): void {
    try {
      fs.writeFileSync(
        SAFEPOINTS_FILE_PATH,
        JSON.stringify(snapshots.slice(0, 25), null, 2),
        'utf-8'
      );
    } catch (err) {
      console.warn('[SafePoints] Write warning:', err);
    }
  }
  
  app.get('/api/safepoints', (req, res) => {
    const snapshots = readServerSafePoints();
    const archive = readServerDerashotArchive();
    return res.json({
      status: 'healthy',
      serverArchiveCount: archive.length,
      preSeededSourcesCount: preSeededSourcesCount,
      snapshots,
    });
  });
  
  app.post('/api/safepoints', (req, res) => {
    try {
      const { snapshot } = req.body || {};
      if (!snapshot || !snapshot.id || !snapshot.payload) {
        return res.status(400).json({ error: 'Falta el objeto snapshot válido.' });
      }
      const existing = readServerSafePoints().filter((s: any) => s && s.id !== snapshot.id);
      const updated = [snapshot, ...existing].slice(0, 20);
      writeServerSafePoints(updated);
  
      if (Array.isArray(snapshot.payload.archive) && snapshot.payload.archive.length > 0) {
        writeServerDerashotArchive(snapshot.payload.archive);
      }
  
      return res.json({ status: 'ok', id: snapshot.id, count: updated.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error guardando Punto Seguro.' });
    }
  });
  
  app.post('/api/safepoints/restore', (req, res) => {
    try {
      const { safePointId, archive } = req.body || {};
      // Clear potentially corrupted or stale in-memory caches on restore
      clearAllPipelineCaches();
  
      if (Array.isArray(archive) && archive.length > 0) {
        writeServerDerashotArchive(archive);
        return res.json({
          status: 'restored',
          safePointId: safePointId || 'custom',
          archiveCount: archive.length,
        });
      }
  
      const snapshots = readServerSafePoints();
      const target = safePointId
        ? snapshots.find((s: any) => s.id === safePointId)
        : snapshots[0];
  
      if (target && target.payload && Array.isArray(target.payload.archive)) {
        writeServerDerashotArchive(target.payload.archive);
        return res.json({
          status: 'restored',
          safePointId: target.id,
          archiveCount: target.payload.archive.length,
          snapshot: target,
        });
      }
  
      return res.json({
        status: 'restored_baseline',
        safePointId: safePointId || 'safepoint-golden-baseline-v1',
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err?.message || 'Error restaurando Punto Seguro en el servidor.' });
    }
  });
  
  app.delete('/api/safepoints/:id', (req, res) => {
    try {
      const targetId = req.params.id;
      const existing = readServerSafePoints();
      const updated = existing.filter((s: any) => s && s.id !== targetId);
      writeServerSafePoints(updated);
      return res.json({ status: 'ok', count: updated.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error eliminando Punto Seguro.' });
    }
  });
}

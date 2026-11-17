import fs from 'fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Helper to recover GEMINI_API_KEY across dev-server child process restarts on Linux
let cachedRuntimeApiKey = '';
let lastProcScanAt = 0;
const PROC_SCAN_NEGATIVE_TTL_MS = 30_000;
export function resolveRuntimeGeminiKey(): string {
  const fromEnv = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (fromEnv && fromEnv !== 'managed' && fromEnv !== 'MY_GEMINI_API_KEY') {
    cachedRuntimeApiKey = fromEnv;
    return fromEnv;
  }
  if (cachedRuntimeApiKey) {
    process.env.GEMINI_API_KEY = cachedRuntimeApiKey;
    return cachedRuntimeApiKey;
  }
  const now = Date.now();
  if (now - lastProcScanAt < PROC_SCAN_NEGATIVE_TTL_MS) {
    return '';
  }
  lastProcScanAt = now;
  try {
    const pids = fs.readdirSync('/proc').filter((x) => /^\d+$/.test(x));
    for (const pid of pids) {
      try {
        const rawEnv = fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
        const found = rawEnv.find(
          (e) => e.startsWith('GEMINI_API_KEY=') || e.startsWith('API_KEY=')
        );
        if (found) {
          const val = found.slice(found.indexOf('=') + 1).trim();
          if (val && val !== 'managed' && val !== 'MY_GEMINI_API_KEY') {
            cachedRuntimeApiKey = val;
            process.env.GEMINI_API_KEY = val;
            return val;
          }
        }
      } catch {
        // ignore unreadable pid
      }
    }
  } catch {
    // ignore non-procfs environments
  }
  return '';
}

// Helper to instantiate internal AI client transparently without exposing technical details to the user
export function getGenAIClient(): GoogleGenAI {
  const internalCredential = resolveRuntimeGeminiKey() || 'managed';
  return new GoogleGenAI({
    apiKey: internalCredential,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const GEMINI_DECISION_MODEL = 'gemini-decision-1';
export const inFlightDecisionsRequests = new Map<string, Promise<any>>();

// Dedicated v1beta client exclusively for Gemini Decisions API ('gemini-decision-1')
export function getDecisionsAIClient(): GoogleGenAI {
  const configuredKey = resolveRuntimeGeminiKey();
  if (!configuredKey) {
    throw new Error('INTERNAL_SYNTHESIS_MODE');
  }
  return new GoogleGenAI({
    apiKey: configuredKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory LRU caches to eliminate redundant LLM and Sefaria round-trips
export const decideMethodologyCache = new Map<string, any>();
export const phase1MemoryCache = new Map<string, any>();
export const sefariaServerCache = new Map<string, any>();
export const derashaMemoryCache = new Map<string, any>();
export const externalSourcesCache = new Map<string, any[]>();
export const masterReadingsCache = new Map<string, any>();
export const compareDerashotCache = new Map<string, any>();
export const inFlightSefariaServerRequests = new Map<string, Promise<any>>();
export const inFlightPhase1ServerRequests = new Map<string, Promise<any>>();
export const inFlightPhase3ServerRequests = new Map<string, Promise<any>>();

export function setBoundedCache<T>(map: Map<string, T>, key: string, value: T, maxEntries = 120) {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, value);
}

export const GEMINI_HYDROGEN_MODEL = 'gemini-4-hydrogen';

export function resolveHydrogenThinkingLevel(requested?: ThinkingLevel): ThinkingLevel {
  if (!requested) return ThinkingLevel.MEDIUM;
  if (requested === ThinkingLevel.MINIMAL) return ThinkingLevel.LOW;
  return requested;
}

export function logPipelineGeminiDiagnostic(
  routeTag: string,
  err: any,
  model = GEMINI_HYDROGEN_MODEL
) {
  const msg = String(err?.message || err || 'Unknown error');
  const status = Number(err?.status || err?.code || 0);
  if (msg.includes('INTERNAL_SYNTHESIS_MODE')) {
    console.info(
      `[Darshán Pipeline][${routeTag}] Sin GEMINI_API_KEY/API_KEY activa en entorno; ejecutando síntesis determinista local.`
    );
    return;
  }
  const lower = msg.toLowerCase();
  if (
    status === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('billing') ||
    lower.includes('has not been used in project') ||
    lower.includes('it is disabled')
  ) {
    console.error(
      `[Darshán Pipeline][BILLING_OR_PERMISSION_403] en ${routeTag} (modelo: ${model}, status: ${status || 403}): ${msg} | Verifica que la API Key seleccionada corresponda al proyecto de Google Cloud con Facturación activa, API Generative Language habilitada y sin restricciones de referrer/IP incompatibles.`
    );
    return;
  }
  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    console.error(
      `[Darshán Pipeline][QUOTA_EXCEEDED_429] en ${routeTag} (modelo: ${model}, status: ${status || 429}): ${msg} | Verifica las cuotas RPM/TPM/RPD y el estado de Tier 1 en Google Cloud Console.`
    );
    return;
  }
  if (status === 400 || lower.includes('api_key_invalid')) {
    console.error(
      `[Darshán Pipeline][API_KEY_INVALID_400] en ${routeTag} (modelo: ${model}): ${msg}`
    );
    return;
  }
  if (status === 404 || lower.includes('not_found')) {
    console.error(
      `[Darshán Pipeline][MODEL_NOT_FOUND_404] en ${routeTag} (modelo: ${model}): ${msg}`
    );
    return;
  }
  console.warn(
    `[Darshán Pipeline][FALLBACK_TRIGGERED] en ${routeTag} (modelo: ${model}, status: ${status || 'N/A'}): ${msg}`
  );
}

export class GeminiHttpError extends Error {
  status: number;
  errorCode: string;
  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = 'GeminiHttpError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export function classifyGeminiRouteError(err: any): {
  status: number;
  code: string;
  userMessage: string;
} {
  if (err instanceof GeminiHttpError) {
    return {
      status: err.status,
      code: err.errorCode,
      userMessage: err.message,
    };
  }
  const msg = String(err?.message || err || 'Error desconocido de síntesis');
  const lower = msg.toLowerCase();
  const status = Number(err?.status || err?.code || 0);

  if (msg.includes('INTERNAL_SYNTHESIS_MODE')) {
    return {
      status: 503,
      code: 'MISSING_API_KEY',
      userMessage:
        'No hay una API Key de Gemini configurada en el servidor. Selecciona o configura una clave válida en Settings > Secrets para responder específicamente a tu consulta.',
    };
  }

  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('spending cap') ||
    lower.includes('spend cap') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    if (lower.includes('spending cap') || lower.includes('spend cap')) {
      return {
        status: 429,
        code: 'MONTHLY_SPEND_CAP_EXCEEDED',
        userMessage:
          'El proyecto de Google Cloud / AI Studio asociado a tu API Key superó su límite de gasto mensual (Monthly Spending Cap). Ajusta el límite en https://ai.studio/spend o selecciona otra clave en Settings > Secrets.',
      };
    }
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      userMessage:
        'Se excedió la cuota disponible de tu API Key de Gemini (429 RESOURCE_EXHAUSTED). Verifica tus límites de cuota/facturación o selecciona otra clave en Settings > Secrets.',
    };
  }

  if (
    status === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('billing') ||
    lower.includes('has not been used in project') ||
    lower.includes('it is disabled')
  ) {
    return {
      status: 403,
      code: 'PERMISSION_OR_BILLING_DENIED',
      userMessage:
        'Permiso denegado o restricción de facturación en la API Key de Gemini (403 PERMISSION_DENIED). Verifica la facturación y la API de Generative Language en Google Cloud o selecciona otra clave en Settings > Secrets.',
    };
  }

  if (
    status === 400 &&
    (lower.includes('safety') ||
      lower.includes('prohibited_content') ||
      lower.includes('blocklist') ||
      lower.includes('image_safety') ||
      lower.includes('content_blocked'))
  ) {
    return {
      status: 400,
      code: 'CONTENT_BLOCKED',
      userMessage:
        'La consulta no pudo procesarse por restricciones de seguridad del contenido. Por favor reformula tu pregunta.',
    };
  }

  if (
    status === 400 ||
    status === 401 ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid_argument')
  ) {
    return {
      status: status === 401 ? 401 : 400,
      code: 'API_KEY_INVALID',
      userMessage:
        'La API Key de Gemini es inválida o no tiene acceso (400/401). Verifica o selecciona una clave válida en Settings > Secrets.',
    };
  }

  if (status === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      userMessage:
        'El modelo de Gemini configurado no se encuentra disponible para la API Key actual (404).',
    };
  }

  if (lower.includes('per_attempt_timeout')) {
    return {
      status: 504,
      code: 'AI_TIMEOUT',
      userMessage:
        'La consulta con el modelo de IA superó el tiempo máximo de espera. Por favor aclara o acota tu pregunta e inténtalo nuevamente.',
    };
  }

  return {
    status: 502,
    code: 'AI_SYNTHESIS_ERROR',
    userMessage:
      'No se pudo obtener una respuesta específica del modelo de IA en este momento. Intenta nuevamente en unos segundos.',
  };
}

export function parseGeminiJsonSafely(
  rawText: string | undefined | null,
  routeTag: string
): Record<string, any> {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error(`[${routeTag}] Respuesta vacía del modelo de IA.`);
  }

  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object') {
      return direct;
    }
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        const extracted = JSON.parse(candidate);
        if (extracted && typeof extracted === 'object') {
          return extracted;
        }
      } catch {
        // fall through to explicit error
      }
    }
  }

  throw new Error(`[${routeTag}] Respuesta JSON inválida del modelo de IA.`);
}

// Robust retry wrapper optimized for Gemini 4 Hydrogen ('gemini-4-hydrogen'), calibrated ThinkingLevel, and bounded total timeouts
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: any,
  options?: { timeoutMs?: number; thinkingLevel?: ThinkingLevel }
): Promise<any> {
  const configuredKey = resolveRuntimeGeminiKey();
  if (!configuredKey) {
    throw new Error('INTERNAL_SYNTHESIS_MODE');
  }

  const targetModel =
    typeof params?.model === 'string' && params.model.trim()
      ? params.model.trim()
      : GEMINI_HYDROGEN_MODEL;
  const primaryThinkingLevel = resolveHydrogenThinkingLevel(
    options?.thinkingLevel ?? params?.config?.thinkingConfig?.thinkingLevel
  );
  // Keep total duration across all retry attempts safely beneath nginx's 60s reverse-proxy timeout
  const totalBudgetMs = Math.min(Math.max(options?.timeoutMs || 40000, 10000), 54000);
  const overallDeadlineMs = Date.now() + totalBudgetMs;
  const maxAttempts = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remainingBeforeAttemptMs = overallDeadlineMs - Date.now();
    if (attempt > 0) {
      if (remainingBeforeAttemptMs < 12000) {
        break;
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }

    const attemptStartedAt = Date.now();
    const attemptTimeoutMs = Math.max(5000, overallDeadlineMs - attemptStartedAt);
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const baseConfig: Record<string, any> = { ...(params.config || {}) };
      // Ensure parameters unsupported by Gemini 4 Hydrogen are never forwarded
      delete baseConfig.thinkingBudget;
      delete baseConfig.temperature;
      delete baseConfig.topP;
      delete baseConfig.topK;
      delete baseConfig.candidateCount;

      baseConfig.thinkingConfig = {
        thinkingLevel: primaryThinkingLevel,
      };

      const res = await Promise.race([
        ai.models.generateContent({
          ...params,
          model: targetModel,
          config: baseConfig,
        }),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('PER_ATTEMPT_TIMEOUT')),
            attemptTimeoutMs
          );
        }),
      ]);
      return res;
    } catch (err: any) {
      lastError = err;
      const attemptElapsedMs = Date.now() - attemptStartedAt;
      const msg = String(err?.message || '');
      const lowerMsg = msg.toLowerCase();
      const status = Number(err?.status || err?.code || 0);
      if (
        msg.includes('PER_ATTEMPT_TIMEOUT') ||
        attemptElapsedMs >= 15000 ||
        overallDeadlineMs - Date.now() < 12000 ||
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 429 ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        lowerMsg.includes('spending cap') ||
        lowerMsg.includes('spend cap') ||
        lowerMsg.includes('quota') ||
        msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('INVALID_ARGUMENT') ||
        msg.includes('NOT_FOUND')
      ) {
        break;
      }
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  throw (
    lastError ||
    new Error(
      'No hay respuestas disponibles de momento. Por favor intenta acotar o aclarar tu consulta.'
    )
  );
}

export function clearAllPipelineCaches(): void {
  decideMethodologyCache.clear();
  phase1MemoryCache.clear();
  derashaMemoryCache.clear();
  masterReadingsCache.clear();
  compareDerashotCache.clear();
}

import {
  DerashaDuration,
  DerashaMethodology,
  DerashaOutputPreferences,
  DerashaTone,
  FinalDerasha,
  Phase1AnalysisResult,
  PipelineStage,
  VerifiedSefariaSource,
} from '../../types';
import { LongWaitTimeoutError } from '../api';
import { resolvePipelineMethodology } from '../../utils/methodologyLogicGates';
import { getMaxRefsForDuration } from './queryEnrichment';
import { resolvePrewarmedOrExecutePhase1And2 } from './executePhase1And2Pipeline';
import { executePhase3DerashaSynthesis } from './executePhase3DerashaSynthesis';
import { PrewarmedPipelineCache } from './types';

export interface ExecuteFullDerashaPipelineParams {
  effectiveQuery: string;
  requestedMethodology: DerashaMethodology;
  duracion: DerashaDuration;
  metodologiasComplementarias: DerashaMethodology[];
  audienciaOTono: string;
  tonoHomiletico?: DerashaTone;
  outputPreferences?: DerashaOutputPreferences;
  prewarmedCache: PrewarmedPipelineCache | null;
  inFlightPrewarmPromise: Promise<PrewarmedPipelineCache | null> | null;
  signal?: AbortSignal;
  isRunStillActive: () => boolean;
  onStageChange: (stage: PipelineStage) => void;
  onPhase1Complete: (phase1Data: Phase1AnalysisResult) => void;
  onSourcesReady: (sources: VerifiedSefariaSource[]) => void;
  onSefariaProgress: (current: number, total: number) => void;
  onUpdatePrewarmCache: (cache: PrewarmedPipelineCache) => void;
}

export interface ExecuteFullDerashaPipelineResult {
  cancelled: boolean;
  phase1Data?: Phase1AnalysisResult;
  verifiedSources?: VerifiedSefariaSource[];
  finalDerasha?: FinalDerasha;
}

/**
 * Orchestrates the complete 3-Phase Derashá Pipeline (Phase 1 Morphology, Phase 2 Sefaria Verification,
 * and Phase 3 Homiletical Synthesis), including prewarm cache reuse and cancellation guards.
 */
export async function executeFullDerashaPipeline(
  params: ExecuteFullDerashaPipelineParams
): Promise<ExecuteFullDerashaPipelineResult> {
  const pipelineResolution = resolvePipelineMethodology(
    params.effectiveQuery,
    params.requestedMethodology,
    params.duracion,
    params.metodologiasComplementarias
  );

  const maxRefsForDuration = getMaxRefsForDuration(params.duracion);

  const p1And2Result = await resolvePrewarmedOrExecutePhase1And2({
    effectiveQuery: params.effectiveQuery,
    requestedMethodology: params.requestedMethodology,
    duracion: params.duracion,
    metodologiasComplementarias: params.metodologiasComplementarias,
    audienciaOTono: params.audienciaOTono,
    tonoHomiletico: params.tonoHomiletico,
    maxRefs: maxRefsForDuration,
    prewarmedCache: params.prewarmedCache,
    inFlightPrewarmPromise: params.inFlightPrewarmPromise,
    logicGateExplanation: pipelineResolution.evaluation.explanation,
    signal: params.signal,
    isRunStillActive: params.isRunStillActive,
    onStageChange: params.onStageChange,
    onPhase1Complete: params.onPhase1Complete,
    onSefariaProgress: params.onSefariaProgress,
    onUpdatePrewarmCache: params.onUpdatePrewarmCache,
  });

  if (p1And2Result.cancelled || !params.isRunStillActive()) {
    return { cancelled: true };
  }

  params.onPhase1Complete(p1And2Result.phase1Data);
  params.onSourcesReady(p1And2Result.verifiedSources);

  // Phase 3: Homiletical & Exegetical Synthesis
  params.onStageChange('phase3_derasha');

  const { finalDerasha, enrichedSources } = await executePhase3DerashaSynthesis({
    effectiveQuery: params.effectiveQuery,
    resolvedMethodology: p1And2Result.resolvedMethodology,
    complementaryMethodologies: p1And2Result.complementaryMethodologies,
    duracion: params.duracion,
    audienciaOTono: params.audienciaOTono,
    tonoHomiletico: params.tonoHomiletico,
    outputPreferences: params.outputPreferences,
    phase1Data: p1And2Result.phase1Data,
    verifiedSources: p1And2Result.verifiedSources,
    fallbackThinkerDetection: pipelineResolution.evaluation.externalThinkerDetection,
    signal: params.signal,
  });

  if (!params.isRunStillActive()) {
    return { cancelled: true };
  }

  params.onSourcesReady(enrichedSources);

  return {
    cancelled: false,
    phase1Data: p1And2Result.phase1Data,
    verifiedSources: enrichedSources,
    finalDerasha,
  };
}

/**
 * Classifies whether a pipeline execution error was caused by a long-wait timeout / temporary unavailability.
 */
export function isPipelineTimeoutOrUnavailableError(err: any): boolean {
  return (
    err instanceof LongWaitTimeoutError ||
    err?.name === 'LongWaitTimeoutError' ||
    err?.errorCode === 'AI_TIMEOUT'
  );
}

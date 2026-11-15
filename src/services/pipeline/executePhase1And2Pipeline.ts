import { Phase1AnalysisResult, VerifiedSefariaSource } from '../../types';
import { requestPhase1Analysis } from '../api';
import { fetchSefariaCanonicalSource } from '../sefaria';
import { resolvePipelineMethodology } from '../../utils/methodologyLogicGates';
import { mergeForcedThinkerRefsWithPredictions } from '../../utils/externalThinkerDetector';
import { getMaxRefsForDuration } from './queryEnrichment';
import {
  Phase1And2PipelineParams,
  Phase1And2PipelineResult,
  ResolveOrExecutePhase1And2Params,
  ResolveOrExecutePhase1And2Result,
} from './types';

/**
 * Executes Phase 1 (Morphology & Theological Keys) + Phase 2 (Sefaria Canonical Source Verification)
 * for background pre-warming or direct execution.
 */
export async function executePhase1And2Pipeline(
  params: Phase1And2PipelineParams
): Promise<Phase1And2PipelineResult> {
  const resolution = resolvePipelineMethodology(
    params.effectiveQuery,
    params.requestedMethodology,
    params.duracion,
    params.metodologiasComplementarias
  );

  const p1Result = await requestPhase1Analysis(params.effectiveQuery, {
    metodologia: resolution.resolvedMethodology,
    audiencia_o_tono: params.audienciaOTono,
    tono_homiletico: params.tonoHomiletico,
    duracion: params.duracion,
    metodologias_complementarias: resolution.complementaryMethodologies,
  });

  const resolvedMethodology = p1Result.detectedMetodologia || resolution.resolvedMethodology;
  const complementaryMethodologies =
    p1Result.metodologiasComplementarias || resolution.complementaryMethodologies;

  const thinkerDet =
    p1Result.externalThinkerDetection || resolution.evaluation.externalThinkerDetection;

  const enrichedPhase1: Phase1AnalysisResult = {
    ...p1Result,
    detectedMetodologia: resolvedMethodology,
    duracion: params.duracion,
    metodologiasComplementarias: complementaryMethodologies,
    ...(params.tonoHomiletico ? { tonoHomiletico: p1Result.tonoHomiletico || params.tonoHomiletico } : {}),
    logicGateReason: resolution.evaluation.explanation,
    ...(thinkerDet?.detected ? { externalThinkerDetection: thinkerDet } : {}),
  };

  params.onPhase1Complete?.(enrichedPhase1);

  const maxRefs = params.maxRefs || getMaxRefsForDuration(params.duracion);

  let verifiedSources: VerifiedSefariaSource[];

  if (Array.isArray(p1Result.preVerifiedSources) && p1Result.preVerifiedSources.length > 0) {
    verifiedSources = p1Result.preVerifiedSources.slice(0, maxRefs);
    params.onSefariaProgress?.(verifiedSources.length, verifiedSources.length);
  } else {
    params.onStageChange?.('phase2_sefaria');
    const baseRefs =
      p1Result.sefariaReferences && p1Result.sefariaReferences.length > 0
        ? p1Result.sefariaReferences.slice(0, maxRefs)
        : [{ ref: 'Genesis 1:1', rationale: 'Fuente canónica primordial' }];

    const refsToFetch = thinkerDet?.detected
      ? mergeForcedThinkerRefsWithPredictions(thinkerDet, baseRefs, maxRefs)
      : baseRefs;

    params.onSefariaProgress?.(0, refsToFetch.length);
    let completed = 0;
    verifiedSources = await Promise.all(
      refsToFetch.map(async (item) => {
        const src = await fetchSefariaCanonicalSource(item.ref);
        completed += 1;
        params.onSefariaProgress?.(completed, refsToFetch.length);
        return src;
      })
    );
  }

  return {
    phase1Data: enrichedPhase1,
    verifiedSources,
    resolvedMethodology,
    complementaryMethodologies,
  };
}

/**
 * Resolves Phase 1 & Phase 2 either from a completed/in-flight background prewarm cache
 * or by executing `executePhase1And2Pipeline` fresh.
 */
export async function resolvePrewarmedOrExecutePhase1And2(
  params: ResolveOrExecutePhase1And2Params
): Promise<ResolveOrExecutePhase1And2Result> {
  const maxRefsForDuration = params.maxRefs || getMaxRefsForDuration(params.duracion);
  const resolution = resolvePipelineMethodology(
    params.effectiveQuery,
    params.requestedMethodology,
    params.duracion,
    params.metodologiasComplementarias
  );

  const hasCompletedPrewarmForQuery =
    params.prewarmedCache &&
    params.prewarmedCache.query === params.effectiveQuery &&
    params.prewarmedCache.verifiedSources.length > 0;

  if (hasCompletedPrewarmForQuery && params.prewarmedCache) {
    const activeP1Data: Phase1AnalysisResult = {
      ...params.prewarmedCache.phase1Data,
      detectedMetodologia: resolution.resolvedMethodology,
      duracion: params.duracion,
      metodologiasComplementarias: resolution.complementaryMethodologies,
      logicGateReason: params.logicGateExplanation,
    };
    const activeFetchedSources = params.prewarmedCache.verifiedSources.slice(0, maxRefsForDuration);
    return {
      phase1Data: activeP1Data,
      verifiedSources: activeFetchedSources,
      resolvedMethodology: resolution.resolvedMethodology,
      complementaryMethodologies: resolution.complementaryMethodologies,
      loadedViaPrewarm: true,
      cancelled: false,
    };
  }

  if (params.inFlightPrewarmPromise) {
    params.onStageChange?.('phase1_morphology');
    const prewarmed = await params.inFlightPrewarmPromise;
    if (!params.isRunStillActive()) {
      return {
        phase1Data: null as any,
        verifiedSources: [],
        resolvedMethodology: resolution.resolvedMethodology,
        complementaryMethodologies: resolution.complementaryMethodologies,
        loadedViaPrewarm: false,
        cancelled: true,
      };
    }

    if (prewarmed && prewarmed.verifiedSources.length > 0) {
      const activeP1Data: Phase1AnalysisResult = {
        ...prewarmed.phase1Data,
        detectedMetodologia: resolution.resolvedMethodology,
        duracion: params.duracion,
        metodologiasComplementarias: resolution.complementaryMethodologies,
        logicGateReason: params.logicGateExplanation,
      };
      const activeFetchedSources = prewarmed.verifiedSources.slice(0, maxRefsForDuration);
      return {
        phase1Data: activeP1Data,
        verifiedSources: activeFetchedSources,
        resolvedMethodology: resolution.resolvedMethodology,
        complementaryMethodologies: resolution.complementaryMethodologies,
        loadedViaPrewarm: true,
        cancelled: false,
      };
    }
  }

  params.onStageChange?.('phase1_morphology');
  params.onSefariaProgress?.(0, 0);

  const freshResult = await executePhase1And2Pipeline({
    effectiveQuery: params.effectiveQuery,
    requestedMethodology: params.requestedMethodology,
    duracion: params.duracion,
    metodologiasComplementarias: params.metodologiasComplementarias,
    audienciaOTono: params.audienciaOTono,
    tonoHomiletico: params.tonoHomiletico,
    maxRefs: maxRefsForDuration,
    onStageChange: params.onStageChange,
    onPhase1Complete: params.onPhase1Complete,
    onSefariaProgress: params.onSefariaProgress,
  });

  if (!params.isRunStillActive()) {
    return {
      ...freshResult,
      loadedViaPrewarm: false,
      cancelled: true,
    };
  }

  params.onUpdatePrewarmCache({
    query: params.effectiveQuery,
    phase1Data: freshResult.phase1Data,
    verifiedSources: freshResult.verifiedSources,
  });

  return {
    ...freshResult,
    loadedViaPrewarm: false,
    cancelled: false,
  };
}

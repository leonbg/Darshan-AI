import { Phase1AnalysisResult, VerifiedSefariaSource } from '../../types';
import { requestPhase1Analysis } from '../api';
import { fetchSefariaCanonicalSource } from '../sefaria';
import { resolvePipelineMethodology } from '../../utils/methodologyLogicGates';
import { mergeForcedThinkerRefsWithPredictions } from '../../utils/externalThinkerDetector';
import {
  consultHalakhicShulchanArukhModule,
  enrichHalakhicConsultationWithVerifiedSources,
  mergeHalakhicRefsWithPredictions,
} from '../../utils/halakhicShulchanArukhModule';
import {
  sanitizeHalakhicOutputFromExternalCitations,
  validatePurelyHalakhicQuery,
} from '../../utils/halakhicPipelineValidator';
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

  const isAutoRequested = !params.requestedMethodology || params.requestedMethodology === 'AUTO';
  const hasExplicitComplementary =
    Array.isArray(params.metodologiasComplementarias) &&
    params.metodologiasComplementarias.length > 0;

  const p1Result = await requestPhase1Analysis(params.effectiveQuery, {
    metodologia: isAutoRequested ? 'AUTO' : resolution.resolvedMethodology,
    audiencia_o_tono: params.audienciaOTono,
    tono_homiletico: params.tonoHomiletico,
    duracion: params.duracion,
    metodologias_complementarias: hasExplicitComplementary
      ? resolution.complementaryMethodologies
      : [],
    signal: params.signal,
  });

  const halakhicValidation =
    p1Result.halakhicValidation ||
    resolution.evaluation.halakhicValidation ||
    validatePurelyHalakhicQuery(params.effectiveQuery);

  const resolvedMethodology =
    halakhicValidation?.externalPhilosophyInjectionDisabled &&
    (p1Result.detectedMetodologia === 'FILOSOFIA_CONTRASTIVA' ||
      resolution.resolvedMethodology === 'FILOSOFIA_CONTRASTIVA')
      ? 'PARDES'
      : p1Result.detectedMetodologia || resolution.resolvedMethodology;

  const complementaryMethodologies = (
    p1Result.metodologiasComplementarias || resolution.complementaryMethodologies
  ).filter(
    (m) =>
      !halakhicValidation?.externalPhilosophyInjectionDisabled ||
      m !== 'FILOSOFIA_CONTRASTIVA'
  );

  const thinkerDet = halakhicValidation?.externalPhilosophyInjectionDisabled
    ? undefined
    : p1Result.externalThinkerDetection || resolution.evaluation.externalThinkerDetection;

  const baseHalakhicConsultation =
    p1Result.halakhicConsultation?.active
      ? p1Result.halakhicConsultation
      : resolution.evaluation.halakhicConsultation?.active
      ? resolution.evaluation.halakhicConsultation
      : consultHalakhicShulchanArukhModule(params.effectiveQuery, halakhicValidation);

  const baseEnrichedPhase1: Phase1AnalysisResult = sanitizeHalakhicOutputFromExternalCitations(
    {
      ...p1Result,
      detectedMetodologia: resolvedMethodology,
      duracion: params.duracion,
      metodologiasComplementarias: complementaryMethodologies,
      ...(params.tonoHomiletico ? { tonoHomiletico: p1Result.tonoHomiletico || params.tonoHomiletico } : {}),
      logicGateReason: resolution.evaluation.explanation,
      ...(halakhicValidation ? { halakhicValidation } : {}),
      ...(baseHalakhicConsultation?.active
        ? { halakhicConsultation: baseHalakhicConsultation }
        : {}),
      ...(thinkerDet?.detected ? { externalThinkerDetection: thinkerDet } : {}),
    },
    halakhicValidation
  );

  params.onPhase1Complete?.(baseEnrichedPhase1);

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

    const refsToFetch = baseHalakhicConsultation?.active
      ? mergeHalakhicRefsWithPredictions(baseHalakhicConsultation, baseRefs, maxRefs)
      : thinkerDet?.detected
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

  const enrichedConsultation = enrichHalakhicConsultationWithVerifiedSources(
    baseHalakhicConsultation,
    verifiedSources
  );

  const enrichedPhase1 = sanitizeHalakhicOutputFromExternalCitations(
    {
      ...baseEnrichedPhase1,
      ...(enrichedConsultation?.active ? { halakhicConsultation: enrichedConsultation } : {}),
    },
    halakhicValidation
  );

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
    const activeFetchedSources = params.prewarmedCache.verifiedSources.slice(0, maxRefsForDuration);
    const halakhicValidation =
      params.prewarmedCache.phase1Data.halakhicValidation ||
      resolution.evaluation.halakhicValidation ||
      validatePurelyHalakhicQuery(params.effectiveQuery);
    const rawConsultation =
      params.prewarmedCache.phase1Data.halakhicConsultation?.active
        ? params.prewarmedCache.phase1Data.halakhicConsultation
        : resolution.evaluation.halakhicConsultation;
    const enrichedConsultation = enrichHalakhicConsultationWithVerifiedSources(
      rawConsultation,
      activeFetchedSources
    );
    const isAutoRequested = !params.requestedMethodology || params.requestedMethodology === 'AUTO';
    const maxComp = params.duracion === '5_MIN' ? 0 : params.duracion === '10_MIN' ? 1 : 2;
    const prewarmPrimary =
      isAutoRequested &&
      params.prewarmedCache.phase1Data.detectedMetodologia &&
      params.prewarmedCache.phase1Data.detectedMetodologia !== 'AUTO'
        ? params.prewarmedCache.phase1Data.detectedMetodologia
        : resolution.resolvedMethodology;
    const prewarmComp =
      isAutoRequested &&
      (!params.metodologiasComplementarias || params.metodologiasComplementarias.length === 0) &&
      Array.isArray(params.prewarmedCache.phase1Data.metodologiasComplementarias) &&
      params.prewarmedCache.phase1Data.metodologiasComplementarias.length > 0
        ? params.prewarmedCache.phase1Data.metodologiasComplementarias.slice(0, maxComp)
        : resolution.complementaryMethodologies;

    const activeP1Data: Phase1AnalysisResult = sanitizeHalakhicOutputFromExternalCitations(
      {
        ...params.prewarmedCache.phase1Data,
        detectedMetodologia: prewarmPrimary,
        duracion: params.duracion,
        metodologiasComplementarias: prewarmComp,
        logicGateReason: params.logicGateExplanation,
        ...(halakhicValidation ? { halakhicValidation } : {}),
        ...(enrichedConsultation?.active ? { halakhicConsultation: enrichedConsultation } : {}),
      },
      halakhicValidation
    );
    return {
      phase1Data: activeP1Data,
      verifiedSources: activeFetchedSources,
      resolvedMethodology: prewarmPrimary as any,
      complementaryMethodologies: prewarmComp as any,
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
      const activeFetchedSources = prewarmed.verifiedSources.slice(0, maxRefsForDuration);
      const halakhicValidation =
        prewarmed.phase1Data.halakhicValidation ||
        resolution.evaluation.halakhicValidation ||
        validatePurelyHalakhicQuery(params.effectiveQuery);
      const rawConsultation =
        prewarmed.phase1Data.halakhicConsultation?.active
          ? prewarmed.phase1Data.halakhicConsultation
          : resolution.evaluation.halakhicConsultation;
      const enrichedConsultation = enrichHalakhicConsultationWithVerifiedSources(
        rawConsultation,
        activeFetchedSources
      );
      const isAutoRequested = !params.requestedMethodology || params.requestedMethodology === 'AUTO';
      const maxComp = params.duracion === '5_MIN' ? 0 : params.duracion === '10_MIN' ? 1 : 2;
      const prewarmPrimary =
        isAutoRequested &&
        prewarmed.phase1Data.detectedMetodologia &&
        prewarmed.phase1Data.detectedMetodologia !== 'AUTO'
          ? prewarmed.phase1Data.detectedMetodologia
          : resolution.resolvedMethodology;
      const prewarmComp =
        isAutoRequested &&
        (!params.metodologiasComplementarias || params.metodologiasComplementarias.length === 0) &&
        Array.isArray(prewarmed.phase1Data.metodologiasComplementarias) &&
        prewarmed.phase1Data.metodologiasComplementarias.length > 0
          ? prewarmed.phase1Data.metodologiasComplementarias.slice(0, maxComp)
          : resolution.complementaryMethodologies;

      const activeP1Data: Phase1AnalysisResult = sanitizeHalakhicOutputFromExternalCitations(
        {
          ...prewarmed.phase1Data,
          detectedMetodologia: prewarmPrimary,
          duracion: params.duracion,
          metodologiasComplementarias: prewarmComp,
          logicGateReason: params.logicGateExplanation,
          ...(halakhicValidation ? { halakhicValidation } : {}),
          ...(enrichedConsultation?.active ? { halakhicConsultation: enrichedConsultation } : {}),
        },
        halakhicValidation
      );
      return {
        phase1Data: activeP1Data,
        verifiedSources: activeFetchedSources,
        resolvedMethodology: prewarmPrimary as any,
        complementaryMethodologies: prewarmComp as any,
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
    signal: params.signal,
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

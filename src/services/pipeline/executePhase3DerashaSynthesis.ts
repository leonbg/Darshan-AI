import {
  DerashaDuration,
  DerashaMethodology,
  DerashaTone,
  FinalDerasha,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
} from '../../types';
import { requestPhase3Derasha } from '../api';
import { resolvePipelineMethodology } from '../../utils/methodologyLogicGates';
import { Phase3DerashaSynthesisParams, Phase3DerashaSynthesisResult } from './types';

/**
 * Executes Phase 3 (Homiletical & Exegetical Synthesis) from verified Phase 1 & Phase 2 data.
 */
export async function executePhase3DerashaSynthesis(
  params: Phase3DerashaSynthesisParams
): Promise<Phase3DerashaSynthesisResult> {
  const derashaPayload = {
    query: params.effectiveQuery,
    tema_o_fuente: params.effectiveQuery,
    metodologia: params.resolvedMethodology,
    audiencia_o_tono: params.audienciaOTono,
    tono_homiletico: params.tonoHomiletico,
    duracion: params.duracion,
    metodologias_complementarias: params.complementaryMethodologies,
    title: params.phase1Data.title,
    primaryHebrew: params.phase1Data.primaryHebrew,
    transliteration: params.phase1Data.transliteration,
    literalSpanishTranslation: params.phase1Data.literalSpanishTranslation,
    liturgicalContext: params.phase1Data.liturgicalContext,
    theologicalKeys: params.phase1Data.theologicalKeys,
    morphologicalBreakdown: params.phase1Data.morphologicalBreakdown,
    verifiedSources: params.verifiedSources,
    externalSources: params.phase1Data.externalSources,
    formalContrast: params.phase1Data.formalContrast,
  };

  const p3Result = await requestPhase3Derasha(derashaPayload);
  const finalThinkerDet =
    p3Result.externalThinkerDetection ||
    params.phase1Data.externalThinkerDetection ||
    params.fallbackThinkerDetection;

  const finalDerasha: FinalDerasha = {
    ...p3Result,
    duracion: p3Result.duracion || params.duracion,
    metodologiasComplementarias:
      p3Result.metodologiasComplementarias || params.complementaryMethodologies,
    ...(finalThinkerDet?.detected ? { externalThinkerDetection: finalThinkerDet } : {}),
  };

  let enrichedSources = params.verifiedSources;
  if (p3Result.canonicalAnalysis?.spanishTranslations) {
    enrichedSources = params.verifiedSources.map((s) => {
      const found = p3Result.canonicalAnalysis.spanishTranslations?.find(
        (t: any) => t.ref.toLowerCase() === s.ref.toLowerCase()
      );
      return found ? { ...s, spanishTranslation: found.spanishTranslation } : s;
    });
  }

  return {
    finalDerasha,
    enrichedSources,
  };
}

/**
 * Re-synthesizes Phase 3 when the user dynamically changes lesson duration (5m / 10m / 30m)
 * or adds a complementary methodology on an existing study.
 */
export async function executeDurationOrComplementaryResynthesis(params: {
  activeStudyQuery: string;
  primaryMetodologia: DerashaMethodology;
  currentComplementary: DerashaMethodology[];
  newDuration: DerashaDuration;
  extraMethodology?: DerashaMethodology;
  audienciaOTono: string;
  tonoHomiletico?: DerashaTone;
  phase1Data: Phase1AnalysisResult;
  verifiedSources: VerifiedSefariaSource[];
}): Promise<{
  finalDerasha: FinalDerasha;
  enrichedSources: VerifiedSefariaSource[];
  updatedComplementary: DerashaMethodology[];
  resolvedComplementary: DerashaMethodology[];
}> {
  let updatedComplementary = [...params.currentComplementary];
  if (
    params.extraMethodology &&
    params.extraMethodology !== 'AUTO' &&
    params.extraMethodology !== params.primaryMetodologia &&
    !updatedComplementary.includes(params.extraMethodology)
  ) {
    const maxSlots = params.newDuration === '30_MIN' ? 2 : 1;
    updatedComplementary = [...updatedComplementary, params.extraMethodology].slice(-maxSlots);
  } else if (params.newDuration === '5_MIN') {
    updatedComplementary = [];
  }

  const resolution = resolvePipelineMethodology(
    params.activeStudyQuery,
    params.primaryMetodologia,
    params.newDuration,
    updatedComplementary
  );

  const { finalDerasha, enrichedSources } = await executePhase3DerashaSynthesis({
    effectiveQuery: params.activeStudyQuery,
    resolvedMethodology: params.primaryMetodologia,
    complementaryMethodologies: resolution.complementaryMethodologies,
    duracion: params.newDuration,
    audienciaOTono: params.audienciaOTono,
    tonoHomiletico: params.tonoHomiletico,
    phase1Data: params.phase1Data,
    verifiedSources: params.verifiedSources,
  });

  return {
    finalDerasha,
    enrichedSources,
    updatedComplementary,
    resolvedComplementary: resolution.complementaryMethodologies,
  };
}

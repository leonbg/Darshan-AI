import {
  DerashaDuration,
  DerashaMethodology,
  DerashaOutputPreferences,
  DerashaTone,
  FinalDerasha,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
} from '../../types';

export interface PrewarmedPipelineCache {
  query: string;
  phase1Data: Phase1AnalysisResult;
  verifiedSources: VerifiedSefariaSource[];
}

export interface Phase1And2PipelineParams {
  effectiveQuery: string;
  requestedMethodology: DerashaMethodology;
  duracion: DerashaDuration;
  metodologiasComplementarias: DerashaMethodology[];
  audienciaOTono: string;
  tonoHomiletico?: DerashaTone;
  maxRefs?: number;
  signal?: AbortSignal;
  onStageChange?: (stage: 'phase1_morphology' | 'phase2_sefaria') => void;
  onPhase1Complete?: (phase1Data: Phase1AnalysisResult) => void;
  onSefariaProgress?: (current: number, total: number) => void;
}

export interface Phase1And2PipelineResult {
  phase1Data: Phase1AnalysisResult;
  verifiedSources: VerifiedSefariaSource[];
  resolvedMethodology: DerashaMethodology;
  complementaryMethodologies: DerashaMethodology[];
}

export interface ResolveOrExecutePhase1And2Params extends Phase1And2PipelineParams {
  prewarmedCache: PrewarmedPipelineCache | null;
  inFlightPrewarmPromise: Promise<PrewarmedPipelineCache | null> | null;
  logicGateExplanation: string;
  isRunStillActive: () => boolean;
  onUpdatePrewarmCache: (cache: PrewarmedPipelineCache) => void;
}

export interface ResolveOrExecutePhase1And2Result extends Phase1And2PipelineResult {
  loadedViaPrewarm: boolean;
  cancelled: boolean;
}

export interface Phase3DerashaSynthesisParams {
  effectiveQuery: string;
  resolvedMethodology: DerashaMethodology;
  complementaryMethodologies: DerashaMethodology[];
  duracion: DerashaDuration;
  audienciaOTono: string;
  tonoHomiletico?: DerashaTone;
  outputPreferences?: DerashaOutputPreferences;
  phase1Data: Phase1AnalysisResult;
  verifiedSources: VerifiedSefariaSource[];
  fallbackThinkerDetection?: Phase1AnalysisResult['externalThinkerDetection'];
  signal?: AbortSignal;
}

export interface Phase3DerashaSynthesisResult {
  finalDerasha: FinalDerasha;
  enrichedSources: VerifiedSefariaSource[];
}

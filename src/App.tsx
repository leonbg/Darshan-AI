import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Header, type WorkspaceTab } from './components/layout/Header';
import { WorkspaceNavigationBar } from './components/layout/WorkspaceNavigationBar';
import { OfflineIndicator } from './components/layout/OfflineIndicator';
import type { ExportScope } from './utils/export/shared';
import type { SettingsModalTab } from './components/layout/SettingsModal';
import { InputSection } from './components/pipeline/InputSection';
import { PhaseProgressIndicator } from './components/pipeline/PhaseProgressIndicator';
import {
  QueryClarificationNotice,
  type ClarificationState,
  buildRefinementsForQuery,
} from './components/pipeline/QueryClarificationNotice';
import type { HubTab } from './components/discovery/SuggestedTopicsHub';

const AboutModal = lazy(() =>
  import('./components/layout/AboutModal').then((m) => ({ default: m.AboutModal }))
);
const UserManualModal = lazy(() =>
  import('./components/layout/UserManualModal').then((m) => ({ default: m.UserManualModal }))
);
const ExportModal = lazy(() =>
  import('./components/layout/ExportModal').then((m) => ({ default: m.ExportModal }))
);
const SettingsModal = lazy(() =>
  import('./components/layout/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const ActiveDerashaWorkspaceView = lazy(() =>
  import('./components/pipeline/ActiveDerashaWorkspaceView').then((m) => ({
    default: m.ActiveDerashaWorkspaceView,
  }))
);
const SuggestedTopicsHub = lazy(() =>
  import('./components/discovery/SuggestedTopicsHub').then((m) => ({
    default: m.SuggestedTopicsHub,
  }))
);
const DerashotArchiveHub = lazy(() =>
  import('./components/archive/DerashotArchiveHub').then((m) => ({
    default: m.DerashotArchiveHub,
  }))
);
import {
  useAtrilPreferences,
  useTorahCalendar,
  useArchiveAndComparator,
  buildSyntheticStudyFromArchivedEntry,
  useSafePoints,
  useDerashaOutputPreferences,
} from './hooks';
import { SampleQuery } from './data/samples';
import {
  checkServerHealth,
  requestDecideMethodology,
  requestExpandDerasha,
  requestTranslateSource,
  requestTranslateSourcesBatch,
  requestMasterReadings,
  evaluateSourceTranslationStatus,
  buildAndSaveDerashaToArchive,
  parseCrossDerashaComparisonCommand,
  LAST_STUDY_STORAGE_KEY,
  createSystemSafePoint,
} from './services';
import {
  enrichQueryWithCalendar,
  isQueryTooBroadOrAmbiguous,
  shouldAutoPrewarmQuery,
  executePhase1And2Pipeline,
  executeDurationOrComplementaryResynthesis,
  executeFullDerashaPipeline,
  isPipelineTimeoutOrUnavailableError,
} from './services/pipeline';
import {
  Phase1AnalysisResult,
  VerifiedSefariaSource,
  FinalDerasha,
  PipelineStage,
  FollowUpItem,
  DerashaMethodology,
  DerashaDuration,
  DerashaTone,
  MethodologyDeliberationResult,
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
  MishnatHaDorotQuote,
} from './types';
import { composeAudienceAndTone } from './utils/toneAdvisor';
import {
  areOutputPreferencesEqual,
  DEFAULT_DERASHA_OUTPUT_PREFERENCES,
} from './utils/outputPreferences';
import { isPredominantlyHebrew } from './utils/bidiText';
import { AlertTriangle, ShieldCheck, RotateCcw, HardDrive, RefreshCw, X } from 'lucide-react';
import { clearLocalAppStorageForDriveMode } from './services';

export default function App() {
  const [query, setQuery] = useState('');
  const [completedStudyQuery, setCompletedStudyQuery] = useState('');
  const [metodologia, setMetodologia] = useState<DerashaMethodology>('AUTO');
  const [duracion, setDuracion] = useState<DerashaDuration>('10_MIN');
  const [metodologiasComplementarias, setMetodologiasComplementarias] = useState<
    DerashaMethodology[]
  >([]);
  const [audienciaOTono, setAudienciaOTono] = useState<string>(
    'Comunidad general · Tono automático según el tema'
  );
  const [tonoHomiletico, setTonoHomiletico] = useState<DerashaTone>('AUTO');
  const [isRtl, setIsRtl] = useState(false);

  // Modal states
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isUserManualOpen, setIsUserManualOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsModalTab>('typography');
  const [exportScope, setExportScope] = useState<ExportScope>('full_derasha');

  // Requested tab in SuggestedTopicsHub when clicking Header navigation links
  const [requestedHubTab, setRequestedHubTab] = useState<{ tab: HubTab; timestamp: number } | null>(
    null
  );

  // Top-level Workspace Mode ('estudio' | 'calendario' | 'archivo' | 'todo')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceTab>('estudio');
  const [homeResetSignal, setHomeResetSignal] = useState<number>(0);
  const [isHomeTapArmed, setIsHomeTapArmed] = useState<boolean>(false);
  const lastClearTapAtRef = useRef<number>(0);
  const clearArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom Hook: Lectern / Bima Typography & Reading Scale Preferences
  const {
    readingScale,
    atrilTypography,
    handleSelectAtrilTypography,
    handleSelectReadingScale,
    cycleReadingScale,
    typographyClass,
    scaleClass,
  } = useAtrilPreferences();

  // Custom Hook: PARDES Output Depth, Level Priority & Final Conclusion Length
  const {
    outputPreferences,
    setOutputPreferences,
    setPardesLevelDepth,
    applyAllPardesDepth,
    togglePrioritizedPardesLevel,
    setConclusionLength,
    resetOutputPreferences,
  } = useDerashaOutputPreferences();

  // Custom Hook: Live Hebrew & Liturgical Calendar
  const { calendarData, isLoadingCalendar, loadCalendar } = useTorahCalendar();

  // Custom Hook: Numbered Derashot Archive (#1–#9+) & Dialectical Comparator + Google User & Google Drive Persistence
  const {
    derashotArchive,
    setDerashotArchive,
    comparativeStudies,
    setComparativeStudies,
    selectedCompareNumbers,
    setSelectedCompareNumbers,
    activeComparison,
    setActiveComparison,
    isComparingDerashot,
    firebaseUser,
    driveAccessToken,
    isSigningInFirebase,
    isSyncingDrive,
    driveSyncSummary,
    pendingDriveConfirmation,
    toggleSelectCompareNumber,
    deleteArchivedDerasha,
    requestUpdateDerashaInDrive,
    confirmPendingDriveAction,
    cancelPendingDriveAction,
    syncWithGoogleDriveNow,
    signInGoogle,
    signOutGoogle,
    runDerashaComparison,
  } = useArchiveAndComparator();

  // Pipeline execution state & Long-Wait Rule state
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [sefariaProgress, setSefariaProgress] = useState({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clarificationState, setClarificationState] = useState<ClarificationState | null>(null);
  const [isPreparingGeneration, setIsPreparingGeneration] = useState<boolean>(false);
  const [collapseFanSignal, setCollapseFanSignal] = useState<number>(0);
  const activeRunIdRef = useRef<number>(0);
  const skipNextAutoSaveRef = useRef<boolean>(false);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const clarificationBannerRef = useRef<HTMLDivElement | null>(null);
  const progressSectionRef = useRef<HTMLDivElement | null>(null);

  // Pipeline data
  const [phase1Data, setPhase1Data] = useState<Phase1AnalysisResult | null>(null);
  const [verifiedSources, setVerifiedSources] = useState<VerifiedSefariaSource[]>([]);
  const [finalDerasha, setFinalDerasha] = useState<FinalDerasha | null>(null);

  // Decoupled Methodology Deliberation & Background Pre-Warmed Cache
  const [deliberationResult, setDeliberationResult] =
    useState<MethodologyDeliberationResult | null>(null);
  const [isDeliberatingMethodology, setIsDeliberatingMethodology] = useState<boolean>(false);
  const [isPrewarmingSources, setIsPrewarmingSources] = useState<boolean>(false);
  const [isMethodologyFanOpen, setIsMethodologyFanOpen] = useState<boolean>(false);
  const [methodologyDecisionSeconds, setMethodologyDecisionSeconds] = useState<number>(0);
  const [prewarmedCache, setPrewarmedCache] = useState<{
    query: string;
    phase1Data: Phase1AnalysisResult;
    verifiedSources: VerifiedSefariaSource[];
  } | null>(null);
  const deliberationAbortRef = useRef<AbortController | null>(null);
  const pipelineAbortRef = useRef<AbortController | null>(null);
  const inFlightPrewarmPromiseRef = useRef<{
    query: string;
    promise: Promise<{
      query: string;
      phase1Data: Phase1AnalysisResult;
      verifiedSources: VerifiedSefariaSource[];
    } | null>;
  } | null>(null);

  // Translation, Masters & Follow-up states
  const [translatingRef, setTranslatingRef] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [isRegeneratingDuration, setIsRegeneratingDuration] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);

  // Keep a latest-value ref of rapidly changing state so memoized callbacks never recreate unnecessarily
  const latestStateRef = useRef({
    query,
    completedStudyQuery,
    metodologia,
    duracion,
    metodologiasComplementarias,
    audienciaOTono,
    tonoHomiletico,
    outputPreferences,
    calendarData,
    phase1Data,
    verifiedSources,
    finalDerasha,
    followUps,
    derashotArchive,
    comparativeStudies,
    prewarmedCache,
    deliberationResult,
    clarificationState,
    requestedHubTab,
  });
  latestStateRef.current = {
    query,
    completedStudyQuery,
    metodologia,
    duracion,
    metodologiasComplementarias,
    audienciaOTono,
    tonoHomiletico,
    outputPreferences,
    calendarData,
    phase1Data,
    verifiedSources,
    finalDerasha,
    followUps,
    derashotArchive,
    comparativeStudies,
    prewarmedCache,
    deliberationResult,
    clarificationState,
    requestedHubTab,
  };

  // Custom Hook: System Safe Points (Golden Baseline + Auto + Manual Snapshots)
  const {
    safePoints,
    refreshSafePoints,
    createManualSafePoint,
    restoreSafePoint,
    deleteSafePoint,
    importSafePointJson,
    runVerifyAndRepair,
  } = useSafePoints({
    onRestoredSnapshot: (restored) => {
      activeRunIdRef.current += 1;
      setDerashotArchive(restored.payload.archive);
      setComparativeStudies(restored.payload.comparativeStudies);
      if (restored.payload.activeStudy) {
        const act = restored.payload.activeStudy;
        setQuery(act.query);
        setCompletedStudyQuery(act.query);
        setMetodologia(act.metodologia);
        setDuracion(act.duracion);
        setMetodologiasComplementarias(act.metodologiasComplementarias || []);
        setAudienciaOTono(act.audienciaOTono);
        if (act.tonoHomiletico) setTonoHomiletico(act.tonoHomiletico);
        setPhase1Data(act.phase1Data);
        setVerifiedSources(act.verifiedSources || []);
        setFinalDerasha(act.finalDerasha);
        setFollowUps(act.followUps || []);
        skipNextAutoSaveRef.current = true;
        setStage('complete');
      } else {
        setStage('idle');
      }
      setErrorMessage(null);
      setClarificationState(null);
    },
    onRepairedState: (repairedArchive, repairedComp) => {
      setDerashotArchive(repairedArchive);
      setComparativeStudies(repairedComp);
    },
  });

  // Load server health & restore last active study on mount
  useEffect(() => {
    checkServerHealth().catch(() => {});

    try {
      localStorage.removeItem('darshan_last_study_v1');
      const saved = localStorage.getItem(LAST_STUDY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.finalDerasha && parsed?.phase1Data) {
          if (parsed.query) {
            setQuery(parsed.query);
            setCompletedStudyQuery(parsed.query);
          }
          if (parsed.metodologia && parsed.metodologia !== 'FILOSOFIA_CONTRASTIVA') {
            setMetodologia(parsed.metodologia);
          } else {
            setMetodologia('AUTO');
          }
          if (parsed.duracion) setDuracion(parsed.duracion);
          if (Array.isArray(parsed.metodologiasComplementarias)) {
            setMetodologiasComplementarias(parsed.metodologiasComplementarias);
          }
          if (parsed.audienciaOTono) setAudienciaOTono(parsed.audienciaOTono);
          if (parsed.tonoHomiletico) setTonoHomiletico(parsed.tonoHomiletico);
          if (parsed.outputPreferences) {
            setOutputPreferences(parsed.outputPreferences);
          } else if (parsed.finalDerasha?.outputPreferences) {
            setOutputPreferences(parsed.finalDerasha.outputPreferences);
          }
          setPhase1Data(parsed.phase1Data);
          setVerifiedSources(Array.isArray(parsed.verifiedSources) ? parsed.verifiedSources : []);
          setFinalDerasha(parsed.finalDerasha);
          setFollowUps(Array.isArray(parsed.followUps) ? parsed.followUps : []);
          skipNextAutoSaveRef.current = true;
          setStage('complete');
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [setOutputPreferences]);

  // Persist completed study in localStorage, save/update in the numbered Derashot Archive, and refresh Auto Safe Point
  useEffect(() => {
    if (stage === 'complete' && finalDerasha && phase1Data) {
      if (skipNextAutoSaveRef.current) {
        skipNextAutoSaveRef.current = false;
        return;
      }

      const studyQueryToSave = completedStudyQuery || query;
      const savedAt = new Date().toISOString();
      const activeSnapshot = {
        query: studyQueryToSave,
        metodologia,
        duracion,
        metodologiasComplementarias,
        audienciaOTono,
        tonoHomiletico,
        outputPreferences: finalDerasha.outputPreferences || outputPreferences,
        phase1Data,
        verifiedSources,
        finalDerasha,
        followUps,
        savedAt,
      };
      if (driveAccessToken) {
        clearLocalAppStorageForDriveMode();
      } else {
        try {
          localStorage.setItem(LAST_STUDY_STORAGE_KEY, JSON.stringify(activeSnapshot));
        } catch {
          // ignore quota errors
        }
      }

      const { updatedArchive } = buildAndSaveDerashaToArchive(
        latestStateRef.current.derashotArchive,
        {
          query: studyQueryToSave,
          methodology: finalDerasha.metodologia || metodologia,
          complementaryMethodologies:
            finalDerasha.metodologiasComplementarias || metodologiasComplementarias,
          duration: finalDerasha.duracion || duracion,
          audienceOrTone: finalDerasha.audienciaOTono || audienciaOTono,
          phase1Data,
          verifiedSources,
          finalDerasha,
          followUps,
        }
      );

      setDerashotArchive(updatedArchive);
      createSystemSafePoint({
        triggerType: 'auto',
        archive: updatedArchive,
        comparativeStudies: latestStateRef.current.comparativeStudies,
        activeStudy: activeSnapshot,
      });
      refreshSafePoints();
    }
  }, [
    stage,
    completedStudyQuery,
    metodologia,
    duracion,
    metodologiasComplementarias,
    audienciaOTono,
    phase1Data,
    verifiedSources,
    finalDerasha,
    followUps,
    driveAccessToken,
    refreshSafePoints,
    setDerashotArchive,
  ]);

  // Memoized derived pipeline values
  const isLoading = useMemo(
    () =>
      stage === 'phase1_morphology' || stage === 'phase2_sefaria' || stage === 'phase3_derasha',
    [stage]
  );

  const lessonElaborationBudgetSeconds = useMemo(
    () => (duracion === '30_MIN' ? 180 : duracion === '10_MIN' ? 150 : 120),
    [duracion]
  );

  const maxWaitForCurrentStage = useMemo(
    () => (stage === 'phase3_derasha' ? lessonElaborationBudgetSeconds : 120),
    [stage, lessonElaborationBudgetSeconds]
  );

  const effectivePreviewQuery = useMemo(
    () => enrichQueryWithCalendar(query.trim(), calendarData),
    [query, calendarData]
  );

  const isPrewarmedReadyForCurrentQuery = useMemo(
    () =>
      Boolean(
        prewarmedCache &&
          prewarmedCache.query === effectivePreviewQuery &&
          prewarmedCache.verifiedSources.length > 0
      ),
    [prewarmedCache, effectivePreviewQuery]
  );

  const activeStudyTitle = useMemo(
    () => finalDerasha?.derashaTitle || phase1Data?.title,
    [finalDerasha?.derashaTitle, phase1Data?.title]
  );

  const effectiveStudyQueryForActiveDerasha = useMemo(
    () => completedStudyQuery || finalDerasha?.derashaTitle || phase1Data?.title || '',
    [completedStudyQuery, finalDerasha?.derashaTitle, phase1Data?.title]
  );

  // Separate clock that tracks time spent choosing/evaluating methodologies while the fan is open
  useEffect(() => {
    if ((!isMethodologyFanOpen && !isDeliberatingMethodology) || isLoading) {
      return;
    }
    const timer = setInterval(() => {
      setMethodologyDecisionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isMethodologyFanOpen, isDeliberatingMethodology, isLoading]);

  const handleStageTimeout = useCallback(() => {
    const st = latestStateRef.current;
    const currentQ = st.query;
    const activeTitle = st.finalDerasha?.derashaTitle || st.phase1Data?.title;
    const activeQ = st.completedStudyQuery;
    activeRunIdRef.current += 1;
    pipelineAbortRef.current?.abort();
    pipelineAbortRef.current = null;
    setStage('idle');
    setClarificationState({
      mode: 'timeout_unavailable',
      originalQuery: currentQ,
      activeStudyTitle: activeTitle,
      activeStudyQuery: activeQ,
      reason:
        'No hay respuestas disponibles de momento porque la fase actual superó el tiempo máximo de espera. Puedes elegir una formulación más acotada aquí abajo para obtener respuesta inmediata, o volver a intentarlo.',
      suggestedRefinements: buildRefinementsForQuery(currentQ, {
        title: activeTitle,
        query: activeQ,
      }),
    });
  }, []);

  // Helper to start or reuse background pre-warming of Phase 1 & Phase 2
  const getOrStartPrewarmPromise = useCallback((effectiveQuery: string) => {
    const {
      prewarmedCache: currentCache,
      metodologia: currentMethod,
      metodologiasComplementarias: currentComp,
      audienciaOTono: currentAudience,
      tonoHomiletico: currentTone,
    } = latestStateRef.current;

    if (
      currentCache &&
      currentCache.query === effectiveQuery &&
      currentCache.verifiedSources.length > 0
    ) {
      return Promise.resolve(currentCache);
    }

    if (
      inFlightPrewarmPromiseRef.current &&
      inFlightPrewarmPromiseRef.current.query === effectiveQuery
    ) {
      return inFlightPrewarmPromiseRef.current.promise;
    }

    setIsPrewarmingSources(true);
    const promise = executePhase1And2Pipeline({
      effectiveQuery,
      requestedMethodology: currentMethod,
      duracion: '30_MIN',
      metodologiasComplementarias: currentComp,
      audienciaOTono: currentAudience,
      tonoHomiletico: currentTone,
      maxRefs: 6,
    })
      .then((res) => {
        const built = {
          query: effectiveQuery,
          phase1Data: res.phase1Data,
          verifiedSources: res.verifiedSources,
        };
        setPrewarmedCache(built);
        return built;
      })
      .catch(() => null)
      .finally(() => {
        if (inFlightPrewarmPromiseRef.current?.query === effectiveQuery) {
          inFlightPrewarmPromiseRef.current = null;
        }
        setIsPrewarmingSources(false);
      });

    inFlightPrewarmPromiseRef.current = { query: effectiveQuery, promise };
    return promise;
  }, []);

  // Automatic debounced background pre-warming (750ms after typing or selecting a valid study query)
  useEffect(() => {
    if (isLoading) return;
    const trimmed = query.trim();
    if (!trimmed || !shouldAutoPrewarmQuery(trimmed)) return;
    // Do not fire background AI prewarm when the input simply displays a restored/completed study
    if (stage === 'complete' && finalDerasha && trimmed === completedStudyQuery.trim()) {
      return;
    }
    const effectiveQuery = enrichQueryWithCalendar(trimmed, calendarData);
    if (
      prewarmedCache &&
      prewarmedCache.query === effectiveQuery &&
      prewarmedCache.verifiedSources.length > 0
    ) {
      return;
    }

    const debounceTimer = setTimeout(() => {
      getOrStartPrewarmPromise(effectiveQuery);
    }, 750);

    return () => clearTimeout(debounceTimer);
  }, [
    query,
    isLoading,
    stage,
    finalDerasha,
    completedStudyQuery,
    calendarData,
    prewarmedCache,
    getOrStartPrewarmPromise,
  ]);

  // Stable UI & Modal Callbacks
  const handleOpenAboutModal = useCallback(() => setIsAboutModalOpen(true), []);
  const handleCloseAboutModal = useCallback(() => setIsAboutModalOpen(false), []);
  const handleOpenUserManualModal = useCallback(() => setIsUserManualOpen(true), []);
  const handleCloseUserManualModal = useCallback(() => setIsUserManualOpen(false), []);
  const handleCloseExportModal = useCallback(() => setIsExportModalOpen(false), []);
  const handleOpenSettingsModal = useCallback(() => {
    setSettingsInitialTab('typography');
    setIsSettingsModalOpen(true);
  }, []);
  const handleCloseSettingsModal = useCallback(() => setIsSettingsModalOpen(false), []);
  const handleOpenSafePointModal = useCallback(() => {
    setSettingsInitialTab('backup');
    setIsSettingsModalOpen(true);
  }, []);
  const handleOpenExportWithScope = useCallback((scope: ExportScope) => {
    setExportScope(scope);
    setIsExportModalOpen(true);
  }, []);

  // Global Keyboard Shortcuts: ? or F1 opens Help Manual outside text inputs; Escape closes active modals
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserManualOpen(false);
        setIsAboutModalOpen(false);
        setIsExportModalOpen(false);
        setIsSettingsModalOpen(false);
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(target?.isContentEditable);

      if (isTyping) return;

      if (event.key === 'F1' || (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault();
        setIsUserManualOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Ensure error, clarification, and progress notices scroll cleanly into view instead of hiding below the fold
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    if (!clarificationState) return;
    const timer = setTimeout(() => {
      clarificationBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return () => clearTimeout(timer);
  }, [clarificationState]);

  const handleToggleAtrilConfig = useCallback(() => {
    setSettingsInitialTab('typography');
    setIsSettingsModalOpen(true);
  }, []);
  const handleToggleRtl = useCallback(() => setIsRtl((prev) => !prev), []);

  const handleChangeWorkspaceMode = useCallback((nextMode: WorkspaceTab) => {
    setWorkspaceMode(nextMode);
    if (nextMode === 'calendario' && !latestStateRef.current.requestedHubTab) {
      setRequestedHubTab({ tab: 'parasha', timestamp: Date.now() });
    }
  }, []);

  const handleReturnToHome = useCallback(() => {
    activeRunIdRef.current += 1;
    pipelineAbortRef.current?.abort();
    pipelineAbortRef.current = null;
    deliberationAbortRef.current?.abort();
    deliberationAbortRef.current = null;
    inFlightPrewarmPromiseRef.current = null;

    setQuery('');
    setCompletedStudyQuery('');
    setClarificationState(null);
    setErrorMessage(null);
    setStage('idle');
    setSefariaProgress({ current: 0, total: 0 });
    setPhase1Data(null);
    setVerifiedSources([]);
    setFinalDerasha(null);
    setFollowUps([]);
    setDeliberationResult(null);
    setIsDeliberatingMethodology(false);
    setIsPrewarmingSources(false);
    setIsMethodologyFanOpen(false);
    setMethodologyDecisionSeconds(0);
    setPrewarmedCache(null);

    setActiveComparison(null);
    setSelectedCompareNumbers([]);
    cancelPendingDriveAction();

    setIsAboutModalOpen(false);
    setIsUserManualOpen(false);
    setIsExportModalOpen(false);
    setIsSettingsModalOpen(false);

    setWorkspaceMode('estudio');
    setRequestedHubTab(null);
    setHomeResetSignal((n) => n + 1);

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const el = document.getElementById('query-input') as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
      }
    }, 40);
  }, [setActiveComparison, setSelectedCompareNumbers, cancelPendingDriveAction]);

  useEffect(() => {
    return () => {
      if (clearArmTimerRef.current) {
        clearTimeout(clearArmTimerRef.current);
      }
    };
  }, []);

  const handleClearOrDoubleTapHome = useCallback(() => {
    const now = Date.now();
    const isSecondTap = now - lastClearTapAtRef.current <= 2200;

    if (clearArmTimerRef.current) {
      clearTimeout(clearArmTimerRef.current);
      clearArmTimerRef.current = null;
    }

    if (isSecondTap) {
      lastClearTapAtRef.current = 0;
      setIsHomeTapArmed(false);
      handleReturnToHome();
      return;
    }

    // 1st tap: Clear the query box and arm a 2nd-tap window to return to start
    setQuery('');
    if (latestStateRef.current.clarificationState) {
      setClarificationState(null);
    }
    lastClearTapAtRef.current = now;
    setIsHomeTapArmed(true);

    const inputEl = document.getElementById('query-input') as HTMLTextAreaElement | null;
    if (inputEl) {
      inputEl.focus();
    }

    clearArmTimerRef.current = setTimeout(() => {
      lastClearTapAtRef.current = 0;
      setIsHomeTapArmed(false);
      clearArmTimerRef.current = null;
    }, 2200);
  }, [handleReturnToHome]);

  const handleChangeQuery = useCallback((val: string) => {
    setQuery(val);
    if (latestStateRef.current.clarificationState) {
      setClarificationState(null);
    }
    setErrorMessage(null);
  }, []);

  const handleSelectSample = useCallback((sample: SampleQuery) => {
    setQuery(sample.query);
    setIsRtl(isPredominantlyHebrew(sample.query));
  }, []);

  const handleNavigateSection = useCallback(
    (target: 'study' | 'archive' | 'topics' | 'musar') => {
      if (target === 'study') {
        setWorkspaceMode('estudio');
        setTimeout(() => {
          const el = document.getElementById('query-input');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
        }, 60);
      } else if (target === 'archive') {
        setWorkspaceMode('archivo');
        setTimeout(() => {
          const el = document.getElementById('derashot-archive-section');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      } else if (target === 'topics') {
        setWorkspaceMode('calendario');
        setRequestedHubTab({ tab: 'parasha', timestamp: Date.now() });
        setTimeout(() => {
          const el = document.getElementById('suggested-topics-hub');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      } else if (target === 'musar') {
        setWorkspaceMode('calendario');
        setRequestedHubTab({ tab: 'musar', timestamp: Date.now() });
        setTimeout(() => {
          const el = document.getElementById('suggested-topics-hub');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
    },
    []
  );

  const handleQuickOpenTab = useCallback((tab: HubTab) => {
    setWorkspaceMode('calendario');
    setRequestedHubTab({ tab, timestamp: Date.now() });
    setTimeout(() => {
      const el = document.getElementById('suggested-topics-hub');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }, []);

  const handleQuickOpenArchive = useCallback(() => {
    setWorkspaceMode('archivo');
    setTimeout(() => {
      const el = document.getElementById('derashot-archive-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  const handleRunDerashaComparison = useCallback(
    async (params: {
      numbers: number[];
      relationType: DerashaRelationType;
      userHypothesis: string;
    }) => {
      await runDerashaComparison(params, {
        onSwitchToArchiveTab: () => setWorkspaceMode('archivo'),
        onError: (msg) => setErrorMessage(msg),
      });
    },
    [runDerashaComparison]
  );

  const handleRunCrossComparisonFromInput = useCallback(
    (params: {
      numbers: number[];
      relationType: DerashaRelationType;
      userHypothesis: string;
    }) => {
      setSelectedCompareNumbers(params.numbers);
      handleRunDerashaComparison(params);
    },
    [setSelectedCompareNumbers, handleRunDerashaComparison]
  );

  const handleOpenArchivedDerasha = useCallback((entry: ArchivedDerashaEntry) => {
    setWorkspaceMode('estudio');
    setQuery(entry.query);
    setCompletedStudyQuery(entry.query);
    setMetodologia(
      entry.methodology && entry.methodology !== 'FILOSOFIA_CONTRASTIVA'
        ? entry.methodology
        : 'AUTO'
    );
    setDuracion(entry.duration || '10_MIN');
    setAudienciaOTono(entry.audienceOrTone || 'Comunidad general · Inspirador y práctico');
    setClarificationState(null);
    setErrorMessage(null);

    if (entry.finalDerasha && entry.phase1Data) {
      setPhase1Data(entry.phase1Data);
      setVerifiedSources(entry.verifiedSources || []);
      setFinalDerasha(entry.finalDerasha);
      setFollowUps(entry.followUps || []);
      skipNextAutoSaveRef.current = true;
      setStage('complete');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const { phase1Data: syntheticPhase1, finalDerasha: syntheticDerasha } =
      buildSyntheticStudyFromArchivedEntry(entry);

    setPhase1Data(syntheticPhase1);
    setVerifiedSources([]);
    setFinalDerasha(syntheticDerasha);
    setFollowUps(entry.followUps || []);
    skipNextAutoSaveRef.current = true;
    setStage('complete');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCreateManualSafePoint = useCallback(
    (label: string, description: string) => {
      const st = latestStateRef.current;
      createManualSafePoint({
        label,
        description,
        archive: st.derashotArchive,
        comparativeStudies: st.comparativeStudies,
        activeStudy:
          st.finalDerasha && st.phase1Data
            ? {
                query: st.completedStudyQuery || st.query,
                metodologia: st.metodologia,
                duracion: st.duracion,
                metodologiasComplementarias: st.metodologiasComplementarias,
                audienciaOTono: st.audienciaOTono,
                tonoHomiletico: st.tonoHomiletico,
                phase1Data: st.phase1Data,
                verifiedSources: st.verifiedSources,
                finalDerasha: st.finalDerasha,
                followUps: st.followUps,
                savedAt: new Date().toISOString(),
              }
            : null,
      });
    },
    [createManualSafePoint]
  );

  const handleRestoreDefaultSafePoint = useCallback(() => {
    restoreSafePoint();
  }, [restoreSafePoint]);

  const handleCancelAndRequestClarification = useCallback(() => {
    const st = latestStateRef.current;
    const currentQ = st.query;
    const activeTitle = st.finalDerasha?.derashaTitle || st.phase1Data?.title;
    const activeQ = st.completedStudyQuery;
    activeRunIdRef.current += 1;
    setStage('idle');
    setClarificationState({
      mode: 'clarification_needed',
      originalQuery: currentQ,
      activeStudyTitle: activeTitle,
      activeStudyQuery: activeQ,
      reason:
        'Se ha detenido la espera prolongada. Para obtener una respuesta mucho más ágil y centrada en fuentes exactas de Sefaria y Jazal, te sugerimos precisar el ángulo de tu pregunta:',
      suggestedRefinements: buildRefinementsForQuery(currentQ, {
        title: activeTitle,
        query: activeQ,
      }),
    });
  }, []);

  const handleDismissClarification = useCallback(() => {
    setClarificationState(null);
    const inputEl = document.getElementById('query-input');
    if (inputEl) inputEl.focus();
  }, []);

  const handleRequestClarificationFromInput = useCallback(() => {
    const st = latestStateRef.current;
    const trimmed = st.query.trim();
    const activeTitle = st.finalDerasha?.derashaTitle || st.phase1Data?.title;
    const activeQ = st.completedStudyQuery;
    const baseInput = trimmed || activeQ || activeTitle || '';
    if (!baseInput) return;
    const effectiveQuery = enrichQueryWithCalendar(baseInput, st.calendarData);
    setClarificationState({
      mode: 'clarification_needed',
      originalQuery: effectiveQuery,
      activeStudyTitle: activeTitle,
      activeStudyQuery: activeQ,
      reason:
        'Selecciona el ángulo específico o la Puerta Lógica metodológica con la que deseas abordar tu estudio:',
      suggestedRefinements: buildRefinementsForQuery(effectiveQuery, {
        title: activeTitle,
        query: activeQ,
      }),
    });
  }, []);

  // Decoupled Methodology Deliberation + Background Pre-Warming of Phase 1 & Phase 2
  const handleDeliberateAndPrewarm = useCallback(async () => {
    const { query: rawQ, calendarData: cal, tonoHomiletico: currentTone } = latestStateRef.current;
    const trimmed = rawQ.trim();
    if (!trimmed) return;
    const effectiveQuery = enrichQueryWithCalendar(trimmed, cal);

    if (deliberationAbortRef.current) {
      deliberationAbortRef.current.abort();
    }
    const abortController = new AbortController();
    deliberationAbortRef.current = abortController;

    setErrorMessage(null);
    setIsDeliberatingMethodology(true);

    const deliberationPromise = requestDecideMethodology(
      effectiveQuery,
      abortController.signal,
      currentTone
    )
      .then((res) => {
        if (!abortController.signal.aborted) {
          setDeliberationResult({ ...res, query: trimmed });
        }
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || abortController.signal.aborted) return;
        setErrorMessage(
          err?.message || 'No se pudo completar la deliberación metodológica en este momento.'
        );
      })
      .finally(() => {
        if (deliberationAbortRef.current === abortController) {
          deliberationAbortRef.current = null;
        }
        setIsDeliberatingMethodology(false);
      });

    const prewarmPromise = shouldAutoPrewarmQuery(trimmed)
      ? getOrStartPrewarmPromise(effectiveQuery)
      : Promise.resolve(null);

    await Promise.all([deliberationPromise, prewarmPromise]);
  }, [getOrStartPrewarmPromise]);

  // Main 3-Phase Execution Pipeline
  const handleGenerateDerasha = useCallback(
    async (
      overrideQuery?: string,
      forceExecution = false,
      overrideMetodologia?: DerashaMethodology
    ) => {
      const st = latestStateRef.current;
      const activeQuery = typeof overrideQuery === 'string' ? overrideQuery : st.query;
      const requestedMethodology = overrideMetodologia || st.metodologia;
      if (!activeQuery.trim()) return;

      // Intercept natural-language requests comparing numbered Derashot
      const crossDerashaCmd = parseCrossDerashaComparisonCommand(activeQuery);
      if (crossDerashaCmd && crossDerashaCmd.isCrossDerashaComparison) {
        setSelectedCompareNumbers(crossDerashaCmd.numbers);
        setWorkspaceMode('archivo');
        await handleRunDerashaComparison({
          numbers: crossDerashaCmd.numbers,
          relationType: crossDerashaCmd.relationType,
          userHypothesis: crossDerashaCmd.userHypothesis,
        });
        return;
      }

      setWorkspaceMode('estudio');
      setCollapseFanSignal((n) => n + 1);

      if (deliberationAbortRef.current) {
        deliberationAbortRef.current.abort();
        deliberationAbortRef.current = null;
        setIsDeliberatingMethodology(false);
      }

      const effectiveQuery = enrichQueryWithCalendar(activeQuery.trim(), st.calendarData);
      if (effectiveQuery !== activeQuery.trim()) {
        setQuery(effectiveQuery);
      }

      if (!forceExecution && isQueryTooBroadOrAmbiguous(effectiveQuery)) {
        const activeTitle = st.finalDerasha?.derashaTitle || st.phase1Data?.title;
        const activeQ = st.completedStudyQuery;
        setErrorMessage(null);
        setClarificationState({
          mode: 'clarification_needed',
          originalQuery: effectiveQuery,
          activeStudyTitle: activeTitle,
          activeStudyQuery: activeQ,
          reason:
            'Tu consulta es muy breve o general. Para evitar una espera muy larga y poder consultar los textos exactos en el Tanaj, el Talmud y Sefaria, por favor aclara qué aspecto específico deseas estudiar:',
          suggestedRefinements: buildRefinementsForQuery(effectiveQuery, {
            title: activeTitle,
            query: activeQ,
          }),
        });
        return;
      }

      const currentRunId = activeRunIdRef.current + 1;
      activeRunIdRef.current = currentRunId;
      pipelineAbortRef.current?.abort();
      const pipelineController = new AbortController();
      pipelineAbortRef.current = pipelineController;

      setClarificationState(null);
      setErrorMessage(null);
      setIsPreparingGeneration(true);

      try {
        // Phase 0: Calibrated semantic methodology, tone, and specificity evaluation
        let calibratedDecision =
          st.deliberationResult &&
          (st.deliberationResult.query.trim().toLowerCase() === activeQuery.trim().toLowerCase() ||
            st.deliberationResult.query.trim().toLowerCase() === effectiveQuery.trim().toLowerCase())
            ? st.deliberationResult
            : null;

        const queryWordCount = effectiveQuery.split(/\s+/).filter(Boolean).length;
        const needsPhase0Calibration =
          !calibratedDecision &&
          (requestedMethodology === 'AUTO' || (!forceExecution && queryWordCount <= 3));

        if (needsPhase0Calibration) {
          setIsDeliberatingMethodology(true);
          try {
            const evaluated = await requestDecideMethodology(
              effectiveQuery,
              pipelineController.signal,
              st.tonoHomiletico
            );
            if (activeRunIdRef.current !== currentRunId) return;
            calibratedDecision = { ...evaluated, query: effectiveQuery };
            setDeliberationResult(calibratedDecision);
          } finally {
            if (activeRunIdRef.current === currentRunId) {
              setIsDeliberatingMethodology(false);
            }
          }
        }

        if (
          !forceExecution &&
          calibratedDecision?.decisionCalibration?.needsClarification
        ) {
          const activeTitle = st.finalDerasha?.derashaTitle || st.phase1Data?.title;
          const activeQ = st.completedStudyQuery;
          const specLabel = calibratedDecision.decisionCalibration.specificityLevelLabel;
          const specPct = calibratedDecision.decisionCalibration.specificityNormalized;
          setClarificationState({
            mode: 'clarification_needed',
            originalQuery: effectiveQuery,
            activeStudyTitle: activeTitle,
            activeStudyQuery: activeQ,
            reason: `Tu consulta («${effectiveQuery}») fue evaluada como ${specLabel.toLowerCase()} (${specPct}% de especificidad). Acotar el ángulo permitirá recuperar pasajes exactos en Sefaria y ofrecerte una Drashá mucho más precisa y veloz:`,
            suggestedRefinements: buildRefinementsForQuery(effectiveQuery, {
              title: activeTitle,
              query: activeQ,
            }),
          });
          return;
        }

        const effectivePipelineMethodology: DerashaMethodology =
          requestedMethodology === 'AUTO' && calibratedDecision?.recommendedPrimary
            ? calibratedDecision.recommendedPrimary
            : requestedMethodology;

        const effectivePipelineComplementary: DerashaMethodology[] =
          st.metodologiasComplementarias.length > 0
            ? st.metodologiasComplementarias
            : requestedMethodology === 'AUTO' && calibratedDecision
            ? st.duracion === '30_MIN'
              ? calibratedDecision.recommendedComplementaryFor30Min
              : st.duracion === '10_MIN'
              ? calibratedDecision.recommendedComplementaryFor10Min
              : []
            : st.metodologiasComplementarias;

        const effectivePipelineTone: DerashaTone =
          st.tonoHomiletico === 'AUTO' && calibratedDecision?.recommendedTone
            ? calibratedDecision.recommendedTone
            : st.tonoHomiletico;

        setPhase1Data(null);
        setVerifiedSources([]);
        setFinalDerasha(null);
        setFollowUps([]);
        setCompletedStudyQuery(effectiveQuery);

        const inFlightPrewarmForQuery =
          inFlightPrewarmPromiseRef.current &&
          inFlightPrewarmPromiseRef.current.query === effectiveQuery
            ? inFlightPrewarmPromiseRef.current.promise
            : null;

        const result = await executeFullDerashaPipeline({
          effectiveQuery,
          requestedMethodology: effectivePipelineMethodology,
          duracion: st.duracion,
          metodologiasComplementarias: effectivePipelineComplementary,
          audienciaOTono: st.audienciaOTono,
          tonoHomiletico: effectivePipelineTone,
          outputPreferences: st.outputPreferences,
          prewarmedCache: st.prewarmedCache,
          inFlightPrewarmPromise: inFlightPrewarmForQuery,
          signal: pipelineController.signal,
          isRunStillActive: () => activeRunIdRef.current === currentRunId,
          onStageChange: (nextStage) => {
            if (activeRunIdRef.current === currentRunId) {
              setStage(nextStage);
            }
          },
          onPhase1Complete: (p1) => {
            if (activeRunIdRef.current === currentRunId) {
              setPhase1Data(p1);
            }
          },
          onSourcesReady: (sources) => {
            if (activeRunIdRef.current === currentRunId) {
              setVerifiedSources(sources);
            }
          },
          onSefariaProgress: (current, total) => {
            if (activeRunIdRef.current === currentRunId) {
              setSefariaProgress({ current, total });
            }
          },
          onUpdatePrewarmCache: (cache) => {
            setPrewarmedCache(cache);
          },
        });

        if (result.cancelled || activeRunIdRef.current !== currentRunId || !result.finalDerasha) {
          return;
        }

        setFinalDerasha(result.finalDerasha);
        setStage('complete');
      } catch (err: any) {
        if (err?.name === 'AbortError' || activeRunIdRef.current !== currentRunId) return;
        console.warn('[Darshán AI] Aviso en pipeline:', err);

        if (isPipelineTimeoutOrUnavailableError(err)) {
          const activeTitle = st.finalDerasha?.derashaTitle || st.phase1Data?.title;
          const activeQ = st.completedStudyQuery;
          setStage('idle');
          setClarificationState({
            mode: 'timeout_unavailable',
            originalQuery: effectiveQuery,
            activeStudyTitle: activeTitle,
            activeStudyQuery: activeQ,
            reason:
              err?.message ||
              'No hay respuestas disponibles de momento debido a una espera demasiado prolongada. Por favor aclara o acota tu consulta seleccionando una de las opciones siguientes, o vuelve a intentarlo:',
            suggestedRefinements: buildRefinementsForQuery(effectiveQuery, {
              title: activeTitle,
              query: activeQ,
            }),
          });
        } else {
          setStage('error');
          setErrorMessage(
            err.message ||
              'No hay respuestas disponibles de momento para esta consulta. Por favor aclara tu pregunta o inténtalo nuevamente.'
          );
        }
      } finally {
        if (activeRunIdRef.current === currentRunId) {
          setIsPreparingGeneration(false);
        }
      }
    },
    [setSelectedCompareNumbers, handleRunDerashaComparison]
  );

  const handleSubmitInput = useCallback(() => {
    handleGenerateDerasha();
  }, [handleGenerateDerasha]);

  const handleSelectRefinement = useCallback(
    (refinedQuery: string) => {
      const st = latestStateRef.current;
      const activeTitle =
        st.clarificationState?.activeStudyTitle ||
        st.finalDerasha?.derashaTitle ||
        st.phase1Data?.title ||
        '';
      const activeQ = st.clarificationState?.activeStudyQuery || st.completedStudyQuery || '';
      const trimmedRef = refinedQuery.trim();
      const anchor = (activeTitle || activeQ).trim();

      let finalQuery = trimmedRef;
      if (anchor && trimmedRef.length < 95 && !/profundizando\s+y\s+acotando/i.test(trimmedRef)) {
        const anchorWords = anchor
          .toLowerCase()
          .replace(/[¿?¡!«»"'.,;:()]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 5);
        const lowerRef = trimmedRef.toLowerCase();
        const sharesTopic = anchorWords.some((w) => lowerRef.includes(w));
        if (!sharesTopic) {
          finalQuery = `${anchor} — Profundizando y acotando en: ${trimmedRef}`;
        }
      }

      setQuery(finalQuery);
      setClarificationState(null);
      handleGenerateDerasha(finalQuery, true);
    },
    [handleGenerateDerasha]
  );

  const handleForceOriginalQuery = useCallback(() => {
    const st = latestStateRef.current;
    const orig = st.clarificationState?.originalQuery || st.query;
    setClarificationState(null);
    handleGenerateDerasha(orig, true);
  }, [handleGenerateDerasha]);

  const handleRefineFullStudy = useCallback(
    (refinedQuery: string) => {
      setQuery(refinedQuery);
      setClarificationState(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      handleGenerateDerasha(refinedQuery, true);
    },
    [handleGenerateDerasha]
  );

  const handleSelectTopicFromHub = useCallback(
    (studyQuery: string, autoSubmit?: boolean) => {
      setQuery(studyQuery);
      setClarificationState(null);
      setWorkspaceMode('estudio');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (autoSubmit) {
        handleGenerateDerasha(studyQuery, true);
      }
    },
    [handleGenerateDerasha]
  );

  const handleSelectSampleFromHub = useCallback(
    (sample: SampleQuery) => {
      handleSelectSample(sample);
      setClarificationState(null);
      setWorkspaceMode('estudio');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [handleSelectSample]
  );

  const handleSelectSavedComparison = useCallback(
    (st: ComparativeDerashaAnalysisResult) => {
      setActiveComparison(st);
      setSelectedCompareNumbers(st.comparedNumbers);
    },
    [setActiveComparison, setSelectedCompareNumbers]
  );

  // Dynamically re-synthesize Phase 3 when the user switches duration or adds a complementary methodology
  const handleChangeDurationOrComplementary = useCallback(
    async (newDuration: DerashaDuration, extraMethodology?: DerashaMethodology) => {
      const st = latestStateRef.current;
      if (!st.phase1Data || !st.finalDerasha) return;

      const activeStudyQuery = st.completedStudyQuery || st.query;
      setDuracion(newDuration);
      const primaryMetodologia: DerashaMethodology =
        st.finalDerasha.metodologia || st.phase1Data.detectedMetodologia || st.metodologia;

      setIsRegeneratingDuration(true);
      setErrorMessage(null);

      try {
        const {
          finalDerasha: updatedDerasha,
          enrichedSources,
          updatedComplementary,
          resolvedComplementary,
        } = await executeDurationOrComplementaryResynthesis({
          activeStudyQuery,
          primaryMetodologia,
          currentComplementary: st.metodologiasComplementarias,
          newDuration,
          extraMethodology,
          audienciaOTono: st.audienciaOTono,
          tonoHomiletico: st.tonoHomiletico,
          outputPreferences: st.outputPreferences,
          phase1Data: st.phase1Data,
          verifiedSources: st.verifiedSources,
        });

        setMetodologiasComplementarias(updatedComplementary);
        setFinalDerasha(updatedDerasha);
        setVerifiedSources(enrichedSources);
        setPhase1Data((prev) =>
          prev
            ? {
                ...prev,
                duracion: newDuration,
                metodologiasComplementarias: resolvedComplementary,
              }
            : prev
        );
      } catch (err: any) {
        console.warn('Warning regenerating duration/complementary:', err);
        setErrorMessage(
          err.message ||
            'No se pudo ajustar la duración o metodología complementaria en este momento.'
        );
      } finally {
        setIsRegeneratingDuration(false);
      }
    },
    []
  );

  // Dynamically re-synthesize Phase 3 when the user applies updated PARDES depth/priority/conclusion preferences on an active study
  const handleResynthesizeOutputPreferences = useCallback(async () => {
    const st = latestStateRef.current;
    if (!st.phase1Data || !st.finalDerasha) return;

    const activeStudyQuery = st.completedStudyQuery || st.query;
    const primaryMetodologia: DerashaMethodology =
      st.finalDerasha.metodologia || st.phase1Data.detectedMetodologia || st.metodologia;
    const targetDuration: DerashaDuration = st.finalDerasha.duracion || st.duracion;
    const currentComp =
      st.finalDerasha.metodologiasComplementarias || st.metodologiasComplementarias;

    setIsRegeneratingDuration(true);
    setErrorMessage(null);

    try {
      const { finalDerasha: updatedDerasha, enrichedSources } =
        await executeDurationOrComplementaryResynthesis({
          activeStudyQuery,
          primaryMetodologia,
          currentComplementary: currentComp,
          newDuration: targetDuration,
          audienciaOTono: st.audienciaOTono,
          tonoHomiletico: st.tonoHomiletico,
          outputPreferences: st.outputPreferences,
          phase1Data: st.phase1Data,
          verifiedSources: st.verifiedSources,
        });

      setFinalDerasha(updatedDerasha);
      setVerifiedSources(enrichedSources);
    } catch (err: any) {
      console.warn('Warning regenerating with output preferences:', err);
      setErrorMessage(
        err.message ||
          'No se pudo aplicar la personalización PARDÉS y de conclusión en este momento.'
      );
    } finally {
      setIsRegeneratingDuration(false);
    }
  }, []);

  // Follow-up question to expand a point
  const handleAskFollowUp = useCallback(
    async (question: string) => {
      if (!question.trim()) return;

      const crossDerashaCmd = parseCrossDerashaComparisonCommand(question);
      if (crossDerashaCmd && crossDerashaCmd.isCrossDerashaComparison) {
        setSelectedCompareNumbers(crossDerashaCmd.numbers);
        const archEl = document.getElementById('derashot-archive-section');
        if (archEl) archEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await handleRunDerashaComparison({
          numbers: crossDerashaCmd.numbers,
          relationType: crossDerashaCmd.relationType,
          userHypothesis: crossDerashaCmd.userHypothesis,
        });
        return;
      }

      const st = latestStateRef.current;
      const activeStudyQuery = st.completedStudyQuery || st.query;
      setIsExpanding(true);

      try {
        const history = st.followUps
          .map((f) => ({
            role: 'user',
            content: f.question,
          }))
          .concat(
            st.followUps.map((f) => ({
              role: 'model',
              content: f.answer,
            }))
          );

        const derashaContext = {
          query: activeStudyQuery,
          metodologia: st.finalDerasha?.metodologia || st.metodologia,
          audienciaOTono: st.finalDerasha?.audienciaOTono || st.audienciaOTono,
          title: st.finalDerasha?.derashaTitle || st.phase1Data?.title || activeStudyQuery,
          primaryHebrew: st.phase1Data?.primaryHebrew,
          theologicalKeys: st.phase1Data?.theologicalKeys,
          morphologicalBreakdown: st.phase1Data?.morphologicalBreakdown,
          verifiedSources: st.verifiedSources,
          externalSources: st.finalDerasha?.externalSources || st.phase1Data?.externalSources,
          formalContrast: st.finalDerasha?.formalContrast || st.phase1Data?.formalContrast,
          pardes: st.finalDerasha?.pardes,
          methodologySections: st.finalDerasha?.methodologySections,
        };

        const result = await requestExpandDerasha({
          question,
          derashaContext,
          conversationHistory: history,
        });

        const newItem: FollowUpItem = {
          id: 'fu-' + Date.now(),
          question,
          answer: result.answer,
          timestamp: new Date().toISOString(),
          suggestedNextQuestions: result.suggestedNextQuestions,
          relatedSefariaReferences: result.relatedSefariaReferences,
        };

        setFollowUps((prev) => [...prev, newItem]);
      } catch (err: any) {
        console.warn('Warning expanding derasha:', err);
        const isTimeout = isPipelineTimeoutOrUnavailableError(err);
        if (!isTimeout && err?.message) {
          setErrorMessage(err.message);
        }
        const refinements = buildRefinementsForQuery(question, {
          title: st.finalDerasha?.derashaTitle || st.phase1Data?.title,
          query: activeStudyQuery,
        });
        const errorNoticeItem: FollowUpItem = {
          id: 'fu-err-' + Date.now(),
          question,
          answer: isTimeout
            ? '### Aviso sobre el tiempo de respuesta\n\nLa consulta superó el tiempo máximo de espera. Te sugerimos **aclarar o acotar la pregunta** eligiendo uno de los siguientes ángulos específicos:'
            : `### No se pudo responder esta pregunta\n\n${err?.message || 'Ocurrió un error al consultar el modelo de IA.'}`,
          timestamp: new Date().toISOString(),
          suggestedNextQuestions: isTimeout ? refinements : [],
        };
        setFollowUps((prev) => [...prev, errorNoticeItem]);
      } finally {
        setIsExpanding(false);
      }
    },
    [setSelectedCompareNumbers, handleRunDerashaComparison]
  );

  // Translate a specific canonical source into Spanish
  const handleTranslateSource = useCallback(
    async (ref: string, hebrewText: string, englishText: string) => {
      setTranslatingRef(ref);
      try {
        const res = await requestTranslateSource({ ref, hebrewText, englishText });
        setVerifiedSources((prev) =>
          prev.map((s) =>
            s.ref.toLowerCase() === ref.toLowerCase()
              ? { ...s, spanishTranslation: res.spanishTranslation }
              : s
          )
        );
        setFinalDerasha((prev) => {
          if (!prev) return prev;
          const existing = prev.canonicalAnalysis?.spanishTranslations || [];
          const filtered = existing.filter((t) => t.ref.toLowerCase() !== ref.toLowerCase());
          return {
            ...prev,
            canonicalAnalysis: {
              ...prev.canonicalAnalysis,
              spanishTranslations: [
                ...filtered,
                { ref, spanishTranslation: res.spanishTranslation },
              ],
            },
          };
        });
      } catch (err: any) {
        console.warn('Warning translating source:', err);
        setErrorMessage(err.message || 'Error al traducir el texto al español.');
      } finally {
        setTranslatingRef(null);
      }
    },
    []
  );

  // Translate all untranslated Sefaria sources into Spanish
  const handleTranslateAllSources = useCallback(async () => {
    const st = latestStateRef.current;
    const untranslated = st.verifiedSources.filter((s) => {
      const phase3Trans = st.finalDerasha?.canonicalAnalysis?.spanishTranslations?.find(
        (t) => t.ref.toLowerCase() === s.ref.toLowerCase()
      )?.spanishTranslation;
      return !evaluateSourceTranslationStatus(s, phase3Trans).hasSpanish;
    });

    if (untranslated.length === 0) return;

    setIsTranslatingAll(true);
    try {
      const batchPayload = untranslated.map((s) => ({
        ref: s.ref,
        hebrewText: s.hebrewText,
        englishText: s.translation,
      }));
      const results = await requestTranslateSourcesBatch(batchPayload);
      const mapByRef = new Map(
        results.map((r) => [r.ref.toLowerCase(), r.spanishTranslation])
      );

      setVerifiedSources((prev) =>
        prev.map((s) => {
          const translated = mapByRef.get(s.ref.toLowerCase());
          return translated ? { ...s, spanishTranslation: translated } : s;
        })
      );

      setFinalDerasha((prev) => {
        if (!prev) return prev;
        const existing = prev.canonicalAnalysis?.spanishTranslations || [];
        const updatedMap = new Map(
          existing.map((t) => [t.ref.toLowerCase(), t.spanishTranslation])
        );
        results.forEach((r) => {
          if (r.ref && r.spanishTranslation) {
            updatedMap.set(r.ref.toLowerCase(), r.spanishTranslation);
          }
        });
        return {
          ...prev,
          canonicalAnalysis: {
            ...prev.canonicalAnalysis,
            spanishTranslations: Array.from(updatedMap.entries()).map(
              ([refKey, spanishTranslation]) => ({
                ref:
                  st.verifiedSources.find((v) => v.ref.toLowerCase() === refKey)?.ref ||
                  refKey,
                spanishTranslation,
              })
            ),
          },
        };
      });
    } catch (err: any) {
      console.warn('Warning translating all sources:', err);
      setErrorMessage(
        err.message || 'No se pudieron traducir todas las fuentes al español en este momento.'
      );
    } finally {
      setIsTranslatingAll(false);
    }
  }, []);

  // Request additional or specialized multi-year readings from Contemporary Masters
  const handleRequestMasterReadings = useCallback(
    async (
      focusMaster: 'all' | 'sacks' | 'gordon' | 'soloveitchik' | 'hirsch',
      specificAngle?: string
    ) => {
      const st = latestStateRef.current;
      const activeQ = (st.completedStudyQuery || st.query).trim();
      if (!activeQ) return;
      setIsLoadingMasters(true);
      try {
        const result = await requestMasterReadings({
          query: activeQ,
          title: st.finalDerasha?.derashaTitle || st.phase1Data?.title,
          primaryHebrew: st.phase1Data?.primaryHebrew,
          verifiedSources: st.verifiedSources,
          focusMaster,
          specificAngle,
        });

        setFinalDerasha((prev) => {
          if (!prev) return prev;
          const existingReadings = prev.contemporaryMasters?.readings || [];
          const newReadings = result.readings.filter(
            (nr) =>
              !existingReadings.some(
                (er) => er.readingTitle.toLowerCase() === nr.readingTitle.toLowerCase()
              )
          );
          return {
            ...prev,
            contemporaryMasters: {
              detectedParashaOrTopic:
                result.detectedParashaOrTopic ||
                prev.contemporaryMasters?.detectedParashaOrTopic ||
                activeQ,
              overview: result.overview || prev.contemporaryMasters?.overview || '',
              readings: [...newReadings, ...existingReadings],
            },
          };
        });
      } catch (err: any) {
        console.warn('Warning fetching master readings:', err);
        setErrorMessage(err.message || 'Error al consultar las lecturas de los maestros.');
      } finally {
        setIsLoadingMasters(false);
      }
    },
    []
  );

  const handleSaveMishnatHaDorotQuotes = useCallback(
    (quotes: MishnatHaDorotQuote[]) => {
      const fetchedAt = new Date().toISOString();
      setFinalDerasha((prev) => {
        if (!prev || !prev.halakhicConsultation) return prev;
        return {
          ...prev,
          halakhicConsultation: {
            ...prev.halakhicConsultation,
            mishnatHaDorotQuotes: quotes,
            mishnatHaDorotFetchedAt: fetchedAt,
          },
        };
      });
      setPhase1Data((prev) => {
        if (!prev || !prev.halakhicConsultation) return prev;
        return {
          ...prev,
          halakhicConsultation: {
            ...prev.halakhicConsultation,
            mishnatHaDorotQuotes: quotes,
            mishnatHaDorotFetchedAt: fetchedAt,
          },
        };
      });
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col text-slate-100 selection:bg-sky-500/30 selection:text-sky-100">
      {/* Top Header (3-Zone Contract + History Button + Gear Settings + Discreet Google Profile & Drive Icon) */}
      <Header
        onOpenAboutModal={handleOpenAboutModal}
        onOpenUserManualModal={handleOpenUserManualModal}
        onOpenSettingsModal={handleOpenSettingsModal}
        onNavigateSection={handleNavigateSection}
        archivedCount={derashotArchive.length}
        archivedEntries={derashotArchive}
        onOpenArchivedDerasha={handleOpenArchivedDerasha}
        onDeleteArchivedDerasha={deleteArchivedDerasha}
        activeWorkspace={workspaceMode}
        activeHubTab={requestedHubTab?.tab}
        currentUser={firebaseUser}
        driveConnected={Boolean(driveAccessToken)}
        isSigningIn={isSigningInFirebase}
        isSyncingDrive={isSyncingDrive}
        driveFolderUrl={driveSyncSummary.folderWebViewLink}
        driveFileCount={driveSyncSummary.totalDriveFiles}
        onSignInGoogle={signInGoogle}
        onSignOutGoogle={signOutGoogle}
        onSyncDriveNow={syncWithGoogleDriveNow}
        homeResetSignal={homeResetSignal}
        isHomeTapArmed={isHomeTapArmed}
        onClearOrReturnHome={handleClearOrDoubleTapHome}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-7">
        {/* Compact Editorial Hero Header */}
        <div className="text-center space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Asistente Rabínico y Pedagógico de{' '}
            <span className="font-hebrew text-sky-400 font-bold">דְּרָשׁוֹת</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Introduce el tema, pasaje o concepto a desarrollar en el recuadro principal arriba, o explora las modalidades de estudio más abajo.
          </p>
        </div>

        {/* 1. RECUADRO PRINCIPAL RESALTADO AL PRINCIPIO DE LA UI: TEMA, PASAJE O CONCEPTO A DESARROLLAR */}
        <InputSection
          query={query}
          onChangeQuery={handleChangeQuery}
          metodologia={metodologia}
          onChangeMetodologia={setMetodologia}
          duracion={duracion}
          onChangeDuracion={setDuracion}
          metodologiasComplementarias={metodologiasComplementarias}
          onChangeMetodologiasComplementarias={setMetodologiasComplementarias}
          audienciaOTono={audienciaOTono}
          onChangeAudienciaOTono={(nextAud) => {
            setAudienciaOTono(composeAudienceAndTone(nextAud, tonoHomiletico));
          }}
          tonoHomiletico={tonoHomiletico}
          onChangeTonoHomiletico={(nextTone) => {
            setTonoHomiletico(nextTone);
            setAudienciaOTono((prev) => composeAudienceAndTone(prev, nextTone));
          }}
          onSubmit={handleSubmitInput}
          isLoading={isLoading}
          isRtl={isRtl}
          onToggleRtl={handleToggleRtl}
          onDeliberateMethodology={handleDeliberateAndPrewarm}
          isDeliberatingMethodology={isDeliberatingMethodology}
          deliberationResult={deliberationResult}
          isPrewarmedReady={isPrewarmedReadyForCurrentQuery}
          isPrewarmingSources={isPrewarmingSources}
          methodologyDecisionSeconds={methodologyDecisionSeconds}
          lessonElaborationBudgetSeconds={lessonElaborationBudgetSeconds}
          onFanOpenChange={setIsMethodologyFanOpen}
          archivedEntries={derashotArchive}
          onRequestClarification={handleRequestClarificationFromInput}
          onRunCrossComparison={handleRunCrossComparisonFromInput}
          onReturnHome={handleReturnToHome}
          homeResetSignal={homeResetSignal}
          isHomeTapArmed={isHomeTapArmed}
          onClearOrReturnHome={handleClearOrDoubleTapHome}
          onOpenUserManualModal={handleOpenUserManualModal}
          collapseFanSignal={collapseFanSignal}
          isEvaluatingQuery={isPreparingGeneration && !isLoading}
          outputPreferences={outputPreferences}
          onChangePardesDepth={setPardesLevelDepth}
          onTogglePrioritizedPardesLevel={togglePrioritizedPardesLevel}
          onChangeConclusionLength={setConclusionLength}
          onApplyAllPardesDepth={applyAllPardesDepth}
          onResetOutputPreferences={resetOutputPreferences}
        />

        {/* Error notification directly below InputSection so it is immediately visible */}
        {errorMessage && (
          <div
            ref={errorBannerRef}
            role="alert"
            className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/45 text-rose-100 shadow-lg flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <strong className="font-semibold text-rose-300 block">Aviso del sistema</strong>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => handleGenerateDerasha(query, true)}
                  disabled={isLoading || isPreparingGeneration}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRestoreDefaultSafePoint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Volver al Punto Seguro</span>
              </button>
              <button
                type="button"
                onClick={handleOpenSafePointModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ver Respaldos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  if (stage === 'error') setStage('idle');
                }}
                aria-label="Cerrar aviso"
                title="Cerrar aviso"
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* AVISO DE ACLARACIÓN DE CONSULTA O ESPERA MUY LARGA */}
        {clarificationState && !isLoading && (
          <div ref={clarificationBannerRef}>
            <QueryClarificationNotice
              state={clarificationState}
              onSelectRefinement={handleSelectRefinement}
              onForceOriginalQuery={handleForceOriginalQuery}
              onDismissAndEdit={handleDismissClarification}
            />
          </div>
        )}

        {/* Pipeline Phase Indicator */}
        {(isLoading || stage === 'error') && (
          <div ref={progressSectionRef}>
            <PhaseProgressIndicator
              currentStage={stage}
              currentRefIndex={sefariaProgress.current}
              totalRefs={sefariaProgress.total}
              error={errorMessage}
              maxWaitSeconds={maxWaitForCurrentStage}
              methodologyDecisionSeconds={methodologyDecisionSeconds}
              lessonElaborationBudgetSeconds={lessonElaborationBudgetSeconds}
              wasPrewarmed={isPrewarmedReadyForCurrentQuery}
              onCancel={handleCancelAndRequestClarification}
              onStageTimeout={handleStageTimeout}
            />
          </div>
        )}

        {/* SALIDA PRINCIPAL DE LA DRASHÁ ACTIVA */}
        {stage === 'complete' && finalDerasha && (
          <Suspense
            fallback={
              <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/50 text-center text-sm text-slate-400">
                Cargando vista editorial de la Drashá...
              </div>
            }
          >
            <ActiveDerashaWorkspaceView
              query={effectiveStudyQueryForActiveDerasha}
              phase1Data={phase1Data}
              verifiedSources={verifiedSources}
              finalDerasha={finalDerasha}
              followUps={followUps}
              isExpanding={isExpanding}
              isRegeneratingDuration={isRegeneratingDuration}
              translatingRef={translatingRef}
              isTranslatingAll={isTranslatingAll}
              isLoadingMasters={isLoadingMasters}
              readingScale={readingScale}
              scaleClass={scaleClass}
              typographyClass={typographyClass}
              onCycleReadingScale={cycleReadingScale}
              onToggleAtrilConfig={handleToggleAtrilConfig}
              onOpenExportWithScope={handleOpenExportWithScope}
              onAskFollowUp={handleAskFollowUp}
              onRefineFullStudy={handleRefineFullStudy}
              onChangeDurationOrComplementary={handleChangeDurationOrComplementary}
              onTranslateSource={handleTranslateSource}
              onTranslateAllSources={handleTranslateAllSources}
              onRequestMasterReadings={handleRequestMasterReadings}
              onSaveMishnatHaDorotQuotes={handleSaveMishnatHaDorotQuotes}
              outputPreferences={outputPreferences}
              onChangePardesDepth={setPardesLevelDepth}
              onTogglePrioritizedPardesLevel={togglePrioritizedPardesLevel}
              onChangeConclusionLength={setConclusionLength}
              onApplyAllPardesDepth={applyAllPardesDepth}
              onResetOutputPreferences={resetOutputPreferences}
              onRegenerateWithOutputPreferences={handleResynthesizeOutputPreferences}
            />
          </Suspense>
        )}

        {/* 2. DEMÁS MODALIDADES: ocultas mientras corre o se aclara una consulta para evitar saturación de menús abajo */}
        {!isLoading && !clarificationState && (
          <section id="lower-study-modalities" className="pt-2 space-y-5 border-t border-slate-800/80">
            <WorkspaceNavigationBar
              workspaceMode={workspaceMode}
              activeHubTab={requestedHubTab?.tab || 'parasha'}
              onSelectStudyModality={handleQuickOpenTab}
              onOpenArchiveModality={handleQuickOpenArchive}
              parashaNameEs={calendarData?.parasha?.nameEs}
              nextEventNameEs={calendarData?.upcomingEvents?.[0]?.titleEs}
              archiveCount={derashotArchive.length}
            />

            {/* SUGERENCIAS DE ESTUDIO: Solo desplegado cuando el usuario abre Calendario/Parashá/Musar o Todo */}
            {(workspaceMode === 'calendario' || workspaceMode === 'todo') && (
              <Suspense
                fallback={
                  <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
                    Cargando calendario y sugerencias de estudio...
                  </div>
                }
              >
                <SuggestedTopicsHub
                  calendar={calendarData}
                  isLoadingCalendar={isLoadingCalendar}
                  onChangeCalendarParams={loadCalendar}
                  onSelectTopic={handleSelectTopicFromHub}
                  onSelectSample={handleSelectSampleFromHub}
                  requestedTab={requestedHubTab}
                />
              </Suspense>
            )}

            {/* ARCHIVO PERSISTENTE Y COMPARADOR DIALÉCTICO ENTRE DERASHOT NUMERADAS (#1–#9+) */}
            {(workspaceMode === 'archivo' || workspaceMode === 'todo') && (
              <Suspense
                fallback={
                  <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
                    Cargando archivo de Derashot y comparador...
                  </div>
                }
              >
                <DerashotArchiveHub
                  archive={derashotArchive}
                  comparativeStudies={comparativeStudies}
                  currentUser={firebaseUser}
                  driveConnected={Boolean(driveAccessToken)}
                  isSigningIn={isSigningInFirebase}
                  isSyncingDrive={isSyncingDrive}
                  driveSyncSummary={driveSyncSummary}
                  isComparing={isComparingDerashot}
                  activeComparison={activeComparison}
                  selectedNumbers={selectedCompareNumbers}
                  onToggleSelectNumber={toggleSelectCompareNumber}
                  onSetSelectedNumbers={setSelectedCompareNumbers}
                  onRunComparison={handleRunDerashaComparison}
                  onOpenArchivedDerasha={handleOpenArchivedDerasha}
                  onDeleteArchivedDerasha={deleteArchivedDerasha}
                  onUpdateEntryInDrive={requestUpdateDerashaInDrive}
                  onSignInGoogle={signInGoogle}
                  onSignOutGoogle={signOutGoogle}
                  onSyncDriveNow={syncWithGoogleDriveNow}
                  onSelectSavedComparison={handleSelectSavedComparison}
                />
              </Suspense>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090f1d] py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p className="flex flex-wrap items-center justify-center gap-2 text-slate-400 font-medium">
            <span className="font-editorial text-slate-200">Darshán AI</span>
            <span>·</span>
            <span>Metodología Pardés</span>
            <span>·</span>
            <span className="font-hebrew text-sky-400">פְּשָׁט · רֶמֶז · דְּרַשׁ · סוֹד</span>
            <span>·</span>
            <button
              type="button"
              onClick={handleOpenUserManualModal}
              className="text-sky-300 hover:text-sky-200 underline underline-offset-4 font-semibold cursor-pointer"
            >
              Manual de Usuario (?)
            </button>
          </p>
          <p className="text-slate-500">
            Fuentes hebraicas canónicas sincronizadas con la Biblioteca de Sefaria · Tradición Judía Clásica
          </p>
        </div>
      </footer>

      {/* Modals (lazy-loaded on open) */}
      <Suspense fallback={null}>
        {isAboutModalOpen && (
          <AboutModal
            isOpen={isAboutModalOpen}
            onClose={handleCloseAboutModal}
          />
        )}

        {isUserManualOpen && (
          <UserManualModal
            isOpen={isUserManualOpen}
            onClose={handleCloseUserManualModal}
            onOpenAboutModal={handleOpenAboutModal}
          />
        )}

        {isExportModalOpen && (
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={handleCloseExportModal}
            query={effectiveStudyQueryForActiveDerasha}
            phase1={phase1Data}
            sources={verifiedSources}
            derasha={finalDerasha}
            followUps={followUps}
            initialScope={exportScope}
          />
        )}

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={handleCloseSettingsModal}
            initialTab={settingsInitialTab}
            readingScale={readingScale}
            atrilTypography={atrilTypography}
            onSelectScale={handleSelectReadingScale}
            onSelectTypography={handleSelectAtrilTypography}
            isRtl={isRtl}
            onToggleRtl={handleToggleRtl}
            workspaceMode={workspaceMode}
            onChangeWorkspaceMode={handleChangeWorkspaceMode}
            safePoints={safePoints}
            onCreateManualSafePoint={handleCreateManualSafePoint}
            onRestoreSafePoint={restoreSafePoint}
            onDeleteSafePoint={deleteSafePoint}
            onImportSafePointJson={importSafePointJson}
            onRunVerifyAndRepair={runVerifyAndRepair}
            archiveCount={derashotArchive.length}
            comparativeCount={comparativeStudies.length}
            activeStudyTitle={activeStudyTitle}
            onOpenAboutModal={handleOpenAboutModal}
            onOpenUserManualModal={handleOpenUserManualModal}
            outputPreferences={outputPreferences}
            onChangePardesDepth={setPardesLevelDepth}
            onTogglePrioritizedPardesLevel={togglePrioritizedPardesLevel}
            onChangeConclusionLength={setConclusionLength}
            onApplyAllPardesDepth={applyAllPardesDepth}
            onResetOutputPreferences={resetOutputPreferences}
            onApplyAndRegenerateActiveStudy={
              finalDerasha && phase1Data ? handleResynthesizeOutputPreferences : undefined
            }
            isRegeneratingActiveStudy={isRegeneratingDuration}
            hasUnsavedOutputChanges={
              Boolean(finalDerasha) &&
              !areOutputPreferencesEqual(
                outputPreferences,
                finalDerasha?.outputPreferences || DEFAULT_DERASHA_OUTPUT_PREFERENCES
              )
            }
          />
        )}
      </Suspense>

      {/* Mandatory User Confirmation Dialog for Google Drive Destructive / Overwrite Operations */}
      {pendingDriveConfirmation && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-confirm-title"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#0d1629] border border-sky-500/40 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  pendingDriveConfirmation.type === 'DELETE'
                    ? 'bg-rose-500/15 border-rose-500/35 text-rose-400'
                    : 'bg-sky-500/15 border-sky-400/35 text-sky-300'
                }`}
              >
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 id="drive-confirm-title" className="text-sm font-bold text-white">
                  {pendingDriveConfirmation.type === 'DELETE'
                    ? 'Confirmar eliminación en tu Google Drive'
                    : 'Confirmar actualización de archivo en tu Google Drive'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {pendingDriveConfirmation.type === 'DELETE' ? (
                    <>
                      ¿Deseas eliminar la <strong>Derashá #{pendingDriveConfirmation.sequenceNumber}</strong>{' '}
                      ({pendingDriveConfirmation.title}) y borrar el archivo{' '}
                      <code className="text-rose-300 font-mono text-[11px]">
                        {pendingDriveConfirmation.fileName}
                      </code>{' '}
                      de tu carpeta <strong>Darshán AI · Mis Derashot</strong> en Google Drive?
                    </>
                  ) : (
                    <>
                      ¿Deseas sobrescribir el archivo existente{' '}
                      <code className="text-sky-300 font-mono text-[11px]">
                        {pendingDriveConfirmation.fileName}
                      </code>{' '}
                      correspondiente a la <strong>Derashá #{pendingDriveConfirmation.sequenceNumber}</strong>{' '}
                      en tu carpeta <strong>Darshán AI · Mis Derashot</strong> de Google Drive?
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={cancelPendingDriveAction}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPendingDriveAction}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  pendingDriveConfirmation.type === 'DELETE'
                    ? 'bg-rose-500 hover:bg-rose-400 text-slate-950'
                    : 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                }`}
              >
                {pendingDriveConfirmation.type === 'DELETE'
                  ? 'Sí, eliminar de Google Drive'
                  : 'Sí, actualizar en Google Drive'}
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}

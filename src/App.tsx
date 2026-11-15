import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Header,
  WorkspaceTab,
  WorkspaceNavigationBar,
  AboutModal,
  ExportModal,
  ExportScope,
  SettingsModal,
  SettingsModalTab,
  OfflineIndicator,
} from './components/layout';
import {
  InputSection,
  PhaseProgressIndicator,
  QueryClarificationNotice,
  ClarificationState,
  buildRefinementsForQuery,
  ActiveDerashaWorkspaceView,
} from './components/pipeline';
import { SuggestedTopicsHub, HubTab } from './components/discovery';
import { DerashotArchiveHub } from './components/archive';
import { YouTubeVisualStudio } from './components/youtube';
import {
  useAtrilPreferences,
  useTorahCalendar,
  useArchiveAndComparator,
  buildSyntheticStudyFromArchivedEntry,
  useSafePoints,
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
  MethodologyDeliberationResult,
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
} from './types';
import { AlertTriangle, ShieldCheck, RotateCcw, HardDrive } from 'lucide-react';
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
    'Comunidad general · Inspirador y práctico'
  );
  const [isRtl, setIsRtl] = useState(false);

  // Modal states
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsModalTab>('typography');
  const [exportScope, setExportScope] = useState<ExportScope>('full_derasha');

  // Requested tab in SuggestedTopicsHub when clicking Header navigation links
  const [requestedHubTab, setRequestedHubTab] = useState<{ tab: HubTab; timestamp: number } | null>(
    null
  );

  // Top-level Workspace Mode ('estudio' | 'calendario' | 'archivo' | 'youtube' | 'todo')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceTab>('estudio');
  const [youtubeBridgeUrl, setYoutubeBridgeUrl] = useState<string | null>(null);
  const [youtubeAutoTriggerSignal, setYoutubeAutoTriggerSignal] = useState<number>(0);

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
  const activeRunIdRef = useRef<number>(0);

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
    calendarData,
    phase1Data,
    verifiedSources,
    finalDerasha,
    followUps,
    derashotArchive,
    comparativeStudies,
    prewarmedCache,
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
    calendarData,
    phase1Data,
    verifiedSources,
    finalDerasha,
    followUps,
    derashotArchive,
    comparativeStudies,
    prewarmedCache,
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
        setPhase1Data(act.phase1Data);
        setVerifiedSources(act.verifiedSources || []);
        setFinalDerasha(act.finalDerasha);
        setFollowUps(act.followUps || []);
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
          setPhase1Data(parsed.phase1Data);
          setVerifiedSources(Array.isArray(parsed.verifiedSources) ? parsed.verifiedSources : []);
          setFinalDerasha(parsed.finalDerasha);
          setFollowUps(Array.isArray(parsed.followUps) ? parsed.followUps : []);
          setStage('complete');
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist completed study in localStorage, save/update in the numbered Derashot Archive, and refresh Auto Safe Point
  useEffect(() => {
    if (stage === 'complete' && finalDerasha && phase1Data) {
      const studyQueryToSave = completedStudyQuery || query;
      const savedAt = new Date().toISOString();
      const activeSnapshot = {
        query: studyQueryToSave,
        metodologia,
        duracion,
        metodologiasComplementarias,
        audienciaOTono,
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

      setDerashotArchive((prev) => {
        const { updatedArchive } = buildAndSaveDerashaToArchive(prev, {
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
        });
        createSystemSafePoint({
          triggerType: 'auto',
          archive: updatedArchive,
          comparativeStudies: latestStateRef.current.comparativeStudies,
          activeStudy: activeSnapshot,
        });
        refreshSafePoints();
        return updatedArchive;
      });
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
    () => (duracion === '30_MIN' ? 600 : duracion === '10_MIN' ? 420 : 300),
    [duracion]
  );

  const maxWaitForCurrentStage = useMemo(
    () => (stage === 'phase3_derasha' ? lessonElaborationBudgetSeconds : 240),
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
    const currentQ = latestStateRef.current.query;
    activeRunIdRef.current += 1;
    setStage('idle');
    setClarificationState({
      mode: 'timeout_unavailable',
      originalQuery: currentQ,
      reason:
        'No hay respuestas disponibles de momento porque la fase actual superó el tiempo máximo de espera. Puedes elegir una formulación más acotada aquí abajo para obtener respuesta inmediata, o volver a intentarlo.',
      suggestedRefinements: buildRefinementsForQuery(currentQ),
    });
  }, []);

  // Helper to start or reuse background pre-warming of Phase 1 & Phase 2
  const getOrStartPrewarmPromise = useCallback((effectiveQuery: string) => {
    const {
      prewarmedCache: currentCache,
      metodologia: currentMethod,
      metodologiasComplementarias: currentComp,
      audienciaOTono: currentAudience,
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
    if (!trimmed || isQueryTooBroadOrAmbiguous(trimmed)) return;
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
  }, [query, isLoading, calendarData, prewarmedCache, getOrStartPrewarmPromise]);

  // Stable UI & Modal Callbacks
  const handleOpenAboutModal = useCallback(() => setIsAboutModalOpen(true), []);
  const handleCloseAboutModal = useCallback(() => setIsAboutModalOpen(false), []);
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

  const handleChangeQuery = useCallback((val: string) => {
    setQuery(val);
    if (latestStateRef.current.clarificationState) {
      setClarificationState(null);
    }
  }, []);

  const handleSelectSample = useCallback((sample: SampleQuery) => {
    setQuery(sample.query);
    const hasHebrew = /[\u0590-\u05FF]/.test(sample.query);
    if (hasHebrew) {
      setIsRtl(true);
    }
  }, []);

  const handleNavigateSection = useCallback(
    (target: 'study' | 'archive' | 'topics' | 'musar' | 'youtube') => {
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
      } else if (target === 'youtube') {
        setWorkspaceMode('youtube');
        setTimeout(() => {
          const el = document.getElementById('youtube-visual-studio');
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

  const handleQuickOpenYouTubeStudio = useCallback(() => {
    setWorkspaceMode('youtube');
    setTimeout(() => {
      const el = document.getElementById('youtube-visual-studio');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  const handleOpenYouTubeStudioFromInput = useCallback((youtubeUrl: string) => {
    setYoutubeBridgeUrl(youtubeUrl);
    setYoutubeAutoTriggerSignal((n) => n + 1);
    setWorkspaceMode('youtube');
    setTimeout(() => {
      const el = document.getElementById('youtube-visual-studio');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  const handleSendYouTubeTopicToDerasha = useCallback((topic: string) => {
    setQuery(topic);
    setWorkspaceMode('estudio');
    setTimeout(() => {
      const el = document.getElementById('query-input');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
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
    const currentQ = latestStateRef.current.query;
    activeRunIdRef.current += 1;
    setStage('idle');
    setClarificationState({
      mode: 'clarification_needed',
      originalQuery: currentQ,
      reason:
        'Se ha detenido la espera prolongada. Para obtener una respuesta mucho más ágil y centrada en fuentes exactas de Sefaria y Jazal, te sugerimos precisar el ángulo de tu pregunta:',
      suggestedRefinements: buildRefinementsForQuery(currentQ),
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
    if (!trimmed) return;
    const effectiveQuery = enrichQueryWithCalendar(trimmed, st.calendarData);
    setClarificationState({
      mode: 'clarification_needed',
      originalQuery: effectiveQuery,
      reason:
        'Selecciona el ángulo específico o la Puerta Lógica metodológica con la que deseas abordar tu estudio:',
      suggestedRefinements: buildRefinementsForQuery(effectiveQuery),
    });
  }, []);

  // Decoupled Methodology Deliberation + Background Pre-Warming of Phase 1 & Phase 2
  const handleDeliberateAndPrewarm = useCallback(async () => {
    const { query: rawQ, calendarData: cal } = latestStateRef.current;
    const trimmed = rawQ.trim();
    if (!trimmed) return;
    const effectiveQuery = enrichQueryWithCalendar(trimmed, cal);

    if (deliberationAbortRef.current) {
      deliberationAbortRef.current.abort();
    }
    const abortController = new AbortController();
    deliberationAbortRef.current = abortController;

    setIsDeliberatingMethodology(true);

    const deliberationPromise = requestDecideMethodology(effectiveQuery, abortController.signal)
      .then((res) => {
        if (!abortController.signal.aborted) {
          setDeliberationResult({ ...res, query: trimmed });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (deliberationAbortRef.current === abortController) {
          deliberationAbortRef.current = null;
        }
        setIsDeliberatingMethodology(false);
      });

    const prewarmPromise = getOrStartPrewarmPromise(effectiveQuery);

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
        setErrorMessage(null);
        setClarificationState({
          mode: 'clarification_needed',
          originalQuery: effectiveQuery,
          reason:
            'Tu consulta es muy breve o general. Para evitar una espera muy larga y poder consultar los textos exactos en el Tanaj, el Talmud y Sefaria, por favor aclara qué aspecto específico deseas estudiar:',
          suggestedRefinements: buildRefinementsForQuery(effectiveQuery),
        });
        return;
      }

      const currentRunId = activeRunIdRef.current + 1;
      activeRunIdRef.current = currentRunId;

      setClarificationState(null);
      setErrorMessage(null);
      setFinalDerasha(null);
      setFollowUps([]);
      setCompletedStudyQuery(effectiveQuery);

      const inFlightPrewarmForQuery =
        inFlightPrewarmPromiseRef.current &&
        inFlightPrewarmPromiseRef.current.query === effectiveQuery
          ? inFlightPrewarmPromiseRef.current.promise
          : null;

      try {
        const result = await executeFullDerashaPipeline({
          effectiveQuery,
          requestedMethodology,
          duracion: st.duracion,
          metodologiasComplementarias: st.metodologiasComplementarias,
          audienciaOTono: st.audienciaOTono,
          prewarmedCache: st.prewarmedCache,
          inFlightPrewarmPromise: inFlightPrewarmForQuery,
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
        if (activeRunIdRef.current !== currentRunId) return;
        console.warn('[Darshán AI] Aviso en pipeline:', err);

        if (isPipelineTimeoutOrUnavailableError(err)) {
          setStage('idle');
          setClarificationState({
            mode: 'timeout_unavailable',
            originalQuery: effectiveQuery,
            reason:
              err?.message ||
              'No hay respuestas disponibles de momento debido a una espera demasiado prolongada. Por favor aclara o acota tu consulta seleccionando una de las opciones siguientes, o vuelve a intentarlo:',
            suggestedRefinements: buildRefinementsForQuery(effectiveQuery),
          });
        } else {
          setStage('error');
          setErrorMessage(
            err.message ||
              'No hay respuestas disponibles de momento para esta consulta. Por favor aclara tu pregunta o inténtalo nuevamente.'
          );
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
      setQuery(refinedQuery);
      setClarificationState(null);
      handleGenerateDerasha(refinedQuery, true);
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
        const refinements = buildRefinementsForQuery(question);
        const fallbackItem: FollowUpItem = {
          id: 'fu-timeout-' + Date.now(),
          question,
          answer:
            '### Aviso sobre el tiempo de respuesta\n\nNo hay respuestas disponibles de momento para esta consulta porque el tiempo de espera fue demasiado largo o la pregunta abarca múltiples tratados. Te sugerimos **aclarar o acotar la pregunta** eligiendo uno de los siguientes ángulos específicos de la tradición judía:',
          timestamp: new Date().toISOString(),
          suggestedNextQuestions: refinements,
        };
        setFollowUps((prev) => [...prev, fallbackItem]);
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

  return (
    <div className="min-h-screen flex flex-col text-slate-100 selection:bg-sky-500/30 selection:text-sky-100">
      {/* Top Header (3-Zone Contract + History Button + Gear Settings + Discreet Google Profile & Drive Icon) */}
      <Header
        onOpenAboutModal={handleOpenAboutModal}
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
          onChangeAudienciaOTono={setAudienciaOTono}
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
          onOpenArchivedDerasha={handleOpenArchivedDerasha}
          onDeleteArchivedDerasha={deleteArchivedDerasha}
          onOpenFullArchive={handleQuickOpenArchive}
          onRequestClarification={handleRequestClarificationFromInput}
          onRunCrossComparison={handleRunCrossComparisonFromInput}
          onOpenYouTubeStudio={handleOpenYouTubeStudioFromInput}
        />

        {/* AVISO DE ACLARACIÓN DE CONSULTA O ESPERA MUY LARGA */}
        {clarificationState && !isLoading && (
          <QueryClarificationNotice
            state={clarificationState}
            onSelectRefinement={handleSelectRefinement}
            onForceOriginalQuery={handleForceOriginalQuery}
            onDismissAndEdit={handleDismissClarification}
          />
        )}

        {/* Pipeline Phase Indicator */}
        {(isLoading || stage === 'error') && (
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
        )}

        {/* Error notification if any, with 1-click Fallback to Safe Point */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <strong className="font-semibold text-rose-300 block">Aviso del sistema</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
            </div>
          </div>
        )}

        {/* SALIDA PRINCIPAL DE LA DRASHÁ ACTIVA */}
        {stage !== 'idle' && finalDerasha && (
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
          />
        )}

        {/* 2. DEMÁS MODALIDADES DE SUGERENCIAS DE ESTUDIO Y COMPARADOR MÁS ABAJO */}
        <section id="lower-study-modalities" className="pt-2 space-y-5 border-t border-slate-800/80">
          <WorkspaceNavigationBar
            workspaceMode={workspaceMode}
            activeHubTab={requestedHubTab?.tab || 'parasha'}
            onSelectStudyModality={handleQuickOpenTab}
            onOpenArchiveModality={handleQuickOpenArchive}
            onOpenYouTubeStudio={handleQuickOpenYouTubeStudio}
            parashaNameEs={calendarData?.parasha?.nameEs}
            nextEventNameEs={calendarData?.upcomingEvents?.[0]?.titleEs}
            archiveCount={derashotArchive.length}
          />

          {/* ESTUDIO VISUAL DE VIDEOS DE YOUTUBE: ILUSTRACIONES SVG Y ANIMACIONES */}
          {(workspaceMode === 'youtube' || workspaceMode === 'todo') && (
            <YouTubeVisualStudio
              initialYoutubeUrl={youtubeBridgeUrl}
              autoTriggerSignal={youtubeAutoTriggerSignal}
              onSendTopicToDerasha={handleSendYouTubeTopicToDerasha}
            />
          )}

          {/* SUGERENCIAS DE ESTUDIO: PARASHÁ DE LA SEMANA, FESTIVIDADES JUDÍAS, MUSAR DIARIO Y PREGUNTAS CLÁSICAS */}
          {workspaceMode !== 'archivo' && workspaceMode !== 'youtube' && (
            <SuggestedTopicsHub
              calendar={calendarData}
              isLoadingCalendar={isLoadingCalendar}
              onChangeCalendarParams={loadCalendar}
              onSelectTopic={handleSelectTopicFromHub}
              onSelectSample={handleSelectSampleFromHub}
              requestedTab={requestedHubTab}
            />
          )}

          {/* ARCHIVO PERSISTENTE Y COMPARADOR DIALÉCTICO ENTRE DERASHOT NUMERADAS (#1–#9+) */}
          {(workspaceMode === 'archivo' || workspaceMode === 'todo') && (
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
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090f1d] py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-1.5">
          <p className="flex items-center justify-center gap-2 text-slate-400 font-medium">
            <span className="font-editorial text-slate-200">Darshán AI</span>
            <span>·</span>
            <span>Metodología Pardés</span>
            <span>·</span>
            <span className="font-hebrew text-sky-400">פְּשָׁט · רֶמֶז · דְּרַשׁ · סוֹד</span>
          </p>
          <p className="text-slate-500">
            Fuentes hebraicas canónicas sincronizadas con la Biblioteca de Sefaria · Tradición Judía Clásica
          </p>
        </div>
      </footer>

      {/* Modals */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={handleCloseAboutModal}
      />

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
      />

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

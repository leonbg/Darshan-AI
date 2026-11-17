import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
  FinalDerasha,
  Phase1AnalysisResult,
} from '../types';
import {
  loadLocalArchive,
  saveLocalArchive,
  loadLocalComparativeStudies,
  saveLocalComparativeStudies,
  requestCompareArchivedDerashot,
  subscribeToFirestoreArchive,
  syncDerashaEntryToFirestore,
  deleteDerashaFromFirestore,
  buildDerashaFirestoreDocId,
  clearKnownFirestoreCache,
  mergeArchiveEntriesSafely,
  recordDeletedDerasha,
} from '../services/archiveService';
import {
  DriveSyncSummary,
  loadUserDerashotFromGoogleDrive,
  createNewDerashaFileInGoogleDrive,
  updateExistingDerashaFileInGoogleDrive,
  deleteDerashaFileFromGoogleDrive,
  clearLocalAppStorageForDriveMode,
  resetDriveFolderCache,
  buildDriveFileNameForDerasha,
} from '../services/googleDriveStorageService';
import { resolveApiUrl } from '../services/api';
import {
  initAuth,
  googleSignIn,
  signOutFirebase,
  User,
} from '../services/firebase';

export interface PendingDriveConfirmation {
  type: 'DELETE' | 'OVERWRITE';
  sequenceNumber: number;
  title: string;
  fileName: string;
  fileId: string;
  entryToUpdate?: ArchivedDerashaEntry;
}

/**
 * Builds an instant 0ms synthetic Phase 1 + FinalDerasha view when opening a seed or summary entry
 * from the historical archive that does not yet have a full cached JSON object.
 */
export function buildSyntheticStudyFromArchivedEntry(entry: ArchivedDerashaEntry): {
  phase1Data: Phase1AnalysisResult;
  finalDerasha: FinalDerasha;
} {
  const sourceRefs = entry.sourcesSummary
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);

  const phase1Data: Phase1AnalysisResult = {
    title: entry.title,
    primaryHebrew: 'תּוֹרָה אוֹר',
    transliteration: 'Torah Or',
    literalSpanishTranslation: entry.centralIdea,
    liturgicalContext: `Derashá #${entry.sequenceNumber} del Archivo Histórico (${entry.methodology})`,
    morphologicalBreakdown: [],
    sefariaReferences: sourceRefs.slice(0, 4).map((r) => ({
      ref: r,
      rationale: `Fuente citada en Derashá #${entry.sequenceNumber}`,
    })),
    detectedMetodologia: entry.methodology,
    duracion: entry.duration,
    metodologiasComplementarias: entry.complementaryMethodologies || [],
  };

  const finalDerasha: FinalDerasha = {
    derashaTitle: `Derashá #${entry.sequenceNumber}: ${entry.title}`,
    openingExordium: entry.centralIdea,
    fullStructuredDerashaMarkdown: entry.essaySummary,
    metodologia: entry.methodology,
    metodologiasComplementarias: entry.complementaryMethodologies || [],
    duracion: entry.duration,
    audienciaOTono: entry.audienceOrTone,
    morphologicalSynthesis: {
      summary: entry.centralIdea,
      keyTheologicalInsight: entry.centralIdea,
    },
    canonicalAnalysis: {
      synthesis: entry.sourcesSummary,
      verifiedEchoes: sourceRefs.map((r) => ({
        ref: r,
        connection: `Fuente empleada en Derashá #${entry.sequenceNumber}`,
      })),
    },
    pardes: {
      pshat: {
        hebrewPillar: 'פְּשָׁט',
        title: 'Planteamiento Central y Fuentes',
        exposition: entry.centralIdea,
        keyTakeaway: entry.sourcesSummary,
      },
      remez: {
        hebrewPillar: 'רֶמֶז',
        title: 'Estructura Filosófica y Hermenéutica',
        exposition: entry.essaySummary,
        keyTakeaway: entry.title,
      },
      drash: {
        hebrewPillar: 'דְּרַשׁ',
        title: 'Desarrollo Exegético Completo',
        exposition: entry.essaySummary,
        keyTakeaway: entry.centralIdea,
      },
      sod: {
        hebrewPillar: 'סוֹד',
        title: 'Dimensión Interior y Síntesis',
        exposition: entry.centralIdea,
        keyTakeaway: entry.title,
      },
    },
    practicalConclusion: {
      title: `Conclusión de la Derashá #${entry.sequenceNumber}`,
      hashkafa: entry.centralIdea,
      prayerKavanah: `Integrar la enseñanza de "${entry.title}" en el estudio y la reflexión diaria.`,
      dailyAction: `Puedes continuar profundizando esta Derashá #${entry.sequenceNumber} en la mesa de conversación inferior o compararla con otra Derashá del archivo.`,
    },
  };

  return { phase1Data, finalDerasha };
}

export function useArchiveAndComparator() {
  const [derashotArchive, setDerashotArchive] = useState<ArchivedDerashaEntry[]>(() =>
    loadLocalArchive()
  );
  const [comparativeStudies, setComparativeStudies] = useState<
    ComparativeDerashaAnalysisResult[]
  >(() => loadLocalComparativeStudies());
  const [selectedCompareNumbers, setSelectedCompareNumbers] = useState<number[]>([1, 5]);
  const [activeComparison, setActiveComparison] =
    useState<ComparativeDerashaAnalysisResult | null>(null);
  const [isComparingDerashot, setIsComparingDerashot] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [isSigningInFirebase, setIsSigningInFirebase] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncSummary, setDriveSyncSummary] = useState<DriveSyncSummary>({
    connected: false,
    folderId: null,
    folderWebViewLink: null,
    filesBySequence: {},
    totalDriveFiles: 0,
    lastSyncedAt: null,
  });
  const [pendingDriveConfirmation, setPendingDriveConfirmation] =
    useState<PendingDriveConfirmation | null>(null);

  const archiveRef = useRef(derashotArchive);
  archiveRef.current = derashotArchive;

  // Merge server-side archive safely on mount (when not in Drive-only mode)
  useEffect(() => {
    if (driveAccessToken) return;
    let cancelled = false;
    fetch(resolveApiUrl('/api/derashot-archive'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.entries) && data.entries.length > 0) {
          setDerashotArchive((prev) => {
            const merged = mergeArchiveEntriesSafely(prev, data.entries);
            saveLocalArchive(merged);
            return merged;
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [driveAccessToken]);

  const syncWithGoogleDriveNow = useCallback(async () => {
    setIsSyncingDrive(true);
    try {
      clearLocalAppStorageForDriveMode();
      const { entries: driveEntries, summary } = await loadUserDerashotFromGoogleDrive();
      const currentEntries = archiveRef.current;
      const merged = mergeArchiveEntriesSafely(currentEntries, driveEntries);
      setDerashotArchive(merged);

      // Upload any entries not yet present in Google Drive (non-destructive creation of new files)
      const updatedFilesBySeq = { ...summary.filesBySequence };
      for (const entry of merged) {
        if (!updatedFilesBySeq[entry.sequenceNumber]) {
          try {
            const createdMeta = await createNewDerashaFileInGoogleDrive(entry);
            updatedFilesBySeq[entry.sequenceNumber] = createdMeta;
          } catch {
            // ignore individual upload failure
          }
        }
      }

      setDriveSyncSummary({
        ...summary,
        filesBySequence: updatedFilesBySeq,
        totalDriveFiles: Object.keys(updatedFilesBySeq).length,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Google Drive sync notice:', err);
    } finally {
      setIsSyncingDrive(false);
    }
  }, []);

  // Listen for Firebase Auth state & subscribe to Cloud Firestore archive
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = initAuth(
      (user, token) => {
        setFirebaseUser(user);
        setDriveAccessToken(token);
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        if (user && user.emailVerified) {
          let initialMissingSeedSyncDone = false;
          unsubscribeSnapshot = subscribeToFirestoreArchive(
            user.uid,
            (remoteEntries, remoteDocIds) => {
              if (remoteEntries.length > 0) {
                setDerashotArchive((prev) => {
                  const merged = mergeArchiveEntriesSafely(prev, remoteEntries);
                  if (!token) {
                    saveLocalArchive(merged);
                  }
                  return merged;
                });
              }

              if (!initialMissingSeedSyncDone) {
                initialMissingSeedSyncDone = true;
                const currentLocal = archiveRef.current;
                currentLocal.forEach((entry) => {
                  const expectedDocId = buildDerashaFirestoreDocId(user.uid, entry.sequenceNumber);
                  if (!remoteDocIds.has(expectedDocId)) {
                    syncDerashaEntryToFirestore(entry).catch(() => {});
                  }
                });
              }
            }
          );
        }
        if (token) {
          syncWithGoogleDriveNow();
        }
      },
      () => {
        clearKnownFirestoreCache();
        setFirebaseUser(null);
        setDriveAccessToken(null);
        resetDriveFolderCache();
        setDriveSyncSummary({
          connected: false,
          folderId: null,
          folderWebViewLink: null,
          filesBySequence: {},
          totalDriveFiles: 0,
          lastSyncedAt: null,
        });
      }
    );

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [syncWithGoogleDriveNow]);

  const toggleSelectCompareNumber = useCallback((seqNum: number) => {
    setSelectedCompareNumbers((prev) =>
      prev.includes(seqNum)
        ? prev.filter((n) => n !== seqNum)
        : [...prev, seqNum].sort((a, b) => a - b)
    );
  }, []);

  const deleteArchivedDerasha = useCallback(
    (sequenceNumber: number) => {
      const targetEntry = archiveRef.current.find((item) => item.sequenceNumber === sequenceNumber);
      const existingDriveFile = driveSyncSummary.filesBySequence[sequenceNumber];

      // If this Derashá is stored in the user's Google Drive, require explicit confirmation before deleting from Drive
      if (driveAccessToken && existingDriveFile) {
        setPendingDriveConfirmation({
          type: 'DELETE',
          sequenceNumber,
          title: targetEntry?.title || `Derashá #${sequenceNumber}`,
          fileName: existingDriveFile.name,
          fileId: existingDriveFile.id,
        });
        return;
      }

      recordDeletedDerasha(targetEntry || { sequenceNumber });

      setDerashotArchive((prev) => {
        const updated = prev.filter((item) => item.sequenceNumber !== sequenceNumber);
        if (!driveAccessToken) {
          saveLocalArchive(updated);
        }
        return updated;
      });
      setSelectedCompareNumbers((prev) => prev.filter((n) => n !== sequenceNumber));
      fetch(resolveApiUrl(`/api/derashot-archive/${sequenceNumber}`), {
        method: 'DELETE',
      }).catch(() => {});
      deleteDerashaFromFirestore(sequenceNumber).catch(() => {});
    },
    [driveAccessToken, driveSyncSummary.filesBySequence]
  );

  const requestUpdateDerashaInDrive = useCallback(
    (entry: ArchivedDerashaEntry) => {
      const existingDriveFile = driveSyncSummary.filesBySequence[entry.sequenceNumber];
      if (!driveAccessToken) return;
      if (existingDriveFile) {
        setPendingDriveConfirmation({
          type: 'OVERWRITE',
          sequenceNumber: entry.sequenceNumber,
          title: entry.title,
          fileName: existingDriveFile.name || buildDriveFileNameForDerasha(entry),
          fileId: existingDriveFile.id,
          entryToUpdate: entry,
        });
      } else {
        createNewDerashaFileInGoogleDrive(entry)
          .then((createdMeta) => {
            setDriveSyncSummary((prev) => ({
              ...prev,
              filesBySequence: {
                ...prev.filesBySequence,
                [entry.sequenceNumber]: createdMeta,
              },
              totalDriveFiles: Object.keys(prev.filesBySequence).length + 1,
              lastSyncedAt: new Date().toISOString(),
            }));
          })
          .catch(() => {});
      }
    },
    [driveAccessToken, driveSyncSummary.filesBySequence]
  );

  const confirmPendingDriveAction = useCallback(async () => {
    if (!pendingDriveConfirmation) return;
    const action = pendingDriveConfirmation;
    setPendingDriveConfirmation(null);
    setIsSyncingDrive(true);

    try {
      if (action.type === 'DELETE') {
        const targetEntry = archiveRef.current.find(
          (item) => item.sequenceNumber === action.sequenceNumber
        );
        recordDeletedDerasha(
          targetEntry || { sequenceNumber: action.sequenceNumber, title: action.title }
        );
        await deleteDerashaFileFromGoogleDrive(action.fileId);
        setDerashotArchive((prev) =>
          prev.filter((item) => item.sequenceNumber !== action.sequenceNumber)
        );
        setSelectedCompareNumbers((prev) => prev.filter((n) => n !== action.sequenceNumber));
        setDriveSyncSummary((prev) => {
          const nextFiles = { ...prev.filesBySequence };
          delete nextFiles[action.sequenceNumber];
          return {
            ...prev,
            filesBySequence: nextFiles,
            totalDriveFiles: Object.keys(nextFiles).length,
            lastSyncedAt: new Date().toISOString(),
          };
        });
        fetch(resolveApiUrl(`/api/derashot-archive/${action.sequenceNumber}`), {
          method: 'DELETE',
        }).catch(() => {});
        deleteDerashaFromFirestore(action.sequenceNumber).catch(() => {});
      } else if (action.type === 'OVERWRITE' && action.entryToUpdate) {
        const updatedMeta = await updateExistingDerashaFileInGoogleDrive(
          action.fileId,
          action.entryToUpdate
        );
        setDriveSyncSummary((prev) => ({
          ...prev,
          filesBySequence: {
            ...prev.filesBySequence,
            [action.sequenceNumber]: updatedMeta,
          },
          lastSyncedAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.warn('Error executing confirmed Google Drive action:', err);
    } finally {
      setIsSyncingDrive(false);
    }
  }, [pendingDriveConfirmation]);

  const cancelPendingDriveAction = useCallback(() => {
    setPendingDriveConfirmation(null);
  }, []);

  const signInGoogle = useCallback(async () => {
    setIsSigningInFirebase(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setFirebaseUser(res.user);
        setDriveAccessToken(res.accessToken);
        await syncWithGoogleDriveNow();
      }
    } catch (err: any) {
      console.warn('Google sign-in notice:', err);
    } finally {
      setIsSigningInFirebase(false);
    }
  }, [syncWithGoogleDriveNow]);

  const signOutGoogle = useCallback(async () => {
    try {
      await signOutFirebase();
      clearKnownFirestoreCache();
      setFirebaseUser(null);
      setDriveAccessToken(null);
      resetDriveFolderCache();
    } catch {
      // ignore
    }
  }, []);

  const runDerashaComparison = useCallback(
    async (
      params: {
        numbers: number[];
        relationType: DerashaRelationType;
        userHypothesis: string;
      },
      callbacks?: {
        onSwitchToArchiveTab?: () => void;
        onError?: (msg: string | null) => void;
      }
    ) => {
      const matchedEntries = derashotArchive.filter((e) =>
        params.numbers.includes(e.sequenceNumber)
      );
      if (matchedEntries.length < 2) {
        callbacks?.onError?.(
          `Por favor selecciona al menos 2 Derashot existentes en tu archivo (actualmente tienes #1 a #${derashotArchive.length}).`
        );
        return;
      }

      callbacks?.onSwitchToArchiveTab?.();
      setIsComparingDerashot(true);
      callbacks?.onError?.(null);
      try {
        const result = await requestCompareArchivedDerashot({
          derashot: matchedEntries,
          relationType: params.relationType,
          userHypothesis: params.userHypothesis,
        });
        setActiveComparison(result);
        setComparativeStudies((prev) => {
          const updated = [result, ...prev.filter((p) => p.id !== result.id)].slice(0, 30);
          if (!driveAccessToken) {
            saveLocalComparativeStudies(updated);
          }
          return updated;
        });
        setTimeout(() => {
          const el = document.getElementById('active-derasha-comparison-result');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      } catch (err: any) {
        callbacks?.onError?.(
          err?.message || 'No se pudo completar el análisis comparativo de las Derashot.'
        );
      } finally {
        setIsComparingDerashot(false);
      }
    },
    [derashotArchive, driveAccessToken]
  );

  return {
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
  };
}


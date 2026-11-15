import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActiveStudySnapshot,
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  SystemSafePointSnapshot,
} from '../types';
import {
  loadLocalSafePoints,
  syncSafePointsWithServer,
  createSystemSafePoint,
  restoreSystemSafePoint,
  deleteSystemSafePoint,
  importSafePointFromJsonString,
  verifyAndRepairSystemState,
} from '../services/safePointService';
import { loadLocalArchive, loadLocalComparativeStudies } from '../services/archiveService';

export function useSafePoints(options: {
  onRestoredSnapshot: (snapshot: SystemSafePointSnapshot) => void;
  onRepairedState: (
    archive: ArchivedDerashaEntry[],
    comparativeStudies: ComparativeDerashaAnalysisResult[]
  ) => void;
}) {
  const [safePoints, setSafePoints] = useState<SystemSafePointSnapshot[]>(() =>
    loadLocalSafePoints()
  );

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    syncSafePointsWithServer()
      .then((list) => setSafePoints(list))
      .catch(() => {});
  }, []);

  const refreshSafePoints = useCallback(() => {
    setSafePoints(loadLocalSafePoints());
  }, []);

  const createManualSafePoint = useCallback(
    (params: {
      label: string;
      description: string;
      archive: ArchivedDerashaEntry[];
      comparativeStudies: ComparativeDerashaAnalysisResult[];
      activeStudy: ActiveStudySnapshot | null;
    }) => {
      createSystemSafePoint({
        label: params.label,
        description: params.description,
        triggerType: 'manual',
        archive: params.archive,
        comparativeStudies: params.comparativeStudies,
        activeStudy: params.activeStudy,
      });
      setSafePoints(loadLocalSafePoints());
    },
    []
  );

  const restoreSafePoint = useCallback(async (safePointId?: string): Promise<void> => {
    const restored = await restoreSystemSafePoint(safePointId);
    optionsRef.current.onRestoredSnapshot(restored);
    setSafePoints(loadLocalSafePoints());
  }, []);

  const deleteSafePoint = useCallback((safePointId: string) => {
    const updated = deleteSystemSafePoint(safePointId);
    setSafePoints(updated);
  }, []);

  const importSafePointJson = useCallback((rawJson: string) => {
    const imported = importSafePointFromJsonString(rawJson);
    optionsRef.current.onRestoredSnapshot(imported);
    setSafePoints(loadLocalSafePoints());
  }, []);

  const runVerifyAndRepair = useCallback(async () => {
    const report = await verifyAndRepairSystemState();
    optionsRef.current.onRepairedState(loadLocalArchive(), loadLocalComparativeStudies());
    setSafePoints(loadLocalSafePoints());
    return report;
  }, []);

  return {
    safePoints,
    refreshSafePoints,
    createManualSafePoint,
    restoreSafePoint,
    deleteSafePoint,
    importSafePointJson,
    runVerifyAndRepair,
  };
}

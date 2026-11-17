import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ConclusionLength,
  DerashaOutputPreferences,
  PardesAnalysisDepth,
  PardesLevelKey,
} from '../types';
import {
  DEFAULT_DERASHA_OUTPUT_PREFERENCES,
  hasCustomOutputPreferences,
  normalizeDerashaOutputPreferences,
} from '../utils/outputPreferences';

export const OUTPUT_PREFERENCES_STORAGE_KEY = 'darshan_output_prefs_v1';

export function useDerashaOutputPreferences() {
  const [outputPreferences, setOutputPreferencesState] = useState<DerashaOutputPreferences>(() => {
    try {
      const saved = localStorage.getItem(OUTPUT_PREFERENCES_STORAGE_KEY);
      if (saved) {
        return normalizeDerashaOutputPreferences(JSON.parse(saved));
      }
    } catch {
      // ignore storage read errors
    }
    return DEFAULT_DERASHA_OUTPUT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(OUTPUT_PREFERENCES_STORAGE_KEY, JSON.stringify(outputPreferences));
    } catch {
      // ignore storage quota errors
    }
  }, [outputPreferences]);

  const setOutputPreferences = useCallback(
    (next: DerashaOutputPreferences | ((prev: DerashaOutputPreferences) => DerashaOutputPreferences)) => {
      setOutputPreferencesState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        return normalizeDerashaOutputPreferences(resolved);
      });
    },
    []
  );

  const setPardesLevelDepth = useCallback(
    (level: PardesLevelKey, depth: PardesAnalysisDepth) => {
      setOutputPreferencesState((prev) =>
        normalizeDerashaOutputPreferences({
          ...prev,
          pardesDepth: {
            ...prev.pardesDepth,
            [level]: depth,
          },
        })
      );
    },
    []
  );

  const applyAllPardesDepth = useCallback((depth: PardesAnalysisDepth) => {
    setOutputPreferencesState((prev) =>
      normalizeDerashaOutputPreferences({
        ...prev,
        pardesDepth: {
          pshat: depth,
          remez: depth,
          drash: depth,
          sod: depth,
        },
      })
    );
  }, []);

  const togglePrioritizedPardesLevel = useCallback((level: PardesLevelKey) => {
    setOutputPreferencesState((prev) => {
      const exists = prev.prioritizedLevels.includes(level);
      const nextPrioritized = exists
        ? prev.prioritizedLevels.filter((l) => l !== level)
        : [...prev.prioritizedLevels, level];
      return normalizeDerashaOutputPreferences({
        ...prev,
        prioritizedLevels: nextPrioritized,
      });
    });
  }, []);

  const setConclusionLength = useCallback((conclusionLength: ConclusionLength) => {
    setOutputPreferencesState((prev) =>
      normalizeDerashaOutputPreferences({
        ...prev,
        conclusionLength,
      })
    );
  }, []);

  const resetOutputPreferences = useCallback(() => {
    setOutputPreferencesState(DEFAULT_DERASHA_OUTPUT_PREFERENCES);
  }, []);

  const isOutputCustomized = useMemo(
    () => hasCustomOutputPreferences(outputPreferences),
    [outputPreferences]
  );

  return {
    outputPreferences,
    setOutputPreferences,
    setPardesLevelDepth,
    applyAllPardesDepth,
    togglePrioritizedPardesLevel,
    setConclusionLength,
    resetOutputPreferences,
    isOutputCustomized,
  };
}

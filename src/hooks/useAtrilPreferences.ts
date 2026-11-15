import { useState, useCallback, useMemo } from 'react';

export type AtrilReadingScale = 'normal' | 'atril' | 'bima';
export type AtrilTypographyPreset = 'serif' | 'sans' | 'hebrew_trad';

const SCALE_STORAGE_KEY = 'darshan_atril_scale_v1';
const FONT_STORAGE_KEY = 'darshan_atril_font_v1';

export function useAtrilPreferences() {
  const [readingScale, setReadingScale] = useState<AtrilReadingScale>(() => {
    try {
      const saved = localStorage.getItem(SCALE_STORAGE_KEY);
      if (saved === 'atril' || saved === 'bima' || saved === 'normal') return saved;
    } catch {
      // ignore storage errors
    }
    return 'normal';
  });

  const [atrilTypography, setAtrilTypography] = useState<AtrilTypographyPreset>(() => {
    try {
      const saved = localStorage.getItem(FONT_STORAGE_KEY);
      if (saved === 'serif' || saved === 'sans' || saved === 'hebrew_trad') return saved;
    } catch {
      // ignore storage errors
    }
    return 'serif';
  });

  const [isAtrilConfigOpen, setIsAtrilConfigOpen] = useState<boolean>(false);

  const handleSelectAtrilTypography = useCallback((font: AtrilTypographyPreset) => {
    setAtrilTypography(font);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, font);
    } catch {
      // ignore
    }
  }, []);

  const handleSelectReadingScale = useCallback((scale: AtrilReadingScale) => {
    setReadingScale(scale);
    try {
      localStorage.setItem(SCALE_STORAGE_KEY, scale);
    } catch {
      // ignore
    }
  }, []);

  const cycleReadingScale = useCallback(() => {
    setReadingScale((prev) => {
      const next: AtrilReadingScale =
        prev === 'normal' ? 'atril' : prev === 'atril' ? 'bima' : 'normal';
      try {
        localStorage.setItem(SCALE_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const typographyClass = useMemo(
    () =>
      atrilTypography === 'sans'
        ? 'atril-font-sans'
        : atrilTypography === 'hebrew_trad'
        ? 'atril-font-hebrew-trad'
        : 'atril-font-serif',
    [atrilTypography]
  );

  const scaleClass = useMemo(
    () =>
      readingScale === 'atril'
        ? 'atril-scale-atril text-lg leading-relaxed'
        : readingScale === 'bima'
        ? 'atril-scale-bima text-xl leading-loose'
        : '',
    [readingScale]
  );

  return {
    readingScale,
    atrilTypography,
    isAtrilConfigOpen,
    setIsAtrilConfigOpen,
    handleSelectAtrilTypography,
    handleSelectReadingScale,
    cycleReadingScale,
    typographyClass,
    scaleClass,
  };
}

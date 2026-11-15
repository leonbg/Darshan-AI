import React from 'react';
import { Type } from 'lucide-react';
import { AtrilReadingScale, AtrilTypographyPreset } from '../../hooks/useAtrilPreferences';

interface AtrilTypographyConfigPanelProps {
  readingScale: AtrilReadingScale;
  atrilTypography: AtrilTypographyPreset;
  onSelectScale: (scale: AtrilReadingScale) => void;
  onSelectTypography: (font: AtrilTypographyPreset) => void;
  onClose: () => void;
}

export const AtrilTypographyConfigPanel: React.FC<AtrilTypographyConfigPanelProps> = React.memo(({
  readingScale,
  atrilTypography,
  onSelectScale,
  onSelectTypography,
  onClose,
}) => {
  return (
    <section
      id="atril-typography-config"
      className="rounded-2xl bg-gradient-to-b from-amber-950/30 via-[#0c1427] to-[#090f1d] border border-amber-500/35 p-4 sm:p-5 space-y-4 shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Configuración de Lectura y Tipografía · Modo Atril</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-200">
                {readingScale === 'normal'
                  ? 'Escala Estándar (A)'
                  : readingScale === 'atril'
                  ? 'Modo Atril Activo (A+)'
                  : 'Modo Bimá Máximo (A++)'}
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Alterna entre Serif editorial (Frank Ruhl Libre), Sans Serif moderna (Heebo) y Fuentes Hebreas Tradicionales (David Libre · Cardo), y ajusta el tamaño para estudio o disertación desde el atril.
            </p>
          </div>
        </div>

        {/* Selector de Escala de Lectura (A / A+ / A++) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-[#070c18] p-1 rounded-xl border border-slate-800 text-xs gap-1">
            <button
              type="button"
              onClick={() => onSelectScale('normal')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                readingScale === 'normal'
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Estándar (A)
            </button>
            <button
              type="button"
              onClick={() => onSelectScale('atril')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                readingScale === 'atril'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Atril (A+)
            </button>
            <button
              type="button"
              onClick={() => onSelectScale('bima')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                readingScale === 'bima'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bimá / Púlpito (A++)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* 3 Tarjetas de Selección de Tipografía */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Opción 1: Serif (Frank Ruhl Libre) */}
        <button
          type="button"
          onClick={() => onSelectTypography('serif')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
            atrilTypography === 'serif'
              ? 'bg-sky-950/45 border-sky-400/70 ring-1 ring-sky-400/40 shadow-md'
              : 'bg-[#070c18]/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                1. Serif Clásica
              </span>
              {atrilTypography === 'serif' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-400 text-slate-950">
                  Activa
                </span>
              )}
            </div>
            <div
              className="text-base font-bold text-white"
              style={{ fontFamily: "'Frank Ruhl Libre', Georgia, serif" }}
            >
              Frank Ruhl Libre
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Tipografía editorial clásica con serifa, ideal para lectura pausada de ensayos exegéticos y discurso rabínico.
            </p>
          </div>

          <div
            className="pt-2 border-t border-slate-800/80 space-y-1"
            style={{ fontFamily: "'Frank Ruhl Libre', Georgia, serif" }}
          >
            <p className="text-right text-lg text-sky-200 font-bold" dir="rtl">
              פְּשָׁט · רֶמֶז · דְּרַשׁ · סוֹד
            </p>
            <p className="text-xs text-slate-200 italic">
              «La Torá tiene setenta rostros de interpretación.»
            </p>
          </div>
        </button>

        {/* Opción 2: Sans Serif (Heebo) */}
        <button
          type="button"
          onClick={() => onSelectTypography('sans')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
            atrilTypography === 'sans'
              ? 'bg-emerald-950/40 border-emerald-400/70 ring-1 ring-emerald-400/40 shadow-md'
              : 'bg-[#070c18]/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                2. Sans Serif Moderna
              </span>
              {atrilTypography === 'sans' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-950">
                  Activa
                </span>
              )}
            </div>
            <div
              className="text-base font-bold text-white"
              style={{ fontFamily: "'Heebo', sans-serif" }}
            >
              Heebo (Sans Serif)
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Trazo limpio sin serifa de máxima nitidez en pantallas y proyectores, excelente para lectura rápida a distancia.
            </p>
          </div>

          <div
            className="pt-2 border-t border-slate-800/80 space-y-1"
            style={{ fontFamily: "'Heebo', sans-serif" }}
          >
            <p className="text-right text-lg text-emerald-200 font-bold" dir="rtl">
              פְּשָׁט · רֶמֶז · דְּרַשׁ · סוֹד
            </p>
            <p className="text-xs text-slate-200">
              «La Torá tiene setenta rostros de interpretación.»
            </p>
          </div>
        </button>

        {/* Opción 3: Fuentes Hebreas Tradicionales (David Libre · Cardo · Noto Serif Hebrew) */}
        <button
          type="button"
          onClick={() => onSelectTypography('hebrew_trad')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
            atrilTypography === 'hebrew_trad'
              ? 'bg-amber-950/45 border-amber-400/70 ring-1 ring-amber-400/40 shadow-md'
              : 'bg-[#070c18]/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                3. Hebreo Tradicional (Séfer)
              </span>
              {atrilTypography === 'hebrew_trad' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                  Activa
                </span>
              )}
            </div>
            <div
              className="text-base font-bold text-white"
              style={{ fontFamily: "'David Libre', 'Cardo', serif" }}
            >
              David Libre · Cardo · Sefarad
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Caligrafía impresa de Séfer tradicional con vocalización masorética (*Nikud*) amplia y prosa humanista clásica.
            </p>
          </div>

          <div
            className="pt-2 border-t border-slate-800/80 space-y-1"
            style={{ fontFamily: "'David Libre', 'Noto Serif Hebrew', 'Cardo', serif" }}
          >
            <p className="text-right text-lg text-amber-200 font-bold tracking-wide" dir="rtl">
              בְּרֵאשִׁית בָּרָא אֱלֹהִים · פַּרְדֵּ״ס
            </p>
            <p className="text-xs text-slate-200 italic">
              «La Torá tiene setenta rostros de interpretación.»
            </p>
          </div>
        </button>
      </div>
    </section>
  );
});

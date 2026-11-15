import React, { useState, useRef } from 'react';
import {
  Settings,
  X,
  Type,
  ShieldCheck,
  Wrench,
  RotateCcw,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  LayoutGrid,
  AlignLeft,
  AlignRight,
  BookOpen,
} from 'lucide-react';
import { AtrilReadingScale, AtrilTypographyPreset } from '../../hooks/useAtrilPreferences';
import { SystemSafePointSnapshot } from '../../types';
import {
  exportSafePointToJsonFile,
  GOLDEN_BASELINE_ID,
} from '../../services/safePointService';
import { WorkspaceTab } from './Header';
import { PWAInstallButton } from './PWAInstallButton';

export type SettingsModalTab = 'typography' | 'backup' | 'maintenance';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsModalTab;
  // Typography & Reading Scale
  readingScale: AtrilReadingScale;
  atrilTypography: AtrilTypographyPreset;
  onSelectScale: (scale: AtrilReadingScale) => void;
  onSelectTypography: (font: AtrilTypographyPreset) => void;
  isRtl: boolean;
  onToggleRtl: () => void;
  // Workspace layout mode
  workspaceMode: WorkspaceTab;
  onChangeWorkspaceMode: (mode: WorkspaceTab) => void;
  // SafePoints & Backup
  safePoints: SystemSafePointSnapshot[];
  onCreateManualSafePoint: (label: string, description: string) => void;
  onRestoreSafePoint: (safePointId: string) => Promise<void>;
  onDeleteSafePoint: (safePointId: string) => void;
  onImportSafePointJson: (rawJson: string) => void;
  onRunVerifyAndRepair: () => Promise<{
    healthy: boolean;
    repairedIssues: string[];
    archiveCount: number;
    safePointsCount: number;
    checksum: string;
  }>;
  archiveCount: number;
  comparativeCount: number;
  activeStudyTitle?: string;
  onOpenAboutModal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'typography',
  readingScale,
  atrilTypography,
  onSelectScale,
  onSelectTypography,
  isRtl,
  onToggleRtl,
  workspaceMode,
  onChangeWorkspaceMode,
  safePoints,
  onCreateManualSafePoint,
  onRestoreSafePoint,
  onDeleteSafePoint,
  onImportSafePointJson,
  onRunVerifyAndRepair,
  archiveCount,
  comparativeCount,
  activeStudyTitle,
  onOpenAboutModal,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsModalTab>(initialTab);
  const [customLabel, setCustomLabel] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateManualSafePoint(customLabel, customDescription);
    setCustomLabel('');
    setCustomDescription('');
    setStatusBanner({
      type: 'success',
      message: 'Punto Seguro de respaldo creado y sincronizado correctamente.',
    });
  };

  const handleRestoreClick = async (sp: SystemSafePointSnapshot) => {
    setRestoringId(sp.id);
    setStatusBanner(null);
    try {
      await onRestoreSafePoint(sp.id);
      setStatusBanner({
        type: 'success',
        message: `Estado restaurado con éxito desde «${sp.label}» (${sp.checksum}).`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'No se pudo restaurar el respaldo seleccionado.',
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handleVerifyClick = async () => {
    setIsVerifying(true);
    setStatusBanner(null);
    try {
      const report = await onRunVerifyAndRepair();
      const details =
        report.repairedIssues.length > 0
          ? report.repairedIssues.join(' ')
          : `Integridad verificada sin anomalías (${report.archiveCount} Derashot, ${report.safePointsCount} respaldos, firma ${report.checksum}).`;
      setStatusBanner({
        type: 'success',
        message: details,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Error al verificar la integridad del sistema.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        onImportSafePointJson(text);
        setStatusBanner({
          type: 'success',
          message: `Archivo de respaldo «${file.name}» importado correctamente.`,
        });
      } catch (err: any) {
        setStatusBanner({
          type: 'error',
          message: err?.message || 'El archivo JSON no tiene un formato de Punto Seguro válido.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0d1526] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-[#090f1d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Ajustes, Tipografía, Respaldo y Mantenimiento
              </h2>
              <p className="text-xs text-slate-400">
                Configuración de lectura en atril, copias de seguridad (Puntos Seguros) y herramientas del sistema
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 transition cursor-pointer"
            aria-label="Cerrar ajustes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs inside Settings */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#0a1120] border-b border-slate-800/90 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('typography')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'typography'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>1. Tipografías y Modo Atril</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-emerald-400 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>2. Respaldo y Puntos Seguros ({safePoints.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-sky-400 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>3. Mantenimiento y Sistema</span>
          </button>
        </div>

        {/* Status Banner */}
        {statusBanner && (
          <div
            className={`mx-5 sm:mx-6 mt-4 p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: TYPOGRAPHY & ATRIL / BIMA */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              {/* Reading Scale Selector */}
              <div className="p-4 rounded-2xl bg-[#090f1d] border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Escala de Lectura para Estudio, Atril o Bimá
                    </h3>
                    <p className="text-xs text-slate-400">
                      Ajusta el tamaño global del texto de la Drashá para lectura en escritorio o disertación desde el púlpito.
                    </p>
                  </div>
                  <div className="flex items-center bg-[#060a14] p-1 rounded-xl border border-slate-800 text-xs gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectScale('normal')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
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
                      className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                        readingScale === 'atril'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Modo Atril (A+)
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectScale('bima')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                        readingScale === 'bima'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bimá / Púlpito (A++)
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Typography Cards */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-white">
                  Familia Tipográfica Editorial y Hebrea
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Serif */}
                  <button
                    type="button"
                    onClick={() => onSelectTypography('serif')}
                    className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      atrilTypography === 'serif'
                        ? 'bg-sky-950/45 border-sky-400/70 ring-1 ring-sky-400/40 shadow-md'
                        : 'bg-[#090f1d] border-slate-800 hover:border-slate-700'
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

                  {/* Sans Serif */}
                  <button
                    type="button"
                    onClick={() => onSelectTypography('sans')}
                    className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      atrilTypography === 'sans'
                        ? 'bg-emerald-950/40 border-emerald-400/70 ring-1 ring-emerald-400/40 shadow-md'
                        : 'bg-[#090f1d] border-slate-800 hover:border-slate-700'
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

                  {/* Hebrew Traditional */}
                  <button
                    type="button"
                    onClick={() => onSelectTypography('hebrew_trad')}
                    className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      atrilTypography === 'hebrew_trad'
                        ? 'bg-amber-950/45 border-amber-400/70 ring-1 ring-amber-400/40 shadow-md'
                        : 'bg-[#090f1d] border-slate-800 hover:border-slate-700'
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
                        Caligrafía impresa de Séfer tradicional con vocalización masorética (Nikud) amplia y prosa humanista clásica.
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
              </div>

              {/* Writing Direction (LTR / RTL) */}
              <div className="p-4 rounded-2xl bg-[#090f1d] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Dirección de Escritura en el Recuadro de Estudio
                  </h4>
                  <p className="text-xs text-slate-400">
                    Alterna entre escritura de izquierda a derecha (Español) o de derecha a izquierda para introducir texto en Hebreo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleRtl}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isRtl
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {isRtl ? (
                    <AlignRight className="w-4 h-4 text-sky-400" />
                  ) : (
                    <AlignLeft className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{isRtl ? 'Modo Activo: RTL · עברית' : 'Modo Activo: LTR · Español'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BACKUP & SAFE POINTS */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Create Manual SafePoint + Import File */}
              <form
                onSubmit={handleCreateSubmit}
                className="p-4 rounded-2xl bg-[#090f1d] border border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Crear Copia de Respaldo (Punto Seguro)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Guarda el estado actual ({archiveCount} Derashot en archivo
                      {activeStudyTitle ? ` · Estudio activo: «${activeStudyTitle}»` : ''}).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>Importar JSON</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Nombre del respaldo (ej. Antes de preparar Shabat)"
                    className="sm:col-span-5 px-3 py-2 rounded-xl bg-[#060a14] border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-emerald-400 outline-none"
                  />
                  <input
                    type="text"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Notas opcionales sobre esta versión..."
                    className="sm:col-span-5 px-3 py-2 rounded-xl bg-[#060a14] border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-emerald-400 outline-none"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </button>
                </div>
              </form>

              {/* List of SafePoints */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Puntos Seguros Disponibles ({safePoints.length})
                </h4>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {safePoints.map((sp) => {
                    const isGolden = sp.id === GOLDEN_BASELINE_ID || sp.isPinnedBaseline;
                    const isRestoring = restoringId === sp.id;
                    return (
                      <div
                        key={sp.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isGolden
                            ? 'bg-emerald-950/25 border-emerald-500/40'
                            : 'bg-[#090f1d] border-slate-800'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-white truncate">
                              {sp.label}
                            </span>
                            {isGolden && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                                Versión Dorada Base
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-slate-400">
                              {sp.checksum}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {sp.description}
                          </p>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                            <span>{new Date(sp.createdAt).toLocaleString('es-ES')}</span>
                            <span>·</span>
                            <span>{sp.stats.archiveCount} Derashot en archivo</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreClick(sp)}
                            disabled={isRestoring}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isRestoring ? 'Restaurando...' : 'Restaurar'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => exportSafePointToJsonFile(sp)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Descargar respaldo en archivo .json"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {!isGolden && (
                            <button
                              type="button"
                              onClick={() => onDeleteSafePoint(sp.id)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                              title="Eliminar punto seguro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MAINTENANCE & SYSTEM */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              {/* Integrity Verification & Repair */}
              <div className="p-4 rounded-2xl bg-[#090f1d] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-sky-400" />
                    <span>Verificación y Autorreparación de Integridad</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprueba la estructura del archivo de Derashot ({archiveCount} guardadas, {comparativeCount} estudios comparativos), repara índices numerados y sincroniza el respaldo con el servidor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyClick}
                  disabled={isVerifying}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>
                    {isVerifying ? 'Verificando...' : 'Verificar y Reparar Ahora'}
                  </span>
                </button>
              </div>

              {/* Workspace Display Mode */}
              <div className="p-4 rounded-2xl bg-[#090f1d] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-indigo-400" />
                    <span>Modo de Visualización de Paneles Inferiores</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Elige si deseas explorar las sugerencias (Parashá, Festividades, Musar y Archivo) por pestañas enfocadas o desplegar todos los paneles simultáneamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeWorkspaceMode(workspaceMode === 'todo' ? 'estudio' : 'todo')
                  }
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    workspaceMode === 'todo'
                      ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>
                    {workspaceMode === 'todo'
                      ? 'Vista Continua Activa (Ver por pestañas)'
                      : 'Activar Vista Continua (Todo Junto)'}
                  </span>
                </button>
              </div>

              {/* PWA Install & Guide */}
              <div className="p-4 rounded-2xl bg-[#090f1d] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>Documentación Metodológica e Instalación Local</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Consulta la guía de exégesis PARDÉS y el flujo antialucinación de 3 fases, o instala la aplicación en tu dispositivo.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PWAInstallButton />
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAboutModal();
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Abrir Guía Pardés</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-[#090f1d] text-xs text-slate-400">
          <span>
            Escala activa:{' '}
            <strong className="text-slate-200">
              {readingScale === 'bima'
                ? 'Modo Bimá (A++)'
                : readingScale === 'atril'
                ? 'Modo Atril (A+)'
                : 'Estándar (A)'}
            </strong>{' '}
            · Respaldos: <strong className="text-emerald-300">{safePoints.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

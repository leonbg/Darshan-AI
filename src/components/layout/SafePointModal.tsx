import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  X,
  RotateCcw,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Wrench,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { SystemSafePointSnapshot } from '../../types';
import {
  exportSafePointToJsonFile,
  GOLDEN_BASELINE_ID,
} from '../../services/safePointService';

interface SafePointModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const SafePointModal: React.FC<SafePointModalProps> = ({
  isOpen,
  onClose,
  safePoints,
  onCreateManualSafePoint,
  onRestoreSafePoint,
  onDeleteSafePoint,
  onImportSafePointJson,
  onRunVerifyAndRepair,
  archiveCount,
  comparativeCount,
  activeStudyTitle,
}) => {
  const [customLabel, setCustomLabel] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateManualSafePoint(customLabel, customDescription);
    setCustomLabel('');
    setCustomDescription('');
    setStatusBanner({
      type: 'success',
      message: 'Punto Seguro creado y sincronizado con el almacén local y del servidor.',
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
        message: err?.message || 'No se pudo restaurar el Punto Seguro seleccionado.',
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
          : `Integridad verificada sin anomalías (${report.archiveCount} Derashot, firma ${report.checksum}).`;
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
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        onImportSafePointJson(text);
        setStatusBanner({
          type: 'success',
          message: `Respaldo «${file.name}» importado y registrado como Punto Seguro.`,
        });
      } catch (err: any) {
        setStatusBanner({
          type: 'error',
          message: err?.message || 'El archivo seleccionado no es un Punto Seguro válido.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getTriggerLabel = (type: SystemSafePointSnapshot['triggerType']) => {
    if (type === 'baseline') return 'Base Inmutable del Sistema';
    if (type === 'auto') return 'Automático';
    if (type === 'emergency') return 'Pre-Fallo';
    return 'Manual';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#0b1326] border border-slate-700/90 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#080e1e] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/35 flex items-center justify-center text-emerald-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-editorial font-bold text-white">
                Puntos Seguros y Versión de Respaldo / Fallback v2.0
              </h2>
              <p className="text-xs text-slate-400">
                Respaldo automático, Validador Halájico y Motor de Fallback Determinista · {archiveCount} Derashot protegidas (#1–#{archiveCount})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            aria-label="Cerrar ventana de Puntos Seguros"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Feedback Banner */}
          {statusBanner && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                statusBanner.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              }`}
            >
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusBanner.message}</span>
            </div>
          )}

          {/* Current System State Summary + Self-Healing Action */}
          <div className="p-4 rounded-xl bg-[#070c18] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                <span>Estado actual en vivo</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-200 font-medium">{archiveCount} Derashot</span>
                <span aria-hidden="true">·</span>
                <span>{comparativeCount} Estudios comparativos</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-300 font-medium">
                  Fallback v2.0 + Validador Halájico Activo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {activeStudyTitle
                  ? `Estudio activo en mesa: «${activeStudyTitle}»`
                  : 'Mesa de estudio lista para nueva consulta'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleVerifyClick}
                disabled={isVerifying}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isVerifying ? 'Verificando...' : 'Verificar y Reparar Integridad'}
                </span>
              </button>

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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-medium transition cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Importar Respaldo (.json)</span>
              </button>
            </div>
          </div>

          {/* Create Manual Safe Point Form */}
          <form
            onSubmit={handleCreateSubmit}
            className="p-4 rounded-xl bg-[#091021] border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-white">
                Crear Nuevo Punto Seguro Ahora
              </h3>
              <span className="text-xs text-slate-400">
                Guarda instantáneamente el archivo, comparativas y estudio actual
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Etiqueta opcional (ej. Antes de nuevo estudio)"
                className="w-full px-3.5 py-2 rounded-xl bg-[#060a14] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Nota opcional sobre este estado"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-[#060a14] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Guardar Punto</span>
                </button>
              </div>
            </div>
          </form>

          {/* List of Available Safe Points */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-200">
              Puntos Seguros Disponibles para Restauración ({safePoints.length})
            </h3>

            <div className="space-y-2.5">
              {safePoints.map((sp) => {
                const isGolden = sp.id === GOLDEN_BASELINE_ID || sp.isPinnedBaseline;
                const isRestoringThis = restoringId === sp.id;
                const formattedTime = new Date(sp.createdAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={sp.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isGolden
                        ? 'bg-emerald-950/20 border-emerald-500/35'
                        : 'bg-[#080d1a] border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 tabular-nums">
                        <span
                          className={
                            isGolden
                              ? 'font-semibold text-emerald-300'
                              : 'font-medium text-sky-300'
                          }
                        >
                          {getTriggerLabel(sp.triggerType)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{sp.checksum}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formattedTime}</span>
                      </div>

                      <h4 className="text-sm font-semibold text-white truncate">
                        {sp.label}
                      </h4>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {sp.description}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                        <span>{sp.stats.archiveCount} Derashot (#1–#{sp.stats.archiveCount})</span>
                        <span aria-hidden="true">·</span>
                        <span>{sp.stats.comparativeCount} comparativas</span>
                        {sp.stats.activeStudyTitle && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-xs">
                              Mesa: {sp.stats.activeStudyTitle}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreClick(sp)}
                        disabled={isRestoringThis}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                          isGolden
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                            : 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>
                          {isRestoringThis ? 'Restaurando...' : 'Restaurar'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportSafePointToJsonFile(sp)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Descargar este Punto Seguro como archivo .json"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {!isGolden && (
                        <button
                          type="button"
                          onClick={() => onDeleteSafePoint(sp.id)}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                          title="Eliminar este Punto Seguro manual"
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

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#080e1e] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            El Punto Seguro Base v1.0 está integrado en el código y nunca puede borrarse.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  ShieldAlert,
  RotateCcw,
  ShieldCheck,
  Download,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  createSystemSafePoint,
  exportSafePointToJsonFile,
  GOLDEN_BASELINE_ID,
  loadLocalSafePoints,
  restoreSystemSafePoint,
} from '../../services/safePointService';

interface SystemSafePointBoundaryProps {
  children: ReactNode;
}

interface SystemSafePointBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorTimestamp: string;
  isRestoring: boolean;
  recoverySuccessMessage: string | null;
  boundaryResetKey: number;
}

export class SystemSafePointBoundary extends Component<
  SystemSafePointBoundaryProps,
  SystemSafePointBoundaryState
> {
  constructor(props: SystemSafePointBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorTimestamp: '',
      isRestoring: false,
      recoverySuccessMessage: null,
      boundaryResetKey: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SystemSafePointBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado de ejecución en el sistema.',
      errorTimestamp: new Date().toLocaleTimeString('es-ES'),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Darshán AI · SafePoint Boundary] Error interceptado:', error, errorInfo);
    try {
      // Automatically create an emergency pre-crash safe point of the intact archive
      createSystemSafePoint({
        label: 'Respaldo Automático de Emergencia',
        description: `Capturado automáticamente al interceptar un error del sistema (${
          error?.message || 'Error de renderizado'
        }).`,
        triggerType: 'emergency',
      });
    } catch {
      // ignore storage errors during emergency capture
    }
  }

  handleRestoreLatestSafePoint = async () => {
    this.setState({ isRestoring: true });
    try {
      const restored = await restoreSystemSafePoint();
      this.setState((prev) => ({
        hasError: false,
        errorMessage: '',
        isRestoring: false,
        recoverySuccessMessage: `Restaurado con éxito: ${restored.label} (${restored.checksum})`,
        boundaryResetKey: prev.boundaryResetKey + 1,
      }));
      setTimeout(() => {
        this.setState({ recoverySuccessMessage: null });
      }, 5000);
    } catch {
      window.location.reload();
    }
  };

  handleRestoreGoldenBaseline = async () => {
    this.setState({ isRestoring: true });
    try {
      const restored = await restoreSystemSafePoint(GOLDEN_BASELINE_ID);
      this.setState((prev) => ({
        hasError: false,
        errorMessage: '',
        isRestoring: false,
        recoverySuccessMessage: `Restaurado al Punto Seguro Base Canónico (${restored.checksum})`,
        boundaryResetKey: prev.boundaryResetKey + 1,
      }));
      setTimeout(() => {
        this.setState({ recoverySuccessMessage: null });
      }, 5000);
    } catch {
      window.location.reload();
    }
  };

  handleExportEmergencyBackup = () => {
    const snapshots = loadLocalSafePoints();
    const target = snapshots[0];
    if (target) {
      exportSafePointToJsonFile(target);
    }
  };

  render() {
    if (this.state.hasError) {
      const snapshots = loadLocalSafePoints();
      const latestAutoOrManual =
        snapshots.find((s) => !s.isPinnedBaseline) || snapshots[0];

      return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-2xl w-full rounded-2xl bg-[#0b1326] border border-sky-500/40 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-sky-400">
                  Escudo de Protección del Sistema · Punto Seguro Activo
                </span>
                <h1 className="text-xl sm:text-2xl font-editorial font-bold text-white">
                  Se activó el Punto de Recuperación Segura
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  El sistema interceptó una anomalía inesperada y protegió automáticamente tu archivo de Derashot y tus estudios comparativos. Puedes volver en un clic a un estado estable verificado.
                </p>
              </div>
            </div>

            {/* Diagnostic Summary */}
            <div className="p-4 rounded-xl bg-[#070c18] border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Diagnóstico capturado ({this.state.errorTimestamp}):</span>
                <span className="font-mono text-emerald-400">
                  Archivo intacto ({latestAutoOrManual?.stats.archiveCount || 10} Derashot)
                </span>
              </div>
              <p className="font-mono text-rose-300 break-words">
                {this.state.errorMessage}
              </p>
            </div>

            {/* Recovery Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={this.handleRestoreLatestSafePoint}
                disabled={this.state.isRestoring}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Restaurar Último Punto Seguro</span>
              </button>

              <button
                type="button"
                onClick={this.handleRestoreGoldenBaseline}
                disabled={this.state.isRestoring}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Volver al Respaldo Base v2.0 (#1–#10)</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={this.handleExportEmergencyBackup}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Descargar copia de seguridad completa (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar aplicación</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.boundaryResetKey}>
        {this.state.recoverySuccessMessage && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2 text-center text-xs text-emerald-200 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{this.state.recoverySuccessMessage}</span>
          </div>
        )}
        {this.props.children}
      </React.Fragment>
    );
  }
}

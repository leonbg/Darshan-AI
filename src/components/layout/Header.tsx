import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Settings,
  User as UserIcon,
  HardDrive,
  RefreshCw,
  ExternalLink,
  LogOut,
  CheckCircle2,
  History,
  Trash2,
  FileText,
  Search,
  X,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { User } from '../../services/firebase';
import { ArchivedDerashaEntry } from '../../types';

export type WorkspaceTab = 'estudio' | 'calendario' | 'archivo' | 'todo';

interface HeaderProps {
  onOpenAboutModal: () => void;
  onOpenUserManualModal?: () => void;
  onOpenSettingsModal?: () => void;
  onNavigateSection?: (target: 'study' | 'archive' | 'topics' | 'musar') => void;
  archivedCount?: number;
  archivedEntries?: ArchivedDerashaEntry[];
  onOpenArchivedDerasha?: (entry: ArchivedDerashaEntry) => void;
  onDeleteArchivedDerasha?: (sequenceNumber: number) => void;
  activeWorkspace?: WorkspaceTab;
  activeHubTab?: 'parasha' | 'festividades' | 'musar' | 'preguntas';
  currentUser?: User | null;
  driveConnected?: boolean;
  isSigningIn?: boolean;
  isSyncingDrive?: boolean;
  driveFolderUrl?: string | null;
  driveFileCount?: number;
  onSignInGoogle?: () => void;
  onSignOutGoogle?: () => void;
  onSyncDriveNow?: () => void;
  homeResetSignal?: number;
  isHomeTapArmed?: boolean;
  onClearOrReturnHome?: () => void;
}

const HeaderComponent: React.FC<HeaderProps> = ({
  onOpenAboutModal,
  onOpenUserManualModal,
  onOpenSettingsModal,
  onNavigateSection,
  archivedCount = 8,
  archivedEntries = [],
  onOpenArchivedDerasha,
  onDeleteArchivedDerasha,
  activeWorkspace = 'estudio',
  activeHubTab,
  currentUser = null,
  driveConnected = false,
  isSigningIn = false,
  isSyncingDrive = false,
  driveFolderUrl = null,
  driveFileCount = 0,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncDriveNow,
  homeResetSignal = 0,
  isHomeTapArmed = false,
  onClearOrReturnHome,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [confirmDeleteSeq, setConfirmDeleteSeq] = useState<number | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const historyMenuRef = useRef<HTMLDivElement | null>(null);

  const isMusarActive = activeWorkspace === 'calendario' && activeHubTab === 'musar';
  const isCalendarActive = activeWorkspace === 'calendario' && activeHubTab !== 'musar';

  useEffect(() => {
    if (!isProfileMenuOpen && !isHistoryMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (historyMenuRef.current && !historyMenuRef.current.contains(event.target as Node)) {
        setIsHistoryMenuOpen(false);
        setConfirmDeleteSeq(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen, isHistoryMenuOpen]);

  useEffect(() => {
    if (homeResetSignal > 0) {
      setIsHistoryMenuOpen(false);
      setIsProfileMenuOpen(false);
      setHistorySearch('');
      setConfirmDeleteSeq(null);
    }
  }, [homeResetSignal]);

  const filteredHistoryEntries = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const list = [...archivedEntries].sort((a, b) => b.sequenceNumber - a.sequenceNumber);
    if (!q) return list;
    return list.filter(
      (item) =>
        `#${item.sequenceNumber}`.includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.query.toLowerCase().includes(q)
    );
  }, [archivedEntries, historySearch]);

  const userInitial = (
    currentUser?.displayName?.trim()?.[0] ||
    currentUser?.email?.trim()?.[0] ||
    'U'
  ).toUpperCase();

  return (
    <header className="border-b border-slate-800/80 bg-[#0b1120]/90 backdrop-blur-md sticky top-0 z-40 safe-top">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Lockup (single-line wordmark) */}
        <a
          href="#study-desk"
          onClick={(e) => {
            if (onNavigateSection) {
              e.preventDefault();
              onNavigateSection('study');
            }
          }}
          className="flex items-center gap-3 group shrink-0 whitespace-nowrap"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 group-hover:border-sky-500/50 transition-colors">
            <span className="font-hebrew font-bold text-lg text-sky-400 select-none leading-none">
              ד
            </span>
          </div>
          <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
            Darshán <span className="text-sky-400">AI</span>
          </span>
        </a>

        {/* Zone 2: Navigation Links (single-line, generous spacing) */}
        <nav className="hidden md:flex items-center gap-3.5 lg:gap-5 text-xs font-medium text-slate-400">
          <button
            type="button"
            onClick={() => onNavigateSection?.('study')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
              activeWorkspace === 'estudio'
                ? 'text-white border-sky-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Mesa de Estudio
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection?.('topics')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
              isCalendarActive
                ? 'text-amber-300 border-amber-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Parashá y Festividades
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection?.('archive')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
              activeWorkspace === 'archivo'
                ? 'text-sky-300 border-sky-400 font-semibold'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Archivo y Comparador ({archivedCount})
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection?.('musar')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
              isMusarActive
                ? 'text-emerald-300 border-emerald-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Musar Diario
          </button>
        </nav>

        {/* Zone 3: Primary Actions (Limpiar / Inicio + Historial Icon + Guía Pardés + Gear Settings + Google Profile Icon) */}
        <div className="flex items-center gap-2 shrink-0">
          {onClearOrReturnHome && (
            <button
              type="button"
              onClick={() => {
                setIsHistoryMenuOpen(false);
                setIsProfileMenuOpen(false);
                onClearOrReturnHome();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer select-none ${
                isHomeTapArmed
                  ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600/80 hover:border-sky-400/60'
              }`}
              title="1 toque: limpiar recuadro de consulta · 2 toques: volver al inicio de la aplicación (cierra historial o cualquier sección)"
              aria-label="Limpiar consulta o tocar dos veces para volver al inicio"
            >
              {isHomeTapArmed ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>2º toque: Inicio</span>
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Limpiar</span>
                </>
              )}
            </button>
          )}

          {/* Small, Recognizable History Button with Clock-Rewind Graphic & Quick History Popover */}
          <div className="relative" ref={historyMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsHistoryMenuOpen((prev) => !prev);
                setIsProfileMenuOpen(false);
                setConfirmDeleteSeq(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isHistoryMenuOpen || activeWorkspace === 'archivo'
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80 hover:border-amber-400/40'
              }`}
              title="Historial de Derashot: acceder a estudios anteriores o eliminar los que no sean de interés"
              aria-label="Abrir historial de Derashot anteriores"
            >
              <History className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Historial</span>
              <span className="text-[11px] font-mono text-amber-300/90">({archivedCount})</span>
            </button>

            {isHistoryMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0d1629] border border-slate-700/90 shadow-2xl p-3.5 z-50 text-xs space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-white text-xs sm:text-sm">
                      Historial de Derashot ({archivedEntries.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHistoryMenuOpen(false);
                      onNavigateSection?.('archive');
                    }}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                  >
                    Ver Comparador →
                  </button>
                </div>

                {/* Search inside Quick History */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Buscar Derashá anterior por # o tema..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070c18] border border-slate-700/80 focus:border-sky-400 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Scrollable list of historical Derashot */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {filteredHistoryEntries.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No hay Derashot en el historial que coincidan.
                    </div>
                  ) : (
                    filteredHistoryEntries.map((entry) => {
                      const isConfirming = confirmDeleteSeq === entry.sequenceNumber;
                      return (
                        <div
                          key={entry.id}
                          className="p-2.5 rounded-xl bg-[#070c18] border border-slate-800/90 hover:border-slate-700 transition space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsHistoryMenuOpen(false);
                                onOpenArchivedDerasha?.(entry);
                              }}
                              className="text-left min-w-0 flex-1 group cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <span className="font-mono font-bold text-sky-400">
                                  #{entry.sequenceNumber}
                                </span>
                                <span>·</span>
                                <span className="truncate">{entry.methodology}</span>
                              </div>
                              <p className="font-semibold text-slate-100 group-hover:text-sky-300 transition line-clamp-2 mt-0.5 leading-snug">
                                {entry.title}
                              </p>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsHistoryMenuOpen(false);
                                  onOpenArchivedDerasha?.(entry);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[11px] font-semibold text-sky-200 transition cursor-pointer"
                                title={`Abrir Derashá #${entry.sequenceNumber}`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>Abrir</span>
                              </button>

                              {onDeleteArchivedDerasha && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteSeq(
                                      isConfirming ? null : entry.sequenceNumber
                                    )
                                  }
                                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                    isConfirming
                                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                                      : 'bg-slate-900 hover:bg-rose-950/50 border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300'
                                  }`}
                                  title="Eliminar esta Derashá del historial"
                                  aria-label={`Eliminar Derashá #${entry.sequenceNumber} del historial`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isConfirming && onDeleteArchivedDerasha && (
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-rose-500/25 text-[11px]">
                              <span className="text-rose-200 font-medium">
                                ¿Eliminar Derashá #{entry.sequenceNumber} del histórico?
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteSeq(null)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                >
                                  No
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeleteSeq(null);
                                    onDeleteArchivedDerasha(entry.sequenceNumber);
                                  }}
                                  className="px-2.5 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold cursor-pointer"
                                >
                                  Sí, eliminar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryMenuOpen(false);
                    onNavigateSection?.('archive');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ir al Archivo Completo y Comparador</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenAboutModal}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Guía de Metodologías: PARDÉS (4 niveles) y las demás metodologías de estudio"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Metodologías</span>
          </button>

          {onOpenUserManualModal && (
            <button
              type="button"
              onClick={() => {
                setIsHistoryMenuOpen(false);
                setIsProfileMenuOpen(false);
                onOpenUserManualModal();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 border border-sky-300 shadow-[0_0_16px_-4px_rgba(56,189,248,0.65)] text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer"
              title="Abrir Manual de Usuario y Atajos de Teclado (? o F1)"
              aria-label="Abrir Manual de Usuario"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-950 shrink-0" />
              <span>Manual</span>
              <span className="hidden xl:inline">de Usuario</span>
            </button>
          )}

          {onOpenSettingsModal && (
            <button
              type="button"
              onClick={onOpenSettingsModal}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-sky-400/50 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Ajustes: Tipografías y Modo Atril, Respaldo (Puntos Seguros) y Mantenimiento"
              aria-label="Abrir ajustes, tipografías, respaldo y mantenimiento"
            >
              <Settings className="w-4 h-4 text-sky-400" />
              <span className="hidden lg:inline">Ajustes</span>
            </button>
          )}

          {/* Discreet, Small Google User Profile & Drive Persistence Icon */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen((prev) => !prev);
                setIsHistoryMenuOpen(false);
              }}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                currentUser && driveConnected
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200 hover:border-emerald-400'
                  : currentUser
                  ? 'bg-sky-950/60 border-amber-400/50 text-sky-200 hover:border-amber-300'
                  : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
              title={
                currentUser
                  ? `${currentUser.displayName || currentUser.email || 'Usuario Google'} · ${
                      driveConnected
                        ? 'Derashot guardadas en Google Drive (0 KB en la app)'
                        : 'Conectar Google Drive'
                    }`
                  : 'Iniciar sesión con Google y guardar Derashot en tu Google Drive'
              }
              aria-label="Perfil de Google y almacenamiento en Google Drive"
            >
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Perfil'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : currentUser ? (
                <span className="text-[11px] font-bold tracking-tight select-none">
                  {userInitial}
                </span>
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}

              {/* Tiny discreet status dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0b1120] ${
                  currentUser && driveConnected
                    ? 'bg-emerald-400'
                    : currentUser
                    ? 'bg-amber-400'
                    : 'bg-slate-600'
                }`}
              />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0d1629] border border-slate-700/90 shadow-2xl p-3.5 z-50 text-xs space-y-3">
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
                      {currentUser.photoURL ? (
                        <img
                          src={currentUser.photoURL}
                          alt={currentUser.displayName || 'Avatar'}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold shrink-0">
                          {userInitial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate">
                          {currentUser.displayName || 'Usuario de Google'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>

                    {/* Google Drive Zero-App-Footprint Status */}
                    <div className="p-2.5 rounded-xl bg-[#070c18] border border-slate-800/90 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                          <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Google Drive Personal</span>
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            driveConnected
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {driveConnected ? '0 KB en app' : 'Reconectar'}
                        </span>
                      </div>

                      {driveConnected ? (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Tus Derashot se guardan en tu carpeta{' '}
                          <strong className="text-slate-200">Darshán AI · Mis Derashot</strong> sin
                          ocupar espacio en la app ({driveFileCount} archivo
                          {driveFileCount === 1 ? '' : 's'} en Drive).
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          Autoriza el acceso a Google Drive para almacenar tus Derashot directamente
                          en tu unidad sin ocupar espacio en la app.
                        </p>
                      )}

                      {driveConnected ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          {onSyncDriveNow && (
                            <button
                              type="button"
                              onClick={() => {
                                onSyncDriveNow();
                              }}
                              disabled={isSyncingDrive}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[11px] font-semibold text-sky-200 transition cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${isSyncingDrive ? 'animate-spin' : ''}`}
                              />
                              <span>
                                {isSyncingDrive ? 'Sincronizando...' : 'Sincronizar Drive'}
                              </span>
                            </button>
                          )}
                          {driveFolderUrl && (
                            <a
                              href={driveFolderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition"
                              title="Abrir carpeta Darshán AI · Mis Derashot en Google Drive"
                            >
                              <span>Drive</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        onSignInGoogle && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              onSignInGoogle();
                            }}
                            disabled={isSigningIn}
                            className="w-full mt-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <svg
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 48 48"
                              className="w-4 h-4 shrink-0"
                            >
                              <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                              />
                              <path
                                fill="#4285F4"
                                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                              />
                              <path
                                fill="#34A853"
                                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                              />
                            </svg>
                            <span>Conectar Google Drive</span>
                          </button>
                        )
                      )}
                    </div>

                    {onSignOutGoogle && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onSignOutGoogle();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-[11px] font-medium transition cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar sesión</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                        <span>Persistencia en tu Google Drive</span>
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Inicia sesión con tu cuenta de Google para asociar tus Derashot a tu usuario
                        y almacenarlas directamente en tu Google Drive sin ocupar espacio en la app.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 bg-emerald-950/40 border border-emerald-500/25 rounded-lg px-2.5 py-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>0 KB ocupados en la app · Carpeta privada en tu Drive</span>
                    </div>

                    {onSignInGoogle && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onSignInGoogle();
                        }}
                        disabled={isSigningIn}
                        className="w-full inline-flex items-center justify-center gap-2.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          className="w-4 h-4 shrink-0"
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                        <span>
                          {isSigningIn ? 'Conectando con Google...' : 'Iniciar sesión con Google'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export const Header = React.memo(HeaderComponent);





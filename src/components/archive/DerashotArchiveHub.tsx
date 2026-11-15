import React, { useState, useMemo } from 'react';
import {
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
} from '../../types';
import {
  Search,
  GitCompare,
  BookOpen,
  CheckSquare,
  Square,
  Sparkles,
  HardDrive,
  RefreshCw,
  ExternalLink,
  LogOut,
  ArrowUpRight,
  Scale,
  Trash2,
  FileText,
} from 'lucide-react';
import { User } from '../../services/firebase';
import { DriveSyncSummary } from '../../services/googleDriveStorageService';
import { SplitScreenComparator } from './SplitScreenComparator';
import { ComparativeStudyResultView } from './ComparativeStudyResultView';

interface DerashotArchiveHubProps {
  archive: ArchivedDerashaEntry[];
  comparativeStudies: ComparativeDerashaAnalysisResult[];
  currentUser: User | null;
  driveConnected?: boolean;
  isSigningIn: boolean;
  isSyncingDrive?: boolean;
  driveSyncSummary?: DriveSyncSummary;
  isComparing: boolean;
  activeComparison: ComparativeDerashaAnalysisResult | null;
  selectedNumbers: number[];
  onToggleSelectNumber: (seqNum: number) => void;
  onSetSelectedNumbers: (nums: number[]) => void;
  onRunComparison: (params: {
    numbers: number[];
    relationType: DerashaRelationType;
    userHypothesis: string;
  }) => void;
  onOpenArchivedDerasha: (entry: ArchivedDerashaEntry) => void;
  onDeleteArchivedDerasha: (sequenceNumber: number) => void;
  onUpdateEntryInDrive?: (entry: ArchivedDerashaEntry) => void;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onSyncDriveNow?: () => void;
  onSelectSavedComparison: (study: ComparativeDerashaAnalysisResult) => void;
}

const RELATION_OPTIONS: Array<{
  value: DerashaRelationType;
  label: string;
  subtitle: string;
}> = [
  {
    value: 'INTEGRAL',
    label: 'Relación, Contradicción y Complemento',
    subtitle: 'Evalúa simultáneamente qué las une, en qué chocan y cómo se completan',
  },
  {
    value: 'RELACION',
    label: 'Me parece que hay una Relación',
    subtitle: 'Busca el hilo conductor oculto y la raíz compartida entre ambas Derashot',
  },
  {
    value: 'CONTRADICCION',
    label: 'Me parece que se Contradicen',
    subtitle: 'Analiza la fricción dialéctica (Majloket) y la oposición entre sus premisas',
  },
  {
    value: 'COMPLEMENTO',
    label: 'Me parece que se Complementan',
    subtitle: 'Muestra cómo una Derashá resuelve o completa lo que la otra deja abierto',
  },
];

export const DerashotArchiveHub: React.FC<DerashotArchiveHubProps> = React.memo(({
  archive,
  comparativeStudies,
  currentUser,
  driveConnected = false,
  isSigningIn,
  isSyncingDrive = false,
  driveSyncSummary,
  isComparing,
  activeComparison,
  selectedNumbers,
  onToggleSelectNumber,
  onSetSelectedNumbers,
  onRunComparison,
  onOpenArchivedDerasha,
  onDeleteArchivedDerasha,
  onUpdateEntryInDrive,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncDriveNow,
  onSelectSavedComparison,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [relationType, setRelationType] = useState<DerashaRelationType>('INTEGRAL');
  const [userHypothesis, setUserHypothesis] = useState('');
  const [expandedPreviewSeq, setExpandedPreviewSeq] = useState<number | null>(null);
  const [confirmDeleteSeq, setConfirmDeleteSeq] = useState<number | null>(null);

  const filteredArchive = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return archive;

    const numMatch = q.match(/^#?(\d+)$/);
    if (numMatch) {
      const targetNum = parseInt(numMatch[1], 10);
      return archive.filter((item) => item.sequenceNumber === targetNum);
    }

    return archive.filter((item) => {
      const seqTag = `#${item.sequenceNumber} drasha ${item.sequenceNumber} derasha ${item.sequenceNumber}`;
      const haystack = `${seqTag} ${item.title} ${item.query} ${item.centralIdea} ${item.sourcesSummary} ${item.methodology}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [archive, searchTerm]);

  const selectedEntries = useMemo(
    () => archive.filter((a) => selectedNumbers.includes(a.sequenceNumber)),
    [archive, selectedNumbers]
  );

  const handleTriggerComparison = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedNumbers.length < 2 || isComparing) return;

    const defaultHyp =
      relationType === 'CONTRADICCION'
        ? `De la Derashá #${selectedNumbers[0]} y la Derashá #${selectedNumbers[1]} me parece que se contradicen en su enfoque; quiero analizar esa tensión y ver cómo la tradición judía la aborda.`
        : relationType === 'COMPLEMENTO'
        ? `De la Derashá #${selectedNumbers[0]} y la Derashá #${selectedNumbers[1]} me parece que se complementan mutuamente; quiero un análisis de cómo se integran.`
        : relationType === 'RELACION'
        ? `De la Derashá #${selectedNumbers[0]} y la Derashá #${selectedNumbers[1]} me parece que hay una relación profunda; quiero analizar su vínculo exegético y filosófico.`
        : `Analizar la Derashá ${selectedNumbers.map((n) => `#${n}`).join(' y la ')}: evaluar qué relación existe entre ellas, en qué parecen contradecirse y cómo se complementan.`;

    onRunComparison({
      numbers: selectedNumbers,
      relationType,
      userHypothesis: userHypothesis.trim() || defaultHyp,
    });
  };

  return (
    <section
      id="derashot-archive-section"
      className="editorial-surface rounded-2xl border border-sky-500/35 bg-[#0b1326] overflow-hidden shadow-xl scroll-mt-20"
    >
      {/* Top Header Banner with Google Drive & User Persistence Status */}
      <div className="px-5 py-4 bg-gradient-to-r from-sky-950/70 via-[#0d172e] to-indigo-950/60 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-300 shrink-0">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
                Archivo Persistente y Comparador Dialéctico
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                {archive.length} Derashot (#1 – #
                {archive[archive.length - 1]?.sequenceNumber || archive.length})
              </span>
              {currentUser && driveConnected && (
                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-[10px] font-semibold text-sky-200">
                  Google Drive activo · 0 KB ocupados en la app
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-editorial font-bold text-white mt-0.5">
              Busca Derashot anteriores (#1, #2, #5...) y analiza su relación, contradicción o complementariedad
            </h2>
          </div>
        </div>

        {/* Google Drive & User Account Sync Control */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentUser && driveConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/35 text-xs text-emerald-200">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[190px]">
                Drive: <strong>{currentUser.email || currentUser.displayName}</strong>
              </span>
              {onSyncDriveNow && (
                <button
                  type="button"
                  onClick={onSyncDriveNow}
                  disabled={isSyncingDrive}
                  className="p-1 rounded hover:bg-emerald-900/60 text-emerald-300 hover:text-white transition cursor-pointer disabled:opacity-50"
                  title="Sincronizar tus Derashot con tu carpeta en Google Drive"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                </button>
              )}
              {driveSyncSummary?.folderWebViewLink && (
                <a
                  href={driveSyncSummary.folderWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-emerald-900/60 text-sky-300 hover:text-white transition"
                  title="Abrir carpeta Darshán AI · Mis Derashot en Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={onSignOutGoogle}
                className="p-1 rounded hover:bg-emerald-900/60 text-slate-300 hover:text-white transition cursor-pointer"
                title="Cerrar sesión de Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignInGoogle}
              disabled={isSigningIn}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-xs font-semibold text-sky-200 transition cursor-pointer disabled:opacity-50"
            >
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {isSigningIn
                  ? 'Conectando Google Drive...'
                  : currentUser
                  ? 'Activar Google Drive (0 KB en la app)'
                  : 'Guardar Derashot en Google Drive (0 KB en la app)'}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Quick Dialectical Presets Bar */}
        <div className="p-4 rounded-xl bg-[#070c18] border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Ejemplos rápidos de contraste entre Derashot numeradas (1 clic):
            </span>
            <span className="text-[11px] text-slate-400">
              También puedes marcar cualquier combinación abajo (ej. #1 y #5)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => {
                const nums = [1, 5].filter((n) => archive.some((a) => a.sequenceNumber === n));
                const finalNums =
                  nums.length >= 2 ? nums : archive.slice(0, 2).map((a) => a.sequenceNumber);
                onSetSelectedNumbers(finalNums);
                setRelationType('INTEGRAL');
                const hyp =
                  'De la Derashá #1 (Imperativo Categórico de Kant vs. Ética Teonómica de la Torá) y la Derashá #5 (Responsabilidad Mutua Kol Yisrael Arevim Ze Baze y Pirkei Avot 2:16) me parece que hay una relación profunda, pero también tensión entre el deber individual y la garantía comunitaria: ¿se contradicen o se complementan?';
                setUserHypothesis(hyp);
                onRunComparison({
                  numbers: finalNums,
                  relationType: 'INTEGRAL',
                  userHypothesis: hyp,
                });
              }}
              className="text-left p-3 rounded-xl bg-[#0d1629] hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/40 transition group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[11px] font-bold">
                  Derashá #1 vs Derashá #5
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400" />
              </div>
              <p className="text-xs font-medium text-slate-200 mt-1.5 group-hover:text-white">
                ¿Se contradicen o se complementan la #1 (Kant vs. Torá) y la #5 (Garantía Comunitaria)?
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                const nums = [3, 4].filter((n) => archive.some((a) => a.sequenceNumber === n));
                const finalNums =
                  nums.length >= 2 ? nums : archive.slice(0, 2).map((a) => a.sequenceNumber);
                onSetSelectedNumbers(finalNums);
                setRelationType('INTEGRAL');
                const hyp =
                  'De la Derashá #3 (Iluminación: Bodhi en el Budismo vs. Devekut y Torá Or en el Judaísmo) y la Derashá #4 (Destino de las Almas: Olam HaBá vs. Nirvana, Cielo/Infierno y Valhalla y sus requisitos de acceso) me parece que hay una relación directa entre qué es iluminarse en esta vida y qué se requiere para el Olam HaBá.';
                setUserHypothesis(hyp);
                onRunComparison({
                  numbers: finalNums,
                  relationType: 'INTEGRAL',
                  userHypothesis: hyp,
                });
              }}
              className="text-left p-3 rounded-xl bg-[#0d1629] hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/40 transition group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[11px] font-bold">
                  Derashá #3 vs Derashá #4
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-slate-200 mt-1.5 group-hover:text-white">
                Iluminación (Budismo vs. Torá #3) y Destino de las Almas (Olam HaBá vs. Nirvana/Valhalla #4)
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                const nums = [1, 2].filter((n) => archive.some((a) => a.sequenceNumber === n));
                const finalNums =
                  nums.length >= 2 ? nums : archive.slice(0, 2).map((a) => a.sequenceNumber);
                onSetSelectedNumbers(finalNums);
                setRelationType('COMPLEMENTO');
                const hyp =
                  'De la Derashá #1 (Kant vs. Torá) y la Derashá #2 (Alegoría de la Caverna de Platón vs. Or HaGanuz) me parece que se complementan para explicar la diferencia entre filosofía occidental y revelación en la Torá.';
                setUserHypothesis(hyp);
                onRunComparison({
                  numbers: finalNums,
                  relationType: 'COMPLEMENTO',
                  userHypothesis: hyp,
                });
              }}
              className="text-left p-3 rounded-xl bg-[#0d1629] hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/40 transition group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono text-[11px] font-bold">
                  Derashá #1 vs Derashá #2
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
              </div>
              <p className="text-xs font-medium text-slate-200 mt-1.5 group-hover:text-white">
                Contraste filosófico: Kant (#1) y la Caverna de Platón (#2) frente a las fuentes de la Torá
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                const nums = [6, 7, 8].filter((n) => archive.some((a) => a.sequenceNumber === n));
                const finalNums =
                  nums.length >= 2 ? nums : archive.slice(0, 2).map((a) => a.sequenceNumber);
                onSetSelectedNumbers(finalNums);
                setRelationType('INTEGRAL');
                const hyp =
                  'Entre la Derashá #6 (Mashíaj judío vs. Mesías cristiano), la Derashá #7 (Por qué Buda no es el Mashíaj) y la Derashá #8 (Corrientes judías: Jabad, Breslev, Reformismo vs. por qué los «judíos mesiánicos» son evangélicos) me parece que se complementan para trazar la frontera teológica e histórica del judaísmo.';
                setUserHypothesis(hyp);
                onRunComparison({
                  numbers: finalNums,
                  relationType: 'INTEGRAL',
                  userHypothesis: hyp,
                });
              }}
              className="text-left p-3 rounded-xl bg-[#0d1629] hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/40 transition group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[11px] font-bold">
                  Derashot #6 × #7 × #8
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
              </div>
              <p className="text-xs font-medium text-slate-200 mt-1.5 group-hover:text-white">
                Tríptico: Mashíaj vs. Cristianismo (#6), Buda (#7) y Frontera ante «Mesiánicos» (#8)
              </p>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN (7 cols): Searchable Historical Archive of Derashot */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Biblioteca Numerada de Derashot Anteriores</span>
              </h3>
              <span className="text-xs text-slate-400">
                Marca 2 o más casillas para compararlas
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar Derashá por número (#1, #5), tema (Kant, iluminación, Olam HaBá, Nirvana) o fuente..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070c18] border border-slate-700/80 focus:border-sky-400 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {filteredArchive.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#070c18] border border-slate-800 text-center text-xs text-slate-400">
                  No se encontraron Derashot que coincidan con «{searchTerm}».
                </div>
              ) : (
                filteredArchive.map((item) => {
                  const isSelected = selectedNumbers.includes(item.sequenceNumber);
                  const isExpanded = expandedPreviewSeq === item.sequenceNumber;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-sky-950/35 border-sky-400/60 shadow-md shadow-sky-950/30'
                          : 'bg-[#070c18]/90 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleSelectNumber(item.sequenceNumber)}
                            className="mt-0.5 text-sky-400 hover:text-sky-300 transition shrink-0 cursor-pointer"
                            title={`Seleccionar Derashá #${item.sequenceNumber} para comparar`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-sky-400" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                onClick={() => onToggleSelectNumber(item.sequenceNumber)}
                                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold cursor-pointer ${
                                  isSelected
                                    ? 'bg-sky-400 text-slate-950'
                                    : 'bg-sky-500/15 border border-sky-500/30 text-sky-300'
                                }`}
                              >
                                Derashá #{item.sequenceNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-800/90 text-[10px] font-medium text-slate-300">
                                {item.methodology}
                              </span>
                              {currentUser && driveConnected && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-medium text-emerald-300"
                                  title="Almacenada en tu Google Drive sin ocupar espacio en la app"
                                >
                                  <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>En tu Drive</span>
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-bold text-white mt-1.5 leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                              {item.centralIdea}
                            </p>
                            <p className="text-[11px] text-sky-300/80 mt-1.5 truncate">
                              Fuentes: {item.sourcesSummary}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenArchivedDerasha(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-[11px] font-semibold text-sky-200 transition cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Abrir #{item.sequenceNumber}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPreviewSeq(isExpanded ? null : item.sequenceNumber)
                              }
                              className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                            >
                              {isExpanded ? 'Ocultar resumen' : 'Ver texto'}
                            </button>
                            {currentUser && driveConnected && onUpdateEntryInDrive && (
                              <button
                                type="button"
                                onClick={() => onUpdateEntryInDrive(item)}
                                className="p-1 rounded text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                                title="Guardar o actualizar esta Derashá en tu Google Drive"
                              >
                                <HardDrive className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteSeq(
                                  confirmDeleteSeq === item.sequenceNumber
                                    ? null
                                    : item.sequenceNumber
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                                confirmDeleteSeq === item.sequenceNumber
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40'
                              }`}
                              title="Eliminar esta Derashá del histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {confirmDeleteSeq === item.sequenceNumber && (
                        <div className="mt-3 pt-2.5 border-t border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs bg-rose-950/25 px-3 py-2 rounded-lg">
                          <span className="text-rose-200 font-medium">
                            ¿Eliminar la <strong>Derashá #{item.sequenceNumber}</strong> del histórico?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSeq(null)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteSeq(null);
                                onDeleteArchivedDerasha(item.sequenceNumber);
                              }}
                              className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                            >
                              Sí, eliminar del histórico
                            </button>
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-200 whitespace-pre-line leading-relaxed bg-[#050912] p-3.5 rounded-lg">
                          {item.essaySummary}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols): Dialectical Comparator Form (#1 vs #5) */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleTriggerComparison}
              className="p-4 sm:p-5 rounded-xl bg-[#070c18] border border-slate-800/90 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-400" />
                  <span>Mesa de Contraste entre Derashot</span>
                </h3>
                {selectedNumbers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSetSelectedNumbers([])}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  1. Elige las Derashot a relacionar o contrastar (ej. #1 y #5):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {archive.map((item) => {
                    const active = selectedNumbers.includes(item.sequenceNumber);
                    return (
                      <button
                        key={item.sequenceNumber}
                        type="button"
                        onClick={() => onToggleSelectNumber(item.sequenceNumber)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                          active
                            ? 'bg-sky-400 text-slate-950 shadow-sm'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                        }`}
                        title={item.title}
                      >
                        #{item.sequenceNumber}
                      </button>
                    );
                  })}
                </div>

                {selectedEntries.length > 0 ? (
                  <div className="mt-2 p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/30 space-y-1">
                    {selectedEntries.map((e) => (
                      <div key={e.sequenceNumber} className="text-xs text-sky-200 truncate">
                        <strong className="font-mono text-sky-400">#{e.sequenceNumber}:</strong>{' '}
                        {e.title}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-300/90 mt-1">
                    Selecciona al menos 2 Derashot (por ejemplo #1 y #5) para habilitar el análisis.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  2. ¿Qué intuición o hipótesis quieres verificar entre ellas?
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {RELATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRelationType(opt.value)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer ${
                        relationType === opt.value
                          ? 'bg-sky-500/15 border-sky-400/60 text-white'
                          : 'bg-[#0b1326]/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-slate-400">{opt.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  3. Tu observación o planteamiento (opcional):
                </label>
                <textarea
                  rows={3}
                  value={userHypothesis}
                  onChange={(e) => setUserHypothesis(e.target.value)}
                  placeholder="Ej.: De la drashá número 1 y la número 5 me parece que hay una relación, o que se contradicen / se complementan en cómo ven la obligación moral individual frente a la comunidad..."
                  className="w-full p-3 rounded-xl bg-[#0b1326] border border-slate-700/80 focus:border-sky-400 text-xs text-white placeholder-slate-500 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={selectedNumbers.length < 2 || isComparing}
                className="w-full py-3 px-4 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-sky-950/50"
              >
                <GitCompare className="w-4 h-4" />
                <span>
                  {isComparing
                    ? 'Analizando relación, contradicciones y complementariedad...'
                    : selectedNumbers.length >= 2
                    ? `Analizar Derashot ${selectedNumbers.map((n) => `#${n}`).join(' vs ')}`
                    : 'Selecciona al menos 2 Derashot (#1, #5...)'}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* VISTA INTERACTIVA DE PANTALLA DIVIDIDA (Modularizada en archive/SplitScreenComparator.tsx) */}
        <SplitScreenComparator
          archive={archive}
          comparativeStudies={comparativeStudies}
          activeComparison={activeComparison}
          selectedNumbers={selectedNumbers}
          isComparing={isComparing}
          onSetSelectedNumbers={onSetSelectedNumbers}
          onRunComparison={onRunComparison}
          onOpenArchivedDerasha={onOpenArchivedDerasha}
        />

        {/* VISOR DE RESULTADO COMPARATIVO ACTIVO E HISTORIAL (Modularizado en archive/ComparativeStudyResultView.tsx) */}
        <ComparativeStudyResultView
          activeComparison={activeComparison}
          comparativeStudies={comparativeStudies}
          isComparing={isComparing}
          onRunComparison={onRunComparison}
          onSelectSavedComparison={onSelectSavedComparison}
        />
      </div>
    </section>
  );
});

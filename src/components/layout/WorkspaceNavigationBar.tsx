import React from 'react';
import { ScrollText, Flame, Footprints, BookOpen, GitBranch } from 'lucide-react';
import { WorkspaceTab } from './Header';
import { HubTab } from '../discovery/SuggestedTopicsHub';

interface WorkspaceNavigationBarProps {
  workspaceMode: WorkspaceTab;
  activeHubTab?: HubTab;
  onSelectStudyModality: (tab: HubTab) => void;
  onOpenArchiveModality: () => void;
  parashaNameEs?: string;
  nextEventNameEs?: string;
  archiveCount: number;
}

export const WorkspaceNavigationBar: React.FC<WorkspaceNavigationBarProps> = React.memo(
  ({
    workspaceMode,
    activeHubTab = 'parasha',
    onSelectStudyModality,
    onOpenArchiveModality,
    parashaNameEs,
    nextEventNameEs,
    archiveCount,
  }) => {
    const isArchiveMode = workspaceMode === 'archivo';

    return (
      <div
        id="study-modalities-bar"
        className="bg-[#090f1d] p-3 sm:p-4 rounded-2xl border border-slate-800/90 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Otras Modalidades y Sugerencias de Estudio
          </span>
          <span className="text-[11px] text-slate-400">
            Selecciona una categoría abajo para cargar pasajes o comparar Derashot en el recuadro principal
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectStudyModality('parasha')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              !isArchiveMode && activeHubTab === 'parasha'
                ? 'bg-sky-400 text-slate-950 shadow-sm'
                : 'bg-[#0c1426] border border-slate-800 text-slate-200 hover:text-white hover:border-sky-500/40'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5 shrink-0" />
            <span>
              Parashá de la Semana{parashaNameEs ? `: ${parashaNameEs}` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectStudyModality('festividades')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              !isArchiveMode && activeHubTab === 'festividades'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-[#0c1426] border border-slate-800 text-slate-200 hover:text-white hover:border-amber-500/40'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>
              Festividades{nextEventNameEs ? ` (${nextEventNameEs})` : ' Judías'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectStudyModality('musar')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              !isArchiveMode && activeHubTab === 'musar'
                ? 'bg-emerald-400 text-slate-950 shadow-sm'
                : 'bg-[#0c1426] border border-slate-800 text-slate-200 hover:text-white hover:border-emerald-500/40'
            }`}
          >
            <Footprints className="w-3.5 h-3.5 shrink-0" />
            <span>Musar Diario (Mesilat Yesharim)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectStudyModality('preguntas')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              !isArchiveMode && activeHubTab === 'preguntas'
                ? 'bg-indigo-400 text-slate-950 shadow-sm'
                : 'bg-[#0c1426] border border-slate-800 text-slate-200 hover:text-white hover:border-indigo-500/40'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Preguntas Clásicas</span>
          </button>

          <button
            type="button"
            onClick={onOpenArchiveModality}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              isArchiveMode
                ? 'bg-indigo-400 text-slate-950 shadow-sm'
                : 'bg-[#0c1426] border border-slate-800 text-slate-200 hover:text-white hover:border-indigo-500/40'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span>Archivo y Comparador (#1–#{archiveCount})</span>
          </button>
        </div>
      </div>
    );
  }
);

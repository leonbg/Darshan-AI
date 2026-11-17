import React from 'react';
import { X, ShieldCheck, Compass } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Metodología Pardés & Verificación</h2>
              <p className="text-xs text-slate-400">Las cuatro dimensiones de la exégesis tradicional judía</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Pardes acronym */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/60">
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <span className="font-hebrew text-xl text-sky-400">פַּרְדֵּס</span>
              <span>¿Qué es el método Pardés?</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              El término <strong>PARDÉS</strong> (literalmente <em>&quot;Huerto&quot;</em> o <em>&quot;Paraíso&quot;</em>) es un acrónimo de los cuatro niveles concéntricos de interpretación de la Torá y la liturgia judía:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                <span className="font-hebrew text-lg font-bold text-emerald-400 block mb-0.5">פ - פְּשָׁט (Pshat)</span>
                <span className="font-semibold text-xs text-emerald-300 uppercase tracking-wider block mb-1">Sentido Literal</span>
                <p className="text-xs text-slate-400">
                  La gramática hebraica pura, morfología de raíces, sintaxis y contexto histórico original.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
                <span className="font-hebrew text-lg font-bold text-indigo-400 block mb-0.5">ר - רֶמֶז (Remez)</span>
                <span className="font-semibold text-xs text-indigo-300 uppercase tracking-wider block mb-1">Sentido Alusivo</span>
                <p className="text-xs text-slate-400">
                  Pistas intertextuales, alusiones poéticas, acrósticos y valores numéricos (Guematriá).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/20">
                <span className="font-hebrew text-lg font-bold text-amber-400 block mb-0.5">ד - דְּרַשׁ (Drash)</span>
                <span className="font-semibold text-xs text-amber-300 uppercase tracking-wider block mb-1">Sentido Homilético</span>
                <p className="text-xs text-slate-400">
                  Exégesis ética y rabínica, relatos midráshicos, debates talmúdicos y lecciones morales.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-500/20">
                <span className="font-hebrew text-lg font-bold text-sky-400 block mb-0.5">ס - סוֹד (Sod)</span>
                <span className="font-semibold text-xs text-sky-300 uppercase tracking-wider block mb-1">Sentido Místico</span>
                <p className="text-xs text-slate-400">
                  Secretos de la Cábala, las diez Sefirot, rectificación (Tikún) y las intenciones del alma (Kavaná).
                </p>
              </div>
            </div>
          </div>

          {/* Anti-Hallucination 3-phase flow */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Flujo de Verificación Canónica Antialucinación</span>
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                <div>
                  <strong className="text-white">Fase 1 - Desglose Filológico:</strong> Se analiza la raíz trilítera, morfología verbal (binyan) y se deducen las referencias canónicas exactas para Sefaria.
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                <div>
                  <strong className="text-white">Fase 2 - Descarga Directa desde Sefaria:</strong> Se consulta directamente la biblioteca canónica de Sefaria, recuperando el texto masorético original y su traducción oficial.
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                <div>
                  <strong className="text-white">Fase 3 - Redacción Fidedigna:</strong> Con los textos reales verificados, se redacta la Derashá sin inventar versículos ni fuentes falsas.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-700/60 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

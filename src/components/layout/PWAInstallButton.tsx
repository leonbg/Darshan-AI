import React, { useState } from 'react';
import { Download, Smartphone, Share2, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          title="Instalar aplicación Darshán AI en este dispositivo"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>Instalar App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          title="Instalar en móvil (Android / iOS) o empaquetar como APK"
        >
          <Smartphone className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">{isIOS ? 'Instalar en iOS' : 'App / APK'}</span>
        </button>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-slate-800 p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-widest text-sky-400">
                  Web App · PWA · Android APK
                </div>
                <h3 className="font-editorial text-lg font-bold text-white mt-0.5">
                  Instalación Móvil y Empaquetado APK
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {isIOS ? (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Instalar en iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Toca el botón <strong>Compartir</strong> en la barra de Safari.</li>
                    <li>Selecciona <strong>«Agregar a pantalla de inicio»</strong>.</li>
                  </ol>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                    <span>Instalar directamente en Android o Escritorio:</span>
                  </div>
                  <p className="text-slate-300">
                    Abre el menú del navegador (Chrome / Edge) y selecciona{' '}
                    <strong>«Instalar aplicación»</strong> o <strong>«Agregar a la pantalla principal»</strong> para ejecutar Darshán AI en pantalla completa (modo nativo <em>standalone</em>).
                  </p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-sky-950/25 border border-sky-500/25 space-y-2">
                <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Listo para publicación en APK (TWA / Capacitor)</span>
                </div>
                <p className="text-slate-300">
                  La estructura incluye <strong>Web App Manifest</strong>, iconos PNG (192×192, 512×512 y <em>maskable</em>), <strong>Service Worker</strong> con caché para Sefaria, soporte CORS y configuración para <strong>PWABuilder / Bubblewrap (TWA)</strong> o <strong>Capacitor Android</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

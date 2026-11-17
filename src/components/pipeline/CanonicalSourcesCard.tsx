import React, { useState, useCallback, useMemo } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  Quote,
  Languages,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  VerifiedSefariaSource,
  ExternalComparativeSource,
  FormalExegeticalContrast,
} from '../../types';
import {
  stripAllHtml,
  evaluateSourceTranslationStatus,
} from '../../services/sefaria';
import { BidiText } from '../../utils/bidiText';

interface CanonicalSourcesCardProps {
  sources: VerifiedSefariaSource[];
  canonicalAnalysis?: {
    synthesis: string;
    verifiedEchoes: Array<{
      ref: string;
      connection: string;
    }>;
    spanishTranslations?: Array<{
      ref: string;
      spanishTranslation: string;
    }>;
  };
  externalSources?: ExternalComparativeSource[];
  formalContrast?: FormalExegeticalContrast;
  onTranslateSource?: (
    ref: string,
    hebrewText: string,
    englishText: string
  ) => Promise<void>;
  onTranslateAllSources?: () => Promise<void>;
  isTranslatingRef?: string | null;
  isTranslatingAll?: boolean;
}

export const CanonicalSourcesCard: React.FC<CanonicalSourcesCardProps> = React.memo(({
  sources,
  canonicalAnalysis,
  externalSources,
  formalContrast,
  onTranslateSource,
  onTranslateAllSources,
  isTranslatingRef,
  isTranslatingAll = false,
}) => {
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Record<string, 'es' | 'en'>>({});

  const handleCopy = useCallback((text: string, ref: string) => {
    navigator.clipboard.writeText(stripAllHtml(text));
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 1500);
  }, []);

  const setLanguage = useCallback((ref: string, lang: 'es' | 'en') => {
    setActiveLang((prev) => ({ ...prev, [ref]: lang }));
  }, []);

  // Evaluate how many sources only have English from Sefaria and lack a Spanish translation
  const evaluatedSources = useMemo(
    () =>
      sources.map((source) => {
        const phase3Trans = canonicalAnalysis?.spanishTranslations?.find(
          (t) => t.ref.toLowerCase() === source.ref.toLowerCase()
        )?.spanishTranslation;
        const status = evaluateSourceTranslationStatus(source, phase3Trans);
        return {
          source,
          ...status,
        };
      }),
    [sources, canonicalAnalysis?.spanishTranslations]
  );

  const untranslatedList = useMemo(
    () => evaluatedSources.filter((item) => !item.hasSpanish),
    [evaluatedSources]
  );

  return (
    <div className="editorial-surface rounded-2xl p-5 sm:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Biblioteca de Sefaria · Textos Masoréticos y Rabínicos</span>
          </div>
          <h3 className="font-editorial text-xl sm:text-2xl font-bold text-white">
            {externalSources && externalSources.length > 0 || formalContrast?.isComparativeStudy
              ? 'Fuentes Internas de la Torá y Fuentes Externas Comparadas'
              : 'Fuentes Internas de la Torá y Citas Canónicas'}
          </h3>
          <p className="text-xs text-slate-400">
            {externalSources && externalSources.length > 0 || formalContrast?.isComparativeStudy
              ? 'Textos hebreos originales de Sefaria con traducción bilingüe y fuentes externas para estudios comparativos'
              : 'Textos hebreos originales de Sefaria con traducción bilingüe y referencias halájicas'}
          </p>
        </div>

        {untranslatedList.length > 0 && onTranslateAllSources && (
          <button
            type="button"
            onClick={onTranslateAllSources}
            disabled={isTranslatingAll || Boolean(isTranslatingRef)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-60 shrink-0"
          >
            {isTranslatingAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Traduciendo fuentes al español...</span>
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" />
                <span>
                  Traducir {untranslatedList.length === 1 ? '1 fuente' : `las ${untranslatedList.length} fuentes`} al Español
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Proactive Proposal Banner when Sefaria sources are in English without Spanish translation */}
      {untranslatedList.length > 0 && (
        <div className="p-4 rounded-2xl bg-sky-950/35 border border-sky-500/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-300 shrink-0 mt-0.5">
              <Languages className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-sky-200 flex items-center gap-1.5">
                <span>
                  {untranslatedList.length === 1
                    ? '1 texto de Sefaria está disponible únicamente en inglés'
                    : `${untranslatedList.length} textos de Sefaria están disponibles únicamente en inglés`}
                </span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sefaria.org proporciona {untranslatedList.length === 1 ? 'esta cita canónica' : 'estas citas canónicas'} con traducción en inglés. ¿Deseas traducir{untranslatedList.length === 1 ? 'la' : 'las'} fielmente al español desde el hebreo original y el inglés?
              </p>
            </div>
          </div>

          {onTranslateAllSources && (
            <button
              type="button"
              onClick={onTranslateAllSources}
              disabled={isTranslatingAll || Boolean(isTranslatingRef)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/50 text-sky-100 text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-60"
            >
              {isTranslatingAll ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Traduciendo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                  <span>Traducir todo al español ahora</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Synthesis narrative if provided by Gemini in phase 3 */}
      {canonicalAnalysis?.synthesis && (
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span>Articulación Exegética de las Fuentes Canónicas</span>
          </h4>
          <BidiText
            as="div"
            paragraphs
            text={canonicalAnalysis.synthesis}
            className="text-sm text-slate-200 leading-relaxed space-y-2"
          />
        </div>
      )}

      {/* External Sources & Formal Contrast block when present */}
      {externalSources && externalSources.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 block">
                Fuentes Externas Consultadas (Jojmá ba-Goyim · Eijá Rabá 2:13)
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white">
                {formalContrast?.externalThinkerOrTradition ||
                  'Textos Clásicos y Filosóficos para Informar el Contraste'}
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {externalSources.map((ext) => (
              <div
                key={ext.id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">
                      {ext.author} — <span className="italic">{ext.workTitle}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {ext.canonicalLocus} ({ext.tradition} · {ext.originalLanguage})
                    </span>
                  </div>
                </div>
                <blockquote className="text-xs text-slate-300 italic border-l-2 border-amber-500/40 pl-2.5">
                  «<BidiText text={ext.originalQuote} />»
                </blockquote>
                <div className="text-xs text-slate-200 leading-relaxed">
                  <strong className="text-slate-400">Traducción: </strong>
                  <BidiText text={ext.spanishTranslation} />
                </div>
                {ext.torahContrastPoint && (
                  <div className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 leading-relaxed">
                    <strong>Contraste con las Fuentes Internas de la Torá: </strong>
                    <BidiText text={ext.torahContrastPoint} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources list */}
      <div className="space-y-6">
        {evaluatedSources.map(({ source, hasSpanish, spanishText, hasEnglish, englishText }, idx) => {
          const echoConnection = canonicalAnalysis?.verifiedEchoes?.find(
            (e) => e.ref.toLowerCase() === source.ref.toLowerCase()
          );

          // If Spanish exists, default to 'es'. If only English exists, show 'es' proposal + English preview or respect user tab selection.
          const selectedTab = activeLang[source.ref] || (hasSpanish ? 'es' : 'en');
          const isTranslating = isTranslatingRef === source.ref || (isTranslatingAll && !hasSpanish);

          return (
            <div
              key={idx}
              className="rounded-2xl bg-[#090f1d]/80 border border-slate-800 overflow-hidden space-y-0"
            >
              {/* Card top banner */}
              <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap text-xs">
                  <span className="font-bold text-white">{source.ref}</span>
                  {source.heRef && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span
                        dir="rtl"
                        className="font-hebrew text-sm font-bold text-sky-400"
                      >
                        {source.heRef}
                      </span>
                    </>
                  )}
                  <span className="text-slate-600">·</span>
                  {source.verified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{source.statusText || 'Verificado en Sefaria v3'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                      Referencia sugerida
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy =
                        hasSpanish && selectedTab === 'es'
                          ? `${stripAllHtml(source.hebrewText)}\n\n(Traducción en Español):\n${spanishText}`
                          : `${stripAllHtml(source.hebrewText)}\n\n(Traducción Sefaria):\n${englishText || source.translation}`;
                      handleCopy(textToCopy, source.ref);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1 cursor-pointer"
                    title="Copiar texto y traducción"
                  >
                    {copiedRef === source.ref ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[11px]">Copiar</span>
                      </>
                    )}
                  </button>

                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 text-xs font-medium transition"
                  >
                    <span>Abrir en Sefaria</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Text content split into Hebrew Masoretic & Translation */}
              <div className="p-4 sm:p-5 space-y-4">
                {/* Hebrew Masoretic text */}
                <div className="space-y-1.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>TEXTO HEBREO ORIGINAL (MASORAH / MISHNÁ)</span>
                    {source.versionTitle && (
                      <span className="truncate max-w-[200px]">{source.versionTitle}</span>
                    )}
                  </div>
                  <p
                    dir="rtl"
                    className="font-hebrew text-xl sm:text-2xl text-slate-100 font-bold leading-relaxed tracking-wide text-right"
                    dangerouslySetInnerHTML={{ __html: source.hebrewText }}
                  />
                </div>

                {/* Translation Box with Language Switcher & Automatic Translation Proposal */}
                <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Languages className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                        Traducción Canónica
                      </span>
                      {!hasSpanish && hasEnglish && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold">
                          En inglés en Sefaria · Sin español aún
                        </span>
                      )}
                      {hasSpanish && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                          Traducido al español
                        </span>
                      )}
                    </div>

                    {/* Language Switcher Tabs */}
                    <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setLanguage(source.ref, 'es')}
                        className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          selectedTab === 'es'
                            ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>Español</span>
                        {hasSpanish && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLanguage(source.ref, 'en')}
                        className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                          selectedTab === 'en'
                            ? 'bg-slate-700 text-white font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>Inglés (Sefaria)</span>
                      </button>
                    </div>
                  </div>

                  {/* Proposal Banner right inside the card when no Spanish translation exists */}
                  {!hasSpanish && onTranslateSource && (
                    <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/35 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-sky-200">
                          {hasEnglish
                            ? 'Este texto de Sefaria tiene traducción en inglés, pero no en español.'
                            : 'Este texto de Sefaria solo está en hebreo original.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          ¿Deseas traducir este pasaje fielmente al español?
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setLanguage(source.ref, 'es');
                          await onTranslateSource(
                            source.ref,
                            source.hebrewText,
                            englishText
                          );
                        }}
                        disabled={isTranslating}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-60"
                      >
                        {isTranslating ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Traduciendo al español...</span>
                          </>
                        ) : (
                          <>
                            <Languages className="w-3.5 h-3.5" />
                            <span>Traducir al Español</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Translation Text Render */}
                  {selectedTab === 'es' && hasSpanish ? (
                    <div className="space-y-1 pt-1">
                      <div className="text-sm sm:text-base text-slate-100 leading-relaxed font-sans font-medium">
                        « <BidiText text={spanishText} /> »
                      </div>
                      <span className="text-[10px] text-emerald-400/90 italic block">
                        Traducción rabínica fidedigna al español
                      </span>
                    </div>
                  ) : hasEnglish ? (
                    <div className="space-y-1 pt-1">
                      <div className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans italic">
                        « <BidiText text={englishText} /> »
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Versión en inglés de Sefaria.org
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-1">
                      Pulsa «Traducir al Español» para obtener la traducción directa desde el texto hebreo masorético.
                    </p>
                  )}
                </div>

                {/* Exegetical connection echo */}
                {echoConnection && (
                  <div className="p-3 rounded-lg bg-slate-850/80 border border-slate-700/50 text-xs text-slate-300 flex items-start gap-2">
                    <Quote className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <strong className="text-sky-300">Conexión exegética:</strong>{' '}
                      <BidiText text={echoConnection.connection} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

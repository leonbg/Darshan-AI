import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquarePlus,
  Send,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Copy,
  Check,
  Mic,
  MicOff,
  Compass,
  BookOpen,
} from 'lucide-react';
import { FollowUpItem } from '../../types';
import { BidiMarkdown, BidiText } from '../../utils/bidiText';

interface ExegesisFollowUpProps {
  onAskQuestion: (question: string) => Promise<void>;
  onRefineFullStudy?: (refinedQuery: string) => void;
  followUps: FollowUpItem[];
  isLoading: boolean;
  query: string;
  derashaTitle?: string;
}

export const ExegesisFollowUp: React.FC<ExegesisFollowUpProps> = React.memo(({
  onAskQuestion,
  onRefineFullStudy,
  followUps,
  isLoading,
  query,
  derashaTitle,
}) => {
  const [questionInput, setQuestionInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const latestThreadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleVoiceDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setQuestionInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Context-aware suggested follow-up questions
  const defaultSuggestions = useMemo(() => {
    const lowerQ = `${query} ${derashaTitle || ''}`.toLowerCase();
    const isAfterlife =
      lowerQ.includes('olam') ||
      lowerQ.includes('olamaba') ||
      lowerQ.includes('valhalla') ||
      lowerQ.includes('nirvana') ||
      lowerQ.includes('infierno') ||
      lowerQ.includes('almas');
    const isEnlightenment =
      lowerQ.includes('iluminaci') ||
      lowerQ.includes('budism') ||
      lowerQ.includes('bodhi') ||
      lowerQ.includes('ganuz');
    const isComparativePhil =
      lowerQ.includes('kant') ||
      lowerQ.includes('hunt') ||
      lowerQ.includes('platón') ||
      lowerQ.includes('platon') ||
      lowerQ.includes('caverna') ||
      lowerQ.includes('cicerón') ||
      lowerQ.includes('ciceron');
    const isShema =
      lowerQ.includes('shema') ||
      lowerQ.includes('ejad') ||
      query.includes('שמע') ||
      query.includes('אחד') ||
      lowerQ.includes('dalet');
    const isToldotOrEsav =
      lowerQ.includes('esav') ||
      lowerQ.includes('esaú') ||
      lowerQ.includes('yaakov') ||
      lowerQ.includes('toldot');
    const isGratitude =
      lowerQ.includes('gratitud') ||
      lowerQ.includes('hakarat') ||
      lowerQ.includes('mode ani') ||
      lowerQ.includes('modé aní') ||
      lowerQ.includes('agradec') ||
      lowerQ.includes('hodaia') ||
      lowerQ.includes('hodaiá') ||
      lowerQ.includes('letoda');
    const isMourningTopic =
      lowerQ.includes('avelut') ||
      lowerQ.includes('duelo') ||
      lowerQ.includes('luto') ||
      lowerQ.includes('kadish') ||
      lowerQ.includes('shiva') ||
      lowerQ.includes('shivá') ||
      lowerQ.includes('shloshim');
    const isPosture =
      !isMourningTopic &&
      (lowerQ.includes('postura') ||
        lowerQ.includes('reverencia') ||
        lowerQ.includes('inclinarse') ||
        lowerQ.includes('keria') ||
        lowerQ.includes('keriá'));

    return isAfterlife
      ? [
          '¿Cuáles son exactamente los 7 Preceptos Universales de Noé que permiten a los justos de todas las naciones acceder al Olam HaBá?',
          '¿Por qué enseña Pirké Avot 4:17 que una sola hora de Teshuvá y buenas acciones en este mundo supera toda la vida del Olam HaBá?',
          '¿Qué diferencia existe entre el Gan Edén espiritual de las almas, el Guehinom temporal (máximo 12 meses) y la Resurrección (Tejiyat HaMetim)?',
          '¿Cómo contrasta la conservación de la identidad del alma en el Olam HaBá (Berajot 17a) con el Anatta del Nirvana y el combate del Valhalla?',
        ]
      : isEnlightenment
      ? [
          '¿Cuáles son los 10 peldaños de la escalera de Rabí Pinjás ben Yaír (Avodá Zará 20b y Mesilat Yesharim) para alcanzar el Ruaj HaKódesh?',
          '¿Qué diferencia hay entre el Bitul HaYesh jasídico (anular el ego ante Hashem) y el concepto budista de Anatta (inexistencia del alma)?',
          '¿Dónde ocultó Dios la Luz Primordial (Or HaGanuz) según el Talmud (Jaguigá 12a) y cómo la revelamos mediante cada Mitzvá específica?',
        ]
      : isComparativePhil
      ? [
          '¿Por qué declara el Talmud en Kidushín 31a que es más grande quien está comandado y cumple («Gadol ha-metzuvé ve-osé») frente a la autonomía de Kant?',
          '¿Cómo explica Maimónides en Shemoná Perakim cap. 6 la tensión entre la virtud armónica de los filósofos y vencer la inclinación?',
          '¿Por qué en Proverbios 6:23 el mandamiento específico es llamado «lámpara» (Ner Mitzvá) frente al Sol abstracto de la caverna de Platón?',
        ]
      : isShema
      ? [
          '¿Existe un enfrentamiento ontológico entre la Dálet y la Reish en el Talmud y la Cábala?',
          '¿Por qué las letras Áyin y Dálet forman la palabra Ed (Testigo)?',
          '¿Cuál es la relación de la Reish con la Sitrá Ajrá en el Zóhar?',
        ]
      : isToldotOrEsav
      ? [
          '¿Por qué Targum Onkelos traduce «be-mirmá» (con engaño) como «be-jojmá» (con sabiduría)?',
          '¿Cómo explican Rashi y Bereshit Rabá 65:10 la ceguera de Yitzjak y la profecía de Rivká?',
          '¿Qué enseña el Rabino Jonathan Sacks sobre por qué Yitzjak amaba a Esav y el significado de las dos bendiciones?',
        ]
      : isGratitude
      ? [
          '¿Por qué recitamos Modé Aní antes de lavarnos las manos (Netilat Yadaim) y en qué se diferencia de Elohai Neshamá (Berajot 60b)?',
          '¿Cómo enseña Rashi (Éxodo 7:19; 8:12) el principio de Hakarat HaTov sobre Moshé y Aarón ante el Nilo y el polvo?',
          '¿Qué significa en Berajot 35a que quien disfruta de este mundo sin recitar bendición «comete robo» y cómo lo analiza Jovot HaLevavot en Shaar HaBejiná?',
        ]
      : isPosture
      ? [
          '¿Qué diferencia halájica y espiritual hay entre Keriá, Kidá e Hishtajavaiá en Berajot 34b y Megilá 22b?',
          '¿Por qué el Shulján Aruj (Oraj Jaim 113:4) ordena doblar en «Baruj–Atá» y levantarse exactamente al pronunciar «Hashem»?',
          '¿Qué simbolizan las 18 vértebras y el hueso Luz en Berajot 28b y Vayikrá Rabá 18:1?',
        ]
      : [
          '¿Cómo comentan este tema Rashi, Maimónides (Rambam) y Najmánides (Ramban)?',
          '¿Cuál es la fuente talmúdica directa y la aplicación halájica en el Shulján Aruj sobre este punto?',
          '¿Cuál es la aplicación práctica de Musar (Mesilat Yesharim) y de la Jasidut para llevar esta enseñanza a la vida diaria?',
        ];
  }, [query, derashaTitle]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!questionInput.trim() || isLoading) return;

      const q = questionInput.trim();
      setQuestionInput('');
      await onAskQuestion(q);
      setTimeout(() => {
        latestThreadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    },
    [questionInput, isLoading, onAskQuestion]
  );

  const handleRefineStudyClick = useCallback(() => {
    if (!questionInput.trim() || !onRefineFullStudy) return;
    const q = questionInput.trim();
    const baseStudy = (derashaTitle || query || '').trim();
    setQuestionInput('');
    onRefineFullStudy(
      baseStudy
        ? `${baseStudy} — Profundizando y acotando en: ${q}`
        : q
    );
  }, [questionInput, onRefineFullStudy, query, derashaTitle]);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  // Markdown + BiDi rendering delegated to <BidiMarkdown />

  return (
    <div className="bg-[#0d1629] border-2 border-sky-500/40 rounded-2xl p-5 sm:p-7 shadow-xl shadow-sky-950/30 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/35 shrink-0 mt-0.5">
            <MessageSquarePlus className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
                Continuar la Conversación · Acotar o Profundizar el Estudio
              </span>
              {followUps.length > 0 && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {followUps.length} {followUps.length === 1 ? 'intervención en este estudio' : 'intervenciones en este estudio'}
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-editorial font-bold text-white">
              ¿Qué aspecto de este estudio deseas profundizar, comparar o acotar ahora?
            </h3>
            <p className="text-xs text-slate-300">
              Escribe o dicta tu pregunta aquí abajo: puedes <strong className="text-sky-300">continuar el diálogo paso a paso</strong> sobre la lección actual o <strong className="text-indigo-300">re-elaborar el estudio completo</strong> acotándolo con tu nuevo enfoque.
            </p>
          </div>
        </div>
      </div>

      {/* Prominent Input Form RIGHT AT THE TOP so the user never misses where to type */}
      <form onSubmit={handleSubmit} className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
        <label htmlFor="followup-input" className="block text-xs font-bold text-sky-200">
          Escribe tu pregunta, contraste adicional o acotación sobre «{derashaTitle || query}»:
        </label>
        <div className="relative">
          <textarea
            id="followup-input"
            rows={2}
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isLoading}
            placeholder={`Ejemplo sobre «${derashaTitle || query || 'este estudio'}»: Profundicemos en las fuentes del Talmud, el Shulján Aruj, el Musar o la Cábala sobre este punto...`}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 text-slate-100 placeholder-slate-500 text-sm outline-none transition resize-y"
          />
          <button
            type="button"
            onClick={toggleVoiceDictation}
            title={isListening ? 'Detener dictado por voz' : 'Dictar pregunta por voz'}
            className={`absolute right-3 top-3 p-2 rounded-lg border transition cursor-pointer ${
              isListening
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-400">
            Presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono">Enter</kbd> para responder en esta conversación
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {onRefineFullStudy && (
              <button
                type="button"
                onClick={handleRefineStudyClick}
                disabled={isLoading || !questionInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 disabled:opacity-40 transition cursor-pointer"
                title="Re-elaborar toda la Drashá incorporando esta acotación"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-300" />
                <span>Re-elaborar Estudio Acotando con Esto</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !questionInput.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-md shadow-sky-500/20 disabled:opacity-50 transition cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Profundizando estudio...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-slate-950" />
                  <span>Continuar Conversación (Responder Aquí)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Suggested quick questions */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>O toca una de estas preguntas sugeridas para continuar inmediatamente:</span>
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {defaultSuggestions.map((suggestion, sIdx) => (
            <button
              key={sIdx}
              type="button"
              onClick={() => onAskQuestion(suggestion)}
              disabled={isLoading}
              className="text-left text-xs p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-sky-400/50 text-slate-200 hover:text-white transition flex items-start gap-2 cursor-pointer disabled:opacity-50"
            >
              <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Indicator when a follow-up is being generated */}
      {isLoading && (
        <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-500/35 flex items-center gap-3 text-sky-200 text-xs sm:text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
          <span>
            El Darshán está consultando las fuentes de este estudio para responder a tu pregunta...
          </span>
        </div>
      )}

      {/* Conversation Thread / Follow-ups List */}
      {followUps.length > 0 && (
        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Hilo de Profundización del Estudio ({followUps.length})</span>
          </div>

          {followUps.map((item, idx) => (
            <div
              key={item.id || idx}
              className="rounded-2xl bg-slate-900/95 border border-slate-700/80 overflow-hidden shadow-lg transition"
            >
              {/* Question header banner */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-sky-950/70 via-slate-900 to-slate-900 border-b border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold flex items-center justify-center shrink-0 border border-sky-500/30">
                    {idx + 1}
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    <BidiText text={item.question} />
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(item.answer, item.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  title="Copiar respuesta"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Copiar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Answer content */}
              <div className="p-5 sm:p-6 space-y-1 font-sans">
                <BidiMarkdown content={item.answer} />

                {item.relatedSefariaReferences && item.relatedSefariaReferences.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/70 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Fuentes relacionadas:
                    </span>
                    {item.relatedSefariaReferences.map((r, rIdx) => (
                      <span
                        key={rIdx}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-sky-300 font-medium"
                        title={r.rationale}
                      >
                        {r.ref}
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested follow-up chips generated dynamically */}
                {item.suggestedNextQuestions && item.suggestedNextQuestions.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-semibold text-sky-300 uppercase tracking-wider block">
                      Continuar profundizando a partir de esta respuesta:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.suggestedNextQuestions.map((nextQ, nIdx) => (
                        <button
                          key={nIdx}
                          type="button"
                          onClick={() => onAskQuestion(nextQ)}
                          disabled={isLoading}
                          className="text-left text-xs px-3 py-1.5 rounded-xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 text-sky-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>{nextQ}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={latestThreadEndRef} />
        </div>
      )}
    </div>
  );
});


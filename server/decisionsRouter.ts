import type { Express } from 'express';
import { detectExternalThinkerAndForceExegeticalSearch } from '../src/utils/externalThinkerDetector.ts';
import { validatePurelyHalakhicQuery } from '../src/utils/halakhicPipelineValidator.ts';
import { consultHalakhicShulchanArukhModule } from '../src/utils/halakhicShulchanArukhModule.ts';
import {
  getToneMeta,
  normalizeDerashaTone,
  resolveDerashaTone,
} from '../src/utils/toneAdvisor.ts';
import {
  getDecisionsAIClient,
  GEMINI_DECISION_MODEL,
  logPipelineGeminiDiagnostic,
  GeminiHttpError,
  classifyGeminiRouteError,
  setBoundedCache,
  decideMethodologyCache,
  inFlightDecisionsRequests,
} from './aiClient.ts';
import { normalizeUserStudyQuery } from './queryNormalization.ts';
import {
  getComplementaryContributionBrief,
  hasExplicitServerCitationOrCalendar,
} from './methodologyPrompts.ts';

export async function evaluateStudyQueryWithDecisionsApi(
  rawQuery: string,
  requestedToneRaw?: string
): Promise<any> {
  const { normalizedQuery: query } = normalizeUserStudyQuery(rawQuery);
  const cacheKey = query.toLowerCase();
  const cachedDelib = decideMethodologyCache.get(cacheKey);
  if (cachedDelib) {
    if (requestedToneRaw && normalizeDerashaTone(requestedToneRaw) !== 'AUTO') {
      const overrideToneEval = resolveDerashaTone(
        requestedToneRaw,
        query,
        cachedDelib.recommendedPrimary as any,
        cachedDelib.halakhicValidation
      );
      return {
        ...cachedDelib,
        recommendedTone: overrideToneEval.resolvedTone,
        toneRationale: overrideToneEval.advisoryReason,
      };
    }
    return cachedDelib;
  }

  const existingInFlight = inFlightDecisionsRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const executionPromise = (async () => {
    const decisionsAi = getDecisionsAIClient();
    const specificityRubric = [
      'Palabra suelta, nombre aislado o término sumamente genérico sin pregunta, versículo, contexto ni ángulo de estudio (ej.: "Shabat", "Fe", "Moshé", "Torá").',
      'Tema general de dos o tres palabras sin precisar qué aspecto, tensión ética, pasaje o pregunta se desea explorar (ej.: "La humildad", "El rezo judío").',
      'Tema de estudio enfocado o pregunta clara en lenguaje natural que identifica un concepto concreto, dilema práctico, festividad o corriente rabínica.',
      'Consulta altamente específica que cita un pasaje bíblico/talmúdico/halájico, un contraste filosófico puntual o una pregunta exegética bien delimitada.',
    ];

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let decisionResponse: any;
    try {
      decisionResponse = await Promise.race([
        decisionsAi.decisions.create({
          model: GEMINI_DECISION_MODEL,
          input: [
            {
              type: 'text',
              text: JSON.stringify({ student_study_query: query }),
            },
          ],
          questions: {
            primary_methodology: {
              type: 'choice',
              instructions:
                'Which of the seven Jewish hermeneutical methodologies in criteria is the single best structural framework for answering student_study_query?',
              criteria: {
                EVOLUCION_CONCEPTUAL:
                  'Genealogical evolution of a spiritual or theological concept across four historical strata: Written/Oral Torah, Kabbalah (Sefirot/Tree of Life/Zohar), Musar, and Hasidism (Besht, Chabad/Tanya, Breslov, Sfat Emet).',
                FILOSOFIA_CONTRASTIVA:
                  'Formal philosophical or interreligious contrast comparing Torah and Jewish thought against external non-Jewish philosophers (e.g., Kant, Plato, Aristotle, Stoics, Cicero, Spinoza, Nietzsche) or non-Jewish religious doctrines (e.g., Buddhism, Nirvana, Christianity, Valhalla).',
                MESILAT_YESHARIM_SISTEMATICO:
                  'Systematic cultivation and analytical anatomy of a moral virtue or character trait (middah) following Ramchal Mesillat Yesharim structure: essence (Mahut), components (Chalakim), acquisition, and obstacles.',
                MUSAR_TRANSFORMATIVO:
                  'Psychological-ethical self-examination (Cheshbon HaNefesh) addressing inner emotional friction, reactive habits, anger, envy, pride, anxiety, resentment, interpersonal hurt, laziness, or subconscious bias (negiah) in the school of Rabbi Israel Salanter and Rav Dessler.',
                PARDES:
                  'Classical four-level Torah exegesis (Pshat literal context, Remez philosophical allusion, Drash rabbinic/Midrashic homiletics, Sod inner mystical meaning) for biblical passages, Parashat HaShavua, Psalms, Jewish festivals, or normative Jewish theology and Halakha.',
                PIRKE_AVOT_EXEGETICO:
                  'Exegetical study of a Mishnaic ethical maxim from Pirkei Avot or rabbinic aphorisms of the Tannaim (Hillel, Shammai, Ben Zoma, Rabbi Akiva), contrasting Maimonides, Rabbeinu Yonah, and Maharal.',
                WISSENSCHAFT_DES_JUDENTUMS:
                  'Historical-philological and redactional analysis of Jewish liturgy, Siddur prayers, synagogue history, Cairo Genizah manuscripts, Second Temple sources, or Tannaitic/Amoraic/Geonic textual variants.',
              },
            },
            recommended_tone: {
              type: 'choice',
              instructions:
                'Which homiletic and rhetorical tone in criteria best suits an authentic rabbinic study (Derasha) on student_study_query?',
              criteria: {
                ADVERTENCIA_CAUTELA:
                  'Sober moral caution and spiritual vigilance regarding ethical pitfalls, speech (Lashon Hara), pride, transgression, or communal boundaries.',
                ANALITICO_SOBRIO:
                  'Rigorous, objective, scholarly, halakhic, philological, or philosophical precision focused on textual proof, legal distinctions (Shulchan Arukh), or conceptual clarity.',
                ASPIRACIONAL:
                  'Elevated mystical, poetic, and contemplative vision inspiring awe, holiness (Kedushah), Shabbat/festival transcendence, and closeness to the Divine.',
                LLAMADO_ACCION:
                  'Direct practical mobilization focused on concrete daily Mitzvot, Tzedakah, Chesed, Teshuvah steps, or immediate communal responsibility.',
                MOTIVACION:
                  'Warm, empathetic, encouraging pastoral support that strengthens trust (Bitachon), hope, resilience, gratitude, and personal growth.',
              },
            },
            is_purely_halakhic: {
              type: 'noul',
              instructions:
                'Does student_study_query ask about normative Jewish law (Halakha), practical observance of Mitzvot, Shabbat/festival laws, Kashrut, prayer laws/liturgy, Minhag, or Shulchan Arukh rulings without asking to compare non-Jewish philosophers or external religions?',
              criteria: {
                true_description:
                  'Normative Jewish legal, ritual, liturgical, Minhag, Nusach, or Shulchan Arukh question internal to Judaism.',
                false_description:
                  'Comparative external philosophy/religion query, or non-legal narrative, homiletical, historical, or psychological topic.',
              },
            },
            requires_external_contrast: {
              type: 'noul',
              instructions:
                'Does student_study_query ask to compare, contrast, or dialogue between Jewish/Torah thought and an external non-Jewish philosopher, secular philosophical school, or non-Jewish religious doctrine?',
              criteria: {
                true_description:
                  'Mentions or alludes to non-Jewish philosophers, secular ethical systems, or non-Jewish religions/eschatologies in contrast with Judaism.',
                false_description:
                  'Focuses strictly on internal Jewish texts, Torah, Talmud, Halakha, Kabbalah, Musar, Hasidism, or personal ethical life within Judaism.',
              },
            },
            query_specificity: {
              type: 'score',
              instructions:
                'How specific, focused, and actionable is student_study_query for generating an in-depth exegetical Torah study (Derasha)?',
              criteria: specificityRubric,
            },
          },
        }),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('PER_ATTEMPT_TIMEOUT')), 25000);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }

    if (!decisionResponse?.answers) {
      const blockReason = decisionResponse?.prompt_feedback?.block_reason;
      throw new GeminiHttpError(
        400,
        'CONTENT_BLOCKED',
        blockReason
          ? `La consulta fue bloqueada por restricciones de contenido (${blockReason}). Por favor reformula tu pregunta.`
          : 'No se recibieron respuestas calibradas para evaluar la consulta.'
      );
    }

    const methodAns = decisionResponse.answers.primary_methodology;
    const toneAns = decisionResponse.answers.recommended_tone;
    const halakhaAns = decisionResponse.answers.is_purely_halakhic;
    const contrastAns = decisionResponse.answers.requires_external_contrast;
    const specAns = decisionResponse.answers.query_specificity;

    if (
      methodAns?.type !== 'choice' ||
      toneAns?.type !== 'choice' ||
      halakhaAns?.type !== 'noul' ||
      contrastAns?.type !== 'noul' ||
      specAns?.type !== 'score'
    ) {
      throw new GeminiHttpError(
        502,
        'DECISION_SCHEMA_MISMATCH',
        'La evaluación calibrada devolvió un formato incompleto.'
      );
    }

    const halakhicProb = Number(halakhaAns.noul);
    const externalContrastProb = Number(contrastAns.noul);
    const baseHalakha = validatePurelyHalakhicQuery(query);
    const explicitThinker = detectExternalThinkerAndForceExegeticalSearch(query);

    const isPurelyHalakhic =
      (halakhicProb >= 0.68 && externalContrastProb < 0.45) ||
      (baseHalakha.isPurelyHalakhic && externalContrastProb < 0.45);

    const requiresExternalContrast =
      !isPurelyHalakhic && (externalContrastProb >= 0.65 || explicitThinker.detected);

    const calibratedHalakha =
      isPurelyHalakhic && !baseHalakha.isPurelyHalakhic
        ? {
            ...baseHalakha,
            isPurelyHalakhic: true,
            externalPhilosophyInjectionDisabled: true,
            halakhicDomainLabels:
              baseHalakha.halakhicDomainLabels.length > 0
                ? baseHalakha.halakhicDomainLabels
                : ['Halajá Práctica y Observancia Normativa'],
            validatorSummary:
              'Consulta clasificada dentro del ámbito normativo halájico interno: se prioriza el Shulján Aruj (Mejaber y Ramá) y se excluye filosofía externa.',
          }
        : baseHalakha;

    const allSevenMethodologies = [
      'PARDES',
      'WISSENSCHAFT_DES_JUDENTUMS',
      'EVOLUCION_CONCEPTUAL',
      'MESILAT_YESHARIM_SISTEMATICO',
      'PIRKE_AVOT_EXEGETICO',
      'MUSAR_TRANSFORMATIVO',
      'FILOSOFIA_CONTRASTIVA',
    ];

    const keySourceHintMap: Record<string, string> = {
      PARDES: 'Tanaj · Rashi · Ramban · Midrash Rabá · Zóhar HaKadosh',
      WISSENSCHAFT_DES_JUDENTUMS:
        'Sotah 40a · Berakhot 33a · Yerushalmi · Seder Rav Amram Gaón · Guenizá de El Cairo',
      EVOLUCION_CONCEPTUAL:
        'Torá y Jazal · Etz Jaim / Pardés Rimonim · Mesilat Yesharim · Tania y Jasidut',
      MESILAT_YESHARIM_SISTEMATICO:
        'Ramjal (Mesilat Yesharim caps. 1–26) · Mahut, Dérej Kinyanó y Mafsidayv',
      PIRKE_AVOT_EXEGETICO:
        'Mishná Pirké Avot · Rambam (Shmoná Perakim) vs. Rabenu Yoná y Maharal (Dérej Jaim)',
      MUSAR_TRANSFORMATIVO:
        'Rabí Israel Salanter (Or Yisrael) · Alter de Kelm · Rav Dessler (Mijtav MeEliahu)',
      FILOSOFIA_CONTRASTIVA:
        'Eijá Rabá 2:13 · Kidushín 31a · Sanhedrín 56a · Kuzari · Moreh Nevujim vs. Fuentes Externas',
    };

    const whyApplicableMap: Record<string, string> = {
      PARDES:
        'Articula la exégesis clásica en 4 estratos (Pshat literal, Rémez alegórico, Drash homilético y Sod místico).',
      WISSENSCHAFT_DES_JUDENTUMS:
        'Rastrea la historia redaccional, las variantes de manuscritos, los códigos geónicos y la filología crítica del texto.',
      EVOLUCION_CONCEPTUAL:
        'Traza la genealogía del concepto a través de la Torá Escrita, el Árbol de la Vida cabalístico, el Musar y la Jasidut.',
      MESILAT_YESHARIM_SISTEMATICO:
        'Desglosa analíticamente la virtud según el Ramjal: definición esencial (Mahut), adquisición y obstáculos.',
      PIRKE_AVOT_EXEGETICO:
        'Contrapone las lecturas éticas de Maimónides, Rabenu Yoná de Gerona y el Maharal de Praga sobre la máxima tanaítica.',
      MUSAR_TRANSFORMATIVO:
        'Aísla la fricción conductual inconsciente (negiá) y diseña un ejercicio práctico de Jeshbón HaNéfesh.',
      FILOSOFIA_CONTRASTIVA:
        'Contrasta formalmente fuentes filosóficas o religiosas externas frente a la Torá (Universalidad vs. Especificidad del Mandamiento).',
    };

    const rawProbs: Record<string, number> = methodAns.probabilities || {};
    const eligibleMethods = allSevenMethodologies.filter((m) => {
      if (m !== 'FILOSOFIA_CONTRASTIVA') return true;
      if (isPurelyHalakhic) return false;
      return requiresExternalContrast || (rawProbs.FILOSOFIA_CONTRASTIVA || 0) >= 0.55;
    });

    const probSum =
      eligibleMethods.reduce((acc, m) => acc + Math.max(0, Number(rawProbs[m] || 0)), 0) || 1;

    const rankedWithProb = eligibleMethods
      .map((m) => ({
        methodology: m,
        prob: Math.max(0, Number(rawProbs[m] || 0)) / probSum,
      }))
      .sort((a, b) => {
        if (
          requiresExternalContrast &&
          explicitThinker.detected &&
          (a.methodology === 'FILOSOFIA_CONTRASTIVA' || b.methodology === 'FILOSOFIA_CONTRASTIVA')
        ) {
          return a.methodology === 'FILOSOFIA_CONTRASTIVA' ? -1 : 1;
        }
        return b.prob - a.prob;
      });

    const recommendedPrimary = rankedWithProb[0]?.methodology || 'PARDES';
    const primaryConfidence = Number(rankedWithProb[0]?.prob ?? methodAns.confidence ?? 0.5);
    const recommendedComplementaryFor30Min = rankedWithProb
      .slice(1, 3)
      .map((item) => item.methodology);
    const recommendedComplementaryFor10Min = recommendedComplementaryFor30Min.slice(0, 1);

    const calibratedToneChoice = normalizeDerashaTone(toneAns.choice);
    const effectiveRecommendedTone =
      calibratedToneChoice !== 'AUTO'
        ? calibratedToneChoice
        : resolveDerashaTone('AUTO', query, recommendedPrimary as any, calibratedHalakha)
            .recommendedTone;

    const requestedToneNormalized = normalizeDerashaTone(requestedToneRaw);
    const finalTone =
      requestedToneNormalized !== 'AUTO' ? requestedToneNormalized : effectiveRecommendedTone;
    const toneMeta = getToneMeta(finalTone as any);
    const toneEval = resolveDerashaTone(
      requestedToneRaw,
      query,
      recommendedPrimary as any,
      calibratedHalakha
    );

    const specificityScore = Number(specAns.score || 0);
    const specificityNormalized = Math.max(
      0,
      Math.min(100, Math.round((specificityScore / (specificityRubric.length - 1)) * 100))
    );
    const specBucket = Math.min(3, Math.max(0, Math.round(specificityScore)));
    const specificityLabels = [
      'Término general sin acotar',
      'Tema amplio (admite varios ángulos)',
      'Consulta bien enfocada',
      'Consulta altamente específica',
    ];
    const specificityLevelLabel = specificityLabels[specBucket] || specificityLabels[2];
    const needsClarification =
      specificityScore < 1.1 && !hasExplicitServerCitationOrCalendar(query);

    const delibHalakhicConsultation = consultHalakhicShulchanArukhModule(
      query,
      calibratedHalakha
    );

    const candidates = rankedWithProb.map((item, idx) => {
      const isPrimary = idx === 0;
      const isComp = idx === 1 || idx === 2;
      return {
        methodology: item.methodology,
        relevanceScore: Math.max(1, Math.min(99, Math.round(item.prob * 100))),
        calibratedProbability: Number(item.prob.toFixed(4)),
        role: isPrimary ? 'primary' : isComp ? 'complementary' : 'optional',
        whyApplicable: whyApplicableMap[item.methodology] || whyApplicableMap.PARDES,
        expectedContribution: getComplementaryContributionBrief(item.methodology),
        keySourceHint: keySourceHintMap[item.methodology] || keySourceHintMap.PARDES,
      };
    });

    const primaryPct = Math.round(primaryConfidence * 100);
    const resultPayload = {
      query,
      recommendedPrimary,
      recommendedComplementaryFor10Min,
      recommendedComplementaryFor30Min,
      recommendedTone: finalTone,
      toneRationale: toneEval.recommendationReason,
      halakhicValidation: calibratedHalakha,
      ...(delibHalakhicConsultation.active
        ? { halakhicConsultation: delibHalakhicConsultation }
        : {}),
      decisionCalibration: {
        primaryConfidence: Number(primaryConfidence.toFixed(4)),
        toneConfidence: Number(Number(toneAns.confidence || 0.5).toFixed(4)),
        halakhicProbability: Number(halakhicProb.toFixed(4)),
        isPurelyHalakhic,
        externalContrastProbability: Number(externalContrastProb.toFixed(4)),
        requiresExternalContrast,
        specificityScore: Number(specificityScore.toFixed(3)),
        specificityNormalized,
        specificityLevelLabel,
        specificityConfidence: Number(Number(specAns.confidence || 0.5).toFixed(4)),
        needsClarification,
      },
      deliberationSummary: delibHalakhicConsultation.active
        ? `${delibHalakhicConsultation.moduleSummary} Selección calibrada: ${recommendedPrimary} (${primaryPct}% de probabilidad) y tono «${toneMeta.shortLabel}».`
        : needsClarification
        ? `La consulta presenta amplitud temática (${specificityNormalized}% de especificidad). De ejecutarse directamente se priorizará ${recommendedPrimary} (${primaryPct}%), aunque se recomienda acotar el ángulo para mayor precisión.`
        : `Evaluación semántica calibrada: se selecciona ${recommendedPrimary} (${primaryPct}% de probabilidad) junto con ${recommendedComplementaryFor30Min.join(' y ')} y tono «${toneMeta.shortLabel}».`,
      candidates,
    };

    setBoundedCache(decideMethodologyCache, cacheKey, resultPayload);
    return resultPayload;
  })();

  inFlightDecisionsRequests.set(cacheKey, executionPromise);
  try {
    return await executionPromise;
  } finally {
    inFlightDecisionsRequests.delete(cacheKey);
  }
}

export function registerDecisionsRoute(app: Express) {
  app.post('/api/decide-methodology', async (req, res) => {
    const startedAt = Date.now();
    try {
      const body = req.body || {};
      const rawQuery = body.tema_o_fuente || body.query;

      if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
        return res
          .status(400)
          .json({ error: 'Debes proporcionar una consulta para evaluar las metodologías.' });
      }

      const decisionPayload = await evaluateStudyQueryWithDecisionsApi(
        rawQuery,
        body.tono_homiletico
      );

      return res.json({
        ...decisionPayload,
        deliberationTimeMs: Date.now() - startedAt,
      });
    } catch (error: any) {
      logPipelineGeminiDiagnostic('/api/decide-methodology', error, GEMINI_DECISION_MODEL);
      const classified = classifyGeminiRouteError(error);
      return res.status(classified.status).json({
        error: classified.userMessage,
        errorCode: classified.code,
      });
    }
  });
}

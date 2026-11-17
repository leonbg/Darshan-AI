/**
 * Distills a natural-language user question into a clean conceptual essence
 * and prevents raw questions from ever being quoted between guillemets («...»)
 * or treated as textual citations inside a Derashá.
 */

function normalizeCompare(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!«»"'“”.,;:()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalizeFirst(str: string): string {
  const s = (str || '').trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowercaseFirst(str: string): string {
  const s = (str || '').trim();
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function isConversationalQuestionText(raw?: string): boolean {
  const s = (raw || '').trim();
  if (!s) return false;
  if (/[¿?]/.test(s)) return true;
  return /^(?:yo\s+)?(?:quer[ií]a|quisiera|me\s+gustar[ií]a|expl[ií]came|dime|por\s+qu[eé]|qu[eé]\s+es|qu[eé]\s+significa|cu[aá]l\s+es|c[oó]mo\s+(?:se|podemos|debemos)|d[oó]nde|cu[aá]ndo|qui[eé]n)\b/i.test(
    s
  );
}

function stripWrappedQuotes(text: string): string {
  let s = (text || '').trim();
  if (
    (s.startsWith('«') && s.endsWith('»')) ||
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith('“') && s.endsWith('”'))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function cleanDisjunctiveOrRedundantClauses(text: string): string {
  let s = (text || '').trim();
  if (!s) return s;

  // Detect dedicated prayer posture / bowing / reverence queries early
  const hasMourningTerms =
    /\b(avelut|duelo|luto|aninut|shiv[aá]|shloshim|yahrzeit|kadish|kaddish|vestidura|rasgar|entierro|difunto)\b/i.test(
      s
    );
  if (
    !hasMourningTerms &&
    /(?<![a-záéíóúñ])(postura|reverencia|inclin(?:arse|amos|an|aci[oó]n|aciones)|keri[aá]|hishtajavai[aá]|postrarse|postraci[oó]n|arrodillarse)(?![a-záéíóúñ])/i.test(
      s
    ) &&
    !/(?<![a-záéíóúñ])modim\s+de[- ]?raban[aá]n(?![a-záéíóúñ])/i.test(s)
  ) {
    return 'La Postura Corporal, la Inclinación (Keriá) y la Reverencia en la Plegaria';
  }

  // Detect dedicated gratitude / Hakarat HaTov / Modé Aní queries early
  if (
    /\b(gratitud|hakarat\s+hatov|mod[eé]\s+an[ií]|agradecimiento|agradecer|hodai[aá]|mizmor\s+letod[aá]|tod[aá]\s+rab[aá])\b/i.test(
      s
    ) &&
    !/\b(halel|rosh\s+j[oó]desh|postura|reverencia|inclinarse)\b/i.test(s)
  ) {
    return /\b(mod[eé]\s+an[ií]|despertar|devoluci[oó]n\s+del\s+alma|elohai\s+nesham[aá])\b/i.test(s)
      ? 'La Gratitud al Despertar (Modé Aní) y Hakarat HaTov en la Torá'
      : 'La Gratitud (Hakarat HaTov), Hodaiá y Todá en la Tradición Judía';
  }

  // Condense repeated "X o significado de Y o por qué Z" style dictations/questions
  if (/\s+o\s+/i.test(s)) {
    const parts = s
      .split(/\s+o\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const cleanedParts: string[] = [];
      const seenNorm = new Set<string>();
      for (const part of parts) {
        let p = part
          .replace(/^(?:el\s+|la\s+)?(?:significado|sentido|valor|raz[oó]n)\s+(?:de|del|de\s+la|sobre)\s+/i, '')
          .replace(/^(?:por\s+qu[eé]\s+(?:debemos|se\s+debe|hay\s+que)?\s*)/i, '')
          .replace(/^(?:qu[eé]\s+(?:es|significa)\s+)/i, '')
          .trim();
        if (!p) continue;
        const normP = normalizeCompare(p);
        if (normP && !seenNorm.has(normP)) {
          seenNorm.add(normP);
          cleanedParts.push(lowercaseFirst(p));
        }
      }
      if (cleanedParts.length >= 2) {
        const joined =
          cleanedParts.length === 2
            ? `${cleanedParts[0]} y ${cleanedParts[1]}`
            : `${cleanedParts.slice(0, -1).join(', ')} y ${cleanedParts[cleanedParts.length - 1]}`;
        return joined;
      }
      if (cleanedParts.length === 1) {
        return cleanedParts[0];
      }
    }
  }

  return s;
}

export interface EssenceVariations {
  primary: string;
  shortLabel: string;
  anaphoraOne: string;
  anaphoraTwo: string;
  anaphoraThree: string;
  actionNoun: string;
}

/**
 * Generates varied grammatical references for a topic so essays never echo
 * the exact same long title phrase 20+ times in a row.
 */
export function buildEssenceVariations(
  essence: string,
  options?: { isPostureTopic?: boolean; isGratitudeTopic?: boolean; isHalakhic?: boolean }
): EssenceVariations {
  if (options?.isPostureTopic) {
    return {
      primary: essence,
      shortLabel: 'la postura y la inclinación (Keriá)',
      anaphoraOne: 'esta gestualidad litúrgica',
      anaphoraTwo: 'la reverencia corporal en la Tefilá',
      anaphoraThree: 'el diálogo entre cuerpo y espíritu ante Hashem',
      actionNoun: 'la inclinación consciente (Keriá)',
    };
  }

  if (options?.isGratitudeTopic) {
    return {
      primary: essence,
      shortLabel: 'la gratitud (Hakarat HaTov) y Modé Aní',
      anaphoraOne: 'el reconocimiento agradecido (Hakarat HaTov)',
      anaphoraTwo: 'la conciencia cotidiana de Modé Aní y Todá',
      anaphoraThree: 'la gratitud viva ante el Creador',
      actionNoun: 'el ejercicio diario de agradecimiento (Hodaiá)',
    };
  }

  const trimmed = (essence || '').trim();
  const shortFromColon = trimmed.split(':')[0].trim();
  const shortLabel =
    shortFromColon.length >= 10 && shortFromColon.length <= 55
      ? lowercaseFirst(shortFromColon)
      : trimmed.length <= 50
      ? lowercaseFirst(trimmed)
      : options?.isHalakhic
      ? 'esta norma halájica'
      : 'este principio de la Torá';

  return {
    primary: trimmed || 'Estudio de la Torá',
    shortLabel,
    anaphoraOne: options?.isHalakhic ? 'esta disposición del Shulján Aruj' : 'este principio ético y textual',
    anaphoraTwo: options?.isHalakhic ? 'dicha observancia práctica' : 'esta enseñanza rabínica',
    anaphoraThree: options?.isHalakhic ? 'el cumplimiento consciente del precepto' : 'la vivencia íntima de esta verdad',
    actionNoun: options?.isHalakhic ? 'esta práctica halájica' : 'esta conducta consciente',
  };
}

/**
 * Converts a natural-language question or raw query into a clean conceptual noun-phrase essence.
 */
export function distillTopicEssence(rawQuery: string, candidateTitle?: string): string {
  // Preserve both base subject and explicit narrowing sub-angle ("Profundizando y acotando en:")
  const refineSplitMatch = (rawQuery || '').match(
    /^([\s\S]+?)\s*[—–-]\s*Profundizando\s+y\s+acotando\s+en\s*:\s*([\s\S]+)$/i
  );
  if (refineSplitMatch) {
    const baseEssence = distillTopicEssence(refineSplitMatch[1].trim());
    const subAngle = stripWrappedQuotes(refineSplitMatch[2].trim())
      .replace(/^[¿¡\s]+|[?!.\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (subAngle) {
      const compactSub =
        subAngle.length > 48
          ? `${subAngle.slice(0, 45).replace(/\s+\S*$/, '').trim()}…`
          : subAngle;
      return `${baseEssence}: ${capitalizeFirst(compactSub)}`;
    }
    return baseEssence;
  }

  const cleanCandidate = stripWrappedQuotes((candidateTitle || '').trim());
  const normalizedRaw = normalizeCompare(rawQuery || '');

  // Dedicated topic recognition before generic paraphrasing
  const hasMourningQueryTerms =
    /\b(avelut|duelo|luto|aninut|shiv[aá]|shloshim|yahrzeit|kadish|kaddish|vestidura|rasgar|entierro|difunto)\b/i.test(
      rawQuery || ''
    );
  const isPostureQuery =
    !hasMourningQueryTerms &&
    /(?<![a-záéíóúñ])(postura|reverencia|inclin(?:arse|amos|an|aci[oó]n|aciones)|keri[aá]|hishtajavai[aá]|postrarse|postraci[oó]n|arrodillarse)(?![a-záéíóúñ])/i.test(
      rawQuery || ''
    ) &&
    !/(?<![a-záéíóúñ])modim\s+de[- ]?raban[aá]n(?![a-záéíóúñ])/i.test(rawQuery || '');

  if (isPostureQuery) {
    return 'La Postura Corporal, la Inclinación (Keriá) y la Reverencia en la Plegaria';
  }

  const isGratitudeQuery =
    /\b(gratitud|hakarat\s+hatov|mod[eé]\s+an[ií]|agradecimiento|agradecer|hodai[aá]|mizmor\s+letod[aá]|tod[aá]\s+rab[aá])\b/i.test(
      rawQuery || ''
    ) && !/\b(halel|rosh\s+j[oó]desh)\b/i.test(rawQuery || '');

  if (isGratitudeQuery && !cleanCandidate) {
    return /\b(mod[eé]\s+an[ií]|despertar|devoluci[oó]n\s+del\s+alma|elohai\s+nesham[aá])\b/i.test(
      rawQuery || ''
    )
      ? 'La Gratitud al Despertar (Modé Aní) y Hakarat HaTov en la Torá'
      : 'La Gratitud (Hakarat HaTov), Hodaiá y Todá en la Tradición Judía';
  }

  if (cleanCandidate) {
    const strippedPrefix = cleanCandidate
      .replace(/^(?:Estudio\s+(?:Exeg[eé]tico|Hal[aá]jico(?:\s+en\s+el\s+Shulj[aá]n\s+Aruj,\s+Minhag\s+y\s+N[uú]saj)?)(?:\s*\([^)]+\))?\s*:\s*)/i, '')
      .trim();

    const candidateIsRawEcho =
      !strippedPrefix ||
      normalizeCompare(strippedPrefix) === normalizedRaw ||
      isConversationalQuestionText(strippedPrefix) ||
      /\bo\s+(?:significado|por\s+qu[eé]|qu[eé]\s+es)\b/i.test(strippedPrefix);

    if (!candidateIsRawEcho && strippedPrefix.length >= 6) {
      return capitalizeFirst(strippedPrefix);
    }
  }

  let s = stripWrappedQuotes((rawQuery || '').trim())
    .replace(/^[¿¡\s]+|[?!.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return 'Estudio Exegético de la Tradición';

  // Remove polite / conversational intros
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/^(?:hola[,.\s]+|buenos?\s+d[ií]as[,.\s]+|shalom[,.\s]+)/i, '')
      .replace(/^(?:por\s+favor[,.\s]+)/i, '')
      .replace(
        /^(?:yo\s+)?(?:quer[ií]a|quisiera|me\s+gustar[ií]a|querr[ií]a|necesito|deseo)\s+(?:saber|preguntar|entender|comprender|estudiar|que\s+me\s+expliques?)\s+/i,
        ''
      )
      .replace(
        /^(?:expl[ií]came|dime|cu[eé]ntame|ens[eé][nñ]ame|podr[ií]as?\s+(?:explicarme|decirme|aclararme))\s+/i,
        ''
      )
      .trim();
  }

  // Condense disjunctive / repetitive phrasing early
  const preCondensed = cleanDisjunctiveOrRedundantClauses(s);
  if (preCondensed !== s) {
    return capitalizeFirst(preCondensed);
  }

  let distilled = s;

  const mWhyDuty = s.match(
    /^por\s+qu[eé]\s+(?:en\s+(?:el\s+juda[ií]smo|la\s+tor[aá])\s+)?(?:debemos|tenemos\s+que|se\s+debe|hay\s+que)\s+(.+)$/i
  );
  const mWhyGeneral = s.match(/^por\s+qu[eé]\s+(.+)$/i);
  const mWhatIs = s.match(
    /^qu[eé]\s+(?:es|son|significa(?:n)?|quiere\s+decir)\s+(.+)$/i
  );
  const mWhatTorahSays = s.match(
    /^qu[eé]\s+(?:dice|ense[nñ]a|opina|sostiene|establece|manda)\s+(?:el\s+juda[ií]smo|la\s+tor[aá]|el\s+talmud|la\s+halaj[aá]|jazal)\s+(?:sobre|acerca\s+de|respecto\s+a)\s+(.+)$/i
  );
  const mWhichRole = s.match(
    /^cu[aá]l\s+es\s+(el\s+sentido|el\s+prop[oó]sito|la\s+importancia|el\s+significado|el\s+valor|el\s+rol|el\s+papel|la\s+esencia|la\s+raz[oó]n)\s+(?:de|del|de\s+la)\s+(.+)$/i
  );
  const mWhichDiff = s.match(
    /^cu[aá]l(?:es)?\s+(?:es|son)\s+(?:la|las)\s+diferencias?\s+entre\s+(.+)$/i
  );
  const mHowPractice = s.match(
    /^c[oó]mo\s+(?:podemos|se\s+puede|debemos|hay\s+que|lograr|alcanzar)\s+(.+)$/i
  );
  const mHowGeneral = s.match(/^c[oó]mo\s+(.+)$/i);

  if (mWhyDuty && mWhyDuty[1]) {
    distilled = `Fundamento espiritual de ${lowercaseFirst(cleanDisjunctiveOrRedundantClauses(mWhyDuty[1]))}`;
  } else if (mWhyGeneral && mWhyGeneral[1]) {
    distilled = `Sentido profundo de ${lowercaseFirst(cleanDisjunctiveOrRedundantClauses(mWhyGeneral[1]))}`;
  } else if (mWhatTorahSays && mWhatTorahSays[1]) {
    distilled = `Enseñanza de la Torá sobre ${lowercaseFirst(cleanDisjunctiveOrRedundantClauses(mWhatTorahSays[1]))}`;
  } else if (mWhatIs && mWhatIs[1]) {
    const core = cleanDisjunctiveOrRedundantClauses(mWhatIs[1]).replace(/^(?:el|la|los|las)\s+/i, '').trim();
    distilled =
      core.length <= 45
        ? `Esencia y sentido de ${core} en la Torá`
        : `Significado espiritual de ${lowercaseFirst(core)}`;
  } else if (mWhichDiff && mWhichDiff[1]) {
    distilled = `Distinción y relación entre ${lowercaseFirst(mWhichDiff[1])}`;
  } else if (mWhichRole && mWhichRole[1] && mWhichRole[2]) {
    const roleNoun = lowercaseFirst(mWhichRole[1]).replace(/^el\s+|^la\s+/, '');
    const subjectCore = cleanDisjunctiveOrRedundantClauses(mWhichRole[2]);
    distilled = `${capitalizeFirst(roleNoun)} de ${lowercaseFirst(subjectCore)}`;
  } else if (mHowPractice && mHowPractice[1]) {
    distilled = `Camino práctico para ${lowercaseFirst(cleanDisjunctiveOrRedundantClauses(mHowPractice[1]))}`;
  } else if (mHowGeneral && mHowGeneral[1]) {
    distilled = `Fundamento de ${lowercaseFirst(cleanDisjunctiveOrRedundantClauses(mHowGeneral[1]))}`;
  } else {
    distilled = capitalizeFirst(cleanDisjunctiveOrRedundantClauses(s));
  }

  distilled = capitalizeFirst(distilled.replace(/[¿?¡!]+/g, '').replace(/\s+/g, ' ').trim());

  if (distilled.length > 90) {
    const cut = distilled.slice(0, 87);
    const lastSpace = cut.lastIndexOf(' ');
    distilled = (lastSpace > 48 ? cut.slice(0, lastSpace) : cut).trim();
  }

  return distilled || 'Estudio Exegético de la Tradición';
}

/**
 * Replaces any verbatim quotation of the user's raw question (inside «...» or "...")
 * with the clean conceptual essence so questions are never styled as scriptural quotes.
 */
export function sanitizeQuotedQuestionInString(
  text: string,
  rawQuery: string,
  cleanEssence: string
): string {
  if (!text || typeof text !== 'string') return text;

  const essence = cleanEssence || distillTopicEssence(rawQuery);
  const normQuery = normalizeCompare(rawQuery);
  const queryWords = normQuery.split(' ').filter((w) => w.length >= 3);

  let out = text;

  // Replace explicit guillemet/quote blocks that reproduce the user's raw question
  out = out.replace(/([«"“])([^»"”]{8,260})([»"”])/g, (fullMatch, _open, inner: string) => {
    const normInner = normalizeCompare(inner);
    if (!normInner) return fullMatch;

    const exactOrContainsRaw =
      normQuery.length >= 8 &&
      (normInner === normQuery ||
        normInner.includes(normQuery) ||
        (normQuery.includes(normInner) && normInner.length >= normQuery.length * 0.65));

    const looksLikeQuotedQuestion =
      /[¿?]/.test(inner) &&
      queryWords.length >= 2 &&
      queryWords.filter((w) => normInner.includes(w)).length >=
        Math.min(3, Math.ceil(queryWords.length * 0.6));

    if (exactOrContainsRaw || looksLikeQuotedQuestion) {
      return essence;
    }
    return fullMatch;
  });

  // Replace direct unquoted question echoes prefixed by "consulta:" or "la pregunta:"
  if (rawQuery && /[¿?]/.test(rawQuery.trim())) {
    const rawTrimmed = rawQuery.trim();
    const rawEscaped = escapeRegExp(rawTrimmed);
    out = out.replace(new RegExp(rawEscaped, 'gi'), essence);
  }

  // Clean awkward boilerplate phrases around titles/essences
  out = out
    .replace(
      /(?:responde(?:mos)?\s+directamente\s+a\s+la\s+consulta|la\s+consulta)\s+[«"“]?([^»"”.\n]+)[»"”]?/gi,
      (m, captured) =>
        normalizeCompare(captured) === normalizeCompare(essence) ||
        normalizeCompare(captured) === normQuery
          ? `aborda directamente ${essence}`
          : m
    )
    .replace(
      /en\s+las\s+palabras\s+de\s+[«"“]([^»"”]+)[»"”]/gi,
      (_m, captured) => `en el estudio sobre ${captured}`
    );

  return out;
}

/**
 * Recursively sanitizes a FinalDerasha-like object so no field quotes the user's raw question.
 */
export function sanitizeDerashaQuotedQuestions<T extends Record<string, any>>(
  derasha: T,
  rawQuery: string,
  cleanEssence?: string
): T {
  if (!derasha || typeof derasha !== 'object') return derasha;
  const essence = cleanEssence || distillTopicEssence(rawQuery, derasha.derashaTitle);

  const fixStr = (val: any) =>
    typeof val === 'string' ? sanitizeQuotedQuestionInString(val, rawQuery, essence) : val;

  const copy: any = { ...derasha };
  if (copy.derashaTitle) {
    copy.derashaTitle = distillTopicEssence(rawQuery, fixStr(copy.derashaTitle));
  }
  if (copy.openingExordium) {
    copy.openingExordium = fixStr(copy.openingExordium);
  }
  if (Array.isArray(copy.methodologySections)) {
    copy.methodologySections = copy.methodologySections.map((sec: any) => ({
      ...sec,
      title: fixStr(sec.title),
      exposition: fixStr(sec.exposition),
      keyTakeaway: fixStr(sec.keyTakeaway),
    }));
  }
  if (copy.pardes && typeof copy.pardes === 'object') {
    const nextPardes: any = { ...copy.pardes };
    (['pshat', 'remez', 'drash', 'sod'] as const).forEach((pillar) => {
      if (nextPardes[pillar]) {
        nextPardes[pillar] = {
          ...nextPardes[pillar],
          title: fixStr(nextPardes[pillar].title),
          exposition: fixStr(nextPardes[pillar].exposition),
          keyTakeaway: fixStr(nextPardes[pillar].keyTakeaway),
        };
      }
    });
    copy.pardes = nextPardes;
  }
  if (copy.morphologicalSynthesis) {
    copy.morphologicalSynthesis = {
      ...copy.morphologicalSynthesis,
      summary: fixStr(copy.morphologicalSynthesis.summary),
      keyTheologicalInsight: fixStr(copy.morphologicalSynthesis.keyTheologicalInsight),
    };
  }
  if (copy.canonicalAnalysis) {
    copy.canonicalAnalysis = {
      ...copy.canonicalAnalysis,
      synthesis: fixStr(copy.canonicalAnalysis.synthesis),
    };
  }
  if (copy.practicalConclusion) {
    copy.practicalConclusion = {
      ...copy.practicalConclusion,
      title: fixStr(copy.practicalConclusion.title),
      hashkafa: fixStr(copy.practicalConclusion.hashkafa),
      prayerKavanah: fixStr(copy.practicalConclusion.prayerKavanah),
      dailyAction: fixStr(copy.practicalConclusion.dailyAction),
    };
  }
  if (copy.executiveSummary) {
    copy.executiveSummary = {
      ...copy.executiveSummary,
      headlineThesis: fixStr(copy.executiveSummary.headlineThesis),
      abstractNarrative: fixStr(copy.executiveSummary.abstractNarrative),
      practicalTakeaway: fixStr(copy.executiveSummary.practicalTakeaway),
      keyPillars: Array.isArray(copy.executiveSummary.keyPillars)
        ? copy.executiveSummary.keyPillars.map((p: any) => ({
            ...p,
            label: fixStr(p.label),
            takeaway: fixStr(p.takeaway),
          }))
        : [],
    };
  }
  if (copy.fullStructuredDerashaMarkdown) {
    copy.fullStructuredDerashaMarkdown = fixStr(copy.fullStructuredDerashaMarkdown);
  }
  return copy as T;
}

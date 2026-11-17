import { validatePurelyHalakhicQuery } from '../src/utils/halakhicPipelineValidator.ts';
import { distillTopicEssence } from '../src/utils/topicEssence.ts';

// Normalize voice-to-text phonetic transcriptions (e.g. "maquillaje" -> "Mashíaj", "imperativo categórico de Hunt" -> "Kant", "olamaba" -> "Olam HaBá") and detect whether the input is a natural-language question or comparative philosophical/cosmological study
export function normalizeUserStudyQuery(rawQuery: string): {
  normalizedQuery: string;
  cleanTopicLabel: string;
  isUserQuestion: boolean;
  isHalelTopic: boolean;
  isMourningTopic: boolean;
  isPrayerPostureTopic: boolean;
  isGratitudeTopic: boolean;
  subFocus: string;
  isShulchanArukhOrMinhagNusachTopic: boolean;
  isInternalHalakhaTopic: boolean;
  isMashiajTopic: boolean;
  isMashiajChristianContrastTopic: boolean;
  isMashiajBuddhaContrastTopic: boolean;
  isKantTopic: boolean;
  isPlatoCaveTopic: boolean;
  isCiceroTopic: boolean;
  isEnlightenmentBuddhismTopic: boolean;
  isAfterlifeSoulDestinyTopic: boolean;
  isJewishMovementsAndMessianicBoundaryTopic: boolean;
  isComparativeTopic: boolean;
} {
  let q = String(rawQuery || '').trim();

  // Voice-to-text / mobile keyboard often transcribes "Minhag" (מִנְהָג) as "mi jag" or "minjag"
  if (/\bmi\s+jag\b/i.test(q)) {
    q = q.replace(/\bmi\s+jag\b/gi, 'Minhag (מִנְהָג — costumbre halájica)');
  }
  if (/\bminjag\b/i.test(q)) {
    q = q.replace(/\bminjag\b/gi, 'Minhag');
  }

  // Voice-to-text Spanish dictation often transcribes "Jabad" (חב״ד) as "javad" or "un javad"
  if (/\bjavad\b/i.test(q)) {
    q = q.replace(/\bun\s+javad\b/gi, 'Jabad (Jabad-Lubavitch)');
    q = q.replace(/\bjavad\b/gi, 'Jabad (Jabad-Lubavitch)');
  }

  // Voice-to-text Spanish dictation often transcribes "Mashíaj" (מָשִׁיחַ) as "maquillaje"
  const hasMaquillajeAsMashiaj =
    /\bmaquillaje\b/i.test(q) &&
    (/\b(esperamos|esperar|papel|humano|dios|hacer|venir|venida|redenci[oó]n|mes[ií]as|rey|profeta|era|mundo|paz|juda[ií]smo|jud[ií]o|qu[eé]\s+es\s+el\s+maquillaje|qui[eé]n\s+es\s+el\s+maquillaje)\b/i.test(
      q
    ) ||
      q.split(/\s+/).length >= 4);

  if (hasMaquillajeAsMashiaj) {
    q = q.replace(/\bel\s+maquillaje\b/gi, 'el Mashíaj (el Mesías en el judaísmo)');
    q = q.replace(/\bmaquillaje\b/gi, 'Mashíaj (el Mesías en el judaísmo)');
  }

  // Voice-to-text Spanish dictation often transcribes "Kant" as "Hunt" in philosophical contrast queries
  const hasHuntAsKant =
    /\bhunt\b/i.test(q) &&
    /\b(imperativo|categ[oó]rico|[eé]tica|filosof[ií]a|filos[oó]fico|tradici[oó]n|jud[ií]a|fuente\s+interna|fuente\s+externa|universalidad|comparativo|contraste)\b/i.test(
      q
    );

  if (hasHuntAsKant) {
    q = q.replace(/\bhunt\b/gi, 'Immanuel Kant');
  }

  // Voice-to-text Spanish dictation often transcribes "Olam HaBá" (עוֹלָם הַבָּא) as "olamaba" or "olam haba"
  if (/\bolamaba\b/i.test(q)) {
    q = q.replace(/\bolamaba\b/gi, 'Olam HaBá (el Mundo Venidero)');
  }

  const refineMatch = q.match(
    /^([\s\S]+?)\s*[—–-]\s*Profundizando\s+y\s+acotando\s+en\s*:\s*([\s\S]+)$/i
  );
  const subFocus = refineMatch ? refineMatch[2].replace(/\s+/g, ' ').trim() : '';
  const anchorTextForTopic = refineMatch ? refineMatch[1].trim() : q;

  const isHalelTopic =
    /(?<![a-záéíóúñ])(halel|hallel|jats[ií]\s+halel|halel\s+shalem|medio\s+halel|halel\s+completo|halel\s+ha[- ]?mitsr[ií]|halel\s+ha[- ]?gadol|pesajim\s+117a?|taanit\s+28b?|arj[ií]n\s+10a?|arakhin\s+10a?|rosh\s+j[oó]desh|rosh\s+chodesh|j[oó]desh\s+mal[eé]|j[oó]desh\s+jaser|mes\s+que\s+termina)(?![a-záéíóúñ])/i.test(
      anchorTextForTopic
    );

  const isMourningTopic =
    /(?<![a-záéíóúñ])(avelut|aninut|duelo|luto|shiv[aá]h?|shloshim|yahrzeit|kadish|kaddish|ilui\s+nesham[aá]|entierro|sepelio|fallecimiento|difunt[oa]|vestidura|rasgar)(?![a-záéíóúñ])/i.test(
      anchorTextForTopic
    );

  const isPrayerPostureTopic =
    !isHalelTopic &&
    !isMourningTopic &&
    /(?<![a-záéíóúñ])(postura|posturas|reverencia|reverencias|inclin(?:arse|amos|an|aci[oó]n|aciones)|keri[aá]|hishtajavai[aá]|kid[aá]|postrarse|postraci[oó]n|arrodillarse|pies\s+juntos|v[eé]rtebras|hueso\s+luz)(?![a-záéíóúñ])/i.test(
      anchorTextForTopic
    ) &&
    !/(?<![a-záéíóúñ])modim\s+de[- ]?raban[aá]n(?![a-záéíóúñ])/i.test(anchorTextForTopic);

  const isGratitudeTopic =
    !isHalelTopic &&
    !isPrayerPostureTopic &&
    /(?<![a-záéíóúñ])(gratitud|hakarat\s+hatov|mod[eé]\s+an[ií]|elohai\s+nesham[aá]|agradecimiento|agradecer|hodai[aá]|mizmor\s+letod[aá]|tod[aá]\s+rab[aá]|korb[aá]n\s+tod[aá])(?![a-záéíóúñ])/i.test(
      anchorTextForTopic
    );

  const isShulchanArukhOrMinhagNusachTopic =
    !isHalelTopic &&
    /(?<![a-záéíóúñ])(shulj[aá]n\s+aruj|shulchan\s+arukh|mishn[aá]\s+berur[aá]|oraj\s+jaim|orach\s+chayim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|mejaber|yosef\s+karo|ram[aá]|rem[aá]|mosh[eé]\s+isserles|hamap[aá]|minhag|minhaguim|n[uú]saj|nusjaot|edot\s+hamizraj|kitniyot|birkat\s+kohanim|selijot)(?![a-záéíóúñ])/i.test(
      q
    ) ||
    (!isHalelTopic &&
      /(?<![a-záéíóúñ])(costumbres?|ritos?|sefard[ií](?:es|m|ta|tas)?|ashkenaz[ií](?:es|m)?|teiman[ií]|cumplimiento|leyes\s+jud[ií]as|halaj[aá]h?|alaj[aá]h?)(?![a-záéíóúñ])/i.test(
        q
      ) &&
      /(?<![a-záéíóúñ])(comparar|comparaci[oó]n|comparaciones|diferencias?|contraste|contrastar|minhag|n[uú]saj|shulj[aá]n\s+aruj|sefard[ií]|ashkenaz[ií]|jas[ií]dic[oa]|dentro\s+del\s+juda[ií]smo)(?![a-záéíóúñ])/i.test(
        q
      ));

  const halakhicValidation = validatePurelyHalakhicQuery(q);

  const isInternalHalakhaTopic =
    halakhicValidation.isPurelyHalakhic ||
    isHalelTopic ||
    isPrayerPostureTopic ||
    isMourningTopic ||
    isShulchanArukhOrMinhagNusachTopic ||
    /(?<![a-záéíóúñ])(halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|shulj[aá]n\s+aruj|mishn[eé]\s+tor[aá]|oraj\s+jaim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|minhag|minhaguim|n[uú]saj|rosh\s+j[oó]desh|beraj[aá]h?|berajot|tefil[aá]h?|amid[aá]h?|shemon[eé]\s+esr[eé]|kashrut|shabat|p[eé]saj|sucot|shavuot|januc[aá]|purim|avelut|aninut|shiv[aá]|shloshim|kadish)(?![a-záéíóúñ])/i.test(
      q
    );

  const isJewishMovementsAndMessianicBoundaryTopic =
    /\b(jud[ií]os?\s+mesi[aá]nicos?|juda[ií]smo\s+mesi[aá]nico|jews\s+for\s+jesus|evang[eé]licos?\s+cristianos?|deja\s+de\s+ser\s+(?:un\s+)?grupo\s+jud[ií]o|no\s+son\s+jud[ií]os\s+son\s+evang[eé]licos)\b/i.test(
      q
    ) ||
    (/\b(jasidismo|jabad|lubavitch|breslev|breslov|reformistas?|ortodox[oa]s?|conservador(?:es)?|masort[ií]|distintos\s+grupos|corrientes\s+del\s+juda[ií]smo)\b/i.test(
      q
    ) &&
      /\b(mesi[aá]nicos?|evang[eé]licos?|aleja|deja\s+de\s+ser|frontera|no\s+son\s+jud[ií]os)\b/i.test(
        q
      ));

  const isMashiajTopic =
    !isJewishMovementsAndMessianicBoundaryTopic &&
    !isHalelTopic &&
    (hasMaquillajeAsMashiaj ||
      /\b(mash[ií]aj|mes[ií]as|era\s+mesi[aá]nica|gueul[aá]|redenci[oó]n\s+mesi[aá]nica|ungido|hiljot\s+melajim)\b/i.test(
        q
      ));

  const isMashiajBuddhaContrastTopic =
    isMashiajTopic &&
    /\b(buda|budismo|budista|siddhartha|gautama|shakiamuni|shakyamuni|bodhi|samsara|anatta|dhammapada|shakya)\b/i.test(
      q
    );

  const isMashiajChristianContrastTopic =
    isMashiajTopic &&
    !isMashiajBuddhaContrastTopic &&
    /\b(cristian(?:ismo|o|a|os|as)?|jes[uú]s|cristo|iglesia|nicea|calcedonia|paulin[oa]|encarnaci[oó]n|trinidad|segunda\s+venida|parus[ií]a|pecado\s+original|expiaci[oó]n\s+vicaria|disputa\s+de\s+barcelona|vikuaj|diferencias?|caracterizar|desglosar|comparar|comparaci[oó]n|contraste|contrastar|frente\s+a)\b/i.test(
      q
    );

  const isPlatoCaveTopic =
    /\b(plat[oó]n|plat[oó]nic[oa]s?|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|caverna\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas|rep[uú]blica\s+de\s+plat[oó]n|eutifr[oó]n|fed[oó]n|timeo)\b/i.test(
      q
    );

  const isCiceroTopic =
    /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae)\b/i.test(
      q
    );

  const isAfterlifeSoulDestinyTopic =
    !isHalelTopic &&
    !isInternalHalakhaTopic &&
    !isMashiajBuddhaContrastTopic &&
    !isJewishMovementsAndMessianicBoundaryTopic &&
    (/\b(destino\s+de\s+las\s+almas|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno|campos\s+el[ií]seos)\b/i.test(
      q
    ) ||
      (/\b(olam\s*ha[- ]?b[aá]|mundo\s+venidero|vida\s+despu[eé]s\s+de\s+la\s+muerte)\b/i.test(
        q
      ) &&
        /\b(nirvana|valhalla|valhala|cielo|infierno|requisitos?\s+para\s+(?:poder\s+)?acceder|destino\s+de\s+las\s+almas|samsara)\b/i.test(
          q
        )) ||
      (/\bnirvana\b/i.test(q) &&
        /\b(alma|almas|destino|olam|cielo|infierno|valhalla|valhala|requisitos?|acceder|muerte|para[ií]so)\b/i.test(
          q
        )));

  const isEnlightenmentBuddhismTopic =
    !isHalelTopic &&
    !isInternalHalakhaTopic &&
    !isMashiajBuddhaContrastTopic &&
    !isJewishMovementsAndMessianicBoundaryTopic &&
    (/\b(budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|iluminaci[oó]n\s+budista)\b/i.test(
      q
    ) ||
      (/\biluminaci[oó]n\b/i.test(q) &&
        /\b(budismo|budista|buda|bodhi|nirvana|meditaci[oó]n|despertar\s+espiritual|existe\s+(?:el\s+concepto\s+de\s+)?(?:la\s+)?iluminaci[oó]n|qu[eé]\s+es\s+la\s+iluminaci[oó]n)\b/i.test(
          q
        )) ||
      (/\bnirvana\b/i.test(q) && !isAfterlifeSoulDestinyTopic));

  const isKantTopic =
    !isHalelTopic &&
    !isInternalHalakhaTopic &&
    (hasHuntAsKant ||
      /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|grundlegung)\b/i.test(q) ||
      (!isPlatoCaveTopic &&
        !isCiceroTopic &&
        !isEnlightenmentBuddhismTopic &&
        !isAfterlifeSoulDestinyTopic &&
        !isMashiajChristianContrastTopic &&
        !isMashiajBuddhaContrastTopic &&
        !isJewishMovementsAndMessianicBoundaryTopic &&
        ((/\b(fuentes?\s+internas?\s+(?:y|o|vs\.?|frente\s+a)\s+fuentes?\s+externas?|autonom[ií]a\s+moral)\b/i.test(
          q
        ) &&
          /\b(heteronom[ií]a|teonom[ií]a|kant|deontolog[ií]a)\b/i.test(q)) ||
          (/\b(universalidad)\b/i.test(q) &&
            /\b(especificidad\s+del\s+mandamiento)\b/i.test(q)))));

  const isComparativeTopic =
    !isHalelTopic &&
    !halakhicValidation.externalPhilosophyInjectionDisabled &&
    (isKantTopic ||
      isPlatoCaveTopic ||
      isCiceroTopic ||
      isEnlightenmentBuddhismTopic ||
      isAfterlifeSoulDestinyTopic ||
      isMashiajChristianContrastTopic ||
      isMashiajBuddhaContrastTopic ||
      isJewishMovementsAndMessianicBoundaryTopic ||
      /\b(arist[oó]teles|s[oó]crates|estoic(?:ismo|o|os|a)|s[eé]neca|epicteto|marco\s+aurelio|spinoza|descartes|nietzsche|fil[oó]n|hermann\s+cohen|rosenzweig|levinas|filosof[ií]a\s+comparada|religiones\s+comparadas)\b/i.test(
        q
      ));

  const isUserQuestion =
    /[¿?]/.test(q) ||
    isComparativeTopic ||
    /\b(qu[eé]\s+es|qui[eé]n\s+es|por\s+qu[eé]|cu[aá]l\s+es|c[oó]mo|cu[aá]ndo|d[oó]nde|quer[ií]a\s+saber|me\s+gustar[ií]a\s+saber|explica|explicar|se\s+supone|es\s+humano|es\s+dios|comparativo|contraste|contrastar|caracterizar|desglosar|diferencias)\b/i.test(
      q
    );

  const formatWithSubFocus = (baseLabel: string) => {
    if (!subFocus) return baseLabel;
    const cleanSub = subFocus.replace(/^[¿¡\s]+|[?!.\s]+$/g, '').trim();
    if (!cleanSub) return baseLabel;
    const compactSub =
      cleanSub.length > 52
        ? `${cleanSub.slice(0, 49).replace(/\s+\S*$/, '').trim()}…`
        : cleanSub;
    return `${baseLabel}: ${compactSub.charAt(0).toUpperCase()}${compactSub.slice(1)}`;
  };

  let cleanTopicLabel = q;
  if (isHalelTopic) {
    cleanTopicLabel = formatWithSubFocus(
      'El Halel (הַלֵּל) y Rosh Jódesh de 1 o 2 Días (Mes Jaser de 29 Días vs. Malé de 30 Días) en la Halajá, el Talmud y el Shulján Aruj (Oraj Jaim 422:2 y 427:1)'
    );
  } else if (isPrayerPostureTopic) {
    cleanTopicLabel = formatWithSubFocus(
      'La Postura Corporal, la Inclinación (Keriá) y la Reverencia en la Plegaria'
    );
  } else if (isGratitudeTopic) {
    const baseGratitude =
      /\b(mod[eé]\s+an[ií]|despertar|devoluci[oó]n\s+del\s+alma|elohai\s+nesham[aá])\b/i.test(
        q
      )
        ? 'La Gratitud al Despertar (Modé Aní) y Hakarat HaTov en la Torá'
        : 'La Gratitud (Hakarat HaTov), Hodaiá y Todá en la Tradición Judía';
    cleanTopicLabel = formatWithSubFocus(baseGratitude);
  } else if (isShulchanArukhOrMinhagNusachTopic) {
    cleanTopicLabel = formatWithSubFocus(
      'El Shulján Aruj (שֻׁלְחָן עָרוּךְ), el Cumplimiento de la Halajá y las Comparaciones de Minhag (מִנְהָג) y Núsaj (נוּסַח) Dentro del Judaísmo: Rabí Yosef Karo (Mejaber) frente al Ramá'
    );
  } else if (isJewishMovementsAndMessianicBoundaryTopic) {
    cleanTopicLabel =
      'Corrientes Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) y la Frontera Teológica: Por Qué los «Judíos Mesiánicos» No Son Judíos sino Cristianos Evangélicos';
  } else if (isMashiajBuddhaContrastTopic) {
    cleanTopicLabel =
      '¿Por Qué Buda No es el Mashíaj? Caracterización de Siddhartha Gautama (el Buda) y Desglose de las 7 Diferencias con el Mashíaj del Judaísmo';
  } else if (isMashiajChristianContrastTopic) {
    cleanTopicLabel =
      'El Mashíaj (מָשִׁיחַ) en el Judaísmo frente a la Caracterización del Mesías en el Cristianismo: Desglose Sistemático de Diferencias';
  } else if (isAfterlifeSoulDestinyTopic && isEnlightenmentBuddhismTopic) {
    cleanTopicLabel =
      'Contraste Exegético Formal: La Iluminación (Budismo vs. Judaísmo) y el Destino de las Almas (Olam HaBá frente a Nirvana, Valhalla, Cielo e Infierno)';
  } else if (isAfterlifeSoulDestinyTopic) {
    cleanTopicLabel =
      'El Destino de las Almas y sus Requisitos de Acceso: Olam HaBá en el Judaísmo frente a Nirvana, Valhalla, Cielo e Infierno';
  } else if (isEnlightenmentBuddhismTopic) {
    cleanTopicLabel =
      '¿Qué es la Iluminación? Contraste Exegético entre el Despertar Budista (Bodhi / Nirvana) y la Luz de la Torá (Or HaGanuz, Ruaj HaKódesh y Devekut)';
  } else if (isPlatoCaveTopic && isCiceroTopic) {
    cleanTopicLabel =
      'Contraste Exegético Formal: La Alegoría de la Caverna de Platón y el Deber Cívico de Cicerón frente a las Fuentes Internas de la Torá';
  } else if (isPlatoCaveTopic) {
    cleanTopicLabel =
      'La Alegoría de la Caverna de Platón (República VII) frente a la Luz de la Torá y la Especificidad del Mandamiento (Ner Mitzvá ve-Torá Or)';
  } else if (isCiceroTopic) {
    cleanTopicLabel =
      'Marco Tulio Cicerón (De Officiis y Ley Natural) frente a la Ética del Pacto y la Especificidad del Mandamiento en la Torá';
  } else if (isKantTopic) {
    cleanTopicLabel =
      'El Imperativo Categórico de Kant frente a la Tradición Judía: Universalidad vs. Especificidad del Mandamiento y Fuentes Internas de la Torá vs. Fuentes Externas';
  } else if (isMashiajTopic) {
    cleanTopicLabel =
      'El Mashíaj (מָשִׁיחַ) en el Judaísmo y Contraste con el Mesías del Cristianismo: Naturaleza, Misión y Diferencias Teológicas';
  } else if (/modim|yotzer\s+bereshit/i.test(q)) {
    cleanTopicLabel = 'El Modim de-Rabanán y el Motivo Creacional (Yotzer Bereshit)';
  } else if (isUserQuestion || subFocus) {
    cleanTopicLabel = distillTopicEssence(q);
  }

  return {
    normalizedQuery: q,
    cleanTopicLabel,
    isUserQuestion,
    isHalelTopic,
    isMourningTopic,
    isPrayerPostureTopic,
    isGratitudeTopic,
    subFocus,
    isShulchanArukhOrMinhagNusachTopic,
    isInternalHalakhaTopic,
    isMashiajTopic,
    isMashiajChristianContrastTopic,
    isMashiajBuddhaContrastTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isComparativeTopic,
  };
}

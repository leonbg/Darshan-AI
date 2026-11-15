export interface NormalizedStudyQueryResult {
  normalizedQuery: string;
  cleanTopicLabel: string;
  isUserQuestion: boolean;
  isMashiajTopic: boolean;
  isMashiajChristianContrastTopic: boolean;
  isMashiajBuddhaContrastTopic: boolean;
  isKantTopic: boolean;
  isPlatoCaveTopic: boolean;
  isCiceroTopic: boolean;
  isEnlightenmentBuddhismTopic: boolean;
  isAfterlifeSoulDestinyTopic: boolean;
  isJewishMovementsAndMessianicBoundaryTopic: boolean;
  isRoshChodeshDaysTopic: boolean;
  isComparativeTopic: boolean;
}

// Normalize voice-to-text phonetic transcriptions (e.g. "maquillaje" -> "Mashíaj", "imperativo categórico de Hunt" -> "Kant", "olamaba" -> "Olam HaBá") and detect whether the input is a natural-language question or comparative philosophical/cosmological study
export function normalizeUserStudyQuery(rawQuery: string): NormalizedStudyQueryResult {
  let q = String(rawQuery || '').trim();

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

  const isRoshChodeshDaysTopic =
    /\b(rosh\s+j[oó]desh|rosh\s+ch[oó]desh|ראש\s+חודש|kidush\s+ha[- ]?j[oó]desh|novilunio|luna\s+nueva)\b/i.test(
      q
    ) &&
    /\b(1|2|un\s+d[ií]a|dos\s+d[ií]as|uno|dos|veces|celebra|dura|d[ií]as?|29|30|jaser|mal[eé]|por\s*qu[eé]|raz[oó]n)\b/i.test(
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
    /\b(plat[oó]n|plat[oó]nic[oa]s?|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|caverna\s+de\s+plat[oó]n|la\s+caverna|mundo\s+de\s+las\s+ideas|rep[uú]blica\s+de\s+plat[oó]n|eutifr[oó]n|fed[oó]n|timeo)\b/i.test(
      q
    );

  const isCiceroTopic =
    /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae)\b/i.test(
      q
    );

  const isAfterlifeSoulDestinyTopic =
    !isMashiajBuddhaContrastTopic &&
    !isJewishMovementsAndMessianicBoundaryTopic &&
    (/\b(destino\s+de\s+las\s+almas|olam\s*ha[- ]?b[aá]|mundo\s+venidero|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno|infierno|requisitos?\s+para\s+(?:poder\s+)?acceder|vida\s+despu[eé]s\s+de\s+la\s+muerte|m[aá]s\s+all[aá]|campos\s+el[ií]seos)\b/i.test(
      q
    ) ||
      (/\bnirvana\b/i.test(q) &&
        /\b(alma|almas|destino|olam|cielo|infierno|valhalla|valhala|requisitos?|acceder|muerte|para[ií]so)\b/i.test(
          q
        )));

  const isEnlightenmentBuddhismTopic =
    !isMashiajBuddhaContrastTopic &&
    !isJewishMovementsAndMessianicBoundaryTopic &&
    (/\b(iluminaci[oó]n|budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|despertar\s+espiritual)\b/i.test(
      q
    ) ||
      (/\bnirvana\b/i.test(q) && !isAfterlifeSoulDestinyTopic));

  const isKantTopic =
    hasHuntAsKant ||
    /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|grundlegung)\b/i.test(q) ||
    (!isPlatoCaveTopic &&
      !isCiceroTopic &&
      !isEnlightenmentBuddhismTopic &&
      !isAfterlifeSoulDestinyTopic &&
      !isMashiajChristianContrastTopic &&
      !isMashiajBuddhaContrastTopic &&
      !isJewishMovementsAndMessianicBoundaryTopic &&
      ((/\b(fuentes?\s+internas?|autonom[ií]a)\b/i.test(q) &&
        /\b(fuentes?\s+externas?|heteronom[ií]a|teonom[ií]a|tradici[oó]n\s+jud[ií]a|tor[aá])\b/i.test(
          q
        )) ||
        (/\b(universalidad)\b/i.test(q) &&
          /\b(especificidad)\b/i.test(q) &&
          /\b([eé]tic[oa]s?|mandamiento|mitzva|mitzv[aá])\b/i.test(q))));

  const isComparativeTopic =
    isKantTopic ||
    isPlatoCaveTopic ||
    isCiceroTopic ||
    isEnlightenmentBuddhismTopic ||
    isAfterlifeSoulDestinyTopic ||
    isMashiajChristianContrastTopic ||
    isMashiajBuddhaContrastTopic ||
    isJewishMovementsAndMessianicBoundaryTopic ||
    /\b(arist[oó]teles|s[oó]crates|estoic(?:ismo|o|os|a)|s[eé]neca|epicteto|marco\s+aurelio|spinoza|descartes|nietzsche|fil[oó]n|hermann\s+cohen|rosenzweig|levinas|estudio\s+comparativo|contraste\s+exeg[eé]tico|comparativo\s+o\s+contraste|fuentes?\s+externas?|universalidad\s+frente\s+a\s+(?:la\s+)?especificidad)\b/i.test(
      q
    );

  const isUserQuestion =
    /[¿?]/.test(q) ||
    isComparativeTopic ||
    isRoshChodeshDaysTopic ||
    /\b(qu[eé]\s+es|qui[eé]n\s+es|por\s+qu[eé]|por\s*que|cu[aá]l\s+es|c[oó]mo|cu[aá]ndo|d[oó]nde|quer[ií]a\s+saber|me\s+gustar[ií]a\s+saber|explica|explicar|se\s+supone|es\s+humano|es\s+dios|comparativo|contraste|contrastar|caracterizar|desglosar|diferencias|raz[oó]n)\b/i.test(
      q
    );

  let cleanTopicLabel = q;
  if (isRoshChodeshDaysTopic) {
    cleanTopicLabel =
      '¿Por Qué Rosh Jódesh se Celebra a Veces 1 Día y a Veces 2 Días? Ciclo Lunar (29.53 Días), Mes Jaser (29) vs. Malé (30) y Kidush HaJodesh';
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
  } else if (isUserQuestion) {
    // Strip conversational question prefixes so the raw question is never treated as a quote title
    const stripped = q
      .replace(/^[¿¡\s]+|[?!\s]+$/g, '')
      .replace(
        /^(?:yo\s+)?(?:quer[ií]a|quisiera|me\s+gustar[ií]a)\s+(?:saber|preguntar|entender)\s+/i,
        ''
      )
      .replace(/^(?:por\s+favor\s+)?(?:expl[ií]came|dime)\s+/i, '')
      .trim();
    const capitalized = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    cleanTopicLabel =
      capitalized.length > 82 ? `${capitalized.slice(0, 79).trim()}…` : capitalized;
  }

  return {
    normalizedQuery: q,
    cleanTopicLabel,
    isUserQuestion,
    isMashiajTopic,
    isMashiajChristianContrastTopic,
    isMashiajBuddhaContrastTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isRoshChodeshDaysTopic,
    isComparativeTopic,
  };
}

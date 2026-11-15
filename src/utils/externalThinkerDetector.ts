import {
  ExternalThinkerForcedRef,
  ExternalThinkerPipelineDetection,
  SefariaRefPrediction,
} from '../types';
import { validatePurelyHalakhicQuery } from './halakhicPipelineValidator';

interface ThinkerRuleProfile {
  thinkerId: string;
  thinkerName: string;
  eraAndTradition: string;
  matchRegex: RegExp;
  specificPhilosophicalConcept: string;
  externalPrimaryWorks: string;
  forcedExegeticalSefariaRefs: ExternalThinkerForcedRef[];
  universalityVsSpecificityMatrix: {
    externalConceptUniversalClaim: string;
    torahUniversalHorizon: string;
    torahCommandmentSpecificity: string;
    worldviewContrastSynthesis: string;
  };
}

/**
 * Catálogo de perfiles de filósofos y pensadores externos (Kant, Platón, Cicerón,
 * Aristóteles, Estoicismo, Spinoza/Descartes, Nietzsche/Kierkegaard, Buda/Canon Pali,
 * Utilitarismo, etc.) con las fuentes exegéticas de la Torá que el pipeline fuerza a buscar
 * para contrastar el concepto específico y analizar Universalidad vs. Especificidad del Mandamiento.
 */
const EXTERNAL_THINKER_PROFILES: ThinkerRuleProfile[] = [
  {
    thinkerId: 'KANT_IMPERATIVO_CATEGORICO',
    thinkerName: 'Immanuel Kant (1724–1804)',
    eraAndTradition: 'Idealismo Trascendental y Deontología Ilustrada (Königsberg)',
    matchRegex:
      /\b(?:kant|kantian[oa]s?|imperativo\s+categ[oó]rico|imperativo\s+de\s+hunt|grundlegung|metaf[ií]sica\s+de\s+las\s+costumbres|cr[ií]tica\s+de\s+la\s+raz[oó]n\s+pr[aá]ctica|autonom[ií]a\s+de\s+la\s+voluntad|heteronom[ií]a|deontolog[ií]a\s+kantiana)\b/i,
    specificPhilosophicalConcept:
      'Imperativo Categórico («obra sólo según aquella máxima que puedas querer como ley universal»), Autonomía de la Razón Práctica Pura frente a Heteronomía, y Universalidad Formal sin Excepciones',
    externalPrimaryWorks:
      'Grundlegung zur Metaphysik der Sitten (Ak. IV, 421–433) · Kritik der praktischen Vernunft (Ak. V, 30) · Über ein vermeintes Recht aus Menschenliebe zu lügen (1797)',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Kiddushin 31a',
        heRef: 'קידושין ל״א ע״א',
        category: 'Talmud',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Cosmovisión Judía · Teonomía Relacional vs. Autonomía',
        rationale:
          'Rabí Janiná: «Gadol ha-metzuvé ve-osé yoter mi-mi she-einó metzuvé ve-osé» (Mayor es quien está comandado y cumple que quien actúa sin estar comandado): refuta el supuesto kantiano de que todo mandato externo degrada la moral en heteronomía.',
      },
      {
        ref: 'Yoma 85b',
        heRef: 'יומא פ״ה ע״ב',
        category: 'Talmud',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento · Pikuaj Néfesh sobre Formalismo',
        rationale:
          'Shmuel sobre Levítico 18:5 («Ve-jay bahem, ve-lo she-yamut bahem» — Vivirás por los preceptos y no morirás por ellos): frente a la máxima universal inflexible de Kant (que prohibía mentir incluso a un asesino en la puerta), la Halajá exige especificidad situacional donde salvar una vida concreta prevalece sobre toda abstracción formal.',
      },
      {
        ref: 'Deuteronomy 6:18',
        heRef: 'דברים ו׳:י״ח',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento · Lifnim Mishurat HaDin',
        rationale:
          '«Ve-asita ha-yashar ve-ha-tov» (Harás lo recto y lo bueno): según Ramban y Bava Metzia 30b, exige discernimiento casuístico específico más allá de la letra rígida de una regla general.',
      },
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Universalidad de la Torá vs. Especificidad de la Mitzvá',
        rationale:
          '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento específico y la Torá es luz universal): articula la luz universal de la Torá con la concreción puntual de cada Mitzvá.',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Universalidad Ética en la Torá · 7 Leyes de Noé',
        rationale:
          'Doble horizonte ético del judaísmo: las 7 Leyes Universales de los Hijos de Noé para toda la humanidad junto a la especificidad pactada de las 613 Mitzvot para Israel.',
      },
      {
        ref: 'Deuteronomy 30:14',
        heRef: 'דברים ל׳:י״ד',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Síntesis · Interiorización del Mandamiento',
        rationale:
          '«Pues muy cerca de ti está la palabra, en tu boca y en tu corazón, para cumplirla»: la voz trascendente del Sinaí se interioriza libremente en la conciencia moral (Pirkei Avot 2:4).',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'Para Kant (Grundlegung Ak. IV, 421), una acción sólo es moral si su máxima puede universalizarse formalmente sin contradicción para todo ser racional y sin admitir excepciones particulares (incluso prohibiendo mentirle a un homicida que busca a una víctima inocente). Además, exige que la ley provenga sólo de la razón interna del sujeto (Autonomía).',
      torahUniversalHorizon:
        'La cosmovisión judía afirma un horizonte ético universal e incondicional para toda la humanidad —todo ser humano es creado Betzélem Elohim (Génesis 1:27) y está regido por las 7 Leyes Universales de Noé (Sanhedrín 56a) y el acceso universal de los justos al Olam HaBá (Hiljot Teshuvá 3:5)— sin exigir uniformidad abstracta.',
      torahCommandmentSpecificity:
        'Frente al formalismo rígido kantiano, la Halajá opera mediante la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá): (1) Jerarquía casuística donde salvar una vida concreta (Pikuaj Néfesh, Yoma 85b) y proteger la paz (Yevamot 65b) obligan a suspender reglas formales; (2) Equidad contextual (Lifnim Mishurat HaDin, Deuteronomio 6:18); y (3) 613 preceptos específicos («Ki ner mitzvá ve-Torá or», Proverbios 6:23) que encarnan la santidad en el tiempo, el cuerpo y la comunidad.',
      worldviewContrastSynthesis:
        'Mientras Kant opone la autonomía interna a toda fuente externa y sacrifica el caso concreto en aras de la máxima universal abstracta, la Torá une la Fuente Trascendente del Pacto (Kidushín 31a) interiorizada por amor (Deuteronomio 30:14; Shemoná Perakim cap. 6) con el discernimiento vivo y compasivo de cada situación humana específica.',
    },
  },
  {
    thinkerId: 'PLATON_CAVERNA_IDEAS',
    thinkerName: 'Platón (c. 427–347 a.e.c.)',
    eraAndTradition: 'Idealismo Griego Clásico · Academia de Atenas',
    matchRegex:
      /\b(?:plat[oó]n|plat[oó]nic[oa]s?|neoplat[oó]nic[oa]|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|caverna\s+de\s+plat[oó]n|rep[uú]blica\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas|teor[ií]a\s+de\s+las\s+formas|fed[oó]n|timeo|eutifr[oó]n|banquete\s+de\s+plat[oó]n)\b/i,
    specificPhilosophicalConcept:
      'Alegoría de la Caverna (República VII, 514a–520d) y Teoría de las Ideas: Dualismo entre el Mundo Sensible Particular (Sombras) y el Mundo Inteligible de las Ideas Universales',
    externalPrimaryWorks:
      'Politeia (La República), Libro VII, 514a–520d · Fedón 107d–114c · Eutifrón 10a',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento · La Vela dentro de la Caverna',
        rationale:
          '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento específico y la Torá es luz universal): mientras Platón exige huir de la caverna física hacia el Sol abstracto de las Ideas, la Torá enciende la lámpara específica de cada Mitzvá dentro del mundo material.',
      },
      {
        ref: 'Exodus 24:7',
        heRef: 'שמות כ״ד:ז׳',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Praxis Específica antes que Contemplación Abstracta',
        rationale:
          '«Naasé ve-nishmá» (Haremos y escucharemos/comprenderemos): en la cosmovisión judía, la acción concreta del mandamiento precede y abre la iluminación espiritual, invirtiendo el intelectualismo contemplativo platónico.',
      },
      {
        ref: 'Pirkei Avot 3:17',
        heRef: 'פרקי אבות ג׳:י״ז',
        category: 'Mishná',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Primacía de las Obras Concretas sobre la Teoría Pura',
        rationale:
          'Rabí Elazar ben Azariá: «Toda persona cuya sabiduría supera sus obras es como un árbol de muchas ramas y pocas raíces; pero aquel cuyas obras superan su sabiduría ningún viento puede arrancarlo».',
      },
      {
        ref: 'Chagigah 12a',
        heRef: 'חגיגה י״ב ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Luz Primordial (Or HaGanuz) en la Creación y en la Torá',
        rationale:
          'La luz primordial creada en Génesis 1:3 (Or HaGanuz) no está en un «mundo de Ideas» divorciado de la materia, sino atesorada en la Torá para iluminar y santificar la creación física («Y vio Dios que era muy bueno», Génesis 1:31).',
      },
      {
        ref: 'Deuteronomy 30:12',
        heRef: 'דברים ל׳:י״ב',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Cosmovisión Judía · «No está en el cielo» (Lo ba-Shamayim hi)',
        rationale:
          'La verdad de la Torá no exige que el filósofo se evada hacia una esfera celeste desencarnada, sino que desciende a la tierra para ser vivida en la sociedad humana.',
      },
      {
        ref: 'Lamentations Rabbah 2:13',
        heRef: 'איכה רבה ב׳:י״ג',
        category: 'Midrash',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Regla Exegética · Jojmá ba-Goyim vs. Torá del Sinaí',
        rationale:
          '«Si te dicen que hay sabiduría (Jojmá) en las naciones, créelo; si te dicen que hay Torá en las naciones, no lo creas»: distinción formal entre la ontología especulativa griega y la Torá normativa.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'Para Platón (República VII, 514a–518d), los objetos y actos particulares del mundo físico son meras sombras deficientes en una caverna subterránea; la verdad y el bien existen únicamente en las Formas o Ideas universales, abstractas e inmutables fuera del mundo material.',
      torahUniversalHorizon:
        'La Torá afirma la existencia de una Sabiduría y Luz divina universal («Torá Or», Proverbios 6:23; el Or HaGanuz de Jaguigá 12a y los 7 Preceptos Universales de Noé en Sanhedrín 56a), pero declara que el mundo material fue creado por Dios como «muy bueno» (Tov Meod, Génesis 1:31).',
      torahCommandmentSpecificity:
        'En lugar de escapar de lo particular sensible hacia una Idea abstracta, el judaísmo santifica el detalle concreto mediante la ESPECIFICIDAD DEL MANDAMIENTO («Ner Mitzvá», Proverbios 6:23): cada Mitzvá específica en el tiempo (Shabat), en la mesa (Kashrut), en la economía (Tzedaká) y en la protección de la vida (Pikuaj Néfesh) introduce la luz divina dentro de la caverna física (Dirá BeTajtonim).',
      worldviewContrastSynthesis:
        'El filósofo platónico asciende para huir del mundo sensible y sólo regresa a la caverna por obligación resignada (República 519d); Moshé Rabenu asciende al Sinaí con el único propósito de hacer descender las Tablas del Mandamiento específico al corazón del campamento humano («Naasé ve-nishmá», Éxodo 24:7).',
    },
  },
  {
    thinkerId: 'CICERON_LEX_NATURAE_OFFICIIS',
    thinkerName: 'Marco Tulio Cicerón (106–43 a.e.c.)',
    eraAndTradition: 'Iusnaturalismo Estoico-Romano y Humanismo Cívico',
    matchRegex:
      /\b(?:cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae|ley\s+natural\s+romana)\b/i,
    specificPhilosophicalConcept:
      'Ley Natural Universal (Lex Naturae / Recta Ratio en De Re Publica III.33) y el Deber Cívico (Officium, Honestum vs. Utile en De Officiis I.20)',
    externalPrimaryWorks:
      'De Re Publica III, 22.33 · De Legibus I, 6.18 · De Officiis (Sobre los Deberes) I, 7.20–23 & I, 14.42',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Micah 6:8',
        heRef: 'מיכה ו׳:ח׳',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Cosmovisión Profética vs. Officium Cívico Romano',
        rationale:
          '«Él te ha declarado, oh hombre, qué es lo bueno y qué pide Hashem de ti: solamente hacer justicia (Mishpat), amar la bondad (Jésed) y caminar humildemente con tu Dios»: contrasta el deber relacional y compasivo con el decoro aristocrático de Cicerón.',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Universalidad en la Torá · 7 Leyes de Noé y Dinim',
        rationale:
          'Establece las 7 Leyes Universales de Bnei Nóaj (incluyendo el precepto universal de Dinim / tribunales de justicia), mostrando cómo el judaísmo fundamenta el derecho universal en la Imagen Divina (Génesis 9:6) y no en un cosmos impersonal.',
      },
      {
        ref: 'Deuteronomy 15:7',
        heRef: 'דברים ט״ו:ז׳-ח׳',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento · Tzedaká vs. Liberalitas',
        rationale:
          '«No endurecerás tu corazón ni cerrarás tu mano contra tu hermano pobre, sino que abrirás tu mano a él»: mientras Cicerón en De Officiis I.42 subordina la beneficencia a la reciprocidad cívica y al patrimonio propio, la Torá legisla mandamientos específicos y exigibles de Tzedaká.',
      },
      {
        ref: 'Deuteronomy 6:18',
        heRef: 'דברים ו׳:י״ח',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad Casuística · Lifnim Mishurat HaDin',
        rationale:
          '«Harás lo recto y lo bueno»: frente al rigor uniforme del ius strictum («summum ius, summa iniuria» citado en De Officiis I.33), la Halajá incorpora la especificidad compasiva de Lifnim Mishurat HaDin (Bava Metzia 30b).',
      },
      {
        ref: 'Deuteronomy 4:6',
        heRef: 'דברים ד׳:ו׳-ח׳',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Sabiduría ante las Naciones mediante Estatutos Específicos',
        rationale:
          '«Guardaréis y pondréis por obra, porque esta es vuestra sabiduría y entendimiento a los ojos de los pueblos»: la ejemplaridad universal de Israel brota de la especificidad de sus Jukim y Mishpatim.',
      },
      {
        ref: 'Lamentations Rabbah 2:13',
        heRef: 'איכה רבה ב׳:י״ג',
        category: 'Midrash',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Frontera Hermenéutica · Jojmá Filosófica vs. Torá',
        rationale:
          'Distingue entre la filosofía jurídica de las naciones (Jojmá ba-Goyim) y la Torá del Pacto.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'En De Re Publica III.33, Cicerón define la ley verdadera como «recta ratio naturae congruens» (recta razón conforme a la naturaleza), postulando una universalidad jurídica uniforme e inmutable («no habrá una ley en Roma y otra en Atenas»). En De Officiis I.20, reduce la justicia a no dañar sin provocación, proteger la propiedad privada y calcular el mérito cívico.',
      torahUniversalHorizon:
        'La Torá reconoce un derecho moral universal para toda la humanidad a través de las Siete Leyes de los Hijos de Noé (Sanhedrín 56a, cuyo precepto de Dinim exige cortes de justicia en toda sociedad), fundado en que cada ser humano fue creado Betzélem Elohim (Génesis 1:27).',
      torahCommandmentSpecificity:
        'Sin embargo, la cosmovisión judía sostiene que una «ley natural» genérica no basta para amparar al débil: hace falta la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá) en la Halajá —cuotas concretas de Peá, Leket, Shijejá y Tzedaká (Deuteronomio 15:7–8; 24:17–22), prohibición de oprimir al forastero por la memoria específica del Éxodo, Pikuaj Néfesh (Yoma 85b) y equidad contextual (Lifnim Mishurat HaDin, Deuteronomio 6:18)—.',
      worldviewContrastSynthesis:
        'Mientras Cicerón concibe el deber (officium) desde el honor del ciudadano romano y la reciprocidad utilitaria, la Torá concibe la Mitzvá como respuesta al llamado divino (Miqueas 6:8; Kidushín 31a) que convierte la solidaridad con el vulnerable en justicia específica e innegociable.',
    },
  },
  {
    thinkerId: 'ARISTOTELES_ETICA_MESOTES',
    thinkerName: 'Aristóteles (384–322 a.e.c.)',
    eraAndTradition: 'Filosofía Peripatética · Liceo de Atenas',
    matchRegex:
      /\b(?:arist[oó]teles|aristot[eé]lic[oa]s?|nic[oó]maco|[eé]tica\s+a\s+nic[oó]maco|mes[oó]tes|eudaimon[ií]a|phr[oó]nesis|justo\s+medio\s+aristot[eé]lico)\b/i,
    specificPhilosophicalConcept:
      'Ética de las Virtudes, el Justo Medio Prudencial (Mesótes) y la Felicidad Contemplativa (Eudaimonía) en la Ética a Nicómaco',
    externalPrimaryWorks:
      'Ética a Nicómaco (Ἠθικὰ Νικομάχεια), Libro II cap. 6 (1106b–1107a) & Libro X caps. 7–8',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Mishneh Torah, Human Dispositions 1:5',
        heRef: 'משנה תורה, הלכות דעות א׳:ה׳-ו׳',
        category: 'Halajá',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Rambam · De la Mesótes Griega a la Imitatio Dei (Dérej Hashem)',
        rationale:
          'Maimónides integra la higiene del camino medio (Dérej HaEmtzaít), pero la transforma en cumplimiento del mandamiento bíblico «Ve-halajtá bi-derajav» (Caminarás en Sus caminos, Deuteronomio 28:9): imitar los atributos de compasión y gracia del Creador.',
      },
      {
        ref: 'Pirkei Avot 4:4',
        heRef: 'פרקי אבות ד׳:ד׳',
        category: 'Mishná',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad Radical ante el Orgullo y la Ira',
        rationale:
          'Rabí Levitas de Yavne: «Sé extremadamente humilde de espíritu (Meod meod hevé shfal ruaj)»: como explica el Rambam en Hiljot Deot 2:3, frente al orgullo y la ira el judaísmo rechaza el «justo medio» aristotélico de la megalopsychia (magnanimidad orgullosa) y exige el extremo de la humildad.',
      },
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento (Ner Mitzvá) vs. Hábito Prudencial',
        rationale:
          'En la Torá, la virtud del carácter no se deja sólo al cálculo prudencial subjetivo (phrónesis), sino que es esculpida día a día por la especificidad práctica de cada Mitzvá (Sefer HaJinuj §16: «El corazón es arrastrado detrás de las acciones concretas»).',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Igualdad Moral Universal vs. Elitismo de la Polis Griega',
        rationale:
          'Mientras Aristóteles restringía la plenitud ética al ciudadano libre de la polis griega, la Torá afirma la dignidad universal de todo ser humano (7 Leyes de Noé y Tzelem Elohim).',
      },
      {
        ref: 'Jeremiah 9:23',
        heRef: 'ירמיהו ט׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'La Verdadera Perfección Humana según los Profetas y el Moreh Nevujim III:54',
        rationale:
          '«En esto se gloríe el que se gloríe: en entenderme y conocerme, que Yo soy Hashem, que hago Jésed, Mishpat y Tzedaká en la tierra»: Maimónides cierra la Guía de los Perplejos (III:54) mostrando que la contemplación judía culmina en la acción ética imitativa en la tierra.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'Aristóteles (Ética a Nicómaco II.6 y X.7) define la virtud como un término medio racional (mesótes) orientado a la autarquía y a la contemplación teórica (eudaimonía), reservando la virtud plena a una élite intelectual y exaltando la «magnanimidad» (megalopsychia / orgullo legítimo del hombre superior).',
      torahUniversalHorizon:
        'La cosmovisión judía democratiza y universaliza la vocación ética: todo ser humano porta la imagen de Dios (Génesis 1:27; Sanhedrín 56a) y todo el pueblo es convocado a ser un reino de sacerdotes (Éxodo 19:6), sin dividir a la humanidad en filósofos contemplativos y siervos por naturaleza.',
      torahCommandmentSpecificity:
        'En el plano de la ESPECIFICIDAD DEL MANDAMIENTO: (1) La Torá no deja el carácter a una estimación subjetiva, sino que moldea el alma mediante acciones preceptivas concretas (Mitzvot); (2) Como codifica Maimónides (Hiljot Deot 2:3; Pirkei Avot 4:4), en rasgos como la soberbia y la ira la Torá prohíbe el término medio y exige apartarse hasta el extremo de la humildad (Anavá); y (3) Exige ir más allá de la media estricta hacia la bondad supererogatoria (Jasidut / Lifnim Mishurat HaDin, Mesilat Yesharim cap. 19).',
      worldviewContrastSynthesis:
        'Como demuestra Maimónides al final del Moreh Nevujim (III:54) citando a Jeremías 9:23, mientras para Aristóteles la cima humana es la contemplación solitaria del motor inmóvil, para el judaísmo el conocimiento de Dios desborda necesariamente en la especificidad práctica de hacer Jésed (bondad), Mishpat (juicio justo) y Tzedaká (caridad justa) en la tierra.',
    },
  },
  {
    thinkerId: 'ESTOICISMO_EPICTETO_SENECA_MARCO_AURELIO',
    thinkerName: 'Estoicismo Clásico · Epicteto, Séneca y Marco Aurelio',
    eraAndTradition: 'Estoa Grecorromana (Enquiridión, Cartas a Lucilio y Meditaciones)',
    matchRegex:
      /\b(?:estoic(?:ismo|o|os|a)|epicteto|s[eé]neca|marco\s+aurelio|zen[oó]n\s+de\s+citio|crisipo|ataraxia|apatheia|amor\s+fati|dicotom[ií]a\s+del\s+control|enquiridi[oó]n)\b/i,
    specificPhilosophicalConcept:
      'Imperturbabilidad (Ataraxia / Apatheia), Resignación ante el Destino Impersonal (Amor Fati) y Dicotomía del Control',
    externalPrimaryWorks:
      'Epicteto, Enquiridión §1 · Marco Aurelio, Meditaciones IV.23 · Séneca, Epistulae Morales ad Lucilium',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Leviticus 19:16',
        heRef: 'ויקרא י״ט:ט״ז',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento vs. Indiferencia Estoica (Apatheia)',
        rationale:
          '«Lo taamod al dam reeja» (No te quedarás de brazos cruzados ante la sangre / sufrimiento de tu prójimo): mientras el estoico clasifica el dolor ajeno como «algo externo fuera de mi control» para proteger su imperturbabilidad (ataraxia), la Torá ordena conmoverse e intervenir activamente.',
      },
      {
        ref: 'Pirkei Avot 4:1',
        heRef: 'פרקי אבות ד׳:א׳',
        category: 'Mishná',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Autodominio Ético (Guibor) y Alegría Contentada (Ashir)',
        rationale:
          'Ben Zomá: «¿Quién es fuerte (Guibor)? El que gobierna su impulso. ¿Quién es rico? El que se alegra con su porción»: muestra el punto de contacto aparente con el autodominio estoico, pero fundado en la gratitud relacional al Creador y no en la resignación ante un hado ciego.',
      },
      {
        ref: 'Deuteronomy 28:47',
        heRef: 'דברים כ״ח:מ״ז',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Santificación de la Emoción (Simjá shel Mitzvá) vs. Extirpación Afectiva',
        rationale:
          '«Por cuanto no serviste a Hashem tu Dios con alegría y bondad de corazón»: el judaísmo rechaza la apatheia estoica (anestesia de las pasiones) y exige canalizar la pasión del corazón en el amor y la alegría del mandamiento.',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Universalidad Ética Activa · Responsabilidad por la Justicia del Mundo',
        rationale:
          'Las 7 Leyes Universales de Noé exigen transformar activamente la sociedad mediante tribunales justos (Dinim), en vez de aceptar pasivamente el statu quo como «destino cósmico».',
      },
      {
        ref: 'Pirkei Avot 2:16',
        heRef: 'פרקי אבות ב׳:ט״ז',
        category: 'Mishná',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Deber Específico de Actuar aunque el Resultado Final no Dependa de Uno',
        rationale:
          'Rabí Tarfón: «No te corresponde completar toda la obra, pero tampoco eres libre de desentenderte de ella»: respuesta judía directa a la «dicotomía del control» de Epicteto.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'El estoicismo postula un Logos cósmico determinista e impersonal (Heimarméne) y enseña que la sabiduría universal consiste en la apatheia (erradicar las pasiones) y la ataraxia (imperturbabilidad interior), retirándose hacia la ciudadela interna de la mente ante todo lo que no controlamos.',
      torahUniversalHorizon:
        'La cosmovisión judía afirma una Providencia personal y dialógica sobre toda la creación y convoca universalmente al ser humano a ser socio activo de Dios en la reparación del mundo (Tikún Olam y las 7 Leyes de Noé en Sanhedrín 56a).',
      torahCommandmentSpecificity:
        'Frente al repliegue interior estoico, la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá) exige vulnerabilidad empática y acción concreta en el mundo exterior: llorar con quien sufre, rescatar al oprimido («No te quedes inmóvil ante la sangre de tu prójimo», Levítico 19:16), dar Tzedaká específica, orar para revocar decretos severos y servir con alegría apasionada (Simjá shel Mitzvá, Deuteronomio 28:47).',
      worldviewContrastSynthesis:
        'El sabio estoico busca blindar su alma para no sufrir con el mundo; el Tzadik y el profeta en la Torá abren su corazón para transformar el sufrimiento del mundo en redención mediante cada Mitzvá específica (Pirkei Avot 2:16).',
    },
  },
  {
    thinkerId: 'SPINOZA_DESCARTES_PANTEISMO_RACIONALISMO',
    thinkerName: 'Baruch Spinoza (1632–1677) & Racionalismo Moderno (Descartes)',
    eraAndTradition: 'Inmanentismo Panteísta y Racionalismo Geométrico Moderno',
    matchRegex:
      /\b(?:spinoza|espinoza|espinosismo|deus\s+sive\s+natura|pante[ií]smo|descartes|cartesiano|cogito\s+ergo\s+sum|racionalismo\s+moderno|amor\s+dei\s+intellectualis)\b/i,
    specificPhilosophicalConcept:
      'Deus sive Natura (Identificación Panteísta de Dios con las Leyes Necesarias de la Naturaleza, Negación del Libre Albedrío y de los Mandamientos Específicos)',
    externalPrimaryWorks:
      'Ethica Ordine Geometrico Demonstrata (Parte I, Prop. 15–29; Parte V) · Tractatus Theologico-Politicus (cap. 4)',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Deuteronomy 30:19',
        heRef: 'דברים ל׳:י״ט',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Libre Albedrío Real vs. Determinismo Geométrico de Spinoza',
        rationale:
          '«He puesto delante de ti la vida y el bien, la muerte y el mal; escoge, pues, la vida (U-vajartá ba-jayim)»: como codifica Maimónides en Hiljot Teshuvá cap. 5, el libre albedrío humano y la trascendencia creadora de Dios son el pilar de toda responsabilidad ética.',
      },
      {
        ref: 'Pirkei Avot 3:15',
        heRef: 'פרקי אבות ג׳:ט״ו',
        category: 'Mishná',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Omnisciencia Divina y Libertad Moral («HaKol Tzafui ve-HaReshut Netuná»)',
        rationale:
          'Rabí Akiva: «Todo está previsto, mas el libre albedrío está dado; y el mundo es juzgado con bondad según la mayoría de las obras».',
      },
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Valor Espiritual Permanente de la Especificidad del Mandamiento',
        rationale:
          'Frente a la tesis del Tractatus Theologico-Politicus (cap. 4) que reducía las Mitzvot específicas a leyes meramente políticas del antiguo Estado hebreo, la Torá afirma que cada Mitzvá es una lámpara espiritual eterna (Ner Mitzvá ve-Torá Or).',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Universalidad Ética de Noé y Especificidad del Pacto de Sinaí',
        rationale:
          'Muestra cómo el judaísmo articula ley moral universal con el Pacto específico e irrevocable de Israel.',
      },
      {
        ref: 'Chagigah 12a',
        heRef: 'חגיגה י״ב ע״א',
        category: 'Talmud',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Panenteísmo Creador («Él es el Lugar del mundo») vs. Panteísmo Naturalista',
        rationale:
          'Como explican el Midrash (Bereshit Rabá 68:9: «HaMakom — Él es el lugar del mundo, mas el mundo no es Su lugar») y el Tania (Sháar HaYijud veHaEmuná), Dios trasciende infinitamente la naturaleza y la sostiene libremente a cada instante.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'Spinoza (Ética I, Prop. 29 y TTP cap. 4) identifica a Dios con la sustancia impersonal de la naturaleza (Deus sive Natura), niega el libre albedrío y sostiene que sólo la ley filosófica universal de la razón tiene valor eterno, reduciendo las Mitzvot específicas de la Torá a estatutos políticos caducos.',
      torahUniversalHorizon:
        'La cosmovisión judía afirma que el Creador trasciende infinitamente el cosmos físico («Él es el Lugar del mundo, pero el mundo no lo agota», Bereshit Rabá 68:9) y otorga a toda la humanidad libre albedrío moral y un código ético universal (las 7 Leyes de Noé, Sanhedrín 56a).',
      torahCommandmentSpecificity:
        'En lugar de disolver la ética en una contemplación intelectual determinista (Amor Dei intellectualis), la Torá afirma que la libertad humana se realiza en la ESPECIFICIDAD DEL MANDAMIENTO («U-vajartá ba-jayim», Deuteronomio 30:19; «Ki ner mitzvá ve-Torá or», Proverbios 6:23), donde cada acto concreto de justicia, Shabat y bondad une lo finito con el Infinito.',
      worldviewContrastSynthesis:
        'En un universo panteísta sin libertad (Spinoza) no puede existir el deber moral («deber» presupone «poder elegir»); en la cosmovisión de la Torá, la trascendencia libre del Creador funda la libertad responsable del ser humano y el valor eterno de cada mandamiento específico.',
    },
  },
  {
    thinkerId: 'NIETZSCHE_KIERKEGAARD_EXISTENCIALISMO',
    thinkerName: 'Friedrich Nietzsche, Søren Kierkegaard y el Existencialismo Moderno',
    eraAndTradition: 'Filosofía Existencial y Crítica de la Moral Occidental (Siglos XIX–XX)',
    matchRegex:
      /\b(?:nietzsche|nietzschean[oa]|superhombre|übermensch|voluntad\s+de\s+poder|genealog[ií]a\s+de\s+la\s+moral|kierkegaard|temor\s+y\s+temblor|suspensi[oó]n\s+teleol[oó]gica|existencialismo|sartre|camus|heidegger|schopenhauer)\b/i,
    specificPhilosophicalConcept:
      'Voluntad de Poder / Transvaloración de los Valores (Nietzsche) y la «Suspensión Teleológica de lo Ético» (Kierkegaard) frente a la Ética del Pacto',
    externalPrimaryWorks:
      'Nietzsche, Zur Genealogie der Moral (1887) · Kierkegaard, Frygt og Bæven (Temor y temblor, 1843) · Sartre, El existencialismo es un humanismo',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Genesis 18:25',
        heRef: 'בראשית י״ח:כ״ה',
        category: 'Tanaj',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Abraham ante Dios: «¿El Juez de toda la tierra no hará justicia?»',
        rationale:
          'Como destaca el Rabino Jonathan Sacks y Rav Soloveitchik frente a Kierkegaard: en el judaísmo la fe jamás exige la «suspensión de lo ético», sino que Abraham apela a la justicia moral universal («Ha-Shofet kol ha-áretz lo yaasé mishpat?»).',
      },
      {
        ref: 'Genesis 22:12',
        heRef: 'בראשית כ״ב:י״ב',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'La Akedá en la Tradición Judía · Prohibición Absoluta del Sacrificio Humano',
        rationale:
          '«No extiendas tu mano sobre el muchacho ni le hagas nada»: frente a la lectura irracionalista de Kierkegaard en Temor y Temblor, para Jazal (Taanit 4a) el clímax de la Akedá es que Dios repudia el sacrificio humano y consagra la vida.',
      },
      {
        ref: 'Micah 6:8',
        heRef: 'מיכה ו׳:ח׳',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Compasión (Jésed) como Fuerza Creadora vs. Crítica de Nietzsche',
        rationale:
          'Mientras Nietzsche en La Genealogía de la Moral ridiculiza la compasión hacia el débil como «moral de esclavos», la Torá revela que proteger al vulnerable y practicar Jésed requiere la máxima fortaleza espiritual (Guevurá, Pirkei Avot 4:1).',
      },
      {
        ref: 'Deuteronomy 30:19',
        heRef: 'דברים ל׳:י״ט',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Afirmación Apasionada de la Vida («Escoge la vida») con Ley Moral',
        rationale:
          'El judaísmo comparte el llamado a afirmar la vida terrenal sin nihilismo, pero muestra que la vida sólo florece dentro de la responsabilidad ética del mandamiento específico.',
      },
      {
        ref: 'Kiddushin 31a',
        heRef: 'קידושין ל״א ע״א',
        category: 'Talmud',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Libertad en el Compromiso del Mandamiento (Gadol ha-metzuvé ve-osé)',
        rationale:
          'Frente al sujeto sartreano que inventa valores en el vacío, en la Torá la libertad alcanza su grandeza cuando responde al llamado concreto del Otro.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'Nietzsche rechaza toda ley moral universal como «resentimiento de los débiles» en favor de la voluntad de poder del individuo superior; Kierkegaard (en Temor y Temblor) opone lo ético-universal a un salto de fe individual que «suspende lo ético»; y Sartre afirma que el individuo inventa sus valores sin referencia trascendente.',
      torahUniversalHorizon:
        'La cosmovisión judía sostiene que Dios mismo se vincula con la justicia moral universal («¿El Juez de toda la tierra no hará justicia?», Génesis 18:25) y que la dignidad de cada vida humana (Génesis 1:27; Sanhedrín 56a) no es una invención arbitraria ni una debilidad, sino el fundamento ontológico del universo («Olam Jésed Yibané», Salmos 89:3).',
      torahCommandmentSpecificity:
        'Lejos de suspender la ética o abandonar al débil, la fe judía se encarna en la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá): leyes concretas que protegen al huérfano, a la viuda y al trabajador (Deuteronomio 24:14–22), prohíben sacrificar al inocente (Génesis 22:12; Yoma 85b) y canalizan la creatividad humana hacia la construcción comunitaria (Rav Soloveitchik en Halakhic Man).',
      worldviewContrastSynthesis:
        'La Torá supera tanto el nihilismo de la fuerza sin ley (Nietzsche) como el irracionalismo de una fe divorciada de la justicia (Kierkegaard), uniendo la pasión por la vida («U-vajartá ba-jayim», Deuteronomio 30:19) con la responsabilidad ética específica de cada Mitzvá.',
    },
  },
  {
    thinkerId: 'BUDA_BODHI_NIRVANA',
    thinkerName: 'Siddhartha Gautama (el Buda) y la Filosofía del Canon Pali',
    eraAndTradition: 'Tradición Sramana y Filosofía Budista Clásica (Siglos VI–V a.e.c.)',
    matchRegex:
      /\b(?:buda|budismo|budista|siddhartha|gautama|shakiamuni|bodhi|nirvana|nibbana|dhammapada|anatta|dukkha|samsara|cuatro\s+nobles\s+verdades|camino\s+[oó]ctuple)\b/i,
    specificPhilosophicalConcept:
      'Iluminación (Bodhi), Inexistencia del Yo Sustancial (Anatta), el Mundo como Insatisfacción (Dukkha) y Extinción del Deseo (Nirvana)',
    externalPrimaryWorks:
      'Dhammapada 183, 277–279 · Dhammacakkappavattana Sutta (SN 56.11) · Ariyapariyesana Sutta (MN 26) · Udāna 8.1',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Iluminación mediante la Especificidad del Mandamiento (Ner Mitzvá)',
        rationale:
          '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento específico y la Torá es luz): frente al desapego budista del mundo concreto, en el judaísmo la iluminación se enciende a través de cada Mitzvá específica dentro de la vida material.',
      },
      {
        ref: 'Psalms 36:10',
        heRef: 'תהילים ל״ו:י׳',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Iluminación Relacional («En Tu luz veremos la luz»)',
        rationale:
          '«Ki imejá mekor jayim, be-orjá niré or»: la iluminación judía es comunión relacional (Devekut) entre el alma inmortal y la Fuente de la Vida, no extinción en el vacío.',
      },
      {
        ref: 'Genesis 1:31',
        heRef: 'בראשית א׳:ל״א',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Bondad Intrínseca del Mundo Físico («Tov Meod») vs. Dukkha/Samsara',
        rationale:
          '«Y vio Dios todo lo que había hecho, y he aquí que era muy bueno (Tov Meod)»: la creación material y el deseo humano canalizado hacia el bien son sagrados.',
      },
      {
        ref: 'Chagigah 12a',
        heRef: 'חגיגה י״ב ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Or HaGanuz · La Luz Primordial Oculta en la Torá',
        rationale:
          'La luz espiritual primordial (Or HaGanuz) está guardada en la Torá y en las acciones éticas de los justos.',
      },
      {
        ref: 'Mishneh Torah, Repentance 3:5',
        heRef: 'משנה תורה, הלכות תשובה ג׳:ה׳',
        category: 'Halajá',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Universalidad Ética de Acceso al Olam HaBá',
        rationale:
          '«Los justos de entre todas las naciones del mundo tienen parte en el Mundo Venidero (Olam HaBá)» preservando la identidad consciente del alma (Berajot 17a).',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'El budismo diagnostica universalmente toda existencia condicionada como impermanente (Anicca), dolorosa (Dukkha) y carente de alma individual (Anatta), proponiendo extinguir la sed del deseo (Tanha) y retirarse del mundo histórico hacia el Nirvana.',
      torahUniversalHorizon:
        'La cosmovisión judía afirma que el universo fue creado «muy bueno» (Tov Meod, Génesis 1:31), que cada ser humano posee un alma individual inmortal («Lámpara de Hashem es el alma del hombre», Proverbios 20:27) y que los justos de todas las naciones alcanzan la plenitud eterna del Olam HaBá (Hiljot Teshuvá 3:5).',
      torahCommandmentSpecificity:
        'En lugar de extinguir el deseo o escapar de las relaciones particulares, la Torá canaliza la pasión humana («Amarás a Hashem con ambos impulsos», Berajot 54a) hacia la ESPECIFICIDAD DEL MANDAMIENTO («Ki ner mitzvá ve-Torá or», Proverbios 6:23): construir familia, practicar Tzedaká, santificar el tiempo en Shabat y traer el Ruaj HaKódesh mediante el refinamiento ético concreto (Avodá Zará 20b; Mesilat Yesharim).',
      worldviewContrastSynthesis:
        'Mientras el despertar budista (Bodhi) busca liberar al individuo de la historia apagando la llama del deseo, la iluminación de la Torá busca encender cada mandamiento específico para llenar la historia y la tierra de justicia y luz divina (Dirá BeTajtonim).',
    },
  },
  {
    thinkerId: 'UTILITARISMO_FILOSOFIA_MODERNA',
    thinkerName: 'Utilitarismo y Filosofía Moral Moderna (Bentham, J. S. Mill, Hobbes, Locke, Rousseau)',
    eraAndTradition: 'Consecuencialismo Utilitarista y Contractualismo Moderno',
    matchRegex:
      /\b(?:utilitarismo|utilitarista|bentham|stuart\s+mill|consecuencialismo|contrato\s+social|hobbes|locke|rousseau|hume|hegel|maquiavelo|rawls)\b/i,
    specificPhilosophicalConcept:
      'Cálculo Utilitarista («La mayor felicidad para el mayor número») y Contractualismo frente al Valor Infinito de Cada Vida Individual en la Halajá',
    externalPrimaryWorks:
      'Jeremy Bentham, Introduction to the Principles of Morals and Legislation (1789) · John Stuart Mill, Utilitarianism (1863)',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Sanhedrin 37a',
        heRef: 'סנהדרין ל״ז ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Valor Infinito e Inconmensurable de Cada Vida Humana Individual',
        rationale:
          'Mishná Sanhedrín 4:5 (37a): «Por eso fue creado el ser humano único (Adam), para enseñarte que quien destruye una sola vida es como si destruyera un mundo entero, y quien salva una sola vida es como si salvara un mundo entero»: refuta de raíz el cálculo utilitarista que sacrifica a uno por la mayoría.',
      },
      {
        ref: 'Yoma 85b',
        heRef: 'יומא פ״ה ע״ב',
        category: 'Talmud',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad Casuística · Prohibición de Entregar un Inocente (Yerushalmi Terumot 8:4)',
        rationale:
          'En la Halajá (Tosefta Terumot 7:20; Rambam Hiljot Yesodei HaTorá 5:5), jamás se permite entregar a una persona inocente específica para salvar a una colectividad, porque el valor infinito de una vida no es divisible ni negociable en una suma aritmética.',
      },
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento sobre el Cálculo de Utilidad',
        rationale:
          'La Mitzvá específica establece límites morales infranqueables que protegen al individuo concreto frente a la razón de Estado o la utilidad agregada.',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Pacto Moral Universal (7 Leyes de Noé) vs.Mero Contrato de Interés',
        rationale:
          'El Rabino Jonathan Sacks distingue entre el contrato social (basado en el interés propio) y el Pacto (Berit, basado en la fidelidad moral y la dignidad sagrada del otro).',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'El utilitarismo (Bentham, Mill) reduce la ética a una fórmula universal de maximización agregada («el mayor bienestar para el mayor número»), donde los derechos del individuo concreto pueden subordinarse al cálculo de utilidad colectiva.',
      torahUniversalHorizon:
        'La cosmovisión judía funda la universalidad en que cada ser humano fue creado a imagen del Infinito (Betzélem Elohim, Génesis 1:27; Mishná Sanhedrín 4:5 [37a]): como el infinito no aumenta al multiplicarse, una sola vida humana posee el mismo valor absoluto que el mundo entero.',
      torahCommandmentSpecificity:
        'Mediante la ESPECIFICIDAD DEL MANDAMIENTO (Halajá), el judaísmo protege a la persona concreta e irrepetible: prohíbe sacrificar a un inocente para salvar a un grupo (Hiljot Yesodei HaTorá 5:5), obliga a detener toda la comunidad por un solo enfermo en peligro (Pikuaj Néfesh, Yoma 85b) y exige atender las necesidades específicas de cada pobre (Deuteronomio 15:7–8).',
      worldviewContrastSynthesis:
        'Mientras el utilitarismo disuelve al individuo en una estadística de utilidad general, la Torá une la responsabilidad universal con la santidad inviolable de cada ser humano concreto y de cada Mitzvá específica.',
    },
  },
  {
    thinkerId: 'FRONTERA_CORRIENTES_Y_MESIANICOS',
    thinkerName:
      'Demarcación Teológica: Corrientes del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) vs. «Judíos Mesiánicos» (Cristianismo Evangélico)',
    eraAndTradition:
      'Eclesiología Bautista/Evangélica Misionera («Jews for Jesus», s. XIX–XX) frente a las Corrientes Históricas del Judaísmo',
    matchRegex:
      /\b(?:jud[ií]os?\s+mesi[aá]nicos?|juda[ií]smo\s+mesi[aá]nico|jews\s+for\s+jesus|congregaci[oó]n\s+mesi[aá]nica|evang[eé]licos?\s+cristianos?|cristianos?\s+evang[eé]licos?|deja\s+de\s+ser\s+(?:un\s+)?grupo\s+jud[ií]o|no\s+son\s+jud[ií]os\s+son\s+evang[eé]licos|grupos?\s+dentro\s+del\s+juda[ií]smo.*mesi[aá]nicos?|(?:jabad|javad|breslev|jasidismo|reformistas?).*(?:mesi[aá]nicos?|evang[eé]licos?|deja\s+de\s+ser))\b/i,
    specificPhilosophicalConcept:
      'Criterio de Demarcación Teológica y Halájica: Pluralismo Interno Judío (Jasidismo Jabad y Breslev, Ortodoxia, Masortí y Reformismo) frente a la Frontera donde un Grupo Deja de Ser Judío («Judaísmo Mesiánico» = Cristianismo Evangélico con Simbología Hebrea)',
    externalPrimaryWorks:
      'Declaraciones de Fe de la UMJC y Jews for Jesus (fundado por el pastor bautista Martin «Moishe» Rosen, 1970) · Credos de Nicea (325 e.c.) y Calcedonia (451 e.c.) · Jurisprudencia de la Corte Suprema de Israel (Caso Rufeisen 1962 y Caso Beresford 1989)',
    forcedExegeticalSefariaRefs: [
      {
        ref: 'Deuteronomy 6:4',
        heRef: 'דברים ו׳:ד׳',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Frontera Teológica Innegociable · Unidad Absoluta de Hashem (Shemá Yisrael)',
        rationale:
          '«Shemá Yisrael, Hashem Eloheinu, Hashem Ejad»: principio fundacional que comparten todas las corrientes judías (Ortodoxia, Jasidismo Jabad y Breslev, Conservadores y Reformistas) y que excluye de raíz la teología trinitaria y la encarnación divina predicada por el movimiento «mesiánico» evangélico.',
      },
      {
        ref: 'Numbers 23:19',
        heRef: 'במדבר כ״ג:י״ט',
        category: 'Tanaj',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Incorporeidad Divina vs. Encarnación Cristológica',
        rationale:
          '«Dios no es hombre para que mienta, ni hijo de hombre para que se arrepienta»: adorar a un ser humano como Dios encarnado («Yeshúa») cruza la línea divisoria fuera del judaísmo hacia el cristianismo.',
      },
      {
        ref: 'Deuteronomy 13:1',
        heRef: 'דברים י״ג:א׳',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad e Inmutabilidad del Mandamiento vs. Sincretismo Misionero',
        rationale:
          '«Todo lo que yo os mando, cuidaréis de hacerlo; no añadirás a ello ni quitarás de ello» (junto a Deut. 13:2–6): advierte contra movimientos que usan lenguaje o señales familiares para desviar hacia una teología ajena al Sinaí.',
      },
      {
        ref: 'Eruvin 13b',
        heRef: 'עירובין י״ג ע״ב',
        category: 'Talmud',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Pluralismo Legítimo Dentro del Judaísmo (Eilu ve-Eilu)',
        rationale:
          '«Eilu ve-eilu divrei Elohim jayim» (Tanto estas como aquellas son palabras del Dios Viviente): explica por qué escuelas distintas dentro del monoteísmo judío (Hilel y Shamai, Jasidismo Jabad, Breslev, Lituanos, Sefardíes) debaten sobre el énfasis de las Mitzvot sin romper la unidad de Dios.',
      },
      {
        ref: 'Ezekiel 18:20',
        heRef: 'יחזקאל י״ח:כ׳',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Responsabilidad Moral Directa vs. Expiación Vicaria Evangélica',
        rationale:
          '«El alma que pecare, ésa morirá; el hijo no cargará con la iniquidad del padre»: en el judaísmo el perdón se alcanza por Teshuvá directa y acción ética específica, jamás por fe en un sacrificio humano vicario.',
      },
      {
        ref: 'Sanhedrin 90a',
        heRef: 'סנהדרין צ׳ ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Los 13 Principios de Fe del Rambam y las Fronteras de la Comunidad',
        rationale:
          'Base sobre la cual Maimónides codifica los 13 Principios de la Fe Judía (Hiljot Yesodei HaTorá 1–2): establece la línea objetiva donde una doctrina deja de ser una corriente judía y pasa a ser otra religión.',
      },
    ],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim:
        'Los grupos autodenominados «judíos mesiánicos» (como Jews for Jesus) sostienen el dogma universalista del cristianismo evangélico bautista/pentecostal: que toda persona (judía o gentil) nace bajo el pecado original y sólo puede salvarse mediante la fe en la divinidad encarnada de Jesús («Yeshúa») y su sacrificio expiatorio en la cruz, empleando símbolos judíos (Talit, Kipá, vocabulario hebreo) únicamente como vehículo misionero.',
      torahUniversalHorizon:
        'La cosmovisión judía distingue con nitidez entre dos planos: 1) Hacia el exterior, el judaísmo respeta a los no-judíos sin exigirles convertirse, reconociendo que los Justos de las Naciones (Jasidei Umot HaOlam) tienen parte en el Olam HaBá por las 7 Leyes éticas de Noé (Sanhedrín 56a; Hiljot Teshuvá 3:5); 2) Hacia el interior del judaísmo, el cimiento innegociable que une a todas las corrientes judías es el monoteísmo incorpóreo estricto del Shemá Yisrael (Deuteronomio 6:4; Números 23:19).',
      torahCommandmentSpecificity:
        'Dentro del judaísmo existen diversas corrientes históricas y espirituales que debaten o enfatizan distintos ángulos de la ESPECIFICIDAD DEL MANDAMIENTO (Eruvin 13b): en la Ortodoxia y el Jasidismo, Jabad-Lubavitch enfatiza la comprensión intelectual de la luz divina (Jojmá-Biná-Daat en el Tania) y la difusión activa de cada Mitzvá específica, mientras Breslev (Rabí Najman) enfatiza la alegría radical (Simjá), la plegaria íntima (Hitbodedut) y hallar los puntos buenos (Azamrá); y corrientes modernas como el Reformismo o el Conservadurismo (Masortí), aunque mantienen profundas diferencias halájicas con la Ortodoxia sobre la obligatoriedad ritual, siguen siendo grupos judíos porque mantienen el monoteísmo incorpóreo del Shemá y no adoran a un ser humano como Dios.',
      worldviewContrastSynthesis:
        'Existe un consenso absoluto y unánime entre TODAS las corrientes del judaísmo (Ortodoxia, Jasidismo Jabad y Breslev, Conservadurismo, Reformismo y la Corte Suprema de Israel en los casos Rufeisen 1962 y Beresford 1989): cuando un grupo adopta la Trinidad, la encarnación divina de Jesús y la soteriología evangélica de la cruz, deja de ser un grupo judío. Los «judíos mesiánicos» son teológica e históricamente grupos cristianos evangélicos.',
    },
  },
];

const GENERIC_EXTERNAL_PHILOSOPHER_REGEX =
  /\b(?:s[oó]crates|presocr[aá]ticos?|her[aá]clito|parm[eé]nides|epicuro|epicure[ií]smo|lucrecio|plotino|fil[oó]n\s+de\s+alejandr[ií]a|confucio|confucianismo|lao[- ]?ts[eé]|tao[ií]smo|averroes|avicena|tom[aá]s\s+de\s+aquino|escol[aá]stica|leibniz|hume|fichte|schelling|hegel|schopenhauer|wittgenstein|habermas|foucault|fil[oó]sofo\s+externo|pensador\s+externo|filosof[ií]a\s+griega|filosof[ií]a\s+occidental|filosof[ií]a\s+moderna|fuentes?\s+externas?)\b/i;

/**
 * Módulo del Pipeline: Detecta automáticamente cuando una consulta menciona a un filósofo
 * o pensador externo (como Kant, Platón, Cicerón, Aristóteles, Séneca, Spinoza, Nietzsche, Buda, etc.)
 * y fuerza:
 * 1) La activación de la metodología 'FILOSOFIA_CONTRASTIVA'.
 * 2) Una búsqueda forzada de fuentes exegéticas en Sefaria que contrasten ese concepto específico
 *    con la cosmovisión del judaísmo.
 * 3) El análisis explícito de la Universalidad versus Especificidad del Mandamiento.
 */
export function detectExternalThinkerAndForceExegeticalSearch(
  rawQuery: string
): ExternalThinkerPipelineDetection {
  const q = (rawQuery || '').trim();

  if (!q) {
    return createEmptyDetection();
  }

  // Pipeline Halakhic Validator Guard: If the query is purely Halakhic (e.g. prayer laws, Hallel, holidays, Shabbat, Kashrut, Shulchan Arukh, Minhag/Nusach),
  // automatically disable any external philosophical/comparative thinker detection.
  const halakhicValidation = validatePurelyHalakhicQuery(q);
  if (halakhicValidation.externalPhilosophyInjectionDisabled) {
    return createEmptyDetection();
  }

  // Check if multiple specific classical thinkers are mentioned together (e.g., Platón + Cicerón, or Kant + Platón)
  const matchedProfiles = EXTERNAL_THINKER_PROFILES.filter((profile) =>
    profile.matchRegex.test(q)
  );

  if (matchedProfiles.length > 0) {
    const primary = matchedProfiles[0];
    const combinedNames = matchedProfiles.map((p) => p.thinkerName).join(' · ');
    const combinedConcepts = matchedProfiles
      .map((p) => p.specificPhilosophicalConcept)
      .join(' | ');
    const combinedWorks = matchedProfiles.map((p) => p.externalPrimaryWorks).join(' · ');

    // Merge and deduplicate forced Sefaria exegetical references across all matched thinkers
    const refMap = new Map<string, ExternalThinkerForcedRef>();
    for (const prof of matchedProfiles) {
      for (const r of prof.forcedExegeticalSefariaRefs) {
        if (!refMap.has(r.ref.toLowerCase())) {
          refMap.set(r.ref.toLowerCase(), r);
        }
      }
    }
    const mergedRefs = Array.from(refMap.values()).slice(0, 6);

    return {
      detected: true,
      thinkerId: matchedProfiles.map((p) => p.thinkerId).join('+'),
      thinkerName: combinedNames,
      eraAndTradition: primary.eraAndTradition,
      specificPhilosophicalConcept: combinedConcepts,
      externalPrimaryWorks: combinedWorks,
      forcedMethodology: 'FILOSOFIA_CONTRASTIVA',
      pipelineActionSummary: `Módulo Detector activado: Se identificó a ${combinedNames}. El pipeline fuerza la metodología FILOSOFIA_CONTRASTIVA y la búsqueda exegética en Sefaria de ${mergedRefs.map((r) => r.ref).join(', ')} para contrastar «${primary.specificPhilosophicalConcept}» con la cosmovisión del judaísmo, analizando explícitamente la Universalidad vs. Especificidad del Mandamiento.`,
      forcedExegeticalSefariaRefs: mergedRefs,
      universalityVsSpecificityMatrix: primary.universalityVsSpecificityMatrix,
    };
  }

  // Fallback for any other external philosopher or school mentioned in the query
  const genericMatch = q.match(GENERIC_EXTERNAL_PHILOSOPHER_REGEX);
  if (genericMatch) {
    const matchedTerm = genericMatch[0];
    const forcedRefs: ExternalThinkerForcedRef[] = [
      {
        ref: 'Proverbs 6:23',
        heRef: 'משלי ו׳:כ״ג',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad del Mandamiento (Ner Mitzvá) vs. Universalidad Abstracta',
        rationale:
          '«Ki ner mitzvá ve-Torá or» (Porque lámpara es el mandamiento específico y la Torá es luz universal): clave exegética para contrastar los sistemas filosóficos abstractos con la concreción normativa de la Mitzvá.',
      },
      {
        ref: 'Kiddushin 31a',
        heRef: 'קידושין ל״א ע״א',
        category: 'Talmud',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Cosmovisión Judía · Teonomía del Pacto vs. Autonomía Filosófica',
        rationale:
          '«Gadol ha-metzuvé ve-osé»: superioridad ética de quien responde al llamado relacional del Mandamiento frente a la especulación autónoma.',
      },
      {
        ref: 'Sanhedrin 56a',
        heRef: 'סנהדרין נ״ו ע״א',
        category: 'Talmud',
        contrastRole: 'UNIVERSALIDAD_TORAH',
        roleLabelEs: 'Universalidad Ética en la Torá · Las 7 Leyes de Noé',
        rationale:
          'Articula el horizonte ético universal para toda la humanidad con la especificidad de las 613 Mitzvot del Pacto.',
      },
      {
        ref: 'Yoma 85b',
        heRef: 'יומא פ״ה ע״ב',
        category: 'Talmud',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Especificidad Vital · Pikuaj Néfesh sobre toda Regla Abstracta',
        rationale:
          '«Vivirás por ellos y no morirás por ellos»: la Halajá prioriza la vida humana concreta en cada contexto.',
      },
      {
        ref: 'Lamentations Rabbah 2:13',
        heRef: 'איכה רבה ב׳:י״ג',
        category: 'Midrash',
        contrastRole: 'TEONOMIA_COSMOVISION',
        roleLabelEs: 'Regla de Contraste · Jojmá ba-Goyim vs. Torá del Sinaí',
        rationale:
          '«Si te dicen que hay sabiduría (Jojmá) entre las naciones, créelo; si te dicen que hay Torá entre las naciones, no lo creas».',
      },
      {
        ref: 'Deuteronomy 6:18',
        heRef: 'דברים ו׳:י״ח',
        category: 'Tanaj',
        contrastRole: 'ESPECIFICIDAD_MITZVA',
        roleLabelEs: 'Equidad Contextual · Lifnim Mishurat HaDin',
        rationale:
          '«Harás lo recto y lo bueno»: discernimiento específico ante la singularidad de cada caso.',
      },
    ];

    return {
      detected: true,
      thinkerId: 'EXTERNAL_PHILOSOPHER_GENERIC',
      thinkerName: `Pensador / Corriente Externa Detectada (${matchedTerm})`,
      eraAndTradition: 'Filosofía y Pensamiento Externo Comparado',
      specificPhilosophicalConcept: `Concepto filosófico planteado en la consulta («${q.slice(0, 90)}»)`,
      externalPrimaryWorks: 'Corpus Filosófico Externo Comparado',
      forcedMethodology: 'FILOSOFIA_CONTRASTIVA',
      pipelineActionSummary: `Módulo Detector activado: Se detectó mención a pensamiento filosófico externo (${matchedTerm}). Se fuerza la búsqueda de fuentes exegéticas en Sefaria (Proverbs 6:23, Kiddushin 31a, Sanhedrin 56a, Yoma 85b, Lamentations Rabbah 2:13, Deuteronomy 6:18) para contrastar el concepto con la cosmovisión judía y analizar explícitamente la Universalidad vs. Especificidad del Mandamiento.`,
      forcedExegeticalSefariaRefs: forcedRefs,
      universalityVsSpecificityMatrix: {
        externalConceptUniversalClaim:
          'Los sistemas filosóficos externos formulan principios éticos u ontológicos desde la razón autónoma universal o desde categorías abstractas e impersonales.',
        torahUniversalHorizon:
          'La cosmovisión judía afirma una ética universal para toda la humanidad fundada en la Imagen Divina (Betzélem Elohim, Génesis 1:27) y las 7 Leyes Universales de Noé (Sanhedrín 56a; Hiljot Teshuvá 3:5).',
        torahCommandmentSpecificity:
          'Al mismo tiempo, la Torá sostiene que la luz universal sólo transforma la realidad cuando se encarna en la ESPECIFICIDAD DEL MANDAMIENTO («Ki ner mitzvá ve-Torá or», Proverbios 6:23; Pikuaj Néfesh en Yoma 85b; Lifnim Mishurat HaDin en Deuteronomio 6:18 y las 613 Mitzvot).',
        worldviewContrastSynthesis:
          'Conforme a Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»), el pipeline contrasta la especulación filosófica externa (Jojmá) con la Teonomía relacional y práctica de la Torá (Kidushín 31a).',
      },
    };
  }

  return createEmptyDetection();
}

/**
 * Fusiona las referencias exegéticas forzadas por el detector de pensadores externos
 * con las referencias sugeridas por el modelo, garantizando que el pipeline siempre
 * busque en Sefaria las fuentes que contrastan Universalidad vs. Especificidad del Mandamiento.
 */
export function mergeForcedThinkerRefsWithPredictions(
  detection: ExternalThinkerPipelineDetection,
  modelPredictions: SefariaRefPrediction[] = [],
  maxCount = 6
): SefariaRefPrediction[] {
  if (!detection.detected || detection.forcedExegeticalSefariaRefs.length === 0) {
    return modelPredictions;
  }

  const forcedAsPredictions: SefariaRefPrediction[] =
    detection.forcedExegeticalSefariaRefs.map((item) => ({
      ref: item.ref,
      heRef: item.heRef,
      category: item.category === 'Halajá' ? 'Talmud' : item.category,
      rationale: `[Búsqueda Exegética Forzada · ${item.roleLabelEs}] ${item.rationale}`,
    }));

  const seen = new Set<string>();
  const merged: SefariaRefPrediction[] = [];

  // Put the top 4 forced contrastive references first so they are always included in Sefaria fetch
  for (const item of forcedAsPredictions.slice(0, 4)) {
    const key = item.ref.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  // Then include relevant model predictions
  for (const pred of modelPredictions) {
    if (!pred?.ref) continue;
    const key = pred.ref.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(pred);
    }
    if (merged.length >= maxCount) break;
  }

  // Fill any remaining slots with the rest of the forced references
  for (const item of forcedAsPredictions.slice(4)) {
    if (merged.length >= maxCount) break;
    const key = item.ref.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.slice(0, maxCount);
}

function createEmptyDetection(): ExternalThinkerPipelineDetection {
  return {
    detected: false,
    thinkerId: '',
    thinkerName: '',
    eraAndTradition: '',
    specificPhilosophicalConcept: '',
    externalPrimaryWorks: '',
    forcedMethodology: 'FILOSOFIA_CONTRASTIVA',
    pipelineActionSummary: '',
    forcedExegeticalSefariaRefs: [],
    universalityVsSpecificityMatrix: {
      externalConceptUniversalClaim: '',
      torahUniversalHorizon: '',
      torahCommandmentSpecificity: '',
      worldviewContrastSynthesis: '',
    },
  };
}

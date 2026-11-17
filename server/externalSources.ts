import { externalSourcesCache, setBoundedCache } from './aiClient.ts';
import { normalizeUserStudyQuery } from './queryNormalization.ts';

// ============================================================================
// PRINCIPIO DE FUENTES INTERNAS DE LA TORÁ Y USO DE FUENTES EXTERNAS EN ESTUDIOS COMPARATIVOS
// ============================================================================
export const STRICT_JEWISH_SOURCES_COVENANT = `
REGLA HERMENÉUTICA DE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS EN ESTUDIOS COMPARATIVOS:
1. FUENTES INTERNAS DE LA TORÁ Y LA MASORAH (Canon de Sefaria):
   - Para la voz normativa, teológica y exegética judía, fundamenta tus análisis en las Fuentes Internas de la Tradición Judía:
     * Tanaj (Torá, Neviím y Ketuvim según el texto masorético hebreo) y Targumim.
     * Literatura de Jazal: Mishná (incluyendo Pirkei Avot), Tosefta, Talmud Bavli, Talmud Yerushalmi, Midrashim Halájicos (Mejilá, Sifrá, Sifré) y Midrashim Agádicos (Midrash Rabá, Eijá Rabá, Tanjumá).
     * Códigos Halájicos, Rishonim y Ajaronim: Rashi, Rambam (Mishné Torá), Ramban (Najmánides), Arbaá Turim (Rabí Yaakov ben Asher), y OBLIGATORIAMENTE en todo tema de leyes, cumplimiento práctico (Halajá le-Maasé) y costumbres: el **SHULJÁN ARUJ (שֻׁלְחָן עָרוּךְ)** de Rabí Yosef Karo (*El Mejaber* · tradición Sefardí / Edot HaMizraj) junto con las glosas de **HaMapá del Ramá** (Rabí Moshé Isserles · tradición Ashkenazí) en sus cuatro secciones (*Oraj Jaim*, *Yoré Deá*, *Even HaEzer* y *Joshen Mishpat*), así como sus comentaristas (*Mishná Berurá* del Jafetz Jaim, *Taz*, *Maguén Avraham*, *Ben Ish Jai*, *Kaf HaJaim*, *Aruj HaShulján* y *Yalkut Yosef*).
     * Pensadores y Maestros: Ibn Ezra, Rashbam, Radak, Rabenu Yoná, Maharal de Praga, Ramjal (Mesilat Yesharim), Gaón de Vilna, Baal Shem Tov, Alter Rebe (Tania y Shulján Aruj HaRav), Rabí Israel Salanter, Rav Samson Raphael Hirsch, Rav Abraham Isaac Kook, Rav Joseph B. Soloveitchik, Rabino Lord Jonathan Sacks y Rab Yehoshua Gordon.
   - MATICES INTERNOS DE LEYES Y COSTUMBRES DENTRO DEL JUDAÍSMO (HALAJÁ · MINHAG · NÚSAJ):
     * Cuando la consulta aborde leyes, cumplimiento práctico, costumbres o comparaciones internas dentro del judaísmo, DEBES distinguir y articular con precisión estos tres conceptos:
       (a) **Halajá (הֲלָכָה — Ley normativa)**: La norma jurídica base (De-Oraita o De-Rabanán) codificada en el Talmud, el *Mishné Torá* y el **Shulján Aruj**, mostrando cómo dialogan el dictamen sefardí de **Rabí Yosef Karo (El Mejaber)** y la glosa ashkenazí del **Ramá (Rabí Moshé Isserles)**.
       (b) **Minhag (מִנְהָג — Costumbre comunitaria y ancestral)**: Las prácticas ancestrales que cada comunidad de Israel ha recibido («Minhag avoteijem be-yadeijem» en *Taanit 28b*; «Minhag Yisrael Torá hi»; *Pesajim 50b*; *Shulján Aruj, Yoré Deá 214:1*). Utiliza el concepto de *Minhag* para explicar y comparar con respeto las diferencias de cumplimiento dentro del judaísmo entre comunidades **Sefardíes / Edot HaMizraj**, **Ashkenazíes**, **Jasídicas**, **Teimaníes (Yemeníes)** e **Italkíes** (por ejemplo: recitar o no *berajá* en el Medio Halel de *Rosh Jódesh* en *Shulján Aruj Oraj Jaim 422:2*; *Birkat Kohanim* diaria vs. en festividades en *Oraj Jaim 128:44*; inicio de las *Selijot* desde Rosh Jódesh Elul vs. días previos a Rosh Hashaná en *Oraj Jaim 581:1*; *Tefilín* en *Jol HaMoed* en *Oraj Jaim 31:2*; o *Kitniyot* en Pésaj en *Oraj Jaim 453:1*).
       (c) **Núsaj (נוּסַח — Rito y formulación litúrgica)**: Las variantes en la redacción textual, estructura del Sidur y melodía litúrgica (*Shulján Aruj, Oraj Jaim 68:1*: «No se debe alterar el Minhag ni el Núsaj del lugar»), comparando los grandes ritos: **Núsaj Sefarad / Edot HaMizraj**, **Núsaj Ashkenaz**, **Núsaj Sefard / Ari (Jasídico)**, **Núsaj Teimán (Baladi y Shami)** y **Núsaj Italkí / Romaniota**.
2. FUENTES EXTERNAS FILOSÓFICAS Y CLÁSICAS EN ESTUDIOS COMPARATIVOS («Jojmá ba-Goyim taamín» — Eijá Rabá 2:13):
   - Cuando la consulta del usuario plantee un ESTUDIO COMPARATIVO o CONTRASTE EXEGÉTICO frente a filósofos, pensadores o textos clásicos externos (por ejemplo: el Imperativo Categórico de Immanuel Kant, la Alegoría de la Caverna de Platón en La República Libro VII, Marco Tulio Cicerón en De Officiis / De Re Publica / De Legibus, Aristóteles en Ética a Nicómaco, el Estoicismo de Séneca/Epicteto/Marco Aurelio, Spinoza, etc.):
     * SÍ DEBES utilizar, citar con precisión académica y analizar las FUENTES EXTERNAS FILOSÓFICAS Y CLÁSICAS proporcionadas para informar la respuesta (citando la obra exacta, el libro/sección como República VII 514a-518d, De Officiis I.20, De Re Publica III.33 o Grundlegung Ak. IV 421, su concepto original y su tesis).
     * DEBES realizar siempre un CONTRASTE EXEGÉTICO FORMAL en dos dimensiones:
       (A) LA UNIVERSALIDAD FRENTE A LA ESPECIFICIDAD DEL MANDAMIENTO: Cómo la fuente externa formula leyes o ideas universales abstractas (el imperativo formal universal de Kant, la Idea universal fuera de la caverna en Platón, la lex naturae / recta ratio uniforme en Cicerón) frente a cómo la Torá articula la universalidad ética (Tzelem Elohim y las 7 Leyes de Noé en Sanhedrín 56a) con la ESPECIFICIDAD CONCRETA DEL MANDAMIENTO (Mitzvá como lámpara que ilumina lo particular en Proverbios 6:23 «Ner Mitzvá ve-Torá Or», la acción específica que precede a la teoría en Éxodo 24:7 «Naasé ve-nishmá», la casuística vital de Pikuaj Néfesh en Yoma 85b, Lifnim Mishurat HaDin en Deuteronomio 6:18 y las 613 Mitzvot del Pacto).
       (B) LA DISTINCIÓN ENTRE FUENTES INTERNAS DE LA TORÁ Y FUENTES EXTERNAS: Basado en Eijá Rabá 2:13 («Si te dicen que hay sabiduría [Jojmá] entre las naciones, créelo; si te dicen que hay Torá entre las naciones, no lo creas»), distingue entre las Fuentes Externas (razón filosófica autónoma, especulación metafísica o deber cívico natural) y las Fuentes Internas de la Torá (Revelación relacional en Sinaí, voz trascendente del Comandante en Kidushín 31a «Gadol ha-metzuvé ve-osé» que rompe el solipsismo del ego y se interioriza en el corazón según Deuteronomio 30:14).
3. CARACTERIZACIÓN Y DESGLOSE COMPARATIVO FRENTE AL MESIANISMO CRISTIANO O FRENTE A BUDA (CUANDO EL USUARIO LO PREGUNTA):
   - En las referencias canónicas de Sefaria (campo 'canonicalReferences'), utiliza siempre textos del canon judío (Tanaj, Talmud, Mishné Torá, etc.).
   - Sin embargo, cuando el usuario pregunte sobre el Mashíaj o pida **caracterizar el Mesías del cristianismo o a Siddhartha Gautama (el Buda) para desglosar por qué no son el Mashíaj del judaísmo**, DEBES responder de forma exhaustiva AMBAS PARTES de la pregunta:
     (1) **El Mashíaj en el Judaísmo (Fuentes Internas de la Torá)**: qué significa *Mashíaj* («el Ungido» con aceite, de la raíz *Mashaj*), su naturaleza 100% humana y mortal nacido de padre y madre humanos del linaje patrilineal de David y Salomón (Isaías 11:1–9; 2 Samuel 7:12–16; 1 Crónicas 22:9–10), la unicidad e incorporeidad absoluta de Dios (Deuteronomio 6:4; Números 23:19; Oseas 11:9) y su misión histórico-política verificable en este mundo (Maimónides, *Hiljot Melajim* caps. 11–12).
     (2) **Si compara con el Cristianismo**: caracteriza los 5 ejes dogmáticos que definen al Mesías cristiano (Encarnación trinitaria en Nicea 325 e.c. / Calcedonia 451 e.c., Pecado Original y Expiación Vicaria en la cruz, Redención interior invisible, Abrogación de la Ley y Segunda Venida / Parusía) y desglosa las **7 diferencias estructurales** frente al *Mashíaj* judío.
      (3) **Si compara con Buda (¿Por qué Buda no es el Mashíaj?)**: caracteriza con rigor los 5 ejes de Siddhartha Gautama (*Shakiamuni*) en el Canon Pali (*Ariyapariyesana Sutta* MN 26, *Dhammacakkappavattana Sutta* SN 56.11, *Brahmajala Sutta* DN 1) y **desglosa las 7 razones y diferencias fundamentales** por las que Buda no es ni pretende ser el *Mashíaj* del judaísmo.
      (4) **Si pregunta sobre las Corrientes Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) y la Frontera Teológica donde un grupo se aleja y deja de ser judío (por qué los «Judíos Mesiánicos» NO son judíos sino cristianos evangélicos)**:
          - **Parte I — Pluralidad Legítima Dentro del Judaísmo (*Majloket le-shem Shamayim*, *Eruvín 13b*)**: Explica cómo dentro del judaísmo coexisten distintas corrientes y escuelas que comparten el fundamento innegociable del monoteísmo absoluto (*Shemá Yisrael*, *Deuteronomio 6:4*): (a) **El Jasidismo** fundado por el Baal Shem Tov, incluyendo **Jabad-Lubavitch** (intelectualismo místico *Jojmá-Biná-Daat* en el *Tania* de Rabí Shneur Zalman de Liadi, difusión universal de las *Mitzvot* y preparación del mundo para la redención) y **Breslev** (enseñanzas de Rabí Najman de Breslev en *Likutei Moharán* sobre la alegría constante *Mitzvá Guedolá Lihyot BeSimjá*, la plegaria personal espontánea *Hitbodedut* y hallar los puntos buenos *Azamrá*); (b) **La Ortodoxia** (Sefardí, Ashkenazí, Lituana/Mitnagdí, Movimiento del Musar y Ortodoxia Moderna); y (c) **El Reformismo y el Conservadurismo (*Masortí*)**, los cuales —aun teniendo profundas diferencias halájicas y hermenéuticas con la Ortodoxia respecto a la obligatoriedad ritual de la *Halajá*— **siguen siendo grupos judíos** porque mantienen intacto el monoteísmo incorpóreo del *Shemá* y jamás adoran a Jesús ni aceptan la Trinidad.
          - **Parte II — La Frontera Teológica y Halájica Innegociable (*Ikarei HaEmuná*)**: Señala con rigor objetivo cuándo un movimiento cruza la frontera y **deja de ser un grupo judío**: cuando abandona la Unicidad e Incorporeidad absoluta de Dios (*Yijud Hashem*, *Deuteronomio 6:4*; *Números 23:19*; Maimónides, *Hiljot Yesodei HaTorá 1:7*), introduce la adoración de un ser humano como «Dios Hijo encarnado» (*Avodá Zará* / *Shituf*), sustituye la *Teshuvá* directa (*Ezequiel 18:20*; *Oseas 14:2–3*) por el dogma del pecado original y la expiación vicaria de sangre, o abroga la eternidad de la Torá (*Deuteronomio 13:1–6*).
          - **Parte III — Por Qué los «Judíos Mesiánicos» NO Son Judíos sino Cristianos Evangélicos**: Demuestra teológica, histórica y jurídicamente que el llamado «judaísmo mesiánico» (*Jews for Jesus*, congregaciones mesiánicas) **no es una corriente del judaísmo, sino cristianismo evangélico bautista/pentecostal revestido de símbolos y terminología hebrea** (*Talit*, *Kipá*, *Shofar*, llamar *Yeshúa* a Jesús) como estrategia de proselitismo misionero (por ejemplo, *Jews for Jesus* fue fundado en 1970 por Martin «Moishe» Rosen, ministro ordenado de la Convención Bautista del Sur). Destaca el **consenso pan-judío absoluto** (Jabad, Breslev, Ortodoxia, Conservadores y Reformistas por igual) y los fallos de la Corte Suprema de Israel (*Caso Rufeisen / Hermano Daniel* 1962 y *Caso Beresford* 1989 bajo la Ley del Retorno) que dictaminan unánimemente que los «judíos mesiánicos» pertenecen a otra religión: el cristianismo evangélico.
`;

// ============================================================================
// MOTOR DE BÚSQUEDA Y RECUPERACIÓN DE FUENTES EXTERNAS (FILOSÓFICAS Y CLÁSICAS)
// ============================================================================
const CLASSICAL_EXTERNAL_SOURCES_LIBRARY: Array<{
  id: string;
  matchRegex: RegExp;
  author: string;
  workTitle: string;
  canonicalLocus: string;
  originalLanguage: string;
  originalQuote: string;
  spanishTranslation: string;
  philosophicalThesis: string;
  torahContrastPoint: string;
  sourceUrl: string;
  wikipediaQuery: string;
}> = [
  {
    id: 'kant-grundlegung-universal',
    matchRegex: /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|grundlegung|deontolog[ií]a|autonom[ií]a|heteronom[ií]a)\b/i,
    author: 'Immanuel Kant (1724–1804)',
    workTitle: 'Fundamentación de la metafísica de las costumbres (Grundlegung zur Metaphysik der Sitten)',
    canonicalLocus: 'Akademie-Ausgabe IV, 421 & IV, 432–433',
    originalLanguage: 'Alemán Filosófico',
    originalQuote:
      '«Handle nur nach derjenigen Maxime, durch die du zugleich wollen kannst, dass sie ein allgemeines Gesetz werde.» / «Die Autonomie des Willens ist das alleinige Prinzip aller moralischen Gesetze.»',
    spanishTranslation:
      '«Obra sólo según aquella máxima por la cual puedas querer que al mismo tiempo se convierta en ley universal.» / «La autonomía de la voluntad es el único principio de todas las leyes morales; toda fuente externa es heteronomía.»',
    philosophicalThesis:
      'La obligación moral emana exclusivamente de una fuente interna (autonomía de la razón práctica pura) y exige que toda conclusión ética sea formalmente universalizable sin admitir excepciones contextuales.',
    torahContrastPoint:
      'Las fuentes internas de la Torá (Kidushín 31a «Gadol ha-metzuvé ve-osé» y Deuteronomio 30:14) muestran que la ética requiere una fuente trascendente relacional que quiebre el ego y luego se interiorice en el corazón, mientras que la Halajá exige especificidad situacional (Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Imperativo_categ%C3%B3rico',
    wikipediaQuery: 'Imperativo categórico',
  },
  {
    id: 'kant-menschenliebe-truth',
    matchRegex: /\b(kant|kantian[oa]s?|imperativo\s+categ[oó]rico|universalidad|especificidad)\b/i,
    author: 'Immanuel Kant (1724–1804)',
    workTitle: 'Sobre un presunto derecho de mentir por filantropía (Über ein vermeintes Recht aus Menschenliebe zu lügen)',
    canonicalLocus: 'Berlinische Blätter (1797), Ak. VIII, 425–430',
    originalLanguage: 'Alemán Filosófico',
    originalQuote:
      '«Die Wahrhaftigkeit in Aussagen, die man nicht umgehen kann, ist formale Pflicht des Menschen gegen jeden, es mag ihm oder einem andern daraus auch noch so großer Nachteil erwachsen.»',
    spanishTranslation:
      '«La veracidad en las declaraciones que no se pueden eludir es un deber formal del hombre hacia cualquiera, por muy grande que sea el perjuicio que de ello resulte para él o para otro [incluso ante un asesino que busca a una víctima inocente].»',
    philosophicalThesis:
      'Para Kant, la universalidad formal de la regla prohíbe cualquier excepción específica, incluso cuando decir la verdad entrega una vida inocente a un homicida.',
    torahContrastPoint:
      'Contraste frontal con la especificidad del mandamiento judío: en Yoma 85b («Vivirás por ellos y no morirás por ellos») y Yevamot 65b, salvar la vida humana concreta (Pikuaj Néfesh) y proteger al inocente tienen prioridad absoluta sobre cualquier abstracción formal.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Fundamentaci%C3%B3n_de_la_metaf%C3%ADsica_de_las_costumbres',
    wikipediaQuery: 'Fundamentación de la metafísica de las costumbres',
  },
  {
    id: 'plato-republic-cave-1',
    matchRegex: /\b(plat[oó]n|plat[oó]nic[oa]s?|caverna|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|rep[uú]blica\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas)\b/i,
    author: 'Platón (c. 427–347 a.e.c.)',
    workTitle: 'La República (Politeia / Πολιτεία), Libro VII — Alegoría de la Caverna',
    canonicalLocus: 'República VII, 514a–517c (Stephanus)',
    originalLanguage: 'Griego Clásico',
    originalQuote:
      '«Ἰδὲ γὰρ ἀνθρώπους οἷον ἐν καταγείῳ οἰκήσει σπηλαιώδει... ἐν τῷ γνωστῷ τελευταία ἡ τοῦ ἀγαθοῦ ἰδέα καὶ μόγις ὁράσθαι»',
    spanishTranslation:
      '«Imagina a unos hombres en una habitación subterránea en forma de caverna, encadenados desde niños viendo sólo las sombras proyectadas por el fuego... En el mundo inteligible, lo último que se percibe y con gran esfuerzo es la Idea del Bien universal.»',
    philosophicalThesis:
      'El mundo sensible y material es una caverna de sombras e ilusión particular; la verdad y el bien residen fuera del mundo físico, en la contemplación intelectual de las Ideas universales e inmutables.',
    torahContrastPoint:
      'Mientras Platón propone escapar de la caverna material hacia lo universal abstracto, las fuentes internas de la Torá (Proverbios 6:23 «Ki ner mitzvá ve-Torá or» y Éxodo 24:7 «Naasé ve-nishmá») enseñan que la luz divina se introduce DENTRO de la caverna del mundo físico mediante la especificidad concreta del mandamiento (Mitzvá), santificando la materia (Dirá BeTajtonim).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Alegor%C3%ADa_de_la_caverna',
    wikipediaQuery: 'Alegoría de la caverna',
  },
  {
    id: 'plato-republic-cave-return',
    matchRegex: /\b(plat[oó]n|plat[oó]nic[oa]s?|caverna|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|rep[uú]blica\s+de\s+plat[oó]n|mundo\s+de\s+las\s+ideas)\b/i,
    author: 'Platón (c. 427–347 a.e.c.)',
    workTitle: 'La República (Politeia), Libro VII — El Giro del Alma (Periagogé) y el Retorno del Filósofo',
    canonicalLocus: 'República VII, 518c–520d (Stephanus)',
    originalLanguage: 'Griego Clásico',
    originalQuote:
      '«Καταβατέον οὖν ἐν μέρει ἑκάστῳ εἰς τὴν τῶν ἄλλων συνοίκησιν...»',
    spanishTranslation:
      '«Por consiguiente, cada uno debe descender por turno a la morada común de los demás y acostumbrarse a contemplar las sombras, aunque el alma del filósofo desee permanecer arriba en lo inteligible.»',
    philosophicalThesis:
      'Para Platón, el filósofo liberado no desea volver a la caverna de los asuntos humanos concretos y sólo desciende por coerción política, pues considera la acción terrenal inferior a la teoría pura.',
    torahContrastPoint:
      'En la Torá (Moshé descendiendo del Sinaí con las Tablas en Éxodo 32:15; Pirké Avot 3:17 «Toda persona cuya sabiduría supera sus acciones es como un árbol de pocas raíces»; y el Maharal de Praga en Tiféret Yisrael), el descenso a la acción específica y al prójimo concreto no es una caída lamentable, sino la consumación misma de la sabiduría.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Rep%C3%BAblica_(Plat%C3%B3n)',
    wikipediaQuery: 'República (Platón)',
  },
  {
    id: 'cicero-de-republica-natural-law',
    matchRegex: /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas|recta\s+ratio|lex\s+naturae)\b/i,
    author: 'Marco Tulio Cicerón (106–43 a.e.c.)',
    workTitle: 'De Re Publica (Sobre la República) & De Legibus (Sobre las Leyes)',
    canonicalLocus: 'De Re Publica III, 22.33 / De Legibus I, 6.18',
    originalLanguage: 'Latín Clásico',
    originalQuote:
      '«Est quidem vera lex recta ratio naturae congruens, diffusa in omnes, constans, sempiterna... Nec erit alia lex Romae, alia Athenis, alia nunc, alia posthac, sed et omnes gentes et omni tempore una lex et sempiterna et immutabilis continebit.»',
    spanishTranslation:
      '«Existe, en efecto, una ley verdadera: la recta razón conforme a la naturaleza, difundida en todos, constante, eterna... Y no habrá una ley en Roma y otra en Atenas, una ahora y otra después, sino que una sola ley eterna e inmutable regirá a todas las naciones en todo tiempo.»',
    philosophicalThesis:
      'Cicerón formula la doctrina estoico-romana de la Ley Natural (lex naturae): la fuente de la ley es la razón universal inmanente a la naturaleza (recta ratio), uniforme e idéntica para todos los pueblos sin especificidad histórica ni revelación pactal.',
    torahContrastPoint:
      'Contraste exegético formal: la Torá reconoce una base moral universal para toda la humanidad (las 7 Leyes de Noé en Sanhedrín 56a), pero rechaza que la ética se reduzca a una ley natural uniforme e impersonal; en las fuentes internas de la Torá (Deuteronomio 4:6-8; Miqueas 6:8), el mandamiento nace de un Pacto histórico vivo y se expresa en la especificidad concreta de la Halajá.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Marco_Tulio_Cicer%C3%B3n',
    wikipediaQuery: 'Marco Tulio Cicerón',
  },
  {
    id: 'cicero-de-officiis-duty',
    matchRegex: /\b(cicer[oó]n|tulio\s+cicer[oó]n|de\s+officiis|sobre\s+los\s+deberes|de\s+re\s+publica|de\s+legibus|tusculanas)\b/i,
    author: 'Marco Tulio Cicerón (106–43 a.e.c.)',
    workTitle: 'De Officiis (Sobre los deberes)',
    canonicalLocus: 'De Officiis, Libro I, 7.20–23 & Libro III, 5.21–28',
    originalLanguage: 'Latín Clásico',
    originalQuote:
      '«Fundamentum autem est iustitiae fides, id est dictorum conventorumque constantia et veritas... Sed iustitiae primum munus est, ut ne cui quis noceat, nisi lacessitus iniuria.»',
    spanishTranslation:
      '«El fundamento de la justicia es la buena fe (fides), esto es, la constancia y veracidad en las palabras y acuerdos... Y el primer oficio de la justicia es que nadie dañe a otro, a menos que haya sido provocado por una injusticia, y usar los bienes comunes para lo común y los privados para lo propio.»',
    philosophicalThesis:
      'En De Officiis, Cicerón concibe el deber moral (officium) como decoro cívico, respeto a la propiedad privada, reciprocidad de beneficios entre ciudadanos y armonización entre la honorabilidad (honestum) y la utilidad política (utile).',
    torahContrastPoint:
      'Mientras el officium de Cicerón protege ante todo el orden cívico y la propiedad privada bajo una reciprocidad calculada, la Mitzvá de la Torá (Levítico 19:18; Deuteronomio 15:7-8 y 24:17-18) establece una obligación asimétrica y específica hacia el pobre, la viuda, el huérfano y el extranjero: en el judaísmo la Tzedaká es justicia debida por mandato divino, no mera liberalidad cívica.',
    sourceUrl: 'https://es.wikipedia.org/wiki/De_officiis',
    wikipediaQuery: 'De officiis',
  },
  {
    id: 'aristotle-nicomachean-mean',
    matchRegex: /\b(arist[oó]teles|nic[oó]maco|mes[oó]tes|justo\s+medio\s+aristot[eé]lico)\b/i,
    author: 'Aristóteles (384–322 a.e.c.)',
    workTitle: 'Ética a Nicómaco (Ἠθικὰ Νικομάχεια)',
    canonicalLocus: 'Libro II, cap. 6 (1106b–1107a)',
    originalLanguage: 'Griego Clásico',
    originalQuote:
      '«Ἔστιν ἄρα ἡ ἀρετὴ ἕξις προαιρετική, ἐν μεσότητι οὖσα τῇ πρὸς ἡμᾶς, ὡρισμένῃ λόγῳ...»',
    spanishTranslation:
      '«La virtud es, por tanto, un hábito selectivo que consiste en un término medio (mesótes) relativo a nosotros, determinado por la razón (logos) y por aquello por lo que decidiría el hombre prudente.»',
    philosophicalThesis:
      'La ética aristotélica fundamenta la virtud en la razón prudencial inmanente (phrónesis) y el equilibrio del justo medio con miras a la eudaimonía (felicidad contemplativa y cívica).',
    torahContrastPoint:
      'Maimónides (en Shemoná Perakim cap. 4 y Hiljot Deot caps. 1–2) dialoga con esta fuente externa adoptando el camino medio (Dérej HaEmtzaít) como higiene del carácter, pero lo subordina a las fuentes internas de la Torá: la imitación de los atributos divinos de bondad (Imitatio Dei / «Ve-halajtá bi-derajav», Deuteronomio 28:9) y la exigencia de humildad radical (Pirké Avot 4:4) y Jasidut (Lifnim Mishurat HaDin).',
    sourceUrl: 'https://es.wikipedia.org/wiki/%C3%89tica_nicom%C3%A1quea',
    wikipediaQuery: 'Ética nicomáquea',
  },
  {
    id: 'stoicism-epictetus-enchiridion',
    matchRegex: /\b(estoic(?:ismo|o|os|a)|epicteto|s[eé]neca|marco\s+aurelio|ataraxia|amor\s+fati|apatheia)\b/i,
    author: 'Epicteto (c. 50–135 e.c.) & Marco Aurelio (121–180 e.c.)',
    workTitle: 'Enquiridión (Manual de Epicteto) & Meditaciones',
    canonicalLocus: 'Enquiridión §1 / Meditaciones IV.23',
    originalLanguage: 'Griego Koiné',
    originalQuote:
      '«Τῶν ὄντων τὰ μέν ἐστιν ἐφ᾽ ἡμῖν, τὰ δὲ οὐκ ἐφ᾽ ἡμῖν... Πᾶν μοι συναρμόζει ὃ σοὶ εὐάρμοστόν ἐστιν, ὦ κόσμε.»',
    spanishTranslation:
      '«De las cosas que existen, unas dependen de nosotros y otras no dependen de nosotros... Todo lo que se armoniza contigo, oh Cosmos, se armoniza conmigo (Amor fati).»',
    philosophicalThesis:
      'El estoicismo busca la imperturbabilidad del alma (ataraxia / apatheia) mediante la resignación racional ante el destino cósmico impersonal (Logos / Heimarméne).',
    torahContrastPoint:
      'Frente a la resignación ante un cosmos ciego y la extirpación de las emociones (apatheia), las fuentes internas de la Torá establecen el Bitajón (confianza relacional en un Creador personal), el poder de la Tefilá y la Teshuvá para transformar el decreto, y la obligación de no ser indiferente al sufrimiento del prójimo (Levítico 19:16).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Estoicismo',
    wikipediaQuery: 'Estoicismo',
  },
  {
    id: 'buddhism-dhammapada-bodhi',
    matchRegex: /\b(budismo|budista|buda|bodhi|satori|samadhi|anatta|dhammapada|camino\s+[oó]ctuple|cuatro\s+nobles\s+verdades|iluminaci[oó]n\s+budista)\b/i,
    author: 'Siddhartha Gautama · Canon Pali Budista (Tipitaka)',
    workTitle: 'Dhammapada (Buddhavagga XIV, vv. 179–183 & Maggavagga XX, vv. 277–279) y Samyutta Nikaya 56.11',
    canonicalLocus: 'Dhammapada 183, 277–279 / Dhammacakkappavattana Sutta (SN 56.11)',
    originalLanguage: 'Pali Clásico',
    originalQuote:
      '«Sabbe saṅkhārā aniccā... Sabbe saṅkhārā dukkhā... Sabbe dhammā anattā ti, yadā paññāya passati, atha nibbindati dukkhe; esa maggo visuddhiyā.»',
    spanishTranslation:
      '«Todos los fenómenos condicionados son impermanentes (Anicca)... todos son insatisfactorios (Dukkha)... todos los fenómenos carecen de un yo sustancial (Anatta). Cuando uno ve esto con sabiduría despierta (Bodhi / Prajñā), se desapega del sufrimiento: este es el sendero de la purificación.»',
    philosophicalThesis:
      'En el budismo, la «iluminación» (Bodhi / Satori) es un despertar cognitivo y meditativo inmanente que comprende la inexistencia de un alma o yo permanente (Anatta) y extingue el deseo/apego (Tanha) para liberarse del mundo fenoménico.',
    torahContrastPoint:
      '¿Existe la iluminación en el judaísmo? En las Fuentes Internas de la Torá sí existe una doctrina luminosa profunda, pero de signo inverso: 1) No es extinción del yo (Anatta), sino Devekut (adhesión amorosa a Dios preservando la identidad ética del alma, Deuteronomio 4:4); 2) Es la revelación del Or HaGanuz (la Luz Primordial oculta en la Torá y en las acciones de los justos, Jaguigá 12a y Salmos 36:10 «En Tu luz veremos la luz»); 3) Es Ruaj HaKódesh y Jojmá-Biná-Daat que iluminan el mundo material mediante la especificidad de cada Mitzvá («Ner Mitzvá ve-Torá Or», Proverbios 6:23) en lugar de desapegarse de la historia.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Bodhi',
    wikipediaQuery: 'Bodhi',
  },
  {
    id: 'afterlife-buddhism-nirvana-udana',
    matchRegex: /\b(nirvana|destino\s+de\s+las\s+almas|valhalla|valhala|cielo\s+e\s+infierno|cielo\s+el\s+infierno)\b/i,
    author: 'Canon Pali Budista (Khuddaka Nikaya)',
    workTitle: 'Udāna VIII.1–3 (Pāṭaligāmiya Vagga — Nibbāna Sutta) & Dhammapada XV.204',
    canonicalLocus: 'Udāna 8.1 (PTS 80) / Dhammapada 203–204',
    originalLanguage: 'Pali Clásico',
    originalQuote:
      '«Atthi, bhikkhave, ajātaṃ abhūtaṃ akataṃ asaṅkhataṃ... Nibbānaṃ paramaṃ sukhaṃ.»',
    spanishTranslation:
      '«Existe, oh monjes, lo no-nacido, no-originado, no-creado, no-condicionado (Nibbāna / Nirvana)... La extinción de la sed (Tanha) y del ciclo de renacimientos (Samsara) es la dicha suprema.»',
    philosophicalThesis:
      'Destino del ser en el Budismo (Nirvana) y requisitos de acceso: El Nirvana no es un cielo espacial donde mora un alma individual, sino el apagamiento definitivo de la llama del deseo (Tanha), del karma y de la ilusión del yo (Anatta). Su requisito de acceso es el Noble Camino Óctuple (recta visión, meditación y desapego ascético de todo vínculo mundano).',
    torahContrastPoint:
      'Contraste con el Olam HaBá judío (Mishná Sanhedrín 10:1; Berajot 17a; Pirké Avot 4:16): En el judaísmo, el alma (Neshamá) conserva su identidad personal y relacional ante el Creador («se deleitan en el resplandor de la Shejiná»), y el requisito para acceder al Olam HaBá no es extinguir el deseo ni huir del mundo, sino santificar la vida terrenal mediante la justicia, la bondad y el cumplimiento ético (tanto las 7 Leyes Universales de Noé para los Justos de las Naciones en Rambam Hiljot Teshuvá 3:5 como las 613 Mitzvot para Israel).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Nirvana_(espiritualidad)',
    wikipediaQuery: 'Nirvana (espiritualidad)',
  },
  {
    id: 'afterlife-norse-valhalla-edda',
    matchRegex: /\b(valhalla|valhala|destino\s+de\s+las\s+almas|cielo\s+e\s+infierno|cielo\s+el\s+infierno)\b/i,
    author: 'Tradición Escandinava · Edda Poética & Snorri Sturluson (1179–1241)',
    workTitle: 'Edda Poética (Grímnismál 8–10, 23) & Edda Prosaica (Gylfaginning caps. 38–41)',
    canonicalLocus: 'Grímnismál estrofas 8–10 / Gylfaginning 38–41',
    originalLanguage: 'Nórdico Antiguo (Old Norse)',
    originalQuote:
      '«Glaðsheimr heitir inn fimmti, þar en gullbjarta Valhöll víð of þrumir; en þar Hroptr kýss hverjan dag vápndauða menn.»',
    spanishTranslation:
      '«Gladsheim se llama el quinto recinto, donde el resplandeciente Valhalla (Salón de los Caídos) se extiende majestuoso; allí Odín elige cada día a los hombres muertos por las armas (vápndauða menn).»',
    philosophicalThesis:
      'Destino de las almas en el mito nórdico (Valhalla vs. Hel) y requisitos de acceso: El acceso al Valhalla está reservado exclusivamente a la aristocracia guerrera que muere de forma violenta en el campo de batalla con las armas en la mano (Einherjar), elegida por Odín y las Valquirias para entrenar luchando cada día hasta la batalla final del Ragnarök; quienes mueren en paz, de vejez o enfermedad van al sombrío reino de Hel.',
    torahContrastPoint:
      'Contraste ético y exegético radical con las Fuentes Internas de la Torá: Mientras el Valhalla exige como requisito la muerte violenta por la espada y concibe el más allá como guerra perpetua, la Torá aborrece el derramamiento de sangre (Génesis 9:6; I Crónicas 22:8, donde David no puede edificar el Templo por haber derramado sangre en guerras). En el judaísmo, la meta es transformar las espadas en arados (Isaías 2:4), y el requisito para entrar al Olam HaBá es salvar y honrar la vida (Pikuaj Néfesh, Yoma 85b), buscar la paz (Salmos 34:15) y practicar la justicia y la compasión (Miqueas 6:8).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Valhalla',
    wikipediaQuery: 'Valhalla',
  },
  {
    id: 'afterlife-eschatology-heaven-hell-contrast',
    matchRegex: /\b(cielo\s+e\s+infierno|cielo\s+el\s+infierno|destino\s+de\s+las\s+almas|valhalla|valhala|nirvana)\b/i,
    author: 'Escatología Comparada de las Religiones y Filosofía Clásica (Platón, Fedón 107d–114c / Escatologías Dogmáticas)',
    workTitle: 'Fedón (El destino del alma tras la muerte) & Doctrinas Comparadas de Cielo e Infierno Eterno',
    canonicalLocus: 'Platón, Fedón 107d–114c; República X, 614b–621d (Mito de Er)',
    originalLanguage: 'Griego Clásico / Historia de las Religiones',
    originalQuote:
      '«Ἀθάνατον ἄρα ἡ ψυχή... οἱ δ᾽ ἂν δόξωσιν ἀνιάτως ἔχειν διὰ τὰ μεγέθη τῶν ἁμαρτημάτων... εἰς τὸν Τάρταρον ἐμβάλλει, ὅθεν οὔποτε ἐκβαίνουσιν.»',
    spanishTranslation:
      '«El alma es inmortal... y aquellos que parecen ser incurables por la magnitud de sus faltas son arrojados por el destino al Tártaro (Infierno perpetuo), de donde jamás salen; mientras que quienes vivieron en pureza filosófica ascienden a las moradas celestes.»',
    philosophicalThesis:
      'En las escatologías dualistas y dogmáticas externas, el destino post-mortem se divide tajantemente entre un Cielo reservado a los iniciados o creyentes de un dogma exclusivo y un Infierno (Tártaro) de castigo eterno e irreversible para los demás.',
    torahContrastPoint:
      'Doble contraste con el Olam HaBá judío: 1) Universalidad inclusiva de acceso: En el judaísmo NO se requiere pertenecer al pueblo judío para acceder al Olam HaBá; según el Talmud (Sanhedrín 105a) y Maimónides (Hiljot Teshuvá 3:5; Hiljot Melajim 8:11), «los justos de todas las naciones (Jasidei Umot HaOlam) tienen parte en el Mundo Venidero» por sus obras éticas universales (7 Leyes de Noé), mientras Israel es evaluado según la especificidad de las 613 Mitzvot y la Teshuvá (Mishná Sanhedrín 10:1). 2) Ausencia de condenación eterna: En el Talmud (Shabat 33b; Eduyot 2:10; Rosh Hashaná 17a), el Guehinóm no es un infierno eterno, sino un crisol pedagógico y purificador temporal (máximo 12 meses) para rehabilitar al alma.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Olam_Haba',
    wikipediaQuery: 'Olam Haba',
  },
  {
    id: 'christian-christology-nicea-chalcedon-soteriology',
    matchRegex: /\b(mash[ií]aj|mashiach|mes[ií]as|cristian(?:ismo|o|a|os|as)?|jes[uú]s|cristo|nicea|calcedonia|encarnaci[oó]n|trinidad|segunda\s+venida|parus[ií]a|pecado\s+original|expiaci[oó]n\s+vicaria)\b/i,
    author: 'Cristología Conciliar (Nicea 325 e.c. / Calcedonia 451 e.c.) y Soteriología Paulina',
    workTitle: 'Símbolo Niceno-Constantinopolitano, Definición de Calcedonia y Corpus Soteriológico Cristiano',
    canonicalLocus: 'Concilio de Nicea (325 e.c.) · Concilio de Calcedonia (451 e.c.) · Soteriología del Pecado Original y la Parusía',
    originalLanguage: 'Griego Eclesiástico y Latín Patrístico',
    originalQuote:
      '«Εἰς ἕνα Κύριον Ἰησοῦν Χριστόν, τὸν Υἱὸν τοῦ Θεοῦ τὸν μονογενῆ... ὁμοούσιον τῷ Πατρί... σαρκωθέντα... καὶ πάλιν ἐρχόμενον μετὰ δόξης.»',
    spanishTranslation:
      '«En un solo Señor Jesucristo, el Hijo único de Dios... consustancial (homoousios) al Padre... que por nosotros los hombres y por nuestra salvación bajó del cielo y se encarnó... fue crucificado... y de nuevo vendrá con gloria (Segunda Venida / Parusía).»',
    philosophicalThesis:
      'Caracterización del Mesías en el Cristianismo (5 ejes dogmáticos): 1) Ontología divino-humana: el Mesías es Dios Hijo encarnado (segunda persona de la Trinidad, unión hipostática de dos naturalezas); 2) Pecado original hereditario: la humanidad nace caída por el pecado de Adán e incapaz de redimirse por sus obras; 3) Expiación vicaria de sangre: el Mesías muere crucificado como sacrificio vicario para pagar la culpa humana; 4) Abrogación de la Ley mosaica: los preceptos prácticos de la Torá (Mitzvot) quedan superados por la fe dogmática en la gracia; y 5) Doctrina de las «Dos Venidas» (Parusía): como las profecías de paz mundial no se cumplieron en su primera venida, se postergan a un segundo retorno escatológico.',
    torahContrastPoint:
      'Desglose de diferencias frente al Mashíaj del Judaísmo: 1) Monoteísmo incorpóreo absoluto (Deuteronomio 6:4; Números 23:19; Oseas 11:9): Dios jamás se encarna en hombre, y el Mashíaj judío es un líder y rey 100% humano mortal nacido de padre y madre humanos; 2) Linaje patrilineal de David y Salomón (2 Samuel 7:12–16; 1 Crónicas 22:9–10; Números 1:18), incompatible con la concepción virginal sin padre humano; 3) Responsabilidad moral individual y Teshuvá directa sin pecado original ni sacrificio vicario (Ezequiel 18:20–23; Oseas 14:2–3; Deuteronomio 12:31); 4) Eternidad irrevocable de las Mitzvot de la Torá (Deuteronomio 13:1–5; Éxodo 31:16); y 5) Cumplimiento íntegro en una sola vida sin «Segunda Venida» (Maimónides, Hiljot Melajim 11:1–4).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Cristolog%C3%ADa',
    wikipediaQuery: 'Cristología',
  },
  {
    id: 'barcelona-disputation-1263-ramban-maimonides',
    matchRegex: /\b(mash[ií]aj|mashiach|mes[ií]as|cristian(?:ismo|o|a|os|as)?|disputa\s+de\s+barcelona|vikuaj|ramb[aá]n|najm[aá]nides|hiljot\s+melajim|diferencias?|caracterizar|desglosar)\b/i,
    author: 'Rabí Moshé ben Najmán (Rambán / Najmánides, 1194–1270) y Rabí Moshé ben Maimón (Rambam / Maimónides, 1138–1204)',
    workTitle: 'Vikuaj ha-Rambán (La Disputa de Barcelona ante el Rey Jaime I de Aragón, 1263) & Mishné Torá, Hiljot Melajim caps. 11–12',
    canonicalLocus: 'Vikuaj ha-Rambán §§42–49 (julio de 1263) · Hiljot Melajim 11:1–4',
    originalLanguage: 'Hebreo Rabínico Medieval',
    originalQuote:
      '«וְאִם לֹא הִצְלִיחַ עַד כֹּה אוֹ נֶהֱרַג, בְּיָדוּעַ שֶׁאֵינוֹ זֶה שֶׁהִבְטִיחָה עָלָיו תּוֹרָה... מִימוֹת יֵשׁוּ וְעַד הֵנָּה הָעוֹלָם כֻּלּוֹ מָלֵא חָמָס וָשֹׁד.»',
    spanishTranslation:
      '«Y si no tuvo éxito hasta este punto [reconstruir el Templo y reunir a los dispersos de Israel] o fue muerto, queda demostrado con certeza que él no es aquel que la Torá prometió» (Rambam, Hiljot Melajim 11:4) · «Desde aquellos días hasta hoy el mundo entero sigue lleno de violencia y rapiña... mas el profeta dice que en días del Mashíaj no alzará espada nación contra nación ni se adiestrarán más para la guerra (Isaías 2:4)» (Rambán, Disputa de Barcelona, 1263).',
    philosophicalThesis:
      'En la Disputa de Barcelona de 1263, Najmánides demuestra ante el Rey Jaime I que la diferencia medular entre el judaísmo y el cristianismo radica en la verificación empírica e histórica de la redención: el cristianismo espiritualiza e interioriza las profecías porque el mundo físico siguió en guerra, mientras que el judaísmo exige hechos públicos e históricos verificables.',
    torahContrastPoint:
      'Para la Torá, la Era Mesiánica no es un dogma de fe invisible para salvar almas del infierno, sino la transformación real del escenario histórico (Olam HaZé): abolición mundial de la guerra (Isaías 2:4), retorno físico de los exiliados de Israel (Kibutz Galuyot), restauración de la soberanía davídica y plenitud universal del conocimiento de Hashem (Isaías 11:9).',
    sourceUrl: 'https://es.wikipedia.org/wiki/Disputa_de_Barcelona',
    wikipediaQuery: 'Disputa de Barcelona',
  },
  {
    id: 'buddha-mahabhinishkramana-mashiaj-contrast',
    matchRegex: /\b(buda|budismo|budista|siddhartha|gautama|shakiamuni|shakyamuni|shakya)\b/i,
    author: 'Siddhartha Gautama (el Buda Shakiamuni, c. 563–483 a.e.c.) · Canon Pali (Sutta Pitaka)',
    workTitle: 'Ariyapariyesana Sutta (MN 26 — La Gran Renuncia), Dhammacakkappavattana Sutta (SN 56.11) y Brahmajāla Sutta (DN 1)',
    canonicalLocus: 'Majjhima Nikaya 26 · Samyutta Nikaya 56.11 · Digha Nikaya 1',
    originalLanguage: 'Pali Clásico',
    originalQuote:
      '«Agārasmā anagāriyaṃ pabbajiṃ... Nibbānaṃyeva anuttaraṃ yogakkhemaṃ pariyesamāno... Sabbe dhammā anattā.»',
    spanishTranslation:
      '«Abandoné el hogar y el palacio real para salir a la vida sin hogar como asceta errante (La Gran Renuncia / Mahabhinishkramana), buscando la suprema extinción de las ataduras, el Nibbāna (Nirvana)... Todos los fenómenos carecen de un yo o alma sustancial (Anatta).»',
    philosophicalThesis:
      'Caracterización de Siddhartha Gautama (el Buda) en 5 ejes: 1) La Gran Renuncia al Trono: príncipe del clan Shakya (casta Kshatriya en la India/Nepal) que abdica de la realeza, abandona su palacio y se retira de la acción política; 2) Marco No-Teísta: niega la existencia de un Dios Creador personal (Ishvara) y de una Revelación divina; 3) Visión del mundo como Dukkha y Samsara: la existencia física e histórica es insatisfacción y dolor; 4) Doctrina de Anatta: inexistencia de un alma individual permanente; y 5) Meta del Nirvana / Parinirvana: extinción individual del deseo (Tanha) para salir definitivamente del ciclo del mundo.',
    torahContrastPoint:
      'Desglose de las 7 diferencias por las que Buda no es el Mashíaj del Judaísmo: 1) Teología: el Mashíaj sirve al Dios Creador Único (Deuteronomio 6:4; Isaías 11:2, 9), mientras Buda postula un camino no-teísta; 2) Dirección del liderazgo: Buda renuncia al trono real para huir del mundo político, mientras el Mashíaj asume el trono de David para gobernar el mundo con justicia social (Mishpat y Tzedaká, Isaías 11:4; Hiljot Melajim 11:1); 3) Genealogía e Historia: el Mashíaj es descendiente patrilineal biológico del Rey David y Salomón en Jerusalén (2 Samuel 7:12–16; 1 Crónicas 22:9–10), no un príncipe del clan Shakya ajeno al Pacto de Israel; 4) Valoración de la Creación: la Torá afirma que el mundo físico es «muy bueno» (Génesis 1:31) y debe santificarse (Dirá BeTajtonim), no abandonarse como Samsara; 5) Mandamiento (Mitzvá): el Mashíaj restaura las 613 Mitzvot y las 7 Leyes de Noé (Hiljot Melajim 11:1–4), frente al ascetismo monástico célibe (Sangha); 6) Verificación Histórica: tras la muerte de Buda (c. 483 a.e.c.) las guerras no cesaron (Isaías 2:4), Israel no fue reunido (Kibutz Galuyot) ni se reconstruyó el Templo; y 7) Escatología: eternidad personal del alma (Neshamá) y Resurrección (Sanhedrín 90a) frente a Anatta y extinción en el Parinirvana.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Buda_Gautama',
    wikipediaQuery: 'Buda Gautama',
  },
  {
    id: 'messianic-evangelical-syncretism-vs-jewish-currents',
    matchRegex:
      /\b(jud[ií]os?\s+mesi[aá]nicos?|juda[ií]smo\s+mesi[aá]nico|jews\s+for\s+jesus|evang[eé]licos?\s+cristianos?|jasidismo|jabad|lubavitch|breslev|breslov|reformistas?|deja\s+de\s+ser\s+(?:un\s+)?grupo\s+jud[ií]o)\b/i,
    author:
      'Historia de las Misiones Evangélicas (Martin «Moishe» Rosen, Jews for Jesus, 1970; Alianza de Judíos Mesiánicos) y Jurisprudencia de la Corte Suprema de Israel (Casos Rufeisen 1962 y Beresford 1989)',
    workTitle:
      'Declaración de Fe del Movimiento Mesiánico Evangélico (Trinidad, Encarnación y Expiación Vicaria) frente al Consenso Pan-Judío y Fallos de la Corte Suprema de Israel (HCJ 72/62 & HCJ 265/87)',
    canonicalLocus:
      'Convención Bautista del Sur / Jews for Jesus (1970) · HCJ 72/62 Rufeisen v. Minister of the Interior (1962) · HCJ 265/87 Beresford v. Minister of the Interior (1989)',
    originalLanguage: 'Inglés Teológico Evangélico y Hebreo Jurídico Contemporáneo',
    originalQuote:
      '«We believe in the Triune God: Father, Son (Yeshua HaMashiach, God incarnate), and Holy Spirit, and in salvation solely through His atoning blood.» / «אדם המאמין בישוע כמשיח וכאל אינו נמנה עם הדת היהודית אלא עם הדת הנוצרית» (Corte Suprema de Israel, Caso Beresford, 1989).',
    spanishTranslation:
      '«Creemos en el Dios Trino: Padre, Hijo (Yeshúa, Dios encarnado) y Espíritu Santo, y en la salvación únicamente por su sangre expiatoria» (Credo de las congregaciones mesiánicas y Jews for Jesus) · «Quien cree en Jesús como Mesías y Dios encarnado no pertenece a la religión judía, sino a la religión cristiana, aunque utilice símbolos judíos» (Corte Suprema de Israel, Caso Beresford, 1989).',
    philosophicalThesis:
      'Origen y naturaleza del «judaísmo mesiánico»: Surgido de misiones protestantes y bautistas en los siglos XIX y XX (como la Hebrew Christian Alliance de 1915 y Jews for Jesus, fundado en 1970 por Martin «Moishe» Rosen, ministro ordenado de la Convención Bautista del Sur), adopta una teología 100% cristiana evangélica (Trinidad nicena, divinidad de Jesús, pecado original, salvación por sangre vicaria y Nuevo Testamento) pero reviste su culto con terminología hebrea y símbolos litúrgicos judíos (Talit, Kipá, Shofar, calendario de fiestas) como método misionero de contextualización.',
    torahContrastPoint:
      'Demarcación entre las corrientes legítimas del judaísmo y la ruptura teológica: 1) Dentro del judaísmo existen diversas corrientes —el Jasidismo en sus escuelas como Jabad-Lubavitch (Tania del Alter Rebe, intelecto místico Jojmá-Biná-Daat y difusión de las Mitzvot) y Breslev (Rabí Najman de Breslev, alegría constante y Hitbodedut), la Ortodoxia (Sefardí, Ashkenazí, Lituana, Musar) y los movimientos modernos como el Reformismo y el Conservadurismo—, y todas ellas permanecen dentro del judaísmo porque sostienen sin fisuras el monoteísmo incorpóreo del Shemá Yisrael (Deuteronomio 6:4; Números 23:19) y rechazan adorar a cualquier ser humano; 2) En cambio, los «judíos mesiánicos» cruzan la frontera teológica de la Torá (Deuteronomio 13:1–6; Maimónides, Hiljot Yesodei HaTorá 1:7 y Hiljot Avodá Zará 2:4; Ezequiel 18:20) y por consenso unánime de todas las corrientes judías son cristianos evangélicos, no un grupo judío.',
    sourceUrl: 'https://es.wikipedia.org/wiki/Juda%C3%ADsmo_mesi%C3%A1nico',
    wikipediaQuery: 'Judaísmo mesiánico',
  },
];

// Live External Source Retriever: combines the curated Classical Philosophical Library with live parallel queries to Wikipedia/MediaWiki REST & Search APIs
export async function fetchExternalComparativeSources(rawQuery: string): Promise<any[]> {
  const {
    normalizedQuery: query,
    isComparativeTopic,
    isMashiajTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
  } = normalizeUserStudyQuery(rawQuery);

  if (!isComparativeTopic && !isMashiajTopic) {
    return [];
  }

  const cacheKey = query.toLowerCase();
  const cached = externalSourcesCache.get(cacheKey);
  if (cached) return cached;

  // 1. Match primary sources from our curated classical library ONLY when explicitly mentioned in the query
  const matchedLibrary = CLASSICAL_EXTERNAL_SOURCES_LIBRARY.filter((item) =>
    item.matchRegex.test(query)
  );

  // Never inject Kant, Plato, or Cicero by default when no external philosopher was mentioned in the query
  const selectedClassical = matchedLibrary;

  const results: any[] = selectedClassical.map((item) => ({
    id: item.id,
    author: item.author,
    workTitle: item.workTitle,
    canonicalLocus: item.canonicalLocus,
    originalLanguage: item.originalLanguage,
    originalQuote: item.originalQuote,
    spanishTranslation: item.spanishTranslation,
    philosophicalThesis: item.philosophicalThesis,
    torahContrastPoint: item.torahContrastPoint,
    sourceUrl: item.sourceUrl,
    retrievedVia: 'Corpus Filosófico Clásico Verificado + Búsqueda Externa',
  }));

  // 2. Determine search topics to query live from external Wikipedia / MediaWiki API
  const wikiTopicsToFetch = new Set<string>();
  selectedClassical.forEach((item) => wikiTopicsToFetch.add(item.wikipediaQuery));

  if (isAfterlifeSoulDestinyTopic) {
    wikiTopicsToFetch.add('Olam Haba');
    wikiTopicsToFetch.add('Nirvana (espiritualidad)');
    wikiTopicsToFetch.add('Valhalla');
  }
  if (isEnlightenmentBuddhismTopic) {
    wikiTopicsToFetch.add('Bodhi');
    wikiTopicsToFetch.add('Iluminación (creencia)');
  }
  if (isPlatoCaveTopic) {
    wikiTopicsToFetch.add('Alegoría de la caverna');
  }
  if (isCiceroTopic) {
    wikiTopicsToFetch.add('Marco Tulio Cicerón');
    wikiTopicsToFetch.add('De officiis');
  }
  if (isKantTopic) {
    wikiTopicsToFetch.add('Imperativo categórico');
  }

  // Also detect any other external philosopher mentioned in the query (e.g., Spinoza, Descartes, Nietzsche, Sócrates, Filón)
  const extraThinkerMatch = query.match(
    /\b(Spinoza|Descartes|Nietzsche|S[oó]crates|Fil[oó]n|Levinas|Hermann\s+Cohen|Rosenzweig|Maquiavelo|Hobbes|Locke|Rousseau|Hume|Hegel|Kierkegaard|Camus|Sartre|Buda|Confucio|Laozi)\b/i
  );
  if (extraThinkerMatch) {
    wikiTopicsToFetch.add(extraThinkerMatch[1]);
  }

  const wikiTopicsArray = Array.from(wikiTopicsToFetch).slice(0, 3);

  try {
    const liveExtracts = await Promise.all(
      wikiTopicsArray.map(async (topicTitle) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        try {
          const encodedTitle = encodeURIComponent(topicTitle.replace(/\s+/g, '_'));
          const summaryRes = await fetch(
            `https://es.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`,
            {
              signal: controller.signal,
              headers: {
                Accept: 'application/json',
                'User-Agent': 'DarshanAI/1.0 (Comparative-Exegesis-Engine)',
              },
            }
          );
          if (!summaryRes.ok) return null;
          const summaryData: any = await summaryRes.json();
          if (!summaryData?.extract) return null;
          return {
            topicTitle,
            title: summaryData.title || topicTitle,
            extract: String(summaryData.extract).slice(0, 520),
            url:
              summaryData.content_urls?.desktop?.page ||
              `https://es.wikipedia.org/wiki/${encodedTitle}`,
          };
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      })
    );

    for (const liveItem of liveExtracts) {
      if (!liveItem) continue;
      const existingIdx = results.findIndex(
        (r) =>
          r.sourceUrl.toLowerCase() === liveItem.url.toLowerCase() ||
          r.workTitle.toLowerCase().includes(liveItem.title.toLowerCase())
      );
      if (existingIdx >= 0) {
        results[existingIdx].retrievedVia =
          'Corpus Clásico + Consulta Externa en Vivo (Wikipedia REST API)';
        if (!results[existingIdx].philosophicalThesis.includes(liveItem.extract.slice(0, 45))) {
          results[existingIdx].philosophicalThesis = `${results[existingIdx].philosophicalThesis} [Contexto documental externo: ${liveItem.extract}]`;
        }
      } else {
        results.push({
          id: `live-ext-${liveItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          author: `Fuente Documental Externa · ${liveItem.title}`,
          workTitle: `Consulta Enciclopédica y Filosófica Externa: ${liveItem.title}`,
          canonicalLocus: 'Fuente Externa Verificada en Tiempo Real',
          originalLanguage: 'Síntesis Documental Externa',
          originalQuote: liveItem.extract,
          spanishTranslation: liveItem.extract,
          philosophicalThesis: `Síntesis recuperada de fuentes externas sobre ${liveItem.title} para informar el análisis comparativo.`,
          torahContrastPoint:
            'Se analiza en contraste con las fuentes internas de la Torá (Eijá Rabá 2:13: «Jojmá ba-Goyim taamín» — distinguir entre sabiduría filosófica externa y la Revelación específica del mandamiento en la Torá).',
          sourceUrl: liveItem.url,
          retrievedVia: 'Consulta Externa en Vivo (Wikipedia REST API)',
        });
      }
    }
  } catch {
    // Keep classical library results if live network call times out
  }

  setBoundedCache(externalSourcesCache, cacheKey, results, 80);
  return results;
}

// Formal Exegetical Contrast Builder: always analyzes (1) Universality vs. Specificity of the Commandment and (2) Internal Sources of the Torah vs. External Sources
export function buildDefaultFormalExegeticalContrast(
  rawQuery: string,
  externalSources: any[] = []
): any | undefined {
  const {
    isComparativeTopic,
    isMashiajTopic,
    isMashiajChristianContrastTopic,
    isMashiajBuddhaContrastTopic,
    isJewishMovementsAndMessianicBoundaryTopic,
    isKantTopic,
    isPlatoCaveTopic,
    isCiceroTopic,
    isEnlightenmentBuddhismTopic,
    isAfterlifeSoulDestinyTopic,
  } = normalizeUserStudyQuery(rawQuery);

  if (!isComparativeTopic && !isMashiajTopic && externalSources.length === 0) {
    return undefined;
  }

  if (isJewishMovementsAndMessianicBoundaryTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Corrientes Internas del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Conservadurismo y Reformismo) frente a la Frontera Teológica donde un grupo deja de ser judío: Por qué los «Judíos Mesiánicos» son Cristianos Evangélicos',
      thesisSummary:
        'Análisis teológico, halájico e histórico en tres partes: (1) La pluralidad legítima dentro del judaísmo (Majloket le-shem Shamayim en Eruvín 13b: el Jasidismo de Jabad-Lubavitch y Breslev, la Ortodoxia Sefardí y Ashkenazí, y movimientos modernos como el Reformismo y el Conservadurismo, todos unidos por el monoteísmo incorpóreo del Shemá Yisrael); (2) La frontera teológica y halájica objetiva donde un grupo se aleja y deja de ser judío (Deuteronomio 6:4; Números 23:19; Deuteronomio 13:1–6; los 13 Principios de Fe de Maimónides en Sanhedrín 90a y Hiljot Yesodei HaTorá 1:7); y (3) La demostración de por qué los «judíos mesiánicos» (Jews for Jesus, congregaciones mesiánicas) NO son una corriente judía, sino grupos cristianos evangélicos bautistas/pentecostales que emplean símbolos hebreos con fines misioneros.',
      universalidadVsEspecificidad: {
        title:
          'I. Corrientes Legítimas Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) frente a la Ruptura Teológica del Movimiento Mesiánico Evangélico',
        externalUniversalism:
          'EL SINCRETISMO MISIONERO DE LOS «JUDÍOS MESIÁNICOS» (CRISTIANISMO EVANGÉLICO): 1) Teología Trinitaria y Encarnacionista: profesan exactamente los dogmas del cristianismo evangélico (la Trinidad, la divinidad de Jesús/Yeshúa como «Dios Hijo encarnado», el pecado original hereditario y la salvación por la sangre de la cruz); 2) Instrumentalización de Símbolos Específicos: adoptan elementos externos de la especificidad ritual judía (Talit, Kipá, Shofar, vocabulario hebreo) no como cumplimiento del Pacto del Sinaí, sino como estrategia de contextualización misionera fundada por juntas bautistas y evangélicas (como Jews for Jesus, fundado en 1970 por el pastor bautista Martin «Moishe» Rosen); y 3) Abrogación de la Halajá y de la Teshuvá directa: sostienen que las Mitzvot no tienen valor redentor y que solo la fe cristológica salva.',
        torahUniversalDimension:
          'EL ESPECTRO LEGÍTIMO DENTRO DEL JUDAÍSMO Y SU UNIVERSALIDAD ÉTICA: Dentro del judaísmo coexisten corrientes diversas —el Jasidismo con escuelas como Jabad-Lubavitch (el intelecto místico Jojmá-Biná-Daat en el Tania del Alter Rebe) y Breslev (Rabí Najman de Breslev: alegría constante, Hitbodedut y hallar los puntos buenos), la Ortodoxia (Sefardí, Ashkenazí, Lituana, Musar) y los movimientos modernos como el Reformismo y el Conservadurismo (Masortí)—. Pese a sus debates internos («Elu ve-elu divrei Elohim jayim», Eruvín 13b), TODAS estas corrientes permanecen dentro del judaísmo porque sostienen la Unicidad e Incorporeidad absoluta de Hashem (Shemá Yisrael, Deuteronomio 6:4; Números 23:19), al tiempo que honran a todas las naciones mediante las 7 Leyes Universales de Noé (Sanhedrín 56a; Hiljot Teshuvá 3:5).',
        torahCommandmentSpecificity:
          'LA FRONTERA ESPECÍFICA DONDE UN GRUPO DEJA DE SER JUDÍO: En la Especificidad del Mandamiento (Deuteronomio 6:4; Deuteronomio 13:1–6; Maimónides, Hiljot Yesodei HaTorá 1:7), la Torá prohíbe de modo absoluto atribuir divinidad a un ser humano o introducir un mediador entre el alma y Hashem. Cuando un grupo adora a Jesús como Dios encarnado y salvador vicario, cruza la frontera hacia otra religión (el cristianismo evangélico), por más que utilice Kipá, Talit o términos en hebreo.',
        exegeticalSynthesis:
          'Un judío Reformista, un jasid de Jabad, un jasid de Breslev y un judío Ortodoxo Lituano o Sefardí rezan al mismo Único Creador incorpóreo del Shemá Yisrael; en cambio, el movimiento «mesiánico» adora a la Trinidad cristiana bajo ropaje hebreo.',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Consenso Pan-Judío y Jurisprudencia de la Corte Suprema de Israel (Casos Rufeisen 1962 y Beresford 1989)',
        internalTorahSourcesNature:
          'Fuentes Internas de la Torá y Consenso de Todas las Corrientes Judías: Torá Escrita (Deuteronomio 6:4; 13:1–6; Números 23:19; Ezequiel 18:20), Talmud Bavli (Eruvín 13b; Sanhedrín 90a), Maimónides (Hiljot Yesodei HaTorá cap. 1; Hiljot Melajim caps. 11–12), el Tania de Jabad, Likutei Moharán de Breslev y las resoluciones conjuntas del Rabinato Ortodoxo, el Movimiento Masortí/Conservador y la Unión para el Judaísmo Reformista (CCAR).',
        externalSourcesNature:
          'Fuentes Documentales e Históricas Externas: 1) Documentos fundacionales de la Hebrew Christian Alliance (1915), la Messianic Jewish Alliance of America (MJAA, que cambió su nombre en 1975 por estrategia misionera) y Jews for Jesus (fundado en 1970 por el ministro bautista ordenado Martin «Moishe» Rosen); y 2) Fallos históricos de la Corte Suprema del Estado de Israel en HCJ 72/62 (Oswald Rufeisen, 1962) y HCJ 265/87 (Beresford v. Ministerio del Interior, 1989).',
        normativeLocusContrast:
          'Existe unanimidad total en el mundo judío —desde el jasidismo de Jabad y Breslev hasta el judaísmo Reformista, además de la Corte Suprema de Israel (Caso Beresford, 1989)— en que los «judíos mesiánicos» son cristianos evangélicos y no constituyen una denominación judía.',
        hermeneuticalRule:
          'La identidad religiosa de un grupo se define por su teología fundamental (Monoteísmo incorpóreo de Hashem vs. Cristología trinitaria evangélica), nunca por el uso cosmético o misionero de símbolos litúrgicos hebreos.',
      },
    };
  }

  if (isMashiajBuddhaContrastTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Caracterización de Siddhartha Gautama, el Buda Shakiamuni (Canon Pali: Ariyapariyesana Sutta MN 26, Dhammacakkappavattana Sutta SN 56.11 y Brahmajāla Sutta DN 1) frente al Mashíaj del Judaísmo (Isaías 2:4; 11:1–9; Maimónides, Hiljot Melajim caps. 11–12)',
      thesisSummary:
        'Estudio exegético y comparativo en tres partes: (1) qué es el Mashíaj en el judaísmo, (2) caracterización filosófica y biográfica de Siddhartha Gautama (el Buda) en el Canon Pali (la Gran Renuncia al trono, el no-teísmo, Dukkha/Samsara, Anatta y el Nirvana), y (3) desglose sistemático de las 7 diferencias estructurales que explican por qué Buda no es ni pretende ser el Mashíaj de la tradición judía.',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad del Desapego Monástico (Nirvana) frente a la Universalidad Histórica y Especificidad del Mandamiento en el Mashíaj (Isaías 2:4 y Hiljot Melajim 11:1–4)',
        externalUniversalism:
          'En el Canon Pali budista (Ariyapariyesana Sutta MN 26 y Dhammacakkappavattana Sutta SN 56.11), Siddhartha Gautama protagoniza la «Gran Renuncia» (Mahabhinishkramana): siendo príncipe heredero del clan Shakya, abdica de su trono real, abandona su palacio, su esposa y su hijo, y se retira de la vida política y social porque considera que todo vínculo mundano y toda acción histórica están atrapados en el sufrimiento (Dukkha) y en la rueda de renacimientos (Samsara). Su vía universal (el Noble Camino Óctuple) busca extinguir la sed del deseo (Tanha) y disolver la ilusión del yo individual (Anatta) en el Nirvana.',
        torahUniversalDimension:
          'En contraste diametral, el Mashíaj del judaísmo no huye del palacio hacia el bosque, sino que asume la responsabilidad pública del trono del Rey David para redimir la historia humana desde adentro: en el plano universal, guía a todas las naciones a reconocer al único Creador («la tierra estará llena del conocimiento del Eterno como las aguas cubren el mar», Isaías 11:9), a erradicar la guerra y el armamento («convertirán sus espadas en rejas de arado», Isaías 2:4) y a vivir éticamente bajo las Siete Leyes Universales de Noé (Rambam, Hiljot Melajim 8:11).',
        torahCommandmentSpecificity:
          'En el plano de la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá), como codifica Maimónides en Hiljot Melajim 11:1–4, el Mashíaj judío restaura la observancia íntegra de las 613 Mitzvot de la Torá escrita y oral (que santifican el matrimonio, la familia, la agricultura, los tribunales de justicia civil y el Beit HaMikdash en Jerusalén) y reúne físicamente a los exiliados de Israel (Kibutz Galuyot).',
        exegeticalSynthesis:
          'La diferencia es geométricamente exacta: Siddhartha Gautama es un príncipe que renuncia a ser rey para enseñar cómo escapar individualmente del mundo (Nirvana); el Mashíaj judío es el descendiente de David ungido para asumir el reinado justo y transformar colectivamente el mundo físico en una morada de paz y justicia divina (Tikún Olam y Dirá BeTajtonim).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Caracterización de Buda (Fuentes Externas del Canon Pali) y Desglose Sistemático de las 7 Diferencias con el Mashíaj del Judaísmo (Fuentes Internas de la Torá)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá —Génesis 1:31 («Y vio Dios todo lo que había hecho, y he aquí que era muy bueno»), Deuteronomio 6:4 y 30:1–6, 2 Samuel 7:12–16, 1 Crónicas 22:9–10, Isaías 2:1–4 y 11:1–12, Talmud Bavli Sanhedrín 90a y 98a, Berajot 34b y Maimónides en Hiljot Melajim caps. 11–12— conciben la redención dentro del monoteísmo creador, la bondad intrínseca del mundo material y la fidelidad histórica al Pacto de Israel.',
        externalSourcesNature:
          'Las Fuentes Externas del Canon Pali (Majjhima Nikaya 26, Samyutta Nikaya 56.11, Digha Nikaya 1 y Dhammapada 277–279), evaluadas según Eijá Rabá 2:13 («Jojmá ba-Goyim taamín»), caracterizan a Siddhartha Gautama como un sabio contemplativo y reformador ascético (Sramana) del siglo VI–V a.e.c. en la India que opera en un marco estrictamente no-teísta y ahistórico.',
        normativeLocusContrast:
          'Desglose de las 7 Razones y Diferencias por las que Buda no es el Mashíaj: (1) Teología: Monoteísmo Creador y relacional (Deuteronomio 6:4; Isaías 11:2) vs. No-teísmo budista que niega a un Dios Creador (Brahmajāla Sutta DN 1); (2) Vocación Política: Asumir el trono de David para juzgar con justicia a los pobres (Isaías 11:4; Hiljot Melajim 11:1) vs. la «Gran Renuncia» al trono y retiro ascético fuera de la sociedad; (3) Genealogía y Pacto: Descendiente patrilineal biológico de Judá, David y Salomón en Jerusalén (1 Crónicas 22:9–10) vs. príncipe del clan Shakya en Nepal/India ajeno al pueblo y a la Torá de Israel; (4) Ontología del Mundo: Santificación de la creación física como «Tov Meod» (Génesis 1:31) vs. rechazo del mundo como Samsara y Dukkha; (5) Ley y Sociedad: Plenitud de las 613 Mitzvot y de la vida familiar/comunitaria vs. orden monástica célibe (Sangha) de desapego; (6) Criterio Empírico de Maimónides (Hiljot Melajim 11:4): Tras la muerte de Buda (c. 483 a.e.c.), las guerras mundiales continuaron, Israel no fue reunido de su exilio ni se reconstruyó el Templo; y (7) Destino del Alma: Inmortalidad personal de la Neshamá, Olam HaBá y Resurrección (Sanhedrín 90a) vs. inexistencia del yo (Anatta) y extinción en el Parinirvana.',
        hermeneuticalRule:
          'Este método comparativo muestra cómo Darshán AI puede contrastar cualquier figura histórica o espiritual externa (sea el Mesías cristiano o el Buda) frente a la matriz objetiva de la Torá y de Maimónides en Hiljot Melajim caps. 11–12.',
      },
    };
  }

  if (isMashiajChristianContrastTopic || isMashiajTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Caracterización del Mesías en el Cristianismo (Cristología Conciliar de Nicea 325 e.c. y Calcedonia 451 e.c.; Soteriología del Pecado Original, Expiación Vicaria y Segunda Venida) frente al Mashíaj del Judaísmo (Tanaj, Talmud, Maimónides en Hiljot Melajim 11–12 y Najmánides en la Disputa de Barcelona de 1263)',
      thesisSummary:
        'Estudio exegético y comparativo en dos partes: (1) definición de qué es el Mashíaj en el judaísmo, y (2) caracterización rigurosa del Mesías en el cristianismo (encarnación trinitaria, pecado original, sacrificio vicario, abrogación de la Ley y Segunda Venida) para desglosar sistemáticamente las 7 diferencias estructurales entre ambas tradiciones.',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad de la Paz Mesiánica frente a la Especificidad Eterna del Mandamiento (Torá vs. Abrogación Cristiana de la Ley)',
        externalUniversalism:
          'El cristianismo caracteriza al Mesías (Cristo) como el «fin de la Ley» (telos nomou): postula un universalismo confesional que abroga o declara superada la especificidad de los preceptos prácticos de la Torá (Shabat, Kashrut, Brit Milá, leyes del Templo), afirmando que la salvación depende exclusivamente de la fe dogmática en el sacrificio vicario de la cruz y desplazando la paz mundial prometida por los profetas a una «Segunda Venida» (Parusía).',
        torahUniversalDimension:
          'En contraste radical, las Fuentes Internas de la Torá articulan una verdadera Universalidad Ética e Histórica sin abolir el Pacto: en la Era Mesiánica todas las naciones de la tierra abandonan la guerra («convertirán sus espadas en rejas de arado y no alzará espada nación contra nación», Isaías 2:4), alcanzan el conocimiento ético del único Creador («la tierra estará llena del conocimiento del Eterno como las aguas cubren el mar», Isaías 11:9; Sofonías 3:9) y tienen parte en el Mundo Venidero como Justos de las Naciones (Jasidei Umot HaOlam, Rambam Hiljot Melajim 8:11) sin necesidad de anular la Torá.',
        torahCommandmentSpecificity:
          'Al mismo tiempo, como codifica Maimónides en Mishné Torá (Hiljot Melajim 11:1–4), el Mashíaj judío se define por su fidelidad absoluta a la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá): lejos de anular un solo precepto de la Torá (la cual es eterna e irrevocable según Deuteronomio 13:1–5 y Salmos 19:8), el Rey Mashíaj restaura la observancia íntegra de todas las leyes de la Torá escrita y oral, reconstruye el Beit HaMikdash en Jerusalén y reúne físicamente a los exiliados de Israel (Kibutz Galuyot).',
        exegeticalSynthesis:
          'Mientras el cristianismo caracteriza a su Mesías como quien suspende la especificidad de las Mitzvot de la Torá y difiere la paz del mundo a una segunda venida, el judaísmo caracteriza al Mashíaj como el rey humano que lleva a su plenitud histórica tanto la paz universal entre las naciones (Isaías 2:4) como el cumplimiento específico e íntegro de toda la Torá (Hiljot Melajim 11:1–4).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Caracterización del Mesías Cristiano (Fuentes Externas) y Desglose Sistemático de las 7 Diferencias con el Mashíaj Judío (Fuentes Internas de la Torá)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá —Isaías 2:1–4 y 11:1–12, Jeremías 23:5–6 y 22:30, Ezequiel 18:20–23 y 37:24–28, Deuteronomio 6:4, 13:1–5 y 30:1–6, Números 23:19, Oseas 11:9 y 14:2–3, Talmud Bavli Sanhedrín 98a–99a y Berajot 34b, Maimónides en Hiljot Melajim caps. 11–12 y Najmánides en Vikuaj ha-Rambán (Disputa de Barcelona, 1263)— definen al Mashíaj dentro del monoteísmo incorpóreo absoluto y la responsabilidad ética directa del ser humano ante Dios.',
        externalSourcesNature:
          'Las Fuentes Externas de la teología cristiana (Credo de Nicea de 325 e.c., Definición de Calcedonia de 451 e.c. y soteriología paulina) caracterizan al Mesías mediante 5 dogmas ajenos al Tanaj: (1) Encarnación divina trinitaria (Dios Hijo consustancial al Padre); (2) Pecado original hereditario que incapacita al ser humano; (3) Expiación vicaria mediante muerte sacrificial en la cruz; (4) Abrogación de las Mitzvot de la Torá; y (5) Desdoblamiento en «Dos Venidas» (Parusía).',
        normativeLocusContrast:
          'Desglose de las 7 Diferencias Fundamentales: (1) Naturaleza: 100% humano mortal nacido de padre y madre humanos vs. Dios encarnado (prohibido en Deuteronomio 6:4 y Números 23:19); (2) Genealogía: linaje patrilineal biológico de David y Salomón (Números 1:18; 1 Crónicas 22:9–10) vs. concepción virginal sin padre humano; (3) Soteriología: responsabilidad individual y Teshuvá directa ante Dios (Ezequiel 18:20; Oseas 14:2–3) vs. pecado original y sacrificio vicario humano; (4) Ley: eternidad de la Torá (Deuteronomio 13:1) vs. abrogación de los preceptos; (5) Tiempo: cumplimiento íntegro en una sola vida (Rambam, Hiljot Melajim 11:4: «si no tuvo éxito hasta este punto o fue muerto, es sabido que no es el prometido por la Torá») vs. doctrina de la Segunda Venida; (6) Escenario: redención geopolítica e histórica visible en este mundo (Najmánides, Barcelona 1263) vs. reino espiritual invisible; y (7) Mediación: relación directa de cada alma con Hashem vs. mediador obligatorio para llegar a Dios.',
        hermeneuticalRule:
          'Este desglose permite responder con total rigor ambas partes de la consulta: primero qué es el Mashíaj en el judaísmo y segundo cómo se caracteriza al Mesías en el cristianismo para comprender por qué sus diferencias son ontológicas, soteriológicas, jurídicas e históricas.',
      },
    };
  }

  if (isAfterlifeSoulDestinyTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Escatologías Comparadas: Nirvana (Budismo · Udāna 8.1), Valhalla (Tradición Nórdica · Grímnismál 8–10) y Cielo/Infierno Dualista frente al Olam HaBá Judío',
      thesisSummary:
        'Contraste exegético formal sobre el destino de las almas y los requisitos de acceso: Olam HaBá, Gan Edén y Guehinóm purificador en el Judaísmo frente al Nirvana budista, el Valhalla nórdico y el Cielo/Infierno dogmático, analizando (1) la Universalidad inclusiva (Jasidei Umot HaOlam) frente a la Especificidad del Mandamiento, y (2) la distinción entre Fuentes Internas de la Torá y Fuentes Externas.',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad frente a Especificidad del Mandamiento en los Requisitos para Acceder al Destino de las Almas (Olam HaBá vs. Nirvana, Valhalla, Cielo e Infierno)',
        externalUniversalism:
          'En las fuentes externas comparadas, los requisitos de acceso al destino último oscilan entre la anulación ascética de la individualidad, el exclusivismo bélico o el dogmatismo confesional: 1) En el Budismo (Udāna 8.1; Dhammapada 203–204), acceder al Nirvana exige extinguir todo deseo (Tanha), disolver la identidad del alma individual (Anatta) y salir del mundo histórico (Samsara) mediante el Noble Camino Óctuple. 2) En la mitología nórdica (Edda Poética, Grímnismál 8–10; Gylfaginning 38–41), acceder al Valhalla exige morir violentamente por las armas en batalla (vápndauða menn), excluyendo a quienes mueren en paz. 3) En escatologías dogmáticas de Cielo e Infierno eterno, la salvación se condiciona a profesar un credo exclusivo, condenando a quienes no lo profesan a un infierno perpetuo.',
        torahUniversalDimension:
          'En contraste radical, las Fuentes Internas de la Torá establecen una UNIVERSALIDAD ÉTICA INCLUSIVA sin precedentes: el judaísmo NO exige ser judío para acceder al Mundo Venidero (Olam HaBá). Como sentencian el Talmud (Sanhedrín 105a; Tosefta Sanhedrín 13:2) y Maimónides (Mishné Torá, Hiljot Teshuvá 3:5 e Hiljot Melajim 8:11): «Jasidei Umot HaOlam yesh lahem jélek la-Olam HaBá» («Los justos de entre todas las naciones del mundo tienen parte en el Mundo Venidero»). Para cualquier ser humano de cualquier nación, el requisito de acceso es la rectitud ética universal expresada en las Siete Leyes de Noé (Sanhedrín 56a: no asesinar, no robar, practicar la justicia, etc.). Además, en el judaísmo no existe un «Infierno eterno» para atormentar almas sin fin: el Guehinóm rabínico (Shabat 33b; Eduyot 2:10) es un proceso pedagógico y purificador temporal (máximo 12 meses) para limpiar el alma antes de su elevación.',
        torahCommandmentSpecificity:
          'Al mismo tiempo, el judaísmo articula esa apertura universal con la ESPECIFICIDAD DEL MANDAMIENTO (Mitzvá): 1) Para el pueblo del Pacto, el requisito se vive a través de las 613 Mitzvot específicas que santifican este mundo («Este mundo es como un vestíbulo ante el Olam HaBá: prepárate en el vestíbulo mediante las acciones concretas para entrar al salón principal», Pirké Avot 4:16; Mishná Sanhedrín 10:1). 2) Frente al Valhalla nórdico (que premia matar o morir por la espada), el requisito específico de la Torá es preservar la vida (Pikuaj Néfesh, Yoma 85b) y perseguir la paz (Isaías 2:4; Salmos 34:15). 3) Frente al Nirvana (que apaga la identidad del yo), en el Olam HaBá (Berajot 17a; Rambam Hiljot Teshuvá 8:2-3) cada alma conserva su singularidad consciente deleitándose en la luz de la Shejiná (Ziv HaShejiná) y culmina en la Resurrección (Tejiyat HaMetim), porque para la Torá el cuerpo y el mundo físico creados por Dios son sagrados.',
        exegeticalSynthesis:
          'Mientras el Valhalla exige muerte en guerra, el Nirvana exige disolver el yo y las escatologías dogmáticas exigen adhesión confesional bajo amenaza de infierno eterno, la Torá abre las puertas del Olam HaBá universalmente a los justos de todas las naciones (Hiljot Teshuvá 3:5) y guía a Israel mediante la especificidad ética y vital de cada Mitzvá (Pirké Avot 4:16).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas en la Escatología Comparada (Eijá Rabá 2:13)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá sobre el destino del alma (Mishná Sanhedrín 10:1 [90a], Talmud Bavli Berajot 17a, Shabat 33b y 152b, Pirké Avot 4:16-17, Rambam en Hiljot Teshuvá caps. 3 y 8, y Ramban en Sháar HaGuemul) conciben el alma (Neshamá, insuflada por Dios en Génesis 2:7) como una entidad relacional, libre y moralmente responsable cuyos actos en este mundo concreto tienen eco eterno.',
        externalSourcesNature:
          'Las Fuentes Externas consultadas para este estudio comparativo —el Canon Pali budista (Udāna 8.1 y Dhammapada sobre el Nirvana), las Eddas nórdicas (Grímnismál y Gylfaginning sobre el Valhalla) y el Fedón de Platón— se analizan bajo el principio rabínico de Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»): nos permiten comprender cómo distintas culturas han respondido al misterio de la muerte, para contrastarlas con la ética del Pacto.',
        normativeLocusContrast:
          'En el Budismo la liberación proviene de una técnica meditativa autónoma que desmantela el sujeto; en el mito nórdico depende del decreto bélico de Odín; en la Torá, la vida eterna brota del vínculo relacional con la Fuente de la Vida («Porque contigo está el manantial de la vida; en Tu luz veremos la luz», Salmos 36:10) y de la acción ética que responde al mandato divino («Gadol ha-metzuvé ve-osé», Kidushín 31a).',
        hermeneuticalRule:
          'Al comparar el Olam HaBá con el Nirvana, el Valhalla, el Cielo y el Infierno, citamos las fuentes primarias externas con precisión documental y demostramos cómo la Torá une la justicia universal (acceso de todos los justos de las naciones) con el valor irrepetible del alma individual y de la acción ética concreta.',
      },
    };
  }

  if (isEnlightenmentBuddhismTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'El Concepto de Iluminación en el Budismo (Bodhi / Satori · Dhammapada XIV, 179–183 & XX, 277–279; Samyutta Nikaya 56.11) frente a la Tradición Judía',
      thesisSummary:
        'Contraste exegético formal para responder si existe la «iluminación» en el judaísmo y cómo se diferencia del despertar budista (Bodhi / Nirvana): análisis de la Universalidad frente a la Especificidad del Mandamiento («Ner Mitzvá ve-Torá Or», Proverbios 6:23) y de las Fuentes Internas de la Torá (Or HaGanuz, Ruaj HaKódesh y Devekut) frente a las Fuentes Externas.',
      universalidadVsEspecificidad: {
        title:
          'I. La Iluminación Abstracta y Desapegada (Bodhi) frente a la Especificidad Luminosa del Mandamiento («Ner Mitzvá ve-Torá Or», Proverbios 6:23)',
        externalUniversalism:
          'En las fuentes externas del Budismo (Dhammapada 277–279; Samyutta Nikaya 56.11), la «iluminación» o despertar (Bodhi, de la raíz sánscrita/pali budh = despertar) consiste en comprender tres características universales de la existencia (Tilakkhana): que todo fenómeno es impermanente (Anicca), insatisfactorio (Dukkha) y carente de un yo o alma sustancial (Anatta). Para alcanzar esa iluminación, el practicante debe extinguir el deseo y el apego (Tanha) y retirarse de la particularidad de las pasiones e historias mundanas hacia una ecuanimidad desapegada.',
        torahUniversalDimension:
          '¿Existe un concepto de iluminación en el judaísmo? ¡Sí, y ocupa un lugar central, pero con una estructura ontológica y ética radicalmente distinta! En las Fuentes Internas de la Torá, Dios crea en el primer día una luz espiritual suprasensible —el **Or HaGanuz** (la Luz Oculta Primordial, Génesis 1:3 y Talmud Bavli Jaguigá 12a)— con la que el ser humano podía ver «de un confín del mundo al otro», y que fue atesorada dentro de la Torá. Como proclama el Salmo 36:10: «Ki imejá mekor jayim, be-orjá niré or» («Porque contigo está el manantial de la vida; en Tu luz veremos la luz»).',
        torahCommandmentSpecificity:
          'El contraste exegético formal reside en cómo se accede a esa luz: 1) Mientras el Bodhi budista busca disolver la especificidad del yo (Anatta) y apagar el deseo, la iluminación judía consiste en **Devekut** (adhesión relacional a Dios sin perder la responsabilidad individual, Deuteronomio 4:4), **Ruaj HaKódesh** (inspiración profética y sabiduría divina que reposa sobre quien cultiva la humildad y la alegría en el precepto, Shabat 30b y Avodá Zará 20b) y **Jojmá-Biná-Daat**. 2) Sobre todo, en la Torá la iluminación no se alcanza huyendo de lo concreto hacia el vacío, sino a través de la **ESPECIFICIDAD DEL MANDAMIENTO**: «Ki ner mitzvá ve-Torá or» («Porque lámpara es el mandamiento específico y la Torá es luz», Proverbios 6:23). Cada Mitzvá concreta (dar Tzedaká, honrar el Shabat, salvar una vida en Pikuaj Néfesh, Yoma 85b) es una mecha específica donde se enciende la luz infinita en medio del mundo físico («Naasé ve-nishmá», Éxodo 24:7).',
        exegeticalSynthesis:
          'En el Budismo la iluminación (Bodhi) es despertar del mundo para apagar la sed del deseo; en el Judaísmo la iluminación (Or HaTorá, Devekut y Ruaj HaKódesh) es despertar DENTRO del mundo para encender cada acción específica con santidad, justicia y compasión.',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas sobre el Despertar Espiritual (Eijá Rabá 2:13)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá sobre la iluminación espiritual —Salmos 36:10 («En Tu luz veremos la luz»), Proverbios 6:23 («Ner Mitzvá ve-Torá Or»), Talmud Bavli Jaguigá 12a (Or HaGanuz), Avodá Zará 20b (la escalera de Pinjás ben Yaír hasta Ruaj HaKódesh), Mesilat Yesharim del Ramjal y el Tania del Alter Rebe (caps. 12–14 y 36)— enseñan que la luz procede del Creador trascendente y se revela en el diálogo del Pacto.',
        externalSourcesNature:
          'Las Fuentes Externas budistas (Dhammapada, Sutta Pitaka, consultadas en sus textos pali y síntesis documentales) se evalúan según Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»): ofrecen una aguda psicología contemplativa sobre cómo el egoísmo y la reactividad generan sufrimiento (Jojmá), pero carecen de la Revelación relacional del Sinaí y de la especificidad redentora de la Mitzvá.',
        normativeLocusContrast:
          'En el Budismo, la fuente de la iluminación es estrictamente interna e inmanente al flujo mental (citta-bhāvanā) en un universo sin Dios creador; en las Fuentes Internas de la Torá, la iluminación brota del encuentro entre la Fuente Trascendente que nos interpela («Gadol ha-metzuvé ve-osé», Kidushín 31a) y la interiorización amorosa de Su palabra en nuestra mente y corazón (Deuteronomio 30:14; Salmos 19:9: «El precepto de HaShem es puro, ilumina los ojos»).',
        hermeneuticalRule:
          'Para analizar qué es la iluminación en contraste con el budismo, se exponen las fuentes externas del Canon Pali (Bodhi, Anatta, Nirvana) y se contrastan con las categorías propias de las fuentes internas de la Torá (Or HaGanuz, Ner Mitzvá, Devekut y Ruaj HaKódesh).',
      },
    };
  }

  if (isPlatoCaveTopic && isCiceroTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Platón (Alegoría de la Caverna · República VII, 514a–520d) y Marco Tulio Cicerón (De Re Publica III.33 & De Officiis I.20)',
      thesisSummary:
        'Contraste exegético formal entre el idealismo contemplativo de Platón y el iusnaturalismo cívico de Cicerón (Fuentes Externas) frente a la Revelación del Pacto y la concreción halájica de la Mitzvá (Fuentes Internas de la Torá).',
      universalidadVsEspecificidad: {
        title:
          'I. La Universalidad frente a la Especificidad del Mandamiento (Platón y Cicerón vs. Halajá y Mitzvá)',
        externalUniversalism:
          'En las fuentes externas grecorromanas, tanto Platón como Cicerón identifican la perfección con lo universal y abstracto: en la Alegoría de la Caverna (República VII, 514a–517c), Platón exige huir del mundo sensible y particular (las sombras de la caverna) para contemplar la Idea universal e inmutable del Bien; y Cicerón (De Re Publica III.33) define la ley verdadera como la «recta ratio naturae congruens», una ley natural homogénea e invariable («la misma en Roma y en Atenas»).',
        torahUniversalDimension:
          'Las fuentes internas de la Torá reconocen un horizonte ético universal para toda la humanidad: todo ser humano es creado Betzélem Elohim (Génesis 1:27) y está vinculado por las Siete Leyes Universales de los Hijos de Noé (Talmud Bavli Sanhedrín 56a), que incluyen el deber universal de establecer tribunales de justicia (Dinim).',
        torahCommandmentSpecificity:
          'Sin embargo, la Torá rechaza que la verdad ética consista en abandonar la caverna del mundo material o en quedarse en máximas cívicas genéricas: el mandamiento judío (Mitzvá) opera desde la ESPECIFICIDAD CONCRETA. Como enseña Proverbios 6:23 («Ki ner mitzvá ve-Torá or»: «Porque lámpara es el mandamiento específico y la Torá es luz»), mientras la Torá es la luz universal, la Mitzvá específica es la lámpara concreta que ilumina cada paso dentro de la realidad material (Shabat, Kashrut, Tzedaká específica al huérfano y al extranjero en Deuteronomio 24:17-18, Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).',
        exegeticalSynthesis:
          'Platón sale de la caverna para contemplar lo universal y Cicerón busca una ley natural uniforme; la Torá hace descender la presencia divina (Shejiná) al interior mismo de la caverna humana a través de la especificidad práctica del mandamiento («Naasé ve-nishmá», Éxodo 24:7).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción Epistemológica y Normativa entre Fuentes Internas de la Torá y Fuentes Externas',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá (Tanaj, Mishná, Talmud Bavli y Yerushalmi, Midrash y códigos halájicos en Sefaria) emanan de la Revelación relacional en el Sinaí (Torá min HaShamayim) y del Pacto histórico de Israel, siendo interpretadas dialógicamente por los Sabios («No está en el cielo», Deuteronomio 30:12; Bava Metzia 59b).',
        externalSourcesNature:
          'Las Fuentes Externas (como los diálogos de Platón o los tratados de Cicerón consultados para informar este estudio) se rigen por el principio talmúdico y midráshico de Eijá Rabá 2:13: «Im yomar lejá adam yesh Jojmá ba-goyim taamín, yesh Torá ba-goyim al taamín» («Si te dicen que hay sabiduría filosófica [Jojmá] entre las naciones, créelo; pero si te dicen que hay Torá entre las naciones, no lo creas»). Son frutos valiosos de la razón natural y la observación humana que informan el análisis comparativo, pero no constituyen Revelación del Pacto.',
        normativeLocusContrast:
          'En Platón la fuente de la verdad es la anamnesis intelectual interna del filósofo, y en Cicerón es la razón natural inmanente (recta ratio) unida al decoro político (officium). En la Torá, la obligación nace de una voz trascendente que interpela al ser humano desde fuera de su ego («Gadol ha-metzuvé ve-osé», Kidushín 31a) y que se interioriza en el corazón mediante la práctica amorosa (Deuteronomio 30:14; Miqueas 6:8).',
        hermeneuticalRule:
          'El exégeta consulta las fuentes externas (Platón, Cicerón) en sus textos originales para comprender su diagnóstico de la condición humana, y las contrasta con las fuentes internas de la Torá para mostrar cómo la especificidad de la Mitzvá redime el mundo concreto en lugar de evadirlo.',
      },
    };
  }

  if (isPlatoCaveTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Platón · Alegoría de la Caverna (La República, Libro VII, 514a–520d)',
      thesisSummary:
        'Contraste exegético formal entre la Alegoría de la Caverna de Platón (ascenso especulativo desde las sombras sensibles hacia la Idea universal) y la concepción de la Torá (descenso de la luz divina a la especificidad del mandamiento concreto en el mundo físico).',
      universalidadVsEspecificidad: {
        title:
          'I. Universalidad de las Ideas Platónicas frente a la Especificidad del Mandamiento (Mitzvá)',
        externalUniversalism:
          'En la fuente externa analizada (Platón, República VII, 514a–518d), el mundo físico, histórico y corporal es representado como una caverna oscura de sombras particulares y engañosas. Para Platón, la salvación epistemológica y ética consiste en romper los vínculos con lo sensible particular y ascender hacia la contemplación intelectual de las Formas o Ideas universales, eternas e inmutables (culminando en la Idea abstracta del Bien). Incluso cuando el filósofo regresa a la caverna (519d–520d), lo hace con reticencia, considerando la vida práctica inferior a la contemplación universal.',
        torahUniversalDimension:
          'Las fuentes internas de la Torá afirman que la luz divina de la Torá posee un alcance universal («Torá Or», Proverbios 6:23; Isaías 42:6; y las 7 Leyes Universales de Bnei Nóaj en Sanhedrín 56a) y que el Creador otorgó sabiduría racional a toda la humanidad.',
        torahCommandmentSpecificity:
          'Sin embargo, el contraste exegético es radical respecto a la ESPECIFICIDAD DEL MANDAMIENTO: en Proverbios 6:23 el Rey Salomón distingue entre «Torá Or» (la Torá es luz universal) y «Ner Mitzvá» (el mandamiento específico es una lámpara puntual). En el judaísmo no escapamos de la caverna del mundo físico hacia las Ideas abstractas: encendemos lámparas específicas (cada Mitzvá concreta en el tiempo, el cuerpo, la mesa, el trato al prójimo, Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18) para transformar la caverna material en una morada para la presencia divina (Dirá BeTajtonim). Por eso en Sinaí el pueblo proclamó primero la acción específica y luego la contemplación: «Naasé ve-nishmá» («Haremos y comprenderemos», Éxodo 24:7; y Pirké Avot 3:17).',
        exegeticalSynthesis:
          'Mientras Platón desprecia lo particular sensible para refugiarse en la universalidad abstracta de las Ideas, la Torá santifica lo particular mediante la especificidad del mandamiento: Moshé no se queda en la cima luminosa del Sinaí, sino que desciende con las Tablas hacia el campamento concreto del pueblo.',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Platón vs. Sinaí)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá (Éxodo 24:7, Deuteronomio 30:11-14, Proverbios 6:23, Talmud Kidushín 31a, Pirké Avot 3:17, Maharal en Tiféret Yisrael y Tania cap. 36) nacen de la Revelación histórica y pactal en Sinaí: en ellas la verdad no es un objeto estático de contemplación solitaria, sino la voz viva del Creador que convoca a la acción ética y comunitaria.',
        externalSourcesNature:
          'Las Fuentes Externas (Platón, República VII, 514a–520d, consultadas en el corpus griego clásico y documentación externa) pertenecen a la categoría rabínica de «Jojmá ba-Goyim taamín» (Eijá Rabá 2:13: «Si te dicen que hay sabiduría entre las naciones, créelo; si te dicen que hay Torá entre las naciones, no lo creas»). Aportan una brillante metáfora pedagógica sobre cómo el ser humano puede confundir apariencias con realidad, pero parten de una ontología dualista que devalúa la creación material.',
        normativeLocusContrast:
          'En Platón, la iluminación proviene de una facultad interna del intelecto (anamnesis o reminiscencia del alma racional) que se emancipa del cuerpo; en las fuentes internas de la Torá, la iluminación brota del encuentro entre el mandato trascendente («Gadol ha-metzuvé ve-osé», Kidushín 31a) y la respuesta encarnada del corazón y las manos («En tu boca y en tu corazón para ponerlo por obra», Deuteronomio 30:14).',
        hermeneuticalRule:
          'Al estudiar la Alegoría de la Caverna desde la hermenéutica judía, consultamos la fuente externa platónica con rigor filológico, pero invertimos su vector: la meta espiritual no es evadir el mundo creado (que Dios declaró «muy bueno» en Génesis 1:31), sino iluminar cada rincón concreto de la caverna humana con la especificidad de las Mitzvot.',
      },
    };
  }

  if (isCiceroTopic) {
    return {
      isComparativeStudy: true,
      externalThinkerOrTradition:
        'Marco Tulio Cicerón · De Re Publica (III.33), De Legibus (I.18) y De Officiis (Sobre los Deberes, I.20 / III.21)',
      thesisSummary:
        'Contraste exegético formal entre la Ley Natural (lex naturae / recta ratio) y el deber cívico (officium) de Cicerón frente a la Ética del Pacto, la Tzedaká y la especificidad del mandamiento en las fuentes internas de la Torá.',
      universalidadVsEspecificidad: {
        title:
          'I. La Ley Natural Universal de Cicerón frente a la Especificidad del Mandamiento en la Torá',
        externalUniversalism:
          'En las fuentes externas romanas consultadas (De Re Publica III.22.33 y De Legibus I.6.18), Cicerón define la verdadera ley como «recta ratio naturae congruens» (la recta razón conforme a la naturaleza), afirmando que es universal, eterna e invariable: «No habrá una ley en Roma y otra en Atenas, una hoy y otra mañana». En De Officiis (I.7.20–23), traduce ese universalismo en deberes cívicos (officia) centrados en proteger la propiedad privada, no dañar sin provocación y mantener la reciprocidad social entre lo honesto (honestum) y lo útil (utile).',
        torahUniversalDimension:
          'Las fuentes internas de la Torá coinciden en que existe un orden moral universal exigible a toda sociedad humana: las Siete Leyes de Bnei Nóaj (Talmud Bavli Sanhedrín 56a), que incluyen el mandato universal de establecer cortes de justicia (Dinim) y prohíben el asesinato, el robo y la crueldad, basadas en que todo ser humano porta la Imagen Divina (Génesis 1:27 y 9:6).',
        torahCommandmentSpecificity:
          'Sin embargo, el contraste exegético muestra dónde la especificidad del mandamiento de la Torá supera al officium de Cicerón: 1) Una «ley natural» abstracta e idéntica en todo lugar resulta insuficiente para proteger al vulnerable cuando choca con el interés político (utile) de Roma. 2) La Torá no deja la ayuda al necesitado como mera «beneficencia» discrecional (liberalitas) subordinada a no afectar el propio patrimonio (como aconseja Cicerón en De Officiis I.14.42–45), sino que legisla MANDAMIENTOS ESPECÍFICOS Y VINCULANTES (Leket, Shijejá, Peá, Maaser Aní y Tzedaká en Deuteronomio 15:7-8 y Levítico 19:9-10) fundados en la memoria histórica específica de Israel («Recuerda que fuiste siervo en Egipto», Deuteronomio 24:17-18). 3) Además, la Halajá conjuga la norma con la especificidad casuística de cada caso (Pikuaj Néfesh en Yoma 85b y Lifnim Mishurat HaDin en Deuteronomio 6:18).',
        exegeticalSynthesis:
          'Cicerón edifica una ética universal de ciudadanía y reciprocidad jurídica (do ut des); la Torá integra la justicia universal con la especificidad compasiva del mandamiento (Miqueas 6:8: «Hacer justicia [Mishpat], amar la bondad [Jésed] y caminar humildemente con tu Dios»).',
      },
      fuentesInternasVsExternas: {
        title:
          'II. Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Cicerón vs. Masorah)',
        internalTorahSourcesNature:
          'Las Fuentes Internas de la Torá (Deuteronomio 4:6-8, Deuteronomio 15:7-11, Miqueas 6:8, Talmud Kidushín 31a, Sanhedrín 56a y Bava Metzia 30b) provienen de la Revelación del Pacto en Sinaí: en ellas el deber moral no es un contrato de conveniencia cívica ni una ley cósmica impersonal, sino una Mitzvá (vínculo relacional con el Santo, Bendito Sea, y con el prójimo).',
        externalSourcesNature:
          'Las Fuentes Externas de Cicerón (De Officiis, De Re Publica, De Legibus, recuperadas del corpus clásico latino y fuentes documentales externas) representan la cumbre de la jurisprudencia y filosofía moral romana («Jojmá ba-Goyim taamín», Eijá Rabá 2:13). Deben ser estudiadas y citadas con rigor para comprender la noción clásica de ley natural y deber cívico.',
        normativeLocusContrast:
          'Para Cicerón, la fuente de la obligación es inmanente: la naturaleza racional del cosmos (lex naturae) y el honor del ciudadano (decorum / honestum). Para las fuentes internas de la Torá, la fuente es teonómica y dialógica: proviene del Comandante trascendente («Gadol ha-metzuvé ve-osé», Kidushín 31a), quien se identifica con el clamor del huérfano, la viuda y el forastero, y escribe esa ley en el corazón humano (Deuteronomio 30:14).',
        hermeneuticalRule:
          'En un estudio comparativo con Cicerón, se contrasta el texto latino de De Officiis y De Re Publica con los versículos de la Torá y las suguiot talmúdicas, evidenciando la diferencia entre el deber cívico natural (officium) y la santidad específica del mandamiento (Mitzvá / Tzedaká).',
      },
    };
  }

  // Only return the Kant / external comparative contrast if Kant or an explicit external source was actually matched
  if (!isKantTopic && externalSources.length === 0) {
    return undefined;
  }

  return {
    isComparativeStudy: true,
    externalThinkerOrTradition: isKantTopic
      ? 'Immanuel Kant · Imperativo Categórico (Fundamentación de la metafísica de las costumbres, Ak. IV, 421–433)'
      : `${externalSources[0].author} (${externalSources[0].workTitle})`,
    thesisSummary:
      'Contraste exegético formal analizando (1) la Universalidad abstracta frente a la Especificidad concreta del mandamiento (Mitzvá y Halajá), y (2) la distinción epistemológica y normativa entre Fuentes Internas de la Torá y Fuentes Externas.',
    universalidadVsEspecificidad: {
      title:
        'I. La Universalidad frente a la Especificidad del Mandamiento (Imperativo Universal vs. Halajá y Mitzvá)',
      externalUniversalism: isKantTopic
        ? 'En la fuente filosófica externa (Immanuel Kant, Grundlegung Ak. IV, 421: «Obra sólo según aquella máxima por la cual puedas querer que al mismo tiempo se convierta en ley universal»), la validez ética exige una universalidad formal, abstracta y sin excepciones. Toda situación particular queda subsumida bajo una regla idéntica e inflexible (llevando a Kant en su ensayo de 1797 a prohibir mentir incluso a un asesino que pregunta por una víctima inocente).'
        : externalSources[0]?.philosophicalThesis ||
          'En la fuente filosófica externa consultada, la norma moral se concibe desde una universalidad teórica homogénea.',
      torahUniversalDimension:
        'Las fuentes internas de la Torá afirman un cimiento ético universal para toda la humanidad: todo ser humano es creado a Imagen Divina (Betzélem Elohim, Génesis 1:27) y toda la familia humana está vinculada por las Siete Leyes Universales de Noé (Talmud Bavli Sanhedrín 56a), que exigen justicia y prohíben el asesinato, el robo y la crueldad.',
      torahCommandmentSpecificity:
        'A diferencia del formalismo abstracto externo, la tradición judía sostiene que la vida moral real exige la ESPECIFICIDAD DEL MANDAMIENTO: 1) Especificidad casuística halájica: las conclusiones éticas no se deducen de una fórmula ciega a las consecuencias, sino de una jerarquía viva de valores donde salvar una vida concreta (Pikuaj Néfesh, Levítico 18:5 y Yoma 85b: «Vivirás por ellos y no morirás por ellos») suspende casi toda la Torá, donde es obligatorio alterar la verdad para salvar a un inocente o preservar la paz (Yevamot 65b), y donde Lifnim Mishurat HaDin (Deuteronomio 6:18; Bava Metzia 30b) atiende la singularidad irrepetible de cada persona. 2) Especificidad del Pacto: junto a las 7 leyes universales, la Torá entrega 613 Mitzvot específicas que santifican el tiempo, el cuerpo y la historia concreta («Ki ner mitzvá ve-Torá or», Proverbios 6:23).',
      exegeticalSynthesis:
        'Mientras la filosofía externa identifica la ética con una universalidad homogénea y abstracta, las fuentes internas de la Torá articulan principios universales (7 Leyes de Noé) con la especificidad concreta, compasiva y casuística del mandamiento (Mitzvá y Halajá).',
    },
    fuentesInternasVsExternas: {
      title:
        'II. La Distinción entre Fuentes Internas de la Torá y Fuentes Externas (Autonomía vs. Teonomía Relacional)',
      internalTorahSourcesNature:
        'Las Fuentes Internas de la Torá comprenden el corpus canónico de la Revelación en Sinaí y la Tradición Oral (Tanaj, Mishná, Talmud Bavli/Yerushalmi, Midrash, Rishonim y Ajaronim en Sefaria). Su fundamento no es la especulación solitaria, sino el Pacto (Berit) entre el Creador y el ser humano, interpretado en la historia por los Sabios (Deuteronomio 30:12; Bava Metzia 59b).',
      externalSourcesNature:
        'Las Fuentes Externas consultadas para informar el estudio comparativo se enmarcan en el principio rabínico de Eijá Rabá 2:13: «Si alguien te dice que hay sabiduría (Jojmá) entre las naciones, créelo; si te dice que hay Torá entre las naciones, no lo creas». Aportan rigor analítico y claridad conceptual que enriquecen el contraste exegético.',
      normativeLocusContrast:
        'Las fuentes internas de la Torá muestran que el sujeto que sólo se escucha a sí mismo queda atrapado en la autojustificación del ego (Negiá); por eso el mandamiento nace de una Fuente Externa Trascendente y Relacional («Gadol ha-metzuvé ve-osé»: «Mayor es quien está comandado y actúa que quien actúa sin estar comandado», Kidushín 31a), cuya meta es ser libremente interiorizada en el corazón («En tu boca y en tu corazón para cumplirla», Deuteronomio 30:14; y Pirké Avot 2:4: «Haz que Su voluntad sea tu voluntad»).',
      hermeneuticalRule:
        'En todo estudio comparativo con un pensador externo explícito, Darshán AI busca y cita las fuentes externas pertinentes para exponer fielmente la tesis filosófica del autor, y luego realiza el contraste exegético formal frente a las fuentes internas de la Torá.',
    },
  };
}

export const FORBIDDEN_NT_BOOKS_REGEX =
  /\b(Juan|Mateo|Marcos|Lucas|Hechos|Romanos|1\s*Corintios|2\s*Corintios|Corintios|G[áa]latas|Efesios|Filipenses|Colosenses|Tesalonicenses|Timoteo|Tito|Filem[óo]n|Hebreos|Santiago|1\s*Pedro|2\s*Pedro|Apocalipsis|John|Matthew|Mark|Luke|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Hebrews|Revelation)\s+\d+:\d+(?:-\d+)?/gi;

export function sanitizeStrictJewishText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text;
}

export function sanitizeStrictJewishObject<T>(obj: T): T {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return sanitizeStrictJewishText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => {
        if (item && typeof item === 'object' && typeof item.ref === 'string') {
          return !FORBIDDEN_NT_BOOKS_REGEX.test(item.ref);
        }
        return true;
      })
      .map((item) => sanitizeStrictJewishObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      out[k] = sanitizeStrictJewishObject(v);
    }
    return out as T;
  }
  return obj;
}

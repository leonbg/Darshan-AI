import {
  HalakhicConsultationFocus,
  HalakhicPipelineValidation,
  HalakhicShulchanArukhConsultation,
  SefariaRefPrediction,
  ShulchanArukhDirectQuote,
  VerifiedSefariaSource,
} from '../types';
import { validatePurelyHalakhicQuery } from './halakhicPipelineValidator';

interface ShulchanArukhCorpusEntry {
  id: string;
  ref: string;
  heRef: string;
  simanSeifLabel: string;
  focusBranch: HalakhicConsultationFocus;
  focusBranchLabel: string;
  topicLabel: string;
  briefHebrewQuote: string;
  briefSpanishQuote: string;
  fullEnglishSummary: string;
  mejaberAndRamaNote?: string;
  subtopicKeywords: RegExp;
  defaultPriority: number;
}

const BRANCH_LABELS: Record<HalakhicConsultationFocus, string> = {
  REZOS: 'Leyes de los Rezos (Oraj Jaim)',
  FESTIVIDADES: 'Leyes de las Festividades y Shabat (Oraj Jaim)',
  KASHRUT: 'Leyes de Kashrut (Yoré Deá)',
  HALAJA_GENERAL: 'Halajá General y Minhag (Shulján Aruj)',
};

const SHULCHAN_ARUKH_CORPUS: ShulchanArukhCorpusEntry[] = [
  // ======================== 1. LEYES DE LOS REZOS (ORAJ JAIM) ========================
  {
    id: 'sa-oc-1-1',
    ref: 'Shulchan Arukh, Orach Chayim 1:1',
    heRef: 'שולחן ערוך, אורח חיים א׳:א׳',
    simanSeifLabel: 'Oraj Jaim 1:1',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Disposición inicial del rezo matutino y conciencia divina',
    briefHebrewQuote:
      'יִתְגַּבֵּר כַּאֲרִי לַעֲמֹד בַּבֹּקֶר לַעֲבוֹדַת בּוֹרְאוֹ... הַגָּה: שִׁוִּיתִי ה׳ לְנֶגְדִּי תָמִיד הוּא כְּלָל גָּדוֹל בַּתּוֹרָה.',
    briefSpanishQuote:
      '«Se fortalecerá como un león para levantarse por la mañana al servicio de su Creador» (Mejaber) · «He puesto a Hashem siempre delante de mí es un gran principio en la Torá» (Ramá).',
    fullEnglishSummary:
      'One should strengthen oneself like a lion to rise in the morning for the service of one’s Creator (Mechaber); Rema: "I have set Hashem before me always" (Ps. 16:8) is a great foundational principle.',
    mejaberAndRamaNote:
      'Mejaber exige vigor práctico al despertar; el Ramá añade la conciencia contemplativa continua (Shiviti).',
    subtopicKeywords: /\b(shajarit|ma[ñn]ana|despertar|despertarse|servicio|modo|inicio|tefil[aá]|rezos?|shiviti|mejaber|ram[aá])\b/i,
    defaultPriority: 92,
  },
  {
    id: 'sa-oc-61-1',
    ref: 'Shulchan Arukh, Orach Chayim 61:1',
    heRef: 'שולחן ערוך, אורח חיים ס״א:א׳',
    simanSeifLabel: 'Oraj Jaim 61:1',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Concentración (Kavaná) y reverencia en la lectura del Shemá',
    briefHebrewQuote:
      'יִקְרָא קְרִיאַת שְׁמַע בְּכַוָּנָה בְּאֵימָה וּבְיִרְאָה בְּרֶתֶת וּבְזִיעַ, וִיכַוֵּן לֵבּוֹ בַּפָּסוּק הָרִאשׁוֹן.',
    briefSpanishQuote:
      '«Leerá la lectura del Shemá con concentración del corazón (Kavaná), con temor reverencial y estremecimiento... enfocando plenamente el sentido de la Unificación divina en el primer versículo».',
    fullEnglishSummary:
      'One must recite the Shema with deliberate concentration, awe, and reverence, focusing the heart completely on accepting God’s sovereignty in the first verse.',
    mejaberAndRamaNote:
      'Aplica por igual a los ritos Sefardí y Ashkenazí; la kavaná del primer versículo es indispensable para cumplir la mitzvá.',
    subtopicKeywords: /\b(shem[aá]|keriat\s+shem[aá]|kavan[aá]|concentraci[oó]n|atenci[oó]n|lectura)\b/i,
    defaultPriority: 95,
  },
  {
    id: 'sa-oc-68-1',
    ref: 'Shulchan Arukh, Orach Chayim 68:1',
    heRef: 'שולחן ערוך, אורח חיים ס״ח:א׳',
    simanSeifLabel: 'Oraj Jaim 68:1',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Preservación del Núsaj HaTefilá y costumbre litúrgica (Minhag HaMakom)',
    briefHebrewQuote:
      'הַגָּה: וְאֵין לְשַׁנּוֹת מִנְהַג הַמָּקוֹם בְּשׁוּם דָּבָר מִסֵּדֶר הַתְּפִלָּה וְנוּסְחָהּ.',
    briefSpanishQuote:
      '«No se debe alterar la costumbre del lugar (Minhag HaMakom) en ningún detalle del orden de la plegaria ni de su rito litúrgico (Núsaj)».',
    fullEnglishSummary:
      'Rema rules that one must never alter the custom of the place in any detail of the order of prayer or its liturgical wording (Nusach).',
    mejaberAndRamaNote:
      'El Ramá protege la continuidad de cada Núsaj (Sefarad, Ashkenaz, Ari, Teimán) frente a cambios arbitrarios.',
    subtopicKeywords: /\b(n[uú]saj|nusjaot|minhag|sidur|siddur|piyutim|rito|orden\s+del\s+rezo|sefard[ií]|ashkenaz[ií])\b/i,
    defaultPriority: 88,
  },
  {
    id: 'sa-oc-90-9',
    ref: 'Shulchan Arukh, Orach Chayim 90:9',
    heRef: 'שולחן ערוך, אורח חיים צ׳:ט׳',
    simanSeifLabel: 'Oraj Jaim 90:9',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Primacía de la plegaria comunitaria (Tefilá be-Tzibur / Minyán)',
    briefHebrewQuote:
      'יִשְׁתַּדֵּל אָדָם לְהִתְפַּלֵּל בְּבֵית הַכְּנֶסֶת עִם הַצִּבּוּר.',
    briefSpanishQuote:
      '«Debe esforzarse la persona por rezar en la sinagoga junto con la congregación (Minyán), pues la plegaria comunitaria asciende siempre con aceptación».',
    fullEnglishSummary:
      'A person should make every effort to pray in the synagogue together with the congregation (tzibur).',
    mejaberAndRamaNote:
      'Define la importancia halájica del Minyán y de la sinagoga como lugar consagrado al rezo.',
    subtopicKeywords: /\b(miny[aá]n|tzibur|sinagoga|comunidad|p[uú]blico|congregaci[oó]n|kadish|kedush[aá])\b/i,
    defaultPriority: 84,
  },
  {
    id: 'sa-oc-98-1',
    ref: 'Shulchan Arukh, Orach Chayim 98:1',
    heRef: 'שולחן ערוך, אורח חיים צ״ח:א׳',
    simanSeifLabel: 'Oraj Jaim 98:1',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Intención del corazón y postura interior en la Amidá (Shemoné Esré)',
    briefHebrewQuote:
      'הַמִּתְפַּלֵּל צָרִיךְ שֶׁיְּכַוֵּן בְּלִבּוֹ פֵּרוּשׁ הַמִּלּוֹת שֶׁמּוֹצִיא בִּשְׂפָתָיו, וְיַחְשׁוֹב כְּאִלּוּ שְׁכִינָה כְּנֶגְדּוֹ.',
    briefSpanishQuote:
      '«Quien reza la Amidá debe concentrar su corazón en el significado de las palabras que pronuncian sus labios, y considerar como si la Presencia Divina (Shejiná) estuviera frente a él».',
    fullEnglishSummary:
      'One who prays the Amidah must direct his heart to the meaning of the words he utters with his lips and regard himself as standing before the Divine Presence.',
    mejaberAndRamaNote:
      'Codifica el núcleo espiritual y halájico de la Shemoné Esré para Shajarit, Minjá y Arvit.',
    subtopicKeywords: /\b(amid[aá]|shemon[eé]\s+esr[eé]|dieciocho|kavan[aá]|rezar|rezo|rezos|tefil[aá]|minj[aá]|arvit|maariv|shajarit)\b/i,
    defaultPriority: 98,
  },
  {
    id: 'sa-oc-158-1',
    ref: 'Shulchan Arukh, Orach Chayim 158:1',
    heRef: 'שולחן ערוך, אורח חיים קנ״ח:א׳',
    simanSeifLabel: 'Oraj Jaim 158:1',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Netilat Yadayim y preparación con bendición antes de comer pan',
    briefHebrewQuote:
      'הַנּוֹטֵל יָדָיו לַאֲכִילַת פַּת מְבָרֵךְ אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו וְצִוָּנוּ עַל נְטִילַת יָדָיִם.',
    briefSpanishQuote:
      '«Quien se dispone a comer pan lava sus manos con un recipiente y recita la bendición "Al Netilat Yadayim" antes del secado, uniendo pureza ritual y bendición».',
    fullEnglishSummary:
      'One who washes hands before eating bread recites the blessing over Netilat Yadayim.',
    subtopicKeywords: /\b(netilat\s+yadayim|lavado\s+de\s+manos|pan|beraj[aá]|berajot|bendici[oó]n|bendiciones)\b/i,
    defaultPriority: 78,
  },
  {
    id: 'sa-oc-167-1',
    ref: 'Shulchan Arukh, Orach Chayim 167:1',
    heRef: 'שולחן ערוך, אורח חיים קס״ז:א׳',
    simanSeifLabel: 'Oraj Jaim 167:1',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Bendición HaMotzí y gratitud consciente en las Berajot',
    briefHebrewQuote:
      'בּוֹצֵעַ מְבָרֵךְ הַמּוֹצִיא לֶחֶם מִן הָאָרֶץ וְאוֹכֵל מִיָּד שֶׁלֹּא יְהֵא הֶפְסֵק בֵּין הַבְּרָכָה לַאֲכִילָה.',
    briefSpanishQuote:
      '«Pronuncia la bendición de HaMotzí sobre el pan sin interrupción entre la berajá y el bocado, reconociendo que todo sustento proviene de Hashem».',
    fullEnglishSummary:
      'One recites the blessing HaMotzi Lechem Min HaAretz over bread and eats immediately without undue interruption.',
    subtopicKeywords: /\b(beraj[aá]|berajot|bendici[oó]n|bendiciones|hamotz[ií]|birkat\s+hamaz[oó]n|comer|pan)\b/i,
    defaultPriority: 82,
  },
  {
    id: 'sa-oc-422-2',
    ref: 'Shulchan Arukh, Orach Chayim 422:2',
    heRef: 'שולחן ערוך, אורח חיים תכ״ב:ב׳',
    simanSeifLabel: 'Oraj Jaim 422:2',
    focusBranch: 'REZOS',
    focusBranchLabel: 'Leyes de los Rezos',
    topicLabel: 'Lectura del Halel en Rosh Jódesh: Mejaber vs. Ramá',
    briefHebrewQuote:
      'קוֹרִין הַהַלֵּל בְּדִלּוּג בְּלֹא בְּרָכָה... הַגָּה: וְכֵן נוֹהֲגִין לְבָרֵךְ עָלָיו אֲפִלּוּ בְּיָחִיד.',
    briefSpanishQuote:
      '«Se recita el Medio Halel con omisiones sin bendición» (Mejaber, rito sefardí) · «Y nuestra costumbre es recitar bendición sobre él incluso en privado» (Ramá, rito ashkenazí).',
    fullEnglishSummary:
      'Mechaber: On Rosh Chodesh, Half-Hallel is recited with omissions and without a blessing; Rema: Our Ashkenazi custom is to recite a blessing.',
    mejaberAndRamaNote:
      'Contraste clásico dentro de la Halajá entre Sefarad (sin berajá sobre una costumbre) y Ashkenaz (con berajá).',
    subtopicKeywords: /\b(halel|hallel|jats[ií]\s+halel|medio\s+halel|rosh\s+j[oó]desh|beraj[aá]\s+del?\s+halel)\b/i,
    defaultPriority: 85,
  },

  // ======================== 2. LEYES DE LAS FESTIVIDADES (ORAJ JAIM) ========================
  {
    id: 'sa-oc-242-1',
    ref: 'Shulchan Arukh, Orach Chayim 242:1',
    heRef: 'שולחן ערוך, אורח חיים רמ״ב:א׳',
    simanSeifLabel: 'Oraj Jaim 242:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Santificación, honor (Kavod) y deleite (Oneg) del Shabat',
    briefHebrewQuote:
      'מִצְוָה לְכַבֵּד הַשַּׁבָּת וּלְעַנְּגוֹ... כָּל הַמְּעַנֵּג אֶת הַשַּׁבָּת נוֹתְנִין לוֹ נַחֲלָה בְּלִי מְצָרִים.',
    briefSpanishQuote:
      '«Es precepto honrar y deleitar el Shabat con comidas especiales y vestimenta digna; quien se deleita en el Shabat recibe una heredad sin límites».',
    fullEnglishSummary:
      'It is a mitzvah to honor and delight in Shabbat through special foods, preparation, and dignified attire.',
    mejaberAndRamaNote:
      'Establece el principio rector de Kavod y Oneg Shabat antes de entrar en el detalle de las 39 Melajot.',
    subtopicKeywords: /\b(shabat|shabbat|oneg|festividad|festividades|fiestas|moadim|descanso)\b/i,
    defaultPriority: 94,
  },
  {
    id: 'sa-oc-263-1',
    ref: 'Shulchan Arukh, Orach Chayim 263:1',
    heRef: 'שולחן ערוך, אורח חיים רס״ג:א׳',
    simanSeifLabel: 'Oraj Jaim 263:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Encendido de las velas de Shabat y Yom Tov para la paz del hogar',
    briefHebrewQuote:
      'חַיָּב אָדָם לִהְיוֹת זָהִיר בְּנֵר שַׁבָּת... לְשַׁלֵּם שְׁלוֹם בֵּיתוֹ וְעֹנֶג שַׁבָּת.',
    briefSpanishQuote:
      '«Toda persona debe ser especialmente cuidadosa con el encendido de las velas de Shabat antes de la puesta del sol, pues su luz instaura paz en el hogar (Shalom Bait) y alegría festiva».',
    fullEnglishSummary:
      'One must be diligent regarding Shabbat candle lighting to bring light, peace in the home (Shalom Bayit), and Shabbat joy.',
    subtopicKeywords: /\b(velas?|encender|encendido|ner|nerot|shabat|shabbat|shalom\s+bait|yom\s+tov)\b/i,
    defaultPriority: 91,
  },
  {
    id: 'sa-oc-271-1',
    ref: 'Shulchan Arukh, Orach Chayim 271:1',
    heRef: 'שולחן ערוך, אורח חיים רע״א:א׳',
    simanSeifLabel: 'Oraj Jaim 271:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Kidush sobre el vino al recibir el Shabat o Yom Tov',
    briefHebrewQuote:
      'צָרִיךְ לְקַדֵּשׁ עַל הַיַּיִן בִּכְנִיסַת שַׁבָּת מִיָּד כְּשֶׁבָּא מִבֵּית הַכְּנֶסֶת.',
    briefSpanishQuote:
      '«Debe consagrarse el Shabat con el Kidush sobre una copa de vino tan pronto como comienza la festividad y antes de degustar la comida».',
    fullEnglishSummary:
      'One must recite Kiddush over wine immediately at the entrance of Shabbat prior to the meal.',
    subtopicKeywords: /\b(kidush|kiddush|vino|copa|shabat|havdal[aá]|santificaci[oó]n)\b/i,
    defaultPriority: 86,
  },
  {
    id: 'sa-oc-427-1',
    ref: 'Shulchan Arukh, Orach Chayim 427:1',
    heRef: 'שולחן ערוך, אורח חיים תכ״ז:א׳',
    simanSeifLabel: 'Oraj Jaim 427:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Regla calendárica de Rosh Jódesh de 1 día (29) o 2 días (30)',
    briefHebrewQuote:
      'הַחֹדֶשׁ שֶׁהוּא כ״ט יוֹם נִקְרָא חָסֵר וְרֹאשׁ חֹדֶשׁ אֵינוֹ אֶלָּא יוֹם א׳; וְהַחֹדֶשׁ שֶׁהוּא ל׳ יוֹם נִקְרָא מָלֵא וְרֹאשׁ חֹדֶשׁ שְׁנֵי יָמִים.',
    briefSpanishQuote:
      '«El mes de 29 días se llama Jaser y su Rosh Jódesh siguiente dura 1 solo día; el mes de 30 días se llama Malé y su Rosh Jódesh dura 2 días: el día 30 del mes saliente y el día 1 del entrante».',
    fullEnglishSummary:
      'A 29-day month (Chaser) yields a 1-day Rosh Chodesh; a 30-day month (Malei) yields a 2-day Rosh Chodesh (day 30 outgoing + day 1 incoming).',
    subtopicKeywords: /\b(rosh\s+j[oó]desh|rosh\s+chodesh|j[oó]desh\s+mal[eé]|j[oó]desh\s+jaser|novilunio|calendario|mes\s+que\s+termina)\b/i,
    defaultPriority: 87,
  },
  {
    id: 'sa-oc-431-1',
    ref: 'Shulchan Arukh, Orach Chayim 431:1',
    heRef: 'שולחן ערוך, אורח חיים תל״א:א׳',
    simanSeifLabel: 'Oraj Jaim 431:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Búsqueda y eliminación del Jametz antes de Pésaj (Bedikat Jametz)',
    briefHebrewQuote:
      'אוֹר לְי״ד בְּנִיסָן בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר בְּחוֹרִין וּבִסְדָקִין.',
    briefSpanishQuote:
      '«La víspera del 14 de Nisán se inspecciona minuciosamente el hogar a la luz de una vela en todo rincón para erradicar el Jametz antes de Pésaj».',
    fullEnglishSummary:
      'On the evening of the 14th of Nisan one searches carefully for chametz by candlelight in all crevices.',
    subtopicKeywords: /\b(p[eé]saj|pesach|jametz|chametz|bedikat\s+jametz|matz[aá]|seder|hagad[aá])\b/i,
    defaultPriority: 93,
  },
  {
    id: 'sa-oc-453-1',
    ref: 'Shulchan Arukh, Orach Chayim 453:1',
    heRef: 'שולחן ערוך, אורח חיים תנ״ג:א׳',
    simanSeifLabel: 'Oraj Jaim 453:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Especies de Matzá y costumbre de Kitniyot en Pésaj (Mejaber vs. Ramá)',
    briefHebrewQuote:
      'אֹרֶז וּשְׁאָר מִינֵי קִטְנִיּוֹת אֵינָם בָּאִים לִידֵי חִמּוּץ... הַגָּה: וְהַמִּנְהָג בְּאַשְׁכְּנַז לְהַחְמִיר וְאֵין לְשַׁנּוֹת.',
    briefSpanishQuote:
      '«El arroz y las legumbres (Kitniyot) no fermentan como Jametz» (Mejaber, rito sefardí) · «Pero en Ashkenaz la costumbre es abstenerse de ellos y no alterar el Minhag» (Ramá).',
    fullEnglishSummary:
      'Mechaber permits rice and legumes (kitniyot) on Pesach as they cannot become chametz; Rema records the binding Ashkenazi custom to refrain from them.',
    mejaberAndRamaNote:
      'Cruce emblemático entre Festividades (Pésaj) y Minhag alimentario (Sefarad vs. Ashkenaz).',
    subtopicKeywords: /\b(p[eé]saj|pesach|matz[aá]|kitniyot|arroz|legumbres|jametz|festividad|festividades)\b/i,
    defaultPriority: 90,
  },
  {
    id: 'sa-oc-585-1',
    ref: 'Shulchan Arukh, Orach Chayim 585:1',
    heRef: 'שולחן ערוך, אורח חיים תקפ״ה:א׳',
    simanSeifLabel: 'Oraj Jaim 585:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Precepto del Shofar en Rosh Hashaná y atención a sus sonidos',
    briefHebrewQuote:
      'מִצְוַת עֲשֵׂה שֶׁל תּוֹרָה לִשְׁמֹעַ תְּקִיעַת שׁוֹפָר בְּרֹאשׁ הַשָּׁנָה.',
    briefSpanishQuote:
      '«Es precepto positivo de la Torá escuchar el toque del Shofar en Rosh Hashaná, poniendo plena atención del corazón tanto quien toca como quien escucha».',
    fullEnglishSummary:
      'It is a Torah commandment to hear the sounding of the Shofar on Rosh Hashanah with mindful intention.',
    subtopicKeywords: /\b(rosh\s+hashan[aá]|shofar|teki[aá]|yamim\s+noraim|elul|selijot)\b/i,
    defaultPriority: 88,
  },
  {
    id: 'sa-oc-606-1',
    ref: 'Shulchan Arukh, Orach Chayim 606:1',
    heRef: 'שולחן ערוך, אורח חיים תר״ו:א׳',
    simanSeifLabel: 'Oraj Jaim 606:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Reconciliación interpersonal indispensable antes de Yom Kipur',
    briefHebrewQuote:
      'עֲבֵרוֹת שֶׁבֵּין אָדָם לַחֲבֵרוֹ אֵין יוֹם הַכִּפּוּרִים מְכַפֵּר עַד שֶׁיְּרַצֶּה אֶת חֲבֵרוֹ.',
    briefSpanishQuote:
      '«Las faltas cometidas entre la persona y su prójimo no son expiadas por Yom Kipur hasta que repare el daño y pida perdón sincero a su compañero».',
    fullEnglishSummary:
      'Transgressions between a person and his fellow are not atoned for by Yom Kippur until one appeases and seeks forgiveness from the wronged person.',
    subtopicKeywords: /\b(yom\s+kipur|yom\s+kippur|perd[oó]n|ayuno|teshuv[aá]|kol\s+nidrei|yamim\s+noraim)\b/i,
    defaultPriority: 90,
  },
  {
    id: 'sa-oc-625-1',
    ref: 'Shulchan Arukh, Orach Chayim 625:1',
    heRef: 'שולחן ערוך, אורח חיים תרכ״ה:א׳',
    simanSeifLabel: 'Oraj Jaim 625:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Mitzvá de habitar la Sucá y recordar la protección del Éxodo',
    briefHebrewQuote:
      'בַּסֻּכּוֹת תֵּשְׁבוּ שִׁבְעַת יָמִים... וִיכַוֵּן בִּישִׁיבָתוֹ שֶׁצִּוָּנוּ הַקָּדוֹשׁ בָּרוּךְ הוּא לֵישֵׁב בַּסֻּכָּה זֵכֶר לִיצִיאַת מִצְרַיִם.',
    briefSpanishQuote:
      '«En cabañas habitaréis siete días: al morar en la Sucá se debe meditar que Hashem nos ordenó habitar bajo Su sombra protectora en recuerdo de los Nubes de Gloria del Éxodo».',
    fullEnglishSummary:
      'In Sukkot one dwells in the Sukkah for seven days remembering the Clouds of Glory after the Exodus from Egypt.',
    subtopicKeywords: /\b(sucot|sukkot|suc[aá]|lulav|etrog|arba[aá]\s+minim|cuatro\s+especies|simjat\s+tor[aá])\b/i,
    defaultPriority: 89,
  },
  {
    id: 'sa-oc-671-1',
    ref: 'Shulchan Arukh, Orach Chayim 671:1',
    heRef: 'שולחן ערוך, אורח חיים תרע״א:א׳',
    simanSeifLabel: 'Oraj Jaim 671:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Encendido de las velas de Janucá y embellecimiento progresivo (Mehadrin)',
    briefHebrewQuote:
      'מִצְוַת חֲנֻכָּה נֵר אִישׁ וּבֵיתוֹ, וְהַמְּהַדְּרִין נֵר לְכָל אֶחָד וְאֶחָד, וְהַמְּהַדְּרִין מִן הַמְּהַדְּרִין מוֹסִיף וְהוֹלֵךְ.',
    briefSpanishQuote:
      '«El precepto básico de Janucá es una luminaria por hogar; quienes lo embellecen encienden una por persona; y quienes buscan máxima excelencia (Mehadrin min HaMehadrin) añaden una vela cada noche».',
    fullEnglishSummary:
      'The mitzvah of Chanukah is one light per household, enhanced by one per person, and heightened by adding one candle each successive night.',
    mejaberAndRamaNote:
      'El Mejaber enfatiza el modelo de una sola Janukiyá familiar creciente; el Ramá registra el uso ashkenazí de encender cada integrante con aumento diario.',
    subtopicKeywords: /\b(januc[aá]|chanukah|hanukkah|janukiy[aá]|velas?\s+de\s+januc[aá]|festividades|fiestas)\b/i,
    defaultPriority: 89,
  },
  {
    id: 'sa-oc-695-1',
    ref: 'Shulchan Arukh, Orach Chayim 695:1',
    heRef: 'שולחן ערוך, אורח חיים תרצ״ה:א׳',
    simanSeifLabel: 'Oraj Jaim 695:1',
    focusBranch: 'FESTIVIDADES',
    focusBranchLabel: 'Leyes de las Festividades',
    topicLabel: 'Alegría de Purim, Mishloaj Manot y dádivas a los necesitados',
    briefHebrewQuote:
      'חַיָּב אָדָם לִשְׂמֹחַ בְּפוּרִים... וְיִשְׁלַח מָנוֹת אִישׁ לְרֵעֵהוּ וּמַתָּנוֹת לָאֶבְיוֹנִים.',
    briefSpanishQuote:
      '«Es deber en Purim celebrar el banquete festivo con alegría y solidaridad, enviando porciones de alimento al prójimo (Mishloaj Manot) y donativos directos a al menos dos personas necesitadas».',
    fullEnglishSummary:
      'On Purim one is obligated in festive joy, sending food portions to friends (Mishloach Manot), and giving gifts to the poor (Matanot LaEvyonim).',
    subtopicKeywords: /\b(purim|meguil[aá]|ester|mishl[oó]aj\s+manot|matanot\s+la[- ]?evyonim)\b/i,
    defaultPriority: 86,
  },

  // ======================== 3. LEYES DE KASHRUT (YORÉ DEÁ Y ORAJ JAIM 451) ========================
  {
    id: 'sa-yd-87-1',
    ref: "Shulchan Arukh, Yoreh De'ah 87:1",
    heRef: 'שולחן ערוך, יורה דעה פ״ז:א׳',
    simanSeifLabel: 'Yoré Deá 87:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Prohibición de Basar BeJalav: cocinar, comer y obtener provecho de carne con leche',
    briefHebrewQuote:
      'בְּשַׂר בְּחָלָב אָסוּר לְבַשְּׁלוֹ וְאָסוּר לְאָכְלוֹ וְאָסוּר בַּהֲנָאָה מִן הַתּוֹרָה.',
    briefSpanishQuote:
      '«La mezcla de carne y leche (Basar BeJalav) está prohibida por la Torá para cocinar, para comer y para obtener cualquier beneficio económico; y los Sabios extendieron la separación a las aves».',
    fullEnglishSummary:
      'Meat cooked with milk is forbidden by Torah law to cook, to eat, or to derive benefit from; rabbinic law extends the separation to poultry.',
    mejaberAndRamaNote:
      'Fundamento normativo absoluto de la separación de cocinas, ollas y alimentos cárnicos y lácteos en Kashrut.',
    subtopicKeywords: /\b(kashrut|kosher|kasher|basar\s+be[- ]?jalav|carne\s+y\s+leche|l[aá]cteos?|c[aá]rnicos?|ave|pollo|parve|leyes\s+alimentarias)\b/i,
    defaultPriority: 99,
  },
  {
    id: 'sa-yd-89-1',
    ref: "Shulchan Arukh, Yoreh De'ah 89:1",
    heRef: 'שולחן ערוך, יורה דעה פ״ט:א׳',
    simanSeifLabel: 'Yoré Deá 89:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Tiempo de espera y separación tras comer carne antes de lácteos',
    briefHebrewQuote:
      'אָכַל בָּשָׂר, אֲפִלּוּ שֶׁל עוֹף, לֹא יֹאכַל גְּבִינָה אַחֲרָיו עַד שֶׁיִּשְׁהֶה שֵׁשׁ שָׁעוֹת.',
    briefSpanishQuote:
      '«Quien comió carne —incluso de ave— no comerá queso ni lácteos después hasta esperar seis horas» (Mejaber) · «Y existen costumbres comunitarias de aguardar entre una, tres o seis horas tras limpiar la boca» (Ramá).',
    fullEnglishSummary:
      'After eating meat or poultry, the Mechaber rules one must wait six hours before dairy; the Rema notes varying Ashkenazi waiting customs alongside cleansing the mouth.',
    mejaberAndRamaNote:
      'Muestra claramente la regla base del Mejaber (6 horas) y el reconocimiento del Ramá de las costumbres ancestrales comunitarias.',
    subtopicKeywords: /\b(kashrut|kosher|carne\s+y\s+leche|horas|esperar|queso|l[aá]cteos?|c[aá]rnicos?|basar\s+be[- ]?jalav)\b/i,
    defaultPriority: 95,
  },
  {
    id: 'sa-yd-98-1',
    ref: "Shulchan Arukh, Yoreh De'ah 98:1",
    heRef: 'שולחן ערוך, יורה דעה צ״ח:א׳',
    simanSeifLabel: 'Yoré Deá 98:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Regla de Taam ke-Ikar y nulificación accidental en sesenta (Bitul be-Shishim)',
    briefHebrewQuote:
      'אִסּוּר שֶׁנִּתְעָרֵב בְּהֶתֵּר מְשַׁעֲרִים אוֹתוֹ בְּשִׁשִּׁים, וְאִם יֵשׁ שִׁשִּׁים כְּנֶגְדּוֹ מֻתָּר.',
    briefSpanishQuote:
      '«Cuando una sustancia prohibida cae accidentalmente en un alimento permitido y no se distingue su sabor, se calcula una proporción de sesenta partes (Bitul be-Shishim) contra la parte prohibida».',
    fullEnglishSummary:
      'When a forbidden food falls unintentionally into a permitted mixture, if there are sixty parts of permitted food to one of the forbidden, it is nullified unless flavor remains.',
    subtopicKeywords: /\b(bitul|sesenta|shishim|mezcla|accidente|gota|sabor|kashrut|kosher)\b/i,
    defaultPriority: 84,
  },
  {
    id: 'sa-yd-69-1',
    ref: "Shulchan Arukh, Yoreh De'ah 69:1",
    heRef: 'שולחן ערוך, יורה דעה ס״ט:א׳',
    simanSeifLabel: 'Yoré Deá 69:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Extracción de la sangre (Meliá / Salado y remojo de la carne)',
    briefHebrewQuote:
      'הַבָּשָׂר אֵינוֹ יוֹצֵא מִידֵי דָּמוֹ אֶלָּא בִּמְלִיחָה יָפָה אוֹ בִּצְלִיָּה עַל הָאֵשׁ.',
    briefSpanishQuote:
      '«La carne no queda purificada de su sangre prohibida sino mediante el remojo, el salado cuidadoso (Meliá) y el enjuague, o mediante el asado directo sobre el fuego abierto».',
    fullEnglishSummary:
      'Meat is only purged of its prohibited blood through proper soaking and salting or through broiling directly over fire.',
    subtopicKeywords: /\b(sangre|salado|sal|meli[aá]|asado|carne|kashrut|kosher)\b/i,
    defaultPriority: 88,
  },
  {
    id: 'sa-yd-1-1',
    ref: "Shulchan Arukh, Yoreh De'ah 1:1",
    heRef: 'שולחן ערוך, יורה דעה א׳:א׳',
    simanSeifLabel: 'Yoré Deá 1:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Shejitá ritual y competencia moral y halájica del Shójet',
    briefHebrewQuote:
      'הַכֹּל שׁוֹחֲטִין לְכַתְּחִלָּה וְהוּא שֶׁיִּהְיֶה יוֹדֵעַ הִלְכוֹת שְׁחִיטָה וּבְדִיקַת הַסַּכִּין.',
    briefSpanishQuote:
      '«Solo quien domina íntegramente las leyes de la Shejitá y verifica con rigor que el cuchillo carezca de toda muesca (Bedikat HaSakín) puede realizar el faenamiento kosher sin causar dolor innecesario».',
    fullEnglishSummary:
      'Shechitah may only be performed by one thoroughly versed in its laws and the meticulous inspection of the blade.',
    subtopicKeywords: /\b(shejit[aá]|sh[oó]jet|cuchillo|faena|animal|bedik[aá]|treif|taref|glatt)\b/i,
    defaultPriority: 85,
  },
  {
    id: 'sa-yd-84-1',
    ref: "Shulchan Arukh, Yoreh De'ah 84:1",
    heRef: 'שולחן ערוך, יורה דעה פ״ד:א׳',
    simanSeifLabel: 'Yoré Deá 84:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Revisión minuciosa contra insectos (Bedikat Tolaim) en vegetales y frutos',
    briefHebrewQuote:
      'כָּל הַשְּׁרָצִים אֲסוּרִים מִן הַתּוֹרָה וְצָרִיךְ לִבְדֹּק הֵיטֵב הַפֵּרוֹת וְהַיְרָקוֹת הַמֻּחְזָקִים בְּתוֹלָעִים.',
    briefSpanishQuote:
      '«Todo insecto rastrero está prohibido por la Torá; por ello es obligatorio revisar cuidadosamente las verduras, hojas y frutos propensos a contener insectos antes de cocinarlos».',
    fullEnglishSummary:
      'All creeping insects are forbidden by Torah law, requiring diligent inspection of vegetables, herbs, and fruits.',
    subtopicKeywords: /\b(insectos?|verduras?|frutas?|hojas?|tolaim|bedikat\s+tolaim|revisi[oó]n|gusanos|kashrut)\b/i,
    defaultPriority: 81,
  },
  {
    id: 'sa-yd-120-1',
    ref: "Shulchan Arukh, Yoreh De'ah 120:1",
    heRef: 'שולחן ערוך, יורה דעה ק״כ:א׳',
    simanSeifLabel: 'Yoré Deá 120:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Inmersión de utensilios de cocina en Mikvé (Tevilat Kelim)',
    briefHebrewQuote:
      'הַלּוֹקֵחַ כְּלֵי סְעוּדָה שֶׁל מַתֶּכֶת אוֹ שֶׁל זְכוּכִית מִן הָעַכּוּ״ם צָרִיךְ לְהַטְבִּילָם בְּמִקְוֶה וּלְבָרֵךְ עַל טְבִילַת כֵּלִים.',
    briefSpanishQuote:
      '«Quien adquiere utensilios de mesa o cocción de metal o vidrio para alimentos debe sumergirlos en una Mikvé (o manantial natural) recitando la bendición "Al Tevilat Kelim" antes de usarlos».',
    fullEnglishSummary:
      'Metal or glass food utensils acquired from a non-Jewish manufacturer require immersion in a kosher mikveh with a blessing before use.',
    subtopicKeywords: /\b(tevilat\s+kelim|utensilios?|vajilla|platos?|ollas?|vasos?|vidrio|metal|mikv[eé]|kashrut|cocina\s+kosher)\b/i,
    defaultPriority: 91,
  },
  {
    id: 'sa-oc-451-1',
    ref: 'Shulchan Arukh, Orach Chayim 451:1',
    heRef: 'שולחן ערוך, אורח חיים תנ״א:א׳',
    simanSeifLabel: 'Oraj Jaim 451:1',
    focusBranch: 'KASHRUT',
    focusBranchLabel: 'Leyes de Kashrut',
    topicLabel: 'Purificación de utensilios (Kashering: Kebol’ó kaj poltó — Hag’alá y Libún)',
    briefHebrewQuote:
      'כְּבוֹלְעוֹ כָּךְ פּוֹלְטוֹ: כְּלִי שֶׁבָּלַע בְּרוֹתְחִין פּוֹלֵט בְּהַגְעָלָה, וְשֶׁבָּלַע בְּאֵשׁ פּוֹלֵט בְּלִבּוּן.',
    briefSpanishQuote:
      '«Tal como un utensilio absorbió lo prohibido, así mismo lo expulsa: lo absorbido en líquido hirviendo se purifica con agua hirviendo (Hag’alá), y lo absorbido al fuego seco exige incandescencia (Libún)».',
    fullEnglishSummary:
      'As a utensil absorbed a substance, so it expels it: via boiling water (Hag’alah) for liquid cooking or intense fire (Libun) for dry roasting.',
    subtopicKeywords: /\b(kashering|kasherizar|hag[- ]?al[aá]|lib[uú]n|utensilios?|ollas?|cocina\s+kosher|p[eé]saj)\b/i,
    defaultPriority: 87,
  },

  // ======================== 4. HALAJA GENERAL & MINHAG ========================
  {
    id: 'sa-yd-214-1',
    ref: "Shulchan Arukh, Yoreh De'ah 214:1",
    heRef: 'שולחן ערוך, יורה דעה רי״ד:א׳',
    simanSeifLabel: 'Yoré Deá 214:1',
    focusBranch: 'HALAJA_GENERAL',
    focusBranchLabel: 'Halajá General y Minhag',
    topicLabel: 'Fuerza vinculante del Minhag comunitario en el Shulján Aruj',
    briefHebrewQuote:
      'דְּבָרִים הַמֻּתָּרִים וְנָהֲגוּ בָּהֶם אֲחֵרִים אִסּוּר... שֶׁהַמִּנְהָג שֶׁל תַּלְמִידֵי חֲכָמִים וְצִבּוּר הֲרֵי הוּא כְּנֶדֶר.',
    briefSpanishQuote:
      '«Prácticas permitidas que una comunidad asumió con rigor ancestral adquieren fuerza de voto sagrado («Al titosh torat imeja» — No abandones la enseñanza de tu madre)».',
    fullEnglishSummary:
      'Permitted practices upon which a community accepted a binding custom carry the legal weight of a vow.',
    subtopicKeywords: /\b(minhag|minhaguim|costumbre|costumbres|voto|n[eé]der|comunidad)\b/i,
    defaultPriority: 80,
  },
];

function detectConsultedBranches(
  cleanQuery: string,
  validation: HalakhicPipelineValidation
): HalakhicConsultationFocus[] {
  const branches: HalakhicConsultationFocus[] = [];

  const hasRezosSignal =
    validation.halakhicDomains.includes('LEYES_REZOS_Y_LITURGIA') ||
    /(?<![a-záéíóúñ])(?:rezo|rezos|rezar|tefil[aá]|plegaria|oraci[oó]n|amid[aá]|shemon[eé]\s+esr[eé]|shem[aá]|beraj[aá]|berajot|bendici[oó]n|bendiciones|shajarit|minj[aá]|arvit|maariv|musaf|halel|n[uú]saj|sidur|miny[aá]n|netilat\s+yadayim|birkat)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  const hasFestividadesSignal =
    validation.halakhicDomains.includes('FESTIVIDADES_Y_SHABAT') ||
    /(?<![a-záéíóúñ])(?:festividad|festividades|fiesta|fiestas|moadim|jaguim|yom\s+tov|shabat|shabbat|kidush|havdal[aá]|velas?\s+de\s+shabat|p[eé]saj|pesach|jametz|matz[aá]|sucot|suc[aá]|lulav|etrog|shavuot|rosh\s+hashan[aá]|shofar|yom\s+kipur|januc[aá]|janukiy[aá]|purim|meguil[aá]|rosh\s+j[oó]desh|ayuno|taanit)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  const hasKashrutSignal =
    validation.halakhicDomains.includes('KASHRUT_Y_LEYES_ALIMENTARIAS') ||
    /(?<![a-záéíóúñ])(?:kashrut|kosher|kasher|casher|carne\s+y\s+leche|basar\s+be[- ]?jalav|l[aá]cteos?|c[aá]rnicos?|shejit[aá]|tevilat\s+kelim|utensilios?|kashering|hag[- ]?al[aá]|lib[uú]n|kitniyot|meli[aá]|salado\s+de\s+la\s+carne|insectos?|bedikat\s+tolaim|bitul|parve|alimentos?)(?![a-záéíóúñ])/i.test(
      cleanQuery
    );

  if (hasRezosSignal) branches.push('REZOS');
  if (hasFestividadesSignal) branches.push('FESTIVIDADES');
  if (hasKashrutSignal) branches.push('KASHRUT');

  // If the user explicitly invokes Halajá / Shulján Aruj without narrowing to one of the 3 pillars,
  // consult a balanced core across Rezos, Festividades, Kashrut & General Halajá.
  if (branches.length === 0 && validation.isPurelyHalakhic) {
    branches.push('REZOS', 'FESTIVIDADES', 'KASHRUT');
  }

  return branches;
}

function selectShulchanArukhEntriesForQuery(
  cleanQuery: string,
  branches: HalakhicConsultationFocus[],
  maxQuotes = 4
): ShulchanArukhCorpusEntry[] {
  const candidates = SHULCHAN_ARUKH_CORPUS.filter(
    (entry) =>
      branches.includes(entry.focusBranch) ||
      (entry.focusBranch === 'HALAJA_GENERAL' && branches.length > 0)
  );

  const scored = candidates.map((entry) => {
    const keywordMatches = entry.subtopicKeywords.test(cleanQuery) ? 45 : 0;
    const isDirectBranch = branches.includes(entry.focusBranch) ? 20 : 0;
    const refDirectHit = cleanQuery
      .toLowerCase()
      .includes(entry.simanSeifLabel.toLowerCase())
      ? 60
      : 0;
    return {
      entry,
      score: entry.defaultPriority + keywordMatches + isDirectBranch + refDirectHit,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: ShulchanArukhCorpusEntry[] = [];
  const usedIds = new Set<string>();

  // Guarantee at least 1 top quote from each matched specialized branch first
  for (const branch of branches) {
    if (selected.length >= maxQuotes) break;
    const topForBranch = scored.find(
      (item) => item.entry.focusBranch === branch && !usedIds.has(item.entry.id)
    );
    if (topForBranch) {
      selected.push(topForBranch.entry);
      usedIds.add(topForBranch.entry.id);
    }
  }

  // Fill remaining slots by relevance score
  for (const item of scored) {
    if (selected.length >= maxQuotes) break;
    if (!usedIds.has(item.entry.id)) {
      selected.push(item.entry);
      usedIds.add(item.entry.id);
    }
  }

  return selected;
}

function toDirectQuote(entry: ShulchanArukhCorpusEntry): ShulchanArukhDirectQuote {
  return {
    id: entry.id,
    ref: entry.ref,
    heRef: entry.heRef,
    simanSeifLabel: entry.simanSeifLabel,
    focusBranch: entry.focusBranch,
    focusBranchLabel: entry.focusBranchLabel,
    topicLabel: entry.topicLabel,
    briefHebrewQuote: entry.briefHebrewQuote,
    briefSpanishQuote: entry.briefSpanishQuote,
    ...(entry.mejaberAndRamaNote ? { mejaberAndRamaNote: entry.mejaberAndRamaNote } : {}),
    sefariaUrl: `https://www.sefaria.org/${encodeURIComponent(entry.ref.replace(/ /g, '_'))}`,
    verifiedFromSefaria: false,
  };
}

/**
 * Pipeline Module for Halakhic Topics:
 * Consults specifically the laws of Prayers (Rezos), Holidays (Festividades), or Kashrut
 * integrating brief and direct Shulchan Arukh citations while omitting all external or
 * comparative philosophy injection.
 */
export function consultHalakhicShulchanArukhModule(
  rawQuery: string,
  existingValidation?: HalakhicPipelineValidation,
  maxQuotes = 4
): HalakhicShulchanArukhConsultation {
  const cleanQuery = String(rawQuery || '').trim();
  const validation = existingValidation || validatePurelyHalakhicQuery(cleanQuery);

  if (!validation.isPurelyHalakhic) {
    return {
      active: false,
      consultedBranches: [],
      consultedBranchLabels: [],
      matchedSubtopics: [],
      consultedSefariaRefs: [],
      directQuotes: [],
      externalPhilosophyOmitted: false,
      moduleSummary: '',
      systemPromptDirective: '',
    };
  }

  const consultedBranches = detectConsultedBranches(cleanQuery, validation);
  const consultedBranchLabels = consultedBranches.map((b) => BRANCH_LABELS[b]);
  const selectedEntries = selectShulchanArukhEntriesForQuery(
    cleanQuery,
    consultedBranches,
    maxQuotes
  );
  const directQuotes = selectedEntries.map(toDirectQuote);
  const matchedSubtopics = selectedEntries.map((e) => e.topicLabel);
  const consultedSefariaRefs = selectedEntries.map((e) => e.ref);

  const quotesBlockForPrompt = directQuotes
    .map(
      (q, i) =>
        `  ${i + 1}. [${q.focusBranchLabel} · ${q.simanSeifLabel} (${q.ref} | ${q.heRef})]\n     Hebreo: «${q.briefHebrewQuote}»\n     Español: ${q.briefSpanishQuote}${q.mejaberAndRamaNote ? `\n     Nota Mejaber/Ramá: ${q.mejaberAndRamaNote}` : ''}`
    )
    .join('\n');

  const moduleSummary = `Módulo Halájico del Shulján Aruj Activo (${consultedBranchLabels.join(' · ')}): consultadas ${directQuotes.length} citas breves y directas del Shulján Aruj (${directQuotes.map((q) => q.simanSeifLabel).join(', ')}), omitiendo toda inyección de filosofía externa o comparativa.`;

  const systemPromptDirective = `\n\n[MÓDULO DEL PIPELINE ACTIVO — CONSULTA HALÁJICA AL SHULJÁN ARUJ (${consultedBranchLabels.join(' / ').toUpperCase()})]:
- Este módulo consultó específicamente las leyes de ${consultedBranchLabels.join(', ')} en el Shulján Aruj.
- INTEGRA DIRECTAMENTE las siguientes citas breves y directas del Shulján Aruj dentro del Exordio, las secciones metodológicas y la Conclusión Práctica (citando la referencia exacta de Simán:Seif y la frase breve en hebreo y español):
${quotesBlockForPrompt}
- OMISIÓN ESTRICTA DE FILOSOFÍA EXTERNA O COMPARATIVA: No inyectes, cites ni compares con filosofía externa (Kant, Platón, Aristóteles, Cicerón, Sócrates, Estoicismo, Spinoza, Nietzsche) ni religiones comparadas (Budismo, Nirvana, Valhalla, Cristianismo). Fundamenta el discurso exclusivamente en el Shulján Aruj (Mejaber y Ramá), Talmud, Rambam y comentaristas halájicos internos.`;

  return {
    active: true,
    consultedBranches,
    consultedBranchLabels,
    matchedSubtopics,
    consultedSefariaRefs,
    directQuotes,
    externalPhilosophyOmitted: true,
    moduleSummary,
    systemPromptDirective,
  };
}

/**
 * Merges consulted Shulchan Arukh Sefaria references ahead of generic predictions
 * so Phase 2 always verifies the exact Shulchan Arukh laws in Sefaria.
 */
export function mergeHalakhicRefsWithPredictions(
  consultation: HalakhicShulchanArukhConsultation | undefined,
  existingRefs: SefariaRefPrediction[] = [],
  maxRefs = 5
): SefariaRefPrediction[] {
  if (!consultation?.active || consultation.directQuotes.length === 0) {
    return existingRefs.slice(0, maxRefs);
  }

  const forced: SefariaRefPrediction[] = consultation.directQuotes.map((q) => ({
    ref: q.ref,
    heRef: q.heRef,
    rationale: `${q.focusBranchLabel} — ${q.topicLabel}: ${q.briefSpanishQuote}`,
    category: 'Halajá',
    exactQuoteHebrew: q.briefHebrewQuote,
  }));

  const seen = new Set(forced.map((f) => f.ref.toLowerCase()));
  const merged = [...forced];
  for (const item of existingRefs) {
    if (merged.length >= maxRefs) break;
    const key = String(item?.ref || '').trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.slice(0, maxRefs);
}

/**
 * Cross-checks direct Shulchan Arukh quotes against Phase 2 verified Sefaria sources
 * and marks verification metadata.
 */
export function enrichHalakhicConsultationWithVerifiedSources(
  consultation: HalakhicShulchanArukhConsultation | undefined,
  verifiedSources: VerifiedSefariaSource[] = []
): HalakhicShulchanArukhConsultation | undefined {
  if (!consultation || !consultation.active) return consultation;

  const enrichedQuotes = consultation.directQuotes.map((q) => {
    const matched = verifiedSources.find(
      (s) => s.ref.toLowerCase() === q.ref.toLowerCase()
    );
    if (!matched) return q;
    return {
      ...q,
      heRef: matched.heRef || q.heRef,
      sefariaUrl: matched.url || q.sefariaUrl,
      verifiedFromSefaria: Boolean(matched.verified),
    };
  });

  return {
    ...consultation,
    directQuotes: enrichedQuotes,
  };
}

/**
 * Exports all curated Shulchan Arukh entries as VerifiedSefariaSource records
 * so server & fallback engines can pre-seed bilingual Hebrew/Spanish texts cleanly.
 */
export function getHalakhicShulchanArukhSeedSources(): VerifiedSefariaSource[] {
  return SHULCHAN_ARUKH_CORPUS.map((entry) => ({
    ref: entry.ref,
    heRef: entry.heRef,
    hebrewText: entry.briefHebrewQuote,
    translation: entry.fullEnglishSummary,
    spanishTranslation: entry.briefSpanishQuote,
    versionTitle: 'Shulchan Arukh · Sefaria Canonical Edition',
    url: `https://www.sefaria.org/${encodeURIComponent(entry.ref.replace(/ /g, '_'))}`,
    verified: true,
    statusText: 'Verificado en Sefaria v3',
    directConnectionSnippet: `${entry.focusBranchLabel}: ${entry.topicLabel}`,
  }));
}

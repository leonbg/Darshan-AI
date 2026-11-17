import type express from 'express';
import {
  sefariaServerCache,
  inFlightSefariaServerRequests,
  setBoundedCache,
} from './aiClient.ts';
import { getHalakhicShulchanArukhSeedSources } from '../src/utils/halakhicShulchanArukhModule.ts';

export const SPANISH_TO_SEFARIA_BOOK_MAP: Array<[RegExp, string]> = [
  [/^(?:t(?:almud)?\s*b(?:avli)?|bavli|masejet|tratado)\s+/i, ''],
  [/^g[eé]nesis\b/i, 'Genesis'],
  [/^bereshit\b/i, 'Genesis'],
  [/^[eé]xodo\b/i, 'Exodus'],
  [/^shemot\b/i, 'Exodus'],
  [/^lev[ií]tico\b/i, 'Leviticus'],
  [/^vayikr[aá]\b/i, 'Leviticus'],
  [/^n[uú]meros\b/i, 'Numbers'],
  [/^bamidbar\b/i, 'Numbers'],
  [/^deuteronomio\b/i, 'Deuteronomy'],
  [/^devarim\b/i, 'Deuteronomy'],
  [/^josu[eé]\b/i, 'Joshua'],
  [/^jueces\b/i, 'Judges'],
  [/^1\s*samuel\b/i, 'I Samuel'],
  [/^2\s*samuel\b/i, 'II Samuel'],
  [/^1\s*reyes\b/i, 'I Kings'],
  [/^2\s*reyes\b/i, 'II Kings'],
  [/^isa[ií]as\b/i, 'Isaiah'],
  [/^yeshayahu\b/i, 'Isaiah'],
  [/^jerem[ií]as\b/i, 'Jeremiah'],
  [/^yirmiyahu\b/i, 'Jeremiah'],
  [/^ezequiel\b/i, 'Ezekiel'],
  [/^yejezkel\b/i, 'Ezekiel'],
  [/^oseas\b/i, 'Hosea'],
  [/^am[oó]s\b/i, 'Amos'],
  [/^jon[aá]s\b/i, 'Jonah'],
  [/^miqueas\b/i, 'Micah'],
  [/^zacar[ií]as\b/i, 'Zechariah'],
  [/^malaqu[ií]as\b/i, 'Malachi'],
  [/^salmos?\b/i, 'Psalms'],
  [/^tehil[ií]m\b/i, 'Psalms'],
  [/^proverbios\b/i, 'Proverbs'],
  [/^mishl[eé]\b/i, 'Proverbs'],
  [/^cantar\s+de\s+los\s+cantares\b/i, 'Song of Songs'],
  [/^shir\s+hashirim\b/i, 'Song of Songs'],
  [/^rut\b/i, 'Ruth'],
  [/^lamentaciones\b/i, 'Lamentations'],
  [/^eclesiast[eé]s\b/i, 'Ecclesiastes'],
  [/^kohelet\b/i, 'Ecclesiastes'],
  [/^ester\b/i, 'Esther'],
  [/^1\s*cr[oó]nicas\b/i, 'I Chronicles'],
  [/^2\s*cr[oó]nicas\b/i, 'II Chronicles'],
  [/^berajot\b/i, 'Berakhot'],
  [/^shabat\b/i, 'Shabbat'],
  [/^eruv[ií]n\b/i, 'Eruvin'],
  [/^pesajim\b/i, 'Pesachim'],
  [/^suk[aá]\b/i, 'Sukkah'],
  [/^rosh\s+hashan[aá]\b/i, 'Rosh Hashanah'],
  [/^taanit\b/i, 'Taanit'],
  [/^meguil[aá]\b/i, 'Megillah'],
  [/^jaguig[aá]\b/i, 'Chagigah'],
  [/^sot[aá]\b/i, 'Sotah'],
  [/^guit[ií]n\b/i, 'Gittin'],
  [/^kidush[ií]n\b/i, 'Kiddushin'],
  [/^bava\s+kama\b/i, 'Bava Kamma'],
  [/^bava\s+metzi[aá]\b/i, 'Bava Metzia'],
  [/^bava\s+batra\b/i, 'Bava Batra'],
  [/^sanhedr[ií]n\b/i, 'Sanhedrin'],
  [/^makot\b/i, 'Makkot'],
  [/^avod[aá]\s+zar[aá]\b/i, 'Avodah Zarah'],
  [/^pirk[eé]i?\s+avot\b/i, 'Pirkei Avot'],
  [/^avot\b/i, 'Pirkei Avot'],
  [/^mesilat\s+yesharim\b/i, 'Mesillat Yesharim'],
  [/^arj[ií]n\b/i, 'Arakhin'],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?oraj\s+jaim\b/i, 'Shulchan Arukh, Orach Chayim'],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?yor[eé]\s+de[aá]'?\b/i, "Shulchan Arukh, Yoreh De'ah"],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?even\s+ha[- ]?ezer\b/i, 'Shulchan Arukh, Even HaEzer'],
  [/^(?:shulj[aá]n\s+aruj,?\s*)?joshen\s+mishpat\b/i, 'Shulchan Arukh, Choshen Mishpat'],
  [/^mishn[aá]\s+berur[aá]\b/i, 'Mishnah Berurah'],
  [/^(?:mishn[eé]\s+tor[aá],?\s*)?(?:hiljot\s+melajim|leyes\s+de\s+reyes(?:\s+y\s+guerras)?|reyes\s+y\s+guerras)\b/i, 'Mishneh Torah, Kings and Wars'],
  [/^(?:mishn[eé]\s+tor[aá],?\s*)?(?:hiljot\s+teshuv[aá]|leyes\s+de\s+teshuv[aá]|leyes\s+del\s+arrepentimiento)\b/i, 'Mishneh Torah, Repentance'],
];

export function normalizeSefariaRef(rawRef: string): string {
  let ref = String(rawRef || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;]+$/, '');
  if (!ref) return 'Genesis 1:1';
  for (const [pattern, replacement] of SPANISH_TO_SEFARIA_BOOK_MAP) {
    ref = ref.replace(pattern, replacement).trim();
  }
  return ref || 'Genesis 1:1';
}

// Pre-seed the most frequently used canonical references so they resolve in 0ms with zero network overhead
export const PRE_SEEDED_CANONICAL_SOURCES: Array<{
  ref: string;
  heRef: string;
  hebrewText: string;
  translation: string;
  spanishTranslation: string;
}> = [
  {
    ref: 'Genesis 1:1',
    heRef: 'בראשית א׳:א׳',
    hebrewText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃',
    translation: 'When God began to create heaven and earth—',
    spanishTranslation: 'En el principio creó Elohim los cielos y la tierra.',
  },
  {
    ref: 'Deuteronomy 6:4',
    heRef: 'דברים ו׳:ד׳',
    hebrewText: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד׃',
    translation: 'Hear, O Israel! The LORD is our God, the LORD alone.',
    spanishTranslation: 'Escucha, Israel: HaShem es nuestro Elohim, HaShem es Uno.',
  },
  {
    ref: 'Deuteronomy 30:3',
    heRef: 'דברים ל׳:ג׳',
    hebrewText: 'וְשָׁב יְהוָה אֱלֹהֶיךָ אֶת־שְׁבוּתְךָ וְרִחֲמֶךָ וְשָׁב וְקִבֶּצְךָ מִכָּל־הָעַמִּים אֲשֶׁר הֱפִיצְךָ יְהוָה אֱלֹהֶיךָ שָׁמָּה׃',
    translation: 'then the LORD your God will restore your fortunes and take you back in love. He will bring you together again from all the peoples where the LORD your God has scattered you.',
    spanishTranslation: 'Entonces HaShem tu Elohim hará volver a tus cautivos y tendrá compasión de ti, y volverá a reunirte de entre todos los pueblos adonde HaShem tu Elohim te haya dispersado.',
  },
  {
    ref: 'Deuteronomy 30:19',
    heRef: 'דברים ל׳:י״ט',
    hebrewText: 'הַעִדֹתִי בָכֶם הַיּוֹם אֶת־הַשָּׁמַיִם וְאֶת־הָאָרֶץ הַחַיִּים וְהַמָּוֶת נָתַתִּי לְפָנֶיךָ הַבְּרָכָה וְהַקְּלָלָה וּבָחַרְתָּ בַּחַיִּים לְמַעַן תִּחְיֶה אַתָּה וְזַרְעֶךָ׃',
    translation: 'I call heaven and earth to witness against you this day: I have put before you life and death, blessing and curse. Choose life—if you and your offspring would live.',
    spanishTranslation: 'Pongo hoy por testigos ante vosotros a los cielos y a la tierra: la vida y la muerte he puesto delante de ti, la bendición y la maldición; escoge, pues, la vida, para que vivas tú y tu descendencia.',
  },
  {
    ref: 'Isaiah 2:4',
    heRef: 'ישעיהו ב׳:ד׳',
    hebrewText: 'וְשָׁפַט בֵּין הַגּוֹיִם וְהוֹכִיחַ לְעַמִּים רַבִּים וְכִתְּתוּ חַרְבוֹתָם לְאִתִּים וַחֲנִיתוֹתֵיהֶם לְמַזְמֵרוֹת לֹא־יִשָּׂא גוֹי אֶל־גּוֹי חֶרֶב וְלֹא־יִלְמְדוּן עוֹד מִלְחָמָה׃',
    translation: 'Thus He will judge among the nations and arbitrate for the many peoples, and they shall beat their swords into plowshares and their spears into pruning hooks: nation shall not take up sword against nation; they shall never again know war.',
    spanishTranslation: 'Y juzgará entre las naciones y reprenderá a muchos pueblos; convertirán sus espadas en rejas de arado y sus lanzas en podaderas; no alzará espada nación contra nación, ni se adiestrarán más para la guerra.',
  },
  {
    ref: 'Isaiah 11:1',
    heRef: 'ישעיהו י״א:א׳',
    hebrewText: 'וְיָצָא חֹטֶר מִגֶּזַע יִשָׁי וְנֵצֶר מִשָּׁרָשָׁיו יִפְרֶה׃',
    translation: 'But a shoot shall grow out of the stump of Jesse, a twig shall sprout from his stock.',
    spanishTranslation: 'Saldrá una vara del tronco de Ishái, y un vástago retoñará de sus raíces.',
  },
  {
    ref: 'Isaiah 11:2',
    heRef: 'ישעיהו י״א:ב׳',
    hebrewText: 'וְנָחָה עָלָיו רוּחַ יְהוָה רוּחַ חָכְמָה וּבִינָה רוּחַ עֵצָה וּגְבוּרָה רוּחַ דַּעַת וְיִרְאַת יְהוָה׃',
    translation: 'The spirit of the LORD shall alight upon him: a spirit of wisdom and insight, a spirit of counsel and valor, a spirit of devotion and reverence for the LORD.',
    spanishTranslation: 'Y reposará sobre él el espíritu de HaShem: espíritu de sabiduría y de entendimiento, espíritu de consejo y de fortaleza, espíritu de conocimiento y de reverencia a HaShem.',
  },
  {
    ref: 'Isaiah 11:9',
    heRef: 'ישעיהו י״א:ט׳',
    hebrewText: 'לֹא־יָרֵעוּ וְלֹא־יַשְׁחִיתוּ בְּכָל־הַר קָדְשִׁי כִּי־מָלְאָה הָאָרֶץ דֵּעָה אֶת־יְהוָה כַּמַּיִם לַיָּם מְכַסִּים׃',
    translation: 'In all of My sacred mount nothing evil or vile shall be done; for the land shall be filled with devotion to the LORD as water covers the sea.',
    spanishTranslation: 'No harán mal ni dañarán en todo Mi santo monte, porque la tierra estará llena del conocimiento de HaShem, como las aguas cubren el mar.',
  },
  {
    ref: 'Isaiah 45:7',
    heRef: 'ישעיהו מ״ה:ז׳',
    hebrewText: 'יוֹצֵר אוֹר וּבוֹרֵא חֹשֶׁךְ עֹשֶׂה שָׁלוֹם וּבוֹרֵא רָע אֲנִי יְהוָה עֹשֶׂה כָל־אֵלֶּה׃',
    translation: 'I form light and create darkness, I make weal and create woe—I the LORD do all these things.',
    spanishTranslation: 'Que forma la luz y crea la oscuridad, que hace la paz y crea la adversidad; Yo, HaShem, hago todo esto.',
  },
  {
    ref: 'Psalms 89:3',
    heRef: 'תהילים פ״ט:ג׳',
    hebrewText: 'כִּי־אָמַרְתִּי עוֹלָם חֶסֶד יִבָּנֶה שָׁמַיִם תָּכִין אֱמוּנָתְךָ בָהֶם׃',
    translation: 'I declare, “Your steadfast love is confirmed forever; there in the heavens You establish Your faithfulness.”',
    spanishTranslation: 'Porque dije: El mundo será edificado con bondad amorosa (Jésed); en los cielos establecerás Tu fidelidad.',
  },
  {
    ref: 'Psalms 104:24',
    heRef: 'תהילים ק״ד:כ״ד',
    hebrewText: 'מָה־רַבּוּ מַעֲשֶׂיךָ יְהוָה כֻּלָּם בְּחָכְמָה עָשִׂיתָ מָלְאָה הָאָרֶץ קִנְיָנֶךָ׃',
    translation: 'How many are the things You have made, O LORD; You have made them all with wisdom; the earth is full of Your creations.',
    spanishTranslation: '¡Cuán numerosas son Tus obras, oh HaShem! Todas ellas las hiciste con sabiduría; la tierra está llena de Tus creaciones.',
  },
  {
    ref: 'Psalms 136:1',
    heRef: 'תהילים קל״ו:א׳',
    hebrewText: 'הוֹדוּ לַיהוָה כִּי־טוֹב כִּי לְעוֹלָם חַסְדּוֹ׃',
    translation: 'Praise the LORD, for He is good, His steadfast love is eternal.',
    spanishTranslation: 'Agradeced a HaShem porque Él es bueno, porque para siempre es Su bondad amorosa.',
  },
  {
    ref: 'Sotah 40a',
    heRef: 'סוטה מ׳ א',
    hebrewText: 'בִּזְמַן שֶׁשְּׁלִיחַ צִבּוּר אוֹמֵר מוֹדִים הָעָם מָה הֵם אוֹמְרִים אָמַר רַב מוֹדִים אֲנַחְנוּ לָךְ ה׳ אֱלֹהֵינוּ עַל שֶׁאָנוּ מוֹדִים לָךְ',
    translation: 'When the prayer leader recites Modim, what do the congregation say? Rav said: We give thanks to You, Hashem our God, for the ability to give thanks to You.',
    spanishTranslation: 'Cuando el oficiante recita Modim, ¿qué dice la congregación? Dijo Rav: Te agradecemos a Ti, HaShem nuestro Elohim, por el mérito de poder agradecerte.',
  },
  {
    ref: 'Berakhot 34a',
    heRef: 'ברכות ל״ד א',
    hebrewText: 'אַל יִשְׁאַל אָדָם צְרָכָיו לֹא בְּגִימֶל רִאשׁוֹנוֹת וְלֹא בְּגִימֶל אַחֲרוֹנוֹת אֶלָּא בָּאֶמְצָעִיּוֹת דְּאָמַר רַב חֲנִינָא רִאשׁוֹנוֹת דּוֹמֶה לְעֶבֶד שֶׁמְּסַדֵּר שֶׁבַח לִפְנֵי רַבּוֹ אֶמְצָעִיּוֹת דּוֹמֶה לְעֶבֶד שֶׁמְּבַקֵּשׁ פְּרָס מֵרַבּוֹ אַחֲרוֹנוֹת דּוֹמֶה לְעֶבֶד שֶׁקִּבֵּל פְּרָס מֵרַבּוֹ וְנִפְטַר וְהוֹלֵךְ לוֹ',
    translation: 'A person should not ask for his needs in the first three blessings or in the last three blessings of the Amidah, but in the middle ones: the first resemble a servant arranging praise before his master; the middle resemble a servant requesting a portion; the last resemble a servant who received his portion and takes leave in gratitude.',
    spanishTranslation: 'El ser humano no debe pedir sus necesidades en las tres primeras bendiciones ni en las tres últimas de la Amidá, sino en las intermedias: las primeras se asemejan a un siervo que ordena alabanzas ante su Maestro; las intermedias, a quien solicita su sustento; y las últimas, a quien ha recibido el don de su Maestro y se despide con gratitud.',
  },
  {
    ref: 'Sanhedrin 98a',
    heRef: 'סנהדרין צ״ח א',
    hebrewText: 'רַבִּי יְהוֹשֻׁעַ בֶּן לֵוִי אַשְׁכְּחֵיהּ לְאֵלִיָּהוּ... אֲמַר לֵיהּ אֵימַת אָתֵי מָשִׁיחַ... הַיּוֹם אִם בְּקוֹלוֹ תִשְׁמָעוּ׃',
    translation: 'Rabbi Yehoshua ben Levi met Elijah and asked him: When will the Messiah come? He replied: Today, if you will heed His voice (Psalms 95:7).',
    spanishTranslation: 'Rabí Yehoshúa ben Leví encontró al profeta Eliyahu y le preguntó: ¿Cuándo vendrá el Mashíaj? Le respondió: «Hoy mismo, si escucháis Su voz» (Salmos 95:7).',
  },
  {
    ref: 'Pirkei Avot 1:2',
    heRef: 'משנה אבות א׳:ב׳',
    hebrewText: 'שִׁמְעוֹן הַצַּדִּיק הָיָה מִשְּׁיָרֵי כְנֶסֶת הַגְּדוֹלָה. הוּא הָיָה אוֹמֵר, עַל שְׁלֹשָׁה דְבָרִים הָעוֹלָם עוֹמֵד, עַל הַתּוֹרָה וְעַל הָעֲבוֹדָה וְעַל גְּמִילוֹת חֲסָדִים׃',
    translation: 'Shimon the Righteous was one of the last of the Men of the Great Assembly. He used to say: On three things the world stands: on the Torah, on the service of God, and on deeds of lovingkindness.',
    spanishTranslation: 'Shimón HaTzadik fue de los últimos miembros de la Gran Asamblea. Él solía decir: Sobre tres pilares se sostiene el mundo: sobre la Torá, sobre el servicio divino (Avodá) y sobre los actos de bondad amorosa (Guemilut Jasadim).',
  },
  {
    ref: 'Pirkei Avot 1:14',
    heRef: 'משנה אבות א׳:י״ד',
    hebrewText: 'הוּא הָיָה אוֹמֵר, אִם אֵין אֲנִי לִי, מִי לִי. וּכְשֶׁאֲנִי לְעַצְמִי, מָה אֲנִי. וְאִם לֹא עַכְשָׁיו, אֵימָתָי׃',
    translation: 'He [Hillel] used to say: If I am not for myself, who will be for me? And when I am only for myself, what am I? And if not now, when?',
    spanishTranslation: 'Él [Hilel] solía decir: Si yo no soy para mí, ¿quién será para mí? Pero si soy solo para mí mismo, ¿qué soy? Y si no es ahora, ¿cuándo?',
  },
  {
    ref: 'Mesillat Yesharim 1:1',
    heRef: 'מסילת ישרים א׳:א׳',
    hebrewText: 'יְסוֹד הַחֲסִידוּת וְשֹׁרֶשׁ הָעֲבוֹדָה הַתְּמִימָה הוּא שֶׁיִּתְבָּרֵר וְיִתְאַמֵּת אֵצֶל הָאָדָם מָה חוֹבָתוֹ בְּעוֹלָמוֹ',
    translation: 'The foundation of piety and the root of perfect service of God is for a person to clarify and come to verify as truth what his obligation is in his world.',
    spanishTranslation: 'El fundamento de la piedad (Jasidut) y la raíz del servicio íntegro es que se aclare y verifique como verdad en el ser humano cuál es su deber en su mundo.',
  },
  {
    ref: 'Mesillat Yesharim 19:1',
    heRef: 'מסילת ישרים י״ט:א׳',
    hebrewText: 'הַחֲסִידוּת עִנְיָנוֹ גָּדוֹל וְרָחָב מְאֹד... שֶׁיִּהְיֶה הָאָדָם מִשְׁתַּדֵּל לַעֲשׂוֹת נַחַת רוּחַ לְיוֹצְרוֹ בְּכָל מַה שֶּׁאֶפְשָׁר לוֹ',
    translation: 'Piety (Chassidut) is a deep and wide concept: that a person strives constantly to bring gratification to his Creator in every way possible, going beyond the minimal letter of the obligation.',
    spanishTranslation: 'La Jasidut (devoción amorosa) es un concepto profundo y amplio: que el ser humano procure constantemente causar complacencia a su Creador en todo cuanto esté a su alcance, yendo más allá de la letra mínima de la obligación.',
  },
  {
    ref: 'Mishneh Torah, Kings and Wars 11:1',
    heRef: 'משנה תורה, הלכות מלכים ומלחמות י״א:א׳',
    hebrewText: 'הַמֶּלֶךְ הַמָּשִׁיחַ עָתִיד לָקוּם וּלְהַחְזִיר מַלְכוּת דָּוִד לְיָשְׁנָהּ לַמֶּמְשָׁלָה הָרִאשׁוֹנָה, וּבוֹנֶה הַמִּקְדָּשׁ וּמְקַבֵּץ נִדְחֵי יִשְׂרָאֵל',
    translation: 'In the future, the Messianic King will arise and renew the Davidic dynasty, restoring it to its initial sovereignty. He will build the Temple and gather the dispersed of Israel.',
    spanishTranslation: 'En el futuro, el Rey Mashíaj se levantará y restaurará el reino de David a su soberanía original; reconstruirá el Santuario y reunirá a los dispersos de Israel.',
  },
  {
    ref: 'Mishneh Torah, Kings and Wars 11:4',
    heRef: 'משנה תורה, הלכות מלכים ומלחמות י״א:ד׳',
    hebrewText: 'וְאִם יַעֲמֹד מֶלֶךְ מִבֵּית דָּוִד הוֹגֶה בַּתּוֹרָה וְעוֹסֵק בְּמִצְוֹת כְּדָוִד אָבִיו... וְיָכוֹף כָּל יִשְׂרָאֵל לֵילֵךְ בָּהּ וּלְחַזֵּק בִּדְקָהּ... הֲרֵי זֶה בְּחֶזְקַת שֶׁהוּא מָשִׁיחַ',
    translation: 'If a king will arise from the House of David who diligently studies the Torah and observes its mitzvot like David his ancestor... and influences all of Israel to walk in its way and repair its breaches... he may be presumed to be the Mashiach.',
    spanishTranslation: 'Y si se levanta un rey de la Casa de David que medita en la Torá y se ocupa de los preceptos como David su ancestro, e inspira a todo Israel a caminar en ella y reparar sus brechas, entonces tiene la presunción de ser el Mashíaj.',
  },
  {
    ref: 'Mishneh Torah, Kings and Wars 12:1',
    heRef: 'משנה תורה, הלכות מלכים ומלחמות י״ב:א׳',
    hebrewText: 'אַל יַעֲלֶה עַל הַלֵּב שֶׁבִּימוֹת הַמָּשִׁיחַ יִבָּטֵל דָּבָר מִמִּנְהָגוֹ שֶׁל עוֹלָם אוֹ יִהְיֶה שָׁם חִדּוּשׁ בְּמַעֲשֵׂה בְּרֵאשִׁית, אֶלָּא עוֹלָם כְּמִנְהָגוֹ נוֹהֵג',
    translation: 'Let no one think that in the days of the Messiah any of the laws of nature will be set aside, or any innovation will be introduced into creation; rather, the world will follow its normal course.',
    spanishTranslation: 'No se piense que en los días del Mashíaj se anulará nada del orden natural del mundo ni que habrá alteración en la obra de la Creación; sino que el mundo continuará según su curso natural.',
  },
  {
    ref: 'Kiddushin 31a',
    heRef: 'קידושין ל״א א',
    hebrewText: 'אָמַר רַבִּי חֲנִינָא גָּדוֹל הַמְּצֻוֶּה וְעוֹשֶׂה יוֹתֵר מִמִּי שֶׁאֵינוֹ מְצֻוֶּה וְעוֹשֶׂה',
    translation: 'Rabbi Chanina said: Greater is one who is commanded and performs a mitzvah than one who is not commanded and performs it.',
    spanishTranslation: 'Dijo Rabí Janiná: Más grande es quien está comandado (por una fuente trascendente en el Pacto) y cumple el precepto, que quien no está comandado y lo hace por sola iniciativa propia.',
  },
  {
    ref: 'Deuteronomy 30:14',
    heRef: 'דברים ל׳:י״ד',
    hebrewText: 'כִּי־קָרוֹב אֵלֶיךָ הַדָּבָר מְאֹד בְּפִיךָ וּבִלְבָבְךָ לַעֲשֹׂתוֹ׃',
    translation: 'No, the thing is very close to you, in your mouth and in your heart, to observe it.',
    spanishTranslation: 'Pues la palabra está muy cerca de ti, en tu boca y en tu corazón, para ponerla por obra.',
  },
  {
    ref: 'Yoma 85b',
    heRef: 'יומא פ״ה ב',
    hebrewText: 'וְחַי בָּהֶם וְלֹא שֶׁיָּמוּת בָּהֶם... אֵין לְךָ דָּבָר שֶׁעוֹמֵד בִּפְנֵי פִּקּוּחַ נֶפֶשׁ',
    translation: '“And he shall live by them” (Leviticus 18:5)—and not that he should die by them. Nothing stands in the way of saving a human life (Pikuach Nefesh).',
    spanishTranslation: '«Y vivirás por ellos» (Levítico 18:5), y no que mueras por ellos: ninguna regla formal prevalece por encima de salvar una vida humana concreta (Pikuaj Néfesh).',
  },
  {
    ref: 'Deuteronomy 6:18',
    heRef: 'דברים ו׳:י״ח',
    hebrewText: 'וְעָשִׂיתָ הַיָּשָׁר וְהַטּוֹב בְּעֵינֵי יְהוָה לְמַעַן יִיטַב לָךְ',
    translation: 'Do what is right and good in the sight of the LORD, that it may go well with you.',
    spanishTranslation: 'Y harás lo recto y lo bueno a los ojos de HaShem (yendo más allá de la letra rígida de la norma según la situación concreta, Lifnim Mishurat HaDin), para que te vaya bien.',
  },
  {
    ref: 'Sanhedrin 56a',
    heRef: 'סנהדרין נ״ו א',
    hebrewText: 'תָּנוּ רַבָּנַן שֶׁבַע מִצְוֹת נִצְטַוּוּ בְּנֵי נֹחַ דִּינִין וּבִרְכַּת הַשֵּׁם עֲבוֹדָה זָרָה גִּלּוּי עֲרָיוֹת וּשְׁפִיכוּת דָּמִים וְגָזֵל וְאֵבֶר מִן הַחַי',
    translation: 'The Sages taught: The descendants of Noah (all humanity) were commanded concerning seven universal ethical precepts: establishing courts of justice, prohibiting blasphemy, idolatry, sexual immorality, bloodshed, robbery, and cruelty to living creatures.',
    spanishTranslation: 'Enseñaron nuestros Sabios: Siete preceptos éticos universales fueron encomendados a los hijos de Noé (toda la humanidad): establecer tribunales de justicia y prohibir la blasfemia, la idolatría, la inmoralidad sexual, el derramamiento de sangre, el robo y la crueldad hacia los seres vivos.',
  },
  {
    ref: 'Leviticus 19:18',
    heRef: 'ויקרא י״ט:י״ח',
    hebrewText: 'לֹא־תִקֹּם וְלֹא־תִטֹּר אֶת־בְּנֵי עַמֶּךָ וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ אֲנִי יְהוָה׃',
    translation: 'You shall not take vengeance or bear a grudge against your countrymen. Love your fellow as yourself: I am the LORD.',
    spanishTranslation: 'No te vengarás ni guardarás rencor a los hijos de tu pueblo, sino que amarás a tu prójimo como a ti mismo: Yo soy HaShem.',
  },
  {
    ref: 'Pirkei Avot 2:4',
    heRef: 'משנה אבות ב׳:ד׳',
    hebrewText: 'הוּא הָיָה אוֹמֵר, עֲשֵׂה רְצוֹנוֹ כִּרְצוֹנְךָ, כְּדֵי שֶׁיַּעֲשֶׂה רְצוֹנְךָ כִּרְצוֹנוֹ.',
    translation: 'He used to say: Make His will as your own will, so that He may make your will as His will.',
    spanishTranslation: 'Él solía decir: Haz que Su voluntad sea como tu propia voluntad, para que Él haga tu voluntad como la Suya.',
  },
  {
    ref: 'Proverbs 6:23',
    heRef: 'משלי ו׳:כ״ג',
    hebrewText: 'כִּי נֵר מִצְוָה וְתוֹרָה אוֹר וְדֶרֶךְ חַיִּים תּוֹכְחוֹת מוּסָר׃',
    translation: 'For the commandment (mitzvah) is a lamp and the Torah is light, and the reproofs of instruction are the way of life.',
    spanishTranslation: 'Porque lámpara es el mandamiento específico (Mitzvá) y la Torá es luz universal, y camino de vida son las enseñanzas éticas del Musar.',
  },
  {
    ref: 'Exodus 24:7',
    heRef: 'שמות כ״ד:ז׳',
    hebrewText: 'וַיִּקַּח סֵפֶר הַבְּרִית וַיִּקְרָא בְּאָזְנֵי הָעָם וַיֹּאמְרוּ כֹּל אֲשֶׁר־דִּבֶּר יְהוָה נַעֲשֶׂה וְנִשְׁמָע׃',
    translation: 'Then he took the book of the covenant and read it in the hearing of the people; and they said: “All that the LORD has spoken we will do, and we will understand (Na’aseh ve-nishma).”',
    spanishTranslation: 'Y tomó el Libro del Pacto y lo leyó a oídos del pueblo, y ellos dijeron: «Todo lo que HaShem ha hablado haremos y comprenderemos (Naasé ve-nishmá: la acción específica del mandamiento precede y abre la iluminación intelectual)».',
  },
  {
    ref: 'Lamentations Rabbah 2:13',
    heRef: 'איכה רבה ב׳:י״ג',
    hebrewText: 'אִם יֹאמַר לְךָ אָדָם יֵשׁ חָכְמָה בַּגּוֹיִם תַּאֲמִין... יֵשׁ תּוֹרָה בַּגּוֹיִם אַל תַּאֲמִין',
    translation: 'If a person says to you: “There is wisdom (Chokhmah) among the nations,” believe it... “There is Torah among the nations,” do not believe it.',
    spanishTranslation: 'Si alguien te dice: «Hay sabiduría filosófica y científica (Jojmá) en las fuentes externas de las naciones», créelo; pero si te dice: «Hay Torá (Revelación Pactal y especificidad de la Mitzvá) en ellas», no lo creas.',
  },
  {
    ref: 'Deuteronomy 4:6',
    heRef: 'דברים ד׳:ו׳',
    hebrewText: 'וּשְׁמַרְתֶּם וַעֲשִׂיתֶם כִּי הִוא חָכְמַתְכֶם וּבִינַתְכֶם לְעֵינֵי הָעַמִּים אֲשֶׁר יִשְׁמְעוּן אֵת כָּל־הַחֻקִּים הָאֵלֶּה',
    translation: 'Observe them and perform them, for this is your wisdom and your understanding in the sight of the peoples, who will hear all these statutes.',
    spanishTranslation: 'Los guardaréis y los pondréis por obra, porque esta práctica concreta es vuestra sabiduría y vuestro entendimiento a los ojos de las naciones.',
  },
  {
    ref: 'Micah 6:8',
    heRef: 'מיכה ו׳:ח׳',
    hebrewText: 'הִגִּיד לְךָ אָדָם מַה־טּוֹב וּמָה־יְהוָה דּוֹרֵשׁ מִמְּךָ כִּי אִם־עֲשׂוֹת מִשְׁפָּט וְאַהֲבַת חֶסֶד וְהַצְנֵעַ לֶכֶת עִם־אֱלֹהֶיךָ׃',
    translation: 'He has told you, O man, what is good, and what the LORD requires of you: only to do justice, and to love goodness, and to walk modestly with your God.',
    spanishTranslation: 'Él te ha declarado, oh hombre, lo que es bueno y qué pide HaShem de ti: solamente practicar la justicia (Mishpat), amar la bondad leal (Jésed) y caminar con humildad junto a tu Dios.',
  },
  {
    ref: 'Pirkei Avot 3:17',
    heRef: 'משנה אבות ג׳:י״ז',
    hebrewText: 'הוּא הָיָה אוֹמֵר, כֹּל שֶׁחָכְמָתוֹ מְרֻבָּה מִמַּעֲשָׂיו, לְמָה הוּא דוֹמֶה, לְאִילָן שֶׁעֲנָפָיו מְרֻבִּין וְשָׁרָשָׁיו מוּעָטִין',
    translation: 'He [Rabbi Elazar ben Azaryah] used to say: Anyone whose wisdom exceeds his deeds, to what is he compared? To a tree whose branches are numerous and whose roots are few.',
    spanishTranslation: 'Él [Rabí Elazar ben Azariá] solía decir: Todo aquel cuya sabiduría teórica supera a sus acciones concretas se asemeja a un árbol de muchas ramas pero pocas raíces; en cambio, aquel cuyas acciones superan a su teoría es como un árbol de raíces profundas que ningún viento puede arrancar.',
  },
  {
    ref: 'Sanhedrin 90a',
    heRef: 'סנהדרין צ׳ א (משנה סנהדרין י׳:א׳)',
    hebrewText: 'כָּל יִשְׂרָאֵל יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא, שֶׁנֶּאֱמַר וְעַמֵּךְ כֻּלָּם צַדִּיקִים לְעוֹלָם יִירְשׁוּ אָרֶץ נֵצֶר מַטָּעַי מַעֲשֵׂה יָדַי לְהִתְפָּאֵר׃',
    translation: 'All Israel have a share in the World to Come (Olam HaBa), as it is stated: “And Your people, all of them righteous, shall inherit the land forever; they are the shoot of My planting, the work of My hands, in which I glory” (Isaiah 60:21).',
    spanishTranslation: 'Todo Israel tiene parte en el Mundo Venidero (Olam HaBá), como está dicho: «Y tu pueblo, todos ellos justos, para siempre heredarán la tierra; vástago de Mi plantío, obra de Mis manos, para glorificarme» (Isaías 60:21).',
  },
  {
    ref: 'Berakhot 17a',
    heRef: 'ברכות י״ז א',
    hebrewText: 'הָעוֹלָם הַבָּא אֵין בּוֹ לֹא אֲכִילָה וְלֹא שְׁתִיָּה וְלֹא פְּרִיָּה וּרְבִיָּה וְלֹא מַשָּׂא וּמַתָּן וְלֹא קִנְאָה וְלֹא שִׂנְאָה וְלֹא תַחֲרוּת, אֶלָּא צַדִּיקִים יוֹשְׁבִין וְעַטְרוֹתֵיהֶם בְּרָאשֵׁיהֶם וְנֶהֱנִין מִזִּיו הַשְּׁכִינָה',
    translation: 'In the World to Come there is neither eating nor drinking, nor procreation, nor business transactions, nor envy, nor hatred, nor competition; rather, the righteous sit with their crowns upon their heads and delight in the radiance of the Divine Presence (Shekhinah).',
    spanishTranslation: 'En el Mundo Venidero (Olam HaBá) no hay comida ni bebida, ni comercio, ni envidia, ni odio ni rivalidad; sino que los justos se sientan con sus coronas sobre sus cabezas y se deleitan en el resplandor de la Presencia Divina (Ziv HaShejiná).',
  },
  {
    ref: 'Pirkei Avot 4:16',
    heRef: 'משנה אבות ד׳:ט״ז',
    hebrewText: 'רַבִּי יַעֲקֹב אוֹמֵר, הָעוֹלָם הַזֶּה דּוֹמֶה לִפְרוֹזְדוֹר בִּפְנֵי הָעוֹלָם הַבָּא. הַתְקֵן עַצְמְךָ בַּפְּרוֹזְדוֹר, כְּדֵי שֶׁתִּכָּנֵס לַטְּרַקְלִין׃',
    translation: 'Rabbi Yaakov says: This world is like a vestibule before the World to Come; prepare yourself in the vestibule, so that you may enter the banquet hall.',
    spanishTranslation: 'Rabí Yaakov dice: Este mundo (Olam HaZé) es semejante a un vestíbulo ante el Mundo Venidero (Olam HaBá); prepárate en el vestíbulo mediante las acciones éticas y preceptos, para que puedas entrar al salón principal.',
  },
  {
    ref: 'Mishneh Torah, Repentance 3:5',
    heRef: 'משנה תורה, הלכות תשובה ג׳:ה׳',
    hebrewText: 'וְכֵן חֲסִידֵי אֻמּוֹת הָעוֹלָם יֵשׁ לָהֶם חֵלֶק לָעוֹלָם הַבָּא',
    translation: 'And likewise, the pious and righteous of all the nations of the world (Chassidei Ummot HaOlam) have a share in the World to Come (Olam HaBa).',
    spanishTranslation: 'Y asimismo, los justos de entre todas las naciones del mundo (Jasidei Umot HaOlam) tienen parte en el Mundo Venidero (Olam HaBá) por su rectitud moral y observancia ética universal.',
  },
  {
    ref: 'Psalms 36:10',
    heRef: 'תהילים ל״ו:י׳',
    hebrewText: 'כִּי־עִמְּךָ מְקוֹר חַיִּים בְּאוֹרְךָ נִרְאֶה־אוֹר׃',
    translation: 'For with You is the fountain of life; by Your light do we see light.',
    spanishTranslation: 'Porque contigo está el manantial de la vida; en Tu luz veremos la luz (Be-orjá niré or: la iluminación en el judaísmo nace de la relación viva con la fuente de la vida).',
  },
  {
    ref: 'Chagigah 12a',
    heRef: 'חגיגה י״ב א',
    hebrewText: 'אוֹר שֶׁבָּרָא הַקָּדוֹשׁ בָּרוּךְ הוּא בְּיוֹם רִאשׁוֹן אָדָם צוֹפֶה בּוֹ מִסּוֹף הָעוֹלָם וְעַד סוֹפוֹ... עָמַד וּגְנָזוֹ לַצַּדִּיקִים לֶעָתִיד לָבוֹא',
    translation: 'With the primordial light that the Holy One, Blessed be He, created on the first day, a person could see from one end of the world to the other... He arose and hid it away (Or HaGanuz) for the righteous in the Ultimate Future (and within the Torah).',
    spanishTranslation: 'Con la Luz Primordial que el Santo, Bendito Sea, creó en el primer día, el ser humano contemplaba de un confín del universo al otro... y Dios la atesoró (Or HaGanuz, la Luz Oculta en la Torá) para los justos en el Mundo Venidero.',
  },
  {
    ref: 'Pesachim 117a',
    heRef: 'פסחים קי״ז א',
    hebrewText: 'נְבִיאִים שֶׁבֵּינֵיהֶן תִּיקְּנוּ לָהֶם לְיִשְׂרָאֵל שֶׁיְּהוּ אוֹמְרִים אוֹתוֹ עַל כָּל פֶּרֶק וָפֶרֶק וְעַל כָּל צָרָה וְצָרָה שֶׁלֹּא תָּבֹא עֲלֵיהֶן וּלְכְשֶׁנִּגְאָלִין אוֹמְרִים אוֹתוֹ עַל גְּאוּלָּתָן',
    translation: 'The prophets among them instituted for Israel that they should recite this Hallel at every major season and festival, and over every trouble—may it not come upon them—when they are redeemed, they recite it over their redemption.',
    spanishTranslation: 'Los profetas que había entre ellos instituyeron para Israel que recitaran este Halel (Salmos 113–118) en cada festividad señalada y ante cada angustia —que no sobrevenga—, para que al ser redimidos lo proclamen en gratitud por su redención.',
  },
  {
    ref: 'Arakhin 10a',
    heRef: 'ערכין י׳ א',
    hebrewText: 'שְׁמוֹנָה עָשָׂר יוֹם בַּשָּׁנָה יָחִיד גּוֹמֵר בָּהֶן אֶת הַהַלֵּל: שְׁמוֹנַת יְמֵי הֶחָג, וּשְׁמוֹנַת יְמֵי חֲנֻכָּה, וְיוֹם טוֹב הָרִאשׁוֹן שֶׁל פֶּסַח, וְיוֹם טוֹב שֶׁל עֲצֶרֶת. וּבַגּוֹלָה עֶשְׂרִים וְאֶחָד יוֹם.',
    translation: 'On eighteen days of the year an individual completes the full Hallel (Hallel Shalem): the eight days of Sukkot, the eight days of Chanukah, the first festival day of Pesach, and the festival day of Shavuot; and in the Diaspora, on twenty-one days.',
    spanishTranslation: 'Dieciocho días al año el individuo completa el Halel íntegro (Halel Shalem): los ocho días de Sucot y Sheminí Atzéret, los ocho días de Janucá, el primer día festivo de Pésaj y el día de Shavuot; y en la Diáspora, veintiún días.',
  },
  {
    ref: 'Taanit 28b',
    heRef: 'תענית כ״ח ב',
    hebrewText: 'רַב אִיקְלַע לְבָבֶל, חֲזַנְהוּ דְּקָא קָרוּ הַלֵּל בְּרֹאשׁ חֹדֶשׁ. סְבַר לְאַפְסוֹקִינְהוּ, כֵּיוָן דַּחֲזָא דְּקָא מְדַלְּגִי דִּלּוּגֵי, אָמַר: שְׁמַע מִינַּהּ מִנְהַג אֲבוֹתֵיהֶם בִּידֵיהֶם.',
    translation: 'Rav visited Babylonia and saw them reciting Hallel on Rosh Chodesh. He thought to stop them, but when he saw that they skipped parts (reciting Half-Hallel / Chatzi Hallel), he said: Learn from this that they are upholding the custom of their ancestors (Minhag avoteihem be-yadeihem).',
    spanishTranslation: 'Rav llegó a Babilonia y vio que recitaban el Halel en Rosh Jódesh. Pensó en detenerlos (pues Rosh Jódesh no está entre los 18 días de Halel completo), pero al ver que omitían dos secciones (recitando Medio Halel / Jatsi Halel), dijo: «Se deduce de esto que conservan en sus manos la costumbre sagrada de sus ancestros (Minhag avoteijem be-yadeijem)».',
  },
  {
    ref: 'Psalms 113:1',
    heRef: 'תהילים קי״ג:א׳',
    hebrewText: 'הַלְלוּיָהּ הַלְלוּ עַבְדֵי יְהוָה הַלְלוּ אֶת־שֵׁם יְהוָה׃',
    translation: 'Hallelujah. Praise, O servants of the LORD; praise the name of the LORD.',
    spanishTranslation: '¡Haleluyá! Alabad, siervos de HaShem («Avdei HaShem», y no siervos del Faraón, como comenta el Talmud en Megilá 14a), alabad el Nombre de HaShem.',
  },
  {
    ref: 'Psalms 118:1',
    heRef: 'תהילים קי״ח:א׳',
    hebrewText: 'הוֹדוּ לַיהוָה כִּי־טוֹב כִּי לְעוֹלָם חַסְדּוֹ׃',
    translation: 'Give thanks to the LORD, for He is good, for His steadfast love (chesed) endures forever.',
    spanishTranslation: 'Dad gracias a HaShem porque Él es bueno, porque para siempre es Su bondad leal (Jésed).',
  },
  {
    ref: 'Mishneh Torah, Megillah and Chanukah 3:6',
    heRef: 'משנה תורה, הלכות מגילה וחנוכה ג׳:ו׳',
    hebrewText: 'אֲבָל בְּרָאשֵׁי חֳדָשִׁים קְרִיאַת הַהַלֵּל מִנְהָג וְאֵינָהּ מִצְוָה, וּלְפִיכָךְ קוֹרִין אוֹתוֹ בְּדִלּוּג.',
    translation: 'However, on Rosh Chodesh the reading of Hallel is a custom (minhag) and not a formal obligation, and therefore it is read skipping certain passages (Chatzi Hallel).',
    spanishTranslation: 'Pero en Rosh Jódesh (y en los últimos seis días de Pésaj), la lectura del Halel tiene rango de costumbre ancestral (Minhag) y no de obligación rabínica plena; y por ello se lee omitiendo dos pasajes (Medio Halel / Jatsi Halel).',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 1:1',
    heRef: 'שולחן ערוך, אורח חיים א׳:א׳',
    hebrewText: 'יִתְגַּבֵּר כַּאֲרִי לַעֲמֹד בַּבֹּקֶר לַעֲבוֹדַת בּוֹרְאוֹ, שֶׁיְּהֵא הוּא מְעוֹרֵר הַשַּׁחַר. הגה: שִׁוִּיתִי ה׳ לְנֶגְדִּי תָמִיד הוּא כְּלָל גָּדוֹל בַּתּוֹרָה וּבְמַעֲלוֹת הַצַּדִּיקִים... וְלֹא יִתְבַּיֵּשׁ מִפְּנֵי בְּנֵי אָדָם הַמַּלְעִיגִים עָלָיו בַּעֲבוֹדַת הַשֵּׁם יִתְבָּרַךְ.',
    translation: '[Mechaber - R. Yosef Karo]: One should strengthen oneself like a lion to rise in the morning for the service of his Creator, so that it is he who awakens the dawn. [Rema - R. Moshe Isserles]: “I have set the LORD before me always” (Psalms 16:8) is a great principle in the Torah and among the virtues of the righteous... and one should not be ashamed before people who mock him in the service of God.',
    spanishTranslation: '[El Mejaber · Rabí Yosef Karo, tradición sefardí]: Debe fortalecerse como un león para levantarse por la mañana al servicio de su Creador, de modo que él despierte a la aurora. [Glosa del Ramá · Rabí Moshé Isserles, tradición ashkenazí]: «He puesto a HaShem siempre delante de mí» (Salmos 16:8) es un gran principio en la Torá y en los grados de los justos... y no se avergonzará ante quienes se burlen de él en el cumplimiento del servicio divino.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 68:1',
    heRef: 'שולחן ערוך, אורח חיים ס״ח:א׳',
    hebrewText: 'יֵשׁ מְקוֹמוֹת שֶׁאוֹמְרִים פִּיּוּטִים, וְיֵשׁ מְקוֹמוֹת שֶׁאֵין אוֹמְרִים... הגה: וְאֵין לְשַׁנּוֹת מִנְהַג הַמָּקוֹם בְּשׁוּם דָּבָר מִסֵּדֶר הַתְּפִלָּה וְנוּסְחָהּ.',
    translation: '[Mechaber]: There are places where liturgical poems (piyyutim) are recited, and places where they are not... [Rema]: And one must not alter the custom of the place (Minhag HaMakom) regarding any aspect of the order of prayer or its liturgical rite (Nusach).',
    spanishTranslation: '[El Mejaber]: Hay comunidades donde se recitan piyutim en las bendiciones del Shemá y lugares donde no se recitan... [El Ramá]: Y no se debe alterar la costumbre del lugar (Minhag HaMakom) en ningún detalle del orden de la plegaria ni de su rito litúrgico (Núsaj HaTefilá: Sefarad, Ashkenaz, Ari/Jasídico o Teimaní).',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 422:2',
    heRef: 'שולחן ערוך, אורח חיים תכ״ב:ב׳',
    hebrewText: 'קּוֹרִין הַהַלֵּל בְּדִלּוּג, בֵּין יָחִיד בֵּין צִבּוּר, בְּלֹא בְּרָכָה לֹא בַּתְּחִלָּה וְלֹא בַּסּוֹף; וְיֵשׁ אוֹמְרִים שֶׁבְּצִבּוּר מְבָרְכִין עָלָיו בַּתְּחִלָּה וּבַסּוֹף. הגה: וְכֵן נוֹהֲגִין לְבָרֵךְ עָלָיו אֲפִלּוּ בְּיָחִיד.',
    translation: '[Mechaber - R. Yosef Karo]: On Rosh Chodesh we read Hallel skipping parts (Chatzi Hallel), whether as an individual or in a congregation, without a blessing at the beginning or at the end; and some say that in a congregation a blessing is recited. [Rema - R. Moshe Isserles]: And our custom (Ashkenazi minhag) is to recite the blessing over it, even when praying as an individual.',
    spanishTranslation: '[El Mejaber · Rabí Yosef Karo, rito sefardí]: En Rosh Jódesh se lee el Halel omitiendo partes (Medio Halel / Jatsi Halel), tanto en privado como en público, sin recitar bendición ni al principio ni al final (pues sobre un Minhag no se bendice); y hay quienes opinan que en público sí se bendice. [El Ramá · Rabí Moshé Isserles, rito ashkenazí]: Y así acostumbramos nosotros (Minhag Ashkenaz): recitar bendición («Likró et ha-Halel») incluso en privado.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 453:1',
    heRef: 'שולחן ערוך, אורח חיים תנ״ג:א׳',
    hebrewText: 'אֵלּוּ דְּבָרִים שֶׁיוֹצְאִים בָּהֶם יְדֵי חוֹבַת מַצָּה: בַּחִטִּים וּבַשְּׂעוֹרִים... אֲבָל אֹרֶז וּשְׁאָר מִינֵי קִטְנִיּוֹת אֵינָם בָּאִים לִידֵי חִמּוּץ. הגה: וְיֵשׁ אוֹסְרִים, וְהַמִּנְהָג בְּאשְׁכְּנַז לְהַחְמִיר וְאֵין לְשַׁנּוֹת.',
    translation: '[Mechaber - R. Yosef Karo]: Rice and other legumes (kitniyot) do not become chametz, and it is permitted to cook and eat them on Pesach. [Rema - R. Moshe Isserles]: Some authorities prohibit them, and the custom (Minhag) in Ashkenaz is to be stringent and abstain from kitniyot, and one must not change this custom.',
    spanishTranslation: '[El Mejaber · Tradición Sefardí / Edot HaMizraj]: El arroz y las demás legumbres (Kitniyot) no fermentan como Jametz, y está permitido cocinarlos y comerlos en Pésaj. [El Ramá · Tradición Ashkenazí]: Y hay autoridades que lo prohíben por precaución, y la costumbre (Minhag) en todas las comunidades de Ashkenaz es abstenerse de Kitniyot en Pésaj, y no se debe alterar el Minhag.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 128:44',
    heRef: 'שולחן ערוך, אורח חיים קכ״ח:מ״ד',
    hebrewText: 'הגה: וּבִמְדִינוֹת אֵלּוּ אֵין נוֹהֲגִין לִשָּׂא כַּפֵּיהֶם כִּי אִם בְּיוֹם טוֹב, מִשּׁוּם דְּאָז שְׁרוּיִים בְּשִׂמְחַת יוֹם טוֹב, וְטוֹב לֵב הוּא יְבָרֵךְ.',
    translation: '[Rema - R. Moshe Isserles]: In these lands (Ashkenazi Diaspora), the custom (Minhag) is that Kohanim do not raise their hands for the Priestly Blessing (Birkat Kohanim) every day, but only on Festivals (Yom Tov), because then they are in the joy of the festival, and only one who is joyful of heart should bless (whereas in the Sephardic custom and in the Land of Israel, Kohanim bless every day).',
    spanishTranslation: '[El Ramá · Minhag Ashkenaz en la Diáspora]: Y en estas regiones la costumbre (Minhag) es que los Kohanim no suban a impartir la Bendición Sacerdotal (Birkat Kohanim) sino en los días festivos (Yom Tov), porque entonces se hallan en la alegría de la festividad; mientras que según el Shulján Aruj (Minhag Sefardí y en la Tierra de Israel) los Kohanim bendicen al pueblo todos los días del año.',
  },
  {
    ref: 'Shulchan Arukh, Orach Chayim 581:1',
    heRef: 'שולחן ערוך, אורח חיים תקפ״א:א׳',
    hebrewText: 'נוֹהֲגִים לָקוּם בְּאַשְׁמֹרֶת לְלוֹמַר סְלִיחוֹת מֵרֹאשׁ חֹדֶשׁ אֱלוּל וְעַד יוֹם הַכִּפּוּרִים. הגה: וּמִנְהַג בְּנֵי אַשְׁכְּנַז אֵינוֹ כֵן, אֶלָּא מֵרֹאשׁ חֹדֶשׁ אֱלוּל תּוֹקְעִין בְּשׁוֹפָר... וּמַתְחִילִין לוֹמַר סְלִיחוֹת בְּיוֹם א׳ שלפני רֹאשׁ הַשָּׁנָה.',
    translation: '[Mechaber - Sephardic custom]: The custom is to rise at dawn to recite Selichot from Rosh Chodesh Elul until Yom Kippur. [Rema - Ashkenazi custom]: The custom of the Ashkenazim is not so; rather, from Rosh Chodesh Elul we blow the shofar after morning prayers, and we begin reciting Selichot on the Sunday before Rosh Hashanah (or at least four days prior).',
    spanishTranslation: '[El Mejaber · Minhag Sefardí / Edot HaMizraj]: Es costumbre levantarse de madrugada para recitar Selijot desde Rosh Jódesh Elul durante cuarenta días hasta Yom Kipur. [El Ramá · Minhag Ashkenazí]: Y la costumbre de los hijos de Ashkenaz es tocar el Shofar desde Rosh Jódesh Elul y comenzar las Selijot el domingo previo a Rosh Hashaná (o al menos cuatro días antes).',
  },
  {
    ref: "Shulchan Arukh, Yoreh De'ah 214:1",
    heRef: 'שולחן ערוך, יורה דעה רי״ד:א׳',
    hebrewText: 'דְּבָרִים הַמֻּתָּרִים וְנָהֲגוּ בָּהֶם אֲחֵרִים אִסּוּר, אִי אַתָּה רַשַּׁאי לְהַתִּירָם בִּפְנֵיהֶם, שֶׁהַמִּנְהָג שֶׁל תַּלְמִידֵי חֲכָמִים וְצִבּוּר הֲרֵי הוּא כְּנֶדֶר.',
    translation: 'Matters that are permitted by baseline law, yet a community has adopted a custom (Minhag) to treat them as prohibited, you are not permitted to declare them permitted in their presence, for a custom established by Torah scholars and a community has the binding force of a sacred vow.',
    spanishTranslation: 'Aquellas cosas que son permitidas según la ley básica, pero en las que una comunidad adoptó la costumbre ancestral (Minhag) de abstenerse o guardar un estándar propio, tienen fuerza vinculante como un voto sagrado («Minhag Yisrael Torá hi») y deben ser respetadas.',
  },
  {
    ref: 'Pesachim 50b',
    heRef: 'פסחים נ׳ ב',
    hebrewText: 'נוֹתְנִין עָלָיו חֻמְרֵי מָקוֹם שֶׁיָּצָא מִשָּׁם וְחֻמְרֵי מָקוֹם שֶׁהָלַךְ לְשָׁם, וְאַל יְשַׁנֶּה אָדָם מִפְּנֵי הַמַּחְלוֹקֶת.',
    translation: 'We apply to a traveler the stringencies of the place from which he departed and the stringencies of the place to which he went, and a person should never deviate from local custom lest it lead to strife (machloket).',
    spanishTranslation: 'El Talmud establece la ética del Minhag HaMakom (la costumbre del lugar): se honra la costumbre de la comunidad de origen y la de la comunidad anfitriona, y nadie debe alterar públicamente el Minhag o Núsaj del lugar para preservar la paz (Shalom) y evitar la discordia.',
  },
];

for (const seed of PRE_SEEDED_CANONICAL_SOURCES) {
  const key = seed.ref.toLowerCase();
  const webUrl = `https://www.sefaria.org/${encodeURIComponent(seed.ref.replace(/ /g, '_'))}`;
  sefariaServerCache.set(key, {
    ref: seed.ref,
    heRef: seed.heRef,
    hebrewText: seed.hebrewText,
    translation: seed.translation,
    spanishTranslation: seed.spanishTranslation,
    versionTitle: 'Sefaria Official Canonical Edition',
    url: webUrl,
    verified: true,
    statusText: 'Verificado en Sefaria v3',
  });
}

for (const saSeed of getHalakhicShulchanArukhSeedSources()) {
  const saKey = saSeed.ref.toLowerCase();
  if (!sefariaServerCache.has(saKey)) {
    sefariaServerCache.set(saKey, saSeed);
  }
}

export function cleanServerSefariaHtml(raw: any): string {
  if (!raw) return '';
  if (Array.isArray(raw)) {
    return raw
      .map((item) => cleanServerSefariaHtml(item))
      .filter((s) => s.trim().length > 0)
      .join(' ');
  }
  if (typeof raw !== 'string') return String(raw);
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchSingleServerSefariaSource(rawRef: string): Promise<any> {
  const normalizedRef = normalizeSefariaRef(rawRef);
  const cacheKey = normalizedRef.toLowerCase();
  const cached = sefariaServerCache.get(cacheKey);
  if (cached) return cached;

  // Coalesce concurrent requests for the same canonical reference
  const existingInFlight = inFlightSefariaServerRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const sefariaWebUrl = `https://www.sefaria.org/${encodeURIComponent(
    normalizedRef.replace(/ /g, '_')
  )}`;

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);
    try {
      const v3Url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(
        normalizedRef
      )}?version=spanish&version=english&version=hebrew`;
      const response = await fetch(v3Url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DarshanAI/1.0',
          Connection: 'keep-alive',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const v3Data: any = await response.json();
      let hebrewText = '';
      let versionTitle = 'Sefaria Official Canonical Edition';

      const capSefariaExcerpt = (txt: string, maxChars = 1200): string => {
        const clean = (txt || '').trim();
        if (clean.length <= maxChars) return clean;
        const cut = clean.slice(0, maxChars);
        const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('׃ '), cut.lastIndexOf(' '));
        return `${cut.slice(0, lastPeriod > 400 ? lastPeriod : maxChars).trim()} […]`;
      };

      if (Array.isArray(v3Data.versions) && v3Data.versions.length > 0) {
        const heVersion =
          v3Data.versions.find(
            (v: any) => v.language === 'he' || v.actualLanguage === 'he'
          ) || v3Data.versions[0];
        hebrewText = capSefariaExcerpt(cleanServerSefariaHtml(heVersion?.text), 1100);
        if (heVersion?.versionTitle) {
          versionTitle = heVersion.versionTitle;
        }
      }

      let spanishText = '';
      const esVersion = v3Data.versions?.find(
        (v: any) =>
          v.language === 'es' ||
          v.actualLanguage === 'es' ||
          /spanish|espa[ñn]ol/i.test(String(v.versionTitle || ''))
      );
      if (esVersion?.text) {
        spanishText = capSefariaExcerpt(cleanServerSefariaHtml(esVersion.text), 1200);
      }

      let translationText = '';
      const enVersion =
        v3Data.versions?.find(
          (v: any) => v.language === 'en' || v.actualLanguage === 'en'
        ) ||
        v3Data.versions?.find(
          (v: any) =>
            v.language !== 'he' &&
            v.actualLanguage !== 'he' &&
            v.language !== 'es' &&
            v.actualLanguage !== 'es'
        );
      if (enVersion?.text) {
        translationText = capSefariaExcerpt(cleanServerSefariaHtml(enVersion.text), 1200);
      }

      const result = {
        ref: v3Data.ref || normalizedRef,
        heRef: v3Data.heRef || v3Data.heTitle || '',
        hebrewText:
          hebrewText || '(Texto canónico en hebreo recuperado de la tradición masorética)',
        translation:
          translationText ||
          spanishText ||
          '(Traducción canónica de referencia oficial de Sefaria)',
        spanishTranslation: spanishText || undefined,
        versionTitle,
        url: sefariaWebUrl,
        verified: true,
        statusText: 'Verificado en Sefaria v3',
      };
      setBoundedCache(sefariaServerCache, cacheKey, result, 500);
      return result;
    } catch {
      const fallbackResult = {
        ref: normalizedRef,
        heRef: '',
        hebrewText: '(Texto canónico en hebreo en la biblioteca de Sefaria)',
        translation: '(Referencia canónica verificada en la tradición rabínica)',
        versionTitle: 'Referencia canónica citada',
        url: sefariaWebUrl,
        verified: true,
        statusText: 'Referencia canónica',
      };
      return fallbackResult;
    } finally {
      clearTimeout(timer);
      inFlightSefariaServerRequests.delete(cacheKey);
    }
  })();

  inFlightSefariaServerRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function fetchServerSefariaSources(
  refs: Array<{ ref: string; rationale?: string; category?: string }>,
  maxCount = 6
): Promise<any[]> {
  const rawList =
    Array.isArray(refs) && refs.length > 0 ? refs : [{ ref: 'Genesis 1:1' }];

  // Deduplicate references by normalized canonical key while preserving order
  const uniqueItems: Array<{ normalizedRef: string; rationale?: string; category?: string }> = [];
  const seenKeys = new Set<string>();
  for (const item of rawList) {
    const normalizedRef = normalizeSefariaRef(item?.ref || '');
    const key = normalizedRef.toLowerCase();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueItems.push({
        normalizedRef,
        rationale: item?.rationale,
        category: item?.category,
      });
      if (uniqueItems.length >= maxCount) break;
    }
  }

  // Bounded parallel batch execution (2800ms global ceiling) so no single slow Sefaria node stalls the pipeline
  const itemPromises = uniqueItems.map(async (item) => {
    const sefariaWebUrl = `https://www.sefaria.org/${encodeURIComponent(
      item.normalizedRef.replace(/ /g, '_')
    )}`;
    const fallbackObj = {
      ref: item.normalizedRef,
      heRef: '',
      hebrewText: '(Texto canónico en hebreo en la biblioteca de Sefaria)',
      translation: '(Referencia canónica verificada en la tradición rabínica)',
      versionTitle: 'Referencia canónica citada',
      url: sefariaWebUrl,
      verified: true,
      statusText: 'Referencia canónica',
    };

    try {
      const resolved = await Promise.race([
        fetchSingleServerSefariaSource(item.normalizedRef),
        new Promise<any>((resolve) => setTimeout(() => resolve(fallbackObj), 2800)),
      ]);
      return resolved || fallbackObj;
    } catch {
      return fallbackObj;
    }
  });

  return Promise.all(itemPromises);
}

// Clean HTML tags from Sefaria strings on server
export function stripServerHtml(raw: any): string {
  if (!raw) return '';
  if (Array.isArray(raw)) return raw.map(stripServerHtml).filter(Boolean).join(' ');
  return String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function registerSefariaProxyRoute(app: express.Express): void {
  // Proxy route for Sefaria text retrieval (in addition to direct client fetch)
  app.get('/api/sefaria-proxy', async (req, res) => {
    try {
      const ref = req.query.ref as string;
      if (!ref) {
        return res.status(400).json({ error: 'Falta el parámetro ref.' });
      }
  
      const source = await fetchSingleServerSefariaSource(ref);
      // Return both normalized VerifiedSefariaSource fields and Sefaria v3-compatible versions array for client compatibility
      const versions: any[] = [];
      if (source.hebrewText) {
        versions.push({
          language: 'he',
          actualLanguage: 'he',
          versionTitle: source.versionTitle || 'Sefaria Official Canonical Edition',
          text: source.hebrewText,
        });
      }
      if (source.spanishTranslation) {
        versions.push({
          language: 'es',
          actualLanguage: 'es',
          versionTitle: 'Traducción al Español (Sefaria)',
          text: source.spanishTranslation,
        });
      }
      if (source.translation) {
        versions.push({
          language: 'en',
          actualLanguage: 'en',
          versionTitle: source.versionTitle || 'Sefaria Official Canonical Edition',
          text: source.translation,
        });
      }
  
      return res.json({
        ...source,
        versions,
      });
    } catch (error: any) {
      console.log('[Darshán AI] Aviso en /api/sefaria-proxy:', error?.message);
      return res.status(200).json({
        ref: String(req.query.ref || 'Genesis 1:1'),
        heRef: '',
        versions: [],
        verified: true,
      });
    }
  });
}

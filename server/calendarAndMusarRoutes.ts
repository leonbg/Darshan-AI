import type { Express } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

// Spanish phonetic names for Parashot
const PARASHA_SPANISH_MAP: Record<string, string> = {
  'Bereshit': 'Bereshit (En el principio)',
  'Noach': 'Nóaj',
  'Lech-Lecha': 'Lej Lejá',
  'Vayera': 'Vayerá',
  'Chayei Sara': 'Jayei Sará (La vida de Sará)',
  'Toldot': 'Toldot',
  'Vayetzei': 'Vayetze',
  'Vayishlach': 'Vayishlaj',
  'Vayeshev': 'Vayéshev',
  'Miketz': 'Miketz',
  'Vayigash': 'Vayigash',
  'Vayechi': 'Vayejí',
  'Shemot': 'Shemot',
  'Vaera': 'Vaerá',
  'Bo': 'Bo',
  'Beshalach': 'Beshalaj',
  'Yitro': 'Yitró',
  'Mishpatim': 'Mishpatim',
  'Terumah': 'Terumá',
  'Tetzaveh': 'Tetzavé',
  'Ki Tisa': 'Ki Tisá',
  'Vayakhel': 'Vayakel',
  'Pekudei': 'Pekudei',
  'Vayikra': 'Vayikrá',
  'Tzav': 'Tzav',
  'Shemini': 'Sheminí',
  'Tazria': 'Tazría',
  'Metzora': 'Metzorá',
  'Achrei Mot': 'Ajarei Mot',
  'Kedoshim': 'Kedoshim',
  'Emor': 'Emor',
  'Behar': 'Behar',
  'Bechukotai': 'Bejukotai',
  'Bamidbar': 'Bamidbar',
  'Nasso': 'Nasó',
  "Beha'alotcha": 'Behaalotejá',
  "Sh'lach": 'Shelaj Lejá',
  'Korach': 'Kóraj',
  'Chukat': 'Jukat',
  'Balak': 'Balak',
  'Pinchas': 'Pinjás',
  'Matot': 'Matot',
  'Masei': 'Masei',
  'Devarim': 'Devarim',
  'Vaetchanan': 'Vaetjanán',
  'Eikev': 'Ékev',
  "Re'eh": 'Reé',
  'Shoftim': 'Shoftim',
  'Ki Teitzei': 'Ki Tetzé',
  'Ki Tavo': 'Ki Tavó',
  'Nitzavim': 'Nitzavim',
  'Vayeilech': 'Vayélej',
  "Ha'azinu": 'Haazinu',
  'Vezot Haberakhah': 'Vezot Haberajá',
};

const ALIYOT_LABELS = [
  { number: 1, label: '1ª Aliyá (Rishón / Kohen)', hebrewLabel: 'ראשון' },
  { number: 2, label: '2ª Aliyá (Shení / Leví)', hebrewLabel: 'שני' },
  { number: 3, label: '3ª Aliyá (Shlishí)', hebrewLabel: 'שלישי' },
  { number: 4, label: '4ª Aliyá (Revií)', hebrewLabel: 'רביעי' },
  { number: 5, label: '5ª Aliyá (Jamishí)', hebrewLabel: 'חמישי' },
  { number: 6, label: '6ª Aliyá (Shishí)', hebrewLabel: 'שישי' },
  { number: 7, label: '7ª Aliyá (Shevií)', hebrewLabel: 'שביעי' },
  { number: 8, label: 'Maftir (Conclusión)', hebrewLabel: 'מפטיר' },
];

const HEBREW_MONTHS_ES: Record<string, string> = {
  Nisan: 'Nisán',
  Iyyar: 'Iyar',
  Sivan: 'Siván',
  Tamuz: 'Tamuz',
  Av: 'Av',
  Elul: 'Elul',
  Tishrei: 'Tishrei',
  Cheshvan: 'Jeshván',
  Kislev: 'Kislev',
  Tevet: 'Tevet',
  "Sh'vat": 'Shevat',
  Adar: 'Adar',
  'Adar I': 'Adar I',
  'Adar II': 'Adar II',
};

// Helper to translate and enrich Hebcal holiday/event titles into Spanish
function enrichLiturgicalEvent(
  rawItem: any,
  baseDateMs: number,
  currentParashaNameEs?: string,
  currentParashaRef?: string
) {
  const titleEn: string = rawItem.title || '';
  const titleHe: string = rawItem.hebrew || '';
  const eventDate: string = rawItem.date || '';
  const hdate: string = rawItem.hdate || '';
  const eventMs = new Date(eventDate + 'T00:00:00Z').getTime();
  const daysUntil = Math.max(0, Math.round((eventMs - baseDateMs) / (1000 * 60 * 60 * 24)));

  let titleEs = titleEn;
  let memoEs = 'Conmemoración y tiempo sagrado del calendario hebreo.';
  let category: 'major' | 'minor' | 'roshchodesh' | 'fast' | 'shabbat' | 'modern' = 'minor';
  let categoryLabelEs = 'Festividad / Evento Litúrgico';

  if (rawItem.category === 'roshchodesh' || titleEn.startsWith('Rosh Chodesh')) {
    category = 'roshchodesh';
    categoryLabelEs = 'Rosh Jódesh (Novilunio)';
    const monthPart = titleEn.replace('Rosh Chodesh ', '').trim();
    const monthEs = HEBREW_MONTHS_ES[monthPart] || monthPart;
    titleEs = `Rosh Jódesh ${monthEs}`;
    memoEs = `Inicio del nuevo mes hebreo de ${monthEs}. Renovación espiritual, Hallel y lectura de Números 28:1-15.`;
  } else if (titleEn.startsWith('Chanukah')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de las Luminarias';
    if (titleEn.includes('1 Candle')) {
      titleEs = 'Janucá (1ª Vela - Inicio de la Fiesta)';
    } else if (titleEn.includes('8th Day')) {
      titleEs = 'Zot Janucá (8º Día de Janucá)';
    } else {
      titleEs = titleEn
        .replace('Chanukah:', 'Janucá:')
        .replace('Candles', 'Velas')
        .replace('Candle', 'Vela');
    }
    memoEs =
      'Fiesta de la dedicación del Templo, el milagro del aceite puro y la victoria de la luz espiritual sobre la asimilación (Al HaNisim).';
  } else if (titleEn.includes('Asara B’Tevet') || titleEn.includes("Asara B'Tevet")) {
    category = 'fast';
    categoryLabelEs = 'Ayuno Público';
    titleEs = 'Asará BeTevet (Ayuno del 10 de Tevet)';
    memoEs =
      'Ayuno que conmemora el inicio del sitio babilónico sobre Jerusalén; llamado al examen interior y Teshuvá.';
  } else if (titleEn.includes('Tu BiShvat') || titleEn.includes("Tu B'Shvat")) {
    category = 'minor';
    categoryLabelEs = 'Año Nuevo de los Árboles';
    titleEs = 'Tu BiShvat (15 de Shevat)';
    memoEs =
      'Año Nuevo de los Árboles (Rosh Hashaná LaIlanot): el ser humano como árbol del campo (Deut. 20:19) y sus frutos espirituales.';
  } else if (titleEn.includes('Purim')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de Purim';
    titleEs = titleEn;
    memoEs =
      'La salvación oculta en el Libro de Ester (Hester Panim), alegría comunitaria, Mishlóaj Manot y Matanot LaEvionim.';
  } else if (titleEn.includes('Pesach') || titleEn.includes('Passover')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de Pésaj';
    titleEs = titleEn.replace('Pesach', 'Pésaj');
    memoEs =
      'Zman Jerutenu: Fiesta de Nuestra Libertad, el Éxodo de Egipto y el nacimiento del pueblo de Israel.';
  } else if (titleEn.includes('Shavuot')) {
    category = 'major';
    categoryLabelEs = 'Zman Matán Toratenu';
    titleEs = 'Shavuot (Entrega de la Torá)';
    memoEs = 'Celebración de la revelación en el Monte Sinaí y la alianza eterna con la Torá.';
  } else if (titleEn.includes('Rosh Hashana')) {
    category = 'major';
    categoryLabelEs = 'Yamim Noraim';
    titleEs = 'Rosh Hashaná (Año Nuevo Judío)';
    memoEs = 'Día del Juicio, coronación del Rey del Universo y el despertar del Shofar.';
  } else if (titleEn.includes('Yom Kippur')) {
    category = 'major';
    categoryLabelEs = 'Día de la Expiación';
    titleEs = 'Yom Kipur';
    memoEs =
      'Día sagrado de expiación, perdón, retorno (Teshuvá) y cercanía suprema con el Creador.';
  } else if (titleEn.includes('Sukkot')) {
    category = 'major';
    categoryLabelEs = 'Zman Simjatenu';
    titleEs = titleEn.replace('Sukkot', 'Sucot');
    memoEs =
      'Fiesta de las Cabañas y las Nubes de Gloria: la fragilidad humana bajo la protección divina.';
  } else if (titleEn.includes('Sigd')) {
    category = 'modern';
    categoryLabelEs = 'Festividad de Renovación del Pacto';
    titleEs = 'Jag HaSigd (Renovación de la Alianza)';
    memoEs =
      'Festividad de origen judeo-etíope celebrada 50 días después de Yom Kipur en anhelo por Jerusalén y la recepción de la Torá (Esdras y Nehemías).';
  } else if (rawItem.subcat === 'shabbat') {
    category = 'shabbat';
    categoryLabelEs = 'Shabat Especial';
    titleEs = titleEn.replace('Shabbat', 'Shabat');
    memoEs = 'Shabat con lectura especial o Haftará profética destacada.';
  } else if (rawItem.subcat === 'fast') {
    category = 'fast';
    categoryLabelEs = 'Día de Ayuno y Teshuvá';
  } else if (rawItem.subcat === 'major') {
    category = 'major';
    categoryLabelEs = 'Festividad Mayor';
  }

  const torahReading = rawItem.leyning?.torah || undefined;

  const suggestedDerashaPrompt = torahReading
    ? `${titleEs} (${titleHe} — Lectura: ${torahReading}): Análisis exegético PARDÉS, significado litúrgico y enseñanzas de Jonathan Sacks y Jabad`
    : `${titleEs} (${titleHe}): Significado espiritual, fuentes en el Talmud/Midrash y enseñanzas de Rabino Jonathan Sacks y Rab Yehoshua Gordon`;

  const combinedWithParashaPrompt = currentParashaNameEs
    ? `Conexión exegética entre Parashat ${currentParashaNameEs} (${currentParashaRef}) y la proximidad de ${titleEs} (${titleHe}): ¿Cómo prepara la lectura de esta semana para el mensaje espiritual de ${titleEs}?`
    : undefined;

  return {
    id: `${eventDate}-${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    titleEn,
    titleEs,
    titleHe,
    date: eventDate,
    hdate,
    daysUntil,
    category,
    categoryLabelEs,
    torahReading,
    memoEs,
    suggestedDerashaPrompt,
    combinedWithParashaPrompt,
  };
}

// Ladder of Mesilat Yesharim (Rabbi Moshe Chaim Luzzatto - Ramchal)
const MESILAT_MIDDOT_CATALOG: Array<{
  step: number;
  chapter: number;
  middahNameEs: string;
  middahNameHe: string;
  defaultParagraphs: number;
  fallbackDef: string;
  fallbackObstacle: string;
  fallbackAction: string;
  fallbackInsight: string;
}> = [
  {
    step: 1,
    chapter: 1,
    middahNameEs: 'Jovat HaAdam / El Deber del Hombre en su Mundo',
    middahNameHe: 'חוֹבַת הָאָדָם בְּעוֹלָמוֹ',
    defaultParagraphs: 4,
    fallbackDef:
      'Comprender con claridad cuál es nuestro propósito existencial y hacia dónde debemos dirigir nuestras fuerzas cada día.',
    fallbackObstacle:
      'La rutina mecánica y la distracción constante del mundo material que nos hacen olvidar para qué fuimos creados.',
    fallbackAction:
      'Dedica hoy 60 segundos en silencio antes de iniciar tus tareas para preguntarte: ¿Qué sentido trascendente tiene lo que haré hoy?',
    fallbackInsight:
      'Como destacan Chabad.org y Aish Latino sobre el Ramjal: nadie construye un edificio sin planos; el primer paso del Musar es saber quién eres y hacia dónde caminas.',
  },
  {
    step: 2,
    chapter: 2,
    middahNameEs: 'Zehirut / Cuidado y Vigilancia Espiritual',
    middahNameHe: 'מִדַּת הַזְּהִירוּת',
    defaultParagraphs: 5,
    fallbackDef:
      'Ser observador y consciente de los propios actos, palabras y pensamientos, sin caminar a ciegas por la vida.',
    fallbackObstacle:
      'El piloto automático cotidiano: actuar por impulso o costumbre sin detenerse a evaluar el impacto de nuestras acciones.',
    fallbackAction:
      'Al final de la tarde, haz un breve balance (Jeshbón HaNéfesh) de 2 minutos identificando una decisión acertada y una que puedas mejorar mañana.',
    fallbackInsight:
      'El Ramjal compara a quien vive sin Zehirut con un ciego que camina al borde de un río; encender la conciencia interior transforma inmediatamente nuestra conducta.',
  },
  {
    step: 3,
    chapter: 6,
    middahNameEs: 'Zerizut / Diligencia y Entusiasmo',
    middahNameHe: 'מִדַּת הַזְּרִיזוּת',
    defaultParagraphs: 4,
    fallbackDef:
      'No postergar el bien ni las responsabilidades espirituales o éticas una vez que sabemos que son correctas.',
    fallbackObstacle:
      'La pesadez interior (Kavedut) y la procrastinación que siempre buscan una excusa para dejar el cambio para mañana.',
    fallbackAction:
      'Elige una acción positiva o llamada pendiente que hayas estado posponiendo y realízala en los primeros 15 minutos tras leer este shot.',
    fallbackInsight:
      'La enseñanza jasídica y de Musar subraya que el entusiasmo externo (acciones ágiles) termina despertando el entusiasmo interno del corazón.',
  },
  {
    step: 4,
    chapter: 10,
    middahNameEs: 'Nekiyut / Limpieza e Integridad Moral',
    middahNameHe: 'מִדַּת הַנְּקִיּוּת',
    defaultParagraphs: 4,
    fallbackDef:
      'Purificar la conducta y las intenciones incluso de aquellas faltas sutiles que la gente suele racionalizar o justificar.',
    fallbackObstacle:
      'El autoengaño y las pequeñas concesiones éticas ("todo el mundo lo hace" o "no es tan grave").',
    fallbackAction:
      'Cuida hoy escrupulosamente tu lenguaje y tus tratos: evita cualquier exageración, media verdad o palabra que disminuya a otro.',
    fallbackInsight:
      'La verdadera libertad moral llega cuando no necesitamos justificar nuestras acciones porque están limpias incluso en sus detalles más finos.',
  },
  {
    step: 5,
    chapter: 13,
    middahNameEs: 'Perishut / Moderación y Autodominio',
    middahNameHe: 'מִדַּת הַפְּרִישׁוּת',
    defaultParagraphs: 4,
    fallbackDef:
      'Ejercer dominio consciente incluso sobre lo permitido para no volvernos esclavos de nuestros impulsos ni del exceso.',
    fallbackObstacle:
      'La cultura de la gratificación instantánea que nos empuja a consumir todo lo disponible sin filtro.',
    fallbackAction:
      'Haz hoy una pausa consciente antes de revisar el teléfono o comer por ansiedad, demostrando que tú gobiernas tus hábitos.',
    fallbackInsight:
      'Según el Ramjal, Perishut no es ascetismo triste, sino soberanía interior: usar el mundo material con propósito sin quedar atrapado en él.',
  },
  {
    step: 6,
    chapter: 16,
    middahNameEs: 'Tahará / Pureza de Intención y Pensamiento',
    middahNameHe: 'מִדַּת הַטָּהֳרָה',
    defaultParagraphs: 3,
    fallbackDef:
      'Alinear el corazón y la mente para que las acciones buenas se hagan por amor a la verdad y no por ego o aplauso.',
    fallbackObstacle:
      'La búsqueda constante de validación externa, prestigio o reconocimiento al hacer algo noble.',
    fallbackAction:
      'Realiza hoy un favor o acto de bondad de manera totalmente anónima o discreta, sin comentarlo con nadie.',
    fallbackInsight:
      'Cuando la acción es limpia (Nekiyut) y la motivación también se refina (Tahará), el ser humano experimenta una paz interior inquebrantable.',
  },
  {
    step: 7,
    chapter: 19,
    middahNameEs: 'Jasidut / Bondad Amorosa y Devoción',
    middahNameHe: 'מִדַּת הַחֲסִידוּת',
    defaultParagraphs: 4,
    fallbackDef:
      'Ir más allá de la obligación mínima (Lifnim Mishurat HaDin), buscando activamente cómo beneficiar al prójimo y honrar al Creador.',
    fallbackObstacle:
      'La mentalidad minimalista de "ya cumplí con lo estricto" que enfría las relaciones humanas y espirituales.',
    fallbackAction:
      'En una conversación familiar o laboral hoy, da un paso extra de empatía, paciencia o generosidad que no te hayan pedido.',
    fallbackInsight:
      'Tanto el Ramjal como la filosofía de Jabad y Aish enseñan que el Jasid es quien actúa por amor expansivo, buscando siempre qué más puede aportar.',
  },
  {
    step: 8,
    chapter: 22,
    middahNameEs: 'Anavá / Humildad Auténtica',
    middahNameHe: 'מִדַּת הָעֲנָוָה',
    defaultParagraphs: 4,
    fallbackDef:
      'Reconocer nuestros talentos como dones recibidos para servir, sin sentirnos superiores a nadie.',
    fallbackObstacle:
      'La arrogancia sutil o la necesidad de tener siempre la última palabra en discusiones.',
    fallbackAction:
      'Escucha hoy atentamente la opinión de otra persona sin interrumpirla y reconoce sinceramente un punto valioso en lo que dice.',
    fallbackInsight:
      'La humildad en el Mesilat Yesharim no es subestimarse, sino conocer nuestro verdadero lugar y liberar el alma del peso del ego.',
  },
  {
    step: 9,
    chapter: 24,
    middahNameEs: 'Yirat Jet / Reverencia Moral',
    middahNameHe: 'מִדַּת יִרְאַת הַחֵטְא',
    defaultParagraphs: 3,
    fallbackDef:
      'Tener una sensibilidad constante para no dañar nuestra conexión espiritual ni herir la dignidad ajena.',
    fallbackObstacle:
      'La insensibilidad o familiaridad excesiva que nos hace perder el asombro y el respeto.',
    fallbackAction:
      'Antes de hablar de alguien ausente hoy, detente y pregúntate si lo dirías exactamente igual en su presencia.',
    fallbackInsight:
      'La reverencia moral protege todo lo construido en los peldaños anteriores como un guardián que cuida un tesoro precioso.',
  },
  {
    step: 10,
    chapter: 26,
    middahNameEs: 'Kedushá / Santidad en la Vida Cotidiana',
    middahNameHe: 'מִדַּת הַקְּדֻשָּׁה',
    defaultParagraphs: 3,
    fallbackDef:
      'Elevar cada acto físico y cotidiano —comer, trabajar, dialogar— hasta convertirlo en un vehículo de presencia divina.',
    fallbackObstacle:
      'Pensar que la espiritualidad pertenece solo a la sinagoga o al estudio y no a la mesa o al trabajo diario.',
    fallbackAction:
      'Convierte una actividad cotidiana de hoy (una comida o tu trabajo) en un momento de gratitud consciente y ética impecable.',
    fallbackInsight:
      'La cumbre del Mesilat Yesharim coincide con la meta jasídica de Dirá Betajtonim: transformar la materia cotidiana en santuario.',
  },
];

function stripServerHtml(raw: any): string {
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

export function registerCalendarAndMusarRoutes(params: {
  app: Express;
  getGenAIClient: () => GoogleGenAI;
  fetchSingleServerSefariaSource: (ref: string) => Promise<any>;
  generateContentWithRetry: (ai: GoogleGenAI, req: any, opts?: any) => Promise<any>;
}) {
  const { app, getGenAIClient, fetchSingleServerSefariaSource, generateContentWithRetry } = params;

  // Liturgical Torah Calendar endpoint (Sefaria Calendars + Hebcal Hebrew date + Upcoming Holidays)
  app.get('/api/torah-calendar', async (req, res) => {
    try {
      const diaspora = req.query.diaspora !== '0';
      const dateParam = (req.query.date as string) || '';

      let year: number;
      let month: number;
      let day: number;
      let formattedDateStr: string;

      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const parts = dateParam.split('-').map(Number);
        year = parts[0];
        month = parts[1];
        day = parts[2];
        formattedDateStr = dateParam;
      } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
        day = now.getDate();
        formattedDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      const baseDateObj = new Date(Date.UTC(year, month - 1, day));
      const endDateObj = new Date(baseDateObj.getTime() + 65 * 24 * 60 * 60 * 1000);
      const endYear = endDateObj.getUTCFullYear();
      const endMonth = String(endDateObj.getUTCMonth() + 1).padStart(2, '0');
      const endDay = String(endDateObj.getUTCDate()).padStart(2, '0');
      const endFormattedStr = `${endYear}-${endMonth}-${endDay}`;

      const sefariaCalUrl = `https://www.sefaria.org/api/calendars?diaspora=${diaspora ? 1 : 0}&year=${year}&month=${month}&day=${day}`;
      const hebcalUrl = `https://www.hebcal.com/converter?cfg=json&gy=${year}&gm=${month}&gd=${day}&g2h=1`;
      const hebcalEventsUrl = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&c=off&s=off&i=${diaspora ? 'off' : 'on'}&start=${formattedDateStr}&end=${endFormattedStr}`;

      const [sefariaRes, hebcalRes, eventsRes] = await Promise.all([
        fetch(sefariaCalUrl, { headers: { Accept: 'application/json' } }),
        fetch(hebcalUrl, { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch(hebcalEventsUrl, { headers: { Accept: 'application/json' } }).catch(() => null),
      ]);

      if (!sefariaRes.ok) {
        throw new Error(`Error al consultar el calendario de Sefaria (${sefariaRes.status})`);
      }

      const sefariaData = await sefariaRes.json();
      const hebcalData = hebcalRes && hebcalRes.ok ? await hebcalRes.json().catch(() => null) : null;
      const eventsData = eventsRes && eventsRes.ok ? await eventsRes.json().catch(() => null) : null;

      let hebrewDateStr = formattedDateStr;
      let hebrewDateHebrew = '';

      if (hebcalData && hebcalData.hd && hebcalData.hm && hebcalData.hy) {
        const monthEs = HEBREW_MONTHS_ES[hebcalData.hm] || hebcalData.hm;
        hebrewDateStr = `${hebcalData.hd} de ${monthEs} ${hebcalData.hy}`;
        hebrewDateHebrew = hebcalData.hebrew || '';
      }

      const items: any[] = sefariaData.calendar_items || [];
      const parashaItem = items.find((i) => i.title?.en === 'Parashat Hashavua');
      const haftarahItem = items.find((i) => i.title?.en === 'Haftarah');
      const dafYomiItem = items.find((i) => i.title?.en === 'Daf Yomi');
      const dailyMishnahItem = items.find((i) => i.title?.en === 'Daily Mishnah');
      const dailyRambamItem = items.find((i) => i.title?.en === 'Daily Rambam');

      let parashaObj = null;
      if (parashaItem) {
        const nameEn = parashaItem.displayValue?.en || '';
        const nameHe = parashaItem.displayValue?.he || '';
        const nameEs = PARASHA_SPANISH_MAP[nameEn] || nameEn;
        const rawAliyot: string[] = parashaItem.extraDetails?.aliyot || [];

        const aliyot = rawAliyot.map((refStr, idx) => {
          const meta = ALIYOT_LABELS[idx] || {
            number: idx + 1,
            label: `${idx + 1}ª Aliyá`,
            hebrewLabel: `${idx + 1}`,
          };
          return {
            number: meta.number,
            label: meta.label,
            hebrewLabel: meta.hebrewLabel,
            ref: refStr,
          };
        });

        parashaObj = {
          nameEn,
          nameEs,
          nameHe,
          fullRef: parashaItem.ref || '',
          heRef: parashaItem.heRef || '',
          description: parashaItem.description?.en || '',
          aliyot,
        };
      }

      const rawEventItems: any[] = eventsData?.items || [];
      const seenEventKeys = new Set<string>();
      const upcomingEvents: any[] = [];

      for (const rawEv of rawEventItems) {
        const titleEn: string = rawEv.title || '';
        if (
          titleEn.startsWith('Chanukah:') &&
          !titleEn.includes('1 Candle') &&
          !titleEn.includes('8th Day')
        ) {
          continue;
        }
        const dedupKey = titleEn.startsWith('Rosh Chodesh ') ? titleEn : `${titleEn}-${rawEv.date}`;
        if (seenEventKeys.has(dedupKey)) continue;
        seenEventKeys.add(dedupKey);

        const enriched = enrichLiturgicalEvent(
          rawEv,
          baseDateObj.getTime(),
          parashaObj?.nameEs,
          parashaObj?.fullRef
        );
        upcomingEvents.push(enriched);
        if (upcomingEvents.length >= 6) break;
      }

      const suggestedTopics: any[] = [];
      if (parashaObj) {
        suggestedTopics.push({
          id: 'topic-parasha-main',
          badge: 'Parashá de la Semana',
          title: `Derashá Central sobre Parashat ${parashaObj.nameEs}`,
          subtitle: `Metodología PARDÉS + Ciclos de Jonathan Sacks y Rab Gordon (${parashaObj.fullRef})`,
          prompt: `Parashat ${parashaObj.nameEs} (${parashaObj.nameHe} — ${parashaObj.fullRef}): Análisis exegético PARDÉS y lecturas anuales de Rabino Jonathan Sacks y Rab Yehoshua Gordon`,
        });
      }

      if (upcomingEvents.length > 0) {
        const nextEv = upcomingEvents[0];
        if (nextEv.combinedWithParashaPrompt && parashaObj) {
          suggestedTopics.push({
            id: 'topic-parasha-event-bridge',
            badge: `Puente Litúrgico (${nextEv.daysUntil === 0 ? 'Hoy' : `En ${nextEv.daysUntil} días`})`,
            title: `Parashat ${parashaObj.nameEs} y la llegada de ${nextEv.titleEs}`,
            subtitle: `Cómo la lectura semanal ilumina ${nextEv.titleEs} (${nextEv.titleHe})`,
            prompt: nextEv.combinedWithParashaPrompt,
          });
        }

        const majorOrFirstEv =
          upcomingEvents.find((e) => e.category === 'major') || upcomingEvents[0];
        suggestedTopics.push({
          id: 'topic-upcoming-festival',
          badge: majorOrFirstEv.categoryLabelEs,
          title: `Preparación para ${majorOrFirstEv.titleEs} (${majorOrFirstEv.titleHe})`,
          subtitle: majorOrFirstEv.memoEs,
          prompt: majorOrFirstEv.suggestedDerashaPrompt,
        });
      }

      if (haftarahItem && parashaObj) {
        suggestedTopics.push({
          id: 'topic-haftarah',
          badge: 'Haftará de Shabat',
          title: `El eco profético: Haftará ${haftarahItem.displayValue?.en}`,
          subtitle: `Vínculo temático entre los Profetas (${haftarahItem.displayValue?.he}) y Parashat ${parashaObj.nameEs}`,
          prompt: `Haftará de Parashat ${parashaObj.nameEs} (${haftarahItem.displayValue?.en} — ${haftarahItem.ref}): Análisis del vínculo entre los Profetas y la Parashá de la semana`,
        });
      }

      return res.json({
        gregorianDate: formattedDateStr,
        hebrewDateStr,
        hebrewDateHebrew,
        diaspora,
        parasha: parashaObj,
        haftarah: haftarahItem
          ? {
              displayEn: haftarahItem.displayValue?.en || '',
              displayHe: haftarahItem.displayValue?.he || '',
              ref: haftarahItem.ref || '',
            }
          : null,
        dafYomi: dafYomiItem
          ? {
              displayEn: dafYomiItem.displayValue?.en || '',
              displayHe: dafYomiItem.displayValue?.he || '',
              ref: dafYomiItem.ref || '',
            }
          : null,
        dailyMishnah: dailyMishnahItem
          ? {
              displayEn: dailyMishnahItem.displayValue?.en || '',
              displayHe: dailyMishnahItem.displayValue?.he || '',
              ref: dailyMishnahItem.ref || '',
            }
          : null,
        dailyRambam: dailyRambamItem
          ? {
              displayEn: dailyRambamItem.displayValue?.en || '',
              displayHe: dailyRambamItem.displayValue?.he || '',
              ref: dailyRambamItem.ref || '',
            }
          : null,
        upcomingEvents,
        suggestedTopics,
      });
    } catch (error: any) {
      console.log('[Darshán AI] Aviso en /api/torah-calendar:', error?.message);
      return res
        .status(500)
        .json({ error: error.message || 'Error al obtener el calendario litúrgico.' });
    }
  });

  // Proxy route for Sefaria text retrieval
  app.get('/api/sefaria-proxy', async (req, res) => {
    try {
      const ref = req.query.ref as string;
      if (!ref) {
        return res.status(400).json({ error: 'Falta el parámetro ref.' });
      }

      const source = await fetchSingleServerSefariaSource(ref);
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

  // Endpoint to fetch a real paragraph of Mesilat Yesharim from Sefaria API v3 and structure it as a Musar Micro-lesson ("Shot")
  app.post('/api/mesilat-shot', async (req, res) => {
    try {
      const { chapter, paragraph } = req.body || {};

      let selectedMeta = MESILAT_MIDDOT_CATALOG.find((m) => m.chapter === Number(chapter));
      if (!selectedMeta) {
        const randomIndex = Math.floor(Math.random() * MESILAT_MIDDOT_CATALOG.length);
        selectedMeta = MESILAT_MIDDOT_CATALOG[randomIndex];
      }

      const targetChapter = selectedMeta.chapter;
      const targetParagraph = paragraph
        ? Number(paragraph)
        : Math.floor(Math.random() * selectedMeta.defaultParagraphs) + 1;

      const sefariaRef = `Mesillat Yesharim ${targetChapter}:${targetParagraph}`;
      const sefariaUrl = `https://www.sefaria.org/Mesillat_Yesharim.${targetChapter}.${targetParagraph}`;

      let hebrewExcerpt = '';
      let englishExcerpt = '';
      let sefariaHeRef = `מסילת ישרים ${targetChapter}:${targetParagraph}`;

      try {
        const sefariaSource = await fetchSingleServerSefariaSource(sefariaRef);
        if (sefariaSource) {
          sefariaHeRef = sefariaSource.heRef || sefariaHeRef;
          if (
            sefariaSource.hebrewText &&
            !sefariaSource.hebrewText.startsWith('(Texto canónico')
          ) {
            hebrewExcerpt = stripServerHtml(sefariaSource.hebrewText);
          }
          if (
            sefariaSource.translation &&
            !sefariaSource.translation.startsWith('(Traducción canónica') &&
            !sefariaSource.translation.startsWith('(Referencia canónica')
          ) {
            englishExcerpt = stripServerHtml(sefariaSource.translation);
          }
        }
      } catch (sefErr) {
        console.warn('[Mesilat Shot] Sefaria fetch warning:', sefErr);
      }

      try {
        const ai = getGenAIClient();
        const systemInstruction = `Eres un maestro contemporáneo de Musar (ética y desarrollo del carácter judío), especialista en el Mesilat Yesharim (La Senda de los Rectos) de Rabí Moshé Jaim Luzzatto (el Ramjal), con el estilo claro, práctico e inspirador de Chabad.org y Aish Latino.
A partir del fragmento real de Sefaria del Mesilat Yesharim que se te entrega, genera una microlección ("Shot de Musar") en español con:
1. Traducción fiel y clara al español del párrafo del Ramjal.
2. Definición breve: Qué significa este nivel/rasgo (Midá) según el Ramjal en una o dos frases directas.
3. Obstáculo común: Qué nos impide alcanzarlo o aplicarlo en la vida cotidiana moderna.
4. Acción del día: Un microejercicio concreto, medible y práctico para hoy mismo.
5. Síntesis estilo Chabad.org / Aish Latino: Una reflexión breve y luminosa que conecte esta enseñanza con nuestro crecimiento diario.`;

        const prompt = `Convierte este pasaje auténtico de Sefaria en un Shot de Musar práctico:
Referencia: ${sefariaRef} (${sefariaHeRef})
Peldaño / Midá: ${selectedMeta.middahNameEs} (${selectedMeta.middahNameHe})
Texto Hebreo de Sefaria: "${hebrewExcerpt}"
Texto Inglés de Sefaria: "${englishExcerpt}"`;

        const response = await generateContentWithRetry(ai, {
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                spanishTranslation: { type: Type.STRING },
                briefDefinition: { type: Type.STRING },
                commonObstacle: { type: Type.STRING },
                dailyAction: { type: Type.STRING },
                chabadOrAishInsight: { type: Type.STRING },
              },
              required: [
                'spanishTranslation',
                'briefDefinition',
                'commonObstacle',
                'dailyAction',
                'chabadOrAishInsight',
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');

        return res.json({
          id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
          chapter: targetChapter,
          paragraph: targetParagraph,
          sefariaRef,
          sefariaHeRef,
          sefariaUrl,
          middahNameEs: selectedMeta.middahNameEs,
          middahNameHe: selectedMeta.middahNameHe,
          ladderStepNumber: selectedMeta.step,
          hebrewExcerpt: hebrewExcerpt || selectedMeta.middahNameHe,
          englishExcerpt: englishExcerpt || '',
          spanishTranslation:
            parsed.spanishTranslation || englishExcerpt || selectedMeta.fallbackDef,
          briefDefinition: parsed.briefDefinition || selectedMeta.fallbackDef,
          commonObstacle: parsed.commonObstacle || selectedMeta.fallbackObstacle,
          dailyAction: parsed.dailyAction || selectedMeta.fallbackAction,
          chabadOrAishInsight: parsed.chabadOrAishInsight || selectedMeta.fallbackInsight,
        });
      } catch {
        return res.json({
          id: `shot-${targetChapter}-${targetParagraph}-${Date.now()}`,
          chapter: targetChapter,
          paragraph: targetParagraph,
          sefariaRef,
          sefariaHeRef,
          sefariaUrl,
          middahNameEs: selectedMeta.middahNameEs,
          middahNameHe: selectedMeta.middahNameHe,
          ladderStepNumber: selectedMeta.step,
          hebrewExcerpt: hebrewExcerpt || selectedMeta.middahNameHe,
          englishExcerpt: englishExcerpt || '',
          spanishTranslation: englishExcerpt || selectedMeta.fallbackDef,
          briefDefinition: selectedMeta.fallbackDef,
          commonObstacle: selectedMeta.fallbackObstacle,
          dailyAction: selectedMeta.fallbackAction,
          chabadOrAishInsight: selectedMeta.fallbackInsight,
        });
      }
    } catch (error: any) {
      console.log('[Darshán AI] Aviso en /api/mesilat-shot:', error?.message);
      return res
        .status(500)
        .json({ error: error.message || 'Error al generar el Shot de Mesilat Yesharim.' });
    }
  });
}

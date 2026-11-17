import type express from 'express';
import { setBoundedCache } from './aiClient.ts';

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
      titleEs = titleEn.replace('Chanukah:', 'Janucá:').replace('Candles', 'Velas').replace('Candle', 'Vela');
    }
    memoEs = 'Fiesta de la dedicación del Templo, el milagro del aceite puro y la victoria de la luz espiritual sobre la asimilación (Al HaNisim).';
  } else if (titleEn.includes('Asara B’Tevet') || titleEn.includes("Asara B'Tevet")) {
    category = 'fast';
    categoryLabelEs = 'Ayuno Público';
    titleEs = 'Asará BeTevet (Ayuno del 10 de Tevet)';
    memoEs = 'Ayuno que conmemora el inicio del sitio babilónico sobre Jerusalén; llamado al examen interior y Teshuvá.';
  } else if (titleEn.includes('Tu BiShvat') || titleEn.includes("Tu B'Shvat")) {
    category = 'minor';
    categoryLabelEs = 'Año Nuevo de los Árboles';
    titleEs = 'Tu BiShvat (15 de Shevat)';
    memoEs = 'Año Nuevo de los Árboles (Rosh Hashaná LaIlanot): el ser humano como árbol del campo (Deut. 20:19) y sus frutos espirituales.';
  } else if (titleEn.includes('Purim')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de Purim';
    titleEs = titleEn;
    memoEs = 'La salvación oculta en el Libro de Ester (Hester Panim), alegría comunitaria, Mishlóaj Manot y Matanot LaEvionim.';
  } else if (titleEn.includes('Pesach') || titleEn.includes('Passover')) {
    category = 'major';
    categoryLabelEs = 'Fiesta de Pésaj';
    titleEs = titleEn.replace('Pesach', 'Pésaj');
    memoEs = 'Zman Jerutenu: Fiesta de Nuestra Libertad, el Éxodo de Egipto y el nacimiento del pueblo de Israel.';
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
    memoEs = 'Día sagrado de expiación, perdón, retorno (Teshuvá) y cercanía suprema con el Creador.';
  } else if (titleEn.includes('Sukkot')) {
    category = 'major';
    categoryLabelEs = 'Zman Simjatenu';
    titleEs = titleEn.replace('Sukkot', 'Sucot');
    memoEs = 'Fiesta de las Cabañas y las Nubes de Gloria: la fragilidad humana bajo la protección divina.';
  } else if (titleEn.includes('Sigd')) {
    category = 'modern';
    categoryLabelEs = 'Festividad de Renovación del Pacto';
    titleEs = 'Jag HaSigd (Renovación de la Alianza)';
    memoEs = 'Festividad de origen judeo-etíope celebrada 50 días después de Yom Kipur en anhelo por Jerusalén y la recepción de la Torá (Esdras y Nehemías).';
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

const torahCalendarCache = new Map<string, { timestamp: number; data: any }>();
const TORAH_CALENDAR_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

async function fetchWithServerTimeout(
  url: string,
  timeoutMs = 4500
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Liturgical Torah Calendar endpoint (Sefaria Calendars + Hebcal Hebrew date + Upcoming Holidays)

export function registerTorahCalendarRoute(app: express.Express): void {
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
  
      const cacheKey = `${formattedDateStr}:${diaspora ? '1' : '0'}`;
      const cachedCal = torahCalendarCache.get(cacheKey);
      if (cachedCal && Date.now() - cachedCal.timestamp < TORAH_CALENDAR_CACHE_TTL_MS) {
        return res.json(cachedCal.data);
      }
  
      // Calculate end date (+65 days) to fetch upcoming holidays and Rosh Chodesh
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
        fetchWithServerTimeout(sefariaCalUrl, 4500),
        fetchWithServerTimeout(hebcalUrl, 4000),
        fetchWithServerTimeout(hebcalEventsUrl, 4500),
      ]);
  
      const sefariaData =
        sefariaRes && sefariaRes.ok ? await sefariaRes.json().catch(() => ({})) : {};
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
  
      // Deduplicate and process upcoming liturgical events (grouping multi-day Rosh Chodesh or middle candles of Chanukah so the list stays crisp and diverse)
      const rawEventItems: any[] = eventsData?.items || [];
      const seenEventKeys = new Set<string>();
      const upcomingEvents: any[] = [];
  
      for (const rawEv of rawEventItems) {
        const titleEn: string = rawEv.title || '';
        // Keep 1st candle and 8th day of Chanukah, skip intermediate candle entries so we don't flood the list
        if (
          titleEn.startsWith('Chanukah:') &&
          !titleEn.includes('1 Candle') &&
          !titleEn.includes('8th Day')
        ) {
          continue;
        }
        // Deduplicate consecutive days of the same Rosh Chodesh
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
  
      // Build curated suggested Derashá themes of the week combining the Parasha and the nearest upcoming holidays
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
  
        // Also add direct holiday/event topic for the most prominent upcoming major/roshchodesh event
        const majorOrFirstEv = upcomingEvents.find((e) => e.category === 'major') || upcomingEvents[0];
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
  
      const responsePayload = {
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
      };
  
      if (parashaObj || upcomingEvents.length > 0) {
        setBoundedCache(torahCalendarCache, cacheKey, { timestamp: Date.now(), data: responsePayload }, 30);
      }
  
      return res.json(responsePayload);
    } catch (error: any) {
      console.log('[Darshán AI] Aviso en /api/torah-calendar:', error?.message);
      return res.status(500).json({ error: error.message || 'Error al obtener el calendario litúrgico.' });
    }
  });
}

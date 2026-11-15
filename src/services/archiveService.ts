import {
  ArchivedDerashaEntry,
  ComparativeDerashaAnalysisResult,
  DerashaRelationType,
  FinalDerasha,
  FollowUpItem,
  Phase1AnalysisResult,
  VerifiedSefariaSource,
  DerashaMethodology,
  DerashaDuration,
} from '../types';
import {
  auth,
  db,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  getAccessToken,
  isFirestoreEnabled,
} from '../firebase';
import { resolveApiUrl } from './api';
import {
  createNewDerashaFileInGoogleDrive,
  clearLocalAppStorageForDriveMode,
} from './googleDriveStorageService';

const LOCAL_ARCHIVE_KEY = 'darshan_derashot_archive_v1';
const LOCAL_COMPARATIVE_KEY = 'darshan_comparative_studies_v1';
const DELETED_DERASHOT_KEY = 'darshan_deleted_derashot_v1';

interface DeletedDerashotRegistry {
  ids: string[];
  sequenceNumbers: number[];
  normTitles: string[];
}

function loadDeletedDerashotRegistry(): DeletedDerashotRegistry {
  try {
    const raw = localStorage.getItem(DELETED_DERASHOT_KEY);
    if (!raw) return { ids: [], sequenceNumbers: [], normTitles: [] };
    const parsed = JSON.parse(raw);
    return {
      ids: Array.isArray(parsed?.ids) ? parsed.ids : [],
      sequenceNumbers: Array.isArray(parsed?.sequenceNumbers) ? parsed.sequenceNumbers : [],
      normTitles: Array.isArray(parsed?.normTitles) ? parsed.normTitles : [],
    };
  } catch {
    return { ids: [], sequenceNumbers: [], normTitles: [] };
  }
}

function saveDeletedDerashotRegistry(reg: DeletedDerashotRegistry): void {
  try {
    localStorage.setItem(DELETED_DERASHOT_KEY, JSON.stringify(reg));
  } catch {
    // ignore storage errors
  }
}

export function isDerashaMarkedDeleted(
  item: Pick<ArchivedDerashaEntry, 'id' | 'sequenceNumber' | 'title'>,
  reg = loadDeletedDerashotRegistry()
): boolean {
  if (!item) return false;
  if (item.id && reg.ids.includes(item.id)) return true;
  if (typeof item.sequenceNumber === 'number' && reg.sequenceNumbers.includes(item.sequenceNumber)) {
    return true;
  }
  const normTitle = (item.title || '').trim().toLowerCase();
  if (normTitle && reg.normTitles.includes(normTitle)) return true;
  return false;
}

export function recordDeletedDerasha(
  target: ArchivedDerashaEntry | { id?: string; sequenceNumber: number; title?: string }
): void {
  const reg = loadDeletedDerashotRegistry();
  const nextIds = new Set(reg.ids);
  const nextSeqs = new Set(reg.sequenceNumbers);
  const nextTitles = new Set(reg.normTitles);

  if (target.id) nextIds.add(target.id);
  if (typeof target.sequenceNumber === 'number') {
    nextSeqs.add(target.sequenceNumber);
    nextIds.add(`derasha-seed-${target.sequenceNumber}`);
  }
  if (target.title?.trim()) {
    nextTitles.add(target.title.trim().toLowerCase());
  }

  saveDeletedDerashotRegistry({
    ids: Array.from(nextIds),
    sequenceNumbers: Array.from(nextSeqs),
    normTitles: Array.from(nextTitles),
  });
}

export function unmarkDeletedDerasha(
  target: Pick<ArchivedDerashaEntry, 'id' | 'sequenceNumber' | 'title'>
): void {
  const reg = loadDeletedDerashotRegistry();
  const normTitle = (target.title || '').trim().toLowerCase();
  saveDeletedDerashotRegistry({
    ids: reg.ids.filter(
      (id) => id !== target.id && id !== `derasha-seed-${target.sequenceNumber}`
    ),
    sequenceNumbers: reg.sequenceNumbers.filter((seq) => seq !== target.sequenceNumber),
    normTitles: reg.normTitles.filter((t) => t !== normTitle),
  });
}

function truncateStr(val: string | undefined | null, maxLen: number, fallback = '-'): string {
  const clean = (val || '').trim();
  if (!clean) return fallback;
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

export const INITIAL_SEEDED_DERASHOT: ArchivedDerashaEntry[] = [
  {
    id: 'derasha-seed-1',
    sequenceNumber: 1,
    title: 'Imperativo Categórico de Kant frente a la Ética Teonómica de la Torá',
    query:
      'Comparativo y contraste filosófico entre el Imperativo Categórico de Kant y la visión ética de la tradición judía: autonomía vs. teonomía, universalidad vs. especificidad del mandamiento y fuentes internas vs. externas',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES', 'EVOLUCION_CONCEPTUAL'],
    duration: '10_MIN',
    audienceOrTone: 'Académico y filosófico · Rigor universitario',
    centralIdea:
      'Mientras Kant funda la moral en la autonomía formal de la razón pura universal («obra solo según aquella máxima que puedas querer como ley universal»), la Torá articula una ética teonómica y dialógica donde el mandamiento concreto (Mitzvá) responde al llamado del Otro y del Creador («Gadol HaMetzuvé veOsé», Kiddushin 31a), articulando universalismo ético (7 leyes de Noé) con particularismo ejemplar.',
    essaySummary: `### Exordio: ¿De dónde nace el deber moral?
En la historia de la filosofía occidental, Immanuel Kant formuló en la *Fundamentación de la metafísica de las costumbres* (1785, Ak. IV, 421) el célebre **Imperativo Categórico**: el ser humano solo es moralmente libre cuando se da la ley a sí mismo desde la razón pura universal (*Autonomía*), rechazando cualquier mandato venido desde fuera (*Heteronomía*).

Sin embargo, el pensamiento judío clásico y contemporáneo introduce una distinción fundamental: la Torá no propone una heteronomía servil, sino una **teonomía relacional de Alianza (*Berit*)**. En el Talmud Bavli (*Kiddushin 31a*), Rabí Janina declara: **«Gadol HaMetzuvé veOsé miMi sheEinó Metzuvé veOsé»** (*Grande es quien está comandado y actúa, más que quien no está comandado y actúa*).

### 1. Fuentes Internas de la Torá frente a Fuentes Externas Filosóficas
- **Fuente Externa (Immanuel Kant, *Grundlegung*, Ak. IV, 421 / *Kritik der praktischen Vernunft*, Ak. V, 30)**: El sujeto trascendental legisla en soledad racional. Su criterio es la no-contradicción formal universalizable.
- **Fuente Interna Normativa (Deuteronomio 30:11-14; Miqueas 6:8; Kiddushin 31a; Maimónides, *Shemoná Perakim* cap. 6)**: La fuente de obligación nace del encuentro con la alteridad divina y humana. Como explican Tosafot y Ritva en *Kiddushin 31a*, quien actúa respondiendo a un mandato supera la vacilación del ego y convierte el acto en vínculo (*Tzavta* = conexión).

### 2. Universalidad frente a Especificidad del Mandamiento
Kant exige que toda conclusión ética sea idéntica e indiferenciada para cualquier agente racional. La tradición judía sostiene un modelo **bifocal**:
1. **Universalidad Ética Fundamental**: Las Siete Leyes de los Hijos de Noé (*Sheva Mitzvot Bnei Nóaj*, *Sanhedrín 56a*) y el principio *Betzélem Elohim* (*Génesis 1:27*) establecen un piso ético universal de justicia (*Dinim*), prohibición del asesinato, robo y crueldad para toda la humanidad.
2. **Especificidad Pactada de la Mitzvá**: Las 613 Mitzvot del pueblo de Israel no niegan la moral universal, sino que encarnan la santidad en el tiempo, el cuerpo, la mesa y la palabra concreta, evitando que el deber quede en una abstracción fría.`,
    sourcesSummary:
      'Kiddushin 31a · Deuteronomy 30:11-14 · Micah 6:8 · Pirkei Avot 2:16 · Kant, Grundlegung zur Metaphysik der Sitten (Ak. IV, 421)',
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T08:00:00.000Z',
  },
  {
    id: 'derasha-seed-2',
    sequenceNumber: 2,
    title: 'La Alegoría de la Caverna de Platón frente a la Luz de la Torá (Or HaGanuz)',
    query:
      'Estudio comparativo entre la Alegoría de la Caverna de Platón (República VII) y la concepción judía de la luz espiritual (Or HaGanuz) y la responsabilidad de volver al mundo',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES'],
    duration: '10_MIN',
    audienceOrTone: 'Académico y filosófico · Rigor universitario',
    centralIdea:
      'En Platón (República VII, 514a-517a), el filósoso escapa del mundo sensible (caverna de sombras) hacia el mundo inteligible de las Ideas; en la Torá y la Cábala (Jaguigá 12a; Tanya cap. 36), la luz primordial (Or HaGanuz) está oculta dentro de la Torá para iluminar y santificar este mismo mundo material (Dirá BaTajtonim), no para huir de él.',
    essaySummary: `### Exordio: ¿Escapar del mundo material o iluminarlo desde adentro?
En el Libro VII de la *República* (514a–520a), Platón describe a los seres humanos encadenados en una caverna subterránea tomando sombras proyectadas por la realidad. La liberación platónica consiste en ascender fuera del mundo sensible hacia el Sol inteligible de la Idea del Bien.

### Contraste Exegético: Fuente Externa Griega vs. Fuente Interna del Tanaj y Talmud
- **Fuente Externa (Platón, *República* VII, 514a-517c)**: Dualismo ontológico entre el mundo material (apariencia deficiente) y el mundo de las Formas eternas.
- **Fuente Interna Judía (Génesis 1:3-4; Salmos 36:10 «BeOrjá Niré Or»; Talmud Bavli *Jaguigá 12a*)**: Dios vio que la creación física era «buena» (*Ki Tov*). Rabí Elazar enseña en *Jaguigá 12a* que con la luz primordial (*Or HaGanuz*) el ser humano podía ver de un extremo al otro del universo, y Dios la atesoró para los justos en las letras de la Torá. En lugar de abandonar la «caverna» de lo físico, el sabio judío introduce la luz del Sinaí en la materia cotidiana (el concepto jasídico de *Ratzo veShov* — ascender para retornar con luz a la comunidad).`,
    sourcesSummary:
      'Chagigah 12a · Psalms 36:10 · Proverbs 6:23 · Genesis 1:3-4 · Platón, República VII (514a-520a)',
    createdAt: '2026-11-09T08:15:00.000Z',
    updatedAt: '2026-11-09T08:15:00.000Z',
  },
  {
    id: 'derasha-seed-3',
    sequenceNumber: 3,
    title: '¿Qué es la Iluminación? El Despertar Budista (Bodhi) frente a Devekut y Torá Or en el Judaísmo',
    query:
      'Comparativo sobre el concepto de iluminación: la perspectiva del budismo (Bodhi / despertar y extinción del deseo) en contraste con el judaísmo (Or HaGanuz, Ruaj HaKódesh, Devekut y Ner Mitzvá veTorá Or)',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES', 'MESILAT_YESHARIM_SISTEMATICO'],
    duration: '10_MIN',
    audienceOrTone: 'Académico y filosófico · Rigor universitario',
    centralIdea:
      'Mientras el budismo concibe la iluminación (Bodhi / Nirvana) como el despertar gnóstico que disuelve la ilusión del yo (Anatta) y extingue el deseo (Tanha) para cesar el sufrimiento (Dukkha), el judaísmo concibe la iluminación como comunión relacional (Devekut), inspiración profética (Ruaj HaKódesh, Mesilat Yesharim 26) y canalización apasionada del deseo hacia el bien mediante el mandamiento («Ner Mitzvá veTorá Or», Proverbios 6:23).',
    essaySummary: `### Exordio: Dos visiones de la luz interior y del despertar espiritual
Cuando preguntamos qué es la «iluminación», el término evoca de inmediato en la historia de las religiones el despertar del Buda (*Bodhi*, literalmente «despertar») bajo el árbol en Bodh Gaya. ¿Existe un equivalente en el judaísmo o se trata de dos arquitecturas espirituales radicalmente distintas?

### 1. Fuente Externa: El Budismo (*Dhammapada* 1-2, 183; *Dhammacakkappavattana Sutta*, SN 56.11)
En el Canon Pali, la iluminación (*Bodhi*) consiste en comprender las Cuatro Nobles Verdades: que toda existencia condicionada conlleva insatisfacción (*Dukkha*), que su origen es la sed o apego (*Tanha*) nacida de la ilusión de un yo permanente (*Anatta*), y que la liberación (*Nibbana / Nirvana*, literalmente «extinción de la llama») se alcanza desapegándose del deseo mediante el Noble Óctuple Sendero (recta visión, meditación *Samadhi* y sabiduría *Prajña*).

### 2. Fuente Interna de la Torá: *Ner Mitzvá veTorá Or*, *Devekut* y *Ruaj HaKódesh*
En el judaísmo no existe la meta de disolver el yo ni de apagar la llama del deseo; por el contrario, el alma humana es llamada **«Ner Hashem Nishmat Adam»** (*Lámpara del Eterno es el alma del ser humano*, *Proverbios 20:27*) y la práctica sagrada es **«Ki Ner Mitzvá veTorá Or»** (*Porque lámpara es el precepto y la Torá es luz*, *Proverbios 6:23*).
- **En lugar de *Anatta* (no-yo), *Tzelem Elohim* y *Devekut* (*Deuteronomio 4:4*)**: La iluminación judía no anula la individualidad ni la relación Yo-Tú (Martin Buber), sino que une la voluntad humana con la Divina en adhesión amorosa (*Devekut*).
- **En lugar de extinguir el deseo (*Tanha*), santificar el impulso (*Bejol Levavejá*, *Berajot 54a*)**: El Talmud enseña que se sirve a Dios «con ambos impulsos» (*Yetzer HaTov* y la energía canalizada del *Yetzer HaRá*), transformando la pasión humana en construcción familiar, justicia social y alegría de Mitzvá (*Simjá shel Mitzvá*, *Shabat 30b*).
- **La cumbre de la escalera espiritual (*Mesilat Yesharim* cap. 26)**: Para el Ramjal, la cima de la perfección ética y espiritual conduce a *Kedushá* (Santidad en lo cotidiano) y *Ruaj HaKódesh* (inspiración divina clara), que no separa al justo de la historia sino que lo vuelve bendición para el mundo.`,
    sourcesSummary:
      'Proverbs 6:23 · Proverbs 20:27 · Shabbat 30b · Mesillat Yesharim 26:1 · Chagigah 12a · Canon Pali: Dhammacakkappavattana Sutta (SN 56.11) & Dhammapada',
    createdAt: '2026-11-09T08:30:00.000Z',
    updatedAt: '2026-11-09T08:30:00.000Z',
  },
  {
    id: 'derasha-seed-4',
    sequenceNumber: 4,
    title: 'El Destino de las Almas y sus Requisitos: Olam HaBá frente a Cielo/Infierno, Nirvana y Valhalla',
    query:
      'Contraste comparativo sobre el destino de las almas y los requisitos para acceder a él: el Olam HaBá en el judaísmo frente al Cielo y el Infierno, el Nirvana budista y el Valhalla nórdico',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES', 'PIRKE_AVOT_EXEGETICO'],
    duration: '10_MIN',
    audienceOrTone: 'Académico y filosófico · Rigor universitario',
    centralIdea:
      'El judaísmo se distingue en la historia comparada de las religiones por su criterio ético universal de acceso al Mundo Venidero (Olam HaBá): según el Talmud (Sanhedrín 105a) y Maimónides (Hiljot Teshuvá 3:5; Hiljot Melajim 8:11), los Justos de todas las Naciones (Jasidéi Umot HaOlam) tienen parte en el Olam HaBá por su rectitud moral, en contraste con la exclusividad dogmática del Cielo/Infierno, la extinción ontológica del Nirvana o el heroísmo bélico del Valhalla.',
    essaySummary: `### Exordio: El mapa comparado del más allá y la pregunta por el mérito
Toda civilización ha respondido a dos preguntas últimas: **¿Cuál es el destino final del alma?** y **¿Cuáles son los requisitos exactos para acceder a ese estado?** Comparar el *Olam HaBá* judío con el Cielo/Infierno, el *Nirvana* oriental y el *Valhalla* germánico-nórdico revela la profunda singularidad ética de la Torá.

### 1. Matriz Comparativa de Fuentes Externas frente a las Fuentes de la Torá
1. **Valhalla (Mitología Nórdica — Fuente Externa: *Edda Poética, Grímnismál* 8-10; Snorri Sturluson, *Gylfaginning* 38-41)**:
   - *Naturaleza*: El salón de Odín en Asgard para los guerreros caídos (*Einherjar*) que se preparan para el *Ragnarök*.
   - *Requisito de acceso*: Muerte violenta y heroica en el campo de batalla con las armas en la mano; quienes mueren de vejez o enfermedad van al frío reino de *Hel*, sin importar su bondad moral.
   - *Contraste con la Torá*: El judaísmo rechaza glorificar la guerra como puerta al paraíso (al Rey David no se le permitió construir el Templo por haber derramado sangre en batallas, *I Crónicas 22:8*); la paz (*Shalom*) y la preservación de la vida (*Pikuaj Néfesh*) son supremas.
2. **Cielo e Infierno Eterno (Teología Dogmática — Fuente Externa: Escatología Patrística y Escolástica)**:
   - *Naturaleza*: Salvación eterna en visión beatífica o condenación eterna e irreversible en el infierno.
   - *Requisito de acceso*: Adhesión confesional a un dogma de fe y sacramentos exclusivos.
   - *Contraste con la Torá*: En el judaísmo no existe un «infierno eterno» para el alma común, sino *Guehinom* como un proceso temporal de purificación y toma de conciencia (máximo 12 meses según *Mishná Eduyot 2:10* y *Rosh Hashaná 17a*), ni se exige que la humanidad entera se convierta al judaísmo para salvarse.
3. **Nirvana / Moksha (Tradición Budista e Hindú — Fuente Externa: *Udana* 8.1-4; *Bhagavad Gita* 2:71-72)**:
   - *Naturaleza*: Liberación del ciclo de reencarnaciones (*Samsara*) mediante el cese del deseo y la disolución del ego individual.
   - *Requisito de acceso*: Desapego ascético y realización meditativa de la vacuidad o unidad impersonal.
4. **Olam HaBá y Gan Eden (Fuente Interna Judía: *Mishná Sanhedrín 10:1*; *Talmud Bavli Sanhedrín 105a*; *Berajot 17a*; Maimónides, *Hiljot Teshuvá* 8:2 y *Hiljot Melajim* 8:11)**:
   - *Naturaleza*: Como enseña Rav en *Berajot 17a*, en el *Olam HaBá* no hay comida, bebida ni envidia, sino que los justos gozan del esplendor de la Presencia Divina (*Ziv HaShejiná*) conservando la identidad moral de lo que construyeron en la historia (*Pirkei Avot 4:16*: «Este mundo es como un vestíbulo ante el Olam HaBá»).
   - *Requisitos de acceso universales y particulares*:
     - **Para toda la humanidad**: Rabí Yehoshúa declara en *Sanhedrín 105a* (codificado por Maimónides): **«Jasidéi Umot HaOlam Yesh Lahem Jélek laOlam HaBá»** (*Los justos y piadosos de entre todas las naciones del mundo tienen parte en el Mundo Venidero*). El requisito es la integridad ética universal (no asesinar, no robar, establecer tribunales justos, respetar la vida y reconocer la ley moral trascendente).
     - **Para Israel**: El estudio de la Torá, la práctica de las Mitzvot entre el ser humano y Dios (*Bein Adam laMakom*) y entre el ser humano y su prójimo (*Bein Adam leJaveró*), y la *Teshuvá* (retorno y reparación sincera, que alcanza el Trono de Gloria en un solo instante, *Kiddushin 49b*).`,
    sourcesSummary:
      'Sanhedrin 105a · Mishnah Sanhedrin 10:1 · Berakhot 17a · Pirkei Avot 4:16-17 · Mishneh Torah, Repentance 8:2 · Fuentes externas: Edda (Grímnismál), Udana 8.1',
    createdAt: '2026-11-09T08:45:00.000Z',
    updatedAt: '2026-11-09T08:45:00.000Z',
  },
  {
    id: 'derasha-seed-5',
    sequenceNumber: 5,
    title: 'Responsabilidad Mutua y Acción Comunitaria: Kol Yisrael Arevim Ze Baze y Pirkei Avot 2:16',
    query:
      'La responsabilidad colectiva y la ética de la acción concreta en la comunidad según el Talmud (Shevuot 39a) y Pirkei Avot 2:16 («No te corresponde terminar la obra, pero tampoco eres libre de desistir de ella»)',
    methodology: 'PIRKE_AVOT_EXEGETICO',
    complementaryMethodologies: ['PARDES', 'MUSAR_TRANSFORMATIVO'],
    duration: '10_MIN',
    audienceOrTone: 'Comunidad general · Inspirador y práctico',
    centralIdea:
      'La ética judía rechaza el perfeccionismo individualista que se paraliza si no puede resolver la totalidad del mundo: Rabí Tarfón (Pirkei Avot 2:16) y el principio de garantía mutua (Kol Yisrael Arevim Ze Baze, Shevuot 39a) enseñan que la validez moral nace de asumir nuestra parte concreta e irremplazable dentro de una obra colectiva e intergeneracional.',
    essaySummary: `### Exordio: La falacia del «todo o nada» moral
Muchas veces el ser humano posterga el bien porque siente que su acción individual es demasiado pequeña para cambiar el mundo entero. Frente a esa parálisis, Rabí Tarfón pronuncia en *Pirkei Avot 2:16* una de las máximas más liberadoras y exigentes de la historia ética: **«Lo Aleja HaMelajá Ligmor, veLo Atá Ben Jorín Lhibatel Mimena»** (*No recae sobre ti la obligación de completar toda la obra, pero tampoco eres un hombre libre para desentenderte de ella*).

### Desarrollo Exegético: De la Autonomía Aislada a la Garantía Mutua (*Arvut*)
1. **El significado de *Ben Jorín* (Hombre Libre) en Avot**:
   En *Pirkei Avot 6:2*, los Sabios enseñan sobre las Tablas de la Ley (*Jirut al HaLujot*): «No leas *Jarut* (grabado), sino *Jirut* (libertad), pues no hay persona verdaderamente libre sino quien se ocupa de la Torá y de la responsabilidad ética». La libertad judía no es ausencia de vínculos, sino capacidad de responder por el prójimo.
2. **La Red de Garantía Colectiva (*Shevuot 39a*)**:
   El Talmud en *Shevuot 39a* formula el principio jurídico y espiritual **«Kol Yisrael Arevim Ze Baze»** (*Todo Israel es garante el uno del otro*). Mientras una ética individualista evalúa al agente en un laboratorio aislado, la Torá concibe a la humanidad y a la comunidad como un barco compartido (*Midrash Vayikrá Rabá 4:6*: nadie puede taladrar debajo de su propio asiento diciendo «¿a ti qué te importa, si solo perforo mi lugar?»).
3. **Conclusión Práctica**:
   Nuestra misión diaria no se mide por alcanzar una perfección abstracta e intemporal en solitario, sino por poner hoy nuestro ladrillo de justicia (*Tzedaká*), bondad (*Guemilut Jasadim*) y estudio compartido dentro de la cadena viva de las generaciones.`,
    sourcesSummary:
      'Pirkei Avot 2:16 · Pirkei Avot 6:2 · Shevuot 39a · Vayikra Rabbah 4:6 · Kiddushin 40b',
    createdAt: '2026-11-09T09:00:00.000Z',
    updatedAt: '2026-11-09T09:00:00.000Z',
  },
  {
    id: 'derasha-seed-6',
    sequenceNumber: 6,
    title:
      'El Mashíaj en el Judaísmo frente a la Caracterización del Mesías en el Cristianismo: Desglose Sistemático de las 7 Diferencias',
    query:
      '¿Qué es el Mashíaj en el judaísmo y cómo caracterizar el Mesías del cristianismo para desglosar las diferencias con el Mashíaj del judaísmo?',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES', 'WISSENSCHAFT_DES_JUDENTUMS'],
    duration: '10_MIN',
    audienceOrTone: 'Académico, Teológico y Pedagógico',
    centralIdea:
      'El judaísmo y el cristianismo no difieren solo en quién es el Mesías, sino en la definición misma de redención: mientras el cristianismo caracteriza a su Mesías mediante 5 dogmas (Dios encarnado trinitario, pecado original y sacrificio vicario en la cruz, salvación interior invisible, abrogación de la Ley y Segunda Venida / Parusía), el judaísmo concibe al Mashíaj como un rey y maestro 100% humano y mortal del linaje patrilineal de David y Salomón que reafirma el monoteísmo incorpóreo absoluto (Deuteronomio 6:4; Números 23:19), la responsabilidad moral y Teshuvá directa (Ezequiel 18:20) y la paz mundial verificable en una sola vida (Isaías 2:4; Rambam, Hiljot Melajim 11:1–4; Najmánides, Disputa de Barcelona de 1263).',
    essaySummary: `### Parte I: ¿Qué es el Mashíaj en el Judaísmo? (Fuentes Internas de la Torá)
La palabra hebrea **מָשִׁיחַ (*Mashíaj*)**, de la raíz verbal **מ-ש-ח (*Mashaj*)**, significa literalmente **«ungido con aceite»**. En el Tanaj designa el rito público de investidura mediante el cual se consagraba con aceite (*Shémen HaMishjá*) a los reyes de Israel (Saúl en *1 Samuel 10:1*, David en *1 Samuel 16:13*), a los Sumos Sacerdotes (*Levítico 4:3*) e incluso a Ciro de Persia (*Isaías 45:1*). En el judaísmo, el *Mashíaj* es un **líder, juez y rey 100% humano y mortal**, nacido de forma natural de padre y madre humanos, descendiente biológico por línea paterna directa del **Rey David a través de su hijo Salomón** (*Isaías 11:1–2*; *2 Samuel 7:12–16*; *1 Crónicas 22:9–10*), dentro de un **monoteísmo incorpóreo absoluto** (*Deuteronomio 6:4*; *Números 23:19*; *Oseas 11:9*).

### Parte II: Caracterización del Mesías en el Cristianismo (Los 5 Ejes Dogmáticos)
La teología cristiana (formulada en la literatura paulina y definida en los Concilios de Nicea de 325 e.c. y Calcedonia de 451 e.c.) caracteriza a su Mesías (*Christós*) mediante cinco ejes dogmáticos:
1. **Naturaleza Divino-Humana (Encarnación y Trinidad)**: Lo define como Dios Hijo encarnado (*homoousios*), segunda persona de la Trinidad nacida por concepción virginal, con dos naturalezas (divina y humana) en una sola persona.
2. **Soteriología del Pecado Original y Expiación Vicaria**: Sostiene que el pecado de Adán corrompió hereditariamente a la humanidad y que el ser humano no puede redimirse por su propio arrepentimiento (*Teshuvá*) ni por sus obras, por lo que el Mesías cristiano muere crucificado como sacrificio vicario de sangre (*Agnus Dei*).
3. **Redención Espiritual e Interior**: Ante la persistencia de las guerras tras el siglo I, caracteriza su reino como una salvación interior e invisible del alma («Mi reino no es de este mundo»).
4. **Abrogación o Superación de la Ley de la Torá**: Lo caracteriza como el «fin de la Ley», declarando abolidos los preceptos prácticos de la Torá (*Mitzvot* como Shabat, Kashrut y Brit Milá) y reemplazándolos por la fe dogmática en la gracia.
5. **Doctrina de las «Dos Venidas» (*Parusía*)**: Como las profecías bíblicas de paz mundial y reunión de Israel no se cumplieron durante su vida, postula una Primera Venida para morir por los pecados y una Segunda Venida futura al final de los tiempos.

### Parte III: Desglose Sistemático de las 7 Diferencias con el Mashíaj del Judaísmo
1. **Ontología (100% Humano Mortal vs. Dios Encarnado)**: En la Torá, Dios es absolutamente Uno e incorpóreo (*Deuteronomio 6:4*; *Números 23:19*: «Dios no es hombre»). Atribuir divinidad a un ser humano es incompatible con el monoteísmo judío.
2. **Genealogía (Linaje Patrilineal de David y Salomón vs. Concepción Virginal)**: En la ley bíblica, la pertenencia tribal y dinástica se transmite exclusivamente por el padre biológico humano (*Números 1:18*; *1 Crónicas 22:9–10*); un nacimiento sin padre humano carece de linaje patrilineal davídico.
3. **Soteriología (Responsabilidad Moral Individual y Teshuvá Directa vs. Pecado Original y Sacrificio Vicario)**: El judaísmo rechaza el pecado original hereditario y prohíbe los sacrificios humanos (*Deuteronomio 12:31*). *Ezequiel 18:20–23* establece que «el alma que pecare, ésa morirá; el hijo no cargará con la iniquidad del padre», y *Oseas 14:2–3* enseña que la *Teshuvá* sincera reconcilia directamente con Dios sin mediadores.
4. **Vigencia de la Ley (Plenitud Eterna de la Torá vs. Abrogación de las Mitzvot)**: La Torá es eterna (*Deuteronomio 13:1–5*); el *Mashíaj* judío restaura el cumplimiento íntegro de todas las *Mitzvot* (*Hiljot Melajim 11:1*).
5. **Criterio Temporal (Cumplimiento en Una Sola Vida vs. «Segunda Venida»)**: Maimónides codifica en *Hiljot Melajim 11:4* que si un candidato muere sin haber reconstruido el Templo ni reunido a los exiliados en su propia vida, «queda demostrado con certeza que NO es aquel que la Torá prometió».
6. **Escenario de la Redención (Paz Mundial Empírica en la Disputa de Barcelona de 1263 vs. Reino Invisible)**: Como demostró Najmánides (*Rambán*) ante el Rey Jaime I en 1263, la prueba irrefutable de la Era Mesiánica es el fin real de las guerras (*Isaías 2:4*) y el retorno físico de Israel (*Kibutz Galuyot*).
7. **Universalismo Ético (Justos de las Naciones vs. Exclusivismo Dogmático)**: En el judaísmo, los justos de todas las naciones tienen parte en el *Olam HaBá* (*Hiljot Teshuvá 3:5*) por su conducta moral sin requerir fe en un dogma cristológico.`,
    sourcesSummary:
      'Isaiah 2:2-4 · Isaiah 11:1-9 · Numbers 23:19 · Ezekiel 18:20-23 · Mishneh Torah, Kings and Wars 11:1-4 · Fuentes externas: Concilios de Nicea (325) y Calcedonia (451), Vikuaj ha-Rambán (Disputa de Barcelona, 1263)',
    createdAt: '2026-11-10T03:20:00.000Z',
    updatedAt: '2026-11-10T03:20:00.000Z',
  },
  {
    id: 'derasha-seed-7',
    sequenceNumber: 7,
    title:
      '¿Por Qué Buda No es el Mashíaj? Caracterización de Siddhartha Gautama (el Buda) y Desglose de las 7 Diferencias con el Mashíaj del Judaísmo',
    query:
      'De la misma forma comparar por qué Buda no es el Mashíaj: caracterización de Siddhartha Gautama en el budismo y desglose de las diferencias con el Mashíaj del judaísmo',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES', 'WISSENSCHAFT_DES_JUDENTUMS'],
    duration: '10_MIN',
    audienceOrTone: 'Académico, Filosófico y Teológico',
    centralIdea:
      'Aplicando el mismo método contrastivo de 3 partes, Siddhartha Gautama (el Buda) y el Mashíaj del judaísmo representan vectores opuestos: mientras el Buda en el Canon Pali (MN 26, SN 56.11) es el príncipe del clan Shakya que protagoniza la «Gran Renuncia» abdicando de su trono real para buscar en un marco no-teísta la extinción del deseo (Tanha), del yo (Anatta) y la salida del mundo físico visto como sufrimiento (Dukkha/Samsara), el Mashíaj judío es el rey davídico que asume el trono en nombre del Dios Creador Único (Deuteronomio 6:4; Isaías 11:1–9) para santificar un mundo creado «muy bueno» (Tov Meod, Génesis 1:31), restaurar las 613 Mitzvot y establecer la paz mundial empírica (Isaías 2:4; Rambam, Hiljot Melajim 11:1–4).',
    essaySummary: `### Parte I: ¿Qué exige el Judaísmo para ser el Mashíaj? (Fuentes Internas de la Torá)
En la Torá y en la codificación de Maimónides (*Mishné Torá, Hiljot Melajim* caps. 11–12), **מָשִׁיחַ (*Mashíaj*, «el Ungido con aceite»)** no es un título genérico para cualquier maestro espiritual iluminado, sino un cargo real, jurídico y profético dentro de la historia:
1. **Linaje y Realeza**: Debe ser descendiente biológico patrilineal del **Rey David a través de su hijo Salomón** (*Isaías 11:1*; *2 Samuel 7:12–16*; *1 Crónicas 22:9–10*) que restaura el trono de Israel en Jerusalén.
2. **Teología Monoteísta y Torá**: Actúa inspirado por **Hashem, el Dios Creador Único** (*Deuteronomio 6:4*; *Isaías 11:2*), y guía a Israel y a las naciones en el conocimiento ético de Dios y el cumplimiento de las 613 *Mitzvot* (*Proverbios 6:23*).
3. **Redención Histórica Empírica**: Reúne a los exiliados de Israel (*Kibutz Galuyot*), reconstruye el *Beit HaMikdash* y erradica todas las guerras de la faz de la tierra (*Isaías 2:4*).

### Parte II: Caracterización de Siddhartha Gautama (el Buda) en el Canon Pali (Los 5 Ejes)
Según las fuentes primarias del Canon Pali (*Ariyapariyesana Sutta* MN 26, *Dhammacakkappavattana Sutta* SN 56.11 y *Brahmajāla Sutta* DN 1), Siddhartha Gautama, el Buda *Shakiamuni* (c. 563–483 a.e.c.), se caracteriza por cinco ejes fundamentales:
1. **La «Gran Renuncia» al Trono Real (*Mahabhinishkramana*)**: Nacido como príncipe heredero de la casta guerrera (*Kshatriya*) del clan *Shakya* en Lumbini (Nepal/India), a los 29 años **abdica de su futuro trono real, abandona el palacio, a su esposa Yasodhara y a su hijo Rahula**, y se retira al bosque como monje mendicante (*Sramana*) porque considera el gobierno y los vínculos familiares como ataduras.
2. **Marco Ontológico No-Teísta**: Rechaza la existencia de un Dios Creador supremo (*Ishvara*) y de cualquier revelación o mandamiento divino.
3. **Diagnóstico del Mundo como *Dukkha* y *Samsara***: En las Cuatro Nobles Verdades enseña que toda existencia física, histórica y deseante es intrínsecamente insatisfactoria y dolorosa (*Dukkha*), atrapada en la rueda de renacimientos (*Samsara*).
4. **Doctrina de *Anatta* (No-Yo)**: Niega la existencia de un alma individual sustancial e inmortal, describiendo al individuo como un flujo impermanente de cinco agregados (*Skandhas*).
5. **Soteriología del *Nirvana / Parinirvana***: Su meta es extinguir la sed del deseo (*Tanha*) mediante el desapego meditativo (Noble Camino Óctuple) para salir definitivamente del ciclo del mundo.

### Parte III: Desglose Sistemático de las 7 Diferencias por las que Buda No es el Mashíaj
1. **Teología (Monoteísmo Creador vs. No-Teísmo)**: El *Mashíaj* es siervo de Hashem, el Creador personal del universo (*Deuteronomio 6:4*; *Isaías 11:2, 9*); el Buda enseña un sistema no-teísta sin Dios Creador.
2. **Dirección del Liderazgo (Asumir el Trono de David vs. Abdicar del Trono en la Gran Renuncia)**: Es el contraste simétrico más claro: Siddhartha Gautama **renuncia a su trono** y huye del palacio hacia el bosque; el *Mashíaj* judío **asume el trono de David** para gobernar con justicia (*Mishpat* y *Tzedaká*) y transformar la geopolítica mundial (*Isaías 11:4*; *Jeremías 23:5*).
3. **Genealogía y Alianza (Casa de David en Sión vs. Clan Shakya en la India)**: El *Mashíaj* debe descender por línea paterna de Judá, David y Salomón (*1 Crónicas 22:9–10*); Buda perteneció al clan *Shakya* en la India, ajeno a la genealogía y al Pacto de Israel.
4. **Valoración del Mundo Físico (*Tov Meod* en Génesis 1:31 vs. *Dukkha/Samsara*)**: Mientras el budismo ve el mundo material como sufrimiento del que hay que escapar, la Torá proclama que la Creación es «muy buena» (*Tov Meod*) y que la misión humana es construir una morada divina aquí abajo (*Dirá BeTajtonim*).
5. **Relación con el Mandamiento (613 Mitzvot y Familia vs. Ascetismo Monástico Célibe)**: El *Mashíaj* restaura las 613 *Mitzvot* (*Hiljot Melajim 11:1*) que santifican el matrimonio, los hijos (*Génesis 1:28*) y la justicia social; Buda funda una orden monástica célibe (*Sangha*) de renuncia al mundo.
6. **Verificación Histórica Empírica (*Hiljot Melajim 11:4*)**: Tras la muerte (*Parinirvana*) de Buda en c. 483 a.e.c., las guerras del mundo no cesaron (*Isaías 2:4*), Israel no fue reunido del exilio ni se reconstruyó el Templo en Jerusalén.
7. **Antropología y Futuro (Alma Eterna *Neshamá* y Resurrección vs. *Anatta* y Extinción)**: El judaísmo afirma la identidad eterna del alma (*Proverbios 20:27*) y la Resurrección (*Sanhedrín 90a*) frente a la disolución del yo (*Anatta*).`,
    sourcesSummary:
      'Isaiah 11:1-9 · Isaiah 2:4 · Genesis 1:31 · Proverbs 6:23 · Lamentations Rabbah 2:13 · Mishneh Torah, Kings and Wars 11:1-4 · Fuentes externas: Canon Pali (Ariyapariyesana Sutta MN 26, Dhammacakkappavattana Sutta SN 56.11, Brahmajāla Sutta DN 1)',
    createdAt: '2026-11-10T03:45:00.000Z',
    updatedAt: '2026-11-10T03:45:00.000Z',
  },
  {
    id: 'derasha-seed-8',
    sequenceNumber: 8,
    title:
      'Corrientes Dentro del Judaísmo (Jasidismo Jabad y Breslev, Ortodoxia, Reformismo) y la Frontera Teológica: Por Qué los «Judíos Mesiánicos» No Son Judíos sino Cristianos Evangélicos',
    query:
      'Dentro del judaísmo hay distintos grupos por ejemplo el jasidismo Jabad y Breslev, y grupos como los reformistas. Pero es importante señalar cuando un grupo ya se aleja y deja de ser un grupo judío: por ejemplo los judíos mesiánicos realmente no son judíos, son evangélicos cristianos',
    methodology: 'FILOSOFIA_CONTRASTIVA',
    complementaryMethodologies: ['PARDES', 'WISSENSCHAFT_DES_JUDENTUMS'],
    duration: '10_MIN',
    audienceOrTone: 'Académico, Halájico y Pedagógico',
    centralIdea:
      'Dentro del judaísmo coexisten legítimamente diversas corrientes —como el Jasidismo en sus escuelas de Jabad-Lubavitch (intelecto místico Jojmá-Biná-Daat en el Tania) y Breslev (alegría constante y plegaria personal Hitbodedut), la Ortodoxia y movimientos modernos como el Reformismo y el Conservadurismo— porque todas sostienen el monoteísmo absoluto e incorpóreo del Shemá Yisrael (Deuteronomio 6:4; Eruvín 13b) y rechazan adorar a un ser humano. En cambio, cuando un grupo adopta la Trinidad, la encarnación divina en Jesús y la salvación vicaria por la cruz, cruza la frontera teológica y deja de ser judío: los llamados «judíos mesiánicos» son cristianos evangélicos (de origen bautista/pentecostal) que utilizan símbolos hebreos con fines misioneros.',
    essaySummary: `### Parte I: La Pluralidad Legítima Dentro del Judaísmo (*Majloket le-shem Shamayim*, *Eruvín 13b*)
El judaísmo nunca ha sido un bloque monolítico sin debate; el Talmud (*Eruvín 13b*) consagra que ante las diferencias de escuelas dentro del Pacto (como *Beit Hilel* y *Beit Shamai*), «estas y aquellas son palabras del Dios viviente». Dentro del marco judío encontramos:
1. **El Movimiento Jasídico (fundado por el Baal Shem Tov en el s. XVIII) y sus escuelas**:
   - **Jabad-Lubavitch (חב״ד)**: Fundado por Rabí Shneur Zalman de Liadi (*Alter Rebe*, autor del *Tania*). Su nombre es el acrónimo de *Jojmá* (Sabiduría), *Biná* (Entendimiento) y *Daat* (Conocimiento interiorizado). Une el estudio sistemático de la mística con el amor incondicional a cada judío (*Ahavat Yisrael*) y la difusión global de cada *Mitzvá* concreta para preparar el mundo como morada divina (*Dirá BeTajtonim*).
   - **Breslev (ברסלב)**: Fundado por Rabí Najman de Breslev (bisnieto del Baal Shem Tov, autor del *Likutei Moharán*). Enfatiza la fe sencilla y ardiente, la alegría como precepto constante (*«Mitzvá guedolá lihyot be-simjá tamid»*), la prohibición absoluta de desesperarse (*«Ein shoom yeúsh ba-olam klal»*), la búsqueda de los puntos buenos (*Azamrá*) y la *Hitbodedut* (conversación íntima y espontánea con Dios en el propio idioma).
2. **La Ortodoxia (Sefardí, Ashkenazí, Lituana/Mitnagdí, Movimiento del Musar y Ortodoxia Moderna)**: Centrada en la continuidad rigurosa de la *Halajá* (Torá Escrita y Torá Oral codificada en el *Shulján Aruj*).
3. **Movimientos Modernos (Judaísmo Conservador/*Masortí* y Judaísmo Reformista)**: Aunque mantienen diferencias halájicas y hermenéuticas profundas con la Ortodoxia respecto a la obligatoriedad ritual de los preceptos, **permanecen dentro del judaísmo** porque sostienen sin fisuras el monoteísmo incorpóreo del *Shemá Yisrael* (*Deuteronomio 6:4*) y jamás adoran a Jesús ni aceptan la Trinidad.

### Parte II: La Frontera Teológica y Halájica — ¿Cuándo un Grupo Deja de Ser Judío?
Las Fuentes Internas de la Torá y los 13 Principios de Fe (*Ikarei HaEmuná*) codificados por Maimónides (*Sanhedrín 90a*; *Mishné Torá, Hiljot Yesodei HaTorá 1:7*; *Hiljot Avodá Zará 1:1 y 2:4*) establecen la frontera objetiva donde un grupo se aleja y deja de pertenecer al judaísmo:
1. **Ruptura de la Unicidad e Incorporeidad de Dios (*Yijud Hashem*)**: *Deuteronomio 6:4* («Hashem es Uno») y *Números 23:19* («Dios no es hombre ni hijo de hombre»). Adorar a un ser humano como «Dios Hijo encarnado» o dividir la divinidad en una Trinidad constituye *Avodá Zará* / *Shituf* (culto ajeno al monoteísmo judío).
2. **Sustitución de la *Teshuvá* Directa por Expiación de Sangre Humana**: En la Torá (*Ezequiel 18:20*; *Oseas 14:2–3*), cada ser humano es moralmente responsable y retorna directamente a Dios sin pecado original hereditario ni sacrificios humanos vicarios (*Deuteronomio 12:31*).
3. **Instrumentalización de Signos para Desviar del Sinaí (*Deuteronomio 13:1–6*)**: La Torá advierte explícitamente contra quien utilice lenguaje profético o símbolos familiares para introducir una teología ajena a la Alianza del Sinaí.

### Parte III: Por Qué los «Judíos Mesiánicos» NO Son Judíos sino Cristianos Evangélicos
1. **Doctrina 100% Cristiana Evangélica**: Sus «Declaraciones de Fe» son idénticas a las de las iglesias bautistas y pentecostales: creen en la Trinidad, la encarnación virginal de Jesús (a quien llaman *Yeshúa*), el pecado original, la salvación exclusiva por la sangre de la cruz y el Nuevo Testamento.
2. **Origen Documentado en Misiones Protestantes y Bautistas**: El movimiento no surgió del judaísmo, sino de misiones evangélicas creadas para convertir judíos al cristianismo. Por ejemplo, *Jews for Jesus* fue fundado en 1970 por **Martin «Moishe» Rosen, un ministro ordenado de la Convención Bautista del Sur** (*Southern Baptist Convention*), y la antigua *Hebrew Christian Alliance* (1915) cambió su nombre en 1975 a *Messianic Jewish Alliance* como estrategia misionera.
3. **Uso Misionero de Símbolos Judíos**: Vestir *Talit* y *Kipá*, tocar el *Shofar* o usar vocabulario hebreo mientras se predica la cristología evangélica es un método de «contextualización misionera», no una denominación judía.
4. **Consenso Pan-Judío Unánime y Fallos de la Corte Suprema de Israel**: Todas las corrientes del judaísmo —Jabad, Breslev, Ortodoxia Sefardí y Ashkenazí, Conservadores y Reformistas— junto con la Corte Suprema de Israel (*Caso Rufeisen* 1962 y *Caso Beresford* 1989 bajo la Ley del Retorno) coinciden de forma unánime en que los «judíos mesiánicos» son **cristianos evangélicos**, no un grupo judío.`,
    sourcesSummary:
      'Deuteronomy 6:4 · Numbers 23:19 · Deuteronomy 13:1-6 · Eruvin 13b · Ezekiel 18:20 · Sanhedrin 90a · Mishneh Torah, Foundations of the Torah 1:7 · Fuentes documentales: Historia de Jews for Jesus (Convención Bautista del Sur, 1970) y Corte Suprema de Israel (HCJ 72/62 Rufeisen 1962 & HCJ 265/87 Beresford 1989)',
    createdAt: '2026-11-10T04:10:00.000Z',
    updatedAt: '2026-11-10T04:10:00.000Z',
  },
  {
    id: 'derasha-seed-9',
    sequenceNumber: 9,
    title: 'La Dialéctica de la Generosidad: Entre la Bondad y el Desequilibrio',
    query:
      'La generosidad (Nedivut y Jésed) en el Mesilat Yesharim del Ramjal y el Musar Transformativo: ¿cuándo el impulso de dar sin límites (Guevurá y Ner Mitzvá) se convierte en desequilibrio?',
    methodology: 'MESILAT_YESHARIM_SISTEMATICO',
    complementaryMethodologies: ['MUSAR_TRANSFORMATIVO'],
    duration: '10_MIN',
    audienceOrTone: 'Comunidad general · Inspirador y práctico',
    centralIdea:
      'Según el Mesilat Yesharim del Ramjal y el Musar de Rav Israel Salanter, la verdadera bondad (Jésed / Nedivut) no es un impulso emocional ciego, sino una arquitectura de precisión: despojada del marco del precepto (Ner Mitzvá, Proverbios 6:23; Kiddushin 31a) y del límite de Guevurá y Jeshbón HaNéfesh, la generosidad desmedida puede derivar en vanidad sutil (Negiá) o descuido de las propias responsabilidades.',
    essaySummary: `### Exordio y Planteamiento Espiritual
En nuestra búsqueda por la perfección moral, a menudo asumimos que la virtud es una línea recta hacia la expansión infinita. Sin embargo, la sabiduría del *Mesilat Yesharim* del Ramjal nos advierte que la verdadera bondad no es un impulso ciego, sino una arquitectura de precisión (*Proverbios 22:9*: «El generoso de corazón será bendecido, pues ha dado de su pan al desvalido»).

### 1. Mahut · Definición Esencial (מַהוּת): La esencia de la generosidad reglada
La generosidad (*Nedivut*, de la raíz נ-ד-ב) es el movimiento voluntario del corazón hacia el exterior. Sin embargo, como enseña *Kiddushin 31a* («Grande es quien está comandado y actúa»), cuando la Sefirá de *Jésed* (Bondad expansiva) se desvincula de *Guevurá* (Restricción y discernimiento) y de la *Mitzvá* (*Proverbios 6:23*), puede degenerar en desequilibrio. La virtud consiste en dar preservando la dignidad del receptor y las obligaciones propias.

### 2. Jalakim · Ramificaciones Prácticas (חֲלָקִים): Pensamiento, Palabra y Acción
- **En el pensamiento (*Majshavá*)**: Desear el bien real del prójimo sin buscar validación ni aplauso.
- **En la palabra (*Dibur*)**: Acompañar el dar con calidez y saber poner límites saludables cuando dar sin orden dañaría la autonomía ajena.
- **En la acción (*Maasé*)**: La *Tzedaká* normativa guiada por la lámpara del precepto (*Ner Mitzvá*).

### 3. Aporte Complementario · Musar Transformativo: Contabilidad del Alma (*Jeshbón HaNéfesh*)
Siguiendo a Rav Israel Salanter, antes de realizar un favor o donación, detente 30 segundos y examina si existe un interés egoico oculto (*Negiá*) o necesidad de reconocimiento, alineando tu voluntad con la del Creador (*Pirkei Avot 2:4*).`,
    sourcesSummary:
      'Mesillat Yesharim 11:1 · Pirkei Avot 2:4 · Proverbs 6:23 · Proverbs 22:9 · Kiddushin 31a',
    createdAt: '2026-11-10T13:00:31.739Z',
    updatedAt: '2026-11-10T13:00:31.739Z',
  },
  {
    id: 'derasha-seed-10',
    sequenceNumber: 10,
    title:
      'El Halel, Rosh Jódesh de 1 o 2 Días (Mes Jaser de 29 Días vs. Malé de 30 Días), el Shulján Aruj y las Comparaciones de Minhag y Núsaj (Mejaber frente al Ramá)',
    query:
      'Leyes del Halel (Halel Shalem vs. Jatsi Halel), por qué Rosh Jódesh es de 1 o 2 días según cuántos días tiene el mes que termina (Jódesh Jaser de 29 días vs. Jódesh Malé de 30 días), su codificación en el Shulján Aruj (Oraj Jaim 422:2 y 427:1) y comparación de costumbres internas (Minhag y Núsaj: Sefardí vs. Ashkenazí vs. Jasídico) con Validador Halájico Activo',
    methodology: 'PARDES',
    complementaryMethodologies: ['WISSENSCHAFT_DES_JUDENTUMS'],
    duration: '10_MIN',
    audienceOrTone: 'Halájico, Litúrgico y Comparativo Interno',
    centralIdea:
      'Cuando una consulta es de carácter puramente halájico y litúrgico —como las leyes del Halel (Pesajim 117a; Arjín 10a; Taanit 28b), por qué Rosh Jódesh dura 1 o 2 días dependiendo de si el mes que termina tiene 29 días (Jódesh Jaser) o 30 días (Jódesh Malé) (Rosh Hashaná 19b; Arjín 8b–9b; Rambam Hiljot Kidush HaJódesh 8:4; Shulján Aruj Oraj Jaim 422 y 427:1), o la comparación de costumbres dentro del judaísmo—, el Validador Halájico del Pipeline desactiva toda cita filosófica externa y fundamenta el estudio al 100% en las fuentes internas: el diálogo en el Shulján Aruj entre Rabí Yosef Karo (el Mejaber, tradición Sefardí / Edot HaMizraj) y Rabí Moshé Isserles (el Ramá, tradición Ashkenazí), distinguiendo entre Halajá, Minhag y Núsaj.',
    essaySummary: `### Exordio: La autosuficiencia del canon halájico y el Validador del Pipeline
Al estudiar temas puramente halájicos, calendáricos y litúrgicos —como las leyes del **Halel (הַלֵּל, Salmos 113–118)**, la estructura de **Rosh Jódesh de 1 o 2 días según la duración del mes que termina**, el Shabat o el Kashrut—, el **Validador Halájico del Pipeline** bloquea automáticamente cualquier inyección de filósofos externos (como Kant o Platón) y concentra el análisis en la riqueza jurídica, astronómica e histórica interna del judaísmo: la Torá, el Talmud, Maimónides y el **Shulján Aruj (שֻׁלְחָן עָרוּךְ)**.

### 1. Pshat Halájico: Institución Profética del Halel y Codificación en el Shulján Aruj (*Oraj Jaim 422:2*)
- **Origen Profético (*Pesajim 117a*)**: Los profetas instituyeron que Israel recite el Halel (*Salmos 113–118*) en cada época festiva y ante cada redención nacional.
- **Halel Completo (*Halel Shalem*, *Arjín 10a*) vs. Medio Halel (*Jatsi Halel*, *Taanit 28b*)**: Se recita *Halel Shalem* 18 días al año en Eretz Yisrael (21 en la Diáspora: 8 días de Sucot, 8 de Janucá, inicio de Pésaj y Shavuot). En cambio, en **Rosh Jódesh** y los últimos seis días de Pésaj se recita **Jatsi Halel** (omitiendo *Lo lanu* en Salmo 115:1–11 y *Ahavti* en Salmo 116:1–11), como descubrió Rav al visitar Babilonia en *Taanit 28b* y exclamar: **«Minhag avoteijem be-yadeijem»** (*La costumbre de sus padres está en sus manos*).
- **El Diálogo entre el Mejaber y el Ramá en *Shulján Aruj, Oraj Jaim 422:2***:
  - **El Mejaber (Rabí Yosef Karo — Minhag Sefardí / Edot HaMizraj)**: Dictamina que sobre el Medio Halel de Rosh Jódesh **no se recita bendición** ni al principio ni al final (pues es una costumbre y no una obligación talmúdica completa).
  - **El Ramá (Rabí Moshé Isserles — Minhag Ashkenazí y Jasídico)**: Añade en su glosa (*HaMapá*) que en las comunidades de Ashkenaz **sí se recita la bendición «Likró et ha-Halel» en público** sobre el Medio Halel.

### 2. ¿Por qué Rosh Jódesh es de 1 o de 2 Días según Cuántos Días Tiene el Mes que Termina? (*Rosh Hashaná 19b*; *Arjín 8b–9b*; *Rambam, Hiljot Kidush HaJódesh 8:4*; *Shulján Aruj, Oraj Jaim 427:1*)
El ciclo lunar sinódico (de un *Molad* al siguiente) dura aproximadamente **29 días y medio** (29 días, 12 horas y 793 *jalakim*). Como un mes calendario no puede empezar a mitad del día (*Rosh Hashaná 19b*), los meses hebreos alternan entre **29 días** y **30 días**, lo cual determina directamente cuántos días dura el *Rosh Jódesh* siguiente:
1. **Cuando el mes que termina tiene 29 días (*Jódesh Jaser* — חֹדֶשׁ חָסֵר, «mes deficiente»)**:
   - **Rosh Jódesh dura 1 solo día**, que corresponde únicamente al **día 1 (*Alef*) del nuevo mes entrante**.
2. **Cuando el mes que termina tiene 30 días (*Jódesh Malé* — חֹדֶשׁ מָלֵא, «mes pleno»)**:
   - **Rosh Jódesh dura 2 días**:
     - **Primer día de Rosh Jódesh**: Es el **día 30 (*Lámed*) del mes que termina (mes saliente)**, porque durante ese día 30 se cumple la fracción de las 29 jornadas y media del ciclo lunar y comienza la transición hacia la nueva luna.
     - **Segundo día de Rosh Jódesh**: Es el **día 1 (*Alef*) del nuevo mes entrante** (*Ikar Rosh Jódesh*), a partir del cual se cuentan las fechas del nuevo mes.
   - **Cumplimiento litúrgico en ambos días (*Oraj Jaim 422–423*)**: Cuando Rosh Jódesh es de **2 días**, en **ambos días** por igual se recita el **Medio Halel (*Jatsi Halel*)**, se incluye **«Yaalé VeYavó»** en la *Amidá* y en *Birkat HaMazón*, se lee la Torá (4 *Aliyot*) y se reza la *Amidá* de **Musaf**. Asimismo, en *Shabat Mevajarim* (*Oraj Jaim 417*), al anunciar el mes se especifica si Rosh Jódesh será de un día o de dos días.

### 3. Cómo Distinguir entre *Halajá*, *Minhag* y *Núsaj* Dentro del Judaísmo
1. **Halajá (הֲלָכָה — Ley normativa)**: La estructura jurídica vinculante codificada en las cuatro secciones del *Shulján Aruj* (*Oraj Jaim*, *Yoré Deá*, *Even HaEzer* y *Joshen Mishpat*).
2. **Minhag (מִנְהָג — Costumbre comunitaria ancestral)**: Práctica adoptada por una comunidad con fuerza de ley (*Shulján Aruj, Yoré Deá 214:1*; *Pesajim 50b*; *Proverbios 1:8*: «No abandones la enseñanza de tu madre»), como la berajá en el Medio Halel de Rosh Jódesh (*Oraj Jaim 422:2*), *Kitniyot* en Pésaj (*Oraj Jaim 453:1*), la frecuencia de *Birkat Kohanim* (*Oraj Jaim 128:44*) o los días de *Selijot* en Elul (*Oraj Jaim 581:1*).
3. **Núsaj (נוּסַח — Rito y orden litúrgico, *Oraj Jaim 68:1*)**: La formulación textual y melódica del Sidur (*Núsaj Sefarad / Edot HaMizraj*, *Núsaj Ashkenaz*, *Núsaj Sefard/Ari* jasídico y *Núsaj Teimaní*).

### 4. Sod: Las Doce Puertas del Cielo (Arizal, *Sháar HaKavanot*)
El Arizal explica que las diferencias de *Núsaj* y *Minhag* dentro del pueblo judío corresponden a las **doce puertas del Templo Celestial** para las doce tribus de Israel: cada tradición comunitaria conserva su melodía y puerta propia hacia el mismo Único Creador.`,
    sourcesSummary:
      "Shulchan Arukh, Orach Chayim 422:2 · Shulchan Arukh, Orach Chayim 427:1 · Mishneh Torah, Sanctification of the New Moon 8:4 · Shulchan Arukh, Orach Chayim 1:1 · Shulchan Arukh, Orach Chayim 68:1 · Shulchan Arukh, Yoreh De'ah 214:1 · Pesachim 117a · Arakhin 10a · Taanit 28b",
    createdAt: '2026-11-12T04:50:00.000Z',
    updatedAt: '2026-11-12T05:40:00.000Z',
  },
];

/**
 * Safely merges two lists of ArchivedDerashaEntry without losing entries when
 * two distinct studies happen to carry the same sequenceNumber.
 */
export function mergeArchiveEntriesSafely(
  baseList: ArchivedDerashaEntry[],
  incomingList: ArchivedDerashaEntry[]
): ArchivedDerashaEntry[] {
  const deletedReg = loadDeletedDerashotRegistry();
  const result: ArchivedDerashaEntry[] = [];
  const byId = new Map<string, ArchivedDerashaEntry>();
  const byNormTitle = new Map<string, ArchivedDerashaEntry>();

  const registerEntry = (item: ArchivedDerashaEntry) => {
    if (!item || !item.title) return;
    if (isDerashaMarkedDeleted(item, deletedReg)) return;
    const normTitle = item.title.trim().toLowerCase();
    const existingById = item.id ? byId.get(item.id) : undefined;
    const existingByTitle = byNormTitle.get(normTitle);
    const match = existingById || existingByTitle;

    if (match) {
      const merged: ArchivedDerashaEntry = {
        ...match,
        ...item,
        id: match.id.startsWith('derasha-seed-') ? match.id : item.id || match.id,
        sequenceNumber: match.id.startsWith('derasha-seed-')
          ? match.sequenceNumber
          : match.sequenceNumber || item.sequenceNumber,
        phase1Data: item.phase1Data || match.phase1Data,
        verifiedSources:
          item.verifiedSources && item.verifiedSources.length > 0
            ? item.verifiedSources
            : match.verifiedSources,
        finalDerasha: item.finalDerasha || match.finalDerasha,
        followUps:
          item.followUps && item.followUps.length > 0 ? item.followUps : match.followUps,
      };
      const idx = result.indexOf(match);
      if (idx >= 0) result[idx] = merged;
      byId.set(merged.id, merged);
      byNormTitle.set(normTitle, merged);
    } else {
      const clone = { ...item };
      result.push(clone);
      if (clone.id) byId.set(clone.id, clone);
      byNormTitle.set(normTitle, clone);
    }
  };

  INITIAL_SEEDED_DERASHOT.forEach(registerEntry);
  baseList.forEach(registerEntry);
  incomingList.forEach(registerEntry);

  // Ensure unique, contiguous or strictly increasing sequence numbers with seeds anchored
  const usedSeq = new Set<number>();
  const finalSorted: ArchivedDerashaEntry[] = [];

  // First pass: anchor seeded entries
  for (const item of result) {
    if (item.id?.startsWith('derasha-seed-') && !usedSeq.has(item.sequenceNumber)) {
      usedSeq.add(item.sequenceNumber);
      finalSorted.push(item);
    }
  }

  // Second pass: place remaining entries at their sequenceNumber if free, or next available
  for (const item of result) {
    if (finalSorted.includes(item)) continue;
    let seq = Number(item.sequenceNumber) || 1;
    while (usedSeq.has(seq)) {
      seq += 1;
    }
    usedSeq.add(seq);
    finalSorted.push({ ...item, sequenceNumber: seq });
  }

  finalSorted.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return finalSorted;
}

export function loadLocalArchive(): ArchivedDerashaEntry[] {
  const deletedReg = loadDeletedDerashotRegistry();
  const activeSeeds = INITIAL_SEEDED_DERASHOT.filter(
    (s) => !isDerashaMarkedDeleted(s, deletedReg)
  );
  try {
    const raw = localStorage.getItem(LOCAL_ARCHIVE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(activeSeeds));
      return activeSeeds;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(activeSeeds));
      return activeSeeds;
    }
    const merged = mergeArchiveEntriesSafely(activeSeeds, parsed);
    localStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return activeSeeds;
  }
}

export function saveLocalArchive(entries: ArchivedDerashaEntry[]): void {
  try {
    const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    localStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(sorted));
  } catch {
    // ignore storage quota errors
  }
}

export function loadLocalComparativeStudies(): ComparativeDerashaAnalysisResult[] {
  try {
    const raw = localStorage.getItem(LOCAL_COMPARATIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalComparativeStudies(studies: ComparativeDerashaAnalysisResult[]): void {
  try {
    localStorage.setItem(LOCAL_COMPARATIVE_KEY, JSON.stringify(studies.slice(0, 30)));
  } catch {
    // ignore
  }
}

/**
 * Syncs a single ArchivedDerashaEntry to Firestore when the user is signed in.
 * Enforces strict blueprint volumetric limits and serverTimestamp().
 */
export async function syncDerashaEntryToFirestore(entry: ArchivedDerashaEntry): Promise<void> {
  if (!isFirestoreEnabled) return;
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const docId = `${currentUser.uid}_derasha_${entry.sequenceNumber}`.replace(
    /[^a-zA-Z0-9_\-]/g,
    '_'
  );
  const path = `derashot_archive/${docId}`;

  try {
    await setDoc(doc(db, 'derashot_archive', docId), {
      ownerId: currentUser.uid,
      sequenceNumber: Math.max(1, Math.min(100000, Math.floor(entry.sequenceNumber))),
      title: truncateStr(entry.title, 300, `Derashá #${entry.sequenceNumber}`),
      query: truncateStr(entry.query, 2000, entry.title),
      methodology: truncateStr(entry.methodology, 80, 'PARDES'),
      duration: truncateStr(entry.duration, 40, '10_MIN'),
      audienceOrTone: truncateStr(entry.audienceOrTone, 200, 'Comunidad general'),
      centralIdea: truncateStr(entry.centralIdea, 2000, entry.title),
      essaySummary: truncateStr(entry.essaySummary, 15000, entry.centralIdea),
      sourcesSummary: truncateStr(entry.sourcesSummary, 4000, 'Sefaria'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Syncs a ComparativeDerashaAnalysisResult to Firestore when the user is signed in.
 */
export async function syncComparativeStudyToFirestore(
  study: ComparativeDerashaAnalysisResult
): Promise<void> {
  if (!isFirestoreEnabled) return;
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const safeId = study.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 80);
  const docId = `${currentUser.uid}_${safeId}`.slice(0, 120);
  const path = `comparative_studies/${docId}`;

  try {
    await setDoc(doc(db, 'comparative_studies', docId), {
      ownerId: currentUser.uid,
      relationType: study.relationType || 'INTEGRAL',
      comparedLabel: truncateStr(
        study.comparedNumbers.map((n) => `Derashá #${n}`).join(' vs '),
        300,
        'Comparativa de Derashot'
      ),
      userHypothesis: truncateStr(study.userHypothesis, 2000, 'Análisis dialéctico'),
      synthesisTitle: truncateStr(study.synthesisTitle, 300, 'Síntesis Comparativa'),
      executiveVerdict: truncateStr(study.executiveVerdict, 4000, study.synthesisTitle),
      contradictionsAnalysis: truncateStr(
        study.pointsOfContradictionOrTension,
        6000,
        'Sin contradicción irresoluble.'
      ),
      complementarityAnalysis: truncateStr(
        study.pointsOfComplementarity,
        6000,
        'Complementariedad exegética.'
      ),
      dialecticalResolution: truncateStr(
        study.dialecticalSynthesisAndHomileticBridge,
        6000,
        study.executiveVerdict
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDerashaFromFirestore(sequenceNumber: number): Promise<void> {
  if (!isFirestoreEnabled) return;
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;
  const docId = `${currentUser.uid}_derasha_${sequenceNumber}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `derashot_archive/${docId}`;
  try {
    await deleteDoc(doc(db, 'derashot_archive', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to the signed-in user's Firestore Derashot archive in real time.
 */
export function subscribeToFirestoreArchive(
  userId: string,
  onReceive: (entries: ArchivedDerashaEntry[]) => void
): () => void {
  if (!isFirestoreEnabled) {
    return () => {};
  }
  const path = 'derashot_archive';
  const q = query(collection(db, path), where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const remoteEntries: ArchivedDerashaEntry[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        remoteEntries.push({
          id: docSnap.id,
          sequenceNumber: Number(d.sequenceNumber) || 1,
          title: d.title || '',
          query: d.query || '',
          methodology: (d.methodology as DerashaMethodology) || 'PARDES',
          duration: (d.duration as DerashaDuration) || '10_MIN',
          audienceOrTone: d.audienceOrTone || 'Comunidad general',
          centralIdea: d.centralIdea || '',
          essaySummary: d.essaySummary || '',
          sourcesSummary: d.sourcesSummary || '',
          createdAt: d.createdAt?.toDate
            ? d.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          updatedAt: d.updatedAt?.toDate
            ? d.updatedAt.toDate().toISOString()
            : new Date().toISOString(),
        });
      });
      if (remoteEntries.length > 0) {
        onReceive(remoteEntries.sort((a, b) => a.sequenceNumber - b.sequenceNumber));
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Builds an ArchivedDerashaEntry from a completed pipeline run and saves it to
 * localStorage, server disk (/api/derashot-archive), and Firestore (if authenticated).
 */
export function buildAndSaveDerashaToArchive(
  existingArchive: ArchivedDerashaEntry[],
  params: {
    query: string;
    methodology: DerashaMethodology;
    complementaryMethodologies?: DerashaMethodology[];
    duration: DerashaDuration;
    audienceOrTone: string;
    phase1Data: Phase1AnalysisResult;
    verifiedSources: VerifiedSefariaSource[];
    finalDerasha: FinalDerasha;
    followUps?: FollowUpItem[];
  }
): { updatedArchive: ArchivedDerashaEntry[]; savedEntry: ArchivedDerashaEntry } {
  const normalizedQuery = params.query.trim().toLowerCase();
  const existingIdx = existingArchive.findIndex(
    (e) =>
      e.query.trim().toLowerCase() === normalizedQuery ||
      e.title.trim().toLowerCase() === (params.finalDerasha.derashaTitle || '').trim().toLowerCase()
  );

  const maxSeq = existingArchive.reduce((max, item) => Math.max(max, item.sequenceNumber || 0), 0);
  const sequenceNumber =
    existingIdx >= 0 ? existingArchive[existingIdx].sequenceNumber : maxSeq + 1;

  const sourcesList = [
    ...(params.verifiedSources || []).map((s) => s.ref),
    ...((params.finalDerasha.externalSources || params.phase1Data.externalSources || []).map(
      (ext) => `${ext.author} (${ext.workTitle}, ${ext.canonicalLocus})`
    )),
  ];

  const nowIso = new Date().toISOString();
  const savedEntry: ArchivedDerashaEntry = {
    id: existingIdx >= 0 ? existingArchive[existingIdx].id : `derasha-${sequenceNumber}-${Date.now()}`,
    sequenceNumber,
    title: params.finalDerasha.derashaTitle || params.phase1Data.title || `Derashá #${sequenceNumber}`,
    query: params.query,
    methodology: params.methodology || params.finalDerasha.metodologia || 'PARDES',
    complementaryMethodologies:
      params.complementaryMethodologies || params.finalDerasha.metodologiasComplementarias || [],
    duration: params.duration || params.finalDerasha.duracion || '10_MIN',
    audienceOrTone: params.audienceOrTone || params.finalDerasha.audienciaOTono || 'Comunidad general',
    centralIdea:
      params.finalDerasha.openingExordium ||
      params.finalDerasha.morphologicalSynthesis?.keyTheologicalInsight ||
      params.phase1Data.literalSpanishTranslation ||
      params.finalDerasha.derashaTitle,
    essaySummary:
      params.finalDerasha.fullStructuredDerashaMarkdown ||
      [
        params.finalDerasha.openingExordium,
        params.finalDerasha.pardes?.pshat?.exposition,
        params.finalDerasha.pardes?.drash?.exposition,
        params.finalDerasha.practicalConclusion?.dailyAction,
      ]
        .filter(Boolean)
        .join('\n\n'),
    sourcesSummary: sourcesList.join(' · ') || 'Fuentes canónicas de Sefaria',
    createdAt: existingIdx >= 0 ? existingArchive[existingIdx].createdAt : nowIso,
    updatedAt: nowIso,
    phase1Data: params.phase1Data,
    verifiedSources: params.verifiedSources,
    finalDerasha: params.finalDerasha,
    followUps: params.followUps || [],
  };

  unmarkDeletedDerasha(savedEntry);

  let updatedArchive: ArchivedDerashaEntry[];
  if (existingIdx >= 0) {
    updatedArchive = [...existingArchive];
    updatedArchive[existingIdx] = savedEntry;
  } else {
    updatedArchive = [...existingArchive, savedEntry];
  }
  updatedArchive.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // When connected to Google Drive, store directly in the user's Google Drive without occupying local app storage
  getAccessToken()
    .then((token) => {
      if (token) {
        clearLocalAppStorageForDriveMode();
        if (existingIdx < 0) {
          createNewDerashaFileInGoogleDrive(savedEntry).catch(() => {});
        }
      } else {
        saveLocalArchive(updatedArchive);
        fetch(resolveApiUrl('/api/derashot-archive'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry: savedEntry }),
        }).catch(() => {});
      }
    })
    .catch(() => {
      saveLocalArchive(updatedArchive);
    });

  // Sync user-associated index to Firebase Firestore if signed in
  syncDerashaEntryToFirestore(savedEntry).catch(() => {});

  return { updatedArchive, savedEntry };
}

/**
 * Calls the server endpoint POST /api/compare-derashot to perform a rigorous
 * dialectical comparison between 2 or more archived Derashot (e.g. #1 vs #5).
 */
export async function requestCompareArchivedDerashot(payload: {
  derashot: ArchivedDerashaEntry[];
  relationType: DerashaRelationType;
  userHypothesis: string;
}): Promise<ComparativeDerashaAnalysisResult> {
  const response = await fetch(resolveApiUrl('/api/compare-derashot'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      derashot: payload.derashot.map((d) => ({
        sequenceNumber: d.sequenceNumber,
        title: d.title,
        query: d.query,
        methodology: d.methodology,
        centralIdea: d.centralIdea,
        essaySummary: d.essaySummary.slice(0, 6000),
        sourcesSummary: d.sourcesSummary,
      })),
      relationType: payload.relationType,
      userHypothesis: payload.userHypothesis,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || 'No se pudo completar el análisis comparativo de las Derashot.');
  }

  const result = (await response.json()) as ComparativeDerashaAnalysisResult;
  syncComparativeStudyToFirestore(result).catch(() => {});
  return result;
}

const SPANISH_WORD_TO_NUM: Record<string, number> = {
  uno: 1,
  una: 1,
  primer: 1,
  primera: 1,
  primero: 1,
  dos: 2,
  segunda: 2,
  segundo: 2,
  tres: 3,
  tercer: 3,
  tercera: 3,
  tercero: 3,
  cuatro: 4,
  cuarta: 4,
  cuarto: 4,
  cinco: 5,
  quinta: 5,
  quinto: 5,
  seis: 6,
  sexta: 6,
  sexto: 6,
  siete: 7,
  septima: 7,
  séptima: 7,
  septimo: 7,
  séptimo: 7,
  ocho: 8,
  octava: 8,
  octavo: 8,
  nueve: 9,
  novena: 9,
  noveno: 9,
  diez: 10,
  decima: 10,
  décima: 10,
  decimo: 10,
  décimo: 10,
};

/**
 * Detects if a user query is asking to compare specific numbered Derashot
 * (e.g. "de la drasha número uno y la número 5 me parece que hay una relación / se contradicen / se complementan").
 */
export function parseCrossDerashaComparisonCommand(rawText: string): {
  isCrossDerashaComparison: boolean;
  numbers: number[];
  relationType: DerashaRelationType;
  userHypothesis: string;
} | null {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  // Check if it mentions drasha/derasha/estudios (Unicode-safe for accented endings like derashá / drashá)
  const mentionsDerasha =
    /(?<![a-záéíóúñ])(drash[aá]s?|derash[aá]s?|drashot|derashot|estudios?)(?![a-záéíóúñ])/i.test(
      lower
    );
  if (!mentionsDerasha) return null;

  const foundNumbers = new Set<number>();

  // 1. Match explicit standalone digits (1..50) when the query is about comparing Derashot/estudios
  // Avoid matching biblical chapter:verse like 12:1 or 1:14 or years like 1970
  const sanitizedForNumbers = lower.replace(/\b\d+\s*[:.]\s*\d+\b/g, ' ');
  const digitMatches = sanitizedForNumbers.matchAll(
    /(?:#|n[úu]mero\s*|nro\.?\s*|drash[aá]s?\s*|derash[aá]s?\s*|estudios?\s*|la\s+|el\s+|los\s+|las\s+|y\s+|e\s+|o\s+|con\s+|entre\s+|,\s*)(\d{1,2})(?![a-záéíóúñ\d:.])/g
  );
  for (const m of digitMatches) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 50) foundNumbers.add(n);
  }

  // 2. Match Spanish number and ordinal words (uno, primera, primer, cinco, quinta, etc.)
  const wordRegex = new RegExp(
    `(?<![a-záéíóúñ])(${Object.keys(SPANISH_WORD_TO_NUM).join('|')})(?![a-záéíóúñ])`,
    'gi'
  );
  const wordMatches = sanitizedForNumbers.matchAll(wordRegex);
  for (const m of wordMatches) {
    const word = m[1].toLowerCase();
    // Ignore "una" or "uno" when part of "una relación", "una contradicción", "una tensión", "una conexión", "uno mismo"
    const afterText = sanitizedForNumbers.slice((m.index || 0) + m[0].length).trim();
    if (
      (word === 'una' || word === 'uno') &&
      /^(relaci[oó]n|contradicci[oó]n|tensi[oó]n|conexi[oó]n|comparaci[oó]n|diferencia|oposici[oó]n|s[ií]ntesis|mismo|misma)\b/i.test(
        afterText
      )
    ) {
      continue;
    }
    const mapped = SPANISH_WORD_TO_NUM[word];
    if (mapped) foundNumbers.add(mapped);
  }

  const numbers = Array.from(foundNumbers).sort((a, b) => a - b);
  if (numbers.length < 2) return null;

  let relationType: DerashaRelationType = 'INTEGRAL';
  if (/contradic|opone|opuest|tensi[óo]n|choca/i.test(lower)) {
    relationType = 'CONTRADICCION';
  } else if (/complement|completa|integra|unen|suma/i.test(lower)) {
    relationType = 'COMPLEMENTO';
  } else if (/relaci[óo]n|vincul|conecta|hilo|parece/i.test(lower)) {
    relationType = 'RELACION';
  }

  return {
    isCrossDerashaComparison: true,
    numbers,
    relationType,
    userHypothesis: text,
  };
}

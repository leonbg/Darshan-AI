export interface SampleQuery {
  id: string;
  category: 'Parashá & Torá' | 'Teología & Creación' | 'Ética & Halajá' | 'Mística & Cábala';
  label: string;
  query: string;
  hebrewHint: string;
  description: string;
}

export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: 'parasha-semana-pregunta',
    category: 'Parashá & Torá',
    label: '¿Cuál es el mensaje central de la Parashá de esta semana?',
    query: '¿Cuál es el dilema espiritual y ético central de la Parashá de esta semana según el Rabino Jonathan Sacks y las enseñanzas de Rab Yehoshua Gordon?',
    hebrewHint: 'פָּרָשַׁת הַשָּׁבוּעַ',
    description: 'Pregunta general sobre el eje temático de la lectura semanal de la Torá y sus ciclos de interpretación.',
  },
  {
    id: 'creacion-continua-pregunta',
    category: 'Teología & Creación',
    label: '¿Por qué la Creación se describe en presente continuo?',
    query: '¿Por qué la tradición judía afirma que Dios crea el universo en tiempo presente continuo (Osé Bereshit) en lugar de haberlo creado solo en el pasado?',
    hebrewHint: 'חִדּוּשׁ מַעֲשֵׂה בְרֵאשִׁית',
    description: 'Indagación sobre la renovación constante del cosmos, los Diez Dichos y la refutación del modelo del Dios relojero.',
  },
  {
    id: 'dalet-reish-unicidad-pregunta',
    category: 'Mística & Cábala',
    label: '¿Qué simboliza la tensión entre la Dálet (Uno) y la Reish (Otro)?',
    query: '¿Por qué en el Shemá Israel la letra Dálet de Ejad (Uno) se escribe más grande para no confundirla con una Reish que formaría Ajer (Otro)?',
    hebrewHint: 'אֶחָד מול אַחֵר (ד/ר)',
    description: 'Pregunta sobre las letras mayúsculas masoréticas (Otiot Guedolot), la unicidad divina frente al dualismo y el testimonio espiritual.',
  },
  {
    id: 'amor-projimo-pregunta',
    category: 'Ética & Halajá',
    label: '¿Cómo se comprende el mandato de amar al prójimo como a uno mismo?',
    query: '¿Cómo interpretan los comentaristas clásicos y maestros contemporáneos el principio fundamental de amar al prójimo como a uno mismo (Levítico 19:18)?',
    hebrewHint: 'וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ',
    description: 'Exploración ética y halájica sobre la dignidad de la diferencia, la empatía y la responsabilidad mutua.',
  },
  {
    id: 'fe-crisis-liderazgo',
    category: 'Parashá & Torá',
    label: '¿Qué define el liderazgo espiritual en tiempos de incertidumbre?',
    query: '¿Qué enseñan las travesías de los patriarcas y Moisés en la Torá sobre el liderazgo moral y la fe ante la incertidumbre?',
    hebrewHint: 'מַנְהִיגוּת וֶאֱמוּנָה',
    description: 'Análisis del liderazgo transformador en el pensamiento de Jonathan Sacks y la resiliencia jasídica en Jabad.',
  },
  {
    id: 'gratitud-despertar-pregunta',
    category: 'Ética & Halajá',
    label: '¿Por qué el día judío comienza con gratitud antes que con petición?',
    query: '¿Cuál es el significado psicológico y espiritual de iniciar cada día reconociendo la devolución del alma con gratitud (Modé Aní)?',
    hebrewHint: 'מוֹדֶה אֲנִי • הַכָּרַת הַטּוֹב',
    description: 'Estudio sobre la conciencia al despertar, la confianza (Emuná) y la psicología de la gratitud.',
  },
  {
    id: 'santidad-tiempo-shabat',
    category: 'Teología & Creación',
    label: '¿Cómo santifica el judaísmo el tiempo a través del Shabat y las fiestas?',
    query: '¿De qué manera el Shabat y el ciclo de festividades judías funcionan como un santuario en el tiempo y cuál es su conexión con la Parashá?',
    hebrewHint: 'קְדֻשַּׁת הַזְּמַן וְשַׁבָּת',
    description: 'Reflexión sobre la arquitectura del tiempo sagrado, el descanso creador y la paz interior.',
  },
  {
    id: 'corrientes-judaismo-frontera-mesianicos',
    category: 'Teología & Creación',
    label: 'Corrientes del Judaísmo (Jabad, Breslev, Reformismo) y por qué los «Mesiánicos» son Evangélicos',
    query: 'Dentro del judaísmo hay distintos grupos como el jasidismo Jabad y Breslev, la ortodoxia y los reformistas; ¿cuál es la frontera teológica donde un grupo se aleja y deja de ser judío, y por qué los llamados judíos mesiánicos son en realidad cristianos evangélicos?',
    hebrewHint: 'יִחוּד ה׳ וּגְבוּל הַיַּהֲדוּת',
    description: 'Demarcación teológica, halájica e histórica entre la pluralidad legítima dentro del judaísmo y el sincretismo misionero evangélico.',
  },
];


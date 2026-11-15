import {
  DerashaDuration,
  DerashaMethodology,
  FinalDerasha,
  MethodologySectionItem,
  PardesPillar,
  ResolvedDerashaTone,
  VerifiedSefariaSource,
} from '../types';
import { distillTopicEssence, sanitizeQuotedQuestionInString } from './topicEssence';

export interface TopicExegeticFallbackInput {
  query: string;
  effectiveTitle: string;
  metodologia: Exclude<DerashaMethodology, 'AUTO'>;
  complementaryMethodologies?: DerashaMethodology[];
  duracion: DerashaDuration;
  primaryHebrew?: string;
  transliteration?: string;
  literalSpanishTranslation?: string;
  liturgicalContext?: string;
  morphologicalBreakdown?: any[];
  theologicalKeys?: any;
  verifiedSources?: VerifiedSefariaSource[];
  resolvedTone: ResolvedDerashaTone;
}

export interface TopicExegeticFallbackOutput {
  cleanEssence: string;
  openingExordium: string;
  methodologySections: MethodologySectionItem[];
  pardes: {
    pshat: PardesPillar;
    remez: PardesPillar;
    drash: PardesPillar;
    sod: PardesPillar;
  };
  morphologicalSynthesis: {
    summary: string;
    keyTheologicalInsight: string;
  };
  canonicalAnalysis: {
    synthesis: string;
    verifiedEchoes: Array<{ ref: string; connection: string }>;
  };
  practicalConclusion: {
    title: string;
    hashkafa: string;
    prayerKavanah: string;
    dailyAction: string;
  };
}

function pickSource(
  sources: VerifiedSefariaSource[],
  index: number
): VerifiedSefariaSource | undefined {
  if (!Array.isArray(sources) || sources.length === 0) return undefined;
  return sources[index % sources.length];
}

function formatSourceCitation(src?: VerifiedSefariaSource): string {
  if (!src) return 'las fuentes canónicas de Sefaria (Proverbios 6:23; Pirké Avot 1:17)';
  const rawSnippet = (src.spanishTranslation || src.translation || '').replace(/\s+/g, ' ').trim();
  const shortSnippet =
    rawSnippet.length > 210 ? `${rawSnippet.slice(0, 207).trim()}…` : rawSnippet;
  const heTag = src.heRef ? ` (${src.heRef})` : '';
  return shortSnippet
    ? `${src.ref}${heTag}: «${shortSnippet}»`
    : `${src.ref}${heTag}`;
}

function formatRootItem(item: any): string {
  if (!item || !item.hebrewWord) return '';
  const rootPart = item.root ? ` (raíz ${item.root}` : '';
  const meaningPart = item.rootMeaning ? `: ${item.rootMeaning}` : '';
  const closing = rootPart ? ')' : '';
  const implication = item.theologicalImplication ? ` — ${item.theologicalImplication}` : '';
  return `${item.hebrewWord}${rootPart}${meaningPart}${closing}${implication}`;
}

function toneDirectiveClosing(tone: ResolvedDerashaTone, essence: string): string {
  switch (tone) {
    case 'ADVERTENCIA_CAUTELA':
      return `Desde una perspectiva de cautela y vigilancia ética (Zehirut / אַזְהָרָה), el estudio sobre ${essence} nos advierte sobre los costos espirituales e interpersonales de descuidar este principio en los momentos inadvertidos.`;
    case 'LLAMADO_ACCION':
      return `Con un llamado directo a la acción (Kabalá LeMaasé), ${essence} exige salir de la teoría abstracta para encarnarse hoy en decisiones concretas y medibles.`;
    case 'MOTIVACION':
      return `Con aliento y fortaleza interior (Jizuk / עִדּוּד), comprender ${essence} renueva la esperanza: todo paso sincero reabre el vínculo vivo con el Creador.`;
    case 'ANALITICO_SOBRIO':
      return `Desde una lectura sobria y rigurosa de los textos primarios, ${essence} queda articulado a través de sus términos hebreos y su desarrollo en los comentadores.`;
    case 'ASPIRACIONAL':
    default:
      return `Con horizonte aspiracional, profundizar en ${essence} eleva la conciencia cotidiana hacia la santificación concreta de la vida (Kidush HaJaim).`;
  }
}

function buildComplementaryTopicSection(
  compMethod: DerashaMethodology,
  stepNumber: number,
  essence: string,
  primaryHebrew: string,
  root0: string,
  src0: VerifiedSefariaSource | undefined,
  src1: VerifiedSefariaSource | undefined,
  theologicalKeys: any
): MethodologySectionItem {
  const srcRef = formatSourceCitation(src1 || src0);
  const kabbalahExp =
    theologicalKeys?.kabbalisticArchitecture?.explanation ||
    `La proyección interior de ${essence} equilibra Jésed y Guevurá dentro de Tiféret y se manifiesta en Maljut.`;
  const badge = stepNumber === 4 ? 'ד' : stepNumber === 5 ? 'ה' : 'ו';

  switch (compMethod) {
    case 'MESILAT_YESHARIM_SISTEMATICO':
      return {
        key: `comp_mesilat_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'מְסִלַּת יְשָׁרִים',
        spanishSubtitle: 'Aporte Complementario · Mesilat Yesharim Sistemático',
        title: `Adquisición Práctica y Obstáculos de ${essence} según el Ramjal`,
        exposition: `Al aplicar el método de Rabí Moshé Jaim Luzzatto sobre ${essence} (${primaryHebrew}), la primera clave es no confundir la buena intención ocasional con una virtud consolidada. El análisis de ${root0} muestra que el crecimiento requiere atención consciente (Zehirut) en los detalles del habla, el pensamiento y la acción respaldados por ${srcRef}. Sus principales detractores son la rutina distraída, la prisa que impide el examen interior y la autojustificación; para contrarrestarlos, el Ramjal prescribe repasar diariamente los fundamentos del tema y fijar actos preventivos pequeños pero constantes.`,
        keyTakeaway: `Sostener ${essence} exige hábitos diarios verificables que superen la inercia y el descuido.`,
        sourceMethodology: compMethod,
      };
    case 'MUSAR_TRANSFORMATIVO':
      return {
        key: `comp_musar_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'מוּסָר וְחֶשְׁבּוֹן הַנֶּפֶשׁ',
        spanishSubtitle: 'Aporte Complementario · Musar Transformativo',
        title: `Diagnóstico del Néfesh y Contabilidad Interior frente a ${essence}`,
        exposition: `Desde la escuela de Rabí Israel Salanter y Rav Dessler, la dificultad real en torno a ${essence} casi nunca es falta de información intelectual, sino la brecha entre lo que la mente reconoce y la reacción automática del Néfesh ante la comodidad o el interés propio (negiá). A la luz de ${srcRef} y de ${root0}, cinco minutos de Jeshbón HaNéfesh vespertino permiten anticipar el instante exacto de prueba y grabar una respuesta serena con convicción emocional (Hitpaalut) antes de actuar.`,
        keyTakeaway: `El cambio genuino en ${essence} nace al confrontar la propia inercia emocional con Jeshbón HaNéfesh diario.`,
        sourceMethodology: compMethod,
      };
    case 'EVOLUCION_CONCEPTUAL':
      return {
        key: `comp_evol_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'הִתְפַּתְּחוּת הַמּוּשָׂג',
        spanishSubtitle: 'Aporte Complementario · Evolución Conceptual (Torá, Cábala, Musar y Jasidut)',
        title: `Trayectoria Histórica y Mística de ${essence}`,
        exposition: `Siguiendo la trayectoria de ${essence} a lo largo de la tradición: en el estrato bíblico-talmúdico (${srcRef}) queda establecido su mandato normativo y la precisión de ${root0}; en la Cábala, ${kabbalahExp}; el Musar convierte esa intuición espiritual en disciplina verificable de la conducta; y la Jasidut (desde el Baal Shem Tov hasta el Tania y Breslev) integra ${essence} como fuente de vitalidad y cercanía interior al Creador (Devekut).`,
        keyTakeaway: `Torá, Cábala, Musar y Jasidut iluminan progresivamente ${essence} desde la norma hasta el servicio gozoso del corazón.`,
        sourceMethodology: compMethod,
      };
    case 'PIRKE_AVOT_EXEGETICO':
      return {
        key: `comp_avot_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'מִילֵי דַאֲבוֹת',
        spanishSubtitle: 'Aporte Complementario · Pirké Avot Exegético',
        title: `Equilibrio Ético y Nobleza de Carácter en ${essence}`,
        exposition: `Al leer ${essence} desde el prisma de Pirké Avot y sus comentadores clásicos: Maimónides (Shemoná Perakim) enseña a situar ${essence} en el justo medio racional para sanar las facultades del alma, mientras Rabenu Yoná y el Maharal de Praga enfatizan que la pureza de intención frente al Cielo protege la integridad de ${root0} incluso en ausencia de testigos, en consonancia con ${srcRef}.`,
        keyTakeaway: `Unir equilibrio racional (Rambam) y temor reverencial del corazón (Rabenu Yoná) consolida ${essence}.`,
        sourceMethodology: compMethod,
      };
    case 'WISSENSCHAFT_DES_JUDENTUMS':
    case 'FILOLOGIA_LITURGICA_WISSENSCHAFT':
      return {
        key: `comp_wiss_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'מֶחְקָר פִילוֹלוֹגִי',
        spanishSubtitle: 'Aporte Complementario · Wissenschaft des Judentums',
        title: `Análisis Filológico y Estratos Textuales de ${essence}`,
        exposition: `Desde la crítica histórico-filológica, el estudio de ${essence} muestra cómo el campo semántico de ${primaryHebrew} y ${root0} atraviesa los estratos del Tanaj, la compilación tanaítica de la Mishná y la elaboración amoraica en ${srcRef}, siendo luego sistematizado en los códigos medievales de los Rishonim para preservar su continuidad textual y normativa.`,
        keyTakeaway: `La continuidad filológica entre el Tanaj, Jazal y los Rishonim confirma la solidez textual de ${essence}.`,
        sourceMethodology: compMethod,
      };
    case 'FILOSOFIA_CONTRASTIVA':
      return {
        key: `comp_filo_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'מַחְשֶׁבֶת יִשְׂרָאֵל',
        spanishSubtitle: 'Aporte Complementario · Pensamiento Comparado de la Torá',
        title: `Especificidad del Mandamiento en ${essence}`,
        exposition: `A diferencia de sistemas morales meramente autónomos o abstractos, la tradición judía sostiene en ${essence} que el deber ético nace de una alianza viva con el Creador y se encarna en preceptos específicos («Ki ner mitzvá ve-Torá or», Proverbios 6:23). Respaldado por ${srcRef} y ${root0}, este enfoque evita que el criterio personal oscurezca la responsabilidad concreta.`,
        keyTakeaway: `En la Torá, la luz universal se realiza a través de la especificidad concreta de ${essence}.`,
        sourceMethodology: compMethod,
      };
    case 'PARDES':
    default:
      return {
        key: `comp_pardes_${stepNumber}`,
        stepNumber,
        hebrewBadge: badge,
        hebrewTerm: 'רֶמֶז וְסוֹד',
        spanishSubtitle: 'Aporte Complementario · Exégesis PARDÉS',
        title: `Síntesis Literal e Interior (Pshat–Sod) de ${essence}`,
        exposition: `Integrando las cuatro dimensiones del PARDÉS sobre ${essence}, el sentido textual de ${primaryHebrew} y ${root0} converge con las resonancias midráshicas de ${srcRef} y con la arquitectura interior descrita en las claves teológicas: ${kabbalahExp}`,
        keyTakeaway: `Desde el texto literal hasta la dimensión interior, todo apunta a encarnar ${essence} en la vida diaria.`,
        sourceMethodology: compMethod,
      };
  }
}

export function buildTopicGroundedExegeticAnalysis(
  input: TopicExegeticFallbackInput
): TopicExegeticFallbackOutput {
  const essence = distillTopicEssence(input.query, input.effectiveTitle);
  const sources = Array.isArray(input.verifiedSources) ? input.verifiedSources : [];
  const roots = Array.isArray(input.morphologicalBreakdown) ? input.morphologicalBreakdown : [];
  const keys = input.theologicalKeys || {};

  const primaryHebrew = (input.primaryHebrew || 'כִּי נֵר מִצְוָה וְתוֹרָה אוֹר').trim();
  const translit = (input.transliteration || 'Ki Ner Mitzvá ve-Torá Or').trim();
  const literalTrans = (
    input.literalSpanishTranslation ||
    'Porque lámpara es el mandamiento y la Torá es luz'
  ).trim();

  const src0 = pickSource(sources, 0);
  const src1 = pickSource(sources, 1);
  const src2 = pickSource(sources, 2);
  const src3 = pickSource(sources, 3);

  const root0 =
    formatRootItem(roots[0]) ||
    'תּוֹרָה (raíz י-ר-ה: instruir, dirigir el caminar humano hacia la verdad y la vida)';
  const root1 =
    formatRootItem(roots[1]) ||
    'מִצְוָה (raíz צ-ו-ה: mandamiento que vincula al ser humano con la voluntad divina)';
  const root2 =
    formatRootItem(roots[2]) ||
    'דִּבּוּר / מַעֲשֶׂה (armonía entre la intención interior, la palabra y la obra concreta)';

  const parallelism = keys?.textualParallelism || {};
  const dichotomy = keys?.grammaticalDichotomy || {};
  const techTerm = keys?.technicalTerm || {};
  const kabbalah = keys?.kabbalisticArchitecture || {};

  const cite0 = formatSourceCitation(src0);
  const cite1 = formatSourceCitation(src1);
  const cite2 = formatSourceCitation(src2);
  const cite3 = formatSourceCitation(src3);

  const toneClose = toneDirectiveClosing(input.resolvedTone, essence);

  const rawExordium = [
    `El estudio sobre ${essence} se ancla en el eje hebreo ${primaryHebrew} (${translit}: «${literalTrans}»).`,
    parallelism.explanation ||
      `Lejos de reducirse a una reflexión aislada, los textos primarios verificados —iniciando con ${cite0}— muestran que ${essence} compromete la integridad del intelecto, la sensibilidad del corazón y la conducta concreta.`,
    toneClose,
  ]
    .filter(Boolean)
    .join(' ');

  const methodologySections: MethodologySectionItem[] = [];
  const m = input.metodologia;

  if (m === 'MESILAT_YESHARIM_SISTEMATICO') {
    methodologySections.push(
      {
        key: 'mahut',
        stepNumber: 1,
        hebrewBadge: 'מ',
        hebrewTerm: 'מַהוּת',
        spanishSubtitle: '1. Mahut · Esencia y Frontera Conceptual',
        title: `Definición Esencial de ${essence} (${primaryHebrew})`,
        exposition: `En el primer estadio del análisis del Ramjal aplicado a ${essence}, la esencia se esclarece desde la raíz hebrea ${root0}. Como atestigua ${cite0}, no se trata de un gesto meramente decorativo o dictado por la conveniencia social, sino de una postura consciente ante el Creador que exige distinguir entre el cumplimiento auténtico y su imitación superficial.${parallelism.explanation ? ` ${parallelism.explanation}` : ''}`,
        keyTakeaway: `La esencia (Mahut) de ${essence} reside en la autenticidad interior sustentada en ${src0?.ref || 'las fuentes de la Torá'}, no en la apariencia externa.`,
        sourceMethodology: m,
      },
      {
        key: 'jalakim',
        stepNumber: 2,
        hebrewBadge: 'ח',
        hebrewTerm: 'חֲלָקִים',
        spanishSubtitle: '2. Jalakim · Pensamiento, Palabra y Acción',
        title: `Manifestaciones de ${essence} en la Conducta Cotidiana`,
        exposition: `Desglosando los componentes operativos de ${essence}: en el plano del pensamiento (Majshavá) requiere lucidez frente a ${dichotomy.explanation || root1}; en la palabra (Dibur), coherencia y respeto al prójimo según ${cite1}; y en el plano de la acción (Maasé), disciplina verificable en las situaciones concretas del hogar, el trabajo y la comunidad.`,
        keyTakeaway: `${essence} abarca de modo inseparable la intención mental, la expresión verbal y la acción tangible.`,
        sourceMethodology: m,
      },
      {
        key: 'derej_kinyano',
        stepNumber: 3,
        hebrewBadge: 'ד',
        hebrewTerm: 'דֶּרֶךְ קִנְיָנוֹ',
        spanishSubtitle: '3. Dérej Kinyanó · Medios de Adquisición',
        title: `Cómo Adquirir y Consolidar ${essence}`,
        exposition: `Para internalizar ${essence} paso a paso, el enfoque del Ramjal combina tres herramientas alimentadas por ${cite2}: 1) estudio meditado de sus fuentes y de ${root1} para que el ideal deje de ser difuso; 2) preparación previa ante los escenarios recurrentes del día (Zehirut); y 3) actos exteriores constantes que despiertan progresivamente la sensibilidad del alma.`,
        keyTakeaway: `La repetición reflexiva y la prevención serena convierten ${essence} en una segunda naturaleza.`,
        sourceMethodology: m,
      },
      {
        key: 'mafsidayv',
        stepNumber: 4,
        hebrewBadge: 'פ',
        hebrewTerm: 'מַפְסִידָיו',
        spanishSubtitle: '4. Mafsidayv · Obstáculos y Factores de Erosión',
        title: `Qué Debilita ${essence} y Cómo Neutralizarlo`,
        exposition: `En el plano de los impedimentos, ${essence} se erosiona por la distracción habitual (herguel), la prisa que impide deliberar antes de reaccionar y el autoengaño de minimizar las faltas pequeñas bajo la idea de que nadie observa. A la luz de ${cite3}${kabbalah.explanation ? ` y de ${kabbalah.explanation}` : ''}, neutralizar estos factores exige pausa consciente y responsabilidad diaria.`,
        keyTakeaway: `Vigilar la inercia y los descuidos cotidianos preserva intacta la integridad de ${essence}.`,
        sourceMethodology: m,
      }
    );
  } else if (m === 'EVOLUCION_CONCEPTUAL') {
    methodologySections.push(
      {
        key: 'tora_jazal',
        stepNumber: 1,
        hebrewBadge: 'ת',
        hebrewTerm: 'תּוֹרָה וַחֲזַ״ל',
        spanishSubtitle: '1. En la Torá y Jazal · Raíz y Normativa',
        title: `Raíz Bíblica y Codificación Talmúdica de ${essence}`,
        exposition: `En el fundamento bíblico y rabínico, ${essence} se articula a partir de ${primaryHebrew} («${literalTrans}») y del campo léxico de ${root0}. El análisis de ${cite0} junto con ${cite1} demuestra cómo los Sabios de la Mishná y el Talmud traducen este principio en responsabilidad ética y jurídica concreta dentro del Pacto.`,
        keyTakeaway: `Desde su raíz hebrea en el Tanaj hasta Jazal, ${essence} une sentido espiritual y deber concreto.`,
        sourceMethodology: m,
      },
      {
        key: 'cabala_etz_jaim',
        stepNumber: 2,
        hebrewBadge: 'ע',
        hebrewTerm: 'עֵץ חַיִּים וְקַבָּלָה',
        spanishSubtitle: '2. En el Árbol de la Vida de la Cábala',
        title: `Arquitectura Sefirótica de ${essence}`,
        exposition: `Al proyectar ${essence} sobre la estructura de las diez Sefirot (${kabbalah.sefiraConnection || 'Jésed, Guevurá, Tiféret y Maljut'}), ${kabbalah.explanation || `cada movimiento ligado a ${root1} ordena la energía del alma entre la expansión amorosa (Jésed) y la contención responsable (Guevurá)`}. De este modo, según ${cite2}, los actos humanos en el plano inferior despiertan correspondencia y armonía en los mundos espirituales.`,
        keyTakeaway: `En la Cábala, ${essence} armoniza expansión y medida sagrada para canalizar luz divina hacia este mundo.`,
        sourceMethodology: m,
      },
      {
        key: 'movimiento_musar',
        stepNumber: 3,
        hebrewBadge: 'מ',
        hebrewTerm: 'תְּנוּעַת הַמּוּסָר',
        spanishSubtitle: '3. Según el Musar · Rectificación del Carácter',
        title: `Psicología Ética y Disciplina de ${essence}`,
        exposition: `El Movimiento del Musar (Ramjal, Rabí Israel Salanter y Rav Dessler) traslada esta arquitectura metafísica al terreno del carácter humano (Tikún HaMidot): analiza qué impulsos egoístas o miedos sabotean ${essence} en la práctica y prescribe, en diálogo con ${dichotomy.explanation || cite1}, ejercicios diarios de autoexamen (Jeshbón HaNéfesh) para alinear emoción e intelecto.`,
        keyTakeaway: `El Musar convierte ${essence} en trabajo metódico sobre las inclinaciones reales del corazón.`,
        sourceMethodology: m,
      },
      {
        key: 'jasidut_escuelas',
        stepNumber: 4,
        hebrewBadge: 'ח',
        hebrewTerm: 'חֲסִידוּת וּפְנִימִיּוּת',
        spanishSubtitle: '4. En la Jasidut y Síntesis Evolutiva',
        title: `Interiorización de ${essence} en Jabad, Breslev y Sfat Emet`,
        exposition: `Finalmente, la Jasidut eleva ${essence} desde la exigencia ascética hacia la adhesión gozosa (Devekut): el Baal Shem Tov revela la presencia divina inmediata dentro de cada acto vinculado a ${root0}; Jabad (Tania) canaliza la meditación intelectual (Jojmá-Biná-Daat) hacia el dominio interior; Breslev convierte ${essence} en diálogo sincero con el Creador (Hitbodedut); y el Sfat Emet llama a renovar su significado en cada generación. Contrastando los cuatro estratos con ${cite3}, se aprecia una línea continua desde el mandamiento textual hasta su vivencia más íntima.`,
        keyTakeaway: `Torá, Cábala, Musar y Jasidut convergen en hacer de ${essence} un encuentro vivo y alegre con lo Divino.`,
        sourceMethodology: m,
      }
    );
  } else if (
    m === 'WISSENSCHAFT_DES_JUDENTUMS' ||
    m === 'FILOLOGIA_LITURGICA_WISSENSCHAFT'
  ) {
    methodologySections.push(
      {
        key: 'critica_textual',
        stepNumber: 1,
        hebrewBadge: 'ב',
        hebrewTerm: 'בִּקֹּרֶת הַנֻּסָּח',
        spanishSubtitle: '1. Crítica Textual y Evidencia Filológica',
        title: `Términos Hebreos y Testimonios Primarios de ${essence}`,
        exposition: `El examen histórico-filológico de ${essence} comienza con la fijación léxica de ${primaryHebrew} (${translit}) y de sus raíces: ${root0}; ${root1}. El cotejo directo con ${cite0} delimita el sentido originario del término antes de sus amplificaciones homiléticas posteriores.`,
        keyTakeaway: `La filología hebrea sobre ${primaryHebrew} fija el sentido exacto del texto base de ${essence}.`,
        sourceMethodology: m,
      },
      {
        key: 'estratos_talmudicos',
        stepNumber: 2,
        hebrewBadge: 'ע',
        hebrewTerm: 'תּוֹלְדוֹת הָעֲרִיכָה',
        spanishSubtitle: '2. Estratos Redaccionales Tanaíticos y Amoraicos',
        title: `Desarrollo de ${essence} en Mishná, Talmud y Midrash`,
        exposition: `Al rastrear ${essence} a través de los estratos redaccionales, observamos cómo la enunciación tanaítica en ${cite1} es reelaborada y contextualizada por los Amoraím y el Midrash en ${cite2}.${dichotomy.explanation ? ` ${dichotomy.explanation}` : ''} Ello permite distinguir el núcleo normativo temprano de las expansiones dialécticas posteriores.`,
        keyTakeaway: `Seguir la evolución entre Tanaím y Amoraím aclara cómo se articuló históricamente ${essence}.`,
        sourceMethodology: m,
      },
      {
        key: 'analisis_funcional',
        stepNumber: 3,
        hebrewBadge: 'ר',
        hebrewTerm: 'פְּסַק וְרִאשׁוֹנִים',
        spanishSubtitle: '3. Análisis Funcional y Recepción en los Rishonim',
        title: `Función Comunitaria y Codificación de ${essence}`,
        exposition: `En el plano institucional y jurídico sobre ${essence}, ${techTerm.explanation || `la recepción medieval en Rashi, Maimónides (Rambam) y el Shulján Aruj consolidó este criterio práctico en la vida judía`}. La evidencia de ${cite3} confirma que la formulación textual respondía a necesidades concretas de cohesión ética y santificación cotidiana.`,
        keyTakeaway: `Los Rishonim tradujeron el debate textual sobre ${essence} en pautas normativas estables para la comunidad.`,
        sourceMethodology: m,
      },
      {
        key: 'exegesis_academica',
        stepNumber: 4,
        hebrewBadge: 'ח',
        hebrewTerm: 'חָכְמַת יִשְׂרָאֵל',
        spanishSubtitle: '4. Exégesis Teológica Comparada y Síntesis',
        title: `Significado Histórico y Contemporáneo de ${essence}`,
        exposition: `Al integrar filología, historia redaccional y teología viva, ${essence} se revela no como una abstracción atemporal sino como una respuesta madura del espíritu judío a lo largo de los siglos: ${parallelism.explanation || `cada fuente (${src0?.ref || 'Tanaj'} y ${src1?.ref || 'Talmud'}) refuerza la síntesis entre precisión textual y vigor moral`}.`,
        keyTakeaway: `El rigor histórico-crítico enriquece y profundiza la comprensión actual de ${essence}.`,
        sourceMethodology: m,
      }
    );
  } else if (m === 'PIRKE_AVOT_EXEGETICO') {
    methodologySections.push(
      {
        key: 'contexto_tanaita',
        stepNumber: 1,
        hebrewBadge: 'א',
        hebrewTerm: 'קוֹל הַתַּנָּא',
        spanishSubtitle: '1. Contexto del Tanaíta · La Voz de la Mishná',
        title: `Fundamento Tanaítico de ${essence}`,
        exposition: `Al situar ${essence} dentro de la cadena de transmisión ética de Avot, el punto de partida textual se condensa en ${primaryHebrew} («${literalTrans}») y en el testimonio directo de ${cite0}. Con sobriedad lapidaria, los Tanaím confrontan la tendencia humana a justificar fallas menores y plantean el núcleo de ${root0}.`,
        keyTakeaway: `La sentencia tanaítica sobre ${essence} interpela directamente la conciencia personal sin rodeos retóricos.`,
        sourceMethodology: m,
      },
      {
        key: 'analisis_contrastivo',
        stepNumber: 2,
        hebrewBadge: 'ב',
        hebrewTerm: 'רַמְבַּ״ם · רַבֵּנוּ יוֹנָה · מַהֲרַ״ל',
        spanishSubtitle: '2. Análisis Contrastivo · Rambam vs. Rabenu Yoná y Maharal',
        title: `Tres Lecturas Clásicas sobre ${essence}`,
        exposition: `Al contrastar los grandes comentaristas en torno a ${cite1}: el Rambam (en su Comentario a Avot y Shemoná Perakim) lee ${essence} como salud y equilibrio de las facultades del alma (camino del medio); Rabenu Yoná de Gerona acentúa la purificación de la intención y el temor reverencial frente al Creador incluso en privado; y el Maharal de Praga (Dérej Jaim) revela su dimensión estructural dentro del orden espiritual del mundo en diálogo con ${root1}.`,
        keyTakeaway: `Rambam, Rabenu Yoná y el Maharal muestran cómo ${essence} une salud mental, pureza interior y orden cósmico.`,
        sourceMethodology: m,
      },
      {
        key: 'principio_vivo',
        stepNumber: 3,
        hebrewBadge: 'ג',
        hebrewTerm: 'הֲלָכָה לְמַעֲשֶׂה',
        spanishSubtitle: '3. Principio Vivo · Ética Contemporánea',
        title: `Aplicación Inmediata de ${essence} Hoy`,
        exposition: `Recogiendo la máxima talmúdica «Mán davaí lejaíé jasiduta» (Bava Kama 30a) y el testimonio de ${cite2}, vivir ${essence} hoy implica transformar el estudio en responsabilidad tangible en la palabra, la honestidad laboral y el trato familiar.`,
        keyTakeaway: `La nobleza de Pirké Avot se mide al llevar ${essence} a las decisiones ordinarias de esta semana.`,
        sourceMethodology: m,
      }
    );
  } else if (m === 'MUSAR_TRANSFORMATIVO') {
    methodologySections.push(
      {
        key: 'punto_focal',
        stepNumber: 1,
        hebrewBadge: 'נ',
        hebrewTerm: 'נְקֻדַּת הַהִתְבּוֹנְנוּת',
        spanishSubtitle: '1. Punto Focal · Fricción Conductual Concreta',
        title: `La Brecha Real al Vivir ${essence}`,
        exposition: `El punto exacto de fricción alrededor de ${essence} ocurre cuando sabemos intelectualmente lo que enseña ${cite0} y ${primaryHebrew} («${literalTrans}»), pero en la práctica cotidiana —especialmente bajo prisa, cansancio o ausencia de testigos— actuamos por impulso automático y olvidamos ${root0}.`,
        keyTakeaway: `El desafío real de ${essence} está en cerrar la distancia entre convicción mental y hábito espontáneo.`,
        sourceMethodology: m,
      },
      {
        key: 'diagnostico_nefesh',
        stepNumber: 2,
        hebrewBadge: 'א',
        hebrewTerm: 'אִבְחוּן הַנֶּפֶשׁ',
        spanishSubtitle: '2. Diagnóstico del Néfesh · Impulsos Subconscientes',
        title: `Qué Fuerzas Ocultas Sabotean ${essence}`,
        exposition: `Al diagnosticar el Néfesh en relación con ${essence} siguiendo a Rabí Israel Salanter y el Mijtav MeEliahu en diálogo con ${cite1}, detectamos las tres coartadas habituales: 1) la búsqueda de validación externa (si nadie mira, baja la guardia); 2) la ilusión de que un gesto aislado no deja huella en el alma; y 3) el interés propio encubierto (negiá). Comprender ${dichotomy.explanation || root1} devuelve claridad frente a estos sesgos.`,
        keyTakeaway: `Reconocer el autoengaño y la negiá devuelve el timón moral sobre ${essence}.`,
        sourceMethodology: m,
      },
      {
        key: 'jeshbon_hanefesh',
        stepNumber: 3,
        hebrewBadge: 'ח',
        hebrewTerm: 'חֶשְׁבּוֹן הַנֶּפֶשׁ',
        spanishSubtitle: '3. Contabilidad del Alma y Kabalá Maásit',
        title: `Pregunta Reflexiva y Práctica Diaria para ${essence}`,
        exposition: `Frente a ${cite2}, surge una pregunta frontal: ¿qué cambiaría hoy en mi conducta respecto a ${essence} si tuviera plena certeza de que cada palabra y acto mío construye mi propio carácter? Como Kabalá LeMaasé para esta semana, establece una pausa de tres segundos antes de responder en momentos de tensión y dedica cinco minutos cada noche a revisar un acierto y una corrección concreta.`,
        keyTakeaway: `Un compromiso pequeño, medible y revisado cada noche transforma gradualmente ${essence} en carácter estable.`,
        sourceMethodology: m,
      }
    );
  } else if (m === 'FILOSOFIA_CONTRASTIVA') {
    methodologySections.push(
      {
        key: 'eje_fuentes',
        stepNumber: 1,
        hebrewBadge: 'א',
        hebrewTerm: 'מְקוֹרוֹת פְּנִימִיִּים וְחִיצוֹנִיִּים',
        spanishSubtitle: '1. Eje I · Fuentes Internas de la Torá frente a Fuentes Externas',
        title: `Fundamento Revelado de ${essence} frente a la Razón Autónoma`,
        exposition: `Al examinar ${essence} bajo el principio de Eijá Rabá 2:13 («Jojmá ba-Goyim taamín, Torá ba-Goyim al taamín»), el análisis de ${primaryHebrew} y de ${root0} en ${cite0} muestra que el deber ético en la Torá no brota solo de un cálculo racional solitario del individuo, sino de una relación viva y teonómica con el Creador que interpela la conciencia.`,
        keyTakeaway: `En la Torá, ${essence} posee autoridad vinculante porque nace de un vínculo relacional del Pacto, no del mero subjetivismo.`,
        sourceMethodology: m,
      },
      {
        key: 'universalidad_especificidad',
        stepNumber: 2,
        hebrewBadge: 'ב',
        hebrewTerm: 'אוּנִיבֶרְסָלִיּוּת וּפְרָטָנוּת',
        spanishSubtitle: '2. Eje II · Universalidad frente a Especificidad del Mandamiento',
        title: `Cómo Se Encarna ${essence} en Mitzvot Concretas`,
        exposition: `Mientras la especulación filosófica tiende a formular máximas abstractas y desencarnadas, ${cite1} y «Ki ner mitzvá ve-Torá or» (Proverbios 6:23) demuestran que la luz universal de ${essence} solo ilumina cuando desciende a la especificidad del mandamiento concreto (Kidushín 31a), equilibrando el principio general con la atención particular a cada circunstancia humana y ${root1}.`,
        keyTakeaway: `La Torá une horizonte ético universal y especificidad concreta al practicar ${essence}.`,
        sourceMethodology: m,
      },
      {
        key: 'respuesta_canonica',
        stepNumber: 3,
        hebrewBadge: 'ג',
        hebrewTerm: 'מַעֲנֵה מְקוֹרוֹת הַתּוֹרָה',
        spanishSubtitle: '3. Respuesta desde las Fuentes Canónicas',
        title: `Diálogo con Talmud, Rambam, Kuzari y Maharal sobre ${essence}`,
        exposition: `Respecto a ${essence}, las fuentes rabínicas clásicas —representadas por ${cite2} y ${techTerm.explanation || 'la tradición halájica y filosófica del Rambam y Rabí Yehudá HaLeví'}— subrayan que la sabiduría alcanza su verdad plena cuando santifica la vida histórica y las relaciones interpersonales en lugar de evadir el mundo material.`,
        keyTakeaway: `Los sabios de Israel validan la reflexión sobre ${essence} únicamente cuando produce rectitud histórica y comunitaria.`,
        sourceMethodology: m,
      },
      {
        key: 'sintesis_elevacion',
        stepNumber: 4,
        hebrewBadge: 'ד',
        hebrewTerm: 'בֵּרוּר וְהַעֲלָאָה',
        spanishSubtitle: '4. Síntesis Exegética y Elevación Práctica',
        title: `Síntesis: Habitar el Mundo con Responsabilidad en ${essence}`,
        exposition: `Convergiendo con ${cite3} y ${kabbalah.explanation || 'el principio de Dirá BeTajtonim'}, ${essence} nos llama a construir en lo cotidiano una morada digna para la presencia divina mediante justicia, bondad y coherencia entre pensamiento y obra.`,
        keyTakeaway: `Realizar hoy una acción concreta de justicia o bondad que traduzca en hechos la enseñanza sobre ${essence}.`,
        sourceMethodology: m,
      }
    );
  } else {
    // Default: PARDES
    methodologySections.push(
      {
        key: 'pshat',
        stepNumber: 1,
        hebrewBadge: 'פ',
        hebrewTerm: 'פְּשָׁט',
        spanishSubtitle: '1. Pshat · Nivel Literal y Contextual',
        title: `Fundamento Textual y Filológico de ${essence}`,
        exposition: `En el plano directo y contextual, ${essence} se fundamenta en la expresión hebrea ${primaryHebrew} (${translit}: «${literalTrans}») y en el testimonio directo de ${cite0}. Al examinar su vocabulario hebreo —específicamente ${root0}— queda claro que el mandato bíblico y rabínico apunta a una realidad objetiva y comprensible para toda conciencia honesta.${parallelism.explanation ? ` ${parallelism.explanation}` : ''}`,
        keyTakeaway: `El texto directo (${src0?.ref || primaryHebrew}) establece que ${essence} es un deber explícito, claro y exigible en la vida práctica.`,
        sourceMethodology: 'PARDES',
      },
      {
        key: 'remez',
        stepNumber: 2,
        hebrewBadge: 'ר',
        hebrewTerm: 'רֶמֶז',
        spanishSubtitle: '2. Rémez · Nivel de Alusión Ética y Filosófica',
        title: `Conexiones Semánticas e Intertextuales de ${essence}`,
        exposition: `En el plano de la alusión intertextual sobre ${essence}, el vínculo entre ${root0} y ${root1} revela una arquitectura moral precisa: ${dichotomy.explanation || `lo que comienza en el fuero interno o en el detalle aparentemente pequeño proyecta consecuencias directas sobre el orden ético completo`}. Esta sintonía se confirma al enlazar el texto base con ${cite1}.${techTerm.explanation ? ` Además, ${techTerm.explanation}` : ''}`,
        keyTakeaway: `La estructura gramatical de ${root2} alude a que cada matiz pequeño en ${essence} repercute sobre el conjunto espiritual.`,
        sourceMethodology: 'PARDES',
      },
      {
        key: 'drash',
        stepNumber: 3,
        hebrewBadge: 'ד',
        hebrewTerm: 'דְּרָשׁ',
        spanishSubtitle: '3. Drash · Nivel Homilético y Midráshico',
        title: `Enseñanza de Jazal en el Talmud y Midrash sobre ${essence}`,
        exposition: `Nuestros Sabios en el Talmud y la tradición ética clásica profundizan el alcance humano de ${essence} a través de ${cite2}. Frente a cualquier tentación de relegar el bien a una mera teoría o de descuidar la responsabilidad cuando no hay supervisión externa, Jazal recalcan que el carácter verdadero se forja en la coherencia diaria entre la palabra, la intención y el acto.`,
        keyTakeaway: `Para Jazal (${src2?.ref || 'Pirkei Avot 1:17'}), el estudio sobre ${essence} solo culmina cuando transforma la conducta concreta.`,
        sourceMethodology: 'PARDES',
      },
      {
        key: 'sod',
        stepNumber: 4,
        hebrewBadge: 'ס',
        hebrewTerm: 'סוֹד',
        spanishSubtitle: '4. Sod · Dimensión Profunda y Mística',
        title: `Resonancia Interior y Espiritual de ${essence}`,
        exposition: `En la dimensión interior de la Cábala y la Jasidut, ${kabbalah.explanation || `${essence} expresa la unión entre la voluntad humana y el flujo de santidad que sostiene la Creación`}, operando a través de ${kabbalah.sefiraConnection || 'la armonía entre Jésed (bondad), Guevurá (contención sagrada) y Maljut (expresión en el mundo)'}. A la luz de ${cite3}, cada vez que una persona honra ${essence} con autenticidad, convierte su existencia cotidiana en morada de luz divina (Dirá BeTajtonim).`,
        keyTakeaway: `En el plano interior, practicar ${essence} alinea el alma humana con la presencia divina dentro del mundo físico.`,
        sourceMethodology: 'PARDES',
      }
    );
  }

  const maxComps =
    input.duracion === '5_MIN' ? 0 : input.duracion === '30_MIN' ? 2 : 1;
  const compsToInclude = (input.complementaryMethodologies || [])
    .filter((cm) => cm && cm !== 'AUTO' && cm !== m)
    .slice(0, maxComps);

  compsToInclude.forEach((compMethod) => {
    const nextStep = methodologySections.length + 1;
    methodologySections.push(
      buildComplementaryTopicSection(
        compMethod,
        nextStep,
        essence,
        primaryHebrew,
        root0,
        src0,
        src1,
        keys
      )
    );
  });

  const s0 = methodologySections[0];
  const s1 = methodologySections[1] || s0;
  const s2 = methodologySections[2] || s1;
  const s3 = methodologySections[3] || s2;

  const pardes: TopicExegeticFallbackOutput['pardes'] = {
    pshat: {
      hebrewPillar: s0.hebrewTerm || 'פְּשָׁט',
      title: s0.title,
      exposition: s0.exposition,
      keyTakeaway: s0.keyTakeaway,
    },
    remez: {
      hebrewPillar: s1.hebrewTerm || 'רֶמֶז',
      title: s1.title,
      exposition: s1.exposition,
      keyTakeaway: s1.keyTakeaway,
    },
    drash: {
      hebrewPillar: s2.hebrewTerm || 'דְּרָשׁ',
      title: s2.title,
      exposition: s2.exposition,
      keyTakeaway: s2.keyTakeaway,
    },
    sod: {
      hebrewPillar: s3.hebrewTerm || 'סוֹד',
      title: s3.title,
      exposition: s3.exposition,
      keyTakeaway: s3.keyTakeaway,
    },
  };

  const rawRootsSummary =
    roots.length > 0
      ? `El examen de las raíces hebreas vinculadas a ${essence} (${roots
          .slice(0, 3)
          .map((r: any) => `${r.hebrewWord} [${r.root || 'שורש'}]`)
          .join(', ')}) revela cómo el lenguaje sagrado enlaza directamente el sentido interno de ${primaryHebrew} con la responsabilidad práctica cotidiana.`
      : `Las raíces hebreas asociadas a ${primaryHebrew} muestran la unidad entre la verdad conceptual de ${essence} y su expresión concreta en el obrar humano.`;

  const keyTheologicalInsight =
    dichotomy.watchmakerRefutation ||
    roots[0]?.theologicalImplication ||
    `La estructura lingüística de ${primaryHebrew} enseña que ${essence} conecta la conciencia interior con la realidad ética del mundo.`;

  const canonicalEchoes = sources.map((s) => ({
    ref: s.ref,
    connection:
      (s.spanishTranslation || s.translation || '').replace(/\s+/g, ' ').trim() ||
      `Fuente canónica directa que fundamenta ${essence}.`,
  }));

  const practicalConclusionTitle =
    input.resolvedTone === 'ADVERTENCIA_CAUTELA'
      ? `Vigilancia Ética y Cerco Protector en ${essence}`
      : input.resolvedTone === 'LLAMADO_ACCION'
      ? `Compromiso Concreto en Torno a ${essence}`
      : input.resolvedTone === 'MOTIVACION'
      ? `Aliento y Renovación Práctica en ${essence}`
      : input.resolvedTone === 'ASPIRACIONAL'
      ? `Horizonte de Elevación para ${essence}`
      : `Síntesis Normativa y Práctica sobre ${essence}`;

  const dailyAction =
    input.resolvedTone === 'ADVERTENCIA_CAUTELA'
      ? `Identifica hoy un momento concreto donde ${essence} suele descuidarse por prisa o falta de testigos y establece una regla preventiva clara (Seyag) antes de actuar o hablar.`
      : input.resolvedTone === 'LLAMADO_ACCION'
      ? `Traduce ${essence} hoy mismo en tres pasos verificables: 1) aplica un cuidado específico en tu habla o conducta; 2) repasa durante 5 minutos ${src0?.ref || 'la fuente central estudiada'}; 3) evalúa al final del día el avance alcanzado.`
      : input.resolvedTone === 'MOTIVACION'
      ? `Da hoy un paso pequeño pero firme en ${essence} sin esperar condiciones perfectas: cada elección consciente fortalece el carácter y renueva la alegría espiritual.`
      : `Integrar hoy ${essence} en una situación real de la vida familiar o comunitaria, cuidando tanto el detalle externo como la sinceridad del corazón.`;

  return {
    cleanEssence: essence,
    openingExordium: sanitizeQuotedQuestionInString(rawExordium, input.query, essence),
    methodologySections: methodologySections.map((sec) => ({
      ...sec,
      title: sanitizeQuotedQuestionInString(sec.title, input.query, essence),
      exposition: sanitizeQuotedQuestionInString(sec.exposition, input.query, essence),
      keyTakeaway: sanitizeQuotedQuestionInString(sec.keyTakeaway, input.query, essence),
    })),
    pardes,
    morphologicalSynthesis: {
      summary: sanitizeQuotedQuestionInString(rawRootsSummary, input.query, essence),
      keyTheologicalInsight: sanitizeQuotedQuestionInString(
        keyTheologicalInsight,
        input.query,
        essence
      ),
    },
    canonicalAnalysis: {
      synthesis: `Las fuentes primarias verificadas en Sefaria (${sources
        .slice(0, 4)
        .map((s) => s.ref)
        .join(', ') || 'Tanaj, Talmud y Midrash'}) sostienen paso a paso el desarrollo de ${essence}.`,
      verifiedEchoes: canonicalEchoes,
    },
    practicalConclusion: {
      title: sanitizeQuotedQuestionInString(practicalConclusionTitle, input.query, essence),
      hashkafa: `El estudio integral de ${essence} demuestra que la sabiduría de la Torá no separa la intimidad de la conciencia del compromiso histórico: cada convicción ética madura al encarnarse en actos concretos.`,
      prayerKavanah: `Al meditar en ${primaryHebrew} («${literalTrans}»), unir el entendimiento del texto con una intención sincera del corazón para vivir ${essence} con integridad constante.`,
      dailyAction: sanitizeQuotedQuestionInString(dailyAction, input.query, essence),
    },
  };
}

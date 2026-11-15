import { HalakhicDomainCategory, HalakhicPipelineValidation } from '../types';

interface HalakhicDomainPatternGroup {
  category: HalakhicDomainCategory;
  label: string;
  recommendedSources: string[];
  patterns: Array<{ termLabel: string; regex: RegExp }>;
}

const HALAKHIC_DOMAIN_GROUPS: HalakhicDomainPatternGroup[] = [
  {
    category: 'LEYES_REZOS_Y_LITURGIA',
    label: 'Leyes de Rezos y Liturgia (Tefilá, Berajot, Halel y Núsaj)',
    recommendedSources: [
      'Shulchan Arukh, Orach Chayim 1:1',
      'Shulchan Arukh, Orach Chayim 68:1',
      'Shulchan Arukh, Orach Chayim 422:2',
      'Pesachim 117a',
      'Berakhot 26b',
    ],
    patterns: [
      {
        termLabel: 'Halel / Jatsi Halel / Halel Shalem',
        regex:
          /(?<![a-záéíóúñ])(?:halel|hallel|jats[ií]\s+halel|halel\s+shalem|medio\s+halel|halel\s+completo|halel\s+ha[- ]?mitsr[ií]|halel\s+ha[- ]?gadol)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Tefilá / Leyes de Rezos / Plegaria',
        regex:
          /(?<![a-záéíóúñ])(?:tefil[aá]h?|tefilot|leyes?\s+de\s+rezos?|rezos?\s+jud[ií]os?|shajarit|minj[aá]h?|arvit|maariv|musaf|neil[aá]h?)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Amidá / Shemoné Esré / Bendiciones',
        regex:
          /(?<![a-záéíóúñ])(?:amid[aá]h?|shemon[eé]\s+esr[eé]|dieciocho\s+bendiciones|beraj[aá]h?|berajot|birkat\s+hamaz[oó]n|birkat\s+kohanim|ashrei|pesukei\s+de[- ]?zimr[aá]|tachan[uú]n|tajan[uú]n|selijot|kadish|kedush[aá]h?|modim|alenu|aleinu)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Shemá / Tefilín / Tzitzit / Talit / Minyán',
        regex:
          /(?<![a-záéíóúñ])(?:keriat\s+shem[aá]|tefil[ií]n|filacterias|tzitzit|tsitsit|talit|miny[aá]n|keriat\s+ha[- ]?tor[aá]|aliy[aá]h?\s+a\s+la\s+tor[aá]|sidur|siddur|majzor)(?![a-záéíóúñ])/i,
      },
    ],
  },
  {
    category: 'FESTIVIDADES_Y_SHABAT',
    label: 'Festividades, Shabat y Calendario Judío (Moadim, Rosh Jódesh y Shabat)',
    recommendedSources: [
      'Shulchan Arukh, Orach Chayim 422:2',
      'Shulchan Arukh, Orach Chayim 427:1',
      'Mishneh Torah, Sanctification of the New Moon 8:4',
      'Shulchan Arukh, Orach Chayim 242:1',
      'Shulchan Arukh, Orach Chayim 453:1',
      'Taanit 28b',
    ],
    patterns: [
      {
        termLabel: 'Shabat / Leyes de Shabat',
        regex:
          /(?<![a-záéíóúñ])(?:shabat|shabbat|kabbalat\s+shabat|kidush|kiddush|havdal[aá]h?|muktz[eé]|eruv|melaj[aá]h?|melajot|oneg\s+shabat|seuda\s+shlishit|melav[eé]\s+malk[aá])(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Pésaj / Sucot / Shavuot (Shalosh Regalim)',
        regex:
          /(?<![a-záéíóúñ])(?:p[eé]saj|pesach|seder\s+de\s+p[eé]saj|hagad[aá]h?|matz[aá]h?|jametz|chametz|bedikat\s+jametz|biur\s+jametz|sucot|sukkot|suc[aá]h?|lulav|etrog|arav[aá]h?|had[aá]s|arba[aá]\s+minim|hoshan[aá]\s+rab[aá]|shemin[ií]\s+atz[eé]ret|simjat\s+tor[aá]|shavuot|omer|sefirat\s+ha[- ]?omer|lag\s+ba[- ]?omer)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Rosh Hashaná / Yom Kipur / Yamim Noraim',
        regex:
          /(?<![a-záéíóúñ])(?:rosh\s+hashan[aá]h?|shofar|tkiah|teki[aá]h?|shevarim|teru[aá]h?|yom\s+kipur|yom\s+kippur|kol\s+nidrei|yamim\s+noraim|aseret\s+yemei\s+teshuv[aá])(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Rosh Jódesh (1 o 2 días · Mes Jaser 29 días vs. Malé 30 días) / Janucá / Purim',
        regex:
          /(?<![a-záéíóúñ])(?:januc[aá]h?|chanukah|hanukkah|janukiy[aá]h?|al\s+ha[- ]?nisim|purim|meguil[aá]h?\s+de\s+ester|mishl[oó]aj\s+manot|matanot\s+la[- ]?evyonim|rosh\s+j[oó]desh|rosh\s+chodesh|j[oó]desh\s+mal[eé]|j[oó]desh\s+jaser|mes\s+que\s+termina|kidush\s+ha[- ]?j[oó]desh|shabat\s+mevajarim|yaal[eé]\s+ve[- ]?yav[oó]|jol\s+ha[- ]?moed|yom\s+tov|tish[aá]\s+be[- ]?av|taanit|ayuno\s+de\s+(?:ester|guedali[aá]|tevet|tamuz)|festividades?\s+jud[ií]as?)(?![a-záéíóúñ])/i,
      },
    ],
  },
  {
    category: 'KASHRUT_Y_LEYES_ALIMENTARIAS',
    label: 'Kashrut y Leyes Alimentarias (Yoré Deá)',
    recommendedSources: [
      "Shulchan Arukh, Yoreh De'ah 87:1",
      "Shulchan Arukh, Yoreh De'ah 214:1",
      'Shulchan Arukh, Orach Chayim 453:1',
      'Chullin 103b',
    ],
    patterns: [
      {
        termLabel: 'Kashrut / Kosher / Kasher',
        regex:
          /(?<![a-záéíóúñ])(?:kashrut|kosher|kasher|casher|leyes?\s+alimentarias?|leyes?\s+diet[eé]ticas?)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Basar BeJalav / Shejitá / Kitniyot / Tevilat Kelim',
        regex:
          /(?<![a-záéíóúñ])(?:basar\s+be[- ]?jalav|carne\s+y\s+leche|l[aá]cteos?\s+y\s+c[aá]rnicos?|shejit[aá]h?|sh[oó]jet|bedik[aá]h?|treif|tar[eé]f|glatt|kitniyot|bishul\s+akum|pat\s+akum|stam\s+yeinam|tevilat\s+kelim|kashering|hag[- ]?al[aá]h?|lib[uú]n|hafrashat\s+jal[aá]h?|orl[aá]h?|terumot|maaserot|shmit[aá]h?)(?![a-záéíóúñ])/i,
      },
    ],
  },
  {
    category: 'CODIGOS_MINHAG_Y_SHULJAN_ARUJ',
    label: 'Códigos Halájicos, Shulján Aruj, Minhag y Núsaj (Mejaber y Ramá)',
    recommendedSources: [
      'Shulchan Arukh, Orach Chayim 1:1',
      "Shulchan Arukh, Yoreh De'ah 214:1",
      'Pesachim 50b',
      'Taanit 28b',
    ],
    patterns: [
      {
        termLabel: 'Halajá / Alajá / Cumplimiento Halájico',
        regex:
          /(?<![a-záéíóúñ])(?:halaj[aá]h?|alaj[aá]h?|hal[aá]jic[oa]s?|al[aá]jic[oa]s?|ley\s+jud[ií]a|leyes\s+jud[ií]as|cumplimiento\s+de\s+las?\s+mitzvot)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Shulján Aruj / Mejaber / Ramá / Mishná Berurá',
        regex:
          /(?<![a-záéíóúñ])(?:shulj[aá]n\s+aruj|shulchan\s+arukh|oraj\s+jaim|orach\s+chayim|yor[eé]\s+de[aá]|even\s+haezer|joshen\s+mishpat|mejaber|yosef\s+karo|ram[aá]|rem[aá]|mosh[eé]\s+isserles|hamap[aá]|mishn[aá]\s+berur[aá]|arba[aá]\s+turim|beit\s+yosef|mishn[eé]\s+tor[aá]|ben\s+ish\s+jai|kaf\s+ha[- ]?jaim|yalkut\s+yosef|shulj[aá]n\s+aruj\s+ha[- ]?rav|aruj\s+ha[- ]?shulj[aá]n|poskim|teshuv[aá]h?\s+hal[aá]jica|responsa)(?![a-záéíóúñ])/i,
      },
      {
        termLabel: 'Minhag / Núsaj / Rito Sefardí vs. Ashkenazí',
        regex:
          /(?<![a-záéíóúñ])(?:minhag|minhaguim|mi\s+jag|minjag|n[uú]saj|nusjaot|edot\s+ha[- ]?mizraj|rito\s+sefard[ií]|rito\s+ashkenaz[ií]|costumbre\s+sefard[ií]|costumbre\s+ashkenaz[ií]|de[- ]?oraita|de[- ]?raban[aá]n)(?![a-záéíóúñ])/i,
      },
    ],
  },
  {
    category: 'CICLO_DE_VIDA_Y_HALAJA_PRACTICA',
    label: 'Ciclo de Vida, Pureza Familiar y Halajá Práctica (Even HaEzer y Joshen Mishpat)',
    recommendedSources: [
      'Shulchan Arukh, Even HaEzer 61:1',
      "Shulchan Arukh, Yoreh De'ah 285:1",
      'Shulchan Arukh, Choshen Mishpat 359:1',
    ],
    patterns: [
      {
        termLabel: 'Ciclo de Vida / Mezuzá / Brit Milá / Matrimonio / Duelo',
        regex:
          /(?<![a-záéíóúñ])(?:brit\s+mil[aá]h?|pidi[oó]n\s+ha[- ]?b[eé]n|bar\s+mitzv[aá]h?|bat\s+mitzv[aá]h?|jup[aá]h?|kidush[ií]n|ketub[aá]h?|guet|yibum|jalitz[aá]h?|taharat\s+ha[- ]?mishpaj[aá]|nid[aá]h?|mikv[eé]h?|mezuz[aá]h?|avelut|aninut|shiv[aá]h?|shloshim|yahrzeit| shatnez|ribit|heter\s+isk[aá]|maaser\s+kesafim)(?![a-záéíóúñ])/i,
      },
    ],
  },
];

/**
 * Explicit external philosophers, classical Greco-Roman authors, or external religious traditions.
 * Only if the user explicitly names one of these in the query should external comparative citations be allowed.
 */
const EXPLICIT_EXTERNAL_PHILOSOPHER_OR_RELIGION_REGEX =
  /(?<![a-záéíóúñ])(?:kant|kantian[oa]s?|imperativo\s+categ[oó]rico|imperativo\s+de\s+hunt|grundlegung|plat[oó]n|plat[oó]nic[oa]s?|alegor[ií]a\s+de\s+la\s+caverna|mito\s+de\s+la\s+caverna|caverna\s+de\s+plat[oó]n|cicer[oó]n|de\s+officiis|de\s+re\s+publica|arist[oó]teles|aristot[eé]lic[oa]s?|[eé]tica\s+nicom[aá]quea|s[oó]crates|estoic(?:ismo|o|os|a)|epicteto|s[eé]neca|marco\s+aurelio|spinoza|descartes|nietzsche|hermann\s+cohen|rosenzweig|levinas|budismo|budista|buda|siddhartha|gautama|shakiamuni|bodhi|nirvana|dhammapada|anatta|samsara|valhalla|valhala|cielo\s+e\s+infierno|cristian(?:ismo|o|a|os|as)|jes[uú]s|cristo|mes[ií]as\s+del\s+cristianismo|jud[ií]os?\s+mesi[aá]nicos?|jews\s+for\s+jesus|evang[eé]licos?|filosof[ií]a\s+comparada|religiones\s+comparadas)(?![a-záéíóúñ])/i;

/**
 * Validates whether a query in the pipeline is of a purely Halakhic character
 * (e.g., prayer laws, holidays, Shabbat, Kashrut, Shulchan Arukh, Minhag/Nusach, lifecycle laws)
 * and automatically disables the injection of external philosophical or comparative citations.
 */
export function validatePurelyHalakhicQuery(rawQuery: string): HalakhicPipelineValidation {
  const clean = String(rawQuery || '').trim();

  if (!clean) {
    return {
      isPurelyHalakhic: false,
      externalPhilosophyInjectionDisabled: false,
      hasExplicitExternalPhilosopherOrReligion: false,
      halakhicDomains: [],
      halakhicDomainLabels: [],
      matchedHalakhicTerms: [],
      recommendedHalakhicSources: [],
      validatorSummary: '',
      systemPromptGuard: '',
    };
  }

  const hasExplicitExternalPhilosopherOrReligion =
    EXPLICIT_EXTERNAL_PHILOSOPHER_OR_RELIGION_REGEX.test(clean);

  const matchedDomains: HalakhicDomainCategory[] = [];
  const matchedDomainLabels: string[] = [];
  const matchedTerms: string[] = [];
  const recommendedSources: string[] = [];

  for (const group of HALAKHIC_DOMAIN_GROUPS) {
    let groupMatched = false;
    for (const p of group.patterns) {
      if (p.regex.test(clean)) {
        groupMatched = true;
        if (!matchedTerms.includes(p.termLabel)) {
          matchedTerms.push(p.termLabel);
        }
      }
    }
    if (groupMatched) {
      matchedDomains.push(group.category);
      matchedDomainLabels.push(group.label);
      for (const src of group.recommendedSources) {
        if (!recommendedSources.includes(src)) {
          recommendedSources.push(src);
        }
      }
    }
  }

  const isPurelyHalakhic =
    matchedDomains.length > 0 && !hasExplicitExternalPhilosopherOrReligion;
  const externalPhilosophyInjectionDisabled = isPurelyHalakhic;

  if (!isPurelyHalakhic) {
    return {
      isPurelyHalakhic: false,
      externalPhilosophyInjectionDisabled: false,
      hasExplicitExternalPhilosopherOrReligion,
      halakhicDomains: matchedDomains,
      halakhicDomainLabels: matchedDomainLabels,
      matchedHalakhicTerms: matchedTerms,
      recommendedHalakhicSources: recommendedSources.slice(0, 6),
      validatorSummary: '',
      systemPromptGuard: '',
    };
  }

  const validatorSummary = `Validador Halájico del Pipeline Activo: Consulta identificada como de carácter puramente halájico (${matchedDomainLabels.join(' · ')}). Se ha desactivado automáticamente toda inyección de citas filosóficas externas o comparativas (Kant, Platón, Cicerón, Aristóteles, Estoicismo, etc.), restringiendo el análisis al canon judío (Tanaj, Mishná, Talmud, Rambam, Shulján Aruj, Mejaber, Ramá, Minhag y Núsaj).`;

  const systemPromptGuard = `\n\n[VALIDADOR HALÁJICO DEL PIPELINE ACTIVO — INYECCIÓN DE CITAS FILOSÓFICAS EXTERNAS DESACTIVADA]:
- El validador del pipeline determinó que esta consulta es de carácter PURAMENTE HALÁJICO / LITÚRGICO INTERNO (${matchedDomainLabels.join('; ')} — Términos detectados: ${matchedTerms.join(', ')}).
- QUEDA ESTRICTAMENTE DESACTIVADA Y PROHIBIDA la inyección de citas filosóficas externas o de religiones comparadas: NO menciones ni cites a Immanuel Kant, el Imperativo Categórico, Platón, la Alegoría de la Caverna, Cicerón, Aristóteles, Sócrates, el Estoicismo, Spinoza, Nietzsche, el Budismo, el Nirvana ni el Valhalla.
- Fundamenta el estudio al 100% en las fuentes internas del judaísmo: Torá, Talmud Bavli y Yerushalmi, Mishné Torá de Maimónides, el Shulján Aruj (Rabí Yosef Karo / Mejaber y las glosas del Ramá), Mishná Berurá, Ben Ish Jai y las diferencias internas de Minhag y Núsaj.
- REGLA HALÁJICA Y CALENDÁRICA OBLIGATORIA SOBRE ROSH JÓDESH Y EL HALEL: Siempre que el tema involucre Rosh Jódesh o el Halel, DEBES explicar explícitamente por qué **Rosh Jódesh puede ser de 1 o de 2 días dependiendo de cuántos días tiene el mes que termina** (ciclo lunar de ~29 días y medio en *Talmud Rosh Hashaná 19b*, *Arjín 8b–9b*, *Rambam Hiljot Kidush HaJódesh 8:4–5* y *Shulján Aruj, Oraj Jaim 422 y 427:1*): (1) Si el mes que termina es **Jódesh Jaser (חֹדֶשׁ חָסֵר, mes deficiente de 29 días)**, Rosh Jódesh dura **1 solo día** (el día 1 del mes nuevo); (2) Si el mes que termina es **Jódesh Malé (חֹדֶשׁ מָלֵא, mes pleno de 30 días)**, Rosh Jódesh dura **2 días**: el **primer día de Rosh Jódesh es el día 30 del mes que termina (mes saliente)** y el **segundo día de Rosh Jódesh es el día 1 del nuevo mes entrante** (a partir del cual se cuentan los días del nuevo mes), recitándose en **ambos días** el Medio Halel (*Jatsi Halel*), *Yaalé VeYavó*, lectura de la Torá y *Musaf*.`;

  return {
    isPurelyHalakhic: true,
    externalPhilosophyInjectionDisabled: true,
    hasExplicitExternalPhilosopherOrReligion: false,
    halakhicDomains: matchedDomains,
    halakhicDomainLabels: matchedDomainLabels,
    matchedHalakhicTerms: matchedTerms,
    recommendedHalakhicSources: recommendedSources.slice(0, 6),
    validatorSummary,
    systemPromptGuard,
  };
}

/**
 * Post-generation sanitizer that guarantees any purely Halakhic payload is stripped of
 * external philosophical sources (`externalSources`), formal philosophical contrast (`formalContrast`),
 * and external thinker detections (`externalThinkerDetection`), while attaching `halakhicValidation`.
 */
export function sanitizeHalakhicOutputFromExternalCitations<T extends Record<string, any>>(
  payload: T,
  validation: HalakhicPipelineValidation
): T {
  if (!payload || typeof payload !== 'object') return payload;

  const clone: Record<string, any> = {
    ...payload,
    halakhicValidation: validation,
  };

  if (validation.externalPhilosophyInjectionDisabled) {
    delete clone.externalSources;
    delete clone.formalContrast;
    delete clone.externalThinkerDetection;
  }

  return clone as T;
}

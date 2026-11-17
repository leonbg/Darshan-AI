import React, { useState, useMemo, useEffect } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  Compass,
  SlidersHorizontal,
  ScrollText,
  Calendar,
  GitBranch,
  Share2,
  ShieldCheck,
  Search,
  Download,
  Keyboard,
} from 'lucide-react';

export type ManualSectionId =
  | 'inicio'
  | 'metodologias'
  | 'lectura_halaja'
  | 'modalidades'
  | 'archivo_drive'
  | 'exportacion'
  | 'ajustes_atajos';

interface ManualSection {
  id: ManualSectionId;
  tabLabel: string;
  title: string;
  subtitle: string;
  searchKeywords: string;
  blocks: Array<{
    heading: string;
    items: Array<{ label: string; detail: string }>;
  }>;
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'inicio',
    tabLabel: '1. Inicio y Mesa',
    title: 'Primeros Pasos en la Mesa de Estudio',
    subtitle: 'Anatomía de la interfaz, barra superior y envío de consultas',
    searchKeywords:
      'inicio mesa estudio limpiar historial barra superior consulta rtl hebreo ctrl enter',
    blocks: [
      {
        heading: 'Acceso al Manual y Barra Superior',
        items: [
          {
            label: 'Botones del Manual de Usuario',
            detail:
              'Abre este manual en cualquier momento desde el botón destacado «Manual / Manual de Usuario» en la barra superior, junto a RTL en la Mesa Principal de Estudio, desde el pie de página, en Ajustes → Mantenimiento o pulsando ? / F1.',
          },
          {
            label: 'Guía de Metodologías (Barra Superior)',
            detail:
              'Junto a Manual encontrarás el botón «Metodologías» con la explicación detallada de PARDÉS y las otras 6 metodologías, además del flujo de verificación en 3 fases.',
          },
          {
            label: 'Navegación de Espacios',
            detail:
              'Alterna en un clic entre Mesa de Estudio, Parashá y Festividades, Archivo y Comparador, y Musar Diario.',
          },
          {
            label: 'Limpiar (1 toque) y Volver al Inicio (2 toques)',
            detail:
              'Un toque limpia el texto de consulta y enfoca el cursor; dos toques seguidos en menos de 2 segundos restablecen toda la pantalla al estado inicial.',
          },
          {
            label: 'Historial Rápido',
            detail:
              'Consulta, busca por número (#1, #2…) o elimina derashot anteriores directamente desde el botón Historial.',
          },
        ],
      },
      {
        heading: 'Redacción y Flujo en 3 Fases',
        items: [
          {
            label: 'Escritura Español / Hebreo (LTR / RTL)',
            detail:
              'Usa el interruptor LTR · Español / RTL · עברית en la esquina del recuadro para redactar citas hebreas alineadas a la derecha.',
          },
          {
            label: 'Flujo Antialucinación (Fases 1 → 2 → 3)',
            detail:
              'Fase 1 analiza raíces hebreas y referencias; Fase 2 descarga textos reales desde Sefaria; Fase 3 redacta la derashá exclusivamente sobre fuentes verificadas.',
          },
          {
            label: 'Acotar Consultas Amplias',
            detail:
              'Si la pregunta es muy abierta, pulsa «Acotar» o elige una de las sugerencias propuestas para obtener citas canónicas precisas en menor tiempo.',
          },
        ],
      },
    ],
  },
  {
    id: 'metodologias',
    tabLabel: '2. Metodologías',
    title: '7 Puertas Lógicas, Duración y Tono',
    subtitle: 'Abanico de decisión metodológica con pre-carga en segundo plano',
    searchKeywords:
      'pardes wissenschaft evolucion concepto mesilat yesharim pirke avot musar filosofia contrastiva duracion tono prewarm profundidad prioridad conclusion final',
    blocks: [
      {
        heading: 'Abanico de Decisión (Reloj Aislado)',
        items: [
          {
            label: 'Recomendación IA y Pre-calentamiento',
            detail:
              'Mientras eliges método en el abanico, el sistema pre-carga raíces y fuentes de Sefaria en 2º plano («Fuentes listas · Fase 3 directa») sin descontar segundos al presupuesto de generación.',
          },
          {
            label: '8 Opciones de Enfoque',
            detail:
              'Automático (AUTO), PARDÉS Clásico, Wissenschaft des Judentums, Evolución del Concepto (Torá · Cábala · Musar · Jasidut), Mesilat Yesharim Sistemático, Pirké Avot Exegético, Musar Transformativo y Diálogo Filosófico Contrastivo.',
          },
          {
            label: 'Personalización PARDÉS y Conclusión Final',
            detail:
              'Desde el abanico («PARDÉS y Conclusión»), Ajustes o debajo de una Drashá generada puedes fijar la profundidad (Breve · Estándar · Profundo) de Pshat, Rémez, Drash y Sod por separado, marcar niveles prioritarios y elegir la extensión de la conclusión final (Concisa · Estándar · Detallada).',
          },
        ],
      },
      {
        heading: 'Duración, Aportes y Tono Homilético',
        items: [
          {
            label: '5 min · 10 min · 30 min',
            detail:
              '5 min (500–700 palabras) aplica solo la metodología principal; 10 min (1.000–1.400 palabras) suma hasta 1 metodología complementaria y 30 min (1.900–2.600 palabras) entrelaza hasta 2 aportes (reajustable incluso después de generar).',
          },
          {
            label: 'Audiencia y Tono de la Drashá',
            detail:
              'Elige audiencia (Comunidad general, Bet Midrash, Jóvenes y familias o Introspección personal) y tono (Automático, Motivación y Aliento, Advertencia y Cautela, Llamado a la Acción, Aspiracional o Analítico / Sobrio).',
          },
        ],
      },
    ],
  },
  {
    id: 'lectura_halaja',
    tabLabel: '3. Lectura y Halajá',
    title: 'Vistas, Modo Atril y Módulo Halájico (Mishnat HaDorot)',
    subtitle: 'Lectura en púlpito, dictámenes por generaciones y ampliación',
    searchKeywords:
      'drasha completa resumen fichas atril bima halaja shuljan aruj mishnat hadorot jazal rishonim ajaronim poskim sefaria traduccion',
    blocks: [
      {
        heading: 'Vistas y Lectura en Atril / Bimá',
        items: [
          {
            label: '3 Vistas Integradas',
            detail:
              'Cambia al instante entre Drashá Completa (discurso continuo), Resumen (tesis y pilares ejecutivos) y Fichas por Sección (tarjetas individuales + conclusión práctica).',
          },
          {
            label: 'Letra Atril (A+ / A++) y Fuentes',
            detail:
              'Escala el tamaño tipográfico para estudiar o leer desde la Bimá y alterna entre Frank Ruhl Libre (Serif), Heebo (Sans) o David Libre / Cardo (Hebreo Tradicional).',
          },
        ],
      },
      {
        heading: 'Módulo Halájico y Mishnat HaDorot',
        items: [
          {
            label: 'Shulján Aruj + Mishnat HaDorot',
            detail:
              'En consultas normativas se muestran citas del Shulján Aruj (Mejaber y Ramá) junto con «Mishnat HaDorot · Dictamen por Generaciones» consultado en vivo en Sefaria.',
          },
          {
            label: '5 Estratos Históricos',
            detail:
              'Filtra cronológicamente por Jazal, Rishonim, Nosei Keilim / Ajaronim Tempranos (Beit Yosef, Ramá, Taz, Shaj, Maguén Avraham, Grá), Ajaronim Clásicos (Mishná Berurá, Aruj HaShulján, Kaf HaJaim, Ben Ish Jai) y Poskim Contemporáneos, o por Simán:Seif.',
          },
          {
            label: 'Desglose Profundo y Diálogo de Ampliación',
            detail:
              'Al final de la lección puedes conversar para profundizar puntos específicos, traducir fuentes de Sefaria al español y consultar a Maestros Contemporáneos (R. Sacks, R. Gordon, R. Soloveitchik, R. Hirsch).',
          },
        ],
      },
    ],
  },
  {
    id: 'modalidades',
    tabLabel: '4. Parashá y Musar',
    title: 'Parashá, Festividades y Musar Diario',
    subtitle: 'Calendario hebreo en vivo y microlecciones de Mesilat Yesharim',
    searchKeywords:
      'parasha semana aliyot haftara festividades calendario hebreo diaspora israel musar diario shots mesilat yesharim preguntas clasicas',
    blocks: [
      {
        heading: 'Calendario Litúrgico y Parashat HaShavúa',
        items: [
          {
            label: 'Lectura Vigente (Diáspora / Israel)',
            detail:
              'Visualiza la Parashá de la semana, sus 7 aliyot, la Haftará y el Daf Yomi. Haz clic en cualquiera para generar un estudio enfocado automáticamente.',
          },
          {
            label: 'Festividades Judías',
            detail:
              'Consulta próximos eventos del calendario hebreo o explora la biblioteca permanente de festividades (Shabat, Pésaj, Shavuot, Rosh Hashaná, Yom Kipur, Sucot, Janucá, Purim).',
          },
        ],
      },
      {
        heading: 'Musar Diario y Preguntas Clásicas',
        items: [
          {
            label: 'Shots de Mesilat Yesharim',
            detail:
              'Recorre los 10 peldaños del Ramjal con párrafos auténticos de Sefaria convertidos en definición, obstáculo común, acción práctica del día y síntesis.',
          },
          {
            label: 'Preguntas Clásicas',
            detail:
              'Carga ejemplos curados directamente en el recuadro principal para probar distintas metodologías y comparaciones.',
          },
        ],
      },
    ],
  },
  {
    id: 'archivo_drive',
    tabLabel: '5. Archivo y Drive',
    title: 'Archivo Numerado, Comparador y Google Drive',
    subtitle: 'Historial #1–#9+, diálogo dialéctico y almacenamiento en tu nube',
    searchKeywords:
      'archivo numerado comparador dialectico pantalla dividida lenguaje natural google drive firestore guardar sincronizar',
    blocks: [
      {
        heading: 'Archivo y Comparador Dialéctico',
        items: [
          {
            label: 'Numeración Automática (#1–#9+)',
            detail:
              'Cada estudio finalizado se indexa automáticamente en tu archivo para reabrirlo con sus fuentes, notas de Mishnat HaDorot y diálogos previos.',
          },
          {
            label: 'Comparación en Pantalla Dividida o Lenguaje Natural',
            detail:
              'Marca 2 o más derashot en el Archivo (o escribe en el recuadro principal «Compara la Derashá #1 con la #3») para analizar Relación, Contradicción (Majloket) o Complemento.',
          },
        ],
      },
      {
        heading: 'Persistencia en Google Drive (0 KB locales)',
        items: [
          {
            label: 'Carpeta Privada en tu Drive',
            detail:
              'Al conectar tu cuenta de Google, tus derashot se guardan en «Darshán AI · Mis Derashot» en tu propio Google Drive sin ocupar espacio en el navegador.',
          },
          {
            label: 'Confirmación Explícita',
            detail:
              'Toda actualización o borrado en Google Drive muestra un diálogo de confirmación previo para evitar pérdidas accidentales.',
          },
        ],
      },
    ],
  },
  {
    id: 'exportacion',
    tabLabel: '6. Exportación',
    title: 'Exportación Multi-Formato y Edición',
    subtitle: 'PDF, Word (.doc), Formato Abierto (.rtf), Markdown (.md) y Web (.html)',
    searchKeywords:
      'exportar compartir pdf vectorial word doc rtf markdown md html editable dedicatoria titulo copiar',
    blocks: [
      {
        heading: 'Formatos Disponibles',
        items: [
          {
            label: 'PDF (.pdf) y PDF Vectorial',
            detail:
              'Genera un PDF descargable/compartible o abre la vista vectorial lista para imprimir con tipografía editorial, textos hebreos RTL, raíces y dictámenes halájicos.',
          },
          {
            label: 'Formatos Editables (.doc · .rtf · .md · .html)',
            detail:
              'Guarda en Word editable (.doc), Rich Text universal (.rtf) para LibreOffice/Pages, Markdown abierto (.md) para Obsidian/Notion o HTML editable directo.',
          },
        ],
      },
      {
        heading: 'Alcance y Personalización',
        items: [
          {
            label: 'Estudio Completo vs. Tarjetas',
            detail:
              'Elige exportar toda la derashá con desgloses y fuentes, o únicamente las tarjetas estructurales (Pardés / Metodología).',
          },
          {
            label: 'Título y Dedicatoria Personalizada',
            detail:
              'Usa «Personalizar título o añadir nota antes de exportar» para adaptar el encabezado o incluir una dedicatoria para tu comunidad o shiur.',
          },
        ],
      },
    ],
  },
  {
    id: 'ajustes_atajos',
    tabLabel: '7. Ajustes y Atajos',
    title: 'Puntos Seguros, PWA / APK y Atajos de Teclado',
    subtitle: 'Respaldos JSON, reparación de integridad e instalación móvil',
    searchKeywords:
      'ajustes puntos seguros respaldo json reparar integridad instalar pwa android apk ios safari atajos teclado',
    blocks: [
      {
        heading: 'Respaldos y Mantenimiento (Ajustes)',
        items: [
          {
            label: 'Puntos Seguros (.json)',
            detail:
              'Crea instantáneas manuales antes de preparar una clase importante, exporta/importa archivos .json o restaura la Versión Dorada Base en un clic.',
          },
          {
            label: 'Verificar y Reparar Integridad',
            detail:
              'Audita la numeración del archivo, limpia índices inconsistentes y sincroniza el estado con el servidor.',
          },
          {
            label: 'Instalación App (PWA / Android / iOS)',
            detail:
              'Instala Darshán AI como aplicación independiente en escritorio, Chrome Android o Safari iOS («Agregar a pantalla de inicio»).',
          },
        ],
      },
      {
        heading: 'Atajos de Teclado',
        items: [
          {
            label: 'Ctrl + Enter / Cmd + Enter',
            detail: 'Envía la consulta activa desde el recuadro de estudio.',
          },
          {
            label: '? o F1 (fuera de campos de texto)',
            detail: 'Abre este Manual de Usuario interactivo.',
          },
          {
            label: 'Escape',
            detail: 'Cierra el modal o diálogo activo en pantalla.',
          },
        ],
      },
    ],
  },
];

function buildUserManualDownloadText(): string {
  const lines: string[] = [
    '# Manual de Usuario · Darshán AI',
    '',
    'Asistente Rabínico y Pedagógico de Derashot (PARDÉS · Sefaria · Halajá)',
    '',
  ];
  for (const sec of MANUAL_SECTIONS) {
    lines.push(`## ${sec.title}`);
    lines.push(`*${sec.subtitle}*`, '');
    for (const block of sec.blocks) {
      lines.push(`### ${block.heading}`);
      for (const item of block.items) {
        lines.push(`- **${item.label}**: ${item.detail}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAboutModal?: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
  onOpenAboutModal,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<ManualSectionId>('inicio');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const filteredSections = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return MANUAL_SECTIONS;
    return MANUAL_SECTIONS.filter((sec) => {
      const haystack = `${sec.title} ${sec.subtitle} ${sec.searchKeywords} ${sec.blocks
        .map((b) => `${b.heading} ${b.items.map((i) => `${i.label} ${i.detail}`).join(' ')}`)
        .join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [searchTerm]);

  const activeSection = useMemo(() => {
    if (searchTerm.trim() && filteredSections.length > 0) {
      return (
        filteredSections.find((s) => s.id === activeSectionId) || filteredSections[0]
      );
    }
    return MANUAL_SECTIONS.find((s) => s.id === activeSectionId) || MANUAL_SECTIONS[0];
  }, [activeSectionId, filteredSections, searchTerm]);

  if (!isOpen) return null;

  const getSectionIcon = (id: ManualSectionId) => {
    switch (id) {
      case 'inicio':
        return <Compass className="w-3.5 h-3.5 shrink-0" />;
      case 'metodologias':
        return <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />;
      case 'lectura_halaja':
        return <ScrollText className="w-3.5 h-3.5 shrink-0" />;
      case 'modalidades':
        return <Calendar className="w-3.5 h-3.5 shrink-0" />;
      case 'archivo_drive':
        return <GitBranch className="w-3.5 h-3.5 shrink-0" />;
      case 'exportacion':
        return <Share2 className="w-3.5 h-3.5 shrink-0" />;
      case 'ajustes_atajos':
        return <ShieldCheck className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  const handleDownloadManual = () => {
    const md = buildUserManualDownloadText();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MANUAL_USUARIO_DARSHAN_AI.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-manual-title"
    >
      <div className="bg-[#0d1526] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-800 bg-[#090f1d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="user-manual-title" className="text-base sm:text-lg font-bold text-white">
                Manual de Usuario · Darshán AI
              </h2>
              <p className="text-xs text-slate-400">
                Guía práctica de flujos, metodologías PARDÉS, Módulo Halájico y exportación
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en el manual..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#060a14] border border-slate-700/80 focus:border-sky-400 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 transition cursor-pointer"
              aria-label="Cerrar manual de usuario"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chapter Tabs */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#0a1120] border-b border-slate-800/90 flex items-center gap-1.5 overflow-x-auto">
          {(searchTerm.trim() ? filteredSections : MANUAL_SECTIONS).map((sec) => {
            const isActive = activeSection.id === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionId(sec.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-sky-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {getSectionIcon(sec.id)}
                <span>{sec.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {filteredSections.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-slate-300 font-medium">
                No se encontraron apartados que coincidan con «{searchTerm}».
              </p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 font-semibold cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-800/80">
                <h3 className="font-editorial text-xl font-bold text-white">
                  {activeSection.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {activeSection.subtitle}
                </p>
              </div>

              <div className="space-y-5">
                {activeSection.blocks.map((block) => (
                  <div
                    key={block.heading}
                    className="p-4 rounded-xl bg-[#090f1d] border border-slate-800 space-y-3"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                      {block.heading}
                    </h4>
                    <dl className="divide-y divide-slate-800/70">
                      {block.items.map((item) => (
                        <div
                          key={item.label}
                          className="py-2.5 first:pt-0 last:pb-0 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-4"
                        >
                          <dt className="sm:col-span-4 text-xs font-semibold text-white">
                            {item.label}
                          </dt>
                          <dd className="sm:col-span-8 text-xs text-slate-300 leading-relaxed">
                            {item.detail}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-[#090f1d] text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Keyboard className="w-3.5 h-3.5 text-sky-400" />
              <span>Atajo: ? o F1 · Cerrar: Esc</span>
            </span>
            {onOpenAboutModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAboutModal();
                }}
                className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200 font-medium cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Ver Guía de Metodologías</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadManual}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Descargar Manual (.md)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold transition cursor-pointer whitespace-nowrap"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

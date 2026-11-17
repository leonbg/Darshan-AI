# Darshán AI — Asistente Rabínico y Pedagógico de *Derashot*

Aplicación web progresiva (PWA) y empaquetable para Android enfocada en la investigación, verificación textual canónica y redacción de clases y *Derashot* judías sobre fuentes verificadas de **Sefaria**.

---

## Documentación del Proyecto

- **Para usuarios y docentes:** [`MANUAL_USUARIO.md`](./MANUAL_USUARIO.md) — Guía paso a paso de la Mesa de Estudio, metodologías, módulo halájico (*Shulján Aruj* + *Mishnat HaDorot*), Archivo/Comparador, Google Drive y atajos de teclado (también accesible dentro de la app desde el botón **Ayuda** o pulsando `?` / `F1`).
- **Para desarrolladores y colaboradores:** [`MANUAL_PROGRAMADORES.md`](./MANUAL_PROGRAMADORES.md) — Documentación técnica completa con diagramas **Mermaid** de arquitectura, flujo del pipeline antialucinación de 3 fases, las 7 Puertas Lógicas Hermenéuticas, secuencia de *Mishnat HaDorot*, máquina de estados de interfaz, diagrama ER de modelos de datos, contratos de los 18 endpoints `/api/*`, reglas de Firestore y despliegue PWA/Capacitor.

---

## Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo (Express + Vite en http://localhost:3000)
npm run dev

# 3. Verificar tipos y compilación de producción
npm run lint
npm run build
npm start
```

## Stack Principal

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite, `lucide-react`
- **Backend:** Node.js, Express (`server.ts` + módulos en `server/`)
- **IA y Fuentes:** `@google/genai` (`gemini-decision-1`, `gemini-4-hydrogen`), Sefaria API (`v3/texts`, `api/links`) y Hebcal
- **Persistencia:** LocalStorage + `.derashot-archive.json` / `.system-safepoints.json` + Firebase Auth/Firestore + Google Drive API v3 (`drive.file`)

import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerSefariaProxyRoute } from './server/sefariaService.ts';
import { registerTorahCalendarRoute } from './server/torahCalendar.ts';
import {
  registerMesilatShotRoute,
  registerArchiveAndSafePointRoutes,
} from './server/mesilatAndStorageRoutes.ts';
import { registerDecisionsRoute } from './server/decisionsRouter.ts';
import { registerAnalyzeRootsRoute } from './server/analyzeRootsRoute.ts';
import { registerDerashaRoutes } from './server/derashaRoutes.ts';
import { registerCompanionRoutes } from './server/companionRoutes.ts';
import { registerMishnatHaDorotRoute } from './server/mishnatHaDorotRoute.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataRoot = fs.existsSync(path.resolve(__dirname, '.derashot-archive.json'))
  ? __dirname
  : process.cwd();

const app = express();
const cliPortIdx = process.argv.indexOf('--port');
const cliPort =
  cliPortIdx !== -1 && process.argv[cliPortIdx + 1]
    ? parseInt(process.argv[cliPortIdx + 1], 10)
    : NaN;
const PORT = Number.isFinite(cliPort)
  ? cliPort
  : process.env.NODE_ENV === 'production' && process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;

app.use(express.json({ limit: '25mb' }));

// Allow cross-origin requests from web and mobile clients
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Registered Modular API Routes
registerDecisionsRoute(app);
registerAnalyzeRootsRoute(app);
registerDerashaRoutes(app);
registerCompanionRoutes(app);
registerTorahCalendarRoute(app);
registerSefariaProxyRoute(app);
registerMishnatHaDorotRoute(app);
registerMesilatShotRoute(app);
registerArchiveAndSafePointRoutes(app, dataRoot);

// Guard so any unmatched /api/* route returns JSON instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.originalUrl}` });
});

// Web Publication SEO Routes: robots.txt and sitemap.xml
app.get('/robots.txt', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res
    .type('text/plain')
    .send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const lastmod = new Date().toISOString().split('T')[0];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n` +
      `    <loc>${origin}/</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>daily</changefreq>\n` +
      `    <priority>1.0</priority>\n` +
      `  </url>\n` +
      `</urlset>`
  );
});

// Express-wide error fallback middleware so no route exception crashes the server
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  if (
    err?.type === 'entity.parse.failed' ||
    (err instanceof SyntaxError && Number((err as any).status) === 400 && 'body' in err)
  ) {
    return res.status(400).json({ error: 'Cuerpo JSON malformado en la solicitud.' });
  }
  if (err?.type === 'entity.too.large' || Number(err?.status) === 413) {
    return res
      .status(413)
      .json({ error: 'El cuerpo de la solicitud excede el tamaño máximo permitido.' });
  }
  console.warn('[Darshán AI · SafePoint Server Guard] Error interceptado:', err?.message || err);
  return res.status(500).json({
    error:
      'Se activó la protección del servidor ante un error inesperado. Tu Punto Seguro está disponible para restauración inmediata.',
    safePointAvailable: true,
  });
});

process.on('uncaughtException', (err) => {
  console.warn('[Darshán AI · SafePoint Process Guard] uncaughtException interceptada:', err?.message);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn(
    '[Darshán AI · SafePoint Process Guard] unhandledRejection interceptada:',
    reason?.message || reason
  );
});

function listenWithRetry(
  appInstance: express.Express,
  port: number,
  onListening: () => void,
  onCloseCleanup?: () => Promise<void> | void
) {
  const maxRetries = 20;
  const retryDelayMs = 350;
  let attempts = 0;
  let activeServer: http.Server | null = null;

  const tryListen = () => {
    attempts += 1;
    const srv = http.createServer(appInstance);
    srv.requestTimeout = 180000;
    srv.headersTimeout = 185000;
    activeServer = srv;

    srv.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempts <= maxRetries) {
        console.warn(
          `[Darshán AI] Puerto ${port} ocupado en reinicio (intento ${attempts}/${maxRetries}); reintentando en ${retryDelayMs}ms...`
        );
        try {
          srv.close();
        } catch {
          // ignore
        }
        setTimeout(tryListen, retryDelayMs);
        return;
      }
      console.error(
        `[Darshán AI] Error fatal al iniciar servidor en puerto ${port}:`,
        err?.message || err
      );
      process.exit(1);
    });

    srv.once('listening', () => {
      onListening();
    });

    srv.listen(port, '0.0.0.0');
  };

  const gracefulShutdown = () => {
    const forceTimer = setTimeout(() => process.exit(0), 1200);
    forceTimer.unref();
    Promise.resolve(onCloseCleanup?.())
      .catch(() => {})
      .finally(() => {
        if (activeServer) {
          activeServer.close(() => process.exit(0));
        } else {
          process.exit(0);
        }
      });
  };

  process.once('SIGTERM', gracefulShutdown);
  process.once('SIGINT', gracefulShutdown);

  tryListen();
}

// Vite dev middleware or static file serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    let viteInstance: any = null;
    let vitePromise: Promise<any> | null = null;

    const ensureViteLoaded = () => {
      if (!vitePromise) {
        vitePromise = import('vite')
          .then(({ createServer }) =>
            createServer({
              server: {
                middlewareMode: true,
                hmr: false,
                ws: false as const,
                watch: null,
              },
              appType: 'spa',
            })
          )
          .then((vite) => {
            viteInstance = vite;
            return vite;
          })
          .catch((err) => {
            vitePromise = null;
            throw err;
          });
      }
      return vitePromise;
    };

    app.use(async (req, res, next) => {
      try {
        const vite = viteInstance || (await ensureViteLoaded());
        return vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });

    listenWithRetry(
      app,
      PORT,
      () => {
        console.log(`[Darshán AI] Servidor iniciado en http://0.0.0.0:${PORT}`);
        ensureViteLoaded().catch((err) => {
          console.warn('[Darshán AI] Aviso al inicializar Vite middleware:', err?.message);
        });
      },
      async () => {
        if (viteInstance?.close) {
          await viteInstance.close();
        }
      }
    );
  } else {
    const distDir = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '7d',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      const indexHtmlPath = path.resolve(distDir, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(404).send('Aplicación no compilada (index.html no encontrado).');
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexHtmlPath);
    });

    listenWithRetry(app, PORT, () => {
      console.log(`[Darshán AI] Servidor iniciado en http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

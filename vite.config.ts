import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function vayuDevApiPlugin(mode: string): Plugin {
  return {
    name: 'vayu-dev-api',
    configureServer(server) {
      // Load environment variables from .env.local and other env files with empty prefix
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, val] of Object.entries(env)) {
        if (process.env[key] === undefined || key.startsWith('OPENAQ_') || key.startsWith('GEMINI_')) {
          process.env[key] = val;
        }
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        // 1. /api/aqi endpoint
        if (req.url.startsWith('/api/aqi')) {
          try {
            const currentEnv = loadEnv(server.config.mode || mode, process.cwd(), '');
            if (currentEnv.OPENAQ_API_KEY !== undefined) {
              process.env.OPENAQ_API_KEY = currentEnv.OPENAQ_API_KEY;
            }

            const { default: handler } = await server.ssrLoadModule('/api/aqi.ts');
            const parsedUrl = new URL(req.url, 'http://localhost');
            const query: Record<string, string> = {};
            parsedUrl.searchParams.forEach((v, k) => {
              query[k] = v;
            });

            const vReq = Object.assign(req, { query });
            const vRes = Object.assign(res, {
              status(code: number) {
                res.statusCode = code;
                return vRes;
              },
              json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return vRes;
              },
            });

            await handler(vReq, vRes);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }

        // 2. /api/plan endpoint
        if (req.url.startsWith('/api/plan')) {
          try {
            const currentEnv = loadEnv(server.config.mode || mode, process.cwd(), '');
            if (currentEnv.GEMINI_API_KEY !== undefined) {
              process.env.GEMINI_API_KEY = currentEnv.GEMINI_API_KEY;
            }
            if (currentEnv.GEMINI_MODEL !== undefined) {
              process.env.GEMINI_MODEL = currentEnv.GEMINI_MODEL;
            }

            // Read POST body stream
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            let body: any = {};
            try {
              if (rawBody.trim()) body = JSON.parse(rawBody);
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Malformed JSON body' }));
              return;
            }

            const { default: handler } = await server.ssrLoadModule('/api/plan.ts');
            const parsedUrl = new URL(req.url, 'http://localhost');
            const query: Record<string, string> = {};
            parsedUrl.searchParams.forEach((v, k) => {
              query[k] = v;
            });

            const vReq = Object.assign(req, { query, body });
            const vRes = Object.assign(res, {
              status(code: number) {
                res.statusCode = code;
                return vRes;
              },
              json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return vRes;
              },
            });

            await handler(vReq, vRes);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Populate process.env at config evaluation time as well
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, val] of Object.entries(env)) {
    if (process.env[key] === undefined || key.startsWith('OPENAQ_') || key.startsWith('GEMINI_')) {
      process.env[key] = val;
    }
  }

  return {
    plugins: [react(), vayuDevApiPlugin(mode)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});

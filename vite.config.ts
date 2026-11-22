import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function aqiDevApiPlugin(mode: string): Plugin {
  return {
    name: 'aqi-dev-api',
    configureServer(server) {
      // Load environment variables from .env.local and other env files with empty prefix
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, val] of Object.entries(env)) {
        if (process.env[key] === undefined || key === 'OPENAQ_API_KEY') {
          process.env[key] = val;
        }
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/aqi')) {
          try {
            // Re-sync env from .env.local on incoming requests in case .env.local was edited
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
    if (process.env[key] === undefined || key === 'OPENAQ_API_KEY') {
      process.env[key] = val;
    }
  }

  return {
    plugins: [react(), aqiDevApiPlugin(mode)],
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

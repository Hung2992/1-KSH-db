import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateEvent, evaluateGlobalState } from '../core/index.js';

const validModules = new Set(['finance', 'security', 'health', 'energy']);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../public');

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function htmlResponse(res, filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Unable to load dashboard.');
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createDecisionStore(limit = 200) {
  const events = [];

  return {
    add(entry) {
      const item = {
        id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...entry,
        createdAt: new Date().toISOString(),
      };

      events.unshift(item);
      if (events.length > limit) {
        events.pop();
      }

      return item;
    },
    list(max = 25) {
      return events.slice(0, max);
    },
  };
}

export function createServer() {
  const decisionStore = createDecisionStore();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return htmlResponse(res, path.join(publicDir, 'index.html'));
    }

    if (req.method === 'GET' && url.pathname === '/links') {
      const host = req.headers.host || 'localhost:3000';
      const base = `http://${host}`;
      return jsonResponse(res, 200, {
        dashboard: `${base}/`,
        health: `${base}/health`,
        listDecisions: `${base}/decisions?limit=10`,
        evaluateModuleExample: `${base}/events/finance`,
        omegaEvaluate: `${base}/omega/evaluate`,
      });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(res, 200, { ok: true, service: 'zoligpt-omega-admin-core' });
    }

    if (req.method === 'GET' && url.pathname === '/decisions') {
      const limit = Number(url.searchParams.get('limit') || 25);
      return jsonResponse(res, 200, {
        items: decisionStore.list(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 25),
      });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/events/')) {
      const moduleName = url.pathname.replace('/events/', '');
      if (!validModules.has(moduleName)) {
        return jsonResponse(res, 400, { error: `Unknown module: ${moduleName}` });
      }

      try {
        const body = await readJsonBody(req);
        const signals = body.signals;
        if (!signals || typeof signals !== 'object') {
          return jsonResponse(res, 400, { error: 'Body must include a signals object' });
        }

        const result = evaluateEvent(moduleName, signals);
        const stored = decisionStore.add({ type: 'module', module: moduleName, payload: result });

        return jsonResponse(res, 200, {
          ...result,
          decisionLogId: stored.id,
        });
      } catch {
        return jsonResponse(res, 400, { error: 'Invalid JSON body' });
      }
    }

    if (req.method === 'POST' && url.pathname === '/omega/evaluate') {
      try {
        const body = await readJsonBody(req);
        const events = body.events;

        if (!Array.isArray(events) || events.length === 0) {
          return jsonResponse(res, 400, { error: 'Body must include a non-empty events array' });
        }

        const moduleEvaluations = events.map((event) => {
          if (!validModules.has(event.module)) {
            throw new Error(`Unknown module: ${event.module}`);
          }
          return evaluateEvent(event.module, event.signals ?? {});
        });

        const global = evaluateGlobalState(moduleEvaluations);
        const stored = decisionStore.add({ type: 'omega', module: 'omega', payload: global });

        return jsonResponse(res, 200, {
          ...global,
          decisionLogId: stored.id,
        });
      } catch (error) {
        return jsonResponse(res, 400, { error: error.message || 'Invalid JSON body' });
      }
    }

    return jsonResponse(res, 404, { error: 'Not found' });
  });
}

export function startServer(port = Number(process.env.PORT) || 3000) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`Omega Admin Core API listening on ${port}`);
  });
  return server;
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

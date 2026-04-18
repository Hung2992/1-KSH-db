import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateEvent,
  evaluateGlobalState,
  forecastModuleRisk,
  derivePredictionAction,
  deriveModuleCommands,
  dedupeCommands,
} from '../core/index.js';

const validModules = new Set(['finance', 'security', 'health', 'energy']);
const roleOrder = ['user', 'analyst', 'operator', 'admin', 'superadmin', 'founder_root'];
const roleCapabilities = {
  user: ['view_self'],
  analyst: ['view_self', 'view_dashboards', 'view_decisions'],
  operator: ['view_self', 'view_dashboards', 'view_decisions', 'run_reviews'],
  admin: ['view_self', 'view_dashboards', 'view_decisions', 'run_reviews', 'manage_users', 'manage_policies'],
  superadmin: [
    'view_self',
    'view_dashboards',
    'view_decisions',
    'run_reviews',
    'manage_users',
    'manage_policies',
    'system_access',
  ],
  founder_root: [
    'view_self',
    'view_dashboards',
    'view_decisions',
    'run_reviews',
    'manage_users',
    'manage_policies',
    'system_access',
    'policy_override',
  ],
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../public');
const configuredPublicBaseUrl = process.env.PUBLIC_BASE_URL || '';

function resolveBaseUrl(req) {
  if (configuredPublicBaseUrl) {
    return configuredPublicBaseUrl.replace(/\/+$/, '');
  }

  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

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

function normalizeRole(rawRole) {
  if (!rawRole) return 'user';
  const normalized = String(rawRole).trim().toLowerCase();
  return roleOrder.includes(normalized) ? normalized : 'user';
}

function hasAtLeastRole(role, requiredRole) {
  return roleOrder.indexOf(role) >= roleOrder.indexOf(requiredRole);
}

function requireRole(req, res, minRole) {
  const role = normalizeRole(req.headers['x-role']);
  if (!hasAtLeastRole(role, minRole)) {
    jsonResponse(res, 403, {
      error: `Forbidden: requires ${minRole} or higher`,
      role,
    });
    return null;
  }
  return role;
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
    topCritical(max = 10) {
      const scored = events
        .map((item) => {
          const score = item.payload?.score ?? 0;
          const decision = item.payload?.decision ?? 'unknown';
          const priorityBoost =
            decision === 'alert' || decision === 'block' ? 30 : decision === 'freeze' ? 20 : 0;

          return { ...item, effectiveScore: Math.min(100, score + priorityBoost) };
        })
        .sort((a, b) => b.effectiveScore - a.effectiveScore);

      return scored.slice(0, max);
    },
    summarizeModuleStates(max = 100) {
      const recent = events.slice(0, max);
      const summary = {
        finance: { latestScore: null, latestDecision: null },
        security: { latestScore: null, latestDecision: null },
        health: { latestScore: null, latestDecision: null },
        energy: { latestScore: null, latestDecision: null },
      };

      for (const item of recent) {
        if (item.type !== 'module' || !summary[item.module]) {
          continue;
        }
        if (summary[item.module].latestScore === null) {
          summary[item.module] = {
            latestScore: item.payload?.score ?? null,
            latestDecision: item.payload?.decision ?? null,
          };
        }
      }

      return summary;
    },
    findById(id) {
      return events.find((item) => item.id === id);
    },
    moduleScores(moduleName, max = 20) {
      return events
        .filter((item) => item.type === 'module' && item.module === moduleName)
        .slice(0, max)
        .map((item) => item.payload?.score)
        .filter((score) => Number.isFinite(score))
        .reverse();
    },
    moduleAnalytics(moduleName, max = 20) {
      const recent = events
        .filter((item) => item.type === 'module' && item.module === moduleName)
        .slice(0, max);
      const scores = recent
        .map((item) => item.payload?.score)
        .filter((score) => Number.isFinite(score));
      const decisions = recent.map((item) => item.payload?.decision).filter(Boolean);
      const total = scores.length;

      if (total === 0) {
        return {
          module: moduleName,
          count: 0,
          averageScore: 0,
          maxScore: 0,
          minScore: 0,
          decisionCounts: {},
        };
      }

      const decisionCounts = decisions.reduce((acc, decision) => {
        acc[decision] = (acc[decision] || 0) + 1;
        return acc;
      }, {});

      return {
        module: moduleName,
        count: total,
        averageScore: Math.round(scores.reduce((acc, score) => acc + score, 0) / total),
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores),
        decisionCounts,
      };
    },
  };
}

function createAuditStore(limit = 500) {
  const logs = [];

  return {
    add(entry) {
      const item = {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...entry,
        createdAt: new Date().toISOString(),
      };

      logs.unshift(item);
      if (logs.length > limit) logs.pop();
      return item;
    },
    list(max = 50) {
      return logs.slice(0, max);
    },
  };
}

function createCommandQueue(limit = 500) {
  const jobs = [];

  return {
    enqueue(command, context) {
      const item = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        command,
        status: 'queued',
        attempts: 0,
        context,
        createdAt: new Date().toISOString(),
      };

      jobs.unshift(item);
      if (jobs.length > limit) jobs.pop();
      return item;
    },
    list({ status, max = 50 }) {
      const filtered = status ? jobs.filter((job) => job.status === status) : jobs;
      return filtered.slice(0, max);
    },
    findById(id) {
      return jobs.find((job) => job.id === id);
    },
    execute(id) {
      const item = jobs.find((job) => job.id === id);
      if (!item) return null;

      item.attempts += 1;
      item.status = 'succeeded';
      item.executedAt = new Date().toISOString();
      return item;
    },
  };
}

export function createServer() {
  const decisionStore = createDecisionStore();
  const auditStore = createAuditStore();
  const commandQueue = createCommandQueue();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return htmlResponse(res, path.join(publicDir, 'index.html'));
    }

    if (req.method === 'GET' && url.pathname === '/links') {
      const base = resolveBaseUrl(req);
      return jsonResponse(res, 200, {
        dashboard: `${base}/`,
        health: `${base}/health`,
        listDecisions: `${base}/decisions?limit=10`,
        commandCenterOverview: `${base}/command-center/overview`,
        roleCatalog: `${base}/admin/roles`,
        financeAnalytics: `${base}/analytics/finance`,
        securityPrediction: `${base}/predict/security`,
        commandsQueue: `${base}/commands?limit=20`,
        auditLogs: `${base}/audit-logs?limit=20`,
        publicConfig: `${base}/deploy/public-config`,
        securityDrill: `${base}/security/drill/breach`,
        evaluateModuleExample: `${base}/events/finance`,
        omegaEvaluate: `${base}/omega/evaluate`,
      });
    }

    if (req.method === 'GET' && url.pathname === '/deploy/public-config') {
      const role = requireRole(req, res, 'admin');
      if (!role) return;

      const base = resolveBaseUrl(req);
      return jsonResponse(res, 200, {
        role,
        publicBaseUrl: base,
        recommendedProductionDomain: 'https://kvamtom.tech',
        requiredEnv: {
          PUBLIC_BASE_URL: 'https://kvamtom.tech',
          PORT: '3000',
        },
        endpoints: {
          dashboard: `${base}/`,
          health: `${base}/health`,
          links: `${base}/links`,
          omegaEvaluate: `${base}/omega/evaluate`,
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(res, 200, { ok: true, service: 'zoligpt-omega-admin-core' });
    }

    if (req.method === 'GET' && url.pathname === '/decisions') {
      const role = requireRole(req, res, 'analyst');
      if (!role) return;
      const limit = Number(url.searchParams.get('limit') || 25);
      return jsonResponse(res, 200, {
        role,
        items: decisionStore.list(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 25),
      });
    }

    if (req.method === 'GET' && url.pathname === '/command-center/overview') {
      const role = requireRole(req, res, 'analyst');
      if (!role) return;

      const moduleStates = decisionStore.summarizeModuleStates();
      const criticalEvents = decisionStore.topCritical(10);
      const maxCriticalScore = criticalEvents[0]?.effectiveScore ?? 0;
      const globalThreatLevel =
        maxCriticalScore >= 80 ? 'red' : maxCriticalScore >= 50 ? 'yellow' : 'green';

      return jsonResponse(res, 200, {
        role,
        globalThreatLevel,
        moduleStates,
        topCriticalEvents: criticalEvents,
      });
    }

    if (req.method === 'GET' && url.pathname === '/admin/roles') {
      const role = requireRole(req, res, 'admin');
      if (!role) return;

      return jsonResponse(res, 200, {
        role,
        hierarchy: roleOrder,
        capabilities: roleCapabilities,
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/analytics/')) {
      const role = requireRole(req, res, 'analyst');
      if (!role) return;

      const moduleName = url.pathname.replace('/analytics/', '');
      if (!validModules.has(moduleName)) {
        return jsonResponse(res, 400, { error: `Unknown module: ${moduleName}` });
      }

      return jsonResponse(res, 200, {
        role,
        ...decisionStore.moduleAnalytics(moduleName),
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/predict/')) {
      const role = requireRole(req, res, 'analyst');
      if (!role) return;

      const moduleName = url.pathname.replace('/predict/', '');
      if (!validModules.has(moduleName)) {
        return jsonResponse(res, 400, { error: `Unknown module: ${moduleName}` });
      }

      const scores = decisionStore.moduleScores(moduleName, 12);
      const prediction = forecastModuleRisk(scores);
      const suggestedAction = derivePredictionAction(moduleName, prediction);

      return jsonResponse(res, 200, {
        role,
        module: moduleName,
        recentScores: scores,
        prediction,
        suggestedAction,
      });
    }

    if (req.method === 'GET' && url.pathname === '/commands') {
      const role = requireRole(req, res, 'operator');
      if (!role) return;

      const limit = Number(url.searchParams.get('limit') || 50);
      const status = url.searchParams.get('status') || null;
      const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 50;

      return jsonResponse(res, 200, {
        role,
        items: commandQueue.list({ status, max: normalizedLimit }),
      });
    }

    if (req.method === 'GET' && url.pathname === '/audit-logs') {
      const role = requireRole(req, res, 'admin');
      if (!role) return;

      const limit = Number(url.searchParams.get('limit') || 50);
      const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 50;

      return jsonResponse(res, 200, {
        role,
        items: auditStore.list(normalizedLimit),
      });
    }

    if (req.method === 'POST' && url.pathname === '/security/drill/breach') {
      const role = requireRole(req, res, 'operator');
      if (!role) return;

      try {
        const body = await readJsonBody(req);
        const defaultSignals = {
          newIp: true,
          adminAccount: true,
          unusualTime: true,
          missingMfa: true,
          tooManyAttempts: true,
        };
        const signals = { ...defaultSignals, ...(body.signals || {}) };
        const result = evaluateEvent('security', signals);
        const stored = decisionStore.add({
          type: 'module',
          module: 'security',
          actorRole: role,
          payload: result,
        });
        const commands = dedupeCommands(deriveModuleCommands('security', result.decision));
        const queuedJobs = commands.map((command) =>
          commandQueue.enqueue(command, {
            source: 'security_drill',
            module: 'security',
            decisionLogId: stored.id,
          }),
        );

        auditStore.add({
          actorRole: role,
          action: 'security_drill_triggered',
          target: 'security',
          metadata: { decisionLogId: stored.id, score: result.score, decision: result.decision, commands },
        });

        return jsonResponse(res, 200, {
          drill: 'breach',
          ...result,
          commands,
          queuedCommandIds: queuedJobs.map((job) => job.id),
          decisionLogId: stored.id,
        });
      } catch {
        return jsonResponse(res, 400, { error: 'Invalid JSON body' });
      }
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
        const stored = decisionStore.add({
          type: 'module',
          module: moduleName,
          actorRole: normalizeRole(req.headers['x-role']),
          payload: result,
        });
        const commands = dedupeCommands(deriveModuleCommands(moduleName, result.decision));
        const queuedJobs = commands.map((command) =>
          commandQueue.enqueue(command, { source: 'module', module: moduleName, decisionLogId: stored.id }),
        );
        auditStore.add({
          actorRole: normalizeRole(req.headers['x-role']),
          action: 'module_evaluated',
          target: moduleName,
          metadata: { decisionLogId: stored.id, score: result.score, decision: result.decision, commands },
        });

        return jsonResponse(res, 200, {
          ...result,
          commands,
          queuedCommandIds: queuedJobs.map((job) => job.id),
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
        const stored = decisionStore.add({
          type: 'omega',
          module: 'omega',
          actorRole: normalizeRole(req.headers['x-role']),
          payload: global,
        });
        const queuedJobs = global.commands.map((command) =>
          commandQueue.enqueue(command, { source: 'omega', module: 'omega', decisionLogId: stored.id }),
        );
        auditStore.add({
          actorRole: normalizeRole(req.headers['x-role']),
          action: 'omega_evaluated',
          target: 'omega',
          metadata: {
            decisionLogId: stored.id,
            score: global.score,
            decision: global.decision,
            commands: global.commands,
          },
        });

        return jsonResponse(res, 200, {
          ...global,
          queuedCommandIds: queuedJobs.map((job) => job.id),
          decisionLogId: stored.id,
        });
      } catch (error) {
        return jsonResponse(res, 400, { error: error.message || 'Invalid JSON body' });
      }
    }

    if (req.method === 'POST' && url.pathname.startsWith('/decisions/') && url.pathname.endsWith('/approve')) {
      const role = requireRole(req, res, 'operator');
      if (!role) return;

      const decisionId = url.pathname.replace('/decisions/', '').replace('/approve', '');
      const item = decisionStore.findById(decisionId);
      if (!item) {
        return jsonResponse(res, 404, { error: `Decision not found: ${decisionId}` });
      }

      item.approval = {
        approvedByRole: role,
        approvedAt: new Date().toISOString(),
      };
      auditStore.add({
        actorRole: role,
        action: 'decision_approved',
        target: decisionId,
        metadata: { approvedByRole: role },
      });

      return jsonResponse(res, 200, { id: decisionId, approval: item.approval });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/commands/') && url.pathname.endsWith('/execute')) {
      const role = requireRole(req, res, 'operator');
      if (!role) return;

      const commandId = url.pathname.replace('/commands/', '').replace('/execute', '');
      const executed = commandQueue.execute(commandId);
      if (!executed) {
        return jsonResponse(res, 404, { error: `Command not found: ${commandId}` });
      }

      auditStore.add({
        actorRole: role,
        action: 'command_executed',
        target: commandId,
        metadata: { command: executed.command, attempts: executed.attempts, status: executed.status },
      });

      return jsonResponse(res, 200, { item: executed });
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

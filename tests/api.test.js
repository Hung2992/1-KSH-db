import test from 'node:test';
import assert from 'node:assert/strict';

import { createServer } from '../src/api/server.js';

async function withServer(run) {
  const server = createServer();

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('GET /health returns ok', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
  });
});

test('GET /links returns shareable endpoints', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/links`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.dashboard, /\/$/);
    assert.match(body.omegaEvaluate, /\/omega\/evaluate$/);
    assert.match(body.listDecisions, /\/decisions\?limit=10$/);
    assert.match(body.commandCenterOverview, /\/command-center\/overview$/);
    assert.match(body.financeAnalytics, /\/analytics\/finance$/);
    assert.match(body.securityPrediction, /\/predict\/security$/);
    assert.match(body.commandsQueue, /\/commands\?limit=20$/);
    assert.match(body.auditLogs, /\/audit-logs\?limit=20$/);
    assert.match(body.publicConfig, /\/deploy\/public-config$/);
    assert.match(body.securityDrill, /\/security\/drill\/breach$/);
  });
});

test('GET / serves dashboard html', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /ZoliGPT Omega Admin Core/);
  });
});

test('POST /events/finance evaluates scoring and returns decision log id', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, newDevice: true },
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.score, 35);
    assert.equal(body.decision, 'review');
    assert.match(body.decisionLogId, /^dec_/);
    assert.ok(Array.isArray(body.commands));
    assert.ok(Array.isArray(body.queuedCommandIds));
  });
});

test('GET /decisions returns previously stored decisions', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, suspiciousCountry: true },
      }),
    });

    await fetch(`${baseUrl}/omega/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          { module: 'finance', signals: { amountAnomaly: true, newDevice: true } },
          { module: 'security', signals: { newIp: true, missingMfa: true } },
        ],
      }),
    });

    const response = await fetch(`${baseUrl}/decisions?limit=10`, {
      headers: { 'x-role': 'analyst' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 2);
    assert.match(body.items[0].id, /^dec_/);
  });
});

test('GET /decisions requires analyst role', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/decisions?limit=10`);
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /requires analyst/i);
  });
});

test('GET /command-center/overview returns threat level and module states', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/events/security`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { newIp: true, adminAccount: true, missingMfa: true, tooManyAttempts: true },
      }),
    });

    const response = await fetch(`${baseUrl}/command-center/overview`, {
      headers: { 'x-role': 'analyst' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.globalThreatLevel, 'red');
    assert.equal(body.moduleStates.security.latestDecision, 'block');
    assert.ok(Array.isArray(body.topCriticalEvents));
    assert.ok(body.topCriticalEvents.length >= 1);
  });
});

test('POST /decisions/:id/approve allows operator approvals', async () => {
  await withServer(async (baseUrl) => {
    const evaluated = await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, newDevice: true },
      }),
    });
    const decision = await evaluated.json();

    const approvalResponse = await fetch(`${baseUrl}/decisions/${decision.decisionLogId}/approve`, {
      method: 'POST',
      headers: { 'x-role': 'operator' },
    });
    const approval = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approval.id, decision.decisionLogId);
    assert.equal(approval.approval.approvedByRole, 'operator');
  });
});

test('GET /analytics/:module returns module aggregates', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, newDevice: true },
      }),
    });

    await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, suspiciousCountry: true, velocitySpike: true },
      }),
    });

    const response = await fetch(`${baseUrl}/analytics/finance`, {
      headers: { 'x-role': 'analyst' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.module, 'finance');
    assert.equal(body.count, 2);
    assert.ok(body.averageScore >= 35);
    assert.ok(body.decisionCounts.review >= 1 || body.decisionCounts.block >= 1);
  });
});

test('GET /predict/:module returns prediction payload', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/events/security`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { newIp: true },
      }),
    });

    await fetch(`${baseUrl}/events/security`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { newIp: true, adminAccount: true, missingMfa: true, tooManyAttempts: true },
      }),
    });

    const response = await fetch(`${baseUrl}/predict/security`, {
      headers: { 'x-role': 'analyst' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.module, 'security');
    assert.ok(Array.isArray(body.recentScores));
    assert.ok(body.prediction);
    assert.ok(typeof body.suggestedAction === 'string');
  });
});

test('GET /commands returns queued command items for operator role', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/events/security`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { newIp: true, adminAccount: true, missingMfa: true, tooManyAttempts: true },
      }),
    });

    const response = await fetch(`${baseUrl}/commands?limit=20`, {
      headers: { 'x-role': 'operator' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 1);
    assert.match(body.items[0].id, /^cmd_/);
  });
});

test('POST /commands/:id/execute updates command status', async () => {
  await withServer(async (baseUrl) => {
    const evaluate = await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, suspiciousCountry: true, velocitySpike: true },
      }),
    });
    const evaluatedBody = await evaluate.json();
    const commandId = evaluatedBody.queuedCommandIds[0];

    const executeResponse = await fetch(`${baseUrl}/commands/${commandId}/execute`, {
      method: 'POST',
      headers: { 'x-role': 'operator' },
    });
    const executeBody = await executeResponse.json();

    assert.equal(executeResponse.status, 200);
    assert.equal(executeBody.item.status, 'succeeded');
    assert.equal(executeBody.item.attempts, 1);
  });
});

test('GET /audit-logs returns audit trail for admin role', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/events/finance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-role': 'admin' },
      body: JSON.stringify({
        signals: { amountAnomaly: true, newDevice: true },
      }),
    });

    const response = await fetch(`${baseUrl}/audit-logs?limit=20`, {
      headers: { 'x-role': 'admin' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 1);
    assert.match(body.items[0].id, /^aud_/);
  });
});

test('GET /deploy/public-config returns production domain config for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/deploy/public-config`, {
      headers: { 'x-role': 'admin' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.recommendedProductionDomain, /^https:\/\/kvamtom\.tech$/);
    assert.ok(body.endpoints.dashboard.endsWith('/'));
  });
});

test('POST /security/drill/breach triggers high-risk security response and queue entries', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/security/drill/breach`, {
      method: 'POST',
      headers: { 'x-role': 'operator', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.drill, 'breach');
    assert.equal(body.module, 'security');
    assert.equal(body.decision, 'block');
    assert.ok(Array.isArray(body.queuedCommandIds));
    assert.ok(body.queuedCommandIds.length >= 1);
  });
});

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

    const response = await fetch(`${baseUrl}/decisions?limit=10`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 2);
    assert.match(body.items[0].id, /^dec_/);
  });
});

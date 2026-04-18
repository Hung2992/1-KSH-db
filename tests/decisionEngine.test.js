import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateEvent,
  deriveDecision,
  evaluateGlobalState,
  getCommandsForDecision,
} from '../src/core/index.js';

test('finance low risk -> approve', () => {
  const result = evaluateEvent('finance', {
    trustedUser: true,
    newDevice: false,
  });

  assert.equal(result.score, 0);
  assert.equal(result.decision, 'approve');
  assert.match(result.explanation, /decision=approve/);
});

test('finance medium risk -> review', () => {
  const result = evaluateEvent('finance', {
    amountAnomaly: true,
    newDevice: true,
  });

  assert.equal(result.score, 35);
  assert.equal(result.decision, 'review');
});

test('security high risk -> block', () => {
  const result = evaluateEvent('security', {
    newIp: true,
    adminAccount: true,
    missingMfa: true,
    tooManyAttempts: true,
  });

  assert.equal(result.score, 85);
  assert.equal(result.decision, 'block');
});

test('deriveDecision health thresholds', () => {
  assert.equal(deriveDecision('health', 10), 'normal');
  assert.equal(deriveDecision('health', 40), 'watch');
  assert.equal(deriveDecision('health', 60), 'risk_flag');
  assert.equal(deriveDecision('health', 90), 'urgent_support');
});

test('omega brain moves to review on cross-module pressure', () => {
  const output = evaluateGlobalState([
    evaluateEvent('finance', {
      amountAnomaly: true,
      newDevice: true,
      suspiciousCountry: true,
      trustedUser: true,
    }),
    evaluateEvent('security', {
      newIp: true,
      adminAccount: true,
      unusualTime: true,
    }),
    evaluateEvent('health', {
      sleepDeficit: true,
      overload: true,
      poorRecovery: true,
    }),
    evaluateEvent('energy', {
      peakUsage: true,
      wastefulDevice: true,
      abnormalLoad: true,
    }),
  ]);

  assert.equal(output.decision, 'review');
  assert.ok(Array.isArray(output.commands));
});

test('omega brain sends alert if finance hard-block happens', () => {
  const output = evaluateGlobalState([
    evaluateEvent('finance', {
      amountAnomaly: true,
      suspiciousCountry: true,
      velocitySpike: true,
    }),
    evaluateEvent('security', { newIp: true }),
  ]);

  assert.equal(output.decision, 'alert');
  assert.deepEqual(getCommandsForDecision(output.decision), ['send_alert', 'audit_log']);
});

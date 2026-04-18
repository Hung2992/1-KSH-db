/**
 * Modulonkénti szabályok és küszöbök.
 */
export const scoringProfiles = {
  finance: {
    rules: [
      { signal: 'amountAnomaly', weight: 20, reason: 'Unusual transaction amount' },
      { signal: 'newDevice', weight: 15, reason: 'New device fingerprint detected' },
      { signal: 'suspiciousCountry', weight: 25, reason: 'Risky country / geo mismatch' },
      { signal: 'velocitySpike', weight: 30, reason: 'Transaction velocity spike' },
      { signal: 'trustedUser', weight: -20, reason: 'Long-term trusted customer' },
    ],
    thresholds: {
      approveMax: 29,
      reviewMax: 59,
      blockMax: 100,
    },
  },
  security: {
    rules: [
      { signal: 'newIp', weight: 15, reason: 'New IP address observed' },
      { signal: 'adminAccount', weight: 20, reason: 'Privileged account access' },
      { signal: 'unusualTime', weight: 10, reason: 'Unusual access time window' },
      { signal: 'missingMfa', weight: 20, reason: 'Missing MFA challenge' },
      { signal: 'tooManyAttempts', weight: 30, reason: 'Excessive failed attempts' },
    ],
    thresholds: {
      allowMax: 24,
      stepUpAuthMax: 49,
      freezeMax: 74,
      blockMax: 100,
    },
  },
  health: {
    rules: [
      { signal: 'sleepDeficit', weight: 25, reason: 'Sleep deficit trend' },
      { signal: 'overload', weight: 25, reason: 'High training/work overload' },
      { signal: 'poorRecovery', weight: 25, reason: 'Poor recovery trend' },
      { signal: 'chronicStress', weight: 25, reason: 'Sustained elevated stress' },
    ],
    thresholds: {
      normalMax: 24,
      watchMax: 49,
      riskFlagMax: 74,
      urgentMax: 100,
    },
  },
  energy: {
    rules: [
      { signal: 'peakUsage', weight: 25, reason: 'Peak-hour consumption overload' },
      { signal: 'wastefulDevice', weight: 25, reason: 'Inefficient device usage pattern' },
      { signal: 'abnormalLoad', weight: 25, reason: 'Abnormal load distribution' },
      { signal: 'repeatedOverconsumption', weight: 25, reason: 'Repeated overconsumption cycle' },
    ],
    thresholds: {
      optimalMax: 24,
      monitorMax: 49,
      optimizeMax: 74,
      criticalMax: 100,
    },
  },
};

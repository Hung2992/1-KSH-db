import { evaluateRules } from './ruleEngine.js';
import { scoringProfiles } from './scoringProfiles.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * @param {'finance'|'security'|'health'|'energy'} moduleName
 * @param {Record<string, boolean>} signals
 */
export function evaluateEvent(moduleName, signals) {
  const profile = scoringProfiles[moduleName];
  if (!profile) {
    throw new Error(`Unknown module: ${moduleName}`);
  }

  const { rawScore, triggered } = evaluateRules(profile.rules, signals);
  const score = clamp(rawScore, 0, 100);
  const decision = deriveDecision(moduleName, score);

  return {
    module: moduleName,
    score,
    decision,
    triggered,
    explanation: buildExplanation(moduleName, decision, triggered),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {'finance'|'security'|'health'|'energy'} moduleName
 * @param {number} score
 */
export function deriveDecision(moduleName, score) {
  const t = scoringProfiles[moduleName].thresholds;

  switch (moduleName) {
    case 'finance':
      if (score <= t.approveMax) return 'approve';
      if (score <= t.reviewMax) return 'review';
      return 'block';

    case 'security':
      if (score <= t.allowMax) return 'allow';
      if (score <= t.stepUpAuthMax) return 'step_up_auth';
      if (score <= t.freezeMax) return 'freeze';
      return 'block';

    case 'health':
      if (score <= t.normalMax) return 'normal';
      if (score <= t.watchMax) return 'watch';
      if (score <= t.riskFlagMax) return 'risk_flag';
      return 'urgent_support';

    case 'energy':
      if (score <= t.optimalMax) return 'optimal';
      if (score <= t.monitorMax) return 'monitor';
      if (score <= t.optimizeMax) return 'optimize';
      return 'critical_waste';

    default:
      throw new Error(`No decision mapping for module: ${moduleName}`);
  }
}

export function buildExplanation(moduleName, decision, triggered) {
  if (triggered.length === 0) {
    return `${moduleName}: no risk rules were triggered.`;
  }

  const topReasons = triggered
    .slice()
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3)
    .map((item) => `${item.signal}(${item.weight >= 0 ? '+' : ''}${item.weight})`)
    .join(', ');

  return `${moduleName}: decision=${decision}; top signals: ${topReasons}`;
}

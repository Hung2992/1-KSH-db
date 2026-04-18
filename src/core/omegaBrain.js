import { getCommandsForDecision } from './commandLayer.js';

const MODULE_WEIGHTS = {
  finance: 0.35,
  security: 0.35,
  health: 0.15,
  energy: 0.15,
};

export function evaluateGlobalState(moduleEvaluations) {
  const weightedScore = moduleEvaluations.reduce((acc, item) => {
    const weight = MODULE_WEIGHTS[item.module] ?? 0;
    return acc + item.score * weight;
  }, 0);

  const score = Math.round(weightedScore);
  const decision = deriveGlobalDecision(score, moduleEvaluations);
  const commands = getCommandsForDecision(decision);

  return {
    score,
    decision,
    commands,
    modules: moduleEvaluations,
    generatedAt: new Date().toISOString(),
  };
}

export function deriveGlobalDecision(score, moduleEvaluations) {
  const hardBlock = moduleEvaluations.some(
    (item) => (item.module === 'finance' || item.module === 'security') && item.decision === 'block',
  );

  if (hardBlock) {
    return 'alert';
  }

  if (score >= 75) return 'escalate';
  if (score >= 50) return 'review';
  return 'approve';
}

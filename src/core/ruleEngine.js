/**
 * Generic rule evaluator that can be reused by all modules.
 * A rule is active when `signals[rule.signal] === true`.
 */
export function evaluateRules(rules, signals) {
  const triggered = [];

  const rawScore = rules.reduce((acc, rule) => {
    if (signals[rule.signal] === true) {
      triggered.push({
        signal: rule.signal,
        weight: rule.weight,
        reason: rule.reason,
      });
      return acc + rule.weight;
    }

    return acc;
  }, 0);

  return {
    rawScore,
    triggered,
  };
}

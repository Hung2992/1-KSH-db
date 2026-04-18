function average(values) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function slope(values) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

export function forecastModuleRisk(recentScores) {
  const safeScores = recentScores.filter((score) => Number.isFinite(score));
  if (safeScores.length === 0) {
    return {
      baseline: 0,
      trend: 'stable',
      nextScore: 0,
      confidence: 'low',
    };
  }

  const baseline = Math.round(average(safeScores));
  const delta = slope(safeScores);
  const projected = Math.round(Math.max(0, Math.min(100, baseline + delta * 0.6)));

  let trend = 'stable';
  if (delta >= 12) trend = 'rising_risk';
  else if (delta <= -12) trend = 'improving';

  const confidence = safeScores.length >= 6 ? 'high' : safeScores.length >= 3 ? 'medium' : 'low';

  return {
    baseline,
    trend,
    nextScore: projected,
    confidence,
  };
}

export function derivePredictionAction(moduleName, prediction) {
  if (prediction.trend === 'rising_risk' && prediction.nextScore >= 70) {
    return moduleName === 'security' ? 'escalate_incident' : 'escalate_review';
  }
  if (prediction.trend === 'rising_risk') {
    return 'tighten_monitoring';
  }
  if (prediction.trend === 'improving') {
    return 'keep_policy';
  }
  return 'observe';
}

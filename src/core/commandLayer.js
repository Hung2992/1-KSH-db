const decisionCommandMap = {
  approve: ['audit_log'],
  review: ['send_to_review_queue', 'notify_risk_team', 'audit_log'],
  block: ['block_transaction', 'alert_security', 'audit_log'],

  allow: ['audit_log'],
  step_up_auth: ['require_mfa_challenge', 'audit_log'],
  freeze: ['freeze_session', 'notify_security_ops', 'audit_log'],

  normal: ['audit_log'],
  watch: ['show_wellness_recommendation', 'audit_log'],
  risk_flag: ['escalate_coach_review', 'send_high_risk_notice', 'audit_log'],
  urgent_support: ['urgent_support_prompt', 'notify_care_operator', 'audit_log'],

  optimal: ['audit_log'],
  monitor: ['energy_monitoring_alert', 'audit_log'],
  optimize: ['send_optimization_plan', 'audit_log'],
  critical_waste: ['critical_energy_alert', 'create_optimization_incident', 'audit_log'],

  escalate: ['escalate_to_operator', 'notify_admin', 'audit_log'],
  alert: ['send_alert', 'audit_log'],
};

export function getCommandsForDecision(decision) {
  return decisionCommandMap[decision] ?? ['audit_log'];
}

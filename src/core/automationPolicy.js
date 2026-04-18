export function deriveModuleCommands(moduleName, decision) {
  switch (moduleName) {
    case 'finance':
      if (decision === 'block') return ['freeze_transaction', 'send_alert', 'audit_log'];
      if (decision === 'review') return ['queue_manual_review', 'audit_log'];
      return ['audit_log'];
    case 'security':
      if (decision === 'block') return ['block_identity', 'force_mfa', 'send_alert', 'audit_log'];
      if (decision === 'freeze') return ['freeze_session', 'force_mfa', 'audit_log'];
      if (decision === 'step_up_auth') return ['force_mfa', 'audit_log'];
      return ['audit_log'];
    case 'health':
      if (decision === 'urgent_support') return ['send_alert', 'recommend_rest', 'audit_log'];
      if (decision === 'risk_flag') return ['recommend_rest', 'audit_log'];
      return ['audit_log'];
    case 'energy':
      if (decision === 'critical_waste') return ['optimize_load', 'send_alert', 'audit_log'];
      if (decision === 'optimize') return ['optimize_load', 'audit_log'];
      return ['audit_log'];
    default:
      return ['audit_log'];
  }
}

export function dedupeCommands(commands) {
  return [...new Set(commands)];
}

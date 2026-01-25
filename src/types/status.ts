/** Status dot types for triage display */
export type StatusDotType = 'green' | 'yellow' | 'red';

/** Triage reason codes for veterinary-priority status display */
export type StatusReason = 
  // Red reasons (critical)
  | 'withdrawal_milk_sold'     // Food safety critical
  | 'overdue_delivery'         // Past expected calving
  | 'multiple_overdue_vaccines'// 2+ overdue vaccinations
  | 'active_health_issue'      // Current health problem
  | 'quarantined'              // Isolated for disease
  // Yellow reasons (attention needed)
  | 'single_overdue_vaccine'   // 1 overdue vaccination
  | 'near_delivery'            // Within 7 days of calving
  | 'in_heat_window'           // Optimal breeding window
  | 'critical_bcs'             // BCS ≤2.0 or ≥4.5
  | 'active_withdrawal'        // Under withdrawal, milk not sold
  // Green
  | 'healthy'                  // All clear
  | undefined;

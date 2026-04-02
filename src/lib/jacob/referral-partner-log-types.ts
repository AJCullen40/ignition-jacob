/**
 * Payload for POST /api/jacob/referral-partners/log (n8n or GHL → webhook).
 */

export interface ReferralPartnerStageLogPayload {
  receivedAt?: string;
  /** e.g. opportunity_stage_changed */
  event?: string;
  ghlContactId?: string;
  ghlOpportunityId?: string;
  contactName?: string;
  /** Raw stage label from GHL */
  pipelineStageName?: string;
  opportunitySource?: string;
  /** Optional notes for ops */
  notes?: string;
  /** Original webhook body for audit (truncated server-side) */
  raw?: unknown;
}

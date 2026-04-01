export type ClioWebhookEvent =
  | "agreement_sent"
  | "agreement_signed"
  | "payment_received";

export interface ClioSyncLogPayload {
  receivedAt?: string;
  event: ClioWebhookEvent;
  /** GHL contact to update (from Clio ↔ GHL mapping in n8n) */
  ghlContactId?: string;
  clioMatterId?: string;
  agreementStatus?: "Sent" | "Signed" | "";
  paymentStatus?: "Pending" | "Received" | "";
  caseValue?: number | string | null;
  /** Copied Clio matter notes → GHL notes field (n8n can POST body here) */
  matterNotes?: string;
  raw?: Record<string, unknown>;
}

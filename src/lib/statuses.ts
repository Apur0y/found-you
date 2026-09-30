export const LEAD_STATUSES = [
  "new",
  "qualified",
  "message_ready",
  "approved",
  "contacted",
  "replied",
  "interested",
  "not_interested",
  "converted",
  "do_not_contact",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const OUTREACH_STATUSES = ["draft", "approved", "sent", "replied"] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];
import type { LeadStatus } from "@/lib/statuses";
import type { WebsiteCategory } from "@/lib/websites";

export type { LeadStatus };
export type { WebsiteCategory };
export type ContactType =
  | "parent"
  | "athlete"
  | "coach"
  | "team"
  | "agency"
  | "unknown";

export type EvidenceKind = "verified" | "ai_inferred" | "user_entered";

export interface EvidenceItem {
  text: string;
  kind: EvidenceKind;
  source?: string;
}

export interface LeadResearch {
  knownInformation: string[];
  possibleSignals: string[];
  missingInformation: string[];
  whyThisLead: string;
  suggestedAngle: string;
}

export interface LeadScore {
  score: number;
  reasons: string[];
  confidence: "low" | "medium" | "high";
  recommendedAction?: string;
}

export interface GameAnalysisSummary {
  recruitingRelevant?: boolean;
  gameType?: string;
  summary?: string;
  confidence?: string;
  gender?: string;
  sport?: string;
  reason?: string;
  analyzedAt?: string;
  analysisBasis?: string;
}

export interface LeadDTO {
  _id: string;
  name: string;
  playerName?: string;
  contactType?: ContactType;
  sport?: string;
  position?: string;
  team?: string;
  graduationYear?: number;
  email?: string;
  socialUrl?: string;
  profileUrl?: string;
  gameId?: string | null;
  score?: number;
  scoreReasons?: string[];
  confidence?: string;
  recommendedAction?: string;
  status: LeadStatus;
  source?: string;
  verifiedInformation?: string[];
  inferredInformation?: string[];
  missingInformation?: string[];
  evidence?: EvidenceItem[];
  research?: LeadResearch;
  outreachMessage?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameDTO {
  _id: string;
  title: string;
  sport?: string;
  date?: string | null;
  teamA?: string;
  teamB?: string;
  gender?: string;
  graduationYear?: number;
  url?: string;
  source?: string;
  notes?: string;
  analysis?: GameAnalysisSummary;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachDTO {
  _id: string;
  leadId: string;
  message: string;
  channel?: "email" | "facebook" | "instagram" | "other";
  status: "draft" | "approved" | "sent" | "replied";
  sentAt?: string | null;
  createdAt: string;
}

export interface WebsiteDTO {
  _id: string;
  name: string;
  url: string;
  category: WebsiteCategory;
  sports: string[];
  region: string;
  access: string;
  description: string;
  useCase: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  highPotential: number;
  outreachPending: number;
  contacted: number;
  replied: number;
  converted: number;
}

export interface LeadFilters {
  q?: string;
  sport?: string;
  status?: string;
  minScore?: number;
  hasGame?: string;
  sort?: string;
}
